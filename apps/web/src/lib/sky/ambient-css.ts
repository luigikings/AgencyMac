// CSS of the 7 ambients of the sky (spec 005, RF-5 to RF-7), generated at build
// time from the table of ambients.ts. Each zone keeps the solid base colour its
// own component paints; this only adds, on the same element, a background-image
// with a glow, a dust and a fade into the base of the next zone. It needs no
// JavaScript and no image. Colours are the CSS variables of the tokens.

import { cssVariableName } from "../../styles/tokens";
import { AMBIENT_ZONES } from "../site-data";
import { AMBIENTS, type AmbientId } from "./ambients";

/** Height of the fade at the bottom of each zone, in rem (RF-6: at least 8). */
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

/**
 * Where the glow and the dust sit in each zone. Neither ellipse may reach the
 * top edge (y - ry >= 0): there the zone must be exactly its base colour, the
 * colour the zone above fades into, so no step shows between them. At the
 * bottom edge the fade covers everything.
 */
export const ZONE_LAYOUT: Readonly<Record<AmbientId, ZoneLayout>> = {
  hero: {
    glow: { x: 76, y: 52, rx: 42, ry: 46 },
    dust: { x: 12, y: 78, rx: 46, ry: 22 },
  },
  hexaweb: {
    glow: { x: 22, y: 50, rx: 46, ry: 50 },
    dust: { x: 85, y: 38, rx: 36, ry: 34 },
  },
  rankia: {
    glow: { x: 78, y: 50, rx: 46, ry: 50 },
    dust: { x: 12, y: 70, rx: 40, ry: 30 },
  },
  adara: {
    glow: { x: 22, y: 50, rx: 46, ry: 50 },
    dust: { x: 85, y: 66, rx: 40, ry: 30 },
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

const mix = (token: Parameters<typeof cssVariableName>[0], alpha: number) =>
  `color-mix(in srgb,var(${cssVariableName(token)}) ${Math.round(alpha * 100)}%,transparent)`;

const radial = (e: Ellipse, color: string) =>
  `radial-gradient(ellipse ${e.rx}% ${e.ry}% at ${e.x}% ${e.y}%,${color},transparent)`;

/** One rule per zone: only `background-image`, never the solid base colour. */
export function ambientsCss(): string {
  return AMBIENTS.map((ambient) => {
    const zone = AMBIENT_ZONES.find((z) => z.id === ambient.id);
    if (!zone) throw new Error(`No zone for ambient "${ambient.id}"`);
    const layout = ZONE_LAYOUT[ambient.id];
    const fade = `linear-gradient(to bottom,transparent calc(100% - ${FADE_REM}rem),var(${cssVariableName(ambient.fadeTo)}))`;
    const glow = radial(layout.glow, mix(ambient.glow, ambient.glowAlpha));
    const dust = radial(layout.dust, mix(ambient.dust, ambient.dustAlpha));
    return `${zone.selector}{background-image:${fade},${glow},${dust}}`;
  }).join("");
}
