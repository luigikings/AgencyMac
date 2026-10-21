// Limits of the device class that live in CSS (spec 005, RF-3, RF-12, RF-37).
// The HTML and the base CSS keep 1, 2 and 1 moons and the three twinkling
// star layers: without JavaScript the class is unknown, and the static page
// is the full one. Once the animation core marks the class on <html>
// (`data-fx-tier`), these rules, generated from TIER_PARAMS (the only source
// of the limits), stand still the moons and layers beyond the class's
// numbers. A still moon stays visible at its own point of the orbit, its
// still pose of T14 (`left`/`top`; the motion path is removed too), and
// nothing is hidden (served stylesheets may not hide content). Pure: no DOM.

import { FX_TIERS, TIER_PARAMS, type FxTier } from "../fx/fx-config";
import { SERVICES } from "../site-data";
import { STAR_LAYERS } from "./star-field";

/** Moons that stand still on each planet in the tier (planets with none left out). */
export function stillMoons(tier: FxTier): Record<string, number> {
  if (tier === "off") return {};
  const still: Record<string, number> = {};
  SERVICES.forEach((service, i) => {
    const allowed = TIER_PARAMS[tier].moonsPerPlanet[i] ?? service.moons;
    const extra = service.moons - allowed;
    if (extra > 0) still[service.id] = extra;
  });
  return still;
}

/** Ids of the star layers that do not twinkle in the tier (the last ones). */
export function stillStarLayers(tier: FxTier): string[] {
  if (tier === "off") return [];
  return STAR_LAYERS.slice(TIER_PARAMS[tier].twinkleLayers).map(
    (layer) => layer.id,
  );
}

/** CSS of the limits of every class, under prefers-reduced-motion. */
export function tierLimitsCss(): string {
  const rules: string[] = [];
  for (const tier of FX_TIERS) {
    if (tier === "off") continue;
    const scope = `html[data-fx-tier="${tier}"]`;
    for (const [id, extra] of Object.entries(stillMoons(tier))) {
      const service = SERVICES.find((s) => s.id === id)!;
      const first = service.moons - extra + 1;
      rules.push(
        `${scope} .service[data-planet="${id}"] .service__moon:nth-of-type(n+${first}){animation:none;offset-path:none}`,
      );
    }
    for (const id of stillStarLayers(tier)) {
      rules.push(`${scope} [data-star-layer="${id}"]{animation:none}`);
    }
  }
  return `@media (prefers-reduced-motion:no-preference){${rules.join("")}}`;
}
