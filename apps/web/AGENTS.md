# AGENTS.md — apps/web

Web pública de AgencyMac: la carta de presentación de la agencia ante clientes. Tiene que impresionar y posicionar en buscadores en ES y EN. Las reglas generales están en el `AGENTS.md` raíz; aquí solo van las de esta app.

## Stack

- Astro 7 con salida estática (`output: "static"`), sin JavaScript de cliente por ahora. GSAP/ScrollTrigger, Lenis y Rive llegarán en una spec posterior (quedaron fuera de la 002).
- Tests: Vitest para la lógica (`src/lib/*.test.ts`, `src/styles/*.test.ts`) y Playwright + axe-core para e2e (`e2e/`, lista de páginas en `e2e/pages.ts`).
- Auditoría: Lighthouse CI (`lighthouserc.cjs`) de `/` y `/en/` con el `chrome-headless-shell` de Playwright, perfil móvil, mediana de 3 ejecuciones; además de las 4 categorías ≥ 0.9 exige LCP ≤ 2500 ms, CLS ≤ 0.1 y `font-display`.

## Comandos (desde la raíz)

- Arrancar: `pnpm dev:web` (`astro dev` en el 4321)
- Build: `pnpm --filter web build`
- Preview de la build: `pnpm --filter web preview` sirve `dist` en el 4322 con `scripts/serve-static.mjs` (sin dependencias). No se usa `astro preview`: siempre sirve la 404 ES. El servidor imita Cloudflare Pages: 404 más cercana por carpeta, distingue mayúsculas y minúsculas (también en Windows), `/en` → 308 `/en/`, y falla si el puerto está ocupado.
- Tests: `pnpm test` (incluye el proyecto `web` de Playwright)
- Auditoría: `pnpm quality`

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
