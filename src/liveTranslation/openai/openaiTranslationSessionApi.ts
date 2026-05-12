const DEFAULT_API_BASE = "http://localhost:8787";

export type OpenAITranslationTargetLanguage = "it" | "en";

export type OpenAITranslationNoiseReduction =
  | "near_field"
  | "far_field"
  | "disabled";

export type LiveTranslationBackendHealth = {
  ok: boolean;
  hasOpenAiKey: boolean;
  mode: string;
};

export type CreateOpenAITranslationSessionRequest = {
  targetLanguage?: OpenAITranslationTargetLanguage;
  noiseReduction?: OpenAITranslationNoiseReduction;
};

export type CreateOpenAITranslationSessionResponse = {
  clientSecret: string;
  expiresAt: number | null;
  session: {
    id: string;
    type: string;
    model: string;
    outputLanguage: OpenAITranslationTargetLanguage;
  };
};

function getApiBase() {
  return import.meta.env.VITE_LIVE_TRANSLATION_API_BASE || DEFAULT_API_BASE;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Live translation backend request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload;
}

async function requestBackend<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiBase = getApiBase();
  let response: Response;

  try {
    response = await fetch(`${apiBase}${path}`, init);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Unable to reach the live translation backend at ${apiBase}: ${error.message}`,
      );
    }

    throw new Error(`Unable to reach the live translation backend at ${apiBase}.`);
  }

  try {
    return await readJsonResponse<T>(response);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Live translation backend returned invalid JSON.");
    }

    throw error;
  }
}

export async function getLiveTranslationBackendHealth(): Promise<LiveTranslationBackendHealth> {
  return requestBackend<LiveTranslationBackendHealth>(
    "/api/live-translation/health",
  );
}

export async function createOpenAITranslationClientSecret(
  request: CreateOpenAITranslationSessionRequest,
): Promise<CreateOpenAITranslationSessionResponse> {
  return requestBackend<CreateOpenAITranslationSessionResponse>(
    "/api/live-translation/session",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );
}
