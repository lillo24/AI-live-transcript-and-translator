import { useContext } from "react";
import { LiveTranslationContext } from "./LiveTranslationProvider";

export function useLiveTranslation() {
  const context = useContext(LiveTranslationContext);

  if (!context) {
    throw new Error(
      "useLiveTranslation must be used within a LiveTranslationProvider.",
    );
  }

  return context;
}

