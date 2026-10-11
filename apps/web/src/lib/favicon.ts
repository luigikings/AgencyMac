// Provisional favicon (RF-22): a planet-like disc on a rounded square. The
// colours always come from the brand tokens, so no hex is written here.
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function assertHexColor(color: string): void {
  if (!HEX_COLOR.test(color)) {
    throw new Error(`Favicon colours must be a hex colour, got "${color}"`);
  }
}

/** Minimal SVG favicon: a `foreground` disc on a `background` square. */
export function buildFaviconSvg(
  foreground: string,
  background: string,
): string {
  assertHexColor(foreground);
  assertHexColor(background);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    `<rect width="32" height="32" rx="7" fill="${background}"/>` +
    `<circle cx="16" cy="16" r="9" fill="${foreground}"/>` +
    "</svg>\n"
  );
}
