import Lenis from "lenis";
// Lenis' own rules (html.lenis...) come as text and are added to the page only
// while smooth scrolling runs: never in the base stylesheet (`?inline` keeps
// the bundler from putting them into the page's CSS).
import lenisCss from "lenis/dist/lenis.css?inline";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Smooth scrolling (RF-37, plan D16). Only loaded for a fine pointer without
// reduced motion. Scrolling stays native (the keyboard, the browser's search
// and assistive technology keep working); Lenis only smooths the wheel and
// anchor jumps. It is driven by GSAP's ticker so ScrollTrigger and the
// travelling Mac see the same scroll position. Returns the cleanup function.
export function startSmoothScroll(): () => void {
  const style = document.createElement("style");
  style.setAttribute("data-lenis-css", "");
  style.textContent = lenisCss;
  document.head.append(style);

  const lenis = new Lenis({ autoRaf: false, anchors: true });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis.destroy();
    style.remove();
  };
}
