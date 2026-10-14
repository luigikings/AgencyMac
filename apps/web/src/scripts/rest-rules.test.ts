import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spec 005, D19 (plan 14.2 and 14.5): at rest the page asks for no frames
// (RF-39). ScrollTrigger keeps a frame loop of its own that cannot be switched
// off, and anything hooked to GSAP's ticker keeps it awake, so neither may
// appear in the client scripts.
const dir = fileURLToPath(new URL(".", import.meta.url));

function scripts(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = join(folder, entry.name);
    if (entry.isDirectory()) return scripts(full);
    return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
      ? [full]
      : [];
  });
}

describe("client scripts never keep a frame loop alive", () => {
  const files = scripts(dir);

  it("finds the scripts", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s uses no ScrollTrigger and no gsap.ticker.add", (file) => {
    const code = readFileSync(file, "utf8");
    expect(code).not.toMatch(/gsap\/ScrollTrigger/);
    expect(code).not.toMatch(/ScrollTrigger\./);
    expect(code).not.toMatch(/gsap\.ticker\.add/);
  });
});
