# AGENTS.md — apps/web

Web pública de AgencyMac: la carta de presentación de la agencia ante clientes. Tiene que impresionar y posicionar en buscadores en ES y EN. Las reglas generales están en el `AGENTS.md` raíz; aquí solo van las de esta app.

## Stack

- Astro 7 con salida estática (`output: "static"`). El único JavaScript de cliente es la capa de animación diferida de la portada (spec 004, fase B): `src/scripts/motion-entry.ts` (~1 KB; espera `load` + `LOAD_DELAY_MS`, no descarga nada con movimiento reducido) y `src/scripts/motion/home-motion.ts` (GSAP + ScrollTrigger; Lenis llegará en T21). Las constantes están en `src/lib/motion/motion-config.ts`. Presupuesto: ≤ 3 KB de JS antes de `load` y ≤ 60 KB en total. El bundle debe conservar la cabecera `@license` de GSAP (`astro.config.mjs`, `comments: { legal: true }`; lo vigila `e2e/motion.spec.ts`). Rive queda fuera.
- Tests: Vitest para la lógica (`src/lib/*.test.ts`, `src/styles/*.test.ts`) y Playwright + axe-core para e2e (`e2e/`, lista de páginas en `e2e/pages.ts`).
- Auditoría: Lighthouse CI (`lighthouserc.cjs`) de `/` y `/en/` con el `chrome-headless-shell` de Playwright, perfil móvil, mediana de 3 ejecuciones; además de las 4 categorías ≥ 0.9 exige LCP ≤ 2500 ms, CLS ≤ 0.1, TBT ≤ 200 ms y `font-display`.

## Comandos (desde la raíz)

- Arrancar: `pnpm dev:web` (`astro dev` en el 4321)
- Build: `pnpm --filter web build`
- Preview de la build: `pnpm --filter web preview` sirve `dist` en el 4322 con `scripts/serve-static.mjs` (sin dependencias). No se usa `astro preview`: siempre sirve la 404 ES. El servidor imita los static assets de Cloudflare Workers (`html_handling: "auto-trailing-slash"`, `not_found_handling: "404-page"`), con los códigos observados con `wrangler dev` (spec 003, D17), y falla si el puerto está ocupado:
  - `/dir/` sirve `dir/index.html`; `/dir` → 307 `/dir/` (`/en` → 307 `/en/`).
  - `/index.html`, `/en/index.html`, `/index` y `/en/index` → 307 `/` y `/en/`.
  - `/name` sirve `name.html` con 200: `/404` y `/en/404` dan 200 con la 404 de su idioma. `/name.html` → 307 `/name` (`/404.html` → `/404`) y `/name/` → 307 `/name` (`/en/404/` → `/en/404`).
  - Todas las redirecciones conservan la query (`/en?x=1` → `/en/?x=1`).
  - Lo demás: 404 con la `404.html` más cercana por carpeta (ES en la raíz, EN bajo `/en/`), distinguiendo mayúsculas y minúsculas también en Windows (`/EN/` → 404 ES). `_headers` y `_redirects` nunca se sirven.
- Tests: `pnpm test` (incluye el proyecto `web` de Playwright). Con `PREBUILT_DIST=1` (CI) Playwright sirve la `dist` existente sin compilar.
- Auditoría: `pnpm quality`. En el CI, Lighthouse añade `--no-sandbox` (solo si `CI` está definido).

## Staging (spec 003)

- Worker `agencymac-staging` con static assets, configurado en `wrangler.json` (JSON puro: sin comentarios; un test lo vigila): solo `workers_dev`, `preview_urls: false`, sin `main`, rutas, dominios, `account_id` ni `vars`.
- Sirve `apps/web/.staging/` (ignorada por git): copia de `dist` + `_headers` con `X-Robots-Tag: noindex` y `X-Staging-Version`, creada por `pnpm --filter web staging:copy` (`scripts/staging/staging-copy.mjs`). La `dist` nunca se modifica y la build de producción nunca lleva `_headers` ni `noindex` (`e2e/dist-clean.spec.ts`).
- `pnpm --filter web staging:local`: copia con versión `local` + `wrangler dev` en el 8787. `staging:deploy` solo lo ejecuta el CI.
- Alta, CI y comportamiento: `docs/staging.md`.

## URLs e idiomas

- ES (principal) sin prefijo: `/`. EN con prefijo: `/en/`. Siempre en minúsculas y con barra final. Una ruta EN es la ruta ES con `/en` delante.
- Sin redirección automática por idioma del navegador: `/` es siempre ES.
- i18n propio en `src/lib/i18n.ts` (`LOCALES`, `localizePath`, `otherLocale`, `t`); no se usa el i18n routing de Astro. Las páginas de `src/pages/` son envoltorios finos que pasan el `locale` a un componente de contenido común.
- Canonical y hreflang (`es`, `en`, `x-default` = ES) salen de `src/lib/seo.ts` con `site` de `astro.config.mjs` (`https://agencymac.com`).
- 404 por idioma: `src/pages/404.astro` y `src/pages/en/404.astro`. La integración `relocateNotFound` de `astro.config.mjs` mueve `dist/en/404/index.html` a `dist/en/404.html`. Las 404 no tienen canonical, hreflang ni navegación.

## Textos

- Todo texto visible sale de las traducciones por clave de `src/lib/translations.ts` mediante `t(locale, key)`. Nunca se escribe texto a mano en un `.astro` (única excepción: `SITE_NAME`, el nombre de la marca).
- Cada clave tiene valor ES y EN no vacío; el test de traducciones falla indicando la clave y el idioma. `t()` con una clave inexistente rompe la build.

## Marca

- Los tokens de `src/styles/tokens.ts` son la única fuente de colores y tipografías. Ningún hex fuera de ese archivo: `no-loose-colors.test.ts` falla listando archivo y color. En CSS se usan las variables `--color-*`, `--font-heading` y `--font-body`.
- La paleta sale del logo (naranjas y amarillos) más los colores de marca de `tokens.ts`; el contraste AA de cada pareja texto/fondo (incluidos los tres fondos de planeta) lo vigila `src/styles/contrast.test.ts`. Un fondo de color de la portada es siempre sólido: nada de texto sobre degradados o imágenes.
- El favicon vectorial es el isologo redibujado con tres formas (`src/lib/favicon-isologo.ts`) y se sirve desde `src/pages/favicon.svg.ts` con los colores de los tokens; además se declaran `favicon-48.png` y `apple-touch-icon.png` (`public/`).
- Imágenes: los originales viven en `Assets/` (raíz, ignorada por git: el repo es público) y nunca se versionan ni se nombran los que no se usan. Solo entran derivados, generados con `pnpm assets:build` (`scripts/assets/`; `pnpm assets:check` comprueba los SHA-256 de los originales). La procedencia está en `src/assets/brand/README.md` y en `scripts/assets/manifest.mjs`; `LICENSE-BRAND.md` los cubre.
- Toda imagen de la portada pasa por `src/components/BrandPicture.astro` (AVIF y WebP en varios anchos, `width`/`height`, lazy salvo `priority`; `highPriority` solo para el candidato a LCP). Alt real; vacío solo en lo decorativo.
- Tipografías autoalojadas en `src/assets/fonts/` (woff2 `latin` de Fontsource, Lilita One 400 y Lato 400/700) con la Fonts API de Astro (`fontProviders.local()`, `display: swap`). Llevan su licencia OFL-1.1 (`OFL-*.txt`) y `NOTICE.md`, que no se borran ni se modifican: la MIT del repo no cubre las fuentes. Nunca se cargan fuentes de otros dominios.
- Foco visible con `outline` en `--color-button-hover`; enlaces en `--color-accent-green`, subrayados.

## Portada (spec 004)

- Cinco secciones en este orden: hero, servicios, proyectos, equipo y contacto (`src/components/home/`), compuestas por `HomeContent.astro` sobre `BaseLayout` con `fullWidth` (la portada va a ancho completo y cada sección pone su banda; las 404 conservan su columna estrecha).
- Los nombres propios (servicios, proyectos, personas), los ids de sección y los destinos de los botones están en `src/lib/site-data.ts`. `CTA_TARGET` (`#contact`) es el único destino de "Quiero despegar" (`CtaButton.astro`): la spec 006 coloca el formulario dentro de `#contact` sin tocar el botón. "Descubre cómo" va a `#services` hasta que existan las páginas de servicio.
- Los textos son la tabla "Textos propuestos" de `specs/004-web-portada/spec.md`: `translations.test.ts` la compara con `translations.ts` clave por clave. Sin precios ni datos de contacto (`src/lib/copy-rules.ts` los vigila en todos los textos).
- Cada servicio es una banda de color sólido de su token (`planetHexawebBg`, `planetRankiaBg`, `planetAdaraBg`); no hay enlaces internos falsos y los dos externos (proyectos) llevan `target="_blank"` y `rel="noopener"`.
- Metadatos sociales (`buildSocialMeta`), JSON-LD `Organization` sin teléfono, correo ni dirección (`structured-data.ts`, ensamblados en `home-seo.ts`), `sitemap.xml` y `robots.txt` (endpoints en `src/pages/`, funciones puras en `sitemap.ts`). Las URL absolutas salen siempre de `site`; en los tests solo se comprueba la ruta en el servidor de pruebas, nunca se pide nada a `agencymac.com`.

## Animación (spec 004, fase B)

- La capa de animación es opcional y diferida: `motion-entry.ts` espera `load` + `LOAD_DELAY_MS` (1000 ms), no descarga nada con movimiento reducido y hace `import()` de `motion/home-motion.ts` (GSAP + ScrollTrigger). El HTML y el CSS dejan todo visible; solo los bloques `[data-reveal]` bajo el pliegue adoptan el estado inicial oculto, aplicado por JS, y terminan visibles. Ninguna regla CSS oculta contenido (`motion-css.test.ts`).
- La lógica pura (planeta activo, destino de Mac, plan de aparición, constantes) vive en `src/lib/motion/`; `motion-config.ts` es la única fuente de las constantes de tiempo y posición. No importa DOM, GSAP ni la fecha.
- Mac viajero (creado por JS, `alt=""`, `aria-hidden`), `data-active-planet` en `#services` y gesto de Mac (`data-mac-gesture`, 0,6 s) existen solo con la capa activa y sin movimiento reducido. Con movimiento reducido a mitad de la visita todo se revierte (`gsap.matchMedia`) sin mover el scroll. El breakpoint NO es condición de `matchMedia` (provocaba un salto al inicio).
- Lenis (`motion/smooth-scroll.ts`, fragmento aparte) solo con `(hover: hover) and (pointer: fine)` y sin movimiento reducido. Su CSS se inyecta desde ese módulo con `?inline`: nunca en la hoja base. Todo CSS con transiciones, animaciones o scroll suave va bajo `prefers-reduced-motion: no-preference`.
- Presupuestos (`e2e/budget.spec.ts`, plan sección 8): JS antes de `load` ≤ 3 KB gzip, JS total ≤ 60 KB gzip, CSS ≤ 20 KB, imágenes al cargar ≤ 90 KB y totales ≤ 400 KB en 375 px, y cada interacción ≤ 200 ms (proxy de INP). Si algo no se cumple, se para y se avisa antes de subir el límite.
- El bundle conserva la cabecera `@license` de GSAP (licencia en `LICENSE-BRAND.md`).

## Reglas

- Todo texto visible existe en ES y EN. Comprueba los dos idiomas en cada cambio.
- El contenido va en el HTML generado y se ve sin JavaScript. Las animaciones solo decoran: nunca ocultan texto a Google.
- Toda animación o transición respeta `prefers-reduced-motion`: con movimiento reducido, el contenido aparece directamente.
- SEO en cada página: `lang`, `<title>` y meta description propios, canonical y hreflang, un solo `h1`, `header`/`nav`/`main`/`footer`, y lo que pida la skill seo-tecnico.
- Nunca `noindex` en la web pública.
- Lighthouse (móvil) ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO. `pnpm quality` falla si alguna baja.
- Accesibilidad: contraste AA y sin infracciones de axe en las 4 páginas; sin desbordamiento horizontal a 320 y 375 px.
- La telemetría de Astro está desactivada en los scripts (`ASTRO_TELEMETRY_DISABLED=1`); mantenla así en los scripts nuevos.
