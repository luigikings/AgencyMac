import { describe, expect, it } from "vitest";
import {
  easeToRest,
  limitLength,
  pointerParallax,
  scrollParallax,
} from "./parallax";

describe("scrollParallax (RF-2)", () => {
  it("is centred: -range/2 at the top, 0 in the middle, +range/2 at the end", () => {
    expect(scrollParallax(0, 4)).toBe(-2);
    expect(scrollParallax(0.5, 4)).toBe(0);
    expect(scrollParallax(1, 4)).toBe(2);
  });

  it("travels the whole range (4, 8 and 16 vh) over the full page", () => {
    for (const range of [4, 8, 16]) {
      expect(scrollParallax(1, range) - scrollParallax(0, range)).toBe(range);
    }
  });

  it("clamps progress outside 0..1", () => {
    expect(scrollParallax(-1, 8)).toBe(scrollParallax(0, 8));
    expect(scrollParallax(3, 8)).toBe(scrollParallax(1, 8));
  });

  it("treats a non-finite progress as 0", () => {
    expect(scrollParallax(Number.NaN, 8)).toBe(scrollParallax(0, 8));
  });
});

describe("pointerParallax (RF-13)", () => {
  const rect = { left: 100, top: 100, width: 200, height: 100 };

  it("is 0 with the cursor at the centre", () => {
    const p = pointerParallax({ x: 200, y: 150 }, rect, 1, 14);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it("moves opposite to the cursor, up to maxPx at the edge", () => {
    const right = pointerParallax({ x: 300, y: 150 }, rect, 1, 14);
    expect(right.x).toBe(-14);
    expect(right.y).toBeCloseTo(0, 10);
    const bottomLeft = pointerParallax({ x: 100, y: 200 }, rect, 1, 14);
    expect(bottomLeft).toEqual({ x: 14, y: -14 });
  });

  it("never exceeds maxPx, even far outside the box", () => {
    const p = pointerParallax({ x: 5000, y: -5000 }, rect, 1, 14);
    expect(Math.abs(p.x)).toBeLessThanOrEqual(14);
    expect(Math.abs(p.y)).toBeLessThanOrEqual(14);
  });

  it("scales with the depth: nearer layers move more", () => {
    const far = pointerParallax({ x: 300, y: 150 }, rect, 0.4, 14);
    const near = pointerParallax({ x: 300, y: 150 }, rect, 1, 14);
    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(far.x));
    expect(far.x).toBeCloseTo(-5.6, 10);
  });

  it("does not divide by zero in an empty box", () => {
    const p = pointerParallax(
      { x: 10, y: 10 },
      { left: 10, top: 10, width: 0, height: 0 },
      1,
      14,
    );
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });
});

describe("easeToRest (return in under 1 s, RF-13)", () => {
  it("keeps the value when no time passed", () => {
    expect(easeToRest({ x: 10, y: -6 }, 0)).toEqual({ x: 10, y: -6 });
  });

  it("shrinks monotonically and never flips sign", () => {
    let p = { x: 14, y: -14 };
    for (let i = 0; i < 60; i++) {
      const next = easeToRest(p, 16);
      expect(Math.abs(next.x)).toBeLessThan(Math.abs(p.x));
      expect(next.x).toBeGreaterThan(0);
      expect(next.y).toBeLessThan(0);
      p = next;
    }
  });

  it("is back within half a pixel after 1 s from the 14 px maximum", () => {
    let p = { x: 14, y: -14 };
    for (let t = 0; t < 1000; t += 16) p = easeToRest(p, 16);
    expect(Math.hypot(p.x, p.y)).toBeLessThan(0.5);
  });

  it("does not depend on how the time is sliced", () => {
    const once = easeToRest({ x: 10, y: 0 }, 400);
    let sliced = { x: 10, y: 0 };
    for (let i = 0; i < 4; i++) sliced = easeToRest(sliced, 100);
    expect(sliced.x).toBeCloseTo(once.x, 10);
  });
});

describe("limitLength (RF-13: a planet moves at most 14 px)", () => {
  it("keeps a short offset as it is", () => {
    expect(limitLength({ x: 3, y: -4 }, 14)).toEqual({ x: 3, y: -4 });
  });

  it("shortens a diagonal to the limit, keeping its direction", () => {
    const p = limitLength({ x: 14, y: 14 }, 14);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(14, 10);
    expect(p.x).toBeCloseTo(p.y, 10);
  });

  it("returns 0 for a non-positive limit or a zero offset", () => {
    expect(limitLength({ x: 5, y: 5 }, 0)).toEqual({ x: 0, y: 0 });
    expect(limitLength({ x: 0, y: 0 }, 14)).toEqual({ x: 0, y: 0 });
  });
});
