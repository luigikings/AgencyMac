import { expect, test } from "@playwright/test";
import { localizePath, otherLocale, t } from "../src/lib/i18n";
import { homePages } from "./pages";

test.describe("Locale routing without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // RF-1, RF-4: Spanish at "/", English at "/en/", each declaring its lang.
  for (const { path, locale } of homePages) {
    test(`${path} is the ${locale} home page`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        t(locale, "hero.heading"),
      );
    });
  }

  // RF-2: "/en" without the trailing slash ends on "/en/", never a 404.
  test("/en ends on /en/ with a 200", async ({ page }) => {
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/en/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  // Spec 003, D17: 307, the code Cloudflare uses.
  test("/en answers with a 307 redirect to /en/", async ({ request }) => {
    const response = await request.get("/en", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/en/");
  });
});

// RF-5: a visible link in the navigation leads to the same page in the other
// language, and it works without JavaScript in both directions.
test.describe("Language link without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const { path, locale } of homePages) {
    const target = otherLocale(locale);
    test(`${path} links to the ${target} equivalent from the nav`, async ({
      page,
    }) => {
      await page.goto(path);
      const nav = page.getByRole("navigation", {
        name: t(locale, "nav.label"),
      });
      const link = nav.getByRole("link", {
        name: t(locale, "nav.switchLanguage"),
        exact: true,
      });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", localizePath(target, "/"));
      await expect(link).toHaveAttribute("hreflang", target);
      await expect(link).toHaveAttribute("lang", target);
    });
  }

  test("/ → English → back to Spanish", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      t("es", "hero.heading"),
    );

    await page
      .getByRole("navigation", { name: t("es", "nav.label") })
      .getByRole("link", { name: t("es", "nav.switchLanguage"), exact: true })
      .click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      t("en", "hero.heading"),
    );

    await page
      .getByRole("navigation", { name: t("en", "nav.label") })
      .getByRole("link", { name: t("en", "nav.switchLanguage"), exact: true })
      .click();
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      t("es", "hero.heading"),
    );
  });
});

// RF-3: the visitor's browser language never changes the page.
test.describe("Browser language is ignored", () => {
  test.use({
    javaScriptEnabled: false,
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en" },
  });

  test("an English browser opening / stays on the Spanish home", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      t("es", "hero.heading"),
    );
  });
});
