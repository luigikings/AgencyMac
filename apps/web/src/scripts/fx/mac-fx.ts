import { gsap } from "gsap";
import { MAC_SETTLE_MS } from "../../lib/fx/fx-config";
import {
  bendSide,
  curveBetween,
  flightMs,
  flightTilt,
  pointAt,
  type Curve,
  type Point,
} from "../../lib/fx/mac-path";
import type { Traveler } from "../motion/home-motion";

// Mac's curved flight between planets (spec 005, RF-21, RF-22, plan D6). It
// replaces the straight move of the animation core while the effects are on:
// one `gsap.to` over a progress 0..1 of a cubic curve (src/lib/fx/mac-path),
// writing only `transform` (x, y and rotation) on the traveller. While he
// flies, `data-mac-flight="flying"` is on the traveller. GSAP's ticker runs
// only during the flight and the straightening after it, so at rest no frame
// is requested (RF-39).

type Cleanup = () => void;

function read(img: HTMLElement, property: string): number {
  return Number(gsap.getProperty(img, property)) || 0;
}

export function macFlight(traveler: Traveler): Cleanup {
  const { img } = traveler;
  const setX = gsap.quickSetter(img, "x", "px");
  const setY = gsap.quickSetter(img, "y", "px");
  const setTilt = gsap.quickSetter(img, "rotation", "deg");
  const progress = { t: 0 };
  let curve: Curve | undefined;
  let startTilt = 0;
  let tween: gsap.core.Tween | undefined;

  const draw = () => {
    if (!curve) return;
    const p = pointAt(curve, progress.t);
    setX(p.x);
    setY(p.y);
    setTilt(flightTilt(curve, progress.t, startTilt));
  };

  // Landed: straight again in MAC_SETTLE_MS (RF-22 asks for under 0.4 s).
  const land = () => {
    img.removeAttribute("data-mac-flight");
    tween = gsap.to(img, {
      rotation: 0,
      duration: MAC_SETTLE_MS / 1000,
      ease: "power2.out",
    });
  };

  // From wherever Mac is now (also mid-flight: no jump) to the new place.
  const fly = (to: Point) => {
    tween?.kill();
    gsap.killTweensOf(img);
    const from = { x: read(img, "x"), y: read(img, "y") };
    startTilt = read(img, "rotation");
    // x and y are the top-left corner: the centre of the container in the
    // same terms.
    const container = img.parentElement;
    const centreX = ((container?.clientWidth ?? 0) - img.offsetWidth) / 2;
    curve = curveBetween(from, to, bendSide(from, to, centreX));
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    progress.t = 0;
    img.setAttribute("data-mac-flight", "flying");
    tween = gsap.to(progress, {
      t: 1,
      duration: flightMs(distance) / 1000,
      ease: "sine.inOut",
      onUpdate: draw,
      onComplete: land,
    });
  };

  // A resize or a rotation places Mac at once: no flight, no tilt.
  const stop = () => {
    tween?.kill();
    tween = undefined;
    curve = undefined;
    gsap.killTweensOf(img, "rotation");
    gsap.set(img, { rotation: 0 });
    img.removeAttribute("data-mac-flight");
  };

  const release = traveler.useFlight({ fly, stop });
  return () => {
    release();
    stop();
  };
}
