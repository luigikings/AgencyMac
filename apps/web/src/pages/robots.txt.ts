import type { APIRoute } from "astro";
import { buildRobotsTxt } from "../lib/sitemap";

// Static endpoint: the build writes dist/robots.txt (crawling allowed, with
// the sitemap). Staging adds its noindex through response headers instead.
export const GET: APIRoute = ({ site }) =>
  new Response(buildRobotsTxt(site!), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
