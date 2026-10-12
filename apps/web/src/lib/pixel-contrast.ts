// Contrast measured on the pixels really painted behind a text (spec 005,
// RF-8). Used only by the browser tests (e2e/pixel-contrast.ts). The first
// function is serialised into the page and runs there, so it must be
// self-contained: no imports, no helpers outside its body.

/**
 * Contrast of `text` against the pixels of an RGBA image, at the given
 * percentile of the worst ones: with percentile 2, 98 % of the pixels have at
 * least the returned ratio. An empty image returns 21 (nothing can fail).
 * Alpha is ignored: the image is a screenshot, always opaque.
 */
export function contrastPercentile(
  rgba: ArrayLike<number>,
  text: readonly [number, number, number],
  percentile: number,
): number {
  const total = Math.floor(rgba.length / 4);
  if (total === 0) return 21;
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (r: number, g: number, b: number) =>
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const textLum = luminance(text[0], text[1], text[2]);
  const ratios = new Float64Array(total);
  for (let i = 0; i < total; i++) {
    const bg = luminance(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!);
    const hi = Math.max(textLum, bg);
    const lo = Math.min(textLum, bg);
    ratios[i] = (hi + 0.05) / (lo + 0.05);
  }
  ratios.sort();
  const index = Math.min(total - 1, Math.floor((total * percentile) / 100));
  return ratios[index]!;
}

/** Contrast WCAG asks of a text: 3:1 if it is large (24 px, or 18.66 px bold), else 4.5:1. */
export function requiredContrast(
  fontSizePx: number,
  fontWeight: number,
): 3 | 4.5 {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  return large ? 3 : 4.5;
}
