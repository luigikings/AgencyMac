// Pure pixel logic for the image cut-outs (spec 004, RF-22, plan section 6).
// It works on plain RGBA buffers and alpha masks: it imports neither the image
// library nor the disk, so it can be tested with synthetic images. The CLI
// (build-derivatives.mjs) does the reading, resizing and writing.

const RECIPE_KINDS = ["flood", "circle", "none"];

function luma(rgba, i) {
  return 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
}

function colorDistance(rgba, i, j) {
  return Math.hypot(
    rgba[i] - rgba[j],
    rgba[i + 1] - rgba[j + 1],
    rgba[i + 2] - rgba[j + 2],
  );
}

/** Per-channel median of the four corner pixels. */
function cornerReference(rgba, w, h) {
  const corners = [0, w - 1, (h - 1) * w, (h - 1) * w + w - 1].map(
    (pixel) => pixel * 4,
  );
  return [0, 1, 2].map((channel) => {
    const values = corners.map((i) => rgba[i + channel]).sort((a, b) => a - b);
    return (values[1] + values[2]) / 2;
  });
}

/**
 * Alpha mask (0 = background, 255 = object) of the background connected to the
 * image border. The fill starts at border pixels close to the corner colour
 * (`seedTol`) and moves to 4-connected neighbours whose colour differs from the
 * current pixel by at most `stepTol`, so gradual changes (vignette, glow) stay
 * background while an abrupt outline stops it. Whatever the outline encloses is
 * never reached and stays opaque. Pixels brighter than `maxLuma` are never
 * background.
 */
export function floodBackground(
  rgba,
  w,
  h,
  { seedTol, stepTol, maxLuma = 255 },
) {
  const [refR, refG, refB] = cornerReference(rgba, w, h);
  const background = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const seed = (pixel) => {
    if (background[pixel]) return;
    const i = pixel * 4;
    const d = Math.hypot(
      rgba[i] - refR,
      rgba[i + 1] - refG,
      rgba[i + 2] - refB,
    );
    if (d <= seedTol && luma(rgba, i) <= maxLuma) {
      background[pixel] = 1;
      queue[tail++] = pixel;
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }

  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % w;
    const y = (pixel - x) / w;
    const neighbours = [
      x > 0 ? pixel - 1 : -1,
      x < w - 1 ? pixel + 1 : -1,
      y > 0 ? pixel - w : -1,
      y < h - 1 ? pixel + w : -1,
    ];
    for (const next of neighbours) {
      if (next < 0 || background[next]) continue;
      const i = next * 4;
      if (
        luma(rgba, i) <= maxLuma &&
        colorDistance(rgba, i, pixel * 4) <= stepTol
      ) {
        background[next] = 1;
        queue[tail++] = next;
      }
    }
  }

  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < alpha.length; p++) alpha[p] = background[p] ? 0 : 255;
  return alpha;
}

/**
 * Cleans an alpha mask that is already nearly right: values below `low` become
 * 0 (faint noise outside) and values from `high` up become 255 (almost-opaque
 * pixels inside). Values in between (the anti-aliased outline) are kept.
 */
export function cleanAlpha(alpha, low, high) {
  const out = new Uint8Array(alpha.length);
  for (let p = 0; p < alpha.length; p++) {
    const a = alpha[p];
    out[p] = a < low ? 0 : a >= high ? 255 : a;
  }
  return out;
}

/**
 * Erodes the object `px` pixels (square window) and softens the result with a
 * 3x3 average, so the outline has no halo strip. `px` 0 returns a copy.
 */
export function featherEdge(alpha, w, h, px) {
  if (px <= 0) return alpha.slice();
  const eroded = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let min = 255;
      for (let dy = -px; dy <= px && min > 0; dy++) {
        for (let dx = -px; dx <= px; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const value =
            nx < 0 || ny < 0 || nx >= w || ny >= h ? 0 : alpha[ny * w + nx];
          if (value < min) min = value;
        }
      }
      eroded[y * w + x] = min;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h)
            sum += eroded[ny * w + nx];
        }
      }
      out[y * w + x] = Math.round(sum / 9);
    }
  }
  return out;
}

/** Circular mask: opaque inside, transparent outside, soft over `feather` px. */
export function circleAlpha(w, h, { cx, cy, r }, feather) {
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const t = feather > 0 ? (r - d) / feather + 0.5 : d <= r ? 1 : 0;
      alpha[y * w + x] = Math.round(Math.min(1, Math.max(0, t)) * 255);
    }
  }
  return alpha;
}

/**
 * Smallest box holding every pixel with alpha >= `min`, plus a margin of 2 %
 * of its longest side (at least 1 px), clamped to the image.
 */
export function contentBox(alpha, min, w, h) {
  let left = w;
  let top = h;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] >= min) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) throw new Error("Cannot crop: the mask is empty");
  const margin = Math.max(
    1,
    Math.ceil(0.02 * Math.max(right - left + 1, bottom - top + 1)),
  );
  const l = Math.max(0, left - margin);
  const t = Math.max(0, top - margin);
  const r = Math.min(w - 1, right + margin);
  const b = Math.min(h - 1, bottom + margin);
  return { left: l, top: t, width: r - l + 1, height: b - t + 1 };
}

/**
 * Square box with the same centre. It may extend past the image: the caller
 * fills the extra area with transparency.
 */
export function squarePad({ left, top, width, height }) {
  const size = Math.max(width, height);
  return {
    left: left - Math.floor((size - width) / 2),
    top: top - Math.floor((size - height) / 2),
    width: size,
    height: size,
  };
}

/**
 * Checks the mask on known points: `corners` must be transparent and `interior`
 * (Mac's eyes, dark areas of the planets) must be opaque. Throws listing every
 * failing sample, so no cut-out is written when the fill went wrong.
 */
export function checkSamples(alpha, w, { corners = [], interior = [] }) {
  const failures = [];
  for (const [x, y] of corners) {
    const value = alpha[y * w + x];
    if (value !== 0) {
      failures.push(`outside ${x},${y} has alpha ${value} (expected 0)`);
    }
  }
  for (const [x, y] of interior) {
    const value = alpha[y * w + x];
    if (value !== 255) {
      failures.push(`inside ${x},${y} has alpha ${value} (expected 255)`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Cut-out samples failed: ${failures.join("; ")}`);
  }
}

/** Throws a clear error when a derivative recipe is incomplete or invalid. */
export function validateRecipe(recipe) {
  const fail = (message) => {
    throw new Error(`Invalid recipe: ${message}`);
  };
  if (!recipe || typeof recipe.source !== "string" || recipe.source === "") {
    fail("missing source");
  }
  if (!RECIPE_KINDS.includes(recipe.kind)) {
    fail(`kind must be one of ${RECIPE_KINDS.join(", ")}`);
  }
  if (!(recipe.maxBytes > 0)) fail("maxBytes must be a positive number");
  if (recipe.cleanAlpha) {
    const { low, high } = recipe.cleanAlpha;
    if (!(low >= 0 && high <= 255 && low < high)) {
      fail("cleanAlpha needs 0 <= low < high <= 255");
    }
  }
  if (recipe.kind === "none") return;

  if (recipe.kind === "flood") {
    if (!(recipe.stepTol > 0)) fail("stepTol must be greater than 0");
    if (!(recipe.seedTol >= 0)) fail("seedTol must be 0 or more");
  } else if (!(recipe.circle?.r > 0)) {
    fail("circle radius must be greater than 0");
  }
  const { corners, interior } = recipe.samples ?? {};
  if (!corners?.length || !interior?.length) {
    fail("samples need at least one corner and one interior point");
  }
}
