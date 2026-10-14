import { describe, expect, it } from "vitest";
import {
  isBelowFold,
  revealDue,
  revealPlan,
  revealRootMargin,
} from "./reveal-plan";

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

// Spec 005, D19 (plan 14.1): without ScrollTrigger a hidden block is revealed
// when its top edge reaches the start line, or is already above it (a jump
// past the block never produces an intersection).
describe("revealDue", () => {
  it("is false while the top edge is below the line", () => {
    expect(revealDue(641, 800, 0.8)).toBe(false);
    expect(revealDue(5000, 800, 0.8)).toBe(false);
  });

  it("is true with the top edge on the line", () => {
    expect(revealDue(640, 800, 0.8)).toBe(true);
  });

  it("is true above the line, also after a jump past the block", () => {
    expect(revealDue(300, 800, 0.8)).toBe(true);
    expect(revealDue(-2400, 800, 0.8)).toBe(true);
  });

  it("is true for non-finite input (never leave content hidden)", () => {
    expect(revealDue(Number.NaN, 800, 0.8)).toBe(true);
    expect(revealDue(700, Number.NaN, 0.8)).toBe(true);
    expect(revealDue(700, 800, Number.POSITIVE_INFINITY)).toBe(true);
  });
});

describe("revealRootMargin", () => {
  it("moves the bottom edge of the observed area up to the line", () => {
    expect(revealRootMargin(0.8)).toBe("0px 0px -20% 0px");
    expect(revealRootMargin(0.5)).toBe("0px 0px -50% 0px");
  });

  it("uses the whole window when the line is at its bottom", () => {
    expect(revealRootMargin(1)).toBe("0px 0px 0% 0px");
  });
});
