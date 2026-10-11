import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(`${root}${path}`, "utf8"));

// Spec 003, section 3 of the plan: the CI workflow.
const WORKFLOW_PATH = ".github/workflows/ci.yml";
const workflowText = readFileSync(`${root}${WORKFLOW_PATH}`, "utf8");
const workflow = parse(workflowText);
const { check, deploy } = workflow.jobs ?? {};

// Approved actions (RNF-3), pinned by commit SHA with the version alongside.
const APPROVED_ACTIONS = {
  "actions/checkout": ["3d3c42e5aac5ba805825da76410c181273ba90b1", "v7.0.1"],
  "actions/setup-node": ["949feb2413d6458794dcd2491c4babbbce0c15c1", "v7.1.0"],
  "actions/upload-artifact": [
    "cf430e030ddbb5b0abf93d22962f4752f3646cd9",
    "v7.0.2",
  ],
  "actions/download-artifact": [
    "9000827ccba6bdab643e8b6fd33ac0654aef8333",
    "v8.0.2",
  ],
};
const SECRET_NAMES = [
  ["CLOUDFLARE", "API", "TOKEN"].join("_"),
  ["CLOUDFLARE", "ACCOUNT", "ID"].join("_"),
  ["CF", "WORKERS", "SUBDOMAIN"].join("_"),
];
const READY = "steps.preflight.outputs.ready == 'true'";

const runs = (job) => job.steps.map((step) => step.run ?? "");
const indexOfRun = (job, pattern) =>
  job.steps.findIndex((step) => pattern.test(step.run ?? ""));
const usesSteps = (job, action) =>
  job.steps.filter((step) => step.uses?.startsWith(`${action}@`));
const BUILD =
  /\bpnpm\s+(?:-r\s+)?build\b|--filter\s+\S+\s+build\b|\bastro build\b|\bvite build\b/;

describe("CI workflow — triggers and permissions", () => {
  it("runs only on push and pull_request to main (RF-3, RF-28, RF-29)", () => {
    expect(workflow.on).toEqual({
      push: { branches: ["main"] },
      pull_request: { branches: ["main"] },
    });
  });

  it.each([
    "pull_request_target",
    "workflow_run",
    "workflow_dispatch",
    "schedule",
  ])("never uses %s", (trigger) => {
    expect(workflow.on).not.toHaveProperty(trigger);
    expect(workflowText).not.toContain(trigger);
  });

  it("grants only contents: read, with no write in any job (RF-32)", () => {
    expect(workflow.permissions).toEqual({ contents: "read" });
    for (const job of Object.values(workflow.jobs)) {
      expect(JSON.stringify(job.permissions ?? {})).not.toMatch(/write/);
    }
  });

  it("has exactly the check and deploy jobs on a fixed runner", () => {
    expect(Object.keys(workflow.jobs).sort()).toEqual(["check", "deploy"]);
    expect(check["runs-on"]).toBe("ubuntu-24.04");
    expect(deploy["runs-on"]).toBe("ubuntu-24.04");
  });
});

describe("CI workflow — check job", () => {
  it("sets up Node from .node-version and pnpm with corepack (RF-30)", () => {
    const [setup] = usesSteps(check, "actions/setup-node");
    expect(setup.with["node-version-file"]).toBe(".node-version");
    expect(runs(check).join("\n")).toMatch(/corepack enable/);
    expect(runs(check).join("\n")).toMatch(/pnpm --version/);
    expect(runs(check).join("\n")).toMatch(/node --version/);
  });

  it("checks out without persisting credentials", () => {
    for (const job of [check, deploy]) {
      const [checkout] = usesSteps(job, "actions/checkout");
      expect(checkout.with["persist-credentials"]).toBe(false);
    }
  });

  it("runs every step in order with a single build (RF-2, RF-11, RF-30, RF-31)", () => {
    const order = [
      /^pnpm install --frozen-lockfile$/,
      /^pnpm browsers:install --with-deps$/,
      /^pnpm lint$/,
      /^pnpm format:check$/,
      /^pnpm build$/,
      /^pnpm test$/,
      /^node scripts\/check-browser\.mjs && pnpm --filter web quality$/,
    ].map((pattern) => indexOfRun(check, pattern));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(runs(check).filter((run) => BUILD.test(run))).toEqual([
      "pnpm build",
    ]);
  });

  it("tests and audits the prebuilt dist without building again (RF-11)", () => {
    const test = check.steps[indexOfRun(check, /^pnpm test$/)];
    expect(String(test.env?.PREBUILT_DIST)).toBe("1");
    expect(runs(check)).not.toContain("pnpm quality");
  });

  it("uploads only apps/web/dist, only on push (RF-6, RF-34)", () => {
    const uploads = Object.values(workflow.jobs).flatMap((job) =>
      usesSteps(job, "actions/upload-artifact"),
    );
    expect(uploads).toHaveLength(1);
    const [upload] = uploads;
    expect(usesSteps(check, "actions/upload-artifact")).toHaveLength(1);
    expect(upload.if).toBe("github.event_name == 'push'");
    expect(upload.with).toMatchObject({
      name: "web-dist",
      path: "apps/web/dist",
      "if-no-files-found": "error",
    });
    expect(check.steps.indexOf(upload)).toBe(check.steps.length - 1);
  });

  it("cancels older runs of the same branch (RF-33)", () => {
    expect(workflow.concurrency).toBeUndefined();
    expect(check.concurrency["cancel-in-progress"]).toBe(true);
    expect(check.concurrency.group).toMatch(/^check-/);
  });

  it("never sees a secret (RF-35)", () => {
    expect(JSON.stringify(check)).not.toContain("secrets.");
    const topLevel = Object.fromEntries(
      Object.entries(workflow).filter(([key]) => key !== "jobs"),
    );
    expect(JSON.stringify(topLevel)).not.toContain("secrets.");
  });
});

describe("CI workflow — deploy job", () => {
  const preflightIndex = deploy.steps.findIndex(
    (step) => step.id === "preflight",
  );

  it("runs only after the whole check, on push to main (RF-1, RF-2, RF-3)", () => {
    expect([deploy.needs].flat()).toEqual(["check"]);
    expect(deploy.if).toBe(
      "github.event_name == 'push' && github.ref == 'refs/heads/main'",
    );
  });

  it("uses the staging environment without a URL (RF-35, RF-40)", () => {
    expect(deploy.environment).toBe("staging");
  });

  it("runs in series and is never cancelled (RF-33)", () => {
    expect(deploy.concurrency).toEqual({
      group: "deploy-staging",
      "cancel-in-progress": false,
    });
  });

  it("disables wrangler telemetry", () => {
    expect(String(deploy.env?.WRANGLER_SEND_METRICS)).toBe("false");
  });

  it("starts with the preflight check that receives the secrets (RF-4, RF-37)", () => {
    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    const preflight = deploy.steps[preflightIndex];
    expect(preflight.run).toBe("node scripts/staging/preflight.mjs");
    expect(Object.keys(preflight.env).sort()).toEqual([...SECRET_NAMES].sort());
    expect(
      deploy.steps.slice(0, preflightIndex).every((step) => step.uses),
    ).toBe(true);
  });

  it("skips every later step unless the preflight is ready (RF-4, RF-37)", () => {
    const later = deploy.steps.slice(preflightIndex + 1);
    expect(later.length).toBeGreaterThan(0);
    for (const step of later) expect(step.if, step.name).toBe(READY);
  });

  it("deploys the downloaded build without building (RF-10, RF-11)", () => {
    expect(runs(deploy).some((run) => BUILD.test(run))).toBe(false);
    const [download] = usesSteps(deploy, "actions/download-artifact");
    expect(download.with).toEqual({ name: "web-dist", path: "apps/web/dist" });
    const copy = indexOfRun(deploy, /^pnpm --filter web staging:copy$/);
    const ship = indexOfRun(deploy, /^pnpm --filter web staging:deploy$/);
    const smoke = indexOfRun(
      deploy,
      /^pnpm smoke --version \$\{\{ github\.sha \}\}$/,
    );
    expect(deploy.steps.indexOf(download)).toBeLessThan(copy);
    expect(copy).toBeLessThan(ship);
    expect(ship).toBeLessThan(smoke);
    expect(deploy.steps[copy].env).toEqual({ VERSION: "${{ github.sha }}" });
  });

  it("gives each secret only to preflight, deploy and smoke (RF-35)", () => {
    expect(JSON.stringify(deploy.env ?? {})).not.toContain("secrets.");
    for (const step of deploy.steps) {
      const env = JSON.stringify(step.env ?? {});
      const allowed =
        step.id === "preflight" ||
        /staging:deploy|^pnpm smoke/.test(step.run ?? "");
      if (!allowed) expect(env, step.name).not.toContain("secrets.");
      expect(JSON.stringify(step.with ?? {})).not.toContain("secrets.");
      for (const [name, value] of Object.entries(step.env ?? {})) {
        if (String(value).includes("secrets.")) {
          expect(value).toBe(`\${{ secrets.${name} }}`);
          expect(SECRET_NAMES).toContain(name);
        }
      }
    }
    const smoke = deploy.steps[indexOfRun(deploy, /^pnpm smoke/)];
    expect(Object.keys(smoke.env)).toEqual([SECRET_NAMES[2]]);
  });

  it("builds the URL from the secret, never from step outputs (RF-12, RF-39)", () => {
    expect(runs(deploy).join("\n")).not.toContain("--url");
    const outputs = JSON.stringify(deploy).match(/[\w.-]*outputs\.[\w-]+/g);
    expect(
      outputs.every((ref) => ref === "steps.preflight.outputs.ready"),
    ).toBe(true);
  });

  it("has a mandatory smoke test and no rollback (RF-5)", () => {
    expect(workflowText).not.toContain("continue-on-error");
    expect(workflowText.toLowerCase()).not.toMatch(/rollback/);
  });
});

describe("CI workflow — pinned actions (RNF-3)", () => {
  const usesLines = workflowText
    .split(/\r?\n/)
    .filter((line) => /^\s*-?\s*uses:/.test(line));

  it("uses only approved actions", () => {
    expect(usesLines.length).toBeGreaterThan(0);
    for (const line of usesLines) {
      const [, action] = /uses:\s*([^@\s]+)@/.exec(line) ?? [];
      expect(Object.keys(APPROVED_ACTIONS), line).toContain(action);
    }
  });

  it("pins every action to its 40-hex SHA with the version in a comment", () => {
    for (const line of usesLines) {
      const match =
        /uses:\s*([^@\s]+)@([0-9a-f]{40})\s+#\s*(v\d+\.\d+\.\d+)\s*$/.exec(
          line,
        );
      expect(match, line).not.toBeNull();
      const [, action, sha, version] = match;
      expect([sha, version], line).toEqual(APPROVED_ACTIONS[action]);
    }
  });
});

// RF-6, RF-7, RF-17 to RF-24: the staging Worker only serves the staging copy
// of the public website, on workers.dev, with no routes, custom domains,
// account id or variables in the repository.
describe("apps/web/wrangler.json", () => {
  const config = readJson("apps/web/wrangler.json");

  it("names the staging Worker and uses a fixed compatibility date", () => {
    expect(config.name).toBe("agencymac-staging");
    expect(config.compatibility_date).toBe("2026-09-01");
  });

  it("publishes on workers.dev only, without preview URLs", () => {
    expect(config.workers_dev).toBe(true);
    expect(config.preview_urls).toBe(false);
  });

  it("serves the staging copy as static assets with 404 pages and trailing slashes", () => {
    expect(config.assets).toEqual({
      directory: "./.staging",
      not_found_handling: "404-page",
      html_handling: "auto-trailing-slash",
    });
  });

  it.each([
    "main",
    "routes",
    "route",
    "custom_domains",
    "account_id",
    "vars",
    "env",
  ])("has no %s", (key) => {
    expect(config).not.toHaveProperty(key);
  });

  it("has nothing else", () => {
    expect(Object.keys(config).sort()).toEqual([
      "assets",
      "compatibility_date",
      "name",
      "preview_urls",
      "workers_dev",
    ]);
  });
});
