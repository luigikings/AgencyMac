import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sky/rng";
import {
  BURST_CLICK,
  BURST_TURBO,
  GREET_MS,
  GREET_SWAY_DEG,
  LOOK_TAU_MS,
  TIER_PARAMS,
  TURBO_LIFT_RATIO,
  TURBO_MARGIN_PX,
  TURBO_MIN_SCALE,
  TURBO_MS,
  TURBO_SPIN_DEG,
  TURBO_SPIN_DELAY,
} from "./fx-config";
import {
  LINE_KEYS,
  bubbleMs,
  burstSize,
  easeGaze,
  greetSway,
  idleDue,
  idleWaitMs,
  isTurbo,
  lookAt,
  pickLine,
  registerPress,
  turboArc,
  turboSpan,
  type PressState,
} from "./mac-reactions";

const OPTS = { maxDeg: 6, maxPx: 8 };

describe("lookAt (RF-25)", () => {
  const mac = { x: 500, y: 400 };

  it("does nothing when the cursor is on Mac", () => {
    expect(lookAt(mac, mac, OPTS)).toEqual({ rotate: 0, x: 0, y: 0 });
  });

  it("never tilts more than 6 degrees nor moves more than 8 px", () => {
    for (const dx of [-5000, -400, -50, 0, 50, 400, 5000]) {
      for (const dy of [-5000, -400, -50, 0, 50, 400, 5000]) {
        const r = lookAt(mac, { x: mac.x + dx, y: mac.y + dy }, OPTS);
        expect(Math.abs(r.rotate)).toBeLessThanOrEqual(6 + 1e-9);
        expect(Math.hypot(r.x, r.y)).toBeLessThanOrEqual(8 + 1e-9);
      }
    }
  });

  it("looks towards the cursor", () => {
    const right = lookAt(mac, { x: 900, y: 400 }, OPTS);
    expect(right.rotate).toBeGreaterThan(0);
    expect(right.x).toBeGreaterThan(0);
    const upLeft = lookAt(mac, { x: 100, y: 0 }, OPTS);
    expect(upLeft.rotate).toBeLessThan(0);
    expect(upLeft.x).toBeLessThan(0);
    expect(upLeft.y).toBeLessThan(0);
  });

  it("reaches the maximum from 400 px and grows gradually before", () => {
    const near = lookAt(mac, { x: 600, y: 400 }, OPTS);
    const far = lookAt(mac, { x: 900, y: 400 }, OPTS);
    expect(Math.abs(near.x)).toBeLessThan(Math.abs(far.x));
    expect(far.x).toBeCloseTo(8, 9);
    expect(far.rotate).toBeCloseTo(6, 9);
  });
});

describe("pickLine (RF-27)", () => {
  it("returns the only line when there is one", () => {
    expect(pickLine(["a"], 0, () => 0.9)).toBe(0);
  });

  it("returns -1 for no lines", () => {
    expect(pickLine([], -1, () => 0.5)).toBe(-1);
  });

  it.each([2, 3])("never repeats the last one with %i lines", (n) => {
    const lines = Array.from({ length: n }, (_, i) => `line ${i}`);
    const rng = mulberry32(5);
    let last = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const next = pickLine(lines, last, rng);
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(n);
      seen.add(next);
      last = next;
    }
    expect(seen.size).toBe(n);
  });

  it("can start from any line when there is no previous one", () => {
    const lines = ["a", "b", "c"];
    expect(pickLine(lines, -1, () => 0)).toBe(0);
    expect(pickLine(lines, -1, () => 0.999999)).toBe(2);
  });
});

describe("isTurbo (RF-29)", () => {
  const now = 10_000;
  const press = (...agos: number[]) => agos.map((ago) => now - ago);

  it("does not fire with 4 presses", () => {
    expect(isTurbo(press(0, 500, 1000, 1500), now)).toBe(false);
  });

  it("fires with 5 presses within 3 s", () => {
    expect(isTurbo(press(0, 500, 1000, 1500, 3000), now)).toBe(true);
  });

  it("does not fire with 5 presses spread over 3.1 s", () => {
    expect(isTurbo(press(0, 500, 1000, 1500, 3100), now)).toBe(false);
  });

  it("ignores old presses and counts only the ones inside the window", () => {
    expect(isTurbo(press(0, 100, 200, 300, 9000, 9500), now)).toBe(false);
    expect(isTurbo(press(0, 100, 200, 300, 400, 9000), now)).toBe(true);
  });

  it("waits for the cooldown of 10 s after the last turbo", () => {
    const clicks = press(0, 100, 200, 300, 400);
    expect(isTurbo(clicks, now, { lastTurbo: now - 9999 })).toBe(false);
    expect(isTurbo(clicks, now, { lastTurbo: now - 10_000 })).toBe(true);
    expect(isTurbo(clicks, now, { lastTurbo: null })).toBe(true);
  });

  it("accepts other options", () => {
    expect(isTurbo(press(0, 100, 200), now, { count: 3 })).toBe(true);
  });
});

describe("idleDue (RF-27)", () => {
  it("is due after 8 s without interaction", () => {
    expect(idleDue({ lastInteraction: 0, lastIdle: null }, 7999)).toBe(false);
    expect(idleDue({ lastInteraction: 0, lastIdle: null }, 8000)).toBe(true);
  });

  it("fires once per period of rest: not again until a new interaction", () => {
    expect(idleDue({ lastInteraction: 0, lastIdle: 8000 }, 20_000)).toBe(false);
    expect(idleDue({ lastInteraction: 15_000, lastIdle: 8000 }, 23_000)).toBe(
      true,
    );
    expect(idleDue({ lastInteraction: 15_000, lastIdle: 8000 }, 22_999)).toBe(
      false,
    );
  });
});

describe("idleWaitMs (RF-27: the rest line is timed, not polled)", () => {
  it("is the time left until 8 s without interaction", () => {
    expect(idleWaitMs({ lastInteraction: 0, lastIdle: null }, 0)).toBe(8000);
    expect(idleWaitMs({ lastInteraction: 1000, lastIdle: null }, 4000)).toBe(
      5000,
    );
    expect(idleWaitMs({ lastInteraction: 0, lastIdle: null }, 9000)).toBe(0);
  });

  it("agrees with idleDue: 0 exactly when it is due", () => {
    for (const now of [0, 7999, 8000, 12_000]) {
      const state = { lastInteraction: 0, lastIdle: null };
      expect(idleWaitMs(state, now) === 0).toBe(idleDue(state, now));
    }
  });

  it("never again in the same period of rest", () => {
    expect(idleWaitMs({ lastInteraction: 0, lastIdle: 8000 }, 9000)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(idleWaitMs({ lastInteraction: 9000, lastIdle: 8000 }, 9000)).toBe(
      8000,
    );
  });
});

describe("easeGaze (RF-25: towards the cursor and back in under 1 s)", () => {
  const rest = { rotate: 0, x: 0, y: 0 };
  const full = { rotate: 6, x: 8, y: 0 };

  it("moves part of the way each frame and never past the target", () => {
    const { pose, settled } = easeGaze(rest, full, 16);
    expect(settled).toBe(false);
    expect(pose.rotate).toBeGreaterThan(0);
    expect(pose.rotate).toBeLessThan(6);
    expect(pose.x).toBeGreaterThan(0);
    expect(pose.x).toBeLessThan(8);
  });

  it("is back at rest from the largest gaze in under 1 s of frames", () => {
    let pose = full;
    let ms = 0;
    let settled = false;
    while (!settled && ms < 2000) {
      ({ pose, settled } = easeGaze(pose, rest, 16));
      ms += 16;
    }
    expect(settled).toBe(true);
    expect(pose).toEqual(rest);
    expect(ms).toBeLessThan(1000);
  });

  it("is time based: one long frame equals several short ones", () => {
    let pose = full;
    for (let i = 0; i < 4; i++) pose = easeGaze(pose, rest, 25).pose;
    const once = easeGaze(full, rest, 100).pose;
    expect(once.rotate).toBeCloseTo(pose.rotate, 6);
    expect(once.x).toBeCloseTo(pose.x, 6);
  });

  it("settles at once when already there", () => {
    expect(easeGaze(full, full, 16)).toEqual({ pose: full, settled: true });
    expect(LOOK_TAU_MS).toBeGreaterThan(0);
  });
});

describe("greetSway (RF-26: a sway of 0.8 s)", () => {
  it("starts and ends straight, and is still outside its 0.8 s", () => {
    expect(GREET_MS).toBe(800);
    expect(greetSway(0)).toBe(0);
    expect(greetSway(-10)).toBe(0);
    expect(greetSway(GREET_MS)).toBe(0);
    expect(greetSway(GREET_MS + 500)).toBe(0);
  });

  it("swings both ways, never more than its amplitude", () => {
    let min = 0;
    let max = 0;
    for (let t = 0; t <= GREET_MS; t += 4) {
      const deg = greetSway(t);
      min = Math.min(min, deg);
      max = Math.max(max, deg);
    }
    expect(max).toBeGreaterThan(GREET_SWAY_DEG / 2);
    expect(min).toBeLessThan(-GREET_SWAY_DEG / 4);
    expect(Math.max(max, -min)).toBeLessThanOrEqual(GREET_SWAY_DEG);
  });
});

describe("bubbleMs (RF-27)", () => {
  it("lasts between 2.0 and 2.8 s", () => {
    expect(bubbleMs(() => 0)).toBe(2000);
    expect(bubbleMs(() => 0.5)).toBe(2400);
    expect(bubbleMs(() => 0.999999)).toBeLessThan(2800);
  });
});

describe("LINE_KEYS", () => {
  it("has the keys of the table of texts of the spec", () => {
    expect(LINE_KEYS.greet).toBe("mac.greet");
    expect(LINE_KEYS.arrive).toEqual({
      hexaweb: "mac.arrive.hexaweb",
      rankia: "mac.arrive.rankia",
      adara: "mac.arrive.adara",
      contact: "mac.arrive.contact",
    });
    expect(LINE_KEYS.click).toEqual([
      "mac.click.1",
      "mac.click.2",
      "mac.click.3",
    ]);
    expect(LINE_KEYS.idle).toBe("mac.idle");
    expect(LINE_KEYS.turbo).toBe("mac.turbo");
  });
});

describe("burstSize (RF-28, RF-29: with the limit of the class)", () => {
  it("is 12 to 20 particles on a press", () => {
    expect(burstSize("click", 160, () => 0)).toBe(BURST_CLICK[0]);
    expect(burstSize("click", 160, () => 0.999999)).toBe(BURST_CLICK[1]);
    const rng = mulberry32(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const n = burstSize("click", 160, rng);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(12);
      expect(n).toBeLessThanOrEqual(20);
      seen.add(n);
    }
    expect(seen.size).toBe(9);
  });

  it("is at least 60 in turbo mode", () => {
    expect(burstSize("turbo", 160, () => 0.5)).toBe(BURST_TURBO);
    expect(BURST_TURBO).toBeGreaterThanOrEqual(60);
  });

  it("never goes past the room the class leaves", () => {
    expect(burstSize("turbo", TIER_PARAMS.low.maxParticles, () => 0.5)).toBe(
      24,
    );
    expect(burstSize("turbo", 30.7, () => 0.5)).toBe(30);
    expect(burstSize("click", 5, () => 0.999999)).toBe(5);
    expect(burstSize("click", 0, () => 0.5)).toBe(0);
    expect(burstSize("click", -3, () => 0.5)).toBe(0);
    expect(burstSize("turbo", Number.NaN, () => 0.5)).toBe(0);
  });
});

describe("registerPress (RF-29: 5 presses in 3 s, then 10 s of cooldown)", () => {
  const start: PressState = { presses: [], lastTurbo: null };
  const run = (times: number[], state: PressState = start) => {
    const fired: number[] = [];
    for (const t of times) {
      const out = registerPress(state, t);
      state = out.state;
      if (out.turbo) fired.push(t);
    }
    return { fired, state };
  };

  it("fires on the 5th press within 3 s, not before", () => {
    expect(run([0, 400, 800, 1200]).fired).toEqual([]);
    expect(run([0, 400, 800, 1200, 1600]).fired).toEqual([1600]);
    expect(run([0, 700, 1400, 2100, 3000]).fired).toEqual([3000]);
    expect(run([0, 800, 1600, 2400, 3100]).fired).toEqual([]);
  });

  it("starts counting again after a turbo and waits 10 s", () => {
    const first = run([0, 100, 200, 300, 400]);
    expect(first.fired).toEqual([400]);
    expect(first.state.presses).toEqual([]);
    expect(first.state.lastTurbo).toBe(400);
    // Five more within the cooldown: nothing.
    const during = run([1000, 1200, 1400, 1600, 1800, 5000, 5200], first.state);
    expect(during.fired).toEqual([]);
    // Five presses once the 10 s are over: again.
    const after = run([10_400, 10_500, 10_600, 10_700, 10_800], during.state);
    expect(after.fired).toEqual([10_800]);
  });

  it("keeps only the presses of the last 3 s", () => {
    const { state } = run([0, 100, 200, 300, 5000, 5100]);
    expect(state.presses).toEqual([5000, 5100]);
  });

  it("does not change the state it is given", () => {
    const state: PressState = { presses: [0, 1, 2, 3], lastTurbo: null };
    registerPress(state, 4);
    expect(state.presses).toEqual([0, 1, 2, 3]);
  });
});

describe("turboSpan and turboArc (RF-29: across the screen in an arc)", () => {
  const view = { width: 1280, height: 720 };
  const right = { x: 900, y: 500, radius: 150 };
  const left = { x: 120, y: 500, radius: 100 };
  const sample = (span: ReturnType<typeof turboSpan>) =>
    Array.from({ length: 241 }, (_, i) => turboArc((i / 240) * TURBO_MS, span));

  it("from the right half crosses to the left edge, and the other way", () => {
    const a = turboSpan(right, view);
    expect(right.x + a.dx).toBeCloseTo(
      TURBO_MARGIN_PX + right.radius * TURBO_MIN_SCALE,
      9,
    );
    expect(a.spin).toBe(-TURBO_SPIN_DEG);
    const b = turboSpan(left, view);
    expect(left.x + b.dx).toBeCloseTo(
      view.width - TURBO_MARGIN_PX - left.radius * TURBO_MIN_SCALE,
      9,
    );
    expect(b.spin).toBe(TURBO_SPIN_DEG);
  });

  it("rises as much as the window lets him, never above its top", () => {
    expect(turboSpan(right, view).lift).toBeCloseTo(
      TURBO_LIFT_RATIO * view.height,
      9,
    );
    const high = { x: 900, y: 200, radius: 150 };
    expect(turboSpan(high, view).lift).toBeCloseTo(
      200 - 150 - TURBO_MARGIN_PX,
      9,
    );
    expect(turboSpan({ x: 900, y: 100, radius: 150 }, view).lift).toBe(0);
  });

  it("stays in the middle of a window narrower than Mac", () => {
    const span = turboSpan(
      { x: 100, y: 400, radius: 250 },
      { width: 300, height: 600 },
    );
    expect(100 + span.dx).toBeCloseTo(150, 9);
  });

  it("keeps the whole path inside the window", () => {
    for (const [mac, v] of [
      [right, view],
      [left, view],
      [
        { x: 140, y: 460, radius: 120 },
        { width: 375, height: 667 },
      ],
      [
        { x: 120, y: 300, radius: 100 },
        { width: 320, height: 640 },
      ],
    ] as const) {
      const span = turboSpan(mac, v);
      for (const pose of sample(span)) {
        const x = mac.x + pose.x;
        const y = mac.y + pose.y;
        const r = mac.radius * pose.scale;
        expect(x - r).toBeGreaterThanOrEqual(TURBO_MARGIN_PX - 1e-6);
        expect(x + r).toBeLessThanOrEqual(v.width - TURBO_MARGIN_PX + 1e-6);
        expect(y - r).toBeGreaterThanOrEqual(
          Math.min(TURBO_MARGIN_PX, mac.y - mac.radius) - 1e-6,
        );
        // Never below where he started.
        expect(pose.y).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it("keeps the turning box of the real Macs inside the window (with the gesture's shift)", () => {
    // The wrapper of the hero's Mac at 1280, 375 and 320 px (window px), and
    // the room the effects layer adds for the gesture (14 px) and the gaze.
    const GESTURE_PX = 14;
    for (const { mac, v } of [
      { mac: { x: 838, y: 360, w: 305, h: 305 }, v: view },
      {
        mac: { x: 133, y: 333, w: 233, h: 233 },
        v: { width: 375, height: 667 },
      },
      {
        mac: { x: 114, y: 320, w: 196, h: 196 },
        v: { width: 320, height: 640 },
      },
    ]) {
      const radius = Math.hypot(mac.w, mac.h) / 2 + 24;
      const span = turboSpan({ x: mac.x, y: mac.y, radius }, v);
      for (const pose of sample(span)) {
        const a = (pose.rotate * Math.PI) / 180;
        const hx =
          (pose.scale *
            (Math.abs(mac.w * Math.cos(a)) + Math.abs(mac.h * Math.sin(a)))) /
            2 +
          GESTURE_PX * pose.scale;
        const hy =
          (pose.scale *
            (Math.abs(mac.w * Math.sin(a)) + Math.abs(mac.h * Math.cos(a)))) /
            2 +
          GESTURE_PX * pose.scale;
        const x = mac.x + pose.x;
        const y = mac.y + pose.y;
        expect(x - hx).toBeGreaterThanOrEqual(0);
        expect(x + hx).toBeLessThanOrEqual(v.width);
        expect(y - hy).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("leaves and arrives straight, and turns once in between", () => {
    const span = turboSpan(right, view);
    // Eased progress TURBO_SPIN_DELAY: p = acos(1 - 2 d) / pi.
    const still = (Math.acos(1 - 2 * TURBO_SPIN_DELAY) / Math.PI) * TURBO_MS;
    expect(Math.abs(turboArc(still * 0.99, span).rotate)).toBe(0);
    expect(turboArc(TURBO_MS - still * 0.99, span).rotate).toBe(span.spin);
    expect(Math.abs(turboArc(TURBO_MS / 2, span).rotate)).toBeCloseTo(180, 6);
  });

  it("is an arc: out to the far side, up to its lift and back home", () => {
    const span = turboSpan(right, view);
    const poses = sample(span);
    const far = Math.min(...poses.map((p) => p.x));
    const top = Math.min(...poses.map((p) => p.y));
    expect(far).toBeCloseTo(span.dx, 3);
    expect(top).toBeCloseTo(-span.lift, 1);
    // Out and back along different paths: higher on the way out.
    const out = turboArc(TURBO_MS * 0.3, span);
    const back = poses.find(
      (p, i) => i > 120 && Math.abs(p.x - out.x) < Math.abs(span.dx) / 50,
    )!;
    expect(out.y).toBeLessThan(back.y - 10);
  });

  it("starts and ends at rest, with no jump on the way", () => {
    const span = turboSpan(right, view);
    for (const t of [-10, 0, TURBO_MS, TURBO_MS + 500]) {
      expect(turboArc(t, span)).toEqual({ rotate: 0, x: 0, y: 0, scale: 1 });
    }
    const poses = sample(span);
    for (let i = 1; i < poses.length; i++) {
      const a = poses[i - 1]!;
      const b = poses[i]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(30);
    }
    // Smaller far away: TURBO_MIN_SCALE in the middle, never smaller.
    const sizes = poses.map((p) => p.scale);
    expect(Math.min(...sizes)).toBeCloseTo(TURBO_MIN_SCALE, 3);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(1);
    // One whole turn in the direction of the flight.
    const spin = poses.map((p) => p.rotate);
    expect(Math.min(...spin)).toBeLessThan(-300);
    expect(Math.min(...spin)).toBeGreaterThanOrEqual(-360);
  });
});
