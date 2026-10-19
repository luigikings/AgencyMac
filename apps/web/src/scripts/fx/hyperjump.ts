import { rgbaOf } from "../../lib/fx/canvas-math";
import {
  JUMP_ALPHA,
  JUMP_DRIFT_RATIO,
  JUMP_STREAK_WIDTH_PX,
  STREAK_LENGTH_PER_SPEED,
  STREAK_MAX_LENGTH_PX,
  TIER_PARAMS,
  type FxTier,
} from "../../lib/fx/fx-config";
import {
  jumpDurationMs,
  jumpEnvelope,
  streakCountFor,
  streakLines,
} from "../../lib/fx/streaks";
import { mulberry32, type Rng } from "../../lib/sky/rng";
import type { ScrollHub } from "../motion/scroll-hub";
import { toneValues, type FxCanvas, type Painter } from "./canvas";

// Space jump (spec 005, RF-31, RNF-10). In the middle and high class, a click
// (or Enter) on a link to a section (the navigation, "Quiero despegar",
// "Descubre cómo") draws stars stretched along the scroll on the effects
// canvas while the page travels: as long as the speed of the scroll (from
// smooth scrolling while its loop runs, otherwise from the scroll handler's
// positions, plan 14.6), 40 or 80 at most, with one soft rise and fall of at
// most 0.9 s. `data-jump="playing"` on <html> marks it. It only listens: the
// click goes on to the browser and to smooth scrolling untouched, so the
// arrival is never held back. Loading with an anchor in the address is not a
// click, so it never jumps. The frames run on the canvas' loop, which stops
// when the jump ends (RF-39).

type Cleanup = () => void;

/** The links that set off a jump. */
const JUMP_LINKS =
  '.site-header__nav a[href^="#"], a.cta[href^="#"], a.hero__discover[href^="#"]';
/** A section closer than this (px) is no journey: no jump. */
const MIN_DISTANCE_PX = 2;

type Jump = {
  start: number;
  ms: number;
  seed: number;
  fromY: number;
};

/** For the tests (`fx:report`): most streaks at once, length over speed. */
export type JumpReport = {
  streaks: number;
  ratioMin: number;
  ratioMax: number;
};

export function hyperjump(options: {
  canvas: FxCanvas;
  tier: FxTier;
  rng: Rng;
  hub: ScrollHub;
}): { stop: Cleanup; report: () => JumpReport } | null {
  const { canvas, tier, rng, hub } = options;
  if (TIER_PARAMS[tier].jumpStreaksMax <= 0) return null;
  const root = document.documentElement;
  let jump: Jump | null = null;
  let color: string | undefined;
  let stats: JumpReport = { streaks: 0, ratioMin: 0, ratioMax: 0 };

  const end = () => {
    jump = null;
    root.removeAttribute("data-jump");
  };

  const painter: Painter = {
    draw(ctx, now, mark) {
      if (!jump) return false;
      const elapsed = now - jump.start;
      if (elapsed >= jump.ms) {
        end();
        return false;
      }
      color ??= toneValues(ctx, ["text"])[0] ?? "";
      const strength = jumpEnvelope(elapsed, jump.ms);
      const velocity = hub.velocity();
      const speed = Math.abs(velocity);
      const count = streakCountFor(tier, speed);
      const view = canvas.view();
      const stroke = rgbaOf(color, JUMP_ALPHA * strength);
      if (count === 0 || !stroke || view.height <= 0) return true;
      // The same streaks every frame (same seed), drifting against the
      // scroll; only their length follows the speed.
      const lines = streakLines(
        count,
        { x: 0, y: velocity },
        view,
        mulberry32(jump.seed),
      );
      const drift = (window.scrollY - jump.fromY) * JUMP_DRIFT_RATIO;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = JUMP_STREAK_WIDTH_PX;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const line of lines) {
        const shift =
          ((((line.y1 - drift) % view.height) + view.height) % view.height) -
          line.y1;
        const y1 = line.y1 + shift;
        const y2 = line.y2 + shift;
        ctx.moveTo(line.x1, y1);
        ctx.lineTo(line.x2, y2);
        mark(line.x1, y1, line.x2, y2);
        const length = Math.abs(line.y2 - line.y1);
        if (length < STREAK_MAX_LENGTH_PX) {
          const ratio = length / (speed * STREAK_LENGTH_PER_SPEED);
          stats.ratioMin = stats.ratioMin
            ? Math.min(stats.ratioMin, ratio)
            : ratio;
          stats.ratioMax = Math.max(stats.ratioMax, ratio);
        }
      }
      ctx.stroke();
      stats.streaks = Math.max(stats.streaks, lines.length);
      return true;
    },
    clear: end,
  };
  canvas.add(painter);

  const onClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
    if (event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.(JUMP_LINKS);
    const id = link?.getAttribute("href")?.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    const distance = Math.abs(target.getBoundingClientRect().top);
    if (distance < MIN_DISTANCE_PX) return;
    jump = {
      start: performance.now(),
      ms: jumpDurationMs(distance),
      seed: Math.floor(rng() * 2 ** 32),
      fromY: window.scrollY,
    };
    stats = { streaks: 0, ratioMin: 0, ratioMax: 0 };
    root.setAttribute("data-jump", "playing");
    canvas.wake();
  };
  // Capture: it sees the click even if smooth scrolling handles the anchor.
  window.addEventListener("click", onClick, { capture: true, passive: true });

  return {
    stop() {
      window.removeEventListener("click", onClick, { capture: true });
      end();
    },
    report: () => ({ ...stats }),
  };
}
