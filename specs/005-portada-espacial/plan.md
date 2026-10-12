# Plan — Spec 005: Portada espacial

Parte de `specs/005-portada-espacial/spec.md` (Estado: borrador; el plan no se ejecuta hasta que el usuario apruebe la spec y este plan con sus tareas). Cumple `docs/constitution.md`, `AGENTS.md` y `apps/web/AGENTS.md`. Base: specs 002, 003 y 004 (portada, animación con GSAP, ScrollTrigger y Lenis, presupuestos y tests).

## 0. Aprobaciones que pide este plan

1. **Dependencias nuevas: ninguna.** Todo con CSS, SVG en línea, un único `<canvas>` 2D nativo y las librerías ya instaladas (`gsap` 3.15.0 con `ScrollTrigger`, `lenis` 1.3.26). Alternativas descartadas con su peso en la sección 11 (D5, D6).
2. **Presupuestos nuevos** (sección 8), a confirmar con la medición de T1 y T2: JS total ≤ 100 KB gzip (antes 60), módulo de efectos ≤ 30 KB, código propio ≤ 45 KB, CSS ≤ 30 KB (antes 20), TBT de Lighthouse ≤ 300 ms (antes 200) y Rendimiento ≥ 92 como objetivo interno (el suelo sigue en 90). El cambio de `lighthouserc.cjs` y de `budget.spec.ts` solo se hace en T32 tras el OK.
3. **Tokens de color nuevos** (sección 7): cuatro colores de resplandor, valores propuestos y sujetos a los tests de luminancia y a la revisión visual.
4. **Criterio de legibilidad por píxeles (RF-8)** en lugar de "sin texto sobre degradados" (D3), con un plan B si la medición inicial lo desaconseja: paneles de color sólido tras el texto.
5. **Cohete de los originales: no usarlo** (D9); el indicador y la plataforma usan el isologo ya incluido.
6. **Emblemas de constelación** en el equipo (duda 3 de la spec) y los **textos nuevos** (tabla de la spec).

## 1. Visión general

- Siguen siendo dos páginas estáticas. Todo el contenido y todo el cielo (estrellas, polvo, ambientes, entrada del hero, planetas con vida) existen en HTML y CSS y funcionan **sin JavaScript** y se anulan con movimiento reducido (CSS bajo `@media (prefers-reduced-motion: no-preference)`).
- La **capa de efectos** (JS) solo añade lo que necesita estado o interacción: paralaje, estrellas fugaces, partículas, trayectoria de Mac, burbujas, indicador de viaje, salto en el espacio, rastro del cursor. Se descarga tras `load` + `LOAD_DELAY_MS` (como la 004), nunca con movimiento reducido, y por módulos: **núcleo** (el `home-motion.ts` actual), **efectos** (`fx/`, nuevo) y **Lenis** (como hoy, solo con puntero fino). El script de entrada sigue siendo lo único antes de `load` (≤ 3 KB).
- **Lógica en funciones puras** (principio 3): generación de estrellas con semilla, ambientes, luminancia máxima del cielo, clases de dispositivo, planificador de efectos, simulación de partículas, trayectoria de Mac, reacciones, progreso del viaje, constelaciones. Los componentes y los módulos del navegador solo pintan y llaman a esas funciones.
- **Nada del contenido inicial parte oculto** (principio de la 004, D14): la entrada del hero solo mueve y escala elementos que ya están visibles; solo las decoraciones puras pueden usar opacidad en `@keyframes` (lista permitida, sección 5).
- **Sin imágenes nuevas** (RNF-15) y sin dependencias (RNF-14). Los colores salen de `tokens.ts`.

## 2. Archivos y responsabilidades

### Lógica pura nueva (`apps/web/src/lib/`; sin DOM, GSAP, fecha ni `Math.random`: reciben el reloj y el generador por parámetro)

| Archivo                           | Funciones                                                                                                                                                                                                                                                                                         | RF                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `src/lib/sky/rng.ts`              | `mulberry32(seed)` (generador determinista), `pick(rng, list)`, `range(rng, min, max)`                                                                                                                                                                                                            | RF-1, RF-4, RF-27                 |
| `src/lib/sky/star-field.ts`       | `generateStarField(seed, count, { heightVh })` → `{ x (vw), y (vh), size, tone }[]`, `starsToBoxShadow(stars, palette)` (texto CSS), `STAR_LAYERS` (recuentos y profundidades), `STAR_TONES` (nombres de token)                                                                                   | RF-1, RF-9                        |
| `src/lib/sky/ambients.ts`         | `AMBIENTS` (tabla de las 7 zonas: token base, token de resplandor, token de polvo, alfas), `resolveAmbient(markerY, zones)`, `blendOver(base, glow, alpha)` (RGB lineal), `glowAlphaCap(base, glow, textHex, minRatio)`, `SKY_MAX_LUMINANCE`                                                      | RF-5, RF-6, RF-7, RF-8            |
| `src/lib/sky/parallax.ts`         | `scrollParallax(progress, layer)` → desplazamiento en vh, `pointerParallax(cursor, rect, depth, maxPx)` → { x, y }, `easeToRest(current, dt)`                                                                                                                                                     | RF-2, RF-13, RF-25                |
| `src/lib/sky/journey.ts`          | `journeyProgress(scrollY, docHeight, viewportHeight)` → 0..1, `visitedStops(progress, stops)`, `STOPS` (5 secciones)                                                                                                                                                                              | RF-30                             |
| `src/lib/sky/constellation.ts`    | `constellationOf(name)` → { stars: {x,y}[], edges: [a,b][] } (5 a 8 estrellas, semilla = nombre, sin cruces de aristas), `constellationPath(c, size)` → atributo `d` de SVG                                                                                                                       | RF-34                             |
| `src/lib/fx/device-tier.ts`       | `pickTier({ reduced, saveData, memoryGb, cores, coarse, widthRem })` → `off\|low\|mid\|high`, `TIER_PARAMS` (tabla de la sección 5), `tierDown(tier)`, `shouldDegrade(frameCosts, window=45, limitMs=12)`                                                                                         | RF-37, RF-38                      |
| `src/lib/fx/scheduler.ts`         | `shouldRun({ hidden, active, inView })`, `nextShootingStarDelay(rng, tier)`, `canSpawnShootingStar(active, tier)`, `needsFrame({ particles, effects })`                                                                                                                                           | RF-4, RF-39                       |
| `src/lib/fx/particles.ts`         | `createPool(max)`, `spawn(pool, kind, origin, velocity, rng, caps)`, `step(pool, dtMs)` (movimiento, vida, gravedad, desvanecimiento), `emitRate(kind, tier, speed)`, `capFor(tier)`                                                                                                              | RF-14, RF-23, RF-28, RF-29, RF-31 |
| `src/lib/fx/streaks.ts`           | `streakLines(count, velocity, viewport, rng)` → líneas del salto en el espacio con longitud ∝ velocidad, `jumpDurationMs(distance)` (≤ 900)                                                                                                                                                       | RF-31                             |
| `src/lib/fx/mac-path.ts`          | `curveBetween(from, to, side)` → { p0, p1, p2, p3 } (cúbica), `pointAt(curve, t)`, `angleAt(curve, t)`, `tiltFor(angleDeg)` (limitada a ±25), `flightMs(distance)` (0,7 a 1,6 s), `maxDeviation(curve)` (para los tests), `retarget(current, to, side)`                                           | RF-21, RF-22, RF-23               |
| `src/lib/fx/mac-reactions.ts`     | `lookAt(macCenter, cursor, { maxDeg: 6, maxPx: 8 })`, `pickLine(lines, lastIndex, rng)` (no repite), `isTurbo(clicks, now, { count: 5, windowMs: 3000, cooldownMs: 10000, lastTurbo })`, `idleDue(lastInteraction, now, 8000)`, `bubbleMs(rng)` (2000 a 2800), `LINE_KEYS` (claves por situación) | RF-25, RF-26, RF-27, RF-28, RF-29 |
| `src/lib/fx/fx-config.ts`         | Única fuente de las constantes de efectos: duraciones, rangos, límites, umbrales (como `motion-config.ts`)                                                                                                                                                                                        | todos                             |
| `src/lib/motion/motion-config.ts` | Se conserva; las constantes nuevas van en `fx-config.ts`                                                                                                                                                                                                                                          | —                                 |

### Estilos, componentes y páginas (`apps/web/src/`)

| Archivo                                                      | Responsabilidad                                                                                                                                                                                                                                                                                                            | RF                            |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `src/styles/tokens.ts` (+ tests)                             | Añade `planetHexawebGlow`, `planetRankiaGlow`, `planetAdaraGlow`, `earthGlow` (sección 7). Solo sintaxis borrable (D17 de la 004)                                                                                                                                                                                          | RF-5, RNF-12                  |
| `src/components/SkyBackdrop.astro`                           | Cielo fijo (`position: fixed; inset: 0; z-index: 0; pointer-events: none; aria-hidden`): base de color + 3 capas de estrellas (`box-shadow` generado en el build con `starsToBoxShadow`, lista larga y lista corta por ancho) + `data-star-count` en cada capa. Solo se incluye en la portada (prop `sky` de `BaseLayout`) | RF-1, RF-3, RF-9              |
| `src/layouts/BaseLayout.astro`                               | Prop `sky` (por defecto falsa: las 404 no cambian); el contenido de cada sección (no `main`) por encima del cielo (`.section__inner`, `position: relative; z-index: 1`); variables de ambiente                                                                                                                             | RF-5, RF-9                    |
| `src/components/home/HeroSection.astro`                      | Entrada del hero en CSS (Luna, envoltorio de Mac, llama, aura, órbita con cuerpo, destellos, escalón de textos), Mac en dos capas (`.hero__mac-wrap` para CSS y `.hero__mac` para GSAP), `data-mac-label`, datos de mensajes                                                                                               | RF-16 a RF-19, RF-26          |
| `src/components/CtaButton.astro`                             | Efecto de barrido, elevación, resplandor y pulsación bajo `no-preference`; variante `pulse` para contacto                                                                                                                                                                                                                  | RF-20, RF-35                  |
| `src/components/home/ServicesSection.astro`                  | Ambiente propio por bloque (base sólida + resplandores + fundido inferior), halo, planeta con flotación y rotación, órbita SVG y lunas (`data-moon`), envoltorio `.service__planet` (paralaje) separado de `.service__art` (aparición)                                                                                     | RF-5, RF-7, RF-10 a RF-12     |
| `src/components/home/ProjectsSection.astro`                  | Ambiente propio, tarjetas con borde cósmico (pseudo-elemento giratorio dentro de la tarjeta, panel interior sólido)                                                                                                                                                                                                        | RF-5, RF-33                   |
| `src/components/home/TeamSection.astro`                      | Ambiente propio, emblema de constelación SVG en línea por persona (`constellationPath`), "dibujo" al hover/foco                                                                                                                                                                                                            | RF-5, RF-34                   |
| `src/components/home/ContactSection.astro`                   | Ambiente propio, plataforma de lanzamiento decorativa (isologo vía `/favicon.svg`), pulso del botón; contenedor reservado para el formulario de la 006                                                                                                                                                                     | RF-5, RF-35                   |
| `src/components/SiteFooter.astro`                            | Horizonte de planeta, satélite orbitando y `footer.detail`, sobre fondo sólido                                                                                                                                                                                                                                             | RF-36                         |
| `src/components/HomeContent.astro`                           | Compone las secciones, `SkyBackdrop`, el script de entrada y el JSON de mensajes (`<script type="application/json" id="mac-lines">`, no ejecutable; se permite en `seo.spec.ts` junto a `application/ld+json`)                                                                                                             | RF-27, RF-43                  |
| `src/styles/sky.css.ts` (o bloques `<style>` por componente) | Reglas globales del cielo, ambientes, fundidos y `@keyframes` (todas bajo `no-preference`; la lista de keyframes con opacidad 0 permitida va en `src/styles/motion-css.ts`)                                                                                                                                                | RF-3, RF-5, RF-6, RF-9, RF-16 |
| `src/lib/translations.ts`, `src/lib/site-data.ts`            | Claves de la tabla de textos de la spec; `site-data.ts` añade `AMBIENT_ZONES` (id de sección → ambiente) y las lunas por planeta (`moons`)                                                                                                                                                                                 | RF-12, RF-43                  |

### Capa de efectos (JS diferido; `apps/web/src/scripts/`)

| Archivo                               | Responsabilidad                                                                                                                                                                                                                                                                                      | RF                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `src/scripts/motion-entry.ts`         | Sin cambios de comportamiento (≤ 3 KB): espera `load` + retardo, no descarga con movimiento reducido, `import()` del núcleo                                                                                                                                                                          | RNF-3                      |
| `src/scripts/motion/home-motion.ts`   | Núcleo actual. Pasa a: calcular la clase (`pickTier`) y, si no es `off`, hacer `import("../fx/fx-layer")`; el viajero usa `mac-path`; cleanup extendido (`gsap.matchMedia`). Escribe `data-fx-tier` en `<html>`                                                                                      | RF-21, RF-37, RF-40        |
| `src/scripts/fx/fx-layer.ts`          | Orquestador del módulo de efectos: crea el canvas, enlaza `ScrollTrigger`/scroll (paralaje, ambiente activo, progreso), `IntersectionObserver` (pausa de animaciones), `visibilitychange`, `matchMedia` de movimiento reducido (revertir), medición de coste y degradado. Devuelve `stop()`          | RF-2, RF-15, RF-37 a RF-41 |
| `src/scripts/fx/canvas.ts`            | Un solo `<canvas>` fijo (`pointer-events: none`, `aria-hidden`), límite de densidad y de 2 megapíxeles, bucle `requestAnimationFrame` **bajo demanda** (arranca al haber partículas o efectos, se detiene al vaciarse), dibujo por lotes (un `fillStyle` por color), `getContext` nulo = sin efectos | RF-39, RF-41, RNF-8        |
| `src/scripts/fx/shooting-stars.ts`    | Planificador con `nextShootingStarDelay` y dibujo de estrellas fugaces                                                                                                                                                                                                                               | RF-4                       |
| `src/scripts/fx/planet-fx.ts`         | Paralaje de ratón de planetas, crecimiento y chispas al entrar (puntero fino, clase media o alta)                                                                                                                                                                                                    | RF-13, RF-14               |
| `src/scripts/fx/mac-fx.ts`            | Viajero con trayectoria curva, inclinación, estela y rebote; mirada al cursor; saludo; ráfagas; turbo                                                                                                                                                                                                | RF-21 a RF-29              |
| `src/scripts/fx/bubbles.ts`           | Burbuja única de Mac (elemento creado por JS, `aria-hidden`, fondo sólido de token), lee el JSON de mensajes y usa `pickLine`/`bubbleMs`                                                                                                                                                             | RF-24, RF-26, RF-27        |
| `src/scripts/fx/journey.ts`           | Indicador de viaje (elementos creados por JS, `aria-hidden`), actualizado con transform                                                                                                                                                                                                              | RF-30                      |
| `src/scripts/fx/hyperjump.ts`         | Trazos del salto en el espacio durante el desplazamiento por ancla (escucha de clics en enlaces `#...` y velocidad desde Lenis o scroll)                                                                                                                                                             | RF-31                      |
| `src/scripts/fx/cursor-trail.ts`      | Rastro del cursor (clase alta, puntero fino)                                                                                                                                                                                                                                                         | RF-32                      |
| `src/scripts/motion/smooth-scroll.ts` | Sin cambios (fragmento aparte, solo con puntero fino); expone la velocidad para `hyperjump`                                                                                                                                                                                                          | RF-31                      |

### Pruebas

| Archivo                                                                   | Cambio                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/sky/*.test.ts`, `src/lib/fx/*.test.ts`                           | Vitest de cada función pura (sección 9)                                                                                                                                                                                                                                         |
| `src/styles/tokens.test.ts`, `contrast.test.ts`, `sky-luminance.test.ts`  | Tokens nuevos; luminancia máxima del cielo con `glowAlphaCap` para las 7 zonas                                                                                                                                                                                                  |
| `src/styles/motion-css.test.ts`                                           | La regla "ninguna regla oculta contenido" se afina: `opacity: 0` solo dentro de `@keyframes` de la lista permitida de decoraciones; el resto sigue prohibido; todo movimiento sigue bajo `no-preference`                                                                        |
| `e2e/pixel-contrast.ts` (ayudante)                                        | `textContrastByPixels(page, locator)`: oculta el texto del elemento (`color: transparent`, sin sombra), captura su caja, calcula la luminancia de cada píxel y devuelve el percentil 2 del contraste. Decodifica el PNG en la página con `createImageBitmap` (sin dependencias) |
| `e2e/sky.spec.ts` (nuevo)                                                 | Capas y recuentos, determinismo, ambientes sin JavaScript, fundidos (diferencia de píxeles en fronteras), contraste por píxeles de las 7 zonas en 375 y 1280, ES y EN                                                                                                           |
| `e2e/hero-entrance.spec.ts` (nuevo)                                       | Entrada sin JavaScript: estado a 0 s, mitad y final; muestreo por fotograma de opacidad y posición de textos; llama; duración total                                                                                                                                             |
| `e2e/fx.spec.ts` (nuevo)                                                  | Clases, paralaje, estrellas fugaces con reloj simulado, chispas, pausa, reposo sin fotogramas, movimiento reducido (carga y a mitad), código bloqueado, dibujo no disponible, `pointer-events`                                                                                  |
| `e2e/mac.spec.ts` (nuevo)                                                 | Trayectoria curva, inclinación, estela, rebote, mirada, saludo, burbujas, ráfaga, turbo                                                                                                                                                                                         |
| `e2e/motion.spec.ts`, `a11y.spec.ts`, `responsive.spec.ts`, `seo.spec.ts` | Se amplían: marcas nuevas, axe con efectos activos y lista de "incompletos" permitidos, 320/375/667×375 con burbujas e indicador, JSON no ejecutable permitido                                                                                                                  |
| `e2e/budget.spec.ts`                                                      | Presupuestos nuevos; tareas largas con CPU ×4 (CDP `Emulation.setCPUThrottlingRate`); coste por fotograma; FPS de la medición controlada; tope de elementos con `will-change`                                                                                                   |
| `lighthouserc.cjs`                                                        | **Propuesta (T32)**: TBT ≤ 300; Rendimiento `minScore` 0,92 (mediana) manteniendo 0,9 en las otras tres categorías                                                                                                                                                              |

## 3. Arquitectura de capas: qué va en CSS, SVG o canvas y por qué

| Elemento                                                       | Tecnología                                                                                                                | Por qué                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Estrellas (3 capas)                                            | CSS: un elemento por capa con lista de `box-shadow` (posición en `vw`/`vh`), generado en el build                         | Sin JavaScript, sin imagen (una imagen de fondo con `url()` puede ser candidata a LCP; un degradado o una sombra no), se rasteriza una vez y se mueve como capa del compositor. Alternativas: SVG como fondo (riesgo de LCP) o canvas estático (necesita JS) |
| Centelleo                                                      | CSS `@keyframes` de opacidad sobre la capa entera (3 duraciones)                                                          | Solo compositor; una animación por capa, no por estrella                                                                                                                                                                                                     |
| Polvo y nebulosas, ambientes por zona, fundidos                | CSS: varios `radial-gradient` y un `linear-gradient` de fundido en el fondo del propio bloque, sobre su color base sólido | Sin JavaScript; se mueven con la página (sin repintar); el color base sigue siendo el token (RF-7)                                                                                                                                                           |
| Parallax de estrellas                                          | JS: `transform` de las capas fijas en función del progreso de la página                                                   | Una escritura de `transform` por capa y fotograma de scroll                                                                                                                                                                                                  |
| Entrada del hero, flotación, rotación, halo, órbitas y lunas   | CSS: `@keyframes` de `transform`/`opacity` (opacidad solo en decoraciones) y `offset-path` para las lunas                 | Funciona antes de cargar JS y sin él; no depende del retardo de 1 s; no retrasa el LCP porque nada del contenido parte con opacidad 0                                                                                                                        |
| Paralaje de ratón de planetas, mirada de Mac, viajero          | JS (GSAP `quickTo` / `transform`) en envoltorios propios, para no pelear con las animaciones CSS                          | Una animación de CSS en marcha gana a un `transform` en línea: por eso cada cosa tiene su envoltorio                                                                                                                                                         |
| Partículas (estelas, chispas, ráfagas, fugaces, rastro, salto) | **Un único canvas 2D fijo**, bucle bajo demanda                                                                           | Cientos de partículas en el DOM serían cientos de nodos y capas; un canvas es una sola capa, dibuja por lotes y se detiene en reposo                                                                                                                         |
| Burbuja, indicador de viaje                                    | DOM creado por JS (decorativo, `aria-hidden`)                                                                             | Texto con fondo sólido de token, calculable por axe; el indicador es 2 elementos con `transform`                                                                                                                                                             |
| Emblemas de constelación, órbitas                              | SVG en línea generado en el build                                                                                         | Vectorial, sin petición, trazo animable con `stroke-dashoffset`                                                                                                                                                                                              |
| Bordes cósmicos de tarjetas                                    | CSS: pseudo-elemento con `conic-gradient` que **gira con `transform`** detrás de un panel sólido                          | Compositor; el panel sólido garantiza el contraste del texto. Alternativa descartada: `@property` con ángulo animado (repinta el degradado en cada fotograma)                                                                                                |

Orden de apilado: base del `body` y fondo de cada zona (bloques sin `z-index`) < cielo fijo (`z-index: 0`) < contenedores interiores de cada sección (`position: relative; z-index: 1`) < canvas de efectos (`z-index: 5`) < cabecera. Importante: ni `main` ni las secciones pueden crear un contexto de apilado (sin `z-index`, `transform`, `filter` ni `contain: paint` en ellos), o sus fondos se pintarían sobre el cielo; el `overflow-x: clip` que ya usan no lo crea. El color base sólido se pinta bajo las estrellas, así que las estrellas se ven sobre él.

## 4. Algoritmos

```
// sky/star-field.ts
generateStarField(seed, count, { heightVh }):
  rng = mulberry32(seed)
  repetir count: x = range(rng, 0, 100)  // vw
                 y = range(rng, 0, heightVh)  // vh (capa con overscan: 100 + 2 * rangoParallax)
                 size = pick(rng, tamaños de la capa)   // 1, 1.5, 2 px (lejana) ... 2, 3 px (cercana)
                 tone = pick(rng, [text, text, accentGreen, buttonHover, logoGradient1])  // nombres de token
  ordenar por (y, x) para que el resultado sea estable
starsToBoxShadow(stars, palette): "12.3vw 45.2vh 0 1px var(--color-text), ..."  // 2 decimales, sin hex

// sky/ambients.ts
blendOver(base, glow, a): mezcla en RGB lineal -> sRGB
glowAlphaCap(base, glow, textHex, minRatio):   // mayor a tal que contrast(textHex, blendOver(base, glow, a)) >= minRatio
  busqueda binaria sobre a en [0, 1] (20 pasos)
// El test comprueba para cada zona: alpha declarada <= glowAlphaCap con el peor texto de la zona (amarillo de acento)
// y luminancia(blend) <= SKY_MAX_LUMINANCE (0,12)

// sky/parallax.ts
scrollParallax(progress, layer):  (progress - 0.5) * 2 * layer.rangeVh      // rango: 4, 8, 16 vh  (la capa tiene overscan = rango)
pointerParallax(cursor, rect, depth, maxPx):  nx = clamp((cursor.x - centro.x) / (rect.width/2), -1, 1) (idem y)
                                               -> { x: -nx * maxPx * depth, y: -ny * maxPx * depth }

// fx/device-tier.ts
pickTier({ reduced, saveData, memoryGb, cores, coarse, widthRem }):
  si reduced: "off"
  si saveData o (memoryGb != null && memoryGb <= 2): "low"
  si coarse y widthRem < 48: "low"
  si coarse: "mid"
  si cores >= 8 y (memoryGb == null o memoryGb >= 8): "high"
  si cores >= 4: "mid"
  si no: "low"
shouldDegrade(costs, window, limitMs): costs.length >= window y media(ultimos window) > limitMs
// el degradado es de una sola dirección: tier = tierDown(tier); nunca sube

// fx/scheduler.ts
shouldRun({ hidden, active, inView }): !hidden && (active || inView)
needsFrame({ particles, effects }): particles > 0 || effects > 0       // en reposo, 0 fotogramas
nextShootingStarDelay(rng, tier): mid -> range(rng, 12000, 24000); high -> range(rng, 8000, 16000); low -> Infinity
canSpawnShootingStar(active, tier): active < (mid ? 1 : high ? 2 : 0)

// fx/particles.ts  (pool de tamaño fijo, sin asignaciones por fotograma)
spawn(pool, kind, origin, velocity, rng, caps):  si pool.alive >= caps.max: descartar la mas antigua de kind "trail" y, si no hay, no crear
step(pool, dtMs):  para cada viva: x += vx*dt; y += vy*dt; vy += g*dt; life -= dt; alpha = life / lifeMax; si life <= 0: liberar
emitRate(kind, tier, speed):  estela: {low: 8, mid: 20, high: 36} por segundo * min(1, speed / velocidadDeReferencia)

// fx/mac-path.ts
curveBetween(from, to, side):                       // side: lado hacia el que se curva (hacia el texto)
  d = dist(from, to); n = normal unitaria de (to - from) hacia side
  bend = max(0.14 * d, 48)                          // >= 12 % de la distancia (spec RF-21)
  p1 = from + (to - from) * 0.25 + n * bend * 1.3
  p2 = from + (to - from) * 0.75 - n * bend * 0.4   // curva en S suave
  return { p0: from, p1, p2, p3: to }
maxDeviation(curve): maximo sobre t en 0..1 (100 pasos) de la distancia perpendicular a la recta p0-p3   // el test exige >= 0,12 * d
tiltFor(angleDeg):  clamp(angleDeg * 0.35, -25, 25)  // sigue la tangente, suavizada
flightMs(d):        clamp(500 + d * 0.9, 700, 1600)
retarget(current, to, side):  curveBetween(posicionActual, to, side)      // sin saltos si cambia el planeta a mitad

// fx/mac-reactions.ts
lookAt(macCenter, cursor, { maxDeg, maxPx }): v = cursor - macCenter; k = min(1, |v| / 400);  { rotate: sign(v.x) * maxDeg * k, x: (v.x/|v|) * maxPx * k, y: (v.y/|v|) * maxPx * k }
pickLine(lines, lastIndex, rng): indice aleatorio distinto de lastIndex (si hay mas de uno)
isTurbo(clicks, now, opts): clicks recientes = filter(now - t <= windowMs); true si count >= 5 y (lastTurbo == null o now - lastTurbo >= cooldownMs)

// fx/fx-layer.ts (orquestacion; sin logica propia)
arranque: tier = pickTier(leer entorno);  si tier == off: return
  <html data-fx-tier=tier>, crear canvas (si getContext falla: continuar sin canvas), registrar observadores
  cada fotograma del bucle: t0 = performance.now(); actualizar y dibujar; costs.push(performance.now() - t0)
  si shouldDegrade(costs): tier = tierDown(tier); aplicar TIER_PARAMS; costs.clear()
informe: en el evento "fx:report" escribe en <html data-fx-frame-avg / data-fx-frame-p95 / data-fx-particles> (solo lo lee la prueba)
```

## 5. Estrategia de rendimiento

### Clases de dispositivo (`TIER_PARAMS`; fuente única de los límites, RF-37)

| Parámetro                                 | baja          | media                    | alta                    |
| ----------------------------------------- | ------------- | ------------------------ | ----------------------- |
| Capas de estrellas con paralaje de scroll | 0 (estáticas) | 2 (lejana y media)       | 3                       |
| Centelleo de capas                        | 1             | 3                        | 3                       |
| Densidad máxima del canvas                | 1             | 1,25                     | 1,5                     |
| Partículas simultáneas (máximo)           | 24            | 80                       | 160                     |
| Estrellas fugaces                         | no            | 1 a la vez, cada 12–24 s | 2 a la vez, cada 8–16 s |
| Estela de Mac (partículas por segundo)    | 8             | 20                       | 36                      |
| Chispas por planeta (simultáneas)         | n/a (táctil)  | 20                       | 40                      |
| Paralaje de ratón, mirada de Mac          | no            | sí                       | sí                      |
| Rastro del cursor                         | no            | no                       | ≤ 14 partículas         |
| Salto en el espacio (trazos máximos)      | no            | 40                       | 80                      |
| Lunas por planeta (animadas)              | 1             | 1 / 2 / 1                | 1 / 2 / 1               |
| Indicador de viaje, burbujas, viajero     | sí            | sí                       | sí                      |

Notas: la clase baja es el camino del móvil (sin Lenis, sin ratón); el cielo CSS y la entrada del hero son idénticos en todas, porque son CSS y su coste es de compositor. La clase se anota en `data-fx-tier` en `<html>`. Memoria y núcleos pueden no estar disponibles (Safari, Firefox): se tratan como "no limitan" salvo que el resto de señales digan lo contrario.

### Reglas de coste

- **Compositor**: solo `transform` y `opacity` en animaciones. Sin `filter: blur` animado. Los resplandores son degradados estáticos de fondo.
- **`will-change`**: solo en elementos que se animan de forma continua o en cada scroll: 3 capas de estrellas, el viajero, el canvas, la cohete del indicador y su trazo (≤ 8 a la vez; el límite de 10 lo vigila `budget.spec.ts`). Las animaciones CSS decorativas se promueven solas mientras corren; no se añade `will-change` a los planetas.
- **Pausa fuera de pantalla** (RF-15): un `IntersectionObserver` (margen 10 %) pone `data-offscreen` en cada bloque con animaciones y el CSS usa `[data-offscreen] * { animation-play-state: paused }`; las capas fijas del cielo siguen siempre porque siempre se ven.
- **Pestaña oculta** (RF-39): `visibilitychange` detiene el bucle y los planificadores; `html[data-fx-paused] * { animation-play-state: paused }`.
- **Reposo** (RF-39): el bucle de `requestAnimationFrame` solo corre mientras `needsFrame` sea verdadero (hay partículas o efectos). En reposo no hay ni un fotograma pedido por JS. Los temporizadores de estrellas fugaces y de reposo de Mac son `setTimeout`, no bucles.
- **Canvas**: tamaño de pantalla × densidad limitada (≤ 2 megapíxeles); se redimensiona solo en `resize` (con debounce); se limpia solo la región usada; partículas en un pool fijo (sin recolección de basura por fotograma); un `fillStyle` por lote de color.
- **Scroll**: un solo manejador pasivo reparte progreso a paralaje, ambiente activo, indicador y salto (no uno por módulo). Con Lenis, se engancha su evento de scroll.
- **Degradado adaptativo** (RF-38): coste medio de 45 fotogramas > 12 ms baja una clase. Nunca sube.
- **Carga**: tres módulos (`home-motion`, `fx-layer` y Lenis) tras `load` + 1 s; `fx-layer` se importa solo si la clase no es `off`. `modulepreload` no se usa (no se quiere competir con el LCP).
- **Entrada del hero en CSS**: arranca en el primer pintado sin esperar al JS; solo transforma y escala; la opacidad solo en las decoraciones de la lista permitida (halo, aura, destellos, llama, órbita). Mac y la Luna **empiezan dentro de la ventana** (p. ej. Mac con `translate(-12%, 22%) scale(.7) rotate(-14deg)`), porque un elemento fuera de la ventana no cuenta como candidato a LCP hasta que entra y el LCP se retrasaría. El h1 y los textos pueden empezar con `translateY(14px)` y llegar en escalón (0 a 0,5 s), siempre con opacidad 1.
- **LCP**: el elemento LCP debe seguir siendo el h1 o la imagen de Mac/Luna. El cielo no usa `url()`, y ninguna capa fija es una imagen.
- **CLS**: todo lo nuevo es `position: absolute/fixed` o `transform`; las alturas del arte del hero y de los bloques de planeta siguen reservadas.
- **Lista permitida de `opacity: 0` en `@keyframes`** (decoraciones puras, ninguna con texto): `hero-halo`, `hero-aura`, `hero-sparkle`, `hero-flame`, `orbit-ring`, `planet-halo-pulse`. El test falla si aparece en otro.

## 6. Ambientes por zona

Color base: siempre un token sólido (RF-7). Resplandor y polvo: degradados radiales de token con alfa limitada por `glowAlphaCap` (la alfa de la tabla es el tope de partida, el test la baja si hace falta). El fundido de cada zona es un degradado lineal de 10 rem del final de su base al color base de la siguiente.

| Zona      | Base (token)      | Resplandor (token)                                        | Polvo (token)              | Notas                                                                                   |
| --------- | ----------------- | --------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| Hero      | `bg`              | `logoGradient2` (naranja), detrás de la Luna, alfa ≤ 0,22 | `logoGradient4`, ≤ 0,12    | La columna de texto queda en zona tranquila (el resplandor está en la columna del arte) |
| Hexaweb   | `planetHexawebBg` | `planetHexawebGlow`, ≤ 0,30                               | `accentGreen`, ≤ 0,06      | Fundido desde el hero: `bg` a `planetHexawebBg`                                         |
| Rankia    | `planetRankiaBg`  | `planetRankiaGlow`, ≤ 0,30                                | `logoGradient4`, ≤ 0,08    |                                                                                         |
| Adara     | `planetAdaraBg`   | `planetAdaraGlow`, ≤ 0,28                                 | `logoGradient1`, ≤ 0,10    | El rojo es el que menos margen deja: el test fija su alfa                               |
| Proyectos | `bg`              | `earthGlow`, ≤ 0,22                                       | `planetRankiaGlow`, ≤ 0,10 | Tarjetas sobre panel sólido                                                             |
| Equipo    | `bgDark`          | `logoGradient3`, ≤ 0,20                                   | `logoGradient4`, ≤ 0,12    | Emblemas de constelación sobre tarjetas sólidas                                         |
| Contacto  | `bg`              | `logoGradient1` (amanecer desde abajo), ≤ 0,22            | `logoGradient2`, ≤ 0,10    | Reserva el hueco del formulario (006) sobre panel sólido                                |

`SKY_MAX_LUMINANCE = 0,12`: con el peor texto de la zona (amarillo de acento, luminancia ≈ 0,78) el contraste mínimo 4,5 exige una luminancia de fondo ≤ ≈ 0,134; se deja un margen. Las estrellas son puntos de ≤ 3 px: por eso el criterio de RF-8 usa el percentil 98 y no el máximo.

## 7. Tokens nuevos (único archivo con hex: `tokens.ts`)

| Token               | Valor propuesto | Papel                                              | Variable CSS                  |
| ------------------- | --------------- | -------------------------------------------------- | ----------------------------- |
| `planetHexawebGlow` | #1FB5C0         | Resplandor y halo de Hexaweb (verde azulado claro) | `--color-planet-hexaweb-glow` |
| `planetRankiaGlow`  | #5B6CFF         | Resplandor y halo de Rankia (azul índigo claro)    | `--color-planet-rankia-glow`  |
| `planetAdaraGlow`   | #FF7A45         | Resplandor y halo de Adara (naranja)               | `--color-planet-adara-glow`   |
| `earthGlow`         | #2E8BFF         | Resplandor de la zona de proyectos (azul Tierra)   | `--color-earth-glow`          |

Valores sujetos a la revisión visual y a los tests (no hay texto con esos colores: solo se pintan como degradados con alfa limitada). No contienen la palabra del cian provisional de la 002 (el test anti-cian sigue en verde). Se reutilizan: `text` y `accentGreen`, `buttonHover` y `logoGradient1` como tonos de estrella, y `logoGradient1` a `logoGradient4` en los ambientes.

## 8. Presupuestos y cómo se miden

| Concepto                                              | 004 (hoy)         | Propuesto                                | Cómo se mide                                                                                                                                                                                        |
| ----------------------------------------------------- | ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JS antes de `load` (gzip)                             | 1,1 KB (≤ 3 KB)   | ≤ 3 KB (sin cambio)                      | `budget.spec.ts`: respuestas JS antes de `load`                                                                                                                                                     |
| JS total (gzip, todos los módulos)                    | 52,6 KB (≤ 60 KB) | **≤ 100 KB**                             | Ídem, tras el retardo, con puntero fino (Lenis) y clase alta                                                                                                                                        |
| Módulo de efectos (gzip)                              | —                 | ≤ 30 KB                                  | `dist/_astro/` del chunk de `fx-layer`                                                                                                                                                              |
| Código propio (todo menos GSAP, ScrollTrigger, Lenis) | ~3,5 KB           | ≤ 45 KB                                  | Total menos el peso medido de las 3 librerías (49,1 KB, T16 de la 004)                                                                                                                              |
| Estimación del código nuevo                           | —                 | 15–20 KB                                 | Motor del canvas y partículas 4 KB; trayectoria y reacciones de Mac 3 KB; burbujas y mensajes 1,5 KB; salto, rastro y fugaces 3 KB; indicador y paralaje 2 KB; clases y orquestación 2–3 KB; margen |
| CSS (gzip, enlazado + en línea)                       | ≤ 20 KB           | **≤ 30 KB**                              | `budget.spec.ts`. Estimación: estrellas 4–5 KB (lista larga y corta), keyframes y ambientes 4–5 KB                                                                                                  |
| Imágenes al cargar y totales (móvil 375 px)           | ≤ 90 / ≤ 400 KB   | Sin cambio                               | `budget.spec.ts`                                                                                                                                                                                    |
| TBT (Lighthouse móvil, mediana de 3)                  | ≤ 200 ms (mide 0) | **≤ 300 ms**                             | `lighthouserc.cjs` (T32). Justificación: ~0,8 de la métrica TBT (30 % del Rendimiento) deja el global > 90; el valor lo confirma T2                                                                 |
| Rendimiento (Lighthouse móvil, mediana)               | ≥ 0,9             | ≥ 0,9 suelo; **≥ 0,92 objetivo interno** | `lighthouserc.cjs` (propuesta)                                                                                                                                                                      |
| Tareas largas con CPU ×4 (primeros 6 s de la capa)    | —                 | ≤ 300 ms de bloqueo                      | `budget.spec.ts` con CDP `Emulation.setCPUThrottlingRate(4)` y `PerformanceObserver` de `longtask` (independiente del momento en que Lighthouse deja de medir)                                      |
| Coste propio por fotograma (clase alta, CPU ×1)       | —                 | media ≤ 4 ms, p95 ≤ 10 ms                | Evento `fx:report` tras 6 s de desplazamiento automático                                                                                                                                            |
| Coste propio por fotograma (clase baja, CPU ×4)       | —                 | p95 ≤ 16 ms                              | Ídem                                                                                                                                                                                                |
| Intervalo entre fotogramas (1280×720, sin GPU)        | —                 | mediana ≤ 18 ms, p95 ≤ 34 ms             | `requestAnimationFrame` en la prueba; con 2 reintentos; tolerancia calibrada en T2; el dato real se confirma a mano en un móvil                                                                     |
| INP (interacciones de la prueba)                      | ≤ 200 ms          | ≤ 200 ms (sin cambio)                    | `budget.spec.ts` ampliada (turbo, ráfagas, salto)                                                                                                                                                   |
| Elementos con `will-change`                           | —                 | ≤ 10                                     | `budget.spec.ts` (consulta de estilos calculados)                                                                                                                                                   |

**Medición inicial (T1 y T2, antes de construir nada que se quede):** dos prototipos desechables (no se versionan; solo se anotan las cifras en la sección 12 de este plan): (T1) cielo CSS completo con 3 capas, 7 ambientes y texto encima: LCP (elemento candidato), CLS, Rendimiento y Accesibilidad de Lighthouse móvil, y si axe/Lighthouse penalizan el texto sobre degradados; (T2) módulo con el motor de canvas, partículas, paralaje y trayectoria: peso gzip, tareas largas con CPU ×4, coste por fotograma y Lighthouse con la capa cargada. Si algún presupuesto propuesto no se cumple se **para** y se vuelve al usuario con los datos (nunca se sube un límite en silencio, regla de la 004).

## 9. Estrategia de tests (comando: `pnpm test`; auditoría: `pnpm quality`)

- **Vitest (lógica, primero en rojo)**: cada archivo de `src/lib/sky/` y `src/lib/fx/` con sus casos límite. Destacan: determinismo de `generateStarField` (misma semilla, mismo resultado; recuentos de la spec), `starsToBoxShadow` sin hex; `glowAlphaCap` y la luminancia de las 7 zonas; `scrollParallax` en 0, 0,5 y 1; `pickTier` con tabla de casos (reducido, ahorro de datos, memoria ≤ 2, móvil, tableta, escritorio de 4, 8 y 16 núcleos, datos ausentes); `shouldDegrade` (44 fotogramas no, 45 sí, media justo en el límite); `step` de partículas (vida, desvanecimiento, pool lleno); `maxDeviation ≥ 0,12 d` para distancias de 100 a 1200 px; `tiltFor` limitado; `flightMs` en [700, 1600]; `retarget` continuo; `pickLine` sin repetición con 1, 2 y 3 mensajes; `isTurbo` (4 clics no, 5 en 3 s sí, 5 en 3,1 s no, enfriamiento); `journeyProgress` en 0, 1 y documento corto; `constellationOf` (5–8 estrellas, distinta para Joni, Samuel y Luigi, estable, sin aristas que se crucen); `needsFrame` y `shouldRun`.
- **Tokens y estilos**: `tokens.test.ts` (nuevos tokens), `no-loose-colors` (ningún hex fuera de `tokens.ts`), `no-cyan`, `motion-css.test.ts` afinado (lista permitida de `opacity: 0` en keyframes; todo movimiento bajo `no-preference`; nada de `filter: blur` en animaciones).
- **Playwright (`pnpm test`)**: los archivos nuevos de la sección 2, siempre en ES y EN y con las variantes: sin JavaScript, JavaScript bloqueado, movimiento reducido (carga y a mitad de visita), 320/375/667×375 y 1280. Para los tiempos (estrellas fugaces, reposo de Mac, enfriamiento del turbo) se usa `page.clock`; para la aleatoriedad, la semilla va por parámetro y se fija con un atributo de prueba solo cuando la URL lo pide (`?seed=`; sin él, semilla basada en la hora de la visita, solo para los efectos aleatorios).
- **Contraste por píxeles** (`pixel-contrast.ts`): para cada texto de las zonas con cielo, en 375 y 1280 y con movimiento reducido y con animación (canvas oculto, capas congeladas con una marca de prueba), percentil 2 del contraste ≥ 4,5 (≥ 3 en texto grande).
- **axe**: `a11y.spec.ts` ejecuta axe antes y después de recorrer la página con los efectos activos. Violaciones = 0; "incompletos" de `color-contrast` solo para elementos con `data-sky-text` (los textos sobre el cielo), cada uno cubierto por el test de píxeles.
- **Rendimiento**: `budget.spec.ts` (sección 8) y `pnpm quality`.
- **Visual**: cada bloque cierra con una tarea de revisión del usuario en staging (móvil y escritorio, con y sin movimiento reducido). El push lo hace el coordinador (`AGENTS.md`: ningún agente hace push ni despliega).

## 10. Mapa RF → parte del plan

| RF                  | Parte del plan                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| RF-1, RF-3, RF-9    | `sky/rng`, `sky/star-field`, `SkyBackdrop.astro`, CSS del cielo (T4, T9)                                                |
| RF-2                | `sky/parallax`, `fx-layer` (T4, T15)                                                                                    |
| RF-4                | `fx/scheduler`, `shooting-stars` (T5, T16)                                                                              |
| RF-5, RF-6, RF-7    | `sky/ambients`, tokens, `sky.css`, secciones (T3, T13)                                                                  |
| RF-8                | `glowAlphaCap`, `sky-luminance.test`, `pixel-contrast.ts` (T3, T8, T13)                                                 |
| RF-10, RF-11, RF-12 | `ServicesSection.astro` y CSS (T14)                                                                                     |
| RF-13, RF-14        | `parallax`, `particles`, `planet-fx` (T5, T15, T17)                                                                     |
| RF-15, RF-39        | `scheduler`, `fx-layer`, `canvas` (T5, T15, T16)                                                                        |
| RF-16, RF-17, RF-18 | `HeroSection.astro` y CSS (T10)                                                                                         |
| RF-19, RF-20        | Hero y `CtaButton.astro` (T11)                                                                                          |
| RF-21, RF-22        | `fx/mac-path`, `mac-fx` (T6, T19)                                                                                       |
| RF-23, RF-24        | `particles`, `mac-fx`, `bubbles` (T20)                                                                                  |
| RF-25, RF-26, RF-27 | `mac-reactions`, `mac-fx`, `bubbles` (T6, T21)                                                                          |
| RF-28, RF-29        | `mac-reactions.isTurbo`, `mac-fx` (T22)                                                                                 |
| RF-30               | `sky/journey`, `fx/journey` (T4, T24)                                                                                   |
| RF-31               | `fx/streaks`, `hyperjump` (T5, T25)                                                                                     |
| RF-32               | `cursor-trail` (T26)                                                                                                    |
| RF-33               | `ProjectsSection.astro` (T28)                                                                                           |
| RF-34               | `sky/constellation`, `TeamSection.astro` (T6, T29)                                                                      |
| RF-35, RF-36        | `ContactSection.astro`, `SiteFooter.astro` (T30)                                                                        |
| RF-37, RF-38        | `fx/device-tier`, `fx-layer` (T5, T15, T26)                                                                             |
| RF-40, RF-41, RF-42 | `fx-layer` (revertir y reducir), `canvas` (sin contexto), CSS (`pointer-events`), `motion-css.test` (T8, T15, T16, T32) |
| RF-43               | `translations.ts` y su test (T7)                                                                                        |

## 11. Decisiones técnicas (con la alternativa descartada)

- **D1. Cielo con listas de `box-shadow` generadas en el build, en 3 capas fijas.** Sin JS, sin imagen y de coste mínimo; determinista por semilla. Descartado: SVG de teselas como `background-image` (puede ser candidato a LCP y su entropía baja es una incógnita), canvas estático (exige JS y repinta al redimensionar) y un `radial-gradient` por estrella (CSS enorme).
- **D2. Ambiente de cada zona en el propio bloque (CSS), con color base sólido y fundido inferior.** Funciona sin JS y con movimiento reducido, no repinta al hacer scroll y conserva el test de color de la 004 (RF-7). Descartado: un fondo fijo que cambia de color con JS (algo visible dependería de JS y repintaría toda la pantalla) y bandas planas cortadas (justo lo que no se quiere).
- **D3. Texto sobre el cielo con criterio medido por píxeles (RF-8)**, con luminancia máxima del cielo comprobada por lógica y percentil 98 de píxeles en el test. axe marcará esos textos como "incompletos" (no puede calcular un fondo con degradados); se admite solo para `data-sky-text` y solo con el test de píxeles en verde. Descartado: paneles opacos tras todo el texto (seguro, pero devuelve la sensación de cajas; queda como **plan B** si T1 muestra que Lighthouse baja Accesibilidad o que el LCP se resiente) y desactivar la regla de contraste de axe (nunca).
- **D4. Entrada del hero en CSS puro, desde el primer pintado.** No espera al JS ni al retardo de 1 s, arranca con todo ya visible y no retrasa el LCP. Descartado: una línea de tiempo de GSAP (empezaría 1 s después de `load`: los elementos se verían colocados y luego saltarían) y el patrón "opacity 0 hasta que cargue" (rompe el LCP y la regla de la 004).
- **D5. Un único canvas 2D con bucle bajo demanda para todas las partículas.** Una capa, dibujo por lotes, 0 fotogramas en reposo. Descartado: partículas como nodos del DOM (cientos de capas) y una librería de partículas (p. ej. `tsparticles`, decenas de KB sin necesidad: lo que se necesita son ~4 KB propios).
- **D6. Trayectoria de Mac con curva cúbica propia (pura y testeable) y `gsap.to` sobre un progreso 0..1.** Descartado: `MotionPathPlugin` de GSAP (+≈ 9–10 KB gzip, y aun así hay que calcular la inclinación, la desviación y el reajuste a mitad de vuelo; la función pura permite probarlo con Vitest).
- **D7. Lunas con `offset-path` y `offset-distance` animados en CSS.** Órbita elíptica real sin distorsionar la luna, solo compositor y sin JS. Descartado: girar un contenedor (la luna se deforma al aplastar la elipse) y animarlas con GSAP (JS innecesario). Si el navegador no lo soporta, la luna se queda fija en su órbita (RF-41).
- **D8. Clase de dispositivo por señales declaradas más degradado por coste medido (RF-37, RF-38).** Barato y verificable. Descartado: medir la potencia con una prueba de arranque (consume justo cuando se quiere no consumir) y decidir solo por el ancho (un móvil bueno y un portátil flojo se tratan mal).
- **D9. Cohete de los originales: no usarlo.** Mac ya se ve sobre su nave y el isologo (cohete naranja, ya incluido y servido como `/favicon.svg`) hace de indicador y de plataforma, sin imagen nueva ni peso. Descartado: añadir la imagen del original (otro asset, manifiesto, licencia y peso). Si el usuario lo aprueba, se trataría como una tarea aparte.
- **D10. Bordes cósmicos con pseudo-elemento giratorio (`transform`) tras un panel sólido.** Compositor y contraste calculable. Descartado: `@property` con ángulo animado y `border-image` (repintan).
- **D11. Mensajes de Mac en un `<script type="application/json">` del HTML de cada idioma** (se leen cuando se necesitan). Mantiene los textos solo en `translations.ts` y evita meter los dos idiomas en el bundle. Descartado: importar `translations.ts` en el módulo (arrastra todo el diccionario) y atributos `data-` con JSON escapado (más ruido en el HTML).
- **D12. Cursor nativo siempre; el rastro es un efecto aparte.** Descartado: sustituir el cursor por una imagen (oculta el punto activo en algunos sistemas, limita el tamaño y es un riesgo de accesibilidad).
- **D13. Indicador de viaje decorativo y sin enlaces**, creado por JS. La navegación ya existe (RF-12 de la 004) y duplicarla sumaría enlaces repetidos. Descartado: paradas clicables (nombres accesibles duplicados y más superficie de pruebas).
- **D14. JS en tres módulos** (núcleo, efectos y Lenis), con tope por módulo. Solo se descarga lo que la clase de dispositivo usa. Descartado: un único bundle (más fácil, pero el móvil descargaría Lenis y los efectos pesados sin usarlos).
- **D15. Sin `localStorage` ni cookies** (RNF-16): el saludo "una vez por visita" se guarda en memoria. Descartado: recordar al visitante entre visitas.
- **D16. Paralaje de scroll por progreso de página con sobrante (overscan) en la capa**, no por módulo ni por teselas repetidas. Sin costuras y sin duplicar estrellas. Descartado: capas el doble de altas que se repiten con `mod` (el doble de sombras en el CSS).
- **D17. Mac en dos capas** (`.hero__mac-wrap` para CSS y `.hero__mac` para GSAP). Una animación CSS en marcha anula un `transform` en línea, así que la flotación y el aterrizaje no pueden compartir elemento con el gesto y la mirada. La misma regla vale para los planetas (`.service__art` aparición, `.service__planet` paralaje, `img` flotación).
- **D18. Emblemas de constelación por código y por nombre.** Únicos, deterministas y sin datos personales. Descartado: iniciales o avatares (la 004 no los quiere) y fotos.

## 12. Riesgos, plan B y medición inicial

| Riesgo                                                                                       | Plan B                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lighthouse (Accesibilidad) baja con texto sobre degradados, o axe da "incompleto" que cuenta | Paneles de color sólido tras el texto de hero y servicios ("ventanillas de cabina") y sin cambio de RF-8, o restricción del resplandor a zonas sin texto. Se decide en T1. |
| El cielo fijo o el canvas empeoran el LCP o el CLS                                           | Cielo sin `position: fixed` (una capa por zona), canvas creado más tarde, estrellas solo CSS                                                                               |
| TBT por encima de 300 ms al cargar `fx-layer`                                                | Dividir `fx-layer` en dos importaciones escalonadas (primero Mac y burbujas, después fugaces y rastro) y subir `LOAD_DELAY_MS` solo para clases altas                      |
| Paralaje de scroll con jank en iOS                                                           | Quedar solo con la capa lejana animada o desactivar el paralaje de scroll en táctil (la clase baja ya lo desactiva)                                                        |
| Los 100 KB se quedan cortos                                                                  | Parar y pedir al usuario un nuevo tope razonado con datos (máximo absoluto 150 KB)                                                                                         |
| La entrada del hero en CSS retrasa el LCP                                                    | Empezar los elementos en su pose final salvo la Luna y Mac, y reducir la secuencia                                                                                         |

**Resultados de la medición inicial:** T1 y T2 hechas (abajo).

### T1. Spike A, el cielo CSS (2026-10-12)

Prototipo desechable en el scratchpad (no versionado): copia de la `dist` de la 004 con 3 capas de estrellas de `box-shadow` (110/60/30 en escritorio y 40/22/10 por `@media`, semilla fija, centelleo de 7/11/15 s), 7 ambientes con degradados radiales y fundido de 10 rem sobre el color base sólido, texto encima y la entrada del hero en CSS (Luna y Mac dentro de la ventana, escalón de textos, llama y halo). Se conserva el JS de la 004. Lighthouse móvil con `chrome-headless-shell`, 3 ejecuciones por URL, y axe 4.13 en 1280 y 375 px.

| Medida (mediana de 3)          | Base 004  | Prototipo `/` y `/en/`                                   |
| ------------------------------ | --------- | -------------------------------------------------------- |
| Rendimiento                    | 100       | 100                                                      |
| Accesibilidad                  | 100       | **100**                                                  |
| Buenas prácticas / SEO         | 100 / 100 | 100 / 100                                                |
| LCP (simulado)                 | 1579 ms   | **1578 ms** (elemento: `img.hero__moon`, imagen de hero) |
| CLS                            | 0         | 0                                                        |
| TBT                            | 0 ms      | 0 ms                                                     |
| CSS gzip (enlazado + en línea) | 2,4 KB    | 6,0 KB (+3,7 KB; HTML +3,8 KB gzip)                      |

- **axe**: 0 violaciones en las 4 combinaciones (1280 y 375 px, ES y EN). Sí da **"incompleto" en `color-contrast`** (12 nodos, "background gradient": kicker, h1, lema, subtítulo y demás textos del hero). Lighthouse no lo cuenta: Accesibilidad sigue en 100 (`color-contrast` pasa con 0 elementos pendientes). Sin desbordamiento horizontal.
- **Contraste por píxeles** (percentil 2, texto oculto y captura de su caja, 76 textos a 1280 y 375 px, con movimiento reducido): todo texto que va directamente sobre el cielo sale **≥ 6,2:1** (el peor, "Desarrollo web" amarillo sobre Hexaweb, 6,24 en 375 px; proyectos y equipo ≥ 11,5). Los valores de 1,0 a 1,3 son artefactos del método (etiquetas y botones con relleno o borde propios, que la captura incluye): `pixel-contrast.ts` (T8) debe medir solo el interior sin borde y saltarse los elementos con fondo propio.
- Revisión visual (capturas 1280 y 375 px): estrellas visibles sobre el fondo, resplandores suaves, fundidos sin cortes, texto legible.

**Decisión (T1): continuar con el criterio por píxeles (D3). No se activa el plan B.** LCP 1,58 s (< 2,0 s) y Accesibilidad 100 (> 90). Consecuencias para las tareas: (1) los textos sobre el cielo llevan `data-sky-text` y se admite el "incompleto" de axe solo para ellos (T8, T13); (2) el helper de píxeles ignora bordes y fondos propios; (3) el cielo CSS cuesta ~3,7 KB gzip de CSS y ~3,8 KB de HTML, muy por debajo del tope de CSS de 30 KB (sin revisar presupuestos hasta T2).

### T2. Spike B, la capa de efectos (2026-10-12)

Prototipo desechable en el scratchpad (no versionado) sobre la portada del spike A (cielo CSS) más el JS de la 004: un módulo diferido (`import()` tras `load` + 1 s) con motor de canvas de bucle bajo demanda, pool de partículas (24/80/160 según clase), paralaje de scroll de 3 capas (2 en media, ninguna en baja), trayectoria cúbica con inclinación y estela, estrellas fugaces y borrado solo de la región usada. Prueba de 6 s con CPU ×1 y ×4 en `chrome-headless-shell` (1280×720, render por software, sin GPU): desplazamiento automático y, cada 300 ms, un vuelo, una estrella fugaz y una ráfaga de 45 partículas (el pool llega al tope de la clase: 160/80/24).

| Medida                                              | Resultado                                                                                       | Presupuesto            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| Módulo de efectos (gzip)                            | 2,6 KB (motor, pool, paralaje, trayectoria, fugaces)                                            | ≤ 30 KB                |
| JS total hoy (004 + prototipo, gzip)                | 52,8 + 2,6 = 55,4 KB                                                                            | ≤ 100 KB               |
| Estimación del código propio total con todos los RF | 3,5 + 15 a 20 KB = 19 a 24 KB; JS total ≈ 68 a 73 KB                                            | ≤ 45 KB / ≤ 100 KB     |
| Lighthouse móvil (mediana de 3, `/` y `/en/`)       | Rendimiento 100, Accesibilidad 100, Buenas prácticas 100, SEO 100; LCP 1579 ms; CLS 0; TBT 0 ms | ≥ 90; TBT ≤ 300 ms     |
| Bloqueo de tareas largas en los 6 s, CPU ×4         | 0 a 22 ms (alta 0 y 9 ms en total de la carga; media 11 ms; baja 15 ms de la carga)             | ≤ 300 ms               |
| Coste por fotograma, clase alta, CPU ×1             | media 0,07 a 0,12 ms, p95 0,2 ms                                                                | media ≤ 4, p95 ≤ 10    |
| Coste por fotograma, clase alta, CPU ×4             | media 0,53 ms, p95 0,8 ms                                                                       | (referencia)           |
| Coste por fotograma, clase baja, CPU ×4             | media 0,33 ms, p95 0,6 ms                                                                       | p95 ≤ 16 ms            |
| Intervalo entre fotogramas (1280×720, sin GPU)      | mediana 16,7 ms, p95 16,7 a 16,8 ms (en todas las clases y también con CPU ×4)                  | mediana ≤ 18, p95 ≤ 34 |
| CSS gzip (spike A: cielo, ambientes y entrada)      | 6,0 KB (enlazado + en línea)                                                                    | ≤ 30 KB                |

Notas y límites de la medición:

- Las cifras del módulo son de un prototipo que cubre el motor, el paralaje y la trayectoria; el resto del código (reacciones de Mac, burbujas, indicador, salto, rastro, clases) se estima con la tabla de la sección 8 (15 a 20 KB en total). Incluso el doble de esa estimación deja el JS total por debajo de 100 KB (≈ 93 KB).
- Lighthouse termina de medir antes del `load` + 1 s en el que entra el módulo, por eso su TBT sale 0 con la capa cargada o sin ella; la cifra que vigila la capa es el bloqueo de tareas largas con CPU ×4 (`budget.spec.ts`), y las dos quedan muy por debajo de 300 ms.
- El coste por fotograma mide solo el JS propio (actualizar y dibujar); el intervalo entre fotogramas incluye el pintado y la composición, y no se sale de los 16,7 ms de la pantalla.
- **Hallazgo para T16**: en reposo, con la capa de la 004 (GSAP + ScrollTrigger) ya cargada y ningún efecto en marcha, la página pide ≈ 128 `requestAnimationFrame` en 2 s (también en táctil, sin Lenis). El módulo de efectos no pide ninguno (su bucle se para al vaciarse), así que el criterio "≤ 2 llamadas en 2 s en reposo" (RF-39, T16) no se cumpliría por culpa del ticker de GSAP de la 004. T16 debe, antes de escribir el test, dormir el ticker de GSAP en reposo (`gsap.ticker.sleep()` y despertarlo al haber interacción o scroll) o acotar el test a lo que pide el módulo; se decide en esa tarea.

**Presupuestos de la sección 8: confirmados sin cambios** (JS total ≤ 100 KB, módulo de efectos ≤ 30 KB, código propio ≤ 45 KB, CSS ≤ 30 KB, TBT ≤ 300 ms, Rendimiento ≥ 90 como suelo y ≥ 92 como objetivo interno, coste por fotograma, tareas largas ≤ 300 ms, `will-change` ≤ 10). **Tolerancia de las pruebas de FPS:** se mantienen mediana ≤ 18 ms y p95 ≤ 34 ms con 2 reintentos (el prototipo da 16,7 / 16,8, con un margen de más del doble en el p95). La confirmación del usuario (duda abierta 4) la delega el coordinador en su criterio, al cumplirse todos los presupuestos propuestos.

## 13. Qué cambia en la spec 004 al cerrar

Solo lo que figura en la tabla "Cambios respecto a la spec 004" de la spec: RNF-5 (JS), RNF-4 (TBT), presupuesto de CSS, RF-38 (cláusula de contraste), RF-19 (nota del color base) y RF-8 (nota del emblema). Se anota con una línea de "modificado por la 005" en cada uno, sin reescribir la historia. También se actualizan `apps/web/AGENTS.md` (presupuestos, "Un fondo de color de la portada es siempre sólido", cielo, capa de efectos, clases de dispositivo) y `MEMORY.md`.
