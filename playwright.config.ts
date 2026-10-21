import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Spec 003 (RF-11, P7): the CI builds once and sets PREBUILT_DIST=1 so the
// web servers only serve that build. Locally (no variable) they build first.
const prebuilt = process.env.PREBUILT_DIST === "1";
// Titles of the tests that measure time (interaction latency, the frame cost
// of the effects and, spec 005 validation round 1, the long tasks with the
// CPU x4), which get a project of their own: other workers would skew them.
const INTERACTION_LATENCY =
  /interaction latency|frame cost|long tasks with the CPU/;
const serve = (app: string) =>
  prebuilt
    ? `pnpm --filter ${app} preview`
    : `pnpm --filter ${app} build && pnpm --filter ${app} preview`;

// Shared Playwright configuration: Chromium only (Playwright's own build,
// shared with Lighthouse CI). Each app has its own project and webServer
// entry that builds the app and serves the production build. The web preview
// uses port 4322 (scripts/serve-static.mjs, fails if the port is busy) so a
// running `astro dev` on 4321 is never mistaken for the build under test.
// Locally an already running preview is reused; in CI an occupied port is an
// error.
export default defineConfig({
  forbidOnly: isCI,
  reporter: isCI ? "github" : "list",
  use: { ...devices["Desktop Chrome"] },
  projects: [
    {
      name: "web",
      testDir: "apps/web/e2e",
      grepInvert: INTERACTION_LATENCY,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4322" },
    },
    {
      name: "control",
      testDir: "apps/control/e2e",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4173" },
    },
    // The interaction latency proxy (budget.spec.ts, RNF-4) measures until
    // the next frame is shown. Headless Chromium composites in software, so
    // with the other workers running the frames of the page wait for CPU and
    // the measure includes that wait (spec 005, note under T15). It runs
    // alone, after the rest, with the same 200 ms limit. The frame cost of
    // the effects (fx.spec.ts, plan section 8) is measured here too.
    {
      name: "web-latency",
      testDir: "apps/web/e2e",
      grep: INTERACTION_LATENCY,
      dependencies: ["web", "control"],
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4322" },
    },
  ],
  webServer: [
    {
      command: serve("web"),
      url: "http://localhost:4322",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: serve("control"),
      url: "http://localhost:4173",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
