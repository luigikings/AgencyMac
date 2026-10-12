// Helpers that read CSS text (spec 004, RF-32, RF-33, RF-38). Pure functions,
// used only by tests: the website itself ships plain CSS.

/**
 * @keyframes of pure decorations (halo, aura, sparkles, flame, orbit ring,
 * planet halo pulse) that may start or end at opacity 0 (spec 005, plan
 * section 5). No text lives in them. Any other @keyframes with opacity 0 is a
 * rule that could hide content and fails the test.
 */
export const OPACITY_ZERO_KEYFRAMES: readonly string[] = [
  "hero-halo",
  "hero-aura",
  "hero-sparkle",
  "hero-flame",
  "orbit-ring",
  "planet-halo-pulse",
  // Sparks of Mac's landing (R1): small circles, no text.
  "hero-spark",
];

const KEYFRAMES_HEAD = /@keyframes\s+([\w-]+)\s*$/;

type KeyframesBlock = {
  name: string;
  /** Text between the braces of the @keyframes. */
  body: string;
  /** Index of the "@" and of the character after the closing brace. */
  start: number;
  end: number;
  /** Inside a `prefers-reduced-motion` media query. */
  guarded: boolean;
};

/** Every @keyframes block of `css`, with whether it sits under a motion query. */
function scanKeyframes(css: string): KeyframesBlock[] {
  const blocks: KeyframesBlock[] = [];
  const guards: boolean[] = [false];
  let bufferStart = 0;
  let i = 0;
  while (i < css.length) {
    const char = css[i];
    if (char === "{") {
      const head = css.slice(bufferStart, i);
      const match = KEYFRAMES_HEAD.exec(head.trimEnd());
      if (match) {
        let depth = 1;
        let j = i + 1;
        while (j < css.length && depth > 0) {
          if (css[j] === "{") depth++;
          else if (css[j] === "}") depth--;
          j++;
        }
        blocks.push({
          name: match[1]!,
          body: css.slice(i + 1, j - 1),
          start: bufferStart + head.lastIndexOf("@keyframes"),
          end: j,
          guarded: guards[guards.length - 1]!,
        });
        i = j;
        bufferStart = j;
        continue;
      }
      guards.push(guards[guards.length - 1]! || MOTION_QUERY.test(head));
      bufferStart = i + 1;
    } else if (char === ";") {
      bufferStart = i + 1;
    } else if (char === "}") {
      if (guards.length > 1) guards.pop();
      bufferStart = i + 1;
    }
    i++;
  }
  return blocks;
}

/**
 * Declarations that hide content on load: opacity 0, visibility hidden,
 * display none. `opacity: 0` inside the @keyframes of OPACITY_ZERO_KEYFRAMES
 * (pure decorations) is allowed.
 */
export function findHidingRules(css: string): string[] {
  const patterns = [
    /opacity\s*:\s*0(?![.\d])/g,
    /visibility\s*:\s*hidden/g,
    /display\s*:\s*none/g,
  ];
  let text = css;
  const allowed = scanKeyframes(css)
    .filter((block) => OPACITY_ZERO_KEYFRAMES.includes(block.name))
    .sort((a, b) => b.start - a.start);
  for (const block of allowed) {
    text = text.slice(0, block.start) + text.slice(block.end);
  }
  return patterns.flatMap((pattern) => text.match(pattern) ?? []);
}

/** `filter: blur(...)` (or backdrop-filter) written inside a @keyframes. */
export function findBlurInKeyframes(css: string): string[] {
  return scanKeyframes(css).flatMap(
    (block) =>
      block.body.match(/(?:backdrop-)?filter\s*:[^;}]*blur[^;}]*/g) ?? [],
  );
}

/** Names of the @keyframes that are not under a `prefers-reduced-motion` query. */
export function findUnguardedKeyframes(css: string): string[] {
  return scanKeyframes(css)
    .filter((block) => !block.guarded)
    .map((block) => block.name);
}

// A declaration that starts or allows motion in CSS.
const MOTION_DECLARATION =
  /(?:^|[\s{])(?:transition|animation)(?:-[a-z-]+)?\s*:|scroll-behavior\s*:\s*smooth/;
const MOTION_QUERY = /@media[^{]*prefers-reduced-motion/;

/**
 * Motion declarations (transitions, animations, smooth scroll) that are not
 * inside a `prefers-reduced-motion` media query. Motion in CSS must only
 * exist under `no-preference` (or be switched off under `reduce`).
 */
export function findUnguardedMotion(css: string): string[] {
  const found: string[] = [];
  const guards: boolean[] = [false];
  let buffer = "";

  const check = () => {
    const text = buffer.trim();
    if (text && !guards[guards.length - 1] && MOTION_DECLARATION.test(text)) {
      found.push(text);
    }
    buffer = "";
  };

  for (const char of css) {
    if (char === "{") {
      guards.push(guards[guards.length - 1]! || MOTION_QUERY.test(buffer));
      buffer = "";
    } else if (char === ";") {
      check();
    } else if (char === "}") {
      check();
      if (guards.length > 1) guards.pop();
    } else {
      buffer += char;
    }
  }
  return found;
}

/** Contents of every `<style>` block of an `.astro` file. */
export function extractStyleBlocks(source: string): string {
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join("\n");
}
