import { useLiveTranslation } from "./useLiveTranslation";

const overlayShellStyle = {
  position: "fixed",
  inset: "auto 0 0",
  display: "flex",
  justifyContent: "center",
  padding: "0 1rem 1.5rem",
  pointerEvents: "none",
  zIndex: 50,
} as const;

const overlayBubbleStyle = {
  maxWidth: "min(920px, calc(100vw - 2rem))",
  padding: "0.95rem 1.2rem",
  borderRadius: "20px",
  color: "#fff8ef",
  background: "rgba(10, 10, 12, 0.78)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  boxShadow: "0 16px 42px rgba(0, 0, 0, 0.28)",
  textAlign: "center",
  fontSize: "clamp(1rem, 1.6vw, 1.45rem)",
  lineHeight: 1.45,
  backdropFilter: "blur(12px)",
} as const;

export function LiveSubtitleOverlay() {
  const { currentPartial, isVisible, recentFinals } = useLiveTranslation();

  if (!isVisible) {
    return null;
  }

  const activeFinal = recentFinals[0];
  const text = currentPartial ?? activeFinal?.text ?? null;

  if (!text) {
    return null;
  }

  const isPartial = Boolean(currentPartial);

  return (
    <div style={overlayShellStyle} aria-live="polite" aria-atomic="true">
      <div
        style={{
          ...overlayBubbleStyle,
          opacity: isPartial ? 0.86 : 1,
          fontStyle: isPartial ? "italic" : "normal",
        }}
      >
        {text}
      </div>
    </div>
  );
}
