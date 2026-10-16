// Mac's speech bubbles (spec 005, RF-24, RF-27, RNF-11): which line to say
// and where to put the bubble. Pure: no DOM, no date; the generator and the
// boxes (CSS px, window coordinates) are passed in.

import {
  BUBBLE_GAP_PX,
  BUBBLE_MARGIN_PX,
  BUBBLE_TAIL_REACH_PX,
  BUBBLE_TEXT_GAP_PX,
} from "./fx-config";
import { pickLine } from "./mac-reactions";
import type { Rng } from "../sky/rng";

export type Box = { left: number; top: number; width: number; height: number };
export type Side = "above" | "below" | "left" | "right";

/**
 * Next line (a translation key) among `candidates`, never `last` again
 * (RF-27: no line twice in a row). Null when there is nothing else to say.
 */
export function nextLine(
  candidates: readonly string[],
  last: string | null,
  rng: Rng,
): string | null {
  const options = candidates.filter((key) => key !== last);
  const index = pickLine(options, -1, rng);
  return index < 0 ? null : options[index]!;
}

/** Do two boxes share some area (touching edges do not count)? */
export function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/** Area two boxes share (0 when they only touch or are apart). */
export function overlapArea(a: Box, b: Box): number {
  const w =
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h =
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function finite(box: Box): boolean {
  return [box.left, box.top, box.width, box.height].every(Number.isFinite);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function grow(box: Box, by: number): Box {
  return {
    left: box.left - by,
    top: box.top - by,
    width: box.width + 2 * by,
    height: box.height + 2 * by,
  };
}

/**
 * Where the bubble goes next to Mac (`anchor`), and how much text it covers
 * (`overlap`, px², 0 when clear).
 *
 * The places, in order of preference: above him, centred; below; to his left;
 * to his right; then each side again slid along it (to one end and to the
 * other), as far as his centre stays BUBBLE_TAIL_REACH_PX inside the bubble's
 * edge, so its tail still points at him. The first place that covers no text
 * of `texts` (kept BUBBLE_TEXT_GAP_PX away) wins; if every place covers some,
 * the one that covers least (T23: the caller may then try a narrower bubble).
 *
 * Every place stays BUBBLE_MARGIN_PX inside the window (no overflow at 320
 * px, RNF-11) and BUBBLE_GAP_PX away from Mac and from every box in `avoid`
 * (the main buttons, which it never covers). Null when no place does: then
 * there is no bubble.
 */
export function placeBubble(options: {
  anchor: Box;
  size: { width: number; height: number };
  view: { width: number; height: number };
  avoid: readonly Box[];
  texts?: readonly Box[];
  gap?: number;
  margin?: number;
}): { x: number; y: number; side: Side; overlap: number } | null {
  const {
    anchor,
    size,
    view,
    avoid,
    texts = [],
    gap = BUBBLE_GAP_PX,
    margin = BUBBLE_MARGIN_PX,
  } = options;
  const { width: w, height: h } = size;
  if (
    !finite(anchor) ||
    ![w, h, view.width, view.height].every(Number.isFinite)
  ) {
    return null;
  }
  const minX = margin;
  const maxX = view.width - margin - w;
  const minY = margin;
  const maxY = view.height - margin - h;
  if (maxX < minX || maxY < minY) return null;

  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;
  const right = anchor.left + anchor.width;
  const bottom = anchor.top + anchor.height;
  const reach = BUBBLE_TAIL_REACH_PX;
  const sides: { side: Side; x: number; y: number }[] = [
    { side: "above", x: cx - w / 2, y: anchor.top - gap - h },
    { side: "below", x: cx - w / 2, y: bottom + gap },
    { side: "left", x: anchor.left - gap - w, y: cy - h / 2 },
    { side: "right", x: right + gap, y: cy - h / 2 },
  ];
  const vertical = (side: Side) => side === "above" || side === "below";
  // Centred first, then slid to each end along the same side.
  const tries = [
    ...sides,
    ...sides.flatMap((t) =>
      vertical(t.side)
        ? [
            { ...t, x: cx - reach },
            { ...t, x: cx - w + reach },
          ]
        : [
            { ...t, y: cy - reach },
            { ...t, y: cy - h + reach },
          ],
    ),
  ];
  const near = texts.filter(finite).map((t) => grow(t, BUBBLE_TEXT_GAP_PX));
  let best: { x: number; y: number; side: Side; overlap: number } | null = null;
  for (const { side, x, y } of tries) {
    // The side must have room as it is; only the other axis slides in.
    if (vertical(side) && (y < minY || y > maxY)) continue;
    if (!vertical(side) && (x < minX || x > maxX)) continue;
    const place = {
      side,
      x: vertical(side) ? clamp(x, minX, maxX) : x,
      y: vertical(side) ? y : clamp(y, minY, maxY),
    };
    const box: Box = { left: place.x, top: place.y, width: w, height: h };
    if (avoid.some((b) => finite(b) && overlaps(grow(box, gap), b))) continue;
    const overlap = near.reduce((sum, t) => sum + overlapArea(box, t), 0);
    if (!best || overlap < best.overlap) best = { ...place, overlap };
    if (overlap === 0) break;
  }
  return best;
}
