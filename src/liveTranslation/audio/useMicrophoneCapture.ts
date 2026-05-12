import { useEffect, useRef, useState } from "react";
import {
  getMicrophoneSupportError,
  listAudioInputDevices,
} from "./audioDevices";
import type {
  AudioInputDevice,
  MicrophoneCaptureController,
  MicrophoneCaptureState,
  MicrophoneCaptureStatus,
} from "../types";

const initialState: MicrophoneCaptureState = {
  status: "idle",
  devices: [],
  selectedDeviceId: null,
  stream: null,
  inputLevel: 0,
  errorMessage: null,
  permissionGranted: false,
};

function getReadyStateStatus(state: MicrophoneCaptureState): MicrophoneCaptureStatus {
  return state.devices.length > 0 || state.permissionGranted ? "ready" : "idle";
}

function resolveSelectedDeviceId(
  devices: AudioInputDevice[],
  selectedDeviceId: string | null,
) {
  if (!devices.length) {
    return null;
  }

  if (selectedDeviceId && devices.some((device) => device.deviceId === selectedDeviceId)) {
    return selectedDeviceId;
  }

  return devices[0].deviceId;
}

function getReadableMicrophoneError(error: unknown) {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "Microphone permission was denied.";
      case "NotFoundError":
        return "No microphone input device was found.";
      case "NotReadableError":
        return "The selected microphone could not be started. It may already be in use.";
      case "OverconstrainedError":
        return "The selected microphone is no longer available. Refresh the device list and try again.";
      case "SecurityError":
        return "Microphone access is blocked by the browser security settings.";
      default:
        return error.message || "Unable to start microphone capture.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to start microphone capture.";
}

function clampLevel(level: number) {
  return Math.min(1, Math.max(0, level));
}

export function useMicrophoneCapture(): MicrophoneCaptureController {
  const [state, setState] = useState<MicrophoneCaptureState>(initialState);
  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const captureRunIdRef = useRef(0);

  function updateState(
    updater: (current: MicrophoneCaptureState) => MicrophoneCaptureState,
  ) {
    const nextState = updater(stateRef.current);
    stateRef.current = nextState;
    setState(nextState);
    return nextState;
  }

  function cleanupAudioRuntime(stopTracks: boolean) {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;

    if (audioContext) {
      void audioContext.close().catch(() => {});
    }

    const stream = streamRef.current;
    streamRef.current = null;

    if (stopTracks && stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  }

  async function refreshDevices() {
    const supportError = getMicrophoneSupportError();

    if (supportError) {
      updateState((current) => ({
        ...current,
        status: "error",
        devices: [],
        selectedDeviceId: null,
        stream: null,
        inputLevel: 0,
        errorMessage: supportError,
      }));
      return;
    }

    try {
      const devices = await listAudioInputDevices();

      if (!mountedRef.current) {
        return;
      }

      updateState((current) => ({
        ...current,
        devices,
        selectedDeviceId: resolveSelectedDeviceId(
          devices,
          current.selectedDeviceId,
        ),
        status:
          current.status === "capturing" ||
          current.status === "requesting-permission"
            ? current.status
            : current.permissionGranted || devices.length > 0
              ? "ready"
              : "idle",
        errorMessage: null,
      }));
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      updateState((current) => ({
        ...current,
        status: current.status === "capturing" ? "capturing" : "error",
        errorMessage: getReadableMicrophoneError(error),
      }));
    }
  }

  function setSelectedDeviceId(deviceId: string | null) {
    updateState((current) => ({
      ...current,
      selectedDeviceId: deviceId,
    }));
  }

  function stopCapture() {
    captureRunIdRef.current += 1;
    cleanupAudioRuntime(true);

    if (!mountedRef.current) {
      return;
    }

    updateState((current) => ({
      ...current,
      status: getReadyStateStatus(current),
      stream: null,
      inputLevel: 0,
      errorMessage: null,
    }));
  }

  async function startCapture() {
    const supportError = getMicrophoneSupportError();

    if (supportError) {
      updateState((current) => ({
        ...current,
        status: "error",
        errorMessage: supportError,
      }));
      return;
    }

    const currentState = stateRef.current;

    if (
      currentState.status === "requesting-permission" ||
      currentState.status === "capturing"
    ) {
      return;
    }

    captureRunIdRef.current += 1;
    const runId = captureRunIdRef.current;

    cleanupAudioRuntime(true);

    updateState((current) => ({
      ...current,
      status: "requesting-permission",
      stream: null,
      inputLevel: 0,
      errorMessage: null,
    }));

    try {
      const constraints: MediaStreamConstraints = {
        audio: currentState.selectedDeviceId
          ? {
              deviceId: { exact: currentState.selectedDeviceId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!mountedRef.current || runId !== captureRunIdRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      streamRef.current = stream;

      if (window.AudioContext) {
        const audioContext = new window.AudioContext();
        audioContextRef.current = audioContext;

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const sourceNode = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.85;
        sourceNode.connect(analyser);

        sourceNodeRef.current = sourceNode;
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.fftSize);

        const updateMeter = () => {
          if (
            !mountedRef.current ||
            runId !== captureRunIdRef.current ||
            !analyserRef.current
          ) {
            return;
          }

          analyserRef.current.getByteTimeDomainData(data);

          let sum = 0;

          for (const sample of data) {
            const normalized = (sample - 128) / 128;
            sum += normalized * normalized;
          }

          const rms = Math.sqrt(sum / data.length);
          const nextLevel = clampLevel(rms * 4);

          if (Math.abs(stateRef.current.inputLevel - nextLevel) >= 0.015) {
            updateState((current) => ({
              ...current,
              inputLevel: nextLevel,
            }));
          }

          animationFrameRef.current = window.requestAnimationFrame(updateMeter);
        };

        animationFrameRef.current = window.requestAnimationFrame(updateMeter);
      }

      let devices = currentState.devices;

      try {
        devices = await listAudioInputDevices();
      } catch {
        devices = currentState.devices;
      }

      if (!mountedRef.current || runId !== captureRunIdRef.current) {
        cleanupAudioRuntime(true);
        return;
      }

      updateState((current) => ({
        ...current,
        status: "capturing",
        devices,
        selectedDeviceId: resolveSelectedDeviceId(
          devices,
          current.selectedDeviceId,
        ),
        stream,
        inputLevel: 0,
        permissionGranted: true,
        errorMessage: null,
      }));
    } catch (error) {
      if (!mountedRef.current || runId !== captureRunIdRef.current) {
        return;
      }

      cleanupAudioRuntime(true);

      updateState((current) => ({
        ...current,
        status: "error",
        stream: null,
        inputLevel: 0,
        errorMessage: getReadableMicrophoneError(error),
      }));
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void refreshDevices();

    return () => {
      mountedRef.current = false;
      captureRunIdRef.current += 1;
      cleanupAudioRuntime(true);
    };
  }, []);

  return {
    ...state,
    refreshDevices,
    setSelectedDeviceId,
    startCapture,
    stopCapture,
  };
}
