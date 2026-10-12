// Single table of the image derivatives that may live in the repository.
// Each entry maps a derivative (output, relative to the repo root) to the only
// original it comes from (path inside the untracked Assets/ folder).
//
// Only the 8 originals the home page uses are named here. The recipe says how
// build-derivatives.mjs makes the derivative; entries with `recipe: null` and
// `sha256: null` are filled in by T5 (cut-outs of Mac, the Moon and planets).
// Spec 004, plan section 3.

/**
 * @typedef {object} Recipe
 * @property {"none"|"flood"|"circle"} kind How the background is removed;
 *   "none" for originals that already have a transparent background.
 * @property {"content"} crop Crop to the content (alpha) with a small margin.
 * @property {number} [maxWidth] Fit inside this box (logos).
 * @property {number} [maxHeight]
 * @property {number} [size] Square icon of size x size.
 * @property {number} [padding] Icon margin, as a fraction of the size.
 * @property {[number, number]} [canvas] Canvas of width x height (social image).
 * @property {number} [markWidth] Social image: mark box, as a fraction of the
 *   canvas width.
 * @property {number} [markHeight] Same, of the canvas height.
 * @property {string|null} [background] Name of a colour token, or null/absent
 *   for a transparent background.
 */

/**
 * @typedef {object} ManifestEntry
 * @property {string} output Derivative path, relative to the repo root.
 * @property {string} original Original path inside Assets/.
 * @property {string|null} sha256 SHA-256 of the original, to detect changes.
 * @property {Recipe|null} recipe How the derivative is made.
 * @property {number} maxBytes Maximum file size of the derivative.
 */

const LOGO_SHA =
  "4ec8c91efd73506e692c987d66f0d670e81a083f38aaa66b0de447a0896de774";
const ISOLOGO_SHA =
  "a8b138646529c11314a5c5c104c502b88cd6fd8fe9641fca7a6571800f73b8bf";

/**
 * Points that must be transparent in a square cut-out of `size` pixels: the
 * four corners and the midpoints of the four edges.
 */
function edgeSamples(size) {
  const last = size - 1;
  const mid = size >> 1;
  return [
    [0, 0],
    [last, 0],
    [0, last],
    [last, last],
    [mid, 0],
    [mid, last],
    [0, mid],
    [last, mid],
  ];
}

/** @type {ManifestEntry[]} */
export const MANIFEST = [
  {
    output: "apps/web/src/assets/brand/logo-white-letters.png",
    original: "Logos/IMAGOLOGO LETRAS BLANCAS.png",
    sha256: LOGO_SHA,
    recipe: { kind: "none", crop: "content", maxWidth: 960, maxHeight: 640 },
    maxBytes: 40 * 1024,
  },
  {
    output: "apps/web/src/assets/brand/isologo.png",
    original: "Logos/ISOLOGO.png",
    sha256: ISOLOGO_SHA,
    recipe: { kind: "none", crop: "content", maxWidth: 360, maxHeight: 640 },
    maxBytes: 30 * 1024,
  },
  {
    output: "apps/web/src/assets/brand/mac.webp",
    original: "Mac/Alien Mac.png",
    sha256: "ab10af543278c269f30f710cf2aa32c3f5be88afa12c67b5ab2963890ce85d2c",
    recipe: {
      kind: "none",
      cleanAlpha: { low: 16, high: 240 },
      maxWidth: 768,
      quality: 80,
      samples: {
        corners: edgeSamples(768),
        // Both eyes, the saucer's dark base and the middle of the body.
        interior: [
          [318, 248],
          [486, 252],
          [371, 717],
          [384, 398],
        ],
      },
    },
    maxBytes: 200 * 1024,
  },
  {
    output: "apps/web/src/assets/brand/moon.webp",
    original: "Planetas/Luna.png",
    sha256: "1dd4fd3b6493d1a4aa244ab8581ecf1065f465f92c19bdf12c4f9a9e114c8d36",
    recipe: {
      kind: "none",
      cleanAlpha: { low: 16, high: 240 },
      maxWidth: 768,
      quality: 80,
      samples: {
        // 733 px: the Moon's content box, squared, is smaller than the limit.
        corners: edgeSamples(733),
        interior: [
          [366, 366],
          [256, 294],
          [476, 440],
        ],
      },
    },
    maxBytes: 120 * 1024,
  },
  {
    output: "apps/web/src/assets/brand/planet-hexaweb.webp",
    original: "Planetas/Hexaweb - Desarrollo web.png",
    sha256: "3d8bfe0e235c4c6e3f6f2fb9258ae766b22890e9b49e00cccac36db8971a2d58",
    recipe: {
      kind: "none",
      cleanAlpha: { low: 16, high: 240 },
      maxWidth: 640,
      quality: 80,
      samples: {
        corners: edgeSamples(640),
        interior: [
          [316, 320],
          [224, 256],
          [416, 384],
        ],
      },
    },
    maxBytes: 90 * 1024,
  },
  {
    output: "apps/web/src/assets/brand/planet-rankia.webp",
    original: "Planetas/Rankia - Posicionamiento.png",
    sha256: "ded700b3b510f7b56ac7883834b38a93269a536149e13d3da660afee6d21dab1",
    recipe: {
      kind: "none",
      cleanAlpha: { low: 16, high: 240 },
      maxWidth: 640,
      quality: 80,
      samples: {
        corners: edgeSamples(640),
        interior: [
          [316, 322],
          [224, 256],
          [416, 384],
        ],
      },
    },
    maxBytes: 90 * 1024,
  },
  {
    output: "apps/web/src/assets/brand/planet-adara.webp",
    original: "Planetas/Adara - Publicidad pagada SEM.png",
    sha256: "48f8d531bd28eb2b9520dfbaf9ee00891c67b771fa24638080c1a1de86a9f778",
    recipe: {
      kind: "none",
      cleanAlpha: { low: 16, high: 240 },
      maxWidth: 640,
      quality: 80,
      samples: {
        corners: edgeSamples(640),
        interior: [
          [320, 320],
          [224, 256],
          [416, 384],
        ],
      },
    },
    maxBytes: 90 * 1024,
  },
  {
    // Optional: omitted in T5 if it does not fit the design.
    output: "apps/web/src/assets/brand/planet-earth.webp",
    original: "Planetas/Tierra.png",
    sha256: "85e52092d5c90cc1c3cdee425149b1b49696c8690a404a9666f5f052f383b35d",
    recipe: {
      kind: "none",
      cleanAlpha: { low: 16, high: 240 },
      maxWidth: 320,
      quality: 80,
      samples: {
        corners: edgeSamples(320),
        interior: [
          [160, 160],
          [112, 128],
          [208, 192],
        ],
      },
    },
    maxBytes: 40 * 1024,
  },
  {
    output: "apps/web/public/favicon-48.png",
    original: "Logos/ISOLOGO.png",
    sha256: ISOLOGO_SHA,
    recipe: {
      kind: "none",
      crop: "content",
      size: 48,
      padding: 0.1,
      background: "bgDark",
    },
    maxBytes: 6 * 1024,
  },
  {
    output: "apps/web/public/apple-touch-icon.png",
    original: "Logos/ISOLOGO.png",
    sha256: ISOLOGO_SHA,
    recipe: {
      kind: "none",
      crop: "content",
      size: 180,
      padding: 0.16,
      background: "bgDark",
    },
    maxBytes: 20 * 1024,
  },
  {
    output: "apps/web/public/logo-512.png",
    original: "Logos/ISOLOGO.png",
    sha256: ISOLOGO_SHA,
    recipe: { kind: "none", crop: "content", size: 512, padding: 0.06 },
    maxBytes: 40 * 1024,
  },
  {
    output: "apps/web/public/og-default.png",
    original: "Logos/IMAGOLOGO LETRAS BLANCAS.png",
    sha256: LOGO_SHA,
    recipe: {
      kind: "none",
      crop: "content",
      canvas: [1200, 630],
      markWidth: 0.62,
      markHeight: 0.6,
      background: "bg",
    },
    maxBytes: 80 * 1024,
  },
];
