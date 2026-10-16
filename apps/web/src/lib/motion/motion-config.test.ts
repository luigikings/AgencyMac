import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FINE_POINTER_QUERY,
  FOLD_MARGIN_PX,
  GESTURE_MS,
  GSAP_AUTO_SLEEP_FRAMES,
  LOAD_DELAY_MS,
  MARKER_RATIO,
  REVEAL_DURATION_S,
  REVEAL_OFFSET_PX,
  REVEAL_START_RATIO,
  SMOOTH_IDLE_FRAMES,
  TRAVELER_MIN_PX,
  TRAVELER_MOVE_S,
  TRAVELER_PLANET_ANCHOR,
  TRAVELER_SIZE_RATIO,
  WIDE_QUERY,
} from "./motion-config";

// The single source of the timing and position constants (plan D13b).
describe("motion-config", () => {
  it("fixes the values the spec and plan name", () => {
    expect(LOAD_DELAY_MS).toBe(1000);
    expect(GESTURE_MS).toBe(600);
    expect(MARKER_RATIO).toBe(0.5);
    expect(FOLD_MARGIN_PX).toBeGreaterThan(0);
  });

  it("defines the reveal of the service blocks", () => {
    expect(REVEAL_OFFSET_PX).toBeGreaterThan(0);
    expect(REVEAL_DURATION_S).toBeGreaterThan(0);
    // Spec 005, D19: the start line is a fraction of the window height (the
    // former ScrollTrigger syntax "top 80%" is gone).
    expect(REVEAL_START_RATIO).toBeGreaterThan(0);
    expect(REVEAL_START_RATIO).toBeLessThanOrEqual(1);
    expect(WIDE_QUERY).toBe("(min-width: 48rem)");
  });

  it("limits smooth scrolling to a fine pointer", () => {
    expect(FINE_POINTER_QUERY).toBe("(hover: hover) and (pointer: fine)");
  });

  it("stops the smooth scrolling loop after a few still frames", () => {
    expect(Number.isInteger(SMOOTH_IDLE_FRAMES)).toBe(true);
    expect(SMOOTH_IDLE_FRAMES).toBeGreaterThanOrEqual(1);
  });

  // RF-39: GSAP's ticker checks every GSAP_AUTO_SLEEP_FRAMES frames whether a
  // tween is left and sleeps if not, so its tail after the last tween is
  // counted in frames, not time: with a busy CPU (20 frames a second, seen in
  // the rest tests under load) 60 frames kept it awake for 3 s, inside the 2 s
  // the rest test counts. A few frames keep the tail under 0.5 s even then.
  it("lets GSAP's ticker sleep within 0.5 s of the last tween, even at 20 frames a second", () => {
    expect(Number.isInteger(GSAP_AUTO_SLEEP_FRAMES)).toBe(true);
    expect(GSAP_AUTO_SLEEP_FRAMES).toBeGreaterThanOrEqual(1);
    expect(GSAP_AUTO_SLEEP_FRAMES * (1000 / 20)).toBeLessThanOrEqual(500);
  });

  it("sizes and times the travelling Mac", () => {
    expect(TRAVELER_SIZE_RATIO).toBeGreaterThan(0);
    expect(TRAVELER_SIZE_RATIO).toBeLessThan(1);
    expect(TRAVELER_MIN_PX).toBeGreaterThan(0);
    expect(TRAVELER_MOVE_S).toBeGreaterThan(0);
  });

  it("anchors the traveller on the lower part of the planet", () => {
    expect(TRAVELER_PLANET_ANCHOR.y).toBe(0.8);
    expect(TRAVELER_PLANET_ANCHOR.left).toBe(0.18);
    expect(TRAVELER_PLANET_ANCHOR.right).toBe(0.82);
  });
});

// Pure logic: no DOM, no GSAP, no clock (T17).
describe("motion modules are pure", () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const sources = readdirSync(dir).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );

  it("finds the five modules", () => {
    expect(sources.sort()).toEqual([
      "active-stop.ts",
      "motion-config.ts",
      "reveal-plan.ts",
      "smooth-loop.ts",
      "traveler.ts",
    ]);
  });

  it.each(sources)("%s imports no GSAP and touches no DOM or clock", (file) => {
    const code = readFileSync(`${dir}${file}`, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/from\s+["'](gsap|lenis)/);
    expect(code).not.toMatch(
      /\b(window|document|navigator|Date\.now|new Date|performance\.now|requestAnimationFrame|setTimeout)\b/,
    );
  });
});
