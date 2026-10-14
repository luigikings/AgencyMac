import {
  PLANET_GROW_TAU_MS,
  PLANET_HOVER_SCALE,
  PLANET_POINTER_DEPTH,
  POINTER_PARALLAX_MAX_PX,
  SPARK_RIM_RATIO,
  SPARK_TONES,
  type FxTier,
} from "../../lib/fx/fx-config";
import {
  alphaAt,
  createPool,
  sparkCap,
  sparkLaunch,
  sparksToEmit,
  spawn,
  step,
  type Pool,
} from "../../lib/fx/particles";
import {
  easeToRest,
  limitLength,
  pointerParallax,
  type Point,
} from "../../lib/sky/parallax";
import type { Rng } from "../../lib/sky/rng";
import { cssVariableName } from "../../styles/tokens";
import type { FxCanvas, Painter } from "./canvas";

// The planets and the cursor (spec 005, RF-13, RF-14). Only with a fine
// pointer in the middle or high class (fx-layer decides). Each planet moves
// against the cursor (up to 14 px, more for the nearer ones) and eases back
// when the cursor leaves the page. Under the cursor it grows (5 % at most)
// and gives off sparks of the brand colours from its rim, up to the tier's
// limit per planet (20 or 40; three planets stay under the tier's particle
// limit, 80 or 160). When the cursor leaves, the sparks already out end
// their short life and the planet shrinks back. Both loops run only while
// something moves or a spark is alive (RF-39): the transforms in their own
// frame loop, the sparks on the shared canvas. Without a canvas there are no
// sparks, and the planets still move and grow (RF-41).

type Cleanup = () => void;
type Hooks = { onHide: Cleanup[]; onShow: Cleanup[] };

type Planet = {
  /** Wrapper that moves and grows (plan D17). */
  el: HTMLElement;
  /** The picture of the planet, whose box the sparks come from. */
  image: HTMLElement;
  depth: number;
  now: Point;
  target: Point;
  scale: number;
  scaleTarget: number;
  hovered: boolean;
  sparks: Pool;
  /** Fraction of a spark left over from the frames before. */
  carry: number;
};

/** Below this the scale counts as arrived. */
const SCALE_EPSILON = 0.0005;

/** Values of the spark tokens as the canvas writes them. */
function toneValues(ctx: CanvasRenderingContext2D): string[] {
  const style = getComputedStyle(document.documentElement);
  return SPARK_TONES.map((tone) => {
    ctx.fillStyle = style.getPropertyValue(cssVariableName(tone)).trim();
    return String(ctx.fillStyle);
  });
}

export function planetFx(options: {
  canvas: FxCanvas | null;
  tier: FxTier;
  rng: Rng;
  hooks: Hooks;
}): Cleanup {
  const { canvas, tier, rng, hooks } = options;
  const cap = canvas ? sparkCap(tier) : 0;
  const planets: Planet[] = [];
  for (const block of document.querySelectorAll<HTMLElement>(
    ".service[data-planet]",
  )) {
    const el = block.querySelector<HTMLElement>(".service__planet");
    const image = block.querySelector<HTMLElement>(".service__image");
    if (!el || !image) continue;
    planets.push({
      el,
      image,
      depth:
        PLANET_POINTER_DEPTH[
          block.dataset.planet as keyof typeof PLANET_POINTER_DEPTH
        ] ?? 1,
      now: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      scale: 1,
      scaleTarget: 1,
      hovered: false,
      sparks: createPool(cap),
      carry: 0,
    });
  }
  if (planets.length === 0) return () => {};

  // Transforms: offset and scale ease towards their targets.
  let frame = 0;
  let last = 0;
  const move = (time: number) => {
    const dt = last ? Math.min(100, time - last) : 16;
    last = time;
    let moving = false;
    const k = Math.exp(-dt / PLANET_GROW_TAU_MS);
    for (const p of planets) {
      const gap = easeToRest(
        { x: p.now.x - p.target.x, y: p.now.y - p.target.y },
        dt,
      );
      if (Math.hypot(gap.x, gap.y) < 0.05) {
        p.now = { ...p.target };
      } else {
        p.now = { x: p.target.x + gap.x, y: p.target.y + gap.y };
        moving = true;
      }
      const grow = (p.scale - p.scaleTarget) * k;
      if (Math.abs(grow) < SCALE_EPSILON) {
        p.scale = p.scaleTarget;
      } else {
        p.scale = p.scaleTarget + grow;
        moving = true;
      }
      if (p.now.x === 0 && p.now.y === 0 && p.scale === 1) {
        p.el.style.removeProperty("transform");
      } else {
        p.el.style.transform =
          `translate3d(${p.now.x}px,${p.now.y}px,0)` +
          (p.scale === 1 ? "" : ` scale(${p.scale})`);
      }
    }
    frame = moving ? window.requestAnimationFrame(move) : 0;
    if (!frame) last = 0;
  };
  const kick = () => {
    if (!frame && !document.hidden) frame = window.requestAnimationFrame(move);
  };
  const halt = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };

  // Sparks, drawn on the shared canvas.
  let tones: string[] | null = null;
  let sparkLast = 0;
  const painter: Painter = {
    draw(ctx, now, mark) {
      const dt = sparkLast ? Math.min(50, now - sparkLast) : 16;
      sparkLast = now;
      if (!tones) tones = toneValues(ctx);
      let busy = false;
      for (const p of planets) {
        const pool = p.sparks;
        step(pool, dt);
        if (p.hovered) {
          busy = true;
          const out = sparksToEmit(p.carry, dt, cap, pool.alive);
          p.carry = out.carry;
          if (out.count > 0) {
            const box = p.image.getBoundingClientRect();
            const centre = {
              x: box.left + box.width / 2,
              y: box.top + box.height / 2,
            };
            const radius = box.width * SPARK_RIM_RATIO;
            for (let n = 0; n < out.count; n++) {
              const { origin, velocity } = sparkLaunch(rng, centre, radius);
              const tone = Math.floor(rng() * tones.length);
              spawn(pool, "spark", origin, velocity, rng, { max: cap }, tone);
            }
          }
        }
        if (pool.alive === 0) continue;
        busy = true;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        // One fillStyle per colour (plan section 5); the fade is the alpha.
        for (let t = 0; t < tones.length; t++) {
          ctx.fillStyle = tones[t]!;
          for (let i = 0; i < pool.alive; i++) {
            if (pool.tone[i] !== t) continue;
            const x = pool.x[i]!;
            const y = pool.y[i]!;
            const r = pool.size[i]!;
            ctx.globalAlpha = alphaAt(pool, i);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.fill();
            x0 = Math.min(x0, x - r);
            y0 = Math.min(y0, y - r);
            x1 = Math.max(x1, x + r);
            y1 = Math.max(y1, y + r);
          }
        }
        ctx.globalAlpha = 1;
        mark(x0, y0, x1, y1);
      }
      if (!busy) sparkLast = 0;
      return busy;
    },
    clear() {
      for (const p of planets) {
        p.sparks.alive = 0;
        p.carry = 0;
      }
      sparkLast = 0;
    },
    particles: () => planets.reduce((sum, p) => sum + p.sparks.alive, 0),
  };
  if (canvas && cap > 0) canvas.add(painter);

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const box = {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const cursor = { x: event.clientX, y: event.clientY };
    for (const p of planets) {
      p.target = limitLength(
        pointerParallax(cursor, box, p.depth, POINTER_PARALLAX_MAX_PX),
        POINTER_PARALLAX_MAX_PX,
      );
    }
    kick();
  };
  const hover = (p: Planet, on: boolean) => {
    p.hovered = on;
    p.scaleTarget = on ? PLANET_HOVER_SCALE : 1;
    if (!on) p.carry = 0;
    kick();
    if (on && cap > 0) canvas?.wake();
  };
  const leaves = planets.map((p) => {
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hover(p, true);
    };
    const leave = () => hover(p, false);
    p.el.addEventListener("pointerenter", enter);
    p.el.addEventListener("pointerleave", leave);
    return () => {
      p.el.removeEventListener("pointerenter", enter);
      p.el.removeEventListener("pointerleave", leave);
    };
  });
  const onLeavePage = () => {
    for (const p of planets) {
      p.target = { x: 0, y: 0 };
      hover(p, false);
    }
  };
  // With the tab hidden nothing runs; the planets let go of the cursor, and
  // on coming back they ease to rest.
  const onHide = () => {
    halt();
    for (const p of planets) {
      p.hovered = false;
      p.scaleTarget = 1;
    }
  };

  const root = document.documentElement;
  window.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("mouseleave", onLeavePage);
  window.addEventListener("blur", onLeavePage);
  hooks.onHide.push(onHide);
  hooks.onShow.push(kick);
  return () => {
    window.removeEventListener("pointermove", onMove);
    root.removeEventListener("mouseleave", onLeavePage);
    window.removeEventListener("blur", onLeavePage);
    leaves.forEach((remove) => remove());
    halt();
    painter.clear();
    planets.forEach((p) => p.el.style.removeProperty("transform"));
  };
}
