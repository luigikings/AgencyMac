// Mac's reactions (spec 005, RF-25 to RF-29): gaze, choice of lines, turbo
// mode and rest. Pure: the clock and the generator are passed in.

import { range, type Rng } from "../sky/rng";
import {
  BUBBLE_MS,
  IDLE_AFTER_MS,
  LOOK_FULL_DISTANCE_PX,
  TURBO_CLICKS,
  TURBO_COOLDOWN_MS,
  TURBO_WINDOW_MS,
} from "./fx-config";

export type Point = { x: number; y: number };

/** Translation keys of Mac's lines by situation (table of texts of the spec). */
export const LINE_KEYS = {
  greet: "mac.greet",
  arrive: {
    hexaweb: "mac.arrive.hexaweb",
    rankia: "mac.arrive.rankia",
    adara: "mac.arrive.adara",
    contact: "mac.arrive.contact",
  },
  click: ["mac.click.1", "mac.click.2", "mac.click.3"],
  idle: "mac.idle",
  turbo: "mac.turbo",
} as const;

/**
 * Tilt (degrees) and shift (px) of Mac towards the cursor: up to `maxDeg` and
 * `maxPx`, reached when the cursor is LOOK_FULL_DISTANCE_PX away or more.
 */
export function lookAt(
  macCenter: Point,
  cursor: Point,
  { maxDeg, maxPx }: { maxDeg: number; maxPx: number },
): { rotate: number; x: number; y: number } {
  const vx = cursor.x - macCenter.x;
  const vy = cursor.y - macCenter.y;
  const dist = Math.hypot(vx, vy);
  if (dist === 0) return { rotate: 0, x: 0, y: 0 };
  const k = Math.min(1, dist / LOOK_FULL_DISTANCE_PX);
  return {
    rotate: Math.sign(vx) * maxDeg * k,
    x: (vx / dist) * maxPx * k,
    y: (vy / dist) * maxPx * k,
  };
}

/**
 * Index of the next line, never the same as `lastIndex` when there is more
 * than one. -1 for no lines; 0 when there is only one.
 */
export function pickLine(
  lines: readonly unknown[],
  lastIndex: number,
  rng: Rng,
): number {
  const n = lines.length;
  if (n === 0) return -1;
  if (n === 1) return 0;
  if (lastIndex < 0 || lastIndex >= n) return Math.floor(rng() * n);
  const pick = Math.floor(rng() * (n - 1));
  return pick >= lastIndex ? pick + 1 : pick;
}

/**
 * Turbo mode (RF-29): at least `count` presses within `windowMs` of `now`
 * (inclusive), and the cooldown after the last turbo is over.
 */
export function isTurbo(
  presses: readonly number[],
  now: number,
  opts: {
    count?: number;
    windowMs?: number;
    cooldownMs?: number;
    lastTurbo?: number | null;
  } = {},
): boolean {
  const {
    count = TURBO_CLICKS,
    windowMs = TURBO_WINDOW_MS,
    cooldownMs = TURBO_COOLDOWN_MS,
    lastTurbo = null,
  } = opts;
  if (lastTurbo !== null && now - lastTurbo < cooldownMs) return false;
  return presses.filter((t) => now - t <= windowMs).length >= count;
}

/**
 * The rest line is due (RF-27): `afterMs` without interaction, and not shown
 * yet in this period of rest (once per period).
 */
export function idleDue(
  state: { lastInteraction: number; lastIdle: number | null },
  now: number,
  afterMs: number = IDLE_AFTER_MS,
): boolean {
  if (now - state.lastInteraction < afterMs) return false;
  return state.lastIdle === null || state.lastIdle < state.lastInteraction;
}

/** How long a bubble stays, in ms (2.0 to 2.8 s). */
export function bubbleMs(rng: Rng): number {
  return range(rng, BUBBLE_MS[0], BUBBLE_MS[1]);
}
