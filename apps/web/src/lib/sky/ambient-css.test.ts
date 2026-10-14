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
import {
  FADE_REM,
  PLANET_GLOW,
  PLANET_ZONES,
  ZONE_LAYOUT,
  ambientsCss,
} from "./ambient-css";

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

  const ruleOf = (id: string) => {
    const zone = AMBIENT_ZONES.find((z) => z.id === id)!;
    return new RegExp(
      `${zone.selector.replace(/[[\]"]/g, "\\$&")}\\{([^}]*)\\}`,
    ).exec(css)![1]!;
  };
  const v = (name: Parameters<typeof cssVariableName>[0]) =>
    `var(${cssVariableName(name)})`;

  it("fades over 10 rem in all: shared fades straddle the boundary (R2)", () => {
    expect(FADE_REM).toBe(10);
    AMBIENTS.forEach((ambient, i) => {
      const rule = ruleOf(ambient.id);
      const next = AMBIENTS[i + 1];
      if (ambient.sharedFade) {
        // 5 rem at the bottom, to the midway colour, opaque at the edge.
        const mid = `color-mix(in srgb,${v(ambient.base)},${v(ambient.fadeTo)})`;
        expect(rule, ambient.id).toContain(
          `linear-gradient(to bottom,transparent calc(100% - 5rem),`,
        );
        expect(rule, ambient.id).toContain(`,${mid} 100%)`);
        // And the next zone paints the other 5 rem at its top.
        expect(ruleOf(next!.id), next!.id).toContain(
          `linear-gradient(to top,transparent calc(100% - 5rem),`,
        );
        expect(ruleOf(next!.id), next!.id).toContain(`,${mid} 100%)`);
      } else {
        // The whole 10 rem at the bottom, to the next base, opaque at the edge.
        expect(rule, ambient.id).toContain(
          `linear-gradient(to bottom,transparent calc(100% - 10rem),`,
        );
        expect(rule, ambient.id).toContain(`,${v(ambient.fadeTo)} 100%)`);
      }
    });
  });

  it("shares the fade only between zones that touch", () => {
    const shared = Object.fromEntries(
      AMBIENTS.map((a) => [a.id, a.sharedFade]),
    );
    // The intro of the services sits between the hero and Hexaweb, and the
    // footer after the contact.
    expect(shared).toEqual({
      hero: false,
      hexaweb: true,
      rankia: true,
      adara: true,
      projects: true,
      team: true,
      contact: false,
    });
  });

  it("covers the top edge of a zone after something that is not a zone with its own base", () => {
    expect(ruleOf("hexaweb")).toContain(
      `linear-gradient(to top,transparent calc(100% - 5rem),`,
    );
    // The top fade comes right before the glow.
    expect(ruleOf("hexaweb")).toContain(
      `,${v("planetHexawebBg")} 100%),radial-gradient(`,
    );
    expect(ruleOf("hero")).not.toContain("to top");
  });

  it("eases every fade in and out (no visible corner where it starts)", () => {
    for (const ambient of AMBIENTS) {
      const fades = ruleOf(ambient.id).match(/linear-gradient\(/g) ?? [];
      expect(fades.length, ambient.id).toBe(ambient.id === "hero" ? 1 : 2);
      // 9 stops per fade: transparent, 7 eased steps and the edge.
      const bottom =
        /linear-gradient\(to bottom,(.*?)\)(?=,(?:linear|radial))/.exec(
          ruleOf(ambient.id),
        )![1]!;
      expect(bottom.match(/calc\(/g)?.length, ambient.id).toBe(8);
    }
  });

  it("puts the glow of each planet on its planet and the dust on its text (R2)", () => {
    for (const id of PLANET_ZONES) {
      const rule = ruleOf(id);
      expect(rule, id).toContain(
        `radial-gradient(circle ${PLANET_GLOW.glowRadius} at ${PLANET_GLOW.glowAt},`,
      );
      expect(rule, id).toContain(
        `radial-gradient(circle ${PLANET_GLOW.dustRadius} at ${PLANET_GLOW.dustAt},`,
      );
    }
    expect(PLANET_GLOW.glowAt).toBe("var(--planet-x,50%) var(--planet-y,50%)");
    expect(PLANET_GLOW.dustAt).toBe("var(--text-x,50%) var(--text-y,50%)");
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
  it("has a layout for each of the 7 ambients (the planets follow their planet)", () => {
    expect([...Object.keys(ZONE_LAYOUT), ...PLANET_ZONES].sort()).toEqual(
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
