import { describe, expect, it } from "vitest";
import { APP_NAME, buildDocumentTitle } from "./documentTitle";

describe("buildDocumentTitle", () => {
  it("returns the app name when there is no section", () => {
    expect(buildDocumentTitle()).toBe("Centro de Control");
    expect(APP_NAME).toBe("Centro de Control");
  });

  it("prefixes the section to the app name", () => {
    expect(buildDocumentTitle("Clientes")).toBe("Clientes · Centro de Control");
  });

  it("ignores empty or blank sections", () => {
    expect(buildDocumentTitle("")).toBe("Centro de Control");
    expect(buildDocumentTitle("   ")).toBe("Centro de Control");
  });

  it("trims surrounding whitespace from the section", () => {
    expect(buildDocumentTitle("  Proyectos ")).toBe(
      "Proyectos · Centro de Control",
    );
  });
});
