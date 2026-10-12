import { describe, expect, it } from "vitest";
import {
  STOPS,
  journeyProgress,
  stopProgresses,
  visitedStops,
} from "./journey";

describe("STOPS (RF-30)", () => {
  it("has the 5 sections in page order", () => {
    expect(STOPS).toEqual(["hero", "services", "projects", "team", "contact"]);
  });
});

describe("journeyProgress", () => {
  it("is 0 at the top and 1 at the bottom", () => {
    expect(journeyProgress(0, 3000, 800)).toBe(0);
    expect(journeyProgress(2200, 3000, 800)).toBe(1);
  });

  it("is proportional in between", () => {
    expect(journeyProgress(1100, 3000, 800)).toBe(0.5);
  });

  it("clamps overscroll (elastic scrolling on phones)", () => {
    expect(journeyProgress(-60, 3000, 800)).toBe(0);
    expect(journeyProgress(2400, 3000, 800)).toBe(1);
  });

  it("is 0 when the document is not taller than the window", () => {
    expect(journeyProgress(0, 700, 800)).toBe(0);
    expect(journeyProgress(50, 800, 800)).toBe(0);
  });

  it("is 0 for non-finite input", () => {
    expect(journeyProgress(Number.NaN, 3000, 800)).toBe(0);
    expect(journeyProgress(10, Number.NaN, 800)).toBe(0);
  });
});

describe("stopProgresses", () => {
  it("converts section tops into progress values", () => {
    expect(stopProgresses([0, 1100, 2200], 3000, 800)).toEqual([0, 0.5, 1]);
  });

  it("clamps tops that cannot be reached by scrolling", () => {
    expect(stopProgresses([0, 2800], 3000, 800)).toEqual([0, 1]);
  });
});

describe("visitedStops", () => {
  const stops = [0, 0.25, 0.5, 0.75, 1];

  it("visits only the first stop at the top", () => {
    expect(visitedStops(0, stops)).toEqual([true, false, false, false, false]);
  });

  it("lights every stop already passed, including the one reached", () => {
    expect(visitedStops(0.5, stops)).toEqual([true, true, true, false, false]);
    expect(visitedStops(0.49, stops)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it("visits all of them at the end", () => {
    expect(visitedStops(1, stops)).toEqual([true, true, true, true, true]);
  });

  it("visits all of them on a short document, where every stop is at 0", () => {
    expect(visitedStops(0, [0, 0, 0, 0, 0])).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});
