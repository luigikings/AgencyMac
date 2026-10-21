import { describe, expect, it } from "vitest";
import {
  findHidingRules,
  findUnguardedKeyframes,
  findUnguardedMotion,
} from "../../styles/motion-css";
import { FX_TIERS, TIER_PARAMS } from "../fx/fx-config";
import { SERVICES } from "../site-data";
import { STAR_LAYERS } from "./star-field";
import { stillMoons, stillStarLayers, tierLimitsCss } from "./tier-css";

// Spec 005, RF-12, RF-37 (validation, round 1): the HTML and the CSS keep 1, 2
// and 1 moons and 3 twinkling layers (the class is only known with
// JavaScript); with `data-fx-tier` on <html> the class's limits of
// TIER_PARAMS apply: the moons and layers beyond them stand still.
describe("stillMoons", () => {
  it("leaves still the moons beyond the class's number on each planet", () => {
    for (const tier of FX_TIERS) {
      const still = stillMoons(tier);
      SERVICES.forEach((service, i) => {
        const allowed = TIER_PARAMS[tier].moonsPerPlanet[i]!;
        const expected =
          tier === "off" ? 0 : Math.max(0, service.moons - allowed);
        expect(still[service.id] ?? 0, `${tier} ${service.id}`).toBe(expected);
      });
    }
  });

  it("in the low class only the second moon of Rankia stands still", () => {
    expect(stillMoons("low")).toEqual({ rankia: 1 });
    expect(stillMoons("mid")).toEqual({});
    expect(stillMoons("high")).toEqual({});
  });
});

describe("stillStarLayers", () => {
  it("keeps twinkling the first layers of the class and stills the rest", () => {
    for (const tier of ["low", "mid", "high"] as const) {
      expect(stillStarLayers(tier)).toEqual(
        STAR_LAYERS.slice(TIER_PARAMS[tier].twinkleLayers).map((l) => l.id),
      );
    }
    expect(stillStarLayers("low")).toHaveLength(STAR_LAYERS.length - 1);
  });
});

describe("tierLimitsCss", () => {
  const css = tierLimitsCss();

  it("stills the second moon of Rankia and two star layers in the low class", () => {
    expect(css).toContain(
      'html[data-fx-tier="low"] .service[data-planet="rankia"] .service__moon:nth-of-type(n+2){animation:none;offset-path:none}',
    );
    for (const id of stillStarLayers("low")) {
      expect(css).toContain(
        `html[data-fx-tier="low"] [data-star-layer="${id}"]{animation:none}`,
      );
    }
  });

  it("has no rule for the middle and high classes (their limits are the page's)", () => {
    expect(css).not.toContain('data-fx-tier="mid"');
    expect(css).not.toContain('data-fx-tier="high"');
  });

  it("only touches motion, under no-preference, and hides nothing", () => {
    expect(
      css.startsWith("@media (prefers-reduced-motion:no-preference){"),
    ).toBe(true);
    expect(findUnguardedMotion(css)).toEqual([]);
    expect(findUnguardedKeyframes(css)).toEqual([]);
    expect(findHidingRules(css)).toEqual([]);
  });
});
