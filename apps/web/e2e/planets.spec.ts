import { expect, test, type Page } from "@playwright/test";
import { colors } from "../src/styles/tokens";
import { homePages } from "./pages";

// Spec 005, T14: planets with life (RF-10, RF-11, RF-12, RF-15, RF-40). The
// floating, turning, halo pulse and moons are plain CSS; the pause outside the
// window needs the animation layer.
const PLANETS = [
  { id: "hexaweb", moons: 1, glow: "planetHexawebGlow" },
  { id: "rankia", moons: 2, glow: "planetRankiaGlow" },
  { id: "adara", moons: 1, glow: "planetAdaraGlow" },
] as const;

const block = (id: string) => `[data-planet="${id}"]`;

test.describe("Planet decoration is in the HTML (RF-11, RF-12)", () => {
  for (const { path } of homePages) {
    test(`${path}: halo, orbit and the moons of each planet, all decorative`, async ({
      page,
    }) => {
      await page.goto(path);
      for (const planet of PLANETS) {
        const info = await page.locator(block(planet.id)).evaluate((el) => {
          const art = el.querySelector(".service__art")!;
          const decor = [
            ...el.querySelectorAll(
              ".service__halo, .service__orbit, .service__moon",
            ),
          ];
          return {
            wrapper: !!art.querySelector(":scope > .service__planet"),
            halo: el.querySelectorAll(".service__halo").length,
            orbits: el.querySelectorAll(".service__orbit").length,
            ring: el.querySelectorAll(".service__orbit svg ellipse").length,
            moons: [...el.querySelectorAll("[data-moon]")].length,
            images: art.querySelectorAll("img").length,
            hidden: decor.every((d) => d.closest('[aria-hidden="true"]')),
            clickThrough: decor.every(
              (d) => getComputedStyle(d).pointerEvents === "none",
            ),
            focusable: decor.some((d) => d.matches("a, button, [tabindex]")),
          };
        });
        expect(info.wrapper, planet.id).toBe(true);
        expect(info.halo, planet.id).toBe(1);
        expect(info.orbits, planet.id).toBeGreaterThanOrEqual(1);
        expect(info.ring, planet.id).toBeGreaterThanOrEqual(1);
        expect(info.moons, planet.id).toBe(planet.moons);
        // No new image: the planet itself is the only one.
        expect(info.images, planet.id).toBe(1);
        expect(info.hidden, planet.id).toBe(true);
        expect(info.clickThrough, planet.id).toBe(true);
        expect(info.focusable, planet.id).toBe(false);
      }
    });
  }
});

test.describe("Planet animations (RF-10, RF-11, RF-12)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { path } of homePages) {
    test(`${path}: floating of 6 to 14 px in 6 to 10 s, a different phase each`, async ({
      page,
    }) => {
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(path);
      const delays: number[] = [];
      for (const planet of PLANETS) {
        const result = await page.locator(block(planet.id)).evaluate((el) => {
          const picture = el.querySelector(".service__art picture")!;
          const anim = picture
            .getAnimations()
            .find(
              (a) => (a as CSSAnimation).animationName === "service-float",
            )!;
          const timing = anim.effect!.getComputedTiming();
          anim.pause();
          const top = (t: number) => {
            anim.currentTime = t;
            return picture.getBoundingClientRect().top;
          };
          const delay = Number(timing.delay);
          const duration = Number(timing.duration);
          const tops = Array.from({ length: 12 }, (_, i) =>
            top((duration * i) / 12),
          );
          return {
            seconds: duration / 1000,
            iterations: timing.iterations,
            travel: Math.max(...tops) - Math.min(...tops),
            delay,
          };
        });
        expect(result.iterations, planet.id).toBe(Infinity);
        expect(result.seconds, planet.id).toBeGreaterThanOrEqual(6);
        expect(result.seconds, planet.id).toBeLessThanOrEqual(10);
        expect(result.travel, planet.id).toBeGreaterThanOrEqual(6);
        expect(result.travel, planet.id).toBeLessThanOrEqual(14);
        delays.push(result.delay);
      }
      expect(new Set(delays).size).toBe(3);
    });

    test(`${path}: turning of 2 to 4 degrees in 14 to 24 s, a different phase each`, async ({
      page,
    }) => {
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(path);
      const delays: number[] = [];
      for (const planet of PLANETS) {
        const result = await page.locator(block(planet.id)).evaluate((el) => {
          const img = el.querySelector(".service__art img")!;
          const anim = img
            .getAnimations()
            .find((a) => (a as CSSAnimation).animationName === "service-turn")!;
          const timing = anim.effect!.getComputedTiming();
          anim.pause();
          const delay = Number(timing.delay);
          const duration = Number(timing.duration);
          const angle = (t: number) => {
            anim.currentTime = t;
            const m = new DOMMatrix(getComputedStyle(img).transform);
            return (Math.atan2(m.b, m.a) * 180) / Math.PI;
          };
          const samples = [0, 0.25, 0.5, 0.75].map((f) => angle(duration * f));
          return {
            seconds: duration / 1000,
            iterations: timing.iterations,
            peak: Math.max(...samples.map(Math.abs)),
            delay,
          };
        });
        expect(result.iterations, planet.id).toBe(Infinity);
        expect(result.seconds, planet.id).toBeGreaterThanOrEqual(14);
        expect(result.seconds, planet.id).toBeLessThanOrEqual(24);
        expect(result.peak, planet.id).toBeGreaterThanOrEqual(2);
        expect(result.peak, planet.id).toBeLessThanOrEqual(4);
        delays.push(result.delay);
      }
      expect(new Set(delays).size).toBe(3);
    });

    test(`${path}: the halo has the glow colour of its zone and pulses 60 to 100 % in 4 to 6 s`, async ({
      page,
    }) => {
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(path);
      for (const planet of PLANETS) {
        const result = await page.locator(block(planet.id)).evaluate((el) => {
          const halo = el.querySelector(".service__halo")!;
          const anim = halo
            .getAnimations()
            .find(
              (a) => (a as CSSAnimation).animationName === "planet-halo-pulse",
            )!;
          const timing = anim.effect!.getComputedTiming();
          anim.pause();
          const duration = Number(timing.duration);
          const opacity = (f: number) => {
            anim.currentTime = duration * f;
            return Number(getComputedStyle(halo).opacity);
          };
          const samples = Array.from({ length: 12 }, (_, i) => opacity(i / 12));
          return {
            seconds: duration / 1000,
            iterations: timing.iterations,
            low: Math.min(...samples),
            high: Math.max(...samples),
            image: getComputedStyle(halo).backgroundImage,
          };
        });
        expect(result.iterations, planet.id).toBe(Infinity);
        expect(result.seconds, planet.id).toBeGreaterThanOrEqual(4);
        expect(result.seconds, planet.id).toBeLessThanOrEqual(6);
        expect(result.low, planet.id).toBeGreaterThanOrEqual(0.6 - 0.01);
        expect(result.high, planet.id).toBeLessThanOrEqual(1);
        expect(result.high - result.low, planet.id).toBeGreaterThan(0.2);
        // The glow colour of the zone (a token), whatever way the browser
        // writes the mix.
        const hex = colors[planet.glow].value;
        const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        const got = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/
          .exec(result.image)!
          .slice(1, 4)
          .map((v) => Math.round(Number(v) * 255));
        expect(got, planet.id).toEqual(want);
      }
    });

    test(`${path}: each moon runs its orbit in 10 to 20 s and stays inside the art`, async ({
      page,
    }) => {
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(path);
      for (const planet of PLANETS) {
        const result = await page.locator(block(planet.id)).evaluate((el) => {
          const art = el
            .querySelector(".service__art")!
            .getBoundingClientRect();
          return [...el.querySelectorAll<HTMLElement>("[data-moon]")].map(
            (moon) => {
              const anim = moon
                .getAnimations()
                .find(
                  (a) => (a as CSSAnimation).animationName === "planet-moon",
                )!;
              const timing = anim.effect!.getComputedTiming();
              anim.pause();
              const delay = Number(timing.delay);
              const duration = Number(timing.duration);
              // First set the time once and lay out, so the pause has taken effect.
              anim.currentTime = 0;
              moon.getBoundingClientRect();
              const inside: boolean[] = [];
              const centres: number[][] = [];
              for (let i = 0; i < 12; i++) {
                anim.currentTime = (duration * i) / 12;
                const r = moon.getBoundingClientRect();
                inside.push(
                  r.left >= art.left - 0.5 &&
                    r.right <= art.right + 0.5 &&
                    r.top >= art.top - 0.5 &&
                    r.bottom <= art.bottom + 0.5,
                );
                centres.push([r.left + r.width / 2, r.top + r.height / 2]);
              }
              const xs = centres.map((c) => c[0]!);
              return {
                seconds: duration / 1000,
                iterations: timing.iterations,
                inside: inside.every(Boolean),
                spread: Math.max(...xs) - Math.min(...xs),
                delay,
                path: getComputedStyle(moon).offsetPath,
              };
            },
          );
        });
        expect(result).toHaveLength(planet.moons);
        for (const moon of result) {
          expect(moon.iterations, planet.id).toBe(Infinity);
          expect(moon.seconds, planet.id).toBeGreaterThanOrEqual(10);
          expect(moon.seconds, planet.id).toBeLessThanOrEqual(20);
          expect(moon.inside, planet.id).toBe(true);
          expect(moon.spread, planet.id).toBeGreaterThan(20);
          expect(moon.path, planet.id).toContain("ellipse");
        }
        // Two moons of one planet do not travel together.
        if (result.length === 2) {
          expect(result[0]!.delay).not.toBe(result[1]!.delay);
        }
      }
    });
  }
});

test.describe("Everything is still with reduced motion or without JavaScript (RF-40)", () => {
  for (const { path } of homePages) {
    test(`${path}: reduced motion, no animation but the decoration is there`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      const result = await page.evaluate(() => ({
        animated: [
          ...document.querySelectorAll(
            ".service__planet, .service__planet *, .service__art picture, .service__art img",
          ),
        ].filter((el) => getComputedStyle(el).animationName !== "none").length,
        running: document
          .getAnimations()
          .filter((a) =>
            (a.effect as KeyframeEffect | null)?.target?.closest?.(".service"),
          ).length,
        moons: document.querySelectorAll("[data-moon]").length,
        halos: document.querySelectorAll(".service__halo").length,
      }));
      expect(result.animated).toBe(0);
      expect(result.running).toBe(0);
      expect(result.moons).toBe(4);
      expect(result.halos).toBe(3);
    });
  }
});

// Without animation each moon stands still at its own point of the orbit,
// inside the art, and the two moons of Rankia never share a point (RF-12,
// RF-40; correction of T14 approved on 2026-10-14). "Without JavaScript" also
// stops the CSS animations, which shows the pose a moon has before (or
// without) its animation: the one that made the orbit test flaky.
const STILL_MODES = [
  { name: "reduced motion", reduced: true, noScript: false },
  { name: "without JavaScript", reduced: false, noScript: true },
] as const;

test.describe("Each moon stands still at its own point (RF-12, RF-40)", () => {
  for (const mode of STILL_MODES) {
    for (const { path } of homePages) {
      for (const width of [375, 1280]) {
        test(`${path} at ${width} px, ${mode.name}: every moon inside the art, apart from its sister`, async ({
          page,
        }) => {
          await page.emulateMedia({
            reducedMotion: mode.reduced ? "reduce" : "no-preference",
          });
          if (mode.noScript) {
            await page.route("**/*.js", (route) => route.abort());
          }
          await page.setViewportSize({ width, height: 800 });
          await page.goto(path);
          for (const planet of PLANETS) {
            const result = await page
              .locator(block(planet.id))
              .evaluate((el) => {
                for (const a of el.getAnimations({ subtree: true })) {
                  a.cancel();
                }
                const art = el
                  .querySelector(".service__art")!
                  .getBoundingClientRect();
                const moons = [
                  ...el.querySelectorAll<HTMLElement>("[data-moon]"),
                ].map((moon) => moon.getBoundingClientRect());
                return {
                  inside: moons.map(
                    (r) =>
                      r.width > 0 &&
                      r.left >= art.left - 0.5 &&
                      r.right <= art.right + 0.5 &&
                      r.top >= art.top - 0.5 &&
                      r.bottom <= art.bottom + 0.5,
                  ),
                  overlap:
                    moons.length === 2 &&
                    moons[0]!.left < moons[1]!.right &&
                    moons[1]!.left < moons[0]!.right &&
                    moons[0]!.top < moons[1]!.bottom &&
                    moons[1]!.top < moons[0]!.bottom,
                };
              });
            expect(result.inside, planet.id).toEqual(
              Array.from({ length: planet.moons }, () => true),
            );
            expect(result.overlap, planet.id).toBe(false);
          }
        });
      }
    }
  }
});

// RF-15: outside the window the planet animations are paused, and they play
// again on coming back. Needs the animation layer (IntersectionObserver).
async function playStates(page: Page, id: string) {
  return page.locator(block(id)).evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((a) => a.effect?.getComputedTiming().iterations === Infinity)
      .map((a) => a.playState),
  );
}

test.describe("Pause outside the window (RF-15)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { path } of homePages) {
    test(`${path}: paused out of view, running in view`, async ({ page }) => {
      await page.goto(path);
      await page.waitForSelector('html[data-motion="on"]', { timeout: 10_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      // Adara is far below the window: its animations are paused.
      await expect
        .poll(
          async () =>
            (await playStates(page, "adara")).every((s) => s === "paused"),
          {
            timeout: 5000,
          },
        )
        .toBe(true);
      expect((await playStates(page, "adara")).length).toBeGreaterThanOrEqual(
        4,
      );
      // Bring Hexaweb into view: it plays; Adara still paused.
      await page.locator(block("hexaweb")).scrollIntoViewIfNeeded();
      await page.evaluate(() =>
        document
          .querySelector('[data-planet="hexaweb"]')!
          .scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await expect
        .poll(
          async () =>
            (await playStates(page, "hexaweb")).every((s) => s === "running"),
          {
            timeout: 5000,
          },
        )
        .toBe(true);
      expect(
        (await playStates(page, "adara")).every((s) => s === "paused"),
      ).toBe(true);
      // Scroll away again: Hexaweb pauses.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect
        .poll(
          async () =>
            (await playStates(page, "hexaweb")).every((s) => s === "paused"),
          {
            timeout: 5000,
          },
        )
        .toBe(true);
    });

    test(`${path}: without the animation layer everything just runs`, async ({
      page,
    }) => {
      await page.route("**/*.js", (route) => route.abort());
      await page.goto(path);
      const states = await playStates(page, "hexaweb");
      expect(states.length).toBeGreaterThanOrEqual(4);
      expect(states.every((s) => s === "running")).toBe(true);
    });
  }
});

test.describe("No layout shift and no overflow with the planets alive", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const { path } of homePages) {
    for (const width of [320, 375, 1280]) {
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.addInitScript(() => {
          const w = window as unknown as { __cls: number };
          w.__cls = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as unknown as {
              value: number;
              hadRecentInput: boolean;
            }[]) {
              if (!e.hadRecentInput) w.__cls += e.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
        });
        // Only the CSS: the reveal of the animation layer moves the halves of the
        // blocks sideways on purpose (004).
        await page.route("**/*.js", (route) => route.abort());
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await page.waitForTimeout(2500);
        const result = await page.evaluate(() => ({
          cls: (window as unknown as { __cls: number }).__cls,
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          cut: [...document.querySelectorAll(".service *")]
            .filter(
              (el) =>
                el.scrollWidth > el.clientWidth + 1 &&
                getComputedStyle(el).display !== "inline",
            )
            .map((el) => `${el.tagName}.${el.className}`),
        }));
        expect(result.cls).toBeLessThanOrEqual(0.001);
        expect(result.overflow).toBeLessThanOrEqual(0);
        expect(result.cut).toEqual([]);
      });
    }
  }
});
