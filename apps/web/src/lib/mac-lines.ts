// Mac's lines for the browser (spec 005, RF-27, plan D11): the texts live only
// in translations.ts; the home page puts the ones of its language in a
// non-executable JSON block that the effects layer reads when it needs them.

import { LINE_KEYS } from "./fx/mac-reactions";
import type { Locale } from "./i18n";
import { translations, type TranslationKey } from "./translations";

const KEYS = [
  LINE_KEYS.greet,
  ...Object.values(LINE_KEYS.arrive),
  ...LINE_KEYS.click,
  LINE_KEYS.idle,
  LINE_KEYS.turbo,
] as const satisfies readonly TranslationKey[];

/** Mac's lines in `locale`, by translation key. */
export function macLines(locale: Locale): Record<string, string> {
  return Object.fromEntries(
    KEYS.map((key) => [key, translations[locale][key]]),
  );
}

/**
 * The lines as JSON text for a `<script type="application/json">`: `<` is
 * escaped so no text can close the tag.
 */
export function macLinesJson(locale: Locale): string {
  return JSON.stringify(macLines(locale)).replace(/</g, "\\u003c");
}
