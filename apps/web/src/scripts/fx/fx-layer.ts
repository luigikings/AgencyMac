import { nextCosts, shouldDegrade, tierDown } from "../../lib/fx/device-tier";
import { TIER_PARAMS, type FxTier } from "../../lib/fx/fx-config";
import { FINE_POINTER_QUERY } from "../../lib/motion/motion-config";
import { scrollParallax } from "../../lib/sky/parallax";
import { mulberry32 } from "../../lib/sky/rng";
import type { Traveler } from "../motion/home-motion";
import type { ScrollHub } from "../motion/scroll-hub";
import { createBubbles } from "./bubbles";
import { createFxCanvas, type FxCanvas } from "./canvas";
import { cursorTrail, type CursorReport } from "./cursor-trail";
import {
  macBursts,
  macFlight,
  macReactions,
  type BurstReport,
  type TrailReport,
} from "./mac-fx";
import { hyperjump, type JumpReport } from "./hyperjump";
import { journey } from "./journey";
import { planetFx } from "./planet-fx";
import { shootingStars } from "./shooting-stars";

// Effects layer of the home page (spec 005, plan section 2). Downloaded by the
// animation core only when the device class is not "off" (so never with
// reduced motion). It holds no rules of its own: the maths lives in
// src/lib/sky and src/lib/fx. Everything it changes is undone by the function
// startFx returns, which the core calls when motion becomes reduced mid-visit
// (RF-40). Only `transform` is written, so nothing is ever hidden (RF-41).

type Cleanup = () => void;
/** Called when the tab becomes hidden and when it is visible again. */
type Hooks = { onHide: Cleanup[]; onShow: Cleanup[] };

/**
 * What the animation core hands to the effects (plan 14.1 and 14.6): the
 * single scroll handler and the travelling Mac, if there is one.
 */
export type FxCore = { hub: ScrollHub; traveler: Traveler | null };

// RF-2: the first `count` star layers (far, middle, near) travel their range
// over the whole page; the rest stay still. They follow the core's single
// scroll handler (plan section 5).
function starParallax(hub: ScrollHub, count: number): Cleanup {
  const layers = [...document.querySelectorAll<HTMLElement>(".sky__layer")]
    .slice(0, count)
    .map((el) => ({ el, range: Number(el.dataset.parallaxVh) || 0 }));
  if (layers.length === 0) return () => {};
  const remove = hub.add(({ progress }) => {
    for (const { el, range } of layers) {
      // Up while the page goes down: the layer starts half its range low.
      el.style.transform = `translate3d(0,${-scrollParallax(progress, range)}vh,0)`;
    }
  });
  return () => {
    remove();
    layers.forEach(({ el }) => el.style.removeProperty("transform"));
  };
}

// RF-15: the hero and each planet block get `data-offscreen` while they are
// out of the window (with a margin of 10 %), and the CSS pauses every
// animation inside them.
function pauseOffscreen(): Cleanup {
  const blocks = [
    ...document.querySelectorAll<HTMLElement>("#hero, .service[data-planet]"),
  ];
  if (blocks.length === 0 || !("IntersectionObserver" in window)) {
    return () => {};
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        if (entry.isIntersecting) target.removeAttribute("data-offscreen");
        else target.setAttribute("data-offscreen", "");
      }
    },
    { rootMargin: "10% 0px" },
  );
  blocks.forEach((block) => observer.observe(block));
  return () => {
    observer.disconnect();
    blocks.forEach((block) => block.removeAttribute("data-offscreen"));
  };
}

// RF-39: with the tab hidden, `data-fx-paused` on <html> stands every CSS
// animation still and the frame loops stop.
function pauseWhenHidden(hooks: Hooks): Cleanup {
  const root = document.documentElement;
  const apply = () => {
    if (document.hidden) {
      root.setAttribute("data-fx-paused", "");
      hooks.onHide.forEach((hook) => hook());
    } else {
      root.removeAttribute("data-fx-paused");
      hooks.onShow.forEach((hook) => hook());
    }
  };
  document.addEventListener("visibilitychange", apply);
  apply();
  return () => {
    document.removeEventListener("visibilitychange", apply);
    root.removeAttribute("data-fx-paused");
  };
}

/**
 * Starts the effects of the tier and watches their own cost per frame
 * (RF-38): over DEGRADE_LIMIT_MS on average for DEGRADE_WINDOW_FRAMES frames
 * in a row, every effect is removed and started again one class down, with
 * its limits at once (`data-fx-tier` changes). It never goes back up during
 * the visit. Returns the function that removes whatever is running.
 */
export function startFx(tier: FxTier, core: FxCore): Cleanup {
  const root = document.documentElement;
  let current = tier;
  let costs: number[] = [];
  let timer = 0;
  let stop: Cleanup = () => {};
  const onFrame = (costMs: number, goesOn: boolean) => {
    if (timer) return;
    const recent = nextCosts(costs, costMs, true);
    costs = goesOn ? recent : [];
    const lower = tierDown(current);
    if (lower === current || !shouldDegrade(recent)) return;
    // Out of the frame being drawn: the canvas itself is replaced.
    timer = window.setTimeout(() => {
      timer = 0;
      costs = [];
      stop();
      current = lower;
      root.dataset.fxTier = lower;
      stop = startTier(lower, core, onFrame);
    });
  };
  stop = startTier(tier, core, onFrame);
  return () => {
    window.clearTimeout(timer);
    timer = 0;
    stop();
  };
}

/** Starts the effects of the tier; returns the function that removes them. */
function startTier(
  tier: FxTier,
  { hub, traveler }: FxCore,
  onFrame: (costMs: number, goesOn: boolean) => void,
): Cleanup {
  const root = document.documentElement;
  const params = TIER_PARAMS[tier];
  const hooks: Hooks = { onHide: [], onShow: [] };
  const rng = mulberry32(visitSeed());

  const cleanups: Cleanup[] = [
    pauseOffscreen(),
    pauseWhenHidden(hooks),
    starParallax(hub, params.scrollParallaxLayers),
    // RF-30: the journey indicator, in every class.
    journey(hub),
  ];
  // Without 2D drawing there is no canvas, and the effects drawn on it are
  // simply left out (RF-41).
  const canvas = createFxCanvas(
    params.canvasDensity,
    params.maxParticles,
    onFrame,
  );
  if (canvas) hooks.onHide.push(canvas.halt);
  // RF-27: Mac's single bubble. It goes with the tab hidden or a new layout
  // (its place was measured on the old one).
  const bubbles = createBubbles(rng);
  hooks.onHide.push(bubbles.clear);
  cleanups.push(hub.onLayout(bubbles.clear), bubbles.stop);
  // RF-21 to RF-24: Mac flies along a curve between planets, in every class,
  // with his trail, the bounce on landing and the planet's line.
  // RF-25 to RF-27: the gaze (fine pointer, middle and high class), the
  // greeting after the hero's landing and the rest line (every class).
  // RF-28, RF-29: bursts and turbo mode when the hero's Mac is pressed.
  const bursts = macBursts({ canvas, tier, rng });
  if (bursts) cleanups.push(bursts.stop);
  const finePointer =
    params.pointerEffects && window.matchMedia(FINE_POINTER_QUERY).matches;
  const reactions = macReactions({
    heroMac: document.querySelector<HTMLElement>(".hero__mac"),
    traveler: traveler?.img ?? null,
    bubbles,
    bursts,
    gaze: finePointer,
    hooks,
  });
  cleanups.push(reactions.stop);
  let trail: (() => TrailReport) | null = null;
  if (traveler) {
    const flight = macFlight({
      traveler,
      canvas,
      tier,
      rng,
      bubbles,
      onTakeOff: () => reactions.letGo(traveler.img),
    });
    trail = flight.report;
    cleanups.push(flight.stop);
  }
  // RF-13, RF-14: planets that follow the cursor, grow and spark under it.
  if (finePointer) {
    cleanups.push(planetFx({ canvas, tier, rng, hooks }));
  }
  // RF-32: the cursor trail (high class with a fine pointer).
  const cursor =
    canvas && finePointer ? cursorTrail({ canvas, tier, rng }) : null;
  if (cursor) cleanups.push(cursor.stop);
  // RF-31: the space jump on the links to a section (middle and high class).
  const jump = canvas ? hyperjump({ canvas, tier, rng, hub }) : null;
  if (jump) cleanups.push(jump.stop);
  if (canvas) {
    cleanups.push(shootingStars({ canvas, tier, rng, hooks }), canvas.stop);
  }
  cleanups.push(
    frameReport(
      canvas,
      trail,
      bursts?.report ?? null,
      jump?.report ?? null,
      cursor?.report ?? null,
    ),
  );
  root.dataset.fx = "on";

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    delete root.dataset.fx;
  };
}

// Seed of the random effects: `?seed=` in the address (for the tests, so a
// run repeats), otherwise the time of the visit.
function visitSeed(): number {
  const param = new URLSearchParams(window.location.search).get("seed");
  const seed = param === null ? NaN : Number(param);
  return Number.isFinite(seed) ? seed : Date.now();
}

// Plan section 4, `fx:report`: on that event the frames drawn, the mean and
// p95 own cost per frame (ms) and the live particles are written on <html>
// (data-fx-frames, data-fx-frame-avg, data-fx-frame-p95, data-fx-particles),
// and Mac's trail: particles emitted so far and alive now
// (data-fx-trail-emitted, data-fx-trail-alive), and Mac's bursts: particles
// emitted so far and alive now (data-fx-burst-emitted, data-fx-burst-alive),
// and the last space jump: most streaks at once and the least and most length
// over speed of the streaks below the cap (data-fx-jump-streaks,
// data-fx-jump-ratio-min, data-fx-jump-ratio-max), and the cursor trail:
// particles emitted so far and alive now (data-fx-cursor-emitted,
// data-fx-cursor-alive).
// Only the tests ask for it.
function frameReport(
  canvas: FxCanvas | null,
  trail: (() => TrailReport) | null,
  bursts: (() => BurstReport) | null,
  jump: (() => JumpReport) | null,
  cursor: (() => CursorReport) | null,
): Cleanup {
  const root = document.documentElement;
  const write = () => {
    const report = canvas?.report() ?? {
      frames: 0,
      avg: 0,
      p95: 0,
      particles: 0,
    };
    root.dataset.fxFrames = String(report.frames);
    root.dataset.fxFrameAvg = String(report.avg);
    root.dataset.fxFrameP95 = String(report.p95);
    root.dataset.fxParticles = String(report.particles);
    const { emitted, alive } = trail?.() ?? { emitted: 0, alive: 0 };
    root.dataset.fxTrailEmitted = String(emitted);
    root.dataset.fxTrailAlive = String(alive);
    const burst = bursts?.() ?? { emitted: 0, alive: 0 };
    root.dataset.fxBurstEmitted = String(burst.emitted);
    root.dataset.fxBurstAlive = String(burst.alive);
    const leap = jump?.() ?? { streaks: 0, ratioMin: 0, ratioMax: 0 };
    root.dataset.fxJumpStreaks = String(leap.streaks);
    root.dataset.fxJumpRatioMin = String(leap.ratioMin);
    root.dataset.fxJumpRatioMax = String(leap.ratioMax);
    const trace = cursor?.() ?? { emitted: 0, alive: 0 };
    root.dataset.fxCursorEmitted = String(trace.emitted);
    root.dataset.fxCursorAlive = String(trace.alive);
  };
  document.addEventListener("fx:report", write);
  return () => {
    document.removeEventListener("fx:report", write);
    delete root.dataset.fxFrames;
    delete root.dataset.fxFrameAvg;
    delete root.dataset.fxFrameP95;
    delete root.dataset.fxParticles;
    delete root.dataset.fxTrailEmitted;
    delete root.dataset.fxTrailAlive;
    delete root.dataset.fxBurstEmitted;
    delete root.dataset.fxBurstAlive;
    delete root.dataset.fxJumpStreaks;
    delete root.dataset.fxJumpRatioMin;
    delete root.dataset.fxJumpRatioMax;
    delete root.dataset.fxCursorEmitted;
    delete root.dataset.fxCursorAlive;
  };
}
