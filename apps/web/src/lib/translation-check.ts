export type TranslationProblem = {
  key: string;
  locale: string;
  problem: "missing" | "empty";
};

/**
 * Lists every key that is missing or blank in any locale. The set of keys
 * is the union of all dictionaries, so a key present in only one language
 * is reported for the others.
 */
export function findMissingTranslations(
  dictionaries: Partial<Record<string, Record<string, string>>>,
  locales: readonly string[],
): TranslationProblem[] {
  const keys = new Set<string>();
  for (const locale of locales) {
    for (const key of Object.keys(dictionaries[locale] ?? {})) keys.add(key);
  }

  const problems: TranslationProblem[] = [];
  for (const key of keys) {
    for (const locale of locales) {
      const dictionary = dictionaries[locale] ?? {};
      if (!Object.hasOwn(dictionary, key)) {
        problems.push({ key, locale, problem: "missing" });
      } else if (dictionary[key].trim() === "") {
        problems.push({ key, locale, problem: "empty" });
      }
    }
  }
  return problems;
}

/** Human-readable list ("[en] home.title: missing"), one problem per line. */
export function formatTranslationProblems(
  problems: readonly TranslationProblem[],
): string {
  return problems
    .map(({ key, locale, problem }) => `[${locale}] ${key}: ${problem}`)
    .join("\n");
}
