// Constellation emblem of each team member (spec 005, RF-34, plan D18). The
// seed is the person's name, so the emblem is unique, always the same and
// holds no personal data. Pure: no random, no DOM.

import { mulberry32, range } from "./rng";

export type Star = { x: number; y: number };
export type Constellation = {
  /** 5 to 8 stars in the unit square. */
  stars: Star[];
  /** Pairs of star indices joined by a line. */
  edges: [number, number][];
};

/** FNV-1a hash of the normalised name. */
function seedOf(name: string): number {
  let hash = 0x811c9dc5;
  for (const ch of name.trim().toLowerCase()) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Side of the emblem in each team card, in SVG units (px) (T29). */
export const EMBLEM_SIZE = 56;

const MARGIN = 0.08;
const START_MIN_DISTANCE = 0.22;
const FLOOR_MIN_DISTANCE = 0.12;

function cross(a: Star, b: Star, c: Star): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * True when the segments ab and cd cross at a point inside both (touching at
 * an end, or running apart, is not crossing).
 */
export function edgesCross(a: Star, b: Star, c: Star, d: Star): boolean {
  const o1 = cross(a, b, c);
  const o2 = cross(a, b, d);
  const o3 = cross(c, d, a);
  const o4 = cross(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function placeStars(count: number, rng: () => number): Star[] {
  const stars: Star[] = [];
  let minDistance = START_MIN_DISTANCE;
  while (stars.length < count) {
    let placed = false;
    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      const candidate = {
        x: range(rng, MARGIN, 1 - MARGIN),
        y: range(rng, MARGIN, 1 - MARGIN),
      };
      if (
        stars.every(
          (s) =>
            Math.hypot(s.x - candidate.x, s.y - candidate.y) >= minDistance,
        )
      ) {
        stars.push(candidate);
        placed = true;
      }
    }
    // Too crowded: relax the distance a little (never below the floor).
    if (!placed) minDistance = Math.max(FLOOR_MIN_DISTANCE, minDistance * 0.9);
  }
  return stars;
}

/** The emblem of `name`: 5 to 8 stars joined by lines that never cross. */
export function constellationOf(name: string): Constellation {
  const rng = mulberry32(seedOf(name));
  const count = 5 + Math.floor(rng() * 4);
  // A chain through the stars ordered left to right cannot cross itself.
  const stars = placeStars(count, rng).sort((a, b) => a.x - b.x || a.y - b.y);
  const edges: [number, number][] = [];
  for (let i = 0; i < count - 1; i++) edges.push([i, i + 1]);
  // Up to two extra lines (triangles) for a constellation look, if they fit.
  let extras = 0;
  for (let i = 0; i < count - 2 && extras < 2; i++) {
    if (rng() >= 0.6) continue;
    const a = stars[i]!;
    const b = stars[i + 2]!;
    const clashes = edges.some(([e, f]) => {
      if (e === i || e === i + 2 || f === i || f === i + 2) return false;
      return edgesCross(a, b, stars[e]!, stars[f]!);
    });
    if (!clashes) {
      edges.push([i, i + 2]);
      extras++;
    }
  }
  return { stars, edges };
}

const fmt = (value: number): string => String(Number(value.toFixed(2)));

/** `d` attribute of an SVG path with one segment per edge, scaled to `size`. */
export function constellationPath(c: Constellation, size: number): string {
  return c.edges
    .map(([a, b]) => {
      const p = c.stars[a]!;
      const q = c.stars[b]!;
      return `M${fmt(p.x * size)} ${fmt(p.y * size)}L${fmt(q.x * size)} ${fmt(q.y * size)}`;
    })
    .join("");
}
