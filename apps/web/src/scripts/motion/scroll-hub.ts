import { nextVelocity, velocityNow } from "../../lib/motion/smooth-loop";
import { journeyProgress } from "../../lib/sky/journey";

// Single scroll handler of the home page (spec 005, plan section 5 and D19).
// It belongs to the animation core, so the reveal and the travelling Mac work
// even when the effects module does not load; the effects receive it in
// `startFx`. One passive `scroll` listener reads the position once and hands it
// to every listener. With Lenis the window still scrolls natively, so the same
// event covers smooth scrolling. It never asks for frames (RF-39).

/** State handed to every scroll listener. */
export type ScrollState = { y: number; progress: number };
export type ScrollListener = (state: ScrollState) => void;
type Remove = () => void;

/** Delay before the layout notice after the last `resize` (ms). */
const LAYOUT_DEBOUNCE_MS = 150;

export type ScrollHub = {
  /** Called on every scroll and resize, and once right away. */
  add(listener: ScrollListener): Remove;
  /** Called once the layout settles after a resize or a rotation. */
  onLayout(listener: () => void): Remove;
  /**
   * Vertical speed of the scroll now, in px/s (down is positive): from the
   * source registered with `useVelocity` (smooth scrolling while its loop
   * runs) or else from the positions of the last scroll events (spec 005,
   * RF-31, plan 14.6).
   */
  velocity(): number;
  /** Registers a better source of speed; it returns null when it has none. */
  useVelocity(source: () => number | null): Remove;
  stop(): void;
};

export function createScrollHub(): ScrollHub {
  const listeners = new Set<ScrollListener>();
  const layoutListeners = new Set<() => void>();
  let timer = 0;
  let source: (() => number | null) | null = null;
  let sample: { y: number; t: number } | null = null;
  let speed = 0;

  const read = (): ScrollState => {
    const y = window.scrollY;
    return {
      y,
      progress: journeyProgress(
        y,
        document.documentElement.scrollHeight,
        window.innerHeight,
      ),
    };
  };
  const emit = () => {
    const state = read();
    const t = performance.now();
    speed = nextVelocity(sample, state.y, t);
    sample = { y: state.y, t };
    for (const listener of listeners) listener(state);
  };
  const onResize = () => {
    emit();
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      for (const listener of layoutListeners) listener();
    }, LAYOUT_DEBOUNCE_MS);
  };

  window.addEventListener("scroll", emit, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  return {
    add(listener) {
      listeners.add(listener);
      listener(read());
      return () => listeners.delete(listener);
    },
    onLayout(listener) {
      layoutListeners.add(listener);
      return () => layoutListeners.delete(listener);
    },
    velocity() {
      const own = source?.() ?? null;
      if (own !== null) return own;
      return sample ? velocityNow(speed, sample.t, performance.now()) : 0;
    },
    useVelocity(next) {
      source = next;
      return () => {
        if (source === next) source = null;
      };
    },
    stop() {
      window.removeEventListener("scroll", emit);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
      listeners.clear();
      layoutListeners.clear();
      source = null;
    },
  };
}
