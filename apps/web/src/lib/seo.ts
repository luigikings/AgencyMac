import {
  DEFAULT_LOCALE,
  LOCALES,
  localizePath,
  otherLocale,
  withTrailingSlash,
  type Locale,
} from "./i18n";
import { SITE_NAME } from "./site";

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

/** Open Graph locale: Spain for Spanish, United States for English. */
export function ogLocale(locale: Locale): string {
  return locale === "es" ? "es_ES" : "en_US";
}

export type SocialMetaTag = {
  /** `property` for Open Graph, `name` for Twitter cards. */
  attr: "property" | "name";
  key: string;
  content: string;
};

export type SocialImage = {
  /** Path of the image on the site (made absolute from `site`). */
  path: string;
  width: number;
  height: number;
  alt: string;
};

/**
 * Open Graph and Twitter card tags of a page. Every absolute URL comes from
 * `site` (never from the local host); texts arrive already translated.
 */
export function buildSocialMeta({
  site,
  locale,
  path,
  title,
  description,
  image,
}: {
  site: string | URL;
  locale: Locale;
  path: string;
  title: string;
  description: string;
  image: SocialImage;
}): SocialMetaTag[] {
  const imageUrl = new URL(image.path, site).href;
  const og = (key: string, content: string): SocialMetaTag => ({
    attr: "property",
    key,
    content,
  });
  const twitter = (key: string, content: string): SocialMetaTag => ({
    attr: "name",
    key,
    content,
  });
  return [
    og("og:type", "website"),
    og("og:site_name", SITE_NAME),
    og("og:title", title),
    og("og:description", description),
    og("og:url", canonicalUrl(site, path)),
    og("og:locale", ogLocale(locale)),
    og("og:locale:alternate", ogLocale(otherLocale(locale))),
    og("og:image", imageUrl),
    og("og:image:width", String(image.width)),
    og("og:image:height", String(image.height)),
    og("og:image:alt", image.alt),
    twitter("twitter:card", "summary_large_image"),
    twitter("twitter:title", title),
    twitter("twitter:description", description),
    twitter("twitter:image", imageUrl),
    twitter("twitter:image:alt", image.alt),
  ];
}
