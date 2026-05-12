import type { TranslationLanguageCode } from "./languages";

export type SubtitleStatus =
  | "idle"
  | "starting"
  | "connecting"
  | "listening"
  | "error";

export type SubtitleLine = {
  id: string;
  text: string;
  isFinal: boolean;
  createdAt: number;
};

export type TargetLanguage = TranslationLanguageCode;

export type OpenAITranslationNoiseReduction =
  | "near_field"
  | "far_field"
  | "disabled";

export type LiveTranslationProviderKind = "fake" | "openai-webrtc";

export type OverlayPosition = "bottom" | "top";

export type OverlayDensity = "comfortable" | "compact";

export type LiveTranslationConfig = {
  providerKind: LiveTranslationProviderKind;
  defaultVisible: boolean;
  defaultTargetLanguage: TargetLanguage;
  maxRecentFinals: number;
  overlayPosition: OverlayPosition;
  overlayDensity?: OverlayDensity;
  enableKeyboardShortcuts: boolean;
  apiBaseUrl?: string | null;
  defaultNoiseReduction?: OpenAITranslationNoiseReduction;
  playTranslatedAudioByDefault?: boolean;
};

export type ResolvedLiveTranslationConfig = Omit<
  LiveTranslationConfig,
  | "overlayDensity"
  | "apiBaseUrl"
  | "defaultNoiseReduction"
  | "playTranslatedAudioByDefault"
> & {
  overlayDensity: OverlayDensity;
  apiBaseUrl: string | null;
  defaultNoiseReduction: OpenAITranslationNoiseReduction;
  playTranslatedAudioByDefault: boolean;
};

export type LiveTranslationState = {
  status: SubtitleStatus;
  isVisible: boolean;
  targetLanguage: TargetLanguage;
  currentPartial: string | null;
  recentFinals: SubtitleLine[];
  errorMessage: string | null;
  connectionStatus: string | null;
  sourceTranscript: string | null;
};

export type TranslationProviderSession = {
  stop: () => void;
};

export type LiveTranslationStartOptions = {
  selectedDeviceId?: string | null;
  noiseReduction?: OpenAITranslationNoiseReduction;
  playTranslatedAudio?: boolean;
  onConnectionStatus?: (status: string | null) => void;
  onSourceTranscript?: (text: string | null) => void;
  onRemoteAudioStream?: (stream: MediaStream | null) => void;
  onEvent?: (type: string, payload?: unknown) => void;
};

export type TranslationProviderStartOptions = {
  targetLanguage: TargetLanguage;
  selectedDeviceId?: string | null;
  noiseReduction?: OpenAITranslationNoiseReduction;
  playTranslatedAudio?: boolean;
  apiBaseUrl?: string | null;
  onListening: () => void;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onConnectionStatus?: (status: string | null) => void;
  onSourceTranscript?: (text: string | null) => void;
  onRemoteAudioStream?: (stream: MediaStream | null) => void;
  onEvent?: (type: string, payload?: unknown) => void;
};

export type TranslationProviderAdapter = {
  kind: LiveTranslationProviderKind;
  start: (
    options: TranslationProviderStartOptions,
  ) =>
    | TranslationProviderSession
    | Promise<TranslationProviderSession>;
};

export type LiveTranslationController = LiveTranslationState & {
  config: ResolvedLiveTranslationConfig;
  start: (options?: LiveTranslationStartOptions) => Promise<void>;
  stop: () => void;
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  setTargetLanguage: (language: TargetLanguage) => void;
  clearSubtitles: () => void;
  setManualPartial: (text: string) => void;
  commitManualFinal: (text: string) => void;
};

export type MicrophoneCaptureStatus =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "capturing"
  | "error";

export type AudioInputDevice = {
  deviceId: string;
  label: string;
  groupId?: string;
};

export type MicrophoneCaptureState = {
  status: MicrophoneCaptureStatus;
  devices: AudioInputDevice[];
  selectedDeviceId: string | null;
  stream: MediaStream | null;
  inputLevel: number;
  errorMessage: string | null;
  permissionGranted: boolean;
};

export type MicrophoneCaptureController = MicrophoneCaptureState & {
  refreshDevices: () => Promise<void>;
  setSelectedDeviceId: (deviceId: string | null) => void;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
};
