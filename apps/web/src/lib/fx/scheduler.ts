// When the effects run (spec 005, RF-4, RF-39). Pure functions: the clock and
// the generator are passed in.

import { range, type Rng } from "../sky/rng";
import { SHOOTING_STAR_MS, TIER_PARAMS, type FxTier } from "./fx-config";

/** The drawing loop may run: tab visible, and something active or in view. */
export function shouldRun(state: {
  hidden: boolean;
  active: boolean;
  inView: boolean;
}): boolean {
  return !state.hidden && (state.active || state.inView);
}

/** The loop asks for another frame only while there is something to draw. */
export function needsFrame(state: {
  particles: number;
  effects: number;
}): boolean {
  return state.particles > 0 || state.effects > 0;
}

/** Milliseconds until the next shooting star; Infinity when the tier has none. */
export function nextShootingStarDelay(rng: Rng, tier: FxTier): number {
  const gap = TIER_PARAMS[tier].shootingStarGapMs;
  return gap ? range(rng, gap[0], gap[1]) : Infinity;
}

/** A new shooting star may start while fewer than the tier's limit are alive. */
export function canSpawnShootingStar(active: number, tier: FxTier): boolean {
  return active < TIER_PARAMS[tier].shootingStarsMax;
}

/** Duration of one shooting star, in ms. */
export function shootingStarDuration(rng: Rng): number {
  return range(rng, SHOOTING_STAR_MS[0], SHOOTING_STAR_MS[1]);
}
