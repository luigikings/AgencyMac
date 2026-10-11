import { describe, expect, it } from "vitest";
import {
  findMissingTranslations,
  formatTranslationProblems,
} from "./translation-check";

describe("findMissingTranslations", () => {
  it("returns nothing when every key has a value in every locale", () => {
    expect(
      findMissingTranslations(
        { es: { a: "Uno", b: "Dos" }, en: { a: "One", b: "Two" } },
        ["es", "en"],
      ),
    ).toEqual([]);
  });

  it("detects a key that only exists in Spanish", () => {
    expect(
      findMissingTranslations(
        { es: { a: "Uno", b: "Dos" }, en: { a: "One" } },
        ["es", "en"],
      ),
    ).toEqual([{ key: "b", locale: "en", problem: "missing" }]);
  });

  it("detects a key that only exists in English", () => {
    expect(
      findMissingTranslations({ es: { a: "Uno" }, en: { a: "One", c: "x" } }, [
        "es",
        "en",
      ]),
    ).toEqual([{ key: "c", locale: "es", problem: "missing" }]);
  });

  it("detects empty and whitespace-only values", () => {
    expect(
      findMissingTranslations(
        { es: { a: "", b: "Dos" }, en: { a: "One", b: "   " } },
        ["es", "en"],
      ),
    ).toEqual([
      { key: "a", locale: "es", problem: "empty" },
      { key: "b", locale: "en", problem: "empty" },
    ]);
  });

  it("treats a whole missing locale as every key missing", () => {
    expect(findMissingTranslations({ es: { a: "Uno" } }, ["es", "en"])).toEqual(
      [{ key: "a", locale: "en", problem: "missing" }],
    );
  });
});

describe("formatTranslationProblems", () => {
  it("names the key and the locale of every problem", () => {
    const message = formatTranslationProblems([
      { key: "home.title", locale: "en", problem: "missing" },
      { key: "footer.text", locale: "es", problem: "empty" },
    ]);
    expect(message).toContain("home.title");
    expect(message).toContain("[en]");
    expect(message).toContain("missing");
    expect(message).toContain("footer.text");
    expect(message).toContain("[es]");
    expect(message).toContain("empty");
  });
});
