export type SubtitleStatus = "idle" | "starting" | "listening" | "error";

export type SubtitleLine = {
  id: string;
  text: string;
  isFinal: boolean;
  createdAt: number;
};

export type TargetLanguage = "it" | "en";

// Later chapters can expand this with "openai-webrtc".
export type LiveTranslationProviderKind = "fake";

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
};

export type ResolvedLiveTranslationConfig = Omit<
  LiveTranslationConfig,
  "overlayDensity"
> & {
  overlayDensity: OverlayDensity;
};

export type LiveTranslationState = {
  status: SubtitleStatus;
  isVisible: boolean;
  targetLanguage: TargetLanguage;
  currentPartial: string | null;
  recentFinals: SubtitleLine[];
  errorMessage: string | null;
};

export type TranslationProviderSession = {
  stop: () => void;
};

export type TranslationProviderStartOptions = {
  targetLanguage: TargetLanguage;
  onListening: () => void;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
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
  start: () => Promise<void>;
  stop: () => void;
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  setTargetLanguage: (language: TargetLanguage) => void;
  clearSubtitles: () => void;
  setManualPartial: (text: string) => void;
  commitManualFinal: (text: string) => void;
};
