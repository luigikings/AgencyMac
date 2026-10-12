export type Stop = { top: number; bottom: number };

// Index of the active planet block for a reference line at `markerY` (RF-34).
// `stops` are sorted, in the same coordinates as `markerY`. Before the first
// block the first is active, after the last block the last one, and inside a
// gap the last one reached. Empty list: -1. Non-finite marker: the first.
export function resolveActiveStop(markerY: number, stops: Stop[]): number {
  if (stops.length === 0) return -1;
  if (!Number.isFinite(markerY)) return 0;
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (markerY < first.top) return 0;
  if (markerY >= last.bottom) return stops.length - 1;
  let active = 0;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i]!.top <= markerY) active = i;
  }
  return active;
}
