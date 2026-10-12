import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { resolveActiveStop } from "../../lib/motion/active-stop";
import {
  FINE_POINTER_QUERY,
  FOLD_MARGIN_PX,
  GESTURE_MS,
  MARKER_RATIO,
  REVEAL_DURATION_S,
  REVEAL_OFFSET_PX,
  REVEAL_START,
  TRAVELER_MIN_PX,
  TRAVELER_MOVE_S,
  TRAVELER_SIZE_RATIO,
  WIDE_QUERY,
} from "../../lib/motion/motion-config";
import { travelerTarget } from "../../lib/motion/traveler";
import {
  isBelowFold,
  revealPlan,
  type RevealSide,
} from "../../lib/motion/reveal-plan";

// Animation layer of the home page. It is downloaded after `load` plus a
// delay and never when motion is reduced. Only `transform` and `opacity` are
// animated (RNF-7), and only blocks below the visible area ever start hidden
// (plan D14), so the first paint and anything the visitor can already see are
// untouched.

// Two-column layout of the service blocks, read when needed.
function isWide(): boolean {
  return window.matchMedia(WIDE_QUERY).matches;
}

function from(side: RevealSide): gsap.TweenVars {
  if (side === "left") return { x: -REVEAL_OFFSET_PX };
  if (side === "right") return { x: REVEAL_OFFSET_PX };
  return { y: REVEAL_OFFSET_PX };
}

function revealBlocks(wide: boolean): void {
  const blocks = gsap.utils.toArray<HTMLElement>("[data-reveal]");
  blocks.forEach((block, index) => {
    const top = block.getBoundingClientRect().top;
    if (!isBelowFold(top, window.innerHeight, FOLD_MARGIN_PX)) return;
    const art = block.querySelector<HTMLElement>(".service__art");
    const text = block.querySelector<HTMLElement>(".service__text");
    if (!art || !text) return;

    const plan = revealPlan(index, wide ? 2 : 1);
    gsap.set(art, { opacity: 0, ...from(plan.image) });
    gsap.set(text, { opacity: 0, ...from(plan.text) });
    // Both halves enter together, from opposite sides.
    gsap.to([art, text], {
      opacity: 1,
      x: 0,
      y: 0,
      duration: REVEAL_DURATION_S,
      ease: "power2.out",
      scrollTrigger: { trigger: block, start: REVEAL_START, once: true },
    });
  });
}

type Box = { left: number; top: number; width: number; height: number };

// Box of an element as laid out, ignoring the reveal's own translation (a
// block that is still sliding in would otherwise move the target).
function layoutBox(el: HTMLElement, moved: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const dx = Number(gsap.getProperty(moved, "x")) || 0;
  const dy = Number(gsap.getProperty(moved, "y")) || 0;
  return {
    left: r.left - dx,
    top: r.top - dy,
    width: r.width,
    height: r.height,
  };
}

// The travelling Mac (RF-34, plan D15): created here, not in the HTML, so
// without JavaScript there is no duplicate image. Decorative: empty alt,
// hidden from assistive technology, absolutely positioned (no layout shift).
// Returns the cleanup function.
function travelingMac(): () => void {
  const services = document.getElementById("services");
  const heroMac = document.querySelector<HTMLImageElement>(".hero__mac");
  const blocks = gsap.utils.toArray<HTMLElement>("#services [data-reveal]");
  if (!services || !heroMac || blocks.length === 0) return () => {};

  const img = document.createElement("img");
  img.src = heroMac.currentSrc || heroMac.src;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.setAttribute("data-traveler", "");
  img.decoding = "async";
  img.draggable = false;
  Object.assign(img.style, {
    position: "absolute",
    left: "0",
    top: "0",
    zIndex: "2",
    pointerEvents: "none",
    userSelect: "none",
    willChange: "transform",
  });
  services.append(img);

  const parts = blocks.map((block) => ({
    id: block.dataset.planet ?? "",
    art: block.querySelector<HTMLElement>(".service__art")!,
    planet: block.querySelector<HTMLElement>(".service__art img")!,
    block,
  }));
  let active = -1;

  const targetFor = (index: number) => {
    const part = parts[index]!;
    const size = Math.max(
      TRAVELER_MIN_PX,
      part.planet.getBoundingClientRect().width * TRAVELER_SIZE_RATIO,
    );
    img.style.width = `${size}px`;
    img.style.height = `${size}px`;
    return travelerTarget({
      container: services.getBoundingClientRect(),
      planet: layoutBox(part.planet, part.art),
      size,
      // Mac stands on the side of the planet that faces the text.
      side: isWide() && index % 2 === 1 ? "left" : "right",
    });
  };

  const place = (index: number, animate: boolean) => {
    const { x, y } = targetFor(index);
    if (animate) {
      gsap.to(img, {
        x,
        y,
        duration: TRAVELER_MOVE_S,
        ease: "power2.inOut",
        overwrite: true,
      });
    } else {
      gsap.set(img, { x, y });
    }
  };

  const update = (animate: boolean) => {
    const scrollY = window.scrollY;
    const stops = parts.map(({ block }) => {
      const r = block.getBoundingClientRect();
      return { top: r.top + scrollY, bottom: r.bottom + scrollY };
    });
    const next = resolveActiveStop(
      scrollY + window.innerHeight * MARKER_RATIO,
      stops,
    );
    if (next < 0) return;
    if (next !== active) {
      active = next;
      services.dataset.activePlanet = parts[next]!.id;
      place(next, animate);
    }
  };

  // First placement: no animation. Afterwards: follow the scroll, and settle
  // again (no animation) whenever the layout changes (resize, rotation).
  update(false);
  const trigger = ScrollTrigger.create({
    trigger: services,
    start: "top bottom",
    end: "bottom top",
    onUpdate: () => update(true),
  });
  const onRefresh = () => {
    if (active >= 0) place(active, false);
    update(false);
  };
  ScrollTrigger.addEventListener("refresh", onRefresh);
  // The page may have scrolled before the layer arrived: settle on every
  // scroll too, since the trigger only fires while the services are in view.
  const onScroll = () => update(true);
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    window.removeEventListener("scroll", onScroll);
    ScrollTrigger.removeEventListener("refresh", onRefresh);
    trigger.kill();
    gsap.killTweensOf(img);
    img.remove();
    delete services.dataset.activePlanet;
  };
}

// Mac's gesture (RF-36): a click or tap on Mac in the hero plays a short
// wiggle of GESTURE_MS. `data-mac-gesture="playing"` is set when it starts and
// removed when it ends. Only `transform` moves; no text is touched. Mouse and
// touch and keyboard (Enter or Space): Mac only becomes a button while this
// layer is active; without it Mac stays a decorative image with no focus.
function macGesture(): () => void {
  const mac = document.querySelector<HTMLElement>(".hero__mac");
  if (!mac) return () => {};
  let playing: gsap.core.Timeline | undefined;

  const play = () => {
    if (playing) return;
    mac.setAttribute("data-mac-gesture", "playing");
    const end = () => {
      mac.removeAttribute("data-mac-gesture");
      gsap.set(mac, { clearProps: "transform" });
      playing = undefined;
    };
    playing = gsap
      .timeline({ onComplete: end })
      .to(mac, {
        rotation: -8,
        y: -14,
        duration: GESTURE_MS / 1000 / 3,
        ease: "power2.out",
      })
      .to(mac, {
        rotation: 8,
        duration: GESTURE_MS / 1000 / 3,
        ease: "sine.inOut",
      })
      .to(mac, {
        rotation: 0,
        y: 0,
        duration: GESTURE_MS / 1000 / 3,
        ease: "power2.in",
      });
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault(); // Space must not scroll the page.
    play();
  };

  // While the layer is active Mac is a button (RF-36): reachable with Tab,
  // named from the text the HTML serves in a data attribute (ES or EN).
  const label = mac.closest<HTMLElement>("[data-mac-label]")?.dataset.macLabel;
  mac.setAttribute("role", "button");
  mac.setAttribute("tabindex", "0");
  if (label) mac.setAttribute("aria-label", label);
  mac.addEventListener("click", play);
  mac.addEventListener("keydown", onKey);
  mac.style.cursor = "pointer";
  return () => {
    mac.removeEventListener("click", play);
    mac.removeEventListener("keydown", onKey);
    mac.removeAttribute("role");
    mac.removeAttribute("tabindex");
    mac.removeAttribute("aria-label");
    mac.style.removeProperty("cursor");
    playing?.kill();
    playing = undefined;
    mac.removeAttribute("data-mac-gesture");
    gsap.set(mac, { clearProps: "transform" });
  };
}

export function startMotion(): void {
  gsap.registerPlugin(ScrollTrigger);
  const root = document.documentElement;
  // matchMedia reverts every tween, trigger and inline style created inside
  // when motion becomes reduced mid-visit, so the content ends up exactly as
  // in the HTML. The breakpoint is deliberately NOT a condition here: when a
  // condition changes, GSAP's revert and rebuild of the triggers made the
  // page jump back to the top. The layout changes (resize, rotation) are
  // followed through ScrollTrigger's own `refresh` event instead.
  gsap
    .matchMedia()
    .add({ motion: "(prefers-reduced-motion: no-preference)" }, (context) => {
      if (!context.conditions?.motion) return;
      root.dataset.motion = "on";
      revealBlocks(isWide());
      const removeTraveler = travelingMac();
      const removeGesture = macGesture();

      // Smooth scrolling: only with a fine pointer (never on touch), and its
      // code is a separate download.
      let stopSmooth: (() => void) | undefined;
      let cancelled = false;
      if (window.matchMedia(FINE_POINTER_QUERY).matches) {
        import("./smooth-scroll")
          .then((module) => {
            if (!cancelled) stopSmooth = module.startSmoothScroll();
          })
          .catch(() => {
            // The page scrolls natively without it.
          });
      }

      return () => {
        cancelled = true;
        stopSmooth?.();
        removeGesture();
        const scrollY = window.scrollY;
        removeTraveler();
        delete root.dataset.motion;
        // Reverting must never move the visitor. ScrollTrigger's refresh
        // after the kill can leave the page at the top: put it back if (and
        // only if) that jump to 0 happens.
        const restore = () => {
          if (scrollY > 0 && window.scrollY === 0) window.scrollTo(0, scrollY);
        };
        restore();
        window.requestAnimationFrame(restore);
        window.setTimeout(restore, 50);
        window.setTimeout(restore, 300);
      };
    });
}
