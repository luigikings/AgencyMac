import { describe, expect, it } from "vitest";
import { LOCALES } from "./i18n";
import {
  findMissingTranslations,
  formatTranslationProblems,
} from "./translation-check";
import { translations } from "./translations";

const REQUIRED_KEYS = [
  "home.title",
  "home.description",
  "home.heading",
  "home.intro",
  "home.sectionHeading",
  "home.sectionBody",
  "notFound.title",
  "notFound.description",
  "notFound.heading",
  "notFound.message",
  "notFound.backHome",
  "nav.label",
  "nav.home",
  "nav.switchLanguage",
  "a11y.skipToContent",
  "footer.text",
];

describe("translations", () => {
  it("has every key with a non-empty value in ES and EN", () => {
    const problems = findMissingTranslations(translations, LOCALES);
    expect(problems, formatTranslationProblems(problems)).toEqual([]);
  });

  it("contains every key the plan requires", () => {
    for (const locale of LOCALES) {
      const keys = Object.keys(translations[locale]);
      const missing = REQUIRED_KEYS.filter((key) => !keys.includes(key));
      expect(missing, `[${locale}] missing keys`).toEqual([]);
    }
  });

  it("uses different titles and descriptions per page and per language", () => {
    const values = LOCALES.flatMap((locale) => [
      translations[locale]["home.title"],
      translations[locale]["notFound.title"],
    ]);
    expect(new Set(values).size).toBe(values.length);
    const descriptions = LOCALES.flatMap((locale) => [
      translations[locale]["home.description"],
      translations[locale]["notFound.description"],
    ]);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});
