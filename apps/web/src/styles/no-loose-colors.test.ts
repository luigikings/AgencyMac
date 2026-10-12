import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findHexColors } from "../lib/hex-colors";

// RF-17: brand colours live only in src/styles/tokens.ts. Any hex colour in
// the web's styles, components, pages, public files or Astro config makes
// this test fail, listing "file: hex".
const WEB_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SOURCE_EXTENSIONS = /\.(astro|css|ts|js|mjs|svg)$/;
const PUBLIC_TEXT_EXTENSIONS =
  /\.(astro|css|ts|js|mjs|svg|json|webmanifest|xml|txt|html)$/;
const EXCLUDED = new Set(["src/styles/tokens.ts"]);

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

function scannedFiles(): string[] {
  const sources = listFiles(join(WEB_ROOT, "src")).filter((file) =>
    SOURCE_EXTENSIONS.test(file),
  );
  // Only text files: a binary image (PNG, WebP...) can contain a byte pattern
  // that looks like a hex colour.
  const publicFiles = listFiles(join(WEB_ROOT, "public")).filter((file) =>
    PUBLIC_TEXT_EXTENSIONS.test(file),
  );
  const config = join(WEB_ROOT, "astro.config.mjs");
  return [...sources, ...publicFiles, config]
    .map((file) => toPosix(relative(WEB_ROOT, file)))
    .filter((file) => !EXCLUDED.has(file) && !file.endsWith(".test.ts"));
}

describe("no loose hex colours (RF-17)", () => {
  it("scans the Astro pages and the config", () => {
    const files = scannedFiles();
    expect(files).toContain("src/pages/index.astro");
    expect(files).toContain("astro.config.mjs");
    expect(files).not.toContain("src/styles/tokens.ts");
  });

  it("finds no hex colour outside src/styles/tokens.ts", () => {
    const loose = scannedFiles().flatMap((file) =>
      findHexColors(readFileSync(join(WEB_ROOT, file), "utf8")).map(
        (hex) => `apps/web/${file}: ${hex}`,
      ),
    );
    expect(loose, "Use the brand tokens instead of hex colours").toEqual([]);
  });
});
