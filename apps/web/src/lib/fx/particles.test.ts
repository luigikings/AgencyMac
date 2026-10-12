import { describe, expect, it } from "vitest";
import { PARTICLE_LIFE_MAX_MS, TIER_PARAMS } from "./fx-config";
import {
  alphaAt,
  capFor,
  createPool,
  emitRate,
  sparkCap,
  spawn,
  step,
} from "./particles";

const rng = () => 0.5;
const at = { x: 100, y: 100 };
const still = { x: 0, y: 0 };

describe("capFor and sparkCap (RF-14, RF-37)", () => {
  it("caps the particles at 24, 80 and 160", () => {
    expect(capFor("low")).toBe(24);
    expect(capFor("mid")).toBe(80);
    expect(capFor("high")).toBe(160);
    expect(capFor("off")).toBe(0);
  });

  it("caps the sparks per planet at 0, 20 and 40", () => {
    expect(sparkCap("low")).toBe(0);
    expect(sparkCap("mid")).toBe(20);
    expect(sparkCap("high")).toBe(40);
  });
});

describe("createPool", () => {
  it("starts empty with the given size", () => {
    const pool = createPool(160);
    expect(pool.max).toBe(160);
    expect(pool.alive).toBe(0);
  });
});

describe("spawn", () => {
  it("adds a particle with its position, velocity and life", () => {
    const pool = createPool(10);
    expect(
      spawn(pool, "burst", at, { x: 0.1, y: -0.2 }, rng, { max: 10 }),
    ).toBe(true);
    expect(pool.alive).toBe(1);
    expect(pool.x[0]).toBe(100);
    expect(pool.vx[0]).toBeCloseTo(0.1);
    expect(pool.life[0]).toBeGreaterThan(0);
    expect(pool.life[0]).toBe(pool.lifeMax[0]);
  });

  it("refuses to go past the cap of the tier, even if the pool is bigger", () => {
    const pool = createPool(160);
    for (let i = 0; i < 100; i++) {
      spawn(pool, "burst", at, still, rng, { max: capFor("mid") });
    }
    expect(pool.alive).toBe(80);
  });

  it("when full, replaces the oldest trail particle with a new one", () => {
    const pool = createPool(3);
    const caps = { max: 3 };
    spawn(pool, "trail", at, still, rng, caps);
    spawn(pool, "burst", at, still, rng, caps);
    spawn(pool, "trail", at, still, rng, caps);
    step(pool, 100); // the first trail is now the oldest
    pool.life[2] = pool.lifeMax[2]!; // refresh the second trail
    const ok = spawn(pool, "spark", { x: 5, y: 5 }, still, rng, caps);
    expect(ok).toBe(true);
    expect(pool.alive).toBe(3);
    expect(pool.x.includes(5)).toBe(true);
  });

  it("when full and there is no trail, does not create the particle", () => {
    const pool = createPool(2);
    const caps = { max: 2 };
    spawn(pool, "burst", at, still, rng, caps);
    spawn(pool, "spark", at, still, rng, caps);
    expect(spawn(pool, "burst", at, still, rng, caps)).toBe(false);
    expect(pool.alive).toBe(2);
  });

  it("creates nothing with a cap of 0", () => {
    const pool = createPool(10);
    expect(spawn(pool, "burst", at, still, rng, { max: 0 })).toBe(false);
  });
});

describe("step", () => {
  it("moves particles by velocity times time", () => {
    const pool = createPool(4);
    spawn(pool, "burst", at, { x: 0.1, y: 0 }, rng, { max: 4 });
    step(pool, 100);
    expect(pool.x[0]).toBeCloseTo(110, 5);
  });

  it("applies gravity to the vertical velocity", () => {
    const pool = createPool(4);
    spawn(pool, "burst", at, still, rng, { max: 4 });
    step(pool, 100);
    expect(pool.vy[0]!).toBeGreaterThan(0);
  });

  it("fades the alpha linearly with the remaining life", () => {
    const pool = createPool(4);
    spawn(pool, "trail", at, still, rng, { max: 4 });
    expect(alphaAt(pool, 0)).toBe(1);
    step(pool, pool.lifeMax[0]! / 2);
    expect(alphaAt(pool, 0)).toBeCloseTo(0.5, 5);
  });

  it("removes dead particles and keeps the others", () => {
    const pool = createPool(4);
    spawn(pool, "trail", at, still, rng, { max: 4 });
    spawn(pool, "burst", { x: 7, y: 7 }, still, rng, { max: 4 });
    const trailLife = pool.lifeMax[0]!;
    const burstLife = pool.lifeMax[1]!;
    expect(burstLife).toBeGreaterThan(trailLife);
    step(pool, trailLife + 1);
    expect(pool.alive).toBe(1);
    expect(pool.x[0]).toBeCloseTo(7, 5);
    step(pool, burstLife);
    expect(pool.alive).toBe(0);
  });

  it("leaves an empty pool empty", () => {
    const pool = createPool(4);
    step(pool, 16);
    expect(pool.alive).toBe(0);
  });

  it("makes trail particles disappear in under 0.6 s (RF-23)", () => {
    const pool = createPool(50);
    for (let i = 0; i < 50; i++) {
      spawn(pool, "trail", at, still, () => 0.999999, { max: 50 });
    }
    step(pool, PARTICLE_LIFE_MAX_MS);
    expect(pool.alive).toBe(0);
    expect(PARTICLE_LIFE_MAX_MS).toBeLessThan(600);
  });
});

describe("emitRate (RF-23)", () => {
  it("is at least 36, 20 and 8 per second at flying speed", () => {
    expect(emitRate("trail", "high", 400)).toBeGreaterThanOrEqual(36);
    expect(emitRate("trail", "mid", 400)).toBeGreaterThanOrEqual(20);
    expect(emitRate("trail", "low", 400)).toBeGreaterThanOrEqual(8);
    expect(emitRate("trail", "high", 400)).toBe(
      TIER_PARAMS.high.trailPerSecond,
    );
  });

  it("is 0 when Mac does not fly", () => {
    expect(emitRate("trail", "high", 0)).toBe(0);
  });

  it("grows with speed up to the full rate", () => {
    const slow = emitRate("trail", "high", 30);
    expect(slow).toBeGreaterThan(0);
    expect(slow).toBeLessThan(36);
    expect(emitRate("trail", "high", 100000)).toBe(36);
  });

  it("is 0 with no effects and for other kinds", () => {
    expect(emitRate("trail", "off", 400)).toBe(0);
    expect(emitRate("spark", "high", 400)).toBe(0);
  });
});
