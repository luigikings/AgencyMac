export type RevealSide = "left" | "right" | "bottom";
export type RevealPlan = { image: RevealSide; text: RevealSide };

// Where the illustration and the text of planet block `index` enter from
// (RF-35). One column: both from below. Two columns: opposite sides,
// alternating on each planet.
export function revealPlan(index: number, columns: number): RevealPlan {
  if (!(columns > 1)) return { image: "bottom", text: "bottom" };
  const even = index % 2 === 0;
  return even
    ? { image: "left", text: "right" }
    : { image: "right", text: "left" };
}

// True when a block's top edge is past the window's bottom plus a margin.
// Only those blocks adopt the hidden initial state (plan D14). Non-finite
// input leaves the block visible.
export function isBelowFold(
  blockTop: number,
  viewportHeight: number,
  margin: number,
): boolean {
  return blockTop > viewportHeight + margin;
}

// True when a hidden block must appear: its top edge is on the start line
// (`ratio` of the window height) or above it, also far above after a jump
// past the block (spec 005, D19). Non-finite input reveals: content is never
// left hidden.
export function revealDue(
  blockTop: number,
  viewportHeight: number,
  ratio: number,
): boolean {
  const line = viewportHeight * ratio;
  if (!Number.isFinite(blockTop) || !Number.isFinite(line)) return true;
  return blockTop <= line;
}

// `rootMargin` of an IntersectionObserver whose area ends at the start line:
// the bottom edge moves up by the part of the window below it.
export function revealRootMargin(ratio: number): string {
  const below = Number.isFinite(ratio)
    ? Math.round((1 - Math.min(1, Math.max(0, ratio))) * 100)
    : 0;
  return `0px 0px ${below === 0 ? "0" : `-${below}`}% 0px`;
}
