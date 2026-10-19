import { describe, expect, it } from "vitest";
import { JUMP_MAX_MS, JUMP_STREAK_WIDTH_PX } from "./fx-config";
import {
  jumpCoverage,
  jumpDurationMs,
  jumpEnvelope,
  streakCountFor,
  streakLines,
} from "./streaks";

const viewport = { width: 1280, height: 720 };
const length = (l: { x1: number; y1: number; x2: number; y2: number }) =>
  Math.hypot(l.x2 - l.x1, l.y2 - l.y1);

describe("streakLines (RF-31)", () => {
  it("returns the requested number of lines", () => {
    expect(
      streakLines(40, { x: 0, y: 2000 }, viewport, () => 0.5),
    ).toHaveLength(40);
  });

  it("returns nothing without speed or without count", () => {
    expect(streakLines(40, { x: 0, y: 0 }, viewport, () => 0.5)).toEqual([]);
    expect(streakLines(0, { x: 0, y: 2000 }, viewport, () => 0.5)).toEqual([]);
  });

  it("makes the length proportional to the speed (below the cap)", () => {
    const slow = streakLines(5, { x: 0, y: 1000 }, viewport, () => 0.5);
    const fast = streakLines(5, { x: 0, y: 3000 }, viewport, () => 0.5);
    for (let i = 0; i < 5; i++) {
      expect(length(fast[i]!) / length(slow[i]!)).toBeCloseTo(3, 5);
    }
  });

  it("stretches along the direction of movement", () => {
    const [down] = streakLines(1, { x: 0, y: 2000 }, viewport, () => 0.5);
    expect(down!.x2).toBeCloseTo(down!.x1, 5);
    expect(down!.y2).not.toBeCloseTo(down!.y1, 1);
    const [side] = streakLines(1, { x: 2000, y: 0 }, viewport, () => 0.5);
    expect(side!.y2).toBeCloseTo(side!.y1, 5);
  });

  it("starts every line inside the window", () => {
    const lines = streakLines(
      80,
      { x: 1000, y: 2000 },
      viewport,
      (() => {
        let i = 0;
        return () => ((i++ * 0.37) % 1) as number;
      })(),
    );
    for (const l of lines) {
      expect(l.x1).toBeGreaterThanOrEqual(0);
      expect(l.x1).toBeLessThan(viewport.width);
      expect(l.y1).toBeGreaterThanOrEqual(0);
      expect(l.y1).toBeLessThan(viewport.height);
    }
  });

  it("caps the length so a huge speed does not cross the screen", () => {
    const [line] = streakLines(1, { x: 0, y: 1e6 }, viewport, () => 1);
    expect(length(line!)).toBeLessThanOrEqual(viewport.height);
  });

  it("is deterministic for the same generator", () => {
    const a = streakLines(10, { x: 0, y: 2000 }, viewport, () => 0.3);
    const b = streakLines(10, { x: 0, y: 2000 }, viewport, () => 0.3);
    expect(a).toEqual(b);
  });
});

describe("streakCountFor (RF-31, RF-37)", () => {
  it("never exceeds 40 on mid and 80 on high", () => {
    expect(streakCountFor("mid", 1e6)).toBe(40);
    expect(streakCountFor("high", 1e6)).toBe(80);
  });

  it("is 0 on low, off and when there is no speed", () => {
    expect(streakCountFor("low", 1e6)).toBe(0);
    expect(streakCountFor("off", 1e6)).toBe(0);
    expect(streakCountFor("high", 0)).toBe(0);
  });

  it("grows with the speed", () => {
    expect(streakCountFor("high", 500)).toBeLessThan(
      streakCountFor("high", 3000),
    );
  });
});

describe("jumpDurationMs (RF-31)", () => {
  it("is at most 900 ms for any distance", () => {
    for (const d of [0, 100, 800, 5000, 100000]) {
      expect(jumpDurationMs(d)).toBeLessThanOrEqual(900);
    }
    expect(JUMP_MAX_MS).toBe(900);
  });

  it("grows with the distance and never goes below a visible minimum", () => {
    expect(jumpDurationMs(100)).toBeGreaterThanOrEqual(200);
    expect(jumpDurationMs(2000)).toBeGreaterThan(jumpDurationMs(100));
  });
});

// RNF-10: one soft rise and fall per jump (never a flash), and the streaks
// never cover more than 25 % of the window.
describe("jumpEnvelope (RF-31, RNF-10)", () => {
  it("starts and ends at 0 and peaks at 1 in the middle", () => {
    expect(jumpEnvelope(0, 600)).toBe(0);
    expect(jumpEnvelope(600, 600)).toBe(0);
    expect(jumpEnvelope(300, 600)).toBeCloseTo(1, 5);
  });

  it("rises and then falls once, with no jumps between frames", () => {
    const values = Array.from({ length: 61 }, (_, i) =>
      jumpEnvelope(i * 10, 600),
    );
    const peak = values.indexOf(Math.max(...values));
    for (let i = 1; i < values.length; i++) {
      const step = values[i]! - values[i - 1]!;
      if (i <= peak) expect(step).toBeGreaterThanOrEqual(0);
      else expect(step).toBeLessThanOrEqual(0);
      expect(Math.abs(step)).toBeLessThan(0.1);
    }
  });

  it("is 0 outside the jump and for a jump without duration", () => {
    expect(jumpEnvelope(-10, 600)).toBe(0);
    expect(jumpEnvelope(700, 600)).toBe(0);
    expect(jumpEnvelope(10, 0)).toBe(0);
  });
});

describe("jumpCoverage (RNF-10)", () => {
  it("never covers more than 25 % of the window, even on a small one", () => {
    for (const view of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ]) {
      expect(jumpCoverage("high", view)).toBeLessThanOrEqual(0.25);
      expect(jumpCoverage("mid", view)).toBeLessThan(
        jumpCoverage("high", view),
      );
    }
    expect(jumpCoverage("low", { width: 375, height: 667 })).toBe(0);
  });

  it("uses thin streaks", () => {
    expect(JUMP_STREAK_WIDTH_PX).toBeGreaterThan(0);
    expect(JUMP_STREAK_WIDTH_PX).toBeLessThanOrEqual(2);
  });
});
