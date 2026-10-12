// Translation dictionaries of the public website, one per locale.
// Every visible text, or text read by search engines or screen readers
// (titles, meta descriptions, aria-labels, alt texts, link texts), comes from
// here. The home page texts are the "Textos propuestos" table of
// specs/004-web-portada/spec.md; a test keeps both in step. Proper nouns
// (brand, services, projects, people) are not here: see site-data.ts.

const es = {
  "home.title": "Diseño web, SEO y Google Ads para tu negocio",
  "home.description":
    "AgencyMac, agencia de marketing, análisis y desarrollo web: creamos tu web, la posicionamos en Google y gestionamos tus anuncios. ¡Hazlo galáctico con Mac!",
  "og.imageAlt":
    "Logotipo de AgencyMac: un cohete naranja y las palabras MAC Agency",
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
  "nav.services": "Servicios",
  "nav.projects": "Proyectos",
  "nav.team": "Quiénes somos",
  "nav.contact": "Contacto",
  "cta.takeOff": "Quiero despegar",
  "a11y.skipToContent": "Saltar al contenido",
  "footer.text": "AgencyMac: marketing, análisis y desarrollo web.",
  "hero.heading":
    "Agencia de diseño web, SEO y Google Ads para conseguir más clientes",
  "hero.tagline": "Creamos ideas que parecen de otro planeta",
  "hero.kicker": "¡Hazlo Galáctico! Hazlo MAC",
  "hero.subtitle":
    "Webs rápidas, posicionamiento en Google y anuncios que funcionan, de la mano de un equipo de marketing, análisis y desarrollo.",
  "hero.discover": "Descubre cómo",
  "hero.macGestureLabel": "Saludar a Mac",
  "hero.macAlt": "Mac, el alien mascota de AgencyMac, asomado a su nave",
  "services.heading": "Tres planetas para despegar",
  "services.intro":
    "Mac te lleva de planeta en planeta: empieza por el plan base, web y posicionamiento, y suma un propulsor cuando quieras acelerar.",
  "services.tagBase": "Plan base",
  "services.tagBooster": "Propulsor extra",
  "services.hexaweb.role": "Desarrollo web",
  "services.hexaweb.body":
    "Diseñamos y programamos webs rápidas, claras y pensadas para convertir visitas en clientes. Se ven bien en el móvil, cargan en un suspiro y Google las entiende.",
  "services.hexaweb.alt":
    "Hexaweb, el planeta turquesa de las webs, con un anillo dorado",
  "services.rankia.role": "SEO y mantenimiento",
  "services.rankia.body":
    "Hacemos que te encuentren: SEO técnico y de contenido, y mantenimiento continuo para que tu web siga rápida, segura y bien posicionada mes a mes.",
  "services.rankia.alt":
    "Rankia, el planeta azul verdoso del posicionamiento, con un anillo",
  "services.adara.role": "Google Ads",
  "services.adara.body":
    "El propulsor: campañas de Google Ads que ponen tu web delante de quien ya está buscando lo que ofreces, con resultados que se pueden medir.",
  "services.adara.alt":
    "Adara, el planeta naranja de la publicidad, con un anillo amarillo y rosa",
  "projects.heading": "Proyectos que ya han aterrizado",
  "projects.intro": "Algunas de las webs con las que hemos trabajado.",
  "projects.metalrenova.description": "Chatarrería y reciclaje de metales.",
  "projects.magnar.description": "Web de wargames y juegos de miniaturas.",
  "projects.visit": "Visitar",
  "projects.newTab": "(se abre en una pestaña nueva)",
  "team.heading": "Quiénes somos",
  "team.intro":
    "La tripulación de Mac: tres personas, tres especialidades y una misión, que tu negocio despegue.",
  "team.role.marketing": "Marketing",
  "team.role.analytics": "Análisis",
  "team.role.coding": "Coding",
  "contact.heading": "Prepara el despegue",
  "contact.body":
    "Estamos terminando el formulario para pedir presupuesto. Muy pronto podrás contarnos tu proyecto desde aquí y despegar con nosotros.",
  "contact.status": "Formulario próximamente",
} as const satisfies Record<string, string>;

/** Every translation key. Spanish is the reference dictionary. */
export type TranslationKey = keyof typeof es;

const en: Record<TranslationKey, string> = {
  "home.title": "Web design, SEO and Google Ads for your business",
  "home.description":
    "AgencyMac, a marketing, analytics and web development agency: we build your website, rank it on Google and run your ads. Make it galactic with Mac!",
  "og.imageAlt": "AgencyMac logo: an orange rocket and the words MAC Agency",
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
  "nav.services": "Services",
  "nav.projects": "Projects",
  "nav.team": "About us",
  "nav.contact": "Contact",
  "cta.takeOff": "I want to take off",
  "a11y.skipToContent": "Skip to content",
  "footer.text": "AgencyMac: marketing, analytics and web development.",
  "hero.heading":
    "Web design, SEO and Google Ads agency that wins you more clients",
  "hero.tagline": "We create ideas that look out of this world",
  "hero.kicker": "Make it Galactic! Make it MAC",
  "hero.subtitle":
    "Fast websites, Google rankings and ads that work, from a team of marketing, analytics and development specialists.",
  "hero.discover": "Find out how",
  "hero.macGestureLabel": "Say hi to Mac",
  "hero.macAlt":
    "Mac, the AgencyMac alien mascot, peeking out of his spaceship",
  "services.heading": "Three planets to take off",
  "services.intro":
    "Mac takes you from planet to planet: start with the base plan, website and search ranking, and add a booster whenever you want to speed up.",
  "services.tagBase": "Base plan",
  "services.tagBooster": "Extra booster",
  "services.hexaweb.role": "Web development",
  "services.hexaweb.body":
    "We design and build fast, clear websites made to turn visitors into clients. They look great on mobile, load in a blink and Google understands them.",
  "services.hexaweb.alt":
    "Hexaweb, the turquoise web planet with a golden ring",
  "services.rankia.role": "SEO and maintenance",
  "services.rankia.body":
    "We make sure you get found: technical and content SEO, plus ongoing maintenance so your website stays fast, secure and well ranked month after month.",
  "services.rankia.alt":
    "Rankia, the blue-green search ranking planet, with a ring",
  "services.adara.role": "Google Ads",
  "services.adara.body":
    "The booster: Google Ads campaigns that put your website in front of people already searching for what you offer, with results you can measure.",
  "services.adara.alt":
    "Adara, the orange advertising planet, with a yellow and pink ring",
  "projects.heading": "Projects that have already landed",
  "projects.intro": "Some of the websites we have worked on.",
  "projects.metalrenova.description": "Scrap yard and metal recycling.",
  "projects.magnar.description": "Wargames and miniatures website.",
  "projects.visit": "Visit",
  "projects.newTab": "(opens in a new tab)",
  "team.heading": "About us",
  "team.intro":
    "Mac's crew: three people, three specialities and one mission, to make your business take off.",
  "team.role.marketing": "Marketing",
  "team.role.analytics": "Analytics",
  "team.role.coding": "Coding",
  "contact.heading": "Get ready for take-off",
  "contact.body":
    "We are finishing the quote request form. Very soon you will be able to tell us about your project right here and take off with us.",
  "contact.status": "Form coming soon",
};

export const translations: Record<
  "es" | "en",
  Record<TranslationKey, string>
> = { es, en };
