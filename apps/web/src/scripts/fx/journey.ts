import {
  JOURNEY_MOBILE_PX,
  JOURNEY_ROCKET_PX,
  JOURNEY_STOP_MARK,
  JOURNEY_WIDE_QUERY,
} from "../../lib/fx/fx-config";
import {
  STOPS,
  railOffset,
  stopProgresses,
  visitedStops,
} from "../../lib/sky/journey";
import { cssVariableName, type ColorName } from "../../styles/tokens";
import type { ScrollHub } from "../motion/scroll-hub";

// Journey indicator of the home page (spec 005, RF-30, RF-42, RNF-11, plan
// D13). Created by JS, so it only exists with the effects layer (never with
// reduced motion: the module is not downloaded, and its cleanup removes it
// mid-visit, RF-40). A fixed rail on the edge of the window: a bar along the
// top on narrow screens (6 px thick, rocket and stops included) and a
// vertical rail on the right edge from 64 rem, in the gutter the content
// never reaches. One stop per section, lit once the section crosses the
// middle of the window, and the isologo already served as `/favicon.svg` as
// the rocket (no new image). Decorative: `aria-hidden`, no pointer, nothing
// focusable. It follows the core's single scroll handler and only writes
// `transform` and the stops' `data-visited`: no frame loop of its own and no
// layout shift (it is fixed, out of the flow).

type Cleanup = () => void;

/** Space between the vertical rail and the right edge, in px. */
const WIDE_EDGE_PX = 12;
/** Part of the window height left free above and below the vertical rail. */
const WIDE_INSET_VH = 18;
/** Thickness of the line, in px. */
const LINE_PX = 2;
/** Size of a stop on narrow and wide screens, in px. */
const STOP_PX = { narrow: JOURNEY_MOBILE_PX, wide: 8 } as const;

const color = (name: ColorName) => `var(${cssVariableName(name)})`;

type Parts = {
  root: HTMLElement;
  track: HTMLElement;
  fill: HTMLElement;
  stops: HTMLElement[];
  rocket: HTMLImageElement;
};

function part(tag: "div" | "span", style: Partial<CSSStyleDeclaration>) {
  const el = document.createElement(tag);
  Object.assign(el.style, { position: "absolute", ...style });
  return el;
}

function build(): Parts {
  const root = document.createElement("div");
  root.setAttribute("data-fx-journey", "");
  root.setAttribute("aria-hidden", "true");
  Object.assign(root.style, {
    position: "fixed",
    zIndex: "7",
    pointerEvents: "none",
    userSelect: "none",
  });
  const track = part("span", {
    background: color("text"),
    opacity: "0.3",
    borderRadius: `${LINE_PX}px`,
  });
  const fill = part("span", {
    background: color("buttonHover"),
    borderRadius: `${LINE_PX}px`,
    willChange: "transform",
  });
  const stops = STOPS.map((id) => {
    const stop = part("span", { borderRadius: "50%" });
    stop.setAttribute("data-journey-stop", id);
    return stop;
  });
  const rocket = document.createElement("img");
  rocket.setAttribute("data-journey-rocket", "");
  rocket.src = "/favicon.svg";
  rocket.alt = "";
  rocket.decoding = "async";
  rocket.draggable = false;
  Object.assign(rocket.style, {
    position: "absolute",
    left: "0",
    top: "0",
    display: "block",
    maxWidth: "none",
    willChange: "transform",
  });
  root.append(track, fill, ...stops, rocket);
  return { root, track, fill, stops, rocket };
}

/** Places the rail for the width of the window; returns whether it is vertical. */
function lay(parts: Parts, wide: boolean) {
  const { root, track, fill, stops, rocket } = parts;
  const rocketPx = wide ? JOURNEY_ROCKET_PX.wide : JOURNEY_ROCKET_PX.narrow;
  const stopPx = wide ? STOP_PX.wide : STOP_PX.narrow;
  const thick = wide ? JOURNEY_ROCKET_PX.wide : JOURNEY_MOBILE_PX;
  const centre = (size: number) => `${(thick - size) / 2}px`;
  root.dataset.orientation = wide ? "vertical" : "horizontal";
  Object.assign(
    root.style,
    wide
      ? {
          top: `${WIDE_INSET_VH}vh`,
          bottom: `${WIDE_INSET_VH}vh`,
          right: `${WIDE_EDGE_PX}px`,
          left: "auto",
          width: `${thick}px`,
          height: "auto",
        }
      : {
          top: "0",
          bottom: "auto",
          left: "0",
          right: "0",
          width: "auto",
          height: `${thick}px`,
        },
  );
  // The line runs along the middle of the rail.
  const line = wide
    ? { top: "0", bottom: "0", left: centre(LINE_PX), right: "auto" }
    : { left: "0", right: "0", top: centre(LINE_PX), bottom: "auto" };
  for (const el of [track, fill]) {
    Object.assign(el.style, line, {
      width: wide ? `${LINE_PX}px` : "auto",
      height: wide ? "auto" : `${LINE_PX}px`,
    });
  }
  fill.style.transformOrigin = wide ? "50% 0" : "0 50%";
  for (const stop of stops) {
    Object.assign(stop.style, {
      width: `${stopPx}px`,
      height: `${stopPx}px`,
      left: wide ? centre(stopPx) : "0",
      top: wide ? "0" : centre(stopPx),
    });
  }
  Object.assign(rocket.style, {
    width: `${rocketPx}px`,
    height: `${rocketPx}px`,
  });
  return { rocketPx, stopPx };
}

export function journey(hub: ScrollHub): Cleanup {
  const sections = STOPS.map((id) => document.getElementById(id));
  if (sections.some((section) => !section)) return () => {};
  const parts = build();
  document.body.append(parts.root);
  const wideQuery = window.matchMedia(JOURNEY_WIDE_QUERY);

  let wide = false;
  let sizes = { rocketPx: 0, stopPx: 0 };
  let length = 0;
  let stops: number[] = [];
  let lit: boolean[] = [];
  let progress = 0;

  const at = (offset: number) =>
    wide ? `translate3d(0,${offset}px,0)` : `translate3d(${offset}px,0,0)`;

  const render = () => {
    const { rocketPx } = sizes;
    const offset = railOffset(progress, length, rocketPx);
    // The rocket points the way it travels: down, or to the right.
    parts.rocket.style.transform = `${at(offset)} rotate(${wide ? 180 : 90}deg)`;
    const reach = length > 0 ? (offset + rocketPx / 2) / length : 0;
    parts.fill.style.transform = wide ? `scaleY(${reach})` : `scaleX(${reach})`;
    const visited = visitedStops(progress, stops);
    visited.forEach((on, i) => {
      if (on === lit[i]) return;
      const stop = parts.stops[i]!;
      stop.toggleAttribute("data-visited", on);
      Object.assign(stop.style, {
        background: color(on ? "buttonHover" : "text"),
        opacity: on ? "1" : "0.5",
        // The glow only on the vertical rail: the bar stays 6 px.
        boxShadow: on && wide ? `0 0 6px ${color("buttonHover")}` : "none",
      });
    });
    lit = visited;
  };

  // Lengths and stops for the current layout of the page.
  const measure = () => {
    wide = wideQuery.matches;
    sizes = lay(parts, wide);
    lit = [];
    length = wide ? parts.root.clientHeight : parts.root.clientWidth;
    const docHeight = document.documentElement.scrollHeight;
    const tops = sections.map(
      (section) => section!.getBoundingClientRect().top + window.scrollY,
    );
    stops = stopProgresses(
      tops,
      docHeight,
      window.innerHeight,
      JOURNEY_STOP_MARK,
    );
    parts.stops.forEach((stop, i) => {
      const offset =
        railOffset(stops[i]!, length, sizes.rocketPx) +
        (sizes.rocketPx - sizes.stopPx) / 2;
      stop.style.transform = at(offset);
    });
    render();
  };

  measure();
  const removeScroll = hub.add((state) => {
    progress = state.progress;
    render();
  });
  const removeLayout = hub.onLayout(measure);
  wideQuery.addEventListener("change", measure);

  return () => {
    removeScroll();
    removeLayout();
    wideQuery.removeEventListener("change", measure);
    parts.root.remove();
  };
}
