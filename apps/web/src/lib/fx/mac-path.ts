// Mac's curved flight between planets (spec 005, RF-21, RF-22, plan D6): a
// cubic Bezier computed here instead of a GSAP plugin, so it can be tested.
// Pure: no DOM, no GSAP, no date.

import {
  MAC_BEND_RATIO,
  MAC_FLIGHT_BASE_MS,
  MAC_FLIGHT_MS,
  MAC_FLIGHT_MS_PER_PX,
  MAC_MAX_TILT_DEG,
  MAC_MIN_BEND_PX,
  MAC_TILT_BLEND,
} from "./fx-config";

export type Point = { x: number; y: number };
export type Curve = { p0: Point; p1: Point; p2: Point; p3: Point };

/**
 * A soft S-shaped curve from `from` to `to`. `side` (1 or -1) picks which
 * side of the straight line it bends towards (towards the text). It strays
 * about 15 % of the distance from the line (RF-21 asks for at least 12 %).
 */
export function curveBetween(from: Point, to: Point, side: 1 | -1): Curve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  // Unit normal; any direction when the two points coincide.
  const nx = d > 0 ? (-dy / d) * side : 0;
  const ny = d > 0 ? (dx / d) * side : 0;
  const bend = Math.max(MAC_BEND_RATIO * d, d > 0 ? MAC_MIN_BEND_PX : 0);
  return {
    p0: from,
    p1: {
      x: from.x + dx * 0.25 + nx * bend * 1.3,
      y: from.y + dy * 0.25 + ny * bend * 1.3,
    },
    p2: {
      x: from.x + dx * 0.75 - nx * bend * 0.4,
      y: from.y + dy * 0.75 - ny * bend * 0.4,
    },
    p3: to,
  };
}

/** Point of the curve at t in 0..1. */
export function pointAt(c: Curve, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const e = 3 * u * t * t;
  const f = t * t * t;
  return {
    x: a * c.p0.x + b * c.p1.x + e * c.p2.x + f * c.p3.x,
    y: a * c.p0.y + b * c.p1.y + e * c.p2.y + f * c.p3.y,
  };
}

/** Direction of travel at t, in degrees (0 = right, 90 = down, screen axes). */
export function angleAt(c: Curve, t: number): number {
  const u = 1 - t;
  let dx =
    3 * u * u * (c.p1.x - c.p0.x) +
    6 * u * t * (c.p2.x - c.p1.x) +
    3 * t * t * (c.p3.x - c.p2.x);
  let dy =
    3 * u * u * (c.p1.y - c.p0.y) +
    6 * u * t * (c.p2.y - c.p1.y) +
    3 * t * t * (c.p3.y - c.p2.y);
  if (dx === 0 && dy === 0) {
    dx = c.p3.x - c.p0.x;
    dy = c.p3.y - c.p0.y;
  }
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Tilt of Mac in degrees for a direction of travel: he leans towards the
 * horizontal direction of the flight, at most MAC_MAX_TILT_DEG either way
 * (RF-22). Straight up or down: no tilt.
 */
export function tiltFor(angleDeg: number): number {
  const tilt = Math.cos((angleDeg * Math.PI) / 180) * MAC_MAX_TILT_DEG;
  return Math.max(-MAC_MAX_TILT_DEG, Math.min(MAC_MAX_TILT_DEG, tilt));
}

/** Duration of a flight of `distance` px: 700 to 1600 ms, growing with it. */
export function flightMs(distance: number): number {
  const ms = MAC_FLIGHT_BASE_MS + Math.max(0, distance) * MAC_FLIGHT_MS_PER_PX;
  return Math.min(MAC_FLIGHT_MS[1], Math.max(MAC_FLIGHT_MS[0], ms));
}

/** Largest distance between the curve and the straight line p0-p3, in px. */
export function maxDeviation(c: Curve): number {
  const dx = c.p3.x - c.p0.x;
  const dy = c.p3.y - c.p0.y;
  const d = Math.hypot(dx, dy);
  let max = 0;
  for (let i = 0; i <= 100; i++) {
    const p = pointAt(c, i / 100);
    const off =
      d > 0
        ? Math.abs(dx * (p.y - c.p0.y) - dy * (p.x - c.p0.x)) / d
        : Math.hypot(p.x - c.p0.x, p.y - c.p0.y);
    if (off > max) max = off;
  }
  return max;
}

/**
 * New curve from where Mac is now to a new target (the visitor changed
 * planet mid-flight): it starts exactly at `current`, so there is no jump.
 */
export function retarget(current: Point, to: Point, side: 1 | -1): Curve {
  return curveBetween(current, to, side);
}

/**
 * Side a flight from `from` to `to` bends to (spec 005, T19). A mostly
 * vertical flight (from planet to planet down or up the page) bends towards
 * the horizontal centre of its container `centreX`, so Mac stays on screen
 * even at 320 px; a mostly horizontal one hops upwards.
 */
export function bendSide(from: Point, to: Point, centreX: number): 1 | -1 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    // x of the normal for side 1 is -dy / d: its sign must match the centre's.
    const towards = centreX - (from.x + to.x) / 2;
    return -dy * towards < 0 ? -1 : 1;
  }
  // y of the normal for side 1 is dx / d: up (negative y) when dx < 0.
  return dx > 0 ? -1 : 1;
}

/**
 * Tilt of Mac at progress t of a flight along `c` (RF-22) that started with
 * tilt `startTilt`: over the first MAC_TILT_BLEND of the flight it moves
 * smoothly from that tilt to the one of the direction of travel.
 */
export function flightTilt(c: Curve, t: number, startTilt: number): number {
  const target = tiltFor(angleAt(c, t));
  const k = Math.min(1, Math.max(0, t / MAC_TILT_BLEND));
  const blend = k * k * (3 - 2 * k);
  const tilt = startTilt + (target - startTilt) * blend;
  return Math.max(-MAC_MAX_TILT_DEG, Math.min(MAC_MAX_TILT_DEG, tilt));
}

/**
 * Point `distance` px behind `centre` when flying towards `headingDeg`
 * (screen axes): where Mac's trail comes out (RF-23).
 */
export function rearOf(
  centre: Point,
  headingDeg: number,
  distance: number,
): Point {
  if (distance === 0) return { ...centre };
  const rad = (headingDeg * Math.PI) / 180;
  return {
    x: centre.x - Math.cos(rad) * distance,
    y: centre.y - Math.sin(rad) * distance,
  };
}
