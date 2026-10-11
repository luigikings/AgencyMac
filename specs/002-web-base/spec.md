# Spec 002 — Esqueleto de la web pública

Estado: aprobada

Depende de: spec 001 (base del monorepo). No se empieza hasta que 001 esté implementada.

## Contexto y objetivo

La web pública es la carta de presentación de AgencyMac y tiene que posicionar en español (mercado principal) y en inglés. Antes de escribir su contenido real hace falta un esqueleto que ya cumpla las reglas que no se pueden olvidar después: rutas por idioma, textos traducidos por clave sin huecos, página 404 real, SEO mínimo por página (título, descripción, canonical, hreflang) e identidad de marca (colores y tipografías) definida en un solo sitio, con contraste accesible y diseño responsive. Esta spec sustituye la página mínima de la spec 001 por ese esqueleto bilingüe, para que la fase 1 solo tenga que añadir contenido.

## Usuarios

- Visitantes de la web en español o en inglés (posibles clientes).
- Buscadores y lectores de pantalla.
- El equipo de desarrollo, que construirá la web real sobre este esqueleto.

## Historias de usuario

- HU-1. Como visitante, quiero ver la web en español o en inglés y cambiar de idioma con un enlace para leerla en mi idioma.
- HU-2. Como visitante que llega a una URL que no existe, quiero una página de error clara en mi idioma con un enlace al inicio.
- HU-3. Como buscador, quiero que cada página declare su idioma, su URL canónica y sus versiones alternativas para indexar la correcta en cada mercado.
- HU-4. Como diseñador del frontend, quiero los colores y tipografías de la marca definidos una sola vez para no repetir valores ni desviarme de la identidad.
- HU-5. Como visitante con baja visión o que navega con teclado, quiero buen contraste y foco visible para poder usar la web.

## Definiciones

- **Página equivalente**: la misma página en el otro idioma (`/` ↔ `/en/`).
- **Texto traducible**: todo texto visible o leído por buscadores o lectores de pantalla: contenido, título, meta descripción, `alt`, `aria-label` y texto de enlaces.
- **URL base**: `https://agencymac.com`.
- **Token de marca**: valor con nombre (color o familia tipográfica) definido en un único lugar y reutilizado desde ahí.

## Por qué estas páginas no son públicas todavía

Esta spec no despliega nada: las páginas solo se sirven en local y llevan texto provisional. Sitemap, robots.txt, Open Graph y JSON-LD se dejan para la spec de la web pública, donde se aplicará completo el principio 7 de la constitución. Lo que sí se exige aquí (idioma, canonical, hreflang, 404, contenido en HTML, Lighthouse ≥ 90) es la base que esa spec no tendrá que rehacer.

## Requisitos funcionales

Cada RF indica cómo se verifica. Los tests en navegador se ejecutan contra la build de producción servida en local (spec 001).

### Rutas e idiomas

- RF-1: EL SISTEMA sirve la página de inicio en español en `/` y en inglés en `/en/`; toda página ES va sin prefijo y su equivalente EN con el prefijo `/en/`. _Verifica: Playwright._
- RF-2: EL SISTEMA usa URLs en minúsculas que terminan en barra; CUANDO se pide `/en` sin barra, EL SISTEMA muestra la página EN o redirige a `/en/`, nunca un 404. _Verifica: Playwright._
- RF-3: EL SISTEMA no redirige ni cambia de idioma según el idioma del navegador del visitante. _Verifica: Playwright con navegador en inglés abriendo `/` y comprobando que sigue en español._
- RF-4: CUANDO se sirve una página, EL SISTEMA declara en el HTML su idioma real (`es` o `en`). _Verifica: Playwright._
- RF-5: EL SISTEMA muestra en la navegación de cada página un enlace visible a la página equivalente en el otro idioma, que funciona sin JavaScript. _Verifica: Playwright con JavaScript desactivado: abre `/`, comprueba el encabezado, cambia a EN y comprueba el encabezado en inglés._

### Traducciones

- RF-6: EL SISTEMA obtiene todo texto traducible de la web a partir de traducciones por clave, con un valor ES y otro EN para cada clave. _Verifica: Vitest sobre las traducciones + revisión de que no hay textos escritos a mano en las páginas._
- RF-7: SI una clave falta en un idioma o su valor está vacío, ENTONCES EL SISTEMA hace fallar los tests indicando la clave y el idioma. _Verifica: Vitest._

### Página 404

- RF-8: CUANDO se pide una URL inexistente sin prefijo `/en/`, EL SISTEMA responde con código HTTP 404 y la página de error en español; CUANDO la URL inexistente empieza por `/en/`, responde con 404 y la página de error en inglés. _Verifica: Playwright comprobando código y encabezado._
- RF-9: EL SISTEMA muestra en cada página 404 un único encabezado principal, un título en su idioma y un enlace al inicio de su idioma, sin enlace de cambio de idioma, sin canonical y sin hreflang. _Verifica: Playwright._
- RF-10: SI se pide una URL con mayúsculas (p. ej. `/EN/`), ENTONCES EL SISTEMA responde con la 404 que le corresponda en lugar de servir la página. _Verifica: Playwright._

### SEO mínimo por página (salvo 404)

- RF-11: EL SISTEMA incluye en cada página un título y una meta descripción en su idioma, distintos entre todas las páginas y entre idiomas; longitud orientativa de 50-60 caracteres para el título y 150-160 para la descripción. _Verifica: Playwright (presencia y unicidad); longitud por revisión, no bloquea._
- RF-12: EL SISTEMA incluye en cada página una URL canónica absoluta formada por la URL base y la ruta con barra final, idéntica en local y en producción. _Verifica: Playwright._
- RF-13: EL SISTEMA incluye en cada página enlaces alternativos `hreflang` absolutos para `es`, `en` y `x-default`, con `x-default` apuntando a la versión ES. _Verifica: Playwright._
- RF-14: EL SISTEMA incluye en cada página un único encabezado principal, jerarquía de encabezados sin saltos, estructura semántica (cabecera, navegación, contenido principal y pie) y todo su contenido en el HTML servido sin depender de JavaScript. _Verifica: Playwright con JavaScript desactivado._
- RF-15: EL SISTEMA nunca incluye `noindex` en ninguna página de la web. _Verifica: Playwright sobre todas las páginas._

### Marca

- RF-16: EL SISTEMA define los colores de la marca como tokens con nombre y papel: #1D003F fondo oscuro, #34006F fondo; #FFC300 botón y #FFE000 botón en hover/foco; #FF9D00, #FF6700, #FF5733 y #C70039 degradado del logo; #DAF7A6 acento verde claro; #00E5FF cian del logo (provisional). _Verifica: Vitest sobre los tokens._
- RF-17: SI aparece un color hexadecimal en los estilos o componentes de la web fuera del archivo de tokens, ENTONCES EL SISTEMA hace fallar los tests indicando el archivo. _Verifica: Vitest._
- RF-18: EL SISTEMA usa Lilita One 400 para los títulos y Lato 400 y 700 (sin cursiva) para el cuerpo, servidas en woff2 desde el propio sitio, sin peticiones a servicios externos de fuentes. _Verifica: Playwright comprobando que no hay peticiones de fuentes a otros dominios._
- RF-19: MIENTRAS cargan las tipografías de marca, EL SISTEMA muestra el texto con una fuente de respaldo, sin dejarlo invisible. _Verifica: auditoría `font-display` de Lighthouse en verde._
- RF-20: EL SISTEMA muestra todos los textos de la página de inicio y de las 404, en ES y EN, con contraste WCAG 2.1 AA frente a su fondo. _Verifica: Playwright con axe-core (regla de contraste) en inicio y 404, ES y EN._
- RF-21: CUANDO un elemento interactivo recibe el foco con el teclado, EL SISTEMA muestra un indicador de foco visible con contraste suficiente. _Verifica: manual con teclado en inicio y 404, ES y EN._
- RF-22: EL SISTEMA incluye un favicon provisional en SVG que usa un color de los tokens de marca. _Verifica: Playwright (el favicon declarado responde 200)._

### Responsive y calidad

- RF-23: EL SISTEMA se muestra sin desbordamiento horizontal ni texto cortado desde 320 px de ancho. _Verifica: Playwright a 320 y 375 px (ancho del documento ≤ ancho de la ventana) en inicio y 404, ES y EN; revisión visual a 375 px._
- RF-24: CUANDO el desarrollador ejecuta el comando de auditoría de calidad, EL SISTEMA audita `/` y `/en/` en perfil móvil con 3 ejecuciones y mediana, y falla si alguna de las 4 categorías baja de 90 en cualquiera de las dos. _Verifica: comando con código de salida._
- RF-25: EL SISTEMA supera la comprobación automática de accesibilidad (axe) sin infracciones en todas las páginas de la web, incluidas las 404, en ES y EN. _Verifica: Playwright con axe-core._

## Entregables

- E-1. Aviso de licencias de terceros con la licencia SIL Open Font License de Lilita One y Lato, incluido en el repo junto a las fuentes.
- E-2. AGENTS.md de la web actualizado: esquema de URLs, regla de traducciones por clave, tokens de marca como única fuente de colores y regla de añadir el cian definitivo cuando exista el archivo del logo.
- E-3. MEMORY.md actualizado al cerrar, con el cian marcado como provisional.

## Requisitos no funcionales

- RNF-1 (Calidad): Lighthouse móvil ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO en `/` y `/en/` (RF-24). Cuenta para el cierre.
- RNF-2 (Core Web Vitals): LCP ≤ 2,5 s y CLS ≤ 0,1 según la mediana de Lighthouse; cuentan para el cierre. INP ≤ 200 ms es orientativo y no bloquea, porque no se puede medir en laboratorio (se vigila el Total Blocking Time como indicador).
- RNF-3 (JavaScript): las páginas funcionan y muestran todo su contenido sin JavaScript; no se carga JS ni CSS innecesario que bloquee la carga.
- RNF-4 (Movimiento): si se añade cualquier transición, respeta `prefers-reduced-motion`.
- RNF-5 (Idiomas): todo texto traducible existe en ES y EN (RF-6, RF-7).
- RNF-6 (Dependencias): ninguna dependencia nueva respecto a la spec 001 sin justificarla en el plan y que la apruebe el usuario.

## Casos límite

- `/en` sin barra final (RF-2). `/EN/` o `/En/` en mayúsculas (RF-10).
- Navegador configurado en inglés que entra por `/` (RF-3).
- URL inexistente en ES (`/no-existe/`) y en EN (`/en/no-existe/`) (RF-8).
- Clave de traducción solo en un idioma o con valor vacío (RF-7).
- Color hexadecimal escrito a mano en un componente (RF-17).
- Tipografías que tardan o fallan al cargar (RF-19).
- JavaScript desactivado (RF-5, RF-14).
- Pantallas de 320 y 375 px (RF-23).
- En local, la canonical y los hreflang siguen apuntando a `https://agencymac.com` (RF-12, RF-13).

## Fuera de alcance

- Despliegue, Cloudflare, D1, Resend, dominio y DNS.
- Contenido real (servicios Hexaweb, Rankia y Adara, recorrido de la home, portfolio, formulario "Quiero despegar") y páginas legales (aviso legal, privacidad y cookies).
- Sitemap, robots.txt, Open Graph y JSON-LD: spec de la web pública.
- Logos e ilustraciones de planetas y de Mac; favicon definitivo.
- Valor definitivo del cian del logo.
- GSAP, ScrollTrigger, Lenis y Rive.
- Tercer idioma (neerlandés).

## Criterios de finalización

- Todos los RF verificados según su método: tests (Vitest y Playwright) y auditoría de calidad en verde; comprobaciones manuales de RF-21 y RF-23 (revisión visual) hechas y anotadas.
- LCP y CLS dentro de RNF-2 en la mediana de Lighthouse de `/` y `/en/`.
- Revisión visual en escritorio y a 375 px de inicio y 404, en ES y EN.
- Entregables E-1 a E-3 revisados.

## Decisiones de clarificación (para el plan)

- URLs: ES en `/`, EN en `/en/`, con barra final; `x-default` → ES; URL base `https://agencymac.com` también en local (RF-1, RF-2, RF-12, RF-13).
- Sin redirección automática por idioma del navegador (RF-3).
- Cian del logo: #00E5FF provisional, aproximado a petición del usuario porque no hay archivo original (RF-16).
- Tipografías autoalojadas en woff2 (Lilita One 400; Lato 400 y 700); Google Fonts descartado (RF-18).
- La 404 no lleva canonical, hreflang ni enlace de idioma (RF-9).
- Papel de los colores confirmado por el usuario, revisable más adelante (RF-16).
- Accesibilidad y contraste automáticos con @axe-core/playwright en todas las páginas, incluidas las 404 (RF-20, RF-25).

## Dudas abiertas

- Ninguna.
