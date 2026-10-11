/** Name of the internal Control Center, shown in titles and headings. */
export const APP_NAME = "Centro de Control";

/**
 * Builds the browser tab title for a Control Center page.
 * Without a (non-blank) section it is just the app name; otherwise
 * "<section> · Centro de Control".
 */
export function buildDocumentTitle(section?: string): string {
  const trimmed = section?.trim();
  return trimmed ? `${trimmed} · ${APP_NAME}` : APP_NAME;
}
