# MEMORY.md — AgencyMac

Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual

- 001-base, 002-web-base y 003-deploy-staging cerradas: monorepo pnpm (`apps/web` Astro, `apps/control` React + Vite), inicio y 404 ES/EN con SEO base, CI en GitHub Actions y staging automático en el Worker `agencymac-staging` (`*.workers.dev`, noindex; `docs/staging.md`).
- 004-web-portada cerrada (2026-10-12): portada real (hero, 3 servicios, proyectos, equipo, contacto), marca, SEO y capa de animación diferida.
- 005-portada-espacial implementada y validada (VEREDICTO: APROBADO, vuelta 2, 2026-10-20), aún `aprobada`: cielo con 3 capas de estrellas y 7 ambientes, planetas con vida, hero cinematográfico, Mac protagonista, microinteracciones, clases de dispositivo y capa de efectos. Bloques R1–R5 aprobados en staging. Vitest 1477, Playwright 740; Lighthouse 1/1/1/1, TBT 0; JS 52,6 KB gzip (1,1 KB antes de `load`).
- Referencias: Notion de la agencia (URL privada en `MEMORY.local.md`, ignorado). Portfolio: chatarreriametalrenova.es y magnarwargames.com (permisos concedidos).

## Decisiones (y por qué)

- Astro (HTML estático, SEO y velocidad); Next.js descartado por enviar más JS. Cloudflare (Workers, D1, Access) en vez de Vercel: su plan gratuito no permite uso comercial. Objetivo: 0 €.
- Centro de Control aparte (control.agencymac.com) tras Cloudflare Access; CRM en D1 propio, no Notion. Repo público: MIT para el código, `LICENSE-BRAND.md` reserva marca, Mac e ilustraciones.
- Node 24 (fnm) y pnpm 12 (corepack), `engineStrict`; versiones exactas sin `^` y nunca publicadas el mismo día. `.gitattributes` fuerza LF; Playwright y Lighthouse usan `chrome-headless-shell`.
- i18n propio (funciones puras); tokens como única fuente de hex; fuentes woff2 autoalojadas con su OFL; servidor local propio (`serve-static.mjs`) que imita Workers static assets.
- 003: despliega solo GitHub Actions; secretos en el entorno "staging" restringido a main; la URL nunca se imprime ni se versiona; `noindex` solo en `.staging/`.
- GSAP con licencia "Standard no charge" (comercial gratis); su `@license` se conserva con `comments: { legal: true }`. Contenido siempre en el HTML: el JS solo oculta bloques bajo el pliegue. CTA a `#contact` hasta la spec 006.
- 005, D19: fuera ScrollTrigger (su bucle interno no se apaga y rompía el reposo: ≤ 2 rAF en 2 s); aparición con `IntersectionObserver`, scroll con un manejador único y Lenis en bucle bajo demanda. GSAP se mantiene. Ningún `gsap.ticker.add`.
- 005: el texto puede ir sobre el cielo; la legibilidad se mide por píxeles (AA en el 98 %) y el resplandor se baja si no cabe. Clases de dispositivo con `TIER_PARAMS` como única fuente; sus límites de CSS salen de `tier-css.ts` y nunca ocultan nada (sin JS, la página completa).
- 005: el TBT de Lighthouse no ve la capa diferida (llega tras el TTI); la vigila la prueba de tareas largas con CPU ×4 (opción a del usuario, T32).

## Aprendizajes y errores a evitar

- Chromium no resuelve `offset-path: ellipse()` en % hasta un cambio de estilo posterior: la pose quieta va con `left`/`top` y el `offset-path` solo con movimiento.
- La caja de un elemento inclinado (`rotate`) es mayor que el elemento: un test de posición sobre ella pasa en vacío. Medir sin la inclinación y comprobar contra la geometría real, y verlo en rojo forzando el fallo.
- `autoSleep` de GSAP cuenta fotogramas, no tiempo: con la CPU cargada tardaba segundos (ahora 6 fotogramas).
- Los tests que miden tiempo van al proyecto aislado `web-latency`: con otros workers las cifras se disparan (tareas largas de T32: 171–455 ms con otros workers, 0–70 ms a solas).
- `gsap.matchMedia` con el breakpoint como condición subía la página al girar el móvil. El CSS de Lenis se inyecta con `?inline`.
- En agentes, `cmd.exe` no atraviesa la junction de fnm: anteponer al PATH la ruta real de Node. Windows: procesos huérfanos en los puertos y `workerd.exe` en el 8787: `taskkill /PID <pid> /T /F`.
- `no-leaks` revisa también specs y docs: escribir siempre `<subdominio>`, nunca `NOMBRE_SECRETO=valor`, URLs privadas, rutas locales ni datos personales.
- Tests con reloj inyectado: el reloj debe avanzar también en rojo, o el bucle de reintentos se cuelga.

## Próximos pasos

- Cerrar la 005 tras la revisión final del usuario; después, formulario de contacto (spec 006) y páginas de servicio (spec 007); más adelante Centro de Control v1 con el CRM e integraciones. Blog SEO más adelante.

## Pendientes del usuario

- 005: revisar staging desde el móvil real (con y sin movimiento reducido; mirar el salto de la 2.ª luna de Rankia en clase baja) y aprobar por escrito los textos y R1–R5; solo entonces pasa a `implementada`. Dudas abiertas 1 (referencias visuales) y 2 (cohete de los originales).
- Comprobaciones manuales pendientes de 002/004: recorrido con Tab, enlaces de proyecto, Ctrl+F y scroll con Lenis.
- Renovar el token de Cloudflare antes de que caduque (fecha anotada en privado; `docs/staging.md`).
- Alta legal (empresa o autónomo) ANTES de lanzar en agencymac.com; correo y WhatsApp de empresa; paquetes y precios (propuesta pendiente de Joni). Migrar el DNS (hoy en Vercel) a Cloudflare al lanzar.
