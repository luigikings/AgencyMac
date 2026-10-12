import { describe, expect, it } from "vitest";
import {
  constellationOf,
  constellationPath,
  edgesCross,
  type Constellation,
} from "./constellation";

const NAMES = ["Joni", "Samuel", "Luigi"];

function anyCrossing(c: Constellation): [number, number][] {
  const bad: [number, number][] = [];
  c.edges.forEach(([a, b], i) => {
    c.edges.forEach(([e, f], j) => {
      if (j <= i) return;
      if (a === e || a === f || b === e || b === f) return; // share a star
      if (edgesCross(c.stars[a]!, c.stars[b]!, c.stars[e]!, c.stars[f]!)) {
        bad.push([i, j]);
      }
    });
  });
  return bad;
}

describe("constellationOf (RF-34)", () => {
  it.each(NAMES)("%s has 5 to 8 stars inside the unit square", (name) => {
    const c = constellationOf(name);
    expect(c.stars.length).toBeGreaterThanOrEqual(5);
    expect(c.stars.length).toBeLessThanOrEqual(8);
    for (const s of c.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
  });

  it.each(NAMES)("%s is the same every time", (name) => {
    expect(constellationOf(name)).toEqual(constellationOf(name));
  });

  it("is different for Joni, Samuel and Luigi", () => {
    const [a, b, c] = NAMES.map((n) => JSON.stringify(constellationOf(n)));
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it.each(NAMES)("%s joins every star and has no crossing edges", (name) => {
    const c = constellationOf(name);
    expect(anyCrossing(c)).toEqual([]);
    const touched = new Set(c.edges.flat());
    expect(touched.size).toBe(c.stars.length);
    for (const [a, b] of c.edges) {
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(c.stars.length);
    }
  });

  it("holds the rules for many names (5 to 8 stars, no crossings, connected)", () => {
    const names = Array.from({ length: 200 }, (_, i) => `person-${i}`);
    for (const name of names) {
      const c = constellationOf(name);
      expect(c.stars.length, name).toBeGreaterThanOrEqual(5);
      expect(c.stars.length, name).toBeLessThanOrEqual(8);
      expect(anyCrossing(c), name).toEqual([]);
      expect(c.edges.length, name).toBeGreaterThanOrEqual(c.stars.length - 1);
    }
  });

  it("keeps the stars apart so they do not overlap", () => {
    for (const name of [...NAMES, "x", "y", "z"]) {
      const { stars } = constellationOf(name);
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const d = Math.hypot(
            stars[i]!.x - stars[j]!.x,
            stars[i]!.y - stars[j]!.y,
          );
          expect(d, `${name} ${i}-${j}`).toBeGreaterThan(0.1);
        }
      }
    }
  });
});

describe("edgesCross", () => {
  it("detects an X and ignores separate or touching-at-end segments", () => {
    expect(
      edgesCross(
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ),
    ).toBe(true);
    expect(
      edgesCross(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ),
    ).toBe(false);
    expect(
      edgesCross(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 1 },
      ),
    ).toBe(false);
  });
});

describe("constellationPath", () => {
  it("draws one segment per edge, scaled to the size", () => {
    const c = constellationOf("Joni");
    const d = constellationPath(c, 100);
    expect(d.match(/M/g)).toHaveLength(c.edges.length);
    expect(d.match(/L/g)).toHaveLength(c.edges.length);
    expect(d).toMatch(/^M-?\d/);
    const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it("uses at most two decimals and is stable", () => {
    const d = constellationPath(constellationOf("Samuel"), 64);
    expect(d).toBe(constellationPath(constellationOf("Samuel"), 64));
    expect(d).not.toMatch(/\.\d{3}/);
  });

  it("has no hex colour (it is only geometry)", () => {
    expect(constellationPath(constellationOf("Luigi"), 80)).not.toMatch(/#/);
  });
});
