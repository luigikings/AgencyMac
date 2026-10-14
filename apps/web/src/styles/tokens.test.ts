import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FONTS_DIR,
  colors,
  cssVariableName,
  fontFamilies,
  fontPreloads,
  fonts,
  tokensToCss,
  type FontVariant,
} from "./tokens";

const WEB_ROOT = new URL("../../", import.meta.url);
const webFile = (path: string) => fileURLToPath(new URL(path, WEB_ROOT));

// Section 5 of specs/002-web-base/plan.md (RF-16): name, value, role and
// CSS variable of every brand colour.
const EXPECTED = [
  ["bgDark", "#1D003F", /dark background/i, "--color-bg-dark"],
  ["bg", "#34006F", /^background/i, "--color-bg"],
  ["button", "#FFC300", /^button$/i, "--color-button"],
  [
    "buttonHover",
    "#FFE000",
    /hover.*focus.*focus ring.*yellow accent text/i,
    "--color-button-hover",
  ],
  ["logoGradient1", "#FF9D00", /logo gradient/i, "--color-logo-gradient-1"],
  ["logoGradient2", "#FF6700", /logo gradient/i, "--color-logo-gradient-2"],
  ["logoGradient3", "#FF5733", /logo gradient/i, "--color-logo-gradient-3"],
  ["logoGradient4", "#C70039", /logo gradient/i, "--color-logo-gradient-4"],
  ["accentGreen", "#DAF7A6", /light green accent/i, "--color-accent-green"],
  ["text", "#FFFFFF", /text on dark backgrounds/i, "--color-text"],
  [
    "planetHexawebBg",
    "#00505C",
    /hexaweb.*block/i,
    "--color-planet-hexaweb-bg",
  ],
  ["planetRankiaBg", "#1F2A7A", /rankia.*block/i, "--color-planet-rankia-bg"],
  ["planetAdaraBg", "#7A1A12", /adara.*block/i, "--color-planet-adara-bg"],
  // Spec 005 (plan section 7): glow colours of the sky ambients.
  [
    "planetHexawebGlow",
    "#1FB5C0",
    /hexaweb.*glow/i,
    "--color-planet-hexaweb-glow",
  ],
  [
    "planetRankiaGlow",
    "#5B6CFF",
    /rankia.*glow/i,
    "--color-planet-rankia-glow",
  ],
  ["planetAdaraGlow", "#FF7A45", /adara.*glow/i, "--color-planet-adara-glow"],
  ["earthGlow", "#2E8BFF", /projects.*glow/i, "--color-earth-glow"],
] as const;

describe("colors (RF-16)", () => {
  it("defines exactly the brand colours, in the table order", () => {
    expect(Object.keys(colors)).toEqual(EXPECTED.map(([name]) => name));
  });

  it.each(EXPECTED)("%s is %s with its role", (name, value, role) => {
    const token = colors[name];
    expect(token.value).toBe(value);
    expect(token.role).toMatch(role);
  });

  it("has no logo cyan token", () => {
    expect(Object.keys(colors).some((name) => /cyan/i.test(name))).toBe(false);
  });

  it("keeps the logo gradient in its order", () => {
    expect(
      [1, 2, 3, 4].map(
        (n) => colors[`logoGradient${n}` as keyof typeof colors].value,
      ),
    ).toEqual(["#FF9D00", "#FF6700", "#FF5733", "#C70039"]);
  });
});

describe("cssVariableName", () => {
  it.each(EXPECTED)("%s → %s", (name, _value, _role, variable) => {
    expect(cssVariableName(name)).toBe(variable);
  });
});

describe("tokensToCss", () => {
  it("declares one custom property per colour inside :root", () => {
    expect(tokensToCss(colors)).toBe(
      ":root{" +
        EXPECTED.map(([, value, , variable]) => `${variable}:${value};`).join(
          "",
        ) +
        "}",
    );
  });

  it("works with any set of tokens", () => {
    expect(tokensToCss({ fooBar: { value: "#000", role: "Test" } })).toBe(
      ":root{--color-foo-bar:#000;}",
    );
  });
});

// Section 5 of the plan (RF-18): Lilita One 400 for headings, Lato 400/700
// for the body, normal style only, self-hosted woff2 files.
describe("fonts (RF-18)", () => {
  it("defines the heading and body families", () => {
    expect(Object.keys(fonts)).toEqual(["heading", "body"]);
    expect(fonts.heading.name).toBe("Lilita One");
    expect(fonts.heading.cssVariable).toBe("--font-heading");
    expect(fonts.body.name).toBe("Lato");
    expect(fonts.body.cssVariable).toBe("--font-body");
  });

  it("uses only Lilita One 400 and Lato 400/700, normal style", () => {
    const weights = (token: (typeof fonts)[keyof typeof fonts]) =>
      token.variants.map((variant) => variant.weight);
    expect(weights(fonts.heading)).toEqual([400]);
    expect(weights(fonts.body)).toEqual([400, 700]);
    for (const token of Object.values(fonts)) {
      expect(token.fallbacks).toEqual(["sans-serif"]);
      for (const variant of token.variants) {
        expect(variant.style).toBe("normal");
      }
    }
  });

  it.each(
    Object.values(fonts).flatMap(
      (token): readonly FontVariant[] => token.variants,
    ),
  )("$file is a woff2 stored in the repo", ({ file }) => {
    expect(file).toMatch(/^[a-z0-9-]+\.woff2$/);
    const path = webFile(FONTS_DIR + file);
    expect(existsSync(path), path).toBe(true);
    expect(readFileSync(path).subarray(0, 4).toString("latin1")).toBe("wOF2");
  });

  it("preloads only Lilita One 400 and Lato 400 (plan, D8)", () => {
    expect(fontPreloads(fonts.heading)).toEqual([
      { weight: 400, style: "normal" },
    ]);
    expect(fontPreloads(fonts.body)).toEqual([
      { weight: 400, style: "normal" },
    ]);
  });
});

describe("fontFamilies (RF-18, RF-19)", () => {
  const provider = { name: "fake-local" };
  const families = fontFamilies(fonts, provider);

  it("builds one local family per font token, with its fallbacks", () => {
    expect(families.map((family) => family.name)).toEqual([
      "Lilita One",
      "Lato",
    ]);
    for (const family of families) {
      expect(family.provider).toBe(provider);
      expect(family.fallbacks).toEqual(["sans-serif"]);
    }
    expect(families.map((family) => family.cssVariable)).toEqual([
      "--font-heading",
      "--font-body",
    ]);
  });

  it("declares every variant with font-display swap and its local file", () => {
    expect(families[1]!.options.variants).toEqual([
      {
        weight: 400,
        style: "normal",
        display: "swap",
        src: [FONTS_DIR + "lato-latin-400-normal.woff2"],
      },
      {
        weight: 700,
        style: "normal",
        display: "swap",
        src: [FONTS_DIR + "lato-latin-700-normal.woff2"],
      },
    ]);
    expect(families[0]!.options.variants).toEqual([
      {
        weight: 400,
        style: "normal",
        display: "swap",
        src: [FONTS_DIR + "lilita-one-latin-400-normal.woff2"],
      },
    ]);
  });
});

// E-1: the fonts travel with their OFL-1.1 licence and a NOTICE.
describe("font licences (E-1)", () => {
  it.each([
    ["OFL-LilitaOne.txt", /Juan Montoreano/],
    ["OFL-Lato.txt", /Lukasz Dziedzic/],
  ])("%s holds the copyright and the SIL OFL 1.1", (file, copyright) => {
    const text = readFileSync(webFile(FONTS_DIR + file), "utf8");
    expect(text).toMatch(copyright);
    expect(text).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it("NOTICE.md records origin, version, copyright and licence of each family", () => {
    const notice = readFileSync(webFile(FONTS_DIR + "NOTICE.md"), "utf8");
    for (const pkg of ["@fontsource/lilita-one", "@fontsource/lato"]) {
      expect(notice).toContain(`${pkg}@5.3.0`);
    }
    expect(notice).toMatch(/Juan Montoreano/);
    expect(notice).toMatch(/Lukasz Dziedzic/);
    expect(notice).toContain("OFL-1.1");
    expect(notice).toContain("OFL-LilitaOne.txt");
    expect(notice).toContain("OFL-Lato.txt");
    expect(notice).toMatch(/MIT/);
  });
});
