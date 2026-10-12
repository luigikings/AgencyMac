// Social metadata and structured data of a home page, shared by the Spanish
// and the English page so the two cannot drift apart (spec 004, RF-27, RF-28).

import { localizePath, t, type Locale } from "./i18n";
import { buildSocialMeta, type SocialMetaTag } from "./seo";
import { SITE_NAME, buildPageTitle } from "./site";
import { buildOrganizationJsonLd, serializeJsonLd } from "./structured-data";

/** Social image (src/public/og-default.png) and its size. */
export const OG_IMAGE = {
  path: "/og-default.png",
  width: 1200,
  height: 630,
} as const;

/** Logo for the structured data (public/logo-512.png). */
export const LOGO_PATH = "/logo-512.png";

/** Social networks of the agency: none yet, so `sameAs` is left out. */
export const SOCIAL_PROFILES: readonly string[] = [];

export function buildHomeSeo(
  site: string | URL,
  locale: Locale,
): { social: SocialMetaTag[]; jsonLd: string } {
  const description = t(locale, "home.description");
  return {
    social: buildSocialMeta({
      site,
      locale,
      path: localizePath(locale, "/"),
      title: buildPageTitle(SITE_NAME, t(locale, "home.title")),
      description,
      image: { ...OG_IMAGE, alt: t(locale, "og.imageAlt") },
    }),
    jsonLd: serializeJsonLd(
      buildOrganizationJsonLd({
        site,
        name: SITE_NAME,
        description,
        logoPath: LOGO_PATH,
        sameAs: SOCIAL_PROFILES,
      }),
    ),
  };
}
