// Writing rules for the public texts (spec 004, RF-5 and RF-13). Pure
// functions: each returns the matches found, so a test can say what failed.

// No prices, rates or currency. "cost" and "fee" are left out on purpose
// ("sin coste", "coffee" would be false positives), and a plain "presupuesto"
// (quote) is allowed because it is the call to action; only "presupuesto
// desde" (quote from) announces a price.
const PRICE =
  /[€$£]|\b(?:euros?|eur|precios?|tarifas?|presupuestos? desde|prices?|pricing|rates?)\b/gi;

// A phone number (nine or more digits, with optional separators) and an email.
const PHONE = /(?:\+?\d[\s().-]?){9,}/g;
const EMAIL = /\S+@\S+\.\S+/g;
// A street address: a street word followed by a name and a number ("Calle
// Mayor 12", "Avenida de la Paz 3") or a number, a name and the street word
// ("5 Main Street").
const ADDRESS =
  /\b(?:calle|avenida|avda|c\/|street|avenue|road)\b(?:\s+\S+){1,4}?\s+\d+|\b\d+\s+\S+\s+(?:street|avenue|road)\b/gi;

/** Every price, rate or currency mention in `text`. */
export function findPriceMentions(text: string): string[] {
  return text.match(PRICE) ?? [];
}

/** Every phone number, email or street address in `text`. */
export function findContactData(text: string): string[] {
  return [PHONE, EMAIL, ADDRESS].flatMap(
    (pattern) => text.match(pattern) ?? [],
  );
}
