# Tareas — Spec 004: Portada real de la web pública

Van en orden de dependencia. En cada tarea, primero los tests (vistos en rojo) y después el código. Cada una cierra con `pnpm test`, `pnpm lint` y `pnpm format:check` en verde.

Una sola spec con 23 tareas detalladas en dos fases (A: T1-T15, contenido, marca y SEO; B: T16-T23, animación). El usuario ha aprobado expresamente que superen las 10 habituales. Cada tarea apunta a 20-30 min de trabajo concentrado: si una se alarga, se para y se parte en dos.

Entorno de agente: si `node -v` no devuelve 24, antepón al PATH la carpeta de instalación real de Node 24 antes de usar pnpm o Playwright (ver MEMORY.md y AGENTS.md). Antes de lanzar Playwright o `pnpm quality`, comprobar que no hay procesos node huérfanos en 4321, 4322, 5173, 4173 u 8787 (en Windows, matar el árbol con `taskkill /PID <pid> /T /F`, solo los de este repo).

Aprobaciones: `sharp` 0.35.5 (raíz) se instala en T3 y `gsap` 3.15.0 y `lenis` 1.3.26 en T16, todo con versión exacta y solo tras el OK del usuario al plan (plan, sección 0). Nunca: añadir al repo nada de `Assets/` salvo los derivados de la lista de usados; nombrar en ningún archivo los originales sin usar; `git add` sobre `Assets/`; **hacer push** (lo hace el usuario); escribir en ningún archivo la URL de staging, el subdominio o la del Notion (en documentación: `agencymac-staging.<subdominio>.workers.dev`).

## Fase A: contenido, marca y SEO

- [x] **T1. Higiene de assets: primero `scripts/repo-assets.test.mjs` y el ajuste de `no-loose-colors.test.ts` (en `public/` solo se escanean archivos de texto); después `.gitignore` con `/Assets/` y `scripts/assets/manifest.mjs` (solo las salidas y los nombres de los originales usados; hashes y muestras se rellenan en T4 y T5).** RF-17, RF-21, RNF-13
  - Hecho cuando:
    - `repo-assets.test.mjs` pasó de rojo a verde: `git check-ignore -q Assets/x.png` (ruta sonda inexistente) indica ignorada, `git ls-files Assets` está vacío, las imágenes versionadas están en la lista permitida y el historial no tiene rutas bajo `Assets/`.
    - `git status` ya no muestra `Assets/` como no rastreada.
    - Un PNG ficticio en `apps/web/public/` no hace fallar `no-loose-colors` y un `.svg` con un hex sí (prueba temporal, se revierte).

- [x] **T2. Tokens y contraste: primero `tokens.test.ts` (sin `logoCyan`; con `planetHexawebBg`, `planetRankiaBg` y `planetAdaraBg`; papel de `buttonHover` ampliado), `src/lib/contrast.test.ts`, `src/styles/contrast.test.ts` (parejas de la sección 4 del plan) y `src/styles/no-cyan.test.ts`; después `tokens.ts` y `contrast.ts`. Se eliminan las menciones al cian de `tokens.ts`, `tokens.test.ts` y `MEMORY.md`.** RF-17, RF-18
  - Hecho cuando:
    - Los tests pasaron de rojo a verde: `text`, `accentGreen` y `buttonHover` ≥ 4,5 sobre `bg`, `bgDark` y los tres fondos de planeta; `bgDark` ≥ 4,5 sobre `button` y `buttonHover`; foco ≥ 3.
    - El test anti-cian recorre `apps/web/src`, excluye su propio archivo y `tokens.test.ts`, y falla si se añade temporalmente `cyan` o `00E5FF` a un archivo (se revierte).
    - Los valores finales de los tres fondos quedan anotados aquí para la revisión visual del usuario; `no-loose-colors` y los e2e de la 002 siguen en verde.
    - **Valores finales (los propuestos del plan, sin ajustes; pendientes de la revisión visual del usuario):** `planetHexawebBg` #00505C (contraste: blanco 9,1; verde 7,7; amarillo 6,9), `planetRankiaBg` #1F2A7A (12,6; 10,7; 9,5) y `planetAdaraBg` #7A1A12 (10,6; 9,0; 8,0). Todos ≥ 4,5.

- [x] **T3. Lógica de recortes (necesita el OK a `sharp`): añadir `sharp` 0.35.5 exacta como `devDependency` del `package.json` raíz; primero `scripts/assets/cutout.test.mjs` (relleno desde los bordes con degradado de fondo, zona oscura interior cerrada que sigue opaca, objeto con borde abierto, `checkSamples`, `featherEdge`, `circleAlpha`, `contentBox`, `squarePad`, `validateRecipe`, e import de `tokens.ts` desde un `.mjs`); después `scripts/assets/cutout.mjs`.** RF-22, RNF-12
  - Hecho cuando:
    - Los tests pasaron de rojo a verde: el exterior de la imagen sintética sale con alfa 0, la zona oscura interior mantiene alfa 255, `checkSamples` lanza con la lista de muestras que fallan y una receta inválida lanza.
    - El test que importa `src/styles/tokens.ts` desde `.mjs` pasa (confirma que solo usa sintaxis borrable por _type stripping_).
    - `pnpm install --frozen-lockfile` funciona, `sharp` queda en 0.35.5 (misma que la transitiva de Astro), el lockfile no añade paquetes nuevos y no hace falta autorizar scripts de instalación en `pnpm-workspace.yaml` (si hiciera falta, se anota y se avisa).
    - `cutout.mjs` no importa `sharp` ni toca disco.

- [x] **T4. CLI de derivados y derivados de logo, isologo, iconos e imagen social: primero la parte de `scripts/assets/derivatives.test.mjs` para esos archivos (existencia, dimensiones, canal alfa del logo, peso ≤ presupuesto, coherencia con el manifiesto); después `scripts/assets/build-derivatives.mjs` (lee `Assets/`, comprueba SHA-256, `--check`), scripts raíz `assets:build` y `assets:check`, y ejecución real para `logo-white-letters.png`, `isologo.png`, `favicon-48.png`, `apple-touch-icon.png`, `logo-512.png` y `og-default.png` (colores de fondo desde `tokens.ts`).** RF-20, RF-21, RF-23, RNF-6
  - Hecho cuando:
    - El test pasó de rojo a verde y cada archivo cumple las dimensiones y el peso máximo de la sección 3 del plan.
    - `pnpm assets:check` confirma los hashes de los originales usados; sin `Assets/` el comando falla con un mensaje claro.
    - Se ha mirado cada derivado (captura) sobre `bg` y `bgDark`: el logo se lee y la imagen social se ve bien.
    - `git status` solo muestra derivados y scripts; ningún original ni `Assets/`.

- [x] **T5. Recortes de Mac, Luna y planetas: primero la parte de `derivatives.test.mjs` para esas imágenes (esquinas y bordes con alfa 0, **muestras interiores con alfa 255** guardadas en el manifiesto, dimensiones y peso); después las recetas (`floodBackground` con `stepTol`/`maxLuma` por imagen; `circleAlpha` para la Luna), las muestras (ojos de Mac, zona oscura del casco y manchas oscuras de Adara como interiores; cuatro esquinas y puntos medios de los bordes como exteriores), `mac.webp`, `moon.webp`, `planet-hexaweb.webp`, `planet-rankia.webp`, `planet-adara.webp` y `planet-earth.webp` (opcional), `src/assets/brand/README.md` con procedencia y SHA-256, y `LICENSE-BRAND.md`.** RF-21, RF-22, RF-23, RNF-6
  - Hecho cuando:
    - El test pasó de rojo a verde y `build-derivatives` se niega a escribir un recorte si falla una muestra.
    - Cada imagen está revisada **sobre `bg`, `bgDark` y los tres fondos de planeta** (capturas): sin cajas, sin franjas de halo y con los ojos de Mac y las zonas oscuras intactas. Se anota el aspecto para que **el usuario lo apruebe**; si un recorte no es aceptable, se aplica la alternativa del plan (sección 12) y se avisa.
    - `pnpm assets:check` en verde; `README.md` lista todos los derivados con su original y su receta; `LICENSE-BRAND.md` cubre logos, Mac, planetas, textos y favicon y cita GSAP, Lenis y sharp como terceros.
    - Se anota si la Tierra se incluye u omite; `git status` sin originales.
    - **Notas de T5:** los originales de Mac, Luna, planetas y Tierra ya traían transparencia (alfa), contra lo supuesto en el plan (fondo opaco). No hizo falta `floodBackground` ni `circleAlpha`: la receta es `kind: "none"` con `cleanAlpha` (alfa < 16 → 0, ≥ 240 → 255), recorte al contenido, cuadrado y escalado, con las muestras comprobadas antes de escribir. Revisión visual hecha sobre `bg`, `bgDark` y los tres fondos de planeta: sin cajas ni franjas de halo y con los ojos de Mac intactos (pendiente de la aprobación del usuario). La Tierra se **incluye** (320 × 320, 13,7 KB). Pesos: mac 56,9 KB, luna 13,5 KB, Hexaweb 22,0 KB, Rankia 19,7 KB, Adara 21,7 KB.

- [x] **T6. Datos y textos: primero `site-data.test.ts`, `copy-rules.test.ts` y la ampliación de `translations.test.ts` (claves de la spec en ES y EN, sin precios ni datos de contacto, casos permitidos como "presupuesto", sin las claves provisionales de la 002); después `site-data.ts`, `copy-rules.ts` y `translations.ts` con la tabla "Textos propuestos". Los e2e de la 002 que usan `home.heading` pasan a `hero.heading`.** RF-5, RF-13, RF-14, RNF-11
  - Hecho cuando:
    - Los tests pasaron de rojo a verde: 3 servicios con su etiqueta, 2 proyectos con URL `https` y dominio, 3 personas, `CTA_TARGET` es un id de sección, cada clave tiene ES y EN no vacíos.
    - Al borrar temporalmente una clave EN, `pnpm test` falla indicando clave e idioma (se revierte).
    - La tabla de textos de la spec coincide con las traducciones, clave por clave, y `copy-rules` no da falsos positivos con ninguno.

- [x] **T7. Maquetación a ancho completo, cabecera con logo y CTA: primero los casos de `home.spec.ts` y `brand.spec.ts` (logo eager con `width`/`height` y alt `nav.home` dentro del enlace al inicio, 4 anclas + idioma, CTA a `#contact`, sin `href="#"`) y el de `not-found.spec.ts` que fija que las 404 no cambian; después `BaseLayout.astro` (prop `fullWidth`, por defecto falsa; `main` sin `max-width` ni padding cuando es verdadera), `BrandPicture.astro`, `CtaButton.astro` y `SiteHeader.astro` (variante mínima en las 404). `a11y.spec.ts`: "footer at the bottom" solo en las 404.** RF-9, RF-11, RF-12, RF-16, RF-24, RF-25, RNF-8
  - Hecho cuando:
    - Los tests pasaron de rojo a verde con JavaScript desactivado, en ES y EN; el logo es la variante de letras blancas.
    - Las 404 siguen idénticas (una columna, sin navegación, sin enlace de idioma) y el test del pie pasa en ellas.
    - axe sigue sin infracciones en las 4 páginas y a 320 px la navegación no desborda.

- [x] **T8. Hero: primero `home.spec.ts` (un único `h1` = `hero.heading`, `hero.tagline` visible justo debajo, `hero.kicker`, subtítulo, "Descubre cómo" → `#services`, Mac y Luna eager con `fetchpriority="high"`, ninguna imagen del hero lazy, nada con opacidad 0); después `HomeContent.astro` y `HeroSection.astro` (fondo `bg` sólido, halo decorativo detrás de las imágenes, altura reservada).** RF-1, RF-2, RF-3, RF-24, RF-25, RF-38
  - Hecho cuando:
    - Los tests pasaron de rojo a verde, ES y EN, con JavaScript desactivado.
    - Las imágenes visibles al cargar (logo + Mac + Luna) pesan ≤ 90 KB a 375 px (medido y anotado) y llevan `width`, `height`, `alt` y formato moderno con varios tamaños.
    - Revisión visual a 375 px y en escritorio (captura); el h1 largo no desborda a 320 px; el LCP queda anotado (si > 2,0 s, se añade el `preload` del plan, D13).
    - **Notas de T8:** imágenes visibles al cargar a 375 px: 3 (logo, Mac y Luna), 15,5 KB en total (límite 90 KB). LCP medido con Playwright: 144 ms en escritorio y 664 ms con red y CPU limitadas (4x); muy por debajo de 2,0 s, así que **no se añade el `preload`** (D13). La medición oficial queda para `pnpm quality` (T15). Revisión visual hecha (ES, 1280 y 375 px, sin desbordamiento a 320 px). La sección de servicios sigue provisional hasta T9 (conserva el id `services` como destino de "Descubre cómo").

- [x] **T9. Servicios: primero `home.spec.ts` (3 planetas con `h3`, etiqueta base/propulsor, alt no vacío, color de fondo calculado de cada bloque = su token, sección a ancho completo, ningún texto sobre degradado o imagen); después `ServicesSection.astro` (bandas sólidas por planeta, `data-planet`, contenedor relativo).** RF-4, RF-19, RF-24, RF-38
  - Hecho cuando:
    - Los tests pasaron de rojo a verde, ES y EN, con JavaScript desactivado y con movimiento reducido.
    - Las imágenes de planetas son lazy, con `width`/`height`/`alt` y varios tamaños; axe da el contraste de cada banda como `passes` (no `incomplete`).
    - Revisión visual de las tres bandas a 375 px y en escritorio, anotada para la aprobación del usuario.
    - **Notas de T9:** revisadas en EN a 1280 y 375 px. Tres bandas de borde a borde (Hexaweb verde azulado, Rankia índigo, Adara rojo oscuro), planeta y texto alternando de lado en escritorio (imagen a la izquierda, derecha, izquierda) y apilados en móvil. Etiquetas en pastilla con borde verde (plan base) o amarillo (propulsor). Los planetas se ven bien sobre sus bandas; el cian de Hexaweb sobre el verde azulado es el par con menos contraste de color (se distingue por forma y anillo). Pendiente de la aprobación del usuario. Con la sección real, la prueba de peso a 375 px cuenta solo las 3 imágenes eager (el primer planeta lazy puede descargarse por cercanía al pliegue).

- [x] **T10. Proyectos y equipo: primero `home.spec.ts` (2 enlaces externos con URL exacta, destino abre en pestaña nueva, `rel` seguro y aviso dentro del enlace; sin imágenes de proyecto; 3 personas solo con nombre y rol, sin imágenes); después `ProjectsSection.astro` (con la Tierra decorativa si T5 la incluyó) y `TeamSection.astro`.** RF-6, RF-7, RF-8, RNF-10
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en ES y EN.
    - Los `href` externos quedan excluidos de la comprobación de enlaces internos y se anota la comprobación manual de que las dos webs abren.
    - axe sin infracciones y a 375 px sin texto cortado.
    - **Notas de T10:** revisadas en EN a 1280 y 375 px (proyectos sobre `bg` con tarjetas de borde verde y la Tierra decorativa; equipo sobre `bgDark` con tres tarjetas). **Pendiente de comprobación manual del usuario:** que `https://chatarreriametalrenova.es` y `https://magnarwargames.com` abren la web correcta (no se pidieron desde los tests).

- [x] **T11. Contacto y cierre del contenido sin JS: primero `home.spec.ts` (sección de contacto con `contact.status` visible y CTA a `#contact`; cada `href` interno se resuelve; sin precios ni datos de contacto en el HTML; orden de las 5 secciones), `responsive.spec.ts` (320, 375 y 667×375, ES y EN) y el helper `revealAll` con axe tras recorrer toda la página en `a11y.spec.ts`; después `ContactSection.astro` y los ajustes de estilo.** RF-1, RF-9, RF-10, RF-11, RF-13, RF-15, RNF-8, RNF-9
  - Hecho cuando:
    - Los tests pasaron de rojo a verde: `scrollWidth ≤ innerWidth` en los tres tamaños y axe sin infracciones antes y después de revelar todo, con `color-contrast` en `passes`.
    - La portada completa se ve sin JavaScript en ES y EN (captura de la página entera revisada).
    - Pulsar "Quiero despegar" y "Descubre cómo" lleva a su sección sin cargar otra página.
    - **Notas de T11:** captura de la página entera sin JavaScript revisada (ES, 1280 px): las cinco secciones en orden, bandas alternadas `bg`/`bgDark`, estado "Formulario próximamente" y CTA en contacto. Los tests nuevos están en `e2e/home-page.spec.ts` (orden, contacto, enlaces internos, sin precios ni datos de contacto, botones sin recarga) y `e2e/responsive.spec.ts`; el helper `revealAll` y el axe antes y después de recorrer la página están en `a11y.spec.ts`. Ajuste de T8: el halo del hero ya no sobresale de su caja (desbordaba el cálculo de ancho a 320 px).

- [x] **T12. SEO de la portada: primero `seo.test.ts` (`buildSocialMeta`, `ogLocale`), `structured-data.test.ts`, `sitemap.test.ts` y `seo.spec.ts` (Open Graph y Twitter, JSON-LD coherente con lo visible, sitemap, robots; la ruta de `og:image` y del logo responde 200 en el servidor de pruebas y su URL absoluta empieza por `https://agencymac.com`, sin pedir nada a `agencymac.com`; "ningún script" pasa a "solo `application/ld+json`"); después `seo.ts`, `structured-data.ts`, `sitemap.ts`, `BaseLayout.astro` (`social`, `jsonLd`), las dos portadas, `sitemap.xml.ts` y `robots.txt.ts`.** RF-26, RF-27, RF-28, RF-29, RF-30, RNF-1
  - Hecho cuando:
    - Los tests pasaron de rojo a verde: títulos y descripciones propios por idioma, `og:locale` `es_ES` y `en_US`, JSON-LD sin teléfono, correo ni dirección y sin `sameAs` vacío, sitemap con las dos URLs y sus alternativas, `robots.txt` con `Sitemap`.
    - Las 404 siguen sin URL canónica, alternativas de idioma, metadatos sociales ni JSON-LD.
    - La build no contiene `noindex` (el e2e de la 003 sigue en verde).

- [x] **T13. Favicon del isologo: primero `favicon-isologo.test.ts` y el caso de `brand.spec.ts` (los tres iconos declarados responden 200 con su tipo; `favicon.test.ts` no se toca); después `buildIsologoFaviconSvg`, `favicon.svg.ts` y los `<link>` de iconos en el layout.** RF-20
  - Hecho cuando:
    - `/favicon.svg` sigue sirviéndose con `image/svg+xml`, `favicon.test.ts` pasa sin cambios y el nuevo test pasa de rojo a verde.
    - El favicon se ve como el isologo a 16, 32 y 48 px (captura revisada).
    - El smoke test de 003 y `brand.spec` siguen en verde.

- [x] **T14. Smoke test de staging ampliado (propuesta que el usuario aprueba con el plan): primero los casos nuevos de `scripts/staging/smoke-checks.test.mjs` (`sitemap.xml` 200 XML, `robots.txt` 200 texto, iconos declarados 200 con su tipo, `og-default.png` 200 PNG, todos con `X-Robots-Tag: noindex` en staging; las rutas se obtienen del HTML de `/` y `/en/`, nunca se piden a `agencymac.com`); después `smoke-checks.mjs` y `smoke.mjs`.** RF-20, RF-27, RF-29, RF-30
  - Hecho cuando:
    - Los tests pasaron de rojo a verde, con respuestas simuladas verdes y rojas, y ningún mensaje de fallo contiene el host.
    - `pnpm --filter web build`, `pnpm --filter web staging:local` y `pnpm smoke --url http://localhost:8787 --version local` terminan con código 0 (y el 8787 queda libre después: `workerd.exe` comprobado y cerrado).

- [x] **T15. Cierre de la fase A: aserción de TBT en `lighthouserc.cjs` (propuesta aprobada con el plan), `pnpm quality`, y actualización de `apps/web/AGENTS.md` (sin cian, assets y `BrandPicture`, `CTA_TARGET`, portada a ancho completo, sitemap, robots y JSON-LD; sigue diciendo "sin JavaScript de cliente", cierto hasta la fase B).** RF-20, RNF-1, RNF-3, RNF-4
  - Hecho cuando:
    - `pnpm test` y `pnpm quality` terminan con código 0: 4 categorías ≥ 0,9, LCP ≤ 2,5 s, CLS ≤ 0,1 y TBT ≤ 200 ms en `/` y `/en/` (valores anotados; la aserción de TBT falla si se baja temporalmente a 1 ms, y se revierte).
    - `AGENTS.md` de la web ya no menciona el cian ni su sustitución.
    - **Cifras de T15 (`pnpm quality`, móvil, mediana de 3, código 0):** `/` y `/en/` dan Rendimiento, Accesibilidad, Buenas prácticas y SEO = 100 (1,00); LCP 1578 ms; CLS 0; TBT 0 ms. La aserción de TBT se comprobó con un límite temporal de -1 ms (`lhci assert` falló en las dos URL) y se revirtió a 200.
    - **Parada: la tarea termina aquí, sin push.** El usuario hace el push a `main`, espera al CI en verde, revisa `agencymac-staging.<subdominio>.workers.dev` (y `/en/`) desde el móvil y aprueba los recortes, los colores de planeta y los textos antes de pasar a la fase B.

## Fase B: animación

- [x] **T16. Licencia, dependencias y medición (primera de la fase B): (1) descargar el tarball de `gsap` 3.15.0 a una carpeta temporal fuera del repo y **leer su `LICENSE`**; anotar identificador, enlace y condiciones en el plan (sección 0.2). **Si no permite uso comercial en un repositorio público o exige algo que no se cumple, PARAR y volver al usuario sin instalar nada.** (2) Si es válida: instalar `gsap` 3.15.0 y `lenis` 1.3.26 exactas en `apps/web`. (3) Spike de medición: construir un módulo mínimo que importe GSAP + ScrollTrigger (y Lenis) y medir su peso comprimido; fijar con él el presupuesto de JS.** RNF-5, RNF-12
  - Hecho cuando:
    - El texto de la licencia está leído y anotado, y la decisión (continuar o parar) queda escrita.
    - `pnpm install --frozen-lockfile` funciona con las versiones exactas y sin `^`; la comprobación de "no publicada el mismo día" se anota.
    - El peso medido (gzip) de GSAP + ScrollTrigger y de Lenis queda anotado y el presupuesto de la sección 8 del plan se fija con él. Si el total supera 60 KB o el TBT del spike pasa de 200 ms, se para y se avisa (opción B o C del plan).
    - `LICENSE-BRAND.md` cita la licencia de GSAP con su identificador real.

- [x] **T17. Lógica pura de movimiento: primero `src/lib/motion/*.test.ts` (`resolveActiveStop`: antes, dentro, hueco, después, vacío y NaN; `travelerTarget`: centro dentro del planeta y limitado al contenedor; `revealPlan`: 1 y 2 columnas y alternancia; `isBelowFold`); después `active-stop.ts`, `traveler.ts`, `reveal-plan.ts` y `motion-config.ts` (`LOAD_DELAY_MS`, `GESTURE_MS = 600`, línea de referencia, margen del pliegue).** RF-34, RF-35, RF-36
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y las funciones no importan DOM, GSAP ni la fecha.
    - `motion-config.ts` es la única fuente de las constantes de tiempo y posición.

- [x] **T18. Carga diferida y aparición de bloques: primero `motion.spec.ts` (con movimiento reducido no se descarga el código de animación; sin él, no se descarga nada de GSAP antes de `load` y sí después de `load` + retardo; el HTML inicial ya contiene todo y ningún elemento arranca invisible; los bloques situados bajo el pliegue aparecen desde lados opuestos al entrar y terminan visibles; CLS ≤ 0,1); después el script de entrada (~1 KB: espera `load` y `LOAD_DELAY_MS`, comprueba el movimiento reducido y hace `import()` dinámico), el módulo con GSAP y ScrollTrigger que aplica el estado inicial **solo a los bloques bajo el pliegue** (`isBelowFold`, `revealPlan`) y los anima, y el atributo `data-reveal` en los bloques de servicios.** RF-31, RF-35, RNF-7
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y el JS antes de `load` es ≤ 3 KB comprimidos.
    - Los bloques visibles al cargar no se tocan y, si se llega por un enlace a una sección, el contenido ya está visible.
    - Con el atributo de reducción de movimiento activado a mitad de la visita, los bloques quedan visibles y el módulo se desactiva.

- [x] **T19. Planeta activo y Mac viajero: primero `motion.spec.ts` (con animación activa y sin movimiento reducido, al desplazarse a cada bloque `data-active-planet` es el esperado y el centro de Mac queda dentro de la ilustración del planeta; antes del primero es el primero y después del último es el último; sin animación no existe el atributo ni el Mac viajero; recalcula al girar o redimensionar); después el Mac viajero creado por JS (`alt=""`, `aria-hidden`, posición absoluta en el contenedor de servicios) con `travelerTarget` y `resolveActiveStop` sobre `ScrollTrigger`.** RF-34, RNF-9, RNF-10
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en ES y EN, a 375 px y en escritorio.
    - Sin desbordamiento horizontal a 320 y 375 px con Mac viajero activo y CLS ≤ 0,1.
    - Revisión visual del viaje de Mac anotada para el usuario.

- [x] **T20. Sin JS y con movimiento reducido: primero `motion.spec.ts` (con el código de animación bloqueado, todo el contenido visible y con opacidad completa; con movimiento reducido, ningún elemento con transición o animación de duración > 0, Mac estático y desplazamiento nativo) y la comprobación en `home.spec.ts` de que no existe ninguna regla que oculte contenido al cargar; después los ajustes necesarios.** RF-32, RF-33, RF-38
  - Hecho cuando:
    - Los tests pasaron de rojo a verde.
    - Con JavaScript desactivado la página es idéntica a la de la fase A.
    - Una revisión de las hojas de estilo confirma que ninguna regla pone `opacity: 0` ni `visibility: hidden` en contenido inicial.

- [x] **T21. Scroll suave con Lenis e INP: primero `motion.spec.ts` y `budget.spec.ts` (Lenis solo con puntero fino y sin movimiento reducido; "Descubre cómo", "Quiero despegar" y los enlaces de navegación llegan a su sección; Tab, Espacio, flechas, Inicio y Fin desplazan; ninguna interacción de la prueba pasa de 200 ms según `PerformanceObserver` de tipo `event`); después Lenis integrado con ScrollTrigger (`gsap.ticker`, `lagSmoothing(0)`), importado con `import()` dentro del módulo solo para puntero fino.** RF-37, RNF-4
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y en táctil (emulado) Lenis no se descarga.
    - Revisión **manual** anotada de la búsqueda en la página (Ctrl+F) y de la sensación del desplazamiento con ratón.
    - El INP de laboratorio máximo queda anotado.

- [x] **T22. Gesto de Mac y axe tras revelar todo: primero `motion.spec.ts` (al pulsar a Mac el atributo `data-mac-gesture` pasa a `playing` y vuelve a quedar vacío a los 600 ms ± margen, sin cambiar el texto; con movimiento reducido no se activa) y `a11y.spec.ts` (axe en `/` y `/en/` antes y después de recorrer toda la página con la animación activa, con `color-contrast` en `passes`); después el gesto con GSAP y los ajustes.** RF-36, RNF-8
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en ES y EN.
    - axe sin infracciones ni `color-contrast` incompleto con la animación activa.
    - El gesto se ve en la revisión visual y no mueve ningún texto.

- [x] **T23. Presupuestos, calidad y cierre: `budget.spec.ts` completo (JS antes de `load`, JS total, CSS, imágenes al cargar y totales) y `pnpm quality`; actualización de `apps/web/AGENTS.md` (se quita "sin JavaScript de cliente"; reglas de animación, carga diferida y presupuestos), `LICENSE-BRAND.md` y `MEMORY.md`; ampliación del smoke de staging si procede; validación RF por RF con checklist de seo-tecnico y cierre.** RF-31, RF-37, RNF-3, RNF-4, RNF-5, RNF-6, RNF-12
  - Hecho cuando:
    - `pnpm test` y `pnpm quality` terminan con código 0 (4 categorías ≥ 0,9, LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms) y los presupuestos de la sección 8 del plan se cumplen (valores anotados).
    - Documentación al día y propuesta de mover a `AGENTS.md` lo que sea regla permanente.
    - **Parada: sin push.** El usuario hace el push, revisa el staging desde el móvil con y sin movimiento reducido, aprueba por escrito los textos (spec), el aspecto de los recortes y los colores, y entonces se cierra la spec con VEREDICTO: APROBADO.
