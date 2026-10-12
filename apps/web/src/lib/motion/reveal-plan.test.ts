import { describe, expect, it } from "vitest";
import { isBelowFold, revealPlan } from "./reveal-plan";

// RF-35: image and text enter from opposite sides, alternating per planet; on
// one column they enter from below.
describe("revealPlan", () => {
  it("uses one column: everything comes from below", () => {
    for (const i of [0, 1, 2, 3]) {
      expect(revealPlan(i, 1)).toEqual({ image: "bottom", text: "bottom" });
    }
  });

  it("treats zero or negative columns as one", () => {
    expect(revealPlan(0, 0)).toEqual({ image: "bottom", text: "bottom" });
    expect(revealPlan(1, -2)).toEqual({ image: "bottom", text: "bottom" });
  });

  it("uses two columns: opposite sides, alternating", () => {
    expect(revealPlan(0, 2)).toEqual({ image: "left", text: "right" });
    expect(revealPlan(1, 2)).toEqual({ image: "right", text: "left" });
    expect(revealPlan(2, 2)).toEqual({ image: "left", text: "right" });
  });

  it("never puts image and text on the same side with two columns", () => {
    for (let i = 0; i < 6; i++) {
      const p = revealPlan(i, 2);
      expect(p.image).not.toBe(p.text);
    }
  });
});

describe("isBelowFold", () => {
  it("is false for blocks already visible", () => {
    expect(isBelowFold(0, 800, 100)).toBe(false);
    expect(isBelowFold(700, 800, 100)).toBe(false);
  });

  it("is false exactly at viewport + margin", () => {
    expect(isBelowFold(900, 800, 100)).toBe(false);
  });

  it("is true past viewport + margin", () => {
    expect(isBelowFold(900.5, 800, 100)).toBe(true);
    expect(isBelowFold(5000, 800, 100)).toBe(true);
  });

  it("is false for non-finite input (leave content visible)", () => {
    expect(isBelowFold(Number.NaN, 800, 100)).toBe(false);
    expect(isBelowFold(1000, Number.NaN, 100)).toBe(false);
  });
});
