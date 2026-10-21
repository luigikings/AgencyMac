import { expect, test } from "@playwright/test";
import { t } from "../src/lib/i18n";
import { homePages } from "./pages";

// RNF-4: a laboratory proxy of INP. Every real interaction of the visit,
// with the animation layer and smooth scrolling active, stays at or below
// 200 ms according to the Event Timing API.
const MAX_INTERACTION_MS = 200;

type Recorded = { name: string; duration: number; id: number };

for (const { path, locale } of homePages) {
  test.describe(`${path}: interaction latency`, () => {
    test("no interaction takes more than 200 ms with the animation active", async ({
      page,
    }, testInfo) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __events: Recorded[] };
        w.__events = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { interactionId: number };
            w.__events.push({
              name: e.name,
              duration: e.duration,
              id: e.interactionId,
            });
          }
        }).observe({
          type: "event",
          durationThreshold: 16,
          buffered: true,
        } as PerformanceObserverInit);
      });
      await page.goto(path);
      await page.waitForSelector('html[data-motion="on"]', {
        timeout: 10_000,
      });
      await expect(page.locator("html.lenis")).toHaveCount(1, {
        timeout: 5000,
      });

      // Mac in the hero, "Descubre cómo", Tab, Space, arrows, the wheel and
      // the call to action.
      await page.locator(".hero__mac").click();
      await page.waitForTimeout(300);
      await page.locator("a.hero__discover").click();
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
      await page.keyboard.press("Space");
      await page.waitForTimeout(500);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(300);
      await page.mouse.move(400, 400);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(120);
      }
      await page
        .getByRole("link", { name: t(locale, "cta.takeOff") })
        .first()
        .click();
      await page.waitForTimeout(1500);

      const events = await page.evaluate(
        () => (window as unknown as { __events: Recorded[] }).__events,
      );
      const interactions = events.filter((e) => e.id > 0);
      const worst = Math.max(0, ...interactions.map((e) => e.duration));
      testInfo.annotations.push({
        type: "max-interaction-ms",
        description: String(worst),
      });
      console.log(
        `${path} max interaction: ${worst} ms (${interactions.length} events)`,
      );
      expect(worst).toBeLessThanOrEqual(MAX_INTERACTION_MS);
    });

    // Spec 005, RNF-4 and T22: the presses that set off Mac's bursts and turbo
    // mode (RF-28, RF-29), with the mouse and then, once the 10 s cooldown is
    // over, with the keyboard, in the high class.
    test("no interaction takes more than 200 ms with Mac's bursts and turbo mode", async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await page.addInitScript(() => {
        const w = window as unknown as { __events: Recorded[] };
        w.__events = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { interactionId: number };
            w.__events.push({
              name: e.name,
              duration: e.duration,
              id: e.interactionId,
            });
          }
        }).observe({
          type: "event",
          durationThreshold: 16,
          buffered: true,
        } as PerformanceObserverInit);
        const proto = Navigator.prototype;
        Object.defineProperty(proto, "hardwareConcurrency", {
          configurable: true,
          get: () => 8,
        });
        Object.defineProperty(proto, "deviceMemory", {
          configurable: true,
          get: () => 8,
        });
      });
      await page.goto(path);
      await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
      await expect(page.locator("html")).toHaveAttribute(
        "data-fx-tier",
        "high",
      );
      const mac = page.locator(".hero__mac");
      await page.waitForTimeout(2_500);
      const box = (await mac.boundingBox())!;
      const turbo = async (press: () => Promise<void>) => {
        for (let i = 0; i < 5; i++) {
          await press();
          if (i < 4) await page.waitForTimeout(250);
        }
        await expect(mac).toHaveAttribute("data-mac-turbo", "playing", {
          timeout: 500,
        });
        // A press while he crosses the window, too.
        await page.waitForTimeout(400);
        await press();
        await expect(mac).not.toHaveAttribute("data-mac-turbo", /.*/, {
          timeout: 1_400,
        });
      };
      const started = Date.now();
      await turbo(() =>
        page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
      );
      await page.waitForTimeout(Math.max(0, 10_300 - (Date.now() - started)));
      await mac.focus();
      await turbo(() => page.keyboard.press("Enter"));
      await page.waitForTimeout(500);

      const events = await page.evaluate(
        () => (window as unknown as { __events: Recorded[] }).__events,
      );
      const interactions = events.filter((e) => e.id > 0);
      const worst = Math.max(0, ...interactions.map((e) => e.duration));
      testInfo.annotations.push({
        type: "max-interaction-ms",
        description: String(worst),
      });
      console.log(
        `${path} max interaction with bursts and turbo: ${worst} ms (${interactions.length} events)`,
      );
      expect(worst).toBeLessThanOrEqual(MAX_INTERACTION_MS);
    });

    // Spec 005, RNF-4 and T25: the links that set off the space jump
    // (RF-31): "Descubre cómo", a link of the navigation and "Quiero
    // despegar", with the mouse and the keyboard, in the high class.
    test("no interaction takes more than 200 ms with the space jump", async ({
      page,
    }, testInfo) => {
      await page.addInitScript(() => {
        const w = window as unknown as {
          __events: Recorded[];
          __jumps: number;
        };
        w.__events = [];
        w.__jumps = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const e = entry as PerformanceEntry & { interactionId: number };
            w.__events.push({
              name: e.name,
              duration: e.duration,
              id: e.interactionId,
            });
          }
        }).observe({
          type: "event",
          durationThreshold: 16,
          buffered: true,
        } as PerformanceObserverInit);
        // <html> may not exist yet: watch the whole document.
        new MutationObserver((records) => {
          for (const record of records) {
            const el = record.target as Element;
            if (el.getAttribute("data-jump") === "playing") w.__jumps++;
          }
        }).observe(document, {
          subtree: true,
          attributes: true,
          attributeFilter: ["data-jump"],
        });
        const proto = Navigator.prototype;
        Object.defineProperty(proto, "hardwareConcurrency", {
          configurable: true,
          get: () => 8,
        });
        Object.defineProperty(proto, "deviceMemory", {
          configurable: true,
          get: () => 8,
        });
      });
      await page.goto(path);
      await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
      await expect(page.locator("html")).toHaveAttribute(
        "data-fx-tier",
        "high",
      );
      await expect(page.locator("html.lenis")).toHaveCount(1, {
        timeout: 5000,
      });
      const jumps = () =>
        page.evaluate(() => (window as unknown as { __jumps: number }).__jumps);
      const links = [
        page.locator("a.hero__discover"),
        page.locator('.site-header__nav a[href="#team"]'),
        page.getByRole("link", { name: t(locale, "cta.takeOff") }).first(),
      ];
      let expected = 0;
      for (const link of links) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await link.click();
        await expect.poll(jumps).toBe(++expected);
        await page.waitForTimeout(1500);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.locator("a.hero__discover").focus();
      await page.keyboard.press("Enter");
      await expect.poll(jumps).toBe(++expected);
      await page.waitForTimeout(1500);

      const events = await page.evaluate(
        () => (window as unknown as { __events: Recorded[] }).__events,
      );
      const interactions = events.filter((e) => e.id > 0);
      const worst = Math.max(0, ...interactions.map((e) => e.duration));
      testInfo.annotations.push({
        type: "max-interaction-ms",
        description: String(worst),
      });
      console.log(
        `${path} max interaction with the space jump: ${worst} ms (${interactions.length} events)`,
      );
      expect(worst).toBeLessThanOrEqual(MAX_INTERACTION_MS);
    });
  });
}

// RNF-5, RNF-6 (plan section 8): size budgets measured on the responses the
// browser really receives. JS and CSS are compressed with gzip level 9 in
// Node (the same measure as the T16 spike); images are counted as served
// (already compressed formats).
import { gzipSync } from "node:zlib";
import type { Page } from "@playwright/test";

// Spec 005, T32: budgets of plan section 8, confirmed in T2 (spec 004 had
// 60 KB of JS and 20 KB of CSS).
const KB = 1000;
const MAX_JS_BEFORE_LOAD = 3 * KB;
const MAX_JS_TOTAL = 100 * KB;
const MAX_CSS = 30 * KB;
const MAX_FX_MODULE = 30 * KB;
const MAX_OWN_CODE = 45 * KB;
// GSAP core + Lenis bundled alone (esbuild, minified, gzip 9), measured in
// T16b: what the JS total holds that is not our own code.
const GSAP_AND_LENIS_GZIP = 32921;
const MAX_WILL_CHANGE = 10;
const MAX_BLOCKING_CPU4_MS = 300;
const FX_CHUNK = /\/fx-layer\.[\w-]+\.js$/;
const MAX_IMAGES_AT_LOAD = 90 * KB;
const MAX_IMAGES_TOTAL = 400 * KB;

type Served = { url: string; type: string; size: number; gzip: number };

function trackResponses(page: Page) {
  const pending: Promise<Served>[] = [];
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (!["script", "stylesheet", "image"].includes(type)) return;
    pending.push(
      response.body().then((body) => ({
        url: response.url(),
        type,
        size: body.length,
        gzip: gzipSync(body, { level: 9 }).length,
      })),
    );
  });
  return () => Promise.all(pending);
}

const sum = (items: Served[], key: "size" | "gzip") =>
  items.reduce((total, item) => total + item[key], 0);

for (const { path } of homePages) {
  test.describe(`${path}: size budgets (375 px phone)`, () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("JS before load, JS in total and CSS", async ({ page }, testInfo) => {
      const served = trackResponses(page);
      await page.goto(path, { waitUntil: "load" });
      const atLoad = await served();
      // The CSS Astro inlines in the page counts too, not only linked files.
      const inlineCss = gzipSync(
        await page.evaluate(() =>
          [...document.querySelectorAll("style:not([data-lenis-css])")]
            .map((el) => el.textContent ?? "")
            .join(" "),
        ),
        { level: 9 },
      ).length;
      await page.waitForSelector('html[data-motion="on"]', {
        timeout: 10_000,
      });
      await page.waitForTimeout(1500);
      // A phone has a coarse pointer in real life; here only the code that
      // every visitor with motion gets is counted, plus Lenis separately.
      const all = await served();

      const jsAtLoad = sum(
        atLoad.filter((s) => s.type === "script"),
        "gzip",
      );
      const jsAll = all.filter((s) => s.type === "script");
      const jsTotal = sum(jsAll, "gzip");
      const css =
        sum(
          all.filter((s) => s.type === "stylesheet"),
          "gzip",
        ) + inlineCss;
      testInfo.annotations.push({
        type: "bytes",
        description: `js before load ${jsAtLoad}, js total ${jsTotal}, css ${css}`,
      });
      console.log(
        `${path} gzip: js before load ${jsAtLoad} B, js total ${jsTotal} B (${jsAll.length} files), css ${css} B`,
      );
      expect(jsAtLoad).toBeLessThanOrEqual(MAX_JS_BEFORE_LOAD);
      expect(jsTotal).toBeLessThanOrEqual(MAX_JS_TOTAL);
      expect(css).toBeLessThanOrEqual(MAX_CSS);
    });

    test("images at load and after walking the whole page", async ({
      page,
    }, testInfo) => {
      const served = trackResponses(page);
      await page.goto(path, { waitUntil: "load" });
      const atLoad = sum(
        (await served()).filter((s) => s.type === "image"),
        "size",
      );
      await page.evaluate(async () => {
        const step = Math.max(200, Math.floor(window.innerHeight / 2));
        for (let y = 0; y <= document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      });
      await page.waitForLoadState("networkidle");
      const total = sum(
        (await served()).filter((s) => s.type === "image"),
        "size",
      );
      testInfo.annotations.push({
        type: "bytes",
        description: `images at load ${atLoad}, images total ${total}`,
      });
      console.log(`${path} images: at load ${atLoad} B, total ${total} B`);
      expect(atLoad).toBeLessThanOrEqual(MAX_IMAGES_AT_LOAD);
      expect(total).toBeLessThanOrEqual(MAX_IMAGES_TOTAL);
    });
  });
}

// Spec 005, T32 (RNF-2 to RNF-8, plan section 8): budgets of the complete
// page with every effect, in the high class on a desktop (the most code).
/** Fakes a strong desktop (8 cores, 8 GB): the high class. */
async function strongDesktop(page: Page) {
  await page.addInitScript(() => {
    const proto = Navigator.prototype;
    Object.defineProperty(proto, "hardwareConcurrency", {
      configurable: true,
      get: () => 8,
    });
    Object.defineProperty(proto, "deviceMemory", {
      configurable: true,
      get: () => 8,
    });
  });
}

for (const { path } of homePages) {
  test.describe(`${path}: budgets with every effect (desktop, high class)`, () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("JS in total, effects module and own code", async ({
      page,
    }, testInfo) => {
      const served = trackResponses(page);
      await strongDesktop(page);
      await page.goto(path);
      await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
      await expect(page.locator("html.lenis")).toHaveCount(1, {
        timeout: 10_000,
      });
      await page.waitForTimeout(500);
      const scripts = (await served()).filter((s) => s.type === "script");
      const total = sum(scripts, "gzip");
      const fx = scripts.filter((s) => FX_CHUNK.test(new URL(s.url).pathname));
      expect(fx).toHaveLength(1);
      const own = total - GSAP_AND_LENIS_GZIP;
      const line = `js total ${total} B (${scripts.length} files), effects ${fx[0]!.gzip} B, own code ${own} B`;
      testInfo.annotations.push({ type: "bytes", description: line });
      console.log(`${path} gzip: ${line}`);
      expect(total).toBeLessThanOrEqual(MAX_JS_TOTAL);
      expect(fx[0]!.gzip).toBeLessThanOrEqual(MAX_FX_MODULE);
      expect(own).toBeLessThanOrEqual(MAX_OWN_CODE);
    });

    test("at most 10 elements with will-change, also during a flight of Mac", async ({
      page,
    }) => {
      await strongDesktop(page);
      await page.goto(path);
      await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
      const count = () =>
        page.evaluate(
          () =>
            [...document.querySelectorAll("*")].filter(
              (el) => getComputedStyle(el).willChange !== "auto",
            ).length,
        );
      const atRest = await count();
      // Mac flies to the next planet while the page scrolls.
      await page.evaluate(() =>
        document
          .querySelector('[data-planet="rankia"]')!
          .scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await page.waitForTimeout(300);
      const flying = await count();
      console.log(
        `${path} will-change: ${atRest} at rest, ${flying} in flight`,
      );
      expect(atRest).toBeLessThanOrEqual(MAX_WILL_CHANGE);
      expect(flying).toBeLessThanOrEqual(MAX_WILL_CHANGE);
    });
  });

  // RNF-3: with the CPU 4 times slower, the long tasks of the first 6 s
  // (loading, the animation core, the effects module and its start) block
  // the main thread 300 ms at most (sum of each long task beyond 50 ms).
  for (const item of [
    {
      name: "desktop, high class",
      use: { viewport: { width: 1280, height: 720 } },
      strong: true,
    },
    {
      name: "phone, low class",
      use: {
        viewport: { width: 375, height: 667 },
        hasTouch: true,
        isMobile: true,
      },
      strong: false,
    },
  ] as const) {
    test.describe(`${path}: long tasks with the CPU x4, ${item.name}`, () => {
      test.use(item.use);

      test("at most 300 ms of blocking in the first 6 s, effects layer included", async ({
        page,
      }, testInfo) => {
        if (item.strong) await strongDesktop(page);
        await page.addInitScript(() => {
          const w = window as Window & {
            __long?: { start: number; duration: number }[];
            __fxOn?: number;
          };
          w.__long = [];
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              w.__long!.push({
                start: entry.startTime,
                duration: entry.duration,
              });
            }
          }).observe({ type: "longtask", buffered: true });
          // When the effects layer has started (<html data-fx="on">).
          new MutationObserver(() => {
            if (w.__fxOn === undefined && document.documentElement.dataset.fx) {
              w.__fxOn = performance.now();
            }
          }).observe(document, {
            subtree: true,
            attributes: true,
            attributeFilter: ["data-fx"],
          });
        });
        // The CPU slowdown belongs to the renderer of the page: a first visit
        // to the same origin, so the measured load stays in that renderer (a
        // navigation from about:blank can start a new one without it).
        await page.goto("/robots.txt");
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto(path);
        await page.waitForSelector('html[data-fx="on"]', { timeout: 30_000 });
        // The window: the first 6 s, or until 1 s after the effects layer
        // started if that came later, so its load and start are always in.
        const end = await page.evaluate(() =>
          Math.max(
            6000,
            ((window as Window & { __fxOn?: number }).__fxOn ?? 0) + 1000,
          ),
        );
        await page.waitForFunction((t) => performance.now() > t, end, {
          timeout: 30_000,
        });
        const seen = await page.evaluate((t) => {
          const w = window as Window & {
            __long?: { start: number; duration: number }[];
            __fxOn?: number;
          };
          const fx = performance
            .getEntriesByType("resource")
            .find((r) =>
              /\/fx-layer\.[\w-]+\.js$/.test(new URL(r.name).pathname),
            );
          return {
            long: w.__long!.filter((e) => e.start < t).map((e) => e.duration),
            fxOn: w.__fxOn ?? Infinity,
            fxLoaded: fx ? fx.responseEnd : Infinity,
          };
        }, end);
        // The observer really sees long tasks: a busy task of its own, after
        // the window (not counted), must show up.
        const probe = await page.evaluate(async (t) => {
          await new Promise((done) =>
            setTimeout(() => {
              const until = performance.now() + 120;
              while (performance.now() < until) {
                // Busy on purpose.
              }
              done(null);
            }),
          );
          await new Promise((done) => setTimeout(done, 300));
          return (
            window as Window & {
              __long?: { start: number; duration: number }[];
            }
          ).__long!.some((e) => e.start >= t && e.duration >= 100);
        }, end);
        expect(probe, "the long task observer is live").toBe(true);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        // The effects layer was loaded and started inside the window.
        expect(seen.fxLoaded).toBeLessThan(end);
        expect(seen.fxOn).toBeLessThan(end);
        const long = seen.long;
        const blocking = long.reduce((s, d) => s + Math.max(0, d - 50), 0);
        const line = `${long.length} long tasks, longest ${Math.round(Math.max(0, ...long))} ms, blocking ${Math.round(blocking)} ms (window ${Math.round(end)} ms, effects on at ${Math.round(seen.fxOn)} ms)`;
        testInfo.annotations.push({ type: "long tasks", description: line });
        console.log(`${path} CPU x4 (${item.name}): ${line}`);
        expect(blocking).toBeLessThanOrEqual(MAX_BLOCKING_CPU4_MS);
      });
    });
  }
}

// RNF-7 (plan section 8, tolerance set in T2): interval between frames in
// the controlled measurement, 1280 x 720 in the high class while the page
// scrolls on its own for 6 s with every effect: median <= 18 ms and p95 <=
// 34 ms, with up to 2 retries. In the project that measures alone
// (`web-latency`, "frame cost" in the name), so other workers do not skew it.
test.describe("frame cost: interval between frames", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("median <= 18 ms and p95 <= 34 ms while scrolling with every effect", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await strongDesktop(page);
    await page.goto("/");
    await page.waitForSelector('html[data-fx="on"]', { timeout: 10_000 });
    await page.waitForTimeout(2500);
    let result = { median: Infinity, p95: Infinity, frames: 0 };
    for (let attempt = 1; attempt <= 3; attempt++) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      result = await page.evaluate(async () => {
        const gaps: number[] = [];
        const max = document.documentElement.scrollHeight - innerHeight;
        const start = performance.now();
        let last = start;
        await new Promise<void>((done) => {
          const tick = (now: number) => {
            gaps.push(now - last);
            last = now;
            const t = (now - start) / 6000;
            window.scrollTo(0, Math.min(1, t) * max);
            if (t < 1) requestAnimationFrame(tick);
            else done();
          };
          requestAnimationFrame(tick);
        });
        const sorted = gaps.slice(1).sort((a, b) => a - b);
        const at = (q: number) =>
          sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
        return { median: at(0.5), p95: at(0.95), frames: sorted.length };
      });
      const line = `attempt ${attempt}: ${result.frames} frames, median ${result.median.toFixed(1)} ms, p95 ${result.p95.toFixed(1)} ms`;
      console.log(`frame interval (high, 1280 x 720): ${line}`);
      testInfo.annotations.push({ type: "frame interval", description: line });
      if (result.median <= 18 && result.p95 <= 34) break;
    }
    expect(result.median).toBeLessThanOrEqual(18);
    expect(result.p95).toBeLessThanOrEqual(34);
  });
});
