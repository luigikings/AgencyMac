import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(`${root}${path}`, "utf8"));

// RF-6, RF-7, RF-17 to RF-24: the staging Worker only serves the staging copy
// of the public website, on workers.dev, with no routes, custom domains,
// account id or variables in the repository.
describe("apps/web/wrangler.json", () => {
  const config = readJson("apps/web/wrangler.json");

  it("names the staging Worker and uses a fixed compatibility date", () => {
    expect(config.name).toBe("agencymac-staging");
    expect(config.compatibility_date).toBe("2026-09-01");
  });

  it("publishes on workers.dev only, without preview URLs", () => {
    expect(config.workers_dev).toBe(true);
    expect(config.preview_urls).toBe(false);
  });

  it("serves the staging copy as static assets with 404 pages and trailing slashes", () => {
    expect(config.assets).toEqual({
      directory: "./.staging",
      not_found_handling: "404-page",
      html_handling: "auto-trailing-slash",
    });
  });

  it.each([
    "main",
    "routes",
    "route",
    "custom_domains",
    "account_id",
    "vars",
    "env",
  ])("has no %s", (key) => {
    expect(config).not.toHaveProperty(key);
  });

  it("has nothing else", () => {
    expect(Object.keys(config).sort()).toEqual([
      "assets",
      "compatibility_date",
      "name",
      "preview_urls",
      "workers_dev",
    ]);
  });
});
