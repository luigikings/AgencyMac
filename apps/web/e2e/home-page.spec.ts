import { expect, test } from "@playwright/test";
import { findContactData, findPriceMentions } from "../src/lib/copy-rules";
import { t } from "../src/lib/i18n";
import { CTA_TARGET, PROJECTS, SECTIONS } from "../src/lib/site-data";
import { homePages } from "./pages";

// RF-1, RF-9 to RF-11, RF-13, RF-15: the whole home page, without JavaScript.
test.describe("Contact and the whole page", () => {
  test.use({ javaScriptEnabled: false });

  for (const { path, locale } of homePages) {
    test(`${path}: the five sections come in order`, async ({ page }) => {
      await page.goto(path);
      const ids = await page
        .locator("main > section")
        .evaluateAll((sections) => sections.map((section) => section.id));
      expect(ids).toEqual(SECTIONS.map((section) => section.id));
    });

    test(`${path}: the contact section says the form is coming and offers the CTA`, async ({
      page,
    }) => {
      await page.goto(path);
      const section = page.locator("section#contact");
      await expect(section).toHaveCount(1);
      await expect(section.getByRole("heading", { level: 2 })).toHaveText(
        t(locale, "contact.heading"),
      );
      await expect(section).toContainText(t(locale, "contact.body"));
      await expect(
        section.getByText(t(locale, "contact.status")),
      ).toBeVisible();
      const cta = section.getByRole("link", { name: t(locale, "cta.takeOff") });
      await expect(cta).toHaveAttribute("href", CTA_TARGET);
      // The CTA appears in the header and in the contact section: twice.
      await expect(
        page.getByRole("link", { name: t(locale, "cta.takeOff") }),
      ).toHaveCount(2);
    });

    test(`${path}: every internal link leads somewhere that exists`, async ({
      page,
      request,
    }) => {
      await page.goto(path);
      const links = await page.locator("a[href]").evaluateAll((anchors) =>
        anchors.map((anchor) => {
          const href = anchor.getAttribute("href") ?? "";
          return {
            href,
            resolved: (anchor as HTMLAnchorElement).href,
            external:
              (anchor as HTMLAnchorElement).origin !== window.location.origin,
            targetExists: href.startsWith("#")
              ? document.getElementById(href.slice(1)) !== null
              : null,
          };
        }),
      );
      const internal = links.filter((link) => !link.external);
      expect(internal.length).toBeGreaterThanOrEqual(8);
      for (const link of internal) {
        if (link.href.startsWith("#")) {
          expect(link.targetExists, `${link.href} has a target`).toBe(true);
        } else {
          const response = await request.get(link.resolved);
          expect(response.status(), link.href).toBe(200);
        }
      }
      // The external links are only the two projects (checked by hand).
      expect(
        links.filter((link) => link.external).map((link) => link.href),
      ).toEqual(PROJECTS.map((project) => project.url));
    });

    test(`${path}: no prices and no contact data in the page`, async ({
      page,
    }) => {
      await page.goto(path);
      const text = await page.evaluate(() =>
        [
          document.body.innerText,
          document.title,
          document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") ?? "",
          ...[...document.querySelectorAll("[alt], [aria-label]")].flatMap(
            (element) => [
              element.getAttribute("alt") ?? "",
              element.getAttribute("aria-label") ?? "",
            ],
          ),
        ].join("\n"),
      );
      expect(findPriceMentions(text)).toEqual([]);
      expect(findContactData(text)).toEqual([]);
    });
  }
});

// RF-3, RF-10: the two buttons lead to their section without loading another
// page. Proving it needs JavaScript: a marker only survives if the document
// is not reloaded.
test.describe("Buttons go to their section in the same page", () => {
  for (const { path, locale } of homePages) {
    for (const [label, target] of [
      ["hero.discover", "services"],
      ["cta.takeOff", "contact"],
    ] as const) {
      test(`${path}: "${label}" goes to #${target}`, async ({ page }) => {
        await page.goto(path);
        await page.evaluate(() => {
          (window as unknown as { __marker: number }).__marker = 1;
        });
        await page
          .getByRole("link", { name: t(locale, label) })
          .first()
          .click();
        await expect(page).toHaveURL(new RegExp(`${path}#${target}$`));
        expect(
          await page.evaluate(
            () => (window as unknown as { __marker?: number }).__marker,
          ),
        ).toBe(1);
        // The section is now in view (the last one cannot reach the very top
        // of the window when the page ends first).
        const top = await page
          .locator(`section#${target}`)
          .evaluate((element) => element.getBoundingClientRect().top);
        const height = await page.evaluate(() => window.innerHeight);
        expect(top).toBeGreaterThanOrEqual(-2);
        expect(top).toBeLessThan(height);
      });
    }
  }
});
