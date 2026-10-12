import { describe, expect, it } from "vitest";
import { resolveActiveStop } from "./active-stop";

// RF-34: the active planet is the one holding the window's vertical centre.
const stops = [
  { top: 100, bottom: 300 },
  { top: 300, bottom: 500 },
  { top: 520, bottom: 700 }, // 20 px gap before this block
];

describe("resolveActiveStop", () => {
  it("returns -1 when there are no stops", () => {
    expect(resolveActiveStop(250, [])).toBe(-1);
  });

  it("picks the first stop before reaching it", () => {
    expect(resolveActiveStop(0, stops)).toBe(0);
    expect(resolveActiveStop(99.9, stops)).toBe(0);
  });

  it("picks the block that contains the marker", () => {
    expect(resolveActiveStop(100, stops)).toBe(0);
    expect(resolveActiveStop(250, stops)).toBe(0);
    expect(resolveActiveStop(300, stops)).toBe(1);
    expect(resolveActiveStop(650, stops)).toBe(2);
  });

  it("keeps the last reached stop inside a gap", () => {
    expect(resolveActiveStop(510, stops)).toBe(1);
  });

  it("picks the last stop at and after the end of the last block", () => {
    expect(resolveActiveStop(700, stops)).toBe(2);
    expect(resolveActiveStop(5000, stops)).toBe(2);
  });

  it("falls back to the first stop for NaN and infinities", () => {
    expect(resolveActiveStop(Number.NaN, stops)).toBe(0);
    expect(resolveActiveStop(Number.POSITIVE_INFINITY, stops)).toBe(0);
    expect(resolveActiveStop(Number.NEGATIVE_INFINITY, stops)).toBe(0);
  });

  it("works with a single stop", () => {
    expect(resolveActiveStop(-50, [{ top: 0, bottom: 10 }])).toBe(0);
    expect(resolveActiveStop(50, [{ top: 0, bottom: 10 }])).toBe(0);
  });
});
