import type {
  TranslationProviderAdapter,
  TranslationProviderStartOptions,
} from "../types";

type FakeSubtitleScript = {
  partials: string[];
  final: string;
};

const englishScript: FakeSubtitleScript[] = [
  {
    partials: [
      "This is...",
      "This is a fake...",
      "This is a fake translated...",
    ],
    final: "This is a fake translated subtitle.",
  },
  {
    partials: [
      "Later this...",
      "Later this will come...",
      "Later this will come from OpenAI...",
    ],
    final: "Later this will come from OpenAI realtime translation.",
  },
  {
    partials: [
      "Right now...",
      "Right now the provider...",
      "Right now the provider only simulates...",
    ],
    final: "Right now the provider only simulates realtime subtitle updates.",
  },
];

const italianScript: FakeSubtitleScript[] = [
  {
    partials: [
      "Questo e...",
      "Questo e un finto...",
      "Questo e un finto sottotitolo...",
    ],
    final: "Questo e un finto sottotitolo tradotto in tempo reale.",
  },
  {
    partials: [
      "Piu avanti...",
      "Piu avanti questo arrivera...",
      "Piu avanti questo arrivera da OpenAI...",
    ],
    final: "Piu avanti questo arrivera dalla traduzione realtime di OpenAI.",
  },
  {
    partials: [
      "Per ora...",
      "Per ora il provider...",
      "Per ora il provider simula...",
    ],
    final: "Per ora il provider simula solo aggiornamenti di sottotitoli realtime.",
  },
];

function scheduleTimeout(
  timeouts: Set<number>,
  callback: () => void,
  delay: number,
) {
  const timeoutId = window.setTimeout(() => {
    timeouts.delete(timeoutId);
    callback();
  }, delay);

  timeouts.add(timeoutId);
}

function runFakeStream(
  script: FakeSubtitleScript[],
  options: TranslationProviderStartOptions,
  timeouts: Set<number>,
  index: number,
  isCancelled: () => boolean,
) {
  if (isCancelled()) {
    return;
  }

  const nextLine = script[index % script.length];
  let elapsed = 0;

  for (const partial of nextLine.partials) {
    elapsed += 850;
    scheduleTimeout(timeouts, () => {
      if (isCancelled()) {
        return;
      }

      options.onPartial(partial);
    }, elapsed);
  }

  elapsed += 900;
  scheduleTimeout(timeouts, () => {
    if (isCancelled()) {
      return;
    }

    options.onFinal(nextLine.final);

    scheduleTimeout(timeouts, () => {
      runFakeStream(script, options, timeouts, index + 1, isCancelled);
    }, 1200);
  }, elapsed);
}

export const fakeTranslationProvider: TranslationProviderAdapter = {
  kind: "fake",
  start(options) {
    let cancelled = false;
    const timeouts = new Set<number>();
    const script =
      options.targetLanguage === "it" ? italianScript : englishScript;

    try {
      options.onListening();

      scheduleTimeout(timeouts, () => {
        runFakeStream(script, options, timeouts, 0, () => cancelled);
      }, 350);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start the fake subtitle provider.";
      options.onError(message);
    }

    return {
      stop() {
        cancelled = true;

        for (const timeoutId of timeouts) {
          window.clearTimeout(timeoutId);
        }

        timeouts.clear();
      },
    };
  },
};
