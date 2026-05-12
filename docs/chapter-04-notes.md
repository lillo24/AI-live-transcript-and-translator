# Chapter 04 Notes

- Chapter 04 adds a local development backend that creates short-lived OpenAI Realtime Translation client secrets, plus a frontend smoke-test panel to call it.
- Run it in two terminals: set `OPENAI_API_KEY`, start `npm run dev:server`, then start `npm run dev` and open `http://localhost:5173`.
- The smoke test proves the frontend can reach a local backend, the backend can keep the real API key server-side, and a short-lived client secret can be returned safely to the browser.
- The API key stays on the server because the browser should only receive the short-lived client secret, never the long-lived OpenAI secret key.
- Still unimplemented: WebRTC session setup, SDP exchange, live audio streaming to OpenAI, realtime transcript events, translated subtitles from OpenAI, and audio playback.
- Chapter 05 should probably connect this session bootstrap layer to the first real browser-side WebRTC translation provider.
