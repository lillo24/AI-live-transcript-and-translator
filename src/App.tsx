import { useState } from "react";
import {
  AudioInputPanel,
  getTranslationLanguageLabel,
  LanguageSelector,
  LiveSubtitleOverlay,
  LiveTranslationProvider,
  OpenAIRealtimeTranslationPanel,
  OpenAITranslationSessionPanel,
  useLiveTranslation,
  type OverlayDensity,
  type OverlayPosition,
  type SubtitleStatus,
  type TargetLanguage,
} from "./liveTranslation";

const statusLabels: Record<SubtitleStatus, string> = {
  idle: "Idle",
  starting: "Starting",
  connecting: "Connecting",
  listening: "Listening",
  error: "Error",
};

type FakeSandboxProps = {
  overlayDensity: OverlayDensity;
  overlayPosition: OverlayPosition;
  onOverlayDensityChange: (density: OverlayDensity) => void;
  onOverlayPositionChange: (position: OverlayPosition) => void;
};

function getSampleManualSubtitle(language: TargetLanguage) {
  return language === "it"
    ? "Questo e un sottotitolo manuale di prova per il plugin."
    : `This is a manual subtitle test line for ${getTranslationLanguageLabel(
        language,
      )}.`;
}

function FakeSubtitleSandbox({
  overlayDensity,
  overlayPosition,
  onOverlayDensityChange,
  onOverlayPositionChange,
}: FakeSandboxProps) {
  const translation = useLiveTranslation();
  const [manualText, setManualText] = useState("");
  const isRunning =
    translation.status === "starting" ||
    translation.status === "connecting" ||
    translation.status === "listening";
  const trimmedManualText = manualText.trim();
  const sampleManualSubtitle = getSampleManualSubtitle(
    translation.targetLanguage,
  );

  return (
    <>
      <section className="slide-stage" aria-label="Fake presentation slide">
        <div className="slide-card">
          <div className="slide-badge">Detachable Overlay</div>
          <h2>Fake subtitles stay isolated while WebRTC goes real</h2>
          <p>
            Chapter 05 keeps the original fake subtitle provider intact and
            adds a separate OpenAI realtime translation path beside it.
          </p>
          <p className="slide-note">
            The fake demo still owns the keyboard shortcuts and bottom overlay.
            The new realtime provider runs as a separate sandbox with its own
            top-positioned overlay, microphone session, and WebRTC lifecycle.
          </p>
          <div className="slide-meta">
            <div>
              <span>Fake provider status</span>
              <strong>{statusLabels[translation.status]}</strong>
            </div>
            <div>
              <span>Target language</span>
              <strong>{getTranslationLanguageLabel(translation.targetLanguage)}</strong>
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
              The original fake provider remains the low-risk test surface for
              subtitle rendering, keyboard shortcuts, and manual overlay input.
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
            <LanguageSelector
              value={translation.targetLanguage}
              onChange={translation.setTargetLanguage}
              label="Translate into"
            />

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
            Changing target language while the fake provider is running does not
            restart the stream. The new language applies on the next start.
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
            <div className="control-row">
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

          <div className="control-row">
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
        <OpenAITranslationSessionPanel />

        <LiveTranslationProvider
          config={{
            providerKind: "openai-webrtc",
            defaultVisible: true,
            defaultTargetLanguage: "it",
            maxRecentFinals: 4,
            overlayPosition: "top",
            overlayDensity: "comfortable",
            enableKeyboardShortcuts: false,
            defaultNoiseReduction: "near_field",
            playTranslatedAudioByDefault: false,
          }}
        >
          <OpenAIRealtimeTranslationPanel />
          <LiveSubtitleOverlay />
        </LiveTranslationProvider>
      </div>

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
    <main className="app-shell">
      <section className="demo-header">
        <div>
          <p className="eyebrow">Chapter 06 Demo</p>
          <h1>Fake subtitles, mic sandbox, backend smoke test, realtime translation, and shared language selection</h1>
          <p className="supporting-text">
            This demo now carries two detached translation paths at once: the
            original fake subtitle provider for safe overlay testing, and a new
            OpenAI WebRTC provider that can request a short-lived client secret,
            negotiate a realtime translation call, and push translated text into
            the existing overlay. Chapter 06 adds one reusable output-language
            selector so the chosen language stays consistent from UI to backend
            session creation.
          </p>
        </div>
      </section>

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
        <FakeSubtitleSandbox
          overlayDensity={overlayDensity}
          overlayPosition={overlayPosition}
          onOverlayDensityChange={setOverlayDensity}
          onOverlayPositionChange={setOverlayPosition}
        />
      </LiveTranslationProvider>
    </main>
  );
}
