import { gsap } from "gsap";
import { resolveActiveStop } from "../../lib/motion/active-stop";
import {
  FINE_POINTER_QUERY,
  FOLD_MARGIN_PX,
  GESTURE_MS,
  GSAP_AUTO_SLEEP_FRAMES,
  MARKER_RATIO,
  REVEAL_DURATION_S,
  REVEAL_OFFSET_PX,
  REVEAL_START_RATIO,
  TRAVELER_MIN_PX,
  TRAVELER_MOVE_S,
  TRAVELER_SIZE_RATIO,
  WIDE_QUERY,
} from "../../lib/motion/motion-config";
import { travelerTarget } from "../../lib/motion/traveler";
import { pickTier } from "../../lib/fx/device-tier";
import type { FxTier } from "../../lib/fx/fx-config";
import {
  isBelowFold,
  revealDue,
  revealPlan,
  revealRootMargin,
  type RevealSide,
} from "../../lib/motion/reveal-plan";
import { createScrollHub, type ScrollHub } from "./scroll-hub";

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

// Reveal of the blocks below the fold (RF-35 of spec 004). Only those start
// hidden. Spec 005, D19: an IntersectionObserver whose area ends at the start
// line plays each reveal once; the single scroll handler is the safety net for
// a jump past a block (no intersection ever happens), which must never leave
// it hidden. `inContext` runs the tween inside the matchMedia context, so
// reduced motion mid-visit reverts it too. Returns the cleanup function.
function revealBlocks(
  wide: boolean,
  hub: ScrollHub,
  inContext: (create: () => void) => void,
): () => void {
  const pending = new Map<Element, HTMLElement[]>();
  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((block, index) => {
    const top = block.getBoundingClientRect().top;
    if (!isBelowFold(top, window.innerHeight, FOLD_MARGIN_PX)) return;
    const art = block.querySelector<HTMLElement>(".service__art");
    const text = block.querySelector<HTMLElement>(".service__text");
    if (!art || !text) return;

    const plan = revealPlan(index, wide ? 2 : 1);
    gsap.set(art, { opacity: 0, ...from(plan.image) });
    gsap.set(text, { opacity: 0, ...from(plan.text) });
    pending.set(block, [art, text]);
  });
  if (pending.size === 0) return () => {};

  let observer: IntersectionObserver | undefined;
  let removeListener: () => void = () => {};
  const reveal = (block: Element) => {
    const halves = pending.get(block);
    if (!halves) return;
    pending.delete(block);
    observer?.unobserve(block);
    // Both halves enter together, from opposite sides.
    inContext(() => {
      gsap.to(halves, {
        opacity: 1,
        x: 0,
        y: 0,
        duration: REVEAL_DURATION_S,
        ease: "power2.out",
      });
    });
    if (pending.size === 0) {
      observer?.disconnect();
      removeListener();
    }
  };

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target);
        }
      },
      { rootMargin: revealRootMargin(REVEAL_START_RATIO) },
    );
    pending.forEach((_, block) => observer!.observe(block));
  }
  removeListener = hub.add(() => {
    for (const block of [...pending.keys()]) {
      const top = block.getBoundingClientRect().top;
      if (revealDue(top, window.innerHeight, REVEAL_START_RATIO)) {
        reveal(block);
      }
    }
  });
  if (pending.size === 0) removeListener();
  return () => {
    observer?.disconnect();
    removeListener();
    pending.clear();
  };
}

type Box = { left: number; top: number; width: number; height: number };

/** Place of the traveller: its top-left corner, relative to #services. */
export type TravelerPoint = { x: number; y: number };

/**
 * A flight that replaces the straight move of spec 004 (spec 005, T19: the
 * curve of the effects module).
 */
export type TravelerFlight = {
  /** Flies from wherever Mac is now to `to`. */
  fly(to: TravelerPoint): void;
  /** Ends a flight at once (Mac is then placed with no animation). */
  stop(): void;
};

/** What the core hands to the effects about the travelling Mac (plan 14.6). */
export type Traveler = {
  img: HTMLImageElement;
  /** Moves with `flight` until the function it returns is called. */
  useFlight(flight: TravelerFlight): () => void;
};

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
// It moves straight to each new planet; the effects module may replace that
// move with its curved flight (spec 005, T19). Returns the cleanup function
// and the handle for the effects (none when there is no traveller).
function travelingMac(hub: ScrollHub): {
  stop: () => void;
  traveler: Traveler | null;
} {
  const services = document.getElementById("services");
  const heroMac = document.querySelector<HTMLImageElement>(".hero__mac");
  const blocks = gsap.utils.toArray<HTMLElement>("#services [data-reveal]");
  if (!services || !heroMac || blocks.length === 0) {
    return { stop: () => {}, traveler: null };
  }

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
  let flight: TravelerFlight | undefined;

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
    if (animate && flight) {
      flight.fly({ x, y });
      return;
    }
    flight?.stop();
    if (animate) {
      gsap.to(img, {
        x,
        y,
        duration: TRAVELER_MOVE_S,
        ease: "power2.inOut",
        overwrite: true,
      });
    } else {
      // Also ends a flight in progress: its end point was measured on the
      // layout before a resize or a rotation, and it would win over this
      // placement and leave Mac off the planet (spec 005, T16b).
      gsap.set(img, { x, y, overwrite: true });
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

  // First placement: no animation. Afterwards: follow the core's single scroll
  // handler, and settle again (no animation) once the layout changes after a
  // resize or a rotation (spec 005, D19: no ScrollTrigger).
  update(false);
  const removeScroll = hub.add(() => update(true));
  const removeLayout = hub.onLayout(() => {
    if (active >= 0) place(active, false);
    update(false);
  });

  const traveler: Traveler = {
    img,
    useFlight(next) {
      flight = next;
      return () => {
        if (flight === next) flight = undefined;
      };
    },
  };

  return {
    stop: () => {
      removeScroll();
      removeLayout();
      flight?.stop();
      flight = undefined;
      gsap.killTweensOf(img);
      img.remove();
      delete services.dataset.activePlanet;
    },
    traveler,
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

// Device class of the visit (spec 005, RF-37), from the signals the browser
// exposes. Memory, cores and data saver may be missing (Safari, Firefox):
// pickTier treats them as "not limiting".
function readTier(): FxTier {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const cores = nav.hardwareConcurrency;
  const fontPx =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return pickTier({
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: nav.connection?.saveData === true,
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    cores: typeof cores === "number" && cores > 0 ? cores : null,
    coarse: window.matchMedia("(pointer: coarse)").matches,
    widthRem: window.innerWidth / fontPx,
  });
}

// The effects layer (spec 005): marks the class in `data-fx-tier` and
// downloads its own module unless the class is "off". Returns the cleanup; a
// module that fails to load leaves no mark behind (RF-41).
function effects(hub: ScrollHub, traveler: Traveler | null): () => void {
  const root = document.documentElement;
  const tier = readTier();
  if (tier === "off") return () => {};
  root.dataset.fxTier = tier;
  let stop: (() => void) | undefined;
  let cancelled = false;
  import("../fx/fx-layer")
    .then((module) => {
      if (!cancelled) stop = module.startFx(tier, { hub, traveler });
    })
    .catch(() => {
      // Blocked or offline: the page is complete without the effects.
      if (!cancelled) delete root.dataset.fxTier;
    });
  return () => {
    cancelled = true;
    stop?.();
    delete root.dataset.fxTier;
  };
}

export function startMotion(): void {
  const root = document.documentElement;
  // At rest no frame is requested (spec 005, RF-39): nothing is hooked to
  // GSAP's ticker, which then sleeps soon after the last tween.
  gsap.config({ autoSleep: GSAP_AUTO_SLEEP_FRAMES });
  // matchMedia reverts every tween and inline style created inside when
  // motion becomes reduced mid-visit, so the content ends up exactly as in the
  // HTML. The breakpoint is deliberately NOT a condition here: when a
  // condition changes, GSAP's revert and rebuild made the page jump back to
  // the top (spec 004). The layout changes (resize, rotation) are followed
  // through the layout notice of the single scroll handler instead.
  gsap
    .matchMedia()
    .add({ motion: "(prefers-reduced-motion: no-preference)" }, (context) => {
      if (!context.conditions?.motion) return;
      root.dataset.motion = "on";
      const hub = createScrollHub();
      const removeReveal = revealBlocks(isWide(), hub, (create) => {
        context.add(create);
      });
      const traveling = travelingMac(hub);
      const removeGesture = macGesture();
      const removeEffects = effects(hub, traveling.traveler);

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
        removeEffects();
        const scrollY = window.scrollY;
        removeReveal();
        traveling.stop();
        hub.stop();
        delete root.dataset.motion;
        // Reverting must never move the visitor (spec 004: ScrollTrigger's
        // refresh after the kill could leave the page at the top). Kept as a
        // cheap guard: put the page back if (and only if) a jump to 0 happens.
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
