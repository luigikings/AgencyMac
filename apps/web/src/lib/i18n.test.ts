import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  localizePath,
  notFoundRelocations,
  otherLocale,
  t,
  translate,
  withTrailingSlash,
  type TranslationKey,
} from "./i18n";

describe("locales", () => {
  it("has Spanish as default and English as the only other locale", () => {
    expect(LOCALES).toEqual(["es", "en"]);
    expect(DEFAULT_LOCALE).toBe("es");
  });

  it("returns the other locale", () => {
    expect(otherLocale("es")).toBe("en");
    expect(otherLocale("en")).toBe("es");
  });
});

describe("withTrailingSlash", () => {
  it.each([
    ["", "/"],
    ["/", "/"],
    ["/en", "/en/"],
    ["/en/", "/en/"],
    ["about", "/about/"],
    ["/a/b", "/a/b/"],
  ])("%j → %j", (input, expected) => {
    expect(withTrailingSlash(input)).toBe(expected);
  });
});

describe("localizePath", () => {
  it("keeps Spanish paths without prefix", () => {
    expect(localizePath("es", "/")).toBe("/");
    expect(localizePath("es", "/about")).toBe("/about/");
  });

  it("prefixes English paths with /en/", () => {
    expect(localizePath("en", "/")).toBe("/en/");
    expect(localizePath("en", "/about/")).toBe("/en/about/");
    expect(localizePath("en", "")).toBe("/en/");
  });
});

describe("translate / t", () => {
  const dicts = {
    es: { greeting: "Hola", blank: "  " },
    en: { greeting: "Hello", blank: "" },
  };

  it("returns the value for the locale", () => {
    expect(translate(dicts, "es", "greeting")).toBe("Hola");
    expect(translate(dicts, "en", "greeting")).toBe("Hello");
  });

  it("throws naming the key and locale when the key is missing", () => {
    expect(() => translate(dicts, "en", "nope")).toThrow(/nope.*en|en.*nope/);
  });

  it("throws when the value is empty or blank", () => {
    expect(() => translate(dicts, "es", "blank")).toThrow(/blank/);
    expect(() => translate(dicts, "en", "blank")).toThrow(/blank/);
  });

  it("t reads the real dictionaries", () => {
    expect(t("es", "nav.switchLanguage")).toBe("English");
    expect(t("en", "nav.switchLanguage")).toBe("Español");
  });

  it("t throws with an unknown key", () => {
    expect(() => t("es", "does.not.exist" as TranslationKey)).toThrow(
      /does\.not\.exist/,
    );
  });
});

describe("notFoundRelocations", () => {
  it("moves the 404 of every non-default locale next to its folder", () => {
    expect(notFoundRelocations(LOCALES)).toEqual([
      { from: "en/404/index.html", to: "en/404.html", removeDir: "en/404" },
    ]);
  });

  it("returns nothing when there is only the default locale", () => {
    expect(notFoundRelocations(["es"])).toEqual([]);
  });
});
