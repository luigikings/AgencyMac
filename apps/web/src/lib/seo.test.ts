import { describe, expect, it } from "vitest";
import { alternateLinks, canonicalUrl, withTrailingSlash } from "./seo";

const SITE = "https://agencymac.com";

describe("withTrailingSlash", () => {
  it("is exported for the layout", () => {
    expect(withTrailingSlash("/en")).toBe("/en/");
  });
});

describe("canonicalUrl", () => {
  it.each([
    ["/", "https://agencymac.com/"],
    ["/en/", "https://agencymac.com/en/"],
    ["/en", "https://agencymac.com/en/"],
    ["/about", "https://agencymac.com/about/"],
  ])("%j → %j", (path, expected) => {
    expect(canonicalUrl(SITE, path)).toBe(expected);
  });

  it("accepts the site as URL object or with a trailing slash", () => {
    expect(canonicalUrl(new URL(SITE), "/en/")).toBe(
      "https://agencymac.com/en/",
    );
    expect(canonicalUrl(`${SITE}/`, "/")).toBe("https://agencymac.com/");
  });

  it("always uses the site, never a local host", () => {
    expect(canonicalUrl(SITE, "/en/")).not.toContain("localhost");
  });

  it("throws when the site is not an absolute URL", () => {
    expect(() => canonicalUrl("agencymac.com", "/")).toThrow();
  });
});

describe("alternateLinks", () => {
  const expected = [
    { hreflang: "es", href: "https://agencymac.com/" },
    { hreflang: "en", href: "https://agencymac.com/en/" },
    { hreflang: "x-default", href: "https://agencymac.com/" },
  ];

  it("gives the same es/en/x-default links from either language", () => {
    expect(alternateLinks(SITE, "/")).toEqual(expected);
    expect(alternateLinks(SITE, "/en/")).toEqual(expected);
    expect(alternateLinks(SITE, "/en")).toEqual(expected);
  });

  it("maps nested pages to their equivalent", () => {
    const links = [
      { hreflang: "es", href: "https://agencymac.com/about/" },
      { hreflang: "en", href: "https://agencymac.com/en/about/" },
      { hreflang: "x-default", href: "https://agencymac.com/about/" },
    ];
    expect(alternateLinks(SITE, "/about/")).toEqual(links);
    expect(alternateLinks(SITE, "/en/about/")).toEqual(links);
  });

  it("does not strip paths that only start with the letters en", () => {
    expect(alternateLinks(SITE, "/english/")[0]).toEqual({
      hreflang: "es",
      href: "https://agencymac.com/english/",
    });
  });
});
