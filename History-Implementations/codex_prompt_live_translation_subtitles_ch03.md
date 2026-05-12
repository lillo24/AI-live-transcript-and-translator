# Codex Prompt — Live Translation Subtitles Plugin, Chapter 03

## Context

We are continuing the standalone repo:

```text
AI-live-transcript-and-translator
```

The project is a React + TypeScript + Vite app that demonstrates a detachable live subtitle plugin.

Current state after Chapter 02:

```text
src/liveTranslation/
  index.ts
  types.ts
  LiveTranslationProvider.tsx
  LiveSubtitleOverlay.tsx
  useLiveTranslation.ts
  useLiveTranslationShortcuts.ts
  providers/
    FakeTranslationProvider.ts
```

Chapter 02 added:

- explicit plugin config
- fake translation provider adapter shape
- plugin-owned keyboard shortcuts
- manual subtitle fallback/testing mode
- configurable overlay position and density
- docs/chapter-02-notes.md

The next risk is not OpenAI yet. The next risk is microphone capture.

Before adding OpenAI/WebRTC, we need to verify that the browser can:

```text
see available audio input devices
let the user choose one
request microphone permission
capture audio from the selected device
show a simple live input level
stop and clean up correctly
```

This matters because the final use case may involve a laptop microphone or an external wireless mic such as a DJI/RØDE receiver.

## Goal of this implementation

Add a detached microphone capture sandbox to the existing demo.

This chapter should prove the audio input layer works, but it must **not** send audio anywhere yet.

The flow should be:

```text
select microphone
-> start microphone capture
-> show status
-> show simple live volume/input level
-> stop capture
```

No OpenAI. No backend. No translation API. No WebRTC connection to OpenAI.

## Important design principle

Keep microphone capture separate from subtitle generation.

Do **not** tightly couple microphone capture to `FakeTranslationProvider`.

The fake subtitle provider should still work without a microphone.

The microphone capture layer is preparation for a future real OpenAI WebRTC provider, but it should be independently testable.

Good target structure:

```text
src/liveTranslation/
  audio/
    audioDevices.ts
    useMicrophoneCapture.ts
    AudioInputPanel.tsx
    AudioLevelMeter.tsx
```

If you choose slightly different names, keep the same separation.

## Non-goals

Do not implement:

- OpenAI API calls
- backend client-secret endpoint
- WebRTC session to OpenAI
- realtime translation
- real transcription
- speech-to-speech output
- audio recording/export
- transcript persistence
- noise suppression UI beyond simple browser constraints
- complex audio processing
- npm packaging

This chapter is local browser microphone capture only.

---

# Required changes

## 1. Add microphone/audio types

Add or extend types in `src/liveTranslation/types.ts`.

Suggested types:

```ts
export type MicrophoneCaptureStatus =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "capturing"
  | "error";

export type AudioInputDevice = {
  deviceId: string;
  label: string;
  groupId?: string;
};

export type MicrophoneCaptureState = {
  status: MicrophoneCaptureStatus;
  devices: AudioInputDevice[];
  selectedDeviceId: string | null;
  stream: MediaStream | null;
  inputLevel: number;
  errorMessage: string | null;
  permissionGranted: boolean;
};
```

`inputLevel` should be normalized from `0` to `1`.

Do not persist the `MediaStream` outside the hook unless needed. Avoid making it global if the demo does not need that yet.

## 2. Add audio device utilities

Create:

```text
src/liveTranslation/audio/audioDevices.ts
```

Responsibilities:

- request/list available audio input devices
- normalize device labels
- handle the case where labels are hidden before permission is granted
- expose a function similar to:

```ts
export async function listAudioInputDevices(): Promise<AudioInputDevice[]>;
```

Expected behavior:

- use `navigator.mediaDevices.enumerateDevices()`
- filter `kind === "audioinput"`
- if label is missing, use fallback labels like:
  - `Microphone 1`
  - `Microphone 2`
- handle unsupported browsers gracefully with a clear error

## 3. Add useMicrophoneCapture hook

Create:

```text
src/liveTranslation/audio/useMicrophoneCapture.ts
```

Suggested controller:

```ts
export type MicrophoneCaptureController = MicrophoneCaptureState & {
  refreshDevices: () => Promise<void>;
  setSelectedDeviceId: (deviceId: string | null) => void;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
};
```

Requirements:

### Device handling

- `refreshDevices()` lists audio input devices.
- If no selected device exists, default to the first available input.
- After permission is granted, refresh devices again so real labels become visible.

### Capture handling

`startCapture()` should call `navigator.mediaDevices.getUserMedia()` with audio constraints.

If a `selectedDeviceId` exists, use it:

```ts
audio: {
  deviceId: { exact: selectedDeviceId }
}
```

If no selected device exists, use:

```ts
audio: true
```

You may include basic browser constraints if useful:

```ts
audio: {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
}
```

But keep it simple.

### State handling

- status becomes `"requesting-permission"` before asking permission
- status becomes `"capturing"` once the stream is active
- status becomes `"idle"` or `"ready"` after stopping
- errors set status `"error"` and a readable `errorMessage`

### Cleanup

Very important:

- stop all `MediaStreamTrack`s on `stopCapture()`
- close/disconnect any `AudioContext`
- cancel animation frames
- do not update state after unmount
- if `startCapture()` is called twice, do not create duplicate streams

## 4. Add live input level meter

Create:

```text
src/liveTranslation/audio/AudioLevelMeter.tsx
```

It should render a simple visual bar using `inputLevel`.

Requirements:

- accept `level: number`
- clamp level between `0` and `1`
- show readable visual state
- no charting library
- no complex styling

Example:

```text
Input level: [██████------]
```

A plain CSS bar is enough.

## 5. Add AudioInputPanel demo component

Create:

```text
src/liveTranslation/audio/AudioInputPanel.tsx
```

This component should use `useMicrophoneCapture()` and provide UI for:

- refresh devices
- select audio input device
- start mic
- stop mic
- show status
- show error message
- show input level meter
- show whether permission appears granted
- show currently selected device

Keep this panel as a demo/test panel, not as final presentation UI.

The final subtitle overlay should stay visually separate.

## 6. Export audio pieces from plugin index

Update:

```text
src/liveTranslation/index.ts
```

Export useful audio utilities/components:

```ts
export { useMicrophoneCapture } from "./audio/useMicrophoneCapture";
export { AudioInputPanel } from "./audio/AudioInputPanel";
export { AudioLevelMeter } from "./audio/AudioLevelMeter";
export * from "./audio/audioDevices";
```

Do not export unnecessary internals if you create any.

## 7. Integrate into App.tsx demo

Update the demo app to show a new section:

```text
Microphone capture sandbox
```

It should sit near the existing subtitle controls.

The app should now demonstrate two independent things:

```text
1. Fake subtitles / overlay plugin
2. Microphone capture / device selection sandbox
```

Make the UI copy explicit:

```text
This microphone panel only tests browser audio capture.
It does not send audio to OpenAI yet.
```

The existing fake subtitles should keep working even if microphone permission is denied.

## 8. Optional: add browser support warning

If `navigator.mediaDevices` or `getUserMedia` is missing, show a clear message:

```text
This browser does not support microphone capture through navigator.mediaDevices.
```

Do not crash the app.

## 9. Styling

Update `src/styles.css`.

Keep styling simple.

Add styles for:

- audio panel
- device selector
- level meter
- status/error labels

Do not over-polish. This is a technical sandbox.

## 10. Documentation

Create:

```text
docs/chapter-03-notes.md
```

Include:

- what Chapter 03 added
- how to test microphone capture
- why this is still separate from subtitles
- what remains unimplemented
- what Chapter 04 should probably do next

Keep it short and practical.

## 11. Update history folder

If the repo has:

```text
History-Implementations/
```

add this prompt there as:

```text
History-Implementations/codex_prompt_live_translation_subtitles_ch03.md
```

Do not delete Chapter 01 or Chapter 02 prompts.

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
    useLiveTranslationShortcuts.ts
    providers/
      FakeTranslationProvider.ts
    audio/
      audioDevices.ts
      useMicrophoneCapture.ts
      AudioInputPanel.tsx
      AudioLevelMeter.tsx
docs/
  chapter-02-notes.md
  chapter-03-notes.md
History-Implementations/
  codex_prompt_live_translation_subtitles_ch01.md
  codex_prompt_live_translation_subtitles_ch02.md
  codex_prompt_live_translation_subtitles_ch03.md
```

## Manual test checklist

After implementation, manually test:

1. `npm run build` passes.
2. App loads without microphone permission.
3. Device list can be refreshed.
4. Browser asks for microphone permission when starting capture.
5. After permission, real device labels appear if the browser exposes them.
6. Selecting a different input device does not crash.
7. Start mic shows status `"capturing"`.
8. Speaking/tapping near the mic changes the input level meter.
9. Stop mic stops the meter and releases the microphone.
10. Starting twice does not create duplicate active streams.
11. Denying permission produces a readable error.
12. Fake subtitles still work with or without microphone access.
13. Keyboard shortcuts from Chapter 02 still work.
14. Manual subtitle mode still works.

## Deliverable summary

At the end, report:

- files created/modified
- whether `npm run build` passes
- how microphone selection works
- how mic cleanup is handled
- whether device labels appear before/after permission
- what remains intentionally unimplemented
- any browser limitations found during testing

## Success definition

Chapter 03 is successful when the demo app can list/select a microphone, start and stop local browser audio capture, and show a live input level meter, while the existing fake subtitle overlay continues to work independently.

This chapter should make the future OpenAI WebRTC provider safer to implement because we will already know the microphone/device layer works.
