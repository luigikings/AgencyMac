import { TIER_PARAMS, type FxTier } from "../../lib/fx/fx-config";
import { FINE_POINTER_QUERY } from "../../lib/motion/motion-config";
import { scrollParallax } from "../../lib/sky/parallax";
import { mulberry32 } from "../../lib/sky/rng";
import type { ScrollHub } from "../motion/scroll-hub";
import { createFxCanvas, type FxCanvas } from "./canvas";
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

/** What the animation core hands to the effects (plan 14.1). */
export type FxCore = { hub: ScrollHub };

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

/** Starts the effects of the tier; returns the function that removes them. */
export function startFx(tier: FxTier, { hub }: FxCore): Cleanup {
  const root = document.documentElement;
  const params = TIER_PARAMS[tier];
  const hooks: Hooks = { onHide: [], onShow: [] };
  const rng = mulberry32(visitSeed());

  const cleanups: Cleanup[] = [
    pauseOffscreen(),
    pauseWhenHidden(hooks),
    starParallax(hub, params.scrollParallaxLayers),
  ];
  // Without 2D drawing there is no canvas, and the effects drawn on it are
  // simply left out (RF-41).
  const canvas = createFxCanvas(params.canvasDensity);
  if (canvas) hooks.onHide.push(canvas.halt);
  // RF-13, RF-14: planets that follow the cursor, grow and spark under it.
  if (params.pointerEffects && window.matchMedia(FINE_POINTER_QUERY).matches) {
    cleanups.push(planetFx({ canvas, tier, rng, hooks }));
  }
  if (canvas) {
    cleanups.push(shootingStars({ canvas, tier, rng, hooks }), canvas.stop);
  }
  cleanups.push(frameReport(canvas));
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
// (data-fx-frames, data-fx-frame-avg, data-fx-frame-p95, data-fx-particles).
// Only the tests ask for it.
function frameReport(canvas: FxCanvas | null): Cleanup {
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
  };
  document.addEventListener("fx:report", write);
  return () => {
    document.removeEventListener("fx:report", write);
    delete root.dataset.fxFrames;
    delete root.dataset.fxFrameAvg;
    delete root.dataset.fxFrameP95;
    delete root.dataset.fxParticles;
  };
}
