// @ts-check
import { defineConfig } from "astro/config";

// Minimal public website: static HTML output, no client-side JavaScript.
// i18n, brand and full SEO arrive with spec 002.
export default defineConfig({
  site: "https://agencymac.com",
  output: "static",
});
