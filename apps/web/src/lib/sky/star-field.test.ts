import { describe, expect, it } from "vitest";
import { colors } from "../../styles/tokens";
import { findHexColors } from "../hex-colors";
import {
  STAR_LAYERS,
  STAR_TONES,
  generateStarField,
  starsToBoxShadow,
} from "./star-field";

describe("STAR_LAYERS (RF-1)", () => {
  it("has the far, mid and near layers with the spec counts", () => {
    expect(STAR_LAYERS.map((l) => l.id)).toEqual(["far", "mid", "near"]);
    expect(STAR_LAYERS.map((l) => l.desktopCount)).toEqual([110, 60, 30]);
    expect(STAR_LAYERS.map((l) => l.mobileCount)).toEqual([40, 22, 10]);
  });

  it("moves the layers 4, 8 and 16 vh (RF-2) and twinkles at different speeds", () => {
    expect(STAR_LAYERS.map((l) => l.parallaxVh)).toEqual([4, 8, 16]);
    const durations = STAR_LAYERS.map((l) => l.twinkleS);
    expect(new Set(durations).size).toBe(3);
    expect(durations.every((s) => s >= 7 && s <= 15)).toBe(true);
  });

  it("gives each layer a different seed", () => {
    expect(new Set(STAR_LAYERS.map((l) => l.seed)).size).toBe(3);
  });

  it("gives each layer overscan of at least half its parallax range", () => {
    for (const l of STAR_LAYERS) {
      expect(l.heightVh).toBeGreaterThanOrEqual(100 + l.parallaxVh);
    }
  });
});

describe("generateStarField", () => {
  const opts = { heightVh: 116 };

  it("is deterministic: same seed, same stars", () => {
    expect(generateStarField(7, 110, opts)).toEqual(
      generateStarField(7, 110, opts),
    );
  });

  it("differs with another seed", () => {
    expect(generateStarField(7, 50, opts)).not.toEqual(
      generateStarField(8, 50, opts),
    );
  });

  it.each([110, 60, 30, 40, 22, 10])("makes exactly %i stars", (count) => {
    expect(generateStarField(3, count, opts)).toHaveLength(count);
  });

  it("keeps x in [0, 100) vw and y in [0, heightVh) vh", () => {
    for (const s of generateStarField(11, 200, opts)) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(100);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(116);
    }
  });

  it("uses only the known tones and positive sizes", () => {
    for (const s of generateStarField(5, 200, opts)) {
      expect(STAR_TONES).toContain(s.tone);
      expect(s.size).toBeGreaterThan(0);
    }
  });

  it("is sorted by y then x, so the output is stable", () => {
    const stars = generateStarField(5, 100, opts);
    for (let i = 1; i < stars.length; i++) {
      const a = stars[i - 1]!;
      const b = stars[i]!;
      expect(a.y < b.y || (a.y === b.y && a.x <= b.x)).toBe(true);
    }
  });

  it("returns an empty field for count 0", () => {
    expect(generateStarField(1, 0, opts)).toEqual([]);
  });
});

describe("STAR_TONES", () => {
  it("are colour token names", () => {
    for (const tone of STAR_TONES) expect(colors).toHaveProperty(tone);
  });
});

describe("starsToBoxShadow", () => {
  const stars = generateStarField(21, 60, { heightVh: 108 });
  const css = starsToBoxShadow(stars);

  it("gives the same text on two runs", () => {
    expect(starsToBoxShadow(generateStarField(21, 60, { heightVh: 108 }))).toBe(
      css,
    );
  });

  it("has no hex colour, only token variables", () => {
    expect(findHexColors(css)).toEqual([]);
    expect(css).toMatch(/var\(--color-[a-z0-9-]+\)/);
  });

  it("writes one shadow per star with two decimals in vw and vh", () => {
    const shadows = css.split(",");
    expect(shadows).toHaveLength(60);
    for (const s of shadows) {
      expect(s).toMatch(
        /^-?\d+(\.\d{1,2})?vw -?\d+(\.\d{1,2})?vh 0 \d+(\.\d+)?px var\(--color-[a-z0-9-]+\)$/,
      );
    }
  });

  it("is empty for no stars", () => {
    expect(starsToBoxShadow([])).toBe("");
  });
});
