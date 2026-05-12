import { useEffect, useRef, useState } from "react";
import {
  getMicrophoneSupportError,
  listAudioInputDevices,
} from "../audio/audioDevices";
import { useLiveTranslation } from "../useLiveTranslation";
import {
  getLiveTranslationBackendHealth,
  type LiveTranslationBackendHealth,
} from "./openaiTranslationSessionApi";
import type {
  AudioInputDevice,
  OpenAITranslationNoiseReduction,
  SubtitleStatus,
  TargetLanguage,
} from "../types";

type HealthStatus = "idle" | "checking" | "ready" | "error";

const translationStatusLabels: Record<SubtitleStatus, string> = {
  idle: "Idle",
  starting: "Starting",
  connecting: "Connecting",
  listening: "Listening",
  error: "Error",
};

function resolveSelectedDeviceId(
  devices: AudioInputDevice[],
  currentValue: string | null,
) {
  if (!devices.length) {
    return null;
  }

  if (currentValue && devices.some((device) => device.deviceId === currentValue)) {
    return currentValue;
  }

  return devices[0].deviceId;
}

function getTranslatedPreview(
  currentPartial: string | null,
  recentFinals: { text: string }[],
) {
  return currentPartial ?? recentFinals[0]?.text ?? null;
}

function getHealthLabel(healthStatus: HealthStatus, health: LiveTranslationBackendHealth | null) {
  if (healthStatus === "checking") {
    return "Checking backend";
  }

  if (!health) {
    return "Not checked";
  }

  return `${health.ok ? "OK" : "Not OK"} / key ${
    health.hasOpenAiKey ? "present" : "missing"
  }`;
}

export function OpenAIRealtimeTranslationPanel() {
  const translation = useLiveTranslation();
  const supportError = getMicrophoneSupportError();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [noiseReduction, setNoiseReduction] =
    useState<OpenAITranslationNoiseReduction>(
      translation.config.defaultNoiseReduction,
    );
  const [playTranslatedAudio, setPlayTranslatedAudio] = useState(
    translation.config.playTranslatedAudioByDefault,
  );
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("idle");
  const [health, setHealth] = useState<LiveTranslationBackendHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(supportError);
  const [connectionPhase, setConnectionPhase] = useState<string | null>(null);
  const [sourceTranscript, setSourceTranscript] = useState<string | null>(null);
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(
    null,
  );
  const [lastEventType, setLastEventType] = useState<string | null>(null);

  const isRunning =
    translation.status === "starting" ||
    translation.status === "connecting" ||
    translation.status === "listening";
  const selectedDevice =
    devices.find((device) => device.deviceId === selectedDeviceId) ?? null;
  const translatedPreview = getTranslatedPreview(
    translation.currentPartial,
    translation.recentFinals,
  );

  async function refreshDevices() {
    if (supportError) {
      setDeviceError(supportError);
      setDevices([]);
      setSelectedDeviceId(null);
      return;
    }

    try {
      const nextDevices = await listAudioInputDevices();
      setDevices(nextDevices);
      setSelectedDeviceId((currentValue) =>
        resolveSelectedDeviceId(nextDevices, currentValue),
      );
      setDeviceError(null);
    } catch (error) {
      setDeviceError(
        error instanceof Error
          ? error.message
          : "Unable to refresh microphone devices.",
      );
    }
  }

  async function refreshHealth() {
    setHealthStatus("checking");
    setHealthError(null);

    try {
      const nextHealth = await getLiveTranslationBackendHealth();
      setHealth(nextHealth);
      setHealthStatus("ready");
    } catch (error) {
      setHealthStatus("error");
      setHealthError(
        error instanceof Error
          ? error.message
          : "Unable to reach the live translation backend.",
      );
    }
  }

  async function handleStart() {
    setLastEventType(null);
    setSourceTranscript(null);
    setConnectionPhase("Starting");
    setRemoteAudioStream(null);

    await translation.start({
      selectedDeviceId,
      noiseReduction,
      playTranslatedAudio,
      onConnectionStatus: setConnectionPhase,
      onSourceTranscript: setSourceTranscript,
      onRemoteAudioStream: setRemoteAudioStream,
      onEvent: (type) => {
        setLastEventType(type);
      },
    });

    void refreshDevices();
  }

  useEffect(() => {
    void refreshDevices();
    void refreshHealth();
  }, []);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    audioElement.srcObject = remoteAudioStream;
  }, [remoteAudioStream]);

  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    audioElement.muted = !playTranslatedAudio;

    if (!remoteAudioStream || !playTranslatedAudio) {
      audioElement.pause();
      return;
    }

    void audioElement.play().catch(() => {});
  }, [playTranslatedAudio, remoteAudioStream]);

  return (
    <section
      className="control-panel openai-realtime-panel"
      aria-label="OpenAI realtime translation sandbox"
    >
      <div className="panel-copy">
        <h3>OpenAI realtime translation sandbox</h3>
        <p>
          This panel starts a real WebRTC translation session through the local
          backend and routes translated transcript deltas into the detachable
          subtitle overlay.
        </p>
      </div>

      <p className="warning-message">
        This uses the OpenAI API and may cost money while running.
      </p>

      {supportError ? (
        <p className="error-message" role="alert">
          {supportError}
        </p>
      ) : null}

      <div className="audio-status-row">
        <div className={`status-chip status-${translation.status}`}>
          <span className="status-dot" />
          {translationStatusLabels[translation.status]}
        </div>
        <div className="audio-flag">Backend: {getHealthLabel(healthStatus, health)}</div>
      </div>

      <div className="control-grid openai-panel-grid">
        <label className="field">
          <span>Target language</span>
          <select
            value={translation.targetLanguage}
            onChange={(event) =>
              translation.setTargetLanguage(event.target.value as TargetLanguage)
            }
            disabled={isRunning}
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
            disabled={isRunning}
          >
            <option value="near_field">near_field</option>
            <option value="far_field">far_field</option>
            <option value="disabled">disabled</option>
          </select>
        </label>
      </div>

      <div className="openai-device-grid">
        <label className="field">
          <span>Audio input device</span>
          <select
            value={selectedDeviceId ?? ""}
            onChange={(event) => setSelectedDeviceId(event.target.value || null)}
            disabled={Boolean(supportError) || isRunning}
          >
            <option value="">Default browser input</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>Selected device</span>
          <div className="audio-selected-device">
            {selectedDevice?.label ?? "Default browser input"}
          </div>
        </div>
      </div>

      <div className="control-row">
        <button
          type="button"
          onClick={() => void refreshHealth()}
          disabled={healthStatus === "checking"}
        >
          Backend health check
        </button>
        <button
          type="button"
          onClick={() => void refreshDevices()}
          disabled={isRunning || Boolean(supportError)}
        >
          Refresh devices
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => void handleStart()}
          disabled={isRunning || Boolean(supportError)}
        >
          Start real translation
        </button>
        <button type="button" onClick={translation.stop} disabled={!isRunning}>
          Stop real translation
        </button>
        <button type="button" onClick={translation.toggleVisible}>
          {translation.isVisible ? "Hide subtitles" : "Show subtitles"}
        </button>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={playTranslatedAudio}
          onChange={(event) => setPlayTranslatedAudio(event.target.checked)}
        />
        <span>Play translated audio</span>
      </label>

      <audio
        ref={audioRef}
        className="translated-audio-player"
        controls
        playsInline
      />

      <div className="openai-result-grid">
        <div className="openai-result-card">
          <span>Connection phase</span>
          <strong>{connectionPhase ?? translation.connectionStatus ?? "Idle"}</strong>
        </div>
        <div className="openai-result-card">
          <span>Last event type</span>
          <strong>{lastEventType ?? "No events yet"}</strong>
        </div>
        <div className="openai-result-card">
          <span>Remote audio stream</span>
          <strong>{remoteAudioStream ? "Attached" : "Not attached"}</strong>
        </div>
        <div className="openai-result-card">
          <span>Subtitle overlay</span>
          <strong>{translation.isVisible ? "Visible" : "Hidden"}</strong>
        </div>
      </div>

      <div className="transcript-grid">
        <div className="transcript-card">
          <span>Source transcript</span>
          <p>{sourceTranscript || translation.sourceTranscript || "No source transcript yet."}</p>
        </div>
        <div className="transcript-card">
          <span>Translated transcript</span>
          <p>{translatedPreview || "No translated transcript yet."}</p>
        </div>
      </div>

      <div className="helper-grid">
        <div className="audio-helper-card">
          <span>Visible devices</span>
          <strong>{devices.length}</strong>
        </div>
        <div className="audio-helper-card">
          <span>Playback mode</span>
          <strong>{playTranslatedAudio ? "Audible" : "Muted / off"}</strong>
        </div>
      </div>

      <p className="helper-text">
        The realtime provider requests its own microphone stream on start. It
        does not share the Chapter 03 microphone sandbox stream, which keeps
        capture lifecycles separate and easier to stop cleanly.
      </p>

      {deviceError ? (
        <p className="error-message" role="alert">
          {deviceError}
        </p>
      ) : null}

      {healthError ? (
        <p className="error-message" role="alert">
          {healthError}
        </p>
      ) : null}

      {translation.errorMessage ? (
        <p className="error-message" role="alert">
          {translation.errorMessage}
        </p>
      ) : null}
    </section>
  );
}
