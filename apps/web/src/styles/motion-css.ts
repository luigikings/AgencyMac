// Helpers that read CSS text (spec 004, RF-32, RF-33, RF-38). Pure functions,
// used only by tests: the website itself ships plain CSS.

/** Declarations that hide content on load: opacity 0, visibility hidden, display none. */
export function findHidingRules(css: string): string[] {
  const patterns = [
    /opacity\s*:\s*0(?![.\d])/g,
    /visibility\s*:\s*hidden/g,
    /display\s*:\s*none/g,
  ];
  return patterns.flatMap((pattern) => css.match(pattern) ?? []);
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
