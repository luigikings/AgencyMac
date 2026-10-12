import { describe, expect, it } from "vitest";
import {
  alternateLinks,
  buildSocialMeta,
  canonicalUrl,
  ogLocale,
  withTrailingSlash,
} from "./seo";

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

describe("ogLocale", () => {
  it("maps the site languages to their Open Graph locale", () => {
    expect(ogLocale("es")).toBe("es_ES");
    expect(ogLocale("en")).toBe("en_US");
  });
});

describe("buildSocialMeta", () => {
  const image = {
    path: "/og-default.png",
    width: 1200,
    height: 630,
    alt: "Logo alt",
  };
  const base = {
    site: SITE,
    path: "/",
    title: "Title · AgencyMac",
    description: "A description.",
    image,
  };
  const find = (tags: ReturnType<typeof buildSocialMeta>, key: string) =>
    tags.filter((tag) => tag.key === key);

  it("gives complete Open Graph and Twitter tags in the page language", () => {
    const tags = buildSocialMeta({ ...base, locale: "es" });
    const value = (key: string) => find(tags, key)[0]?.content;
    expect(value("og:type")).toBe("website");
    expect(value("og:site_name")).toBe("AgencyMac");
    expect(value("og:title")).toBe("Title · AgencyMac");
    expect(value("og:description")).toBe("A description.");
    expect(value("og:url")).toBe("https://agencymac.com/");
    expect(value("og:locale")).toBe("es_ES");
    expect(find(tags, "og:locale:alternate").map((tag) => tag.content)).toEqual(
      ["en_US"],
    );
    expect(value("og:image")).toBe("https://agencymac.com/og-default.png");
    expect(value("og:image:width")).toBe("1200");
    expect(value("og:image:height")).toBe("630");
    expect(value("og:image:alt")).toBe("Logo alt");
    expect(value("twitter:card")).toBe("summary_large_image");
    expect(value("twitter:title")).toBe("Title · AgencyMac");
    expect(value("twitter:description")).toBe("A description.");
    expect(value("twitter:image")).toBe("https://agencymac.com/og-default.png");
    expect(value("twitter:image:alt")).toBe("Logo alt");
  });

  it("uses property for og:* and name for twitter:*", () => {
    for (const tag of buildSocialMeta({ ...base, locale: "en" })) {
      expect(tag.attr).toBe(tag.key.startsWith("og:") ? "property" : "name");
    }
  });

  it("uses en_US with es_ES as the alternative for English", () => {
    const tags = buildSocialMeta({ ...base, path: "/en/", locale: "en" });
    expect(find(tags, "og:locale")[0]?.content).toBe("en_US");
    expect(find(tags, "og:locale:alternate")[0]?.content).toBe("es_ES");
    expect(find(tags, "og:url")[0]?.content).toBe("https://agencymac.com/en/");
  });

  it("builds every absolute URL from the site, never a local host", () => {
    const tags = buildSocialMeta({ ...base, locale: "es" });
    for (const key of ["og:url", "og:image", "twitter:image"]) {
      const url = find(tags, key)[0]!.content;
      expect(url.startsWith("https://agencymac.com/")).toBe(true);
    }
  });

  it("has no empty content", () => {
    for (const tag of buildSocialMeta({ ...base, locale: "es" })) {
      expect(tag.content.trim()).not.toBe("");
    }
  });
});
