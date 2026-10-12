import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spec 004, T16 (RNF-5, RNF-12): the animation dependencies are pinned to the
// versions approved with the plan, their licences are recorded, and the JS
// budget comes from a real measurement, not from a guess.
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${ROOT}${path}`, "utf8");
const webPackage = JSON.parse(read("apps/web/package.json"));
const plan = read("specs/004-web-portada/plan.md");
const brand = read("LICENSE-BRAND.md");
const lockfile = read("pnpm-lock.yaml");

const GSAP_LICENSE_URL = "https://gsap.com/standard-license";

function section(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  const end = text.indexOf(endHeading, start + 1);
  expect(start, `missing heading ${startHeading}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing heading ${endHeading}`).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe("animation dependencies (T16)", () => {
  it("pins gsap 3.15.0 and lenis 1.3.26 exactly, without ^ or ~", () => {
    expect(webPackage.devDependencies.gsap).toBe("3.15.0");
    expect(webPackage.devDependencies.lenis).toBe("1.3.26");
  });

  it("resolves exactly those versions in the lockfile", () => {
    expect(lockfile).toMatch(/^ {2}gsap@3\.15\.0:/m);
    expect(lockfile).toMatch(/^ {2}lenis@1\.3\.26[(:]/m);
    expect(lockfile).not.toMatch(/^ {2}gsap@(?!3\.15\.0)/m);
    expect(lockfile).not.toMatch(/^ {2}lenis@(?!1\.3\.26)/m);
  });
});

describe("GSAP licence is read and recorded (plan 0.2, LICENSE-BRAND.md)", () => {
  const plan02 = section(plan, "### 0.2", "### 0.3");

  it("records identifier, link, conditions and the decision in plan 0.2", () => {
    expect(plan02).toContain("Standard 'no charge' license");
    expect(plan02).toContain(GSAP_LICENSE_URL);
    expect(plan02).toMatch(/Decisión \(T16\): continuar/);
    expect(plan02).toMatch(/Prohibited Use/);
    expect(plan02).toMatch(/gsap-core\.js|@license/);
  });

  it("cites the GSAP licence with its real identifier in LICENSE-BRAND.md", () => {
    const line = brand.split("\n").find((l) => l.includes("**GSAP**"));
    expect(line).toBeDefined();
    expect(line).toContain("Standard 'no charge' license");
    expect(line).toContain(GSAP_LICENSE_URL);
    const lenis = brand.split("\n").find((l) => l.includes("**Lenis**"));
    expect(lenis).toContain("MIT");
  });
});

describe("JS budget is fixed with a measurement (plan 0.3 and 8)", () => {
  it("records the measured gzip weights and the spike TBT in plan 0.3", () => {
    const plan03 = section(plan, "### 0.3", "### 0.4");
    expect(plan03).toMatch(/Medición \(T16,/);
    expect(plan03).toMatch(/GSAP[^\n]*KB/);
    expect(plan03).toMatch(/ScrollTrigger[^\n]*KB/);
    expect(plan03).toMatch(/Lenis[^\n]*KB/);
    expect(plan03).toMatch(/TBT/);
  });

  it("no longer leaves the total JS budget pending in plan 8", () => {
    const plan8 = section(plan, "## 8. Presupuestos", "## 9.");
    expect(plan8).not.toMatch(/se fija con la medición real/);
    expect(plan8).toMatch(/medido en T16/);
  });
});
