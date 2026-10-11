import type { APIRoute } from "astro";
import { buildFaviconSvg } from "../lib/favicon";
import { colors } from "../styles/tokens";

// Static endpoint: the build writes dist/favicon.svg. Its colours come from
// the brand tokens, so no hex is written outside src/styles/tokens.ts.
export const GET: APIRoute = () =>
  new Response(
    buildFaviconSvg(colors.logoGradient2.value, colors.bgDark.value),
    { headers: { "Content-Type": "image/svg+xml" } },
  );
