// Lighthouse CI configuration for the public website (RF-17).
// Audits the production build of `/` and `/en/` (RF-24) served locally with Playwright's
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
// Core Web Vitals (RNF-2), asserted on the median run of each URL.
const MAX_LCP_MS = 2500;
const MAX_CLS = 0.1;
// Total blocking time (the lab indicator of INP): at most 300 ms with the
// effects layer of spec 005 (plan section 8, confirmed in T2; 200 ms in 004).
const MAX_TBT_MS = 300;
// Spec 005, T32: performance at 0.92 or more in the median run (internal
// target of plan section 8; the floor of the constitution stays at 0.9 for
// the other three categories).
const MIN_PERFORMANCE = 0.92;
const assertCategory = [
  "error",
  { minScore: MIN_SCORE, aggregationMethod: "median-run" },
];

module.exports = {
  ci: {
    collect: {
      startServerCommand: "pnpm preview",
      startServerReadyPattern: "localhost:4322",
      url: ["http://localhost:4322/", "http://localhost:4322/en/"],
      numberOfRuns: 3,
      chromePath,
      // In CI (Ubuntu 24.04 restricts unprivileged sandboxes) Chromium needs
      // --no-sandbox; locally the flags stay as they were (spec 003, P10).
      settings: {
        chromeFlags: process.env.CI ? "--headless --no-sandbox" : "--headless",
      },
    },
    assert: {
      assertions: {
        "categories:performance": [
          "error",
          { minScore: MIN_PERFORMANCE, aggregationMethod: "median-run" },
        ],
        "categories:accessibility": assertCategory,
        "categories:best-practices": assertCategory,
        "categories:seo": assertCategory,
        "largest-contentful-paint": [
          "error",
          { maxNumericValue: MAX_LCP_MS, aggregationMethod: "median-run" },
        ],
        "cumulative-layout-shift": [
          "error",
          { maxNumericValue: MAX_CLS, aggregationMethod: "median-run" },
        ],
        "total-blocking-time": [
          "error",
          { maxNumericValue: MAX_TBT_MS, aggregationMethod: "median-run" },
        ],
        // RF-19: text stays visible while brand fonts load. In Lighthouse
        // 12.6.1 the scored audit is `font-display` (`font-display-insight`
        // is null), and it must pass outright.
        "font-display": [
          "error",
          { minScore: 1, aggregationMethod: "median-run" },
        ],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/reports",
    },
  },
};
