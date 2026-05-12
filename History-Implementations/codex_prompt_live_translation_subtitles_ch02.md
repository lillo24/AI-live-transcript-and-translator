# Codex Prompt — Live Translation Subtitles Plugin, Chapter 02

## Context

We are continuing the standalone repo:

```text
AI-live-transcript-and-translator
```

Chapter 01 already created a Vite React/TypeScript demo app with a detached `src/liveTranslation/` plugin:

```text
src/liveTranslation/
  index.ts
  types.ts
  LiveTranslationProvider.tsx
  LiveSubtitleOverlay.tsx
  useLiveTranslation.ts
  providers/FakeTranslationProvider.ts
```

The current app has:

- a fake slide/demo page
- fake subtitles
- start/stop controls
- show/hide controls
- target language selector
- keyboard shortcuts

This chapter should polish the plugin architecture and controls before adding OpenAI/WebRTC.

Do **not** add OpenAI yet.

## Goal of this implementation

Turn the Chapter 01 demo into a more robust, reusable “presentation subtitle plugin” skeleton.

The main goals are:

1. Make plugin configuration explicit.
2. Make the overlay safer for real presentations.
3. Improve keyboard/visibility controls.
4. Add a development “manual subtitle test” mode.
5. Prepare a clean provider interface for the future OpenAI WebRTC provider.
6. Keep everything removable/importable from `src/liveTranslation`.

## Important constraint

The feature must stay detachable.

The presentation app should depend on the plugin only through:

```ts
import {
  LiveTranslationProvider,
  LiveSubtitleOverlay,
  useLiveTranslation,
} from "./liveTranslation";
```

Avoid spreading subtitle-specific logic across unrelated app files.

## Non-goals

Do not implement:

- OpenAI API
- WebRTC
- backend session endpoint
- microphone permission
- real audio capture
- translated audio playback
- transcript persistence
- packaging/publishing to npm
- complex UI framework

This chapter is still fake/local-only.

---

# Required changes

## 1. Add explicit plugin config

Create a small config shape in `src/liveTranslation/types.ts`.

Suggested type:

```ts
export type LiveTranslationProviderKind = "fake";

export type LiveTranslationConfig = {
  providerKind: LiveTranslationProviderKind;
  defaultVisible: boolean;
  defaultTargetLanguage: TargetLanguage;
  maxRecentFinals: number;
  overlayPosition: "bottom" | "top";
  enableKeyboardShortcuts: boolean;
};
```

Then allow `LiveTranslationProvider` to receive a config prop:

```ts
<LiveTranslationProvider
  config={{
    providerKind: "fake",
    defaultVisible: true,
    defaultTargetLanguage: "it",
    maxRecentFinals: 4,
    overlayPosition: "bottom",
    enableKeyboardShortcuts: true,
  }}
>
```

Important: do not over-engineer this. For now `providerKind` can only be `"fake"`, but the type should make it obvious that `"openai-webrtc"` will be added later.

Keep backward compatibility if easy, but the demo can be updated to use the new config explicitly.

## 2. Move keyboard shortcuts into the plugin

Right now keyboard handling lives in `App.tsx`.

Move keyboard shortcut handling into the plugin layer, preferably inside `LiveTranslationProvider` or a dedicated internal hook such as:

```text
src/liveTranslation/useLiveTranslationShortcuts.ts
```

Shortcuts:

```text
S = show/hide subtitles
M = start/stop fake subtitles
Escape = stop subtitles
```

Requirements:

- shortcuts should be enabled only when `config.enableKeyboardShortcuts === true`
- shortcuts should ignore editable elements:
  - input
  - textarea
  - select
  - contenteditable
- do not break the target language selector
- avoid stale state bugs
- clean up event listeners on unmount

React 19 is available in this repo, but keep the implementation readable. If you use `useEffectEvent`, that is acceptable; if you avoid it, make sure dependencies are correct.

## 3. Add manual subtitle test mode

Add controller methods that let the host app manually set fake subtitle text.

Suggested additions:

```ts
setManualPartial: (text: string) => void;
commitManualFinal: (text: string) => void;
```

Behavior:

- `setManualPartial("...")` sets `currentPartial`
- `commitManualFinal("...")` pushes a final subtitle line into `recentFinals` and clears `currentPartial`
- both should work even when the fake provider is not running
- this is for UI testing and future demo fallback

In `App.tsx`, add a small dev panel:

- input text field
- button: “Show as partial”
- button: “Commit as final”
- button: “Use sample subtitle”

This matters because for a thesis presentation we need a fallback way to test/show the overlay without microphone/API.

## 4. Make overlay position configurable

Update `LiveSubtitleOverlay` so it can render at:

```text
bottom
top
```

It should read this from plugin config/state.

Default is bottom.

Top mode should be useful if the bottom of a slide contains important content.

Suggested behavior:

- bottom: fixed at bottom with bottom padding
- top: fixed at top with top padding
- same bubble styling
- still `pointer-events: none`

Do not add many positions yet. Just top/bottom.

## 5. Add a compact overlay variant option, but keep it simple

Add a config option or prop for overlay density:

```ts
overlayDensity?: "comfortable" | "compact";
```

If easier, put this directly as a prop on `LiveSubtitleOverlay`:

```tsx
<LiveSubtitleOverlay density="comfortable" />
```

Requirements:

- comfortable = current size
- compact = smaller padding/font size
- keep readable

Do not create a large theming system.

## 6. Improve fake provider control edge cases

Check and fix if needed:

- calling `start()` twice should not create two fake streams
- calling `stop()` should clear all pending timeouts
- changing target language while currently listening should be handled predictably

For changing target language while listening, choose this simple rule:

```text
When targetLanguage changes, do not automatically restart.
The new language is used on the next start.
```

Optional but useful: expose this in the UI as small helper text.

## 7. Add provider lifecycle clarity

Improve provider/session types so the future real provider will be easier to add.

You can adjust naming, but keep it simple.

Suggested types:

```ts
export type TranslationProviderStartOptions = {
  targetLanguage: TargetLanguage;
  onListening: () => void;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
};

export type TranslationProviderSession = {
  stop: () => void;
};

export type TranslationProviderAdapter = {
  kind: LiveTranslationProviderKind;
  start: (
    options: TranslationProviderStartOptions,
  ) => TranslationProviderSession | Promise<TranslationProviderSession>;
};
```

Then update the fake provider:

```ts
export const fakeTranslationProvider: TranslationProviderAdapter = {
  kind: "fake",
  start(options) {
    ...
  }
};
```

This makes the later OpenAI provider shape obvious.

## 8. Improve demo copy

Update app labels from “Chapter 01 Demo” to “Chapter 02 Demo”.

The demo should clearly say:

```text
This repo currently uses a fake provider.
OpenAI/WebRTC is intentionally not implemented yet.
```

## 9. Add a small implementation note file

Create:

```text
docs/chapter-02-notes.md
```

Include:

- what Chapter 02 added
- what is still fake
- why manual subtitle mode exists
- what Chapter 03 should probably do next

Keep it short.

## 10. Update history folder

If the repo has:

```text
History-Implementations/
```

add this prompt there as:

```text
History-Implementations/codex_prompt_live_translation_subtitles_ch02.md
```

Do not delete the Chapter 01 prompt.

---

# Expected final structure

Aim for something close to:

```text
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
    useLiveTranslationShortcuts.ts      // optional but recommended
    providers/
      FakeTranslationProvider.ts
docs/
  chapter-02-notes.md
History-Implementations/
  codex_prompt_live_translation_subtitles_ch01.md
  codex_prompt_live_translation_subtitles_ch02.md
```

## Quality checks

Run:

```bash
npm run build
```

Fix all TypeScript/build errors.

Also manually reason through:

1. Start fake subtitles.
2. Stop fake subtitles.
3. Press `S` to hide/show.
4. Press `M` to start/stop.
5. Press `Escape` to stop.
6. Type in manual subtitle input and ensure shortcuts do not trigger while typing.
7. Show manual partial.
8. Commit manual final.
9. Switch overlay top/bottom if exposed in the UI.
10. Switch target language and confirm it affects next fake start.

## Deliverable summary

At the end, report:

- files created/modified
- whether `npm run build` passes
- how the new config works
- what keyboard shortcuts are now plugin-owned
- what manual subtitle mode does
- what remains intentionally unimplemented

## Success definition

Chapter 02 is successful when the repo still runs as a local React demo, but the subtitle system is now clearly configurable, safer for presentation use, and easier to integrate later into the thesis React slide app.

The real OpenAI/WebRTC provider should still be a future chapter, not part of this one.
