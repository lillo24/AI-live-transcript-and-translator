# Chapter 02 Notes

- Chapter 02 adds explicit plugin config, plugin-owned keyboard shortcuts, configurable overlay position and density, and manual subtitle test controls.
- The repo is still fully fake and local-only. There is no OpenAI integration, WebRTC transport, microphone input, backend session, or translated audio.
- Manual subtitle mode exists so the overlay can be tested or demonstrated during presentation prep even when microphone or API work is unavailable.
- Chapter 03 should probably add the first real provider path, starting with a clean OpenAI/WebRTC adapter boundary while preserving the current detachable plugin imports.
