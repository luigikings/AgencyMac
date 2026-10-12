// @ts-check
import { existsSync } from "node:fs";
import { mkdir, rename, rmdir } from "node:fs/promises";
import { dirname } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { defineConfig, fontProviders } from "astro/config";
import { LOCALES, notFoundRelocations } from "./src/lib/i18n.ts";
import { fontFamilies, fonts } from "./src/styles/tokens.ts";

/**
 * Astro only emits the root 404 as "404.html"; "en/404.astro" becomes
 * "en/404/index.html". Hosting (and scripts/serve-static.mjs) look for the
 * nearest "404.html" walking up the folders, so the build moves it to
 * "en/404.html" and removes the emptied folder (plan, decision D4).
 * @returns {import("astro").AstroIntegration}
 */
function relocateNotFound() {
  return {
    name: "relocate-not-found",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        for (const { from, to, removeDir } of notFoundRelocations(LOCALES)) {
          const source = fileURLToPath(new URL(from, dir));
          const target = fileURLToPath(new URL(to, dir));
          if (!existsSync(source)) {
            throw new Error(
              `relocate-not-found: "${from}" was not generated; the ${to} page would be missing`,
            );
          }
          await mkdir(dirname(target), { recursive: true });
          await rename(source, target);
          // rmdir (not a recursive rm): fails loudly if Astro ever puts
          // anything else in that folder, instead of deleting it.
          await rmdir(fileURLToPath(new URL(removeDir, dir)));
          logger.info(`${from} → ${to}`);
        }
      },
    },
  };
}

// Static public website. The only client-side JavaScript is the deferred
// animation layer of the home page (spec 004). Brand fonts are self-hosted
// from src/assets/fonts (local provider, never a font CDN).
export default defineConfig({
  site: "https://agencymac.com",
  output: "static",
  fonts: fontFamilies(fonts, fontProviders.local()),
  integrations: [relocateNotFound()],
  vite: {
    build: {
      rollupOptions: {
        // GSAP's licence forbids removing its notice (plan 0.2): keep the
        // legal comments (`@license`) that minification drops by default.
        output: { comments: { legal: true } },
      },
    },
  },
});
