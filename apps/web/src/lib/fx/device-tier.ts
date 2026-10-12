// Device class of the visit (spec 005, RF-37, RF-38). Pure functions: the
// browser code reads the signals and passes them in.

import {
  DEGRADE_LIMIT_MS,
  DEGRADE_WINDOW_FRAMES,
  type FxTier,
} from "./fx-config";

export type TierSignals = {
  /** The visitor asks for reduced motion. */
  reduced: boolean;
  /** Data saver is on. */
  saveData: boolean;
  /** `navigator.deviceMemory` in GB; null or undefined when not exposed. */
  memoryGb?: number | null;
  /** `navigator.hardwareConcurrency`; null or undefined when not exposed. */
  cores?: number | null;
  /** The main pointer is coarse (touch). */
  coarse: boolean;
  /** Window width in rem. */
  widthRem: number;
};

/** Width in rem from which a touch device counts as a tablet. */
const TABLET_REM = 48;

/**
 * Classifies the visit. Memory or cores not exposed (Safari, Firefox) do not
 * limit by themselves: a fine pointer with no core count falls in the middle
 * class.
 */
export function pickTier(s: TierSignals): FxTier {
  if (s.reduced) return "off";
  const memory = s.memoryGb ?? null;
  const cores = s.cores ?? null;
  if (s.saveData || (memory !== null && memory <= 2)) return "low";
  if (s.coarse) return s.widthRem < TABLET_REM ? "low" : "mid";
  if (cores === null) return "mid";
  if (cores >= 8 && (memory === null || memory >= 8)) return "high";
  if (cores >= 4) return "mid";
  return "low";
}

/** One class down; never up. `low` and `off` stay as they are. */
export function tierDown(tier: FxTier): FxTier {
  if (tier === "high") return "mid";
  if (tier === "mid") return "low";
  return tier;
}

/**
 * True when the mean cost of the last `windowFrames` frames is over `limitMs`
 * (RF-38). Fewer frames than the window never degrade.
 */
export function shouldDegrade(
  frameCostsMs: readonly number[],
  windowFrames: number = DEGRADE_WINDOW_FRAMES,
  limitMs: number = DEGRADE_LIMIT_MS,
): boolean {
  if (frameCostsMs.length < windowFrames) return false;
  const recent = frameCostsMs.slice(-windowFrames);
  const mean = recent.reduce((sum, ms) => sum + ms, 0) / windowFrames;
  return mean > limitMs;
}
