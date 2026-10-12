import { describe, expect, it } from "vitest";
import { contrastRatio } from "../lib/contrast";
import { colors } from "./tokens";

// RF-18, plan section 4: every text colour reaches WCAG AA (4.5:1) on every
// background it can sit on; the focus ring needs 3:1 (non-text).
const BACKGROUNDS = [
  "bg",
  "bgDark",
  "planetHexawebBg",
  "planetRankiaBg",
  "planetAdaraBg",
] as const;
const TEXT_COLORS = ["text", "accentGreen", "buttonHover"] as const;

const pairs = TEXT_COLORS.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg]));

describe("text contrast (WCAG AA, 4.5:1)", () => {
  it.each(pairs)("%s on %s", (fg, bg) => {
    const ratio = contrastRatio(
      colors[fg as keyof typeof colors].value,
      colors[bg as keyof typeof colors].value,
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["button", "buttonHover"] as const)(
    "button label (bgDark) on %s",
    (button) => {
      expect(
        contrastRatio(colors.bgDark.value, colors[button].value),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("focus ring contrast (3:1)", () => {
  it.each(BACKGROUNDS)("buttonHover ring on %s", (bg) => {
    expect(
      contrastRatio(colors.buttonHover.value, colors[bg].value),
    ).toBeGreaterThanOrEqual(3);
  });
});
