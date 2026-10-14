import { describe, expect, it } from "vitest";
import { keepTicking, needsResync, nextIdleFrames } from "./smooth-loop";

// Spec 005, D19 (plan 14.2): the smooth scrolling loop only runs while the
// page moves, and stops after a few frames without movement (RF-39).
describe("smooth scrolling loop", () => {
  const MAX = 3;

  function run(moving: boolean[]): number[] {
    let idle = 0;
    return moving.map((m) => (idle = nextIdleFrames(idle, m)));
  }

  it("keeps ticking while there is movement", () => {
    let idle = 0;
    for (let i = 0; i < 100; i++) {
      idle = nextIdleFrames(idle, true);
      expect(idle).toBe(0);
      expect(keepTicking(idle, MAX)).toBe(true);
    }
  });

  it("stops after MAX frames without movement", () => {
    const idle = run([true, false, false, false]);
    expect(idle).toEqual([0, 1, 2, 3]);
    expect(idle.map((i) => keepTicking(i, MAX))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("a movement in the middle starts the count again", () => {
    const idle = run([false, false, true, false, false, false]);
    expect(idle).toEqual([1, 2, 0, 1, 2, 3]);
    expect(keepTicking(idle[1]!, MAX)).toBe(true);
    expect(keepTicking(idle[5]!, MAX)).toBe(false);
  });

  it("never ticks forever with a limit below one", () => {
    expect(keepTicking(1, 0)).toBe(false);
    expect(keepTicking(1, Number.NaN)).toBe(false);
  });
});

// Lenis keeps its own copy of the scroll position and only updates it when a
// `scroll` event arrives (next frame). A click on an anchor in between made
// it aim from the old position and jump back first (CI failure, note under
// T18 of spec 005). Before Lenis handles a click, its copy is brought up to
// date unless its own smooth scroll is running.
describe("resync of the smooth scrolling position", () => {
  it("resyncs when the page moved and Lenis did not see it", () => {
    expect(needsResync(false, 0, 426)).toBe(true);
    expect(needsResync("native", 1200, 0)).toBe(true);
  });

  it("leaves a running smooth scroll alone", () => {
    expect(needsResync("smooth", 0, 426)).toBe(false);
  });

  it("does nothing when both positions agree (sub-pixel included)", () => {
    expect(needsResync(false, 426, 426)).toBe(false);
    expect(needsResync(false, 426.4, 426)).toBe(false);
  });

  it("never resyncs to a position that is not a number", () => {
    expect(needsResync(false, 0, Number.NaN)).toBe(false);
    expect(needsResync(false, Number.NaN, 300)).toBe(true);
  });
});
