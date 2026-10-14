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
