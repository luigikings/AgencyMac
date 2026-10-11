// Lighthouse CI configuration for the public website (RF-17).
// Audits the production build served locally with Playwright's
// chrome-headless-shell (no system Chrome/Edge; the full Chromium build does
// not start on the developer's Windows machine), mobile profile (Lighthouse
// default), 3 runs, median run asserted against a 0.9 minimum in the 4
// categories. Reports stay on disk in .lighthouseci/ (git-ignored); never
// uploaded to public storage.
const { existsSync } = require("node:fs");
const {
  browserStatus,
  locateHeadlessShell,
} = require("../../scripts/check-browser.mjs");

const chromePath = locateHeadlessShell();
const status = browserStatus({
  executablePath: chromePath,
  exists: chromePath !== "" && existsSync(chromePath),
});
if (!status.ok) throw new Error(status.message);

const MIN_SCORE = 0.9;
const assertCategory = [
  "error",
  { minScore: MIN_SCORE, aggregationMethod: "median-run" },
];

module.exports = {
  ci: {
    collect: {
      startServerCommand: "pnpm preview",
      startServerReadyPattern: "localhost:4322",
      url: ["http://localhost:4322/"],
      numberOfRuns: 3,
      chromePath,
      settings: { chromeFlags: "--headless" },
    },
    assert: {
      assertions: {
        "categories:performance": assertCategory,
        "categories:accessibility": assertCategory,
        "categories:best-practices": assertCategory,
        "categories:seo": assertCategory,
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/reports",
    },
  },
};
