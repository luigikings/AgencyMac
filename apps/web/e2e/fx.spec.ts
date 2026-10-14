import { gzipSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { LOAD_DELAY_MS } from "../src/lib/motion/motion-config";
import { SERVICES } from "../src/lib/site-data";
import { STAR_LAYERS } from "../src/lib/sky/star-field";
import { colors, cssVariableName } from "../src/styles/tokens";
import { homePages } from "./pages";

// Spec 005, T15: core of the effects layer (RF-2, RF-13, RF-15, RF-37, RF-39,
// RF-40, RF-41, RF-42). The animation core picks the device class, marks it in
// `data-fx-tier` and downloads the effects module (`fx-layer`) unless motion
// is reduced. The effects module moves the star layers with the scroll, the
// planets with the cursor and pauses the decoration out of view or with the
// tab hidden.

const MOTION = 'html[data-motion="on"]';
const FX_ON = 'html[data-fx="on"]';
const FX_CHUNK = /\/fx-layer\.[\w-]+\.js$/;
const MAX_FX_GZIP = 30 * 1024;

type Signals = { cores?: number; memory?: number; saveData?: boolean };

/** Fakes the hardware signals the device class reads (before any script). */
async function simulate(page: Page, signals: Signals) {
  await page.addInitScript((s: Signals) => {
    const proto = Navigator.prototype;
    if (s.cores !== undefined) {
      Object.defineProperty(proto, "hardwareConcurrency", {
        configurable: true,
        get: () => s.cores,
      });
    }
    if (s.memory !== undefined) {
      Object.defineProperty(proto, "deviceMemory", {
        configurable: true,
        get: () => s.memory,
      });
    }
    Object.defineProperty(proto, "connection", {
      configurable: true,
      get: () => ({ saveData: !!s.saveData }),
    });
  }, signals);
}

/** Vertical translation, in px, of the computed transform of an element. */
async function translateOf(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.e, y: m.f, none: getComputedStyle(el).transform === "none" };
  });
}

const CANVAS = "canvas.fx-canvas";
// Seed of the random effects (`?seed=`), so the runs repeat.
const SEED = 5;

/** Page errors and console errors of the visit. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

type StarEvent = { phase: "start" | "end"; id: number; ms: number; t: number };

/** Records every `fx:shooting-star` event with the (simulated) time. */
async function logStars(page: Page) {
  await page.addInitScript(() => {
    const w = window as Window & { __stars?: unknown[] };
    w.__stars = [];
    document.addEventListener("fx:shooting-star", (event) => {
      const detail = (event as CustomEvent).detail as object;
      w.__stars!.push({ ...detail, t: Date.now() });
    });
  });
}

function starLog(page: Page): Promise<StarEvent[]> {
  return page.evaluate(
    () => (window as Window & { __stars?: StarEvent[] }).__stars ?? [],
  );
}

/** Asks the effects for their report (`fx:report`) and reads it. */
async function frameReport(page: Page) {
  return page.evaluate(() => {
    document.dispatchEvent(new Event("fx:report"));
    const d = document.documentElement.dataset;
    return {
      frames: Number(d.fxFrames),
      avg: Number(d.fxFrameAvg),
      p95: Number(d.fxFrameP95),
      particles: Number(d.fxParticles),
    };
  });
}

/** Simulates the tab becoming hidden or visible again. */
function setHidden(page: Page, hidden: boolean) {
  return page.evaluate((h) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => h,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (h ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

async function layerOffsets(page: Page) {
  const out: Record<string, number> = {};
  for (const layer of STAR_LAYERS) {
    out[layer.id] = (await translateOf(page, `.sky__layer--${layer.id}`)).y;
  }
  return out;
}

async function scrollToY(page: Page, y: number | "end") {
  await page.evaluate((target) => {
    const top =
      target === "end"
        ? document.documentElement.scrollHeight - window.innerHeight
        : target;
    window.scrollTo({ top, behavior: "instant" });
  }, y);
}

// RF-37: the class of the visit, from the signals of the device.
const CLASSES = [
  {
    name: "desktop with 8 cores and 8 GB",
    use: { viewport: { width: 1280, height: 800 } },
    signals: { cores: 8, memory: 8 },
    tier: "high",
  },
  {
    name: "desktop with 4 cores",
    use: { viewport: { width: 1280, height: 800 } },
    signals: { cores: 4, memory: 8 },
    tier: "mid",
  },
  {
    name: "phone (touch, 375 px)",
    use: {
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    },
    signals: { cores: 8, memory: 8 },
    tier: "low",
  },
  {
    name: "tablet (touch, 820 px)",
    use: {
      viewport: { width: 820, height: 1180 },
      hasTouch: true,
      isMobile: true,
    },
    signals: { cores: 8, memory: 8 },
    tier: "mid",
  },
  {
    name: "data saver on a strong desktop",
    use: { viewport: { width: 1280, height: 800 } },
    signals: { cores: 16, memory: 8, saveData: true },
    tier: "low",
  },
  {
    name: "2 GB of memory",
    use: { viewport: { width: 1280, height: 800 } },
    signals: { cores: 8, memory: 2 },
    tier: "low",
  },
] as const;

test.use({ reducedMotion: "no-preference" });
// The tests share nothing, and the ones with a simulated clock are long: they
// are spread over the workers instead of running one after another.
test.describe.configure({ mode: "parallel" });

for (const { path } of homePages) {
  test.describe(`${path}: device class (RF-37)`, () => {
    for (const item of CLASSES) {
      test.describe(item.name, () => {
        test.use(item.use);

        test(`data-fx-tier is ${item.tier}`, async ({ page }) => {
          await simulate(page, item.signals);
          await page.goto(path);
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          await expect(page.locator("html")).toHaveAttribute(
            "data-fx-tier",
            item.tier,
          );
        });
      });
    }
  });

  test.describe(`${path}: download of the effects module`, () => {
    test("after load plus the delay, small, and nothing big before load", async ({
      page,
    }, testInfo) => {
      const bodies: Promise<{ url: string; gzip: number }>[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() !== "script") return;
        bodies.push(
          response.body().then((body) => ({
            url: response.url(),
            gzip: gzipSync(body, { level: 9 }).length,
          })),
        );
      });
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      const scripts = await Promise.all(bodies);
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType(
          "navigation",
        )[0] as PerformanceNavigationTiming;
        return {
          load: nav.loadEventStart,
          starts: Object.fromEntries(
            performance
              .getEntriesByType("resource")
              .map((e) => [e.name, e.startTime]),
          ) as Record<string, number>,
        };
      });
      const fx = scripts.filter((s) => FX_CHUNK.test(new URL(s.url).pathname));
      expect(fx).toHaveLength(1);
      expect(timing.starts[fx[0]!.url]).toBeGreaterThanOrEqual(
        timing.load + LOAD_DELAY_MS - 150,
      );
      expect(fx[0]!.gzip).toBeLessThanOrEqual(MAX_FX_GZIP);
      const early = scripts
        .filter((s) => (timing.starts[s.url] ?? Infinity) < timing.load)
        .reduce((sum, s) => sum + s.gzip, 0);
      expect(early).toBeLessThanOrEqual(3 * 1024);
      testInfo.annotations.push({
        type: "bytes",
        description: `fx-layer gzip ${fx[0]!.gzip}, js before load ${early}`,
      });
      console.log(
        `${path} gzip: fx-layer ${fx[0]!.gzip} B, js before load ${early} B`,
      );
    });

    test("with reduced motion the effects module is never downloaded", async ({
      page,
    }) => {
      const urls: string[] = [];
      page.on("request", (request) => urls.push(request.url()));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForTimeout(LOAD_DELAY_MS + 1500);
      expect(urls.filter((u) => FX_CHUNK.test(new URL(u).pathname))).toEqual(
        [],
      );
      const marks = await page.evaluate(() => ({
        tier: document.documentElement.hasAttribute("data-fx-tier"),
        fx: document.documentElement.hasAttribute("data-fx"),
      }));
      expect(marks).toEqual({ tier: false, fx: false });
    });
  });

  // RF-2: over the whole page the far, middle and near layers travel 4, 8
  // and 16 vh; in the middle class only the first two; in the low one none.
  test.describe(`${path}: scroll parallax of the stars (RF-2)`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    const CASES = [
      { tier: "high", signals: { cores: 8, memory: 8 }, moving: 3 },
      { tier: "mid", signals: { cores: 4, memory: 8 }, moving: 2 },
      { tier: "low", signals: { cores: 8, saveData: true }, moving: 0 },
    ] as const;

    for (const item of CASES) {
      test(`${item.tier} class: ${item.moving} layers move`, async ({
        page,
      }) => {
        await simulate(page, item.signals);
        await page.goto(path);
        await page.waitForSelector(FX_ON, { timeout: 10_000 });
        await expect(page.locator("html")).toHaveAttribute(
          "data-fx-tier",
          item.tier,
        );
        await scrollToY(page, 0);
        await page.waitForTimeout(200);
        const top = await layerOffsets(page);
        await scrollToY(page, "end");
        const vh = 800 / 100;
        await expect
          .poll(async () => {
            const end = await layerOffsets(page);
            return STAR_LAYERS.map((layer) =>
              Math.round((top[layer.id]! - end[layer.id]!) / vh),
            );
          })
          .toEqual(
            STAR_LAYERS.map((layer, i) =>
              i < item.moving ? layer.parallaxVh : 0,
            ),
          );
      });
    }
  });

  // RF-13: with a fine pointer in the middle or high class each planet
  // follows the cursor up to 14 px, and goes back in under 1 s.
  test.describe(`${path}: planets follow the cursor (RF-13)`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    const PLANET = '[data-planet="hexaweb"] .service__planet';

    test("up to 14 px, against the cursor, back in under 1 s", async ({
      page,
    }) => {
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await page.evaluate(() =>
        document
          .querySelector('[data-planet="hexaweb"]')!
          .scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await page.mouse.move(640, 400);
      await page.mouse.move(2, 2, { steps: 4 });
      await expect
        .poll(async () => {
          const t = await translateOf(page, PLANET);
          return Math.hypot(t.x, t.y);
        })
        .toBeGreaterThan(8);
      await page.waitForTimeout(800);
      const moved = await translateOf(page, PLANET);
      // Cursor at the top left: the planet goes to the bottom right.
      expect(moved.x).toBeGreaterThan(0);
      expect(moved.y).toBeGreaterThan(0);
      expect(Math.hypot(moved.x, moved.y)).toBeLessThanOrEqual(14.01);

      // The cursor leaves the page: back to rest in under a second.
      const ms = await page.evaluate(async (selector) => {
        const el = document.querySelector(selector)!;
        const offset = () => {
          const m = new DOMMatrix(getComputedStyle(el).transform);
          return Math.hypot(m.e, m.f);
        };
        const start = performance.now();
        document.documentElement.dispatchEvent(
          new MouseEvent("mouseleave", { relatedTarget: null }),
        );
        while (offset() >= 0.5 && performance.now() - start < 3000) {
          await new Promise((r) => requestAnimationFrame(r));
        }
        return performance.now() - start;
      }, PLANET);
      expect(ms).toBeLessThan(1000);
    });

    test("not in the low class", async ({ page }) => {
      await simulate(page, { cores: 8, saveData: true });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await page.evaluate(() =>
        document
          .querySelector('[data-planet="hexaweb"]')!
          .scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await page.mouse.move(640, 400);
      await page.mouse.move(2, 2, { steps: 4 });
      await page.waitForTimeout(600);
      expect((await translateOf(page, PLANET)).none).toBe(true);
    });
  });

  // RF-15, RF-39: blocks out of view are marked (and their CSS animations
  // paused), and with the tab hidden every decoration stands still.
  test.describe(`${path}: pause out of view and with the tab hidden`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("IntersectionObserver marks the blocks out of view", async ({
      page,
    }) => {
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await scrollToY(page, 0);
      await expect(page.locator("#hero")).not.toHaveAttribute("data-offscreen");
      await expect(page.locator('[data-planet="adara"]')).toHaveAttribute(
        "data-offscreen",
        "",
      );
      await scrollToY(page, "end");
      await expect(page.locator("#hero")).toHaveAttribute("data-offscreen", "");
    });

    test("a hidden tab pauses the decoration, and it plays on coming back", async ({
      page,
    }) => {
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await scrollToY(page, 0);
      const states = () =>
        page.evaluate(() =>
          document
            .querySelector(".sky")!
            .getAnimations({ subtree: true })
            .map((a) => a.playState),
        );
      const setHidden = (hidden: boolean) =>
        page.evaluate((h) => {
          Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => h,
          });
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => (h ? "hidden" : "visible"),
          });
          document.dispatchEvent(new Event("visibilitychange"));
        }, hidden);

      expect((await states()).every((s) => s === "running")).toBe(true);
      await setHidden(true);
      await expect(page.locator("html")).toHaveAttribute("data-fx-paused", "");
      await expect
        .poll(async () => (await states()).every((s) => s === "paused"))
        .toBe(true);
      expect((await states()).length).toBeGreaterThanOrEqual(3);
      await setHidden(false);
      await expect(page.locator("html")).not.toHaveAttribute("data-fx-paused");
      await expect
        .poll(async () => (await states()).every((s) => s === "running"))
        .toBe(true);
    });
  });

  // RF-40: motion reduced in the middle of the visit removes every effect and
  // leaves the page where it was.
  test.describe(`${path}: motion reduced mid-visit (RF-40)`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("every effect is removed and the scroll does not move", async ({
      page,
    }) => {
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await page.evaluate(() =>
        document
          .querySelector('[data-planet="rankia"]')!
          .scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await page.mouse.move(640, 400);
      await page.mouse.move(2, 2, { steps: 4 });
      await page.waitForTimeout(600);
      const before = await page.evaluate(() => window.scrollY);
      expect(before).toBeGreaterThan(0);
      expect((await translateOf(page, ".sky__layer--near")).none).toBe(false);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(FX_ON)).toHaveCount(0);
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({
        y: window.scrollY,
        tier: document.documentElement.hasAttribute("data-fx-tier"),
        paused: document.documentElement.hasAttribute("data-fx-paused"),
        offscreen: document.querySelectorAll("[data-offscreen]").length,
        moved: [...document.querySelectorAll(".sky__layer, .service__planet")]
          .filter((el) => getComputedStyle(el).transform !== "none")
          .map((el) => el.className),
      }));
      expect(Math.abs(after.y - before)).toBeLessThanOrEqual(1);
      expect(after).toMatchObject({ tier: false, paused: false, offscreen: 0 });
      expect(after.moved).toEqual([]);
    });
  });

  // RF-42, RNF-8: one fixed canvas for every particle, out of the way of the
  // pointer and of assistive technology, with its resolution limited.
  test.describe(`${path}: effects canvas (RF-42, RNF-8)`, () => {
    const CASES = [
      {
        name: "high class, 1920 x 1080 at 2x: 2 megapixels at most",
        use: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 },
        signals: { cores: 8, memory: 8 },
        tier: "high",
        density: 1.5,
      },
      {
        name: "mid class, 1280 x 800 at 2x: density 1.25",
        use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
        signals: { cores: 4, memory: 8 },
        tier: "mid",
        density: 1.25,
      },
      {
        name: "low class, phone at 3x: density 1",
        use: {
          viewport: { width: 375, height: 667 },
          deviceScaleFactor: 3,
          hasTouch: true,
          isMobile: true,
        },
        signals: { cores: 8, memory: 8 },
        tier: "low",
        density: 1,
      },
    ] as const;

    for (const item of CASES) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("one fixed canvas, hidden from assistive technology, no pointer", async ({
          page,
        }) => {
          const errors = watchErrors(page);
          await simulate(page, item.signals);
          await page.goto(path);
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          await expect(page.locator("html")).toHaveAttribute(
            "data-fx-tier",
            item.tier,
          );
          await expect(page.locator("canvas")).toHaveCount(1);
          const canvas = page.locator(CANVAS);
          await expect(canvas).toHaveAttribute("aria-hidden", "true");
          const info = await canvas.evaluate((el: HTMLCanvasElement) => {
            const s = getComputedStyle(el);
            return {
              position: s.position,
              pointerEvents: s.pointerEvents,
              width: el.width,
              height: el.height,
              cssWidth: el.clientWidth,
              cssHeight: el.clientHeight,
              tabIndex: el.tabIndex,
              viewW: document.documentElement.clientWidth,
              viewH: window.innerHeight,
            };
          });
          expect(info.position).toBe("fixed");
          expect(info.pointerEvents).toBe("none");
          expect(info.tabIndex).toBe(-1);
          expect(info.cssWidth).toBe(info.viewW);
          expect(info.cssHeight).toBe(info.viewH);
          expect(info.width * info.height).toBeLessThanOrEqual(2_000_000);
          expect(info.width / info.cssWidth).toBeLessThanOrEqual(
            item.density + 0.01,
          );
          if (info.cssWidth * info.cssHeight * item.density ** 2 <= 2e6) {
            expect(info.width / info.cssWidth).toBeCloseTo(item.density, 2);
          }
          // The canvas never takes a click or a tap: the top element at the
          // centre of the main button is the button itself.
          const cta = page.locator("#hero a").first();
          const box = (await cta.boundingBox())!;
          const top = await page.evaluate(
            ([x, y]) => document.elementFromPoint(x!, y!)?.closest("a")?.href,
            [box.x + box.width / 2, box.y + box.height / 2],
          );
          expect(top).toBe(
            await cta.evaluate((a: HTMLAnchorElement) => a.href),
          );
          expect(
            await page.locator(CANVAS).evaluate(
              (el) =>
                // Not in the accessibility tree and no focus.
                el.closest("[aria-hidden='true']") !== null &&
                !el.matches(":focus"),
            ),
          ).toBe(true);
          expect(errors).toEqual([]);
        });
      });
    }

    test("the canvas is removed with the rest when motion becomes reduced", async ({
      page,
    }) => {
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await expect(page.locator(CANVAS)).toHaveCount(1);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(FX_ON)).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
    });
  });

  // RF-14, RF-37, RF-40: with a fine pointer in the middle or high class, a
  // planet under the cursor grows (5 % at most) and gives off sparks in brand
  // colours, up to 20 (middle) or 40 (high) at once; they stop when the
  // cursor leaves and the planet shrinks back. None on touch, in the low
  // class or with reduced motion. The sparks never take the pointer.
  test.describe(`${path}: sparks on the planets (RF-14)`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    const BLOCK = '[data-planet="hexaweb"]';
    const PLANET = `${BLOCK} .service__planet`;

    /** Scrolls the planet to the middle and returns the centre of its image. */
    async function planetCentre(page: Page) {
      await page.evaluate(
        (selector) =>
          document
            .querySelector(selector)!
            .scrollIntoView({ block: "center", behavior: "instant" }),
        BLOCK,
      );
      // Let the reveal of the block end before measuring it.
      await page.waitForTimeout(1200);
      const box = (await page
        .locator(`${BLOCK} .service__image`)
        .boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }

    /** Scale of the planet, from its computed transform (1 = its size). */
    async function scaleOf(page: Page) {
      return page.locator(PLANET).evaluate((el) => {
        const t = getComputedStyle(el).transform;
        if (t === "none") return 1;
        const m = new DOMMatrix(t);
        return Math.hypot(m.a, m.b);
      });
    }

    /** Most particles and largest scale seen over `ms`, frame by frame. */
    async function sample(page: Page, ms: number) {
      return page.evaluate(
        async ({ selector, ms }) => {
          const el = document.querySelector(selector)!;
          const root = document.documentElement;
          let particles = 0;
          let scale = 1;
          const start = performance.now();
          while (performance.now() - start < ms) {
            document.dispatchEvent(new Event("fx:report"));
            particles = Math.max(particles, Number(root.dataset.fxParticles));
            const t = getComputedStyle(el).transform;
            if (t !== "none") {
              const m = new DOMMatrix(t);
              scale = Math.max(scale, Math.hypot(m.a, m.b));
            }
            await new Promise((r) => requestAnimationFrame(r));
          }
          return { particles, scale };
        },
        { selector: PLANET, ms },
      );
    }

    const TIERS = [
      { tier: "high", signals: { cores: 8, memory: 8 }, cap: 40 },
      { tier: "mid", signals: { cores: 4, memory: 8 }, cap: 20 },
    ] as const;

    for (const item of TIERS) {
      test(`${item.tier} class: grows up to 5 % with up to ${item.cap} sparks, and both stop on leaving`, async ({
        page,
      }) => {
        const errors = watchErrors(page);
        await simulate(page, item.signals);
        await page.goto(`${path}?seed=${SEED}`);
        await page.waitForSelector(FX_ON, { timeout: 10_000 });
        await expect(page.locator("html")).toHaveAttribute(
          "data-fx-tier",
          item.tier,
        );
        const centre = await planetCentre(page);
        await page.mouse.move(4, 4);
        await page.mouse.move(centre.x, centre.y, { steps: 5 });

        const inside = await sample(page, 1500);
        console.log(
          `${path} ${item.tier}: up to ${inside.particles} sparks, scale ${inside.scale.toFixed(4)}`,
        );
        expect(inside.particles).toBeGreaterThanOrEqual(item.cap * 0.75);
        expect(inside.particles).toBeLessThanOrEqual(item.cap);
        expect(inside.scale).toBeGreaterThan(1.03);
        expect(inside.scale).toBeLessThanOrEqual(1.05 + 1e-3);

        // The sparks never take the pointer: a click at the centre reaches
        // the planet under the canvas.
        expect((await frameReport(page)).particles).toBeGreaterThan(0);
        const hit = await page.evaluate(
          ([x, y]) => {
            const top = document.elementFromPoint(x!, y!);
            return {
              canvas: top?.tagName === "CANVAS",
              planet: !!top?.closest(".service__planet"),
            };
          },
          [centre.x, centre.y],
        );
        expect(hit).toEqual({ canvas: false, planet: true });
        await page.evaluate(() => {
          const w = window as Window & { __clicked?: boolean };
          document.addEventListener(
            "click",
            (event) => {
              w.__clicked = !!(event.target as Element).closest(
                ".service__planet",
              );
            },
            { once: true },
          );
        });
        await page.mouse.click(centre.x, centre.y);
        await expect
          .poll(() =>
            page.evaluate(
              () => (window as Window & { __clicked?: boolean }).__clicked,
            ),
          )
          .toBe(true);

        // Out of the planet: the sparks end (each lives 0.8 s at most; the
        // margin is for slow frames with other workers) and the planet
        // shrinks back.
        await page.mouse.move(4, 4, { steps: 3 });
        await expect
          .poll(async () => (await frameReport(page)).particles, {
            timeout: 3000,
          })
          .toBe(0);
        await expect
          .poll(() => scaleOf(page), { timeout: 2000 })
          .toBeLessThan(1.002);
        expect(errors).toEqual([]);
      });
    }

    test("the sparks use only colour tokens", async ({ page }) => {
      await simulate(page, { cores: 8, memory: 8 });
      await page.addInitScript(() => {
        const w = window as Window & { __fills?: Set<string> };
        w.__fills = new Set();
        const proto = CanvasRenderingContext2D.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "fillStyle")!;
        Object.defineProperty(proto, "fillStyle", {
          configurable: true,
          get() {
            return desc.get!.call(this);
          },
          set(value) {
            desc.set!.call(this, value);
            w.__fills!.add(String(desc.get!.call(this)));
          },
        });
      });
      await page.goto(`${path}?seed=${SEED}`);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      const centre = await planetCentre(page);
      await page.mouse.move(4, 4);
      await page.mouse.move(centre.x, centre.y, { steps: 5 });
      await page.waitForTimeout(600);
      const names = Object.keys(colors).map(cssVariableName);
      const result = await page.evaluate((names) => {
        // Copied before the probe below, which also sets fillStyle.
        const fills = [
          ...(window as Window & { __fills?: Set<string> }).__fills!,
        ];
        const style = getComputedStyle(document.documentElement);
        const probe = document.createElement("canvas").getContext("2d")!;
        const tokens = names.map((name) => {
          probe.fillStyle = style.getPropertyValue(name).trim();
          return String(probe.fillStyle);
        });
        return { fills, tokens };
      }, names);
      expect(result.fills.length).toBeGreaterThan(0);
      for (const fill of result.fills) expect(result.tokens).toContain(fill);
    });

    test("touch (tablet, middle class): no sparks and no growth", async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
        isMobile: true,
        reducedMotion: "no-preference",
        baseURL: test.info().project.use.baseURL,
      });
      const page = await context.newPage();
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await expect(page.locator("html")).toHaveAttribute("data-fx-tier", "mid");
      const centre = await planetCentre(page);
      await page.touchscreen.tap(centre.x, centre.y);
      await page.mouse.move(centre.x, centre.y, { steps: 3 });
      const seen = await sample(page, 800);
      expect(seen).toEqual({ particles: 0, scale: 1 });
      await context.close();
    });

    test("low class: no sparks and no growth", async ({ page }) => {
      await simulate(page, { cores: 8, saveData: true });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await expect(page.locator("html")).toHaveAttribute("data-fx-tier", "low");
      const centre = await planetCentre(page);
      await page.mouse.move(4, 4);
      await page.mouse.move(centre.x, centre.y, { steps: 5 });
      const seen = await sample(page, 800);
      expect(seen).toEqual({ particles: 0, scale: 1 });
    });

    test("reduced motion: no canvas, no sparks, no growth", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForTimeout(LOAD_DELAY_MS + 1000);
      const centre = await planetCentre(page);
      await page.mouse.move(4, 4);
      await page.mouse.move(centre.x, centre.y, { steps: 5 });
      await page.waitForTimeout(600);
      await expect(page.locator("canvas")).toHaveCount(0);
      expect((await translateOf(page, PLANET)).none).toBe(true);
    });

    test("reduced motion mid-hover: the sparks and the growth are removed", async ({
      page,
    }) => {
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      const centre = await planetCentre(page);
      await page.mouse.move(4, 4);
      await page.mouse.move(centre.x, centre.y, { steps: 5 });
      await expect
        .poll(async () => (await frameReport(page)).particles)
        .toBeGreaterThan(0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(FX_ON)).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
      await page.waitForTimeout(300);
      expect((await translateOf(page, PLANET)).none).toBe(true);
    });

    // RF-39: once the sparks are gone and the planet is back to its size,
    // nothing asks for frames.
    test("at rest after leaving a planet: at most 2 rAF calls in 2 s", async ({
      page,
    }) => {
      await simulate(page, { cores: 8, memory: 8 });
      await page.addInitScript(() => {
        const w = window as Window & { __rafCalls?: number };
        const original = window.requestAnimationFrame.bind(window);
        w.__rafCalls = 0;
        window.requestAnimationFrame = (callback) => {
          w.__rafCalls!++;
          return original(callback);
        };
      });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      const centre = await planetCentre(page);
      await page.mouse.move(4, 4);
      await page.mouse.move(centre.x, centre.y, { steps: 5 });
      await expect
        .poll(async () => (await frameReport(page)).particles)
        .toBeGreaterThan(0);
      await page.waitForTimeout(800);
      await page.mouse.move(4, 4, { steps: 3 });
      await expect
        .poll(async () => (await frameReport(page)).particles, {
          timeout: 3000,
        })
        .toBe(0);
      await page.waitForTimeout(1500);
      const calls = () =>
        page.evaluate(
          () => (window as Window & { __rafCalls?: number }).__rafCalls!,
        );
      const before = await calls();
      await page.waitForTimeout(2000);
      const during = (await calls()) - before;
      console.log(`${path} after leaving a planet: ${during} rAF calls in 2 s`);
      expect(during).toBeLessThanOrEqual(2);
    });
  });

  // RF-39: at rest (no particles, no effect running) the page asks for no
  // more than 2 frames in 2 s: neither the effects nor the animation core, nor
  // smooth scrolling (plan D19, section 14). Also once a wheel scroll has
  // ended (Lenis goes to sleep) and once a block has appeared and the active
  // planet has changed (GSAP's ticker goes to sleep).
  test.describe(`${path}: no frames at rest (RF-39)`, () => {
    const CASES = [
      {
        name: "desktop, high class, smooth scrolling",
        use: { viewport: { width: 1280, height: 800 } },
        signals: { cores: 8, memory: 8 },
        smooth: true,
      },
      {
        name: "phone, low class",
        use: {
          viewport: { width: 375, height: 667 },
          hasTouch: true,
          isMobile: true,
        },
        signals: { cores: 8, memory: 8 },
        smooth: false,
      },
    ] as const;

    // The last planet block: below the fold in both viewports.
    const LAST = SERVICES.length - 1;

    async function start(page: Page, item: (typeof CASES)[number]) {
      await simulate(page, item.signals);
      await page.addInitScript(() => {
        const w = window as Window & { __rafCalls?: number };
        const original = window.requestAnimationFrame.bind(window);
        w.__rafCalls = 0;
        window.requestAnimationFrame = (callback) => {
          w.__rafCalls!++;
          return original(callback);
        };
      });
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      // Smooth scrolling must be running on the desktop, not missing.
      await expect(page.locator("html.lenis")).toHaveCount(
        item.smooth ? 1 : 0,
        {
          timeout: 10_000,
        },
      );
    }

    /** rAF calls in 2 s, counted from now. */
    async function framesIn2s(page: Page, label: string) {
      const calls = () =>
        page.evaluate(
          () => (window as Window & { __rafCalls?: number }).__rafCalls!,
        );
      const before = await calls();
      await page.waitForTimeout(2000);
      const during = (await calls()) - before;
      console.log(`${path} ${label}: ${during} rAF calls at rest in 2 s`);
      return during;
    }

    for (const item of CASES) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("at most 2 requestAnimationFrame calls in 2 s", async ({
          page,
        }) => {
          await start(page, item);
          // Let the start of the layer settle (the first shooting star never
          // comes before 8 s).
          await page.waitForTimeout(2500);
          expect(await framesIn2s(page, item.name)).toBeLessThanOrEqual(2);
        });

        test("at most 2 in 2 s, 2.5 s after a wheel scroll", async ({
          page,
        }) => {
          await start(page, item);
          await page.mouse.move(200, 300);
          await page.mouse.wheel(0, 600);
          await expect
            .poll(() => page.evaluate(() => window.scrollY))
            .toBeGreaterThan(100);
          await page.waitForTimeout(2500);
          expect(
            await framesIn2s(page, `${item.name}, after a wheel scroll`),
          ).toBeLessThanOrEqual(2);
        });

        test("at most 2 in 2 s, 2.5 s after a block appears and the planet changes", async ({
          page,
        }) => {
          await start(page, item);
          const block = page.locator("[data-reveal]").nth(LAST);
          const opacity = () =>
            block.evaluate((el) =>
              Number(
                getComputedStyle(el.querySelector(".service__text")!).opacity,
              ),
            );
          // Hidden below the fold until the visitor gets there.
          expect(await opacity()).toBe(0);
          await block.evaluate((el) =>
            el.scrollIntoView({ block: "center", behavior: "instant" }),
          );
          await expect(page.locator("#services")).toHaveAttribute(
            "data-active-planet",
            SERVICES[LAST]!.id,
          );
          await expect.poll(opacity).toBe(1);
          await page.waitForTimeout(2500);
          expect(
            await framesIn2s(page, `${item.name}, after a reveal and a move`),
          ).toBeLessThanOrEqual(2);
        });
      });
    }
  });

  // RF-4: shooting stars, with a simulated clock and a fixed seed. Every
  // simulated frame runs the page's frame callbacks, so a simulated minute
  // takes real time: the runs are as short as the gaps allow (3 gaps of the
  // middle class, 4 of the high one) and the timeout is longer.
  test.describe(`${path}: shooting stars (RF-4)`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    test.describe.configure({ timeout: 120_000 });
    const RUN_MS = 72_000;

    const CASES = [
      {
        tier: "mid",
        signals: { cores: 4, memory: 8 },
        gap: [12_000, 24_000],
        max: 1,
        least: 3,
      },
      {
        tier: "high",
        signals: { cores: 8, memory: 8 },
        gap: [8_000, 16_000],
        max: 2,
        least: 4,
      },
    ] as const;

    for (const item of CASES) {
      test(`${item.tier} class: every ${item.gap[0] / 1000}-${item.gap[1] / 1000} s, ${item.max} at a time at most, 0.6 to 1.2 s each`, async ({
        page,
      }) => {
        const errors = watchErrors(page);
        await page.clock.install();
        await simulate(page, item.signals);
        await logStars(page);
        await page.goto(`${path}?seed=${SEED}`);
        await page.waitForSelector(FX_ON, { timeout: 10_000 });
        await expect(page.locator("html")).toHaveAttribute(
          "data-fx-tier",
          item.tier,
        );
        await page.clock.runFor(RUN_MS);
        const log = await starLog(page);
        const starts = log.filter((e) => e.phase === "start");
        expect(starts.length).toBeGreaterThanOrEqual(item.least);
        for (let i = 1; i < starts.length; i++) {
          const gap = starts[i]!.t - starts[i - 1]!.t;
          expect(gap).toBeGreaterThanOrEqual(item.gap[0] - 1);
          expect(gap).toBeLessThanOrEqual(item.gap[1] + 1);
        }
        let active = 0;
        let most = 0;
        for (const e of log) {
          active += e.phase === "start" ? 1 : -1;
          most = Math.max(most, active);
        }
        expect(most).toBeLessThanOrEqual(item.max);
        for (const start of starts) {
          expect(start.ms).toBeGreaterThanOrEqual(600);
          expect(start.ms).toBeLessThanOrEqual(1200);
          const end = log.find((e) => e.phase === "end" && e.id === start.id);
          if (!end) continue; // still running when the clock stopped
          expect(end.t - start.t).toBeGreaterThanOrEqual(start.ms);
          expect(end.t - start.t).toBeLessThanOrEqual(start.ms + 50);
        }
        // Something was drawn on the canvas while they ran.
        const report = await frameReport(page);
        expect(report.frames).toBeGreaterThan(0);
        expect(errors).toEqual([]);
      });
    }

    test("low class: none", async ({ page }) => {
      await page.clock.install();
      await simulate(page, { cores: 8, saveData: true });
      await logStars(page);
      await page.goto(`${path}?seed=${SEED}`);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await expect(page.locator("html")).toHaveAttribute("data-fx-tier", "low");
      await page.clock.runFor(40_000);
      expect(await starLog(page)).toEqual([]);
      expect((await frameReport(page)).frames).toBe(0);
    });

    test("with the tab hidden: none, and the drawing loop stops", async ({
      page,
    }) => {
      await page.clock.install();
      await simulate(page, { cores: 8, memory: 8 });
      await logStars(page);
      await page.goto(`${path}?seed=${SEED}`);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      // Run until the first star starts, then hide the tab while it runs.
      for (let i = 0; i < 40 && (await starLog(page)).length === 0; i++) {
        await page.clock.runFor(500);
      }
      expect(await starLog(page)).toHaveLength(1);
      await setHidden(page, true);
      const frames = (await frameReport(page)).frames;
      await page.clock.runFor(40_000);
      expect(
        (await starLog(page)).filter((e) => e.phase === "start"),
      ).toHaveLength(1);
      expect((await frameReport(page)).frames).toBe(frames);
      await setHidden(page, false);
      await page.clock.runFor(20_000);
      expect(
        (await starLog(page)).filter((e) => e.phase === "start").length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  // RF-41: a browser that cannot draw on a canvas keeps everything else.
  test.describe(`${path}: no canvas drawing available (RF-41)`, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("the content and the sky are complete, with no errors", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await page.addInitScript(() => {
        HTMLCanvasElement.prototype.getContext = () => null;
      });
      await page.clock.install();
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(`${path}?seed=${SEED}`);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await page.clock.runFor(20_000);
      const state = await page.evaluate(() => ({
        canvases: document.querySelectorAll("canvas").length,
        layers: document.querySelectorAll(".sky__layer").length,
        hidden: [
          ...document.querySelectorAll("main h1, main h2, main h3, main p"),
        ]
          .filter((el) => {
            const s = getComputedStyle(el);
            return s.visibility !== "visible" || s.display === "none";
          })
          .map((el) => el.textContent),
      }));
      expect(state).toEqual({ canvases: 0, layers: 3, hidden: [] });
      expect(errors).toEqual([]);
    });
  });

  // RF-41: without the effects module the rest still works and nothing is
  // left half done.
  test.describe(`${path}: effects module blocked (RF-41)`, () => {
    test("the content and the sky are complete, with no errors", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route(FX_CHUNK, (route) => route.abort());
      await simulate(page, { cores: 8, memory: 8 });
      await page.goto(path);
      await page.waitForSelector(MOTION, { timeout: 10_000 });
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => ({
        fx: document.documentElement.hasAttribute("data-fx"),
        tier: document.documentElement.hasAttribute("data-fx-tier"),
        layers: document.querySelectorAll(".sky__layer").length,
        moved: [...document.querySelectorAll(".sky__layer, .service__planet")]
          .filter((el) => getComputedStyle(el).transform !== "none")
          .map((el) => el.className),
        hidden: [
          ...document.querySelectorAll("main h1, main h2, main h3, main p"),
        ]
          .filter((el) => {
            const s = getComputedStyle(el);
            return s.visibility !== "visible" || s.display === "none";
          })
          .map((el) => el.textContent),
      }));
      expect(state).toMatchObject({ fx: false, tier: false, layers: 3 });
      expect(state.moved).toEqual([]);
      expect(state.hidden).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

// Plan section 8: own cost per frame of the effects (update and draw), read
// with `fx:report`, in the high class with CPU x1: mean <= 4 ms, p95 <= 10 ms.
// Real time (the simulated clock would stop performance.now), with the page
// scrolling on its own while a shooting star is drawn. It runs in the project
// that measures alone (`web-latency`), so other workers do not skew it.
test.describe("frame cost of the effects", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("high class, CPU x1: mean <= 4 ms and p95 <= 10 ms", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await simulate(page, { cores: 8, memory: 8 });
    await logStars(page);
    await page.goto(`/?seed=${SEED}`);
    await page.waitForSelector(FX_ON, { timeout: 10_000 });
    // Scroll down and up on its own for 6 s, then wait for the first star.
    await page.evaluate(async () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const start = performance.now();
      await new Promise<void>((done) => {
        const tick = (now: number) => {
          const t = (now - start) / 6000;
          window.scrollTo(0, max * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI)));
          if (t < 1) requestAnimationFrame(tick);
          else done();
        };
        requestAnimationFrame(tick);
      });
    });
    await expect
      .poll(
        async () =>
          (await starLog(page)).filter((e) => e.phase === "end").length,
        { timeout: 25_000 },
      )
      .toBeGreaterThanOrEqual(1);
    const report = await frameReport(page);
    const line = `frames ${report.frames}, mean ${report.avg.toFixed(3)} ms, p95 ${report.p95.toFixed(3)} ms`;
    testInfo.annotations.push({ type: "frame cost", description: line });
    console.log(`frame cost (high, CPU x1): ${line}`);
    expect(report.frames).toBeGreaterThan(20);
    expect(report.avg).toBeLessThanOrEqual(4);
    expect(report.p95).toBeLessThanOrEqual(10);
    expect(errors).toEqual([]);
  });

  // RF-14: the same budget with the cursor on a planet for 3 s (the sparks
  // of the high class at their limit of 40).
  test("high class, CPU x1, sparks on a planet: mean <= 4 ms and p95 <= 10 ms", async ({
    page,
  }, testInfo) => {
    const errors = watchErrors(page);
    await simulate(page, { cores: 8, memory: 8 });
    await page.goto(`/?seed=${SEED}`);
    await page.waitForSelector(FX_ON, { timeout: 10_000 });
    await page.evaluate(() =>
      document
        .querySelector('[data-planet="rankia"]')!
        .scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await page.waitForTimeout(1200);
    const box = (await page
      .locator('[data-planet="rankia"] .service__image')
      .boundingBox())!;
    const before = (await frameReport(page)).frames;
    await page.mouse.move(4, 4);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 5,
    });
    let most = 0;
    const start = Date.now();
    while (Date.now() - start < 3000) {
      most = Math.max(most, (await frameReport(page)).particles);
      await page.waitForTimeout(100);
    }
    const report = await frameReport(page);
    const line = `frames ${report.frames - before}, up to ${most} sparks, mean ${report.avg.toFixed(3)} ms, p95 ${report.p95.toFixed(3)} ms`;
    testInfo.annotations.push({ type: "frame cost", description: line });
    console.log(`frame cost with sparks (high, CPU x1): ${line}`);
    expect(most).toBeLessThanOrEqual(40);
    expect(report.frames - before).toBeGreaterThan(60);
    expect(report.avg).toBeLessThanOrEqual(4);
    expect(report.p95).toBeLessThanOrEqual(10);
    expect(errors).toEqual([]);
  });
});
