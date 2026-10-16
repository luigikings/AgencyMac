// Single source of the constants of the effects layer (spec 005, plan
// section 5). Pure data: no DOM, no GSAP, no date. Every limit of the device
// tiers (RF-37) lives in TIER_PARAMS; the rest of the effects read from here.

import type { ColorName } from "../../styles/tokens";

/** Device classes, from no effects at all to the full set. */
export const FX_TIERS = ["off", "low", "mid", "high"] as const;

export type FxTier = (typeof FX_TIERS)[number];

export function isFxTier(value: unknown): value is FxTier {
  return FX_TIERS.some((tier) => tier === value);
}

export type TierParams = {
  /** Star layers that move with the scroll (the others stay still). */
  scrollParallaxLayers: number;
  /** Star layers that twinkle. */
  twinkleLayers: number;
  /** Highest pixel density of the effects canvas. */
  canvasDensity: number;
  /** Most particles alive at once. */
  maxParticles: number;
  /** Most shooting stars at once (0 = none). */
  shootingStarsMax: number;
  /** [min, max] ms between shooting stars; null = none. */
  shootingStarGapMs: readonly [number, number] | null;
  /** Mac's trail particles per second while he flies. */
  trailPerSecond: number;
  /** Most sparks alive at once on one planet. */
  sparksPerPlanet: number;
  /** Planet parallax and Mac's gaze follow the pointer. */
  pointerEffects: boolean;
  /** Most particles of the cursor trail. */
  cursorTrailMax: number;
  /** Most streaks of the space jump. */
  jumpStreaksMax: number;
  /** Animated moons of Hexaweb, Rankia and Adara. */
  moonsPerPlanet: readonly [number, number, number];
};

const NONE: TierParams = {
  scrollParallaxLayers: 0,
  twinkleLayers: 0,
  canvasDensity: 0,
  maxParticles: 0,
  shootingStarsMax: 0,
  shootingStarGapMs: null,
  trailPerSecond: 0,
  sparksPerPlanet: 0,
  pointerEffects: false,
  cursorTrailMax: 0,
  jumpStreaksMax: 0,
  moonsPerPlanet: [0, 0, 0],
};

/** Plan section 5, table of device classes (RF-37). */
export const TIER_PARAMS: Readonly<Record<FxTier, TierParams>> = {
  off: NONE,
  low: {
    scrollParallaxLayers: 0,
    twinkleLayers: 1,
    canvasDensity: 1,
    maxParticles: 24,
    shootingStarsMax: 0,
    shootingStarGapMs: null,
    trailPerSecond: 8,
    sparksPerPlanet: 0,
    pointerEffects: false,
    cursorTrailMax: 0,
    jumpStreaksMax: 0,
    moonsPerPlanet: [1, 1, 1],
  },
  mid: {
    scrollParallaxLayers: 2,
    twinkleLayers: 3,
    canvasDensity: 1.25,
    maxParticles: 80,
    shootingStarsMax: 1,
    shootingStarGapMs: [12000, 24000],
    trailPerSecond: 20,
    sparksPerPlanet: 20,
    pointerEffects: true,
    cursorTrailMax: 0,
    jumpStreaksMax: 40,
    moonsPerPlanet: [1, 2, 1],
  },
  high: {
    scrollParallaxLayers: 3,
    twinkleLayers: 3,
    canvasDensity: 1.5,
    maxParticles: 160,
    shootingStarsMax: 2,
    shootingStarGapMs: [8000, 16000],
    trailPerSecond: 36,
    sparksPerPlanet: 40,
    pointerEffects: true,
    cursorTrailMax: 14,
    jumpStreaksMax: 80,
    moonsPerPlanet: [1, 2, 1],
  },
};

/** Furthest a planet moves with the cursor, in px (RF-13). */
export const POINTER_PARALLAX_MAX_PX = 14;

/**
 * Depth of each planet for the cursor parallax (RF-13): the nearer it feels,
 * the more it moves (1 = the full POINTER_PARALLAX_MAX_PX). Different for each
 * planet so they never move in step.
 */
export const PLANET_POINTER_DEPTH: Readonly<
  Record<"hexaweb" | "rankia" | "adara", number>
> = {
  hexaweb: 1,
  rankia: 0.7,
  adara: 0.85,
};

// Planet under the cursor (RF-14).
/** Size of a planet under the cursor: 5 % bigger at most. */
export const PLANET_HOVER_SCALE = 1.05;
/** Time constant of its growth and of its return to its size, in ms. */
export const PLANET_GROW_TAU_MS = 90;
/** Brand colours of the sparks (token names: the canvas reads their value). */
export const SPARK_TONES: readonly ColorName[] = [
  "buttonHover",
  "button",
  "logoGradient1",
  "logoGradient2",
  "text",
];
/** [min, max] speed of a spark when it leaves the rim, in px per ms. */
export const SPARK_SPEED_PX_MS = [0.03, 0.11] as const;
/** The sparks start on a circle of this fraction of the planet's width. */
export const SPARK_RIM_RATIO = 0.42;
/** Time to reach the tier's spark limit from none while hovering, in ms. */
export const SPARK_FILL_MS = 400;

/**
 * Time constant of the return to rest after the cursor leaves, in ms. With
 * 180 ms the offset is under 1 % after 1 s (RF-13: back in under 1 s).
 */
export const POINTER_REST_TAU_MS = 180;

// Adaptive degradation (RF-38): this many frames in a row whose mean cost is
// over the limit lower the tier one step.
export const DEGRADE_WINDOW_FRAMES = 45;
export const DEGRADE_LIMIT_MS = 12;

/** A shooting star lasts between these two durations, in ms (RF-4). */
export const SHOOTING_STAR_MS = [600, 1200] as const;
/** Fall of a shooting star below the horizontal, in degrees. */
export const SHOOTING_STAR_ANGLE_DEG = [15, 35] as const;
/** Length of its tail and of its whole run, in CSS px. */
export const SHOOTING_STAR_TAIL_PX = [80, 160] as const;
export const SHOOTING_STAR_TRAVEL_PX = [280, 520] as const;
/** Width of its head and its tail, in CSS px. */
export const SHOOTING_STAR_WIDTH_PX = 1.6;

// Effects canvas (RF-39, RNF-8).
/** Largest internal resolution of the canvas, in device pixels. */
export const MAX_CANVAS_PIXELS = 2_000_000;
/** Wait after the last resize before the canvas is sized again, in ms. */
export const CANVAS_RESIZE_DEBOUNCE_MS = 150;
/** Frame costs kept for the report and the degradation (the latest ones). */
export const FRAME_COST_SAMPLES = 600;

export type ParticleKind = "trail" | "burst" | "spark" | "cursor";

/** Order of the kinds: the index is stored in the pool. */
export const PARTICLE_KINDS: readonly ParticleKind[] = [
  "trail",
  "burst",
  "spark",
  "cursor",
];

/** [min, max) life of each kind of particle, in ms. */
export const PARTICLE_LIFE_MS: Readonly<
  Record<ParticleKind, readonly [number, number]>
> = {
  // The last one emitted is gone at most 500 ms after Mac lands, a frame or
  // two under the 0.6 s of RF-23.
  trail: [300, 500],
  burst: [500, 900],
  spark: [400, 800],
  cursor: [300, 550],
};

/** Longest life of a trail or cursor particle: always under 0.6 s (RF-23). */
export const PARTICLE_LIFE_MAX_MS = 550;

/** Downward acceleration of each kind, in px per ms squared. */
export const PARTICLE_GRAVITY: Readonly<Record<ParticleKind, number>> = {
  trail: 0,
  burst: 0.0004,
  spark: 0.0002,
  cursor: 0,
};

/** Range of particle radii, in px. */
export const PARTICLE_SIZE_PX = [1.5, 3.5] as const;

/** Flight speed (px/s) from which the trail is emitted at its full rate. */
export const TRAIL_FULL_RATE_SPEED_PX_S = 60;

// Mac's trail (RF-23).
/** Warm brand colours of the trail (token names: the canvas reads them). */
export const TRAIL_TONES: readonly ColorName[] = [
  "buttonHover",
  "button",
  "logoGradient1",
  "logoGradient2",
  "text",
];
/** The trail leaves Mac this fraction of his size behind his centre. */
export const TRAIL_REAR_RATIO = 0.32;
/** Random offset of each trail particle around that point, in px. */
export const TRAIL_JITTER_PX = 4;
/** [min, max] drift speed of a trail particle, in px per ms. */
export const TRAIL_SPEED_PX_MS = [0.01, 0.05] as const;
/** Largest angle between a particle's drift and straight back, in degrees. */
export const TRAIL_SPREAD_DEG = 28;

// Arrival bounce (RF-24).
/** Mac grows up to this scale when he lands, and back to 1. */
export const MAC_BOUNCE_SCALE = 1.12;
/** Duration of the whole bounce, in ms. */
export const MAC_BOUNCE_MS = 400;
/** Part of the bounce (0..1) spent growing; the rest is the way back. */
export const MAC_BOUNCE_PEAK = 0.4;

// Mac's flight (RF-21, RF-22).
/** The curve bends this fraction of the distance (at least MIN_BEND_PX). */
export const MAC_BEND_RATIO = 0.3;
export const MAC_MIN_BEND_PX = 48;
/** Flight duration: 500 ms plus this per px, between the two limits. */
export const MAC_FLIGHT_BASE_MS = 500;
export const MAC_FLIGHT_MS_PER_PX = 0.9;
export const MAC_FLIGHT_MS = [700, 1600] as const;
/** Largest tilt in flight, in degrees (RF-22), and time to straighten up. */
export const MAC_MAX_TILT_DEG = 25;
export const MAC_SETTLE_MS = 300;
/**
 * Part of a flight (0..1 of its progress) over which the tilt goes from the
 * one Mac had to the one of the flight, so a new flight (also a change of
 * planet mid-flight) never makes him turn at once.
 */
export const MAC_TILT_BLEND = 0.25;

// Mac's reactions (RF-25 to RF-29).
export const LOOK_MAX_DEG = 6;
export const LOOK_MAX_PX = 8;
/** Distance of the cursor (px) from which the gaze is at its maximum. */
export const LOOK_FULL_DISTANCE_PX = 400;
/** Time constant (ms) of the gaze easing towards its target and back. */
export const LOOK_TAU_MS = 150;
/** The greeting (RF-26): a sway of this duration (ms) and amplitude (deg). */
export const GREET_MS = 800;
export const GREET_SWAY_DEG = 9;
export const TURBO_CLICKS = 5;
export const TURBO_WINDOW_MS = 3000;
export const TURBO_COOLDOWN_MS = 10000;
export const IDLE_AFTER_MS = 8000;
/** A bubble stays on screen between these two durations, in ms. */
export const BUBBLE_MS = [2000, 2800] as const;
/** Space between a bubble and Mac (and any button it keeps clear of), in px. */
export const BUBBLE_GAP_PX = 10;
/** Smallest space between a bubble and the edges of the window, in px. */
export const BUBBLE_MARGIN_PX = 12;
/** Smallest space between a bubble and any text of the page, in px (T23). */
export const BUBBLE_TEXT_GAP_PX = 4;
/**
 * A bubble may slide along Mac's side as long as his centre stays this far
 * inside its edge, so its tail still points at him (T23).
 */
export const BUBBLE_TAIL_REACH_PX = 24;
/**
 * Narrower widths (px) a bubble wraps into, in this order, when at its full
 * width every place next to Mac would cover a text (T23).
 */
export const BUBBLE_WIDTHS_PX = [260, 200] as const;
/** Solid background of the bubble and colour of its text (token names). */
export const BUBBLE_BG: ColorName = "text";
export const BUBBLE_FG: ColorName = "bgDark";
/** The bubble grows into place in this time, in ms. */
export const BUBBLE_POP_MS = 180;

// Bursts and turbo mode (RF-28, RF-29).
/** Particles of the burst of a press on Mac: [min, max], both included. */
export const BURST_CLICK = [12, 20] as const;
/** Particles of the burst of turbo mode (always within the class limit). */
export const BURST_TURBO = 64;
/** [min, max] speed of a burst particle when it leaves Mac, in px per ms. */
export const BURST_SPEED_PX_MS = [0.06, 0.24] as const;
/** The burst starts on a circle of this fraction of Mac's width. */
export const BURST_RADIUS_RATIO = 0.3;
/** Brand colours of the bursts (token names: the canvas reads their value). */
export const BURST_TONES: readonly ColorName[] = [
  "buttonHover",
  "button",
  "logoGradient1",
  "logoGradient3",
  "accentGreen",
  "text",
];
/** Turbo mode: Mac's arc across the window lasts this long, in ms. */
export const TURBO_MS = 1200;
/** Highest rise of the arc, as a fraction of the window's height. */
export const TURBO_LIFT_RATIO = 0.25;
/** Space the arc leaves between Mac and the edges of the window, in px. */
export const TURBO_MARGIN_PX = 12;
/** Mac turns this much on the arc (towards where he flies), in degrees. */
export const TURBO_SPIN_DEG = 360;
/** Smallest size of Mac on the arc, far away in the middle of it. */
export const TURBO_MIN_SCALE = 0.6;
/**
 * Part of the arc at each end (of its eased progress) where Mac does not turn
 * yet: he leaves and arrives straight, so his turn never reaches past the
 * edge he starts next to.
 */
export const TURBO_SPIN_DELAY = 0.15;

// Space jump (RF-31).
/** Longest and shortest duration of the jump, in ms. */
export const JUMP_MAX_MS = 900;
export const JUMP_MIN_MS = 200;
/** Scroll speed (px/s) from which the jump shows all its streaks. */
export const JUMP_FULL_SPEED_PX_S = 2000;
/** Streak length in px per px/s of speed, and the longest streak. */
export const STREAK_LENGTH_PER_SPEED = 0.05;
export const STREAK_MAX_LENGTH_PX = 400;
