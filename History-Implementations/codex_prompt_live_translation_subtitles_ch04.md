# Codex Prompt — Live Translation Subtitles Plugin, Chapter 04

## Context

We are continuing the standalone repo:

```text
AI-live-transcript-and-translator
```

Current state after Chapter 03:

- React + TypeScript + Vite demo app
- detached `src/liveTranslation/` subtitle plugin
- fake subtitles provider
- manual subtitle fallback mode
- microphone capture sandbox
- audio input device selection
- live input level meter

Chapter 03 proved the browser-side microphone layer.

The next step is **not** full OpenAI WebRTC translation yet.

The next step is to add the safe server-side piece that creates short-lived OpenAI Realtime Translation client secrets.

OpenAI's current Realtime Translation flow is:

```text
browser
  -> asks our server for short-lived translation client secret
  -> browser later uses that client secret for WebRTC session
```

The real OpenAI API key must stay on the server.

Official details this prompt is based on:

- create translation client secret endpoint:
  `POST https://api.openai.com/v1/realtime/translations/client_secrets`
- model:
  `gpt-realtime-translate`
- optional source transcript model:
  `gpt-realtime-whisper`
- client secrets are short-lived and safe to pass to browser clients
- browser WebRTC connection will be a later chapter

## Goal of this implementation

Add a minimal local development backend that can create an OpenAI Realtime Translation client secret, plus a frontend smoke-test panel to request one.

This chapter should prove:

```text
local React app
-> local dev backend
-> OpenAI client-secret endpoint
-> client secret response reaches frontend
```

But it should **not** open a WebRTC session yet.

## Important scope boundary

Do **not** implement the real translation provider yet.

No RTCPeerConnection.
No SDP offer.
No `/v1/realtime/translations/calls` request.
No translated transcript events.
No audio sent to OpenAI yet.

This chapter only creates and tests the server-side session/client-secret layer.

---

# Pre-flight fix required

Before adding new features, fix the Chapter 03 layout bug:

In the microphone capture sandbox, long audio device names can overlap between:

```text
Audio input device
Selected device
```

Update CSS/layout so:

- the two columns never overlap
- long device names truncate with ellipsis
- select and selected-device value stay inside their containers
- responsive/mobile layout still works
- no behavior changes

Likely CSS concepts needed:

```css
grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
min-width: 0;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
```

Apply this only where needed.

---

# Required changes

## 1. Add local dev backend

Create:

```text
server/dev-server.mjs
```

Use a small Node server. Prefer built-in Node `http` + `fetch` to avoid adding backend dependencies.

The server should listen on:

```text
http://localhost:8787
```

unless overridden by:

```text
PORT=8787
```

Add routes:

```text
GET  /api/live-translation/health
POST /api/live-translation/session
```

### Health endpoint

`GET /api/live-translation/health`

Return JSON:

```json
{
  "ok": true,
  "hasOpenAiKey": true,
  "mode": "dev"
}
```

Rules:

- `hasOpenAiKey` is `Boolean(process.env.OPENAI_API_KEY)`
- do not return the actual key
- do not crash if the key is missing

### Session endpoint

`POST /api/live-translation/session`

Input body:

```json
{
  "targetLanguage": "it",
  "noiseReduction": "near_field"
}
```

Suggested TypeScript/frontend equivalent:

```ts
export type OpenAITranslationTargetLanguage = "it" | "en";

export type OpenAITranslationNoiseReduction =
  | "near_field"
  | "far_field"
  | "disabled";
```

Server validation:

- allow only target languages currently used by this demo: `"it"` and `"en"`
- allow only noise reduction values:
  - `"near_field"`
  - `"far_field"`
  - `"disabled"`
- default `targetLanguage` to `"it"`
- default `noiseReduction` to `"near_field"`
- if `OPENAI_API_KEY` is missing, return HTTP 500 with a clear JSON error
- if OpenAI returns an error, forward a safe error shape to the browser
- never log the full client secret
- never log the OpenAI API key

Request to OpenAI:

```js
fetch("https://api.openai.com/v1/realtime/translations/client_secrets", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
```

Expected OpenAI response contains:

```json
{
  "value": "ek_...",
  "expires_at": 1234567890,
  "session": {
    "id": "sess_...",
    "type": "translation",
    "model": "gpt-realtime-translate"
  }
}
```

Your backend can return a normalized response to the frontend:

```json
{
  "clientSecret": "ek_...",
  "expiresAt": 1234567890,
  "session": {
    "id": "sess_...",
    "type": "translation",
    "model": "gpt-realtime-translate",
    "outputLanguage": "it"
  }
}
```

Important: returning the client secret to the browser is expected. It is short-lived. But the UI should not display the full value.

## 2. CORS handling for local dev

Because Vite and the backend run on different ports, add simple CORS support.

Allow local dev origins:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Also handle `OPTIONS` preflight requests.

Do not make this production-perfect. It is a local dev backend.

## 3. Add npm scripts

Update `package.json`.

Add:

```json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "node server/dev-server.mjs",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

Do not break existing scripts.

Do not add `concurrently` yet unless absolutely necessary. Running two terminals is fine.

## 4. Add environment example

Create:

```text
.env.example
```

Include:

```text
# Server-side only. Never expose this through Vite.
OPENAI_API_KEY=your_openai_api_key_here

# Optional local backend port.
PORT=8787

# Frontend API base. The app defaults to this if omitted.
VITE_LIVE_TRANSLATION_API_BASE=http://localhost:8787
```

Do not create or commit a real `.env`.

Make sure `.gitignore` ignores `.env` if it does not already.

## 5. Add frontend API client

Create:

```text
src/liveTranslation/openai/openaiTranslationSessionApi.ts
```

Responsibilities:

- call the local backend health endpoint
- call the local backend session endpoint
- expose typed functions
- provide readable errors

Suggested functions:

```ts
export async function getLiveTranslationBackendHealth(): Promise<LiveTranslationBackendHealth>;

export async function createOpenAITranslationClientSecret(
  request: CreateOpenAITranslationSessionRequest,
): Promise<CreateOpenAITranslationSessionResponse>;
```

Suggested types can live here or in `types.ts`.

Use `import.meta.env.VITE_LIVE_TRANSLATION_API_BASE`, defaulting to:

```text
http://localhost:8787
```

## 6. Add frontend smoke-test panel

Create:

```text
src/liveTranslation/openai/OpenAITranslationSessionPanel.tsx
```

This panel is only for development.

UI should include:

- backend health check button
- create client secret button
- target language selector: Italian / English
- noise reduction selector:
  - near_field: close microphone / wireless lav mic
  - far_field: laptop / room mic
  - disabled
- status display
- safe error display
- safe session display:
  - session id
  - model
  - output language
  - expiration time
  - masked client secret preview only, e.g. `ek_abc...xyz`

Important:

- do not display the full client secret
- do not store the client secret in localStorage/sessionStorage
- keep it in component state only
- make clear in the UI:
  `This only creates a short-lived OpenAI translation session secret. It does not start WebRTC translation yet.`

## 7. Integrate panel into App.tsx

Add a new demo section:

```text
OpenAI session smoke test
```

It should sit after or near the microphone capture sandbox.

The app should now demonstrate three independent layers:

```text
1. Fake subtitle overlay
2. Local microphone capture
3. OpenAI client-secret backend smoke test
```

If the backend is not running, the app should still load and fake subtitles/mic sandbox should still work.

## 8. Export useful OpenAI session pieces

Update:

```text
src/liveTranslation/index.ts
```

Export:

```ts
export { OpenAITranslationSessionPanel } from "./openai/OpenAITranslationSessionPanel";
export {
  getLiveTranslationBackendHealth,
  createOpenAITranslationClientSecret,
} from "./openai/openaiTranslationSessionApi";
```

Do not export unnecessary internals.

## 9. Documentation

Create:

```text
docs/chapter-04-notes.md
```

Include:

- what Chapter 04 added
- how to run frontend and backend
- how to set `OPENAI_API_KEY`
- what the smoke test proves
- why the API key stays on the server
- what remains unimplemented
- what Chapter 05 should probably do next

Keep it short and practical.

Suggested run instructions:

PowerShell:

```powershell
cd C:\Users\leona\Documents\GitHub\AI-live-transcript-and-translator

$env:OPENAI_API_KEY="YOUR_KEY"
npm run dev:server

# in another terminal
npm run dev
```

Then open:

```text
http://localhost:5173
```

## 10. Update history folder

If the repo has:

```text
History-Implementations/
```

add this prompt there as:

```text
History-Implementations/codex_prompt_live_translation_subtitles_ch04.md
```

Do not delete earlier prompts.

---

# Expected final structure

Aim for something close to:

```text
server/
  dev-server.mjs
src/
  App.tsx
  main.tsx
  styles.css
  liveTranslation/
    index.ts
    types.ts
    LiveTranslationProvider.tsx
    LiveSubtitleOverlay.tsx
    useLiveTranslation.ts
    useLiveTranslationShortcuts.ts
    providers/
      FakeTranslationProvider.ts
    audio/
      audioDevices.ts
      useMicrophoneCapture.ts
      AudioInputPanel.tsx
      AudioLevelMeter.tsx
    openai/
      openaiTranslationSessionApi.ts
      OpenAITranslationSessionPanel.tsx
docs/
  chapter-02-notes.md
  chapter-03-notes.md
  chapter-04-notes.md
History-Implementations/
  codex_prompt_live_translation_subtitles_ch01.md
  codex_prompt_live_translation_subtitles_ch02.md
  codex_prompt_live_translation_subtitles_ch03.md
  codex_prompt_live_translation_subtitles_ch04.md
.env.example
```

## Manual test checklist

After implementation, test:

### Build/static checks

1. `npm run build` passes.
2. `node --check server/dev-server.mjs` passes if available.
3. App still loads without backend running.
4. Fake subtitles still work.
5. Microphone sandbox still works.
6. Long device names no longer overlap.

### Backend without key

1. Start server without `OPENAI_API_KEY`.
2. Health endpoint returns `hasOpenAiKey: false`.
3. Session creation returns a readable error.
4. Frontend displays the error cleanly.

### Backend with key

PowerShell:

```powershell
$env:OPENAI_API_KEY="YOUR_KEY"
npm run dev:server
```

Then in another terminal:

```powershell
npm run dev
```

Test:

1. Health check returns `hasOpenAiKey: true`.
2. Create client secret for Italian.
3. Create client secret for English.
4. Try near_field/far_field/disabled.
5. UI shows session metadata.
6. UI only shows a masked client secret preview.
7. Browser console does not show the full secret unless unavoidable from network response inspection.
8. Server logs do not print secrets.

## Deliverable summary

At the end, report:

- files created/modified
- whether `npm run build` passes
- whether `node --check server/dev-server.mjs` passes
- how to run frontend + backend
- how the health endpoint behaves with/without key
- whether client-secret creation was tested with a real key
- what is still intentionally unimplemented
- any API or browser limitations found

## Success definition

Chapter 04 is successful when the local frontend can ask the local backend to create a short-lived OpenAI Realtime Translation client secret, and the response is displayed safely in the app.

No audio should be sent to OpenAI yet.

This sets up Chapter 05, where we can add the actual OpenAI WebRTC translation provider.
