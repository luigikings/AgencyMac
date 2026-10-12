import { describe, expect, it } from "vitest";
import { ISOLOGO_SHAPES, buildIsologoFaviconSvg } from "./favicon-isologo";
import { findHexColors } from "./hex-colors";

// The favicon is a hand-simplified isologo (a rocket): three flat shapes in
// the brand colours on the dark background (spec 004, RF-20, decision D8).
const PALETTE = {
  background: "#1D003F",
  body: "#FF9D00",
  shade: "#FF6700",
  flame: "#FFE000",
};

describe("buildIsologoFaviconSvg (RF-20)", () => {
  const svg = buildIsologoFaviconSvg(PALETTE);

  it("is a standalone SVG document with a square viewBox", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/viewBox="0 0 (\d+) \1"/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
    expect(svg.match(/<svg\b/g)).toHaveLength(1);
  });

  it("draws the background and exactly three shapes", () => {
    expect(svg.match(/<rect\b/g)).toHaveLength(1);
    expect(svg.match(/<path\b/g)).toHaveLength(3);
    expect(svg).toContain(
      `<rect width="32" height="32" rx="7" fill="#1D003F"/>`,
    );
  });

  it("uses only the received colours, one per shape", () => {
    expect(new Set(findHexColors(svg))).toEqual(
      new Set(Object.values(PALETTE)),
    );
    for (const color of [PALETTE.body, PALETTE.shade, PALETTE.flame]) {
      expect(svg.split(`fill="${color}"`).length - 1).toBe(1);
    }
    expect(svg).not.toMatch(/rgb|hsl|currentColor|url\(/i);
  });

  it("keeps every coordinate inside the 32 x 32 box", () => {
    const numbers = [...svg.matchAll(/d="([^"]+)"/g)].flatMap((m) =>
      m[1]!.match(/-?\d+(?:\.\d+)?/g)!.map(Number),
    );
    expect(numbers.length).toBeGreaterThan(20);
    for (const value of numbers) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(32);
    }
  });

  it("opens the window of the rocket (even-odd fill)", () => {
    expect(svg).toContain('fill-rule="evenodd"');
  });

  it("is deterministic", () => {
    expect(buildIsologoFaviconSvg(PALETTE)).toBe(svg);
  });
});

describe("ISOLOGO_SHAPES", () => {
  it("has three shapes, none with more than 12 points", () => {
    expect(ISOLOGO_SHAPES).toHaveLength(3);
    for (const shape of ISOLOGO_SHAPES) {
      const points = shape.contours.reduce(
        (total, contour) => total + contour.length,
        0,
      );
      expect(points, shape.role).toBeLessThanOrEqual(12);
      for (const contour of shape.contours) {
        expect(contour.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("colour validation", () => {
  it.each([
    ["not a hex", { ...PALETTE, body: "orange" }],
    ["markup injection", { ...PALETTE, flame: '#fff"/><script>' }],
    ["a bad background", { ...PALETTE, background: "#12" }],
    ["a bad shade", { ...PALETTE, shade: "" }],
  ])("rejects %s", (_label, palette) => {
    expect(() => buildIsologoFaviconSvg(palette)).toThrow(/hex colour/i);
  });
});
