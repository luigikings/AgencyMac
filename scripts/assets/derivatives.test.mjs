import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { colors } from "../../apps/web/src/styles/tokens.ts";
import { checkSamples, validateRecipe } from "./cutout.mjs";
import { MANIFEST } from "./manifest.mjs";

// The versioned derivatives (spec 004, RF-20 to RF-23, RNF-6). They are
// checked without Assets/, so this runs the same in CI. Which original made
// each one is checked by `pnpm assets:check`, not here.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const sharp = createRequire(import.meta.url)("sharp");

// Derivatives produced so far: logo, isologo, icons and social image (T4).
// The cut-outs of Mac, the Moon and the planets arrive in T5.
const T4_OUTPUTS = [
  "apps/web/src/assets/brand/logo-white-letters.png",
  "apps/web/src/assets/brand/isologo.png",
  "apps/web/public/favicon-48.png",
  "apps/web/public/apple-touch-icon.png",
  "apps/web/public/logo-512.png",
  "apps/web/public/og-default.png",
];

// Plan section 3: exact size of the square icons and the social image.
const EXACT_SIZE = {
  "apps/web/public/favicon-48.png": [48, 48],
  "apps/web/public/apple-touch-icon.png": [180, 180],
  "apps/web/public/logo-512.png": [512, 512],
  "apps/web/public/og-default.png": [1200, 630],
};
// Plan section 3: maximum size of the logos (their ratio is the content's).
const MAX_SIZE = {
  "apps/web/src/assets/brand/logo-white-letters.png": [960, 640],
  "apps/web/src/assets/brand/isologo.png": [360, 640],
};
// Transparent background (alpha 0 in the corners); the rest are opaque on a
// brand colour.
const TRANSPARENT = new Set([
  "apps/web/src/assets/brand/logo-white-letters.png",
  "apps/web/src/assets/brand/isologo.png",
  "apps/web/public/logo-512.png",
]);
const OPAQUE_ON = {
  "apps/web/public/favicon-48.png": "bgDark",
  "apps/web/public/apple-touch-icon.png": "bgDark",
  "apps/web/public/og-default.png": "bg",
};

const entry = (output) => MANIFEST.find((item) => item.output === output);
const abs = (output) => join(ROOT, output);

async function readRgba(output) {
  const { data, info } = await sharp(abs(output))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [
    ...data.subarray((y * info.width + x) * 4).subarray(0, 4),
  ];
  return { data, info, pixel };
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

describe("manifest of the T4 derivatives", () => {
  it.each(T4_OUTPUTS)(
    "%s has a valid recipe and its original's hash",
    (output) => {
      const item = entry(output);
      expect(item, "listed in the manifest").toBeDefined();
      expect(item.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(() =>
        validateRecipe({
          source: item.original,
          kind: item.recipe.kind,
          maxBytes: item.maxBytes,
        }),
      ).not.toThrow();
    },
  );
});

describe.each(T4_OUTPUTS)("derivative %s", (output) => {
  it("exists and weighs no more than its budget (RNF-6)", () => {
    expect(existsSync(abs(output))).toBe(true);
    expect(statSync(abs(output)).size).toBeLessThanOrEqual(
      entry(output).maxBytes,
    );
  });

  it("is a PNG with the planned dimensions", async () => {
    const meta = await sharp(abs(output)).metadata();
    expect(meta.format).toBe("png");
    if (EXACT_SIZE[output]) {
      expect([meta.width, meta.height]).toEqual(EXACT_SIZE[output]);
    } else {
      const [maxW, maxH] = MAX_SIZE[output];
      expect(meta.width).toBeLessThanOrEqual(maxW);
      expect(meta.height).toBeLessThanOrEqual(maxH);
      // At least one side uses the full budget: not needlessly small.
      expect(meta.width === maxW || meta.height === maxH).toBe(true);
    }
  });

  it("has the planned background", async () => {
    const { info, pixel, data } = await readRgba(output);
    const corners = [
      pixel(0, 0),
      pixel(info.width - 1, 0),
      pixel(0, info.height - 1),
      pixel(info.width - 1, info.height - 1),
    ];
    if (TRANSPARENT.has(output)) {
      for (const corner of corners) expect(corner[3]).toBe(0);
      let opaque = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] === 255) opaque++;
      expect(opaque).toBeGreaterThan(info.width * info.height * 0.03);
    } else {
      const expected = hexToRgb(colors[OPAQUE_ON[output]].value);
      for (const corner of corners) {
        expect(corner).toEqual([...expected, 255]);
      }
      // The mark is drawn on top: not every pixel is background.
      let different = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== expected[0] || data[i + 1] !== expected[1]) different++;
      }
      expect(different).toBeGreaterThan(info.width * info.height * 0.03);
    }
  });
});

describe("the white-letters logo", () => {
  it("has light pixels (white letters) and orange pixels (MAC)", async () => {
    const { data } = await readRgba(
      "apps/web/src/assets/brand/logo-white-letters.png",
    );
    let white = 0;
    let orange = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) white++;
      if (data[i] > 200 && data[i + 1] < 190 && data[i + 2] < 60) orange++;
    }
    expect(white).toBeGreaterThan(500);
    expect(orange).toBeGreaterThan(500);
  });
});

describe("assets:check without the originals folder", () => {
  it("fails with a clear message", () => {
    const result = spawnSync(
      process.execPath,
      [join(ROOT, "scripts/assets/build-derivatives.mjs"), "--check"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          AGENCYMAC_ASSETS_DIR: join(tmpdir(), "agencymac-no-assets-folder"),
        },
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Assets/);
    expect(result.stderr).toMatch(/not found|missing/i);
  });
});

// Cut-outs of Mac, the Moon and the planets (T5, RF-22). The originals already
// carry transparency; the recipe cleans it and the samples (derivative
// coordinates, saved in the manifest) prove that the outside is transparent and
// that dark areas inside the drawing (Mac's eyes, planet spots) stay opaque.
const T5_OUTPUTS = [
  "apps/web/src/assets/brand/mac.webp",
  "apps/web/src/assets/brand/moon.webp",
  "apps/web/src/assets/brand/planet-hexaweb.webp",
  "apps/web/src/assets/brand/planet-rankia.webp",
  "apps/web/src/assets/brand/planet-adara.webp",
  "apps/web/src/assets/brand/planet-earth.webp",
];

async function readAlpha(output) {
  const { data, info } = await sharp(abs(output))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let p = 0; p < alpha.length; p++) alpha[p] = data[p * 4 + 3];
  return { alpha, info };
}

describe.each(T5_OUTPUTS)("cut-out %s", (output) => {
  it("is in the manifest with its original's hash and samples", () => {
    const item = entry(output);
    expect(item).toBeDefined();
    expect(item.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(item.recipe.samples.corners.length).toBeGreaterThanOrEqual(8);
    expect(item.recipe.samples.interior.length).toBeGreaterThanOrEqual(1);
    expect(() =>
      validateRecipe({
        source: item.original,
        kind: item.recipe.kind,
        maxBytes: item.maxBytes,
        cleanAlpha: item.recipe.cleanAlpha,
        samples: item.recipe.samples,
      }),
    ).not.toThrow();
  });

  it("exists, is a square WebP within its size and weight budget", async () => {
    const item = entry(output);
    expect(existsSync(abs(output))).toBe(true);
    expect(statSync(abs(output)).size).toBeLessThanOrEqual(item.maxBytes);
    const meta = await sharp(abs(output)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(meta.height);
    expect(meta.width).toBeLessThanOrEqual(item.recipe.maxWidth);
    expect(meta.hasAlpha).toBe(true);
  });

  it("has transparent corners and edge midpoints, and opaque interior samples", async () => {
    const { samples } = entry(output).recipe;
    const { alpha, info } = await readAlpha(output);
    // The samples are inside the image and cover the four corners and the
    // midpoints of the four edges.
    for (const [x, y] of [...samples.corners, ...samples.interior]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(info.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(info.height);
    }
    const key = (list) => new Set(list.map(([x, y]) => `${x},${y}`));
    const mid = info.width >> 1;
    const last = info.width - 1;
    for (const point of [
      [0, 0],
      [last, 0],
      [0, last],
      [last, last],
      [mid, 0],
      [mid, last],
      [0, mid],
      [last, mid],
    ]) {
      expect(key(samples.corners)).toContain(point.join(","));
    }
    expect(() => checkSamples(alpha, info.width, samples)).not.toThrow();
  });

  it("has no faint haze: every pixel is transparent or clearly drawn", async () => {
    const { alpha, info } = await readAlpha(output);
    const { width, height } = info;
    // cleanAlpha zeroes the faint noise of the original. Scaling down leaves a
    // one-pixel anti-aliasing tail around the outline, which is fine; what is
    // not allowed is faint pixels with no clearly drawn pixel within 2 px.
    const strong = (x, y) =>
      x >= 0 &&
      y >= 0 &&
      x < width &&
      y < height &&
      alpha[y * width + x] >= 128;
    const isolated = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = alpha[y * width + x];
        // Alpha below 8 is resampling ripple next to the outline (invisible);
        // 8 to 15 far from any drawn pixel would be haze.
        if (a < 8 || a >= 16) continue;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) {
          for (let dx = -2; dx <= 2 && !near; dx++)
            near = strong(x + dx, y + dy);
        }
        if (!near) isolated.push(`${x},${y}`);
      }
    }
    expect(isolated.slice(0, 5)).toEqual([]);
  });
});

describe("Mac's cut-out keeps its eyes", () => {
  it("lists dark interior samples that are opaque and dark", async () => {
    const output = "apps/web/src/assets/brand/mac.webp";
    const { interior } = entry(output).recipe.samples;
    const { data, info } = await readRgba(output);
    const dark = interior.filter(([x, y]) => {
      const i = (y * info.width + x) * 4;
      return data[i + 3] === 255 && data[i] + data[i + 1] + data[i + 2] < 240;
    });
    expect(dark.length).toBeGreaterThanOrEqual(2);
  });
});

// Provenance (RF-23): the README next to the brand images lists every
// derivative with its original and the original's SHA-256.
describe("brand README", () => {
  const readme = readFileSync(
    join(ROOT, "apps/web/src/assets/brand/README.md"),
    "utf8",
  );

  it.each(MANIFEST.map((item) => [item.output, item]))(
    "lists %s with its original and hash",
    (output, item) => {
      expect(readme).toContain(output.replace("apps/web/", ""));
      expect(readme).toContain(item.original);
      expect(readme).toContain(item.sha256);
    },
  );
});

describe("LICENSE-BRAND.md", () => {
  const license = readFileSync(join(ROOT, "LICENSE-BRAND.md"), "utf8");

  it("covers logos, Mac, planets, texts, favicon and derivatives", () => {
    for (const word of [
      /logo/i,
      /Mac/,
      /planetas/i,
      /textos/i,
      /favicon/i,
      /recortes/i,
    ]) {
      expect(license).toMatch(word);
    }
  });

  it("cites GSAP, Lenis and sharp as third parties", () => {
    for (const name of ["GSAP", "Lenis", "sharp"]) {
      expect(license).toContain(name);
    }
  });
});
