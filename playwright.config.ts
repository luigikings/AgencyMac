import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
// Spec 003 (RF-11, P7): the CI builds once and sets PREBUILT_DIST=1 so the
// web servers only serve that build. Locally (no variable) they build first.
const prebuilt = process.env.PREBUILT_DIST === "1";
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
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4322" },
    },
    {
      name: "control",
      testDir: "apps/control/e2e",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4173" },
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
