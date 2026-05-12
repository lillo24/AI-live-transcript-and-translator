import { useEffect, useEffectEvent } from "react";
import {
  LiveSubtitleOverlay,
  LiveTranslationProvider,
  useLiveTranslation,
} from "./liveTranslation";

const statusLabels = {
  idle: "Idle",
  starting: "Starting",
  listening: "Listening",
  error: "Error",
} as const;

function DemoScreen() {
  const translation = useLiveTranslation();

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    const isEditable =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT");

    if (isEditable) {
      return;
    }

    if (event.key === "Escape") {
      translation.stop();
      return;
    }

    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      translation.toggleVisible();
      return;
    }

    if (event.key.toLowerCase() === "m") {
      event.preventDefault();

      if (
        translation.status === "starting" ||
        translation.status === "listening"
      ) {
        translation.stop();
        return;
      }

      void translation.start();
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleShortcut(event);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleShortcut]);

  const isRunning =
    translation.status === "starting" || translation.status === "listening";

  return (
    <>
      <main className="app-shell">
        <section className="demo-header">
          <div>
            <p className="eyebrow">Chapter 01 Demo</p>
            <h1>Live Translation Subtitle Overlay</h1>
            <p className="supporting-text">
              Fake subtitles simulate the realtime UI flow before adding a
              microphone or OpenAI provider.
            </p>
          </div>

          <div className={`status-chip status-${translation.status}`}>
            <span className="status-dot" />
            {statusLabels[translation.status]}
          </div>
        </section>

        <section className="slide-stage" aria-label="Fake presentation slide">
          <div className="slide-card">
            <div className="slide-badge">Fake Slide</div>
            <h2>Realtime Translation Overlay Sandbox</h2>
            <p>
              This view stands in for the thesis presentation app that will host
              the detachable overlay later.
            </p>
            <div className="slide-meta">
              <div>
                <span>Target language</span>
                <strong>
                  {translation.targetLanguage === "en" ? "English" : "Italian"}
                </strong>
              </div>
              <div>
                <span>Visibility</span>
                <strong>{translation.isVisible ? "Shown" : "Hidden"}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="control-panel" aria-label="Subtitle controls">
          <div className="control-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => void translation.start()}
              disabled={isRunning}
            >
              Start
            </button>
            <button type="button" onClick={translation.stop} disabled={!isRunning}>
              Stop
            </button>
            <button type="button" onClick={translation.toggleVisible}>
              {translation.isVisible ? "Hide subtitles" : "Show subtitles"}
            </button>
            <button type="button" onClick={translation.clearSubtitles}>
              Clear subtitles
            </button>
          </div>

          <div className="control-row control-row-wrap">
            <label className="field">
              <span>Target language</span>
              <select
                value={translation.targetLanguage}
                onChange={(event) =>
                  translation.setTargetLanguage(
                    event.target.value as "en" | "it",
                  )
                }
              >
                <option value="en">English</option>
                <option value="it">Italian</option>
              </select>
            </label>

            <div className="field">
              <span>Keyboard shortcuts</span>
              <div className="shortcut-list">
                <kbd>S</kbd> show or hide
                <kbd>M</kbd> start or stop
                <kbd>Esc</kbd> stop
              </div>
            </div>
          </div>

          {translation.errorMessage ? (
            <p className="error-message" role="alert">
              {translation.errorMessage}
            </p>
          ) : null}
        </section>
      </main>

      <LiveSubtitleOverlay />
    </>
  );
}

export default function App() {
  return (
    <LiveTranslationProvider>
      <DemoScreen />
    </LiveTranslationProvider>
  );
}

