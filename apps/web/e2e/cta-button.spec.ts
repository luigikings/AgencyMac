import { expect, test, type Page } from "@playwright/test";
import { homePages } from "./pages";

// RF-20 (spec 005, T11): the main button "Quiero despegar" lifts 2 px, sweeps
// a shine for 0.6 s and glows on hover and keyboard focus, and shrinks to 0.97
// when pressed. With reduced motion only the colour changes, as in the 004.
const BUTTON_COLOR = "rgb(255, 195, 0)";
const BUTTON_HOVER_COLOR = "rgb(255, 224, 0)";

async function ctaState(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      const before = getComputedStyle(el, "::before");
      return {
        transform: s.transform,
        boxShadow: s.boxShadow,
        background: s.backgroundColor,
        transition: s.transitionDuration,
        sweepName: before.animationName,
        sweepSeconds: parseFloat(before.animationDuration),
      };
    });
}

for (const { path } of homePages) {
  test.describe(`${path}: the main button with animation (RF-20)`, () => {
    test.use({ reducedMotion: "no-preference" });

    for (const [label, selector] of [
      ["header", ".site-header .cta"],
      ["contact", "#contact .cta"],
    ] as const) {
      test(`${label}: rest, hover and press`, async ({ page }) => {
        await page.goto(path);
        const cta = page.locator(selector).first();
        await cta.scrollIntoViewIfNeeded();
        const rest = await ctaState(page, selector);
        expect(rest.transform).toBe("none");
        expect(rest.boxShadow).toBe("none");
        expect(rest.background).toBe(BUTTON_COLOR);
        expect(rest.sweepName).toBe("none");

        await cta.hover();
        await page.waitForTimeout(450);
        const hover = await ctaState(page, selector);
        expect(hover.transform).toBe("matrix(1, 0, 0, 1, 0, -2)");
        expect(hover.boxShadow).not.toBe("none");
        expect(hover.background).toBe(BUTTON_HOVER_COLOR);
        expect(hover.sweepName).toBe("cta-sweep");
        expect(hover.sweepSeconds).toBeCloseTo(0.6, 5);

        await page.mouse.down();
        await page.waitForTimeout(450);
        const pressed = await ctaState(page, selector);
        await page.mouse.up();
        expect(pressed.transform).toMatch(/^matrix\(0\.97, 0, 0, 0\.97,/);
      });
    }

    test("keyboard focus lifts, glows and sweeps like hover", async ({
      page,
    }) => {
      await page.goto(path);
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("Tab");
        const onCta = await page.evaluate(() =>
          document.activeElement?.classList.contains("cta"),
        );
        if (onCta) break;
      }
      await page.waitForTimeout(450);
      const focus = await ctaState(page, ".cta:focus");
      expect(focus.transform).toBe("matrix(1, 0, 0, 1, 0, -2)");
      expect(focus.boxShadow).not.toBe("none");
      expect(focus.sweepName).toBe("cta-sweep");
    });

    test("the shine never sits on top of the label (text stays readable)", async ({
      page,
    }) => {
      await page.goto(path);
      const layers = await page.locator(".site-header .cta").evaluate((el) => {
        const before = getComputedStyle(el, "::before");
        return {
          isolation: getComputedStyle(el).isolation,
          zIndex: before.zIndex,
          pointerEvents: before.pointerEvents,
        };
      });
      expect(layers.isolation).toBe("isolate");
      expect(layers.zIndex).toBe("-1");
      expect(layers.pointerEvents).toBe("none");
    });
  });

  test.describe(`${path}: the main button with reduced motion (RF-20, RF-40)`, () => {
    test.use({ reducedMotion: "reduce" });

    test("only the colour changes", async ({ page }) => {
      await page.goto(path);
      const cta = page.locator(".site-header .cta").first();
      const rest = await ctaState(page, ".site-header .cta");
      await cta.hover();
      await page.waitForTimeout(450);
      const hover = await ctaState(page, ".site-header .cta");
      expect(rest.background).toBe(BUTTON_COLOR);
      expect(hover.background).toBe(BUTTON_HOVER_COLOR);
      expect(hover.transform).toBe("none");
      expect(hover.boxShadow).toBe("none");
      expect(hover.sweepName).toBe("none");
      expect(hover.transition).toBe("0s");
      await page.mouse.down();
      const pressed = await ctaState(page, ".site-header .cta");
      await page.mouse.up();
      expect(pressed.transform).toBe("none");
    });
  });
}
