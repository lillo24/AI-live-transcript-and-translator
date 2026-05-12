import {
  createContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { openAIRealtimeTranslationProvider } from "./providers/OpenAIRealtimeTranslationProvider";
import { fakeTranslationProvider } from "./providers/FakeTranslationProvider";
import { useLiveTranslationShortcuts } from "./useLiveTranslationShortcuts";
import type {
  LiveTranslationStartOptions,
  LiveTranslationConfig,
  LiveTranslationController,
  LiveTranslationProviderKind,
  LiveTranslationState,
  OpenAITranslationNoiseReduction,
  ResolvedLiveTranslationConfig,
  SubtitleLine,
  TargetLanguage,
  TranslationProviderAdapter,
  TranslationProviderSession,
} from "./types";

const defaultConfig: ResolvedLiveTranslationConfig = {
  providerKind: "fake",
  defaultVisible: true,
  defaultTargetLanguage: "en",
  maxRecentFinals: 4,
  overlayPosition: "bottom",
  overlayDensity: "comfortable",
  enableKeyboardShortcuts: true,
  apiBaseUrl: null,
  defaultNoiseReduction: "near_field",
  playTranslatedAudioByDefault: false,
};

export const LiveTranslationContext =
  createContext<LiveTranslationController | null>(null);

type LiveTranslationProviderProps = PropsWithChildren<{
  config?: Partial<LiveTranslationConfig>;
  provider?: TranslationProviderAdapter;
}>;

function resolveConfig(
  config?: Partial<LiveTranslationConfig>,
): ResolvedLiveTranslationConfig {
  return {
    ...defaultConfig,
    ...config,
    overlayDensity: config?.overlayDensity ?? defaultConfig.overlayDensity,
    defaultNoiseReduction:
      config?.defaultNoiseReduction ?? defaultConfig.defaultNoiseReduction,
    playTranslatedAudioByDefault:
      config?.playTranslatedAudioByDefault ??
      defaultConfig.playTranslatedAudioByDefault,
  };
}

function createDefaultState(
  config: ResolvedLiveTranslationConfig,
): LiveTranslationState {
  return {
    status: "idle",
    isVisible: config.defaultVisible,
    targetLanguage: config.defaultTargetLanguage,
    currentPartial: null,
    recentFinals: [],
    errorMessage: null,
    connectionStatus: null,
    sourceTranscript: null,
  };
}

function resolveProviderAdapter(
  kind: LiveTranslationProviderKind,
  override?: TranslationProviderAdapter,
) {
  if (override) {
    return override;
  }

  switch (kind) {
    case "fake":
      return fakeTranslationProvider;
    case "openai-webrtc":
      return openAIRealtimeTranslationProvider;
  }
}

type ResolvedStartOptions = {
  selectedDeviceId: string | null;
  noiseReduction: OpenAITranslationNoiseReduction;
  playTranslatedAudio: boolean;
  apiBaseUrl: string | null;
  onConnectionStatus?: (status: string | null) => void;
  onSourceTranscript?: (text: string | null) => void;
  onRemoteAudioStream?: (stream: MediaStream | null) => void;
  onEvent?: (type: string, payload?: unknown) => void;
};

function createSubtitleLine(text: string): SubtitleLine {
  return {
    id: `subtitle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    isFinal: true,
    createdAt: Date.now(),
  };
}

export function LiveTranslationProvider({
  children,
  config,
  provider,
}: LiveTranslationProviderProps) {
  const resolvedConfig = resolveConfig(config);
  const initialConfigRef = useRef<ResolvedLiveTranslationConfig>(resolvedConfig);
  const [state, setState] = useState<LiveTranslationState>(() =>
    createDefaultState(initialConfigRef.current),
  );
  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  const sessionRef = useRef<TranslationProviderSession | null>(null);
  const runIdRef = useRef(0);
  const configRef = useRef(resolvedConfig);
  const startOptionsRef = useRef<ResolvedStartOptions | null>(null);

  configRef.current = resolvedConfig;

  function updateState(
    updater: (current: LiveTranslationState) => LiveTranslationState,
  ) {
    const nextState = updater(stateRef.current);
    stateRef.current = nextState;
    setState(nextState);
    return nextState;
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      clearExternalSessionState();
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (stateRef.current.recentFinals.length <= resolvedConfig.maxRecentFinals) {
      return;
    }

    updateState((current) => ({
      ...current,
      recentFinals: current.recentFinals.slice(0, resolvedConfig.maxRecentFinals),
    }));
  }, [resolvedConfig.maxRecentFinals]);

  function resolveStartOptions(
    options?: LiveTranslationStartOptions,
  ): ResolvedStartOptions {
    return {
      selectedDeviceId: options?.selectedDeviceId ?? null,
      noiseReduction:
        options?.noiseReduction ?? configRef.current.defaultNoiseReduction,
      playTranslatedAudio:
        options?.playTranslatedAudio ??
        configRef.current.playTranslatedAudioByDefault,
      apiBaseUrl: configRef.current.apiBaseUrl,
      onConnectionStatus: options?.onConnectionStatus,
      onSourceTranscript: options?.onSourceTranscript,
      onRemoteAudioStream: options?.onRemoteAudioStream,
      onEvent: options?.onEvent,
    };
  }

  function clearExternalSessionState() {
    const activeStartOptions = startOptionsRef.current;

    activeStartOptions?.onConnectionStatus?.(null);
    activeStartOptions?.onSourceTranscript?.(null);
    activeStartOptions?.onRemoteAudioStream?.(null);

    startOptionsRef.current = null;
  }

  async function start(options?: LiveTranslationStartOptions) {
    const currentState = stateRef.current;

    if (
      currentState.status === "starting" ||
      currentState.status === "connecting" ||
      currentState.status === "listening"
    ) {
      return;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;

    clearExternalSessionState();
    sessionRef.current?.stop();
    sessionRef.current = null;
    const resolvedStartOptions = resolveStartOptions(options);
    startOptionsRef.current = resolvedStartOptions;

    updateState((nextState) => ({
      ...nextState,
      status: "starting",
      currentPartial: null,
      errorMessage: null,
      connectionStatus: null,
      sourceTranscript: null,
    }));

    try {
      const activeProvider = resolveProviderAdapter(
        configRef.current.providerKind,
        provider,
      );
      const nextSession = await activeProvider.start({
        targetLanguage: stateRef.current.targetLanguage,
        selectedDeviceId: resolvedStartOptions.selectedDeviceId,
        noiseReduction: resolvedStartOptions.noiseReduction,
        playTranslatedAudio: resolvedStartOptions.playTranslatedAudio,
        apiBaseUrl: resolvedStartOptions.apiBaseUrl,
        onListening: () => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          updateState((nextState) => ({
            ...nextState,
            status: "listening",
            errorMessage: null,
          }));
        },
        onConnectionStatus: (status) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          resolvedStartOptions.onConnectionStatus?.(status);

          updateState((nextState) => ({
            ...nextState,
            status:
              nextState.status === "starting" &&
              status &&
              status.toLowerCase() !== "connected"
                ? "connecting"
                : nextState.status,
            connectionStatus: status,
          }));
        },
        onSourceTranscript: (text) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          resolvedStartOptions.onSourceTranscript?.(text);

          updateState((nextState) => ({
            ...nextState,
            sourceTranscript: text,
          }));
        },
        onRemoteAudioStream: (stream) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          resolvedStartOptions.onRemoteAudioStream?.(stream);
        },
        onEvent: (type, payload) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          resolvedStartOptions.onEvent?.(type, payload);
        },
        onPartial: (text) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          updateState((nextState) => ({
            ...nextState,
            currentPartial: text,
            errorMessage: null,
          }));
        },
        onFinal: (text) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          updateState((nextState) => ({
            ...nextState,
            status: "listening",
            currentPartial: null,
            recentFinals: [createSubtitleLine(text), ...nextState.recentFinals].slice(
              0,
              configRef.current.maxRecentFinals,
            ),
            errorMessage: null,
          }));
        },
        onError: (message) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          clearExternalSessionState();
          sessionRef.current?.stop();
          sessionRef.current = null;

          updateState((nextState) => ({
            ...nextState,
            status: "error",
            currentPartial: null,
            errorMessage: message,
            connectionStatus: null,
          }));
        },
      });

      if (!mountedRef.current || runId !== runIdRef.current) {
        nextSession.stop();
        return;
      }

      sessionRef.current = nextSession;
    } catch (error) {
      if (!mountedRef.current || runId !== runIdRef.current) {
        return;
      }

      sessionRef.current?.stop();
      sessionRef.current = null;

      updateState((nextState) => ({
        ...nextState,
        status: "error",
        currentPartial: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unable to start live translation.",
        connectionStatus: null,
      }));
    }
  }

  function stop() {
    runIdRef.current += 1;
    clearExternalSessionState();
    sessionRef.current?.stop();
    sessionRef.current = null;

    if (!mountedRef.current) {
      return;
    }

    updateState((nextState) => ({
      ...nextState,
      status: "idle",
      currentPartial: null,
      errorMessage: null,
      connectionStatus: null,
      sourceTranscript: null,
    }));
  }

  function toggleVisible() {
    updateState((nextState) => ({
      ...nextState,
      isVisible: !nextState.isVisible,
    }));
  }

  function setVisible(visible: boolean) {
    updateState((nextState) => ({
      ...nextState,
      isVisible: visible,
    }));
  }

  function setTargetLanguage(language: TargetLanguage) {
    updateState((nextState) =>
      nextState.targetLanguage === language
        ? nextState
        : {
            ...nextState,
            targetLanguage: language,
          },
    );
  }

  function clearSubtitles() {
    updateState((nextState) => ({
      ...nextState,
      currentPartial: null,
      recentFinals: [],
      errorMessage: null,
    }));
  }

  function setManualPartial(text: string) {
    const nextText = text.trim();

    updateState((nextState) => ({
      ...nextState,
      currentPartial: nextText || null,
      errorMessage: null,
    }));
  }

  function commitManualFinal(text: string) {
    const nextText = text.trim();

    if (!nextText) {
      return;
    }

    updateState((nextState) => ({
      ...nextState,
      currentPartial: null,
      recentFinals: [createSubtitleLine(nextText), ...nextState.recentFinals].slice(
        0,
        configRef.current.maxRecentFinals,
      ),
      errorMessage: null,
    }));
  }

  useLiveTranslationShortcuts({
    enabled: resolvedConfig.enableKeyboardShortcuts,
    status: state.status,
    start,
    stop,
    toggleVisible,
  });

  const value: LiveTranslationController = {
    ...state,
    config: resolvedConfig,
    start,
    stop,
    toggleVisible,
    setVisible,
    setTargetLanguage,
    clearSubtitles,
    setManualPartial,
    commitManualFinal,
  };

  return (
    <LiveTranslationContext.Provider value={value}>
      {children}
    </LiveTranslationContext.Provider>
  );
}
