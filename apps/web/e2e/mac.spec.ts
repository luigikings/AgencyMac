import { expect, test, type Page } from "@playwright/test";
import { SERVICES } from "../src/lib/site-data";
import { homePages } from "./pages";

// Spec 005, T19: Mac's curved flight between planets (RF-21, RF-22). When the
// active planet changes, the travelling Mac flies along a curve that strays
// at least 12 % of the distance from the straight line, in 0.7 to 1.6 s,
// leaning with the direction of the flight (-25 to 25 degrees) and straight
// again in under 0.4 s once he lands, with his centre inside the planet. A
// change of planet mid-flight turns him from where he is, with no jump.
// Without the effects module the straight move of spec 004 remains; with
// reduced motion there is no traveller at all (RF-40). At rest after a flight
// the page asks for no frames (RF-39).

const READY = 'html[data-motion="on"]';
const FX_ON = 'html[data-fx="on"]';
const FX_CHUNK = /\/fx-layer\.[\w-]+\.js$/;
const TRAVELER = "img[data-traveler]";
const FLYING = "img[data-traveler][data-mac-flight]";

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

/** One frame of the traveller: time, position (its transform), tilt. */
type Sample = {
  t: number;
  x: number;
  y: number;
  rot: number;
  flying: boolean;
  overflow: number;
};

/** Starts recording the traveller on every frame (window.__samples). */
async function startRecording(page: Page) {
  await page.evaluate((selector) => {
    const w = window as Window & { __samples?: Sample[]; __rec?: boolean };
    w.__samples = [];
    w.__rec = true;
    const el = document.querySelector(selector) as HTMLElement;
    const tick = (now: number) => {
      if (!w.__rec) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      w.__samples!.push({
        t: now,
        x: m.e,
        y: m.f,
        rot: (Math.atan2(m.b, m.a) * 180) / Math.PI,
        flying: el.hasAttribute("data-mac-flight"),
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, TRAVELER);
}

async function stopRecording(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const w = window as Window & { __samples?: Sample[]; __rec?: boolean };
    w.__rec = false;
    return w.__samples ?? [];
  });
}

/** Scrolls planet block `i` to the middle of the window, at once. */
async function toBlock(page: Page, i: number) {
  await page
    .locator("[data-reveal]")
    .nth(i)
    .evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" }),
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
      // A block still sliding in is translated; Mac aims at its final place.
      const art = planet.closest(".service__art") as HTMLElement;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(art).transform);
      const p = planet.getBoundingClientRect();
      const cx = m.left + m.width / 2;
      const cy = m.top + m.height / 2;
      return (
        cx >= p.left - matrix.e &&
        cx <= p.right - matrix.e &&
        cy >= p.top - matrix.f &&
        cy <= p.bottom - matrix.f
      );
    },
    [TRAVELER, i] as const,
  );
}

/** Lands on planet `i` (or is already there) and stops moving. */
async function settleOn(page: Page, i: number) {
  await toBlock(page, i);
  await expect(page.locator("#services")).toHaveAttribute(
    "data-active-planet",
    SERVICES[i]!.id,
  );
  await expect(page.locator(FLYING)).toHaveCount(0, { timeout: 5_000 });
  await expect.poll(() => travelerInsidePlanet(page, i)).toBe(true);
  await page.waitForTimeout(450);
}

/** Records the flight from planet `from` to planet `to` until it lands. */
async function recordFlight(
  page: Page,
  from: number,
  to: number,
  midway?: { afterMs: number; to: number },
) {
  await settleOn(page, from);
  await startRecording(page);
  await page.waitForTimeout(100);
  await toBlock(page, to);
  if (midway) {
    await page.waitForTimeout(midway.afterMs);
    // The second change comes while Mac is still on his way.
    await expect(page.locator(FLYING)).toHaveCount(1);
    await toBlock(page, midway.to);
  }
  const last = midway ? midway.to : to;
  await expect(page.locator("#services")).toHaveAttribute(
    "data-active-planet",
    SERVICES[last]!.id,
  );
  await expect(page.locator(FLYING)).toHaveCount(1, { timeout: 2_000 });
  await expect(page.locator(FLYING)).toHaveCount(0, { timeout: 6_000 });
  // Keep recording a little: Mac straightens up after landing.
  await page.waitForTimeout(700);
  return stopRecording(page);
}

/** Analysis of a recorded flight. */
function analyse(samples: Sample[]) {
  const first = samples[0]!;
  const moved = (s: Sample, p: Sample) =>
    Math.abs(s.x - p.x) > 0.01 || Math.abs(s.y - p.y) > 0.01;
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 1; i < samples.length; i++) {
    if (moved(samples[i]!, samples[i - 1]!)) {
      if (startIndex < 0) startIndex = i - 1;
      endIndex = i;
    }
  }
  expect(startIndex, "the traveller never moved").toBeGreaterThanOrEqual(0);
  const start = samples[startIndex]!;
  const end = samples[endIndex]!;
  const flight = samples.slice(startIndex, endIndex + 1);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  let deviation = 0;
  let maxTilt = 0;
  let maxStep = 0;
  let maxTurn = 0;
  for (let i = 0; i < flight.length; i++) {
    const s = flight[i]!;
    deviation = Math.max(
      deviation,
      Math.abs(dx * (s.y - start.y) - dy * (s.x - start.x)) / distance,
    );
    maxTilt = Math.max(maxTilt, Math.abs(s.rot));
    if (i > 0) {
      const p = flight[i - 1]!;
      const dt = Math.max(1, s.t - p.t);
      // A step longer than the flight's top speed allows, or a turn faster
      // than the tilt can change, is a jump.
      maxStep = Math.max(
        maxStep,
        Math.hypot(s.x - p.x, s.y - p.y) / Math.max(60, 3 * dt),
      );
      maxTurn = Math.max(maxTurn, Math.abs(s.rot - p.rot) / Math.max(12, dt));
    }
  }
  // After landing: the first moment from which the tilt stays under 0.5 deg.
  const after = samples.slice(endIndex);
  let straightAt = Number.NaN;
  for (let i = after.length - 1; i >= 0; i--) {
    if (Math.abs(after[i]!.rot) >= 0.5) break;
    straightAt = after[i]!.t;
  }
  return {
    first,
    durationMs: end.t - start.t,
    distance,
    ratio: deviation / distance,
    maxTilt,
    straightenMs: straightAt - end.t,
    // Both under 1 when there is no jump.
    maxStep,
    maxTurn,
    maxOverflow: Math.max(...samples.map((s) => s.overflow)),
    finalRot: samples[samples.length - 1]!.rot,
  };
}

function report(label: string, a: ReturnType<typeof analyse>) {
  console.log(
    `${label}: ${Math.round(a.distance)} px in ${Math.round(a.durationMs)} ms, ` +
      `deviation ${(a.ratio * 100).toFixed(1)} %, tilt up to ${a.maxTilt.toFixed(1)} deg, ` +
      `straight ${Math.round(a.straightenMs)} ms after landing`,
  );
}

function expectCurvedFlight(a: ReturnType<typeof analyse>) {
  expect(a.ratio).toBeGreaterThanOrEqual(0.12);
  // 0.7 to 1.6 s; a frame either side for the sampling.
  expect(a.durationMs).toBeGreaterThanOrEqual(700 - 40);
  expect(a.durationMs).toBeLessThanOrEqual(1600 + 60);
  expect(a.maxTilt).toBeLessThanOrEqual(25.01);
  expect(a.maxTilt).toBeGreaterThan(3);
  expect(a.straightenMs).toBeLessThan(400);
  expect(Math.abs(a.finalRot)).toBeLessThan(0.5);
  expect(a.maxStep).toBeLessThan(1);
  expect(a.maxOverflow).toBeLessThanOrEqual(0);
}

const VIEWPORTS = [
  {
    name: "desktop",
    use: { viewport: { width: 1280, height: 720 } },
    signals: { cores: 8, memory: 8 },
  },
  {
    name: "375 px phone",
    use: {
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    },
    signals: { cores: 8, memory: 8 },
  },
  {
    name: "320 px phone",
    use: {
      viewport: { width: 320, height: 640 },
      hasTouch: true,
      isMobile: true,
    },
    signals: { cores: 8, memory: 8 },
  },
] as const;

test.use({ reducedMotion: "no-preference" });
test.describe.configure({ mode: "parallel" });

for (const { path } of homePages) {
  test.describe(`${path}: Mac's curved flight (RF-21, RF-22)`, () => {
    for (const item of VIEWPORTS) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("a curve of at least 12 %, 0.7 to 1.6 s, tilted and straight on landing inside the planet", async ({
          page,
        }) => {
          await simulate(page, item.signals);
          await page.goto(path);
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          for (const [from, to] of [
            [0, 1],
            [1, 2],
            [2, 0],
          ] as const) {
            const a = analyse(await recordFlight(page, from, to));
            report(`${path} ${item.name} ${from} -> ${to}`, a);
            expectCurvedFlight(a);
            await expect.poll(() => travelerInsidePlanet(page, to)).toBe(true);
          }
          // The state of spec 004 stays as it was.
          await expect(page.locator(TRAVELER)).toHaveCount(1);
          await expect(page.locator(TRAVELER)).toHaveAttribute("alt", "");
          await expect(page.locator(TRAVELER)).toHaveAttribute(
            "aria-hidden",
            "true",
          );
        });

        test("a change of planet mid-flight turns from where Mac is, with no jump", async ({
          page,
        }) => {
          await simulate(page, item.signals);
          await page.goto(path);
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          const samples = await recordFlight(page, 0, 1, {
            afterMs: 450,
            to: 2,
          });
          const a = analyse(samples);
          report(`${path} ${item.name} 0 -> 1 -> 2`, a);
          expect(a.maxStep).toBeLessThan(1);
          expect(a.maxTurn).toBeLessThan(1);
          expect(a.maxTilt).toBeLessThanOrEqual(25.01);
          expect(a.straightenMs).toBeLessThan(400);
          expect(a.maxOverflow).toBeLessThanOrEqual(0);
          await expect.poll(() => travelerInsidePlanet(page, 2)).toBe(true);
        });
      });
    }

    test.describe("at rest after a flight (RF-39)", () => {
      for (const item of VIEWPORTS.slice(0, 2)) {
        test.describe(item.name, () => {
          test.use(item.use);

          test("at most 2 requestAnimationFrame calls in 2 s", async ({
            page,
          }) => {
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
            await settleOn(page, 0);
            await toBlock(page, 1);
            await expect(page.locator(FLYING)).toHaveCount(1, {
              timeout: 2_000,
            });
            await expect(page.locator(FLYING)).toHaveCount(0, {
              timeout: 6_000,
            });
            const calls = () =>
              page.evaluate(
                () => (window as Window & { __rafCalls?: number }).__rafCalls!,
              );
            // How long after landing the frames stop (for the record).
            const landed = Date.now();
            let quietAfter = Number.NaN;
            let last = await calls();
            while (Date.now() - landed < 2500) {
              await page.waitForTimeout(100);
              const now = await calls();
              if (now === last && Number.isNaN(quietAfter)) {
                quietAfter = Date.now() - landed;
              } else if (now !== last) quietAfter = Number.NaN;
              last = now;
            }
            const before = await calls();
            await page.waitForTimeout(2000);
            const during = (await calls()) - before;
            console.log(
              `${path} ${item.name}: frames stop ~${quietAfter} ms after landing; ${during} rAF calls in 2 s at rest`,
            );
            expect(during).toBeLessThanOrEqual(2);
          });
        });
      }
    });
  });

  test.describe(`${path}: without the effects module`, () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("the straight move of spec 004 remains, with no tilt", async ({
      page,
    }) => {
      await page.route(FX_CHUNK, (route) => route.abort());
      await page.goto(path);
      await page.waitForSelector(READY, { timeout: 10_000 });
      // The failed download leaves no class mark behind.
      await expect(page.locator("html[data-fx-tier]")).toHaveCount(0, {
        timeout: 10_000,
      });
      await settleOn(page, 0);
      await startRecording(page);
      await page.waitForTimeout(100);
      await toBlock(page, 1);
      await expect(page.locator("#services")).toHaveAttribute(
        "data-active-planet",
        SERVICES[1]!.id,
      );
      await page.waitForTimeout(1500);
      const a = analyse(await stopRecording(page));
      report(`${path} without effects 0 -> 1`, a);
      expect(a.ratio).toBeLessThan(0.02);
      expect(a.maxTilt).toBeLessThan(0.01);
      await expect.poll(() => travelerInsidePlanet(page, 1)).toBe(true);
      await expect(page.locator(FLYING)).toHaveCount(0);
    });
  });

  test.describe(`${path}: reduced motion`, () => {
    test.use({ reducedMotion: "reduce" });

    test("no travelling Mac and no active planet mark", async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(2500);
      await expect(page.locator(TRAVELER)).toHaveCount(0);
      await expect(page.locator("#services")).not.toHaveAttribute(
        "data-active-planet",
        /.*/,
      );
    });
  });

  test.describe(`${path}: reduced motion mid-flight`, () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("the traveller and its flight are removed without moving the page", async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await settleOn(page, 0);
      await toBlock(page, 1);
      await expect(page.locator(FLYING)).toHaveCount(1, { timeout: 2_000 });
      const y = await page.evaluate(() => window.scrollY);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(TRAVELER)).toHaveCount(0);
      await expect(page.locator("#services")).not.toHaveAttribute(
        "data-active-planet",
        /.*/,
      );
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.scrollY)).toBe(y);
    });
  });
}
