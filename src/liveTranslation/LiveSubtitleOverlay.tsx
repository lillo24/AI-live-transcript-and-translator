import { useLiveTranslation } from "./useLiveTranslation";

const overlayShellStyle = {
  position: "fixed",
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 50,
} as const;

const overlayBubbleStyle = {
  maxWidth: "min(920px, calc(100vw - 2rem))",
  color: "#fff8ef",
  background: "rgba(10, 10, 12, 0.78)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  boxShadow: "0 16px 42px rgba(0, 0, 0, 0.28)",
  textAlign: "center",
  lineHeight: 1.45,
  backdropFilter: "blur(12px)",
} as const;

export function LiveSubtitleOverlay() {
  const { config, currentPartial, isVisible, recentFinals } =
    useLiveTranslation();

  if (!isVisible) {
    return null;
  }

  const activeFinal = recentFinals[0];
  const text = currentPartial ?? activeFinal?.text ?? null;

  if (!text) {
    return null;
  }

  const isPartial = Boolean(currentPartial);
  const isTopPosition = config.overlayPosition === "top";
  const isCompact = config.overlayDensity === "compact";

  return (
    <div
      style={{
        ...overlayShellStyle,
        inset: isTopPosition ? "0 0 auto" : "auto 0 0",
        padding: isTopPosition ? "1.2rem 1rem 0" : "0 1rem 1.5rem",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        style={{
          ...overlayBubbleStyle,
          padding: isCompact ? "0.65rem 0.95rem" : "0.95rem 1.2rem",
          borderRadius: isCompact ? "16px" : "20px",
          fontSize: isCompact
            ? "clamp(0.92rem, 1.2vw, 1.15rem)"
            : "clamp(1rem, 1.6vw, 1.45rem)",
          opacity: isPartial ? 0.86 : 1,
          fontStyle: isPartial ? "italic" : "normal",
        }}
      >
        {text}
      </div>
    </div>
  );
}
