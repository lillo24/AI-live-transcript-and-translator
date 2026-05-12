# Codex Prompt — Live Translation Subtitles Plugin, Chapter 05

## Context

We are continuing the standalone repo:

```text
AI-live-transcript-and-translator
```

Current state after Chapter 04:

- React + TypeScript + Vite demo app
- detached `src/liveTranslation/` subtitle plugin
- fake subtitle provider
- manual subtitle fallback mode
- microphone capture sandbox
- local Node dev backend
- OpenAI Realtime Translation client-secret smoke test
- no WebRTC translation provider yet

Chapter 04 proved:

```text
React frontend
-> local dev backend
-> OpenAI Realtime Translation client secret
```

The user tested the Chapter 04 smoke test locally with a real OpenAI key and it appears to work.

Now we can add the first real WebRTC translation provider.

Official flow to implement:

```text
browser microphone MediaStreamTrack
-> RTCPeerConnection
-> OpenAI Realtime Translation calls endpoint
-> remote translated audio track
-> oai-events data channel
-> translated transcript deltas
-> subtitle overlay
```

Use the dedicated Realtime Translation endpoint, not the normal voice-agent endpoint.

Reference architecture from OpenAI docs:

- browser apps should use WebRTC for client-side audio
- server creates short-lived translation client secret
- browser posts SDP offer to:
  `https://api.openai.com/v1/realtime/translations/calls`
- data channel name:
  `oai-events`
- transcript event examples:
  `session.output_transcript.delta`
  `session.input_transcript.delta`
- no `response.create` for translation sessions

## Goal of this implementation

Add a real OpenAI WebRTC translation provider that can:

```text
selected microphone
-> OpenAI Realtime Translation
-> translated subtitle text in the existing overlay
```

This is the first real end-to-end translation chapter.

Keep it experimental and detachable.

The fake provider must remain available.

---

# Pre-flight UI fix required

Before adding WebRTC, clean up the demo layout.

The current demo cards/sections such as:

```text
Subtitle overlay sandbox
Microphone capture sandbox
OpenAI session smoke test
```

have container width limits and some rows can overflow when content is long.

Fix the UI globally enough for this demo.

Requirements:

## 1. Remove narrow max-width limits from main demo containers

Delete or loosen max-width limits that make the main sandbox cards too narrow.

The main app content should be able to use the viewport width.

Target behavior:

```text
large screen  -> cards can become wider
small screen  -> cards stack and wrap cleanly
```

Do not make the layout full-bleed edge-to-edge. Keep reasonable page padding.

## 2. Prevent overflow everywhere in sandbox cards

Apply the same principle previously used for the audio device row to all relevant rows/cards:

- use `min-width: 0` on grid/flex children where needed
- long text should not escape its card
- long values should either truncate with ellipsis or wrap depending on context
- form rows should wrap instead of overflowing
- button rows should wrap instead of overflowing
- select/input elements should stay inside their containers
- status/session/error blocks should wrap long text safely

Suggested CSS concepts:

```css
min-width: 0;
max-width: 100%;
overflow-wrap: anywhere;
word-break: normal;
text-overflow: ellipsis;
white-space: nowrap;
flex-wrap: wrap;
grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
```

Use ellipsis for compact single-line values.
Use wrapping for explanatory text, errors, and session/status blocks.

## 3. Responsive wrapping rule

If a row becomes too short, elements should wrap.

Examples:

```text
buttons in a row -> wrap to next line
label + input -> stack or wrap
two/three columns -> auto-fit into fewer columns
```

Avoid horizontal scrolling in normal usage.

Do not change behavior while doing this cleanup.

---

# Required WebRTC changes

## 1. Extend provider kind types

Update `src/liveTranslation/types.ts`.

Current provider kind is probably:

```ts
export type LiveTranslationProviderKind = "fake";
```

Extend to:

```ts
export type LiveTranslationProviderKind = "fake" | "openai-webrtc";
```

Add any WebRTC-specific status if useful, but avoid overcomplicating.

Recommended status additions:

```ts
export type SubtitleStatus =
  | "idle"
  | "starting"
  | "connecting"
  | "listening"
  | "error";
```

If changing this creates too much churn, keep existing statuses and map WebRTC connecting into `"starting"`.
Prefer clarity if manageable.

## 2. Add OpenAI WebRTC provider file

Create:

```text
src/liveTranslation/providers/OpenAIRealtimeTranslationProvider.ts
```

This provider should implement the existing `TranslationProviderAdapter` shape introduced in Chapter 02.

Suggested exported adapter:

```ts
export const openAIRealtimeTranslationProvider: TranslationProviderAdapter = {
  kind: "openai-webrtc",
  async start(options) {
    ...
  },
};
```

This provider should:

1. Get microphone audio with `navigator.mediaDevices.getUserMedia()`.
2. Use the selected device if available.
3. Request a short-lived client secret from the existing local backend API.
4. Create `RTCPeerConnection`.
5. Create data channel named `"oai-events"`.
6. Add the microphone audio track to the peer connection.
7. Create SDP offer.
8. Set local description.
9. POST the SDP offer to:

```text
https://api.openai.com/v1/realtime/translations/calls
```

Headers:

```ts
Authorization: `Bearer ${clientSecret}`
Content-Type: "application/sdp"
```

10. Read the SDP answer as text.
11. Set remote description.
12. Listen to data channel events.
13. Convert transcript events into `onPartial` / `onFinal` callbacks.
14. Stop cleanly.

Important:

- the OpenAI standard API key must never be used in the browser
- only the short-lived client secret goes to the browser
- do not log the full client secret
- do not display the full client secret
- do not store the secret in localStorage/sessionStorage

## 3. Source microphone/device handling

The provider needs microphone input.

Use one of these two options:

### Preferred simple option

Let the WebRTC provider request its own microphone stream using selected device options.

Add `selectedDeviceId?: string | null` to the provider start options:

```ts
export type TranslationProviderStartOptions = {
  targetLanguage: TargetLanguage;
  selectedDeviceId?: string | null;
  noiseReduction?: OpenAITranslationNoiseReduction;
  onListening: () => void;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onConnectionStatus?: (status: string) => void;
};
```

This keeps the existing microphone sandbox independent.

The demo can pass the selected device id from a new lightweight control in the OpenAI translation panel, or from a shared selector if easy.

### Avoid for now

Do not try to share the exact same active `MediaStream` from `useMicrophoneCapture()` unless it is already very clean.

Reason: sharing streams between the meter sandbox and WebRTC provider can create lifecycle confusion.

For Chapter 05, it is okay if:

```text
mic sandbox = separate local testing tool
OpenAI provider = requests mic separately when real translation starts
```

## 4. Device selector for real translation

Add a small device selector to the real translation demo panel.

Do not force users to use the microphone sandbox panel to choose the OpenAI translation input.

Create or reuse `listAudioInputDevices()`.

UI should show:

- refresh devices
- select microphone
- selected device label
- fallback labels if permission is not granted yet

This can be inside a new `OpenAIRealtimeTranslationPanel`.

## 5. Add real translation panel

Create:

```text
src/liveTranslation/openai/OpenAIRealtimeTranslationPanel.tsx
```

Purpose:

A development/demo panel for starting/stopping real OpenAI WebRTC translation.

UI should include:

- backend health check
- microphone selector
- target language selector: Italian / English
- noise reduction selector:
  - near_field
  - far_field
  - disabled
- start real translation button
- stop real translation button
- status display
- connection phase display if available
- error display
- checkbox/toggle:
  `Play translated audio`
- translated audio element if audio playback is enabled
- source transcript display if available
- translated transcript display if useful
- warning text:
  `This uses the OpenAI API and may cost money while running.`

Keep it practical, not beautiful.

## 6. Translated audio playback

The Realtime Translation call returns translated audio as a remote WebRTC audio track.

For Chapter 05:

- support receiving the remote audio track
- create an `<audio>` element
- default translated audio playback to **off** if possible, or muted by default

Reason: for subtitle demo, translated speech playback may create echo/confusion.

Suggested behavior:

```text
Play translated audio: unchecked by default
```

If unchecked:

- still attach the remote stream internally if needed
- keep audio element muted or do not play it

If checked:

- play translated audio through the browser audio output

Do not overbuild volume/mixing controls yet.

## 7. Transcript event handling

Handle at least these data channel events:

```text
session.output_transcript.delta
session.input_transcript.delta
error
```

For output transcript:

- append deltas to a current output buffer
- call `onPartial(currentOutputBuffer)`
- when a “done/completed/final” event is received, call `onFinal(buffer)` and clear buffer

You need to inspect event names defensively because the exact final event names may vary.

Implement a small helper:

```ts
function handleRealtimeTranslationEvent(event: unknown): void
```

Recommended defensive handling:

- if `event.type === "session.output_transcript.delta"` and `event.delta` is a string:
  append to translated buffer
- if event type contains `"output_transcript"` and contains `"done"` / `"completed"`:
  commit final
- if `event.type === "session.input_transcript.delta"`:
  update source transcript buffer for panel display
- if event type contains `"error"`:
  surface readable error

Do not crash on unknown events.
Unknown events can be ignored or optionally logged in dev-only mode.

## 8. Provider session cleanup

The provider `start()` should return a session object:

```ts
{
  stop: () => void;
}
```

Stopping must:

- stop microphone tracks
- close data channel
- close RTCPeerConnection
- stop/clear remote audio stream if any
- clear references
- avoid state updates after stop
- be safe if called twice

Also handle:

- browser permission denial
- backend unavailable
- OpenAI SDP call failure
- data channel close/error
- peer connection failure

Surface readable errors.

## 9. Wire provider selection into LiveTranslationProvider

Currently the provider probably uses only the fake adapter.

Update `LiveTranslationProvider` so `config.providerKind` selects:

```ts
"fake" -> fakeTranslationProvider
"openai-webrtc" -> openAIRealtimeTranslationProvider
```

But be careful:

The demo may still want fake subtitles and real OpenAI panel separately.

If this conflicts with the existing architecture, prefer this simpler approach:

- keep the main `LiveTranslationProvider` configurable
- for the real panel, use the existing provider/controller with `providerKind: "openai-webrtc"`
- do not break the fake demo

One acceptable demo architecture:

```tsx
<LiveTranslationProvider config={{ providerKind: "fake", ... }}>
  <FakeSubtitleDemo />
</LiveTranslationProvider>

<LiveTranslationProvider config={{ providerKind: "openai-webrtc", ... }}>
  <OpenAIRealtimeTranslationPanel />
  <LiveSubtitleOverlay />
</LiveTranslationProvider>
```

But if two overlays are confusing, use one provider and allow switching provider kind from the UI.

Choose the cleaner approach for the current codebase.

Hard requirement:

```text
fake subtitles must still be testable without OpenAI
real translation must be startable without deleting fake mode
```

## 10. Config and state additions

Add config fields if needed:

```ts
apiBaseUrl?: string;
defaultNoiseReduction?: OpenAITranslationNoiseReduction;
playTranslatedAudioByDefault?: boolean;
```

Do not make config huge.

## 11. Export new pieces

Update:

```text
src/liveTranslation/index.ts
```

Export:

```ts
export { openAIRealtimeTranslationProvider } from "./providers/OpenAIRealtimeTranslationProvider";
export { OpenAIRealtimeTranslationPanel } from "./openai/OpenAIRealtimeTranslationPanel";
```

and any useful types.

## 12. Documentation

Create:

```text
docs/chapter-05-notes.md
```

Include:

- what Chapter 05 added
- how to run backend + frontend
- how to test real translation
- how to choose microphone
- expected event flow
- why translated audio is optional/off by default
- what remains rough/experimental
- known limitations:
  - no reconnect
  - no transcript persistence
  - no production auth/rate limiting
  - no glossary/custom prompts
  - only Italian/English exposed in demo
  - cost while running

## 13. Update history folder

If the repo has:

```text
History-Implementations/
```

add this prompt there as:

```text
History-Implementations/codex_prompt_live_translation_subtitles_ch05.md
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
  chapter-02-notes.md
  chapter-03-notes.md
  chapter-04-notes.md
  chapter-05-notes.md
History-Implementations/
  codex_prompt_live_translation_subtitles_ch01.md
  codex_prompt_live_translation_subtitles_ch02.md
  codex_prompt_live_translation_subtitles_ch03.md
  codex_prompt_live_translation_subtitles_ch04.md
  codex_prompt_live_translation_subtitles_ch05.md
.env.example
```

---

# Manual test checklist

## UI/layout

1. `npm run build` passes.
2. Main sandbox cards no longer have an overly narrow max-width.
3. Long device names do not overflow.
4. Long session/error/status values wrap or truncate safely.
5. Button rows wrap when viewport is narrow.
6. Form rows/selects/inputs stay inside their cards.
7. No normal horizontal page scroll.

## Existing features

8. Fake subtitles still work.
9. Manual subtitle mode still works.
10. Keyboard shortcuts still work.
11. Mic capture sandbox still works.
12. OpenAI client-secret smoke-test panel still works.

## Real translation setup

Terminal 1:

```powershell
cd C:\Users\leona\Documents\GitHub\AI-live-transcript-and-translator
$env:OPENAI_API_KEY="YOUR_KEY"
npm run dev:server
```

Terminal 2:

```powershell
cd C:\Users\leona\Documents\GitHub\AI-live-transcript-and-translator
npm run dev
```

Open:

```text
http://localhost:5173
```

Then:

13. Select microphone in the real translation panel.
14. Select target language Italian.
15. Select noise reduction `near_field`.
16. Start real translation.
17. Allow microphone permission.
18. Speak English.
19. Confirm translated Italian subtitles appear in the overlay.
20. Stop real translation.
21. Confirm browser microphone indicator turns off.
22. Repeat with target language English and speak Italian.

## Error cases

23. Start frontend without backend; app still loads.
24. Start backend without key; real translation panel shows readable error.
25. Deny microphone permission; panel shows readable error.
26. Stop can be clicked twice without crashing.
27. Starting twice does not create duplicate peer connections.

---

# Deliverable summary

At the end, report:

- files created/modified
- whether `npm run build` passes
- whether `node --check server/dev-server.mjs` still passes
- what UI overflow fixes were made
- how real WebRTC translation is started/stopped
- whether real translation was tested with a live key
- which transcript event types were observed in the browser console or panel
- whether translated audio playback works or remains disabled/muted
- what remains intentionally unimplemented
- any limitations or weird behavior found

## Success definition

Chapter 05 is successful when the app can use a selected microphone to start an OpenAI Realtime Translation WebRTC session and show translated transcript text in the existing subtitle overlay.

The feature is still experimental, but it must cleanly start, stop, and fail without breaking the fake subtitle demo or microphone sandbox.
