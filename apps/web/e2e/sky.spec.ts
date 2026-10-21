import { expect, test, type Page } from "@playwright/test";
import { TIER_PARAMS } from "../src/lib/fx/fx-config";
import { homePages, pages } from "./pages";

// Spec 005, T9: the base sky (RF-1, RF-3, RF-9, RF-40, RF-42). Three fixed
// layers of stars drawn with CSS only: they exist without JavaScript and with
// reduced motion.
const LAYERS = ["far", "mid", "near"] as const;
const DESKTOP = { far: 110, mid: 60, near: 30 };
const NARROW = { far: 40, mid: 22, near: 10 };

// Number of shadows in a computed `box-shadow` (each one has an rgb() colour).
async function shadowCounts(page: Page) {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>("[data-star-layer]")].map(
        (layer) => [
          layer.dataset.starLayer!,
          (getComputedStyle(layer).boxShadow.match(/rgba?\(/g) ?? []).length,
        ],
      ),
    ),
  );
}

test.describe("Sky layers (RF-1)", () => {
  for (const { path } of homePages) {
    test(`${path}: 3 layers with 110/60/30 stars from 48 rem`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      const layers = page.locator("[data-star-layer]");
      await expect(layers).toHaveCount(3);
      expect(
        await layers.evaluateAll((els) =>
          els.map((el) => (el as HTMLElement).dataset.starLayer),
        ),
      ).toEqual([...LAYERS]);
      for (const id of LAYERS) {
        await expect(page.locator(`[data-star-layer="${id}"]`)).toHaveAttribute(
          "data-star-count",
          String(DESKTOP[id]),
        );
      }
      expect(await shadowCounts(page)).toEqual(DESKTOP);
    });

    test(`${path}: 40/22/10 stars below 48 rem (375 px)`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      for (const id of LAYERS) {
        await expect(page.locator(`[data-star-layer="${id}"]`)).toHaveAttribute(
          "data-star-count-narrow",
          String(NARROW[id]),
        );
      }
      expect(await shadowCounts(page)).toEqual(NARROW);
    });

    test(`${path}: the sky is the same in two loads`, async ({ page }) => {
      const read = async () => {
        await page.goto(path);
        return page.locator("style#sky-stars").evaluate((el) => el.textContent);
      };
      const first = await read();
      const second = await read();
      expect(first).toBeTruthy();
      expect(second).toBe(first);
    });
  }
});

test.describe("Sky container (RF-42)", () => {
  for (const { path } of homePages) {
    test(`${path}: fixed, hidden from screen readers and click-through`, async ({
      page,
    }) => {
      await page.goto(path);
      const sky = page.locator(".sky");
      await expect(sky).toHaveCount(1);
      await expect(sky).toHaveAttribute("aria-hidden", "true");
      const style = await sky.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          position: s.position,
          pointerEvents: s.pointerEvents,
          zIndex: s.zIndex,
        };
      });
      expect(style).toEqual({
        position: "fixed",
        pointerEvents: "none",
        zIndex: "0",
      });
      // Nothing inside is focusable or exposed.
      expect(
        await sky.evaluate(
          (el) => el.querySelectorAll("a, button, [tabindex], img").length,
        ),
      ).toBe(0);
    });

    test(`${path}: no section creates a stacking context over the sky`, async ({
      page,
    }) => {
      await page.goto(path);
      const offenders = await page.evaluate(() =>
        [
          document.querySelector("main"),
          ...document.querySelectorAll("main > section"),
        ]
          .filter((el): el is Element => el !== null)
          .filter((el) => {
            const s = getComputedStyle(el);
            return (
              s.zIndex !== "auto" ||
              s.transform !== "none" ||
              s.filter !== "none" ||
              s.willChange !== "auto" ||
              /paint|strict|content/.test(s.contain) ||
              Number(s.opacity) !== 1
            );
          })
          .map((el) => el.id || el.tagName),
      );
      expect(offenders).toEqual([]);
    });

    test(`${path}: the content of each section sits above the sky`, async ({
      page,
    }) => {
      await page.goto(path);
      const inner = await page.evaluate(() =>
        [
          ".hero__inner",
          ".services__intro",
          ".service__inner",
          ".projects__inner",
          ".team__inner",
          ".contact__inner",
          ".site-header",
          ".site-footer",
        ].map((selector) => {
          const el = document.querySelector(selector)!;
          const s = getComputedStyle(el);
          return [selector, s.position, Number(s.zIndex) >= 1];
        }),
      );
      for (const [selector, position, above] of inner) {
        expect(position, String(selector)).not.toBe("static");
        expect(above, String(selector)).toBe(true);
      }
    });

    test(`${path}: the stars are really painted over the section backgrounds`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      // Hide every text and image of the content (not the sections' own
      // backgrounds), so only the backgrounds and the sky are left.
      await page.addStyleTag({
        content:
          "main *, .site-header *, .site-footer * { visibility: hidden !important; }",
      });
      const png = await page.screenshot({
        clip: { x: 0, y: 140, width: 1280, height: 600 },
      });
      const bright = await page.evaluate(async (base64) => {
        const blob = await (
          await fetch(`data:image/png;base64,${base64}`)
        ).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        const { data } = context.getImageData(
          0,
          0,
          bitmap.width,
          bitmap.height,
        );
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i]! + data[i + 1]! + data[i + 2]! > 330) count++;
        }
        return count;
      }, png.toString("base64"));
      expect(bright).toBeGreaterThanOrEqual(20);
    });
  }
});

test.describe("Without JavaScript (RF-9)", () => {
  test.use({ javaScriptEnabled: false });

  for (const { path } of homePages) {
    test(`${path}: the complete sky is there`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(".sky")).toBeVisible();
      await expect(page.locator("[data-star-layer]")).toHaveCount(3);
      const shadows = await page.evaluate(() =>
        [...document.querySelectorAll("[data-star-layer]")].map(
          (el) => getComputedStyle(el).boxShadow !== "none",
        ),
      );
      expect(shadows).toEqual([true, true, true]);
    });
  }
});

test.describe("With reduced motion (RF-9, RF-40)", () => {
  test.use({ reducedMotion: "reduce" });

  for (const { path } of homePages) {
    test(`${path}: the sky is complete and static`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(".sky")).toBeVisible();
      expect(await shadowCounts(page)).toEqual(
        // The default window of the tests is 1280 px wide.
        DESKTOP,
      );
      const animations = await page.evaluate(() =>
        [...document.querySelectorAll("[data-star-layer]")].map(
          (el) => getComputedStyle(el).animationName,
        ),
      );
      expect(animations).toEqual(["none", "none", "none"]);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(
        0,
      );
    });

    // T28: the cosmic border of the project cards does not turn either.
    test(`${path}: no animation with the cursor or the focus on a project card`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.locator("#projects .project").first().hover();
      await page.locator("#projects .project a").last().focus();
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(
        0,
      );
    });
  }
});

test.describe("Twinkle (RF-3)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { path } of homePages) {
    test(`${path}: 3 different cycles between 7 and 15 s`, async ({ page }) => {
      await page.goto(path);
      const cycles = await page.evaluate(() =>
        [...document.querySelectorAll("[data-star-layer]")].map((el) => {
          const s = getComputedStyle(el);
          return {
            name: s.animationName,
            seconds: parseFloat(s.animationDuration),
            iterations: s.animationIterationCount,
            opacityRange: [0.5, 1],
          };
        }),
      );
      for (const c of cycles) {
        expect(c.name).toBe("sky-twinkle");
        expect(c.seconds).toBeGreaterThanOrEqual(7);
        expect(c.seconds).toBeLessThanOrEqual(15);
        expect(c.iterations).toBe("infinite");
      }
      expect(new Set(cycles.map((c) => c.seconds)).size).toBe(3);
    });

    test(`${path}: the twinkle never goes dark (opacity stays at 0.5 or more)`, async ({
      page,
    }) => {
      await page.goto(path);
      const lows = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => (a as CSSAnimation).animationName === "sky-twinkle")
          .map((a) =>
            Math.min(
              ...(a.effect as KeyframeEffect)
                .getKeyframes()
                .map((k) => Number(k.opacity)),
            ),
          ),
      );
      expect(lows).toHaveLength(3);
      for (const low of lows) expect(low).toBeGreaterThanOrEqual(0.5);
    });
  }
});

test.describe("The 404 pages have no sky", () => {
  for (const { path } of pages.filter((p) => p.kind === "notFound")) {
    test(`${path}: no sky layers, no sky mark`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(".sky")).toHaveCount(0);
      await expect(page.locator("[data-star-layer]")).toHaveCount(0);
      await expect(page.locator("style#sky-stars")).toHaveCount(0);
      expect(
        await page.evaluate(() => document.body.hasAttribute("data-sky")),
      ).toBe(false);
    });
  }
});

test.describe("No horizontal overflow with the sky", () => {
  for (const { path } of homePages) {
    for (const width of [320, 375]) {
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  }
});

// Spec 005, RF-3 and RF-37 (validation, round 1): with the class known
// (`data-fx-tier`), only TIER_PARAMS[tier].twinkleLayers layers twinkle (the
// first ones); the HTML and CSS without JavaScript keep the three.
test.describe("Twinkling layers of each class (RF-3, RF-37)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const view of [
    {
      tier: "low",
      name: "375 px touch phone, low class",
      use: {
        viewport: { width: 375, height: 667 },
        hasTouch: true,
        isMobile: true,
      },
      cores: 8,
    },
    {
      tier: "mid",
      name: "desktop with 4 cores, middle class",
      use: { viewport: { width: 1280, height: 800 } },
      cores: 4,
    },
    {
      tier: "high",
      name: "desktop with 8 cores, high class",
      use: { viewport: { width: 1280, height: 800 } },
      cores: 8,
    },
  ] as const) {
    test.describe(view.name, () => {
      test.use(view.use);

      for (const { path } of homePages) {
        test(`${path}: twinkling layers as in TIER_PARAMS.${view.tier}`, async ({
          page,
        }) => {
          await page.addInitScript((cores) => {
            Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
              configurable: true,
              get: () => cores,
            });
            Object.defineProperty(Navigator.prototype, "deviceMemory", {
              configurable: true,
              get: () => 8,
            });
          }, view.cores);
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute(
            "data-fx-tier",
            view.tier,
            { timeout: 10_000 },
          );
          const twinkling = await page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>("[data-star-layer]")]
              .filter((layer) =>
                layer
                  .getAnimations()
                  .some(
                    (a) => (a as CSSAnimation).animationName === "sky-twinkle",
                  ),
              )
              .map((layer) => layer.dataset.starLayer),
          );
          expect(twinkling).toEqual(
            LAYERS.slice(0, TIER_PARAMS[view.tier].twinkleLayers),
          );
        });
      }
    });
  }
});
