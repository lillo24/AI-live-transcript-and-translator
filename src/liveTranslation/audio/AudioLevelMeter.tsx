type AudioLevelMeterProps = {
  level: number;
};

function clampLevel(level: number) {
  return Math.min(1, Math.max(0, level));
}

export function AudioLevelMeter({ level }: AudioLevelMeterProps) {
  const clampedLevel = clampLevel(level);
  const width = `${Math.round(clampedLevel * 100)}%`;

  return (
    <div className="audio-level-meter">
      <div className="audio-level-meter-header">
        <span>Input level</span>
        <strong>{Math.round(clampedLevel * 100)}%</strong>
      </div>
      <div
        className="audio-level-meter-track"
        aria-label={`Input level ${Math.round(clampedLevel * 100)} percent`}
      >
        <div className="audio-level-meter-fill" style={{ width }} />
      </div>
    </div>
  );
}
