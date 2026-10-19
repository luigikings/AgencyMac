import { describe, expect, it } from "vitest";
import {
  BUBBLE_BG,
  BURST_CLICK,
  BURST_RADIUS_RATIO,
  BURST_SPEED_PX_MS,
  BURST_TONES,
  BURST_TURBO,
  BUBBLE_FG,
  BUBBLE_GAP_PX,
  BUBBLE_MARGIN_PX,
  BUBBLE_MS,
  BUBBLE_POP_MS,
  BUBBLE_TAIL_REACH_PX,
  BUBBLE_TEXT_GAP_PX,
  BUBBLE_WIDTHS_PX,
  CURSOR_TRAIL_SPACING_PX,
  DEGRADE_LIMIT_MS,
  DEGRADE_WINDOW_FRAMES,
  FX_TIERS,
  GREET_MS,
  GREET_SWAY_DEG,
  JOURNEY_MOBILE_PX,
  JOURNEY_ROCKET_PX,
  JOURNEY_STOP_MARK,
  JOURNEY_WIDE_QUERY,
  JUMP_MAX_MS,
  LOOK_TAU_MS,
  MAC_BOUNCE_MS,
  MAC_BOUNCE_PEAK,
  MAC_BOUNCE_SCALE,
  PARTICLE_LIFE_MAX_MS,
  PARTICLE_LIFE_MS,
  PLANET_GROW_TAU_MS,
  PLANET_HOVER_SCALE,
  PLANET_POINTER_DEPTH,
  SHOOTING_STAR_MS,
  SPARK_FILL_MS,
  SPARK_RIM_RATIO,
  SPARK_SPEED_PX_MS,
  SPARK_TONES,
  TIER_PARAMS,
  TRAIL_JITTER_PX,
  TRAIL_REAR_RATIO,
  TRAIL_SPEED_PX_MS,
  TRAIL_SPREAD_DEG,
  TRAIL_TONES,
  TURBO_COOLDOWN_MS,
  TURBO_LIFT_RATIO,
  TURBO_MARGIN_PX,
  TURBO_MIN_SCALE,
  TURBO_MS,
  TURBO_SPIN_DEG,
  TURBO_SPIN_DELAY,
  isFxTier,
} from "./fx-config";
import { colors } from "../../styles/tokens";
import { contrastRatio } from "../contrast";

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

describe("planet growth and sparks (RF-14)", () => {
  it("grows a planet under the cursor by 5 % at most", () => {
    expect(PLANET_HOVER_SCALE).toBeGreaterThan(1);
    expect(PLANET_HOVER_SCALE).toBeLessThanOrEqual(1.05);
  });

  it("grows and shrinks back in well under a second", () => {
    expect(PLANET_GROW_TAU_MS).toBeGreaterThan(0);
    // Within 1 % of the way after 5 time constants.
    expect(5 * PLANET_GROW_TAU_MS).toBeLessThan(1000);
  });

  it("paints the sparks only with brand colour tokens", () => {
    expect(SPARK_TONES.length).toBeGreaterThan(1);
    for (const tone of SPARK_TONES) {
      expect(Object.keys(colors)).toContain(tone);
    }
    expect(new Set(SPARK_TONES).size).toBe(SPARK_TONES.length);
  });

  it("launches the sparks outwards at a sane speed, from the rim", () => {
    const [slow, fast] = SPARK_SPEED_PX_MS;
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(slow);
    expect(SPARK_RIM_RATIO).toBeGreaterThan(0);
    expect(SPARK_RIM_RATIO).toBeLessThanOrEqual(0.5);
    expect(SPARK_FILL_MS).toBeGreaterThan(0);
  });
});

describe("planet parallax depths (RF-13)", () => {
  it("has a depth in (0, 1] for each planet, all different", () => {
    const depths = Object.values(PLANET_POINTER_DEPTH);
    expect(Object.keys(PLANET_POINTER_DEPTH).sort()).toEqual([
      "adara",
      "hexaweb",
      "rankia",
    ]);
    for (const depth of depths) {
      expect(depth).toBeGreaterThan(0);
      expect(depth).toBeLessThanOrEqual(1);
    }
    expect(new Set(depths).size).toBe(3);
  });
});

describe("Mac's trail, bounce and bubbles (RF-23, RF-24, RF-27)", () => {
  it("fades every trail particle in under 0.6 s, with room for a frame", () => {
    const [min, max] = PARTICLE_LIFE_MS.trail;
    expect(min).toBeGreaterThan(0);
    expect(max).toBeGreaterThan(min);
    expect(max).toBeLessThanOrEqual(PARTICLE_LIFE_MAX_MS);
    expect(max + 50).toBeLessThan(600);
  });

  it("paints the trail only with brand colour tokens", () => {
    expect(TRAIL_TONES.length).toBeGreaterThan(1);
    for (const tone of TRAIL_TONES) {
      expect(Object.keys(colors)).toContain(tone);
    }
    expect(new Set(TRAIL_TONES).size).toBe(TRAIL_TONES.length);
  });

  it("emits the trail from Mac's back, slowly and close to him", () => {
    expect(TRAIL_REAR_RATIO).toBeGreaterThan(0);
    expect(TRAIL_REAR_RATIO).toBeLessThanOrEqual(0.5);
    expect(TRAIL_JITTER_PX).toBeGreaterThanOrEqual(0);
    expect(TRAIL_SPEED_PX_MS[0]).toBeGreaterThanOrEqual(0);
    expect(TRAIL_SPEED_PX_MS[1]).toBeGreaterThan(TRAIL_SPEED_PX_MS[0]);
    expect(TRAIL_SPREAD_DEG).toBeGreaterThan(0);
    expect(TRAIL_SPREAD_DEG).toBeLessThan(90);
  });

  it("bounces on arrival up to a scale of 1.12 and back in 0.4 s", () => {
    expect(MAC_BOUNCE_SCALE).toBe(1.12);
    expect(MAC_BOUNCE_MS).toBe(400);
    expect(MAC_BOUNCE_PEAK).toBeGreaterThan(0);
    expect(MAC_BOUNCE_PEAK).toBeLessThan(1);
  });

  it("greets with a sway of 0.8 s and eases the gaze back well inside 1 s", () => {
    expect(GREET_MS).toBe(800);
    expect(GREET_SWAY_DEG).toBeGreaterThan(0);
    expect(GREET_SWAY_DEG).toBeLessThanOrEqual(12);
    // From 8 px to under 0.5 px (a sixteenth) in at most 0.7 s.
    expect(LOOK_TAU_MS * Math.log(16)).toBeLessThanOrEqual(700);
  });

  it("shows a bubble for 2.0 to 2.8 s, away from Mac and the edges", () => {
    expect(BUBBLE_MS).toEqual([2000, 2800]);
    expect(BUBBLE_GAP_PX).toBeGreaterThan(0);
    expect(BUBBLE_MARGIN_PX).toBeGreaterThanOrEqual(8);
  });

  // T23: a bubble never covers a text; it may slide along Mac's side, as far
  // as its tail still points at him, or wrap into narrower lines.
  it("keeps clear of texts, slides with its tail on Mac and wraps narrower", () => {
    expect(BUBBLE_TEXT_GAP_PX).toBeGreaterThan(0);
    expect(BUBBLE_TEXT_GAP_PX).toBeLessThanOrEqual(BUBBLE_GAP_PX);
    // The tail (12 px, turned) sits at least 12 px inside the corner.
    expect(BUBBLE_TAIL_REACH_PX).toBeGreaterThanOrEqual(18);
    expect(BUBBLE_TAIL_REACH_PX).toBeLessThanOrEqual(40);
    // Narrower and narrower, never below what the longest word needs.
    expect(BUBBLE_WIDTHS_PX.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < BUBBLE_WIDTHS_PX.length; i++) {
      expect(BUBBLE_WIDTHS_PX[i]).toBeLessThan(BUBBLE_WIDTHS_PX[i - 1]!);
    }
    expect(Math.min(...BUBBLE_WIDTHS_PX)).toBeGreaterThanOrEqual(160);
  });
});

describe("Mac's bubble colours (RF-27: solid, readable)", () => {
  it("is a solid brand token with AA contrast for its text", () => {
    expect(Object.keys(colors)).toContain(BUBBLE_BG);
    expect(Object.keys(colors)).toContain(BUBBLE_FG);
    expect(
      contrastRatio(colors[BUBBLE_FG].value, colors[BUBBLE_BG].value),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("pops in quickly, well inside its shortest life", () => {
    expect(BUBBLE_POP_MS).toBeGreaterThan(0);
    expect(BUBBLE_POP_MS).toBeLessThanOrEqual(250);
  });
});

describe("Mac's bursts and turbo mode (RF-28, RF-29)", () => {
  it("bursts 12 to 20 particles on a press and at least 60 in turbo mode", () => {
    expect(BURST_CLICK).toEqual([12, 20]);
    expect(BURST_TURBO).toBeGreaterThanOrEqual(60);
    // Within the largest class limit (RF-37).
    expect(BURST_TURBO).toBeLessThanOrEqual(TIER_PARAMS.high.maxParticles);
  });

  it("throws the burst out of Mac, fast but short-lived", () => {
    const [min, max] = PARTICLE_LIFE_MS.burst;
    expect(min).toBeGreaterThan(0);
    expect(max).toBeGreaterThan(min);
    expect(max).toBeLessThanOrEqual(1000);
    expect(BURST_SPEED_PX_MS[0]).toBeGreaterThan(0);
    expect(BURST_SPEED_PX_MS[1]).toBeGreaterThan(BURST_SPEED_PX_MS[0]);
    expect(BURST_RADIUS_RATIO).toBeGreaterThan(0);
    expect(BURST_RADIUS_RATIO).toBeLessThanOrEqual(0.5);
  });

  it("paints the bursts only with brand colour tokens", () => {
    expect(BURST_TONES.length).toBeGreaterThan(1);
    for (const tone of BURST_TONES) {
      expect(Object.keys(colors)).toContain(tone);
    }
    expect(new Set(BURST_TONES).size).toBe(BURST_TONES.length);
  });

  it("crosses the screen in at most 1.4 s, inside the window, with a spin", () => {
    expect(TURBO_MS).toBeGreaterThan(0);
    // A frame of room for the mark to go.
    expect(TURBO_MS + 50).toBeLessThanOrEqual(1400);
    expect(TURBO_MARGIN_PX).toBeGreaterThanOrEqual(8);
    expect(TURBO_LIFT_RATIO).toBeGreaterThan(0);
    expect(TURBO_LIFT_RATIO).toBeLessThanOrEqual(0.5);
    expect(Math.abs(TURBO_SPIN_DEG)).toBeGreaterThan(0);
    expect(TURBO_MIN_SCALE).toBeGreaterThan(0.3);
    expect(TURBO_MIN_SCALE).toBeLessThanOrEqual(1);
    expect(TURBO_SPIN_DELAY).toBeGreaterThanOrEqual(0);
    expect(TURBO_SPIN_DELAY).toBeLessThan(0.5);
    expect(TURBO_COOLDOWN_MS).toBe(10_000);
  });
});

describe("journey indicator (RF-30)", () => {
  it("is at most 6 px thick on phones, rocket included", () => {
    expect(JOURNEY_MOBILE_PX).toBeGreaterThan(0);
    expect(JOURNEY_MOBILE_PX).toBeLessThanOrEqual(6);
    expect(JOURNEY_ROCKET_PX.narrow).toBeLessThanOrEqual(JOURNEY_MOBILE_PX);
    expect(JOURNEY_ROCKET_PX.wide).toBeGreaterThan(JOURNEY_ROCKET_PX.narrow);
  });

  it("turns vertical from 64 rem", () => {
    expect(JOURNEY_WIDE_QUERY).toBe("(min-width: 64rem)");
  });

  it("reaches a stop when its section crosses the middle of the window", () => {
    expect(JOURNEY_STOP_MARK).toBe(0.5);
  });
});

describe("cursor trail constants (RF-32)", () => {
  it("leaves a particle every few px", () => {
    expect(CURSOR_TRAIL_SPACING_PX).toBeGreaterThanOrEqual(4);
    expect(CURSOR_TRAIL_SPACING_PX).toBeLessThanOrEqual(40);
  });
});
