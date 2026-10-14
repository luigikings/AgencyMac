// CSS of the 7 ambients of the sky (spec 005, RF-5 to RF-7), generated at build
// time from the table of ambients.ts. Each zone keeps the solid base colour its
// own component paints; this only adds, on the same element, a background-image
// with the fades into the zones around it, a glow and a dust. It needs no
// JavaScript and no image. Colours are the CSS variables of the tokens.
//
// R2 adjustments (2026-10-14): the glow of a planet block is a circle on its
// planet (not an ellipse in % of a wide, short block, which read as a
// horizontal band), and the fade between two zones that touch straddles their
// boundary, so each colour stays centred on its own block.

import { cssVariableName, type ColorName } from "../../styles/tokens";
import { AMBIENT_ZONES } from "../site-data";
import { AMBIENTS, type AmbientId } from "./ambients";

/** Height of the whole fade between two zones, in rem (RF-6: at least 8). */
export const FADE_REM = 10;

type Ellipse = {
  /** Centre, in % of the zone. */
  x: number;
  y: number;
  /** Radii, in % of the zone. */
  rx: number;
  ry: number;
};

export type ZoneLayout = { glow: Ellipse; dust: Ellipse };

/** Zones of the three service planets: their glow follows the planet. */
export const PLANET_ZONES = ["hexaweb", "rankia", "adara"] as const;
type PlanetZone = (typeof PLANET_ZONES)[number];

const isPlanetZone = (id: AmbientId): id is PlanetZone =>
  (PLANET_ZONES as readonly string[]).includes(id);

/**
 * Glow and dust of a planet block: circles of a fixed size centred on the
 * planet and on the text. The centres are CSS variables that the services
 * section sets for each layout (one column, or two with the planet on either
 * side), so the glow always sits on the planet whatever the width.
 */
export const PLANET_GLOW = {
  glowRadius: "min(20rem,85vw)",
  dustRadius: "min(15rem,65vw)",
  glowAt: "var(--planet-x,50%) var(--planet-y,50%)",
  dustAt: "var(--text-x,50%) var(--text-y,50%)",
} as const;

/**
 * Where the glow and the dust sit in the other zones (tall blocks, where an
 * ellipse in % of the zone reads as a glow). Neither ellipse reaches the top
 * edge (y - ry >= 0); the fades cover both edges anyway.
 */
export const ZONE_LAYOUT: Readonly<
  Record<Exclude<AmbientId, PlanetZone>, ZoneLayout>
> = {
  hero: {
    glow: { x: 76, y: 52, rx: 42, ry: 46 },
    dust: { x: 12, y: 78, rx: 46, ry: 22 },
  },
  projects: {
    glow: { x: 50, y: 46, rx: 56, ry: 45 },
    dust: { x: 88, y: 70, rx: 36, ry: 30 },
  },
  team: {
    glow: { x: 50, y: 50, rx: 50, ry: 48 },
    dust: { x: 12, y: 72, rx: 40, ry: 28 },
  },
  contact: {
    glow: { x: 50, y: 80, rx: 60, ry: 46 },
    dust: { x: 14, y: 42, rx: 40, ry: 38 },
  },
};

const v = (token: ColorName) => `var(${cssVariableName(token)})`;

/** `color` at `alpha` (0..1), as a mix with transparent. */
const withAlpha = (color: string, alpha: number) =>
  alpha >= 1
    ? color
    : `color-mix(in srgb,${color} ${Math.round(alpha * 1000) / 10}%,transparent)`;

/** Smoothstep: no visible edge where a fade starts or ends. */
const smooth = (u: number) => u * u * (3 - 2 * u);

/** Steps of every fade, enough for a curve with no visible corner. */
const FADE_STEPS = 8;

/**
 * A fade over the last `rem` of the zone towards one `edge`, from transparent
 * to `color` fully opaque at that edge. `curve` gives the opacity at each
 * fraction of the way (0 where the fade starts, 1 at the edge).
 */
function edgeFade(
  edge: "bottom" | "top",
  color: string,
  rem: number,
  curve: (p: number) => number,
) {
  const stops = Array.from({ length: FADE_STEPS + 1 }, (_, i) => {
    const p = i / FADE_STEPS;
    const at = `calc(100% - ${Math.round((1 - p) * rem * 1000) / 1000}rem)`;
    return i === 0
      ? `transparent ${at}`
      : `${withAlpha(color, curve(p))} ${i === FADE_STEPS ? "100%" : at}`;
  });
  return `linear-gradient(to ${edge},${stops.join(",")})`;
}

// A shared fade: the colour goes from one base to the other along a
// smoothstep over FADE_REM, centred on the boundary. Each half is painted by
// its own zone over its own base as the midway colour at a growing opacity;
// at the boundary both halves are that colour, fully opaque.
const halfCurve = (p: number) => 2 * smooth(p / 2);

/** Radial profile of a glow: soft centre, no visible rim. */
const GLOW_PROFILE = [
  [1, 0],
  [0.62, 28],
  [0.3, 52],
  [0.1, 76],
] as const;

function glowGradient(shape: string, color: string, alpha: number) {
  const stops = GLOW_PROFILE.map(
    ([k, at]) => `${withAlpha(color, alpha * k)}${at === 0 ? "" : ` ${at}%`}`,
  );
  return `radial-gradient(${shape},${stops.join(",")},transparent)`;
}

const ellipseShape = (e: Ellipse) =>
  `ellipse ${e.rx}% ${e.ry}% at ${e.x}% ${e.y}%`;

/** The midway colour between two bases (the colour of a shared boundary). */
const midway = (a: ColorName, b: ColorName) =>
  `color-mix(in srgb,${v(a)},${v(b)})`;

/** One rule per zone: only `background-image`, never the solid base colour. */
export function ambientsCss(): string {
  return AMBIENTS.map((ambient, index) => {
    const zone = AMBIENT_ZONES.find((z) => z.id === ambient.id);
    if (!zone) throw new Error(`No zone for ambient "${ambient.id}"`);

    const bottom = ambient.sharedFade
      ? edgeFade(
          "bottom",
          midway(ambient.base, ambient.fadeTo),
          FADE_REM / 2,
          halfCurve,
        )
      : edgeFade("bottom", v(ambient.fadeTo), FADE_REM, smooth);

    // The top: the other half of the fade from the zone above, or (after
    // something that is not a zone) the zone's own base, which only hides the
    // glow and the dust at that edge.
    const above = AMBIENTS[index - 1];
    const top =
      index === 0
        ? []
        : [
            edgeFade(
              "top",
              above?.sharedFade
                ? midway(above.base, ambient.base)
                : v(ambient.base),
              FADE_REM / 2,
              halfCurve,
            ),
          ];

    const id = ambient.id;
    const [glowShape, dustShape] = isPlanetZone(id)
      ? [
          `circle ${PLANET_GLOW.glowRadius} at ${PLANET_GLOW.glowAt}`,
          `circle ${PLANET_GLOW.dustRadius} at ${PLANET_GLOW.dustAt}`,
        ]
      : [
          ellipseShape(ZONE_LAYOUT[id].glow),
          ellipseShape(ZONE_LAYOUT[id].dust),
        ];
    const glow = glowGradient(glowShape, v(ambient.glow), ambient.glowAlpha);
    const dust = glowGradient(dustShape, v(ambient.dust), ambient.dustAlpha);

    return `${zone.selector}{background-image:${[bottom, ...top, glow, dust].join(",")}}`;
  }).join("");
}
