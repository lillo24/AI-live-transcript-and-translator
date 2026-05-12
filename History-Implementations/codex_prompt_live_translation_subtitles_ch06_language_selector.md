# Codex Prompt — Live Translation Subtitles Plugin, Chapter 06

## Context

We are continuing the standalone repo:

```text
AI-live-transcript-and-translator
```

Current state after Chapter 05 according to the latest implementation summary:

- React + TypeScript + Vite demo app
- detached `src/liveTranslation/` subtitle plugin
- fake subtitle provider
- microphone capture sandbox
- local Node dev backend
- OpenAI Realtime Translation client-secret smoke test
- experimental OpenAI WebRTC realtime translation provider
- realtime panel with target language currently handled locally/inline

Now we need a cleaner language selector component and proper backend wiring so the chosen target language is used consistently when creating the `gpt-realtime-translate` session.

Important terminology:

- The user chooses the **target/output language**.
- The source/input language is auto-detected by `gpt-realtime-translate`.
- Do not call it “source language” in the UI.
- Do not expose model/API complexity in the main selector.

## Goal of this implementation

Create a reusable UI component for choosing the translation output language and wire it end-to-end:

```text
Language selector UI
-> frontend translation session request
-> local backend validation
-> OpenAI client-secret request
-> session.audio.output.language
-> OpenAI WebRTC translation provider
```

This should remove duplicated language dropdown logic from the OpenAI smoke-test panel and the realtime translation panel.

## Important correction

Use the real model name:

```text
gpt-realtime-translate
```

Do not call it `gpt-translate` in code.

---

# Required changes

## 1. Add shared supported language registry

Create:

```text
src/liveTranslation/languages.ts
```

Define a single source of truth for output languages.

Suggested type:

```ts
export type TranslationLanguageCode =
  | "en"
  | "it"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ja"
  | "zh"
  | "ko"
  | "hi"
  | "id"
  | "vi"
  | "ru";
```

Suggested registry:

```ts
export type TranslationLanguageOption = {
  code: TranslationLanguageCode;
  label: string;
  nativeLabel?: string;
  helper?: string;
};

export const TRANSLATION_LANGUAGE_OPTIONS: TranslationLanguageOption[] = [
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "zh", label: "Chinese", nativeLabel: "中文" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  { code: "ru", label: "Russian", nativeLabel: "Русский" },
];
```

Also export helpers:

```ts
export function isTranslationLanguageCode(value: unknown): value is TranslationLanguageCode;
export function getTranslationLanguageLabel(code: TranslationLanguageCode): string;
```

If the existing code has a `TargetLanguage` type, either replace it with `TranslationLanguageCode` or alias it:

```ts
export type TargetLanguage = TranslationLanguageCode;
```

Prefer the least disruptive migration.

## 2. Add reusable language selector component

Create:

```text
src/liveTranslation/LanguageSelector.tsx
```

Component API:

```ts
export type LanguageSelectorProps = {
  value: TranslationLanguageCode;
  onChange: (language: TranslationLanguageCode) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  compact?: boolean;
  id?: string;
};
```

Behavior:

- renders a normal accessible `<select>`
- uses `TRANSLATION_LANGUAGE_OPTIONS`
- shows label like `Translate into`
- shows helper text:
  `Source language is detected automatically.`
- supports compact layout for narrow panels
- does not overflow when language names are long
- no custom dropdown library

UI copy recommendation:

```text
Translate into
[ Italian / Italiano v ]
Source language is detected automatically.
```

Avoid ambiguous labels like:

```text
Language
Source language
Input language
```

## 3. Replace duplicated selectors in frontend panels

Update both:

```text
src/liveTranslation/openai/OpenAITranslationSessionPanel.tsx
src/liveTranslation/openai/OpenAIRealtimeTranslationPanel.tsx
```

Replace inline target-language `<select>` elements with:

```tsx
<LanguageSelector
  value={targetLanguage}
  onChange={setTargetLanguage}
  label="Translate into"
/>
```

The selected language must be passed into the existing request path.

## 4. Wire language into OpenAI session API types

Update:

```text
src/liveTranslation/openai/openaiTranslationSessionApi.ts
```

Make `targetLanguage` use the shared type:

```ts
import type { TranslationLanguageCode } from "../languages";

export type CreateOpenAITranslationSessionRequest = {
  targetLanguage: TranslationLanguageCode;
  noiseReduction: OpenAITranslationNoiseReduction;
};
```

Make sure `createOpenAITranslationClientSecret(...)` sends:

```json
{
  "targetLanguage": "<selected-language>",
  "noiseReduction": "<selected-noise-reduction>"
}
```

No hardcoded `"it"` or `"en"` should remain in the request path except defaults.

## 5. Wire language into WebRTC provider start options

Update the provider start options in `types.ts` if needed:

```ts
targetLanguage: TranslationLanguageCode;
```

Then verify:

```text
OpenAIRealtimeTranslationPanel
-> controller.start()
-> OpenAIRealtimeTranslationProvider.start(options)
-> createOpenAITranslationClientSecret({ targetLanguage, noiseReduction })
-> backend session.audio.output.language = targetLanguage
```

This is the critical end-to-end path.

## 6. Update backend validation

Update:

```text
server/dev-server.mjs
```

Currently it likely validates only:

```text
it
en
```

Replace that with the full shared language list.

Because the backend is plain JS, define the same allowed codes there:

```js
const SUPPORTED_TRANSLATION_LANGUAGE_CODES = new Set([
  "en",
  "it",
  "es",
  "fr",
  "de",
  "pt",
  "ja",
  "zh",
  "ko",
  "hi",
  "id",
  "vi",
  "ru",
]);
```

Validation rules:

- default to `"it"`
- reject unsupported language codes with HTTP 400
- response should clearly say which code was invalid
- do not crash
- still validate `noiseReduction`

When creating the OpenAI client-secret request, confirm it sends:

```js
session: {
  model: "gpt-realtime-translate",
  audio: {
    output: {
      language: targetLanguage,
    },
    ...
  },
}
```

Do not accidentally hardcode Italian/English.

## 7. Backend response should echo selected language

Normalize backend response as before, but include:

```json
{
  "session": {
    "outputLanguage": "fr"
  }
}
```

The frontend panel should display this as a safe session detail:

```text
Output language: French
```

Use the shared label helper where possible.

## 8. Optional but useful: remember last selected language

Add a very small local preference hook if simple:

```text
src/liveTranslation/useStoredTranslationLanguage.ts
```

Behavior:

- stores only the language code in `localStorage`
- key: `liveTranslation.targetLanguage`
- validates stored value with `isTranslationLanguageCode`
- falls back to `"it"`
- should not crash if localStorage is unavailable

Use it in the demo panels only.

If this adds too much churn, skip it. The required part is end-to-end wiring.

## 9. Styling

Update `src/styles.css`.

Requirements:

- language selector fits inside cards
- long native labels do not overflow
- compact mode works in narrow rows
- helper text wraps safely
- no horizontal page scroll

Use the same overflow-safe principles from Chapter 05.

## 10. Documentation

Create:

```text
docs/chapter-06-notes.md
```

Include:

- what Chapter 06 added
- target language vs source language explanation
- how the selected language reaches the backend
- how the backend validates language codes
- how to test multiple languages
- what remains intentionally unimplemented

Keep it short.

## 11. Update history folder

If the repo has:

```text
History-Implementations/
```

add this prompt there as:

```text
History-Implementations/codex_prompt_live_translation_subtitles_ch06.md
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
    languages.ts
    LanguageSelector.tsx
    LiveTranslationProvider.tsx
    LiveSubtitleOverlay.tsx
    useLiveTranslation.ts
    useLiveTranslationShortcuts.ts
    providers/
      FakeTranslationProvider.ts
      OpenAIRealtimeTranslationProvider.ts
    audio/
      audioDevices.ts
      useMicrophoneCapture.ts
      AudioInputPanel.tsx
      AudioLevelMeter.tsx
    openai/
      openaiTranslationSessionApi.ts
      OpenAITranslationSessionPanel.tsx
      OpenAIRealtimeTranslationPanel.tsx
docs/
  chapter-06-notes.md
History-Implementations/
  codex_prompt_live_translation_subtitles_ch06.md
```

---

# Manual test checklist

## Static checks

1. `npm run build` passes.
2. `node --check server/dev-server.mjs` passes.
3. No TypeScript errors.
4. No duplicated inline target-language option lists remain in panels.

## UI checks

5. Smoke-test panel uses the new language selector.
6. Realtime panel uses the new language selector.
7. Label says `Translate into`.
8. Helper says source language is auto-detected.
9. Long labels/native labels do not overflow.
10. Narrow viewport wraps cleanly.

## Backend without key

11. Start backend without `OPENAI_API_KEY`.
12. Health still works.
13. Creating session with supported language gives the existing missing-key error.
14. Creating session with unsupported language returns HTTP 400 before key check.

## Backend validation

Use curl/PowerShell or the browser panel.

Test valid codes:

```text
it
en
es
fr
de
```

At least one non-Italian/English code must reach the backend as `targetLanguage`.

Test invalid code:

```json
{
  "targetLanguage": "xx",
  "noiseReduction": "near_field"
}
```

Expected:

```text
HTTP 400 with readable invalid language error
```

## Real path

With a real key:

1. Choose French.
2. Create session.
3. Confirm frontend displays output language French.
4. Start realtime translation with French selected.
5. Confirm the provider sends selected language to session creation.
6. Stop cleanly.
7. Repeat with Italian or English.

## Deliverable summary

At the end, report:

- files created/modified
- whether `npm run build` passes
- whether `node --check server/dev-server.mjs` passes
- which language codes are supported
- where the shared language selector is used
- how backend validation works
- whether a non-Italian/English language was tested
- what remains intentionally unimplemented
- any weird behavior found

## Success definition

Chapter 06 is successful when the user can choose the translation output language from one reusable UI component, and that exact selected language is validated by the local backend and used in the `gpt-realtime-translate` session configuration.

The source language should remain auto-detected and should not be exposed as a required user choice.
