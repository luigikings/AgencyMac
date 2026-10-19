import { expect, test } from "@playwright/test";
import { localizePath, t } from "../src/lib/i18n";
import { NAV_SECTIONS, PROJECTS, SERVICES, TEAM } from "../src/lib/site-data";
import { findHidingRules } from "../src/styles/motion-css";
import { colors } from "../src/styles/tokens";
import { homePages } from "./pages";

// The home page without JavaScript (RF-15): everything below is plain HTML.
test.use({ javaScriptEnabled: false });

test.describe("Home header (RF-9, RF-12, RF-16)", () => {
  for (const { path, locale } of homePages) {
    test(`${path}: logo inside the link to the home page`, async ({ page }) => {
      await page.goto(path);
      const header = page.getByRole("banner");
      const brand = header.getByRole("link", { name: t(locale, "nav.home") });
      await expect(brand).toHaveAttribute("href", localizePath(locale, "/"));
      const logo = brand.locator("img");
      await expect(logo).toHaveCount(1);
      // The logo is the white-letters variant, with real alt text.
      await expect(logo).toHaveAttribute("alt", t(locale, "nav.home"));
      expect(await logo.getAttribute("src")).toContain("logo-white-letters");
      // Declared dimensions (no layout shift) and loaded right away.
      expect(Number(await logo.getAttribute("width"))).toBeGreaterThan(0);
      expect(Number(await logo.getAttribute("height"))).toBeGreaterThan(0);
      expect(await logo.getAttribute("loading")).not.toBe("lazy");
      // Modern formats offered through <picture>.
      const types = await brand
        .locator("picture source")
        .evaluateAll((sources) =>
          sources.map((source) => source.getAttribute("type")),
        );
      expect(types).toEqual(
        expect.arrayContaining(["image/avif", "image/webp"]),
      );
    });

    test(`${path}: four section links and the language link`, async ({
      page,
    }) => {
      await page.goto(path);
      const nav = page.getByRole("banner").getByRole("navigation");
      await expect(nav).toHaveCount(1);
      const links = await nav
        .getByRole("link")
        .evaluateAll((anchors) =>
          anchors.map((anchor) => [
            anchor.textContent?.trim(),
            anchor.getAttribute("href"),
          ]),
        );
      expect(links).toEqual([
        ...NAV_SECTIONS.map((section) => [
          t(locale, section.navKey),
          `#${section.id}`,
        ]),
        [
          t(locale, "nav.switchLanguage"),
          localizePath(locale === "es" ? "en" : "es", "/"),
        ],
      ]);
    });

    test(`${path}: "I want to take off" goes to the contact section`, async ({
      page,
    }) => {
      await page.goto(path);
      const cta = page
        .getByRole("banner")
        .getByRole("link", { name: t(locale, "cta.takeOff") });
      await expect(cta).toHaveCount(1);
      await expect(cta).toHaveAttribute("href", "#contact");
    });

    test(`${path}: no empty or fake links`, async ({ page }) => {
      await page.goto(path);
      const hrefs = await page
        .locator("a")
        .evaluateAll((anchors) =>
          anchors.map((anchor) => anchor.getAttribute("href")),
        );
      for (const href of hrefs) {
        expect(href, "every link has a destination").toBeTruthy();
        expect(href).not.toBe("#");
      }
    });

    test(`${path}: main uses the full width`, async ({ page }) => {
      await page.goto(path);
      const main = await page.locator("main").evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          maxWidth: style.maxWidth,
          paddingLeft: style.paddingLeft,
          paddingTop: style.paddingTop,
          width: element.getBoundingClientRect().width,
          innerWidth: window.innerWidth,
        };
      });
      expect(main.maxWidth).toBe("none");
      expect(main.paddingLeft).toBe("0px");
      expect(main.paddingTop).toBe("0px");
      expect(main.width).toBe(main.innerWidth);
    });
  }
});

test.describe("Home header on narrow screens", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const { path } of homePages) {
    test(`${path}: the navigation does not overflow at 320 px`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      const size = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(size.scrollWidth).toBeLessThanOrEqual(size.innerWidth);
    });
  }
});

// RF-1 to RF-3, RF-24, RF-25, RF-38: the hero, without JavaScript.
test.describe("Hero", () => {
  for (const { path, locale } of homePages) {
    test(`${path}: single h1 with the tagline right below`, async ({
      page,
    }) => {
      await page.goto(path);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(t(locale, "hero.heading"));
      // The tagline is visible text, the next element after the h1.
      const next = h1.locator("xpath=following-sibling::*[1]");
      await expect(next).toHaveText(t(locale, "hero.tagline"));
      await expect(next).toBeVisible();
      expect(await next.evaluate((el) => el.tagName)).toBe("P");
    });

    test(`${path}: kicker, subtitle and "find out how" link`, async ({
      page,
    }) => {
      await page.goto(path);
      const hero = page.locator("section#hero");
      await expect(hero).toHaveCount(1);
      await expect(hero.getByText(t(locale, "hero.kicker"))).toBeVisible();
      await expect(hero.getByText(t(locale, "hero.subtitle"))).toBeVisible();
      const discover = hero.getByRole("link", {
        name: t(locale, "hero.discover"),
      });
      await expect(discover).toHaveAttribute("href", "#services");
      // The hero is a labelled region of the h1.
      await expect(hero).toHaveAttribute("aria-labelledby", /.+/);
    });

    test(`${path}: Mac and the Moon load first, no hero image is lazy`, async ({
      page,
    }) => {
      await page.goto(path);
      const images = page.locator("section#hero img");
      await expect(images).toHaveCount(2);
      const info = await images.evaluateAll((list) =>
        list.map((image) => ({
          src: image.getAttribute("src") ?? "",
          alt: image.getAttribute("alt"),
          loading: image.getAttribute("loading"),
          fetchpriority: image.getAttribute("fetchpriority"),
          width: Number(image.getAttribute("width")),
          height: Number(image.getAttribute("height")),
        })),
      );
      const mac = info.find((image) => image.src.includes("mac"));
      const moon = info.find((image) => image.src.includes("moon"));
      expect(mac?.alt).toBe(t(locale, "hero.macAlt"));
      expect(moon?.alt).toBe(""); // decorative
      for (const image of [mac!, moon!]) {
        expect(image.loading).toBe("eager");
        expect(image.fetchpriority).toBe("high");
        expect(image.width).toBeGreaterThan(0);
        expect(image.height).toBeGreaterThan(0);
      }
      // Modern formats in several sizes.
      const sources = await page
        .locator("section#hero picture source")
        .evaluateAll((list) =>
          list.map((source) => ({
            type: source.getAttribute("type"),
            srcset: source.getAttribute("srcset") ?? "",
          })),
        );
      expect(sources.map((source) => source.type)).toEqual(
        expect.arrayContaining(["image/avif", "image/webp"]),
      );
      for (const source of sources) {
        expect(source.srcset.split(",").length).toBeGreaterThan(1);
      }
    });

    test(`${path}: nothing in the hero starts hidden`, async ({ page }) => {
      await page.goto(path);
      const hidden = await page
        .locator("section#hero, section#hero *")
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              // The flame of Mac is a decoration that fades in and out in the
              // entrance (spec 005, RF-18); nothing with content may hide.
              if (element.matches(".hero__flame, .hero__spark")) return false;
              const style = getComputedStyle(element);
              return style.opacity === "0" || style.visibility === "hidden";
            })
            .map((element) => element.tagName),
        );
      expect(hidden).toEqual([]);
    });

    test(`${path}: no text sits on an image, and text on a gradient is a sky text (RF-8)`, async ({
      page,
    }) => {
      await page.goto(path);
      const hero = await page.locator("section#hero").evaluate((section) => {
        const textElements = [...section.querySelectorAll("h1, p, a")];
        return textElements
          .map((element) => {
            let node: Element | null = element;
            let gradient = false;
            while (node) {
              const image = getComputedStyle(node).backgroundImage;
              if (image.includes("url(")) return element.tagName;
              if (image !== "none") gradient = true;
              node = node.parentElement;
            }
            // A text over a gradient must be marked: its contrast is measured
            // on the pixels (sky-ambients.spec.ts).
            return gradient && !element.hasAttribute("data-sky-text")
              ? element.tagName
              : null;
          })
          .filter(Boolean);
      });
      expect(hero).toEqual([]);
    });
  }
});

// RNF-6: on a 375 px phone only the logo, Mac and the Moon are downloaded
// before the page finishes loading, and together they weigh at most 90 KB.
test.describe("Images visible on load (375 px)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const { path } of homePages) {
    test(`${path}: logo, Mac and the Moon weigh at most 90 KB`, async ({
      page,
    }) => {
      const sizes: { url: string; bytes: number }[] = [];
      page.on("response", async (response) => {
        if (response.request().resourceType() !== "image") return;
        const body = await response.body().catch(() => Buffer.alloc(0));
        sizes.push({ url: response.url(), bytes: body.length });
      });
      await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      // Lazy images near the viewport (the first planet) may also be fetched:
      // only the eager ones (logo, Mac, Moon) count for this budget.
      const eager = sizes.filter(({ url }) =>
        /logo-white-letters|\/mac\.|\/moon\./.test(url),
      );
      const total = eager.reduce((sum, item) => sum + item.bytes, 0);
      console.log(
        `[${path}] eager images: ${eager.length}, ${total} bytes (all images: ${sizes.length})`,
      );
      expect(eager.length).toBe(3);
      expect(total).toBeLessThanOrEqual(90 * 1024);
    });

    test(`${path}: the long headline does not overflow at 320 px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const h1Right = await page
        .locator("h1")
        .evaluate((element) => element.getBoundingClientRect().right);
      expect(h1Right).toBeLessThanOrEqual(320);
    });
  }
});

// RF-4, RF-19, RF-24, RF-38: the services section, one solid band per planet.
function hexToRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

async function checkServiceBands(
  page: import("@playwright/test").Page,
  locale: "es" | "en",
) {
  const section = page.locator("section#services");
  await expect(section).toHaveCount(1);
  await expect(section.getByRole("heading", { level: 2 })).toHaveText(
    t(locale, "services.heading"),
  );
  await expect(section).toContainText(t(locale, "services.intro"));

  const bands = section.locator("article[data-planet]");
  await expect(bands).toHaveCount(3);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  for (const [index, service] of SERVICES.entries()) {
    const band = bands.nth(index);
    await expect(band).toHaveAttribute("data-planet", service.id);
    // Name as h3, then role and body, with the base-plan or booster tag.
    await expect(band.getByRole("heading", { level: 3 })).toHaveText(
      service.name,
    );
    await expect(band).toContainText(t(locale, service.tagKey));
    await expect(band).toContainText(t(locale, service.roleKey));
    await expect(band).toContainText(t(locale, service.bodyKey));
    // Solid background of its own token, and the band spans the viewport.
    const style = await band.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        color: computed.backgroundColor,
        image: computed.backgroundImage,
        width: element.getBoundingClientRect().width,
      };
    });
    expect(style.color).toBe(hexToRgb(colors[service.bgToken].value));
    // No picture under the band; the sky only adds gradients of tokens (RF-5).
    expect(style.image).not.toContain("url(");
    expect(style.width).toBe(viewportWidth);
  }
}

test.describe("Services", () => {
  for (const { path, locale } of homePages) {
    test(`${path}: three planets with their own solid band`, async ({
      page,
    }) => {
      await page.goto(path);
      await checkServiceBands(page, locale);
    });

    test(`${path}: the bands are the same with reduced motion`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await checkServiceBands(page, locale);
    });

    test(`${path}: tags say base plan for Hexaweb and Rankia, booster for Adara`, async ({
      page,
    }) => {
      await page.goto(path);
      const tags = await page
        .locator("section#services article[data-planet] .service__tag")
        .allTextContents();
      expect(tags).toEqual([
        t(locale, "services.tagBase"),
        t(locale, "services.tagBase"),
        t(locale, "services.tagBooster"),
      ]);
    });

    test(`${path}: planet images are lazy, sized and described`, async ({
      page,
    }) => {
      await page.goto(path);
      const images = page.locator("section#services img");
      await expect(images).toHaveCount(3);
      const info = await images.evaluateAll((list) =>
        list.map((image) => ({
          alt: image.getAttribute("alt"),
          src: image.getAttribute("src") ?? "",
          loading: image.getAttribute("loading"),
          width: Number(image.getAttribute("width")),
          height: Number(image.getAttribute("height")),
        })),
      );
      for (const [index, service] of SERVICES.entries()) {
        expect(info[index].alt).toBe(t(locale, service.altKey));
        expect(info[index].src).toContain(service.image);
        expect(info[index].loading).toBe("lazy");
        expect(info[index].width).toBeGreaterThan(0);
        expect(info[index].height).toBeGreaterThan(0);
      }
      const sources = await page
        .locator("section#services picture source")
        .evaluateAll((list) =>
          list.map((source) => ({
            type: source.getAttribute("type"),
            srcset: source.getAttribute("srcset") ?? "",
          })),
        );
      expect(sources.map((source) => source.type)).toEqual(
        expect.arrayContaining(["image/avif", "image/webp"]),
      );
      for (const source of sources) {
        expect(source.srcset.split(",").length).toBeGreaterThan(1);
      }
    });

    test(`${path}: no text sits on an image, and text on a gradient is a sky text (RF-8)`, async ({
      page,
    }) => {
      await page.goto(path);
      const offenders = await page
        .locator("section#services")
        .evaluate((section) =>
          [...section.querySelectorAll("h2, h3, p, span")]
            // The decoration (halo, orbit, moons) carries no text.
            .filter((element) => !element.closest('[aria-hidden="true"]'))
            .filter((element) => {
              let gradient = false;
              for (
                let node: Element | null = element;
                node;
                node = node.parentElement
              ) {
                const image = getComputedStyle(node).backgroundImage;
                if (image.includes("url(")) return true;
                if (image !== "none") gradient = true;
              }
              // A text over a gradient must be a marked sky text: its
              // contrast is measured on the pixels (sky-ambients.spec.ts).
              return gradient && !element.hasAttribute("data-sky-text");
            })
            .map((element) => element.tagName),
        );
      expect(offenders).toEqual([]);
    });
  }
});

// RF-6, RF-7, RF-8, RNF-10: projects and team, without JavaScript.
test.describe("Projects", () => {
  for (const { path, locale } of homePages) {
    test(`${path}: two cards with an external link that opens in a new tab`, async ({
      page,
    }) => {
      await page.goto(path);
      const section = page.locator("section#projects");
      await expect(section).toHaveCount(1);
      await expect(section.getByRole("heading", { level: 2 })).toHaveText(
        t(locale, "projects.heading"),
      );
      await expect(section).toContainText(t(locale, "projects.intro"));
      const cards = section.locator("article");
      await expect(cards).toHaveCount(PROJECTS.length);
      for (const [index, project] of PROJECTS.entries()) {
        const card = cards.nth(index);
        await expect(card.getByRole("heading", { level: 3 })).toHaveText(
          project.name,
        );
        await expect(card).toContainText(t(locale, project.descriptionKey));
        const link = card.getByRole("link");
        await expect(link).toHaveCount(1);
        // Exact destination, new tab, safe rel, and the notice inside the link.
        await expect(link).toHaveAttribute("href", project.url);
        await expect(link).toHaveAttribute("target", "_blank");
        const rel = (await link.getAttribute("rel")) ?? "";
        expect(rel.split(/\s+/)).toContain("noopener");
        expect(rel).not.toMatch(/nofollow|noreferrer/);
        await expect(link).toContainText(project.domain);
        await expect(link).toContainText(t(locale, "projects.visit"));
        await expect(link).toContainText(t(locale, "projects.newTab"));
      }
    });

    test(`${path}: no project screenshots, only the decorative Earth`, async ({
      page,
    }) => {
      await page.goto(path);
      const images = page.locator("section#projects img");
      const count = await images.count();
      expect(count).toBeLessThanOrEqual(1);
      for (let i = 0; i < count; i++) {
        await expect(images.nth(i)).toHaveAttribute("alt", "");
        expect(await images.nth(i).getAttribute("src")).toContain(
          "planet-earth",
        );
        expect(await images.nth(i).getAttribute("loading")).toBe("lazy");
        // Decorative images are hidden from assistive technology.
        await expect(page.locator("section#projects picture")).toHaveCount(1);
      }
    });
  }
});

test.describe("Team", () => {
  for (const { path, locale } of homePages) {
    test(`${path}: three people with a name and a role, no images`, async ({
      page,
    }) => {
      await page.goto(path);
      const section = page.locator("section#team");
      await expect(section).toHaveCount(1);
      await expect(section.getByRole("heading", { level: 2 })).toHaveText(
        t(locale, "team.heading"),
      );
      await expect(section).toContainText(t(locale, "team.intro"));
      const people = section.getByRole("listitem");
      await expect(people).toHaveCount(TEAM.length);
      for (const [index, person] of TEAM.entries()) {
        const item = people.nth(index);
        await expect(item).toContainText(person.name);
        await expect(item).toContainText(t(locale, person.roleKey));
        // Only first name and role: nothing else in the item.
        const text = (await item.innerText()).replace(/\s+/g, " ").trim();
        expect(text).toBe(`${person.name} ${t(locale, person.roleKey)}`);
        await expect(item.locator("img, a")).toHaveCount(0);
      }
      await expect(section.locator("img")).toHaveCount(0);
    });
  }
});

test.describe("Projects and team on a phone", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const { path } of homePages) {
    test(`${path}: no cut text at 375 px`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      // No block element has content wider than itself (text cut or spilling).
      const cut = await page.evaluate(() =>
        [...document.querySelectorAll("#projects *, #team *")]
          .filter(
            (element) =>
              element.scrollWidth > element.clientWidth + 1 &&
              getComputedStyle(element).display !== "inline" &&
              // Only what holds text can cut it (spec 005, T28: the cosmic
              // border of the project cards is an empty layer wider than its
              // box, clipped by the card).
              (element.textContent ?? "").trim() !== "",
          )
          .map((element) => element.tagName),
      );
      expect(cut).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

// RF-32, RF-38: the stylesheets the browser really receives (linked and
// inline) contain no rule that hides content on load.
test.describe("Served stylesheets", () => {
  for (const { path } of homePages) {
    test(`${path}: no rule sets opacity 0, visibility hidden or display none`, async ({
      request,
    }) => {
      const html = await (await request.get(path)).text();
      const sheets = [
        ...[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
          (match) => match[1]!,
        ),
      ];
      const links = [
        ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g),
      ].map((match) => match[1]!);
      for (const href of links) {
        sheets.push(await (await request.get(href)).text());
      }
      expect(sheets.length).toBeGreaterThan(0);
      for (const css of sheets) {
        expect(findHidingRules(css)).toEqual([]);
      }
    });
  }
});
