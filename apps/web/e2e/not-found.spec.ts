import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { localizePath, t, type Locale } from "../src/lib/i18n";
import { SITE_NAME, buildPageTitle } from "../src/lib/site";
import { pages } from "./pages";

const notFoundPages = pages.filter((page) => page.kind === "notFound");

// RF-10: paths with capital letters never serve the page; they fall to the
// Spanish 404 (no lowercase "/en/" prefix).
const uppercaseRequests: readonly { path: string; locale: Locale }[] = [
  { path: "/EN/", locale: "es" },
  { path: "/En/", locale: "es" },
];

test.describe("404 pages without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // RF-8, RF-10: real 404 status and the error page of the right locale.
  for (const { path, locale } of [...notFoundPages, ...uppercaseRequests]) {
    test(`${path} answers 404 with the ${locale} error page`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      expect(response?.headers()["content-type"]).toContain("text/html");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(t(locale, "notFound.heading"));
    });
  }

  // RF-9: title, description and content in its locale, a link back to the
  // home of the same locale, no language link, no canonical and no hreflang.
  for (const { path, locale } of notFoundPages) {
    test(`${path}: translated title, description and content`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(
        buildPageTitle(SITE_NAME, t(locale, "notFound.title")),
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        t(locale, "notFound.description"),
      );
      const main = page.locator("main#content");
      await expect(main).toContainText(t(locale, "notFound.message"));
      const back = main.getByRole("link", {
        name: t(locale, "notFound.backHome"),
        exact: true,
      });
      await expect(back).toHaveCount(1);
      await expect(back).toHaveAttribute("href", localizePath(locale, "/"));
    });

    test(`${path}: no language link, canonical or hreflang`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      await expect(page.locator("link[hreflang]")).toHaveCount(0);
      await expect(page.locator("a[hreflang]")).toHaveCount(0);
      for (const target of ["es", "en"] as const) {
        await expect(
          page.getByRole("link", {
            name: t(target, "nav.switchLanguage"),
            exact: true,
          }),
        ).toHaveCount(0);
      }
      // Every link stays in the same locale (home of that locale or #content).
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      for (const href of hrefs) {
        expect(["#content", localizePath(locale, "/")]).toContain(href);
      }
    });

    // RF-14 (applied to the 404 as well): header, main and footer. The 404
    // has nothing to navigate to besides the home page (brand link and the
    // back link), so it renders no empty <nav> landmark.
    test(`${path}: header, main and footer without an empty nav`, async ({
      page,
    }) => {
      await page.goto(path);
      const landmarks = await page
        .locator("body > *")
        .evaluateAll((elements) =>
          elements.map((element) => element.tagName.toLowerCase()),
        );
      expect(landmarks).toEqual(["header", "main", "footer"]);
      const header = page.getByRole("banner");
      const skip = header.locator("a").first();
      await expect(skip).toHaveText(t(locale, "a11y.skipToContent"));
      await expect(skip).toHaveAttribute("href", "#content");
      await expect(
        header.getByRole("link", { name: t(locale, "nav.home") }),
      ).toHaveAttribute("href", localizePath(locale, "/"));
      await expect(page.locator("nav")).toHaveCount(0);
      await expect(page.getByRole("contentinfo")).toContainText(
        t(locale, "footer.text"),
      );
    });
  }

  // RF-11 (orientative on the 404): titles and descriptions differ between
  // the two 404s and from the home pages.
  test("404 titles and descriptions are unique across all pages", async ({
    page,
  }) => {
    const titles: string[] = [];
    const descriptions: string[] = [];
    for (const { path } of pages) {
      await page.goto(path);
      titles.push(await page.title());
      descriptions.push(
        (await page
          .locator('meta[name="description"]')
          .getAttribute("content")) ?? "",
      );
    }
    expect(new Set(titles).size).toBe(pages.length);
    expect(new Set(descriptions).size).toBe(pages.length);
  });

  // D4: the English 404 is served from "en/404.html"; the folder Astro emits
  // ("en/404/index.html") is gone, so "/en/404/" is not a 200 page. Spec 003
  // (D17): like Cloudflare, it redirects with a 307 to "/en/404".
  test("/en/404/ is not served as a page", async ({ request }) => {
    const response = await request.get("/en/404/", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/en/404");
  });
});

test("the build leaves dist/en/404.html and no dist/en/404/ folder", () => {
  const dist = new URL("../dist/", import.meta.url);
  expect(existsSync(fileURLToPath(new URL("en/404.html", dist)))).toBe(true);
  expect(existsSync(fileURLToPath(new URL("en/404/", dist)))).toBe(false);
  expect(existsSync(fileURLToPath(new URL("404.html", dist)))).toBe(true);
});

// The axe audit of the 404s (RF-20, RF-25) lives in a11y.spec.ts with the
// other pages.

// T7 (spec 004): the full-width home layout must not change the 404s. They
// keep one column, no navigation, no language link and no call to action.
test.describe("404 pages keep their one-column layout", () => {
  for (const { path, locale } of pages.filter(
    (page) => page.kind === "notFound",
  )) {
    test(`${path}: narrow main, no navigation, language link or CTA`, async ({
      page,
    }) => {
      await page.goto(path);
      const main = await page.locator("main").evaluate((element) => {
        const style = getComputedStyle(element);
        return { maxWidth: style.maxWidth, paddingLeft: style.paddingLeft };
      });
      expect(main.maxWidth).toBe("960px");
      expect(main.paddingLeft).toBe("16px");
      await expect(page.locator("nav")).toHaveCount(0);
      const header = page.getByRole("banner");
      await expect(
        header.getByRole("link", { name: t(locale, "nav.switchLanguage") }),
      ).toHaveCount(0);
      await expect(
        header.getByRole("link", { name: t(locale, "cta.takeOff") }),
      ).toHaveCount(0);
      await expect(header.locator('a[href^="#"]')).toHaveCount(1); // skip link
    });
  }
});
