import { describe, expect, it } from "vitest";
import { mulberry32, pick, range } from "./rng";

describe("mulberry32", () => {
  it("gives the same sequence for the same seed", () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("gives different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it("stays in [0, 1) and is not constant", () => {
    const r = mulberry32(99);
    const values = Array.from({ length: 1000 }, () => r());
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(990);
  });

  it("has a known first value (guards against accidental changes)", () => {
    expect(mulberry32(1)()).toBeCloseTo(0.6270739405881613, 12);
  });
});

describe("range", () => {
  it("maps the generator into [min, max)", () => {
    expect(range(() => 0, 5, 9)).toBe(5);
    expect(range(() => 0.5, 5, 9)).toBe(7);
    expect(range(() => 0.999999, 5, 9)).toBeLessThan(9);
  });
});

describe("pick", () => {
  it("picks by the generator value", () => {
    const list = ["a", "b", "c", "d"];
    expect(pick(() => 0, list)).toBe("a");
    expect(pick(() => 0.26, list)).toBe("b");
    expect(pick(() => 0.999999, list)).toBe("d");
  });

  it("throws on an empty list", () => {
    expect(() => pick(() => 0.5, [])).toThrow();
  });
});
