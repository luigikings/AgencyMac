import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SERVICES } from "../src/lib/site-data";
import { unexpectedContrastIncomplete } from "./axe-incomplete";
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
      expect(unexpectedContrastIncomplete(results)).toEqual([]);
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
        expect(unexpectedContrastIncomplete(results)).toEqual([]);
      });
    }
  }
});

// Spec 005, RF-27: with one of Mac's bubbles on screen axe still finds
// nothing, and the bubble's text passes the contrast check (a solid
// background, so axe can work it out). On the page axe may leave the bubble's
// text as "incomplete" when its lines lie over different elements (allowed for
// `data-mac-bubble-text` in axe-incomplete.ts), so the contrast is checked on a
// copy of the bubble on a single line, removed afterwards.
test.describe("Accessibility with a bubble of Mac on screen", () => {
  test.use({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 720 },
  });

  for (const { path } of homePages) {
    test(`${path}: axe with a bubble visible`, async ({ page }) => {
      await page.goto(path);
      await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
      const services = page.locator("#services");
      const block = page.locator("[data-reveal]");
      const flying = page.locator("img[data-mac-flight]");
      const bubble = page.locator("[data-mac-bubble]");
      const toBlock = (i: number) =>
        block
          .nth(i)
          .evaluate((el) =>
            el.scrollIntoView({ block: "center", behavior: "instant" }),
          );
      // Mac lands on the first planet and its bubble (if any) goes.
      await toBlock(0);
      await expect(services).toHaveAttribute(
        "data-active-planet",
        SERVICES[0]!.id,
      );
      await expect(flying).toHaveCount(0, { timeout: 6_000 });
      await expect(bubble).toHaveCount(0, { timeout: 4_000 });
      // Then he flies to the second one and says its line.
      await toBlock(1);
      await expect(services).toHaveAttribute(
        "data-active-planet",
        SERVICES[1]!.id,
      );
      await expect(flying).toHaveCount(1, { timeout: 2_000 });
      await expect(flying).toHaveCount(0, { timeout: 6_000 });
      await expect(bubble).toHaveCount(1, { timeout: 1_000 });
      // A copy of it, taken now (it only lives 2.0 to 2.8 s).
      await bubble.evaluate((el) => {
        (window as Window & { __bubbleCopy?: Node }).__bubbleCopy =
          el.cloneNode(true);
      });

      // The whole page, with the bubble on screen.
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      expect(unexpectedContrastIncomplete(results)).toEqual([]);

      // The bubble's contrast, on the copy.
      await page.evaluate(() => {
        const probe = (window as Window & { __bubbleCopy?: Node })
          .__bubbleCopy as HTMLElement;
        probe.removeAttribute("aria-hidden");
        probe.removeAttribute("data-mac-bubble");
        probe.setAttribute("data-bubble-probe", "");
        // Axe finds what is under the text with elementsFromPoint, which
        // skips elements the pointer goes through, and gives up on text whose
        // lines lie over different elements: the copy keeps the colours and
        // the font, on a single line at the same height.
        for (const node of [probe, ...probe.querySelectorAll("*")]) {
          (node as HTMLElement).style.pointerEvents = "auto";
        }
        Object.assign(probe.style, {
          width: "auto",
          maxWidth: "none",
          whiteSpace: "nowrap",
          left: `${window.scrollX + 12}px`,
          visibility: "visible",
        });
        document.body.append(probe);
      });
      const contrast = await new AxeBuilder({ page })
        .include("[data-bubble-probe]")
        .withRules(["color-contrast"])
        .analyze();
      await page.locator("[data-bubble-probe]").evaluate((el) => el.remove());
      const check = (list: typeof contrast.passes) =>
        list.find(({ id }) => id === "color-contrast")?.nodes.length ?? 0;
      expect(check(contrast.violations)).toBe(0);
      expect(check(contrast.incomplete)).toBe(0);
      expect(check(contrast.passes)).toBeGreaterThan(0);
    });

    // T22 (RF-28, RF-29): right after turbo mode, with its bubble and the
    // particles of its burst still on screen, axe still finds nothing (and Mac
    // is still a labelled button).
    test(`${path}: axe after turbo mode, with its bubble visible`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
      const mac = page.locator(".hero__mac");
      await expect(mac).toHaveAttribute("role", "button");
      await page.waitForTimeout(2_500);
      await mac.focus();
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Enter");
        if (i < 4) await page.waitForTimeout(250);
      }
      await expect(mac).toHaveAttribute("data-mac-turbo", "playing", {
        timeout: 500,
      });
      // Its length (at most 1.4 s) is checked in mac.spec.ts on the exact
      // marks; here it only has to end (room for a busy machine, where GSAP
      // stretches it, T23).
      await expect(mac).not.toHaveAttribute("data-mac-turbo", /.*/, {
        timeout: 1_400 + 3_000,
      });
      await expect(page.locator("[data-mac-bubble]")).toHaveCount(1);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      expect(unexpectedContrastIncomplete(results)).toEqual([]);
    });
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
          await expect(page.locator(".hero__mac")).toHaveAttribute(
            "role",
            "button",
          );
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
          // Mac is a labelled button now (RF-36): axe must accept it too.
          await expect(page.locator(".hero__mac")).toHaveAttribute(
            "role",
            "button",
          );
        }
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
        const ids = (list: { id: string }[]) => list.map(({ id }) => id);
        expect(ids(results.passes)).toContain("color-contrast");
        expect(unexpectedContrastIncomplete(results)).toEqual([]);
      });
    }
  }
});
