import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Plan section 2: the pure modules of src/lib/sky and src/lib/fx do not touch
// the DOM, GSAP, the date or Math.random; the clock and the generator are
// passed in as parameters.
const LIB = fileURLToPath(new URL("../", import.meta.url));
const FORBIDDEN: [string, RegExp][] = [
  ["Math.random", /Math\.random/],
  ["Date", /\bDate\b/],
  ["performance.now", /performance\.now/],
  ["document", /\bdocument\./],
  ["window", /\bwindow\b/],
  ["gsap", /gsap/i],
  ["requestAnimationFrame", /requestAnimationFrame/],
];

// Comments may say "no DOM, no GSAP"; only the code counts.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sources(dir: string): string[] {
  return readdirSync(join(LIB, dir))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => `${dir}/${f}`);
}

describe("sky and fx modules are pure", () => {
  const files = [...sources("sky"), ...sources("fx")];

  it("scans the modules", () => {
    expect(files).toContain("sky/rng.ts");
    expect(files).toContain("sky/star-field.ts");
    expect(files).toContain("fx/fx-config.ts");
  });

  it.each(FORBIDDEN)("uses no %s", (_name, pattern) => {
    const offenders = files.filter((f) =>
      pattern.test(stripComments(readFileSync(join(LIB, f), "utf8"))),
    );
    expect(offenders).toEqual([]);
  });
});
