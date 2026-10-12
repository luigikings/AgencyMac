# Tareas — Spec 005: Portada espacial

Van en orden de dependencia. En cada tarea, primero los tests (vistos en rojo) y después el código. Cada una cierra con `pnpm test`, `pnpm lint` y `pnpm format:check` en verde (las dos de medición, T1 y T2, cierran anotando cifras). Cada tarea apunta a 20-30 min de trabajo concentrado: si una se alarga, se para y se parte en dos.

33 tareas en 8 bloques (medición, bases, y los bloques A a F). El usuario acepta superar las 10 habituales y quiere revisar por bloques: cada bloque termina con una **tarea de revisión (R1 a R5)** que **para** hasta que el usuario apruebe en staging (móvil y escritorio, con y sin movimiento reducido). El push a `main` lo hace el coordinador tras cada bloque; ninguna tarea hace push, `wrangler login`, `wrangler deploy` ni toca el CI.

Entorno de agente: si `node -v` no devuelve 24, antepón al PATH la carpeta real de Node 24 antes de usar pnpm o Playwright (ver MEMORY.md y AGENTS.md). Antes de lanzar Playwright o `pnpm quality`, comprobar que no hay procesos node huérfanos en 4321, 4322, 5173, 4173 u 8787 (en Windows, `taskkill /PID <pid> /T /F`, solo los de este repo).

Nunca: instalar dependencias (ninguna prevista; si hiciera falta una, parar y avisar), añadir imágenes o nada de `Assets/`, escribir hex fuera de `tokens.ts`, escribir texto visible fuera de `translations.ts`, escribir en ningún archivo la URL de staging, el subdominio o URLs privadas, ni subir un presupuesto sin aprobación del usuario.

## Bloque 0: medición inicial (antes de construir)

- [x] **T1. Spike A, el cielo CSS: prototipo desechable (rama local o carpeta temporal, no se versiona) con 3 capas de estrellas de `box-shadow`, 7 ambientes con degradados y fundidos, texto encima y el hero con la entrada en CSS (Mac y Luna dentro de la ventana). Medir con Lighthouse móvil (3 ejecuciones, `chrome-headless-shell`) y axe.** RF-1, RF-5, RF-6, RF-8, RF-16, RNF-2
  - Hecho cuando:
    - Anotadas en el plan (sección 12, "Resultados de la medición inicial"): Rendimiento, Accesibilidad, Buenas prácticas y SEO; LCP y su elemento candidato (debe ser el h1 o Mac/Luna, no una capa del cielo); CLS; TBT; peso gzip del CSS.
    - Anotado si axe da "incompleto" en el texto sobre degradados y si Lighthouse Accesibilidad baja de 100 por ello.
    - **Decisión escrita: continuar con el criterio por píxeles (D3) o activar el plan B (paneles sólidos tras el texto).** Si LCP > 2,0 s o Accesibilidad < 90, se PARA y se avisa.
    - El prototipo no queda en el árbol de trabajo (`git status` limpio salvo el plan).

- [x] **T2. Spike B, la capa de efectos: prototipo desechable con un módulo que importe el motor del canvas (bucle bajo demanda), un pool de 160 partículas, el paralaje de scroll y una trayectoria curva, cargado como módulo diferido tras `load` + 1 s sobre la portada actual. Medir peso, TBT, tareas largas con CPU ×4, coste por fotograma y FPS.** RNF-2, RNF-3, RNF-4, RNF-7, RNF-8
  - Hecho cuando:
    - Anotados en el plan (sección 12): peso gzip del módulo y estimación del código propio total; TBT de Lighthouse (mediana de 3) con la capa cargada; bloqueo de tareas largas de los primeros 6 s con CPU ×4; coste por fotograma (media y p95) en clase alta con CPU ×1 y en clase baja con CPU ×4; intervalo entre fotogramas (mediana y p95) en 1280×720 sin GPU.
    - **Los presupuestos de la sección 8 del plan quedan confirmados o corregidos con esas cifras y la tolerancia de las pruebas de FPS queda fijada.** Si el total supera 100 KB, el TBT 300 ms o el CSS 30 KB, se PARA y se vuelve al usuario con los datos (máximo absoluto de JS: 150 KB, con aprobación expresa).
    - **Parada: el usuario confirma los presupuestos** (duda abierta 4 de la spec) antes de seguir con T3.
    - El prototipo no queda en el árbol de trabajo.

## Bloque 1: tokens, lógica pura y herramientas de prueba

- [x] **T3. Tokens y ambientes: primero `tokens.test.ts` (cuatro tokens de resplandor), `src/lib/sky/ambients.test.ts` y `src/styles/sky-luminance.test.ts` (7 zonas distintas; `blendOver`; `glowAlphaCap`; la alfa de cada resplandor ≤ su tope con el peor texto de la zona; luminancia ≤ `SKY_MAX_LUMINANCE`); después `tokens.ts`, `src/lib/sky/ambients.ts` y `src/lib/fx/fx-config.ts` (esqueleto).** RF-5, RF-8, RNF-12
  - Hecho cuando:
    - Los tests pasaron de rojo a verde; `no-loose-colors` y `no-cyan` siguen en verde.
    - Las alfas finales de los 7 ambientes (ajustadas por el test, si hizo falta bajarlas) quedan anotadas aquí para la revisión visual.
    - **Alfas finales (resplandor / polvo):** hero 0,22 / 0,12; Hexaweb **0,12 / 0,02** (plan 0,30 / 0,06); Rankia 0,30 / 0,08; Adara **0,17 / 0,04** (plan 0,28 / 0,10); proyectos 0,22 / 0,10; equipo 0,20 / 0,12; contacto **0,20 / 0,06** (plan 0,22 / 0,10). El límite lo pone la luminancia máxima del pico (resplandor y polvo apilados ≤ 0,12), no el tope del resplandor solo. Hexaweb queda con un resplandor muy tenue: es el punto a mirar en la revisión visual (si se quiere más, habría que cambiar el color del polvo, no el contraste del texto).

- [x] **T4. Estrellas, paralaje y viaje (puros): primero `src/lib/sky/rng.test.ts`, `star-field.test.ts` (determinismo, recuentos 110/60/30 y 40/22/10, sin hex en `starsToBoxShadow`, rangos de x e y), `parallax.test.ts` (0, 0,5 y 1; rangos 4/8/16 vh; paralaje de puntero) y `journey.test.ts` (progreso en 0, 1 y documento corto; paradas visitadas); después los cuatro archivos.** RF-1, RF-2, RF-13, RF-30
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y los módulos no importan DOM, GSAP ni usan `Math.random` ni la fecha.
    - La misma semilla da el mismo texto de sombras en dos ejecuciones.

- [x] **T5. Clases de dispositivo, planificador, partículas y salto (puros): primero `src/lib/fx/device-tier.test.ts` (tabla completa de casos de RF-37, `shouldDegrade` con 44 y 45 fotogramas y media en el límite, `tierDown` nunca sube), `scheduler.test.ts` (`shouldRun`, `needsFrame`, intervalos de estrellas fugaces por clase, límites simultáneos), `particles.test.ts` (vida, desvanecimiento, pool lleno, `emitRate`, caps 24/80/160) y `streaks.test.ts` (longitud ∝ velocidad, ≤ 900 ms, trazos máximos 40/80); después los cuatro archivos y `fx-config.ts` completo (tabla `TIER_PARAMS` del plan).** RF-4, RF-14, RF-23, RF-31, RF-37, RF-38, RF-39
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y `fx-config.ts` es la única fuente de las constantes de efectos.
    - Ningún módulo importa DOM, GSAP ni la fecha; el reloj y el generador se pasan por parámetro.

- [x] **T6. Mac y constelaciones (puros): primero `src/lib/fx/mac-path.test.ts` (desviación ≥ 12 % de la distancia en distancias de 100 a 1200 px, extremos exactos, duración en [700, 1600] ms, inclinación en ±25°, `retarget` continuo), `mac-reactions.test.ts` (`lookAt` ≤ 6° y 8 px, `pickLine` sin repetir con 1, 2 y 3 mensajes, `isTurbo` con 4 clics, 5 en 3 s, 5 en 3,1 s y enfriamiento, `idleDue`, `bubbleMs` en [2000, 2800]) y `src/lib/sky/constellation.test.ts` (5 a 8 estrellas, estable, distinta para Joni, Samuel y Luigi, sin aristas que se crucen); después los tres archivos.** RF-21, RF-22, RF-25, RF-26, RF-27, RF-29, RF-34
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y no hay acceso a DOM, GSAP ni fecha.

- [x] **T7. Textos nuevos: primero la ampliación de `translations.test.ts` (claves de la tabla "Textos propuestos" de la spec en ES y EN, no vacías, comparadas con la tabla clave por clave) y `copy-rules` sobre ellas (sin precios ni datos de contacto); después `translations.ts`, `site-data.ts` (zonas de ambiente y lunas por planeta) y el JSON de mensajes en `HomeContent.astro` (`<script type="application/json" id="mac-lines">`; `seo.spec.ts` lo permite junto a `application/ld+json`).** RF-27, RF-36, RF-43, RNF-13
  - Hecho cuando:
    - Los tests pasaron de rojo a verde; borrar temporalmente una clave EN hace fallar `pnpm test` indicando clave e idioma (se revierte).
    - Los textos siguen siendo provisionales hasta la aprobación del usuario (se anota aquí al aprobar).

- [x] **T8. Herramientas de prueba: primero tests de `e2e/pixel-contrast.ts` (con una imagen sintética: texto blanco sobre fondo oscuro pasa, sobre fondo claro falla; percentil 2) y los de `motion-css.test.ts` afinado (`opacity: 0` solo dentro de `@keyframes` de la lista permitida; `filter: blur` en animaciones prohibido; todo movimiento bajo `no-preference`); después `pixel-contrast.ts`, el ajuste de `motion-css.ts` y la lista de "incompletos" permitidos (`data-sky-text`) en `a11y.spec.ts`.** RF-8, RF-40, RF-42, RNF-9
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y las pruebas de la 004 siguen en verde.
    - `pixel-contrast.ts` no necesita dependencias (decodifica la captura en la página) y funciona con `page.screenshot` de `chrome-headless-shell`.

## Bloque A: hero y cielo base

- [x] **T9. Cielo base: primero `e2e/sky.spec.ts` (3 capas con `data-star-count` 110/60/30 en escritorio y 40/22/10 en 375 px; mismo CSS en dos cargas; capas fijas, `aria-hidden`, `pointer-events: none`; visibles sin JavaScript y con movimiento reducido; las 404 no llevan cielo; centelleo con duraciones distintas entre 7 y 15 s solo bajo `no-preference`); después `SkyBackdrop.astro`, la prop `sky` de `BaseLayout.astro` (contenido de cada sección sobre el cielo, sin contextos de apilado en `main` ni en las secciones) y el CSS del cielo.** RF-1, RF-3, RF-9, RF-40, RF-42
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en ES y EN; sin desbordamiento a 320 y 375 px.
    - `pnpm test` completo en verde (los e2e de la 004 no cambian) y captura revisada sobre el hero.

- [x] **T10. Entrada cinematográfica del hero: primero `e2e/hero-entrance.spec.ts` (sin JavaScript; a los 0 s todo el contenido del hero está dentro de la ventana con opacidad 1; muestreo por fotograma de opacidad y caja de h1, lema, kicker, subtítulo, enlace, Mac y Luna; Luna en su sitio antes de 1,2 s, Mac aterrizado antes de 1,7 s, llama retirada antes de 1,8 s, rebote de 0,3 a 0,5 s, textos asentados antes de 0,5 s, secuencia completa ≤ 2,0 s; con movimiento reducido todo en su pose final desde el primer fotograma) y el test de lista permitida de `opacity: 0`; después el CSS de `HeroSection.astro` (Mac en dos capas, llama, escalón de textos, Luna que sube).** RF-16, RF-17, RF-18, RF-40, RNF-2
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en ES y EN y a 375 px y 1280 px.
    - LCP medido con Playwright (CPU ×4) y anotado; el elemento LCP es h1 o imagen del hero. Si el LCP supera 2,0 s se aplica el plan B de la sección 12 del plan y se avisa.
    - **Medido (T10):** Playwright con CPU ×4, 3 cargas por página y viewport (1280 y 375 px, ES y EN): LCP 216 a 252 ms, elemento `h1`. Lighthouse móvil (3 ejecuciones): LCP mediana 1579 ms (`/`) y 1597 ms (`/en/`), elemento `img.hero__moon` (imagen del hero); CLS 0, TBT 0, 100 en las 4 categorías. Por debajo de 2,0 s: no hace falta el plan B.

- [x] **T11. Decoración del hero y botón: primero `hero-entrance.spec.ts` (aura, ≥ 1 órbita con cuerpo que la recorre, ≥ 3 destellos que parpadean, sin solapar texto ni desplazarlo; CLS 0) y los casos de `home-page.spec.ts` del botón (hover y foco: elevación 2 px y brillo de 0,6 s; pulsación: escala 0,97; con movimiento reducido solo cambia el color); después el CSS de `HeroSection.astro` y `CtaButton.astro`.** RF-19, RF-20, RF-40, RNF-10
  - Hecho cuando:
    - Los tests pasaron de rojo a verde; axe sin infracciones y `color-contrast` del botón y de los textos del hero medido como "pasa" o por píxeles.
    - Ningún destello parpadea más de 3 veces por segundo (comprobado sobre los parámetros).

- [ ] **T12. REVISIÓN R1: hero.** RF-16 a RF-20, RNF-2
  - Hecho cuando:
    - `pnpm test`, `pnpm lint`, `pnpm format:check` y `pnpm build` en verde; capturas del hero a 375 px y escritorio, ES y EN, con y sin movimiento reducido, entregadas al coordinador.
    - **Parada: el coordinador hace el push, el CI despliega a staging y el usuario aprueba el hero (móvil y escritorio).** Sin su OK no se sigue. Anotar aquí el resultado y los ajustes pedidos.

## Bloque B: cielo y servicios

- [ ] **T13. Ambientes y fundidos: primero `sky.spec.ts` (7 ambientes con color base distinto sin JavaScript; el color base de cada bloque de planeta es su token; en cada frontera entre zonas, a 375 y 1280 px, ningún par de píxeles consecutivos difiere más de 12 niveles por canal; contraste por píxeles del texto de las 7 zonas en ES y EN, con y sin movimiento reducido); después el CSS de ambientes y fundidos en `ServicesSection`, `ProjectsSection`, `TeamSection`, `ContactSection` y el hero (con `data-sky-text` en los textos sobre el cielo).** RF-5, RF-6, RF-7, RF-8, RNF-9
  - Hecho cuando:
    - Los tests pasaron de rojo a verde; axe sin infracciones, con "incompletos" solo en `data-sky-text`.
    - Si algún texto no llega al contraste por píxeles, se baja la alfa del resplandor (no el contraste del texto) y se anota; si no se consigue con aspecto aceptable, se activa el plan B (paneles sólidos) y se avisa.

- [ ] **T14. Planetas con vida: primero `sky.spec.ts` o `planets.spec.ts` (flotación 6–14 px y 6–10 s, rotación 2–4° y 14–24 s con desfases distintos; halo con pulso 60–100 % y 4–6 s; órbitas y lunas `data-moon` 1/2/1 con ciclos de 10–20 s; animaciones en pausa al salir de la ventana y reanudadas al volver; todo estático con movimiento reducido y sin JavaScript); después el CSS y el marcado de `ServicesSection.astro` (envoltorios `.service__planet`, halo, órbita SVG, lunas con `offset-path`).** RF-10, RF-11, RF-12, RF-15, RF-40
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en ES y EN; la aparición de la 004 (`data-reveal`) y el planeta activo siguen en verde.
    - Sin desbordamiento a 320 y 375 px y CLS 0.

- [ ] **T15. Núcleo de la capa de efectos: primero `fx.spec.ts` (`data-fx-tier` presente según la clase simulada: móvil, tableta, escritorio, ahorro de datos, memoria baja; con movimiento reducido no se descarga el módulo de efectos; paralaje de scroll de las capas 4/8/16 vh y solo 2 capas en clase media y ninguna en baja; paralaje de ratón de los planetas ≤ 14 px y retorno < 1 s; pausa por `IntersectionObserver` y `visibilitychange`; reducción de movimiento a mitad de visita retira todo sin mover el scroll; código bloqueado y todo visible); después `src/scripts/fx/fx-layer.ts`, el cambio en `home-motion.ts` (clase y `import()` del módulo) y el manejador de scroll único.** RF-2, RF-13, RF-15, RF-37, RF-39, RF-40, RF-41, RF-42
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y el JS antes de `load` sigue ≤ 3 KB.
    - El peso del módulo de efectos queda anotado frente al tope (≤ 30 KB).

- [ ] **T16. Canvas y estrellas fugaces: primero `fx.spec.ts` (un solo canvas fijo, `aria-hidden`, `pointer-events: none`, densidad limitada y ≤ 2 megapíxeles; en reposo ≤ 2 llamadas a `requestAnimationFrame` en 2 s; estrellas fugaces con `page.clock`: cada 12–24 s en clase media con una a la vez, 8–16 s con hasta 2 en alta y ninguna en baja, de 0,6 a 1,2 s; sin `getContext` el contenido y el cielo se ven y no hay errores) y el informe `fx:report`; después `canvas.ts` (bucle bajo demanda) y `shooting-stars.ts`.** RF-4, RF-39, RF-41, RF-42, RNF-8
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y no hay errores en consola con y sin soporte de canvas.
    - Coste por fotograma anotado frente al presupuesto (media ≤ 4 ms en clase alta).

- [ ] **T17. Chispas al pasar por los planetas: primero `fx.spec.ts` (con puntero fino y clase media o alta: al entrar en un planeta crece hasta un 5 % y hay chispas hasta 20 (media) o 40 (alta) por planeta; al salir paran y el planeta vuelve a su tamaño; en táctil o clase baja no hay chispas; con movimiento reducido ninguna); después `planet-fx.ts`.** RF-14, RF-37, RF-40
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y las chispas usan colores de token (sin hex).
    - Ninguna chispa intercepta el ratón (el clic atraviesa el canvas).

- [ ] **T18. REVISIÓN R2: cielo y servicios.** RF-1 a RF-15
  - Hecho cuando:
    - `pnpm test`, `pnpm lint`, `pnpm format:check` y `pnpm build` en verde; capturas de las 7 zonas a 375 px y escritorio, ES y EN, con y sin movimiento reducido, y de las capturas de contraste por píxeles.
    - **Parada: push del coordinador y aprobación del usuario del cielo y los servicios en staging (móvil y escritorio).** Anotar el resultado y los ajustes.

## Bloque C: Mac

- [ ] **T19. Trayectoria curva e inclinación: primero `mac.spec.ts` (al cambiar el planeta activo Mac recorre una curva cuya desviación máxima respecto a la recta es ≥ 12 % de la distancia, 0,7–1,6 s, termina con su centro dentro del planeta activo; inclinación en ±25° durante el vuelo y recta en < 0,4 s al llegar; un cambio de planeta a mitad de vuelo redirige sin saltos; el estado de la 004 (`data-active-planet`, sin Mac viajero sin animación) se conserva; 320 y 375 px sin desbordamiento); después `mac-fx.ts` (viajero con `curveBetween`, `pointAt`, `tiltFor`).** RF-21, RF-22, RNF-11
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y `motion.spec.ts` de la 004 sigue en verde.
    - El viaje desde el hero hasta el primer planeta no deja dos Macs superpuestos de forma visible (anotado para la revisión).

- [ ] **T20. Estela, rebote de llegada y burbujas: primero `mac.spec.ts` (estela ≥ 36/s en alta, 20/s en media y 8/s en baja mientras vuela y 0 cuando no; partículas desvanecidas en < 0,6 s; rebote de llegada 0,4 s con escala hasta 1,12; burbuja con el mensaje de su planeta: una a la vez, 2,0–2,8 s, `aria-hidden`, fondo sólido, sin texto en el HTML inicial, no tapa el botón principal ni desborda a 320 px; con movimiento reducido ninguna) y los de `bubbles` (sin repetir mensajes seguidos); después la estela en `mac-fx.ts` y `bubbles.ts`.** RF-23, RF-24, RF-27, RF-40, RNF-11
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en ES y EN (mensajes de la tabla de la spec).
    - axe sin infracciones con una burbuja visible y contraste de la burbuja como "pasa".

- [ ] **T21. Mirada y saludo: primero `mac.spec.ts` (con puntero fino, el Mac del hero y el viajero se inclinan ≤ 6° y se desplazan ≤ 8 px hacia el cursor y vuelven en < 1 s; el saludo de 0,8 s ocurre una sola vez al terminar el aterrizaje, con su burbuja; tras 8 s sin interacción sale `mac.idle` una vez por periodo, con `page.clock`; en táctil no hay mirada); después `mac-fx.ts` (mirada con `lookAt`, saludo, reposo con `idleDue`).** RF-25, RF-26, RF-27
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y el gesto de la 004 (RF-36: ratón, toque y teclado) sigue en verde.

- [ ] **T22. Ráfagas y modo turbo: primero `mac.spec.ts` (pulsar, tocar o Intro/Espacio: gesto de 0,6 s + ráfaga de 12–20 partículas con el límite de la clase + burbuja, sin cambiar texto; 5 activaciones en ≤ 3 s activan `data-mac-turbo="playing"` y la retiran en ≤ 1,4 s, ≥ 60 partículas con el límite de la clase, burbuja `mac.turbo`, no repite hasta 10 s, funciona con teclado; las activaciones masivas no apilan gestos ni burbujas); después `mac-fx.ts` (ráfaga y turbo con `isTurbo`).** RF-28, RF-29, RNF-4
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y axe sigue sin infracciones.
    - INP de la prueba con turbo ≤ 200 ms (anotado).

- [ ] **T23. REVISIÓN R3: Mac.** RF-21 a RF-29
  - Hecho cuando:
    - `pnpm test`, `pnpm lint`, `pnpm format:check` y `pnpm build` en verde; capturas y secuencias del vuelo, la llegada, las burbujas y el turbo a 375 px y escritorio, ES y EN.
    - **Parada: push del coordinador y aprobación del usuario de Mac, de los textos nuevos (tabla de la spec) y del huevo de pascua en staging (móvil y escritorio).** Anotar el resultado y los textos finales.

## Bloque D: microinteracciones

- [ ] **T24. Indicador del viaje: primero `fx.spec.ts` (con animación: 5 paradas, el isologo avanza con el progreso, paradas visitadas iluminadas, `aria-hidden`, ≤ 6 px de grosor en móvil, vertical desde 64 rem, no solapa ningún texto ni botón a 320, 375 y 1280 px; no existe sin animación) y `journey` en el navegador; después `src/scripts/fx/journey.ts` (usa `/favicon.svg` como cohete; sin imagen nueva).** RF-30, RF-42, RNF-11
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y no aparece ninguna imagen nueva en el manifiesto.
    - Sin CLS y sin desbordamiento a 320 px.

- [ ] **T25. Salto en el espacio: primero `fx.spec.ts` (al activar "Quiero despegar", "Descubre cómo" o un enlace de la navegación, en clase media o alta, aparece `data-jump="playing"` ≤ 0,9 s, ≤ 40 trazos (media) o 80 (alta), longitud ∝ velocidad; la llegada a la sección no se retrasa; no hay salto al cargar con un ancla en la URL ni en clase baja ni con movimiento reducido); después `hyperjump.ts` y la velocidad expuesta por `smooth-scroll.ts`.** RF-31, RF-40, RNF-10
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y la interacción con ancla ≤ 200 ms de respuesta.
    - Ningún cambio brusco de luminosidad por encima del límite (parámetros comprobados).

- [ ] **T26. Rastro del cursor y degradado adaptativo: primero `fx.spec.ts` (clase alta con puntero fino: rastro ≤ 14 partículas que se apaga a los 0,6 s con el cursor quieto; sin rastro en media, baja o táctil; con la CPU ralentizada ×4 y coste medio > 12 ms durante 45 fotogramas, `data-fx-tier` baja una clase, aplica sus límites y nunca sube); después `cursor-trail.ts` y la medición y degradado en `fx-layer.ts`.** RF-32, RF-37, RF-38
  - Hecho cuando:
    - Los tests pasaron de rojo a verde; el cursor nativo no se oculta ni cambia.
    - El degradado se reproduce en el navegador con CPU ×4 y queda anotado.

- [ ] **T27. REVISIÓN R4: microinteracciones.** RF-20, RF-30, RF-31, RF-32, RF-37, RF-38
  - Hecho cuando:
    - `pnpm test`, `pnpm lint`, `pnpm format:check` y `pnpm build` en verde; capturas y notas de botón, indicador, salto y rastro.
    - **Parada: push del coordinador y aprobación del usuario en staging (móvil y escritorio, incluida una prueba en un móvil real).** Anotar el resultado.

## Bloque E: proyectos, equipo, contacto y pie

- [ ] **T28. Tarjetas de proyectos con borde cósmico: primero `home-page.spec.ts` y `sky.spec.ts` (borde con ≥ 2 colores de token; el borde gira solo en hover o foco-dentro y solo con animación; el texto va sobre panel sólido y axe lo da como "pasa"; los enlaces externos de la 004 intactos; 320 y 375 px sin desbordamiento); después `ProjectsSection.astro`.** RF-33, RF-40
  - Hecho cuando:
    - Los tests pasaron de rojo a verde en ES y EN y los tests de proyectos de la 004 siguen en verde.

- [ ] **T29. Equipo con constelaciones: primero `home-page.spec.ts` (cada miembro tiene un emblema SVG `aria-hidden` con 5–8 estrellas, distinto y estable entre cargas; sin imágenes ni nombres completos; el trazo "se dibuja" en 0,8 s al hover o foco solo con animación; sin él, el emblema está completo y estático); después `TeamSection.astro` con `constellationPath` y el CSS.** RF-34, RF-40
  - Hecho cuando:
    - Los tests pasaron de rojo a verde (y el de la 004 de "sin imágenes de equipo" ajustado solo para permitir el SVG decorativo, si la duda 3 se aprueba).
    - Si la duda 3 se rechaza, esta tarea se omite y se anota.

- [ ] **T30. Contacto y pie: primero `home-page.spec.ts` (contacto con plataforma de lanzamiento decorativa, isologo sin imagen nueva, pulso del botón cada 3 s solo con animación, `contact.status` y el hueco del formulario intactos; pie con horizonte, satélite que orbita con animación y `footer.detail` en ES y EN sobre fondo sólido; axe y 320/375 px); después `ContactSection.astro`, `SiteFooter.astro` y `CtaButton.astro` (variante `pulse`).** RF-35, RF-36, RF-40, RF-43
  - Hecho cuando:
    - Los tests pasaron de rojo a verde y las 404 no cambian (el pie de las 404 sigue sin el horizonte, salvo que el usuario lo pida).
    - La mención "Mac" del mensaje `mac.arrive.contact` aparece al llegar a contacto.

- [ ] **T31. REVISIÓN R5: proyectos, equipo, contacto y pie.** RF-33 a RF-36
  - Hecho cuando:
    - `pnpm test`, `pnpm lint`, `pnpm format:check` y `pnpm build` en verde; capturas a 375 px y escritorio, ES y EN, con y sin movimiento reducido.
    - **Parada: push del coordinador y aprobación del usuario en staging.** Anotar el resultado.

## Bloque F: presupuestos y cierre

- [ ] **T32. Presupuestos y calidad: primero `budget.spec.ts` ampliada (JS antes de `load` ≤ 3 KB; JS total ≤ 100 KB; módulo de efectos ≤ 30 KB; código propio ≤ 45 KB; CSS ≤ 30 KB; imágenes sin cambio; tareas largas con CPU ×4 ≤ 300 ms; coste por fotograma y FPS de la medición controlada con la tolerancia fijada en T2; elementos con `will-change` ≤ 10; INP ≤ 200 ms con turbo, ráfagas y salto) y la propuesta de `lighthouserc.cjs` (TBT ≤ 300 ms y Rendimiento ≥ 0,92 en la mediana); después los ajustes necesarios y `pnpm quality`.** RF-37, RF-38, RF-39, RNF-2, RNF-3, RNF-4, RNF-5, RNF-6, RNF-7, RNF-8
  - Hecho cuando:
    - `pnpm test` y `pnpm quality` terminan con código 0: 4 categorías ≥ 0,9 (Rendimiento ≥ 0,92), LCP ≤ 2,5 s, CLS ≤ 0,1 y TBT ≤ 300 ms en `/` y `/en/`; todas las cifras anotadas aquí.
    - La aserción de TBT falla si se baja temporalmente a 1 ms en una página con la capa activa (y se revierte).
    - Los presupuestos de `budget.spec.ts` y de `lighthouserc.cjs` solo se cambian con el OK del usuario (T2); si algo no se cumple, se para y se avisa.

- [ ] **T33. Cierre: validación RF por RF con la checklist de seo-tecnico (título, descripción, canonical, un solo h1, HTML servido con todo el contenido, sitemap y robots, alt/ancho/alto, JSON-LD coherente, sin `noindex`, 404 real, rendimiento), `apps/web/AGENTS.md` (presupuestos nuevos, "un fondo de color es siempre sólido" sustituido por la regla de contraste por píxeles, cielo, capa de efectos y clases de dispositivo), nota "modificado por la 005" en los requisitos afectados de la spec 004, `LICENSE-BRAND.md` solo si procede y `MEMORY.md`.** todos los RF y RNF
  - Hecho cuando:
    - Validación con **VEREDICTO: APROBADO** y la lista de RF con su test y su resultado.
    - Documentación al día y propuesta de mover a `AGENTS.md` lo que sea regla permanente.
    - **Parada: sin push.** El coordinador hace el push, el usuario revisa staging desde el móvil real (con y sin movimiento reducido), aprueba los textos y los bloques R1 a R5 por escrito (se anota en la spec) y solo entonces la spec pasa a `implementada`.
