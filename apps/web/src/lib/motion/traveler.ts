import { TRAVELER_PLANET_ANCHOR } from "./motion-config";

export type Rect = { left: number; top: number; width: number; height: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

// Top-left position of the traveller (a square of `size`), relative to the
// container's origin, so that its centre rests on the lower part of the
// planet on the given side (RF-34). The traveller stays inside the container;
// if that would push its centre out of the planet, the planet interior wins.
export function travelerTarget({
  container,
  planet,
  size,
  side,
}: {
  container: Rect;
  planet: Rect;
  size: number;
  side: "left" | "right";
}): { x: number; y: number } {
  const planetLeft = planet.left - container.left;
  const planetTop = planet.top - container.top;
  const ratioX = TRAVELER_PLANET_ANCHOR[side];
  const wantedX = planetLeft + planet.width * ratioX;
  const wantedY = planetTop + planet.height * TRAVELER_PLANET_ANCHOR.y;

  let x = clamp(wantedX - size / 2, 0, container.width - size);
  let y = clamp(wantedY - size / 2, 0, container.height - size);

  const centreX = clamp(x + size / 2, planetLeft, planetLeft + planet.width);
  const centreY = clamp(y + size / 2, planetTop, planetTop + planet.height);
  x = centreX - size / 2;
  y = centreY - size / 2;
  return { x, y };
}
