import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sky/rng";
import {
  canvasSize,
  frameStats,
  rgbaOf,
  shootingStarFrame,
  shootingStarPath,
} from "./canvas-math";
import {
  MAX_CANVAS_PIXELS,
  SHOOTING_STAR_ANGLE_DEG,
  SHOOTING_STAR_TAIL_PX,
} from "./fx-config";

describe("canvasSize (RNF-8)", () => {
  it("uses the device ratio when it is under the limit of the tier", () => {
    expect(canvasSize(800, 600, 1, 1.5)).toEqual({
      width: 800,
      height: 600,
      density: 1,
    });
  });

  it("caps the density at the limit of the tier (1, 1.25, 1.5)", () => {
    expect(canvasSize(400, 300, 3, 1).density).toBe(1);
    expect(canvasSize(400, 300, 3, 1.25)).toEqual({
      width: 500,
      height: 375,
      density: 1.25,
    });
    expect(canvasSize(400, 300, 2, 1.5).density).toBe(1.5);
  });

  it("never goes over 2 megapixels", () => {
    expect(MAX_CANVAS_PIXELS).toBe(2_000_000);
    for (const [w, h, dpr] of [
      [1920, 1080, 2],
      [2560, 1440, 1],
      [3840, 2160, 1],
      [1366, 768, 1.5],
    ] as const) {
      const size = canvasSize(w, h, dpr, 1.5);
      expect(size.width * size.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
      expect(size.density).toBeLessThanOrEqual(1.5);
    }
  });

  it("keeps the aspect ratio when it scales down", () => {
    const size = canvasSize(1920, 1080, 2, 1.5);
    expect(size.width / size.height).toBeCloseTo(1920 / 1080, 2);
    expect(size.width * size.height).toBeGreaterThan(0.98 * MAX_CANVAS_PIXELS);
  });

  it("gives at least 1 x 1 for an empty or broken viewport", () => {
    expect(canvasSize(0, 0, 1, 1)).toEqual({ width: 1, height: 1, density: 1 });
    expect(canvasSize(800, 600, NaN, 1.5).density).toBe(1);
  });
});

describe("frameStats (fx:report)", () => {
  it("is empty without frames", () => {
    expect(frameStats([])).toEqual({ frames: 0, avg: 0, p95: 0 });
  });

  it("gives the mean and the 95th percentile (nearest rank)", () => {
    const costs = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(frameStats(costs)).toEqual({ frames: 100, avg: 50.5, p95: 95 });
  });

  it("does not depend on the order", () => {
    expect(frameStats([3, 1, 2]).p95).toBe(3);
    expect(frameStats([2, 3, 1]).avg).toBe(2);
  });
});

describe("shootingStarPath (RF-4)", () => {
  const view = { width: 1280, height: 800 };

  it("starts in the upper half of the view and falls at a gentle angle", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const p = shootingStarPath(rng, view);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(view.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(view.height / 2);
      expect(Math.hypot(p.dx, p.dy)).toBeCloseTo(1, 6);
      expect(p.dy).toBeGreaterThan(0); // downwards
      const angle = (Math.atan2(p.dy, Math.abs(p.dx)) * 180) / Math.PI;
      expect(angle).toBeGreaterThanOrEqual(SHOOTING_STAR_ANGLE_DEG[0] - 1e-9);
      expect(angle).toBeLessThanOrEqual(SHOOTING_STAR_ANGLE_DEG[1] + 1e-9);
      expect(p.tail).toBeGreaterThanOrEqual(SHOOTING_STAR_TAIL_PX[0]);
      expect(p.tail).toBeLessThanOrEqual(SHOOTING_STAR_TAIL_PX[1]);
      expect(p.travel).toBeGreaterThan(p.tail);
    }
  });

  it("goes both ways, towards the middle of the view", () => {
    const rng = mulberry32(11);
    const paths = Array.from({ length: 100 }, () =>
      shootingStarPath(rng, view),
    );
    expect(paths.some((p) => p.dx > 0)).toBe(true);
    expect(paths.some((p) => p.dx < 0)).toBe(true);
    for (const p of paths) {
      // Heading left from the right half, right from the left half.
      expect(Math.sign(p.dx)).toBe(p.x >= view.width / 2 ? -1 : 1);
    }
  });

  it("is the same for the same seed", () => {
    expect(shootingStarPath(mulberry32(3), view)).toEqual(
      shootingStarPath(mulberry32(3), view),
    );
  });
});

describe("shootingStarFrame (RF-4)", () => {
  const path = { x: 100, y: 50, dx: 0.8, dy: 0.6, travel: 400, tail: 100 };

  it("fades in and out: invisible at both ends, full in the middle", () => {
    expect(shootingStarFrame(path, 0, 1000).alpha).toBeCloseTo(0, 6);
    expect(shootingStarFrame(path, 500, 1000).alpha).toBeCloseTo(1, 6);
    expect(shootingStarFrame(path, 1000, 1000).alpha).toBeCloseTo(0, 6);
  });

  it("moves the head along the path, with the tail behind it", () => {
    const a = shootingStarFrame(path, 250, 1000);
    const b = shootingStarFrame(path, 750, 1000);
    expect(b.headX).toBeGreaterThan(a.headX);
    expect(b.headY).toBeGreaterThan(a.headY);
    const end = shootingStarFrame(path, 1000, 1000);
    expect(end.headX).toBeCloseTo(100 + 0.8 * 400, 6);
    expect(end.headY).toBeCloseTo(50 + 0.6 * 400, 6);
    const tail = Math.hypot(b.headX - b.tailX, b.headY - b.tailY);
    expect(tail).toBeCloseTo(100, 6);
  });

  it("never draws the tail behind the starting point", () => {
    const f = shootingStarFrame(path, 50, 1000);
    expect(f.tailX).toBeCloseTo(100, 6);
    expect(f.tailY).toBeCloseTo(50, 6);
  });

  it("clamps the time to the duration", () => {
    expect(shootingStarFrame(path, 5000, 1000)).toEqual(
      shootingStarFrame(path, 1000, 1000),
    );
    expect(shootingStarFrame(path, -5, 1000)).toEqual(
      shootingStarFrame(path, 0, 1000),
    );
  });
});

describe("rgbaOf (colours of the canvas come from the tokens)", () => {
  it("reads the colour the canvas normalises (6 digits or rgba)", () => {
    expect(rgbaOf("#" + "ffcc00", 0.5)).toBe("rgba(255,204,0,0.5)");
    expect(rgbaOf("rgba(10, 20, 30, 0.8)", 1)).toBe("rgba(10,20,30,1)");
    expect(rgbaOf("rgb(1,2,3)", 0)).toBe("rgba(1,2,3,0)");
  });

  it("limits the alpha to [0, 1]", () => {
    expect(rgbaOf("rgb(1,2,3)", 2)).toBe("rgba(1,2,3,1)");
    expect(rgbaOf("rgb(1,2,3)", -1)).toBe("rgba(1,2,3,0)");
  });

  it("is null for a colour it cannot read", () => {
    expect(rgbaOf("", 1)).toBeNull();
    expect(rgbaOf("var(--color-text)", 1)).toBeNull();
  });
});
