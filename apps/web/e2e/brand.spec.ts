import { expect, test } from "@playwright/test";
import { t } from "../src/lib/i18n";
import { homePages, pages } from "./pages";

test.describe("Brand assets", () => {
  // RF-20: the declared favicon is an SVG served by the site (the same
  // address and type as before the isologo).
  for (const { path } of homePages) {
    test(`${path}: the declared favicon responds 200 as SVG`, async ({
      page,
      request,
    }) => {
      await page.goto(path);
      const icon = page.locator('link[rel="icon"][type="image/svg+xml"]');
      await expect(icon).toHaveCount(1);
      const href = await icon.getAttribute("href");
      expect(href).toBe("/favicon.svg");
      const response = await request.get(new URL(href!, page.url()).href);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/svg+xml");
      expect(await response.text()).toContain("<svg");
    });
  }

  // RF-20: the three declared icons (SVG, PNG and Apple) respond 200 with
  // their type, on every page.
  for (const { path } of pages) {
    test(`${path}: SVG, PNG and Apple icons are declared and served`, async ({
      page,
      request,
    }) => {
      await page.goto(path);
      const declared = await page
        .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
        .evaluateAll((links) =>
          links.map((link) => ({
            rel: link.getAttribute("rel"),
            type: link.getAttribute("type"),
            sizes: link.getAttribute("sizes"),
            href: link.getAttribute("href"),
          })),
        );
      expect(declared).toEqual([
        {
          rel: "icon",
          type: "image/svg+xml",
          sizes: "any",
          href: "/favicon.svg",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "48x48",
          href: "/favicon-48.png",
        },
        {
          rel: "apple-touch-icon",
          type: null,
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
      ]);
      const expectedTypes = ["image/svg+xml", "image/png", "image/png"];
      for (const [index, icon] of declared.entries()) {
        const response = await request.get(
          new URL(icon.href!, page.url()).href,
        );
        expect(response.status(), icon.href!).toBe(200);
        expect(response.headers()["content-type"], icon.href!).toBe(
          expectedTypes[index],
        );
      }
    });
  }
});

// RF-16: the header shows the real logo (not the written name), inside the
// link to the home page, with real alt text, declared size and eager loading.
// The 404s use it too.
test.describe("Header logo", () => {
  for (const { path, locale } of pages) {
    test(`${path}: logo image in the home link`, async ({ page }) => {
      await page.goto(path);
      const brand = page
        .getByRole("banner")
        .getByRole("link", { name: t(locale, "nav.home") });
      const logo = brand.locator("img");
      await expect(logo).toHaveCount(1);
      await expect(logo).toHaveAttribute("alt", t(locale, "nav.home"));
      await expect(logo).toHaveAttribute("width", /^\d+$/);
      await expect(logo).toHaveAttribute("height", /^\d+$/);
      expect(await logo.getAttribute("loading")).not.toBe("lazy");
      // The written brand name is no longer the link content.
      await expect(brand).not.toHaveText(/\S/);
      const loaded = await logo.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      );
      expect(loaded).toBe(true);
    });
  }
});

// RF-18/RF-19: the brand fonts are self-hosted woff2 files (no external font
// service, no request to any other domain) with font-display: swap, and the
// two critical files are preloaded. Fonts are checked with JavaScript on
// because FontFace data is read through `evaluate`; the pages ship no
// scripts, so the DOM is the same one a visitor without JavaScript gets.
test.describe("Self-hosted fonts", () => {
  for (const { path } of homePages) {
    test(`${path}: fonts come only from the site, as woff2 with swap`, async ({
      page,
      baseURL,
    }) => {
      const origin = new URL(baseURL!).origin;
      const requests: { url: string; type: string }[] = [];
      page.on("request", (request) =>
        requests.push({ url: request.url(), type: request.resourceType() }),
      );

      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);

      // No request at all leaves the site (no Google Fonts or other CDN).
      const foreign = requests.filter(
        ({ url }) => !url.startsWith("data:") && new URL(url).origin !== origin,
      );
      expect(foreign).toEqual([]);

      const fontRequests = requests.filter(({ type }) => type === "font");
      expect(fontRequests.length).toBeGreaterThanOrEqual(2);
      for (const { url } of fontRequests) {
        expect(new URL(url).origin).toBe(origin);
        expect(new URL(url).pathname).toMatch(/\.woff2$/);
      }

      const html = await page.content();
      expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);

      const faces = await page.evaluate(() =>
        [...document.fonts].map((face) => ({
          family: face.family.replace(/^["']|["']$/g, ""),
          weight: face.weight,
          style: face.style,
          display: face.display,
          status: face.status,
        })),
      );
      // Astro names each family "<name>-<hash>"; its metric-adjusted
      // fallbacks ("<name>-<hash> fallback: Arial") use local() fonts.
      const brandFaces = faces.filter(({ family }) =>
        /^(Lilita One|Lato)-[0-9a-f]+$/.test(family),
      );
      // Exactly Lilita One 400 + Lato 400/700, all normal and with swap.
      expect(
        brandFaces
          .map(({ family, weight }) => `${family.split("-")[0]} ${weight}`)
          .sort(),
      ).toEqual(["Lato 400", "Lato 700", "Lilita One 400"]);
      for (const face of brandFaces) {
        expect(face.style).toBe("normal");
        expect(face.display).toBe("swap");
      }
      // Lilita One (h1) and Lato (body text) are actually loaded.
      const loaded = brandFaces
        .filter(({ status }) => status === "loaded")
        .map(({ family, weight }) => `${family.split("-")[0]} ${weight}`);
      expect(loaded).toEqual(
        expect.arrayContaining(["Lilita One 400", "Lato 400"]),
      );

      // Headings use --font-heading (Lilita One); body text uses --font-body (Lato).
      const families = await page.evaluate(() => ({
        h1: getComputedStyle(document.querySelector("h1")!).fontFamily,
        body: getComputedStyle(document.body).fontFamily,
      }));
      expect(families.h1).toMatch(/^"?Lilita One-/);
      expect(families.body).toMatch(/^"?Lato-/);

      // Preload: only Lilita One 400 and Lato 400, same-origin woff2.
      const preloads = await page
        .locator('link[rel="preload"][as="font"]')
        .evaluateAll((links) =>
          links.map((link) => (link as HTMLLinkElement).href),
        );
      expect(preloads).toHaveLength(2);
      for (const href of preloads) {
        expect(new URL(href).origin).toBe(origin);
        expect(href).toMatch(/\.woff2$/);
      }
    });
  }
});

// RF-23: no horizontal overflow on narrow phones (320 and 375 px wide), on
// the 4 pages, in both languages.
test.describe("Responsive without horizontal scroll", () => {
  for (const width of [320, 375]) {
    test.describe(`${width} px`, () => {
      test.use({ viewport: { width, height: 640 } });

      for (const { path } of pages) {
        test(`${path}: content fits the width`, async ({ page }) => {
          await page.goto(path);
          await page.evaluate(() => document.fonts.ready);
          const size = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          expect(size.innerWidth).toBe(width);
          expect(size.scrollWidth).toBeLessThanOrEqual(size.innerWidth);
        });
      }
    });
  }
});
