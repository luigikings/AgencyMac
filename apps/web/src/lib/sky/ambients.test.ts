import { describe, expect, it } from "vitest";
import { contrastRatio } from "../contrast";
import { colors } from "../../styles/tokens";
import {
  AMBIENTS,
  SKY_MAX_LUMINANCE,
  blendOver,
  glowAlphaCap,
  resolveAmbient,
} from "./ambients";

describe("AMBIENTS (RF-5, plan section 6)", () => {
  it("has the 7 zones in page order", () => {
    expect(AMBIENTS.map((a) => a.id)).toEqual([
      "hero",
      "hexaweb",
      "rankia",
      "adara",
      "projects",
      "team",
      "contact",
    ]);
  });

  it("gives every zone a distinct ambient (base and glow pair)", () => {
    const keys = AMBIENTS.map((a) => `${a.base}|${a.glow}|${a.dust}`);
    expect(new Set(keys).size).toBe(7);
    const glows = AMBIENTS.map((a) => `${a.base}|${a.glow}`);
    expect(new Set(glows).size).toBe(7);
  });

  it("uses only existing colour tokens", () => {
    for (const a of AMBIENTS) {
      for (const name of [a.base, a.glow, a.dust, a.fadeTo]) {
        expect(colors, `${a.id}: ${name}`).toHaveProperty(name);
      }
    }
  });

  it("keeps the solid base colour of each planet block (RF-7)", () => {
    const byId = Object.fromEntries(AMBIENTS.map((a) => [a.id, a]));
    expect(byId.hexaweb!.base).toBe("planetHexawebBg");
    expect(byId.rankia!.base).toBe("planetRankiaBg");
    expect(byId.adara!.base).toBe("planetAdaraBg");
    expect(byId.hero!.base).toBe("bg");
    expect(byId.projects!.base).toBe("bg");
    expect(byId.team!.base).toBe("bgDark");
    expect(byId.contact!.base).toBe("bg");
  });

  it("fades each zone into the base colour of the next one", () => {
    AMBIENTS.slice(0, -1).forEach((a, i) => {
      expect(a.fadeTo, a.id).toBe(AMBIENTS[i + 1]!.base);
    });
    expect(AMBIENTS.at(-1)!.fadeTo).toBe("bgDark");
  });

  it("has alphas inside 0..1", () => {
    for (const a of AMBIENTS) {
      expect(a.glowAlpha).toBeGreaterThan(0);
      expect(a.glowAlpha).toBeLessThanOrEqual(1);
      expect(a.dustAlpha).toBeGreaterThan(0);
      expect(a.dustAlpha).toBeLessThanOrEqual(1);
    }
  });
});

describe("resolveAmbient", () => {
  const zones = [
    { id: "hero", top: 0, bottom: 800 },
    { id: "hexaweb", top: 800, bottom: 1600 },
    { id: "rankia", top: 1600, bottom: 2400 },
  ] as const;

  it("returns the ambient of the zone that holds the marker", () => {
    expect(resolveAmbient(0, zones).id).toBe("hero");
    expect(resolveAmbient(799, zones).id).toBe("hero");
    expect(resolveAmbient(800, zones).id).toBe("hexaweb");
    expect(resolveAmbient(2399, zones).id).toBe("rankia");
  });

  it("clamps to the first and last zone outside the page", () => {
    expect(resolveAmbient(-50, zones).id).toBe("hero");
    expect(resolveAmbient(9999, zones).id).toBe("rankia");
  });
});

describe("blendOver", () => {
  it("returns the base with alpha 0 and the glow with alpha 1", () => {
    expect(blendOver("#34006F", "#FF6700", 0)).toBe("#34006F");
    expect(blendOver("#34006F", "#FF6700", 1)).toBe("#FF6700");
  });

  it("mixes in linear light, not in sRGB", () => {
    // Half of white over black is 0.5 in linear light = 188 (0xBC) in sRGB.
    expect(blendOver("#000000", "#FFFFFF", 0.5)).toBe("#BCBCBC");
  });

  it("clamps the alpha", () => {
    expect(blendOver("#000000", "#FFFFFF", -1)).toBe("#000000");
    expect(blendOver("#000000", "#FFFFFF", 2)).toBe("#FFFFFF");
  });
});

describe("glowAlphaCap", () => {
  it("returns 1 when even the full glow keeps the contrast", () => {
    expect(glowAlphaCap("#000000", "#101010", "#FFFFFF", 4.5)).toBe(1);
  });

  it("returns 0 when the base already fails", () => {
    expect(glowAlphaCap("#FFFFFF", "#000000", "#FFFFFF", 4.5)).toBe(0);
  });

  it("finds the largest alpha that still reaches the ratio", () => {
    const cap = glowAlphaCap("#000000", "#FFFFFF", "#FFFFFF", 4.5);
    expect(cap).toBeGreaterThan(0);
    expect(cap).toBeLessThan(1);
    const at = (a: number) =>
      contrastRatio("#FFFFFF", blendOver("#000000", "#FFFFFF", a));
    expect(at(cap)).toBeGreaterThanOrEqual(4.45);
    expect(at(Math.min(1, cap + 0.02))).toBeLessThan(4.5);
  });
});

describe("SKY_MAX_LUMINANCE", () => {
  it("is 0.12, below what the yellow accent text allows (about 0.127)", () => {
    expect(SKY_MAX_LUMINANCE).toBe(0.12);
  });
});
