import { describe, expect, it } from "vitest";
import { mulberry32 } from "../sky/rng";
import {
  BUBBLE_GAP_PX,
  BUBBLE_MARGIN_PX,
  BUBBLE_TAIL_REACH_PX,
  BUBBLE_TEXT_GAP_PX,
} from "./fx-config";
import {
  nextLine,
  overlapArea,
  overlaps,
  placeBubble,
  type Box,
} from "./bubbles";

const CLICKS = ["mac.click.1", "mac.click.2", "mac.click.3"] as const;

describe("nextLine (RF-27: never the same line twice in a row)", () => {
  it("gives no line when there are no candidates", () => {
    expect(nextLine([], null, mulberry32(1))).toBeNull();
    expect(nextLine([], "mac.idle", mulberry32(1))).toBeNull();
  });

  it("gives the only candidate when it is not the last line", () => {
    expect(nextLine(["mac.arrive.rankia"], null, mulberry32(1))).toBe(
      "mac.arrive.rankia",
    );
    expect(
      nextLine(["mac.arrive.rankia"], "mac.arrive.hexaweb", mulberry32(1)),
    ).toBe("mac.arrive.rankia");
  });

  it("gives nothing rather than the same line again", () => {
    expect(
      nextLine(["mac.arrive.hexaweb"], "mac.arrive.hexaweb", mulberry32(1)),
    ).toBeNull();
  });

  it("never repeats a line in a row over many picks", () => {
    const rng = mulberry32(7);
    let last: string | null = null;
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const line = nextLine(CLICKS, last, rng);
      expect(line).not.toBeNull();
      expect(line).not.toBe(last);
      seen.add(line!);
      last = line;
    }
    // Every line still comes up.
    expect([...seen].sort()).toEqual([...CLICKS]);
  });

  it("only gives lines among the candidates", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 100; i++) {
      expect(CLICKS).toContain(nextLine(CLICKS, "mac.greet", rng));
    }
  });

  it("is repeatable with the same seed", () => {
    const run = () => {
      const rng = mulberry32(42);
      let last: string | null = null;
      return Array.from(
        { length: 20 },
        () => (last = nextLine(CLICKS, last, rng)),
      );
    };
    expect(run()).toEqual(run());
  });
});

describe("overlaps", () => {
  const a: Box = { left: 0, top: 0, width: 10, height: 10 };
  it("tells boxes that share area from boxes that only touch", () => {
    expect(overlaps(a, { left: 5, top: 5, width: 10, height: 10 })).toBe(true);
    expect(overlaps(a, { left: 10, top: 0, width: 10, height: 10 })).toBe(
      false,
    );
    expect(overlaps(a, { left: 0, top: 20, width: 10, height: 10 })).toBe(
      false,
    );
  });
});

describe("placeBubble (RF-27, RNF-11)", () => {
  const view = { width: 1280, height: 720 };
  const mac: Box = { left: 600, top: 400, width: 100, height: 100 };
  const size = { width: 200, height: 48 };
  const inside = (p: { x: number; y: number }, v = view) =>
    p.x >= BUBBLE_MARGIN_PX - 1e-9 &&
    p.y >= BUBBLE_MARGIN_PX - 1e-9 &&
    p.x + size.width <= v.width - BUBBLE_MARGIN_PX + 1e-9 &&
    p.y + size.height <= v.height - BUBBLE_MARGIN_PX + 1e-9;
  const boxOf = (p: { x: number; y: number }): Box => ({
    left: p.x,
    top: p.y,
    width: size.width,
    height: size.height,
  });

  it("goes above Mac, centred on him, when there is room", () => {
    const p = placeBubble({ anchor: mac, size, view, avoid: [] })!;
    expect(p.side).toBe("above");
    expect(p.x + size.width / 2).toBeCloseTo(650);
    expect(p.y + size.height).toBeCloseTo(mac.top - BUBBLE_GAP_PX);
    expect(overlaps(boxOf(p), mac)).toBe(false);
  });

  it("goes below Mac when he is at the top of the window", () => {
    const top: Box = { ...mac, top: 10 };
    const p = placeBubble({ anchor: top, size, view, avoid: [] })!;
    expect(p.side).toBe("below");
    expect(p.y).toBeCloseTo(top.top + top.height + BUBBLE_GAP_PX);
    expect(inside(p)).toBe(true);
  });

  it("stays inside a 320 px window, also with Mac at its edge", () => {
    const narrow = { width: 320, height: 640 };
    const wide = { width: 280, height: 60 };
    for (const left of [-40, 0, 120, 250, 300]) {
      const anchor: Box = { left, top: 300, width: 80, height: 80 };
      const p = placeBubble({ anchor, size: wide, view: narrow, avoid: [] })!;
      expect(p).not.toBeNull();
      expect(p.x).toBeGreaterThanOrEqual(BUBBLE_MARGIN_PX);
      expect(p.x + wide.width).toBeLessThanOrEqual(320 - BUBBLE_MARGIN_PX);
    }
  });

  it("never covers the main button: it moves to another side", () => {
    // The button is right above Mac.
    const button: Box = { left: 560, top: 300, width: 180, height: 48 };
    const p = placeBubble({ anchor: mac, size, view, avoid: [button] })!;
    expect(p).not.toBeNull();
    expect(p.side).not.toBe("above");
    expect(overlaps(boxOf(p), button)).toBe(false);
    expect(inside(p)).toBe(true);
  });

  it("keeps a gap from the button too", () => {
    const button: Box = {
      left: 560,
      top: mac.top - BUBBLE_GAP_PX - size.height - 4,
      width: 180,
      height: 4,
    };
    const p = placeBubble({ anchor: mac, size, view, avoid: [button] })!;
    expect(p.side).not.toBe("above");
  });

  it("gives no place when every side would cover a button", () => {
    const all: Box = { left: 0, top: 0, width: 1280, height: 720 };
    expect(placeBubble({ anchor: mac, size, view, avoid: [all] })).toBeNull();
  });

  it("gives no place when the bubble does not fit in the window", () => {
    const tiny = { width: 100, height: 100 };
    expect(
      placeBubble({ anchor: mac, size, view: tiny, avoid: [] }),
    ).toBeNull();
  });

  it("ignores buttons that are far away", () => {
    const far: Box = { left: 0, top: 0, width: 100, height: 40 };
    const p = placeBubble({ anchor: mac, size, view, avoid: [far] })!;
    expect(p.side).toBe("above");
  });

  it("works with non-finite boxes by giving no place", () => {
    const bad: Box = { left: Number.NaN, top: 0, width: 10, height: 10 };
    expect(placeBubble({ anchor: bad, size, view, avoid: [] })).toBeNull();
  });
});

describe("overlapArea", () => {
  it("is the shared area, 0 when the boxes only touch or are apart", () => {
    const a: Box = { left: 0, top: 0, width: 10, height: 10 };
    expect(overlapArea(a, { left: 5, top: 6, width: 10, height: 10 })).toBe(20);
    expect(overlapArea(a, { left: 10, top: 0, width: 5, height: 5 })).toBe(0);
    expect(overlapArea(a, { left: 30, top: 30, width: 5, height: 5 })).toBe(0);
  });
});

// T23 (R3 review): the bubble never covers a text of the page (headings,
// paragraphs, labels, links). It tries the other sides of Mac and slides along
// each one as far as its tail still points at him; with no clear place, it
// takes the one that covers least and says how much.
describe("placeBubble keeps clear of texts (T23)", () => {
  const view = { width: 1280, height: 720 };
  const mac: Box = { left: 600, top: 400, width: 100, height: 100 };
  const size = { width: 200, height: 48 };
  const boxOf = (p: { x: number; y: number }): Box => ({
    left: p.x,
    top: p.y,
    width: size.width,
    height: size.height,
  });
  const padded = (b: Box): Box => ({
    left: b.left - BUBBLE_TEXT_GAP_PX,
    top: b.top - BUBBLE_TEXT_GAP_PX,
    width: b.width + 2 * BUBBLE_TEXT_GAP_PX,
    height: b.height + 2 * BUBBLE_TEXT_GAP_PX,
  });
  const clearOf = (p: { x: number; y: number }, texts: Box[]) =>
    texts.every((t) => !overlaps(boxOf(p), padded(t)));
  // The tail can reach Mac's centre from this place.
  const tailOnMac = (p: { x: number; y: number; side: string }) => {
    const cx = mac.left + mac.width / 2;
    const cy = mac.top + mac.height / 2;
    return p.side === "above" || p.side === "below"
      ? cx >= p.x + BUBBLE_TAIL_REACH_PX - 1e-9 &&
          cx <= p.x + size.width - BUBBLE_TAIL_REACH_PX + 1e-9
      : cy >= p.y + BUBBLE_TAIL_REACH_PX - 1e-9 &&
          cy <= p.y + size.height - BUBBLE_TAIL_REACH_PX + 1e-9;
  };

  it("says it covers nothing when the place is clear", () => {
    const p = placeBubble({ anchor: mac, size, view, avoid: [], texts: [] })!;
    expect(p.side).toBe("above");
    expect(p.overlap).toBe(0);
  });

  it("ignores texts far away", () => {
    const far: Box = { left: 0, top: 0, width: 300, height: 30 };
    const p = placeBubble({
      anchor: mac,
      size,
      view,
      avoid: [],
      texts: [far],
    })!;
    expect(p.side).toBe("above");
    expect(p.overlap).toBe(0);
  });

  it("moves to another side when a heading sits right above Mac", () => {
    const heading: Box = { left: 500, top: 330, width: 300, height: 40 };
    const p = placeBubble({
      anchor: mac,
      size,
      view,
      avoid: [],
      texts: [heading],
    })!;
    expect(p.side).not.toBe("above");
    expect(p.overlap).toBe(0);
    expect(clearOf(p, [heading])).toBe(true);
  });

  it("keeps a small gap from a text, not only its box", () => {
    // Just above where the centred bubble would end.
    const line: Box = {
      left: 560,
      top: mac.top - BUBBLE_GAP_PX - size.height - BUBBLE_TEXT_GAP_PX / 2 - 20,
      width: 180,
      height: 20,
    };
    const p = placeBubble({
      anchor: mac,
      size,
      view,
      avoid: [],
      texts: [line],
    })!;
    expect(clearOf(p, [line])).toBe(true);
  });

  it("slides along a side, its tail still on Mac, when the centred place covers a text", () => {
    // A label above Mac on his left; below and the sides are taken by the
    // window and by buttons, so it stays above, slid to the right.
    const low: Box = { ...mac, top: 720 - 100 - BUBBLE_MARGIN_PX + 4 };
    const label: Box = { left: 450, top: low.top - 80, width: 160, height: 30 };
    const buttons: Box[] = [
      { left: 380, top: low.top, width: 200, height: 100 },
      { left: 720, top: low.top, width: 200, height: 100 },
    ];
    const p = placeBubble({
      anchor: low,
      size,
      view,
      avoid: buttons,
      texts: [label],
    })!;
    expect(p.side).toBe("above");
    expect(p.overlap).toBe(0);
    expect(clearOf(p, [label])).toBe(true);
    const cx = low.left + low.width / 2;
    expect(cx).toBeGreaterThanOrEqual(p.x + BUBBLE_TAIL_REACH_PX - 1e-9);
    expect(cx).toBeLessThanOrEqual(p.x + size.width - BUBBLE_TAIL_REACH_PX);
    expect(p.x).toBeGreaterThan(cx - size.width / 2);
  });

  it("slides up or down along the left and right sides too", () => {
    // Above and below are out of the window, the right side has a button
    // and a text sits left of Mac, high up: the bubble goes to his left,
    // lowered.
    const flat = { width: 1280, height: 120 };
    const anchor: Box = { left: 600, top: 10, width: 100, height: 100 };
    const text: Box = { left: 380, top: 0, width: 200, height: 30 };
    const p = placeBubble({
      anchor,
      size: { width: 200, height: 60 },
      view: flat,
      avoid: [{ left: 710, top: 0, width: 400, height: 120 }],
      texts: [text],
    })!;
    expect(p).not.toBeNull();
    expect(p.side).toBe("left");
    expect(p.overlap).toBe(0);
    expect(p.y).toBeGreaterThan(60 - 30);
    expect(
      overlaps({ left: p.x, top: p.y, width: 200, height: 60 }, padded(text)),
    ).toBe(false);
  });

  it("never covers a button to clear a text", () => {
    const heading: Box = { left: 500, top: 330, width: 300, height: 40 };
    const p = placeBubble({
      anchor: mac,
      size,
      view,
      avoid: [{ left: 560, top: 510, width: 180, height: 48 }],
      texts: [heading],
    })!;
    expect(p.side).not.toBe("below");
    expect(clearOf(p, [heading])).toBe(true);
  });

  it("with no clear place, takes the one that covers least and says how much", () => {
    // Texts on every side of Mac; the one below is the smallest.
    const texts: Box[] = [
      { left: 0, top: 0, width: 1280, height: 395 },
      { left: 0, top: 0, width: 595, height: 500 },
      { left: 705, top: 0, width: 575, height: 500 },
      { left: 640, top: 520, width: 20, height: 10 },
    ];
    const p = placeBubble({ anchor: mac, size, view, avoid: [], texts })!;
    expect(p).not.toBeNull();
    expect(p.side).toBe("below");
    expect(p.overlap).toBeGreaterThan(0);
    expect(p.overlap).toBeLessThanOrEqual(
      (20 + 2 * BUBBLE_TEXT_GAP_PX) * (10 + 2 * BUBBLE_TEXT_GAP_PX),
    );
    expect(tailOnMac(p)).toBe(true);
  });
});
