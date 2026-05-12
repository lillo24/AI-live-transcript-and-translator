import { createOpenAITranslationClientSecret } from "../openai/openaiTranslationSessionApi";
import type {
  OpenAITranslationNoiseReduction,
  TranslationProviderAdapter,
  TranslationProviderStartOptions,
} from "../types";

const OPENAI_TRANSLATION_CALLS_URL =
  "https://api.openai.com/v1/realtime/translations/calls";

type TranscriptBuffers = {
  output: string;
  input: string;
};

function getReadableRealtimeError(error: unknown) {
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
        return error.message || "Unable to start the realtime translation session.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to start the realtime translation session.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(
  value: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    if (typeof value[key] === "string") {
      return value[key];
    }
  }

  return null;
}

function readNestedErrorMessage(value: Record<string, unknown>) {
  const directMessage = readStringField(value, ["message", "error"]);

  if (directMessage) {
    return directMessage;
  }

  if (isRecord(value.error)) {
    return (
      readStringField(value.error, ["message", "error", "type"]) ||
      "OpenAI returned an error event."
    );
  }

  return "OpenAI returned an error event.";
}

function isFinalTranscriptType(type: string) {
  return (
    type.includes("done") ||
    type.includes("completed") ||
    type.includes("final")
  );
}

function buildMicrophoneConstraints(
  selectedDeviceId: string | null | undefined,
  noiseReduction: OpenAITranslationNoiseReduction | undefined,
): MediaStreamConstraints {
  const shouldSuppressNoise = noiseReduction !== "disabled";

  return {
    audio: selectedDeviceId
      ? {
          deviceId: { exact: selectedDeviceId },
          echoCancellation: shouldSuppressNoise,
          noiseSuppression: shouldSuppressNoise,
          autoGainControl: true,
        }
      : {
          echoCancellation: shouldSuppressNoise,
          noiseSuppression: shouldSuppressNoise,
          autoGainControl: true,
        },
  };
}

async function waitForIceGatheringComplete(peerConnection: RTCPeerConnection) {
  if (peerConnection.iceGatheringState === "complete") {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeoutId = window.setTimeout(finish, 4_000);

    function finish() {
      window.clearTimeout(timeoutId);
      peerConnection.removeEventListener(
        "icegatheringstatechange",
        handleStateChange,
      );
      resolve();
    }

    function handleStateChange() {
      if (peerConnection.iceGatheringState === "complete") {
        finish();
      }
    }

    peerConnection.addEventListener(
      "icegatheringstatechange",
      handleStateChange,
    );
  });
}

async function postRealtimeOffer(
  clientSecret: string,
  offerSdp: string,
): Promise<string> {
  const response = await fetch(OPENAI_TRANSLATION_CALLS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offerSdp,
  });

  const responseText = await response.text();

  if (!response.ok) {
    try {
      const errorPayload = JSON.parse(responseText) as {
        error?: { message?: string };
        message?: string;
      };
      throw new Error(
        errorPayload.error?.message ||
          errorPayload.message ||
          `OpenAI rejected the realtime translation offer with status ${response.status}.`,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        `OpenAI rejected the realtime translation offer with status ${response.status}.`,
      );
    }
  }

  if (!responseText.trim()) {
    throw new Error("OpenAI returned an empty SDP answer.");
  }

  return responseText;
}

function handleRealtimeTranslationEvent(
  payload: unknown,
  transcriptBuffers: TranscriptBuffers,
  options: TranslationProviderStartOptions,
  fail: (message: string) => void,
) {
  let eventPayload = payload;

  if (typeof eventPayload === "string") {
    try {
      eventPayload = JSON.parse(eventPayload);
    } catch {
      return;
    }
  }

  if (!isRecord(eventPayload) || typeof eventPayload.type !== "string") {
    return;
  }

  const { type } = eventPayload;
  options.onEvent?.(type, eventPayload);

  if (type.includes("error")) {
    fail(readNestedErrorMessage(eventPayload));
    return;
  }

  if (type === "session.output_transcript.delta") {
    const delta = readStringField(eventPayload, ["delta", "text", "transcript"]);

    if (delta) {
      transcriptBuffers.output += delta;
      options.onPartial(transcriptBuffers.output);
    }

    return;
  }

  if (type === "session.input_transcript.delta") {
    const delta = readStringField(eventPayload, ["delta", "text", "transcript"]);

    if (delta) {
      transcriptBuffers.input += delta;
      options.onSourceTranscript?.(transcriptBuffers.input);
    }

    return;
  }

  if (type.includes("output_transcript") && isFinalTranscriptType(type)) {
    const finalText =
      readStringField(eventPayload, ["transcript", "text", "delta"]) ||
      transcriptBuffers.output;
    const normalizedText = finalText.trim();

    if (normalizedText) {
      options.onFinal(normalizedText);
    }

    transcriptBuffers.output = "";
    return;
  }

  if (type.includes("input_transcript") && isFinalTranscriptType(type)) {
    const finalText =
      readStringField(eventPayload, ["transcript", "text", "delta"]) ||
      transcriptBuffers.input;

    transcriptBuffers.input = finalText;
    options.onSourceTranscript?.(finalText || null);
  }
}

function ensureRealtimeSupport() {
  if (
    typeof window === "undefined" ||
    typeof RTCPeerConnection === "undefined"
  ) {
    throw new Error("This browser does not support WebRTC peer connections.");
  }

  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    throw new Error("This browser cannot capture microphone audio.");
  }
}

export const openAIRealtimeTranslationProvider: TranslationProviderAdapter = {
  kind: "openai-webrtc",
  async start(options) {
    ensureRealtimeSupport();

    let stopped = false;
    let microphoneStream: MediaStream | null = null;
    let peerConnection: RTCPeerConnection | null = null;
    let dataChannel: RTCDataChannel | null = null;
    let remoteStream: MediaStream | null = null;
    let listeningStarted = false;

    const transcriptBuffers: TranscriptBuffers = {
      output: "",
      input: "",
    };

    function updateConnectionStatus(status: string | null) {
      if (stopped) {
        return;
      }

      options.onConnectionStatus?.(status);
    }

    function stopTracks(stream: MediaStream | null) {
      if (!stream) {
        return;
      }

      for (const track of stream.getTracks()) {
        track.stop();
      }
    }

    function cleanup() {
      if (stopped) {
        return;
      }

      stopped = true;

      if (dataChannel) {
        dataChannel.onopen = null;
        dataChannel.onmessage = null;
        dataChannel.onerror = null;
        dataChannel.onclose = null;

        if (dataChannel.readyState !== "closed") {
          try {
            dataChannel.close();
          } catch {}
        }
      }

      if (peerConnection) {
        peerConnection.onconnectionstatechange = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.ontrack = null;

        if (peerConnection.signalingState !== "closed") {
          peerConnection.close();
        }
      }

      stopTracks(remoteStream);
      stopTracks(microphoneStream);

      remoteStream = null;
      microphoneStream = null;
      peerConnection = null;
      dataChannel = null;

      options.onRemoteAudioStream?.(null);
      options.onSourceTranscript?.(null);
      options.onConnectionStatus?.(null);
    }

    function fail(message: string) {
      if (stopped) {
        return;
      }

      cleanup();
      options.onError(message);
    }

    function markListening() {
      if (stopped || listeningStarted) {
        return;
      }

      listeningStarted = true;
      updateConnectionStatus("Connected");
      options.onListening();
    }

    try {
      updateConnectionStatus("Requesting microphone");
      microphoneStream = await navigator.mediaDevices.getUserMedia(
        buildMicrophoneConstraints(
          options.selectedDeviceId,
          options.noiseReduction,
        ),
      );

      if (stopped) {
        stopTracks(microphoneStream);
        return { stop: cleanup };
      }

      updateConnectionStatus("Requesting OpenAI client secret");
      const session = await createOpenAITranslationClientSecret(
        {
          targetLanguage: options.targetLanguage,
          noiseReduction: options.noiseReduction,
        },
        {
          apiBaseUrl: options.apiBaseUrl,
        },
      );

      if (!session.clientSecret) {
        throw new Error("The local backend returned an empty OpenAI client secret.");
      }

      updateConnectionStatus("Creating peer connection");
      peerConnection = new RTCPeerConnection();
      dataChannel = peerConnection.createDataChannel("oai-events");

      dataChannel.onopen = () => {
        markListening();
      };

      dataChannel.onmessage = (event) => {
        handleRealtimeTranslationEvent(
          event.data,
          transcriptBuffers,
          options,
          fail,
        );
      };

      dataChannel.onerror = () => {
        fail("The realtime translation event channel reported an error.");
      };

      dataChannel.onclose = () => {
        if (!stopped && peerConnection?.connectionState !== "closed") {
          updateConnectionStatus("Event channel closed");
        }
      };

      peerConnection.ontrack = (event) => {
        const nextRemoteStream =
          event.streams[0] ||
          (() => {
            const fallbackStream = remoteStream ?? new MediaStream();
            fallbackStream.addTrack(event.track);
            return fallbackStream;
          })();

        remoteStream = nextRemoteStream;
        options.onRemoteAudioStream?.(nextRemoteStream);
      };

      peerConnection.onconnectionstatechange = () => {
        if (!peerConnection || stopped) {
          return;
        }

        switch (peerConnection.connectionState) {
          case "new":
            updateConnectionStatus("Peer connection created");
            break;
          case "connecting":
            updateConnectionStatus("Connecting to OpenAI");
            break;
          case "connected":
            markListening();
            break;
          case "disconnected":
            updateConnectionStatus("Connection lost");
            break;
          case "failed":
            fail("The WebRTC connection to OpenAI failed.");
            break;
          case "closed":
            break;
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        if (!peerConnection || stopped) {
          return;
        }

        if (peerConnection.iceConnectionState === "failed") {
          fail("ICE negotiation failed while connecting to OpenAI.");
        }
      };

      for (const track of microphoneStream.getAudioTracks()) {
        peerConnection.addTrack(track, microphoneStream);
      }

      updateConnectionStatus("Creating SDP offer");
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
      });
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);

      const offerSdp = peerConnection.localDescription?.sdp || offer.sdp;

      if (!offerSdp) {
        throw new Error("Unable to create a local SDP offer.");
      }

      updateConnectionStatus("Sending SDP offer to OpenAI");
      const answerSdp = await postRealtimeOffer(session.clientSecret, offerSdp);

      updateConnectionStatus("Applying OpenAI SDP answer");
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      updateConnectionStatus("Waiting for translated audio and transcripts");

      return {
        stop() {
          cleanup();
        },
      };
    } catch (error) {
      cleanup();
      throw new Error(getReadableRealtimeError(error));
    }
  },
};
