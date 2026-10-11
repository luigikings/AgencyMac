import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { findIndexingBlocks } from "../../../scripts/lib/dist-check.mjs";

// RF-9, RNF-9: the production build that Playwright (or the CI) serves has
// no noindex anywhere: no robots/googlebot meta with noindex or none, no
// X-Robots-Tag rule and no _headers file. Staging adds its noindex only to
// its own copy of the build, never here.
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const BINARY = /\.(woff2?|ttf|otf|png|jpe?g|gif|webp|avif|ico|riv|pdf)$/i;

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

test("the production build contains no noindex", () => {
  const files = listFiles(dist).map((path) => ({
    path: relative(dist, path).replaceAll("\\", "/"),
    content: BINARY.test(path) ? "" : readFileSync(path, "utf8"),
  }));
  const paths = files.map(({ path }) => path);
  expect(paths).toContain("index.html");
  expect(paths).toContain("en/index.html");
  expect(findIndexingBlocks(files)).toEqual([]);
});
