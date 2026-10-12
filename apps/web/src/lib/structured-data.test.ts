import { describe, expect, it } from "vitest";
import { buildOrganizationJsonLd, serializeJsonLd } from "./structured-data";

const input = {
  site: "https://agencymac.com",
  name: "AgencyMac",
  description: "A description.",
  logoPath: "/logo-512.png",
  sameAs: [] as string[],
};

describe("buildOrganizationJsonLd", () => {
  it("is a schema.org Organization with name, url, logo and description", () => {
    expect(buildOrganizationJsonLd(input)).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "AgencyMac",
      url: "https://agencymac.com/",
      logo: "https://agencymac.com/logo-512.png",
      description: "A description.",
    });
  });

  it("omits sameAs while there are no social networks", () => {
    expect("sameAs" in buildOrganizationJsonLd(input)).toBe(false);
  });

  it("includes sameAs when there are networks", () => {
    const data = buildOrganizationJsonLd({
      ...input,
      sameAs: ["https://example.com/agencymac"],
    });
    expect(data.sameAs).toEqual(["https://example.com/agencymac"]);
  });

  it("never carries phone, email or address", () => {
    const text = JSON.stringify(buildOrganizationJsonLd(input));
    expect(text).not.toMatch(/telephone|email|address/i);
  });

  it("builds URLs from the site, whatever its trailing slash", () => {
    const data = buildOrganizationJsonLd({
      ...input,
      site: "https://agencymac.com/",
    });
    expect(data.url).toBe("https://agencymac.com/");
    expect(data.logo).toBe("https://agencymac.com/logo-512.png");
  });
});

describe("serializeJsonLd", () => {
  it("round-trips through JSON.parse", () => {
    const data = buildOrganizationJsonLd(input);
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("escapes <, > and & so it cannot close the script tag", () => {
    const text = serializeJsonLd({ description: "</script><b>&" });
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toContain("&");
    expect(JSON.parse(text)).toEqual({ description: "</script><b>&" });
  });
});
