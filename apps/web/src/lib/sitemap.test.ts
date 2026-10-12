import { describe, expect, it } from "vitest";
import { buildRobotsTxt, buildSitemapXml } from "./sitemap";

const SITE = "https://agencymac.com";

describe("buildSitemapXml", () => {
  const xml = buildSitemapXml(SITE, ["es", "en"], ["/"]);

  it("is a urlset with the xhtml namespace", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    );
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it("lists the two canonical URLs and nothing else", () => {
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([
      "https://agencymac.com/",
      "https://agencymac.com/en/",
    ]);
  });

  it("gives each URL its es, en and x-default alternatives", () => {
    const links = [
      '<xhtml:link rel="alternate" hreflang="es" href="https://agencymac.com/"/>',
      '<xhtml:link rel="alternate" hreflang="en" href="https://agencymac.com/en/"/>',
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://agencymac.com/"/>',
    ];
    for (const link of links) {
      // Once per URL: twice in total.
      expect(xml.split(link).length - 1).toBe(2);
    }
  });

  it("has no 404 page and no lastmod", () => {
    expect(xml).not.toMatch(/404|lastmod/);
  });

  it("is well formed: every opened tag is closed", () => {
    expect(xml.split("<url>").length).toBe(xml.split("</url>").length);
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });

  it("escapes characters that XML reserves", () => {
    const odd = buildSitemapXml(SITE, ["es"], ["/a&b/"]);
    expect(odd).toContain("a&amp;b");
    expect(odd).not.toContain("a&b");
  });

  it("builds URLs from the site, whatever its trailing slash", () => {
    expect(buildSitemapXml(`${SITE}/`, ["es"], ["/"])).toContain(
      "<loc>https://agencymac.com/</loc>",
    );
  });
});

describe("buildRobotsTxt", () => {
  it("allows crawling and points to the sitemap", () => {
    expect(buildRobotsTxt(SITE)).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://agencymac.com/sitemap.xml\n",
    );
  });

  it("never disallows anything", () => {
    expect(buildRobotsTxt(SITE)).not.toMatch(/disallow/i);
  });
});
