import {
  rgbaOf,
  shootingStarFrame,
  shootingStarPath,
} from "../../lib/fx/canvas-math";
import {
  SHOOTING_STAR_WIDTH_PX,
  TIER_PARAMS,
  type FxTier,
} from "../../lib/fx/fx-config";
import {
  canSpawnShootingStar,
  nextShootingStarDelay,
  shootingStarDuration,
} from "../../lib/fx/scheduler";
import type { Rng } from "../../lib/sky/rng";
import type { FxCanvas, Painter } from "./canvas";

// Shooting stars (spec 005, RF-4): in the middle class one at a time every 12
// to 24 s, in the high class up to two at a time every 8 to 16 s, none in the
// low class. Each lasts 0.6 to 1.2 s. The next one is a timer, never a frame
// loop, so between stars nothing runs (RF-39). With the tab hidden the timer
// stops and the stars in flight are dropped; a new wait starts on coming
// back. Every start and end is announced with the `fx:shooting-star` event
// on the document ({ phase, id, ms }), which only the tests listen to.

type Star = {
  id: number;
  path: ReturnType<typeof shootingStarPath>;
  ms: number;
  start: number;
};

type Cleanup = () => void;

function announce(phase: "start" | "end", star: Star) {
  document.dispatchEvent(
    new CustomEvent("fx:shooting-star", {
      detail: { phase, id: star.id, ms: star.ms },
    }),
  );
}

/** Colour of the stars: the text token, as the canvas reads it. */
function starColor(ctx: CanvasRenderingContext2D): string {
  const token = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-text")
    .trim();
  if (!token) return "";
  ctx.fillStyle = token;
  return String(ctx.fillStyle);
}

export function shootingStars(options: {
  canvas: FxCanvas;
  tier: FxTier;
  rng: Rng;
  hooks: { onHide: Cleanup[]; onShow: Cleanup[] };
}): Cleanup {
  const { canvas, tier, rng, hooks } = options;
  if (TIER_PARAMS[tier].shootingStarsMax === 0) return () => {};

  const stars: Star[] = [];
  let ids = 0;
  let timer = 0;
  let color: string | undefined;

  const painter: Painter = {
    draw(ctx, now, mark) {
      if (color === undefined) color = starColor(ctx);
      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i]!;
        const elapsed = now - star.start;
        if (elapsed >= star.ms) {
          stars.splice(i, 1);
          announce("end", star);
          continue;
        }
        const f = shootingStarFrame(star.path, elapsed, star.ms);
        const head = rgbaOf(color, f.alpha);
        const tail = rgbaOf(color, 0);
        if (!head || !tail) continue;
        const gradient = ctx.createLinearGradient(
          f.tailX,
          f.tailY,
          f.headX,
          f.headY,
        );
        gradient.addColorStop(0, tail);
        gradient.addColorStop(1, head);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = SHOOTING_STAR_WIDTH_PX;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(f.tailX, f.tailY);
        ctx.lineTo(f.headX, f.headY);
        ctx.stroke();
        mark(f.tailX, f.tailY, f.headX, f.headY);
      }
      return stars.length > 0;
    },
    clear() {
      for (const star of stars.splice(0)) announce("end", star);
    },
  };
  canvas.add(painter);

  const launch = () => {
    timer = 0;
    if (canSpawnShootingStar(stars.length, tier)) {
      const star: Star = {
        id: ++ids,
        path: shootingStarPath(rng, canvas.view()),
        ms: shootingStarDuration(rng),
        start: performance.now(),
      };
      stars.push(star);
      announce("start", star);
      canvas.wake();
    }
    schedule();
  };
  const schedule = () => {
    window.clearTimeout(timer);
    const delay = nextShootingStarDelay(rng, tier);
    timer = Number.isFinite(delay) ? window.setTimeout(launch, delay) : 0;
  };
  const pause = () => {
    window.clearTimeout(timer);
    timer = 0;
  };

  hooks.onHide.push(pause);
  hooks.onShow.push(schedule);
  if (!document.hidden) schedule();
  return () => {
    pause();
    painter.clear();
  };
}
