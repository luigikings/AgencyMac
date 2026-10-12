import { LOAD_DELAY_MS } from "../lib/motion/motion-config";

// Entry of the deferred animation layer (spec 004, RF-31, plan D13b). It is
// the only script that ships with the page: it waits for `load` plus a delay
// (so the animation code never competes with the first paint), skips
// everything when motion is reduced, and only then downloads the module with
// GSAP. The page is complete without any of it (RF-32).
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
let requested = false;

function download(): void {
  if (requested || reduced.matches) return;
  requested = true;
  import("./motion/home-motion")
    .then((module) => module.startMotion())
    .catch(() => {
      // Blocked or offline: the content is already visible.
      requested = false;
    });
}

function schedule(): void {
  if (requested || reduced.matches) return;
  window.setTimeout(download, LOAD_DELAY_MS);
}

if (document.readyState === "complete") {
  schedule();
} else {
  window.addEventListener("load", schedule, { once: true });
}

// Motion allowed again in the middle of the visit: load the layer then.
reduced.addEventListener("change", () => {
  if (!reduced.matches && document.readyState === "complete") schedule();
});
