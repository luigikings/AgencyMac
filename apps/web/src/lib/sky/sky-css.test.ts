import { describe, expect, it } from "vitest";
import { findHexColors } from "../hex-colors";
import {
  findHidingRules,
  findUnguardedKeyframes,
  findUnguardedMotion,
} from "../../styles/motion-css";
import { STAR_LAYERS } from "./star-field";
import { skyStarsCss } from "./sky-css";

describe("skyStarsCss (RF-1, RF-3, RF-9)", () => {
  const css = skyStarsCss();

  it("is the same text on every call (fixed seed)", () => {
    expect(skyStarsCss()).toBe(css);
  });

  it("has no hex colour, only token variables", () => {
    expect(findHexColors(css)).toEqual([]);
    expect(css).toMatch(/var\(--color-/);
  });

  it("gives each layer its desktop list and, below 48 rem, its short list", () => {
    for (const layer of STAR_LAYERS) {
      const rule = new RegExp(
        `\\.sky__layer--${layer.id}\\{[^}]*box-shadow:([^;}]+)`,
      ).exec(css);
      expect(rule, layer.id).not.toBeNull();
      expect(rule![1]!.split(",")).toHaveLength(layer.desktopCount);
      const narrow = new RegExp(
        `@media\\s*\\(max-width:\\s*47\\.99rem\\)\\s*\\{[^@]*\\.sky__layer--${layer.id}\\{[^}]*box-shadow:([^;}]+)`,
      ).exec(css);
      expect(narrow, `${layer.id} narrow`).not.toBeNull();
      expect(narrow![1]!.split(",")).toHaveLength(layer.mobileCount);
    }
  });

  it("offsets each layer up by its parallax overscan", () => {
    for (const layer of STAR_LAYERS) {
      expect(css).toContain(`top:-${layer.parallaxVh}vh`);
    }
  });

  it("twinkles with a different duration per layer, only under no-preference", () => {
    expect(findUnguardedMotion(css)).toEqual([]);
    expect(findUnguardedKeyframes(css)).toEqual([]);
    expect(findHidingRules(css)).toEqual([]);
    for (const layer of STAR_LAYERS) {
      expect(css).toContain(`animation-duration:${layer.twinkleS}s`);
    }
  });

  it("is small enough to ship inline (under 20 KB of text)", () => {
    expect(css.length).toBeLessThan(20_000);
  });
});
