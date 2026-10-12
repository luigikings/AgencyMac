import { describe, expect, it } from "vitest";
import { findContactData, findPriceMentions } from "./copy-rules";
import { LOCALES } from "./i18n";
import { translations } from "./translations";

// Writing rules for the public texts (RF-5: no prices; RF-13: no contact
// data). The rules are deliberately narrow so normal copy never trips them.
describe("findPriceMentions", () => {
  it.each([
    "Desde 99 €",
    "Only $49 a month",
    "£20",
    "Nuestros precios son claros",
    "Consulta la tarifa",
    "Cuesta 300 euros",
    "Our pricing is simple",
    "Check our rates",
    "presupuesto desde 500",
  ])("flags %j", (text) => {
    expect(findPriceMentions(text).length).toBeGreaterThan(0);
  });

  // Documented allowed cases: a quote request is the call to action, and the
  // rule must not fire on words that merely contain a price word.
  it.each([
    "Pide presupuesto sin compromiso",
    "Presupuesto a medida",
    "Gratis y sin compromiso",
    "Sin coste de alta",
    "Get a quote with no commitment",
    "Our coffee is free",
    "Ratings and rankings",
    "Generate more leads",
    "Mac te lleva de planeta en planeta",
  ])("allows %j", (text) => {
    expect(findPriceMentions(text)).toEqual([]);
  });
});

describe("findContactData", () => {
  it.each([
    "Llámanos al +34 600 123 456",
    "Call 600-123-456 today",
    "Escríbenos a hola@agencymac.com",
    "Write to team@example.co.uk",
    "Calle Mayor 12, Madrid",
    "Visit us at 5 Main Street 22",
    "Avenida de la Paz 3",
  ])("flags %j", (text) => {
    expect(findContactData(text).length).toBeGreaterThan(0);
  });

  it.each([
    "Tres planetas para despegar",
    "Three planets to take off",
    "Estamos en 2026",
    "Joni, Samuel y Luigi",
    "Se abre en una pestaña nueva",
    "Visit chatarreriametalrenova.es",
  ])("allows %j", (text) => {
    expect(findContactData(text)).toEqual([]);
  });
});

describe("every public text follows the rules", () => {
  const entries = LOCALES.flatMap((locale) =>
    Object.entries(translations[locale]).map(
      ([key, text]) => [`[${locale}] ${key}`, text] as const,
    ),
  );

  it.each(entries)("%s has no price", (_label, text) => {
    expect(findPriceMentions(text)).toEqual([]);
  });

  it.each(entries)("%s has no contact data", (_label, text) => {
    expect(findContactData(text)).toEqual([]);
  });
});
