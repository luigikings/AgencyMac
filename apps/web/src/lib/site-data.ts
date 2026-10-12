// Data of the home page (spec 004). Proper nouns (services, projects, people)
// and structure live here, never in the pages or the translations; every
// translatable text is referenced by its key in translations.ts.

import type { ColorName } from "../styles/tokens";
import type { TranslationKey } from "./translations";

export type Section = {
  /** Anchor id of the section (same in every language). */
  id: "hero" | "services" | "projects" | "team" | "contact";
  /** Navigation label, for the sections that appear in the navigation. */
  navKey?: TranslationKey;
};

/** The five sections of the home page, in page order. */
export const SECTIONS: readonly Section[] = [
  { id: "hero" },
  { id: "services", navKey: "nav.services" },
  { id: "projects", navKey: "nav.projects" },
  { id: "team", navKey: "nav.team" },
  { id: "contact", navKey: "nav.contact" },
];

/** The sections that have a link in the header navigation. */
export const NAV_SECTIONS = SECTIONS.filter(
  (section): section is Section & { navKey: TranslationKey } =>
    section.navKey !== undefined,
);

/** Where "Quiero despegar" goes: the contact section (spec 006 fills it). */
export const CTA_TARGET = "#contact";

/** Where "Descubre cómo" goes until the service pages exist (spec 005). */
export const DISCOVER_TARGET = "#services";

export type Service = {
  id: "hexaweb" | "rankia" | "adara";
  name: string;
  tagKey: TranslationKey;
  roleKey: TranslationKey;
  bodyKey: TranslationKey;
  altKey: TranslationKey;
  /** Colour token of the block background. */
  bgToken: ColorName;
  /** Name of the planet image in src/assets/brand/. */
  image: `planet-${string}`;
};

/** The three services, as planets: base plan first, booster last. */
export const SERVICES: readonly Service[] = [
  {
    id: "hexaweb",
    name: "Hexaweb",
    tagKey: "services.tagBase",
    roleKey: "services.hexaweb.role",
    bodyKey: "services.hexaweb.body",
    altKey: "services.hexaweb.alt",
    bgToken: "planetHexawebBg",
    image: "planet-hexaweb",
  },
  {
    id: "rankia",
    name: "Rankia",
    tagKey: "services.tagBase",
    roleKey: "services.rankia.role",
    bodyKey: "services.rankia.body",
    altKey: "services.rankia.alt",
    bgToken: "planetRankiaBg",
    image: "planet-rankia",
  },
  {
    id: "adara",
    name: "Adara",
    tagKey: "services.tagBooster",
    roleKey: "services.adara.role",
    bodyKey: "services.adara.body",
    altKey: "services.adara.alt",
    bgToken: "planetAdaraBg",
    image: "planet-adara",
  },
];

export type Project = {
  id: string;
  name: string;
  /** External link (https, no www). */
  url: string;
  /** Visible domain, the host of `url`. */
  domain: string;
  descriptionKey: TranslationKey;
};

export const PROJECTS: readonly Project[] = [
  {
    id: "metalrenova",
    name: "Metal Renova",
    url: "https://chatarreriametalrenova.es",
    domain: "chatarreriametalrenova.es",
    descriptionKey: "projects.metalrenova.description",
  },
  {
    id: "magnar",
    name: "Magnar WarGames",
    url: "https://magnarwargames.com",
    domain: "magnarwargames.com",
    descriptionKey: "projects.magnar.description",
  },
];

export type TeamMember = {
  /** First name only: no surnames, photos or contact data. */
  name: string;
  roleKey: TranslationKey;
};

export const TEAM: readonly TeamMember[] = [
  { name: "Joni", roleKey: "team.role.marketing" },
  { name: "Samuel", roleKey: "team.role.analytics" },
  { name: "Luigi", roleKey: "team.role.coding" },
];
