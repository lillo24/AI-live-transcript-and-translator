import type { AudioInputDevice } from "../types";

const unsupportedMicrophoneMessage =
  "This browser does not support microphone capture through navigator.mediaDevices.";

export function getMicrophoneSupportError() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.enumerateDevices !== "function" ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    return unsupportedMicrophoneMessage;
  }

  return null;
}

export function isMicrophoneCaptureSupported() {
  return getMicrophoneSupportError() === null;
}

function normalizeAudioInputLabel(label: string, index: number) {
  const trimmedLabel = label.trim();

  if (trimmedLabel) {
    return trimmedLabel;
  }

  return `Microphone ${index + 1}`;
}

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  const supportError = getMicrophoneSupportError();

  if (supportError) {
    throw new Error(supportError);
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((device) => device.kind === "audioinput");

  return audioInputs.map((device, index) => ({
    deviceId: device.deviceId,
    label: normalizeAudioInputLabel(device.label, index),
    groupId: device.groupId || undefined,
  }));
}
