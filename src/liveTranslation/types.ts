export type SubtitleStatus = "idle" | "starting" | "listening" | "error";

export type SubtitleLine = {
  id: string;
  text: string;
  isFinal: boolean;
  createdAt: number;
};

export type TargetLanguage = "it" | "en";

export type LiveTranslationState = {
  status: SubtitleStatus;
  isVisible: boolean;
  targetLanguage: TargetLanguage;
  currentPartial: string | null;
  recentFinals: SubtitleLine[];
  errorMessage: string | null;
};

export type TranslationSession = {
  stop: () => void;
};

export type TranslationStartOptions = {
  targetLanguage: TargetLanguage;
  onListening: () => void;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
};

export type TranslationProviderAdapter = {
  start: (
    options: TranslationStartOptions,
  ) => TranslationSession | Promise<TranslationSession>;
};

export type LiveTranslationController = LiveTranslationState & {
  start: () => Promise<void>;
  stop: () => void;
  toggleVisible: () => void;
  setVisible: (visible: boolean) => void;
  setTargetLanguage: (language: TargetLanguage) => void;
  clearSubtitles: () => void;
};

