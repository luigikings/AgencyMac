// Star field of the sky (spec 005, RF-1, RF-9): three layers of stars drawn as
// a list of `box-shadow`s, generated at build time from a fixed seed so the
// sky is identical in every load and every build. No hex colours: the shadows
// use the CSS variables of the colour tokens.

import { cssVariableName, type ColorName } from "../../styles/tokens";
import { mulberry32, pick, range } from "./rng";

export type Star = {
  /** Horizontal position, in vw. */
  x: number;
  /** Vertical position, in vh (inside the layer, which has overscan). */
  y: number;
  /** Spread of the shadow in px: the radius of the star. */
  size: number;
  tone: ColorName;
};

export type StarLayer = {
  id: "far" | "mid" | "near";
  seed: number;
  /** Stars from 48 rem of width. */
  desktopCount: number;
  /** Stars on narrower screens. */
  mobileCount: number;
  /** Distance the layer travels over the whole page (RF-2), in vh. */
  parallaxVh: number;
  /** Height of the layer in vh: the window plus overscan for the parallax. */
  heightVh: number;
  /** Possible sizes (spread, px). */
  sizes: readonly number[];
  /** Duration of the twinkle cycle, in seconds (RF-3: 7 to 15 s). */
  twinkleS: number;
};

export const STAR_LAYERS: readonly StarLayer[] = [
  {
    id: "far",
    seed: 1001,
    desktopCount: 110,
    mobileCount: 40,
    parallaxVh: 4,
    heightVh: 100 + 2 * 4,
    sizes: [0, 0, 0.5],
    twinkleS: 7,
  },
  {
    id: "mid",
    seed: 1002,
    desktopCount: 60,
    mobileCount: 22,
    parallaxVh: 8,
    heightVh: 100 + 2 * 8,
    sizes: [0.5, 1],
    twinkleS: 11,
  },
  {
    id: "near",
    seed: 1003,
    desktopCount: 30,
    mobileCount: 10,
    parallaxVh: 16,
    heightVh: 100 + 2 * 16,
    sizes: [1, 1.5],
    twinkleS: 15,
  },
];

/** Tones of the stars (token names); white is twice as likely. */
export const STAR_TONES: readonly ColorName[] = [
  "text",
  "text",
  "accentGreen",
  "buttonHover",
  "logoGradient1",
];

/**
 * `count` stars from `seed`, sorted by (y, x) so the result is stable. x in
 * [0, 100) vw and y in [0, heightVh) vh. `sizes` defaults to a 1 px spread.
 */
export function generateStarField(
  seed: number,
  count: number,
  {
    heightVh,
    sizes = [0.5, 1],
  }: { heightVh: number; sizes?: readonly number[] },
): Star[] {
  const rng = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: round2(range(rng, 0, 100)),
      y: round2(range(rng, 0, heightVh)),
      size: pick(rng, sizes),
      tone: pick(rng, STAR_TONES),
    });
  }
  return stars.sort((a, b) => a.y - b.y || a.x - b.x);
}

function round2(value: number): number {
  // Rounding must keep the value inside [0, max): the caller passes a value
  // strictly below max, and 2 decimals can only reach max at the very edge.
  return Math.floor(value * 100) / 100;
}

/** Text of a CSS `box-shadow` list: one shadow per star, no hex colours. */
export function starsToBoxShadow(stars: readonly Star[]): string {
  return stars
    .map(
      (s) => `${s.x}vw ${s.y}vh 0 ${s.size}px var(${cssVariableName(s.tone)})`,
    )
    .join(",");
}
