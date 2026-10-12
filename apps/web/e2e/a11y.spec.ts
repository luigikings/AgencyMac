import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { homePages, pages } from "./pages";

// RF-20, RF-25: axe (WCAG 2.x A/AA rules, color-contrast included) finds no
// violations on the 4 pages (home and 404, ES and EN). axe-core is injected
// as a script, so it needs JavaScript enabled. The pages ship no scripts
// (checked in seo.spec.ts), so the audited DOM is the same one a visitor
// without JavaScript gets.
test.describe("Accessibility (axe)", () => {
  for (const { path } of pages) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      // The contrast rule really ran on the text (it is not left as
      // "inapplicable" or "needs review" because of an unknown background).
      const ruleIds = (list: { id: string }[]) => list.map(({ id }) => id);
      expect(ruleIds(results.passes)).toContain("color-contrast");
      expect(ruleIds(results.incomplete)).not.toContain("color-contrast");
    });
  }
});

// RF-21 (automatic part; the full keyboard walk-through is manual): every
// link in the header shows a visible outline when focused with the keyboard.
test.describe("Visible keyboard focus", () => {
  for (const { path } of homePages) {
    test(`${path}: header links show a focus outline`, async ({ page }) => {
      await page.goto(path);
      const linkCount = await page.locator("header a").count();
      expect(linkCount).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < linkCount; i++) {
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement;
          const style = getComputedStyle(element);
          return {
            inHeader: element.closest("header") !== null,
            outlineStyle: style.outlineStyle,
            outlineWidth: parseFloat(style.outlineWidth),
          };
        });
        expect(focus.inHeader).toBe(true);
        expect(focus.outlineStyle).toBe("solid");
        expect(focus.outlineWidth).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

// RNF-4: with reduced motion requested nothing moves (no transitions or
// animations anywhere on the page).
test.describe("Reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  for (const { path } of pages) {
    test(`${path}: no transitions or animations`, async ({ page }) => {
      await page.goto(path);
      const moving = await page.evaluate(() =>
        [...document.querySelectorAll("*")]
          .map((element) => {
            const style = getComputedStyle(element);
            const anyPositive = (list: string) =>
              list.split(",").some((value) => parseFloat(value) > 0);
            const hasTransition = anyPositive(style.transitionDuration);
            const hasAnimation =
              style.animationName !== "none" &&
              anyPositive(style.animationDuration);
            return hasTransition || hasAnimation
              ? element.tagName.toLowerCase()
              : null;
          })
          .filter((tag) => tag !== null),
      );
      expect(moving).toEqual([]);
    });
  }
});

// Layout: on short pages the footer sits at the bottom of the window (the
// purple main area fills the remaining height), with no vertical scroll. The
// home pages are long since spec 004, so this only applies to the 404s.
test.describe("Footer at the bottom on short pages", () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  for (const { path } of pages.filter((page) => page.kind === "notFound")) {
    test(`${path}: footer reaches the bottom of the viewport`, async ({
      page,
    }) => {
      await page.goto(path);
      const layout = await page.evaluate(() => ({
        footerBottom: document.querySelector("footer")!.getBoundingClientRect()
          .bottom,
        innerHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      expect(layout.scrollHeight).toBeLessThanOrEqual(layout.innerHeight);
      expect(Math.abs(layout.footerBottom - layout.innerHeight)).toBeLessThan(
        1,
      );
    });
  }
});

// RNF-8, RF-38: axe on the home pages before and after walking the whole
// page (so every lazy image has loaded and every section has been seen), with
// the contrast rule really executed.
async function revealAll(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight / 2));
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("Accessibility after revealing the whole page", () => {
  for (const { path } of homePages) {
    for (const stage of ["before", "after"] as const) {
      test(`${path}: axe ${stage} walking the page`, async ({ page }) => {
        await page.goto(path);
        if (stage === "after") await revealAll(page);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
        const ids = (list: { id: string }[]) => list.map(({ id }) => id);
        expect(ids(results.passes)).toContain("color-contrast");
        expect(ids(results.incomplete)).not.toContain("color-contrast");
      });
    }
  }
});

// RNF-8, RF-38 (phase B): the same check with the animation layer running
// (the page still needs to be complete and readable while it moves). Axe runs
// before anything is revealed and after walking the whole page once every
// block has finished sliding in.
test.describe("Accessibility with the animation active", () => {
  for (const { path } of homePages) {
    for (const stage of ["before", "after"] as const) {
      test(`${path}: axe ${stage} walking the page with animation`, async ({
        page,
      }) => {
        await page.goto(path);
        await page.waitForSelector('html[data-motion="on"]', {
          timeout: 10_000,
        });
        if (stage === "after") {
          await revealAll(page);
          // Every half of every block is fully opaque again.
          await expect
            .poll(() =>
              page.evaluate(() =>
                [
                  ...document.querySelectorAll(
                    "[data-reveal] .service__art, [data-reveal] .service__text",
                  ),
                ].every((el) => Number(getComputedStyle(el).opacity) === 1),
              ),
            )
            .toBe(true);
        } else {
          // The traveller is part of the page now: it must not break axe.
          await expect(page.locator("img[data-traveler]")).toHaveCount(1);
        }
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
        const ids = (list: { id: string }[]) => list.map(({ id }) => id);
        expect(ids(results.passes)).toContain("color-contrast");
        expect(ids(results.incomplete)).not.toContain("color-contrast");
      });
    }
  }
});
