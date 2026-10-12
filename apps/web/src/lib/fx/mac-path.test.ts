import { describe, expect, it } from "vitest";
import {
  angleAt,
  curveBetween,
  flightMs,
  maxDeviation,
  pointAt,
  retarget,
  tiltFor,
} from "./mac-path";

const origin = { x: 200, y: 300 };
const toward = (distance: number, angleDeg: number) => ({
  x: origin.x + distance * Math.cos((angleDeg * Math.PI) / 180),
  y: origin.y + distance * Math.sin((angleDeg * Math.PI) / 180),
});
const DISTANCES = Array.from({ length: 23 }, (_, i) => 100 + i * 50); // 100 to 1200
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

describe("curveBetween (RF-21)", () => {
  it("starts and ends exactly at the given points", () => {
    const to = toward(500, 30);
    const c = curveBetween(origin, to, 1);
    expect(pointAt(c, 0)).toEqual(origin);
    const end = pointAt(c, 1);
    expect(end.x).toBeCloseTo(to.x, 9);
    expect(end.y).toBeCloseTo(to.y, 9);
  });

  it("strays at least 12 % of the distance from the straight line", () => {
    for (const d of DISTANCES) {
      for (const a of ANGLES) {
        for (const side of [1, -1] as const) {
          const c = curveBetween(origin, toward(d, a), side);
          expect(
            maxDeviation(c),
            `distance ${d}, angle ${a}, side ${side}`,
          ).toBeGreaterThanOrEqual(0.12 * d);
        }
      }
    }
  });

  it("does not stray absurdly far either (at most 35 % of the distance)", () => {
    for (const d of DISTANCES) {
      const c = curveBetween(origin, toward(d, 20), 1);
      expect(maxDeviation(c)).toBeLessThanOrEqual(0.35 * d);
    }
  });

  it("curves to the other side when the side is flipped", () => {
    const to = toward(600, 0); // straight right: the chord is y = 300
    const up = curveBetween(origin, to, 1);
    const down = curveBetween(origin, to, -1);
    const midUp = pointAt(up, 0.3).y - 300;
    const midDown = pointAt(down, 0.3).y - 300;
    expect(midUp * midDown).toBeLessThan(0);
    expect(Math.abs(midUp)).toBeCloseTo(Math.abs(midDown), 9);
  });

  it("does not produce NaN when the two points coincide", () => {
    const c = curveBetween(origin, origin, 1);
    const p = pointAt(c, 0.5);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(Number.isFinite(angleAt(c, 0.5))).toBe(true);
  });
});

describe("maxDeviation", () => {
  it("is 0 for a straight line (control points on the chord)", () => {
    const c = {
      p0: { x: 0, y: 0 },
      p1: { x: 100, y: 0 },
      p2: { x: 200, y: 0 },
      p3: { x: 300, y: 0 },
    };
    expect(maxDeviation(c)).toBeCloseTo(0, 9);
  });
});

describe("angleAt and tiltFor (RF-22)", () => {
  it("follows the tangent of the curve", () => {
    const straight = {
      p0: { x: 0, y: 0 },
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 300, y: 300 },
    };
    expect(angleAt(straight, 0.5)).toBeCloseTo(45, 6);
  });

  it("limits the tilt to -25 and 25 degrees for any direction", () => {
    for (let a = -360; a <= 360; a += 5) {
      const tilt = tiltFor(a);
      expect(tilt).toBeGreaterThanOrEqual(-25);
      expect(tilt).toBeLessThanOrEqual(25);
    }
  });

  it("leans towards the direction of the flight", () => {
    expect(tiltFor(0)).toBeCloseTo(25, 6); // flying right
    expect(tiltFor(180)).toBeCloseTo(-25, 6); // flying left
    expect(Math.abs(tiltFor(90))).toBeLessThan(1e-9); // straight down
    expect(Math.abs(tiltFor(-90))).toBeLessThan(1e-9); // straight up
    expect(tiltFor(30)).toBeGreaterThan(0);
    expect(tiltFor(150)).toBeLessThan(0);
  });
});

describe("flightMs (RF-21)", () => {
  it("stays between 700 and 1600 ms for any distance", () => {
    for (const d of [0, 50, 100, 400, 800, 1200, 5000, 1e6]) {
      expect(flightMs(d)).toBeGreaterThanOrEqual(700);
      expect(flightMs(d)).toBeLessThanOrEqual(1600);
    }
  });

  it("grows with the distance between the limits", () => {
    expect(flightMs(300)).toBeLessThan(flightMs(800));
    expect(flightMs(800)).toBeLessThan(flightMs(1200));
    expect(flightMs(0)).toBe(700);
    expect(flightMs(1e6)).toBe(1600);
  });
});

describe("retarget (RF-21: change of planet in mid-flight)", () => {
  it("starts exactly where Mac is, with no jump", () => {
    const first = curveBetween(origin, toward(700, 10), 1);
    const here = pointAt(first, 0.4);
    const second = retarget(here, toward(500, 120), -1);
    expect(second.p0).toEqual(here);
    expect(pointAt(second, 0)).toEqual(here);
  });

  it("ends at the new target and still curves at least 12 %", () => {
    const here = { x: 350, y: 380 };
    const to = { x: 900, y: 120 };
    const second = retarget(here, to, 1);
    const end = pointAt(second, 1);
    expect(end.x).toBeCloseTo(to.x, 9);
    expect(end.y).toBeCloseTo(to.y, 9);
    expect(maxDeviation(second)).toBeGreaterThanOrEqual(
      0.12 * Math.hypot(to.x - here.x, to.y - here.y),
    );
  });
});
