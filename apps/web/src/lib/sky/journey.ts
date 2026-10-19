// Progress of the journey indicator (spec 005, RF-30). Pure maths: the browser
// code reads the scroll position and the section tops and passes them in.

/** The 5 stops: one per section of the home page, in page order. */
export const STOPS = [
  "hero",
  "services",
  "projects",
  "team",
  "contact",
] as const;

export type StopId = (typeof STOPS)[number];

/**
 * Progress 0..1 of the scroll through the page. 0 when the document is not
 * taller than the window or the input is not finite; overscroll is clamped.
 */
export function journeyProgress(
  scrollY: number,
  docHeight: number,
  viewportHeight: number,
): number {
  const scrollable = docHeight - viewportHeight;
  if (!Number.isFinite(scrollY) || !Number.isFinite(scrollable)) return 0;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

/**
 * Progress at which each section top (page coordinates) reaches the mark of
 * the window: its top with `mark` 0, its middle with 0.5. Stops that cannot
 * be reached by scrolling are clamped to 0 or 1.
 */
export function stopProgresses(
  tops: readonly number[],
  docHeight: number,
  viewportHeight: number,
  mark = 0,
): number[] {
  return tops.map((top) =>
    journeyProgress(top - mark * viewportHeight, docHeight, viewportHeight),
  );
}

/**
 * Offset (px) of the rocket from the start of a rail `length` long when the
 * rocket is `size` long: 0 at the start, the end of the rail at 1, and never
 * outside it.
 */
export function railOffset(
  progress: number,
  length: number,
  size: number,
): number {
  const room = length - size;
  if (!Number.isFinite(progress) || !(room > 0)) return 0;
  return Math.min(1, Math.max(0, progress)) * room;
}

/** Which stops have been reached (inclusive) at `progress`. */
export function visitedStops(
  progress: number,
  stops: readonly number[],
): boolean[] {
  return stops.map((stop) => progress >= stop);
}
