# AGENTS.md — apps/web

Web pública de AgencyMac: la carta de presentación de la agencia ante clientes. Tiene que impresionar y posicionar en buscadores en ES y EN. Las reglas generales están en el `AGENTS.md` raíz; aquí solo van las de esta app.

## Stack

- Astro 7 con salida estática (`output: "static"`), sin JavaScript de cliente por ahora. GSAP/ScrollTrigger, Lenis y Rive llegarán en una spec posterior (quedaron fuera de la 002).
- Tests: Vitest para la lógica (`src/lib/*.test.ts`, `src/styles/*.test.ts`) y Playwright + axe-core para e2e (`e2e/`, lista de páginas en `e2e/pages.ts`).
- Auditoría: Lighthouse CI (`lighthouserc.cjs`) de `/` y `/en/` con el `chrome-headless-shell` de Playwright, perfil móvil, mediana de 3 ejecuciones; además de las 4 categorías ≥ 0.9 exige LCP ≤ 2500 ms, CLS ≤ 0.1 y `font-display`.

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
- El cian del logo (`logoCyan`, #00E5FF) es provisional: cuando exista el archivo del logo, se sustituye en `tokens.ts` por el valor real del archivo.
- El favicon se genera desde los tokens (`src/pages/favicon.svg.ts`); no se añade un favicon escrito a mano.
- Tipografías autoalojadas en `src/assets/fonts/` (woff2 `latin` de Fontsource, Lilita One 400 y Lato 400/700) con la Fonts API de Astro (`fontProviders.local()`, `display: swap`). Llevan su licencia OFL-1.1 (`OFL-*.txt`) y `NOTICE.md`, que no se borran ni se modifican: la MIT del repo no cubre las fuentes. Nunca se cargan fuentes de otros dominios.
- Foco visible con `outline` en `--color-button-hover`; enlaces en `--color-accent-green`, subrayados.

## Reglas

- Todo texto visible existe en ES y EN. Comprueba los dos idiomas en cada cambio.
- El contenido va en el HTML generado y se ve sin JavaScript. Las animaciones solo decoran: nunca ocultan texto a Google.
- Toda animación o transición respeta `prefers-reduced-motion`: con movimiento reducido, el contenido aparece directamente.
- SEO en cada página: `lang`, `<title>` y meta description propios, canonical y hreflang, un solo `h1`, `header`/`nav`/`main`/`footer`, y lo que pida la skill seo-tecnico.
- Nunca `noindex` en la web pública.
- Lighthouse (móvil) ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO. `pnpm quality` falla si alguna baja.
- Accesibilidad: contraste AA y sin infracciones de axe en las 4 páginas; sin desbordamiento horizontal a 320 y 375 px.
- La telemetría de Astro está desactivada en los scripts (`ASTRO_TELEMETRY_DISABLED=1`); mantenla así en los scripts nuevos.
