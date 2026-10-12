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

/** Progress at which each section top (page coordinates) reaches the window top. */
export function stopProgresses(
  tops: readonly number[],
  docHeight: number,
  viewportHeight: number,
): number[] {
  return tops.map((top) => journeyProgress(top, docHeight, viewportHeight));
}

/** Which stops have been reached (inclusive) at `progress`. */
export function visitedStops(
  progress: number,
  stops: readonly number[],
): boolean[] {
  return stops.map((stop) => progress >= stop);
}
