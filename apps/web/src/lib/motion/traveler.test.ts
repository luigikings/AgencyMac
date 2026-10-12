import { describe, expect, it } from "vitest";
import { travelerTarget } from "./traveler";

// RF-34: the centre of the traveller lands inside the active planet's
// illustration and the traveller never leaves its container.
const container = { left: 0, top: 0, width: 1000, height: 2000 };
const planet = { left: 600, top: 300, width: 300, height: 300 };

type Rect = { left: number; top: number; width: number; height: number };

function centre(t: { x: number; y: number }, size: number) {
  return { cx: t.x + size / 2, cy: t.y + size / 2 };
}
function inside(c: { cx: number; cy: number }, r: Rect) {
  return (
    c.cx >= r.left &&
    c.cx <= r.left + r.width &&
    c.cy >= r.top &&
    c.cy <= r.top + r.height
  );
}

describe("travelerTarget", () => {
  it("puts the centre inside the planet for both sides", () => {
    for (const side of ["left", "right"] as const) {
      const t = travelerTarget({ container, planet, size: 120, side });
      expect(inside(centre(t, 120), planet)).toBe(true);
    }
  });

  it("sits further right for side right than for side left", () => {
    const l = travelerTarget({ container, planet, size: 120, side: "left" });
    const r = travelerTarget({ container, planet, size: 120, side: "right" });
    expect(r.x).toBeGreaterThan(l.x);
    expect(r.y).toBe(l.y);
  });

  it("uses the lower part of the planet", () => {
    const t = travelerTarget({ container, planet, size: 100, side: "right" });
    expect(centre(t, 100).cy).toBeCloseTo(300 + 300 * 0.8);
    expect(centre(t, 100).cx).toBeCloseTo(600 + 300 * 0.82);
  });

  it("keeps the traveller inside the container", () => {
    const edge = { left: 880, top: 1900, width: 120, height: 100 };
    const t = travelerTarget({
      container,
      planet: edge,
      size: 120,
      side: "right",
    });
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x + 120).toBeLessThanOrEqual(1000);
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.y + 120).toBeLessThanOrEqual(2000);
  });

  it("prioritises the planet interior when the container would clip it", () => {
    const corner = { left: 0, top: 0, width: 200, height: 200 };
    const t = travelerTarget({
      container,
      planet: corner,
      size: 400,
      side: "left",
    });
    expect(inside(centre(t, 400), corner)).toBe(true);
  });

  it("handles a container smaller than the traveller without NaN", () => {
    const t = travelerTarget({
      container: { left: 0, top: 0, width: 50, height: 50 },
      planet: { left: 0, top: 0, width: 50, height: 50 },
      size: 120,
      side: "left",
    });
    expect(Number.isFinite(t.x)).toBe(true);
    expect(Number.isFinite(t.y)).toBe(true);
  });

  it("returns positions relative to the container origin", () => {
    const offset = { left: 100, top: 1000, width: 1000, height: 2000 };
    const a = travelerTarget({
      container: offset,
      planet: { left: 700, top: 1300, width: 300, height: 300 },
      size: 100,
      side: "right",
    });
    const b = travelerTarget({
      container,
      planet,
      size: 100,
      side: "right",
    });
    expect(a).toEqual(b);
  });
});
