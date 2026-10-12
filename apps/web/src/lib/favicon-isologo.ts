// Favicon of the isologo (spec 004, RF-20, decision D8): the rocket redrawn by
// hand with three flat shapes of at most 12 points each, so it stays sharp at
// 16 px. The colours always come from the brand tokens, so no hex is written
// here. `buildFaviconSvg` (the provisional disc of spec 002) is untouched.

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export type IsologoPalette = {
  /** Rounded square behind the rocket. */
  background: string;
  /** Rocket body (logo gradient, first stop). */
  body: string;
  /** Fins and the sides of the flame (logo gradient, second stop). */
  shade: string;
  /** Inner flame. */
  flame: string;
};

type Point = readonly [number, number];

export type IsologoShape = {
  role: keyof Omit<IsologoPalette, "background">;
  /** Closed outlines in isologo pixel coordinates (323 x 640). */
  contours: readonly (readonly Point[])[];
};

// Painted in this order: the fins behind the body, the flame on top.
export const ISOLOGO_SHAPES: readonly IsologoShape[] = [
  {
    role: "shade",
    contours: [
      // Left fin.
      [
        [100, 268],
        [45, 295],
        [12, 345],
        [20, 382],
        [82, 360],
      ],
      // Right fin.
      [
        [262, 318],
        [292, 375],
        [272, 470],
        [232, 415],
      ],
      // Right side of the flame.
      [
        [188, 425],
        [207, 485],
        [155, 580],
      ],
    ],
  },
  {
    role: "body",
    contours: [
      // Hull.
      [
        [300, 2],
        [255, 30],
        [170, 110],
        [115, 230],
        [80, 360],
        [232, 418],
        [275, 300],
        [295, 150],
      ],
      // Window (cut out with the even-odd rule).
      [
        [245, 130],
        [183, 243],
        [233, 265],
      ],
    ],
  },
  {
    role: "flame",
    contours: [
      [
        [100, 398],
        [160, 405],
        [190, 440],
        [190, 480],
        [165, 520],
        [80, 580],
        [40, 640],
        [45, 590],
        [50, 480],
        [75, 420],
      ],
    ],
  },
];

// The 640 px tall isologo is scaled to 28 units and centred in a 32 x 32 box.
const SCALE = 28 / 640;
const OFFSET_X = (32 - 323 * SCALE) / 2;
const OFFSET_Y = 2;

const round = (value: number) => Number(value.toFixed(2));

function pathData(contours: IsologoShape["contours"]): string {
  return contours
    .map(
      (contour) =>
        contour
          .map(([x, y], index) => {
            const px = round(OFFSET_X + x * SCALE);
            const py = round(OFFSET_Y + y * SCALE);
            return `${index === 0 ? "M" : "L"}${px} ${py}`;
          })
          .join("") + "Z",
    )
    .join("");
}

/** SVG favicon of the isologo on a rounded dark square. */
export function buildIsologoFaviconSvg(palette: IsologoPalette): string {
  for (const color of Object.values(palette)) {
    if (!HEX_COLOR.test(color)) {
      throw new Error(`Favicon colours must be a hex colour, got "${color}"`);
    }
  }
  const paths = ISOLOGO_SHAPES.map(
    (shape) =>
      `<path d="${pathData(shape.contours)}" fill="${palette[shape.role]}"` +
      `${shape.contours.length > 1 && shape.role === "body" ? ' fill-rule="evenodd"' : ""}/>`,
  ).join("");
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    `<rect width="32" height="32" rx="7" fill="${palette.background}"/>` +
    paths +
    "</svg>\n"
  );
}
