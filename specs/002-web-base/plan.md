# Plan — Spec 002: Esqueleto de la web pública

Parte de `specs/002-web-base/spec.md` (Estado: aprobada). Cumple `docs/constitution.md`, `AGENTS.md` y `apps/web/AGENTS.md`. Base ya construida: spec 001 (commit d81ca25).

## 0. Decisiones resueltas por el usuario (2026-10-11)

El usuario aceptó las tres recomendaciones.

| Id  | Problema                                                                                                                                                                                                                  | Decisión aceptada                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Alternativas descartadas                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Color del texto.** RF-16 no tenía ningún color neutro para el texto, y RF-17 prohíbe cualquier hex fuera del archivo de tokens.                                                                                         | Token neutro `text` = #FFFFFF ("texto sobre fondos oscuros") en el archivo de tokens, sin cambiar el papel de los colores de marca. RF-16 ya lo incluye: cambio menor anotado en la spec el 2026-10-11, que sigue aprobada.                                                                                                                                                                                                                                                                                              | (a) Usar #DAF7A6 (verde claro) como color de texto: cambia el papel confirmado de "acento". (b) Usar la palabra clave CSS `white`: cumple RF-17 al pie de la letra, pero se salta HU-4 (un solo lugar para los colores).                                             |
| P2  | **Origen de los woff2.** El repositorio oficial de Google Fonts en GitHub (`google/fonts`, carpetas `ofl/lilitaone` y `ofl/lato`) solo tiene **TTF**, no woff2.                                                           | Los 3 woff2 del subconjunto `latin` (Lilita One 400, Lato 400 y Lato 700) se descargan una sola vez de los paquetes npm de Fontsource (`@fontsource/lilita-one` y `@fontsource/lato`, licencia OFL-1.1). Se sacan del tarball de npm con versión exacta no publicada el mismo día y se versionan en el repo con su licencia y `NOTICE.md`. No se añade ninguna dependencia. La descarga se hace en T7, y el usuario la aprueba en ese momento. El subconjunto `latin` (U+0000-00FF…) incluye ñ, á, é, í, ó, ú, ü, ¿ y ¡. | (a) Instalar Fontsource como devDependencies: son dependencias nuevas. (b) Convertir los TTF de `google/fonts` a woff2: necesita una herramienta nueva (fonttools/woff2). (c) `fontProviders.google()`: descarga de Google en cada build limpia y depende de la red. |
| P3  | **Servidor local de la build.** `astro preview` siempre sirve `dist/404.html`, también para `/en/...`, y no admite plugins de usuario (lo hemos comprobado en el código de Astro 7.3.8). Con él no se puede cumplir RF-8. | Servidor estático propio `scripts/serve-static.mjs`, sin dependencias (`node:http`), en lugar de `astro preview`. Imita lo que hará Cloudflare Pages: busca el `404.html` más cercano, distingue mayúsculas y minúsculas aunque Windows no lo haga, y redirige `/en` → `/en/`. Usa el puerto 4322 y falla si está ocupado.                                                                                                                                                                                               | (a) `wrangler pages dev`: es una dependencia nueva y pesada, y Cloudflare queda fuera de alcance. Se revisará en la spec de despliegue. (b) Seguir con `astro preview` y una sola 404: incumple RF-8.                                                                |

**Dependencias npm nuevas: ninguna.** Lo único nuevo son 3 archivos de fuente con sus licencias, y su descarga se aprueba en T7.

## 1. Visión general

- Todo es HTML estático generado por Astro, sin JavaScript de cliente (RNF-3). Hay cuatro páginas: `/`, `/en/`, `404` ES y `404` EN.
- La lógica va en funciones puras con tests en Vitest (principio 3):
  - Rutas e idiomas.
  - Traducciones por clave y su comprobación.
  - Canonical y hreflang.
  - Tokens de marca y su CSS.
  - Favicon.
  - Detector de hex sueltos.
  - Resolución de peticiones del servidor local.
- Las páginas solo pintan: un layout común, la cabecera con la navegación y el pie, y dos componentes de contenido (inicio y 404). Las páginas de `src/pages/` son envoltorios finos que solo pasan el idioma.
- **i18n nativo y sin dependencias.** No se activa el `i18n` routing de Astro: sus helpers viven en un módulo virtual (`astro:i18n`) que no se puede probar en Vitest, y con dos rutas estáticas no aporta nada. Se podrá adoptar más adelante sin cambiar las URLs.
- **Tipografías con la Fonts API de Astro** (estable desde la 6.0), usando el proveedor `local`:
  - Genera los `@font-face` con `font-display: swap` por defecto (RF-19).
  - Genera fuentes de respaldo con métricas ajustadas, lo que reduce el CLS (RNF-2).
  - Gestiona el `preload`, y los archivos se sirven desde el propio sitio (RF-18).

## 2. Archivos y responsabilidades

### Raíz

| Archivo                         | Responsabilidad                                                                                                                                                                                                                                                                                                                                                                                                                                      | RF                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `scripts/serve-static.mjs`      | Funciones puras exportadas: `resolveRequest({ pathname, search, files })` y `contentTypeFor(path)`. El bloque CLI (`--dir`, `--port`) lee `dist` de forma recursiva y construye un `Set` de rutas POSIX con su mayúscula/minúscula real. Sirve con `node:http` en `localhost`, comprime con gzip (`node:zlib`) los tipos de texto si el cliente lo acepta e imprime `http://localhost:<port>/`. Si el puerto está ocupado (`EADDRINUSE`), sale con 1 | RF-2, RF-8, RF-10 |
| `scripts/serve-static.test.mjs` | Vitest de `resolveRequest` y `contentTypeFor` (casos de la sección 4)                                                                                                                                                                                                                                                                                                                                                                                | RF-2, RF-8, RF-10 |
| `AGENTS.md`                     | Línea de puertos: la preview 4322 la sirve `scripts/serve-static.mjs`, que imita Cloudflare Pages (404 por carpeta, distingue mayúsculas/minúsculas)                                                                                                                                                                                                                                                                                                 | —                 |
| `README.md`                     | Frase de los puertos ajustada al nuevo servidor de la preview                                                                                                                                                                                                                                                                                                                                                                                        | —                 |
| `MEMORY.md`                     | Estado: 001 commiteada y subida (quitar "Aún sin commit" y el primer próximo paso); 002 cerrada; cian provisional; decisiones P1-P3 con su porqué. En pendientes del usuario, quitar "revisar las descripciones de Hexaweb, Rankia y Adara" (ya validadas) y "definir `CHROME_DEVTOOLS_EXECUTABLE`" (ya definida en su usuario de Windows)                                                                                                           | E-3               |

`playwright.config.ts` y `vitest.config.ts` no cambian. El proyecto `web` sigue en 4322 con `pnpm --filter web preview`, y `scripts/**/*.test.mjs` ya está incluido.

### apps/web

| Archivo                                                                                                                                                                                                                                                                     | Responsabilidad                                                                                                                                                                                                                                                                                                                                                                                                           | RF                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `package.json`                                                                                                                                                                                                                                                              | `preview` pasa a ser `node ../../scripts/serve-static.mjs --dir dist --port 4322`. `dev` y `build` no cambian (telemetría desactivada)                                                                                                                                                                                                                                                                                    | RF-2, RF-8, RF-10                   |
| `astro.config.mjs`                                                                                                                                                                                                                                                          | `site: "https://agencymac.com"` (única fuente de la URL base; las páginas la leen con `Astro.site`). `fonts` con `fontProviders.local()` a partir de los tokens de tipografía. Integración inline `relocateNotFound` (hook `astro:build:done`) que mueve `dist/en/404/index.html` a `dist/en/404.html` y borra la carpeta vacía (ver decisión D4)                                                                         | RF-8, RF-12, RF-18, RF-19           |
| `src/lib/site.ts`                                                                                                                                                                                                                                                           | Ya existe. Se mantienen `SITE_NAME` (nombre propio de la marca, igual en los dos idiomas, que no es texto traducible) y `buildPageTitle`                                                                                                                                                                                                                                                                                  | RF-11                               |
| `src/lib/i18n.ts`                                                                                                                                                                                                                                                           | `LOCALES = ["es", "en"]`, `DEFAULT_LOCALE = "es"`, tipo `Locale`, `localizePath(locale, path)`, `otherLocale(locale)`, `t(locale, key)` (lanza un error si la clave falta o está vacía, así que la build falla)                                                                                                                                                                                                           | RF-1, RF-5, RF-6                    |
| `src/lib/translations.ts`                                                                                                                                                                                                                                                   | Diccionarios `{ es: {...}, en: {...} }` con todas las claves de la sección 6                                                                                                                                                                                                                                                                                                                                              | RF-6                                |
| `src/lib/translation-check.ts`                                                                                                                                                                                                                                              | `findMissingTranslations(dictionaries, locales)` devuelve `[{ key, locale, problem: "missing" \| "empty" }]` y detecta también las claves que solo existen en un idioma                                                                                                                                                                                                                                                   | RF-7                                |
| `src/lib/seo.ts`                                                                                                                                                                                                                                                            | `withTrailingSlash(path)`, `canonicalUrl(site, path)`, `alternateLinks(site, path)` devuelve `[{ hreflang: "es" \| "en" \| "x-default", href }]`, con `x-default` = la URL ES                                                                                                                                                                                                                                             | RF-12, RF-13                        |
| `src/styles/tokens.ts`                                                                                                                                                                                                                                                      | **Único archivo con hex.** `colors` (nombre, valor y papel; tabla de la sección 5), `fonts` (heading/body: familia, `cssVariable`, pesos, estilos, archivos y fallbacks) y `tokensToCss(colors)` → `:root{--color-…}`                                                                                                                                                                                                     | RF-16, RF-18                        |
| `src/lib/hex-colors.ts`                                                                                                                                                                                                                                                     | `findHexColors(source)` devuelve los hex que encuentra (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), ignorando las entidades HTML `&#…;`                                                                                                                                                                                                                                                                                     | RF-17                               |
| `src/lib/favicon.ts`                                                                                                                                                                                                                                                        | `buildFaviconSvg(color)` devuelve un SVG mínimo (forma simple, provisional) con ese color                                                                                                                                                                                                                                                                                                                                 | RF-22                               |
| `src/pages/favicon.svg.ts`                                                                                                                                                                                                                                                  | Endpoint estático: `GET` → `buildFaviconSvg(colors.<token>.value)` con `Content-Type: image/svg+xml`. Genera `dist/favicon.svg` sin escribir ningún hex fuera de los tokens                                                                                                                                                                                                                                               | RF-17, RF-22                        |
| `src/layouts/BaseLayout.astro`                                                                                                                                                                                                                                              | Props: `locale`, `title`, `description` y `seo` (`{ path }` o `null` en la 404). Pinta `<html lang>`, charset, viewport, título, descripción, canonical y hreflang (solo si `seo`), favicon, `<Font … preload>` y `<style is:inline set:html={tokensToCss(colors)}>`. Estilos globales: tipografías por variable, foco visible y `prefers-reduced-motion`. Estructura `SiteHeader` + `<main id="content">` + `SiteFooter` | RF-4, RF-11-15, RF-19, RF-21, RF-22 |
| `src/components/SiteHeader.astro`                                                                                                                                                                                                                                           | Enlace "saltar al contenido", marca (enlace al inicio de su idioma) y `<nav aria-label>`. El enlace al otro idioma (`hreflang` + `lang`, con `href` = `localizePath(otherLocale)`) se pinta solo si `showLanguageSwitch`                                                                                                                                                                                                  | RF-5, RF-9, RF-14                   |
| `src/components/SiteFooter.astro`                                                                                                                                                                                                                                           | `<footer>` con un texto traducido                                                                                                                                                                                                                                                                                                                                                                                         | RF-14                               |
| `src/components/HomeContent.astro`                                                                                                                                                                                                                                          | `h1` + párrafo + `h2` + párrafo de texto provisional desde las traducciones                                                                                                                                                                                                                                                                                                                                               | RF-6, RF-14                         |
| `src/components/NotFoundContent.astro`                                                                                                                                                                                                                                      | `h1`, mensaje y enlace al inicio de su idioma                                                                                                                                                                                                                                                                                                                                                                             | RF-9                                |
| `src/pages/index.astro`, `src/pages/en/index.astro`                                                                                                                                                                                                                         | Sustituyen a la página mínima de 001: `BaseLayout` + `HomeContent` con `locale` `es` / `en`                                                                                                                                                                                                                                                                                                                               | RF-1, RF-4                          |
| `src/pages/404.astro`, `src/pages/en/404.astro`                                                                                                                                                                                                                             | `BaseLayout` con `seo = null` y `showLanguageSwitch = false`, más `NotFoundContent`                                                                                                                                                                                                                                                                                                                                       | RF-8, RF-9                          |
| `src/assets/fonts/`                                                                                                                                                                                                                                                         | `lilita-one-latin-400-normal.woff2`, `lato-latin-400-normal.woff2`, `lato-latin-700-normal.woff2`, `OFL-LilitaOne.txt`, `OFL-Lato.txt` y `NOTICE.md` (origen, versión de Fontsource, copyright de cada familia, licencia OFL-1.1 y aclaración de que la MIT del repo no cubre estas fuentes). Fuera de `public/` para no duplicarlas, como recomienda Astro                                                               | RF-18, E-1                          |
| Tests Vitest: `src/lib/i18n.test.ts`, `translation-check.test.ts`, `translations.test.ts`, `seo.test.ts`, `hex-colors.test.ts`, `favicon.test.ts`, `src/styles/tokens.test.ts`, `src/styles/no-loose-colors.test.ts`                                                        | Sección 7                                                                                                                                                                                                                                                                                                                                                                                                                 | RF-6, 7, 12, 13, 16, 17, 18, 22     |
| e2e Playwright: `e2e/pages.ts` (lista de las 4 páginas: ruta, idioma, tipo), `e2e/routing.spec.ts`, `e2e/seo.spec.ts`, `e2e/not-found.spec.ts`, `e2e/brand.spec.ts`, `e2e/a11y.spec.ts`. Se elimina `e2e/home.spec.ts` (su contenido pasa a `seo.spec.ts` y `a11y.spec.ts`) | Sección 7                                                                                                                                                                                                                                                                                                                                                                                                                 | RF-1-5, 8-15, 18, 20, 22, 23, 25    |
| `lighthouserc.cjs`                                                                                                                                                                                                                                                          | `url`: `http://localhost:4322/` y `http://localhost:4322/en/`. Aserciones nuevas con `median-run`: `largest-contentful-paint` ≤ 2500 ms, `cumulative-layout-shift` ≤ 0.1 y la auditoría de `font-display` de la versión instalada (Lighthouse 12.6.1; el id exacto, `font-display` o `font-display-insight`, se comprueba en el JSON del informe)                                                                         | RF-19, RF-24, RNF-1, RNF-2          |
| `AGENTS.md` (web)                                                                                                                                                                                                                                                           | E-2: esquema de URLs, regla de traducciones por clave (`t()`, nunca texto a mano), tokens como única fuente de colores (el test falla si hay un hex fuera de ellos), el cian provisional y la regla de sustituirlo cuando exista el archivo del logo, las fuentes en `src/assets/fonts` con OFL, el servidor de la preview, y la corrección de "GSAP… llegan en la spec 002" (quedan fuera de alcance)                    | E-2                                 |

## 3. Decisiones técnicas

- **D1. i18n propio (funciones puras + diccionario TS)** en lugar del i18n routing de Astro o de una librería (p. ej. i18next). Así se puede probar en Vitest, no añade dependencias y basta para dos idiomas y rutas estáticas.
- **D2. Tokens en TypeScript, que se convierten a variables CSS** (`tokensToCss`) y se inyectan en el layout.
  - Un solo origen sirve para el CSS, el favicon, la configuración de fuentes y los tests (RF-16 se prueba sin parsear CSS).
  - Descartado: un `tokens.css` como fuente. Habría que parsear CSS en los tests, y el favicon tendría que repetir el hex.
- **D3. Favicon generado por un endpoint estático**, para que su color salga del token y RF-17 se cumpla sin excepciones.
  - Descartado: un `public/favicon.svg` escrito a mano. Habría que añadir una excepción al test de hex sueltos y duplicar el color.
- **D4. 404 por idioma compatible con Cloudflare Pages.** Con `build.format: "directory"`, Astro solo trata como página de error la ruta raíz `/404`. Hemos comprobado en el código que `src/pages/en/404.astro` se genera como `dist/en/404/index.html`.
  - La integración inline `relocateNotFound` la mueve a `dist/en/404.html`, que es lo que Cloudflare Pages busca al recorrer la carpeta hacia arriba (hay que confirmarlo en la spec de despliegue).
  - La lista de traslados sale de una función pura `notFoundRelocations(locales)` en `src/lib/i18n.ts`, con su test.
  - Descartado: `build.format: "preserve"`. Generaría `about.html` para las páginas futuras y rompería la regla de barra final.
  - Descartado también: que el servidor acepte `404/index.html`. Divergiría del hosting real y dejaría `/en/404/` respondiendo 200.
- **D5. Sin `trailingSlash` en la config de Astro** (valor por defecto). La barra final la garantizan `withTrailingSlash` y el servidor (`/en` → 308 `/en/`). Con `"always"`, `astro dev` daría 404 en `/en`.
- **D6. P3: el servidor estático propio** (sección 0, aprobado). Resuelve también la trampa de Windows: con el sistema de archivos insensible a mayúsculas, `/EN/` encontraría `dist/en/index.html`. El servidor compara contra la lista real de archivos (RF-10).
- **D7. Contraste** (a confirmar con axe en T8):
  - Texto `text` (#FFFFFF) sobre `bg` #34006F y sobre `bgDark` #1D003F.
  - Enlaces en `accentGreen` #DAF7A6, subrayados.
  - Foco: `outline` de 3 px en `buttonHover` #FFE000 con `outline-offset` de 2 px sobre los fondos morados (contraste > 3:1, WCAG 2.4.7/1.4.11).
  - Los colores de botón y degradado no se usan como texto en esta spec.
- **D8. Preload** solo de Lilita One 400 (h1, probable LCP) y Lato 400. Lato 700 se carga cuando se necesita. Así no se añaden peticiones críticas innecesarias (RNF-3).

## 4. Lógica (pseudocódigo)

```
resolveRequest({ pathname, search, files }):        // files: Set of exact-case POSIX paths relative to dist
  path = safeDecode(pathname); if invalid or contains ".." segment → return notFound("/")
  rel = path.slice(1)
  if path ends with "/":
    if files.has(rel + "index.html") → { status: 200, file: rel + "index.html" }
  else:
    if files.has(rel) → { status: 200, file: rel }
    if files.has(rel + "/index.html") → { status: 308, location: path + "/" + (search ?? "") }
  return notFound(path)

notFound(path):                                       // nearest 404.html walking up, exact case
  dirs = segments of path without the last one if path doesn't end with "/", else all segments
  for i = dirs.length down to 0:
    candidate = join(dirs[0..i], "404.html")
    if files.has(candidate) → { status: 404, file: candidate }
  return { status: 404, file: null }                  // plain-text 404

findMissingTranslations(dicts, locales):
  keys = union of keys across locales
  for key in keys, locale in locales:
    if key not in dicts[locale] → push { key, locale, problem: "missing" }
    else if dicts[locale][key].trim() === "" → push { key, locale, problem: "empty" }

localizePath(locale, path):  p = withTrailingSlash(path); locale === "es" ? p : "/en" + p
canonicalUrl(site, path):    new URL(withTrailingSlash(path), site).href
alternateLinks(site, path):  basePath = path without "/en" prefix
  [{es, canonicalUrl(site, localizePath("es", basePath))},
   {en, canonicalUrl(site, localizePath("en", basePath))},
   {x-default, same as es}]

findHexColors(source): matches of /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi
```

Casos clave del servidor:

| Petición           | Resultado                   |
| ------------------ | --------------------------- |
| `/`                | 200 `index.html`            |
| `/en/`             | 200 `en/index.html`         |
| `/en` y `/en?x=1`  | 308 a `/en/` (con la query) |
| `/EN/` y `/En/`    | 404 `404.html` (ES)         |
| `/no-existe/`      | 404 `404.html`              |
| `/en/no-existe/`   | 404 `en/404.html`           |
| `/en/a/b`          | 404 `en/404.html`           |
| `/%E0%A4%A`        | 404 sin excepción           |
| `/../package.json` | 404                         |
| `/favicon.svg`     | 200, `image/svg+xml`        |

## 5. Tokens de marca (RF-16)

| Token (código)      | Valor                              | Papel                                                   | Variable CSS                  |
| ------------------- | ---------------------------------- | ------------------------------------------------------- | ----------------------------- |
| `bgDark`            | #1D003F                            | Fondo oscuro (cabecera, pie)                            | `--color-bg-dark`             |
| `bg`                | #34006F                            | Fondo                                                   | `--color-bg`                  |
| `button`            | #FFC300                            | Botón                                                   | `--color-button`              |
| `buttonHover`       | #FFE000                            | Botón en hover/foco (también anillo de foco)            | `--color-button-hover`        |
| `logoGradient1`…`4` | #FF9D00, #FF6700, #FF5733, #C70039 | Degradado del logo, en ese orden                        | `--color-logo-gradient-1`…`4` |
| `accentGreen`       | #DAF7A6                            | Acento verde claro (enlaces)                            | `--color-accent-green`        |
| `logoCyan`          | #00E5FF                            | Cian del logo (**provisional**, comentado en el código) | `--color-logo-cyan`           |
| `text`              | #FFFFFF                            | Neutro: texto sobre fondos oscuros (RF-16, P1)          | `--color-text`                |

Tipografías: `heading` = "Lilita One" 400 normal (`--font-heading`, fallbacks `["sans-serif"]`); `body` = "Lato" 400 y 700 normal (`--font-body`, fallbacks `["sans-serif"]`). No hay cursiva. El favicon usa `logoGradient2` sobre `bgDark`.

## 6. Interfaz y textos

- Estructura de cada página:
  - `header`: saltar al contenido, marca y `nav` (con el idioma salvo en la 404).
  - `main#content`.
  - `footer`.
- Fondo `bg`; cabecera y pie en `bgDark`; títulos en `--font-heading` y cuerpo en `--font-body`.
- Diseño fluido con `max-width` y `padding` laterales, `clamp()` en los tamaños del `h1` y `overflow-wrap: anywhere` en los títulos, para que no haya desbordamiento a 320 px (RF-23).
- Sin transiciones. Si se añade alguna (p. ej. el hover del enlace), va dentro de `@media (prefers-reduced-motion: no-preference)` (RNF-4).
- Claves de traducción (los textos son provisionales y se escriben en ES y EN; el contenido real llega en la fase 1):

| Clave                                                                   | Uso                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `home.title`, `home.description`                                        | `<title>` (con `buildPageTitle`) y meta description de inicio (50-60 / 150-160 caracteres orientativos) |
| `home.heading`, `home.intro`, `home.sectionHeading`, `home.sectionBody` | Contenido provisional de inicio                                                                         |
| `notFound.title`, `notFound.description`                                | `<title>` y meta description de la 404                                                                  |
| `notFound.heading`, `notFound.message`, `notFound.backHome`             | Contenido de la 404                                                                                     |
| `nav.label`                                                             | `aria-label` de la navegación                                                                           |
| `nav.home`                                                              | Texto accesible del enlace de la marca al inicio                                                        |
| `nav.switchLanguage`                                                    | Texto visible del enlace al otro idioma ("English" en ES, "Español" en EN)                              |
| `a11y.skipToContent`                                                    | Enlace de saltar al contenido                                                                           |
| `footer.text`                                                           | Texto del pie                                                                                           |

## 7. Datos

No hay datos persistentes, D1, variables de entorno ni `.env.example`. Los diccionarios y los tokens son módulos TS versionados. No hay ningún dato sensible.

## 8. Estrategia de tests

Comando: `pnpm test` (Vitest + check-browser + Playwright contra la build servida en 4322). Auditoría: `pnpm quality`. Cada tarea cierra con `pnpm test`, `pnpm lint` y `pnpm format:check` en verde. Los tests se escriben primero y se ven en rojo.

**Vitest**

| Archivo                     | Comprueba                                                                                                                                                                            | RF          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `serve-static.test.mjs`     | Tabla de la sección 4 y `contentTypeFor`                                                                                                                                             | RF-2, 8, 10 |
| `i18n.test.ts`              | `localizePath`, `otherLocale`, `t` (lanza con una clave inexistente) y `notFoundRelocations`                                                                                         | RF-1, 5, 6  |
| `translation-check.test.ts` | Con diccionarios de ejemplo: clave solo en ES, solo en EN y valor vacío o con espacios. Comprueba que el mensaje del test incluye la clave y el idioma                               | RF-7        |
| `translations.test.ts`      | `findMissingTranslations(realDicts)` devuelve `[]`. El `expect` usa la lista como mensaje, así que el fallo muestra la clave y el idioma                                             | RF-6, RF-7  |
| `seo.test.ts`               | Canonical absoluta con barra final y siempre `https://agencymac.com`; hreflang es/en/x-default con x-default = ES                                                                    | RF-12, 13   |
| `tokens.test.ts`            | Cada valor y papel de la tabla de la sección 5, `tokensToCss`, y que las fuentes sean solo 400 (Lilita) y 400/700 (Lato), solo `normal` y solo woff2                                 | RF-16, 18   |
| `hex-colors.test.ts`        | Detecta las 4 longitudes; ignora `&#8217;` y anclas como `#content`                                                                                                                  | RF-17       |
| `no-loose-colors.test.ts`   | Lee `apps/web/src/**/*.{astro,css,ts,js,mjs,svg}`, `apps/web/public/**` y `apps/web/astro.config.mjs` (excluye `src/styles/tokens.ts` y `*.test.ts`) y falla listando `archivo: hex` | RF-17       |
| `favicon.test.ts`           | El SVG es válido, usa el color recibido y no contiene otros colores                                                                                                                  | RF-22       |

**Playwright** (proyecto `web`, `e2e/pages.ts` con las 4 páginas)

| Spec                | Comprueba                                                                                                                                                                                                                                                                                                                             | RF              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `routing.spec.ts`   | `/` en ES y `/en/` en EN (`lang` + `h1` = traducción). `/en` → URL final `/en/` y 200 (y 308 con `request` y `maxRedirects: 0`). Contexto con `locale: "en-US"` y `Accept-Language: en` abriendo `/`: sigue en `/`, `lang="es"` y h1 en ES. Con JS desactivado, abre `/`, pulsa el enlace de idioma, comprueba el h1 en EN y vuelve   | RF-1-5          |
| `seo.spec.ts`       | En `/` y `/en/`: título y descripción no vacíos y distintos entre las 4 páginas; canonical exacta; 3 hreflang exactos; un solo `h1`; niveles sin saltos; `header`, `nav`, `main` y `footer`; contenido presente con JS desactivado. En las 4 páginas: ningún `noindex` (meta `robots` ni cabecera `X-Robots-Tag`) y ningún `<script>` | RF-11-15, RNF-3 |
| `not-found.spec.ts` | `/no-existe/` → 404 y h1 ES; `/en/no-existe/` → 404 y h1 EN; `/EN/` y `/En/` → 404. En las 404: un `h1`, título en su idioma, enlace al inicio de su idioma, sin enlace de idioma, sin canonical y sin hreflang                                                                                                                       | RF-8-10         |
| `brand.spec.ts`     | Registra las peticiones: todas las de tipo `font` son del mismo origen y terminan en `.woff2`, ninguna va a otro dominio, y se cargan Lilita One y Lato (`document.fonts.check`). El favicon declarado responde 200 con `image/svg+xml`. A 320 y 375 px, en las 4 páginas, `scrollWidth ≤ innerWidth`                                 | RF-18, 22, 23   |
| `a11y.spec.ts`      | axe (incluida `color-contrast`) sin infracciones en las 4 páginas                                                                                                                                                                                                                                                                     | RF-20, 25       |

Los tests que usan `evaluate` o axe se ejecutan con JS activado. Las páginas no cargan scripts (lo comprueba `seo.spec.ts`), así que el DOM es el mismo que sin JS.

**Lighthouse CI** (`pnpm quality`): se auditan `/` y `/en/` en móvil, 3 ejecuciones y mediana, con ≥ 0.9 en las 4 categorías, LCP ≤ 2500 ms, CLS ≤ 0.1 y la auditoría de `font-display` en verde (RF-19, RF-24, RNF-1, RNF-2). Se comprueba que falla subiendo el umbral temporalmente a 1.01 y se revierte.

**Manual** (se anota en T10):

- RF-21: recorrer con Tab inicio y 404, en ES y EN.
- RF-23: revisión visual a 375 px y en escritorio.
- RF-6: revisar que no hay textos a mano en `.astro` (salvo `SITE_NAME`).
- RF-11: longitudes orientativas.

Checklist de seo-tecnico en la validación: title, description, canonical, un solo h1, HTML con contenido, 404 real, hreflang, sin `noindex` y rendimiento. Sitemap, robots, OG y JSON-LD están fuera de alcance según la spec.

## 9. Cobertura de RF

| RF / E              | Cubierto por                                                              | Tarea      |
| ------------------- | ------------------------------------------------------------------------- | ---------- |
| RF-1, RF-4          | `i18n.ts`, páginas `index` ES/EN, `routing.spec`                          | T2, T4     |
| RF-2                | `serve-static` (308), `withTrailingSlash`, `routing.spec`                 | T1, T4     |
| RF-3                | Sin lógica de redirección; `routing.spec` con navegador en inglés         | T4         |
| RF-5                | `SiteHeader`, `localizePath`, `routing.spec` sin JS                       | T5         |
| RF-6, RF-7          | `translations.ts`, `translation-check.ts`, `t()`, Vitest; revisión manual | T2, T10    |
| RF-8, RF-9, RF-10   | `serve-static`, `relocateNotFound`, páginas 404, `not-found.spec`         | T1, T6     |
| RF-11 a RF-15       | `BaseLayout`, `seo.ts`, `seo.spec`                                        | T2, T4, T5 |
| RF-16, RF-17        | `tokens.ts`, `hex-colors.ts`, `no-loose-colors.test`                      | T3         |
| RF-18, RF-19        | Fonts API + `src/assets/fonts`, `brand.spec`, Lighthouse `font-display`   | T7, T9     |
| RF-20, RF-25        | Estilos con tokens (D7), `a11y.spec`                                      | T8         |
| RF-21               | Estilo de foco global; verificación manual                                | T5, T10    |
| RF-22               | `favicon.ts`, endpoint, `brand.spec`                                      | T3, T4     |
| RF-23               | CSS fluido, `brand.spec` a 320/375 px; revisión visual                    | T8, T10    |
| RF-24, RNF-1, RNF-2 | `lighthouserc.cjs`                                                        | T9         |
| RNF-3, RNF-4        | `seo.spec` (sin scripts), CSS con `prefers-reduced-motion`                | T4, T8     |
| RNF-6               | Sección 0 (sin dependencias npm nuevas; decisiones aprobadas)             | —          |
| E-1                 | `src/assets/fonts/OFL-*.txt` + `NOTICE.md`                                | T7         |
| E-2, E-3            | `apps/web/AGENTS.md`, `MEMORY.md`                                         | T10        |

## 10. Riesgos

- **`localhost` en Windows** puede resolver a `::1`. El servidor escucha en `localhost` igual que lo hacía `astro preview`. Si Playwright o Lighthouse no conectan, se para y se propone escuchar en `127.0.0.1` y cambiar las URLs. No se cambia sin avisar.
- **Importar `tokens.ts` desde `astro.config.mjs`.** Astro carga la configuración con Vite, así que debería funcionar. Si no funciona, se propone renombrarlo a `astro.config.ts` (lo admite Astro) antes de aplicarlo.
- **El hook `astro:build:done`** recibe `dir` como URL. Si `en/404/index.html` no existe (por un cambio de Astro), la integración falla con un mensaje claro, en vez de seguir sin 404 EN.
- **Fonts API con el proveedor `local`.** Se confirma la forma exacta de `fonts` y de `<Font>` con el MCP de Astro Docs en T7. Si las fuentes de respaldo optimizadas no se generan con estos archivos, se comprueba que el CLS siga ≤ 0.1.
- **Id de la auditoría de `font-display`** en Lighthouse 12.6.1: se confirma en el JSON del informe antes de añadir la aserción.
- **El comportamiento de Cloudflare Pages** (404 más cercana, redirección a barra final y distinción de mayúsculas) se imita, pero no se ha verificado en producción. Queda para la spec de despliegue.
- **Los procesos node huérfanos** en 4322 (AGENTS.md) hacen que el nuevo servidor falle con `EADDRINUSE`. Es el comportamiento buscado: hay que matarlos y relanzar.
