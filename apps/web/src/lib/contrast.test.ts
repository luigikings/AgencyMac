import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./contrast";

// WCAG 2.1 relative luminance and contrast ratio (RF-18).
describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
  });

  it("ignores letter case", () => {
    expect(relativeLuminance("#ffc300")).toBe(relativeLuminance("#FFC300"));
  });

  it("weights green more than red and red more than blue", () => {
    expect(relativeLuminance("#00FF00")).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance("#FF0000")).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance("#0000FF")).toBeCloseTo(0.0722, 4);
  });

  it("uses the linear branch for very dark channels", () => {
    // 10/255 <= 0.03928, so the channel is divided by 12.92.
    expect(relativeLuminance("#0A0000")).toBeCloseTo(
      (0.2126 * (10 / 255)) / 12.92,
      8,
    );
  });

  it.each(["", "fff", "#fff", "#12345", "#GGGGGG", "red"])(
    "rejects %j",
    (value) => {
      expect(() => relativeLuminance(value)).toThrow(/hex/i);
    },
  );
});

describe("contrastRatio", () => {
  it("is 21 for black on white, in either order", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 10);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 10);
  });

  it("is 1 for the same colour", () => {
    expect(contrastRatio("#34006F", "#34006F")).toBe(1);
  });

  it("matches a known reference pair (#777777 on white is about 4.48)", () => {
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
});
