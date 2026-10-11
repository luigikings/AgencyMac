// A hex colour (#rgb, #rgba, #rrggbb, #rrggbbaa). The lookbehind skips HTML
// entities (`&#8217;`) and hashes glued to a word (`issue#123`); `\b` stops
// longer runs and anchors such as `#content` from matching.
const HEX_COLOR = /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;

/** Every hex colour written in `source`, in order of appearance. */
export function findHexColors(source: string): string[] {
  return source.match(HEX_COLOR) ?? [];
}
