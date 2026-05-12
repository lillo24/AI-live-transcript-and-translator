# Codex Prompt — Live Translation Subtitles Plugin, Chapter 01

## Context

We are creating a new GitHub repository for a small React/TypeScript component/plugin that can later be inserted into my thesis presentation React app.

The long-term goal is:

```text
microphone input
-> OpenAI realtime translation
-> translated subtitles
-> subtitle overlay on top of a React slide/presentation app
```

But this first implementation must **not** integrate OpenAI yet.

This repo should start as a clean, detachable subtitle overlay module with a fake provider. The fake provider lets us test the UI, state model, and integration pattern before adding WebRTC/API complexity.

## Goal of this implementation

Create a minimal working React + TypeScript project that demonstrates a reusable live subtitle overlay plugin.

The app should show a demo page with:

- a fake slide/presentation area
- a subtitle overlay at the bottom
- controls to start/stop fake subtitles
- controls to show/hide subtitles
- a target language selector, even if it is not functionally used yet
- a clean internal structure that can later receive a real OpenAI provider

## Important design principle

Make this **detachable**, but do not over-engineer it.

The plugin should be easy to copy or import later into another React app, especially my thesis presentation app.

Good enough modularity:

```text
src/liveTranslation/
  index.ts
  types.ts
  LiveTranslationProvider.tsx
  LiveSubtitleOverlay.tsx
  useLiveTranslation.ts
  providers/
    FakeTranslationProvider.ts
```

The demo app can live outside the plugin:

```text
src/App.tsx
src/main.tsx
```

Do not build a library packaging system yet unless the repo already has one. A normal Vite React app is enough for now.

## Tech assumptions

Use:

- React
- TypeScript
- Vite
- plain CSS or CSS modules

Avoid:

- OpenAI API
- WebRTC
- backend code
- microphone permissions
- complex package publishing setup
- Redux/Zustand unless already present
- unnecessary UI libraries

## Functional requirements

### 1. LiveTranslationProvider

Create a provider that owns subtitle state.

It should expose a controller through context/hook.

Suggested state:

```ts
export type SubtitleStatus =
  | "idle"
  | "starting"
  | "listening"
  | "error";

export type SubtitleLine = {
  id: string;
  text: string;
  isFinal: boolean;
  createdAt: number;
};

export type TargetLanguage = "it" | "en";

export type LiveTranslationState = {
  status: SubtitleStatus;
  isVisible: boolean;
  targetLanguage: TargetLanguage;
  currentPartial: string | null;
  recentFinals: SubtitleLine[];
  errorMessage: string | null;
};

export type LiveTranslationController = LiveTranslationState & {
  start: () => Promise<void>;
  stop: () => void;
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  setTargetLanguage: (language: TargetLanguage) => void;
  clearSubtitles: () => void;
};
```

You may adjust names slightly if needed, but keep the same concept.

### 2. FakeTranslationProvider

Create a fake provider that simulates realtime translated subtitles.

It should emit fake partial/final subtitle updates over time.

Example behavior:

```text
partial: "This is..."
partial: "This is a fake..."
final:   "This is a fake translated subtitle."
partial: "Later this..."
partial: "Later this will come..."
final:   "Later this will come from OpenAI realtime translation."
```

The goal is to test UI behavior that resembles realtime transcript deltas.

It should be cancellable when `stop()` is called.

Avoid memory leaks:
- clear timers/intervals
- do not update state after stop/unmount

### 3. LiveSubtitleOverlay

Create a bottom subtitle overlay component.

It should:

- appear fixed at the bottom of the viewport
- be readable over slide content
- show the current partial subtitle when present
- otherwise show the most recent final subtitle
- have a subtle visual difference for partial text, e.g. opacity or italic
- hide completely when `isVisible === false`
- not block pointer interactions with the slide content if possible

Keep styling simple and robust.

Example visual target:

```text
┌────────────────────────────────────────────┐
│                                            │
│                 Fake Slide                 │
│                                            │
│        [ translated subtitle here ]         │
└────────────────────────────────────────────┘
```

### 4. Demo controls

In `App.tsx`, create a basic demo page.

Include:

- fake slide area
- Start button
- Stop button
- Show/Hide subtitles button
- Clear subtitles button
- target language selector: Italian / English
- small status indicator

Do not make the demo beautiful. Make it clear and usable.

### 5. Keyboard shortcuts

Add simple keyboard shortcuts:

```text
S = show/hide subtitles
M = start/stop fake subtitles
Escape = stop fake subtitles
```

Make sure shortcuts do not break text inputs/selects.

### 6. Export surface

Create `src/liveTranslation/index.ts` that exports the useful pieces:

```ts
export * from "./types";
export { LiveTranslationProvider } from "./LiveTranslationProvider";
export { LiveSubtitleOverlay } from "./LiveSubtitleOverlay";
export { useLiveTranslation } from "./useLiveTranslation";
```

This is important because later the thesis app should only need clean imports from this folder.

## Non-goals

Do not implement:

- OpenAI API calls
- WebRTC
- microphone selection
- backend session endpoint
- actual translation
- speech-to-speech audio playback
- transcript saving
- multi-speaker support
- npm package publishing
- complex styling system

Those will be later chapters.

## Expected final structure

Aim for something close to:

```text
src/
  App.tsx
  main.tsx
  liveTranslation/
    index.ts
    types.ts
    LiveTranslationProvider.tsx
    LiveSubtitleOverlay.tsx
    useLiveTranslation.ts
    providers/
      FakeTranslationProvider.ts
  styles.css
```

If the repo uses a different default Vite structure, adapt minimally.

## Quality checks

After implementation:

1. Run install/build checks available in the repo.
2. Fix TypeScript errors.
3. Make sure fake subtitles start and stop reliably.
4. Make sure the overlay can be hidden.
5. Make sure removing `LiveSubtitleOverlay` does not break the rest of the app.
6. Make sure the provider cleans up timers on unmount.

## Deliverable summary

At the end, report:

- files created/modified
- how to run the demo
- what shortcuts exist
- what is intentionally not implemented yet
- any assumptions made about the repo setup

## Success definition

This chapter is successful when I can run the new repo locally and see fake live subtitles over a fake React slide, with start/stop and show/hide controls.

The code should make it obvious where the real OpenAI WebRTC provider will plug in later, but it should not implement that yet.
