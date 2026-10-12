// Parallax of the sky and of the planets (spec 005, RF-2, RF-13). Pure maths:
// the browser code only applies the result as a `transform`.

import { POINTER_REST_TAU_MS } from "../fx/fx-config";

export type Point = { x: number; y: number };
export type Box = { left: number; top: number; width: number; height: number };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Offset in vh of a star layer for the page progress (0 at the top, 1 at the
 * end). Centred: over the whole page the layer travels `rangeVh` (RF-2: 4, 8
 * or 16 vh), from -range/2 to +range/2.
 */
export function scrollParallax(progress: number, rangeVh: number): number {
  const p = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
  return (p - 0.5) * rangeVh;
}

/**
 * Offset in px of an element for the cursor position (RF-13). It moves against
 * the cursor, up to `maxPx * depth` at the edge of the box; `depth` goes from
 * 0 (far) to 1 (near).
 */
export function pointerParallax(
  cursor: Point,
  box: Box,
  depth: number,
  maxPx: number,
): Point {
  const nx = normalised(cursor.x - (box.left + box.width / 2), box.width / 2);
  const ny = normalised(cursor.y - (box.top + box.height / 2), box.height / 2);
  return { x: -nx * maxPx * depth, y: -ny * maxPx * depth };
}

function normalised(delta: number, half: number): number {
  if (half <= 0) return 0;
  return clamp(delta / half, -1, 1);
}

/**
 * Eases an offset back to rest after `dtMs` milliseconds: exponential decay,
 * independent of how the time is sliced, back within half a pixel in under 1 s
 * from 14 px (RF-13).
 */
export function easeToRest(current: Point, dtMs: number): Point {
  const k = Math.exp(-Math.max(0, dtMs) / POINTER_REST_TAU_MS);
  return { x: current.x * k, y: current.y * k };
}
