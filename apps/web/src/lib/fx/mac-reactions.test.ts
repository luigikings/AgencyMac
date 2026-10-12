import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sky/rng";
import {
  LINE_KEYS,
  bubbleMs,
  idleDue,
  isTurbo,
  lookAt,
  pickLine,
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
