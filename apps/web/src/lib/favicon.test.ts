import { describe, expect, it } from "vitest";
import { buildFaviconSvg } from "./favicon";
import { findHexColors } from "./hex-colors";

const FOREGROUND = "#FF6700";
const BACKGROUND = "#1D003F";

describe("buildFaviconSvg (RF-22)", () => {
  const svg = buildFaviconSvg(FOREGROUND, BACKGROUND);

  it("is a standalone SVG document with a square viewBox", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/viewBox="0 0 (\d+) \1"/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
    expect(svg.match(/<svg\b/g)).toHaveLength(1);
  });

  it("uses the received colours", () => {
    expect(svg).toContain(`fill="${BACKGROUND}"`);
    expect(svg).toContain(`fill="${FOREGROUND}"`);
  });

  it("contains no other colours", () => {
    expect(new Set(findHexColors(svg))).toEqual(
      new Set([FOREGROUND, BACKGROUND]),
    );
    expect(svg).not.toMatch(/rgb|hsl|currentColor/i);
  });

  it.each([
    ["not a hex", "red", BACKGROUND],
    ["markup injection", '#fff"/><script>', BACKGROUND],
    ["a bad background", FOREGROUND, "#12"],
  ])("rejects %s", (_label, foreground, background) => {
    expect(() => buildFaviconSvg(foreground, background)).toThrow(
      /hex colour/i,
    );
  });
});
