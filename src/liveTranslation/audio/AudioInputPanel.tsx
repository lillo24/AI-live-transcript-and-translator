import { AudioLevelMeter } from "./AudioLevelMeter";
import {
  getMicrophoneSupportError,
  isMicrophoneCaptureSupported,
} from "./audioDevices";
import { useMicrophoneCapture } from "./useMicrophoneCapture";

const statusLabels = {
  idle: "Idle",
  "requesting-permission": "Requesting permission",
  ready: "Ready",
  capturing: "Capturing",
  error: "Error",
} as const;

export function AudioInputPanel() {
  const microphone = useMicrophoneCapture();
  const supportError = getMicrophoneSupportError();
  const isSupported = isMicrophoneCaptureSupported();
  const isRequesting = microphone.status === "requesting-permission";
  const isCapturing = microphone.status === "capturing";
  const selectedDevice =
    microphone.devices.find(
      (device) => device.deviceId === microphone.selectedDeviceId,
    ) ?? null;

  return (
    <section className="control-panel audio-panel" aria-label="Microphone capture sandbox">
      <div className="panel-copy">
        <h3>Microphone capture sandbox</h3>
        <p>
          This microphone panel only tests browser audio capture. It does not
          send audio to OpenAI yet.
        </p>
      </div>

      {supportError ? (
        <p className="audio-warning" role="alert">
          {supportError}
        </p>
      ) : null}

      <div className="audio-status-row">
        <div className={`status-chip status-${microphone.status}`}>
          <span className="status-dot" />
          {statusLabels[microphone.status]}
        </div>
        <div className="audio-flag">
          Permission: {microphone.permissionGranted ? "Granted" : "Not yet"}
        </div>
      </div>

      <div className="audio-panel-grid">
        <label className="field">
          <span>Audio input device</span>
          <select
            value={microphone.selectedDeviceId ?? ""}
            onChange={(event) =>
              microphone.setSelectedDeviceId(event.target.value || null)
            }
            disabled={!isSupported || isRequesting}
          >
            <option value="">Default browser input</option>
            {microphone.devices.map((device) => (
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

      <div className="control-row control-row-wrap">
        <button
          type="button"
          onClick={() => void microphone.refreshDevices()}
          disabled={!isSupported || isRequesting}
        >
          Refresh devices
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => void microphone.startCapture()}
          disabled={!isSupported || isRequesting || isCapturing}
        >
          Start mic
        </button>
        <button
          type="button"
          onClick={microphone.stopCapture}
          disabled={!isCapturing}
        >
          Stop mic
        </button>
      </div>

      <AudioLevelMeter level={microphone.inputLevel} />

      <div className="audio-helper-grid">
        <div className="audio-helper-card">
          <span>Visible devices</span>
          <strong>{microphone.devices.length}</strong>
        </div>
        <div className="audio-helper-card">
          <span>Browser support</span>
          <strong>{isSupported ? "Supported" : "Unavailable"}</strong>
        </div>
      </div>

      <p className="helper-text">
        If device labels are hidden before permission is granted, refresh or
        start capture once and the browser may expose the real labels.
      </p>

      {microphone.errorMessage ? (
        <p className="error-message" role="alert">
          {microphone.errorMessage}
        </p>
      ) : null}
    </section>
  );
}
