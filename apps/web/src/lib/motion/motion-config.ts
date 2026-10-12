// Single source of the timing and position constants of the home page
// animation (spec 004, plan D13b). Pure data: no DOM, no GSAP.

// Wait this long after the window `load` event before downloading the
// animation code, so it never competes with the first paint (RNF-4).
export const LOAD_DELAY_MS = 1000;

// Duration of Mac's gesture (RF-36).
export const GESTURE_MS = 600;

// Reference line for the active planet: this fraction of the window height
// (0.5 = the vertical centre, RF-34).
export const MARKER_RATIO = 0.5;

// Blocks whose top edge is more than this many pixels below the window are
// "below the fold" and may start in their hidden state (RF-35, plan D14).
export const FOLD_MARGIN_PX = 120;

// Where the traveller's centre rests on a planet, as a fraction of the
// planet's width (left/right, depending on the side) and height (y).
export const TRAVELER_PLANET_ANCHOR = {
  left: 0.18,
  right: 0.82,
  y: 0.8,
} as const;

// Reveal of the service blocks (RF-35): how far the halves travel, how long
// they take and where in the window the block triggers (ScrollTrigger start).
export const REVEAL_OFFSET_PX = 64;
export const REVEAL_DURATION_S = 0.8;
export const REVEAL_START = "top 80%";

// Two-column layout from this width (matches the CSS breakpoint of the
// service blocks).
export const WIDE_QUERY = "(min-width: 48rem)";

// Travelling Mac (RF-34): its size is a fraction of the planet's width (never
// below the minimum) and it takes this long to move to the next planet.
export const TRAVELER_SIZE_RATIO = 0.4;
export const TRAVELER_MIN_PX = 64;
export const TRAVELER_MOVE_S = 0.9;

// Smooth scrolling is only for a mouse or trackpad (RF-37, plan D16).
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
