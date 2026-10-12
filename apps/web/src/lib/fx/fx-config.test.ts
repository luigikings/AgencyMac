import { describe, expect, it } from "vitest";
import {
  DEGRADE_LIMIT_MS,
  DEGRADE_WINDOW_FRAMES,
  FX_TIERS,
  JUMP_MAX_MS,
  PARTICLE_LIFE_MAX_MS,
  SHOOTING_STAR_MS,
  TIER_PARAMS,
  isFxTier,
} from "./fx-config";

describe("fx-config (spec 005)", () => {
  it("lists the device tiers from off to high", () => {
    expect(FX_TIERS).toEqual(["off", "low", "mid", "high"]);
  });

  it("recognises only those tiers", () => {
    expect(isFxTier("mid")).toBe(true);
    expect(isFxTier("ultra")).toBe(false);
    expect(isFxTier(undefined)).toBe(false);
  });

  it("has params for every tier", () => {
    expect(Object.keys(TIER_PARAMS).sort()).toEqual([...FX_TIERS].sort());
  });
});

// Table of plan section 5 (RF-37).
describe("TIER_PARAMS (plan section 5)", () => {
  it("has the particle limits 24, 80 and 160 (RF-37)", () => {
    expect(TIER_PARAMS.low.maxParticles).toBe(24);
    expect(TIER_PARAMS.mid.maxParticles).toBe(80);
    expect(TIER_PARAMS.high.maxParticles).toBe(160);
  });

  it("scrolls 0, 2 and 3 star layers and twinkles 1, 3 and 3", () => {
    expect(TIER_PARAMS.low.scrollParallaxLayers).toBe(0);
    expect(TIER_PARAMS.mid.scrollParallaxLayers).toBe(2);
    expect(TIER_PARAMS.high.scrollParallaxLayers).toBe(3);
    expect(TIER_PARAMS.low.twinkleLayers).toBe(1);
    expect(TIER_PARAMS.mid.twinkleLayers).toBe(3);
    expect(TIER_PARAMS.high.twinkleLayers).toBe(3);
  });

  it("caps the canvas density at 1, 1.25 and 1.5", () => {
    expect(TIER_PARAMS.low.canvasDensity).toBe(1);
    expect(TIER_PARAMS.mid.canvasDensity).toBe(1.25);
    expect(TIER_PARAMS.high.canvasDensity).toBe(1.5);
  });

  it("has shooting stars: none, 1 every 12-24 s, 2 every 8-16 s (RF-4)", () => {
    expect(TIER_PARAMS.low.shootingStarsMax).toBe(0);
    expect(TIER_PARAMS.low.shootingStarGapMs).toBeNull();
    expect(TIER_PARAMS.mid.shootingStarsMax).toBe(1);
    expect(TIER_PARAMS.mid.shootingStarGapMs).toEqual([12000, 24000]);
    expect(TIER_PARAMS.high.shootingStarsMax).toBe(2);
    expect(TIER_PARAMS.high.shootingStarGapMs).toEqual([8000, 16000]);
    expect(SHOOTING_STAR_MS).toEqual([600, 1200]);
  });

  it("emits the trail at 8, 20 and 36 per second (RF-23)", () => {
    expect(TIER_PARAMS.low.trailPerSecond).toBe(8);
    expect(TIER_PARAMS.mid.trailPerSecond).toBe(20);
    expect(TIER_PARAMS.high.trailPerSecond).toBe(36);
  });

  it("limits the sparks per planet to 0, 20 and 40 (RF-14)", () => {
    expect(TIER_PARAMS.low.sparksPerPlanet).toBe(0);
    expect(TIER_PARAMS.mid.sparksPerPlanet).toBe(20);
    expect(TIER_PARAMS.high.sparksPerPlanet).toBe(40);
  });

  it("limits the pointer effects, cursor trail and space jump", () => {
    expect(TIER_PARAMS.low.pointerEffects).toBe(false);
    expect(TIER_PARAMS.mid.pointerEffects).toBe(true);
    expect(TIER_PARAMS.high.pointerEffects).toBe(true);
    expect(TIER_PARAMS.low.cursorTrailMax).toBe(0);
    expect(TIER_PARAMS.mid.cursorTrailMax).toBe(0);
    expect(TIER_PARAMS.high.cursorTrailMax).toBe(14);
    expect(TIER_PARAMS.low.jumpStreaksMax).toBe(0);
    expect(TIER_PARAMS.mid.jumpStreaksMax).toBe(40);
    expect(TIER_PARAMS.high.jumpStreaksMax).toBe(80);
  });

  it("animates 1 moon per planet when low and 1/2/1 otherwise", () => {
    expect(TIER_PARAMS.low.moonsPerPlanet).toEqual([1, 1, 1]);
    expect(TIER_PARAMS.mid.moonsPerPlanet).toEqual([1, 2, 1]);
    expect(TIER_PARAMS.high.moonsPerPlanet).toEqual([1, 2, 1]);
  });

  it("does nothing when the tier is off", () => {
    const off = TIER_PARAMS.off;
    expect(off.maxParticles).toBe(0);
    expect(off.trailPerSecond).toBe(0);
    expect(off.shootingStarsMax).toBe(0);
    expect(off.sparksPerPlanet).toBe(0);
    expect(off.jumpStreaksMax).toBe(0);
    expect(off.pointerEffects).toBe(false);
  });

  it("never grows from a lower tier to a higher one in any limit", () => {
    const order = ["low", "mid", "high"] as const;
    const keys = [
      "maxParticles",
      "scrollParallaxLayers",
      "twinkleLayers",
      "canvasDensity",
      "shootingStarsMax",
      "trailPerSecond",
      "sparksPerPlanet",
      "cursorTrailMax",
      "jumpStreaksMax",
    ] as const;
    for (const key of keys) {
      for (let i = 1; i < order.length; i++) {
        expect(
          TIER_PARAMS[order[i]!][key],
          `${key}: ${order[i]} vs ${order[i - 1]}`,
        ).toBeGreaterThanOrEqual(TIER_PARAMS[order[i - 1]!][key]);
      }
    }
  });
});

describe("other constants", () => {
  it("degrades after 45 frames over 12 ms (RF-38)", () => {
    expect(DEGRADE_WINDOW_FRAMES).toBe(45);
    expect(DEGRADE_LIMIT_MS).toBe(12);
  });

  it("fades particles in under 0.6 s (RF-23) and jumps in at most 0.9 s (RF-31)", () => {
    expect(PARTICLE_LIFE_MAX_MS).toBeLessThan(600);
    expect(JUMP_MAX_MS).toBeLessThanOrEqual(900);
  });
});
