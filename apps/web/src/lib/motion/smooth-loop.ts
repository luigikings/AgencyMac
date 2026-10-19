// Frame loop of smooth scrolling on demand (spec 005, RF-39, plan 14.2): it
// runs while the page moves and stops after a few frames without movement, so
// at rest no frame is requested. Pure: no DOM.

import { SCROLL_FRAME_MS, SCROLL_VELOCITY_MAX_AGE_MS } from "./motion-config";

/** Frames in a row without movement, after one more frame. */
export function nextIdleFrames(idle: number, moving: boolean): number {
  return moving ? 0 : idle + 1;
}

/** Whether to ask for another frame; a limit below 1 never keeps ticking. */
export function keepTicking(idle: number, maxIdle: number): boolean {
  return maxIdle >= 1 && idle < maxIdle;
}

/**
 * Whether Lenis' copy of the scroll position must be brought up to date
 * before it handles a click. Lenis only learns about a scroll it did not make
 * from the `scroll` event, which comes with the next frame; a click on an
 * anchor in between (the browser scrolling the link into view, a busy CPU)
 * made it aim from the old position and jump back there first. Its own smooth
 * scroll is left alone. Differences under half a pixel do not count.
 */
export function needsResync(
  scrolling: boolean | string,
  animated: number,
  actual: number,
): boolean {
  if (scrolling === "smooth" || !Number.isFinite(actual)) return false;
  return !Number.isFinite(animated) || Math.abs(animated - actual) > 0.5;
}

/** A step of `dy` px over `dtMs` ms in px per second (0 if it cannot be told). */
export function pxPerSecond(dy: number, dtMs: number): number {
  if (!Number.isFinite(dy) || !Number.isFinite(dtMs) || dtMs <= 0) return 0;
  return (dy / dtMs) * 1000;
}

/**
 * Speed (px/s) of the scroll from the previous scroll event to this one at
 * `y`, `t` (ms). A previous event older than SCROLL_VELOCITY_MAX_AGE_MS means
 * the page was still: the step counts as one frame.
 */
export function nextVelocity(
  prev: { y: number; t: number } | null,
  y: number,
  t: number,
): number {
  if (!prev) return 0;
  const gap = t - prev.t;
  return pxPerSecond(
    y - prev.y,
    gap > SCROLL_VELOCITY_MAX_AGE_MS ? SCROLL_FRAME_MS : gap,
  );
}

/** The last speed while fresh; 0 once no scroll event came for a while. */
export function velocityNow(
  velocity: number,
  lastT: number,
  now: number,
): number {
  return now - lastT > SCROLL_VELOCITY_MAX_AGE_MS ? 0 : velocity;
}
