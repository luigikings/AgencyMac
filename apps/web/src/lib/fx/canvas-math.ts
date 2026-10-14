// Maths of the effects canvas and of the shooting stars (spec 005, RF-4,
// RF-39, RNF-8). Pure functions: the generator is passed in; no DOM, no date.

import { range, type Rng } from "../sky/rng";
import {
  MAX_CANVAS_PIXELS,
  SHOOTING_STAR_ANGLE_DEG,
  SHOOTING_STAR_TAIL_PX,
  SHOOTING_STAR_TRAVEL_PX,
} from "./fx-config";

export type CanvasSize = { width: number; height: number; density: number };

/**
 * Internal size of a canvas that covers `cssWidth` x `cssHeight` CSS px: the
 * device pixel ratio, capped at the density of the tier and then at
 * MAX_CANVAS_PIXELS (keeping the aspect ratio). Never under 1 x 1.
 */
export function canvasSize(
  cssWidth: number,
  cssHeight: number,
  deviceRatio: number,
  maxDensity: number,
): CanvasSize {
  const w = Math.max(0, cssWidth || 0);
  const h = Math.max(0, cssHeight || 0);
  const ratio =
    Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  let density = Math.min(ratio, maxDensity > 0 ? maxDensity : 1);
  if (w * h * density * density > MAX_CANVAS_PIXELS) {
    density = Math.sqrt(MAX_CANVAS_PIXELS / (w * h));
  }
  return {
    width: Math.max(1, Math.floor(w * density)),
    height: Math.max(1, Math.floor(h * density)),
    density: w > 0 && h > 0 ? density : 1,
  };
}

export type FrameStats = { frames: number; avg: number; p95: number };

/** Mean and 95th percentile (nearest rank) of the frame costs, in ms. */
export function frameStats(costs: readonly number[]): FrameStats {
  if (costs.length === 0) return { frames: 0, avg: 0, p95: 0 };
  const sorted = [...costs].sort((a, b) => a - b);
  const sum = sorted.reduce((total, cost) => total + cost, 0);
  const rank = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return { frames: costs.length, avg: sum / costs.length, p95: sorted[rank]! };
}

/** Run of one shooting star: start, unit direction, run and tail, in CSS px. */
export type ShootingStarPath = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  travel: number;
  tail: number;
};

/**
 * A shooting star that starts in the upper half of the view and falls at a
 * gentle angle towards the middle (to the left from the right half, to the
 * right from the left half).
 */
export function shootingStarPath(
  rng: Rng,
  view: { width: number; height: number },
): ShootingStarPath {
  const x = range(rng, 0, view.width);
  const y = range(rng, 0, view.height / 2);
  const side = x >= view.width / 2 ? -1 : 1;
  const angle =
    (range(rng, SHOOTING_STAR_ANGLE_DEG[0], SHOOTING_STAR_ANGLE_DEG[1]) *
      Math.PI) /
    180;
  return {
    x,
    y,
    dx: side * Math.cos(angle),
    dy: Math.sin(angle),
    travel: range(rng, SHOOTING_STAR_TRAVEL_PX[0], SHOOTING_STAR_TRAVEL_PX[1]),
    tail: range(rng, SHOOTING_STAR_TAIL_PX[0], SHOOTING_STAR_TAIL_PX[1]),
  };
}

export type ShootingStarFrame = {
  headX: number;
  headY: number;
  tailX: number;
  tailY: number;
  alpha: number;
};

/**
 * Where a shooting star is `elapsed` ms after it started: the head moves
 * along the run, the tail follows (never behind the start) and the star fades
 * in and out.
 */
export function shootingStarFrame(
  path: ShootingStarPath,
  elapsed: number,
  duration: number,
): ShootingStarFrame {
  const t = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1;
  const run = path.travel * t;
  const tail = Math.min(path.tail, run);
  const headX = path.x + path.dx * run;
  const headY = path.y + path.dy * run;
  return {
    headX,
    headY,
    tailX: headX - path.dx * tail,
    tailY: headY - path.dy * tail,
    alpha: Math.sin(Math.PI * t),
  };
}

/**
 * `rgba(...)` text of a colour as the canvas normalises it (6-digit hex or
 * `rgb`/`rgba`), with the given alpha. The colours come from the CSS tokens
 * at run time; null when the text cannot be read.
 */
export function rgbaOf(color: string, alpha: number): string | null {
  const a = Math.min(1, Math.max(0, alpha));
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  if (hex) {
    const [r, g, b] = hex.slice(1).map((part) => parseInt(part, 16));
    return `rgba(${r},${g},${b},${a})`;
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color.trim());
  return rgb ? `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${a})` : null;
}
