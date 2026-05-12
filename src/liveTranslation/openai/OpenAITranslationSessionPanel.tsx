import { useMemo, useState } from "react";
import {
  createOpenAITranslationClientSecret,
  getLiveTranslationBackendHealth,
  type CreateOpenAITranslationSessionResponse,
  type LiveTranslationBackendHealth,
  type OpenAITranslationNoiseReduction,
  type OpenAITranslationTargetLanguage,
} from "./openaiTranslationSessionApi";

type OpenAISessionPanelStatus =
  | "idle"
  | "checking-health"
  | "creating-session"
  | "ready"
  | "error";

const panelStatusLabels: Record<OpenAISessionPanelStatus, string> = {
  idle: "Idle",
  "checking-health": "Checking backend",
  "creating-session": "Creating client secret",
  ready: "Ready",
  error: "Error",
};

function maskClientSecret(value: string) {
  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-3)}`;
}

function formatExpiration(expiresAt: number | null) {
  if (!expiresAt) {
    return "Unknown";
  }

  return new Date(expiresAt * 1000).toLocaleString();
}

export function OpenAITranslationSessionPanel() {
  const [status, setStatus] = useState<OpenAISessionPanelStatus>("idle");
  const [targetLanguage, setTargetLanguage] =
    useState<OpenAITranslationTargetLanguage>("it");
  const [noiseReduction, setNoiseReduction] =
    useState<OpenAITranslationNoiseReduction>("near_field");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [health, setHealth] = useState<LiveTranslationBackendHealth | null>(null);
  const [session, setSession] =
    useState<CreateOpenAITranslationSessionResponse | null>(null);

  const maskedSecret = useMemo(
    () => (session ? maskClientSecret(session.clientSecret) : null),
    [session],
  );

  async function handleCheckHealth() {
    setStatus("checking-health");
    setErrorMessage(null);

    try {
      const nextHealth = await getLiveTranslationBackendHealth();
      setHealth(nextHealth);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to check backend health.",
      );
    }
  }

  async function handleCreateClientSecret() {
    setStatus("creating-session");
    setErrorMessage(null);

    try {
      const nextSession = await createOpenAITranslationClientSecret({
        targetLanguage,
        noiseReduction,
      });
      setSession(nextSession);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create a translation client secret.",
      );
    }
  }

  return (
    <section
      className="control-panel openai-session-panel"
      aria-label="OpenAI session smoke test"
    >
      <div className="panel-copy">
        <h3>OpenAI session smoke test</h3>
        <p>
          This only creates a short-lived OpenAI translation session secret. It
          does not start WebRTC translation yet.
        </p>
      </div>

      <div className="audio-status-row">
        <div className={`status-chip status-${status === "error" ? "error" : "idle"}`}>
          <span className="status-dot" />
          {panelStatusLabels[status]}
        </div>
      </div>

      <div className="control-grid openai-panel-grid">
        <label className="field">
          <span>Target language</span>
          <select
            value={targetLanguage}
            onChange={(event) =>
              setTargetLanguage(
                event.target.value as OpenAITranslationTargetLanguage,
              )
            }
            disabled={status === "creating-session"}
          >
            <option value="it">Italian</option>
            <option value="en">English</option>
          </select>
        </label>

        <label className="field">
          <span>Noise reduction</span>
          <select
            value={noiseReduction}
            onChange={(event) =>
              setNoiseReduction(
                event.target.value as OpenAITranslationNoiseReduction,
              )
            }
            disabled={status === "creating-session"}
          >
            <option value="near_field">near_field: close mic / lav mic</option>
            <option value="far_field">far_field: laptop / room mic</option>
            <option value="disabled">disabled</option>
          </select>
        </label>
      </div>

      <div className="control-row control-row-wrap">
        <button
          type="button"
          onClick={() => void handleCheckHealth()}
          disabled={status === "checking-health" || status === "creating-session"}
        >
          Backend health check
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => void handleCreateClientSecret()}
          disabled={status === "creating-session"}
        >
          Create client secret
        </button>
      </div>

      <div className="openai-result-grid">
        <div className="openai-result-card">
          <span>Backend health</span>
          <strong>
            {health
              ? `${health.ok ? "OK" : "Not OK"} / key ${
                  health.hasOpenAiKey ? "present" : "missing"
                }`
              : "Not checked"}
          </strong>
        </div>
        <div className="openai-result-card">
          <span>Session preview</span>
          <strong>{maskedSecret ?? "Not created"}</strong>
        </div>
      </div>

      {session ? (
        <div className="openai-session-details">
          <div className="openai-result-card">
            <span>Session id</span>
            <strong>{session.session.id || "Unavailable"}</strong>
          </div>
          <div className="openai-result-card">
            <span>Model</span>
            <strong>{session.session.model}</strong>
          </div>
          <div className="openai-result-card">
            <span>Output language</span>
            <strong>{session.session.outputLanguage}</strong>
          </div>
          <div className="openai-result-card">
            <span>Expires at</span>
            <strong>{formatExpiration(session.expiresAt)}</strong>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
