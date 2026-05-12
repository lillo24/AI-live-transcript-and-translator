import {
  TRANSLATION_LANGUAGE_OPTIONS,
  type TranslationLanguageCode,
} from "./languages";

export type LanguageSelectorProps = {
  value: TranslationLanguageCode;
  onChange: (language: TranslationLanguageCode) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  compact?: boolean;
  id?: string;
};

function formatLanguageOptionLabel(
  label: string,
  nativeLabel: string | undefined,
) {
  if (!nativeLabel || nativeLabel === label) {
    return label;
  }

  return `${label} / ${nativeLabel}`;
}

export function LanguageSelector({
  value,
  onChange,
  label = "Translate into",
  helperText = "Source language is detected automatically.",
  disabled = false,
  compact = false,
  id,
}: LanguageSelectorProps) {
  return (
    <label
      className={`field language-selector${compact ? " language-selector-compact" : ""}`}
    >
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.target.value as TranslationLanguageCode)
        }
        disabled={disabled}
      >
        {TRANSLATION_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {formatLanguageOptionLabel(option.label, option.nativeLabel)}
          </option>
        ))}
      </select>
      <small className="selector-helper-text">{helperText}</small>
    </label>
  );
}
