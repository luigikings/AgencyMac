import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MANIFEST } from "./assets/manifest.mjs";

// RF-21 / RNF-13: the folder of original illustrations (Assets/) is never
// versioned, and the only images in the repo are the derivatives listed in the
// asset manifest.
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|avif|svg|ico)$/i;

// The only originals the home page uses (spec 004, plan section 3). Anything
// else in Assets/ must never be read, copied or named in the repo.
const USED_ORIGINALS = [
  "Logos/IMAGOLOGO LETRAS BLANCAS.png",
  "Logos/ISOLOGO.png",
  "Mac/Alien Mac.png",
  "Planetas/Luna.png",
  "Planetas/Hexaweb - Desarrollo web.png",
  "Planetas/Rankia - Posicionamiento.png",
  "Planetas/Adara - Publicidad pagada SEM.png",
  "Planetas/Tierra.png",
];

function git(...args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function lines(text) {
  return text.split(/\r?\n/).filter(Boolean);
}

describe("repository assets (RF-21, RNF-13)", () => {
  it("ignores the Assets/ folder of originals", () => {
    // The probe path does not need to exist: check-ignore only matches rules.
    expect(() =>
      git("check-ignore", "-q", "Assets/does-not-exist.png"),
    ).not.toThrow();
  });

  it("versions no file under Assets/", () => {
    expect(lines(git("ls-files", "Assets"))).toEqual([]);
  });

  it("versions only images listed as manifest outputs", () => {
    const allowed = new Set(MANIFEST.map((entry) => entry.output));
    const images = lines(git("ls-files")).filter((file) =>
      IMAGE_EXTENSIONS.test(file),
    );
    const unlisted = images.filter((file) => !allowed.has(file));
    expect(unlisted, "Add the derivative to the manifest or remove it").toEqual(
      [],
    );
  });

  it("has no path under Assets/ anywhere in the git history", () => {
    const paths = lines(
      git("log", "--all", "--name-only", "--pretty=format:"),
    ).filter((file) => file.startsWith("Assets/"));
    expect(paths).toEqual([]);
  });

  it("cites only used originals in the manifest", () => {
    const cited = MANIFEST.map((entry) => entry.original);
    const unexpected = cited.filter((name) => !USED_ORIGINALS.includes(name));
    expect(unexpected).toEqual([]);
    expect(MANIFEST.length).toBeGreaterThan(0);
  });

  it("has unique outputs under apps/web", () => {
    const outputs = MANIFEST.map((entry) => entry.output);
    expect(new Set(outputs).size).toBe(outputs.length);
    for (const output of outputs) {
      expect(output.startsWith("apps/web/")).toBe(true);
    }
  });
});
