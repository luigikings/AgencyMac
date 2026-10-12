// Structured data (JSON-LD) of the home pages (spec 004, RF-28). Pure
// functions. Only an Organization: there is no address or phone to publish,
// and `sameAs` stays out until there are social networks.

export type OrganizationJsonLd = {
  "@context": "https://schema.org";
  "@type": "Organization";
  name: string;
  url: string;
  logo: string;
  description: string;
  sameAs?: string[];
};

export function buildOrganizationJsonLd({
  site,
  name,
  description,
  logoPath,
  sameAs,
}: {
  site: string | URL;
  name: string;
  description: string;
  logoPath: string;
  sameAs: readonly string[];
}): OrganizationJsonLd {
  const data: OrganizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url: new URL("/", site).href,
    logo: new URL(logoPath, site).href,
    description,
  };
  if (sameAs.length > 0) data.sameAs = [...sameAs];
  return data;
}

/**
 * JSON for a `<script type="application/ld+json">` body. `<`, `>` and `&` are
 * escaped as unicode so the text can never close the tag or open markup.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
