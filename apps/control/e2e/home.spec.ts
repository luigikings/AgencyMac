import { expect, test } from "@playwright/test";

test.describe("Control Center home", () => {
  test("shows the Spanish heading and title", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page).toHaveTitle("Centro de Control");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText("Centro de Control");
  });

  test("is marked as noindex with meta robots", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /\bnoindex\b/,
    );
  });
});
