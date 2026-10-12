import { describe, expect, it } from "vitest";
import { contrastPercentile, requiredContrast } from "./pixel-contrast";

// Synthetic RGBA image: `n` pixels, the first `bright` of a bright colour and
// the rest of a dark one.
function image(
  n: number,
  bright: number,
  darkRgb: number[],
  brightRgb: number[],
) {
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const rgb = i < bright ? brightRgb : darkRgb;
    data.set([...rgb, 255], i * 4);
  }
  return data;
}

const WHITE = [255, 255, 255] as const;
const DARK = [52, 0, 111]; // the brand background
const LIGHT = [240, 240, 240];

describe("contrastPercentile (RF-8)", () => {
  it("passes white text on a dark background", () => {
    const data = image(400, 0, DARK, LIGHT);
    expect(contrastPercentile(data, WHITE, 2)).toBeGreaterThanOrEqual(4.5);
  });

  it("fails white text on a light background", () => {
    const data = image(400, 400, DARK, LIGHT);
    expect(contrastPercentile(data, WHITE, 2)).toBeLessThan(2);
  });

  it("ignores up to 2 % of bright pixels (the stars)", () => {
    // 100 pixels, 2 of them white: percentile 2 skips them.
    const data = image(100, 2, DARK, [255, 255, 255]);
    expect(contrastPercentile(data, WHITE, 2)).toBeGreaterThanOrEqual(4.5);
  });

  it("fails as soon as 3 % of the pixels are too bright", () => {
    const data = image(100, 3, DARK, [255, 255, 255]);
    expect(contrastPercentile(data, WHITE, 2)).toBeCloseTo(1, 5);
  });

  it("with percentile 0 takes the worst pixel", () => {
    const data = image(100, 1, DARK, [255, 255, 255]);
    expect(contrastPercentile(data, WHITE, 0)).toBeCloseTo(1, 5);
  });

  it("works with dark text on a light background", () => {
    const data = image(100, 0, DARK, LIGHT);
    const light = image(100, 100, DARK, LIGHT);
    expect(contrastPercentile(light, [0, 0, 0], 2)).toBeGreaterThan(10);
    expect(contrastPercentile(data, [0, 0, 0], 2)).toBeLessThan(2);
  });

  it("returns the known ratio of white on #34006F", () => {
    // L(#34006F) = 0.0192; (1 + 0.05) / (0.0192 + 0.05) = 15.2
    const data = image(10, 0, DARK, LIGHT);
    expect(contrastPercentile(data, WHITE, 2)).toBeCloseTo(15.2, 0);
  });

  it("returns 21 for an empty image (nothing to fail)", () => {
    expect(contrastPercentile(new Uint8ClampedArray(0), WHITE, 2)).toBe(21);
  });
});

describe("requiredContrast (WCAG large text)", () => {
  it("asks 3:1 from 24 px, or 18.66 px in bold", () => {
    expect(requiredContrast(24, 400)).toBe(3);
    expect(requiredContrast(18.66, 700)).toBe(3);
    expect(requiredContrast(19, 700)).toBe(3);
  });

  it("asks 4.5:1 from smaller text", () => {
    expect(requiredContrast(16, 400)).toBe(4.5);
    expect(requiredContrast(23.9, 400)).toBe(4.5);
    expect(requiredContrast(18, 700)).toBe(4.5);
    expect(requiredContrast(18.66, 400)).toBe(4.5);
  });
});
