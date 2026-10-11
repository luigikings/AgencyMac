/** Brand name of the agency, identical in Spanish and English. */
export const SITE_NAME = "AgencyMac";

/**
 * Builds the document title for a public page.
 * Without a (non-blank) page title it is just the site name; otherwise
 * "<page title> · <site name>".
 */
export function buildPageTitle(siteName: string, pageTitle?: string): string {
  const trimmed = pageTitle?.trim();
  return trimmed ? `${trimmed} · ${siteName}` : siteName;
}
