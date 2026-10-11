import {
  DEFAULT_LOCALE,
  LOCALES,
  localizePath,
  withTrailingSlash,
} from "./i18n";

export { withTrailingSlash };

export type AlternateLink = {
  hreflang: "es" | "en" | "x-default";
  href: string;
};

/**
 * Absolute canonical URL: the site (Astro `site`, never the local host)
 * plus the path with a trailing slash. Throws if `site` is not absolute.
 */
export function canonicalUrl(site: string | URL, path: string): string {
  return new URL(withTrailingSlash(path), site).href;
}

/** Spanish (unprefixed) path of a page, given its path in any locale. */
function basePath(path: string): string {
  const normalized = withTrailingSlash(path);
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const prefix = `/${locale}/`;
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length - 1);
    }
  }
  return normalized;
}

/** hreflang links for es, en and x-default (which points to Spanish). */
export function alternateLinks(
  site: string | URL,
  path: string,
): AlternateLink[] {
  const base = basePath(path);
  const es = canonicalUrl(site, localizePath("es", base));
  return [
    { hreflang: "es", href: es },
    { hreflang: "en", href: canonicalUrl(site, localizePath("en", base)) },
    { hreflang: "x-default", href: es },
  ];
}
