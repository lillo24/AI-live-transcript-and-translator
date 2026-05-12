export type TranslationLanguageCode =
  | "en"
  | "it"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ja"
  | "zh"
  | "ko"
  | "hi"
  | "id"
  | "vi"
  | "ru";

export type TranslationLanguageOption = {
  code: TranslationLanguageCode;
  label: string;
  nativeLabel?: string;
  helper?: string;
};

export const DEFAULT_TRANSLATION_LANGUAGE_CODE: TranslationLanguageCode = "it";

export const TRANSLATION_LANGUAGE_OPTIONS: TranslationLanguageOption[] = [
  { code: "it", label: "Italian", nativeLabel: "Italiano" },
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Espanol" },
  { code: "fr", label: "French", nativeLabel: "Francais" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "pt", label: "Portuguese", nativeLabel: "Portugues" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "zh", label: "Chinese", nativeLabel: "中文" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { code: "vi", label: "Vietnamese", nativeLabel: "Tieng Viet" },
  { code: "ru", label: "Russian", nativeLabel: "Русский" },
];

const TRANSLATION_LANGUAGE_CODE_SET = new Set<TranslationLanguageCode>(
  TRANSLATION_LANGUAGE_OPTIONS.map((option) => option.code),
);

const TRANSLATION_LANGUAGE_LABELS = new Map(
  TRANSLATION_LANGUAGE_OPTIONS.map((option) => [option.code, option.label]),
);

export function isTranslationLanguageCode(
  value: unknown,
): value is TranslationLanguageCode {
  return (
    typeof value === "string" &&
    TRANSLATION_LANGUAGE_CODE_SET.has(value as TranslationLanguageCode)
  );
}

export function getTranslationLanguageLabel(code: TranslationLanguageCode) {
  return TRANSLATION_LANGUAGE_LABELS.get(code) ?? code;
}
