# Tareas — Spec 002: Esqueleto de la web pública

Van en orden de dependencia. En cada tarea, primero los tests (vistos en rojo) y después el código. Cada una cierra con `pnpm test`, `pnpm lint` y `pnpm format:check` en verde.

Entorno de agente: si `node -v` no devuelve 24, antepón al PATH la carpeta de instalación real de Node 24 antes de usar pnpm o Playwright (ver MEMORY.md y AGENTS.md). Antes de los tests, comprobar que no hay procesos node huérfanos en 4321/4322.

P1, P2 y P3 del plan (sección 0) ya están aprobadas por el usuario (2026-10-11). La descarga de las fuentes en T7 se hace con su aprobación en ese momento.

- [x] **T1. Servidor estático de la preview: `scripts/serve-static.test.mjs` primero (la tabla de la sección 4 del plan y `contentTypeFor`), después `scripts/serve-static.mjs` (`resolveRequest` puro + CLI con `node:http`, gzip, fallo con `EADDRINUSE`). El script `preview` de `apps/web` pasa a usar el nuevo servidor en 4322.** RF-2, RF-8, RF-10
  - Hecho cuando:
    - Los tests de `resolveRequest` pasaron de rojo a verde, incluidos `/EN/` → 404 ES, `/en` → 308 `/en/` y `/en/no-existe/` → `en/404.html`.
    - `pnpm test` (los e2e de 001 contra el nuevo servidor) y `pnpm quality` terminan con código 0.
    - Con el puerto 4322 ocupado, `pnpm --filter web preview` sale con código distinto de cero.

- [x] **T2. Lógica de idiomas, traducciones y SEO: primero `i18n.test.ts`, `translation-check.test.ts`, `translations.test.ts` y `seo.test.ts`; después `src/lib/i18n.ts` (incluida `notFoundRelocations`), `translations.ts` con las claves de la sección 6 del plan en ES y EN, `translation-check.ts` y `seo.ts`.** RF-6, RF-7, RF-12, RF-13
  - Hecho cuando:
    - Todos los tests pasaron de rojo a verde.
    - Al borrar temporalmente una clave EN o vaciar un valor, `pnpm test` falla mostrando la clave y el idioma (se revierte).
    - `t()` con una clave inexistente lanza un error.

- [x] **T3. Tokens de marca, detector de hex y favicon: primero `tokens.test.ts`, `hex-colors.test.ts`, `no-loose-colors.test.ts` y `favicon.test.ts`; después `src/styles/tokens.ts` (tabla de la sección 5, con el cian marcado como provisional y el neutro `text` #FFFFFF), `tokensToCss`, `hex-colors.ts` y `favicon.ts`. La página mínima de 001 deja sus hex temporales y usa las variables de los tokens.** RF-16, RF-17, RF-22
  - Hecho cuando:
    - Los tests pasaron de rojo a verde. `no-loose-colors` estuvo en rojo por los hex de `index.astro`.
    - Al añadir temporalmente un `#123456` a un `.astro`, `pnpm test` falla indicando el archivo (se revierte).
    - Los e2e y axe de 001 siguen en verde.

- [x] **T4. Layout y páginas de inicio ES/EN: primero `e2e/pages.ts`, `routing.spec.ts` (RF-1 a RF-4) y `seo.spec.ts`; después `BaseLayout.astro` (lang, title, description, canonical, hreflang, favicon, CSS de tokens), `HomeContent.astro`, `src/pages/index.astro`, `src/pages/en/index.astro` y el endpoint `src/pages/favicon.svg.ts`. Se elimina `e2e/home.spec.ts`.** RF-1, RF-2, RF-3, RF-4, RF-11, RF-12, RF-13, RF-14, RF-15, RF-22
  - Hecho cuando:
    - Los specs pasaron de rojo a verde con JS desactivado donde corresponde: canonical y hreflang exactos con `https://agencymac.com`, títulos y descripciones distintos, sin `noindex` ni `<script>`, y `/en` llega a `/en/`.
    - Con el navegador en inglés, `/` sigue en español.
    - `dist/favicon.svg` existe y responde 200 con `image/svg+xml`.
    - Ningún texto escrito a mano en los `.astro` salvo `SITE_NAME`.

- [x] **T5. Cabecera, navegación y pie: primero el caso de RF-5 en `routing.spec.ts` (sin JS: `/` → enlace de idioma → h1 EN → vuelta a ES) y la estructura `header`/`nav`/`main`/`footer` en `seo.spec.ts`; después `SiteHeader.astro` (saltar al contenido, marca, `nav` con `aria-label`, enlace de idioma con `hreflang` y `lang`), `SiteFooter.astro` y el estilo global de foco visible.** RF-5, RF-14, RF-21
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en `/` y `/en/`.
    - El enlace de idioma funciona sin JS en los dos sentidos.
    - axe sigue sin infracciones.

- [x] **T6. Páginas 404 por idioma: primero `not-found.spec.ts`; después `NotFoundContent.astro`, `src/pages/404.astro`, `src/pages/en/404.astro` (sin canonical, hreflang ni enlace de idioma) y la integración `relocateNotFound` en `astro.config.mjs`, que deja `dist/en/404.html`.** RF-8, RF-9, RF-10
  - Hecho cuando:
    - `/no-existe/` y `/EN/` (y `/En/`) responden 404 con h1 ES, y `/en/no-existe/` 404 con h1 EN, con todo lo de RF-9 comprobado.
    - Tras `pnpm --filter web build` existe `dist/en/404.html` y no existe `dist/en/404/`.
    - Los tests pasaron de rojo a verde.

- [x] **T7. Tipografías autoalojadas (P2 aprobada; la descarga se hace con la aprobación del usuario en ese momento): primero los tests de tipografías en `tokens.test.ts` y la parte de fuentes de `brand.spec.ts`; después se descargan los 3 woff2 `latin` y los textos OFL de Fontsource (versión exacta no publicada el mismo día, anotada en `NOTICE.md`), se guardan en `apps/web/src/assets/fonts/` con `OFL-*.txt` y `NOTICE.md`, se configura `fonts` (`fontProviders.local()`, `display: swap`) en `astro.config.mjs` desde los tokens y se añade `<Font … preload>` en el layout (preload de Lilita 400 y Lato 400).** RF-18, RF-19, E-1
  - Hecho cuando:
    - Los tests pasaron de rojo a verde: solo peticiones `font` del mismo origen en `.woff2`, ninguna a otros dominios, y Lilita One y Lato cargadas.
    - El CSS generado tiene `font-display: swap`.
    - `NOTICE.md` indica el origen, la versión, el copyright y la licencia OFL-1.1 de cada familia.
    - `git check-attr binary` marca los `.woff2`.
    - Si el usuario no aprueba la descarga cuando se le pide, se para aquí.

- [x] **T8. Accesibilidad, contraste y responsive: primero `a11y.spec.ts` (axe en las 4 páginas) y la parte de 320/375 px de `brand.spec.ts`; después se ajustan los estilos (colores de D7, `clamp()`, `overflow-wrap`, `max-width`, cualquier transición dentro de `prefers-reduced-motion`).** RF-20, RF-23, RF-25, RNF-4
  - Hecho cuando:
    - axe no da infracciones (incluida `color-contrast`) en inicio y 404, en ES y EN.
    - `scrollWidth ≤ innerWidth` a 320 y 375 px en las 4 páginas.
    - Los tests están en verde.

- [x] **T9. Auditoría de calidad: `lighthouserc.cjs` audita `/` y `/en/` con 3 ejecuciones y mediana; ≥ 0.9 en las 4 categorías; LCP ≤ 2500 ms, CLS ≤ 0.1 y la aserción de `font-display` (id confirmado en el JSON de Lighthouse 12.6.1).** RF-19, RF-24, RNF-1, RNF-2
  - Hecho cuando:
    - `pnpm quality` termina con código 0 y el informe muestra las dos URLs.
    - Al subir temporalmente el umbral a 1.01, falla con código distinto de cero (se revierte).
    - Se anotan las puntuaciones, el LCP y el CLS de la mediana de cada URL.

- [x] **T10. Documentación y verificación final: `apps/web/AGENTS.md` (E-2), línea de puertos de `AGENTS.md` raíz y del README (servidor de la preview) y `MEMORY.md` (E-3).** RF-6, RF-11, RF-21, RF-23, E-2, E-3
  - `MEMORY.md`:
    - La 001 ya está commiteada y subida: quitar "Aún sin commit" y el primer próximo paso.
    - 002 cerrada, con el cian #00E5FF provisional.
    - Decisiones P1-P3 y D4 con su porqué.
    - En "Pendientes del usuario", quitar "Revisar las descripciones breves de Hexaweb, Rankia y Adara en el README" (ya validadas) y "Definir la variable `CHROME_DEVTOOLS_EXECUTABLE`" (ya definida en su usuario de Windows, apunta a Edge).
    - Máximo ~50 líneas.
  - Hecho cuando:
    - E-2 cubre el esquema de URLs, las traducciones por clave, los tokens como única fuente de colores, la regla de sustituir el cian cuando exista el archivo del logo, las fuentes con OFL y el servidor de la preview. Ya no dice que GSAP/Lenis/Rive llegan en la 002.
    - Queda anotado:
      - Foco visible con Tab en inicio y 404, ES y EN (RF-21).
      - Revisión visual en escritorio y a 375 px (RF-23).
      - Revisión de que no hay textos a mano (RF-6).
      - Longitudes de títulos y descripciones (RF-11, orientativo).
    - `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format:check` y `pnpm quality` terminan con código 0.
    - `git grep` no encuentra rutas locales, correos ni URLs privadas fuera de `specs/`.
    - El `git grep` de rutas locales y nombres de usuario (`/c/Users/`, `C:\Users`, `AppData\Roaming`, el nombre de usuario de Windows) **incluye también `specs/`**, sin resultados. Las menciones genéricas a `%LOCALAPPDATA%` o `ms-playwright` están permitidas.
  - Resultado (2026-10-11):
    - `pnpm build`, `pnpm lint`, `pnpm format:check` y `pnpm quality` con código 0; `pnpm test`: Vitest 167/167 y Playwright 64/64.
    - `git grep` (incluidos los archivos sin seguimiento): sin correos, rutas locales, URLs privadas ni secretos fuera de `specs/`. Solo coincidencias genéricas (`AppData` en el código que localiza la caché de Playwright, `/home/dev/...` de ejemplo en tests y la palabra `token` en tipos de `tokens.ts`). `MEMORY.local.md` está ignorado.
    - **Excepción aprobada por el usuario:** los correos públicos de los autores en la primera línea de `apps/web/src/assets/fonts/OFL-*.txt` se mantienen, porque la OFL obliga a conservar el aviso de copyright. Se excluyen explícitamente del `git grep`.
    - RF-6 (revisión): los `.astro` solo pintan `t(locale, …)`; el único texto fijo es `SITE_NAME`.
    - RF-11 (orientativo, no bloquea): títulos ES 51 / EN 59 caracteres en inicio y 32 / 26 en las 404; descripciones ES 158 / EN 157 en inicio y 155 / 149 en las 404. Los títulos de las 404 quedan cortos, lo normal en una página de error no indexable.
    - RF-21: el foco visible de los enlaces de la cabecera en `/` y `/en/` lo comprueba `a11y.spec.ts`. Queda para el usuario el recorrido con teclado real (Tab) en inicio y 404, ES y EN.
    - RF-23: `brand.spec.ts` comprueba 320 y 375 px sin desbordamiento. Queda para el usuario la revisión visual en escritorio y a 375 px.
