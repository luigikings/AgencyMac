// Mac's reactions (spec 005, RF-25 to RF-29): gaze, choice of lines, turbo
// mode and rest. Pure: the clock and the generator are passed in.

import { range, type Rng } from "../sky/rng";
import {
  BUBBLE_MS,
  BURST_CLICK,
  BURST_TURBO,
  GREET_MS,
  GREET_SWAY_DEG,
  IDLE_AFTER_MS,
  LOOK_FULL_DISTANCE_PX,
  LOOK_TAU_MS,
  TURBO_CLICKS,
  TURBO_COOLDOWN_MS,
  TURBO_LIFT_RATIO,
  TURBO_MARGIN_PX,
  TURBO_MIN_SCALE,
  TURBO_MS,
  TURBO_SPIN_DEG,
  TURBO_SPIN_DELAY,
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

/**
 * Milliseconds until the rest line is due (0 when it is), so a single timer
 * can wait for it; Infinity once shown in this period of rest.
 */
export function idleWaitMs(
  state: { lastInteraction: number; lastIdle: number | null },
  now: number,
  afterMs: number = IDLE_AFTER_MS,
): number {
  if (state.lastIdle !== null && state.lastIdle >= state.lastInteraction) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, state.lastInteraction + afterMs - now);
}

/** Mac's gaze: tilt in degrees and shift in px. */
export type Pose = { rotate: number; x: number; y: number };

/** Below these the gaze counts as arrived (degrees, px). */
const GAZE_EPSILON_DEG = 0.02;
const GAZE_EPSILON_PX = 0.05;

/**
 * One frame of the gaze easing from `current` towards `target` (time based,
 * time constant `tauMs`); it lands exactly on the target when close enough.
 */
export function easeGaze(
  current: Pose,
  target: Pose,
  dtMs: number,
  tauMs: number = LOOK_TAU_MS,
): { pose: Pose; settled: boolean } {
  const k = Math.exp(-Math.max(0, dtMs) / tauMs);
  const pose = {
    rotate: target.rotate + (current.rotate - target.rotate) * k,
    x: target.x + (current.x - target.x) * k,
    y: target.y + (current.y - target.y) * k,
  };
  const settled =
    Math.abs(pose.rotate - target.rotate) < GAZE_EPSILON_DEG &&
    Math.hypot(pose.x - target.x, pose.y - target.y) < GAZE_EPSILON_PX;
  return settled ? { pose: { ...target }, settled } : { pose, settled };
}

/**
 * Tilt of the greeting (RF-26) `elapsedMs` after it starts: two swings that
 * fade out, straight at the start and at the end of its `durationMs`.
 */
export function greetSway(
  elapsedMs: number,
  durationMs: number = GREET_MS,
  maxDeg: number = GREET_SWAY_DEG,
): number {
  if (elapsedMs <= 0 || elapsedMs >= durationMs) return 0;
  const p = elapsedMs / durationMs;
  return maxDeg * Math.sin(4 * Math.PI * p) * (1 - p);
}

/** How long a bubble stays, in ms (2.0 to 2.8 s). */
export function bubbleMs(rng: Rng): number {
  return range(rng, BUBBLE_MS[0], BUBBLE_MS[1]);
}

/** Presses on Mac still inside the turbo window, and the last turbo. */
export type PressState = {
  presses: readonly number[];
  lastTurbo: number | null;
};

/**
 * A press on Mac at `now` (RF-29): whether it sets off turbo mode (isTurbo),
 * and the new state. The presses older than the window are dropped, and a
 * turbo starts the count again (and the cooldown).
 */
export function registerPress(
  state: PressState,
  now: number,
  windowMs: number = TURBO_WINDOW_MS,
): { turbo: boolean; state: PressState } {
  const presses = [...state.presses.filter((t) => now - t <= windowMs), now];
  if (isTurbo(presses, now, { windowMs, lastTurbo: state.lastTurbo })) {
    return { turbo: true, state: { presses: [], lastTurbo: now } };
  }
  return { turbo: false, state: { presses, lastTurbo: state.lastTurbo } };
}

/**
 * Particles of a burst (RF-28, RF-29): 12 to 20 on a press and BURST_TURBO in
 * turbo mode, never more than the `room` the class limit leaves.
 */
export function burstSize(
  kind: "click" | "turbo",
  room: number,
  rng: Rng,
): number {
  const free = Number.isFinite(room) ? Math.max(0, Math.floor(room)) : 0;
  const want =
    kind === "turbo"
      ? BURST_TURBO
      : Math.min(
          BURST_CLICK[1],
          Math.floor(range(rng, BURST_CLICK[0], BURST_CLICK[1] + 1)),
        );
  return Math.min(want, free);
}

/** Turbo mode's arc: how far across, how high and how much Mac turns. */
export type TurboSpan = { dx: number; lift: number; spin: number };

/**
 * The arc of turbo mode for a Mac centred at (x, y) whose turn fits in a
 * circle of `radius` (half his diagonal), in window px (RF-29): to the far
 * side of the window (where he is TURBO_MIN_SCALE of his size), up to
 * TURBO_LIFT_RATIO of its height without going above its top, `margin` from
 * every edge.
 */
export function turboSpan(
  mac: { x: number; y: number; radius: number },
  view: { width: number; height: number },
  margin: number = TURBO_MARGIN_PX,
): TurboSpan {
  const edge = margin + mac.radius * TURBO_MIN_SCALE;
  const goesLeft = mac.x > view.width / 2;
  const target =
    view.width < 2 * edge
      ? view.width / 2
      : goesLeft
        ? edge
        : view.width - edge;
  const dx = target - mac.x;
  const lift = Math.max(
    0,
    Math.min(TURBO_LIFT_RATIO * view.height, mac.y - margin - mac.radius),
  );
  return { dx, lift, spin: (dx < 0 ? -1 : 1) * TURBO_SPIN_DEG };
}

/** Highest point of sin(pi e) + sin(2 pi e) / 2 for e in [0, 1] (at 1/3). */
const ARC_PEAK = (3 * Math.sqrt(3)) / 4;

/**
 * Mac's offset (px), turn (deg) and size `elapsedMs` into turbo mode (RF-29):
 * out to `dx` high on the way out, back home lower, never below where he
 * started, smallest (TURBO_MIN_SCALE) on the far side, one whole turn away
 * from both ends (TURBO_SPIN_DELAY); at rest before it starts and once its
 * `durationMs` is over.
 */
export function turboArc(
  elapsedMs: number,
  span: TurboSpan,
  durationMs: number = TURBO_MS,
): Pose & { scale: number } {
  const p = elapsedMs / durationMs;
  if (!(p > 0 && p < 1)) return { rotate: 0, x: 0, y: 0, scale: 1 };
  // Eased in and out: smooth at both ends.
  const e = (1 - Math.cos(Math.PI * p)) / 2;
  const rise = Math.sin(Math.PI * e) + Math.sin(2 * Math.PI * e) / 2;
  // The turn, eased too, only away from both ends.
  const q = Math.min(
    1,
    Math.max(0, (e - TURBO_SPIN_DELAY) / (1 - 2 * TURBO_SPIN_DELAY)),
  );
  return {
    rotate: (span.spin * (1 - Math.cos(Math.PI * q))) / 2,
    x: (span.dx * (1 - Math.cos(2 * Math.PI * e))) / 2,
    y: (-span.lift * Math.max(0, rise)) / ARC_PEAK,
    scale: 1 - (1 - TURBO_MIN_SCALE) * Math.sin(Math.PI * e),
  };
}
