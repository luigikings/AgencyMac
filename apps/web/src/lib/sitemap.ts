// Sitemap and robots.txt of the public website (spec 004, RF-29, RF-30). Pure
// functions. No `lastmod` (it would need the current date) and no 404 pages.

import { localizePath, type Locale } from "./i18n";
import { alternateLinks, canonicalUrl } from "./seo";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sitemap with one `<url>` per page and language, each one with the
 * alternatives es, en and x-default. `paths` are Spanish (unprefixed) paths.
 */
export function buildSitemapXml(
  site: string | URL,
  locales: readonly Locale[],
  paths: readonly string[],
): string {
  const urls = paths.flatMap((path) =>
    locales.map((locale) => {
      const localized = localizePath(locale, path);
      const links = alternateLinks(site, localized)
        .map(
          ({ hreflang, href }) =>
            `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`,
        )
        .join("\n");
      return `  <url>\n    <loc>${escapeXml(canonicalUrl(site, localized))}</loc>\n${links}\n  </url>`;
    }),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** robots.txt: crawling allowed everywhere, and the sitemap. */
export function buildRobotsTxt(site: string | URL): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", site).href}\n`;
}
