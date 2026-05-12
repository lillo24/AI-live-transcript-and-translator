import {
  createContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { fakeTranslationProvider } from "./providers/FakeTranslationProvider";
import type {
  LiveTranslationController,
  LiveTranslationState,
  SubtitleLine,
  TargetLanguage,
  TranslationProviderAdapter,
  TranslationSession,
} from "./types";

const defaultState: LiveTranslationState = {
  status: "idle",
  isVisible: true,
  targetLanguage: "en",
  currentPartial: null,
  recentFinals: [],
  errorMessage: null,
};

export const LiveTranslationContext =
  createContext<LiveTranslationController | null>(null);

type LiveTranslationProviderProps = PropsWithChildren<{
  provider?: TranslationProviderAdapter;
  maxRecentFinals?: number;
}>;

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
  provider = fakeTranslationProvider,
  maxRecentFinals = 4,
}: LiveTranslationProviderProps) {
  const [state, setState] = useState<LiveTranslationState>(defaultState);
  const mountedRef = useRef(true);
  const sessionRef = useRef<TranslationSession | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  async function start() {
    if (state.status === "starting" || state.status === "listening") {
      return;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;

    sessionRef.current?.stop();
    sessionRef.current = null;

    setState((current) => ({
      ...current,
      status: "starting",
      currentPartial: null,
      errorMessage: null,
    }));

    try {
      const nextSession = await provider.start({
        targetLanguage: state.targetLanguage,
        onListening: () => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          setState((current) => ({
            ...current,
            status: "listening",
            errorMessage: null,
          }));
        },
        onPartial: (text) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          setState((current) => ({
            ...current,
            currentPartial: text,
            errorMessage: null,
          }));
        },
        onFinal: (text) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          setState((current) => ({
            ...current,
            status: "listening",
            currentPartial: null,
            recentFinals: [createSubtitleLine(text), ...current.recentFinals].slice(
              0,
              maxRecentFinals,
            ),
            errorMessage: null,
          }));
        },
        onError: (message) => {
          if (!mountedRef.current || runId !== runIdRef.current) {
            return;
          }

          sessionRef.current?.stop();
          sessionRef.current = null;

          setState((current) => ({
            ...current,
            status: "error",
            currentPartial: null,
            errorMessage: message,
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

      setState((current) => ({
        ...current,
        status: "error",
        currentPartial: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unable to start live translation.",
      }));
    }
  }

  function stop() {
    runIdRef.current += 1;
    sessionRef.current?.stop();
    sessionRef.current = null;

    if (!mountedRef.current) {
      return;
    }

    setState((current) => ({
      ...current,
      status: "idle",
      currentPartial: null,
      errorMessage: null,
    }));
  }

  function toggleVisible() {
    setState((current) => ({
      ...current,
      isVisible: !current.isVisible,
    }));
  }

  function setVisible(visible: boolean) {
    setState((current) => ({
      ...current,
      isVisible: visible,
    }));
  }

  function setTargetLanguage(language: TargetLanguage) {
    setState((current) => ({
      ...current,
      targetLanguage: language,
    }));
  }

  function clearSubtitles() {
    setState((current) => ({
      ...current,
      currentPartial: null,
      recentFinals: [],
      errorMessage: null,
    }));
  }

  const value: LiveTranslationController = {
    ...state,
    start,
    stop,
    toggleVisible,
    setVisible,
    setTargetLanguage,
    clearSubtitles,
  };

  return (
    <LiveTranslationContext.Provider value={value}>
      {children}
    </LiveTranslationContext.Provider>
  );
}
