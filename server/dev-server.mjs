import { createServer } from "node:http";

const DEFAULT_PORT = 8787;
const DEV_MODE = "dev";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const OPENAI_TRANSLATION_CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/translations/client_secrets";
const VALID_TARGET_LANGUAGES = new Set(["it", "en"]);
const VALID_NOISE_REDUCTION_VALUES = new Set([
  "near_field",
  "far_field",
  "disabled",
]);

function getCorsHeaders(origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    };
  }

  return {};
}

function writeJson(response, statusCode, payload, origin) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...getCorsHeaders(origin),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (!chunks.length) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

function normalizeTargetLanguage(value) {
  if (typeof value !== "string" || !VALID_TARGET_LANGUAGES.has(value)) {
    return "it";
  }

  return value;
}

function normalizeNoiseReduction(value) {
  if (typeof value !== "string" || !VALID_NOISE_REDUCTION_VALUES.has(value)) {
    return "near_field";
  }

  return value;
}

async function createTranslationClientSecret({
  targetLanguage,
  noiseReduction,
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      statusCode: 500,
      payload: {
        error: "OPENAI_API_KEY is not configured on the local dev server.",
      },
    };
  }

  const openAiResponse = await fetch(OPENAI_TRANSLATION_CLIENT_SECRETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: 600,
      },
      session: {
        model: "gpt-realtime-translate",
        audio: {
          input: {
            transcription: {
              model: "gpt-realtime-whisper",
            },
            noise_reduction:
              noiseReduction === "disabled"
                ? null
                : { type: noiseReduction },
          },
          output: {
            language: targetLanguage,
          },
        },
      },
    }),
  });

  const responseText = await openAiResponse.text();
  let responseJson = null;

  if (responseText) {
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = null;
    }
  }

  if (!openAiResponse.ok) {
    const errorMessage =
      responseJson?.error?.message ||
      responseJson?.message ||
      "OpenAI rejected the translation session request.";

    return {
      ok: false,
      statusCode: openAiResponse.status,
      payload: {
        error: errorMessage,
        status: openAiResponse.status,
      },
    };
  }

  return {
    ok: true,
    statusCode: 200,
    payload: {
      clientSecret: responseJson?.value ?? "",
      expiresAt: responseJson?.expires_at ?? null,
      session: {
        id: responseJson?.session?.id ?? "",
        type: responseJson?.session?.type ?? "translation",
        model: responseJson?.session?.model ?? "gpt-realtime-translate",
        outputLanguage: targetLanguage,
      },
    },
  };
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      ...getCorsHeaders(origin),
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (
    request.method === "GET" &&
    url.pathname === "/api/live-translation/health"
  ) {
    writeJson(
      response,
      200,
      {
        ok: true,
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
        mode: DEV_MODE,
      },
      origin,
    );
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/live-translation/session"
  ) {
    try {
      const body = await readRequestBody(request);
      const targetLanguage = normalizeTargetLanguage(body?.targetLanguage);
      const noiseReduction = normalizeNoiseReduction(body?.noiseReduction);
      const sessionResult = await createTranslationClientSecret({
        targetLanguage,
        noiseReduction,
      });

      writeJson(
        response,
        sessionResult.statusCode,
        sessionResult.payload,
        origin,
      );
    } catch (error) {
      writeJson(
        response,
        400,
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to process the translation session request.",
        },
        origin,
      );
    }
    return;
  }

  writeJson(
    response,
    404,
    {
      error: "Route not found.",
    },
    origin,
  );
});

const port = Number(process.env.PORT || DEFAULT_PORT);

server.listen(port, () => {
  console.log(
    `Live translation dev server running on http://localhost:${port}`,
  );
});
