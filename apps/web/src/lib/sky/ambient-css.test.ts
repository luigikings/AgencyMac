import { describe, expect, it } from "vitest";
import {
  findHidingRules,
  findUnguardedKeyframes,
  findUnguardedMotion,
} from "../../styles/motion-css";
import { cssVariableName } from "../../styles/tokens";
import { findHexColors } from "../hex-colors";
import { AMBIENT_ZONES } from "../site-data";
import { AMBIENTS } from "./ambients";
import { FADE_REM, ZONE_LAYOUT, ambientsCss } from "./ambient-css";

describe("ambientsCss (RF-5, RF-6, RF-7)", () => {
  const css = ambientsCss();

  it("is the same text on every call", () => {
    expect(ambientsCss()).toBe(css);
  });

  it("has no hex colour and no motion or hiding rule", () => {
    expect(findHexColors(css)).toEqual([]);
    expect(findUnguardedMotion(css)).toEqual([]);
    expect(findUnguardedKeyframes(css)).toEqual([]);
    expect(findHidingRules(css)).toEqual([]);
  });

  it("has one rule per zone, on the selector of AMBIENT_ZONES", () => {
    for (const zone of AMBIENT_ZONES) {
      expect(css, zone.id).toContain(`${zone.selector}{`);
    }
    expect(AMBIENT_ZONES).toHaveLength(7);
  });

  it("only sets background-image: the solid base colour is never touched (RF-7)", () => {
    const rules = [...css.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]!);
    expect(rules).toHaveLength(7);
    for (const body of rules) {
      expect(body).toMatch(/^background-image:/);
      expect(body).not.toMatch(/background(-color)?:\s*var/);
      expect(body).not.toContain("background:");
    }
  });

  it("fades the last 10 rem into the base of the next zone", () => {
    expect(FADE_REM).toBe(10);
    for (const ambient of AMBIENTS) {
      const zone = AMBIENT_ZONES.find((z) => z.id === ambient.id)!;
      const rule = new RegExp(
        `${zone.selector.replace(/[[\]"]/g, "\\$&")}\\{([^}]*)\\}`,
      ).exec(css)![1]!;
      expect(rule, ambient.id).toContain(
        `linear-gradient(to bottom,transparent calc(100% - ${FADE_REM}rem),var(${cssVariableName(ambient.fadeTo)}))`,
      );
    }
  });

  it("paints the glow and the dust of the zone with their token colours and alphas", () => {
    for (const ambient of AMBIENTS) {
      const zone = AMBIENT_ZONES.find((z) => z.id === ambient.id)!;
      const rule = new RegExp(
        `${zone.selector.replace(/[[\]"]/g, "\\$&")}\\{([^}]*)\\}`,
      ).exec(css)![1]!;
      expect(rule, ambient.id).toContain(
        `color-mix(in srgb,var(${cssVariableName(ambient.glow)}) ${Math.round(ambient.glowAlpha * 100)}%,transparent)`,
      );
      expect(rule, ambient.id).toContain(
        `color-mix(in srgb,var(${cssVariableName(ambient.dust)}) ${Math.round(ambient.dustAlpha * 100)}%,transparent)`,
      );
    }
  });
});

describe("ZONE_LAYOUT (no step at the top edge of a zone, RF-6)", () => {
  it("has a layout for each of the 7 ambients", () => {
    expect(Object.keys(ZONE_LAYOUT).sort()).toEqual(
      AMBIENTS.map((a) => a.id).sort(),
    );
  });

  it("keeps every glow and dust ellipse out of the top edge, where the zone must equal the fade of the one above", () => {
    for (const [id, layout] of Object.entries(ZONE_LAYOUT)) {
      for (const part of ["glow", "dust"] as const) {
        const e = layout[part];
        expect(e.y - e.ry, `${id} ${part}`).toBeGreaterThanOrEqual(0);
        // And inside the box sideways at its centre.
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.x).toBeLessThanOrEqual(100);
      }
    }
  });
});
