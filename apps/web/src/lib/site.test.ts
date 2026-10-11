import { describe, expect, it } from "vitest";
import { SITE_NAME, buildPageTitle } from "./site";

describe("buildPageTitle", () => {
  it("exposes the brand name", () => {
    expect(SITE_NAME).toBe("AgencyMac");
  });

  it("returns the site name when there is no page title", () => {
    expect(buildPageTitle(SITE_NAME)).toBe("AgencyMac");
  });

  it("appends the site name to the page title", () => {
    expect(buildPageTitle(SITE_NAME, "Servicios")).toBe(
      "Servicios · AgencyMac",
    );
  });

  it("ignores empty or blank page titles", () => {
    expect(buildPageTitle(SITE_NAME, "")).toBe("AgencyMac");
    expect(buildPageTitle(SITE_NAME, "   ")).toBe("AgencyMac");
  });

  it("trims surrounding whitespace from the page title", () => {
    expect(buildPageTitle(SITE_NAME, "  Contacto ")).toBe(
      "Contacto · AgencyMac",
    );
  });
});
