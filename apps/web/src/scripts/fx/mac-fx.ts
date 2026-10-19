import { gsap } from "gsap";
import {
  BURST_RADIUS_RATIO,
  BURST_TONES,
  GREET_MS,
  LOOK_MAX_DEG,
  LOOK_MAX_PX,
  MAC_BOUNCE_MS,
  MAC_BOUNCE_PEAK,
  MAC_BOUNCE_SCALE,
  MAC_SETTLE_MS,
  TIER_PARAMS,
  TRAIL_REAR_RATIO,
  TRAIL_TONES,
  TURBO_MS,
  type FxTier,
} from "../../lib/fx/fx-config";
import {
  angleAt,
  bendSide,
  curveBetween,
  flightMs,
  flightTilt,
  pointAt,
  rearOf,
  type Curve,
  type Point,
} from "../../lib/fx/mac-path";
import {
  LINE_KEYS,
  burstSize,
  easeGaze,
  greetSway,
  idleDue,
  idleWaitMs,
  lookAt,
  registerPress,
  turboArc,
  turboSpan,
  type Pose,
  type PressState,
  type TurboSpan,
} from "../../lib/fx/mac-reactions";
import {
  alphaAt,
  burstLaunch,
  capFor,
  createPool,
  spawn,
  step,
  trailCap,
  trailDue,
  trailLaunch,
} from "../../lib/fx/particles";
import type { Rng } from "../../lib/sky/rng";
import type { Traveler } from "../motion/home-motion";
import type { Bubbles } from "./bubbles";
import { toneValues, type FxCanvas, type Painter } from "./canvas";

// Mac's curved flight between planets (spec 005, RF-21, RF-22, plan D6). It
// replaces the straight move of the animation core while the effects are on:
// one `gsap.to` over a progress 0..1 of a cubic curve (src/lib/fx/mac-path),
// writing only `transform` (x, y, rotation and scale) on the traveller. While
// he flies, `data-mac-flight="flying"` is on the traveller.
//
// T20: while he flies, a trail of particles of the brand colours comes out of
// his back at the rate of the device class (RF-23: 36, 20 or 8 a second),
// drawn on the shared canvas; each lives under 0.5 s. On landing he bounces
// (RF-24: up to a scale of 1.12 and back in 0.4 s) and says that planet's line
// in a bubble. GSAP's ticker runs only during the flight, the straightening
// and the bounce, and the canvas only while trail particles are alive, so at
// rest no frame is requested (RF-39).

type Cleanup = () => void;

/** What the effects layer reports of the trail (plan section 4, fx:report). */
export type TrailReport = { emitted: number; alive: number };

/** Longest frame step of the trail particles' motion, in ms. */
const STEP_MAX_MS = 50;

function read(img: HTMLElement, property: string): number {
  return Number(gsap.getProperty(img, property)) || 0;
}

export function macFlight(options: {
  traveler: Traveler;
  canvas: FxCanvas | null;
  tier: FxTier;
  rng: Rng;
  bubbles: Bubbles | null;
  /** Called on every take-off (the gaze lets go of the traveller, T21). */
  onTakeOff?: () => void;
}): { stop: Cleanup; report: () => TrailReport } {
  const { traveler, canvas, tier, rng, bubbles, onTakeOff } = options;
  const { img } = traveler;
  const setX = gsap.quickSetter(img, "x", "px");
  const setY = gsap.quickSetter(img, "y", "px");
  const setTilt = gsap.quickSetter(img, "rotation", "deg");
  const progress = { t: 0 };
  let curve: Curve | undefined;
  let startTilt = 0;
  let tween: gsap.core.Tween | undefined;
  let bounce: gsap.core.Timeline | undefined;

  // The trail (RF-23): its own pool, sized so no particle is cut short.
  const cap = canvas ? trailCap(tier) : 0;
  const rate = TIER_PARAMS[tier].trailPerSecond;
  const pool = createPool(cap);
  let flying = false;
  // Take-off time and particles emitted in this flight: the emission follows
  // the clock, not the frames (trailDue).
  let takeOff = 0;
  let flightEmitted = 0;
  let last = 0;
  let lastScrollY = 0;
  let emitted = 0;
  let tones: string[] | null = null;

  // The particles due by `now` since take-off, out of Mac's back.
  const emitTrail = (now: number) => {
    if (!curve || cap === 0) return;
    const due = trailDue(now - takeOff, rate);
    // Never past the class limit, with Mac's bursts alive too (RF-37).
    const count = Math.min(cap, due - flightEmitted, canvas?.room() ?? 0);
    flightEmitted = due;
    if (count <= 0) return;
    const box = img.getBoundingClientRect();
    const heading = angleAt(curve, progress.t);
    const rear = rearOf(
      { x: box.left + box.width / 2, y: box.top + box.height / 2 },
      heading,
      img.offsetWidth * TRAIL_REAR_RATIO,
    );
    for (let n = 0; n < count; n++) {
      const { origin, velocity } = trailLaunch(rng, rear, heading);
      const tone = Math.floor(rng() * TRAIL_TONES.length);
      if (spawn(pool, "trail", origin, velocity, rng, { max: cap }, tone)) {
        emitted++;
      }
    }
  };

  const painter: Painter = {
    draw(ctx, now, mark) {
      const elapsed = last ? now - last : 16;
      last = now;
      if (!tones) tones = toneValues(ctx, TRAIL_TONES);
      // The particles stay where they were left on the page, also while it
      // scrolls under the fixed canvas.
      const scrollY = window.scrollY;
      const shift = scrollY - lastScrollY;
      lastScrollY = scrollY;
      if (shift !== 0) {
        for (let i = 0; i < pool.alive; i++) pool.y[i] = pool.y[i]! - shift;
      }
      step(pool, Math.min(STEP_MAX_MS, elapsed));
      if (flying) emitTrail(performance.now());
      if (pool.alive > 0) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        // One fillStyle per colour (plan section 5); they fade and shrink.
        for (let t = 0; t < tones.length; t++) {
          ctx.fillStyle = tones[t]!;
          for (let i = 0; i < pool.alive; i++) {
            if (pool.tone[i] !== t) continue;
            const alpha = alphaAt(pool, i);
            const x = pool.x[i]!;
            const y = pool.y[i]!;
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
      }
      const busy = flying || pool.alive > 0;
      if (!busy) last = 0;
      return busy;
    },
    clear() {
      pool.alive = 0;
      last = 0;
    },
    particles: () => pool.alive,
  };
  if (canvas && cap > 0) canvas.add(painter);

  const draw = () => {
    if (!curve) return;
    const p = pointAt(curve, progress.t);
    setX(p.x);
    setY(p.y);
    setTilt(flightTilt(curve, progress.t, startTilt));
  };

  // RF-24: up to MAC_BOUNCE_SCALE and back, MAC_BOUNCE_MS in all.
  const playBounce = () => {
    bounce?.kill();
    const up = (MAC_BOUNCE_MS * MAC_BOUNCE_PEAK) / 1000;
    const down = (MAC_BOUNCE_MS * (1 - MAC_BOUNCE_PEAK)) / 1000;
    bounce = gsap
      .timeline({ onComplete: () => (bounce = undefined) })
      .to(img, { scale: MAC_BOUNCE_SCALE, duration: up, ease: "power2.out" })
      .to(img, { scale: 1, duration: down, ease: "bounce.out" });
  };

  // The line of the planet he has landed on (the core marks it on #services).
  const sayArrival = () => {
    const id = img.parentElement?.dataset.activePlanet;
    const key =
      id && id in LINE_KEYS.arrive
        ? LINE_KEYS.arrive[id as keyof typeof LINE_KEYS.arrive]
        : null;
    if (key) bubbles?.say([key], img);
  };

  // Landed: straight again in MAC_SETTLE_MS (RF-22 asks for under 0.4 s),
  // with the bounce and the bubble.
  const land = () => {
    // The ones due up to the very moment he lands, then no more.
    emitTrail(performance.now());
    flying = false;
    img.removeAttribute("data-mac-flight");
    tween = gsap.to(img, {
      rotation: 0,
      duration: MAC_SETTLE_MS / 1000,
      ease: "power2.out",
    });
    playBounce();
    sayArrival();
  };

  // From wherever Mac is now (also mid-flight: no jump) to the new place.
  const fly = (to: Point) => {
    tween?.kill();
    bounce?.kill();
    bounce = undefined;
    gsap.killTweensOf(img);
    // A bounce cut short shrinks back while he takes off.
    if (read(img, "scale") !== 1) {
      gsap.to(img, { scale: 1, duration: 0.15, ease: "power2.out" });
    }
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
    onTakeOff?.();
    // The first trail particle comes out at once.
    if (!flying) {
      takeOff = performance.now();
      flightEmitted = 0;
      lastScrollY = window.scrollY;
    }
    flying = true;
    if (cap > 0) canvas?.wake();
    tween = gsap.to(progress, {
      t: 1,
      duration: flightMs(distance) / 1000,
      ease: "sine.inOut",
      onUpdate: draw,
      onComplete: land,
    });
  };

  // A resize or a rotation places Mac at once: no flight, no tilt, no bounce.
  // The trail already out fades on its own.
  const stop = () => {
    tween?.kill();
    tween = undefined;
    bounce?.kill();
    bounce = undefined;
    curve = undefined;
    flying = false;
    gsap.killTweensOf(img, "rotation,scale");
    gsap.set(img, { rotation: 0, scale: 1 });
    img.removeAttribute("data-mac-flight");
  };

  const release = traveler.useFlight({ fly, stop });
  return {
    stop: () => {
      release();
      stop();
      painter.clear();
    },
    report: () => ({ emitted, alive: pool.alive }),
  };
}

// T22 (RF-28, RF-29): the bursts of particles out of Mac when he is pressed
// and in turbo mode, drawn on the shared canvas. Their own pool, as large as
// the class limit; each burst takes only the room the other effects leave
// (canvas.room), so the particles alive never go past the limit (RF-37).

/** What the effects layer reports of the bursts (plan section 4, fx:report). */
export type BurstReport = { emitted: number; alive: number };

export type Bursts = {
  /**
   * A burst out of a Mac centred at `centre` (window px) `width` px wide.
   * Returns the particles created.
   */
  burst(kind: "click" | "turbo", centre: Point, width: number): number;
  report(): BurstReport;
  stop: Cleanup;
};

export function macBursts(options: {
  canvas: FxCanvas | null;
  tier: FxTier;
  rng: Rng;
}): Bursts | null {
  const { canvas, tier, rng } = options;
  const cap = capFor(tier);
  if (!canvas || cap <= 0) return null;
  const pool = createPool(cap);
  let emitted = 0;
  let last = 0;
  let lastScrollY = 0;
  let tones: string[] | null = null;

  const painter: Painter = {
    draw(ctx, now, mark) {
      const elapsed = last ? now - last : 16;
      last = now;
      if (!tones) tones = toneValues(ctx, BURST_TONES);
      // They stay where they were thrown on the page, also while it scrolls.
      const scrollY = window.scrollY;
      const shift = scrollY - lastScrollY;
      lastScrollY = scrollY;
      if (shift !== 0) {
        for (let i = 0; i < pool.alive; i++) pool.y[i] = pool.y[i]! - shift;
      }
      step(pool, Math.min(STEP_MAX_MS, elapsed));
      if (pool.alive > 0) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (let t = 0; t < tones.length; t++) {
          ctx.fillStyle = tones[t]!;
          for (let i = 0; i < pool.alive; i++) {
            if (pool.tone[i] !== t) continue;
            const alpha = alphaAt(pool, i);
            const x = pool.x[i]!;
            const y = pool.y[i]!;
            const r = pool.size[i]! * (0.5 + 0.5 * alpha);
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
      }
      const busy = pool.alive > 0;
      if (!busy) last = 0;
      return busy;
    },
    clear() {
      pool.alive = 0;
      last = 0;
    },
    particles: () => pool.alive,
  };
  canvas.add(painter);

  return {
    burst(kind, centre, width) {
      if (document.hidden) return 0;
      // The big burst takes the place of the press bursts still in the air
      // (in the low class they would leave it almost no room).
      if (kind === "turbo") pool.alive = 0;
      const count = burstSize(kind, canvas.room(), rng);
      if (pool.alive === 0) lastScrollY = window.scrollY;
      const radius = width * BURST_RADIUS_RATIO;
      let made = 0;
      for (let n = 0; n < count; n++) {
        const { origin, velocity } = burstLaunch(rng, centre, radius);
        const tone = Math.floor(rng() * BURST_TONES.length);
        if (spawn(pool, "burst", origin, velocity, rng, { max: cap }, tone)) {
          made++;
        }
      }
      emitted += made;
      if (made > 0) canvas.wake();
      return made;
    },
    report: () => ({ emitted, alive: pool.alive }),
    stop: () => painter.clear(),
  };
}

// T21 (RF-25, RF-26, RF-27): Mac's gaze, greeting and rest line.
//
// Gaze: with a fine pointer (fx-layer decides the class), the hero's Mac while
// he is on screen and the traveller while he is not flying lean up to 6
// degrees and move up to 8 px towards the cursor, and ease back to rest when
// it leaves the page. It is written on the elements' own `rotate` and
// `translate` properties, which the browser adds to `transform`, so it never
// fights the flight, the bounce or the gesture of spec 004 (all on
// `transform`). Greeting: once per visit, when the hero's CSS landing is over
// and Mac is in view, a sway of GREET_MS on `rotate` with the greeting bubble
// (`data-mac-greet="playing"` meanwhile). Rest line: after IDLE_AFTER_MS
// without interaction, once per period of rest, in a bubble next to the Mac on
// screen. One frame loop for the gaze and the sway, only while one of them
// moves; the rest line waits on a timer (RF-39: no frames at rest).
//
// T22 (RF-28, RF-29): a press on the hero's Mac (click, tap, Enter or Space,
// the same as the gesture of spec 004, which the core plays) that starts a
// gesture adds a burst and one of his press lines; presses during a gesture
// add nothing, so nothing stacks. Five presses within 3 s set off turbo mode
// instead (registerPress): `data-mac-turbo="playing"` on Mac while he crosses
// the window in an arc of TURBO_MS (turboArc), with a big burst and the turbo
// line; not again for 10 s. The arc moves the wrapper of the hero's Mac
// (`.hero__mac-wrap`, its own `translate`, `rotate` and `scale`), never the
// image: GSAP folds an element's own `translate`, `rotate` and `scale` into
// its `transform` when the gesture starts, and the gesture may start at any
// moment of the arc. The same frame loop moves it.

type Hooks = { onHide: Cleanup[]; onShow: Cleanup[] };

/** One Mac whose pose (gaze plus sway) this module writes. */
type Posed = {
  el: HTMLElement;
  /** Does he follow the cursor? */
  gazes: boolean;
  now: Pose;
  target: Pose;
  settled: boolean;
  /** Start of the greeting (performance.now), while it plays. */
  greetFrom: number | null;
};

const REST: Pose = { rotate: 0, x: 0, y: 0 };
/** Longest frame step of the gaze, in ms. */
const GAZE_STEP_MAX_MS = 100;
/**
 * Room around Mac's turn in turbo mode for the gesture's own shift (14 px)
 * and the gaze (8 px), in px.
 */
const TURBO_ROOM_PX = 24;
/** Events that count as an interaction (RF-27, the rest line). */
const INTERACTIONS = [
  "pointermove",
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

/** In memory only (plan D15): Mac greets once per visit. */
let greeted = false;

function visibleArea(el: Element): number {
  const box = el.getBoundingClientRect();
  const w = Math.min(box.right, window.innerWidth) - Math.max(box.left, 0);
  const h = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
  return w > 0 && h > 0 ? w * h : 0;
}

export function macReactions(options: {
  heroMac: HTMLElement | null;
  traveler: HTMLElement | null;
  bubbles: Bubbles | null;
  /** The bursts of a press and of turbo mode (none without a canvas). */
  bursts: Bursts | null;
  /** Fine pointer in the middle or high class (RF-25). */
  gaze: boolean;
  hooks: Hooks;
}): { stop: Cleanup; letGo: (el: HTMLElement) => void } {
  const { heroMac, traveler, bubbles, bursts, gaze, hooks } = options;
  const macs: Posed[] = [heroMac, traveler]
    .filter((el): el is HTMLElement => el !== null)
    .map((el) => ({
      el,
      gazes: gaze,
      now: { ...REST },
      target: { ...REST },
      settled: true,
      greetFrom: null,
    }));
  const hero = macs.find((m) => m.el === heroMac) ?? null;
  let stopped = false;
  let cursor: { x: number; y: number } | null = null;
  let aimPending = false;

  // Where each Mac looks: rest without a cursor, while flying or off screen.
  const aim = (m: Posed) => {
    if (!m.gazes) return;
    let target = REST;
    if (
      cursor &&
      !m.el.hasAttribute("data-mac-flight") &&
      !m.el.hasAttribute("data-mac-turbo") &&
      visibleArea(m.el) > 0
    ) {
      const box = m.el.getBoundingClientRect();
      // His centre without the gaze's own shift (the tilt keeps it).
      const centre = {
        x: box.left + box.width / 2 - m.now.x,
        y: box.top + box.height / 2 - m.now.y,
      };
      target = lookAt(centre, cursor, {
        maxDeg: LOOK_MAX_DEG,
        maxPx: LOOK_MAX_PX,
      });
    }
    m.target = target;
    m.settled = false;
  };

  const write = (m: Posed, sway: number) => {
    const rotate = m.now.rotate + sway;
    const { style } = m.el;
    if (rotate === 0 && m.now.x === 0 && m.now.y === 0) {
      style.removeProperty("rotate");
      style.removeProperty("translate");
    } else {
      style.rotate = `${rotate}deg`;
      style.translate = `${m.now.x}px ${m.now.y}px`;
    }
  };

  let frame = 0;
  let last = 0;
  const tick = (time: number) => {
    const dt = last ? Math.min(GAZE_STEP_MAX_MS, time - last) : 16;
    last = time;
    // Read the boxes first, then write (no layout between writes).
    if (aimPending) {
      aimPending = false;
      macs.forEach(aim);
    }
    let busy = false;
    for (const m of macs) {
      if (!m.settled) {
        const next = easeGaze(m.now, m.target, dt);
        m.now = next.pose;
        m.settled = next.settled;
        busy ||= !next.settled;
      }
      let sway = 0;
      if (m.greetFrom !== null) {
        const elapsed = performance.now() - m.greetFrom;
        if (elapsed >= GREET_MS) {
          m.greetFrom = null;
          m.el.removeAttribute("data-mac-greet");
        } else {
          sway = greetSway(elapsed);
          busy = true;
        }
      }
      write(m, sway);
    }
    if (turbo) {
      const elapsed = performance.now() - turbo.from;
      if (elapsed >= TURBO_MS) {
        endTurbo();
      } else {
        writeTurbo(turboArc(elapsed, turbo.span));
        busy = true;
      }
    }
    frame = busy ? window.requestAnimationFrame(tick) : 0;
    if (!frame) last = 0;
  };
  const kick = () => {
    if (!frame && !stopped && !document.hidden) {
      frame = window.requestAnimationFrame(tick);
    }
  };
  const halt = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cursor = { x: event.clientX, y: event.clientY };
    aimPending = true;
    kick();
  };
  const onLeavePage = () => {
    cursor = null;
    aimPending = true;
    kick();
  };

  // Turbo mode (RF-29) on the wrapper of the hero's Mac.
  const wrap = heroMac?.closest<HTMLElement>(".hero__mac-wrap") ?? null;
  let presses: PressState = { presses: [], lastTurbo: null };
  let turbo: { from: number; span: TurboSpan } | null = null;
  const writeTurbo = (pose: ReturnType<typeof turboArc>) => {
    if (!wrap) return;
    const { style } = wrap;
    // It turns and shrinks about its middle (the CSS landing, over by now,
    // pivots on the saucer's base).
    style.transformOrigin = "50% 50%";
    style.translate = `${pose.x}px ${pose.y}px`;
    style.rotate = `${pose.rotate}deg`;
    style.scale = `${pose.scale}`;
  };
  const endTurbo = () => {
    turbo = null;
    heroMac?.removeAttribute("data-mac-turbo");
    if (!wrap) return;
    for (const property of [
      "translate",
      "rotate",
      "scale",
      "transform-origin",
    ]) {
      wrap.style.removeProperty(property);
    }
  };
  const startTurbo = (now: number) => {
    if (!hero || !wrap) return;
    const box = wrap.getBoundingClientRect();
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    // Half his diagonal (the turn fits in it), plus the gesture's own shift
    // and the gaze.
    const radius =
      Math.hypot(wrap.offsetWidth, wrap.offsetHeight) / 2 + TURBO_ROOM_PX;
    turbo = {
      from: now,
      span: turboSpan(
        { ...centre, radius },
        {
          width: document.documentElement.clientWidth,
          height: window.innerHeight,
        },
      ),
    };
    hero.el.setAttribute("data-mac-turbo", "playing");
    // He lets go of the cursor while he flies.
    hero.target = { ...REST };
    hero.settled = false;
    bursts?.burst("turbo", centre, box.width);
    bubbles?.say([LINE_KEYS.turbo], hero.el);
    kick();
  };
  // Capture phase: it runs before the core's own handler, so it still sees
  // whether this press starts a gesture or comes during one.
  const onPress = (event: Event) => {
    if (stopped || !hero) return;
    if (!(event.target instanceof Node) || !hero.el.contains(event.target)) {
      return;
    }
    if (event instanceof KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.repeat) return;
    }
    const now = performance.now();
    const startsGesture = !hero.el.hasAttribute("data-mac-gesture");
    const press = registerPress(presses, now);
    presses = press.state;
    if (press.turbo) {
      startTurbo(now);
      return;
    }
    if (turbo || !startsGesture) return;
    const box = hero.el.getBoundingClientRect();
    bursts?.burst(
      "click",
      { x: box.left + box.width / 2, y: box.top + box.height / 2 },
      box.width,
    );
    bubbles?.say(LINE_KEYS.click, hero.el);
  };
  const capture = { capture: true } as const;
  window.addEventListener("click", onPress, capture);
  window.addEventListener("keydown", onPress, capture);

  // The greeting: after the hero's landing (its CSS animations) and with Mac
  // in view; with the tab hidden it waits for the visitor to come back.
  let pendingGreet = false;
  let inView: IntersectionObserver | undefined;
  const greet = () => {
    if (stopped || greeted || !hero) return;
    if (document.hidden) {
      pendingGreet = true;
      return;
    }
    greeted = true;
    hero.greetFrom = performance.now();
    hero.el.setAttribute("data-mac-greet", "playing");
    bubbles?.say([LINE_KEYS.greet], hero.el);
    kick();
  };
  const greetInView = () => {
    if (stopped || greeted || !hero) return;
    if (!("IntersectionObserver" in window)) {
      greet();
      return;
    }
    inView = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        inView?.disconnect();
        inView = undefined;
        greet();
      },
      { threshold: 0.5 },
    );
    inView.observe(hero.el);
  };
  if (hero && !greeted) {
    const wrap = hero.el.closest(".hero__mac-wrap");
    const landing =
      wrap && "getAnimations" in wrap
        ? wrap.getAnimations().filter((animation) => {
            const end = animation.effect?.getComputedTiming().endTime;
            return (
              animation.playState !== "finished" &&
              typeof end === "number" &&
              Number.isFinite(end)
            );
          })
        : [];
    Promise.all(landing.map((animation) => animation.finished)).then(
      greetInView,
      greetInView,
    );
  }

  // The rest line: one timer that checks again when it fires.
  const idle = {
    lastInteraction: performance.now(),
    lastIdle: null as number | null,
  };
  let idleTimer = 0;
  const scheduleIdle = () => {
    if (idleTimer || stopped) return;
    const wait = idleWaitMs(idle, performance.now());
    if (Number.isFinite(wait)) {
      idleTimer = window.setTimeout(onIdleTimer, wait);
    }
  };
  const onIdleTimer = () => {
    idleTimer = 0;
    const now = performance.now();
    if (!idleDue(idle, now)) {
      scheduleIdle();
      return;
    }
    // With the tab hidden, coming back counts as an interaction.
    if (document.hidden) return;
    idle.lastIdle = now;
    // Next to the Mac that is most in view, if any.
    let anchor: HTMLElement | null = null;
    let best = 0;
    for (const m of macs) {
      const area = visibleArea(m.el);
      if (area > best) {
        best = area;
        anchor = m.el;
      }
    }
    if (anchor) bubbles?.say([LINE_KEYS.idle], anchor);
  };
  const interact = () => {
    idle.lastInteraction = performance.now();
    scheduleIdle();
  };
  scheduleIdle();

  const onShow = () => {
    interact();
    if (pendingGreet) {
      pendingGreet = false;
      greet();
    }
    kick();
  };
  const listen = { capture: true, passive: true } as const;
  INTERACTIONS.forEach((type) =>
    window.addEventListener(type, interact, listen),
  );
  const root = document.documentElement;
  if (gaze) {
    window.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("mouseleave", onLeavePage);
    window.addEventListener("blur", onLeavePage);
  }
  hooks.onHide.push(halt);
  hooks.onShow.push(onShow);

  return {
    // A take-off: the traveller lets go of the cursor (the flight's own tilt
    // rules, RF-22).
    letGo: (el) => {
      const m = macs.find((posed) => posed.el === el);
      if (!m || !m.gazes) return;
      m.target = { ...REST };
      m.settled = false;
      kick();
    },
    stop: () => {
      stopped = true;
      halt();
      inView?.disconnect();
      window.clearTimeout(idleTimer);
      idleTimer = 0;
      INTERACTIONS.forEach((type) =>
        window.removeEventListener(type, interact, listen),
      );
      window.removeEventListener("pointermove", onMove);
      root.removeEventListener("mouseleave", onLeavePage);
      window.removeEventListener("blur", onLeavePage);
      window.removeEventListener("click", onPress, capture);
      window.removeEventListener("keydown", onPress, capture);
      endTurbo();
      for (const m of macs) {
        m.el.style.removeProperty("rotate");
        m.el.style.removeProperty("translate");
        m.el.removeAttribute("data-mac-greet");
      }
    },
  };
}

/**
 * RF-27 and T30: Mac's line on arriving at the contact section
 * (`mac.arrive.contact`), next to the launch pad's rocket, each time the pad
 * comes into view (the bubbles never repeat a line twice in a row). Returns
 * the cleanup.
 */
export function contactArrival(bubbles: Bubbles): () => void {
  const rocket = document.querySelector<HTMLElement>(".contact__rocket");
  if (!rocket || !("IntersectionObserver" in window)) return () => {};
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          bubbles.say([LINE_KEYS.arrive.contact], rocket);
        }
      }
    },
    { threshold: 0.6 },
  );
  observer.observe(rocket);
  return () => observer.disconnect();
}
