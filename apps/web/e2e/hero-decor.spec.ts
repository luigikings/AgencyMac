import { expect, test } from "@playwright/test";
import { homePages } from "./pages";
import { textContrastByPixels } from "./pixel-contrast";

// RF-19 (spec 005, T11): aura around the moon, an orbit with a small body that
// runs along it, and at least 3 sparkles that blink, all decorative: they do
// not cover or move any text (RNF-10: no blink above 3 per second).
const DECOR = ".hero__aura, .hero__orbit, .hero__orbit-body, .hero__sparkle";
const TEXT_BOXES =
  "#hero-heading, .hero__kicker, .hero__tagline, .hero__subtitle, .hero__discover";

test.describe("Decoration of the hero (RF-19)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { path } of homePages) {
    test(`${path}: aura, orbit with a body and 3 or more sparkles, all decorative`, async ({
      page,
    }) => {
      await page.goto(path);
      const info = await page.evaluate((decorSelector) => {
        const count = (s: string) => document.querySelectorAll(s).length;
        const decor = [...document.querySelectorAll(decorSelector)];
        return {
          aura: count(".hero__aura"),
          orbits: count(".hero__orbit"),
          bodies: count(".hero__orbit .hero__orbit-body"),
          sparkles: count(".hero__sparkle"),
          hidden: decor.every((el) => el.closest('[aria-hidden="true"]')),
          clickThrough: decor.every(
            (el) => getComputedStyle(el).pointerEvents === "none",
          ),
          focusable: decor.some(
            (el) =>
              el.matches("a, button, [tabindex]") ||
              el.querySelector("a, button, [tabindex]"),
          ),
        };
      }, DECOR);
      expect(info.aura).toBe(1);
      expect(info.orbits).toBeGreaterThanOrEqual(1);
      expect(info.bodies).toBeGreaterThanOrEqual(1);
      expect(info.sparkles).toBeGreaterThanOrEqual(3);
      expect(info.hidden).toBe(true);
      expect(info.clickThrough).toBe(true);
      expect(info.focusable).toBe(false);
    });

    for (const width of [1280, 375]) {
      test(`${path} at ${width} px: the aura hugs the visible moon, same centre and radius (R1)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForTimeout(2300);
        const m = await page.evaluate(async () => {
          const moon = document.querySelector<HTMLImageElement>(".hero__moon")!;
          const size = 400;
          const bitmap = await createImageBitmap(moon, {
            resizeWidth: size,
            resizeHeight: size,
          });
          const canvas = new OffscreenCanvas(size, size);
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(bitmap, 0, 0);
          const { data } = ctx.getImageData(0, 0, size, size);
          let x0 = size;
          let y0 = size;
          let x1 = -1;
          let y1 = -1;
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              if (data[(y * size + x) * 4 + 3]! > 40) {
                x0 = Math.min(x0, x);
                y0 = Math.min(y0, y);
                x1 = Math.max(x1, x);
                y1 = Math.max(y1, y);
              }
            }
          }
          const r = moon.getBoundingClientRect();
          const visible = {
            cx: r.left + ((x0 + x1 + 1) / 2 / size) * r.width,
            cy: r.top + ((y0 + y1 + 1) / 2 / size) * r.height,
            radius:
              (((x1 - x0 + 1) / size) * r.width +
                ((y1 - y0 + 1) / size) * r.height) /
              2 /
              2,
          };
          const a = document
            .querySelector(".hero__aura")!
            .getBoundingClientRect();
          return {
            moonWidth: r.width,
            visible,
            aura: {
              cx: a.left + a.width / 2,
              cy: a.top + a.height / 2,
              radius: a.width / 2,
            },
          };
        });
        const tolerance = m.moonWidth * 0.02;
        expect(Math.abs(m.aura.cx - m.visible.cx)).toBeLessThanOrEqual(
          tolerance,
        );
        expect(Math.abs(m.aura.cy - m.visible.cy)).toBeLessThanOrEqual(
          tolerance,
        );
        // Hugging, with the glow tucked under the rim: never bigger than the
        // moon, never more than 3 % of its width smaller.
        expect(m.aura.radius).toBeLessThanOrEqual(
          m.visible.radius + tolerance / 2,
        );
        expect(m.visible.radius - m.aura.radius).toBeLessThanOrEqual(
          m.moonWidth * 0.03,
        );
      });
    }

    test(`${path}: the body really travels along the orbit`, async ({
      page,
    }) => {
      await page.goto(path);
      const at = () =>
        page
          .locator(".hero__orbit-body")
          .first()
          .evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [r.left + r.width / 2, r.top + r.height / 2];
          });
      const a = await at();
      await page.waitForTimeout(1500);
      const b = await at();
      expect(Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!)).toBeGreaterThan(5);
      const names = await page
        .locator(".hero__orbit-body")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName);
      expect(names).toContain("hero-orbit-spin");
    });

    test(`${path}: the sparkles blink (no more than 3 times a second)`, async ({
      page,
    }) => {
      await page.goto(path);
      const sparkles = await page.locator(".hero__sparkle").evaluateAll((els) =>
        els.map((el) => {
          const anim = el
            .getAnimations()
            .find((a) => (a as CSSAnimation).animationName === "hero-sparkle")!;
          const timing = anim.effect!.getComputedTiming();
          const duration = Number(timing.duration);
          anim.pause();
          const delay = Number(timing.delay);
          anim.currentTime = delay;
          const low = Number(getComputedStyle(el).opacity);
          anim.currentTime = delay + duration / 2;
          const high = Number(getComputedStyle(el).opacity);
          return {
            name: (anim as CSSAnimation).animationName,
            iterations: timing.iterations,
            seconds: duration / 1000,
            low,
            high,
          };
        }),
      );
      expect(sparkles.length).toBeGreaterThanOrEqual(3);
      for (const sp of sparkles) {
        expect(sp.name).toBe("hero-sparkle");
        expect(sp.iterations).toBe(Infinity);
        // One blink per cycle: the cycle lasts at least 1/3 s.
        expect(1 / sp.seconds).toBeLessThanOrEqual(3);
        expect(Math.abs(sp.high - sp.low)).toBeGreaterThan(0.3);
      }
      expect(new Set(sparkles.map((s) => s.seconds)).size).toBeGreaterThan(1);
    });

    for (const width of [1280, 375, 320]) {
      test(`${path} at ${width} px: no decoration covers or moves any text`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForTimeout(2300);
        const measure = () =>
          page.evaluate(
            ({ decor, text }) => {
              // Decoration: its layout box, ignoring the rotation and scale of
              // its animation (the orbit turns inside its own square). The
              // body of the orbit stays inside the orbit.
              const layout = (el: Element) => {
                const h = el as HTMLElement;
                let left = 0;
                let top = 0;
                for (
                  let n: HTMLElement | null = h;
                  n;
                  n = n.offsetParent as HTMLElement | null
                ) {
                  left += n.offsetLeft;
                  top += n.offsetTop;
                }
                return [left, top, left + h.offsetWidth, top + h.offsetHeight];
              };
              const decorBoxes = [
                ...document.querySelectorAll(
                  ".hero__aura, .hero__orbit, .hero__sparkle",
                ),
              ].map(layout);
              // Text: the lines really written, not the box of the element.
              const textBoxes = [...document.querySelectorAll(text)].flatMap(
                (el) => {
                  const range = document.createRange();
                  range.selectNodeContents(el);
                  return [...range.getClientRects()].map((r) => [
                    r.left,
                    r.top + window.scrollY,
                    r.right,
                    r.bottom + window.scrollY,
                  ]);
                },
              );
              void decor;
              return { decor: decorBoxes, text: textBoxes };
            },
            { decor: DECOR, text: TEXT_BOXES },
          );
        const withDecor = await measure();
        for (const d of withDecor.decor) {
          for (const t of withDecor.text) {
            const overlap =
              d[0]! < t[2]! && d[2]! > t[0]! && d[1]! < t[3]! && d[3]! > t[1]!;
            expect(overlap, `decoration ${d} over text ${t}`).toBe(false);
          }
        }
        // Taking the decoration away moves nothing.
        await page.addStyleTag({
          content: `${DECOR} { display: none !important; }`,
        });
        const without = await measure();
        expect(without.text).toEqual(withDecor.text);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }

    test(`${path}: the decoration causes no layout shift`, async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as {
            value: number;
            hadRecentInput: boolean;
          }[]) {
            if (!e.hadRecentInput) w.__cls += e.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(path);
      await page.waitForTimeout(2500);
      expect(
        await page.evaluate(
          () => (window as unknown as { __cls: number }).__cls,
        ),
      ).toBeLessThanOrEqual(0.001);
    });
  }
});

// The texts of the hero stay readable with the decoration running: measured on
// the pixels really painted behind them (RF-8).
test.describe("Hero texts over the decoration (RF-8, RF-19)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { path } of homePages) {
    for (const width of [1280, 375]) {
      test(`${path} at ${width} px: contrast by pixels`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForTimeout(2300);
        for (const selector of [
          ".hero__kicker",
          "#hero-heading",
          ".hero__tagline",
          ".hero__subtitle",
        ]) {
          const result = await textContrastByPixels(
            page,
            page.locator(selector),
          );
          expect(result.ok, `${selector}: ${result.ratio.toFixed(2)}:1`).toBe(
            true,
          );
        }
      });
    }
  }
});

test.describe("Decoration of the hero with reduced motion (RF-40)", () => {
  test.use({ reducedMotion: "reduce" });

  for (const { path } of homePages) {
    test(`${path}: present and still`, async ({ page }) => {
      await page.goto(path);
      expect(
        await page.locator(".hero__sparkle").count(),
      ).toBeGreaterThanOrEqual(3);
      expect(
        await page.locator(".hero__orbit-body").count(),
      ).toBeGreaterThanOrEqual(1);
      const moving = await page.evaluate(
        (selector) =>
          [...document.querySelectorAll(selector)].filter(
            (el) => getComputedStyle(el).animationName !== "none",
          ).length,
        DECOR,
      );
      expect(moving).toBe(0);
    });
  }
});
