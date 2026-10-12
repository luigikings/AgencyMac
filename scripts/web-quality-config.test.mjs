import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spec 004, T15: the quality gate of the web asserts the total blocking time,
// and the web's own rules no longer talk about the removed logo cyan. The
// config is read as text: loading it needs the browser of the audit.
const read = (path) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("Lighthouse CI configuration of the web", () => {
  const config = read("../apps/web/lighthouserc.cjs");

  it("asserts a total blocking time of at most 200 ms on the median run", () => {
    expect(config).toMatch(/const MAX_TBT_MS = 200;/);
    expect(config).toMatch(
      /"total-blocking-time":\s*\[\s*"error",\s*\{\s*maxNumericValue: MAX_TBT_MS,\s*aggregationMethod: "median-run"/,
    );
  });

  it("keeps the earlier limits (categories, LCP, CLS, font-display)", () => {
    expect(config).toContain("const MIN_SCORE = 0.9;");
    expect(config).toContain("const MAX_LCP_MS = 2500;");
    expect(config).toContain("const MAX_CLS = 0.1;");
    expect(config).toContain('"font-display"');
    for (const category of [
      "performance",
      "accessibility",
      "best-practices",
      "seo",
    ]) {
      expect(config).toContain(`"categories:${category}"`);
    }
  });
});

describe("apps/web/AGENTS.md", () => {
  const rules = read("../apps/web/AGENTS.md");

  it("no longer mentions the logo cyan or its replacement", () => {
    expect(rules).not.toMatch(/cyan|cian|00E5FF|provisional/i);
  });

  it("documents the home page: assets, BrandPicture, CTA, sitemap and JSON-LD", () => {
    for (const topic of [
      "BrandPicture",
      "CTA_TARGET",
      "assets:build",
      "sitemap.xml",
      "robots.txt",
      "JSON-LD",
      "Assets/",
      "TBT",
    ]) {
      expect(rules, topic).toContain(topic);
    }
  });

  // Phase B of spec 004 arrived: the only client JavaScript is the deferred
  // animation layer, with its budget and GSAP's licence notice documented.
  it("documents the deferred animation layer as the only client JavaScript", () => {
    expect(rules).toMatch(/único JavaScript de cliente/);
    expect(rules).toMatch(/≤ 3 KB de JS antes de `load`/);
    expect(rules).toMatch(/@license/);
  });
});
