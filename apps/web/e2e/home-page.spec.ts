import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { findContactData, findPriceMentions } from "../src/lib/copy-rules";
import { t } from "../src/lib/i18n";
import { CTA_TARGET, PROJECTS, SECTIONS, TEAM } from "../src/lib/site-data";
import {
  EMBLEM_SIZE,
  constellationOf,
  constellationPath,
} from "../src/lib/sky/constellation";
import { colors } from "../src/styles/tokens";
import { homePages, pages } from "./pages";

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

// Spec 005, T28 (RF-33, RF-40): the project cards have a cosmic border, a
// gradient of at least two brand colours, which turns only while the card
// has the cursor or the focus, and only with animation. Their text sits on a
// solid panel, so axe can compute its contrast and gives it as "passes".
// The external links of spec 004 stay as they were.
const CARD = "#projects .project";

/** `#RRGGBB` of a token as the browser writes it: `rgb(r, g, b)`. */
function rgbOf(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * The border layer of every card (an empty decorative element behind the
 * panel): its background, animation and turn.
 */
function borders(page: Page) {
  return page.locator(CARD).evaluateAll((cards) =>
    cards.map((card) => {
      const s = getComputedStyle(
        card.querySelector(".project__border")!,
        "::before",
      );
      return {
        image: s.backgroundImage,
        animation: s.animationName,
        transform: s.transform,
      };
    }),
  );
}

test.describe("Project cards with a cosmic border (RF-33)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { path, locale } of homePages) {
    test(`${path}: a border of at least two brand colours around a solid panel`, async ({
      page,
    }) => {
      await page.goto(path);
      const cards = page.locator(CARD);
      await expect(cards).toHaveCount(PROJECTS.length);
      const tokenRgb = new Set(
        Object.values(colors).map((token) => rgbOf(token.value)),
      );
      for (const border of await borders(page)) {
        expect(border.image).toMatch(/^conic-gradient\(/);
        const used = new Set(border.image.match(/rgb\(\d+, \d+, \d+\)/g));
        expect(used.size).toBeGreaterThanOrEqual(2);
        for (const colour of used) expect(tokenRgb.has(colour)).toBe(true);
        // Still at rest.
        expect(border.animation).toBe("none");
      }
      const panels = await page
        .locator(`${CARD} .project__panel`)
        .evaluateAll((els) =>
          els.map((el) => {
            const s = getComputedStyle(el);
            return {
              background: s.backgroundColor,
              image: s.backgroundImage,
              opacity: s.opacity,
              texts: el.querySelectorAll("h3, p, a").length,
            };
          }),
        );
      expect(panels).toHaveLength(PROJECTS.length);
      for (const panel of panels) {
        expect(panel).toEqual({
          background: rgbOf(colors.bgDark.value),
          image: "none",
          opacity: "1",
          texts: 3,
        });
      }
      // The ring of the border shows around the panel on every side.
      const ring = await cards.first().evaluate((card) => {
        const outer = card.getBoundingClientRect();
        const inner = card
          .querySelector(".project__panel")!
          .getBoundingClientRect();
        return [
          inner.left - outer.left,
          outer.right - inner.right,
          inner.top - outer.top,
          outer.bottom - inner.bottom,
        ];
      });
      for (const side of ring) expect(side).toBeGreaterThanOrEqual(2);

      // The external links of spec 004, unchanged.
      const links = await page
        .locator(`${CARD} a`)
        .evaluateAll((anchors) =>
          anchors.map((a) => [
            a.getAttribute("href"),
            a.getAttribute("target"),
            a.getAttribute("rel"),
          ]),
        );
      expect(links).toEqual(
        PROJECTS.map((project) => [project.url, "_blank", "noopener"]),
      );
      await expect(cards.first().locator("a")).toContainText(
        t(locale, "projects.visit"),
      );
    });

    test(`${path}: the border turns only with the cursor or the focus on the card`, async ({
      page,
    }) => {
      await page.goto(path);
      const first = page.locator(CARD).first();
      await first.scrollIntoViewIfNeeded();
      await page.mouse.move(2, 2);
      expect((await borders(page)).map((b) => b.animation)).toEqual(
        PROJECTS.map(() => "none"),
      );

      // Cursor on the first card: only its border turns.
      await first.hover();
      await expect
        .poll(async () => (await borders(page)).map((b) => b.animation))
        .toEqual(
          PROJECTS.map((_, i) => (i === 0 ? "project-border-spin" : "none")),
        );
      const turn = async () => (await borders(page))[0]!.transform;
      const a = await turn();
      await page.waitForTimeout(300);
      expect(await turn()).not.toBe(a);

      // Cursor away: it stops.
      await page.mouse.move(2, 2);
      await expect
        .poll(async () => (await borders(page))[0]!.animation)
        .toBe("none");

      // Keyboard focus on the link inside the second card.
      await page.locator(`${CARD} a`).nth(1).focus();
      await expect
        .poll(async () => (await borders(page)).map((b) => b.animation))
        .toEqual(
          PROJECTS.map((_, i) => (i === 1 ? "project-border-spin" : "none")),
        );
      await page.evaluate(() => (document.activeElement as HTMLElement).blur());
      await expect
        .poll(async () => (await borders(page))[1]!.animation)
        .toBe("none");
    });

    test(`${path}: axe gives the text of the cards as passing contrast, with a border turning`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.locator(CARD).first().hover();
      const results = await new AxeBuilder({ page })
        .include(CARD)
        .withRules(["color-contrast"])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(results.incomplete).toEqual([]);
      const passed = results.passes.find((r) => r.id === "color-contrast");
      // Heading, description, link and its notice, in each card.
      expect(passed?.nodes.length ?? 0).toBeGreaterThanOrEqual(
        PROJECTS.length * 3,
      );
    });
  }

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    for (const { path } of homePages) {
      test(`${path}: the border is there and never turns`, async ({ page }) => {
        await page.goto(path);
        await page.locator(CARD).first().hover();
        await page.locator(`${CARD} a`).nth(1).focus();
        await page.waitForTimeout(300);
        for (const border of await borders(page)) {
          expect(border.image).toMatch(/^conic-gradient\(/);
          expect(border.animation).toBe("none");
        }
      });
    }
  });

  for (const width of [320, 375]) {
    test.describe(`${width} px`, () => {
      test.use({ viewport: { width, height: 700 } });

      for (const { path } of homePages) {
        test(`${path}: no horizontal overflow, with a border turning`, async ({
          page,
        }) => {
          await page.goto(path);
          const first = page.locator(CARD).first();
          await first.scrollIntoViewIfNeeded();
          await first.hover();
          const sizes = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth,
            client: document.documentElement.clientWidth,
          }));
          expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
          const box = (await first.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        });
      }
    });
  }
});

// Spec 005, T29 (RF-34, RF-40): each team member has a decorative emblem, a
// constellation of 5 to 8 stars generated from the name (SVG in the HTML,
// hidden from assistive technology), different for each person and the same
// on every load. With animation its lines "draw themselves" in 0.8 s under
// the cursor (or the focus inside the card); without it the emblem is whole
// and still. No photos, no images, no surnames.
const MEMBER = "#team .member";
const EMBLEM = `${MEMBER} svg.member__emblem`;

type Emblem = {
  hidden: string | null;
  focusable: string | null;
  stars: number;
  d: string;
  text: string;
  size: string | null;
};

function emblems(page: Page): Promise<Emblem[]> {
  return page.locator(MEMBER).evaluateAll((members) =>
    members.map((member) => {
      const svg = member.querySelector("svg.member__emblem");
      return {
        hidden: svg?.getAttribute("aria-hidden") ?? null,
        focusable: svg?.getAttribute("focusable") ?? null,
        stars: svg?.querySelectorAll("circle").length ?? 0,
        d: svg?.querySelector("path")?.getAttribute("d") ?? "",
        text: svg?.textContent?.trim() ?? "",
        size: svg?.getAttribute("viewBox") ?? null,
      };
    }),
  );
}

/** The drawing of the lines of every emblem: animation and dash offset. */
function drawing(page: Page) {
  return page.locator(`${EMBLEM} path`).evaluateAll((paths) =>
    paths.map((path) => {
      const s = getComputedStyle(path);
      return {
        animation: s.animationName,
        duration: s.animationDuration,
        offset: Number.parseFloat(s.strokeDashoffset),
      };
    }),
  );
}

test.describe("Team constellations (RF-34)", () => {
  test.describe("in the HTML, without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    for (const { path } of homePages) {
      test(`${path}: one emblem per person, 5 to 8 stars, generated from the name`, async ({
        page,
      }) => {
        await page.goto(path);
        const list = await emblems(page);
        expect(list).toHaveLength(TEAM.length);
        for (const [i, person] of TEAM.entries()) {
          const c = constellationOf(person.name);
          expect(list[i]).toEqual({
            hidden: "true",
            focusable: "false",
            stars: c.stars.length,
            d: constellationPath(c, EMBLEM_SIZE),
            text: "",
            size: `0 0 ${EMBLEM_SIZE} ${EMBLEM_SIZE}`,
          });
          expect(c.stars.length).toBeGreaterThanOrEqual(5);
          expect(c.stars.length).toBeLessThanOrEqual(8);
        }
        // A different emblem for each person.
        expect(new Set(list.map((e) => e.d)).size).toBe(TEAM.length);
        // No images in the section (spec 004) and the emblem is whole.
        await expect(page.locator("#team img, #team picture")).toHaveCount(0);
        for (const line of await drawing(page)) expect(line.offset).toBe(0);
      });
    }
  });

  test.describe("with animation", () => {
    test.use({ reducedMotion: "no-preference" });

    for (const { path } of homePages) {
      test(`${path}: the same emblems on every load`, async ({ page }) => {
        await page.goto(path);
        const first = (await emblems(page)).map((e) => e.d);
        await page.reload();
        expect((await emblems(page)).map((e) => e.d)).toEqual(first);
      });

      test(`${path}: the lines draw themselves in 0.8 s under the cursor, and only then`, async ({
        page,
      }) => {
        await page.goto(path);
        const second = page.locator(MEMBER).nth(1);
        await second.scrollIntoViewIfNeeded();
        await page.mouse.move(2, 2);
        expect((await drawing(page)).map((l) => l.animation)).toEqual(
          TEAM.map(() => "none"),
        );
        await second.hover();
        const lines = await drawing(page);
        expect(lines.map((l) => l.animation)).toEqual(
          TEAM.map((_, i) => (i === 1 ? "member-draw" : "none")),
        );
        expect(lines[1]!.duration).toBe("0.8s");
        // Mid-way it is still being drawn; once done, whole and still.
        expect(lines[1]!.offset).toBeGreaterThan(0);
        await expect
          .poll(async () => (await drawing(page))[1]!.offset, { timeout: 2000 })
          .toBe(0);
        await page.mouse.move(2, 2);
        await expect
          .poll(async () => (await drawing(page))[1]!.animation)
          .toBe("none");
        expect((await drawing(page))[1]!.offset).toBe(0);
      });

      test(`${path}: axe finds nothing in the team, with an emblem drawing`, async ({
        page,
      }) => {
        await page.goto(path);
        await page.locator(MEMBER).first().hover();
        const results = await new AxeBuilder({ page })
          .include("#team .team__list")
          .analyze();
        expect(results.violations).toEqual([]);
        expect(
          results.incomplete.filter((r) => r.id === "color-contrast"),
        ).toEqual([]);
      });
    }
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    for (const { path } of homePages) {
      test(`${path}: the emblem is whole and never draws itself`, async ({
        page,
      }) => {
        await page.goto(path);
        await page.locator(MEMBER).first().hover();
        await page.waitForTimeout(300);
        for (const line of await drawing(page)) {
          expect(line).toMatchObject({ animation: "none", offset: 0 });
        }
        expect(await page.evaluate(() => document.getAnimations().length)).toBe(
          0,
        );
      });
    }
  });

  for (const width of [320, 375]) {
    test.describe(`${width} px`, () => {
      test.use({ viewport: { width, height: 700 } });

      for (const { path } of homePages) {
        test(`${path}: the emblems fit, beside the text and inside the card`, async ({
          page,
        }) => {
          await page.goto(path);
          const boxes = await page.locator(MEMBER).evaluateAll((members) =>
            members.map((member) => {
              const card = member.getBoundingClientRect();
              const svg = member
                .querySelector("svg.member__emblem")!
                .getBoundingClientRect();
              const text = [...member.querySelectorAll("h3, p")].map((el) =>
                el.getBoundingClientRect(),
              );
              const overlaps = text.some(
                (r) =>
                  Math.min(r.right, svg.right) - Math.max(r.left, svg.left) >
                    0.5 &&
                  Math.min(r.bottom, svg.bottom) - Math.max(r.top, svg.top) >
                    0.5,
              );
              return {
                inside:
                  svg.left >= card.left &&
                  svg.right <= card.right &&
                  svg.top >= card.top &&
                  svg.bottom <= card.bottom,
                overlaps,
              };
            }),
          );
          for (const box of boxes) {
            expect(box).toEqual({ inside: true, overlaps: false });
          }
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          );
          expect(overflow).toBeLessThanOrEqual(0);
        });
      }
    });
  }
});

// Spec 005, T30 (RF-35, RF-36, RF-40, RF-43): the contact section has a
// decorative launch pad with the isologo as its rocket (no new image) and,
// with animation, its "Quiero despegar" pulses every 3 s; the status "form
// coming soon" and the room for the form of spec 006 stay. The footer of the
// home page has the curved horizon of a planet with a satellite that orbits
// it (with animation) and `footer.detail`, on a solid background. The 404
// pages keep their plain footer. Mac says `mac.arrive.contact` on arriving.
const LAUNCH = "#contact .contact__launch";
const FOOTER = "footer.site-footer";

test.describe("Contact and footer (RF-35, RF-36)", () => {
  test.describe("in the HTML, without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    for (const { path, locale } of homePages) {
      test(`${path}: launch pad with the isologo, status and the room for the form`, async ({
        page,
      }) => {
        await page.goto(path);
        const launch = page.locator(LAUNCH);
        await expect(launch).toHaveCount(1);
        await expect(launch).toHaveAttribute("aria-hidden", "true");
        const rocket = launch.locator("img");
        await expect(rocket).toHaveCount(1);
        await expect(rocket).toHaveAttribute("src", "/favicon.svg");
        await expect(rocket).toHaveAttribute("alt", "");
        await expect
          .poll(() =>
            rocket.evaluate(
              (img) => (img as HTMLImageElement).naturalWidth > 0,
            ),
          )
          .toBe(true);
        const section = page.locator("section#contact");
        await expect(
          section.getByText(t(locale, "contact.status")),
        ).toBeVisible();
        const slot = section.locator("[data-contact-form]");
        await expect(slot).toHaveCount(1);
        expect(await slot.innerHTML()).toBe("");
        // The pad never covers the texts or the button of the section.
        const covered = await page.evaluate((selector) => {
          const pad = document.querySelector(selector)!.getBoundingClientRect();
          return [
            ...document.querySelectorAll(
              "#contact h2, #contact p, #contact .cta",
            ),
          ]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return (
                Math.min(r.right, pad.right) - Math.max(r.left, pad.left) >
                  0.5 &&
                Math.min(r.bottom, pad.bottom) - Math.max(r.top, pad.top) > 0.5
              );
            })
            .map((el) => el.tagName);
        }, LAUNCH);
        expect(covered).toEqual([]);
      });

      test(`${path}: footer with horizon, satellite and its line, on a solid background`, async ({
        page,
      }) => {
        await page.goto(path);
        const footer = page.locator(FOOTER);
        const horizon = footer.locator(".site-footer__horizon");
        await expect(horizon).toHaveCount(1);
        await expect(horizon).toHaveAttribute("aria-hidden", "true");
        await expect(horizon.locator(".site-footer__planet")).toHaveCount(1);
        await expect(horizon.locator(".site-footer__satellite")).toHaveCount(1);
        await expect(page.getByRole("contentinfo")).toContainText(
          t(locale, "footer.text"),
        );
        await expect(page.getByRole("contentinfo")).toContainText(
          t(locale, "footer.detail"),
        );
        const text = await footer.evaluate((el) => {
          const s = getComputedStyle(el);
          const detail = el.querySelector(".site-footer__detail")!;
          const horizonBox = el
            .querySelector(".site-footer__horizon")!
            .getBoundingClientRect();
          return {
            background: s.backgroundColor,
            image: s.backgroundImage,
            // The texts sit below the horizon, never over it.
            below:
              detail.getBoundingClientRect().top >= horizonBox.bottom - 0.5,
          };
        });
        expect(text).toEqual({
          background: rgbOf(colors.bgDark.value),
          image: "none",
          below: true,
        });
      });
    }

    for (const { path, locale } of pages.filter((p) => p.kind === "notFound")) {
      test(`${path}: the 404 keeps its plain footer`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator(".site-footer__horizon")).toHaveCount(0);
        await expect(page.getByRole("contentinfo")).toContainText(
          t(locale, "footer.text"),
        );
        await expect(page.getByRole("contentinfo")).not.toContainText(
          t(locale, "footer.detail"),
        );
      });
    }
  });

  test.describe("with animation", () => {
    test.use({ reducedMotion: "no-preference" });

    for (const { path, locale } of homePages) {
      test(`${path}: the button of the contact section pulses every 3 s, the one in the header does not`, async ({
        page,
      }) => {
        await page.goto(path);
        const pulse = (selector: string) =>
          page.locator(selector).evaluate((el) => {
            const s = getComputedStyle(el);
            return [
              s.animationName,
              s.animationDuration,
              s.animationIterationCount,
            ];
          });
        // The ring under the button pulses (the button clips its own overflow).
        expect(await pulse("#contact .cta-ring")).toEqual([
          "cta-pulse",
          "3s",
          "infinite",
        ]);
        expect((await pulse("header .cta"))[0]).toBe("none");
        await expect(page.locator("header .cta-ring")).toHaveCount(0);
        await expect(page.locator("#contact .cta-ring")).toHaveAttribute(
          "aria-hidden",
          "true",
        );
        // Under the cursor it stops pulsing, so its hover glow shows.
        await page.locator("#contact .cta").hover();
        await expect
          .poll(async () => (await pulse("#contact .cta-ring"))[0])
          .toBe("none");
        await expect(
          page.getByRole("link", { name: t(locale, "cta.takeOff") }).last(),
        ).toHaveAttribute("href", CTA_TARGET);
      });

      test(`${path}: the satellite orbits over the horizon`, async ({
        page,
      }) => {
        await page.goto(path);
        const satellite = page.locator(`${FOOTER} .site-footer__satellite`);
        // Not scrollIntoViewIfNeeded: it waits for the element to stand still.
        await satellite.evaluate((el) =>
          el.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        const state = () =>
          satellite.evaluate((el) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return { name: s.animationName, x: Math.round(r.left) };
          });
        const a = await state();
        expect(a.name).toBe("footer-orbit");
        await page.waitForTimeout(600);
        expect((await state()).x).not.toBe(a.x);
      });

      test(`${path}: Mac says his line on arriving at the contact section`, async ({
        page,
      }) => {
        await page.goto(path);
        await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
        await page.waitForTimeout(3000);
        await page.evaluate(() =>
          document
            .querySelector("#contact .contact__launch")!
            .scrollIntoView({ block: "center", behavior: "instant" }),
        );
        await expect(page.locator("[data-mac-bubble-text]")).toHaveText(
          t(locale, "mac.arrive.contact"),
          { timeout: 5000 },
        );
      });
    }
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    for (const { path } of homePages) {
      test(`${path}: no pulse, a still satellite, and no line from Mac`, async ({
        page,
      }) => {
        await page.goto(path);
        await page.locator(LAUNCH).scrollIntoViewIfNeeded();
        await page.waitForTimeout(2500);
        const state = await page.evaluate(() => ({
          pulse: getComputedStyle(document.querySelector("#contact .cta-ring")!)
            .animationName,
          satellite: getComputedStyle(
            document.querySelector(".site-footer__satellite")!,
          ).animationName,
          visible:
            getComputedStyle(document.querySelector(".site-footer__satellite")!)
              .visibility === "visible",
          animations: document.getAnimations().length,
          bubbles: document.querySelectorAll("[data-mac-bubble]").length,
        }));
        expect(state).toEqual({
          pulse: "none",
          satellite: "none",
          visible: true,
          animations: 0,
          bubbles: 0,
        });
      });
    }
  });

  for (const width of [320, 375]) {
    test.describe(`${width} px`, () => {
      test.use({ viewport: { width, height: 700 } });

      for (const { path } of homePages) {
        test(`${path}: launch pad, horizon and satellite fit, no overflow`, async ({
          page,
        }) => {
          await page.goto(path);
          const boxes = await page.evaluate(() => {
            const inside = (sel: string, box: string) => {
              const a = document.querySelector(sel)!.getBoundingClientRect();
              const b = document.querySelector(box)!.getBoundingClientRect();
              return (
                a.left >= b.left - 0.5 &&
                a.right <= b.right + 0.5 &&
                a.top >= b.top - 0.5 &&
                a.bottom <= b.bottom + 0.5
              );
            };
            return {
              launch: inside("#contact .contact__launch", "#contact"),
              satellite: inside(
                ".site-footer__satellite",
                ".site-footer__horizon",
              ),
              overflow:
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
            };
          });
          expect(boxes.launch).toBe(true);
          expect(boxes.satellite).toBe(true);
          expect(boxes.overflow).toBeLessThanOrEqual(0);
        });
      }
    });
  }
});
