import { gsap } from "gsap";
import {
  nextLine,
  placeBubble,
  type Box,
  type Side,
} from "../../lib/fx/bubbles";
import {
  BUBBLE_BG,
  BUBBLE_FG,
  BUBBLE_MARGIN_PX,
  BUBBLE_POP_MS,
  BUBBLE_WIDTHS_PX,
} from "../../lib/fx/fx-config";
import { bubbleMs } from "../../lib/fx/mac-reactions";
import type { Rng } from "../../lib/sky/rng";
import { cssVariableName } from "../../styles/tokens";

// Mac's speech bubble (spec 005, RF-24, RF-26, RF-27, RNF-11). A single
// element, created by JS only when Mac says something, so the HTML never has
// it and it never exists with reduced motion (the effects module is not even
// downloaded then, and its cleanup removes it mid-visit, RF-40). It is
// decorative: `aria-hidden`, out of the way of the pointer, on a solid brand
// colour. Its text comes from the JSON block of lines the page serves in its
// language (#mac-lines, from translations.ts). One at a time: a new line takes
// the place of the one on screen; each stays 2.0 to 2.8 s and is never the
// same as the one before. It goes next to Mac, inside the window and clear of
// the main buttons; if there is no such place, nothing is shown. It never
// covers a text of the page either (T23): it tries every side of Mac, slides
// along them and, if it must, wraps into narrower lines; only when no place
// at all is clear does it take the one that covers least. No frame loop of
// its own: a short GSAP pop-in and a timer.

export type Bubbles = {
  /**
   * Shows one of `candidates` (translation keys) next to `anchor`. Returns
   * whether a bubble is shown.
   */
  say(candidates: readonly string[], anchor: Element): boolean;
  /** Removes the bubble on screen, if any. */
  clear(): void;
};

/** What a bubble never covers: the "Quiero despegar" buttons. */
const AVOID = ".cta";
/** Text that is not on the page for the visitor. */
const NOT_TEXT = "[data-mac-bubble], script, style, noscript, template";
/** Side of the little tail (a rotated square), in px. */
const TAIL_PX = 12;

function readLines(): Record<string, string> {
  try {
    const raw = document.getElementById("mac-lines")?.textContent ?? "";
    const data: unknown = JSON.parse(raw);
    return data && typeof data === "object"
      ? (data as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/**
 * The line boxes of every visible text in the window (headings, paragraphs,
 * labels, links...), in window px: what a bubble keeps clear of.
 */
function textBoxes(view: { width: number; height: number }): Box[] {
  const boxes: Box[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!node.nodeValue?.trim() || !parent || parent.closest(NOT_TEXT)) {
      continue;
    }
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width <= 1 || r.height <= 1) continue;
      if (r.bottom < 0 || r.top > view.height) continue;
      if (r.right < 0 || r.left > view.width) continue;
      if (getComputedStyle(parent).visibility !== "visible") break;
      boxes.push({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    }
  }
  return boxes;
}

const color = (name: Parameters<typeof cssVariableName>[0]) =>
  `var(${cssVariableName(name)})`;

function build(
  text: string,
  maxWidth: number,
): {
  el: HTMLElement;
  tail: HTMLElement;
} {
  const el = document.createElement("div");
  el.setAttribute("data-mac-bubble", "");
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "absolute",
    left: "0",
    top: "0",
    zIndex: "6",
    boxSizing: "border-box",
    maxWidth: `${maxWidth}px`,
    // More than half the diagonal of the tail (12 px turned 45 degrees), so
    // it never reaches the text.
    padding: "0.65rem 0.9rem",
    borderRadius: "1rem",
    background: color(BUBBLE_BG),
    color: color(BUBBLE_FG),
    boxShadow: `0 0.2rem 0 ${color("button")}`,
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    fontWeight: "700",
    lineHeight: "1.3",
    textAlign: "center",
    overflowWrap: "anywhere",
    pointerEvents: "none",
    userSelect: "none",
    visibility: "hidden",
  });
  const label = document.createElement("span");
  label.setAttribute("data-mac-bubble-text", "");
  label.textContent = text;
  label.style.position = "relative"; // above the tail
  const tail = document.createElement("span");
  Object.assign(tail.style, {
    position: "absolute",
    width: `${TAIL_PX}px`,
    height: `${TAIL_PX}px`,
    background: color(BUBBLE_BG),
    transform: "rotate(45deg)",
  });
  el.append(tail, label);
  return { el, tail };
}

/** Puts the tail on the side facing Mac, pointing at his centre. */
function aimTail(
  tail: HTMLElement,
  side: Side,
  place: { x: number; y: number },
  size: { width: number; height: number },
  anchor: Box,
): string {
  const half = TAIL_PX / 2;
  const along = (centre: number, start: number, length: number) =>
    Math.min(length - 2 * TAIL_PX, Math.max(TAIL_PX, centre - start - half));
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;
  if (side === "above" || side === "below") {
    const left = along(cx, place.x, size.width);
    tail.style.left = `${left}px`;
    // From the edge itself, whatever the final height.
    tail.style[side === "above" ? "bottom" : "top"] = `${-half}px`;
    return `${left + half}px ${side === "above" ? "100%" : "0%"}`;
  }
  const top = along(cy, place.y, size.height);
  tail.style.top = `${top}px`;
  tail.style[side === "left" ? "right" : "left"] = `${-half}px`;
  return `${side === "left" ? "100%" : "0%"} ${top + half}px`;
}

export function createBubbles(rng: Rng): Bubbles & { stop(): void } {
  let lines: Record<string, string> | null = null;
  let current: HTMLElement | null = null;
  let last: string | null = null;
  let timer = 0;
  let pop: gsap.core.Tween | undefined;

  const clear = () => {
    window.clearTimeout(timer);
    timer = 0;
    pop?.kill();
    pop = undefined;
    current?.remove();
    current = null;
  };

  const say = (candidates: readonly string[], anchor: Element): boolean => {
    lines ??= readLines();
    const known = lines;
    const key = nextLine(
      candidates.filter((k) => typeof known[k] === "string" && known[k] !== ""),
      last,
      rng,
    );
    if (!key) return false;
    clear();

    const root = document.documentElement;
    const view = { width: root.clientWidth, height: window.innerHeight };
    const full = Math.max(0, view.width - 2 * BUBBLE_MARGIN_PX);
    const { el, tail } = build(known[key]!, full);
    // Measured hidden, at the top-left corner (inside the window). Rounded
    // up: a width rounded down would wrap the text once fixed.
    document.body.append(el);
    const target = boxOf(anchor);
    const avoid = [...document.querySelectorAll(AVOID)].map(boxOf);
    const texts = textBoxes(view);
    let best: {
      place: NonNullable<ReturnType<typeof placeBubble>>;
      size: { width: number; height: number };
      limit: number;
    } | null = null;
    // The full width first, then narrower lines while every place covers
    // some text.
    for (const limit of [full, ...BUBBLE_WIDTHS_PX.filter((w) => w < full)]) {
      el.style.maxWidth = `${limit}px`;
      const measured = el.getBoundingClientRect();
      if (best && measured.width >= best.size.width) continue;
      const size = {
        width: Math.ceil(measured.width),
        height: Math.ceil(measured.height),
      };
      const place = placeBubble({ anchor: target, size, view, avoid, texts });
      if (place && (!best || place.overlap < best.place.overlap)) {
        best = { place, size, limit };
      }
      if (best?.place.overlap === 0) break;
    }
    if (!best) {
      el.remove();
      return false;
    }
    const { place, size, limit } = best;
    // Fixed width, so it wraps the same once moved; page coordinates, so it
    // scrolls with Mac.
    Object.assign(el.style, {
      maxWidth: `${limit}px`,
      width: `${size.width}px`,
      left: `${place.x + window.scrollX}px`,
      top: `${place.y + window.scrollY}px`,
      visibility: "visible",
    });
    const origin = aimTail(tail, place.side, place, size, target);
    current = el;
    last = key;
    pop = gsap.fromTo(
      el,
      { scale: 0.85 },
      {
        scale: 1,
        transformOrigin: origin,
        duration: BUBBLE_POP_MS / 1000,
        ease: "back.out(2)",
      },
    );
    timer = window.setTimeout(clear, bubbleMs(rng));
    return true;
  };

  return { say, clear, stop: clear };
}
