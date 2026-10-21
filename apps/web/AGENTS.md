# AGENTS.md — apps/web

Web pública de AgencyMac: la carta de presentación de la agencia ante clientes. Tiene que impresionar y posicionar en buscadores en ES y EN. Las reglas generales están en el `AGENTS.md` raíz; aquí solo van las de esta app.

## Stack

- Astro 7 con salida estática (`output: "static"`). El único JavaScript de cliente es la capa de animación diferida de la portada (specs 004 y 005): `src/scripts/motion-entry.ts` (~1 KB; espera `load` + `LOAD_DELAY_MS`, no descarga nada con movimiento reducido), el núcleo `src/scripts/motion/home-motion.ts` (GSAP, sin ScrollTrigger desde la 005, D19), el fragmento de Lenis `motion/smooth-scroll.ts` y la capa de efectos `src/scripts/fx/fx-layer.ts`. Las constantes están en `src/lib/motion/motion-config.ts` y `src/lib/fx/fx-config.ts`. Presupuesto: ≤ 3 KB de JS antes de `load` y ≤ 100 KB en total (detalle en "Presupuestos"). El bundle debe conservar la cabecera `@license` de GSAP (`astro.config.mjs`, `comments: { legal: true }`; lo vigila `e2e/motion.spec.ts`). Rive queda fuera.
- Tests: Vitest para la lógica (`src/lib/*.test.ts`, `src/styles/*.test.ts`) y Playwright + axe-core para e2e (`e2e/`, lista de páginas en `e2e/pages.ts`).
- Tests que miden tiempo (latencia de interacción, coste por fotograma, tareas largas con CPU ×4) van en el proyecto aislado `web-latency` de `playwright.config.ts`, que corre solo y después del resto: otros workers falsean la medida. Un test nuevo de ese tipo debe encajar en su `grep`.
- Auditoría: Lighthouse CI (`lighthouserc.cjs`) de `/` y `/en/` con el `chrome-headless-shell` de Playwright, perfil móvil, mediana de 3 ejecuciones; exige Rendimiento ≥ 0.92, las otras 3 categorías ≥ 0.9, LCP ≤ 2500 ms, CLS ≤ 0.1, TBT ≤ 300 ms (spec 005; antes 200) y `font-display`. El TBT de Lighthouse no ve la capa diferida (llega tras `load` + 1 s, después del TTI): su coste lo vigila la prueba de tareas largas con CPU ×4 de `budget.spec.ts`.

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
- La paleta sale del logo (naranjas y amarillos) más los colores de marca de `tokens.ts`; el contraste AA de cada pareja texto/fondo (incluidos los tres fondos de planeta) lo vigila `src/styles/contrast.test.ts`.
- Contraste por píxeles (spec 005, RF-8; sustituye a "un fondo de color de la portada es siempre sólido"): el texto puede ir sobre el cielo (degradados, resplandores, estrellas), pero su contraste se mide sobre los píxeles realmente pintados detrás: `e2e/pixel-contrast.ts` oculta el texto, captura su área y exige AA (4,5:1, o 3:1 en texto grande) en el 98 % de los píxeles (percentil 2; matemática pura en `src/lib/pixel-contrast.ts`). Lo aplican `sky-ambients.spec.ts` (cada texto marcado con `data-sky-text`) y `hero-decor.spec.ts`. Además, ningún punto del cielo pasa de `SKY_MAX_LUMINANCE` (0,12; `sky-luminance.test.ts`). Si un resplandor no cabe, se baja su intensidad, nunca el contraste del texto. El texto con fondo o borde propio (botón, etiqueta, tarjeta) lo sigue comprobando axe; un contraste "incompleto" de axe solo se admite en `data-sky-text` y en la burbuja de Mac (`e2e/axe-incomplete.ts`).
- El favicon vectorial es el isologo redibujado con tres formas (`src/lib/favicon-isologo.ts`) y se sirve desde `src/pages/favicon.svg.ts` con los colores de los tokens; además se declaran `favicon-48.png` y `apple-touch-icon.png` (`public/`).
- Imágenes: los originales viven en `Assets/` (raíz, ignorada por git: el repo es público) y nunca se versionan ni se nombran los que no se usan. Solo entran derivados, generados con `pnpm assets:build` (`scripts/assets/`; `pnpm assets:check` comprueba los SHA-256 de los originales). La procedencia está en `src/assets/brand/README.md` y en `scripts/assets/manifest.mjs`; `LICENSE-BRAND.md` los cubre.
- Toda imagen de la portada pasa por `src/components/BrandPicture.astro` (AVIF y WebP en varios anchos, `width`/`height`, lazy salvo `priority`; `highPriority` solo para el candidato a LCP). Alt real; vacío solo en lo decorativo.
- Tipografías autoalojadas en `src/assets/fonts/` (woff2 `latin` de Fontsource, Lilita One 400 y Lato 400/700) con la Fonts API de Astro (`fontProviders.local()`, `display: swap`). Llevan su licencia OFL-1.1 (`OFL-*.txt`) y `NOTICE.md`, que no se borran ni se modifican: la MIT del repo no cubre las fuentes. Nunca se cargan fuentes de otros dominios.
- Foco visible con `outline` en `--color-button-hover`; enlaces en `--color-accent-green`, subrayados.

## Portada (spec 004)

- Cinco secciones en este orden: hero, servicios, proyectos, equipo y contacto (`src/components/home/`), compuestas por `HomeContent.astro` sobre `BaseLayout` con `fullWidth` (la portada va a ancho completo y cada sección pone su banda; las 404 conservan su columna estrecha).
- Los nombres propios (servicios, proyectos, personas), los ids de sección y los destinos de los botones están en `src/lib/site-data.ts`. `CTA_TARGET` (`#contact`) es el único destino de "Quiero despegar" (`CtaButton.astro`): la spec 006 coloca el formulario dentro de `#contact` sin tocar el botón. "Descubre cómo" va a `#services` hasta que existan las páginas de servicio.
- Los textos son la tabla "Textos propuestos" de `specs/004-web-portada/spec.md`: `translations.test.ts` la compara con `translations.ts` clave por clave. Sin precios ni datos de contacto (`src/lib/copy-rules.ts` los vigila en todos los textos).
- Cada servicio conserva como color base sólido su token (`planetHexawebBg`, `planetRankiaBg`, `planetAdaraBg`; mismo test de color calculado) y, desde la 005, lleva encima el resplandor, el polvo y los fundidos de su ambiente; no hay enlaces internos falsos y los dos externos (proyectos) llevan `target="_blank"` y `rel="noopener"`.
- Metadatos sociales (`buildSocialMeta`), JSON-LD `Organization` sin teléfono, correo ni dirección (`structured-data.ts`, ensamblados en `home-seo.ts`), `sitemap.xml` y `robots.txt` (endpoints en `src/pages/`, funciones puras en `sitemap.ts`). Las URL absolutas salen siempre de `site`; en los tests solo se comprueba la ruta en el servidor de pruebas, nunca se pide nada a `agencymac.com`.

## Animación (specs 004 y 005)

- La capa de animación es opcional y diferida: `motion-entry.ts` espera `load` + `LOAD_DELAY_MS` (1000 ms), no descarga nada con movimiento reducido y hace `import()` del núcleo `motion/home-motion.ts` (GSAP). El HTML y el CSS dejan todo visible; solo los bloques `[data-reveal]` bajo el pliegue adoptan el estado inicial oculto, aplicado por JS, y terminan visibles. Ninguna regla CSS oculta contenido (`motion-css.test.ts`).
- Sin ScrollTrigger (spec 005, D19): su bucle interno de fotogramas no se puede apagar e impedía el reposo. La aparición usa un `IntersectionObserver` (`revealRootMargin`) con red de seguridad en cada scroll (`revealDue`, para los saltos por ancla que pasan un bloque de largo); el viajero y `data-active-planet` salen del manejador único de scroll `motion/scroll-hub.ts` (un oyente pasivo de `scroll` y un aviso de diseño tras `resize`, sin pedir fotogramas), que también reciben los efectos. El paquete `gsap` sigue siendo dependencia y GSAP sigue animando (tweens, gesto, turbo, `gsap.matchMedia`).
- Regla de reposo (RF-39 de la 005): en reposo la página no pide fotogramas (≤ 2 llamadas a `requestAnimationFrame` en 2 s, `fx.spec.ts`). Nada de bucles permanentes ni de `gsap.ticker.add`: `src/scripts/rest-rules.test.ts` falla si un script importa `gsap/ScrollTrigger` o usa `ScrollTrigger.` o `gsap.ticker.add`. El ticker de GSAP se duerme solo (`gsap.config({ autoSleep: GSAP_AUTO_SLEEP_FRAMES })`, 6 fotogramas: cuenta fotogramas, no tiempo); Lenis va en un bucle propio bajo demanda (`smooth-loop.ts`: se para tras `SMOOTH_IDLE_FRAMES` = 3 fotogramas quietos y se despierta con rueda, clic, tecla o scroll); el lienzo de efectos y los bucles de Mac y de los planetas se paran al llegar al reposo.
- La lógica pura (planeta activo, destino de Mac, plan de aparición, bucle de Lenis, constantes) vive en `src/lib/motion/`; `motion-config.ts` es la única fuente de las constantes de tiempo y posición. No importa DOM, GSAP ni la fecha.
- Mac viajero (creado por JS, `alt=""`, `aria-hidden`), `data-active-planet` en `#services` y gesto de Mac (`data-mac-gesture`, 0,6 s; también con Intro o Espacio: Mac pasa a `role="button"` con foco solo con la capa activa) existen solo con la capa activa y sin movimiento reducido. Sin módulo de efectos el viajero se mueve recto; con él, vuela en curva (`fx/mac-fx.ts`). Con movimiento reducido a mitad de la visita todo se revierte (`gsap.matchMedia` y la limpieza que devuelve `startFx`) sin mover el scroll. El breakpoint NO es condición de `matchMedia` (provocaba un salto al inicio).
- Lenis (`motion/smooth-scroll.ts`, fragmento aparte) solo con `(hover: hover) and (pointer: fine)` y sin movimiento reducido; desplaza la ventana de forma nativa, así que el `scroll-hub` recibe el mismo evento `scroll`. Su CSS se inyecta desde ese módulo con `?inline`: nunca en la hoja base. Todo CSS con transiciones, animaciones o scroll suave va bajo `prefers-reduced-motion: no-preference`.
- El bundle conserva la cabecera `@license` de GSAP (licencia en `LICENSE-BRAND.md`).

## Cielo (spec 005)

- Solo en la portada (`BaseLayout` con `sky`): una capa fija `SkyBackdrop.astro` (`aria-hidden`, decorativa) con 3 capas de estrellas de `box-shadow` (`far`, `mid` y `near`, de `STAR_LAYERS` en `src/lib/sky/star-field.ts`), generadas en la build con semillas fijas (`sky-css.ts`, `style#sky-stars`; listas más cortas por debajo de 48 rem). El mismo cielo en cada carga, sin imágenes ni JavaScript.
- 7 ambientes (tabla `AMBIENTS` de `src/lib/sky/ambients.ts`), pintados en la build por `ambient-css.ts` (`style#sky-ambients`): cada zona conserva su color base sólido y añade resplandor, polvo y el fundido con sus vecinas. Las alfas tienen tope por luminancia (`SKY_MAX_LUMINANCE`) y contraste por píxeles (ver "Marca").
- `main` y las secciones nunca llevan `z-index`, `transform`, `filter` ni `contain: paint`: sus fondos se apilarían sobre el cielo (comentario de `SkyBackdrop.astro`).
- Planetas: flotación y lunas en CSS. Una luna quieta (movimiento reducido, sin JS o fuera de su clase) va en su punto de la elipse con `left`/`top`; el `offset-path` solo se aplica con movimiento, porque Chromium no resuelve `offset-path: ellipse()` en % hasta un cambio de estilo posterior y dejaba la luna en la esquina de la órbita.

## Capa de efectos y clases de dispositivo (spec 005)

- El núcleo calcula la clase con `pickTier` (`src/lib/fx/device-tier.ts`, puro): `off` con movimiento reducido; `low` con ahorro de datos, ≤ 2 GB de memoria, táctil por debajo de 48 rem o menos de 4 núcleos; `mid` en tableta táctil, sin número de núcleos o con ≥ 4 núcleos que no llegan a alta; `high` con ≥ 8 núcleos y ≥ 8 GB (o memoria desconocida). La marca en `html[data-fx-tier]` y, salvo en `off`, descarga `src/scripts/fx/fx-layer.ts` (`startFx(tier, { hub, traveler })`). Si el módulo no carga, quita la marca y la página sigue completa.
- `TIER_PARAMS` (`src/lib/fx/fx-config.ts`) es la única fuente de los límites de cada clase (capas de paralaje y de centelleo, densidad del lienzo, partículas, estrellas fugaces, chispas, rastro del cursor, trazos del salto y lunas animadas); el resto de constantes de los efectos vive también en `fx-config.ts`.
- Lo que la clase limita en CSS sale de `src/lib/sky/tier-css.ts` (puro, desde `TIER_PARAMS`): `tierLimitsCss()` genera reglas `html[data-fx-tier="…"]` bajo `no-preference` que dejan quietas (`animation: none; offset-path: none`) las lunas y las capas de estrellas que sobran, y `BaseLayout` las inyecta en `style#fx-tier-limits`, solo en la portada. Nunca ocultan nada: sin JS la página es la completa (1/2/1 lunas y 3 capas que centellean). Media y alta no generan reglas.
- Degradación: si la media del coste de los últimos `DEGRADE_WINDOW_FRAMES` (45) fotogramas supera `DEGRADE_LIMIT_MS` (12 ms), la clase baja un escalón (`tierDown`) y no vuelve a subir en la visita.
- Un solo lienzo fijo (`fx/canvas.ts`, `aria-hidden`, ≤ 2 Mpx) con bucle bajo demanda: arranca cuando un efecto tiene algo que dibujar y se para en el primer fotograma vacío. Con la pestaña oculta, `html[data-fx-paused]` detiene las animaciones CSS. Efectos (`src/scripts/fx/`): estrellas fugaces, chispas y paralaje de los planetas, vuelo, estela, mirada, saludo, ráfagas y turbo de Mac, burbujas, indicador del viaje, salto en el espacio y rastro del cursor; su matemática es pura, en `src/lib/fx/` y `src/lib/sky/`. Solo mueven o decoran (transformaciones, nunca visibilidad ni opacidad del contenido: RF-41) y todo se deshace con la función que devuelve `startFx`.
- Para los tests, `html[data-fx="on"]` marca la capa arrancada y el evento `fx:report` vuelca en atributos `data-fx-*` los fotogramas, su coste (media y p95) y los contadores de cada efecto.

## Presupuestos (`e2e/budget.spec.ts`, `e2e/fx.spec.ts` y `lighthouserc.cjs`)

- JS gzip: antes de `load` ≤ 3 KB; total con todos los módulos ≤ 100 KB; módulo de efectos ≤ 30 KB; código propio ≤ 45 KB (total menos GSAP núcleo + Lenis, `GSAP_AND_LENIS_GZIP` = 32921 B medido en T16b de la 005: hay que actualizarlo si se actualiza GSAP o Lenis). CSS ≤ 30 KB. Imágenes al cargar ≤ 90 KB y totales ≤ 400 KB en 375 px.
- Hilo principal: tareas largas con CPU ×4 en los primeros 6 s ≤ 300 ms de bloqueo, con la capa de efectos ya arrancada; cada interacción ≤ 200 ms (proxy de INP, también con turbo, ráfagas y salto); intervalo entre fotogramas a 1280×720 en clase alta, mediana ≤ 18 ms y p95 ≤ 34 ms; coste propio por fotograma en clase alta con CPU ×1, media ≤ 4 ms y p95 ≤ 10 ms, y en clase baja con CPU ×4, p95 ≤ 16 ms (`fx.spec.ts`); ≤ 10 elementos con `will-change`, en reposo y durante un vuelo de Mac.
- Lighthouse (móvil, mediana de 3): Rendimiento ≥ 0,92 (objetivo interno; el suelo de la constitución sigue en 0,9), TBT ≤ 300 ms, LCP ≤ 2500 ms y CLS ≤ 0,1.
- Si algo no se cumple, se para y se avisa: un límite solo se sube con el OK del usuario.

## Reglas

- Todo texto visible existe en ES y EN. Comprueba los dos idiomas en cada cambio.
- El contenido va en el HTML generado y se ve sin JavaScript. Las animaciones solo decoran: nunca ocultan texto a Google.
- Toda animación o transición respeta `prefers-reduced-motion`: con movimiento reducido, el contenido aparece directamente.
- SEO en cada página: `lang`, `<title>` y meta description propios, canonical y hreflang, un solo `h1`, `header`/`nav`/`main`/`footer`, y lo que pida la skill seo-tecnico.
- Nunca `noindex` en la web pública.
- Lighthouse (móvil) ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO. `pnpm quality` falla si alguna baja.
- Accesibilidad: contraste AA y sin infracciones de axe en las 4 páginas; sin desbordamiento horizontal a 320 y 375 px.
- La telemetría de Astro está desactivada en los scripts (`ASTRO_TELEMETRY_DISABLED=1`); mantenla así en los scripts nuevos.
