// WCAG 2.1 colour contrast (RF-18). Pure functions on 6-digit hex colours.

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (0 to 1) of a `#RRGGBB` colour. */
export function relativeLuminance(hex: string): number {
  const match = HEX.exec(hex);
  if (!match) throw new Error(`Expected a #RRGGBB hex colour, got "${hex}"`);
  const [r, g, b] = [match[1]!, match[2]!, match[3]!].map((part) =>
    channel(parseInt(part, 16)),
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Contrast ratio (1 to 21) between two `#RRGGBB` colours, in either order. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
