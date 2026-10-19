import { describe, expect, it } from "vitest";
import {
  keepTicking,
  needsResync,
  nextIdleFrames,
  nextVelocity,
  pxPerSecond,
  velocityNow,
} from "./smooth-loop";
import { SCROLL_FRAME_MS, SCROLL_VELOCITY_MAX_AGE_MS } from "./motion-config";

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

// Spec 005, T25 (plan 14.6): the speed of the scroll for the space jump, from
// Lenis while its loop runs and otherwise from the scroll handler's positions.
describe("pxPerSecond", () => {
  it("turns a step over a time into px per second", () => {
    expect(pxPerSecond(100, 50)).toBe(2000);
    expect(pxPerSecond(-30, 15)).toBe(-2000);
  });

  it("is 0 without time or with values that are not finite", () => {
    expect(pxPerSecond(100, 0)).toBe(0);
    expect(pxPerSecond(100, -5)).toBe(0);
    expect(pxPerSecond(Number.NaN, 16)).toBe(0);
    expect(pxPerSecond(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("nextVelocity", () => {
  it("is 0 for the first position", () => {
    expect(nextVelocity(null, 500, 1000)).toBe(0);
  });

  it("is the change of position over the time between two scroll events", () => {
    expect(nextVelocity({ y: 0, t: 1000 }, 40, 1020)).toBe(2000);
    expect(nextVelocity({ y: 400, t: 1000 }, 380, 1010)).toBe(-2000);
  });

  it("counts a jump after a still page as one frame (an instant jump is fast)", () => {
    const v = nextVelocity({ y: 0, t: 0 }, 2000, 5000);
    expect(v).toBeCloseTo((2000 / SCROLL_FRAME_MS) * 1000, 5);
  });
});

describe("velocityNow", () => {
  it("keeps the last speed while it is fresh", () => {
    expect(velocityNow(1500, 1000, 1000 + SCROLL_VELOCITY_MAX_AGE_MS)).toBe(
      1500,
    );
  });

  it("is 0 once no scroll has come for a while", () => {
    expect(velocityNow(1500, 1000, 1000 + SCROLL_VELOCITY_MAX_AGE_MS + 1)).toBe(
      0,
    );
  });
});
