import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./i18n";
import {
  findMissingTranslations,
  formatTranslationProblems,
} from "./translation-check";
import { translations } from "./translations";

// Kept from the 002 base: the home page title and description, the 404 and
// the shared chrome. The provisional home texts of the 002 are gone.
const BASE_KEYS = [
  "home.title",
  "home.description",
  "notFound.title",
  "notFound.description",
  "notFound.heading",
  "notFound.message",
  "notFound.backHome",
  "nav.label",
  "nav.home",
  "nav.switchLanguage",
  "a11y.skipToContent",
  "footer.text",
];

// Keys of the home page of spec 004 (table "Textos propuestos").
const HOME_KEYS = [
  "og.imageAlt",
  "nav.services",
  "nav.projects",
  "nav.team",
  "nav.contact",
  "cta.takeOff",
  "hero.heading",
  "hero.tagline",
  "hero.kicker",
  "hero.subtitle",
  "hero.discover",
  "hero.macAlt",
  "hero.macGestureLabel",
  "services.heading",
  "services.intro",
  "services.tagBase",
  "services.tagBooster",
  "services.hexaweb.role",
  "services.hexaweb.body",
  "services.hexaweb.alt",
  "services.rankia.role",
  "services.rankia.body",
  "services.rankia.alt",
  "services.adara.role",
  "services.adara.body",
  "services.adara.alt",
  "projects.heading",
  "projects.intro",
  "projects.metalrenova.description",
  "projects.magnar.description",
  "projects.visit",
  "projects.newTab",
  "team.heading",
  "team.intro",
  "team.role.marketing",
  "team.role.analytics",
  "team.role.coding",
  "contact.heading",
  "contact.body",
  "contact.status",
];

// Keys added by spec 005 (table "Textos propuestos"): Mac's lines and the
// footer phrase.
const SPACE_KEYS = [
  "mac.greet",
  "mac.arrive.hexaweb",
  "mac.arrive.rankia",
  "mac.arrive.adara",
  "mac.arrive.contact",
  "mac.click.1",
  "mac.click.2",
  "mac.click.3",
  "mac.idle",
  "mac.turbo",
  "footer.detail",
];

const REMOVED_KEYS = [
  "home.heading",
  "home.intro",
  "home.sectionHeading",
  "home.sectionBody",
];

describe("translations", () => {
  it("has every key with a non-empty value in ES and EN", () => {
    const problems = findMissingTranslations(translations, LOCALES);
    expect(problems, formatTranslationProblems(problems)).toEqual([]);
  });

  it("contains every key the plan requires", () => {
    for (const locale of LOCALES) {
      const keys = Object.keys(translations[locale]);
      const missing = [...BASE_KEYS, ...HOME_KEYS, ...SPACE_KEYS].filter(
        (key) => !keys.includes(key),
      );
      expect(missing, `[${locale}] missing keys`).toEqual([]);
    }
  });

  it("has no other keys (nothing without a use)", () => {
    for (const locale of LOCALES) {
      const unexpected = Object.keys(translations[locale]).filter(
        (key) => ![...BASE_KEYS, ...HOME_KEYS, ...SPACE_KEYS].includes(key),
      );
      expect(unexpected, `[${locale}] unexpected keys`).toEqual([]);
    }
  });

  it("no longer has the provisional texts of the 002", () => {
    for (const locale of LOCALES) {
      const keys = Object.keys(translations[locale]);
      expect(keys.filter((key) => REMOVED_KEYS.includes(key))).toEqual([]);
    }
  });

  it("uses different titles and descriptions per page and per language", () => {
    const values = LOCALES.flatMap((locale) => [
      translations[locale]["home.title"],
      translations[locale]["notFound.title"],
    ]);
    expect(new Set(values).size).toBe(values.length);
    const descriptions = LOCALES.flatMap((locale) => [
      translations[locale]["home.description"],
      translations[locale]["notFound.description"],
    ]);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("keeps the Spanish and English home texts different", () => {
    for (const key of ["hero.heading", "hero.tagline", "contact.status"]) {
      const k = key as keyof (typeof translations)["es"];
      expect(translations.es[k]).not.toBe(translations.en[k]);
    }
  });
});

// The "Textos propuestos" table of the spec is the reference for the copy:
// every row must match the translations key by key, in both languages.
describe("spec 004 text table", () => {
  const spec = readFileSync(
    fileURLToPath(
      new URL("../../../../specs/004-web-portada/spec.md", import.meta.url),
    ),
    "utf8",
  );
  const rows = spec
    .split(/\r?\n/)
    .map((line) => /^\|\s*`([^`]+)`[^|]*\|([^|]+)\|([^|]+)\|\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, key, es, en]) => ({ key, es: es.trim(), en: en.trim() }));

  it("lists every key of the home page", () => {
    expect(rows.map((row) => row.key).sort()).toEqual(
      [...HOME_KEYS, "home.title", "home.description"].sort(),
    );
  });

  it.each(["es", "en"] as const)("matches the %s translations", (locale) => {
    const mismatches = rows
      .filter(
        (row) =>
          translations[locale][row.key as keyof (typeof translations)["es"]] !==
          row[locale],
      )
      .map((row) => `[${locale}] ${row.key}`);
    expect(mismatches).toEqual([]);
  });
});

// Spec 005: the same check for its table of new texts (RF-43).
describe("spec 005 text table", () => {
  const spec = readFileSync(
    fileURLToPath(
      new URL(
        "../../../../specs/005-portada-espacial/spec.md",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  const rows = spec
    .split(/\r?\n/)
    .map((line) => /^\|\s*`([^`]+)`[^|]*\|([^|]+)\|([^|]+)\|\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, key, es, en]) => ({ key, es: es.trim(), en: en.trim() }));

  it("lists every new key and no other", () => {
    expect(rows.map((row) => row.key).sort()).toEqual([...SPACE_KEYS].sort());
  });

  it.each(["es", "en"] as const)("matches the %s translations", (locale) => {
    const mismatches = rows
      .filter(
        (row) =>
          translations[locale][row.key as keyof (typeof translations)["es"]] !==
          row[locale],
      )
      .map((row) => `[${locale}] ${row.key}`);
    expect(mismatches).toEqual([]);
  });

  it("has Spanish and English lines that differ", () => {
    for (const key of SPACE_KEYS) {
      const k = key as keyof (typeof translations)["es"];
      expect(translations.es[k], key).not.toBe(translations.en[k]);
    }
  });
});

// Soft check (RNF-1, orientative): lengths outside the SEO ranges only warn.
describe("title and description lengths", () => {
  it.each(LOCALES)("[%s] are close to the recommended lengths", (locale) => {
    const title = translations[locale]["home.title"];
    const description = translations[locale]["home.description"];
    if (title.length > 60) {
      console.warn(`[${locale}] home.title has ${title.length} characters`);
    }
    if (description.length < 140 || description.length > 165) {
      console.warn(
        `[${locale}] home.description has ${description.length} characters`,
      );
    }
    expect(title.length).toBeGreaterThan(0);
  });
});
