import { describe, expect, it } from "vitest";
import { keepTicking, nextIdleFrames } from "./smooth-loop";

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
