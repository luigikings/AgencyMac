import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

// RF-11, RNF-9 (spec 003, plan P7): in the CI the build happens once; with
// PREBUILT_DIST=1 the Playwright web servers only serve that build. Without
// the variable (local use) they still build first.
const require = createRequire(import.meta.url);

async function loadPlaywrightConfig(env) {
  vi.resetModules();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return (await import("../playwright.config.ts")).default;
}

function loadLighthouseConfig(env) {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  const path = require.resolve("../apps/web/lighthouserc.cjs");
  delete require.cache[path];
  return require(path);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("playwright.config.ts web servers", () => {
  it("only serve the existing builds with PREBUILT_DIST=1", async () => {
    const config = await loadPlaywrightConfig({ PREBUILT_DIST: "1" });
    expect(config.webServer.map(({ command }) => command)).toEqual([
      "pnpm --filter web preview",
      "pnpm --filter control preview",
    ]);
  });

  it.each(["", "0"])(
    "build and then serve when PREBUILT_DIST is %j",
    async (value) => {
      const config = await loadPlaywrightConfig({ PREBUILT_DIST: value });
      expect(config.webServer.map(({ command }) => command)).toEqual([
        "pnpm --filter web build && pnpm --filter web preview",
        "pnpm --filter control build && pnpm --filter control preview",
      ]);
    },
  );

  it("keep the same ports either way", async () => {
    for (const value of ["1", ""]) {
      const config = await loadPlaywrightConfig({ PREBUILT_DIST: value });
      expect(config.webServer.map(({ url }) => url)).toEqual([
        "http://localhost:4322",
        "http://localhost:4173",
      ]);
    }
  });
});

describe("apps/web/lighthouserc.cjs Chromium flags", () => {
  it("adds --no-sandbox only in CI (Ubuntu 24.04 restricts the sandbox)", () => {
    expect(
      loadLighthouseConfig({ CI: "true" }).ci.collect.settings.chromeFlags,
    ).toBe("--headless --no-sandbox");
  });

  it("keeps the local flags unchanged", () => {
    expect(
      loadLighthouseConfig({ CI: "" }).ci.collect.settings.chromeFlags,
    ).toBe("--headless");
  });
});
