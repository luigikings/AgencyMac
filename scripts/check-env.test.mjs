import { describe, expect, it } from "vitest";
import { checkEnvironment } from "./check-env.mjs";

const PNPM_UA = "pnpm/12.11.1 npm/? node/v24.21.0 win32 x64";
const NPM_UA = "npm/11.6.0 node/v24.21.0 win32 x64 workspaces/false";

describe("checkEnvironment", () => {
  it("accepts Node 24 with pnpm", () => {
    expect(
      checkEnvironment({ nodeVersion: "v24.21.0", userAgent: PNPM_UA }),
    ).toEqual([]);
  });

  it("accepts any Node 24.x release", () => {
    expect(
      checkEnvironment({ nodeVersion: "v24.0.0", userAgent: PNPM_UA }),
    ).toEqual([]);
  });

  it.each(["v22.15.0", "v23.11.0", "v25.0.0", "v26.11.1"])(
    "rejects Node %s and states the expected range",
    (nodeVersion) => {
      const errors = checkEnvironment({ nodeVersion, userAgent: PNPM_UA });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(">=24 <25");
      expect(errors[0]).toContain(nodeVersion);
    },
  );

  it("rejects npm and asks to use pnpm", () => {
    const errors = checkEnvironment({
      nodeVersion: "v24.21.0",
      userAgent: NPM_UA,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("pnpm install");
  });

  it("rejects yarn", () => {
    const errors = checkEnvironment({
      nodeVersion: "v24.21.0",
      userAgent: "yarn/1.22.22 npm/? node/v24.21.0",
    });
    expect(errors).toHaveLength(1);
  });

  it("rejects a missing user agent", () => {
    expect(
      checkEnvironment({ nodeVersion: "v24.21.0", userAgent: undefined }),
    ).toHaveLength(1);
  });

  it("reports both problems at once", () => {
    expect(
      checkEnvironment({ nodeVersion: "v22.15.0", userAgent: NPM_UA }),
    ).toHaveLength(2);
  });

  it("rejects an unparseable Node version", () => {
    expect(
      checkEnvironment({ nodeVersion: "garbage", userAgent: PNPM_UA }),
    ).toHaveLength(1);
  });
});
