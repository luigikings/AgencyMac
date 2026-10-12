import { expect, test, type Page } from "@playwright/test";
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
      await expect(h1).toHaveText(t(locale, "hero.heading"));
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
      await expect(main).toContainText(t(locale, "hero.tagline"));
      await expect(main).toContainText(t(locale, "services.heading"));
      await expect(main).toContainText(t(locale, "services.intro"));
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

// RF-15 and RNF-3 on every page: never noindex, and no executable script
// except the deferred-animation entry module of the home pages (spec 004,
// phase B). The home pages also carry one JSON-LD block (data, not code); the
// 404s carry nothing.
test.describe("All pages", () => {
  for (const { path, kind } of pages) {
    test(`${path}: no noindex and no executable scripts`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.headers()["x-robots-tag"]).toBeUndefined();
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
      await expect(page.locator('meta[name="googlebot"]')).toHaveCount(0);
      const types = await page
        .locator("script")
        .evaluateAll((scripts) =>
          scripts.map((script) => script.getAttribute("type")),
        );
      expect(types).toEqual(
        kind === "home" ? ["application/ld+json", "module"] : [],
      );
    });
  }
});

// RF-27: social metadata in the language of the page, absolute URLs built
// from the site, and an image that the server under test really serves.
const meta = (page: Page, attr: "property" | "name", key: string) =>
  page.locator(`meta[${attr}="${key}"]`);

test.describe("Social metadata (RF-27)", () => {
  for (const { path, locale, canonicalPath } of homePages) {
    test(`${path}: Open Graph and Twitter tags`, async ({ page, request }) => {
      await page.goto(path);
      const title = buildPageTitle(SITE_NAME, t(locale, "home.title"));
      const description = t(locale, "home.description");
      const expected: ["property" | "name", string, string][] = [
        ["property", "og:type", "website"],
        ["property", "og:site_name", SITE_NAME],
        ["property", "og:title", title],
        ["property", "og:description", description],
        ["property", "og:url", `${SITE_URL}${canonicalPath}`],
        ["property", "og:locale", locale === "es" ? "es_ES" : "en_US"],
        ["property", "og:image", `${SITE_URL}/og-default.png`],
        ["property", "og:image:width", "1200"],
        ["property", "og:image:height", "630"],
        ["property", "og:image:alt", t(locale, "og.imageAlt")],
        ["name", "twitter:card", "summary_large_image"],
        ["name", "twitter:title", title],
        ["name", "twitter:description", description],
        ["name", "twitter:image", `${SITE_URL}/og-default.png`],
        ["name", "twitter:image:alt", t(locale, "og.imageAlt")],
      ];
      for (const [attr, key, content] of expected) {
        const tag = meta(page, attr, key);
        await expect(tag, key).toHaveCount(1);
        await expect(tag, key).toHaveAttribute("content", content);
      }
      // The other language is offered as an alternative locale.
      await expect(
        meta(page, "property", "og:locale:alternate"),
      ).toHaveAttribute("content", locale === "es" ? "en_US" : "es_ES");
      // The image is served by the site under test (its absolute URL points
      // at the production domain, which these tests never request).
      const image = new URL(
        (await meta(page, "property", "og:image").getAttribute("content"))!,
      );
      const response = await request.get(image.pathname);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
    });
  }

  for (const { path } of pages.filter((p) => p.kind === "notFound")) {
    test(`${path}: no social metadata on the 404`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[property^="og:"]')).toHaveCount(0);
      await expect(page.locator('meta[name^="twitter:"]')).toHaveCount(0);
    });
  }
});

// RF-28: Organization data that matches what the page says.
test.describe("Structured data (RF-28)", () => {
  for (const { path, locale } of homePages) {
    test(`${path}: JSON-LD Organization`, async ({ page, request }) => {
      await page.goto(path);
      const raw = await page
        .locator('script[type="application/ld+json"]')
        .textContent();
      const data = JSON.parse(raw!);
      expect(data["@context"]).toBe("https://schema.org");
      expect(data["@type"]).toBe("Organization");
      expect(data.name).toBe(SITE_NAME);
      expect(data.url).toBe(`${SITE_URL}/`);
      expect(data.description).toBe(t(locale, "home.description"));
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        data.description,
      );
      expect(data.logo.startsWith(`${SITE_URL}/`)).toBe(true);
      const logo = await request.get(new URL(data.logo).pathname);
      expect(logo.status()).toBe(200);
      for (const forbidden of ["telephone", "email", "address", "sameAs"]) {
        expect(data, forbidden).not.toHaveProperty(forbidden);
      }
    });
  }

  for (const { path } of pages.filter((p) => p.kind === "notFound")) {
    test(`${path}: no JSON-LD on the 404`, async ({ page }) => {
      await page.goto(path);
      await expect(
        page.locator('script[type="application/ld+json"]'),
      ).toHaveCount(0);
    });
  }
});

// RF-29, RF-30: sitemap and robots.txt, served by the site under test.
test.describe("Sitemap and robots.txt (RF-29, RF-30)", () => {
  test("sitemap.xml lists the two pages with their language alternatives", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${SITE_URL}/`, `${SITE_URL}/en/`]);
    for (const hreflang of ["es", "en", "x-default"]) {
      expect(xml).toContain(`hreflang="${hreflang}"`);
    }
    expect(xml).not.toContain("404");
  });

  test("robots.txt allows crawling and links to the sitemap", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    const text = await response.text();
    expect(text).toContain("Allow: /");
    expect(text).not.toMatch(/disallow/i);
    expect(text).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});
