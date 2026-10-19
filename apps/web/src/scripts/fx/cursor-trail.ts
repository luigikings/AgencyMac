import {
  CURSOR_TRAIL_SPACING_PX,
  CURSOR_TRAIL_SPEED_PX_MS,
  CURSOR_TRAIL_TONES,
  type FxTier,
} from "../../lib/fx/fx-config";
import {
  alphaAt,
  createPool,
  cursorDue,
  cursorTrailCap,
  spawn,
  step,
} from "../../lib/fx/particles";
import { range, type Rng } from "../../lib/sky/rng";
import { toneValues, type FxCanvas, type Painter } from "./canvas";

// Cursor trail (spec 005, RF-32, plan D12). Only in the high class with a
// fine pointer (fx-layer decides): the mouse leaves a particle every
// CURSOR_TRAIL_SPACING_PX it travels, 14 alive at most, in brand colours,
// drifting slowly and fading. Each lives under 0.6 s, so with the cursor
// still the trail is gone within 0.6 s and the canvas loop stops (RF-39).
// The native cursor is never touched: no style is written anywhere.

type Cleanup = () => void;

export type CursorReport = { emitted: number; alive: number };

export function cursorTrail(options: {
  canvas: FxCanvas;
  tier: FxTier;
  rng: Rng;
}): { stop: Cleanup; report: () => CursorReport } | null {
  const { canvas, tier, rng } = options;
  const cap = cursorTrailCap(tier);
  if (cap <= 0) return null;
  const pool = createPool(cap);
  let tones: string[] | null = null;
  let last = 0;
  let carry = 0;
  let previous: { x: number; y: number } | null = null;
  let emitted = 0;
  // Points waiting for the next frame (the tones are read on the canvas).
  const queue: { x: number; y: number }[] = [];

  const painter: Painter = {
    draw(ctx, now, mark) {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      tones ??= toneValues(ctx, CURSOR_TRAIL_TONES);
      step(pool, dt);
      for (const origin of queue.splice(0)) {
        // Full: the oldest makes way, so the trail stays behind the cursor
        // (step frees a particle whose life is over).
        if (pool.alive >= cap) {
          let oldest = 0;
          for (let i = 1; i < pool.alive; i++) {
            if (alphaAt(pool, i) < alphaAt(pool, oldest)) oldest = i;
          }
          pool.life[oldest] = 0;
          step(pool, 0);
        }
        if (canvas.room() <= 0) break;
        const angle = rng() * 2 * Math.PI;
        const speed = range(
          rng,
          CURSOR_TRAIL_SPEED_PX_MS[0],
          CURSOR_TRAIL_SPEED_PX_MS[1],
        );
        const velocity = {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed,
        };
        const tone = Math.floor(rng() * tones.length);
        if (spawn(pool, "cursor", origin, velocity, rng, { max: cap }, tone)) {
          emitted++;
        }
      }
      if (pool.alive === 0) {
        last = 0;
        return false;
      }
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let t = 0; t < tones.length; t++) {
        ctx.fillStyle = tones[t]!;
        for (let i = 0; i < pool.alive; i++) {
          if (pool.tone[i] !== t) continue;
          const x = pool.x[i]!;
          const y = pool.y[i]!;
          const alpha = alphaAt(pool, i);
          // It shrinks as it fades.
          const r = pool.size[i]! * (0.4 + 0.6 * alpha);
          ctx.globalAlpha = alpha;
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
      return true;
    },
    clear() {
      pool.alive = 0;
      queue.length = 0;
      last = 0;
    },
    particles: () => pool.alive,
  };
  canvas.add(painter);

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const at = { x: event.clientX, y: event.clientY };
    const from = previous;
    previous = at;
    if (!from) return;
    const dx = at.x - from.x;
    const dy = at.y - from.y;
    const distance = Math.hypot(dx, dy);
    const before = carry;
    const due = cursorDue(carry, distance, CURSOR_TRAIL_SPACING_PX);
    carry = due.carry;
    if (due.count === 0) return;
    // Evenly along the way, never more than fit in the pool at once.
    for (let n = Math.max(0, due.count - cap); n < due.count; n++) {
      const along = (CURSOR_TRAIL_SPACING_PX * (n + 1) - before) / distance;
      queue.push({ x: from.x + dx * along, y: from.y + dy * along });
    }
    canvas.wake();
  };
  const onLeave = () => {
    previous = null;
    carry = 0;
  };
  const root = document.documentElement;
  window.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("mouseleave", onLeave);
  return {
    stop() {
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("mouseleave", onLeave);
      painter.clear();
    },
    report: () => ({ emitted, alive: pool.alive }),
  };
}
