import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Web home (minimal page) without JavaScript", () => {
  // All content must be in the served HTML, so JavaScript is disabled.
  test.use({ javaScriptEnabled: false });

  test("serves lang, viewport, title, description and a single h1", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /width=device-width/,
    );
    await expect(page).toHaveTitle(/AgencyMac/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/,
    );
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText("AgencyMac");
    await expect(page.locator("main")).toHaveCount(1);
  });

  test("ships no client-side scripts", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("script")).toHaveCount(0);
  });
});

test.describe("Web home (minimal page) accessibility", () => {
  // axe-core is injected as a script, so it needs JavaScript enabled. The
  // page itself ships no scripts (checked above), so the audited DOM is the
  // same one a visitor without JavaScript gets.
  test("has no axe accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
