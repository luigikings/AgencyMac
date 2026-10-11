import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findLeaks, formatLeak } from "./lib/leaks.mjs";

// RF-12, RF-36: the files git would publish (tracked, plus untracked files
// that are not ignored, so a leak is caught before it is committed) contain
// no workers.dev host, no secret with a literal value and no .env/.wrangler
// file. Binary files are skipped.
const root = fileURLToPath(new URL("..", import.meta.url));
const BINARY = /\.(woff2?|ttf|otf|png|jpe?g|gif|webp|avif|ico|riv|pdf|zip)$/i;

function publishableFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" },
  );
  return [...new Set(output.split("\0").filter(Boolean))];
}

function readText(path) {
  if (BINARY.test(path)) return "";
  try {
    const content = readFileSync(join(root, path), "utf8");
    return content.includes("\0") ? "" : content;
  } catch (error) {
    // Deleted in the working tree but still in the index: nothing to read.
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

describe("Repository leak check", () => {
  it("finds the files to check", () => {
    expect(publishableFiles()).toContain("package.json");
  });

  it("publishes no workers.dev host, secret value or .env file", () => {
    const files = publishableFiles().map((path) => ({
      path,
      content: readText(path),
    }));
    expect(findLeaks(files).map(formatLeak)).toEqual([]);
  });
});
