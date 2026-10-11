# Spec 001 — Base del monorepo

Estado: implementada

## Contexto y objetivo

AgencyMac necesita una base sobre la que construir sus dos productos: la web pública (carta de presentación ante clientes, en ES y EN) y el Centro de Control (panel interno). Hoy el repositorio está vacío. Esta spec deja el repo listo para trabajar con seguridad: las dos aplicaciones arrancan como esqueletos mínimos, las herramientas de calidad (lint, formato, tests de lógica, tests en navegador y auditoría Lighthouse) funcionan con un ejemplo en verde, y el repositorio, que es público y sirve de portfolio, queda saneado antes del primer commit y explica qué se puede reutilizar y qué no. El esqueleto completo de la web (idiomas, SEO mínimo y marca) va en la spec 002, que depende de esta. Merece la pena porque todas las specs siguientes dependen de ella y porque la constitución exige tests primero y Lighthouse ≥ 90 desde el principio.

## Usuarios

- El equipo de desarrollo de AgencyMac y los agentes de IA que trabajan en el repo.
- Visitantes del repositorio público (posibles clientes, reclutadores) que lo ven como portfolio.

## Historias de usuario

- HU-1. Como desarrollador, quiero instalar, arrancar, compilar y verificar ambas aplicaciones desde la raíz para empezar a trabajar sin configuración manual.
- HU-2. Como desarrollador, quiero un comando de tests y otro de auditoría de calidad que fallen con código de salida distinto de cero para saber si algo se ha roto.
- HU-3. Como agente de IA, quiero un AGENTS.md por aplicación con sus reglas y comandos para trabajar en cada una sin romper la otra.
- HU-4. Como visitante del repositorio, quiero un README y una licencia que dejen claro qué es el proyecto y qué puedo reutilizar.
- HU-5. Como responsable del repo, quiero que ningún secreto, ruta local ni enlace privado llegue al historial público.

## Definiciones

- **Esqueleto**: aplicación mínima que arranca y muestra una página provisional, sin contenido real ni funcionalidad de negocio.
- **Página mínima de la web**: única página de la web en esta spec, que existe solo para que los tests en navegador y Lighthouse tengan algo que medir. La sustituye la spec 002.
- **Build servida en local**: la versión de producción compilada y servida en la máquina del desarrollador (no un despliegue).
- **Modo CI**: ejecución con la variable de entorno `CI` definida.
- **Primer commit**: el primer commit posterior al inicial ya existente que añade el contenido del proyecto (AGENTS.md, MEMORY.md, docs/, specs/, apps/...).

## Por qué las páginas de esta spec no son públicas

Nada se despliega en esta spec: las páginas solo existen en local. Por eso sitemap, robots.txt, Open Graph y JSON-LD quedan para la spec de la web pública, donde se aplicará completo el principio 7 de la constitución. Aun así, la página mínima ya debe superar Lighthouse ≥ 90 para que el listón esté activo desde el principio.

## Requisitos funcionales

Cada RF indica cómo se verifica.

### Estructura y herramientas

- RF-1: CUANDO el desarrollador ejecuta el comando de instalación en la raíz de un clon limpio, EL SISTEMA instala las dependencias de ambas aplicaciones sin pasos adicionales. _Verifica: comando con código de salida 0._
- RF-2: SI la versión de Node no cumple `>=24 <25`, ENTONCES EL SISTEMA hace fallar la instalación con un error que indica la versión esperada. _Verifica: manual, instalando con otra versión de Node._
- RF-3: EL SISTEMA fija una versión exacta de pnpm; SI se instala con otro gestor de paquetes, ENTONCES la instalación falla indicando que se use pnpm. _Verifica: manual, ejecutando la instalación con npm._
- RF-4: CUANDO el desarrollador ejecuta el comando documentado de instalación del navegador de tests, EL SISTEMA descarga el Chromium de Playwright, que usan tanto los tests en navegador como Lighthouse. _Verifica: comando con código de salida 0._
- RF-5: CUANDO el desarrollador ejecuta el comando de compilación en la raíz, EL SISTEMA genera la versión de producción de ambas aplicaciones sin errores ni advertencias originadas en el código del proyecto (las advertencias de dependencias de terceros no bloquean). _Verifica: comando con código de salida 0 y revisión de la salida._
- RF-6: CUANDO el desarrollador ejecuta el comando de lint en la raíz, EL SISTEMA analiza el código TypeScript, Astro y React de ambas aplicaciones y termina con 0 errores y 0 advertencias. _Verifica: comando con código de salida 0._
- RF-7: CUANDO el desarrollador ejecuta el comprobador de formato en la raíz, EL SISTEMA termina con error si algún archivo no respeta el formato acordado. _Verifica: comando; manual, desformateando un archivo y comprobando que falla._

### Arranque en desarrollo

- RF-8: CUANDO el desarrollador ejecuta el comando de arranque de la web en la raíz, EL SISTEMA sirve la página mínima de la web en local. _Verifica: manual en el navegador._
- RF-9: CUANDO el desarrollador ejecuta el comando de arranque del Centro de Control en la raíz, EL SISTEMA sirve su página provisional en local. _Verifica: manual en el navegador._

### Página mínima de la web

- RF-10: EL SISTEMA sirve en `/` una página con idioma declarado `es`, viewport para móvil, título, meta descripción y un único encabezado principal con el texto "AgencyMac", todo presente en el HTML servido sin depender de JavaScript. _Verifica: Playwright con JavaScript desactivado._

### Centro de Control

- RF-11: CUANDO se abre el Centro de Control, EL SISTEMA muestra el encabezado "Centro de Control", con toda su interfaz solo en español por ser de uso interno. _Verifica: Playwright._
- RF-12: EL SISTEMA marca todas las páginas del Centro de Control como no indexables mediante la etiqueta meta robots `noindex` (no mediante robots.txt). _Verifica: Playwright._

### Verificación

- RF-13: CUANDO el desarrollador ejecuta el comando de tests en la raíz, EL SISTEMA ejecuta los tests de lógica de ambas aplicaciones y los tests en navegador, y termina con código distinto de cero si alguno falla. _Verifica: comando; manual, rompiendo un test y comprobando el código de salida._
- RF-14: EL SISTEMA incluye en cada aplicación al menos un test de lógica de ejemplo en verde. _Verifica: comando de tests._
- RF-15: EL SISTEMA ejecuta los tests en navegador contra la build de producción servida en local, con el Chromium de Playwright, levantando el servidor por su cuenta si no está arrancado. _Verifica: comando de tests con las apps paradas._
- RF-16: SI al lanzar los tests ya hay un servidor escuchando en el puerto previsto, ENTONCES EL SISTEMA lo reutiliza en local y falla con un mensaje claro en modo CI. _Verifica: manual, con un servidor arrancado, con y sin `CI`._
- RF-17: CUANDO el desarrollador ejecuta el comando de auditoría de calidad (separado del de tests), EL SISTEMA compila la web, la sirve en local, audita `/` con Lighthouse en perfil móvil 3 veces, toma la mediana y termina con código distinto de cero si Rendimiento, Accesibilidad, Buenas prácticas o SEO bajan de 90. _Verifica: comando con código de salida._
- RF-18: SI el Chromium de Playwright no está instalado, ENTONCES los comandos de tests y de auditoría fallan con un mensaje que indica el comando de instalación del navegador. _Verifica: manual._
- RF-24: EL SISTEMA supera la comprobación automática de accesibilidad (axe) sin infracciones en la página mínima de la web. _Verifica: Playwright con axe-core._

### Repositorio público y saneamiento

- RF-19: EL SISTEMA excluye del control de versiones: `.env` y todas sus variantes salvo `.env.example`, `.dev.vars`, `.claude/settings.local.json`, dependencias instaladas, compilaciones, informes de tests y de Lighthouse, y el archivo local de notas privadas de RF-21. _Verifica: `git check-ignore` sobre una ruta de ejemplo de cada tipo._
- RF-20: SI se crea un `.env`, `.env.local` o `.dev.vars` en la raíz o dentro de una aplicación, ENTONCES `git status` no lo muestra; un `.env.example` sí se puede versionar. _Verifica: manual con archivos de prueba._
- RF-21: CUANDO se prepara el primer commit, EL SISTEMA ya no contiene la URL de Notion en MEMORY.md; esa URL se guarda en un archivo local ignorado por git. _Verifica: `git grep` sin resultados para "notion.site" en los archivos preparados y `git check-ignore` sobre el archivo local._
- RF-22: EL SISTEMA versiona la configuración de servidores MCP sin rutas absolutas de la máquina local; la ruta del navegador se toma de una variable de entorno o se omite. _Verifica: revisión del archivo y `git grep` sin rutas como `C:\`._
- RF-23: CUANDO se prepara el primer commit, ningún archivo versionado contiene claves, tokens, rutas absolutas locales, datos de contacto personales ni la URL de Notion. _Verifica: `git grep` sobre los archivos preparados con patrones de rutas (`C:\`, `/Users/`), `notion.site`, `@` de correos personales y `.env`._

## Entregables

Documentos que se verifican por revisión en los criterios de finalización.

- E-1. Licencia MIT del código con titular "© 2026 AgencyMac", en un archivo que GitHub detecte como MIT.
- E-2. Archivo aparte de reserva de marca que reserva todos los derechos sobre la marca AgencyMac, la mascota Mac (nombre e imagen), los logos, las ilustraciones (planetas y Mac) y los textos de marca, e indica que la licencia MIT no los cubre.
- E-3. README en español, para portfolio: qué es AgencyMac, las dos aplicaciones, tecnologías, estructura del repo, cómo instalar (incluida la instalación de Chromium), arrancar, ejecutar tests y la auditoría, y resumen de las licencias. Sin datos de contacto personales.
- E-4. AGENTS.md de la web: propósito, stack, comandos y reglas (SEO, ES/EN, rendimiento, contenido en HTML, `prefers-reduced-motion`, nunca `noindex` en la web pública).
- E-5. AGENTS.md del Centro de Control: propósito, stack, comandos y reglas (interfaz solo ES, `noindex`, datos sensibles nunca en el repo ni en logs, nunca se despliega sin Cloudflare Access).
- E-6. AGENTS.md raíz con la sección Comandos completa (instalar, instalar Chromium, arrancar cada app, tests, auditoría, lint, formato y build) y la regla: si una app necesita variables de entorno, se añade un `.env.example` sin valores reales.
- E-7. MEMORY.md actualizado: sin la URL de Notion, con los permisos de Metal Renova y Magnar WarGames como concedidos (ya pueden figurar en el portfolio) y con el estado al cerrar la spec.

## Requisitos no funcionales

- RNF-1 (Calidad): Lighthouse móvil ≥ 90 en las 4 categorías sobre la página mínima (RF-17). Cuenta para el cierre.
- RNF-2 (Seguridad): ningún secreto, dato de contacto o de cliente, ruta local ni enlace privado en el repo ni en su historial.
- RNF-3 (Idiomas): código, nombres y comentarios en inglés; README, AGENTS.md y documentación en español. La página mínima no muestra más texto visible que la marca "AgencyMac", que es igual en ES y EN; el esqueleto bilingüe llega con la spec 002.
- RNF-4 (Dependencias): solo las aprobadas (pnpm, Astro, React, Vite, Vitest, Playwright, @axe-core/playwright, Lighthouse CI, ESLint con sus configuraciones oficiales para TypeScript, Astro y React, y Prettier). Cualquier otra se justifica en el plan y la aprueba el usuario.
- RNF-5 (Coste): ninguna herramienta ni servicio de pago.
- RNF-6 (Plataforma): todos los comandos funcionan en Windows (el entorno del desarrollador) y en Linux. No se depende de Edge ni de Chrome instalados en el sistema.

## Casos límite

- Node 22 o 25 instalado (RF-2). Instalar con npm o yarn (RF-3).
- Chromium de Playwright sin instalar (RF-18). Solo Edge instalado en el sistema: los tests siguen funcionando con Chromium de Playwright (RF-4, RNF-6).
- Lanzar los tests sin arrancar las apps (RF-15) o con un servidor ya arrancado en el puerto (RF-16).
- JavaScript desactivado: la página mínima muestra igual su contenido (RF-10).
- `.env` creado en la raíz o dentro de una aplicación (RF-20).
- Un test o la auditoría fallan: el comando termina con error (RF-13, RF-17).
- Puntuación de Lighthouse que oscila alrededor de 90 entre ejecuciones: decide la mediana de 3 (RF-17).

## Fuera de alcance

- Despliegue de cualquier tipo, previews por rama y CI en la nube.
- Cloudflare (Pages/Workers), D1, Cloudflare Access, Resend, dominio y DNS.
- Idiomas, 404, SEO mínimo, tokens de marca, tipografías y favicon de la web: spec 002.
- Contenido real de la web, páginas legales (aviso legal, privacidad y cookies), sitemap, robots.txt, Open Graph y JSON-LD: spec de la web pública.
- GSAP, ScrollTrigger, Lenis y Rive.
- Funcionalidad del CRM, autenticación y diseño del Centro de Control.
- Auditoría Lighthouse del Centro de Control.

## Criterios de finalización

- Todos los RF verificados según su método: comandos de tests, auditoría, lint, formato y build en verde desde la raíz en Windows; comprobaciones manuales de RF-2, RF-3, RF-8, RF-9, RF-16, RF-18 y RF-20 hechas y anotadas.
- Comprobaciones `git grep` y `git check-ignore` de RF-19 a RF-23 sin hallazgos antes del primer commit.
- Entregables E-1 a E-7 revisados; GitHub detecta la licencia como MIT tras subirla.
- MEMORY.md actualizado al cerrar.

Cierre (2026-10-11): validación con VEREDICTO: APROBADO (todos los RF y E-1 a E-7). Vitest 28 tests, Playwright 5 tests y Lighthouse 100 en las 4 categorías, en verde. Queda solo comprobar que GitHub detecta la licencia MIT tras el primer push.

## Decisiones de clarificación (para el plan)

- Licencia: MIT para el código + archivo aparte de reserva de marca; titular "© 2026 AgencyMac" aunque la empresa aún no esté dada de alta (E-1, E-2).
- Node 24 LTS (`>=24 <25`) con instalación estricta (error, no aviso); pnpm en versión exacta (RF-2, RF-3).
- Centro de Control con React + Vite; interfaz solo en español (RF-9, RF-11).
- Navegador de tests: Chromium de Playwright, compartido con Lighthouse; no se depende de Edge (RF-4).
- Lint con ESLint (configuraciones oficiales TS, Astro y React) + Prettier, aprobados como dependencias (RF-6, RF-7).
- La configuración MCP se versiona sin la ruta local de Edge; `.claude/settings.local.json` se ignora (RF-19, RF-22).
- La URL de Notion sale de MEMORY.md a un archivo local ignorado; los permisos de Metal Renova y Magnar están concedidos (RF-21, E-7).
- README en español; Centro de Control con `noindex` (E-3, RF-12).
- Accesibilidad automática con @axe-core/playwright, aprobada como dependencia (RF-24).
- Página mínima: solo "AgencyMac" visible y meta descripción en español, confirmado por el usuario (RF-10, RNF-3).

## Dudas abiertas

- Ninguna.
