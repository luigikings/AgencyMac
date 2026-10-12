import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The provisional logo cyan was removed (spec 004, plan section 4): nothing in
// apps/web/src may bring it back. This file and tokens.test.ts (which checks
// that the token is gone) are excluded.
const SRC = fileURLToPath(new URL("../", import.meta.url));
const EXCLUDED = new Set(["styles/no-cyan.test.ts", "styles/tokens.test.ts"]);
const BINARY = /\.(woff2?|png|jpe?g|webp|avif|ico)$/i;

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .map((file) => relative(SRC, file).split(sep).join("/"))
    .filter((file) => !EXCLUDED.has(file) && !BINARY.test(file));
}

describe("no logo cyan in apps/web/src", () => {
  it("scans the source files and skips the excluded ones", () => {
    const files = sourceFiles();
    expect(files).toContain("styles/tokens.ts");
    expect(files).not.toContain("styles/no-cyan.test.ts");
    expect(files).not.toContain("styles/tokens.test.ts");
  });

  it("finds neither 'cyan' nor 00E5FF", () => {
    const found = sourceFiles().filter((file) =>
      /cyan|00E5FF/i.test(readFileSync(join(SRC, file), "utf8")),
    );
    expect(found, "The logo cyan no longer exists").toEqual([]);
  });
});
