import { describe, expect, it } from "vitest";
import { findLeaks, formatLeak } from "./leaks.mjs";

// Real-looking hosts and secret names are built at run time so this file
// never trips the repository leak check (scripts/no-leaks.test.mjs) itself.
const host = (...labels) => [...labels, "workers", "dev"].join(".");
const TOKEN = ["CLOUDFLARE", "API", "TOKEN"].join("_");
const ACCOUNT = ["CLOUDFLARE", "ACCOUNT", "ID"].join("_");
const SUBDOMAIN = ["CF", "WORKERS", "SUBDOMAIN"].join("_");

const leaksIn = (content, path = "docs/example.md") =>
  findLeaks([{ path, content }]);

describe("findLeaks — rule (a): workers.dev hosts", () => {
  it.each([
    ["an account subdomain", host("ejemplo123")],
    ["the worker host without subdomain", host("agencymac-staging")],
    ["the full staging host", host("agencymac-staging", "acme-42")],
    ["a host inside a URL", `https://${host("agencymac-staging", "x")}/en/`],
    ["an upper-case host", host("EJEMPLO123").toUpperCase()],
  ])("fails on %s", (_label, text) => {
    expect(leaksIn(`See ${text} here`)).toEqual([
      { path: "docs/example.md", line: 1, rule: "workers-dev" },
    ]);
  });

  it.each([
    "agencymac-staging.<subdominio>.workers.dev",
    "<subdominio de la cuenta>.workers.dev",
    "*.workers.dev",
    "the workers.dev domain",
  ])("accepts the placeholder %s", (text) => {
    expect(leaksIn(`Open ${text} in the panel`)).toEqual([]);
  });

  it("reports the right line and one entry per line", () => {
    const content = ["# Title", "", `${host("a")} and ${host("b")}`].join("\n");
    expect(leaksIn(content)).toEqual([
      { path: "docs/example.md", line: 3, rule: "workers-dev" },
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(leaksIn(`ok\r\n${host("a")}\r\n`)).toEqual([
      { path: "docs/example.md", line: 2, rule: "workers-dev" },
    ]);
  });
});

describe("findLeaks — rule (b): secrets assigned to a value", () => {
  it.each([TOKEN, ACCOUNT, SUBDOMAIN])("fails when %s has a value", (name) => {
    for (const line of [
      `${name}=abc`,
      `${name}: abc`,
      `${name} = 'xyz'`,
      `export ${name}="abc123"`,
      `  ${name}: \${{ secrets.OTHER_SECRET }}`,
    ]) {
      expect(leaksIn(line), line).toEqual([
        { path: "docs/example.md", line: 1, rule: "secret-value" },
      ]);
    }
  });

  it.each([TOKEN, ACCOUNT, SUBDOMAIN])(
    "accepts references, empty values, placeholders and mentions of %s",
    (name) => {
      for (const line of [
        `${name}: \${{ secrets.${name} }}`,
        `  ${name}: "\${{secrets.${name}}}"`,
        `${name}=`,
        `${name}=""`,
        `${name}="<token>"`,
        `${name}: <valor del panel>`,
        `Create the \`${name}\` secret in GitHub.`,
        `names: ["${name}"],`,
        `if: env.${name} == ''`,
      ]) {
        expect(leaksIn(line), line).toEqual([]);
      }
    },
  );

  it("never includes the secret value in the result", () => {
    const [leak] = leaksIn(`${TOKEN}=supersecretvalue`);
    expect(JSON.stringify(leak)).not.toContain("supersecretvalue");
    expect(formatLeak(leak)).toBe("docs/example.md:1 (secret-value)");
  });
});

describe("findLeaks — rule (c): forbidden files", () => {
  it.each([
    ".env",
    "apps/web/.env",
    ".env.local",
    "apps/control/.env.production",
    ".dev.vars",
    "apps/web/.dev.vars",
    ".wrangler/state/v3/cache.json",
    "apps/web/.wrangler/tmp/bundle.js",
    "apps\\web\\.env",
  ])("fails on %s", (path) => {
    expect(findLeaks([{ path, content: "" }])).toEqual([
      { path: path.replaceAll("\\", "/"), line: 1, rule: "env-file" },
    ]);
  });

  it.each([
    ".env.example",
    "apps/web/.env.example",
    "apps/web/wrangler.json",
    "docs/wrangler.md",
    "scripts/check-env.mjs",
  ])("accepts %s", (path) => {
    expect(findLeaks([{ path, content: "" }])).toEqual([]);
  });
});

describe("findLeaks — several files", () => {
  it("returns an empty list for clean files", () => {
    expect(
      findLeaks([
        { path: "a.md", content: "hello" },
        { path: "b.yml", content: `${TOKEN}: \${{ secrets.${TOKEN} }}` },
      ]),
    ).toEqual([]);
  });

  it("returns every leak with its file", () => {
    expect(
      findLeaks([
        { path: "a.md", content: `x\n${host("acme")}` },
        { path: "b.env", content: `${ACCOUNT}=123` },
        { path: ".env", content: "" },
      ]).map(formatLeak),
    ).toEqual([
      "a.md:2 (workers-dev)",
      "b.env:1 (secret-value)",
      ".env:1 (env-file)",
    ]);
  });
});
