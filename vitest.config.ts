import { defineConfig } from "vitest/config";

// One Vitest project per workspace area. Playwright specs (e2e/) are never
// run here.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "scripts",
          include: ["scripts/**/*.test.mjs"],
          environment: "node",
        },
      },
      {
        test: {
          name: "web",
          include: ["apps/web/src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "control",
          include: ["apps/control/src/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
