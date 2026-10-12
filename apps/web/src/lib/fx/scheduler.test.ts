import { describe, expect, it } from "vitest";
import {
  canSpawnShootingStar,
  needsFrame,
  nextShootingStarDelay,
  shootingStarDuration,
  shouldRun,
} from "./scheduler";

describe("shouldRun (RF-39)", () => {
  it("never runs with the tab hidden", () => {
    expect(shouldRun({ hidden: true, active: true, inView: true })).toBe(false);
  });

  it("runs when visible and either active or in view", () => {
    expect(shouldRun({ hidden: false, active: true, inView: false })).toBe(
      true,
    );
    expect(shouldRun({ hidden: false, active: false, inView: true })).toBe(
      true,
    );
  });

  it("does not run when visible but neither active nor in view", () => {
    expect(shouldRun({ hidden: false, active: false, inView: false })).toBe(
      false,
    );
  });
});

describe("needsFrame (RF-39)", () => {
  it("asks for frames only while there are particles or effects", () => {
    expect(needsFrame({ particles: 0, effects: 0 })).toBe(false);
    expect(needsFrame({ particles: 3, effects: 0 })).toBe(true);
    expect(needsFrame({ particles: 0, effects: 1 })).toBe(true);
  });
});

describe("nextShootingStarDelay (RF-4)", () => {
  it("is 12 to 24 s on mid", () => {
    expect(nextShootingStarDelay(() => 0, "mid")).toBe(12000);
    expect(nextShootingStarDelay(() => 0.5, "mid")).toBe(18000);
    expect(nextShootingStarDelay(() => 0.999999, "mid")).toBeLessThan(24000);
  });

  it("is 8 to 16 s on high", () => {
    expect(nextShootingStarDelay(() => 0, "high")).toBe(8000);
    expect(nextShootingStarDelay(() => 0.999999, "high")).toBeLessThan(16000);
  });

  it("never comes on low or off", () => {
    expect(nextShootingStarDelay(() => 0.5, "low")).toBe(Infinity);
    expect(nextShootingStarDelay(() => 0.5, "off")).toBe(Infinity);
  });
});

describe("canSpawnShootingStar (RF-4)", () => {
  it("allows 1 at a time on mid", () => {
    expect(canSpawnShootingStar(0, "mid")).toBe(true);
    expect(canSpawnShootingStar(1, "mid")).toBe(false);
  });

  it("allows 2 at a time on high", () => {
    expect(canSpawnShootingStar(1, "high")).toBe(true);
    expect(canSpawnShootingStar(2, "high")).toBe(false);
  });

  it("allows none on low or off", () => {
    expect(canSpawnShootingStar(0, "low")).toBe(false);
    expect(canSpawnShootingStar(0, "off")).toBe(false);
  });
});

describe("shootingStarDuration (RF-4)", () => {
  it("lasts 0.6 to 1.2 s", () => {
    expect(shootingStarDuration(() => 0)).toBe(600);
    expect(shootingStarDuration(() => 0.999999)).toBeLessThan(1200);
  });
});
