import { describe, expect, it } from "vitest";
import {
  pickTier,
  shouldDegrade,
  tierDown,
  type TierSignals,
} from "./device-tier";

const desktop: TierSignals = {
  reduced: false,
  saveData: false,
  memoryGb: 8,
  cores: 8,
  coarse: false,
  widthRem: 80,
};
const sig = (over: Partial<TierSignals>): TierSignals => ({
  ...desktop,
  ...over,
});

// Table of cases of RF-37.
describe("pickTier (RF-37)", () => {
  it.each([
    ["reduced motion", sig({ reduced: true }), "off"],
    [
      "reduced motion beats everything",
      sig({ reduced: true, saveData: true }),
      "off",
    ],
    ["data saver", sig({ saveData: true }), "low"],
    ["memory 2 GB", sig({ memoryGb: 2 }), "low"],
    ["memory 0.5 GB", sig({ memoryGb: 0.5 }), "low"],
    ["memory 4 GB, 8 cores", sig({ memoryGb: 4 }), "mid"],
    ["phone: touch under 48 rem", sig({ coarse: true, widthRem: 24 }), "low"],
    ["touch just under 48 rem", sig({ coarse: true, widthRem: 47.9 }), "low"],
    ["tablet: touch at 48 rem", sig({ coarse: true, widthRem: 48 }), "mid"],
    ["tablet: touch wider", sig({ coarse: true, widthRem: 64 }), "mid"],
    [
      "data saver on a tablet",
      sig({ coarse: true, widthRem: 64, saveData: true }),
      "low",
    ],
    ["desktop 16 cores", sig({ cores: 16 }), "high"],
    ["desktop 8 cores, memory 8", sig({ cores: 8, memoryGb: 8 }), "high"],
    [
      "desktop 8 cores, memory unknown",
      sig({ cores: 8, memoryGb: null }),
      "high",
    ],
    ["desktop 7 cores", sig({ cores: 7 }), "mid"],
    ["desktop 4 cores", sig({ cores: 4 }), "mid"],
    ["desktop 3 cores", sig({ cores: 3 }), "low"],
    ["desktop 1 core", sig({ cores: 1 }), "low"],
    [
      "fine pointer, no data at all",
      sig({ cores: null, memoryGb: null }),
      "mid",
    ],
    ["fine pointer, cores unknown, memory 8", sig({ cores: undefined }), "mid"],
  ] as const)("%s", (_name, signals, expected) => {
    expect(pickTier(signals)).toBe(expected);
  });
});

describe("tierDown (RF-38)", () => {
  it("goes down one tier at a time", () => {
    expect(tierDown("high")).toBe("mid");
    expect(tierDown("mid")).toBe("low");
  });

  it("never goes up and stays at the bottom", () => {
    expect(tierDown("low")).toBe("low");
    expect(tierDown("off")).toBe("off");
  });
});

describe("shouldDegrade (RF-38)", () => {
  const frames = (n: number, ms: number) => Array.from({ length: n }, () => ms);

  it("does not degrade with 44 frames, even if they are slow", () => {
    expect(shouldDegrade(frames(44, 20))).toBe(false);
  });

  it("degrades with 45 frames averaging over 12 ms", () => {
    expect(shouldDegrade(frames(45, 12.5))).toBe(true);
  });

  it("does not degrade when the mean is exactly at the limit", () => {
    expect(shouldDegrade(frames(45, 12))).toBe(false);
  });

  it("looks only at the last 45 frames", () => {
    expect(shouldDegrade([...frames(100, 1), ...frames(45, 20)])).toBe(true);
    expect(shouldDegrade([...frames(100, 50), ...frames(45, 2)])).toBe(false);
  });

  it("uses the mean, so a few spikes among fast frames do not trigger it", () => {
    expect(shouldDegrade([...frames(44, 2), 100])).toBe(false);
  });

  it("accepts another window and limit", () => {
    expect(shouldDegrade(frames(10, 5), 10, 4)).toBe(true);
    expect(shouldDegrade(frames(9, 5), 10, 4)).toBe(false);
  });
});
