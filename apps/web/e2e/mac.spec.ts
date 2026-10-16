import { expect, test, type Page } from "@playwright/test";
import { SERVICES } from "../src/lib/site-data";
import { translations } from "../src/lib/translations";
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
//
// T20 (RF-23, RF-24, RF-27, RF-40, RNF-11): while Mac flies he leaves a trail
// of particles at the rate of the device class (36, 20 or 8 a second), none
// when he does not, and the last ones are gone in under 0.6 s; on landing he
// bounces up to a scale of 1.12 and back in 0.4 s and a bubble shows that
// planet's line: one at a time, 2.0 to 2.8 s, solid, hidden from assistive
// technology, absent from the HTML, never on the main button and never out of
// the window at 320 px. With reduced motion there is none of it. The counts
// come from the `fx:report` marks `data-fx-trail-emitted` and
// `data-fx-trail-alive`.
//
// T21 (RF-25, RF-26, RF-27): with a fine pointer (middle and high class) the
// hero's Mac and the traveller lean up to 6 degrees and move up to 8 px
// towards the cursor, and are back at rest in under 1 s when it leaves the
// page; on touch and in the low class there is no gaze. The gaze is written on
// the elements' own `rotate` and `translate` properties, apart from the
// `transform` of the flight and the gesture. Once the hero's landing is over,
// Mac greets once (a sway of 0.8 s, `data-mac-greet="playing"`) with the
// greeting bubble; after 8 s without interaction the rest line comes out once
// per period of rest (simulated clock). With reduced motion there is none.
//
// T22 (RF-28, RF-29, RNF-4): a press on the hero's Mac (mouse, touch, Enter or
// Space) plays the gesture of spec 004 (0.6 s) plus a burst of 12 to 20
// particles (within the class limit) and one of his press lines, with no text
// changed. Five presses within 3 s set off turbo mode: `data-mac-turbo=
// "playing"` while Mac crosses the window in an arc (gone in at most 1.4 s), a
// burst of at least 60 particles (within the class limit) and the turbo line;
// not again for 10 s. Many presses never stack gestures or bubbles. With
// reduced motion, none of it. The counts come from the `fx:report` marks
// `data-fx-burst-emitted` and `data-fx-particles`.

const READY = 'html[data-motion="on"]';
const FX_ON = 'html[data-fx="on"]';
const FX_CHUNK = /\/fx-layer\.[\w-]+\.js$/;
const TRAVELER = "img[data-traveler]";
const FLYING = "img[data-traveler][data-mac-flight]";
const BUBBLE = "[data-mac-bubble]";
const HERO_MAC = ".hero__mac";
const GREET_MS = 800;

/** The gaze of an element (RF-25): its own `rotate` and `translate`. */
async function gazeOf(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const style = getComputedStyle(el);
    const rot = style.rotate === "none" ? 0 : parseFloat(style.rotate);
    const [x = 0, y = 0] =
      style.translate === "none"
        ? []
        : style.translate.split(" ").map((v) => parseFloat(v));
    const box = el.getBoundingClientRect();
    return {
      rot,
      x,
      y,
      none: style.rotate === "none" && style.translate === "none",
      // The centre without the gaze's own shift.
      cx: box.left + box.width / 2 - x,
      cy: box.top + box.height / 2 - y,
    };
  });
}

/**
 * Moves the cursor far from the Mac of `selector` and checks his gaze; then
 * the cursor leaves the page and he must be back at rest in under 1 s.
 */
async function expectGaze(page: Page, selector: string, label: string) {
  const rest = await gazeOf(page, selector);
  expect(rest.none, `${label}: at rest before the cursor moves`).toBe(true);
  const cursor = { x: rest.cx > 640 ? 40 : 1240, y: 40 };
  await page.mouse.move(cursor.x, cursor.y, { steps: 5 });
  await expect
    .poll(async () => Math.abs((await gazeOf(page, selector)).rot))
    .toBeGreaterThan(4);
  await page.waitForTimeout(700);
  const g = await gazeOf(page, selector);
  const shift = Math.hypot(g.x, g.y);
  // Up to 6 degrees and 8 px, towards the cursor.
  expect(Math.abs(g.rot)).toBeLessThanOrEqual(6.01);
  expect(shift).toBeLessThanOrEqual(8.01);
  expect(shift).toBeGreaterThan(4);
  expect(Math.sign(g.rot)).toBe(Math.sign(cursor.x - g.cx));
  expect(g.x * (cursor.x - g.cx) + g.y * (cursor.y - g.cy)).toBeGreaterThan(0);

  // The cursor leaves the page: back to rest in under a second.
  const ms = await page.locator(selector).evaluate(async (el) => {
    const off = () => {
      const style = getComputedStyle(el);
      const rot = style.rotate === "none" ? 0 : parseFloat(style.rotate);
      const [x = 0, y = 0] =
        style.translate === "none"
          ? []
          : style.translate.split(" ").map((v) => parseFloat(v));
      return Math.abs(rot) >= 0.1 || Math.hypot(x, y) >= 0.5;
    };
    const start = performance.now();
    document.documentElement.dispatchEvent(
      new MouseEvent("mouseleave", { relatedTarget: null }),
    );
    while (off() && performance.now() - start < 3000) {
      await new Promise((r) => requestAnimationFrame(r));
    }
    return performance.now() - start;
  });
  console.log(
    `${label}: gaze ${g.rot.toFixed(2)} deg, ${shift.toFixed(2)} px; back at rest in ${Math.round(ms)} ms`,
  );
  expect(ms).toBeLessThan(1000);
}

/**
 * Lets the greeting (if Mac is in view) come and go: the landing ends at most
 * 1.65 s after the first paint and the sway lasts 0.8 s.
 */
async function afterGreeting(page: Page) {
  await page.waitForTimeout(2_000);
  await expect(page.locator(HERO_MAC)).not.toHaveAttribute(
    "data-mac-greet",
    /.+/,
    { timeout: 2_000 },
  );
}

/** What the page records of Mac's greeting and bubbles (before any script). */
type MacLog = {
  greetStarts: number[];
  greetEnds: number[];
  landed: number[];
  bubbles: { t: number; text: string }[];
  maxSway: number;
  /** Longest frame while the greeting plays (ms). */
  maxFrameMs: number;
};

async function logMac(page: Page) {
  await page.addInitScript(() => {
    const log: MacLog = {
      greetStarts: [],
      greetEnds: [],
      landed: [],
      bubbles: [],
      maxSway: 0,
      maxFrameMs: 0,
    };
    (window as Window & { __mac?: MacLog }).__mac = log;
    // The end of the hero's landing (its CSS bounce).
    document.addEventListener(
      "animationend",
      (event) => {
        if (event.animationName.includes("hero-mac-bounce")) {
          log.landed.push(performance.now());
        }
      },
      true,
    );
    document.addEventListener("DOMContentLoaded", () => {
      const mac = document.querySelector<HTMLElement>(".hero__mac")!;
      let sampling = false;
      let lastFrame = Number.NaN;
      const sample = (now: number) => {
        const style = getComputedStyle(mac);
        const rot = style.rotate === "none" ? 0 : parseFloat(style.rotate);
        log.maxSway = Math.max(log.maxSway, Math.abs(rot));
        if (!Number.isNaN(lastFrame)) {
          log.maxFrameMs = Math.max(log.maxFrameMs, now - lastFrame);
        }
        lastFrame = now;
        if (sampling) requestAnimationFrame(sample);
      };
      new MutationObserver(() => {
        const on = mac.getAttribute("data-mac-greet") === "playing";
        if (on === sampling) return;
        sampling = on;
        (on ? log.greetStarts : log.greetEnds).push(performance.now());
        if (on) {
          lastFrame = Number.NaN;
          requestAnimationFrame(sample);
        }
      }).observe(mac, {
        attributes: true,
        attributeFilter: ["data-mac-greet"],
      });
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLElement && node.dataset.macBubble === "") {
              log.bubbles.push({
                t: performance.now(),
                text: node.textContent ?? "",
              });
            }
          }
        }
      }).observe(document.body, { childList: true });
    });
  });
}

async function macLog(page: Page): Promise<MacLog> {
  return page.evaluate(() => (window as Window & { __mac?: MacLog }).__mac!);
}

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
  /** performance.now() when sampled (GSAP times its frames this way). */
  pt: number;
  x: number;
  y: number;
  rot: number;
  /** Scale of the traveller (1 at rest; the bounce of RF-24 goes above). */
  scale: number;
  flying: boolean;
  overflow: number;
  /** Trail particles emitted so far and alive now (fx:report). */
  trailEmitted: number;
  trailAlive: number;
  /** Bubbles on the page, and the first one's text and box (window px). */
  bubbles: number;
  bubbleText: string | null;
  bubbleBox: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null;
  /** Does the bubble share area with a main button ("Quiero despegar")? */
  bubbleOnButton: boolean;
};

/** A take-off (`flying`) or a landing, at its exact time (performance.now). */
type FlightMark = { t: number; flying: boolean };

/** Take-offs and landings since the recording started. */
async function flightMarks(page: Page): Promise<FlightMark[]> {
  return page.evaluate(
    () => (window as Window & { __flights?: FlightMark[] }).__flights ?? [],
  );
}

/** Starts recording the traveller on every frame (window.__samples). */
async function startRecording(page: Page) {
  await page.evaluate(
    ([selector, bubbleSelector]) => {
      const w = window as Window & {
        __samples?: Sample[];
        __rec?: boolean;
        __flights?: FlightMark[];
        __flightObserver?: MutationObserver;
      };
      w.__samples = [];
      w.__rec = true;
      const el = document.querySelector(selector!) as HTMLElement;
      const root = document.documentElement;
      // The exact moments Mac takes off and lands (the frames only see them
      // up to a frame late).
      w.__flights = [];
      w.__flightObserver?.disconnect();
      w.__flightObserver = new MutationObserver(() => {
        const flying = el.hasAttribute("data-mac-flight");
        const marks = w.__flights!;
        if (marks.at(-1)?.flying !== flying) {
          marks.push({ t: performance.now(), flying });
        }
      });
      w.__flightObserver.observe(el, {
        attributes: true,
        attributeFilter: ["data-mac-flight"],
      });
      const tick = (now: number) => {
        if (!w.__rec) return;
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        document.dispatchEvent(new Event("fx:report"));
        const bubbles = document.querySelectorAll(bubbleSelector!);
        const bubble = bubbles[0] as HTMLElement | undefined;
        const box = bubble?.getBoundingClientRect();
        const onButton =
          !!box &&
          [...document.querySelectorAll(".cta")].some((cta) => {
            const b = cta.getBoundingClientRect();
            return (
              b.width > 0 &&
              box.left < b.right &&
              b.left < box.right &&
              box.top < b.bottom &&
              b.top < box.bottom
            );
          });
        w.__samples!.push({
          t: now,
          pt: performance.now(),
          x: m.e,
          y: m.f,
          rot: (Math.atan2(m.b, m.a) * 180) / Math.PI,
          scale: Math.hypot(m.a, m.b),
          flying: el.hasAttribute("data-mac-flight"),
          overflow: root.scrollWidth - root.clientWidth,
          trailEmitted: Number(root.dataset.fxTrailEmitted ?? Number.NaN),
          trailAlive: Number(root.dataset.fxTrailAlive ?? Number.NaN),
          bubbles: bubbles.length,
          bubbleText: bubble?.textContent ?? null,
          bubbleBox: box
            ? {
                left: box.left,
                top: box.top,
                right: box.right,
                bottom: box.bottom,
              }
            : null,
          bubbleOnButton: onButton,
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [TRAVELER, BUBBLE] as const,
  );
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
  afterLandingMs = 700,
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
  await page.waitForTimeout(afterLandingMs);
  return stopRecording(page);
}

/** Longest frame of a recording (ms). */
function longestGap(samples: Sample[]) {
  let longest = 0;
  for (let i = 1; i < samples.length; i++) {
    longest = Math.max(longest, samples[i]!.t - samples[i - 1]!.t);
  }
  return longest;
}

/**
 * A frame this long is the machine stalling, not the page: GSAP counts a
 * frame of over 500 ms as 33 ms (its default lag smoothing), so the flight
 * lasts that much longer on the clock, and the trail, due by the clock, finds
 * its pool full. The page's timings cannot be read from such a recording.
 */
const STALL_MS = 250;

/**
 * `recordFlight`, recorded again (up to 3 times) when the machine stalls
 * during it; the last recording is returned whatever it holds.
 */
async function recordSteadyFlight(
  ...args: Parameters<typeof recordFlight>
): Promise<Sample[]> {
  for (let attempt = 1; ; attempt++) {
    const samples = await recordFlight(...args);
    const gap = longestGap(samples);
    if (gap <= STALL_MS || attempt === 3) return samples;
    console.log(
      `stalled frame of ${Math.round(gap)} ms; recording ${args[1]} -> ${args[2]} again`,
    );
  }
}

/**
 * Mac's trail in a recording (RF-23): emission rate while he flies, particles
 * emitted while he does not, and how long the last ones live after landing.
 */
function analyseTrail(samples: Sample[], marks: FlightMark[]) {
  const first = samples.findIndex((s) => s.flying);
  let last = -1;
  samples.forEach((s, i) => {
    if (s.flying) last = i;
  });
  expect(first, "Mac never flew").toBeGreaterThan(0);
  expect(last, "Mac never landed").toBeLessThan(samples.length - 1);
  expect(samples.every((s) => Number.isFinite(s.trailEmitted))).toBe(true);
  // The flight itself, from take-off to landing, as the page timed them.
  expect(marks.map((m) => m.flying)).toEqual([true, false]);
  const flightMs = marks[1]!.t - marks[0]!.t;
  // Emitted from the frame before take-off to the frame after landing.
  const before = samples[first - 1]!;
  const end = samples[last]!;
  const emitted = samples[last + 1]!.trailEmitted - before.trailEmitted;
  // Frames where Mac was not flying on this one nor the one before (the
  // canvas may draw the frame he lands on before the recorder sees it).
  let idleEmitted = 0;
  for (let i = 2; i < samples.length; i++) {
    const [a, b, c] = [samples[i - 2]!, samples[i - 1]!, samples[i]!];
    if (!a.flying && !b.flying && !c.flying) {
      idleEmitted += c.trailEmitted - b.trailEmitted;
    }
  }
  const goneAt = samples.findIndex((s, i) => i >= last && s.trailAlive === 0);
  const gone = samples[goneAt];
  // The last particle went between the frame before `gone` (still one alive)
  // and `gone`: the earlier frame, timed from the exact landing, does not grow
  // with a slow frame.
  const stillAlive = goneAt > 0 ? samples[goneAt - 1]! : undefined;
  return {
    perSecond: (emitted * 1000) / flightMs,
    emitted,
    flightMs,
    idleEmitted,
    maxAlive: Math.max(...samples.map((s) => s.trailAlive)),
    fadeMs: gone ? gone.t - end.t : Number.POSITIVE_INFINITY,
    fadeMinMs:
      gone && stillAlive
        ? Math.max(0, stillAlive.t - marks[1]!.t)
        : Number.POSITIVE_INFINITY,
  };
}

/**
 * Arrival bounce in a recording (RF-24): peak scale, the frame it starts on
 * and when it ends, timed from the exact landing (`marks`, not a frame: with
 * the CPU busy a frame can last 50 to 100 ms and a time measured between two
 * frames grows with it).
 */
function analyseBounce(samples: Sample[], marks: FlightMark[]) {
  let last = -1;
  samples.forEach((s, i) => {
    if (s.flying) last = i;
  });
  const landedAt = marks.findLast((m) => !m.flying)?.t ?? Number.NaN;
  const flight = samples.slice(0, last + 1);
  const after = samples.slice(last + 1);
  const grownAt = after.findIndex((s) => s.scale > 1.002);
  let lastGrownAt = -1;
  after.forEach((s, i) => {
    if (s.scale > 1.002) lastGrownAt = i;
  });
  const firstGrown = after[grownAt];
  const lastGrown = after[lastGrownAt];
  // The frame before the last grown one (the frame time it lasted) and the
  // first one back at rest.
  const beforeLastGrown = lastGrownAt > 0 ? after[lastGrownAt - 1] : undefined;
  const back = after[lastGrownAt + 1];
  return {
    flightMaxScale: Math.max(...flight.map((s) => s.scale)),
    peak: Math.max(...after.map((s) => s.scale)),
    // 1 = the first frame after the last one in flight.
    startsAfterFrames: grownAt < 0 ? Number.NaN : grownAt + 1,
    startsAfterMs: firstGrown ? firstGrown.t - landedAt : Number.NaN,
    // Still grown at this time after landing, and the frame it lasted.
    lastGrownMs: lastGrown ? lastGrown.t - landedAt : Number.NaN,
    lastGrownFrameMs:
      lastGrown && beforeLastGrown ? lastGrown.t - beforeLastGrown.t : 0,
    // Back to rest by this time (NaN if never seen).
    backMs: back ? back.t - landedAt : Number.NaN,
    finalScale: samples[samples.length - 1]!.scale,
  };
}

/**
 * Each bubble shown in a recording: its text, the frame it appeared on and
 * the first frame without it (NaN if it was still there at the end), with
 * the frames just before them (`fromPrev`, `toPrev`): it appeared between
 * `fromPrev` and `from`, and went between `toPrev` and `to`.
 */
function bubbleRuns(samples: Sample[]) {
  type Run = {
    text: string;
    from: number;
    fromPrev: number;
    to: number;
    toPrev: number;
  };
  const runs: Run[] = [];
  let open: Omit<Run, "to" | "toPrev"> | null = null;
  let prev = Number.NaN;
  for (const s of samples) {
    if (open && s.bubbleText === open.text) {
      prev = s.t;
      continue;
    }
    if (open) runs.push({ ...open, to: s.t, toPrev: prev });
    open =
      s.bubbleText === null
        ? null
        : { text: s.bubbleText, from: s.t, fromPrev: prev };
    prev = s.t;
  }
  if (open) runs.push({ ...open, to: Number.NaN, toPrev: Number.NaN });
  return runs;
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
      // The time since the frame before the previous one, on both clocks:
      // GSAP moves Mac by the time it reads in its own frame (with a busy
      // CPU it differs from the frame's timestamp), and the recorder may see
      // two of GSAP's frames in one when the order of the two frame
      // callbacks swaps. A real jump (hundreds of px at once) still shows.
      const q = flight[Math.max(0, i - 2)]!;
      const dt = Math.max(1, s.t - q.t, s.pt - q.pt);
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
  // The flight began after `start` and before the next frame, and ended
  // after the frame before `end` and by `end`: the longest and the shortest
  // it can have lasted (they differ by the two frames at its ends, which a
  // busy CPU stretches).
  return {
    first,
    durationMs: end.t - start.t,
    durationMinMs:
      endIndex - 1 > startIndex + 1
        ? samples[endIndex - 1]!.t - samples[startIndex + 1]!.t
        : 0,
    distance,
    ratio: deviation / distance,
    maxTilt,
    straightenMs: straightAt - end.t,
    // Both under 1 when there is no jump.
    maxStep,
    maxTurn,
    maxOverflow: Math.max(...samples.map((s) => s.overflow)),
    finalRot: samples[samples.length - 1]!.rot,
    longestFrameMs: longestGap(samples),
  };
}

function report(label: string, a: ReturnType<typeof analyse>) {
  console.log(
    `${label}: ${Math.round(a.distance)} px in ${Math.round(a.durationMinMs)}-${Math.round(a.durationMs)} ms, ` +
      `deviation ${(a.ratio * 100).toFixed(1)} %, tilt up to ${a.maxTilt.toFixed(1)} deg, ` +
      `straight ${Math.round(a.straightenMs)} ms after landing, longest frame ${Math.round(a.longestFrameMs)} ms`,
  );
}

function expectCurvedFlight(a: ReturnType<typeof analyse>) {
  expect(a.ratio).toBeGreaterThanOrEqual(0.12);
  // 0.7 to 1.6 s, between the frames around take-off and landing (a few ms
  // either side for the timers).
  expect(a.durationMs).toBeGreaterThanOrEqual(700 - 20);
  expect(a.durationMinMs).toBeLessThanOrEqual(1600 + 20);
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

const DESKTOP = { viewport: { width: 1280, height: 720 } } as const;

/** Trail rate of each device class (plan section 5, TIER_PARAMS). */
const TRAIL_CASES = [
  {
    name: "desktop, high class",
    tier: "high",
    rate: 36,
    use: DESKTOP,
    signals: { cores: 8, memory: 8 },
  },
  {
    name: "desktop, middle class",
    tier: "mid",
    rate: 20,
    use: DESKTOP,
    signals: { cores: 4, memory: 8 },
  },
  {
    name: "desktop, low class",
    tier: "low",
    rate: 8,
    use: DESKTOP,
    signals: { cores: 8, saveData: true },
  },
  {
    name: "375 px phone, low class",
    tier: "low",
    rate: 8,
    use: VIEWPORTS[1].use,
    signals: { cores: 8, memory: 8 },
  },
] as const;

/** Window sizes of the check that no bubble covers a text (T23). */
const CLEAR_CASES = [
  {
    name: "320 px phone",
    use: VIEWPORTS[2].use,
    touch: true,
  },
  {
    name: "375 px phone",
    use: VIEWPORTS[1].use,
    touch: true,
  },
  { name: "1280 px desktop", use: DESKTOP, touch: false },
  {
    name: "1440 px desktop",
    use: { viewport: { width: 1440, height: 900 } },
    touch: false,
  },
] as const;

/** A bubble once popped in, and what it covers. */
type Clearance = {
  text: string;
  box: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  /** The visible texts it shares area with (their first characters). */
  covers: string[];
  /** Does it share area with a "Quiero despegar" button? */
  onButton: boolean;
  overflow: number;
};

/**
 * Checks every bubble once it has popped in (scale 1, or the last frame
 * before another one takes its place) against the line boxes of every
 * visible text of the page and the main buttons (before any script).
 */
async function watchBubbleClearance(page: Page) {
  await page.addInitScript(() => {
    const log: Clearance[] = [];
    (window as Window & { __clear?: Clearance[] }).__clear = log;
    const SKIP = "[data-mac-bubble], script, style, noscript, template";
    const check = (bubble: HTMLElement) => {
      const b = bubble.getBoundingClientRect();
      const share = (r: DOMRect) =>
        Math.min(b.right, r.right) - Math.max(b.left, r.left) > 0 &&
        Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top) > 0;
      const covers: string[] = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue?.trim() ?? "";
        const parent = node.parentElement;
        if (!text || !parent || parent.closest(SKIP)) continue;
        if (getComputedStyle(parent).visibility !== "visible") continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width > 1 && r.height > 1 && share(r)) {
            covers.push(text.slice(0, 24));
            break;
          }
        }
      }
      const onButton = [...document.querySelectorAll(".cta")].some((cta) => {
        const r = cta.getBoundingClientRect();
        return r.width > 0 && share(r);
      });
      const root = document.documentElement;
      log.push({
        text: bubble.textContent ?? "",
        box: {
          left: b.left,
          top: b.top,
          right: b.right,
          bottom: b.bottom,
          width: b.width,
          height: b.height,
        },
        covers,
        onButton,
        overflow: root.scrollWidth - root.clientWidth,
      });
    };
    const follow = (bubble: HTMLElement) => {
      const tick = () => {
        if (!bubble.isConnected) return;
        const m = new DOMMatrixReadOnly(getComputedStyle(bubble).transform);
        if (Math.abs(Math.hypot(m.a, m.b) - 1) < 0.001) check(bubble);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    document.addEventListener("DOMContentLoaded", () => {
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof HTMLElement && node.dataset.macBubble === "") {
              follow(node);
            }
          }
        }
      }).observe(document.body, { childList: true });
    });
  });
}

async function clearances(page: Page): Promise<Clearance[]> {
  return page.evaluate(
    () => (window as Window & { __clear?: Clearance[] }).__clear ?? [],
  );
}

for (const { path, locale } of homePages) {
  const lines = translations[locale];
  const arrive = (i: number) =>
    lines[`mac.arrive.${SERVICES[i]!.id}` as keyof typeof lines];
  const pressLines: string[] = [
    lines["mac.click.1"],
    lines["mac.click.2"],
    lines["mac.click.3"],
  ];

  test.describe(`${path}: Mac's trail and arrival bounce (RF-23, RF-24)`, () => {
    for (const item of TRAIL_CASES) {
      test.describe(item.name, () => {
        test.use(item.use);

        test(`at least ${item.rate} trail particles a second only while he flies, gone in under 0.6 s; a bounce up to 1.12 in 0.4 s on landing`, async ({
          page,
        }) => {
          await simulate(page, item.signals);
          await page.goto(path);
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          await expect(page.locator("html")).toHaveAttribute(
            "data-fx-tier",
            item.tier,
          );
          for (const [from, to] of [
            [0, 1],
            [1, 2],
          ] as const) {
            const samples = await recordSteadyFlight(page, from, to);
            const marks = await flightMarks(page);
            const trail = analyseTrail(samples, marks);
            const bounce = analyseBounce(samples, marks);
            console.log(
              `${path} ${item.name} ${from} -> ${to}: ${trail.emitted} trail particles in ${Math.round(trail.flightMs)} ms ` +
                `(${trail.perSecond.toFixed(1)}/s, up to ${trail.maxAlive} alive), gone ${Math.round(trail.fadeMinMs)}-${Math.round(trail.fadeMs)} ms after landing; ` +
                `bounce up to ${bounce.peak.toFixed(3)} from frame ${bounce.startsAfterFrames} (+${Math.round(bounce.startsAfterMs)} ms), ` +
                `grown until +${Math.round(bounce.lastGrownMs)} ms (frame of ${Math.round(bounce.lastGrownFrameMs)} ms), back at +${Math.round(bounce.backMs)} ms; ` +
                `longest frame ${Math.round(longestGap(samples))} ms`,
            );
            // RF-23: the rate of the class while he flies (whole particles:
            // in a flight of t s, at least rate * t rounded down; the page
            // times the landing a few ms after the last one is due), and no
            // more than that (plus the one emitted at take-off).
            expect(trail.emitted).toBeGreaterThanOrEqual(
              Math.floor((item.rate * trail.flightMs) / 1000),
            );
            expect(trail.emitted).toBeLessThanOrEqual(
              Math.ceil((item.rate * trail.flightMs) / 1000) + 2,
            );
            expect(trail.idleEmitted).toBe(0);
            // Gone between two frames: the earlier one, timed from the exact
            // landing, under 0.6 s.
            expect(trail.fadeMinMs).toBeLessThan(600);
            // RF-24: no growth in flight; up to 1.12 and back within 0.4 s.
            expect(bounce.flightMaxScale).toBeLessThan(1.001);
            expect(bounce.peak).toBeGreaterThanOrEqual(1.1);
            expect(bounce.peak).toBeLessThanOrEqual(1.1205);
            // It starts on landing: grown on the second frame after the last
            // one in flight at the latest (the landing frame starts the
            // timeline, the next one draws it; the recorder may see each
            // frame's drawing on the following one).
            expect(bounce.startsAfterFrames).toBeLessThanOrEqual(2);
            // 0.4 s from the landing: back at rest by then, give or take the
            // frame the last grown sample lasted (an ease.out bounce drops
            // under 1.002 at about 0.37 s), and not back before 0.3 s.
            expect(bounce.lastGrownMs).toBeLessThanOrEqual(
              400 + bounce.lastGrownFrameMs,
            );
            expect(bounce.backMs).toBeGreaterThanOrEqual(300);
            expect(Math.abs(bounce.finalScale - 1)).toBeLessThan(0.001);
            expect(
              Math.max(...samples.map((s) => s.overflow)),
            ).toBeLessThanOrEqual(0);
          }
        });
      });
    }
  });

  test.describe(`${path}: Mac's bubbles (RF-24, RF-27, RNF-11)`, () => {
    for (const item of [VIEWPORTS[0], VIEWPORTS[2]]) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("one bubble at a time with the planet's line, 2.0 to 2.8 s, solid and hidden from assistive technology, clear of the main button and inside the window", async ({
          page,
        }) => {
          const width = item.use.viewport.width;
          await simulate(page, item.signals);
          await page.goto(path);
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          await settleOn(page, 0);
          // The first arrival may have a bubble of its own: let it go.
          await expect(page.locator(BUBBLE)).toHaveCount(0, { timeout: 4_000 });

          // Arrival on planet 1: its line, left alone until it goes.
          await startRecording(page);
          await page.waitForTimeout(100);
          await toBlock(page, 1);
          await expect(page.locator(FLYING)).toHaveCount(1, { timeout: 2_000 });
          await expect(page.locator(FLYING)).toHaveCount(0, { timeout: 6_000 });
          const bubble = page.locator(BUBBLE);
          await expect(bubble).toHaveCount(1, { timeout: 1_000 });
          await expect(bubble).toHaveAttribute("aria-hidden", "true");
          const look = await bubble.evaluate((el) => {
            const style = getComputedStyle(el);
            return {
              background: style.backgroundColor,
              image: style.backgroundImage,
              opacity: style.opacity,
            };
          });
          // A solid colour: no transparency and no gradient or image.
          expect(look.background).toMatch(/^rgb\(/);
          expect(look.image).toBe("none");
          expect(look.opacity).toBe("1");
          // Once popped in: the tail sits on the edge facing Mac, clear of
          // the text (a width rounded down used to wrap the text over it).
          await page.waitForTimeout(300);
          const shape = await bubble.evaluate((el) => {
            const box = (e: Element) => e.getBoundingClientRect().toJSON();
            const tail = el.querySelector(
              ":scope > span:not([data-mac-bubble-text])",
            )!;
            const text = el.querySelector("[data-mac-bubble-text]")!;
            return { bubble: box(el), tail: box(tail), text: box(text) };
          });
          const { bubble: b, tail, text } = shape;
          const tailX = tail.left + tail.width / 2;
          const tailY = tail.top + tail.height / 2;
          const onEdge = [
            Math.abs(tailY - b.top),
            Math.abs(tailY - b.bottom),
            Math.abs(tailX - b.left),
            Math.abs(tailX - b.right),
          ];
          expect(Math.min(...onEdge)).toBeLessThanOrEqual(1);
          const apart =
            tail.right <= text.left ||
            text.right <= tail.left ||
            tail.bottom <= text.top ||
            text.bottom <= tail.top;
          expect(apart).toBe(true);
          await page.waitForTimeout(2_900);

          // Two arrivals in a row: the second line takes the first one's
          // place; never two bubbles.
          await toBlock(page, 2);
          await expect(page.locator(FLYING)).toHaveCount(1, { timeout: 2_000 });
          await expect(page.locator(FLYING)).toHaveCount(0, { timeout: 6_000 });
          await page.waitForTimeout(400);
          await toBlock(page, 0);
          await expect(page.locator(FLYING)).toHaveCount(1, { timeout: 2_000 });
          await expect(page.locator(FLYING)).toHaveCount(0, { timeout: 6_000 });
          await page.waitForTimeout(3_200);
          const samples = await stopRecording(page);

          const runs = bubbleRuns(samples);
          console.log(
            `${path} ${item.name}: ` +
              runs
                .map((r) => `"${r.text}" ${Math.round(r.to - r.from)} ms`)
                .join(", "),
          );
          expect(runs.map((r) => r.text)).toEqual([
            arrive(1),
            arrive(2),
            arrive(0),
          ]);
          // 2.0 to 2.8 s between the frames around its start and its end
          // (a slow frame widens the gap, not the check), a few ms either
          // side for the timers.
          for (const run of [runs[0]!, runs[2]!]) {
            expect(run.to - run.fromPrev).toBeGreaterThanOrEqual(2000 - 20);
            expect(run.toPrev - run.from).toBeLessThanOrEqual(2800 + 20);
          }
          expect(
            Math.max(...samples.map((s) => s.bubbles)),
          ).toBeLessThanOrEqual(1);
          for (const s of samples) {
            expect(s.overflow).toBeLessThanOrEqual(0);
            expect(s.bubbleOnButton).toBe(false);
            if (!s.bubbleBox) continue;
            expect(s.bubbleBox.left).toBeGreaterThanOrEqual(0);
            expect(s.bubbleBox.right).toBeLessThanOrEqual(width);
          }
        });
      });
    }
  });

  // T23 (R3 review): no bubble ever covers a text of the page. Every bubble
  // Mac says (the greeting, a press, turbo mode, the rest line and the
  // arrival on each planet) is checked once popped in, against the line boxes
  // of every visible text (headings, paragraphs, labels, links) and the
  // "Quiero despegar" buttons, at 320, 375, 1280 and 1440 px.
  test.describe(`${path}: no bubble covers a text (RF-27, RNF-11)`, () => {
    test.describe.configure({ timeout: 150_000 });

    for (const item of CLEAR_CASES) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("greeting, press, turbo, rest and arrival bubbles clear of every visible text and button, inside the window", async ({
          page,
        }) => {
          await simulate(page, { cores: 8, memory: 8 });
          await watchBubbleClearance(page);
          await page.goto(path);
          const mac = page.locator(HERO_MAC);
          await mac.evaluate((el) =>
            el.scrollIntoView({ block: "center", behavior: "instant" }),
          );
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          const seen = async (text: string) =>
            (await clearances(page)).some((c) => c.text === text);
          const gone = () =>
            expect(page.locator(BUBBLE)).toHaveCount(0, { timeout: 6_000 });

          // The greeting, once the hero's landing is over.
          await expect
            .poll(() => seen(lines["mac.greet"]), { timeout: 10_000 })
            .toBe(true);
          await gone();
          // A press, then (3 s later, a new series) turbo mode.
          await expect(mac).toHaveAttribute("role", "button");
          const box = (await mac.boundingBox())!;
          const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          const press = () =>
            item.touch
              ? page.touchscreen.tap(at.x, at.y)
              : page.mouse.click(at.x, at.y);
          await press();
          await expect
            .poll(
              async () =>
                (await clearances(page)).some((c) =>
                  pressLines.includes(c.text),
                ),
              { timeout: 3_000 },
            )
            .toBe(true);
          await page.waitForTimeout(3_200);
          for (let i = 0; i < 5; i++) {
            await press();
            if (i < 4) await page.waitForTimeout(250);
          }
          await expect
            .poll(() => seen(lines["mac.turbo"]), { timeout: 3_000 })
            .toBe(true);
          await expect(mac).not.toHaveAttribute("data-mac-turbo", /.*/, {
            timeout: TURBO_MAX_MS + 3_000,
          });
          await gone();
          // The rest line: 8 s without interaction.
          await expect
            .poll(() => seen(lines["mac.idle"]), { timeout: 12_000 })
            .toBe(true);
          await gone();
          // The arrival on each planet (the first one, from the hero, may
          // come with no line: Mac is placed there, not flown).
          await settleOn(page, 0);
          await gone();
          for (const i of [1, 2, 0]) {
            await toBlock(page, i);
            await expect
              .poll(() => seen(arrive(i)), { timeout: 10_000 })
              .toBe(true);
            await gone();
          }

          const all = await clearances(page);
          for (const c of all) {
            console.log(
              `${path} ${item.name}: "${c.text}" at ${c.box.left},${c.box.top} ${c.box.width}x${c.box.height}` +
                (c.covers.length
                  ? `, covers ${c.covers.join("; ")}`
                  : ", clear"),
            );
          }
          for (const c of all) {
            expect(c.covers, `"${c.text}" covers`).toEqual([]);
            expect(c.onButton, `"${c.text}" on a main button`).toBe(false);
            expect(c.box.left, `"${c.text}" left`).toBeGreaterThanOrEqual(0);
            expect(c.box.top, `"${c.text}" top`).toBeGreaterThanOrEqual(0);
            expect(c.box.right, `"${c.text}" right`).toBeLessThanOrEqual(
              item.use.viewport.width,
            );
            expect(c.box.bottom, `"${c.text}" bottom`).toBeLessThanOrEqual(
              item.use.viewport.height,
            );
            expect(c.overflow, `"${c.text}" overflow`).toBeLessThanOrEqual(0);
          }
        });
      });
    }
  });

  test.describe(`${path}: Mac's gaze (RF-25)`, () => {
    test.describe("desktop, high class", () => {
      test.use(DESKTOP);

      test("the hero's Mac and the traveller lean up to 6 degrees and move up to 8 px towards the cursor, and are back in under 1 s", async ({
        page,
      }) => {
        await simulate(page, { cores: 8, memory: 8 });
        await page.goto(path);
        await page.waitForSelector(FX_ON, { timeout: 10_000 });
        await afterGreeting(page);
        await expectGaze(page, HERO_MAC, `${path} hero's Mac`);
        await settleOn(page, 0);
        await expectGaze(page, TRAVELER, `${path} traveller`);
        // The gaze never touches the transform of the flight or the gesture.
        expect(
          await page
            .locator(HERO_MAC)
            .evaluate((el) => getComputedStyle(el).transform),
        ).toBe("none");
      });
    });

    for (const item of [
      { name: "375 px phone (touch)", use: VIEWPORTS[1].use, signals: {} },
      { name: "desktop, low class", use: DESKTOP, signals: { saveData: true } },
    ] as const) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("no gaze", async ({ page }) => {
          await simulate(page, { cores: 8, memory: 8, ...item.signals });
          await page.goto(path);
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          await afterGreeting(page);
          await page.mouse.move(300, 300);
          await page.mouse.move(2, 2, { steps: 5 });
          await page.waitForTimeout(600);
          expect((await gazeOf(page, HERO_MAC)).none).toBe(true);
          await settleOn(page, 0);
          await page.mouse.move(300, 300, { steps: 5 });
          await page.waitForTimeout(600);
          expect((await gazeOf(page, TRAVELER)).none).toBe(true);
        });
      });
    }
  });

  test.describe(`${path}: Mac's greeting (RF-26, RF-27)`, () => {
    for (const item of [VIEWPORTS[0], VIEWPORTS[1]]) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("once the hero's landing is over, a sway of 0.8 s with the greeting bubble, once per visit", async ({
          page,
        }) => {
          await simulate(page, item.signals);
          await logMac(page);
          await page.goto(path);
          // On a phone Mac may start below the fold: bring him into view.
          await page
            .locator(HERO_MAC)
            .evaluate((el) =>
              el.scrollIntoView({ block: "center", behavior: "instant" }),
            );
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          await expect
            .poll(async () => (await macLog(page)).greetEnds.length, {
              timeout: 6_000,
            })
            .toBe(1);
          // Away and back: no second greeting.
          await page.waitForTimeout(3_000);
          await toBlock(page, 0);
          await page.waitForTimeout(800);
          await page
            .locator(HERO_MAC)
            .evaluate((el) =>
              el.scrollIntoView({ block: "center", behavior: "instant" }),
            );
          await page.waitForTimeout(2_500);
          const log = await macLog(page);
          const start = log.greetStarts[0]!;
          const greetings = log.bubbles.filter(
            (b) => b.text === lines["mac.greet"],
          );
          console.log(
            `${path} ${item.name}: greeting ${Math.round(log.greetEnds[0]! - start)} ms, ` +
              `${Math.round(start - (log.landed.at(-1) ?? Number.NaN))} ms after the landing, ` +
              `sway up to ${log.maxSway.toFixed(1)} deg, longest frame ${Math.round(log.maxFrameMs)} ms, bubble at +${Math.round((greetings[0]?.t ?? Number.NaN) - start)} ms`,
          );
          expect(log.greetStarts).toHaveLength(1);
          expect(log.greetEnds).toHaveLength(1);
          // 0.8 s: it ends on the first frame past it, so up to the longest
          // frame meanwhile later (a busy CPU stretches them); its start is
          // seen after the bubble is placed, a little late.
          const ms = log.greetEnds[0]! - start;
          const frame = Math.max(log.maxFrameMs, 1000 / 60);
          expect(ms).toBeGreaterThanOrEqual(GREET_MS - Math.max(20, frame));
          expect(ms).toBeLessThanOrEqual(GREET_MS + frame + 40);
          // After the landing of the hero's entrance.
          expect(log.landed.length).toBeGreaterThanOrEqual(1);
          expect(start).toBeGreaterThanOrEqual(log.landed.at(-1)!);
          // A real sway, with the greeting bubble at its start.
          expect(log.maxSway).toBeGreaterThan(3);
          expect(log.maxSway).toBeLessThanOrEqual(12);
          expect(greetings).toHaveLength(1);
          expect(Math.abs(greetings[0]!.t - start)).toBeLessThan(100);
          // Mac rests straight again.
          expect((await gazeOf(page, HERO_MAC)).none).toBe(true);
          await expect(page.locator(HERO_MAC)).not.toHaveAttribute(
            "data-mac-greet",
            /.+/,
          );
        });
      });
    }
  });

  test.describe(`${path}: Mac's rest line (RF-27)`, () => {
    test.describe.configure({ timeout: 90_000 });

    for (const item of [VIEWPORTS[0], VIEWPORTS[1]]) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("after 8 s without interaction, the rest line once per period of rest", async ({
          page,
        }) => {
          await page.clock.install();
          await simulate(page, item.signals);
          await logMac(page);
          await page.goto(path);
          await page
            .locator(HERO_MAC)
            .evaluate((el) =>
              el.scrollIntoView({ block: "center", behavior: "instant" }),
            );
          await page.waitForSelector(FX_ON, { timeout: 10_000 });
          // Let the greeting come and go. It waits for the hero's CSS landing,
          // which runs in real time (the simulated clock does not move the
          // animations), so it is awaited first; then its bubble's timer.
          await expect
            .poll(async () => (await macLog(page)).greetEnds.length, {
              timeout: 8_000,
            })
            .toBe(1);
          await page.clock.runFor(3_000);
          const idles = async () =>
            (await macLog(page)).bubbles.filter(
              (b) => b.text === lines["mac.idle"],
            ).length;
          // An interaction: a period of rest starts now.
          await page.keyboard.press("Shift");
          await page.clock.runFor(7_700);
          expect(await idles()).toBe(0);
          await page.clock.runFor(600);
          expect(await idles()).toBe(1);
          await expect(page.locator(BUBBLE)).toHaveCount(1);
          await expect(page.locator(BUBBLE)).toHaveText(lines["mac.idle"]);
          // Still the same period: not again.
          await page.clock.runFor(16_000);
          expect(await idles()).toBe(1);
          await expect(page.locator(BUBBLE)).toHaveCount(0);
          // Never the same line twice in a row (RF-27): a new period right
          // after it brings the rest line again only if Mac said something
          // else in between.
          const neverTwiceInARow = async () => {
            const texts = (await macLog(page)).bubbles.map((b) => b.text);
            for (let i = 1; i < texts.length; i++) {
              expect(texts[i], `bubble ${i}`).not.toBe(texts[i - 1]);
            }
          };
          const saidElse = async () => {
            const texts = (await macLog(page)).bubbles.map((b) => b.text);
            return texts.at(-1) !== lines["mac.idle"];
          };
          const expected = (await idles()) + ((await saidElse()) ? 1 : 0);
          await page.keyboard.press("Shift");
          await page.clock.runFor(8_300);
          expect(await idles()).toBe(expected);
          await neverTwiceInARow();
          // Mac lands on a planet and says its line; the next period of rest
          // brings the rest line again, next to the Mac on screen.
          // (In real time: the flight follows the frames.)
          const clock = () => page.evaluate(() => performance.now());
          const scrolled = await clock();
          await toBlock(page, 1);
          await expect
            .poll(
              async () =>
                (await macLog(page)).bubbles.some((b) => b.text === arrive(1)),
              { timeout: 8_000 },
            )
            .toBe(true);
          const before = await idles();
          await page.clock.runFor(
            Math.max(0, scrolled + 7_700 - (await clock())),
          );
          expect(await idles()).toBe(before);
          await page.clock.runFor(600);
          expect(await idles()).toBe(before + 1);
          await expect(page.locator(BUBBLE)).toHaveText(lines["mac.idle"]);
          await neverTwiceInARow();
        });
      });
    }
  });

  test.describe(`${path}: reduced motion, no gaze, greeting or rest line`, () => {
    test.use({ ...DESKTOP, reducedMotion: "reduce" });

    test("Mac stays still and says nothing", async ({ page }) => {
      await page.clock.install();
      await simulate(page, { cores: 8, memory: 8 });
      await logMac(page);
      await page.goto(path);
      await page.clock.runFor(3_000);
      await page.mouse.move(40, 40, { steps: 5 });
      await page.clock.runFor(10_000);
      const log = await macLog(page);
      expect(log.greetStarts).toHaveLength(0);
      expect(log.bubbles).toHaveLength(0);
      expect((await gazeOf(page, HERO_MAC)).none).toBe(true);
      await expect(page.locator(TRAVELER)).toHaveCount(0);
    });
  });

  test.describe(`${path}: Mac's lines are not in the page (RF-27)`, () => {
    test("no bubble in the HTML, and the lines only in their data block", async ({
      request,
    }) => {
      const html = await (await request.get(path)).text();
      expect(html).not.toContain("data-mac-bubble");
      const data = html.match(
        /<script[^>]*\sid="mac-lines"[^>]*>[\s\S]*?<\/script>/,
      );
      expect(data).not.toBeNull();
      const rest = html.replace(data![0], "");
      for (const key of Object.keys(lines).filter((k) =>
        k.startsWith("mac."),
      )) {
        const text = lines[key as keyof typeof lines];
        expect(rest, key).not.toContain(text);
        // Also as JSON escapes it (accents, "<").
        expect(data![0]).toContain(
          JSON.stringify(text).slice(1, -1).replace(/</g, "\\u003c"),
        );
      }
    });
  });

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
            const a = analyse(await recordSteadyFlight(page, from, to));
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
          const samples = await recordSteadyFlight(page, 0, 1, {
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

    test("no travelling Mac, no active planet mark, no trail and no bubble", async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForTimeout(2500);
      for (const i of [0, 1, 2]) {
        await toBlock(page, i);
        await page.waitForTimeout(400);
      }
      await expect(page.locator(TRAVELER)).toHaveCount(0);
      await expect(page.locator(BUBBLE)).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
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

    test("a bubble on screen and the trail are removed too (RF-40)", async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForSelector(FX_ON, { timeout: 10_000 });
      await settleOn(page, 0);
      await toBlock(page, 1);
      // Take-off first: "not flying" alone also holds before he leaves.
      await expect(page.locator(FLYING)).toHaveCount(1, { timeout: 2_000 });
      await expect(page.locator(FLYING)).toHaveCount(0, { timeout: 6_000 });
      await expect(page.locator(BUBBLE)).toHaveCount(1, { timeout: 1_000 });
      const y = await page.evaluate(() => window.scrollY);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator(BUBBLE)).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.scrollY)).toBe(y);
    });
  });
}

// T22 (RF-28, RF-29): bursts and turbo mode.

/** Most particles alive at once in each class (RF-37). */
const CLASS_LIMIT = { low: 24, mid: 80, high: 160 } as const;
type Tier = keyof typeof CLASS_LIMIT;
const TURBO_MAX_MS = 1400;

/** One frame of the hero's Mac and the effects (window px). */
type HeroSample = {
  t: number;
  /** performance.now() when sampled, the clock of the marks. */
  pt: number;
  turbo: boolean;
  cx: number;
  cy: number;
  left: number;
  right: number;
  top: number;
  burstEmitted: number;
  particles: number;
  bubbles: number;
  overflow: number;
};

type HeroLog = {
  gestureOn: number[];
  gestureOff: number[];
  turboOn: number[];
  turboOff: number[];
  bubbles: { t: number; text: string }[];
  /** Pointer presses on the page, at their exact time. */
  presses: number[];
  samples: HeroSample[];
  recording: boolean;
};

/** Records the hero's Mac on every frame and his marks at their exact time. */
async function recordHero(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __hero?: HeroLog };
    if (w.__hero) w.__hero.recording = false;
    const log: HeroLog = {
      gestureOn: [],
      gestureOff: [],
      turboOn: [],
      turboOff: [],
      bubbles: [],
      presses: [],
      samples: [],
      recording: true,
    };
    w.__hero = log;
    const onPress = () => {
      if (!log.recording) return removeEventListener("pointerdown", onPress);
      log.presses.push(performance.now());
    };
    addEventListener("pointerdown", onPress, true);
    const mac = document.querySelector<HTMLElement>(".hero__mac")!;
    const root = document.documentElement;
    let gesture = mac.hasAttribute("data-mac-gesture");
    let turbo = mac.hasAttribute("data-mac-turbo");
    const marks = new MutationObserver(() => {
      if (!log.recording) return marks.disconnect();
      const now = performance.now();
      const g = mac.getAttribute("data-mac-gesture") === "playing";
      const tb = mac.getAttribute("data-mac-turbo") === "playing";
      if (g !== gesture) (g ? log.gestureOn : log.gestureOff).push(now);
      if (tb !== turbo) (tb ? log.turboOn : log.turboOff).push(now);
      gesture = g;
      turbo = tb;
    });
    marks.observe(mac, {
      attributes: true,
      attributeFilter: ["data-mac-gesture", "data-mac-turbo"],
    });
    const added = new MutationObserver((records) => {
      if (!log.recording) return added.disconnect();
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.dataset.macBubble === "") {
            log.bubbles.push({
              t: performance.now(),
              text: node.textContent ?? "",
            });
          }
        }
      }
    });
    added.observe(document.body, { childList: true });
    const tick = (now: number) => {
      if (!log.recording) return;
      document.dispatchEvent(new Event("fx:report"));
      const box = mac.getBoundingClientRect();
      log.samples.push({
        t: now,
        pt: performance.now(),
        turbo: mac.hasAttribute("data-mac-turbo"),
        cx: box.left + box.width / 2,
        cy: box.top + box.height / 2,
        left: box.left,
        right: box.right,
        top: box.top,
        burstEmitted: Number(root.dataset.fxBurstEmitted ?? Number.NaN),
        particles: Number(root.dataset.fxParticles ?? Number.NaN),
        bubbles: document.querySelectorAll("[data-mac-bubble]").length,
        overflow: root.scrollWidth - root.clientWidth,
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopHero(page: Page): Promise<HeroLog> {
  return page.evaluate(() => {
    const w = window as Window & { __hero?: HeroLog };
    w.__hero!.recording = false;
    return w.__hero!;
  });
}

/** Every text of the page but Mac's bubble (RF-28: no text changes). */
async function pageText(page: Page) {
  return page.evaluate(() =>
    [...document.body.children]
      .filter((el) => !el.matches("[data-mac-bubble], script, canvas"))
      .map((el) => el.textContent ?? "")
      .join("|"),
  );
}

type Press = "mouse" | "touch" | "Enter" | "Space";

/**
 * The hero's Mac in the middle of the window, the layer on, the greeting and
 * its bubble gone; returns how to press him.
 */
async function readyHero(page: Page, path: string, signals: Signals) {
  await simulate(page, signals);
  await page.goto(path);
  const mac = page.locator(HERO_MAC);
  await mac.evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await page.waitForSelector(FX_ON, { timeout: 10_000 });
  await expect(mac).toHaveAttribute("role", "button");
  await afterGreeting(page);
  await expect(page.locator(BUBBLE)).toHaveCount(0, { timeout: 4_000 });
  const box = (await mac.boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return async (how: Press) => {
    if (how === "mouse") await page.mouse.click(at.x, at.y);
    else if (how === "touch") await page.touchscreen.tap(at.x, at.y);
    else {
      await mac.focus();
      await page.keyboard.press(how);
    }
  };
}

/** Five presses, 250 ms apart (1 s in all: well inside the 3 s). */
async function fivePresses(press: (how: Press) => Promise<void>, how: Press) {
  for (let i = 0; i < 5; i++) {
    await press(how);
    if (i < 4) await new Promise((r) => setTimeout(r, 250));
  }
}

/** Longest frame of the hero's samples between two times (ms). */
function longestFrame(samples: HeroSample[], from: number, to: number) {
  let longest = 1000 / 60;
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i]!;
    if (s.t < from || samples[i - 1]!.t > to) continue;
    longest = Math.max(longest, s.t - samples[i - 1]!.t);
  }
  return longest;
}

/**
 * Burst particles emitted between two times (from the frame samples): from
 * the last frame sampled before `from` (or the first one of the recording)
 * to the first one sampled from `to` on (if the machine stalls after a press,
 * the next frame may come after `to`). Timed by when each frame was sampled,
 * the clock of the marks: Chrome handles a press inside a frame whose
 * timestamp was set before it.
 */
function emittedBetween(samples: HeroSample[], from: number, to: number) {
  const before =
    samples.filter((s) => s.pt < from).at(-1)?.burstEmitted ??
    samples[0]?.burstEmitted ??
    0;
  const after =
    samples.find((s) => s.pt >= to)?.burstEmitted ??
    samples.at(-1)?.burstEmitted ??
    before;
  return after - before;
}

/**
 * How much longer than its own time a GSAP animation lasts on the clock
 * between two times: a frame of over 500 ms counts as 33 ms for GSAP (its
 * default lag smoothing). 0 unless the machine stalled.
 */
function lagExtension(samples: HeroSample[], from: number, to: number) {
  let extra = 0;
  for (let i = 1; i < samples.length; i++) {
    const gap = samples[i]!.t - samples[i - 1]!.t;
    if (samples[i]!.t < from || samples[i - 1]!.t > to) continue;
    if (gap > 500) extra += gap - 33;
  }
  return extra;
}

const PRESS_CASES = [
  {
    name: "desktop, high class, mouse",
    use: DESKTOP,
    signals: { cores: 8, memory: 8 },
    tier: "high",
    press: "mouse",
  },
  {
    name: "desktop, middle class, Enter",
    use: DESKTOP,
    signals: { cores: 4, memory: 8 },
    tier: "mid",
    press: "Enter",
  },
  {
    name: "desktop, low class, Space",
    use: DESKTOP,
    signals: { cores: 8, saveData: true },
    tier: "low",
    press: "Space",
  },
  {
    name: "375 px phone, low class, touch",
    use: VIEWPORTS[1].use,
    signals: { cores: 8, memory: 8 },
    tier: "low",
    press: "touch",
  },
] as const satisfies readonly {
  name: string;
  use: object;
  signals: Signals;
  tier: Tier;
  press: Press;
}[];

for (const { path, locale } of homePages) {
  const lines = translations[locale];
  const pressLines: string[] = [
    lines["mac.click.1"],
    lines["mac.click.2"],
    lines["mac.click.3"],
  ];

  test.describe(`${path}: a press on Mac, a burst and a bubble (RF-28)`, () => {
    for (const item of PRESS_CASES) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("the 0.6 s gesture, a burst of 12 to 20 particles within the class limit and a bubble, with no text changed", async ({
          page,
        }) => {
          const press = await readyHero(page, path, item.signals);
          await expect(page.locator("html")).toHaveAttribute(
            "data-fx-tier",
            item.tier,
          );
          const text = await pageText(page);
          await recordHero(page);
          await page.waitForTimeout(100);
          await press(item.press);
          await page.waitForTimeout(1_300);
          const log = await stopHero(page);
          const on = log.gestureOn[0]!;
          const burst = emittedBetween(log.samples, on - 50, on + 200);
          console.log(
            `${path} ${item.name}: gesture ${Math.round((log.gestureOff[0] ?? Number.NaN) - on)} ms ` +
              `(longest frame ${Math.round(longestFrame(log.samples, on - 200, on + 800))} ms), ` +
              `burst of ${burst}, up to ${Math.max(...log.samples.map((s) => s.particles))} particles alive, ` +
              `bubble "${log.bubbles[0]?.text}" at +${Math.round((log.bubbles[0]?.t ?? Number.NaN) - on)} ms`,
          );
          // The gesture of spec 004, once: 0.6 s, give or take a frame at
          // each end (its timeline starts at the last frame's time and ends
          // on the first frame past it; a busy CPU stretches them).
          expect(log.gestureOn).toHaveLength(1);
          expect(log.gestureOff).toHaveLength(1);
          const ms = log.gestureOff[0]! - on;
          const frame = longestFrame(log.samples, on - 200, on + 800);
          expect(ms).toBeGreaterThanOrEqual(600 - Math.max(20, frame));
          expect(ms).toBeLessThanOrEqual(600 + Math.max(100, frame + 40));
          // The burst: 12 to 20, never past the class limit.
          expect(burst).toBeGreaterThanOrEqual(12);
          expect(burst).toBeLessThanOrEqual(20);
          for (const s of log.samples) {
            expect(s.particles).toBeLessThanOrEqual(CLASS_LIMIT[item.tier]);
            expect(s.bubbles).toBeLessThanOrEqual(1);
            expect(s.overflow).toBeLessThanOrEqual(0);
          }
          // One of his press lines, with the press.
          expect(log.bubbles).toHaveLength(1);
          expect(pressLines).toContain(log.bubbles[0]!.text);
          expect(Math.abs(log.bubbles[0]!.t - on)).toBeLessThan(100);
          expect(log.turboOn).toHaveLength(0);
          // No text of the page changes or goes.
          expect(await pageText(page)).toBe(text);
        });
      });
    }

    test.describe("desktop, high class, many presses", () => {
      test.use(DESKTOP);

      test("four quick presses play one gesture, one burst and one bubble", async ({
        page,
      }) => {
        const press = await readyHero(page, path, { cores: 8, memory: 8 });
        let log: HeroLog | undefined;
        // The four must land while the first gesture plays (0.6 s): a busy
        // machine can spread them past it, and then a fifth or later press
        // rightly plays a gesture of its own. Pressed again in that case,
        // more than 3 s later (so they never add up to turbo mode).
        for (let attempt = 1; attempt <= 3; attempt++) {
          await recordHero(page);
          await page.waitForTimeout(100);
          for (let i = 0; i < 4; i++) {
            await press("mouse");
            await page.waitForTimeout(120);
          }
          await page.waitForTimeout(1_200);
          log = await stopHero(page);
          const span = log.presses.at(-1)! - log.presses[0]!;
          if (log.presses.length === 4 && span < 600 - 100) break;
          console.log(
            `${path} 4 quick presses spread over ${Math.round(span)} ms; pressing again`,
          );
          await page.waitForTimeout(3_200);
        }
        log = log!;
        const burst = emittedBetween(log.samples, 0, Number.POSITIVE_INFINITY);
        console.log(
          `${path} 4 quick presses: ${log.gestureOn.length} gesture(s), burst of ${burst}, ${log.bubbles.length} bubble(s)`,
        );
        expect(log.gestureOn).toHaveLength(1);
        expect(log.gestureOff).toHaveLength(1);
        expect(burst).toBeGreaterThanOrEqual(12);
        expect(burst).toBeLessThanOrEqual(20);
        expect(log.bubbles).toHaveLength(1);
        expect(Math.max(...log.samples.map((s) => s.bubbles))).toBe(1);
        expect(log.turboOn).toHaveLength(0);
      });
    });
  });

  test.describe(`${path}: turbo mode (RF-29)`, () => {
    test.describe.configure({ timeout: 60_000 });

    for (const item of [PRESS_CASES[0], PRESS_CASES[1], PRESS_CASES[3]]) {
      test.describe(item.name, () => {
        test.use(item.use);

        test("5 presses in 3 s: an arc across the window in at most 1.4 s, a burst of at least 60 within the class limit and the turbo line; not again for 10 s", async ({
          page,
        }) => {
          const width = item.use.viewport.width;
          const mac = page.locator(HERO_MAC);
          const press = await readyHero(page, path, item.signals);
          const text = await pageText(page);
          await recordHero(page);
          await page.waitForTimeout(100);
          await fivePresses(press, item.press);
          await expect(mac).toHaveAttribute("data-mac-turbo", "playing", {
            timeout: 500,
          });
          await page.waitForTimeout(TURBO_MAX_MS + 300);
          let log = await stopHero(page);
          const on = log.turboOn[0]!;
          const off = log.turboOff[0]!;
          const turboSamples = log.samples.filter((s) => s.turbo);
          const home = log.samples.filter((s) => s.pt < on).at(-1)!;
          const far = turboSamples.reduce((a, b) =>
            Math.abs(b.cx - home.cx) > Math.abs(a.cx - home.cx) ? b : a,
          );
          const burst = emittedBetween(log.samples, on - 20, on + 100);
          const limit = CLASS_LIMIT[item.tier];
          const rise = home.cy - Math.min(...turboSamples.map((s) => s.cy));
          console.log(
            `${path} ${item.name}: turbo ${Math.round(off - on)} ms, ` +
              `centre ${Math.round(home.cx)} -> ${Math.round(far.cx)} of ${width} px, up ${Math.round(rise)} px, ` +
              `burst of ${burst} (limit ${limit}), up to ${Math.max(...log.samples.map((s) => s.particles))} alive, ` +
              `bubbles ${log.bubbles.map((b) => `"${b.text}"`).join(", ")}`,
          );
          expect(log.turboOn).toHaveLength(1);
          expect(log.turboOff).toHaveLength(1);
          expect(off - on).toBeGreaterThan(0);
          expect(off - on).toBeLessThanOrEqual(
            TURBO_MAX_MS + lagExtension(log.samples, on, off),
          );
          // Across the window: from one half to the other, in an arc.
          expect(Math.sign(far.cx - width / 2)).not.toBe(
            Math.sign(home.cx - width / 2),
          );
          expect(Math.abs(far.cx - home.cx)).toBeGreaterThanOrEqual(
            0.2 * width,
          );
          expect(rise).toBeGreaterThan(10);
          for (const s of log.samples) {
            expect(s.left).toBeGreaterThanOrEqual(0);
            expect(s.right).toBeLessThanOrEqual(width);
            expect(s.top).toBeGreaterThanOrEqual(0);
            expect(s.overflow).toBeLessThanOrEqual(0);
            expect(s.particles).toBeLessThanOrEqual(limit);
            expect(s.bubbles).toBeLessThanOrEqual(1);
          }
          // A burst of at least 60, or as many as the class allows.
          expect(burst).toBeGreaterThanOrEqual(Math.min(60, limit));
          expect(burst).toBeLessThanOrEqual(limit);
          // The turbo line, said once, as he sets off.
          const turboLines = log.bubbles.filter(
            (b) => b.text === lines["mac.turbo"],
          );
          expect(turboLines).toHaveLength(1);
          expect(Math.abs(turboLines[0]!.t - on)).toBeLessThan(100);
          // Home again: only the gaze (if any) is left.
          const after = await gazeOf(page, HERO_MAC);
          expect(Math.abs(after.rot)).toBeLessThanOrEqual(6.01);
          expect(Math.hypot(after.x, after.y)).toBeLessThanOrEqual(8.01);
          expect(await mac.evaluate((el) => getComputedStyle(el).scale)).toBe(
            "none",
          );
          expect(await pageText(page)).toBe(text);

          // Five more presses within the 10 s: no turbo.
          await recordHero(page);
          await fivePresses(press, item.press);
          await page.waitForTimeout(TURBO_MAX_MS);
          log = await stopHero(page);
          expect(log.turboOn).toHaveLength(0);
          // Once the 10 s are over, five presses set it off again.
          const since = await page.evaluate((t) => performance.now() - t, on);
          await page.waitForTimeout(Math.max(0, 10_100 - since));
          await recordHero(page);
          await fivePresses(press, item.press);
          await expect(mac).toHaveAttribute("data-mac-turbo", "playing", {
            timeout: 500,
          });
          // Its length was checked above, on the exact marks; here it only
          // has to end (seen from the test, with room for a busy machine).
          await expect(mac).not.toHaveAttribute("data-mac-turbo", /.*/, {
            timeout: TURBO_MAX_MS + 3_000,
          });
          log = await stopHero(page);
          expect(log.turboOn).toHaveLength(1);
        });
      });
    }

    test.describe("at rest after a burst and after turbo mode (RF-39)", () => {
      for (const item of [PRESS_CASES[0], PRESS_CASES[3]]) {
        test.describe(item.name, () => {
          test.use(item.use);

          test("at most 2 requestAnimationFrame calls in 2 s", async ({
            page,
          }) => {
            await page.addInitScript(() => {
              const w = window as Window & {
                __rafCalls?: number;
                __stars?: [number, number][];
              };
              const original = window.requestAnimationFrame.bind(window);
              w.__rafCalls = 0;
              window.requestAnimationFrame = (callback) => {
                w.__rafCalls!++;
                return original(callback);
              };
              // Shooting stars (RF-4) are an effect in progress of their own:
              // a count that overlaps one is taken again.
              w.__stars = [];
              const open = new Map<number, [number, number]>();
              document.addEventListener("fx:shooting-star", (event) => {
                const { phase, id } = (
                  event as CustomEvent<{ phase: string; id: number }>
                ).detail;
                const now = performance.now();
                if (phase === "start") {
                  const span: [number, number] = [now, Infinity];
                  open.set(id, span);
                  w.__stars!.push(span);
                } else {
                  const span = open.get(id);
                  if (span) span[1] = now;
                  open.delete(id);
                }
              });
            });
            const mac = page.locator(HERO_MAC);
            const press = await readyHero(page, path, item.signals);
            const calls = () =>
              page.evaluate(
                () => (window as Window & { __rafCalls?: number }).__rafCalls!,
              );
            const clock = () => page.evaluate(() => performance.now());
            const starBetween = (from: number, to: number) =>
              page.evaluate(
                ([a, b]) =>
                  (
                    (window as Window & { __stars?: [number, number][] })
                      .__stars ?? []
                  ).some(([start, end]) => start < b! && end > a!),
                [from, to],
              );
            const quiet = async (label: string) => {
              await page.waitForTimeout(2_500);
              for (let attempt = 0; ; attempt++) {
                const from = await clock();
                const before = await calls();
                await page.waitForTimeout(2_000);
                const during = (await calls()) - before;
                const star = await starBetween(from - 50, await clock());
                console.log(
                  `${path} ${item.name}: ${during} rAF calls in 2 s at rest after ${label}` +
                    (star ? " (a shooting star: again)" : ""),
                );
                if (star && attempt < 3) {
                  // A new period of rest, so the rest line (8 s without
                  // interaction, RF-27) does not come in the next count.
                  await page.keyboard.press("Shift");
                  await page.waitForTimeout(2_500);
                  continue;
                }
                expect(star, `${label}: a shooting star each time`).toBe(false);
                expect(during, label).toBeLessThanOrEqual(2);
                break;
              }
            };
            await press(item.press);
            await quiet("a burst");
            await fivePresses(press, item.press);
            await expect(mac).toHaveAttribute("data-mac-turbo", "playing", {
              timeout: 500,
            });
            // Its length is checked in the turbo test, on the exact marks;
            // here it only has to end (room for a busy machine).
            await expect(mac).not.toHaveAttribute("data-mac-turbo", /.*/, {
              timeout: TURBO_MAX_MS + 3_000,
            });
            await quiet("turbo mode");
          });
        });
      }
    });
  });

  // T23 (R3 review): a tap on Mac showed the browser's tap highlight, a
  // translucent blue square that turned with him in turbo mode. He has none,
  // and keeps the visible keyboard focus of spec 004.
  test.describe(`${path}: no tap highlight on Mac, a visible keyboard focus (RF-28)`, () => {
    test.use(VIEWPORTS[1].use);

    test("the hero's Mac has a transparent tap highlight and an outline on keyboard focus", async ({
      page,
    }) => {
      const press = await readyHero(page, path, { cores: 8, memory: 8 });
      const mac = page.locator(HERO_MAC);
      const highlight = () =>
        mac.evaluate((el) =>
          getComputedStyle(el).getPropertyValue("-webkit-tap-highlight-color"),
        );
      expect(await highlight()).toBe("rgba(0, 0, 0, 0)");
      // From the keyboard (before any tap): Tab until Mac has the focus.
      let focused = false;
      for (let i = 0; i < 30 && !focused; i++) {
        await page.keyboard.press("Tab");
        focused = await mac.evaluate((el) => el === document.activeElement);
      }
      expect(focused).toBe(true);
      const ring = await mac.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          visible: el.matches(":focus-visible"),
          style: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
        };
      });
      expect(ring.visible).toBe(true);
      expect(ring.style).toBe("solid");
      expect(ring.width).toBeGreaterThanOrEqual(2);
      // A tap: still no highlight.
      await mac.evaluate((el) => (el as HTMLElement).blur());
      await press("touch");
      expect(await highlight()).toBe("rgba(0, 0, 0, 0)");
    });
  });

  test.describe(`${path}: reduced motion, no burst and no turbo (RF-40)`, () => {
    test.use({ ...DESKTOP, reducedMotion: "reduce" });

    test("presses on Mac do nothing", async ({ page }) => {
      await page.goto(path);
      await page.waitForTimeout(2_500);
      const mac = page.locator(HERO_MAC);
      const box = (await mac.boundingBox())!;
      for (let i = 0; i < 6; i++) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(150);
      }
      await page.waitForTimeout(300);
      await expect(mac).not.toHaveAttribute("data-mac-gesture", /.*/);
      await expect(mac).not.toHaveAttribute("data-mac-turbo", /.*/);
      await expect(page.locator(BUBBLE)).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
      expect((await gazeOf(page, HERO_MAC)).none).toBe(true);
    });
  });

  test.describe(`${path}: reduced motion mid-turbo (RF-40)`, () => {
    test.use(DESKTOP);

    test("turbo mode, its bubble and its particles go without moving the page", async ({
      page,
    }) => {
      const press = await readyHero(page, path, { cores: 8, memory: 8 });
      const mac = page.locator(HERO_MAC);
      await fivePresses(press, "mouse");
      await expect(mac).toHaveAttribute("data-mac-turbo", "playing", {
        timeout: 500,
      });
      await page.waitForTimeout(300);
      const y = await page.evaluate(() => window.scrollY);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(mac).not.toHaveAttribute("data-mac-turbo", /.*/);
      await expect(page.locator(BUBBLE)).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
      for (const el of [mac, page.locator(".hero__mac-wrap")]) {
        const style = await el.evaluate((e) => {
          const s = e as HTMLElement;
          const c = getComputedStyle(s);
          return [c.translate, c.rotate, c.scale, c.transform, s.style.cssText];
        });
        expect(style.slice(0, 4)).toEqual(["none", "none", "none", "none"]);
        expect(style[4]).not.toMatch(/translate|rotate|scale|origin/);
      }
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.scrollY)).toBe(y);
    });
  });
}
