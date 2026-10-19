import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sky/rng";
import {
  BURST_SPEED_PX_MS,
  CURSOR_TRAIL_SPACING_PX,
  CURSOR_TRAIL_SPEED_PX_MS,
  CURSOR_TRAIL_TONES,
  PARTICLE_LIFE_MAX_MS,
  PARTICLE_LIFE_MS,
  SPARK_FILL_MS,
  SPARK_SPEED_PX_MS,
  TIER_PARAMS,
  TRAIL_JITTER_PX,
  TRAIL_SPEED_PX_MS,
  TRAIL_SPREAD_DEG,
} from "./fx-config";
import {
  alphaAt,
  burstLaunch,
  capFor,
  createPool,
  cursorDue,
  cursorTrailCap,
  emitRate,
  sparkCap,
  sparkLaunch,
  sparksToEmit,
  spawn,
  step,
  trailCap,
  trailDue,
  trailLaunch,
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

describe("tone of a particle (RF-14)", () => {
  it("is stored when spawned and travels with it when another dies", () => {
    const pool = createPool(4);
    spawn(pool, "trail", at, still, rng, { max: 4 }, 1);
    spawn(pool, "burst", { x: 7, y: 7 }, still, rng, { max: 4 }, 3);
    expect(pool.tone[0]).toBe(1);
    expect(pool.tone[1]).toBe(3);
    step(pool, pool.lifeMax[0]! + 1); // the trail dies, the burst moves down
    expect(pool.alive).toBe(1);
    expect(pool.tone[0]).toBe(3);
  });

  it("is 0 when none is given", () => {
    const pool = createPool(2);
    spawn(pool, "burst", at, still, rng, { max: 2 });
    expect(pool.tone[0]).toBe(0);
  });
});

describe("sparkLaunch (RF-14)", () => {
  const center = { x: 300, y: 200 };

  it("starts on the rim and flies outwards within the speed range", () => {
    for (const value of [0, 0.13, 0.5, 0.77, 0.999]) {
      const { origin, velocity } = sparkLaunch(() => value, center, 80);
      const out = { x: origin.x - center.x, y: origin.y - center.y };
      expect(Math.hypot(out.x, out.y)).toBeCloseTo(80, 5);
      expect(out.x * velocity.x + out.y * velocity.y).toBeGreaterThan(0);
      const speed = Math.hypot(velocity.x, velocity.y);
      expect(speed).toBeGreaterThanOrEqual(SPARK_SPEED_PX_MS[0] - 1e-9);
      expect(speed).toBeLessThanOrEqual(SPARK_SPEED_PX_MS[1] + 1e-9);
    }
  });

  it("is the same for the same generator", () => {
    const a = sparkLaunch(mulberry32(9), center, 50);
    const b = sparkLaunch(mulberry32(9), center, 50);
    expect(a).toEqual(b);
  });
});

describe("sparksToEmit (RF-14)", () => {
  it("emits nothing with a cap of 0 (low tier, touch)", () => {
    expect(sparksToEmit(0, 1000, 0, 0)).toEqual({ count: 0, carry: 0 });
  });

  it("fills the cap from empty in SPARK_FILL_MS", () => {
    let carry = 0;
    let alive = 0;
    for (let t = 0; t < SPARK_FILL_MS; t += 16) {
      const out = sparksToEmit(carry, 16, 40, alive);
      carry = out.carry;
      alive += out.count;
    }
    expect(alive).toBeGreaterThanOrEqual(38);
    expect(alive).toBeLessThanOrEqual(40);
  });

  it("never emits past the cap of the planet", () => {
    for (const alive of [0, 10, 19, 20, 25]) {
      const { count } = sparksToEmit(0.9, 5000, 20, alive);
      expect(alive + count).toBeLessThanOrEqual(Math.max(20, alive));
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the fraction left over between frames", () => {
    const half = SPARK_FILL_MS / 40 / 2; // half a spark at a cap of 40
    const first = sparksToEmit(0, half, 40, 0);
    expect(first.count).toBe(0);
    const second = sparksToEmit(first.carry, half, 40, 0);
    expect(second.count).toBe(1);
    expect(second.carry).toBeCloseTo(0, 5);
  });
});

describe("trailCap (RF-23, RF-37)", () => {
  it("holds a whole trail: every particle emitted lives its life", () => {
    for (const tier of ["low", "mid", "high"] as const) {
      const lifeMax = PARTICLE_LIFE_MS.trail[1];
      expect(trailCap(tier)).toBeGreaterThanOrEqual(
        Math.ceil((TIER_PARAMS[tier].trailPerSecond * lifeMax) / 1000) + 1,
      );
    }
  });

  it("with the sparks of the three planets stays under the tier's limit", () => {
    for (const tier of ["low", "mid", "high"] as const) {
      expect(trailCap(tier) + 3 * sparkCap(tier)).toBeLessThanOrEqual(
        capFor(tier),
      );
    }
  });

  it("is 0 with no effects", () => {
    expect(trailCap("off")).toBe(0);
  });
});

describe("trailDue (RF-23)", () => {
  it("is one particle at take-off and the rate per second after it", () => {
    for (const rate of [8, 20, 36]) {
      expect(trailDue(0, rate)).toBe(1);
      expect(trailDue(1000, rate)).toBe(rate + 1);
      expect(trailDue(500, rate)).toBe(Math.floor(rate / 2) + 1);
    }
  });

  it("never falls behind the rate, whatever the frames", () => {
    for (const rate of [8, 20, 36]) {
      for (let ms = 0; ms <= 1600; ms += 7) {
        expect(trailDue(ms, rate)).toBeGreaterThanOrEqual((rate * ms) / 1000);
        expect(trailDue(ms, rate)).toBeLessThanOrEqual((rate * ms) / 1000 + 1);
      }
    }
  });

  it("grows with time and never goes back", () => {
    let before = 0;
    for (let ms = 0; ms <= 1000; ms += 13) {
      const due = trailDue(ms, 36);
      expect(due).toBeGreaterThanOrEqual(before);
      before = due;
    }
  });

  it("is nothing with no rate, and the first one with no time", () => {
    expect(trailDue(1000, 0)).toBe(0);
    expect(trailDue(-50, 36)).toBe(1);
    expect(trailDue(Number.NaN, 36)).toBe(1);
  });
});

describe("trailLaunch (RF-23)", () => {
  const rear = { x: 400, y: 300 };

  it("starts near Mac's rear and drifts away behind him", () => {
    for (const heading of [0, 45, 90, 180, -120]) {
      for (const value of [0, 0.25, 0.5, 0.75, 0.999]) {
        const { origin, velocity } = trailLaunch(() => value, rear, heading);
        expect(
          Math.hypot(origin.x - rear.x, origin.y - rear.y),
        ).toBeLessThanOrEqual(TRAIL_JITTER_PX * Math.SQRT2 + 1e-9);
        const speed = Math.hypot(velocity.x, velocity.y);
        expect(speed).toBeGreaterThanOrEqual(TRAIL_SPEED_PX_MS[0] - 1e-9);
        expect(speed).toBeLessThanOrEqual(TRAIL_SPEED_PX_MS[1] + 1e-9);
        // Against the direction of flight, within the spread.
        const rad = (heading * Math.PI) / 180;
        const along =
          (velocity.x * Math.cos(rad) + velocity.y * Math.sin(rad)) / speed;
        expect(along).toBeLessThanOrEqual(
          -Math.cos((TRAIL_SPREAD_DEG * Math.PI) / 180) + 1e-9,
        );
      }
    }
  });

  it("is the same for the same generator", () => {
    expect(trailLaunch(mulberry32(5), rear, 30)).toEqual(
      trailLaunch(mulberry32(5), rear, 30),
    );
  });
});

describe("burstLaunch (RF-28, RF-29)", () => {
  it("starts on a circle around Mac and flies straight out", () => {
    const r = mulberry32(11);
    const centre = { x: 300, y: 200 };
    for (let i = 0; i < 200; i++) {
      const { origin, velocity } = burstLaunch(r, centre, 40);
      const dx = origin.x - centre.x;
      const dy = origin.y - centre.y;
      expect(Math.hypot(dx, dy)).toBeCloseTo(40, 6);
      const speed = Math.hypot(velocity.x, velocity.y);
      expect(speed).toBeGreaterThanOrEqual(BURST_SPEED_PX_MS[0] - 1e-9);
      expect(speed).toBeLessThanOrEqual(BURST_SPEED_PX_MS[1] + 1e-9);
      // Outwards: the same direction as from the centre to the origin.
      expect(velocity.x * dx + velocity.y * dy).toBeGreaterThan(0);
    }
  });

  it("spreads all around", () => {
    const r = mulberry32(2);
    const quadrants = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { velocity } = burstLaunch(r, at, 10);
      quadrants.add(`${velocity.x > 0}${velocity.y > 0}`);
    }
    expect(quadrants.size).toBe(4);
  });
});

// Spec 005, T26: the cursor trail (RF-32).
describe("cursor trail (RF-32)", () => {
  it("has room for 14 particles in the high class and none in the others", () => {
    expect(cursorTrailCap("high")).toBe(14);
    expect(cursorTrailCap("mid")).toBe(0);
    expect(cursorTrailCap("low")).toBe(0);
    expect(cursorTrailCap("off")).toBe(0);
  });

  it("emits one particle every CURSOR_TRAIL_SPACING_PX travelled", () => {
    const s = CURSOR_TRAIL_SPACING_PX;
    expect(cursorDue(0, 2 * s + 2, s)).toEqual({ count: 2, carry: 2 });
    expect(cursorDue(s - 1, 1, s)).toEqual({ count: 1, carry: 0 });
    expect(cursorDue(0, s / 2, s)).toEqual({ count: 0, carry: s / 2 });
  });

  it("emits nothing without movement or with a bad spacing", () => {
    expect(cursorDue(3, 0, 14)).toEqual({ count: 0, carry: 3 });
    expect(cursorDue(3, Number.NaN, 14)).toEqual({ count: 0, carry: 3 });
    expect(cursorDue(3, 40, 0)).toEqual({ count: 0, carry: 0 });
  });

  it("is gone 0.6 s after the cursor stops: every particle lives less", () => {
    expect(PARTICLE_LIFE_MS.cursor[1]).toBeLessThan(600);
    expect(PARTICLE_LIFE_MS.cursor[0]).toBeGreaterThan(0);
  });

  it("drifts slowly, in brand colours", () => {
    expect(CURSOR_TRAIL_SPEED_PX_MS[0]).toBeGreaterThanOrEqual(0);
    expect(CURSOR_TRAIL_SPEED_PX_MS[1]).toBeLessThanOrEqual(0.05);
    expect(CURSOR_TRAIL_TONES.length).toBeGreaterThan(0);
  });
});
