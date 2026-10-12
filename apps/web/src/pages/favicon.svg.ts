import type { APIRoute } from "astro";
import { buildIsologoFaviconSvg } from "../lib/favicon-isologo";
import { colors } from "../styles/tokens";

// Static endpoint: the build writes dist/favicon.svg, the isologo redrawn with
// flat shapes. Its colours come from the brand tokens, so no hex is written
// outside src/styles/tokens.ts.
export const GET: APIRoute = () =>
  new Response(
    buildIsologoFaviconSvg({
      background: colors.bgDark.value,
      body: colors.logoGradient1.value,
      shade: colors.logoGradient2.value,
      flame: colors.buttonHover.value,
    }),
    { headers: { "Content-Type": "image/svg+xml" } },
  );
