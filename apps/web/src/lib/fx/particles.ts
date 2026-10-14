// Particle pool of the effects canvas (spec 005, plan section 4). A pool of
// fixed size in typed arrays: no allocation per frame. The generator is
// passed in; time is passed as `dtMs`.

import { range, type Rng } from "../sky/rng";
import {
  PARTICLE_GRAVITY,
  PARTICLE_KINDS,
  PARTICLE_LIFE_MS,
  PARTICLE_SIZE_PX,
  SPARK_FILL_MS,
  SPARK_SPEED_PX_MS,
  TIER_PARAMS,
  TRAIL_FULL_RATE_SPEED_PX_S,
  type FxTier,
  type ParticleKind,
} from "./fx-config";

export type Point = { x: number; y: number };

export type Pool = {
  readonly max: number;
  /** Particles alive: indices 0 to alive - 1. */
  alive: number;
  x: Float32Array;
  y: Float32Array;
  /** Velocity in px per ms. */
  vx: Float32Array;
  vy: Float32Array;
  /** Remaining life and initial life, in ms. */
  life: Float32Array;
  lifeMax: Float32Array;
  size: Float32Array;
  /** Index of the kind in PARTICLE_KINDS. */
  kind: Uint8Array;
  /** Colour of the particle: an index in the painter's own list of tones. */
  tone: Uint8Array;
};

export function createPool(max: number): Pool {
  return {
    max,
    alive: 0,
    x: new Float32Array(max),
    y: new Float32Array(max),
    vx: new Float32Array(max),
    vy: new Float32Array(max),
    life: new Float32Array(max),
    lifeMax: new Float32Array(max),
    size: new Float32Array(max),
    kind: new Uint8Array(max),
    tone: new Uint8Array(max),
  };
}

/** Most particles alive at once in the tier (RF-37). */
export function capFor(tier: FxTier): number {
  return TIER_PARAMS[tier].maxParticles;
}

/** Most sparks alive at once on one planet in the tier (RF-14). */
export function sparkCap(tier: FxTier): number {
  return TIER_PARAMS[tier].sparksPerPlanet;
}

const TRAIL = PARTICLE_KINDS.indexOf("trail");

function write(
  pool: Pool,
  i: number,
  kind: ParticleKind,
  origin: Point,
  velocity: Point,
  rng: Rng,
  tone: number,
): void {
  const [lifeMin, lifeMax] = PARTICLE_LIFE_MS[kind];
  pool.tone[i] = tone;
  const life = range(rng, lifeMin, lifeMax);
  pool.x[i] = origin.x;
  pool.y[i] = origin.y;
  pool.vx[i] = velocity.x;
  pool.vy[i] = velocity.y;
  pool.life[i] = life;
  pool.lifeMax[i] = life;
  pool.size[i] = range(rng, PARTICLE_SIZE_PX[0], PARTICLE_SIZE_PX[1]);
  pool.kind[i] = PARTICLE_KINDS.indexOf(kind);
}

/**
 * Adds a particle. Never goes past `caps.max` (the limit of the tier) or the
 * size of the pool. When full it takes the place of the oldest trail
 * particle; if there is none, nothing is created. Returns whether it was.
 * `tone` is the colour index the painter gives it (0 by default).
 */
export function spawn(
  pool: Pool,
  kind: ParticleKind,
  origin: Point,
  velocity: Point,
  rng: Rng,
  caps: { max: number },
  tone = 0,
): boolean {
  const limit = Math.min(caps.max, pool.max);
  if (limit <= 0) return false;
  if (pool.alive < limit) {
    write(pool, pool.alive, kind, origin, velocity, rng, tone);
    pool.alive++;
    return true;
  }
  let oldest = -1;
  let lowest = Infinity;
  for (let i = 0; i < pool.alive; i++) {
    if (pool.kind[i] !== TRAIL) continue;
    const left = pool.life[i]! / pool.lifeMax[i]!;
    if (left < lowest) {
      lowest = left;
      oldest = i;
    }
  }
  if (oldest < 0) return false;
  write(pool, oldest, kind, origin, velocity, rng, tone);
  return true;
}

/** Moves the particles, ages them and frees the ones whose life ended. */
export function step(pool: Pool, dtMs: number): void {
  for (let i = 0; i < pool.alive;) {
    const left = pool.life[i]! - dtMs;
    pool.life[i] = left;
    if (left <= 0) {
      const last = pool.alive - 1;
      pool.x[i] = pool.x[last]!;
      pool.y[i] = pool.y[last]!;
      pool.vx[i] = pool.vx[last]!;
      pool.vy[i] = pool.vy[last]!;
      pool.life[i] = pool.life[last]!;
      pool.lifeMax[i] = pool.lifeMax[last]!;
      pool.size[i] = pool.size[last]!;
      pool.kind[i] = pool.kind[last]!;
      pool.tone[i] = pool.tone[last]!;
      pool.alive--;
      continue;
    }
    const gravity = PARTICLE_GRAVITY[PARTICLE_KINDS[pool.kind[i]!]!];
    pool.x[i] = pool.x[i]! + pool.vx[i]! * dtMs;
    pool.y[i] = pool.y[i]! + pool.vy[i]! * dtMs;
    pool.vy[i] = pool.vy[i]! + gravity * dtMs;
    i++;
  }
}

/**
 * Where a spark of a planet starts and how it flies (RF-14): on a circle of
 * `radius` around the centre, at a random angle, outwards at a speed in
 * SPARK_SPEED_PX_MS.
 */
export function sparkLaunch(
  rng: Rng,
  centre: Point,
  radius: number,
): { origin: Point; velocity: Point } {
  const angle = range(rng, 0, 2 * Math.PI);
  const speed = range(rng, SPARK_SPEED_PX_MS[0], SPARK_SPEED_PX_MS[1]);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return {
    origin: { x: centre.x + dx * radius, y: centre.y + dy * radius },
    velocity: { x: dx * speed, y: dy * speed },
  };
}

/**
 * Sparks a planet under the cursor gives off in `dtMs` (RF-14): at the rate
 * that fills `cap` in SPARK_FILL_MS, never past `cap` alive. `carry` is the
 * fraction left from the frames before; when the cap stops the emission the
 * fraction is dropped.
 */
export function sparksToEmit(
  carry: number,
  dtMs: number,
  cap: number,
  alive: number,
): { count: number; carry: number } {
  if (cap <= 0) return { count: 0, carry: 0 };
  const total = carry + (Math.max(0, dtMs) * cap) / SPARK_FILL_MS;
  const whole = Math.floor(total);
  const room = Math.max(0, cap - alive);
  if (whole > room) return { count: room, carry: 0 };
  return { count: whole, carry: total - whole };
}

/** Opacity of particle `i`: 1 when born, 0 when its life ends. */
export function alphaAt(pool: Pool, i: number): number {
  return Math.max(0, pool.life[i]! / pool.lifeMax[i]!);
}

/**
 * Particles per second a kind emits at `speed` (px/s). Only Mac's trail is
 * emitted continuously: 0 when he is still, the tier's full rate from a
 * flying speed (RF-23).
 */
export function emitRate(
  kind: ParticleKind,
  tier: FxTier,
  speed: number,
): number {
  if (kind !== "trail" || !(speed > 0)) return 0;
  const full = TIER_PARAMS[tier].trailPerSecond;
  return full * Math.min(1, speed / TRAIL_FULL_RATE_SPEED_PX_S);
}
