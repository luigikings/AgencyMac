import { describe, expect, it } from "vitest";
import { colors } from "../styles/tokens";
import { LOCALES } from "./i18n";
import {
  CTA_TARGET,
  DISCOVER_TARGET,
  NAV_SECTIONS,
  PROJECTS,
  SECTIONS,
  SERVICES,
  TEAM,
} from "./site-data";
import { translations } from "./translations";

// Data of the home page (RF-1, RF-4, RF-6, RF-8, RF-10, RF-14): proper nouns
// live here, the translatable text lives in translations.ts.
const keyExists = (key: string) =>
  LOCALES.every((locale) => Object.hasOwn(translations[locale], key));

describe("SECTIONS", () => {
  it("lists the five sections in order, with unique ids", () => {
    expect(SECTIONS.map((section) => section.id)).toEqual([
      "hero",
      "services",
      "projects",
      "team",
      "contact",
    ]);
  });

  it("puts four of them in the navigation, with an existing label", () => {
    expect(NAV_SECTIONS.map((section) => section.id)).toEqual([
      "services",
      "projects",
      "team",
      "contact",
    ]);
    for (const section of NAV_SECTIONS) {
      expect(keyExists(section.navKey), section.navKey).toBe(true);
    }
  });

  it("targets existing sections with the two calls to action", () => {
    const ids = SECTIONS.map((section) => `#${section.id}`);
    expect(CTA_TARGET).toBe("#contact");
    expect(DISCOVER_TARGET).toBe("#services");
    expect(ids).toContain(CTA_TARGET);
    expect(ids).toContain(DISCOVER_TARGET);
  });
});

describe("SERVICES", () => {
  it("has exactly Hexaweb, Rankia and Adara", () => {
    expect(SERVICES.map((service) => service.name)).toEqual([
      "Hexaweb",
      "Rankia",
      "Adara",
    ]);
    expect(new Set(SERVICES.map((service) => service.id)).size).toBe(3);
  });

  it("labels the first two as base plan and Adara as booster", () => {
    expect(SERVICES.map((service) => service.tagKey)).toEqual([
      "services.tagBase",
      "services.tagBase",
      "services.tagBooster",
    ]);
  });

  it("uses an existing text, alt text, image and background token", () => {
    for (const service of SERVICES) {
      for (const key of [service.roleKey, service.bodyKey, service.altKey]) {
        expect(keyExists(key), key).toBe(true);
      }
      expect(Object.keys(colors)).toContain(service.bgToken);
      expect(service.image).toMatch(/^planet-[a-z]+$/);
    }
    expect(SERVICES.map((service) => service.bgToken)).toEqual([
      "planetHexawebBg",
      "planetRankiaBg",
      "planetAdaraBg",
    ]);
  });
});

describe("PROJECTS", () => {
  it("has Metal Renova and Magnar WarGames with https URL and domain", () => {
    expect(PROJECTS.map((project) => project.name)).toEqual([
      "Metal Renova",
      "Magnar WarGames",
    ]);
    expect(PROJECTS.map((project) => project.domain)).toEqual([
      "chatarreriametalrenova.es",
      "magnarwargames.com",
    ]);
    for (const project of PROJECTS) {
      const url = new URL(project.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe(project.domain);
      expect(keyExists(project.descriptionKey), project.descriptionKey).toBe(
        true,
      );
    }
  });
});

describe("TEAM", () => {
  it("has Joni, Samuel and Luigi with a role, and nothing else", () => {
    expect(TEAM.map((person) => person.name)).toEqual([
      "Joni",
      "Samuel",
      "Luigi",
    ]);
    expect(TEAM.map((person) => person.roleKey)).toEqual([
      "team.role.marketing",
      "team.role.analytics",
      "team.role.coding",
    ]);
    for (const person of TEAM) {
      expect(Object.keys(person).sort()).toEqual(["name", "roleKey"]);
      expect(keyExists(person.roleKey), person.roleKey).toBe(true);
    }
  });
});
