import type { APIRoute } from "astro";
import { LOCALES } from "../lib/i18n";
import { buildSitemapXml } from "../lib/sitemap";

// Static endpoint: the build writes dist/sitemap.xml with the home page in
// both languages (the 404s are not listed).
export const GET: APIRoute = ({ site }) =>
  new Response(buildSitemapXml(site!, LOCALES, ["/"]), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
