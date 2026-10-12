import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkSamples,
  circleAlpha,
  cleanAlpha,
  contentBox,
  featherEdge,
  floodBackground,
  squarePad,
  validateRecipe,
} from "./cutout.mjs";

// Pure pixel logic of the cut-outs (spec 004, RF-22, plan section 6). Images
// are synthetic RGBA buffers: no sharp, no disk.

const W = 40;
const H = 40;

function makeImage(paint) {
  const rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * W + x) * 4;
      rgba.set([r, g, b, 255], i);
    }
  }
  return rgba;
}

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

// Background with a horizontal gradient (one colour unit per pixel), a bright
// disc and, inside it, a closed dark blob (like Mac's eyes).
const DISC = { cx: 20, cy: 20, r: 12 };
const BLOB = { cx: 20, cy: 20, r: 3 };
function discWithDarkCore() {
  return makeImage((x, y) => {
    if (dist(x, y, BLOB.cx, BLOB.cy) <= BLOB.r) return [0, 0, 0];
    if (dist(x, y, DISC.cx, DISC.cy) <= DISC.r) return [200, 180, 50];
    return [20 + x, 10, 60];
  });
}

// A ring: the disc has a hole in the middle and a gap that opens the hole onto
// the background, so the fill leaks into it.
function openRing() {
  return makeImage((x, y) => {
    const d = dist(x, y, DISC.cx, DISC.cy);
    const inGap = x >= 18 && x <= 22 && y < DISC.cy;
    if (d <= DISC.r && d > 5 && !inGap) return [200, 180, 50];
    return [20 + x, 10, 60];
  });
}

const at = (alpha, x, y) => alpha[y * W + x];
const FLOOD = { seedTol: 60, stepTol: 4 };

describe("floodBackground", () => {
  it("makes the outside transparent, even over a gradient", () => {
    const alpha = floodBackground(discWithDarkCore(), W, H, FLOOD);
    expect(alpha).toBeInstanceOf(Uint8Array);
    expect(alpha.length).toBe(W * H);
    for (const [x, y] of [
      [0, 0],
      [W - 1, 0],
      [0, H - 1],
      [W - 1, H - 1],
      [19, 2],
      [2, 20],
      [37, 20],
    ]) {
      expect(at(alpha, x, y), `(${x},${y})`).toBe(0);
    }
  });

  it("keeps the object and its closed dark interior opaque", () => {
    const alpha = floodBackground(discWithDarkCore(), W, H, FLOOD);
    expect(at(alpha, 20, 20)).toBe(255); // dark core
    expect(at(alpha, 20, 18)).toBe(255); // dark core
    expect(at(alpha, 20, 11)).toBe(255); // disc body
    expect(at(alpha, 30, 20)).toBe(255); // disc body
  });

  it("does not cross a sharp colour jump (stepTol)", () => {
    const alpha = floodBackground(discWithDarkCore(), W, H, {
      seedTol: 60,
      stepTol: 4,
    });
    // The disc outline is a jump of ~180 units: nothing inside is background.
    let opaque = 0;
    for (const a of alpha) if (a === 255) opaque++;
    expect(opaque).toBeGreaterThan(400);
  });

  it("only seeds from border pixels close to the reference (seedTol)", () => {
    const rgba = discWithDarkCore();
    // The reference is the middle of the gradient: a few border pixels near it
    // are enough to seed the whole background, and a negative tolerance seeds
    // nothing, so everything stays opaque.
    const alpha = floodBackground(rgba, W, H, { seedTol: 5, stepTol: 4 });
    expect(Array.from(alpha).every((a) => a === 255)).toBe(false);
    const none = floodBackground(rgba, W, H, { seedTol: -1, stepTol: 4 });
    expect(Array.from(none).every((a) => a === 255)).toBe(true);
  });

  it("treats pixels brighter than maxLuma as foreground", () => {
    const bright = makeImage((x) => (x < 20 ? [240, 240, 240] : [10, 10, 10]));
    const alpha = floodBackground(bright, W, H, {
      seedTol: 1000,
      stepTol: 1000,
      maxLuma: 100,
    });
    expect(at(alpha, 30, 20)).toBe(0);
    expect(at(alpha, 5, 20)).toBe(255);
  });

  it("leaks into an object whose outline is open (the samples catch it)", () => {
    const alpha = floodBackground(openRing(), W, H, FLOOD);
    expect(at(alpha, 20, 20)).toBe(0);
    expect(() =>
      checkSamples(alpha, W, { corners: [[0, 0]], interior: [[20, 20]] }),
    ).toThrow(/20,20/);
  });

  it("is deterministic and does not modify its input", () => {
    const rgba = discWithDarkCore();
    const copy = rgba.slice();
    const a = floodBackground(rgba, W, H, FLOOD);
    const b = floodBackground(rgba, W, H, FLOOD);
    expect(rgba).toEqual(copy);
    expect(a).toEqual(b);
  });
});

describe("checkSamples", () => {
  const alpha = floodBackground(discWithDarkCore(), W, H, FLOOD);

  it("passes when corners are transparent and interior points opaque", () => {
    expect(() =>
      checkSamples(alpha, W, {
        corners: [
          [0, 0],
          [W - 1, H - 1],
        ],
        interior: [
          [20, 20],
          [20, 11],
        ],
      }),
    ).not.toThrow();
  });

  it("throws listing every failing sample", () => {
    let message = "";
    try {
      checkSamples(alpha, W, {
        corners: [
          [0, 0],
          [20, 20],
        ],
        interior: [
          [20, 20],
          [1, 1],
          [2, 2],
        ],
      });
    } catch (error) {
      message = error.message;
    }
    expect(message).toContain("20,20"); // opaque pixel used as a corner
    expect(message).toContain("1,1");
    expect(message).toContain("2,2");
    expect(message).not.toContain("0,0");
  });
});

describe("featherEdge", () => {
  const block = new Uint8Array(20 * 20);
  for (let y = 5; y < 15; y++) {
    for (let x = 5; x < 15; x++) block[y * 20 + x] = 255;
  }

  it("softens the outermost foreground layer and keeps the core", () => {
    const out = featherEdge(block, 20, 20, 1);
    expect(out[5 * 20 + 5]).toBeLessThan(255);
    expect(out[5 * 20 + 9]).toBeLessThan(255);
    expect(out[10 * 20 + 10]).toBe(255);
  });

  it("never adds opacity far from the object", () => {
    const out = featherEdge(block, 20, 20, 1);
    expect(out[0]).toBe(0);
    expect(out[19 * 20 + 19]).toBe(0);
  });

  it("returns an unchanged copy for 0 px", () => {
    const out = featherEdge(block, 20, 20, 0);
    expect(out).toEqual(block);
    expect(out).not.toBe(block);
  });
});

// Some originals already come with transparency, but with faint noise outside
// and almost-opaque (250-254) pixels inside: cleanAlpha normalises both ends.
describe("cleanAlpha", () => {
  it("zeroes the faint noise and makes the near-opaque pixels opaque", () => {
    const out = cleanAlpha(
      Uint8Array.from([0, 5, 15, 16, 128, 239, 240, 254, 255]),
      16,
      240,
    );
    expect(Array.from(out)).toEqual([0, 0, 0, 16, 128, 239, 255, 255, 255]);
  });

  it("does not modify its input", () => {
    const input = Uint8Array.from([5, 250]);
    cleanAlpha(input, 16, 240);
    expect(Array.from(input)).toEqual([5, 250]);
  });
});

describe("circleAlpha", () => {
  const circle = { cx: 20, cy: 20, r: 10 };

  it("is opaque inside, transparent outside and half-way on the edge", () => {
    const alpha = circleAlpha(W, H, circle, 4);
    expect(at(alpha, 20, 20)).toBe(255);
    expect(at(alpha, 0, 0)).toBe(0);
    expect(at(alpha, 30, 20)).toBeGreaterThan(100);
    expect(at(alpha, 30, 20)).toBeLessThan(160);
  });

  it("fades monotonically across the feather", () => {
    const alpha = circleAlpha(W, H, circle, 4);
    const row = [26, 28, 30, 32, 34].map((x) => at(alpha, x, 20));
    for (let i = 1; i < row.length; i++) {
      expect(row[i]).toBeLessThanOrEqual(row[i - 1]);
    }
  });
});

describe("contentBox and squarePad", () => {
  const alpha = new Uint8Array(W * H);
  for (let y = 5; y < 10; y++) {
    for (let x = 10; x < 20; x++) alpha[y * W + x] = 255;
  }

  it("returns the smallest box with a 2 % margin, inside the image", () => {
    expect(contentBox(alpha, 128, W, H)).toEqual({
      left: 9,
      top: 4,
      width: 12,
      height: 7,
    });
  });

  it("ignores pixels below the minimum alpha", () => {
    const faint = alpha.slice();
    faint[30 * W + 30] = 20;
    expect(contentBox(faint, 128, W, H)).toEqual(contentBox(alpha, 128, W, H));
  });

  it("throws when nothing reaches the minimum alpha", () => {
    expect(() => contentBox(new Uint8Array(W * H), 1, W, H)).toThrow(/empty/i);
  });

  it("squarePad makes the box square around the same centre", () => {
    const box = { left: 9, top: 4, width: 12, height: 7 };
    const square = squarePad(box);
    expect(square.width).toBe(12);
    expect(square.height).toBe(12);
    expect(square.left).toBe(9);
    expect(square.top).toBeLessThanOrEqual(box.top);
    expect(square.top + square.height).toBeGreaterThanOrEqual(
      box.top + box.height,
    );
  });
});

describe("validateRecipe", () => {
  const samples = { corners: [[0, 0]], interior: [[5, 5]] };
  const flood = {
    source: "Mac/Alien Mac.png",
    kind: "flood",
    seedTol: 30,
    stepTol: 6,
    samples,
    maxBytes: 1000,
  };
  const circle = {
    source: "Planetas/Luna.png",
    kind: "circle",
    circle: { cx: 10, cy: 10, r: 8 },
    feather: 2,
    samples,
    maxBytes: 1000,
  };
  const none = { source: "Logos/ISOLOGO.png", kind: "none", maxBytes: 1000 };

  it("accepts valid flood, circle and none recipes", () => {
    const cleaned = { ...none, cleanAlpha: { low: 16, high: 240 }, samples };
    for (const recipe of [flood, circle, none, cleaned]) {
      expect(() => validateRecipe(recipe)).not.toThrow();
    }
  });

  it.each([
    ["no source", { ...flood, source: "" }, /source/],
    ["unknown kind", { ...flood, kind: "magic" }, /kind/],
    ["stepTol <= 0", { ...flood, stepTol: 0 }, /stepTol/],
    ["radius <= 0", { ...circle, circle: { cx: 1, cy: 1, r: 0 } }, /radius|r/],
    ["flood without samples", { ...flood, samples: undefined }, /samples/],
    [
      "circle without interior samples",
      { ...circle, samples: { corners: [[0, 0]], interior: [] } },
      /samples/,
    ],
    ["no byte limit", { ...none, maxBytes: undefined }, /maxBytes/],
    [
      "cleanAlpha with low >= high",
      { ...none, cleanAlpha: { low: 200, high: 100 } },
      /cleanAlpha/,
    ],
  ])("rejects %s", (_name, recipe, message) => {
    expect(() => validateRecipe(recipe)).toThrow(message);
  });
});

describe("module boundaries", () => {
  it("cutout.mjs imports neither sharp nor the disk", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./cutout.mjs", import.meta.url)),
      "utf8",
    );
    expect(source).not.toMatch(/\bsharp\b/);
    expect(source).not.toMatch(/node:fs|from "fs"|node:child_process/);
  });

  it("an .mjs can import src/styles/tokens.ts (type stripping only, D17)", () => {
    const tokens = pathToFileURL(
      fileURLToPath(
        new URL("../../apps/web/src/styles/tokens.ts", import.meta.url),
      ),
    ).href;
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { colors, cssVariableName } from ${JSON.stringify(tokens)};` +
          "console.log(JSON.stringify([colors.bg.value, cssVariableName('bgDark')]));",
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(output)).toEqual(["#34006F", "--color-bg-dark"]);
  });
});
