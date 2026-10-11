import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareStagingCopy, stagingHeaders } from "./staging-copy.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("stagingHeaders", () => {
  it("writes one /* rule with noindex and the version (exact text)", () => {
    expect(stagingHeaders(SHA)).toBe(
      `/*\n  X-Robots-Tag: noindex\n  X-Staging-Version: ${SHA}\n`,
    );
  });

  it("accepts the local identifier", () => {
    expect(stagingHeaders("local")).toBe(
      "/*\n  X-Robots-Tag: noindex\n  X-Staging-Version: local\n",
    );
  });

  it.each([
    "",
    undefined,
    "LOCAL",
    SHA.slice(0, 39),
    `${SHA}0`,
    SHA.toUpperCase(),
    "0123456789abcdef0123456789abcdef0123456g",
    `${SHA}\n  X-Robots-Tag: all`,
  ])("rejects the identifier %j", (version) => {
    expect(() => stagingHeaders(version)).toThrow(/version/i);
  });
});

describe("prepareStagingCopy", () => {
  let root;
  let dist;
  let copy;

  const listTree = (dir, prefix = "") =>
    readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? listTree(join(dir, entry.name), `${prefix}${entry.name}/`)
          : [`${prefix}${entry.name}`],
      )
      .sort();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "staging-copy-"));
    dist = join(root, "dist");
    copy = join(root, ".staging");
    mkdirSync(join(dist, "en"), { recursive: true });
    writeFileSync(join(dist, "index.html"), "<html lang=es>");
    writeFileSync(join(dist, "en", "index.html"), "<html lang=en>");
    writeFileSync(join(dist, "404.html"), "<html lang=es>404");
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("copies the build and adds _headers only to the copy", () => {
    prepareStagingCopy({ from: dist, to: copy, version: SHA });
    expect(listTree(copy)).toEqual([
      "404.html",
      "_headers",
      "en/index.html",
      "index.html",
    ]);
    expect(readFileSync(join(copy, "_headers"), "utf8")).toBe(
      stagingHeaders(SHA),
    );
    expect(readFileSync(join(copy, "en", "index.html"), "utf8")).toBe(
      "<html lang=en>",
    );
    // The build is left untouched.
    expect(listTree(dist)).toEqual(["404.html", "en/index.html", "index.html"]);
  });

  it("replaces a previous copy completely", () => {
    mkdirSync(copy);
    writeFileSync(join(copy, "old.html"), "stale");
    prepareStagingCopy({ from: dist, to: copy, version: "local" });
    expect(listTree(copy)).not.toContain("old.html");
  });

  it("refuses a build that already has _headers and leaves it untouched", () => {
    writeFileSync(join(dist, "_headers"), "/*\n  X-Robots-Tag: noindex\n");
    expect(() =>
      prepareStagingCopy({ from: dist, to: copy, version: SHA }),
    ).toThrow(/_headers/);
    expect(listTree(dist)).toEqual([
      "404.html",
      "_headers",
      "en/index.html",
      "index.html",
    ]);
    expect(readdirSync(root)).not.toContain(".staging");
  });

  it("validates the version before touching anything", () => {
    mkdirSync(copy);
    writeFileSync(join(copy, "keep.html"), "previous");
    expect(() =>
      prepareStagingCopy({ from: dist, to: copy, version: "main" }),
    ).toThrow(/version/i);
    expect(listTree(copy)).toEqual(["keep.html"]);
  });

  it("refuses a missing build or one without index.html", () => {
    expect(() =>
      prepareStagingCopy({ from: join(root, "nope"), to: copy, version: SHA }),
    ).toThrow(/index\.html/);
    rmSync(join(dist, "index.html"));
    expect(() =>
      prepareStagingCopy({ from: dist, to: copy, version: SHA }),
    ).toThrow(/index\.html/);
  });

  it("refuses a destination equal to or inside the build", () => {
    expect(() =>
      prepareStagingCopy({ from: dist, to: dist, version: SHA }),
    ).toThrow(/destination/i);
    expect(() =>
      prepareStagingCopy({ from: dist, to: join(dist, "x"), version: SHA }),
    ).toThrow(/destination/i);
    expect(listTree(dist)).toEqual(["404.html", "en/index.html", "index.html"]);
  });
});
