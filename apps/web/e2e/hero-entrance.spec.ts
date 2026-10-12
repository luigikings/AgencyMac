import { expect, test, type Page } from "@playwright/test";
import { homePages } from "./pages";

// Spec 005, T10: cinematic entrance of the hero (RF-16, RF-17, RF-18, RF-40,
// RNF-2). It is plain CSS: it runs before any script and never changes the
// opacity of content. The tests step through the timeline by seeking the CSS
// animations (deterministic, works without JavaScript) and also sample real
// frames from the very first one.
const CONTENT = {
  kicker: ".hero__kicker",
  heading: "#hero-heading",
  tagline: ".hero__tagline",
  subtitle: ".hero__subtitle",
  discover: ".hero__discover",
  mac: ".hero__mac",
  moon: ".hero__moon",
} as const;
const TEXTS = ["kicker", "heading", "tagline", "subtitle", "discover"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812 },
];

type Box = { left: number; top: number; right: number; bottom: number };
type Sample = {
  t: number;
  items: Record<string, { box: Box; opacity: number }>;
  flame: number;
};

// Runs in the page: collects the finite CSS animations of the hero and
// returns functions to seek and measure them.
async function installProbe(page: Page) {
  await page.evaluate((selectors) => {
    const anims = document
      .getAnimations()
      .filter(
        (a) =>
          (a.effect as KeyframeEffect | null)?.target?.closest?.("#hero") &&
          a.effect!.getComputedTiming().iterations !== Infinity,
      );
    const measure = () => {
      const items: Record<string, unknown> = {};
      for (const [key, selector] of Object.entries(selectors)) {
        const el = document.querySelector(selector)!;
        const r = el.getBoundingClientRect();
        let opacity = 1;
        for (let n: Element | null = el; n; n = n.parentElement) {
          opacity *= Number(getComputedStyle(n).opacity);
        }
        items[key] = {
          box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
          opacity,
        };
      }
      const flame = document.querySelector(".hero__flame");
      return {
        items,
        flame: flame ? Number(getComputedStyle(flame).opacity) : 0,
      };
    };
    (window as unknown as Record<string, unknown>).__probe = {
      anims,
      seek(ms: number) {
        for (const a of anims) {
          a.pause();
          a.currentTime = ms;
        }
        return { t: ms, ...measure() };
      },
      info() {
        return anims.map((a) => {
          const timing = a.effect!.getComputedTiming();
          const target = (a.effect as KeyframeEffect).target as HTMLElement;
          return {
            name: (a as CSSAnimation).animationName,
            target: target.className || target.id,
            delay: Number(timing.delay),
            duration: Number(timing.duration),
            end: Number(timing.endTime),
          };
        });
      },
    };
  }, CONTENT);
}

const seek = (page: Page, ms: number) =>
  page.evaluate(
    (t) =>
      (
        window as unknown as { __probe: { seek: (t: number) => unknown } }
      ).__probe.seek(t),
    ms,
  ) as Promise<Sample>;

async function timeline(page: Page, until = 2000, step = 50) {
  const samples: Sample[] = [];
  for (let t = 0; t <= until; t += step) samples.push(await seek(page, t));
  return samples;
}

const near = (a: Box, b: Box, tolerance = 0.75) =>
  (["left", "top", "right", "bottom"] as const).every(
    (k) => Math.abs(a[k] - b[k]) <= tolerance,
  );

// First time from which the element stays at its final box.
function settleMs(samples: Sample[], key: string, final: Box): number {
  let settled = 0;
  for (const s of samples) {
    if (!near(s.items[key]!.box, final)) settled = s.t + 1;
  }
  return settled;
}

test.describe("Entrance of the hero without scripts (RF-16, RF-17)", () => {
  for (const { path } of homePages) {
    for (const vp of VIEWPORTS) {
      test.describe(`${path} on ${vp.name}`, () => {
        test.use({
          viewport: { width: vp.width, height: vp.height },
          reducedMotion: "no-preference",
        });

        test("nothing is ever hidden or outside the window", async ({
          page,
        }) => {
          await page.route("**/*.js", (route) => route.abort());
          await page.goto(path);
          await installProbe(page);
          const samples = await timeline(page, 2600);
          const final = samples.at(-1)!;
          for (const s of samples) {
            for (const [key, item] of Object.entries(s.items)) {
              const label = `${key} at ${s.t} ms`;
              expect(item.opacity, label).toBeGreaterThanOrEqual(0.999);
              const { box } = item;
              // Always inside the window sideways.
              expect(box.left, label).toBeGreaterThanOrEqual(-0.5);
              expect(box.right, label).toBeLessThanOrEqual(vp.width + 0.5);
              // And vertically too when its final place is inside the window.
              const end = final.items[key]!.box;
              if (end.top >= 0 && end.bottom <= vp.height) {
                expect(box.top, label).toBeGreaterThanOrEqual(-0.5);
                expect(box.bottom, label).toBeLessThanOrEqual(vp.height + 0.5);
              }
            }
          }
        });

        test("the moon, Mac and the texts settle on time", async ({ page }) => {
          await page.route("**/*.js", (route) => route.abort());
          await page.goto(path);
          await installProbe(page);
          const samples = await timeline(page, 2600);
          const final = samples.at(-1)!;
          // At 0 s the image and the texts are really off their final place.
          expect(near(samples[0]!.items.moon!.box, final.items.moon!.box)).toBe(
            false,
          );
          expect(near(samples[0]!.items.mac!.box, final.items.mac!.box)).toBe(
            false,
          );
          expect(
            near(samples[0]!.items.heading!.box, final.items.heading!.box),
          ).toBe(false);
          // The moon is in place before 1.2 s, Mac has landed before 1.7 s and
          // the texts are in place before 0.5 s.
          expect(
            settleMs(samples, "moon", final.items.moon!.box),
          ).toBeLessThanOrEqual(1200);
          expect(
            settleMs(samples, "mac", final.items.mac!.box),
          ).toBeLessThanOrEqual(1700);
          for (const key of TEXTS) {
            expect(
              settleMs(samples, key, final.items[key]!.box),
              key,
            ).toBeLessThanOrEqual(500);
          }
        });

        test("the whole sequence lasts 2.0 s at most", async ({ page }) => {
          await page.route("**/*.js", (route) => route.abort());
          await page.goto(path);
          await installProbe(page);
          const info = await page.evaluate(() =>
            (
              window as unknown as {
                __probe: { info: () => { end: number; name: string }[] };
              }
            ).__probe.info(),
          );
          expect(info.length).toBeGreaterThanOrEqual(7);
          for (const a of info) {
            expect(a.end, a.name).toBeLessThanOrEqual(2000);
          }
        });

        test("Mac's flame burns in flight and is gone before 1.8 s (RF-18)", async ({
          page,
        }) => {
          await page.route("**/*.js", (route) => route.abort());
          await page.goto(path);
          await installProbe(page);
          const samples = await timeline(page, 2600);
          const at = (t: number) => samples.find((s) => s.t === t)!.flame;
          expect(at(600)).toBeGreaterThan(0.5);
          expect(at(1000)).toBeGreaterThan(0.5);
          expect(at(1800)).toBe(0);
          expect(at(2600)).toBe(0);
          const info = await page.evaluate(() =>
            (
              window as unknown as {
                __probe: {
                  info: () => { name: string; end: number }[];
                };
              }
            ).__probe.info(),
          );
          const flame = info.find((a) => a.name === "hero-flame");
          expect(flame, "hero-flame animation").toBeDefined();
          expect(flame!.end).toBeLessThanOrEqual(1800);
        });

        test("Mac bounces on touching the moon, 0.3 to 0.5 s (RF-18)", async ({
          page,
        }) => {
          await page.route("**/*.js", (route) => route.abort());
          await page.goto(path);
          await installProbe(page);
          const info = await page.evaluate(() =>
            (
              window as unknown as {
                __probe: {
                  info: () => {
                    name: string;
                    delay: number;
                    duration: number;
                    end: number;
                  }[];
                };
              }
            ).__probe.info(),
          );
          const bounce = info.find((a) => a.name === "hero-mac-bounce");
          expect(bounce, "hero-mac-bounce animation").toBeDefined();
          expect(bounce!.duration).toBeGreaterThanOrEqual(300);
          expect(bounce!.duration).toBeLessThanOrEqual(500);
          expect(bounce!.end).toBeLessThanOrEqual(1700);
          const land = info.find((a) => a.name === "hero-mac-land")!;
          expect(bounce!.delay).toBeGreaterThanOrEqual(
            land.delay + land.duration - 1,
          );
          // The bounce really moves Mac: during it he leaves his final place.
          const samples = await timeline(page, 2600, 20);
          const final = samples.at(-1)!.items.mac!.box;
          const during = samples.filter(
            (s) => s.t > bounce!.delay + 20 && s.t < bounce!.end - 20,
          );
          const maxOffset = Math.max(
            ...during.map((s) => Math.abs(s.items.mac!.box.top - final.top)),
          );
          expect(maxOffset).toBeGreaterThan(2);
        });

        test("the animation lives on the wrapper, not on Mac's image (D17)", async ({
          page,
        }) => {
          await page.route("**/*.js", (route) => route.abort());
          await page.goto(path);
          const names = await page.evaluate(() => ({
            wrap: getComputedStyle(document.querySelector(".hero__mac-wrap")!)
              .animationName,
            mac: getComputedStyle(document.querySelector(".hero__mac")!)
              .animationName,
            nested: !!document.querySelector(".hero__mac-wrap .hero__mac"),
          }));
          expect(names.wrap).toContain("hero-mac-land");
          expect(names.mac).toBe("none");
          expect(names.nested).toBe(true);
        });
      });
    }
  }
});

test.describe("Entrance of the hero in real frames (RF-17, RNF-2)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { path } of homePages) {
    test(`${path}: from the first frame, everything visible and in the window`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.addInitScript((selectors) => {
        const frames: unknown[] = [];
        (window as unknown as Record<string, unknown>).__frames = frames;
        let start: number | null = null;
        const tick = (now: number) => {
          const els = Object.entries(selectors).map(
            ([key, selector]) =>
              [key, document.querySelector(selector)] as const,
          );
          if (els.every(([, el]) => el)) {
            start ??= now;
            const items: Record<string, unknown> = {};
            for (const [key, el] of els) {
              const r = el!.getBoundingClientRect();
              let opacity = 1;
              for (let n: Element | null = el; n; n = n.parentElement) {
                opacity *= Number(getComputedStyle(n).opacity);
              }
              items[key] = { r: [r.left, r.top, r.right, r.bottom], opacity };
            }
            frames.push({ t: now - start, items });
          }
          if (start === null || now - start < 3000) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, CONTENT);
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(path);
      await page.waitForFunction(
        () =>
          (window as unknown as { __frames: { t: number }[] }).__frames.some(
            (f) => f.t > 2800,
          ),
        null,
        { timeout: 15_000 },
      );
      const frames = await page.evaluate(
        () =>
          (
            window as unknown as {
              __frames: {
                t: number;
                items: Record<string, { r: number[]; opacity: number }>;
              }[];
            }
          ).__frames,
      );
      expect(frames.length).toBeGreaterThan(60);
      expect(frames[0]!.t).toBe(0);
      for (const f of frames) {
        for (const [key, item] of Object.entries(f.items)) {
          const label = `${key} at ${f.t.toFixed(0)} ms`;
          expect(item.opacity, label).toBeGreaterThanOrEqual(0.999);
          expect(item.r[0], label).toBeGreaterThanOrEqual(-0.5);
          expect(item.r[2], label).toBeLessThanOrEqual(1280.5);
          // Vertically too, when the final place is inside the window (the
          // button sits right at the fold on a 800 px tall window).
          const end = frames.at(-1)!.items[key]!.r;
          if (end[1]! >= 0 && end[3]! <= 800) {
            expect(item.r[1], label).toBeGreaterThanOrEqual(-0.5);
            expect(item.r[3], label).toBeLessThanOrEqual(800.5);
          }
        }
      }
      // Everything is still by 2.0 s (real time, one frame of tolerance).
      const last = frames.at(-1)!;
      const at2s = frames.find((f) => f.t >= 2100)!;
      for (const key of Object.keys(last.items)) {
        for (let i = 0; i < 4; i++) {
          expect(
            Math.abs(at2s.items[key]!.r[i]! - last.items[key]!.r[i]!),
            key,
          ).toBeLessThanOrEqual(0.75);
        }
      }
    });
  }
});

test.describe("Entrance of the hero with reduced motion (RF-40)", () => {
  test.use({ reducedMotion: "reduce" });

  for (const { path } of homePages) {
    test(`${path}: everything is in its final pose, with no animation at all`, async ({
      page,
    }) => {
      await page.goto(path);
      const result = await page.evaluate(() => ({
        animations: document
          .getAnimations()
          .filter((a) =>
            (a.effect as KeyframeEffect | null)?.target?.closest?.("#hero"),
          ).length,
        names: [...document.querySelectorAll<HTMLElement>("#hero, #hero *")]
          .map((el) => getComputedStyle(el).animationName)
          .filter((n) => n !== "none"),
        flame: getComputedStyle(document.querySelector(".hero__flame")!)
          .transform,
      }));
      expect(result.animations).toBe(0);
      expect(result.names).toEqual([]);
      // The flame is switched off with a static scale, not hidden by a rule.
      expect(result.flame).toMatch(/matrix\(0, 0, 0, 0/);
    });
  }
});
