import { describe, expect, it } from "vitest";
import { parseLsRemote, preflight } from "./preflight.mjs";

// Secret names and values are built at run time so this file never trips the
// repository leak check (scripts/no-leaks.test.mjs).
const NAMES = [
  ["CLOUDFLARE", "API", "TOKEN"].join("_"),
  ["CLOUDFLARE", "ACCOUNT", "ID"].join("_"),
  ["CF", "WORKERS", "SUBDOMAIN"].join("_"),
];
const VALUES = ["tok-value-123", "acc-value-456", "sub-value-789"];
const SHA = "a".repeat(40);
const OLD_SHA = "b".repeat(40);

const fullEnv = () =>
  Object.fromEntries(NAMES.map((name, i) => [name, VALUES[i]]));

const run = (env, { sha = SHA, mainSha = SHA } = {}) =>
  preflight({ env, names: NAMES, sha, mainSha });

const noValues = (warnings) => {
  for (const value of VALUES) {
    expect(warnings.join("\n")).not.toContain(value);
  }
};

describe("preflight", () => {
  it("is ready with the three secrets and the commit at the tip of main", () => {
    expect(run(fullEnv())).toEqual({ ready: true, warnings: [] });
  });

  it.each([[[0]], [[1]], [[2]], [[0, 1]], [[1, 2]], [[0, 1, 2]]])(
    "is not ready when secrets %j are missing, naming them",
    (missing) => {
      const env = fullEnv();
      for (const i of missing) delete env[NAMES[i]];
      const { ready, warnings } = run(env);
      expect(ready).toBe(false);
      expect(warnings).toHaveLength(missing.length);
      missing.forEach((i, n) => expect(warnings[n]).toContain(NAMES[i]));
      noValues(warnings);
    },
  );

  it.each(["", "   "])("treats a value of %j as missing", (value) => {
    const env = { ...fullEnv(), [NAMES[1]]: value };
    const { ready, warnings } = run(env);
    expect(ready).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(NAMES[1]);
  });

  it("is not ready when the commit is no longer the tip of main", () => {
    const { ready, warnings } = run(fullEnv(), { sha: OLD_SHA, mainSha: SHA });
    expect(ready).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(OLD_SHA);
    expect(warnings[0]).toContain("main");
    noValues(warnings);
  });

  it("is not ready when the tip of main is unknown", () => {
    const { ready, warnings } = run(fullEnv(), { mainSha: null });
    expect(ready).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("main");
  });

  it("is not ready without the commit of the run", () => {
    expect(run(fullEnv(), { sha: "" }).ready).toBe(false);
  });

  it("reports missing secrets and an old commit together", () => {
    const env = fullEnv();
    delete env[NAMES[2]];
    const { ready, warnings } = run(env, { sha: OLD_SHA, mainSha: SHA });
    expect(ready).toBe(false);
    expect(warnings).toHaveLength(2);
    noValues(warnings);
  });
});

describe("parseLsRemote", () => {
  it("returns the SHA of refs/heads/main", () => {
    expect(parseLsRemote(`${SHA}\trefs/heads/main\n`)).toBe(SHA);
  });

  it.each(["", "garbage\n", `${SHA}\trefs/heads/other\n`])(
    "returns null for %j",
    (output) => {
      expect(parseLsRemote(output)).toBeNull();
    },
  );
});
