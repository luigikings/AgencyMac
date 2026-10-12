import { describe, expect, it } from "vitest";
import { LINE_KEYS } from "./fx/mac-reactions";
import { LOCALES } from "./i18n";
import { macLines, macLinesJson } from "./mac-lines";
import { translations } from "./translations";

const ALL_KEYS = [
  LINE_KEYS.greet,
  ...Object.values(LINE_KEYS.arrive),
  ...LINE_KEYS.click,
  LINE_KEYS.idle,
  LINE_KEYS.turbo,
];

describe("macLines (RF-27, RF-43, plan D11)", () => {
  it.each(LOCALES)(
    "[%s] has exactly Mac's lines, with the translated text",
    (locale) => {
      const lines = macLines(locale);
      expect(Object.keys(lines).sort()).toEqual([...ALL_KEYS].sort());
      for (const key of ALL_KEYS) {
        expect(lines[key]).toBe(
          translations[locale][key as keyof (typeof translations)["es"]],
        );
        expect(lines[key]!.length).toBeGreaterThan(0);
      }
    },
  );

  it("does not carry any other translation", () => {
    for (const locale of LOCALES) {
      expect(
        Object.keys(macLines(locale)).every((k) => k.startsWith("mac.")),
      ).toBe(true);
    }
  });
});

describe("macLinesJson", () => {
  it.each(LOCALES)("[%s] is valid JSON that round-trips", (locale) => {
    expect(JSON.parse(macLinesJson(locale))).toEqual(macLines(locale));
  });

  it("cannot close the script tag it lives in", () => {
    for (const locale of LOCALES) {
      expect(macLinesJson(locale)).not.toMatch(/</);
    }
  });
});
