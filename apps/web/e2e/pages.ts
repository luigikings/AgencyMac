import type { Locale } from "../src/lib/i18n";

// The pages of the public website served by the build under test.
// "home" pages are indexable (canonical + hreflang); "notFound" pages are the
// per-locale 404s (requested through a path that does not exist).
export type PageKind = "home" | "notFound";

export type SitePage = {
  /** Path requested in the browser. */
  path: string;
  locale: Locale;
  kind: PageKind;
  /** Expected canonical path (only for indexable pages). */
  canonicalPath?: string;
};

export const SITE_URL = "https://agencymac.com";

export const pages: readonly SitePage[] = [
  { path: "/", locale: "es", kind: "home", canonicalPath: "/" },
  { path: "/en/", locale: "en", kind: "home", canonicalPath: "/en/" },
  { path: "/no-existe/", locale: "es", kind: "notFound" },
  { path: "/en/no-existe/", locale: "en", kind: "notFound" },
];

export const homePages = pages.filter((page) => page.kind === "home");
