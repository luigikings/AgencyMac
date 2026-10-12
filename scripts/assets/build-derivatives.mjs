// CLI that makes the image derivatives of the manifest from the untracked
// Assets/ folder (spec 004, RF-20 to RF-23).
//
//   pnpm assets:build   reads the originals, checks their SHA-256, writes the
//                       derivatives under apps/web/ (checking the byte budget
//                       and, for cut-outs, the pixel samples first).
//   pnpm assets:check   only checks that the originals match the manifest.
//   --out-dir <folder>  writes the files there (previews) instead of the repo.
//
// It only opens the originals the manifest names. The folder can be moved
// with AGENCYMAC_ASSETS_DIR. Pixel logic lives in cutout.mjs (tested without
// disk); this file reads, resizes and writes.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { colors } from "../../apps/web/src/styles/tokens.ts";
import {
  checkSamples,
  cleanAlpha,
  contentBox,
  squarePad,
  validateRecipe,
} from "./cutout.mjs";
import { MANIFEST } from "./manifest.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const ALPHA_MIN = 16;
const PNG_OPTIONS = {
  palette: true,
  quality: 90,
  effort: 10,
  compressionLevel: 9,
};

function fail(message) {
  console.error(`assets: ${message}`);
  process.exit(1);
}

function assetsDir() {
  return resolve(process.env.AGENCYMAC_ASSETS_DIR ?? join(ROOT, "Assets"));
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function backgroundOf(name) {
  if (!name) return { r: 0, g: 0, b: 0, alpha: 0 };
  const token = colors[name];
  if (!token) fail(`unknown colour token "${name}" in the manifest`);
  const [r, g, b] = [1, 3, 5].map((i) =>
    parseInt(token.value.slice(i, i + 2), 16),
  );
  return { r, g, b, alpha: 1 };
}

/** Original cropped to its content (alpha) as an RGBA PNG buffer. */
async function croppedOriginal(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let p = 0; p < alpha.length; p++) alpha[p] = data[p * 4 + 3];
  const box = contentBox(alpha, ALPHA_MIN, info.width, info.height);
  return sharp(file).ensureAlpha().extract(box).png().toBuffer();
}

/** Mark scaled into `width` x `height` and centred on a canvas of its own. */
async function markOnCanvas(cropped, [canvasW, canvasH], [boxW, boxH], bg) {
  const mark = await sharp(cropped)
    .resize({ width: boxW, height: boxH, fit: "inside" })
    .png()
    .toBuffer();
  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: bg },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png(PNG_OPTIONS)
    .toBuffer();
}

/**
 * Cut-out of an original that already has transparency (Mac, Moon, planets):
 * cleans the alpha, crops to the content, makes it square, scales it down and
 * writes WebP. The pixel samples of the recipe are checked on the final alpha
 * before anything is returned.
 */
async function renderCutout(entry, originalFile, { requireSamples }) {
  const { recipe } = entry;
  const { data, info } = await sharp(originalFile)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let p = 0; p < alpha.length; p++) alpha[p] = data[p * 4 + 3];
  const cleaned = cleanAlpha(
    alpha,
    recipe.cleanAlpha.low,
    recipe.cleanAlpha.high,
  );
  for (let p = 0; p < cleaned.length; p++) data[p * 4 + 3] = cleaned[p];

  const box = contentBox(
    cleaned,
    recipe.cleanAlpha.low,
    info.width,
    info.height,
  );
  const cropped = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(box)
    .png()
    .toBuffer();
  const square = squarePad({
    left: 0,
    top: 0,
    width: box.width,
    height: box.height,
  });
  const padded = await sharp({
    create: {
      width: square.width,
      height: square.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, left: -square.left, top: -square.top }])
    .png()
    .toBuffer();
  const { data: finalRaw, info: finalInfo } = await sharp(padded)
    .resize({
      width: recipe.maxWidth,
      height: recipe.maxWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const finalAlpha = new Uint8Array(finalInfo.width * finalInfo.height);
  for (let p = 0; p < finalAlpha.length; p++)
    finalAlpha[p] = finalRaw[p * 4 + 3];
  if (recipe.samples) {
    checkSamples(finalAlpha, finalInfo.width, recipe.samples);
  } else if (requireSamples) {
    throw new Error(
      `${entry.output}: the recipe has no samples (the cut-out is ${finalInfo.width}x${finalInfo.height})`,
    );
  } else {
    console.log(
      `assets: ${entry.output} is ${finalInfo.width}x${finalInfo.height} (no samples checked)`,
    );
  }
  return sharp(finalRaw, {
    raw: { width: finalInfo.width, height: finalInfo.height, channels: 4 },
  })
    .webp({
      quality: recipe.quality ?? 80,
      alphaQuality: 100,
      effort: 6,
    })
    .toBuffer();
}

async function render(entry, originalFile, options) {
  const { recipe } = entry;
  validateRecipe({
    source: entry.original,
    kind: recipe.kind,
    maxBytes: entry.maxBytes,
    cleanAlpha: recipe.cleanAlpha,
    samples: recipe.samples,
  });
  if (recipe.cleanAlpha) return renderCutout(entry, originalFile, options);
  if (recipe.kind !== "none") {
    throw new Error(`${entry.output}: recipe kind "${recipe.kind}" is for T5`);
  }
  const cropped = await croppedOriginal(originalFile);
  const bg = backgroundOf(recipe.background);

  if (recipe.size) {
    const inner = Math.round(recipe.size * (1 - 2 * recipe.padding));
    return markOnCanvas(
      cropped,
      [recipe.size, recipe.size],
      [inner, inner],
      bg,
    );
  }
  if (recipe.canvas) {
    const [w, h] = recipe.canvas;
    const box = [
      Math.round(w * recipe.markWidth),
      Math.round(h * recipe.markHeight),
    ];
    return markOnCanvas(cropped, recipe.canvas, box, bg);
  }
  return sharp(cropped)
    .resize({
      width: recipe.maxWidth,
      height: recipe.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png(PNG_OPTIONS)
    .toBuffer();
}

async function main() {
  const check = process.argv.includes("--check");
  // `--out-dir <folder>` writes the previews there instead of into the repo.
  const outFlag = process.argv.indexOf("--out-dir");
  const outDir = outFlag >= 0 ? resolve(process.argv[outFlag + 1]) : null;
  const dir = assetsDir();
  if (!existsSync(dir)) {
    fail(
      `Assets folder not found at ${dir}. The originals are not versioned: ` +
        "copy them there (or set AGENCYMAC_ASSETS_DIR) and run it again.",
    );
  }

  // Check every original the manifest knows a hash for, once each.
  const hashed = new Map();
  for (const entry of MANIFEST) {
    if (entry.sha256) hashed.set(entry.original, entry.sha256);
  }
  const mismatches = [];
  for (const [original, expected] of hashed) {
    const file = join(dir, original);
    if (!existsSync(file)) {
      mismatches.push(`${original}: missing`);
    } else if (sha256(file) !== expected) {
      mismatches.push(`${original}: SHA-256 differs from the manifest`);
    }
  }
  if (mismatches.length > 0) fail(mismatches.join("; "));
  console.log(`assets: ${hashed.size} originals match the manifest`);
  if (check) return;

  for (const entry of MANIFEST) {
    if (!entry.recipe) {
      console.log(`assets: skipped ${entry.output} (no recipe yet)`);
      continue;
    }
    const buffer = await render(entry, join(dir, entry.original), {
      // A preview in another folder may omit the samples; the real build may not.
      requireSamples: !outDir,
    });
    if (buffer.length > entry.maxBytes) {
      fail(
        `${entry.output} would weigh ${buffer.length} bytes (limit ${entry.maxBytes}); lower the size or quality`,
      );
    }
    const target = join(outDir ?? ROOT, entry.output);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, buffer);
    console.log(`assets: wrote ${entry.output} (${buffer.length} bytes)`);
  }
}

main().catch((error) => fail(error.message));
