import { gzipSync } from "node:zlib";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { t } from "../src/lib/i18n";
import { GESTURE_MS, LOAD_DELAY_MS } from "../src/lib/motion/motion-config";
import { NAV_SECTIONS, SERVICES } from "../src/lib/site-data";
import { homePages } from "./pages";

// RF-31, RF-32, RF-33, RF-35, RNF-5, RNF-7: the animation code arrives late
// (after `load` plus a delay), never when motion is reduced, and the page is
// complete without it. Blocks below the fold appear from opposite sides.

const READY = 'html[data-motion="on"]';
// Marks the GSAP bundle: its licence header survives minification.
const GSAP_HEADER = /GreenSock/;
const GSAP_LICENSE_URL = "https://gsap.com/standard-license";
const FOLD_MARGIN = 120;
// Strings only ScrollTrigger's code carries (they survive minification).
const SCROLL_TRIGGER =
  /pin-spacer|scrollerProxy|registerPlugin\(ScrollTrigger\)/;

type Loaded = { url: string; body: Buffer; startTime: number };

/** Records every JavaScript response; resolve it with `scripts()` later. */
function trackScripts(page: Page) {
  const pending: Promise<{ url: string; body: Buffer }>[] = [];
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (type !== "script") return;
    pending.push(
      response.body().then((body) => ({ url: response.url(), body })),
    );
  });
  return {
    async scripts(): Promise<{ loaded: Loaded[]; loadEventStart: number }> {
      const bodies = await Promise.all(pending);
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        const starts: Record<string, number> = {};
        for (const entry of performance.getEntriesByType("resource")) {
          starts[entry.name] = entry.startTime;
        }
        return { loadEventStart: nav.loadEventStart, starts };
      });
      return {
        loaded: bodies.map((item) => ({
          ...item,
          startTime: timing.starts[item.url] ?? Number.NaN,
        })),
        loadEventStart: timing.loadEventStart,
      };
    },
  };
}

/** Opacity and translation of the two halves of each service block. */
async function revealState(page: Page) {
  return page.locator("[data-reveal]").evaluateAll((blocks) =>
    blocks.map((block) => {
      const read = (selector: string) => {
        const el = block.querySelector(selector) as HTMLElement;
        const style = getComputedStyle(el);
        const matrix =
          style.transform === "none"
            ? [1, 0, 0, 1, 0, 0]
            : style.transform
                .replace(/^matrix\(|\)$/g, "")
                .split(",")
                .map(Number);
        return {
          opacity: Number(style.opacity),
          x: matrix[4] ?? 0,
          y: matrix[5] ?? 0,
        };
      };
      return {
        top: block.getBoundingClientRect().top,
        art: read(".service__art"),
        text: read(".service__text"),
      };
    }),
  );
}

const TRAVELER = "img[data-traveler]";

/** Waits until the scroll position stops changing and returns it. */
async function settledScroll(page: Page) {
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 80 && stable < 10; i++) {
    const now = await page.evaluate(() => Math.round(window.scrollY));
    stable = now === last ? stable + 1 : 0;
    last = now;
    await page.waitForTimeout(50);
  }
  return last;
}

// The way a visitor goes back: the Home key (works with smooth scrolling too).
async function backToTop(page: Page) {
  await settledScroll(page);
  await page.keyboard.press("Home");
  await expect.poll(() => settledScroll(page)).toBe(0);
}

/** Has the page scrolled to section `id` (or as far as the page allows)? */
async function arrivedAt(page: Page, id: string) {
  return page.evaluate(
    (target) =>
      Math.abs(document.getElementById(target)!.getBoundingClientRect().top) <
        200 ||
      window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2,
    id,
  );
}

/** Is the traveller's centre inside the illustration of planet block `i`? */
async function travelerInsidePlanet(page: Page, i: number) {
  return page.evaluate(
    ([selector, index]) => {
      const traveler = document.querySelector(selector as string);
      const planet = document.querySelectorAll(
        "[data-reveal] .service__art img",
      )[index as number];
      if (!traveler || !planet) return false;
      const m = traveler.getBoundingClientRect();
      // The planet where it rests: a block that has not slid in yet is
      // translated, and the traveller aims at its final place.
      const art = planet.closest(".service__art") as HTMLElement;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(art).transform);
      const p = planet.getBoundingClientRect();
      const left = p.left - matrix.e;
      const right = p.right - matrix.e;
      const top = p.top - matrix.f;
      const bottom = p.bottom - matrix.f;
      const cx = m.left + m.width / 2;
      const cy = m.top + m.height / 2;
      return cx >= left && cx <= right && cy >= top && cy <= bottom;
    },
    [TRAVELER, i] as const,
  );
}

async function expectNoTraveler(page: Page) {
  await expect(page.locator(TRAVELER)).toHaveCount(0);
  await expect(page.locator("#services")).not.toHaveAttribute(
    "data-active-planet",
    /.*/,
  );
}

async function expectActivePlanet(page: Page, i: number) {
  await expect(page.locator("#services")).toHaveAttribute(
    "data-active-planet",
    SERVICES[i]!.id,
  );
  // The traveller settles on the planet once the scroll stops.
  await expect.poll(() => travelerInsidePlanet(page, i)).toBe(true);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectAllVisible(page: Page) {
  const state = await revealState(page);
  expect(state).toHaveLength(SERVICES.length);
  for (const block of state) {
    for (const part of [block.art, block.text]) {
      expect(part.opacity).toBe(1);
      expect(part.x).toBe(0);
      expect(part.y).toBe(0);
    }
  }
}

for (const { path, locale } of homePages) {
  test.describe(`${path}: deferred animation code`, () => {
    test("the initial HTML already holds all the content", async ({
      page,
      request,
    }) => {
      const html = await (await request.get(path)).text();
      for (const service of SERVICES) {
        expect(html).toContain(service.name);
        expect(html).toContain(`data-planet="${service.id}"`);
      }
      expect(html).toContain(t(locale, "services.heading"));
      expect((html.match(/data-reveal/g) ?? []).length).toBe(SERVICES.length);
      await page.goto(path);
      await expect(page.locator("[data-reveal]")).toHaveCount(SERVICES.length);
    });

    test("nothing of GSAP downloads before load, and it arrives after load plus the delay", async ({
      page,
    }) => {
      const tracker = trackScripts(page);
      await page.goto(path, { waitUntil: "load" });
      // Right at load nothing is hidden or moved.
      await expectAllVisible(page);
      await page.waitForSelector(READY, { timeout: 10_000 });
      const { loaded, loadEventStart } = await tracker.scripts();

      const gsap = loaded.filter((s) => GSAP_HEADER.test(s.body.toString()));
      expect(gsap.length).toBeGreaterThan(0);
      for (const script of gsap) {
        expect(script.startTime).toBeGreaterThanOrEqual(
          loadEventStart + LOAD_DELAY_MS - 150,
        );
      }

      // JS that arrived before load: at most 3 KB gzip in total (RNF-5).
      const early = loaded.filter((s) => s.startTime < loadEventStart);
      const earlyBytes = early.reduce(
        (sum, s) => sum + gzipSync(s.body, { level: 9 }).length,
        0,
      );
      expect(earlyBytes).toBeLessThanOrEqual(3 * 1024);
    });

    test("the GSAP bundle keeps its licence notice (plan 0.2)", async ({
      page,
    }) => {
      const tracker = trackScripts(page);
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      const { loaded } = await tracker.scripts();
      const text = loaded.map((s) => s.body.toString()).join("\n");
      expect(text).toMatch(/@license[^\n]*GreenSock/);
      expect(text).toContain(GSAP_LICENSE_URL);
    });

    test("blocks below the fold start hidden and appear from opposite sides", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      const state = await revealState(page);
      const viewport = 600;
      const hidden = state
        .map((block, index) => ({ block, index }))
        .filter(({ block }) => block.top > viewport + FOLD_MARGIN);
      expect(hidden.length).toBeGreaterThan(0);

      for (const { block, index } of state
        .map((block, index) => ({ block, index }))
        .filter(({ block }) => block.top <= viewport + FOLD_MARGIN)) {
        // Visible blocks are never touched.
        expect(block.art.opacity, `block ${index}`).toBe(1);
        expect(block.text.opacity, `block ${index}`).toBe(1);
      }

      for (const { block, index } of hidden) {
        expect(block.art.opacity).toBe(0);
        expect(block.text.opacity).toBe(0);
        // Even blocks: illustration from the left, text from the right.
        const artFromLeft = index % 2 === 0;
        expect(Math.sign(block.art.x)).toBe(artFromLeft ? -1 : 1);
        expect(Math.sign(block.text.x)).toBe(artFromLeft ? 1 : -1);
      }

      // Scrolling to each block shows it completely.
      for (let i = 0; i < SERVICES.length; i++) {
        await page
          .locator("[data-reveal]")
          .nth(i)
          .evaluate((el) => el.scrollIntoView({ block: "center" }));
        await expect
          .poll(async () => (await revealState(page))[i]!.art.opacity)
          .toBe(1);
        await expect
          .poll(async () => (await revealState(page))[i]!.text.opacity)
          .toBe(1);
      }
      await expectAllVisible(page);
    });

    test("on a narrow screen the blocks come from below", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      const state = await revealState(page);
      const hidden = state.filter((b) => b.top > 667 + FOLD_MARGIN);
      expect(hidden.length).toBeGreaterThan(0);
      for (const block of hidden) {
        for (const part of [block.art, block.text]) {
          expect(part.opacity).toBe(0);
          expect(part.x).toBe(0);
          expect(part.y).toBeGreaterThan(0);
        }
      }
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("layout shift stays at or below 0.1 while walking the page", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (!shift.hadRecentInput) {
              (window as unknown as { __cls: number }).__cls += shift.value;
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      for (let i = 0; i < SERVICES.length; i++) {
        await page
          .locator("[data-reveal]")
          .nth(i)
          .evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(400);
      }
      const cls = await page.evaluate(
        () => (window as unknown as { __cls: number }).__cls,
      );
      expect(cls).toBeLessThanOrEqual(0.1);
    });

    for (const viewport of [
      { name: "desktop", width: 1280, height: 720 },
      { name: "375 px", width: 375, height: 667 },
    ]) {
      test(`the active planet and the traveller follow the scroll (${viewport.name})`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(path);
        await page.waitForSelector(READY, { timeout: 10_000 });

        // The traveller is decorative: no alt text, hidden from assistive
        // technology, absolutely positioned inside the services container.
        const traveler = page.locator(TRAVELER);
        await expect(traveler).toHaveCount(1);
        await expect(traveler).toHaveAttribute("alt", "");
        await expect(traveler).toHaveAttribute("aria-hidden", "true");
        expect(
          await traveler.evaluate((el) => ({
            position: getComputedStyle(el).position,
            parent: el.parentElement?.id,
          })),
        ).toEqual({ position: "absolute", parent: "services" });

        // Before the first block (top of the page): the first planet.
        await page.evaluate(() => window.scrollTo(0, 0));
        await expectActivePlanet(page, 0);

        // Scrolling to each block: that block's planet.
        for (let i = 0; i < SERVICES.length; i++) {
          await page
            .locator("[data-reveal]")
            .nth(i)
            .evaluate((el) => el.scrollIntoView({ block: "center" }));
          await expectActivePlanet(page, i);
        }

        // After the last block (bottom of the page): the last planet.
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight),
        );
        await expectActivePlanet(page, SERVICES.length - 1);
        await expectNoHorizontalOverflow(page);
      });
    }

    test("the traveller settles again after a resize or a rotation", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      await page
        .locator("[data-reveal]")
        .nth(1)
        .evaluate((el) => el.scrollIntoView({ block: "center" }));
      await expectActivePlanet(page, 1);

      for (const size of [
        { width: 667, height: 375 },
        { width: 375, height: 667 },
        { width: 900, height: 700 },
      ]) {
        await page.setViewportSize(size);
        await page
          .locator("[data-reveal]")
          .nth(1)
          .evaluate((el) => el.scrollIntoView({ block: "center" }));
        await expectActivePlanet(page, 1);
        await expectNoHorizontalOverflow(page);
      }
    });

    // Spec 005, T16b: a resize or a rotation while the traveller is still
    // flying must not let that flight end on the old layout.
    for (const [start, end] of [
      [
        { width: 667, height: 375 },
        { width: 375, height: 667 },
      ],
      [
        { width: 900, height: 700 },
        { width: 1280, height: 720 },
      ],
    ] as const) {
      test(`a resize from ${start.width} to ${end.width} px mid-flight still settles the traveller`, async ({
        page,
      }) => {
        await page.setViewportSize(start);
        await page.goto(path);
        await page.waitForSelector(READY, { timeout: 10_000 });
        await page
          .locator("[data-reveal]")
          .nth(0)
          .evaluate((el) => el.scrollIntoView({ block: "center" }));
        await expectActivePlanet(page, 0);

        // The flight to the next planet starts, and the layout changes.
        await page
          .locator("[data-reveal]")
          .nth(1)
          .evaluate((el) => el.scrollIntoView({ block: "center" }));
        await expect(page.locator("#services")).toHaveAttribute(
          "data-active-planet",
          SERVICES[1]!.id,
        );
        await page.setViewportSize(end);
        await page
          .locator("[data-reveal]")
          .nth(1)
          .evaluate((el) => el.scrollIntoView({ block: "center" }));
        await expectActivePlanet(page, 1);
      });
    }

    test("crossing the breakpoint or reducing motion never moves the visitor", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(500);
      await page.setViewportSize({ width: 900, height: 700 });
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => window.scrollY)).toBe(1500);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(READY)).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.scrollY)).toBe(1500);
    });

    for (const width of [320, 375]) {
      test(`no horizontal overflow at ${width} px with the traveller active`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 640 });
        await page.goto(path);
        await page.waitForSelector(READY, { timeout: 10_000 });
        for (let i = 0; i < SERVICES.length; i++) {
          await page
            .locator("[data-reveal]")
            .nth(i)
            .evaluate((el) => el.scrollIntoView({ block: "center" }));
          await expectActivePlanet(page, i);
          await expectNoHorizontalOverflow(page);
        }
      });
    }

    test("arriving through a link to a section leaves the content visible", async ({
      page,
    }) => {
      await page.goto(`${path}#contact`);
      await page.waitForSelector(READY, { timeout: 10_000 });
      await expect(page.locator("section#contact")).toBeInViewport();
      // The blocks above the contact section were never hidden.
      await expectAllVisible(page);
    });

    // Spec 005, D19: the layer works without ScrollTrigger, whose own frame
    // loop never sleeps (RF-39).
    test("no loaded script contains ScrollTrigger", async ({ page }) => {
      const tracker = trackScripts(page);
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
      await expect(page.locator("html.lenis")).toHaveCount(1, {
        timeout: 10_000,
      });
      const { loaded } = await tracker.scripts();
      expect(loaded.length).toBeGreaterThan(0);
      for (const script of loaded) {
        expect(script.body.toString(), script.url).not.toMatch(SCROLL_TRIGGER);
      }
    });

    // Spec 005, D19: a jump that goes past a hidden block (no intersection
    // ever happens) must still leave it visible.
    test("a jump through an anchor past hidden blocks leaves them visible", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      const before = await revealState(page);
      expect(before.some((b) => b.art.opacity === 0)).toBe(true);
      // An instant jump straight to the last section.
      await page.evaluate(() => {
        window.location.hash = "#contact";
      });
      await expect(page.locator("section#contact")).toBeInViewport();
      await expect
        .poll(async () =>
          (await revealState(page)).every(
            (b) =>
              b.art.opacity === 1 &&
              b.text.opacity === 1 &&
              b.art.x === 0 &&
              b.text.x === 0,
          ),
        )
        .toBe(true);
      await expectAllVisible(page);
    });

    test("with motion reduced mid-visit, everything is visible and the module switches off", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 600 });
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      const before = await revealState(page);
      expect(before.some((b) => b.art.opacity === 0)).toBe(true);

      await expect(page.locator(TRAVELER)).toHaveCount(1);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(READY)).toHaveCount(0);
      await expectNoTraveler(page);
      await expect
        .poll(async () =>
          (await revealState(page)).every(
            (b) => b.art.opacity === 1 && b.text.opacity === 1,
          ),
        )
        .toBe(true);
      await expectAllVisible(page);
    });
  });

  test.describe(`${path}: motion reduced from the start`, () => {
    test.use({ reducedMotion: "reduce" });

    test("the animation code is never downloaded and all is visible", async ({
      page,
    }) => {
      const tracker = trackScripts(page);
      await page.goto(path);
      await page.waitForTimeout(LOAD_DELAY_MS + 1500);
      const { loaded } = await tracker.scripts();
      for (const script of loaded) {
        expect(script.body.toString()).not.toMatch(GSAP_HEADER);
      }
      await expect(page.locator(READY)).toHaveCount(0);
      await expectNoTraveler(page);
      await expectAllVisible(page);
    });

    // RF-33: no CSS transition or animation lasts any time, Mac stays still
    // and the scroll is the browser's own.
    test("nothing transitions or animates, Mac is still and the scroll is native", async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForTimeout(LOAD_DELAY_MS + 1000);
      const moving = await page.evaluate(() =>
        [...document.querySelectorAll("body, body *, html")]
          .map((el) => {
            const style = getComputedStyle(el);
            const seconds = (list: string) =>
              list.split(",").map((v) => parseFloat(v) || 0);
            return {
              tag: `${el.tagName.toLowerCase()}.${el.className}`,
              transition: Math.max(...seconds(style.transitionDuration)),
              animation:
                style.animationName !== "none"
                  ? Math.max(...seconds(style.animationDuration))
                  : 0,
            };
          })
          .filter((item) => item.transition > 0 || item.animation > 0),
      );
      expect(moving).toEqual([]);

      const state = await page.evaluate(() => {
        const mac = document.querySelector(".hero__mac") as HTMLElement;
        return {
          macTransform: getComputedStyle(mac).transform,
          macAnimation: getComputedStyle(mac).animationName,
          scrollBehavior: getComputedStyle(document.documentElement)
            .scrollBehavior,
          htmlClass: document.documentElement.className,
        };
      });
      expect(state.macTransform).toBe("none");
      expect(state.macAnimation).toBe("none");
      expect(state.scrollBehavior).not.toBe("smooth");
      expect(state.htmlClass).not.toMatch(/lenis/);

      // A jump to an anchor lands at once, with no smooth scrolling.
      await page.evaluate(() => {
        location.hash = "#contact";
      });
      const y = await page.evaluate(() => window.scrollY);
      expect(y).toBeGreaterThan(0);
    });
  });

  test.describe(`${path}: animation code blocked`, () => {
    test("without the code every block is visible", async ({ page }) => {
      // Every script fails to load (network down or blocked, RF-32).
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(path);
      await page.waitForTimeout(LOAD_DELAY_MS + 1000);
      await expect(page.locator(READY)).toHaveCount(0);
      await expectNoTraveler(page);
      await expectAllVisible(page);
    });

    // RF-32, RF-38: with the code blocked, nothing on the page is faded or
    // hidden, not just the service blocks.
    test("no element on the page is transparent or hidden", async ({
      page,
    }) => {
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(path);
      await page.waitForTimeout(LOAD_DELAY_MS + 1000);
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter(
            (el) =>
              !el.closest("script,style,noscript,template,source") &&
              // Decorations (spec 005): the sky twinkles between 0.55 and 1 (RF-3) and
              // the flame of Mac fades in and out during the entrance (RF-18).
              !el.closest(
                ".sky, .hero__flame, .hero__aura, .hero__orbit, .hero__sparkle, .hero__spark, .service__halo",
              ),
          )
          .map((el) => {
            const style = getComputedStyle(el);
            return {
              tag: `${el.tagName.toLowerCase()}.${el.className}`,
              opacity: Number(style.opacity),
              visibility: style.visibility,
              display: style.display,
            };
          })
          .filter(
            (item) =>
              item.opacity < 1 ||
              item.visibility !== "visible" ||
              item.display === "none",
          ),
      );
      expect(hidden).toEqual([]);
    });
  });

  // RF-37: smooth scrolling only with a fine pointer and without reduced
  // motion; links and the keyboard keep working.
  test.describe(`${path}: smooth scroll with a fine pointer`, () => {
    const LENIS = "html.lenis";

    test("Lenis starts after the animation code, and only then", async ({
      page,
    }) => {
      const tracker = trackScripts(page);
      await page.goto(path);
      await expect(page.locator(LENIS)).toHaveCount(0);
      await page.waitForSelector(READY, { timeout: 10_000 });
      await expect(page.locator(LENIS)).toHaveCount(1, { timeout: 5000 });
      const { loaded, loadEventStart } = await tracker.scripts();
      const lenis = loaded.filter((s) =>
        /lenis-smooth/.test(s.body.toString()),
      );
      expect(lenis.length).toBeGreaterThan(0);
      for (const script of lenis) {
        expect(script.startTime).toBeGreaterThanOrEqual(
          loadEventStart + LOAD_DELAY_MS - 150,
        );
      }
    });

    test("the header links to every section", async ({ page }) => {
      await page.goto(path);
      const hrefs = await page
        .locator('header nav a[href^="#"]')
        .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
      expect(hrefs.length).toBeGreaterThanOrEqual(4);
      expect(hrefs).toEqual(NAV_SECTIONS.map((s) => `#${s.id}`));
    });

    // One test per link, each with its own time budget: as a single test the
    // six round trips took 18 s of its 30 s alone and up to 29.5 s with
    // 8 workers (note under T18 of spec 005). Each one checks where the page
    // comes to rest: the browser's own jump to the anchor passes by the
    // section for a moment before Lenis moves.
    const anchorLinks: {
      name: string;
      id: string;
      link: (p: Page) => Locator;
    }[] = [
      ...NAV_SECTIONS.map((s) => ({
        name: `the header link to #${s.id}`,
        id: s.id,
        link: (p: Page) => p.locator(`header nav a[href="#${s.id}"]`),
      })),
      // "Descubre cómo" (hero) and "Quiero despegar" (header).
      {
        name: "the hero's discover link",
        id: "services",
        link: (p: Page) => p.locator("a.hero__discover"),
      },
      {
        name: "the take-off button",
        id: "contact",
        link: (p: Page) =>
          p.getByRole("link", { name: t(locale, "cta.takeOff") }).first(),
      },
    ];
    for (const { name, id, link } of anchorLinks) {
      test(`${name} arrives at its section`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator(LENIS)).toHaveCount(1, { timeout: 12_000 });
        await backToTop(page);
        await link(page).click();
        await settledScroll(page);
        await expect
          .poll(() => arrivedAt(page, id), { timeout: 8000 })
          .toBe(true);
      });
    }

    // A scroll Lenis has not heard of yet (its `scroll` event comes with the
    // next frame) followed by a click on a link in the same frame: the
    // browser scrolling a link into view, or a busy CPU. Lenis must start
    // from where the page is, not from where it last saw it (the anchor test
    // above failed in the CI that way: plan 005, note under T18).
    test("a link clicked right after an unseen scroll still arrives", async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator(LENIS)).toHaveCount(1, { timeout: 12_000 });
      await backToTop(page);
      const start = 600;
      await page.evaluate((y) => {
        const w = window as unknown as { __minY: number };
        w.__minY = Infinity;
        window.addEventListener(
          "scroll",
          () => (w.__minY = Math.min(w.__minY, window.scrollY)),
          { passive: true },
        );
        window.scrollTo({ top: y, behavior: "instant" });
        document
          .querySelector<HTMLAnchorElement>('header nav a[href="#projects"]')!
          .click();
      }, start);
      // Where the page comes to rest, not a moment on the way: the browser's
      // own jump to the anchor passes by the section before Lenis moves.
      await settledScroll(page);
      expect(await arrivedAt(page, "projects")).toBe(true);
      // It never jumps back above where the page was before going down.
      const minY = await page.evaluate(
        () => (window as unknown as { __minY: number }).__minY,
      );
      expect(minY).toBeGreaterThanOrEqual(start - 1);
    });

    test("the keyboard scrolls: Tab, Space, arrows, Home and End", async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator(LENIS)).toHaveCount(1, { timeout: 12_000 });
      const y = () => page.evaluate(() => Math.round(window.scrollY));

      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => document.activeElement?.tagName),
      ).not.toBe("BODY");

      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      await page.keyboard.press("Space");
      await expect.poll(y).toBeGreaterThan(200);
      const afterSpace = await settledScroll(page);

      await page.keyboard.press("ArrowDown");
      await expect.poll(y).toBeGreaterThan(afterSpace);
      const afterDown = await settledScroll(page);

      await page.keyboard.press("ArrowUp");
      await expect.poll(y).toBeLessThan(afterDown);

      await page.keyboard.press("End");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.innerHeight + window.scrollY >=
              document.documentElement.scrollHeight - 2,
          ),
        )
        .toBe(true);

      await page.keyboard.press("Home");
      await expect.poll(y).toBe(0);
    });

    test("the mouse wheel scrolls the page", async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(LENIS)).toHaveCount(1, { timeout: 12_000 });
      await page.mouse.move(400, 400);
      await page.mouse.wheel(0, 600);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(100);
    });
  });

  // RF-36: tapping or clicking Mac in the hero plays a gesture of GESTURE_MS,
  // shown by a state attribute that is set at the start and removed at the end.
  test.describe(`${path}: Mac's gesture`, () => {
    const GESTURE = ".hero__mac";

    test("clicking Mac sets the mark for 0.6 s and changes no text", async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      const textBefore = await page.locator("#hero").innerText();
      await expect(page.locator(GESTURE)).not.toHaveAttribute(
        "data-mac-gesture",
        /.+/,
      );

      const started = Date.now();
      await page.locator(GESTURE).click();
      await expect(page.locator(GESTURE)).toHaveAttribute(
        "data-mac-gesture",
        "playing",
        { timeout: 500 },
      );
      await expect(page.locator(GESTURE)).not.toHaveAttribute(
        "data-mac-gesture",
        /.+/,
        { timeout: 2000 },
      );
      const elapsed = Date.now() - started;
      // 600 ms plus the click and the polling of the test.
      expect(elapsed).toBeGreaterThanOrEqual(GESTURE_MS - 100);
      expect(elapsed).toBeLessThanOrEqual(GESTURE_MS + 700);

      // Nothing was changed or hidden, and Mac rests where it was.
      expect(await page.locator("#hero").innerText()).toBe(textBefore);
      await expect(page.locator("#hero h1")).toBeVisible();
      expect(
        await page
          .locator(GESTURE)
          .evaluate((el) => getComputedStyle(el).transform),
      ).toBe("none");
    });

    test("it can play again after it ends", async ({ page }) => {
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      for (let i = 0; i < 2; i++) {
        await page.locator(GESTURE).click();
        await expect(page.locator(GESTURE)).toHaveAttribute(
          "data-mac-gesture",
          "playing",
        );
        await expect(page.locator(GESTURE)).not.toHaveAttribute(
          "data-mac-gesture",
          /.+/,
          { timeout: 2000 },
        );
      }
    });

    // RF-36 (keyboard): Mac is a button only while the layer is active.
    test("Tab reaches Mac, with a name, a role and a visible focus", async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      const mac = page.locator(GESTURE);
      await expect(mac).toHaveAttribute("role", "button");
      await expect(mac).toHaveAttribute("tabindex", "0");
      await expect(mac).toHaveAttribute(
        "aria-label",
        t(locale, "hero.macGestureLabel"),
      );
      await mac.focus();
      const focus = await mac.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          active: document.activeElement === el,
          outlineStyle: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth),
        };
      });
      expect(focus.active).toBe(true);
      expect(focus.outlineStyle).not.toBe("none");
      expect(focus.outlineWidth).toBeGreaterThan(0);
      // Tab from the previous link lands on Mac.
      await page.locator(".hero__discover").focus();
      await page.keyboard.press("Tab");
      await expect(mac).toBeFocused();
    });

    for (const key of ["Enter", "Space"]) {
      test(`${key} on Mac plays the 0.6 s gesture`, async ({ page }) => {
        await page.goto(path);
        await page.waitForSelector(READY, { timeout: 10_000 });
        const textBefore = await page.locator("#hero").innerText();
        await page.locator(GESTURE).focus();
        await page.keyboard.press(key);
        await expect(page.locator(GESTURE)).toHaveAttribute(
          "data-mac-gesture",
          "playing",
          { timeout: 500 },
        );
        await expect(page.locator(GESTURE)).not.toHaveAttribute(
          "data-mac-gesture",
          /.+/,
          { timeout: 2000 },
        );
        expect(await page.locator("#hero").innerText()).toBe(textBefore);
      });
    }

    test("without the layer Mac has no role, focus stop or label", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await page.waitForTimeout(LOAD_DELAY_MS + 800);
      const mac = page.locator(GESTURE);
      await expect(mac).not.toHaveAttribute("role", /.*/);
      await expect(mac).not.toHaveAttribute("tabindex", /.*/);
      await expect(mac).not.toHaveAttribute("aria-label", /.*/);
    });

    test("reducing motion mid-visit removes the button semantics", async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      await expect(page.locator(GESTURE)).toHaveAttribute("role", "button");
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(READY)).toHaveCount(0);
      const mac = page.locator(GESTURE);
      await expect(mac).not.toHaveAttribute("role", /.*/);
      await expect(mac).not.toHaveAttribute("tabindex", /.*/);
      await expect(mac).not.toHaveAttribute("aria-label", /.*/);
    });

    test("with reduced motion there is no gesture", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      await page.waitForTimeout(LOAD_DELAY_MS + 800);
      await page.locator(GESTURE).click();
      await page.waitForTimeout(300);
      await expect(page.locator(GESTURE)).not.toHaveAttribute(
        "data-mac-gesture",
        /.+/,
      );
    });

    test("reducing motion mid-visit switches the gesture off", async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(READY)).toHaveCount(0);
      await page.locator(GESTURE).click();
      await page.waitForTimeout(300);
      await expect(page.locator(GESTURE)).not.toHaveAttribute(
        "data-mac-gesture",
        /.+/,
      );
    });
  });

  test.describe(`${path}: JavaScript blocked`, () => {
    test.use({ javaScriptEnabled: false });

    test("Mac stays decorative: no role, focus stop or label", async ({
      page,
    }) => {
      await page.goto(path);
      const mac = page.locator(".hero__mac");
      await expect(mac).not.toHaveAttribute("role", /.*/);
      await expect(mac).not.toHaveAttribute("tabindex", /.*/);
      await expect(mac).not.toHaveAttribute("aria-label", /.*/);
    });
  });

  test.describe(`${path}: touch device`, () => {
    test.use({ hasTouch: true, isMobile: true });

    test("Lenis is never downloaded or started", async ({ page }) => {
      const tracker = trackScripts(page);
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      await page.waitForTimeout(1500);
      await expect(page.locator("html.lenis")).toHaveCount(0);
      const { loaded } = await tracker.scripts();
      for (const script of loaded) {
        expect(script.body.toString()).not.toMatch(/lenis-smooth/);
      }
      // The placement of Mac does not depend on smooth scrolling (RF-34).
      await expect(page.locator(TRAVELER)).toHaveCount(1);
    });
  });
}
