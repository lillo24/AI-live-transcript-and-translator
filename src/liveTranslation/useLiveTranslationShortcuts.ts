import { useEffect, useEffectEvent } from "react";
import type { SubtitleStatus } from "./types";

type LiveTranslationShortcutOptions = {
  enabled: boolean;
  status: SubtitleStatus;
  start: () => Promise<void>;
  stop: () => void;
  toggleVisible: () => void;
};

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

export function useLiveTranslationShortcuts({
  enabled,
  status,
  start,
  stop,
  toggleVisible,
}: LiveTranslationShortcutOptions) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isEditableTarget(event.target)
    ) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stop();
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "s") {
      event.preventDefault();
      toggleVisible();
      return;
    }

    if (key === "m") {
      event.preventDefault();

      if (status === "starting" || status === "listening") {
        stop();
        return;
      }

      void start();
    }
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
