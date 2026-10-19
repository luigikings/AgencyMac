import { canvasSize, frameStats } from "../../lib/fx/canvas-math";
import {
  CANVAS_RESIZE_DEBOUNCE_MS,
  FRAME_COST_SAMPLES,
} from "../../lib/fx/fx-config";
import { cssVariableName, type ColorName } from "../../styles/tokens";

// The single effects canvas (spec 005, plan D5): fixed over the page, out of
// the way of the pointer and of assistive technology (RF-42), with its
// resolution limited by the tier and to 2 megapixels (RNF-8). Its frame loop
// runs only on demand: it starts when a painter has something to draw and
// stops on the first frame with nothing drawn (RF-39). A browser without 2D
// drawing gets no canvas at all and the effects that need it do nothing
// (RF-41).

/** One kind of effect drawn on the canvas. */
export type Painter = {
  /**
   * Updates and draws one frame at `now` (ms, performance.now) in CSS px,
   * calling `mark` with the box it drew on. Returns true while it still has
   * something to draw on the next frame.
   */
  draw(ctx: CanvasRenderingContext2D, now: number, mark: Mark): boolean;
  /** Stops at once (tab hidden, effects removed): nothing left to draw. */
  clear(): void;
  /** Particles alive, for the report. */
  particles?(): number;
};

type Mark = (x0: number, y0: number, x1: number, y1: number) => void;

export type FxCanvas = {
  /** Size of the canvas in CSS px. */
  view(): { width: number; height: number };
  add(painter: Painter): void;
  /** A painter has something new: run the loop if it is not running. */
  wake(): void;
  /** Stops the loop and wipes the canvas (the painters are cleared). */
  halt(): void;
  /** Frames drawn so far, mean and p95 cost of the latest, particles. */
  report(): { frames: number; avg: number; p95: number; particles: number };
  /**
   * Particles that can still be created without going past the limit of the
   * class (RF-37), counting those of every painter alive now.
   */
  room(): number;
  /** Removes the canvas and everything it listens to. */
  stop(): void;
};

/**
 * Values of colour tokens as the canvas writes them (read once from the CSS
 * variables: no hex outside tokens.ts).
 */
export function toneValues(
  ctx: CanvasRenderingContext2D,
  tones: readonly ColorName[],
): string[] {
  const style = getComputedStyle(document.documentElement);
  return tones.map((tone) => {
    ctx.fillStyle = style.getPropertyValue(cssVariableName(tone)).trim();
    return String(ctx.fillStyle);
  });
}

/** Padding around the marked boxes when they are wiped, in CSS px. */
const WIPE_PAD = 4;

/**
 * `onFrame` gets the own cost (ms) of every frame drawn and whether the loop
 * goes on after it (RF-38: the degradation watches frames in a row).
 */
export function createFxCanvas(
  maxDensity: number,
  maxParticles: number,
  onFrame?: (costMs: number, goesOn: boolean) => void,
): FxCanvas | null {
  const el = document.createElement("canvas");
  const ctx = el.getContext("2d");
  if (!ctx) return null;

  el.className = "fx-canvas";
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    zIndex: "5",
    pointerEvents: "none",
  });
  document.body.append(el);

  const painters: Painter[] = [];
  const costs: number[] = [];
  let frames = 0;
  let frame = 0;
  let size = { width: 1, height: 1, density: 1 };
  let css = { width: 0, height: 0 };
  // Box drawn on the last frame (CSS px), wiped at the start of the next.
  let dirty: [number, number, number, number] | null = null;

  const resize = () => {
    const box = el.getBoundingClientRect();
    css = { width: box.width, height: box.height };
    size = canvasSize(
      box.width,
      box.height,
      window.devicePixelRatio,
      maxDensity,
    );
    el.width = size.width;
    el.height = size.height;
    // Setting the size wipes the canvas and resets the transform.
    ctx.setTransform(size.density, 0, 0, size.density, 0, 0);
    dirty = null;
  };
  resize();

  let resizeTimer = 0;
  const onResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, CANVAS_RESIZE_DEBOUNCE_MS);
  };
  window.addEventListener("resize", onResize, { passive: true });

  const wipe = () => {
    if (!dirty) return;
    const [x0, y0, x1, y1] = dirty;
    ctx.clearRect(
      x0 - WIPE_PAD,
      y0 - WIPE_PAD,
      x1 - x0 + 2 * WIPE_PAD,
      y1 - y0 + 2 * WIPE_PAD,
    );
    dirty = null;
  };

  let next: [number, number, number, number] | null = null;
  const mark: Mark = (x0, y0, x1, y1) => {
    const box: [number, number, number, number] = [
      Math.min(x0, x1),
      Math.min(y0, y1),
      Math.max(x0, x1),
      Math.max(y0, y1),
    ];
    next = next
      ? [
          Math.min(next[0], box[0]),
          Math.min(next[1], box[1]),
          Math.max(next[2], box[2]),
          Math.max(next[3], box[3]),
        ]
      : box;
  };

  const tick = () => {
    const start = performance.now();
    wipe();
    next = null;
    let busy = false;
    for (const painter of painters) {
      if (painter.draw(ctx, start, mark)) busy = true;
    }
    dirty = next;
    frames++;
    const cost = performance.now() - start;
    costs.push(cost);
    if (costs.length > FRAME_COST_SAMPLES) costs.shift();
    // Keep going while something is alive or a box is still to be wiped.
    frame = busy || dirty ? window.requestAnimationFrame(tick) : 0;
    onFrame?.(cost, frame !== 0);
  };

  const alive = () =>
    painters.reduce((sum, p) => sum + (p.particles?.() ?? 0), 0);

  const halt = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    painters.forEach((painter) => painter.clear());
    ctx.clearRect(0, 0, css.width, css.height);
    dirty = null;
  };

  return {
    view: () => ({ ...css }),
    add(painter) {
      painters.push(painter);
    },
    wake() {
      if (!frame && !document.hidden) {
        frame = window.requestAnimationFrame(tick);
      }
    },
    halt,
    report() {
      const stats = frameStats(costs);
      return {
        frames,
        avg: stats.avg,
        p95: stats.p95,
        particles: alive(),
      };
    },
    room: () => Math.max(0, maxParticles - alive()),
    stop() {
      halt();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      painters.length = 0;
      el.remove();
    },
  };
}
