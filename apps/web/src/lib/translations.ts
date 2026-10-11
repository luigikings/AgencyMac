// Translation dictionaries of the public website, one per locale.
// Every visible text, or text read by search engines or screen readers
// (titles, meta descriptions, aria-labels, link texts), comes from here.
// The texts are provisional: the real content arrives in phase 1.

const es = {
  "home.title": "Agencia de diseño web, SEO y Google Ads",
  "home.description":
    "AgencyMac diseña webs rápidas, las posiciona en Google con SEO y mantenimiento y gestiona tus campañas de Google Ads para que tu negocio consiga más clientes.",
  "home.heading": "Tu negocio, listo para despegar en internet",
  "home.intro":
    "Somos una agencia de marketing, análisis y desarrollo web. Esta es una versión provisional de nuestra web: muy pronto encontrarás aquí todo lo que podemos hacer por ti.",
  "home.sectionHeading": "Qué hacemos",
  "home.sectionBody":
    "Creamos webs a medida, cuidamos su posicionamiento en buscadores y gestionamos campañas de Google Ads con un objetivo claro: que te encuentren y te elijan.",
  "notFound.title": "Página no encontrada",
  "notFound.description":
    "La página que buscas no existe o ha cambiado de dirección. Vuelve al inicio de AgencyMac para descubrir nuestros servicios de diseño web, SEO y Google Ads.",
  "notFound.heading": "Esta página se ha perdido en el espacio",
  "notFound.message":
    "No encontramos la página que buscas. Puede que la dirección esté mal escrita o que la página ya no exista.",
  "notFound.backHome": "Volver al inicio",
  "nav.label": "Navegación principal",
  "nav.home": "AgencyMac, ir al inicio",
  "nav.switchLanguage": "English",
  "a11y.skipToContent": "Saltar al contenido",
  "footer.text": "AgencyMac: marketing, análisis y desarrollo web.",
} as const satisfies Record<string, string>;

/** Every translation key. Spanish is the reference dictionary. */
export type TranslationKey = keyof typeof es;

const en: Record<TranslationKey, string> = {
  "home.title": "Web design, SEO and Google Ads marketing agency",
  "home.description":
    "AgencyMac builds fast websites, ranks them on Google with SEO and ongoing maintenance, and runs your Google Ads campaigns so your business wins more clients.",
  "home.heading": "Your business, ready to take off online",
  "home.intro":
    "We are a marketing, analytics and web development agency. This is a provisional version of our website: soon you will find here everything we can do for you.",
  "home.sectionHeading": "What we do",
  "home.sectionBody":
    "We build custom websites, take care of their search engine rankings and manage Google Ads campaigns with one clear goal: to get you found and chosen.",
  "notFound.title": "Page not found",
  "notFound.description":
    "The page you are looking for does not exist or has moved. Go back to the AgencyMac home page to discover our web design, SEO and Google Ads services.",
  "notFound.heading": "This page got lost in space",
  "notFound.message":
    "We could not find the page you are looking for. The address may be misspelled or the page may no longer exist.",
  "notFound.backHome": "Back to the home page",
  "nav.label": "Main navigation",
  "nav.home": "AgencyMac, go to the home page",
  "nav.switchLanguage": "Español",
  "a11y.skipToContent": "Skip to content",
  "footer.text": "AgencyMac: marketing, analytics and web development.",
};

export const translations: Record<
  "es" | "en",
  Record<TranslationKey, string>
> = { es, en };
