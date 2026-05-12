# Chapter 06 Notes

- Chapter 06 adds a shared translation language registry plus one reusable `LanguageSelector` component for choosing the translation output language.
- In the UI, the choice is always framed as `Translate into`, while the source language remains auto-detected by `gpt-realtime-translate`.
- The selected language now flows as:
  - `LanguageSelector`
  - frontend session request / realtime provider start
  - local backend validation
  - `session.audio.output.language`
  - returned session details / realtime translation session
- The backend accepts these output-language codes:
  - `en`, `it`, `es`, `fr`, `de`, `pt`, `ja`, `zh`, `ko`, `hi`, `id`, `vi`, `ru`
- Missing language values still default to `it`, but unsupported codes now return a readable HTTP 400 error before the OpenAI key path runs.
- To test it, try the smoke-test panel and the realtime panel with a supported code such as `fr` or `de`, then verify the backend/session details echo that same language.
- Still intentionally unimplemented: production auth/rate limiting, reconnect logic, transcript persistence, glossary/custom prompt tuning, and deeper per-language translation QA.
