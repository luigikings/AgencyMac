// CSS of the star layers (spec 005, RF-1, RF-3, RF-9), generated at build time
// from the fixed seeds of STAR_LAYERS: the sky is identical in every load and
// every build, needs no JavaScript and no image. The colours are the CSS
// variables of the tokens, never hex.

import { STAR_LAYERS, generateStarField, starsToBoxShadow } from "./star-field";

/** Width below which the short lists of stars are used (48 rem, RF-1). */
const NARROW_QUERY = "(max-width:47.99rem)";

/** CSS text of the three layers: lists of stars, narrow lists and twinkle. */
export function skyStarsCss(): string {
  const list = (count: number, layer: (typeof STAR_LAYERS)[number]) =>
    starsToBoxShadow(
      generateStarField(layer.seed, count, {
        heightVh: layer.heightVh,
        sizes: layer.sizes,
      }),
    );

  const base =
    ".sky__layer{position:absolute;left:0;width:1px;height:1px;border-radius:50%;will-change:transform}";
  const desktop = STAR_LAYERS.map(
    (layer) =>
      `.sky__layer--${layer.id}{top:-${layer.parallaxVh}vh;box-shadow:${list(layer.desktopCount, layer)}}`,
  ).join("");
  const narrow = STAR_LAYERS.map(
    (layer) =>
      `.sky__layer--${layer.id}{box-shadow:${list(layer.mobileCount, layer)}}`,
  ).join("");
  const durations = STAR_LAYERS.map(
    (layer) =>
      `.sky__layer--${layer.id}{animation-duration:${layer.twinkleS}s}`,
  ).join("");

  // Twinkle: soft brightness change of the whole layer (one animation per
  // layer, compositor only), a cycle of 7 to 15 s: well under three changes a
  // second. Never fully dark. Only for visitors who allow motion.
  const twinkle =
    "@media (prefers-reduced-motion:no-preference){" +
    "@keyframes sky-twinkle{from{opacity:.55}to{opacity:1}}" +
    ".sky__layer{animation-name:sky-twinkle;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}" +
    durations +
    "}";

  return `${base}${desktop}@media ${NARROW_QUERY}{${narrow}}${twinkle}`;
}
