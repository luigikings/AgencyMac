import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  OPACITY_ZERO_KEYFRAMES,
  extractStyleBlocks,
  findBlurInKeyframes,
  findHidingRules,
  findUnguardedKeyframes,
  findUnguardedMotion,
} from "./motion-css";

// RF-32, RF-33, RF-38: no stylesheet rule hides content when the page loads,
// motion in CSS only exists for visitors who allow it, and reduced motion
// switches everything off.
const SRC = fileURLToPath(new URL("../", import.meta.url));

function styleSources(): { file: string; css: string }[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => /\.(astro|css)$/.test(file))
    .map((file) => ({
      file: relative(SRC, file).split(sep).join("/"),
      css: file.endsWith(".astro")
        ? extractStyleBlocks(readFileSync(file, "utf8"))
        : readFileSync(file, "utf8"),
    }));
}

describe("findHidingRules", () => {
  it.each([
    "a { opacity: 0; }",
    "a{opacity:0}",
    "a { visibility: hidden }",
    "a { display: none; }",
    "a { opacity: 0 !important; }",
  ])("flags %j", (css) => {
    expect(findHidingRules(css).length).toBeGreaterThan(0);
  });

  it.each([
    "a { opacity: 1; }",
    "a { opacity: 0.5; }",
    "a { opacity: 0.05; }",
    "a { visibility: visible; }",
    "a { display: flex; }",
  ])("allows %j", (css) => {
    expect(findHidingRules(css)).toEqual([]);
  });
});

describe("findUnguardedMotion", () => {
  it.each([
    "a { transition: opacity 0.3s; }",
    "a { animation: spin 1s infinite; }",
    "html { scroll-behavior: smooth; }",
    "a { animation-name: spin; }",
    "a { transition-duration: 1s; }",
  ])("flags %j outside a no-preference query", (css) => {
    expect(findUnguardedMotion(css).length).toBeGreaterThan(0);
  });

  it("allows motion inside (prefers-reduced-motion: no-preference)", () => {
    const css = `@media (prefers-reduced-motion: no-preference) {
      a { transition: opacity 0.3s; }
      html { scroll-behavior: smooth; }
    }`;
    expect(findUnguardedMotion(css)).toEqual([]);
  });

  it("allows switching motion off inside the reduced query", () => {
    const css = `@media (prefers-reduced-motion: reduce) {
      *, ::before, ::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
    }`;
    expect(findUnguardedMotion(css)).toEqual([]);
  });

  it("flags motion that follows a closed no-preference query", () => {
    const css = `@media (prefers-reduced-motion: no-preference) { a { transition: none; } }
      b { transition: opacity 1s; }`;
    expect(findUnguardedMotion(css).length).toBe(1);
  });
});

describe("the website styles", () => {
  const sources = styleSources();

  it("scans the layout and the components", () => {
    const files = sources.map((s) => s.file);
    expect(files).toContain("layouts/BaseLayout.astro");
    expect(files).toContain("components/home/ServicesSection.astro");
  });

  it("no rule hides content on load", () => {
    for (const { file, css } of sources) {
      expect(findHidingRules(css), file).toEqual([]);
    }
  });

  it("motion in CSS only exists for visitors who allow it", () => {
    for (const { file, css } of sources) {
      expect(findUnguardedMotion(css), file).toEqual([]);
    }
  });

  it("the base layout switches transitions, animations and smooth scroll off with reduced motion", () => {
    const layout = sources.find((s) => s.file === "layouts/BaseLayout.astro")!;
    const block = layout.css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n {2}\}/,
    );
    expect(block, "missing reduced-motion block").not.toBeNull();
    expect(block![0]).toMatch(/transition:\s*none\s*!important/);
    expect(block![0]).toMatch(/animation:\s*none\s*!important/);
    expect(block![0]).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });
});

// Spec 005 (T8): the sky adds @keyframes. Opacity 0 is only allowed inside
// the keyframes of pure decorations; blur never animates; every @keyframes
// lives under `no-preference`.
describe("findHidingRules with keyframes (spec 005)", () => {
  it.each(OPACITY_ZERO_KEYFRAMES)(
    "allows opacity 0 in @keyframes %s",
    (name) => {
      const css = `@keyframes ${name} { from { opacity: 0; } to { opacity: 1; } }`;
      expect(findHidingRules(css)).toEqual([]);
    },
  );

  it("lists the allowed decorations of the plan", () => {
    expect([...OPACITY_ZERO_KEYFRAMES]).toEqual([
      "hero-halo",
      "hero-aura",
      "hero-sparkle",
      "hero-flame",
      "orbit-ring",
      "planet-halo-pulse",
    ]);
  });

  it("flags opacity 0 in any other @keyframes", () => {
    const css = `@keyframes text-in { from { opacity: 0; } to { opacity: 1; } }`;
    expect(findHidingRules(css).length).toBeGreaterThan(0);
  });

  it("still flags opacity 0 on a plain rule next to an allowed keyframes", () => {
    const css = `@keyframes hero-halo { from { opacity: 0; } }
      .a { opacity: 0; }`;
    expect(findHidingRules(css)).toEqual(["opacity: 0"]);
  });

  it("allows opacity 0 inside an allowed keyframes under a media query", () => {
    const css = `@media (prefers-reduced-motion: no-preference) {
      @keyframes hero-flame { 0% { opacity: 0; } 100% { opacity: 0; } }
    }`;
    expect(findHidingRules(css)).toEqual([]);
  });

  it("does not let the allowance leak past the end of the keyframes", () => {
    const css = `@keyframes hero-halo { from { opacity: 0; } }
      @keyframes other { from { opacity: 0; } }`;
    expect(findHidingRules(css)).toEqual(["opacity: 0"]);
  });
});

describe("findBlurInKeyframes (spec 005)", () => {
  it.each([
    "@keyframes a { from { filter: blur(0); } to { filter: blur(8px); } }",
    "@keyframes a { 50% { filter: blur(2px) brightness(1.2); } }",
    "@keyframes a { 50% { backdrop-filter: blur(4px); } }",
  ])("flags %j", (css) => {
    expect(findBlurInKeyframes(css).length).toBeGreaterThan(0);
  });

  it("allows other filters and a static blur outside keyframes", () => {
    expect(
      findBlurInKeyframes(
        "@keyframes a { to { filter: brightness(1.2); } } .b { filter: blur(2px); }",
      ),
    ).toEqual([]);
  });
});

describe("findUnguardedKeyframes (spec 005)", () => {
  it("flags @keyframes outside a no-preference query", () => {
    expect(
      findUnguardedKeyframes("@keyframes spin { to { transform: none; } }"),
    ).toEqual(["spin"]);
  });

  it("allows @keyframes inside (prefers-reduced-motion: no-preference)", () => {
    const css = `@media (prefers-reduced-motion: no-preference) {
      @keyframes spin { to { transform: none; } }
    }`;
    expect(findUnguardedKeyframes(css)).toEqual([]);
  });

  it("flags the ones that come after the query closes", () => {
    const css = `@media (prefers-reduced-motion: no-preference) { @keyframes a { to { opacity: 1; } } }
      @keyframes b { to { opacity: 1; } }`;
    expect(findUnguardedKeyframes(css)).toEqual(["b"]);
  });
});

describe("the website styles and the keyframes (spec 005)", () => {
  const sources = styleSources();

  it("no @keyframes blurs and every one is under no-preference", () => {
    for (const { file, css } of sources) {
      expect(findBlurInKeyframes(css), file).toEqual([]);
      expect(findUnguardedKeyframes(css), file).toEqual([]);
    }
  });
});
