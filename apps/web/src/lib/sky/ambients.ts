// Ambients of the 7 zones of the home page (spec 005, RF-5 to RF-8, plan
// section 6). Pure data and colour maths: no DOM, no date. Colours are token
// names; the hex values come from styles/tokens.ts.

import type { ColorName } from "../../styles/tokens";
import { colors } from "../../styles/tokens";
import { contrastRatio } from "../contrast";

export type AmbientId =
  "hero" | "hexaweb" | "rankia" | "adara" | "projects" | "team" | "contact";

export type Ambient = {
  id: AmbientId;
  /** Solid base colour of the zone (always a token, RF-7). */
  base: ColorName;
  /** Glow colour (radial gradient on top of the base). */
  glow: ColorName;
  /** Dust colour (a second, fainter gradient). */
  dust: ColorName;
  /** Peak alpha of the glow, capped by sky-luminance.test.ts (RF-8). */
  glowAlpha: number;
  /** Peak alpha of the dust. */
  dustAlpha: number;
  /** Base colour of the next zone: the 10 rem fade at the bottom goes there. */
  fadeTo: ColorName;
};

/**
 * Highest luminance (0 to 1) any point of the sky may reach. The yellow
 * accent text (luminance about 0.76) needs a background at or under about
 * 0.127 for 4.5:1; this leaves a margin.
 */
export const SKY_MAX_LUMINANCE = 0.12;

// Alphas start at the plan's tops (glows 0.22, 0.30, 0.30, 0.28, 0.22, 0.20,
// 0.22) and are lowered where sky-luminance.test.ts requires it: Hexaweb
// (glow 0.12, dust 0.02), Adara (0.17, 0.04) and Contact (0.20, 0.06) do not
// fit the 0.12 luminance ceiling at their plan values.
export const AMBIENTS: readonly Ambient[] = [
  {
    id: "hero",
    base: "bg",
    glow: "logoGradient2",
    dust: "logoGradient4",
    glowAlpha: 0.22,
    dustAlpha: 0.12,
    fadeTo: "planetHexawebBg",
  },
  {
    id: "hexaweb",
    base: "planetHexawebBg",
    glow: "planetHexawebGlow",
    dust: "accentGreen",
    glowAlpha: 0.12,
    dustAlpha: 0.02,
    fadeTo: "planetRankiaBg",
  },
  {
    id: "rankia",
    base: "planetRankiaBg",
    glow: "planetRankiaGlow",
    dust: "logoGradient4",
    glowAlpha: 0.3,
    dustAlpha: 0.08,
    fadeTo: "planetAdaraBg",
  },
  {
    id: "adara",
    base: "planetAdaraBg",
    glow: "planetAdaraGlow",
    dust: "logoGradient1",
    glowAlpha: 0.17,
    dustAlpha: 0.04,
    fadeTo: "bg",
  },
  {
    id: "projects",
    base: "bg",
    glow: "earthGlow",
    dust: "planetRankiaGlow",
    glowAlpha: 0.22,
    dustAlpha: 0.1,
    fadeTo: "bgDark",
  },
  {
    id: "team",
    base: "bgDark",
    glow: "logoGradient3",
    dust: "logoGradient4",
    glowAlpha: 0.2,
    dustAlpha: 0.12,
    fadeTo: "bg",
  },
  {
    id: "contact",
    base: "bg",
    glow: "logoGradient1",
    dust: "logoGradient2",
    glowAlpha: 0.2,
    dustAlpha: 0.06,
    fadeTo: "bgDark",
  },
];

export type ZoneBox = { id: string; top: number; bottom: number };

/**
 * Ambient of the zone that holds `markerY` (page coordinates). Outside the
 * page it clamps to the first or last zone.
 */
export function resolveAmbient(
  markerY: number,
  zones: readonly ZoneBox[],
): Ambient {
  const first = zones[0];
  const last = zones.at(-1);
  if (!first || !last)
    throw new Error("resolveAmbient needs at least one zone");
  const zone =
    markerY < first.top
      ? first
      : markerY >= last.bottom
        ? last
        : (zones.find((z) => markerY >= z.top && markerY < z.bottom) ?? last);
  const ambient = AMBIENTS.find((a) => a.id === zone.id);
  if (!ambient) throw new Error(`No ambient for zone "${zone.id}"`);
  return ambient;
}

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function parse(hex: string): [number, number, number] {
  const m = HEX.exec(hex);
  if (!m) throw new Error(`Expected a #RRGGBB hex colour, got "${hex}"`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

const toLinear = (v: number): number => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (l: number): number => {
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

/** `glow` painted over `base` with `alpha`, mixed in linear light. `#RRGGBB`. */
export function blendOver(base: string, glow: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  const b = parse(base);
  const g = parse(glow);
  const out = [0, 1, 2].map((i) =>
    toSrgb(toLinear(b[i]!) * (1 - a) + toLinear(g[i]!) * a),
  );
  return (
    "#" +
    out
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/**
 * Largest alpha in 0..1 for which `textHex` keeps `minRatio` of contrast on
 * `glow` blended over `base` (binary search, 20 steps). 0 when the base alone
 * fails; 1 when even the full glow passes. Assumes the contrast falls as the
 * alpha grows (a glow lighter than the base under light text).
 */
export function glowAlphaCap(
  base: string,
  glow: string,
  textHex: string,
  minRatio: number,
): number {
  const ok = (a: number) =>
    contrastRatio(textHex, blendOver(base, glow, a)) >= minRatio;
  if (!ok(0)) return 0;
  if (ok(1)) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Brightest colour the ambient can paint: dust over glow over base, both at
 * their peak alpha, as if their gradients overlapped at full strength.
 */
export function ambientPeak(ambient: Ambient): string {
  const withGlow = blendOver(
    colors[ambient.base].value,
    colors[ambient.glow].value,
    ambient.glowAlpha,
  );
  return blendOver(withGlow, colors[ambient.dust].value, ambient.dustAlpha);
}
