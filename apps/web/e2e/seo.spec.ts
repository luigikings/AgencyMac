import { expect, test } from "@playwright/test";
import { localizePath, t } from "../src/lib/i18n";
import { SITE_NAME, buildPageTitle } from "../src/lib/site";
import { SITE_URL, homePages, pages } from "./pages";

// Everything here is checked in the served HTML, without JavaScript.
test.use({ javaScriptEnabled: false });

test.describe("Indexable pages: minimum SEO", () => {
  for (const { path, locale, canonicalPath } of homePages) {
    test(`${path}: title, description and viewport`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(
        buildPageTitle(SITE_NAME, t(locale, "home.title")),
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        t(locale, "home.description"),
      );
      await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
        "content",
        /width=device-width/,
      );
    });

    // RF-12: absolute canonical on the production domain, trailing slash.
    test(`${path}: canonical URL`, async ({ page }) => {
      await page.goto(path);
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute(
        "href",
        `${SITE_URL}${canonicalPath}`,
      );
    });

    // RF-13: es, en and x-default (= es), absolute.
    test(`${path}: hreflang alternates`, async ({ page }) => {
      await page.goto(path);
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) =>
          links.map((link) => ({
            hreflang: link.getAttribute("hreflang"),
            href: link.getAttribute("href"),
          })),
        );
      expect(alternates).toEqual([
        { hreflang: "es", href: `${SITE_URL}/` },
        { hreflang: "en", href: `${SITE_URL}/en/` },
        { hreflang: "x-default", href: `${SITE_URL}/` },
      ]);
    });

    // RF-14: one h1, no skipped heading levels, content in the HTML.
    test(`${path}: headings and content in the HTML`, async ({ page }) => {
      await page.goto(path);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(t(locale, "home.heading"));
      const levels = await page
        .locator("h1, h2, h3, h4, h5, h6")
        .evaluateAll((headings) =>
          headings.map((heading) => Number(heading.tagName.slice(1))),
        );
      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
      }
      const main = page.locator("main#content");
      await expect(main).toHaveCount(1);
      await expect(main).toContainText(t(locale, "home.intro"));
      await expect(main).toContainText(t(locale, "home.sectionHeading"));
      await expect(main).toContainText(t(locale, "home.sectionBody"));
    });
  }

  // RF-14: semantic structure header > nav, main, footer (body children).
  test.describe("Semantic structure", () => {
    for (const { path, locale } of homePages) {
      test(`${path}: header, nav, main and footer`, async ({ page }) => {
        await page.goto(path);
        const landmarks = await page
          .locator("body > *")
          .evaluateAll((elements) =>
            elements.map((element) => element.tagName.toLowerCase()),
          );
        expect(landmarks).toEqual(["header", "main", "footer"]);

        const header = page.getByRole("banner");
        await expect(header).toHaveCount(1);
        await expect(page.getByRole("main")).toHaveCount(1);
        await expect(page.getByRole("contentinfo")).toHaveCount(1);

        // Skip link: first focusable element, pointing at the main content.
        const skip = header.locator("a").first();
        await expect(skip).toHaveText(t(locale, "a11y.skipToContent"));
        await expect(skip).toHaveAttribute("href", "#content");

        // Brand link back to the home page of the same locale.
        await expect(
          header.getByRole("link", { name: t(locale, "nav.home") }),
        ).toHaveAttribute("href", localizePath(locale, "/"));

        const nav = header.getByRole("navigation", {
          name: t(locale, "nav.label"),
        });
        await expect(nav).toHaveCount(1);
        await expect(page.getByRole("navigation")).toHaveCount(1);

        await expect(page.getByRole("contentinfo")).toContainText(
          t(locale, "footer.text"),
        );
      });
    }
  });

  // RF-11: titles and descriptions differ between pages and locales.
  test("titles and descriptions are unique", async ({ page }) => {
    const titles: string[] = [];
    const descriptions: string[] = [];
    for (const { path } of homePages) {
      await page.goto(path);
      titles.push(await page.title());
      descriptions.push(
        (await page
          .locator('meta[name="description"]')
          .getAttribute("content")) ?? "",
      );
    }
    for (const value of [...titles, ...descriptions]) {
      expect(value.trim()).not.toBe("");
    }
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});

// RF-15 and RNF-3 on every page: never noindex, never a script.
test.describe("All pages", () => {
  for (const { path } of pages) {
    test(`${path}: no noindex and no scripts`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.headers()["x-robots-tag"]).toBeUndefined();
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
      await expect(page.locator('meta[name="googlebot"]')).toHaveCount(0);
      await expect(page.locator("script")).toHaveCount(0);
    });
  }
});
