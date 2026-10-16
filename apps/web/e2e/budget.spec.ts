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
  });
}

// RNF-5, RNF-6 (plan section 8): size budgets measured on the responses the
// browser really receives. JS and CSS are compressed with gzip level 9 in
// Node (the same measure as the T16 spike); images are counted as served
// (already compressed formats).
import { gzipSync } from "node:zlib";
import type { Page } from "@playwright/test";

const KB = 1000;
const MAX_JS_BEFORE_LOAD = 3 * KB;
const MAX_JS_TOTAL = 60 * KB;
const MAX_CSS = 20 * KB;
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
