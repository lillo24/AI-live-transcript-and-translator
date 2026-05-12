# Chapter 03 Notes

- Chapter 03 adds a detached microphone capture sandbox with audio device listing, input selection, start/stop capture controls, and a live input level meter.
- To test it locally, run `npm run dev`, open the demo page, refresh devices, start the microphone, allow browser permission, and confirm the meter reacts to speech or taps near the selected mic.
- This stays separate from subtitles on purpose so microphone/device handling can be validated before any OpenAI or WebRTC provider is added.
- Still unimplemented: OpenAI calls, backend session setup, WebRTC transport, realtime transcription, translation, transcript saving, and audio playback.
- Chapter 04 should probably connect this audio layer to the first real provider boundary without breaking the detachable subtitle plugin imports.
