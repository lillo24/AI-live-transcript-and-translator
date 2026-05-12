import { useState } from "react";
import {
  AudioInputPanel,
  LiveSubtitleOverlay,
  LiveTranslationProvider,
  useLiveTranslation,
  type OverlayDensity,
  type OverlayPosition,
  type TargetLanguage,
} from "./liveTranslation";

const statusLabels = {
  idle: "Idle",
  starting: "Starting",
  listening: "Listening",
  error: "Error",
} as const;

type DemoScreenProps = {
  overlayDensity: OverlayDensity;
  overlayPosition: OverlayPosition;
  onOverlayDensityChange: (density: OverlayDensity) => void;
  onOverlayPositionChange: (position: OverlayPosition) => void;
};

function getSampleManualSubtitle(language: TargetLanguage) {
  return language === "it"
    ? "Questo e un sottotitolo manuale di prova per il plugin."
    : "This is a manual subtitle test line for the plugin.";
}

function DemoScreen({
  overlayDensity,
  overlayPosition,
  onOverlayDensityChange,
  onOverlayPositionChange,
}: DemoScreenProps) {
  const translation = useLiveTranslation();
  const [manualText, setManualText] = useState("");

  const isRunning =
    translation.status === "starting" || translation.status === "listening";
  const trimmedManualText = manualText.trim();
  const sampleManualSubtitle = getSampleManualSubtitle(
    translation.targetLanguage,
  );

  return (
    <>
      <main className="app-shell">
        <section className="demo-header">
          <div>
            <p className="eyebrow">Chapter 03 Demo</p>
            <h1>Subtitle Plugin and Microphone Sandbox</h1>
            <p className="supporting-text">
              This repo still uses a fake subtitle provider. The new microphone
              sandbox only proves local browser audio capture and does not send
              audio to OpenAI or any backend.
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
            <p className="slide-note">
              Subtitle behavior and microphone capture now share the same demo
              page, but they remain separate modules on purpose.
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
              <div>
                <span>Overlay position</span>
                <strong>
                  {translation.config.overlayPosition === "top"
                    ? "Top"
                    : "Bottom"}
                </strong>
              </div>
              <div>
                <span>Provider kind</span>
                <strong>{translation.config.providerKind}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="sandbox-panels">
          <section className="control-panel" aria-label="Subtitle controls">
            <div className="panel-copy">
              <h3>Subtitle overlay sandbox</h3>
              <p>
                Keyboard shortcuts remain plugin-owned, and the fake subtitle
                flow still works without any microphone permission.
              </p>
            </div>

            <div className="control-row">
              <button
                className="primary-button"
                type="button"
                onClick={() => void translation.start()}
                disabled={isRunning}
              >
                Start
              </button>
              <button
                type="button"
                onClick={translation.stop}
                disabled={!isRunning}
              >
                Stop
              </button>
              <button type="button" onClick={translation.toggleVisible}>
                {translation.isVisible ? "Hide subtitles" : "Show subtitles"}
              </button>
              <button type="button" onClick={translation.clearSubtitles}>
                Clear subtitles
              </button>
            </div>

            <div className="control-grid">
              <label className="field">
                <span>Target language</span>
                <select
                  value={translation.targetLanguage}
                  onChange={(event) =>
                    translation.setTargetLanguage(
                      event.target.value as TargetLanguage,
                    )
                  }
                >
                  <option value="en">English</option>
                  <option value="it">Italian</option>
                </select>
              </label>

              <label className="field">
                <span>Overlay position</span>
                <select
                  value={overlayPosition}
                  onChange={(event) =>
                    onOverlayPositionChange(
                      event.target.value as OverlayPosition,
                    )
                  }
                >
                  <option value="bottom">Bottom</option>
                  <option value="top">Top</option>
                </select>
              </label>

              <label className="field">
                <span>Overlay density</span>
                <select
                  value={overlayDensity}
                  onChange={(event) =>
                    onOverlayDensityChange(
                      event.target.value as OverlayDensity,
                    )
                  }
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
            </div>

            <p className="helper-text">
              Changing target language while listening does not restart the fake
              stream. The new language is used on the next start.
            </p>

            <div className="field manual-panel">
              <span>Manual subtitle test mode</span>
              <input
                className="text-input"
                type="text"
                value={manualText}
                onChange={(event) => setManualText(event.target.value)}
                placeholder="Type a subtitle line for manual overlay testing"
              />
              <div className="control-row control-row-wrap">
                <button
                  type="button"
                  onClick={() => translation.setManualPartial(trimmedManualText)}
                  disabled={!trimmedManualText}
                >
                  Show as partial
                </button>
                <button
                  type="button"
                  onClick={() => translation.commitManualFinal(trimmedManualText)}
                  disabled={!trimmedManualText}
                >
                  Commit as final
                </button>
                <button
                  type="button"
                  onClick={() => setManualText(sampleManualSubtitle)}
                >
                  Use sample subtitle
                </button>
              </div>
            </div>

            <div className="control-row control-row-wrap">
              <div className="field">
                <span>Keyboard shortcuts</span>
                <div className="shortcut-list">
                  <kbd>S</kbd> show or hide
                  <kbd>M</kbd> start or stop
                  <kbd>Esc</kbd> stop
                </div>
              </div>

              <div className="field">
                <span>Active overlay config</span>
                <div className="config-summary">
                  {translation.config.overlayPosition} /{" "}
                  {translation.config.overlayDensity}
                </div>
              </div>
            </div>

            {translation.errorMessage ? (
              <p className="error-message" role="alert">
                {translation.errorMessage}
              </p>
            ) : null}
          </section>

          <AudioInputPanel />
        </div>
      </main>

      <LiveSubtitleOverlay />
    </>
  );
}

export default function App() {
  const [overlayPosition, setOverlayPosition] =
    useState<OverlayPosition>("bottom");
  const [overlayDensity, setOverlayDensity] =
    useState<OverlayDensity>("comfortable");

  return (
    <LiveTranslationProvider
      config={{
        providerKind: "fake",
        defaultVisible: true,
        defaultTargetLanguage: "it",
        maxRecentFinals: 4,
        overlayPosition,
        overlayDensity,
        enableKeyboardShortcuts: true,
      }}
    >
      <DemoScreen
        overlayDensity={overlayDensity}
        overlayPosition={overlayPosition}
        onOverlayDensityChange={setOverlayDensity}
        onOverlayPositionChange={setOverlayPosition}
      />
    </LiveTranslationProvider>
  );
}
