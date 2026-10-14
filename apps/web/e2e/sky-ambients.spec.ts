import { expect, test, type Page } from "@playwright/test";
import { AMBIENT_ZONES } from "../src/lib/site-data";
import { AMBIENTS } from "../src/lib/sky/ambients";
import { colors } from "../src/styles/tokens";
import { homePages } from "./pages";
import { textContrastByPixels } from "./pixel-contrast";

// Spec 005, T13: the 7 ambients (RF-5), their 10 rem fades (RF-6), the solid
// base of each planet block (RF-7) and the readability of every text on the sky
// measured on the pixels (RF-8, RNF-9).
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.describe("Ambients without JavaScript (RF-5, RF-7)", () => {
  test.use({ javaScriptEnabled: false });

  for (const { path } of homePages) {
    test(`${path}: 7 zones, each with its own solid base and glow`, async ({
      page,
    }) => {
      await page.goto(path);
      const zones = await page.evaluate(
        (selectors) => {
          return selectors.map((selector) => {
            const el = document.querySelector(selector)!;
            const s = getComputedStyle(el);
            return {
              selector,
              base: s.backgroundColor,
              image: s.backgroundImage,
            };
          });
        },
        AMBIENT_ZONES.map((z) => z.selector),
      );
      expect(zones).toHaveLength(7);
      // Base colour: the token of the zone, solid.
      AMBIENTS.forEach((ambient, i) => {
        expect(zones[i]!.base, ambient.id).toBe(
          rgb(colors[ambient.base].value),
        );
        expect(zones[i]!.image, ambient.id).toContain("radial-gradient");
        expect(zones[i]!.image, ambient.id).toContain("linear-gradient");
      });
      // Each zone is different: base and gradients together.
      const keys = zones.map((z) => `${z.base}|${z.image}`);
      expect(new Set(keys).size).toBe(7);
      // The glow of each zone is its own colour (no two zones share one).
      const glows = AMBIENTS.map((a) => `${a.base}|${a.glow}`);
      expect(new Set(glows).size).toBe(7);
    });

    test(`${path}: each planet block keeps its token as solid base (RF-7)`, async ({
      page,
    }) => {
      await page.goto(path);
      for (const [id, token] of [
        ["hexaweb", "planetHexawebBg"],
        ["rankia", "planetRankiaBg"],
        ["adara", "planetAdaraBg"],
      ] as const) {
        const base = await page
          .locator(`[data-planet="${id}"]`)
          .evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(base, id).toBe(rgb(colors[token].value));
      }
    });
  }
});

// Boundaries between zones, as [upper, lower] selectors.
const BOUNDARIES: [string, string][] = [
  ["#hero", ".services"],
  ['[data-planet="hexaweb"]', '[data-planet="rankia"]'],
  ['[data-planet="rankia"]', '[data-planet="adara"]'],
  ['[data-planet="adara"]', "#projects"],
  ["#projects", "#team"],
  ["#team", "#contact"],
  ["#contact", ".site-footer"],
];

// The largest difference per colour channel between two consecutive rows of
// pixels, along a boundary (screenshot decoded in the page).
async function worstStep(page: Page, boundaryY: number, width: number) {
  const top = Math.max(0, Math.floor(boundaryY) - 40);
  const png = await page.screenshot({
    fullPage: true,
    clip: { x: 0, y: top, width, height: 80 },
  });
  return page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let worst = 0;
    for (let y = 1; y < bitmap.height; y++) {
      for (let x = 0; x < bitmap.width; x++) {
        for (let c = 0; c < 3; c++) {
          const a = data[((y - 1) * bitmap.width + x) * 4 + c]!;
          const b = data[(y * bitmap.width + x) * 4 + c]!;
          worst = Math.max(worst, Math.abs(a - b));
        }
      }
    }
    return worst;
  }, png.toString("base64"));
}

for (const reduced of [false, true]) {
  test.describe(`Fades between zones, ${reduced ? "reduced motion" : "with motion"} (RF-6)`, () => {
    test.use({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });

    for (const { path } of homePages) {
      for (const width of [375, 1280]) {
        test(`${path} at ${width} px: no step above 12 levels in any boundary`, async ({
          page,
        }) => {
          test.setTimeout(120_000);
          await page.route("**/*.js", (route) => route.abort());
          await page.setViewportSize({ width, height: 800 });
          await page.goto(path);
          await page.waitForTimeout(2300);
          // Only the backgrounds: no text, no images, no stars.
          await page.evaluate((css) => {
            const style = document.createElement("style");
            style.textContent = css;
            document.head.appendChild(style);
          }, "* { color: transparent !important; text-shadow: none !important; } img, picture, .sky, .hero__art > * { visibility: hidden !important; } a { text-decoration: none !important; }");
          for (const [upper, lower] of BOUNDARIES) {
            const y = await page.evaluate(
              ([u, l]) => {
                const a = document.querySelector(u!)!.getBoundingClientRect();
                const b = document.querySelector(l!)!.getBoundingClientRect();
                return Math.round((a.bottom + b.top) / 2 + window.scrollY);
              },
              [upper, lower],
            );
            const worst = await worstStep(page, y, width);
            expect(worst, `${upper} | ${lower} at ${y}`).toBeLessThanOrEqual(
              12,
            );
          }
        });
      }
    }
  });
}

// RF-8, RNF-9: every text on the sky reaches its contrast on the pixels really
// painted behind it, in both languages, at 375 and 1280 px, with and without
// motion.
for (const reduced of [false, true]) {
  test.describe(`Texts over the sky by pixels, ${reduced ? "reduced motion" : "with motion"} (RF-8)`, () => {
    test.use({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });

    for (const { path } of homePages) {
      for (const width of [375, 1280]) {
        test(`${path} at ${width} px`, async ({ page }) => {
          test.setTimeout(120_000);
          await page.route("**/*.js", (route) => route.abort());
          await page.setViewportSize({ width, height: 800 });
          await page.goto(path);
          await page.waitForTimeout(reduced ? 300 : 2300);
          const count = await page.locator("[data-sky-text]").count();
          expect(count).toBeGreaterThanOrEqual(20);
          const failures: string[] = [];
          for (let i = 0; i < count; i++) {
            const el = page.locator("[data-sky-text]").nth(i);
            const result = await textContrastByPixels(page, el);
            if (!result.ok) {
              const label = ((await el.textContent()) ?? "")
                .trim()
                .slice(0, 30);
              failures.push(
                `${label}: ${result.ratio.toFixed(2)} < ${result.required}`,
              );
            }
          }
          expect(failures).toEqual([]);
        });
      }
    }
  });
}

// R2 adjustments (2026-10-14): the glow of each planet block sits on its
// planet, and the colour of each zone changes into the next one right at their
// boundary, not half a block earlier (RF-5, RF-6). Only the backgrounds are
// measured: the content, the stars and the header are hidden.
const BACKGROUNDS_ONLY =
  ".hero__inner, .services__intro, .service__inner, .projects__inner, .team__inner, .contact__inner, .site-header, .site-footer, .sky { visibility: hidden !important; }";

const PLANET_IDS = ["hexaweb", "rankia", "adara"] as const;

// Luminance-weighted centre of the brightest pixels of a capture: where the
// glow peaks.
async function glowCentre(page: Page, png: Buffer) {
  return page.evaluate(async (base64) => {
    const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = new Float64Array(bitmap.width * bitmap.height);
    let max = 0;
    let min = 1;
    for (let i = 0; i < lum.length; i++) {
      const l =
        0.2126 * lin(data[i * 4]!) +
        0.7152 * lin(data[i * 4 + 1]!) +
        0.0722 * lin(data[i * 4 + 2]!);
      lum[i] = l;
      max = Math.max(max, l);
      min = Math.min(min, l);
    }
    const threshold = max - 0.1 * (max - min);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = 0; i < lum.length; i++) {
      if (lum[i]! >= threshold) {
        sx += i % bitmap.width;
        sy += Math.floor(i / bitmap.width);
        n++;
      }
    }
    return { x: sx / n, y: sy / n };
  }, png.toString("base64"));
}

test.describe("The glow of each planet block sits on its planet (RF-5, R2)", () => {
  for (const { path } of homePages) {
    for (const width of [375, 1280, 1680]) {
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        // Only the CSS: no reveal or effects of the animation layer.
        await page.route("**/*.js", (route) => route.abort());
        await page.goto(path);
        await page.evaluate((css) => {
          const style = document.createElement("style");
          style.textContent = css;
          document.head.appendChild(style);
        }, BACKGROUNDS_ONLY);
        for (const id of PLANET_IDS) {
          const { block, art } = await page
            .locator(`[data-planet="${id}"]`)
            .evaluate((el) => {
              const b = el.getBoundingClientRect();
              const a = el
                .querySelector(".service__art")!
                .getBoundingClientRect();
              const y = window.scrollY;
              return {
                block: {
                  x: Math.round(b.x),
                  y: Math.round(b.y + y),
                  width: Math.floor(b.width),
                  height: Math.floor(b.height),
                },
                art: { x: a.x, y: a.y + y, width: a.width, height: a.height },
              };
            });
          const png = await page.screenshot({ fullPage: true, clip: block });
          const centre = await glowCentre(page, png);
          const at = { x: block.x + centre.x, y: block.y + centre.y };
          const where = `${id}: glow at ${Math.round(at.x)},${Math.round(at.y)}; art ${Math.round(art.x)},${Math.round(art.y)} ${Math.round(art.width)}x${Math.round(art.height)}`;
          // Inside the central 60 % of the art, where the planet is.
          expect(at.x, where).toBeGreaterThanOrEqual(art.x + art.width * 0.2);
          expect(at.x, where).toBeLessThanOrEqual(art.x + art.width * 0.8);
          expect(at.y, where).toBeGreaterThanOrEqual(art.y + art.height * 0.2);
          expect(at.y, where).toBeLessThanOrEqual(art.y + art.height * 0.8);
        }
      });
    }
  }
});

// Consecutive zones, as [upper, lower] ambient ids.
const ZONE_PAIRS = [
  ["hexaweb", "rankia"],
  ["rankia", "adara"],
  ["adara", "projects"],
  ["projects", "team"],
  ["team", "contact"],
] as const;

// Row (from the top of the capture) where a column of pixels has gone halfway
// from colour `a` to colour `b`: projected on the line from a to b.
async function halfwayRow(
  page: Page,
  png: Buffer,
  x: number,
  a: number[],
  b: number[],
) {
  return page.evaluate(
    async ({ base64, x, a, b }) => {
      const blob = await (
        await fetch(`data:image/png;base64,${base64}`)
      ).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const d = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
      const len = d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2;
      const t = (y: number) => {
        const i = (y * bitmap.width + x) * 4;
        return (
          ((data[i]! - a[0]!) * d[0]! +
            (data[i + 1]! - a[1]!) * d[1]! +
            (data[i + 2]! - a[2]!) * d[2]!) /
          len
        );
      };
      // First row from which the column stays past the halfway point.
      for (let y = 0; y < bitmap.height - 4; y++) {
        if ([0, 1, 2, 3, 4].every((k) => t(y + k) >= 0.5)) return y;
      }
      return -1;
    },
    { base64: png.toString("base64"), x, a, b },
  );
}

const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test.describe("Each zone turns into the next one at their boundary (RF-6, R2)", () => {
  for (const { path } of homePages) {
    for (const width of [375, 1280]) {
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        // Only the CSS: no reveal or effects of the animation layer.
        await page.route("**/*.js", (route) => route.abort());
        await page.goto(path);
        await page.evaluate((css) => {
          const style = document.createElement("style");
          style.textContent = css;
          document.head.appendChild(style);
        }, BACKGROUNDS_ONLY);
        const selector = (id: string) =>
          AMBIENT_ZONES.find((z) => z.id === id)!.selector;
        const base = (id: string) =>
          channels(colors[AMBIENTS.find((a) => a.id === id)!.base].value);
        for (const [upper, lower] of ZONE_PAIRS) {
          const boundary = await page.evaluate(
            (s) =>
              document.querySelector(s)!.getBoundingClientRect().bottom +
              window.scrollY,
            selector(upper),
          );
          // 12 rem above and below the boundary.
          const span = 192;
          const top = Math.round(boundary - span);
          const png = await page.screenshot({
            fullPage: true,
            clip: { x: 0, y: top, width, height: span * 2 },
          });
          for (const x of [2, width - 3]) {
            const row = await halfwayRow(
              page,
              png,
              x,
              base(upper),
              base(lower),
            );
            const off = top + row - boundary;
            // Within 1.5 rem of the boundary.
            expect(
              Math.abs(off),
              `${upper} | ${lower}, column ${x}: halfway ${Math.round(off)} px from the boundary`,
            ).toBeLessThanOrEqual(24);
          }
        }
      });
    }
  }
});
