import { expect, test } from "@playwright/test";
import { homePages } from "./pages";

// RNF-9: no horizontal overflow and no cut text on a 320 px phone, a 375 px
// phone and a phone in landscape (667 x 375), in Spanish and English.
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 375, height: 667 },
  { width: 667, height: 375 },
] as const;

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport });

    for (const { path } of homePages) {
      test(`${path}: content fits the width`, async ({ page }) => {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const size = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(size.innerWidth).toBe(viewport.width);
        expect(size.scrollWidth).toBeLessThanOrEqual(size.innerWidth);
      });

      test(`${path}: no text is cut or spills out of its box`, async ({
        page,
      }) => {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        // The entrance of the hero moves things for 2 s (spec 005): measure
        // once it has settled.
        await page.waitForTimeout(2300);
        const cut = await page.evaluate(() =>
          [...document.querySelectorAll("main *, header *, footer *")]
            .filter(
              (element) =>
                element.scrollWidth > element.clientWidth + 1 &&
                getComputedStyle(element).display !== "inline",
            )
            .map((element) => `${element.tagName}.${element.className}`),
        );
        expect(cut).toEqual([]);
      });
    }
  });
}
