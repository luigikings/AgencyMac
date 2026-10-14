// Frame loop of smooth scrolling on demand (spec 005, RF-39, plan 14.2): it
// runs while the page moves and stops after a few frames without movement, so
// at rest no frame is requested. Pure: no DOM.

/** Frames in a row without movement, after one more frame. */
export function nextIdleFrames(idle: number, moving: boolean): number {
  return moving ? 0 : idle + 1;
}

/** Whether to ask for another frame; a limit below 1 never keeps ticking. */
export function keepTicking(idle: number, maxIdle: number): boolean {
  return maxIdle >= 1 && idle < maxIdle;
}
