import { translations, type TranslationKey } from "./translations";

export type { TranslationKey };

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

/** Ensures a leading and a trailing slash ("" → "/", "en" → "/en/"). */
export function withTrailingSlash(path: string): string {
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export function otherLocale(locale: Locale): Locale {
  return locale === "es" ? "en" : "es";
}

/**
 * Path of a page in the given locale. `path` is the Spanish (unprefixed)
 * path; English pages live under "/en/".
 */
export function localizePath(locale: Locale, path: string): string {
  const normalized = withTrailingSlash(path);
  return locale === DEFAULT_LOCALE ? normalized : `/${locale}${normalized}`;
}

/** Looks up a key; throws (failing the build) if it is missing or blank. */
export function translate(
  dictionaries: Partial<Record<string, Record<string, string>>>,
  locale: string,
  key: string,
): string {
  const dictionary = dictionaries[locale] ?? {};
  if (!Object.hasOwn(dictionary, key)) {
    throw new Error(`Missing translation "${key}" for locale "${locale}"`);
  }
  const value = dictionary[key];
  if (value.trim() === "") {
    throw new Error(`Empty translation "${key}" for locale "${locale}"`);
  }
  return value;
}

export function t(locale: Locale, key: TranslationKey): string {
  return translate(translations, locale, key);
}

export type NotFoundRelocation = {
  from: string;
  to: string;
  removeDir: string;
};

/**
 * Astro only emits the root 404 as "404.html"; "<locale>/404.astro" becomes
 * "<locale>/404/index.html". Hosting looks for "<locale>/404.html", so the
 * build moves it (paths relative to dist, POSIX separators).
 */
export function notFoundRelocations(
  locales: readonly string[],
): NotFoundRelocation[] {
  return locales
    .filter((locale) => locale !== DEFAULT_LOCALE)
    .map((locale) => ({
      from: `${locale}/404/index.html`,
      to: `${locale}/404.html`,
      removeDir: `${locale}/404`,
    }));
}
