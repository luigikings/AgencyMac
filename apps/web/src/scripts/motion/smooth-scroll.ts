import Lenis from "lenis";
// Lenis' own rules (html.lenis...) come as text and are added to the page only
// while smooth scrolling runs: never in the base stylesheet (`?inline` keeps
// the bundler from putting them into the page's CSS).
import lenisCss from "lenis/dist/lenis.css?inline";
import { SMOOTH_IDLE_FRAMES } from "../../lib/motion/motion-config";
import {
  keepTicking,
  needsResync,
  nextIdleFrames,
  pxPerSecond,
} from "../../lib/motion/smooth-loop";
import type { ScrollHub } from "./scroll-hub";

// Smooth scrolling (RF-37, plan D16). Only loaded for a fine pointer without
// reduced motion. Scrolling stays native (the keyboard, the browser's search
// and assistive technology keep working); Lenis only smooths the wheel and
// anchor jumps. The window scrolls natively, so the core's scroll handler sees
// every position. Spec 005, D19 (plan 14.2): Lenis has a frame loop of its own
// that only runs while the page moves and stops after SMOOTH_IDLE_FRAMES still
// frames, so at rest no frame is requested (RF-39). Nothing is hooked to GSAP's
// ticker. While its loop runs it gives the scroll handler the speed of the
// scroll for the space jump (spec 005, RF-31, plan 14.6). Returns the cleanup
// function.
export function startSmoothScroll(hub?: ScrollHub): () => void {
  const style = document.createElement("style");
  style.setAttribute("data-lenis-css", "");
  style.textContent = lenisCss;
  document.head.append(style);

  const lenis = new Lenis({ autoRaf: false, anchors: true });
  let frame = 0;
  let idle = 0;
  // Lenis measures each step from the previous time it got: after a pause the
  // gap would make it jump to the end. Its clock only advances while the loop
  // runs (the first frame after waking adds no time).
  let clock = 0;
  let last = -1;
  // Speed of the last step of the loop, in px/s (Lenis gives px per step).
  let speed = 0;

  const loop = (time: number) => {
    const step = last < 0 ? 0 : time - last;
    clock += step;
    last = time;
    lenis.raf(clock);
    speed = pxPerSecond(lenis.velocity, step);
    idle = nextIdleFrames(idle, lenis.isScrolling !== false);
    if (keepTicking(idle, SMOOTH_IDLE_FRAMES)) {
      frame = window.requestAnimationFrame(loop);
    } else {
      frame = 0;
      last = -1;
    }
  };
  const halt = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    last = -1;
  };
  const wake = () => {
    idle = 0;
    if (!frame && !document.hidden) {
      frame = window.requestAnimationFrame(loop);
    }
  };
  // Runs in the capture phase, before Lenis' own click handler (bubble): a
  // scroll whose event has not arrived yet would otherwise make Lenis aim at
  // an anchor from an old position and jump back there first (note under T18
  // of spec 005). Lenis' public fields are enough: no animation is running.
  const onClick = () => {
    if (
      needsResync(lenis.isScrolling, lenis.animatedScroll, lenis.actualScroll)
    ) {
      lenis.animatedScroll = lenis.targetScroll = lenis.actualScroll;
    }
    wake();
  };
  const onVisibility = () => {
    if (document.hidden) halt();
    else if (lenis.isScrolling !== false) wake();
  };

  const removeVelocity = hub?.useVelocity(() => (frame ? speed : null));

  // Anything that may start a movement wakes the loop: the wheel, a click on
  // an anchor (Lenis scrolls to it), the keyboard and any other scroll.
  window.addEventListener("wheel", wake, { passive: true });
  window.addEventListener("click", onClick, { capture: true });
  window.addEventListener("keydown", wake);
  window.addEventListener("scroll", wake, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("wheel", wake);
    window.removeEventListener("click", onClick, { capture: true });
    window.removeEventListener("keydown", wake);
    window.removeEventListener("scroll", wake);
    document.removeEventListener("visibilitychange", onVisibility);
    removeVelocity?.();
    halt();
    lenis.destroy();
    style.remove();
  };
}
