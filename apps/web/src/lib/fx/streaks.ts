// Streaks of the space jump (spec 005, RF-31): stars stretched along the
// movement, as long as the speed. Pure: the generator is passed in.

import type { Rng } from "../sky/rng";
import {
  JUMP_FULL_SPEED_PX_S,
  JUMP_MAX_MS,
  JUMP_MIN_MS,
  JUMP_STREAK_WIDTH_PX,
  STREAK_LENGTH_PER_SPEED,
  STREAK_MAX_LENGTH_PX,
  TIER_PARAMS,
  type FxTier,
} from "./fx-config";

export type Streak = { x1: number; y1: number; x2: number; y2: number };

/**
 * `count` streaks inside the window. `velocity` is the movement in px/s: the
 * streak stretches along it, its tail behind the head, with length
 * proportional to the speed (up to STREAK_MAX_LENGTH_PX). No speed, no count
 * or an empty window: no streaks.
 */
export function streakLines(
  count: number,
  velocity: { x: number; y: number },
  viewport: { width: number; height: number },
  rng: Rng,
): Streak[] {
  const speed = Math.hypot(velocity.x, velocity.y);
  if (count <= 0 || !(speed > 0)) return [];
  const dx = velocity.x / speed;
  const dy = velocity.y / speed;
  const lines: Streak[] = [];
  for (let i = 0; i < count; i++) {
    const x1 = rng() * viewport.width;
    const y1 = rng() * viewport.height;
    const jitter = 0.5 + 0.5 * rng();
    const length = Math.min(
      STREAK_MAX_LENGTH_PX,
      speed * STREAK_LENGTH_PER_SPEED * jitter,
    );
    lines.push({ x1, y1, x2: x1 - dx * length, y2: y1 - dy * length });
  }
  return lines;
}

/**
 * How many streaks to draw at `speed` (px/s): none on low or off, growing
 * with the speed up to the tier's limit (40 mid, 80 high).
 */
export function streakCountFor(tier: FxTier, speed: number): number {
  const max = TIER_PARAMS[tier].jumpStreaksMax;
  if (max <= 0 || !(speed > 0)) return 0;
  return Math.round(max * Math.min(1, speed / JUMP_FULL_SPEED_PX_S));
}

/** Duration of the jump for a scroll of `distance` px: 200 to 900 ms. */
export function jumpDurationMs(distance: number): number {
  const ms = JUMP_MIN_MS + Math.max(0, distance) * 0.25;
  return Math.min(JUMP_MAX_MS, ms);
}

/**
 * Strength 0..1 of the jump `elapsed` ms after it began, for a jump of `ms`:
 * one soft rise and fall (half a sine), 0 at both ends and outside (RNF-10:
 * no flash).
 */
export function jumpEnvelope(elapsed: number, ms: number): number {
  if (!(ms > 0) || !(elapsed > 0) || elapsed >= ms) return 0;
  return Math.sin((Math.PI * elapsed) / ms);
}

/**
 * Most of the window (0..1) the streaks of the tier can cover at once: every
 * streak at its longest, as wide as JUMP_STREAK_WIDTH_PX (RNF-10: ≤ 0.25).
 */
export function jumpCoverage(
  tier: FxTier,
  viewport: { width: number; height: number },
): number {
  const area = viewport.width * viewport.height;
  if (!(area > 0)) return 0;
  const longest = Math.min(STREAK_MAX_LENGTH_PX, viewport.height);
  return (
    (TIER_PARAMS[tier].jumpStreaksMax * longest * JUMP_STREAK_WIDTH_PX) / area
  );
}
