import { describe, expect, it } from "vitest";
import {
  AMBIENTS,
  SKY_MAX_LUMINANCE,
  ambientPeak,
  glowAlphaCap,
} from "../lib/sky/ambients";
import { contrastRatio, relativeLuminance } from "../lib/contrast";
import { colors } from "./tokens";

// RF-8, RNF-12: the strongest point of every ambient (glow and dust stacked
// at full strength over the solid base) keeps every text colour readable.
// Text colours that can sit directly on the sky.
const TEXT_COLORS = ["text", "accentGreen", "buttonHover"] as const;
const MIN_RATIO = 4.5;

// Starting alphas of the plan (section 6). The test may only lower them.
const PLAN_TOP = {
  hero: { glow: 0.22, dust: 0.12 },
  hexaweb: { glow: 0.3, dust: 0.06 },
  rankia: { glow: 0.3, dust: 0.08 },
  adara: { glow: 0.28, dust: 0.1 },
  projects: { glow: 0.22, dust: 0.1 },
  team: { glow: 0.2, dust: 0.12 },
  contact: { glow: 0.22, dust: 0.1 },
} as const;

describe.each(AMBIENTS)("ambient $id", (ambient) => {
  const hex = (name: keyof typeof colors) => colors[name].value;

  it("never exceeds the plan's starting alphas", () => {
    expect(ambient.glowAlpha).toBeLessThanOrEqual(PLAN_TOP[ambient.id].glow);
    expect(ambient.dustAlpha).toBeLessThanOrEqual(PLAN_TOP[ambient.id].dust);
  });

  it("keeps the glow alpha under its cap for the worst text of the zone", () => {
    const cap = Math.min(
      ...TEXT_COLORS.map((text) =>
        glowAlphaCap(
          hex(ambient.base),
          hex(ambient.glow),
          hex(text),
          MIN_RATIO,
        ),
      ),
    );
    expect(
      ambient.glowAlpha,
      `${ambient.id}: glow alpha ${ambient.glowAlpha} > cap ${cap.toFixed(3)}`,
    ).toBeLessThanOrEqual(cap);
  });

  it(`stays at or under SKY_MAX_LUMINANCE (${SKY_MAX_LUMINANCE}) at its peak`, () => {
    const peak = ambientPeak(ambient);
    expect(
      relativeLuminance(peak),
      `${ambient.id}: peak ${peak}`,
    ).toBeLessThanOrEqual(SKY_MAX_LUMINANCE);
  });

  it.each(TEXT_COLORS)("keeps %s at 4.5:1 on the peak", (text) => {
    expect(
      contrastRatio(hex(text), ambientPeak(ambient)),
    ).toBeGreaterThanOrEqual(MIN_RATIO);
  });
});
