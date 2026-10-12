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
