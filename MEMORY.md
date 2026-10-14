# MEMORY.md — AgencyMac

Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual

- 001-base (d81ca25): monorepo pnpm con `apps/web` (Astro) y `apps/control` (React + Vite). Comandos en `AGENTS.md`.
- 002-web-base (72fc218): inicio y 404 en ES (`/`) y EN (`/en/`), tokens de marca, fuentes autoalojadas, SEO base, axe limpio, Lighthouse 100. (El cian provisional del logo se eliminó en la 004: la marca no lo usa.)
- 003-deploy-staging cerrada (2026-10-11): CI en GitHub Actions en cada push y PR a main; staging activo en el Worker `agencymac-staging` (`*.workers.dev`, noindex), con despliegue automático y smoke test real en cada push a main en verde. Alta y comportamiento en `docs/staging.md`. Vitest 407, Playwright 65.
- 004-web-portada cerrada (2026-10-12; textos, recortes y colores aprobados por el usuario; VEREDICTO: APROBADO): portada real (hero, 3 servicios, proyectos, equipo, contacto), marca, SEO y capa de animación diferida (GSAP + ScrollTrigger + Lenis). Lighthouse 100/100/100/100, LCP ~1,5 s, CLS 0, TBT 0; JS 52,6 KB gzip (1,1 KB antes de `load`).
- Referencias: Notion de la agencia (URL privada en `MEMORY.local.md`, ignorado). Portfolio: chatarreriametalrenova.es y magnarwargames.com (permisos concedidos).

## Decisiones (y por qué)

- Astro (HTML estático, SEO y velocidad); Next.js descartado por enviar más JS. GSAP + Lenis + Rive llegarán después.
- Cloudflare (Workers, D1, Access) en vez de Vercel: el plan gratuito de Vercel no permite uso comercial. Objetivo: 0 €.
- Centro de Control aparte (control.agencymac.com) tras Cloudflare Access; CRM en D1 propio (empresas + proyectos), no Notion.
- Repo público: MIT para el código, `LICENSE-BRAND.md` reserva marca, Mac e ilustraciones.
- Node 24 (fnm) y pnpm 12 (corepack), `engineStrict` en `pnpm-workspace.yaml`; versiones exactas sin `^` y nunca publicadas el mismo día. ESLint 9 y TypeScript 6.0.3 por compatibilidad.
- `.gitattributes` fuerza LF; `shellEmulator: true` para `VAR=valor cmd` en Windows. Playwright y Lighthouse usan `chrome-headless-shell`.
- MCPs en `.mcp.json`; la ruta del navegador en `CHROME_DEVTOOLS_EXECUTABLE`, nunca en el repo.
- 002: i18n propio (funciones puras) en vez del de Astro; fuentes woff2 de Fontsource con su OFL; los tokens son la única fuente de hex.
- 002/003: servidor local propio (`serve-static.mjs`, 4322) que imita Workers static assets (307, `/404` → 200; D17 de la 003: se aceptó el comportamiento de Cloudflare en vez de código de Worker).
- 003: despliega solo GitHub Actions; wrangler como devDependency (paridad en local con `wrangler dev`), solo el script de `workerd` autorizado. `noindex` solo en la copia `.staging/`, nunca en `dist`; una sola build por CI (`PREBUILT_DIST=1`).
- 003: secretos solo en el entorno "staging" restringido a main; la comprobación previa omite el despliegue en verde si falta un secreto o el commit no es la punta de main. La URL se compone con el secreto del subdominio y nunca se imprime ni se versiona.
- 004: GSAP con licencia "Standard no charge" (uso comercial gratis; su tarball no trae LICENSE, solo el enlace); Vite quita su `@license` al minificar: se conserva con `comments: { legal: true }`. Contenido siempre visible en el HTML: JS solo oculta bloques bajo el pliegue. CTA a `#contact` hasta la spec 006.

## Aprendizajes y errores a evitar

- `gsap.matchMedia` con el breakpoint como condición devolvía la página arriba al girar el móvil: solo el movimiento reducido es condición. El CSS de Lenis se inyecta con `?inline`, no por import normal (Astro lo metía en el HTML de todos).

- La web antigua tenía título "WebApplication1" y casi nada indexable: no repetirlo.
- En agentes, `cmd.exe` no atraviesa la junction de fnm: anteponer al PATH la ruta real de Node.
- Windows: procesos node huérfanos en los puertos, y `workerd.exe` sigue vivo en el 8787 tras parar `wrangler dev`: matar el árbol con `taskkill /T` (regla en `AGENTS.md`).
- El detector de filtraciones (`no-leaks`) revisa también specs y docs: escribir siempre `<subdominio>` y nunca `NOMBRE_SECRETO=valor`, ni como ejemplo.
- Nada de URLs privadas, rutas locales ni datos personales en archivos versionados (historial público). Excepción: correos de autores en `OFL-*.txt`.
- Tests con reloj inyectado: el reloj debe avanzar también en rojo, o el bucle de reintentos se cuelga.

## Próximos pasos

- Después de la 004: formulario de contacto (spec 006), páginas de servicio (005); más adelante Centro de Control v1 con el CRM (fase 2) e integraciones (fase 3). Blog SEO más adelante.

## Pendientes del usuario

- Renovar el token de Cloudflare antes de que caduque (≤ 12 meses; fecha anotada en privado) según `docs/staging.md`.
- Comprobaciones manuales de la 002, si siguen pendientes: RF-21 (recorrido con Tab) y RF-23 (revisión a 375 px y escritorio; la revisión de staging del 2026-10-11 puede cubrirla).
- 004: comprobaciones manuales aún del usuario: staging desde el móvil (con y sin movimiento reducido), enlaces de proyecto, Ctrl+F y scroll con Lenis, recorrido con Tab.
- Alta legal (empresa o autónomo) ANTES de lanzar en agencymac.com; correo y WhatsApp de empresa; paquetes y precios (propuesta pendiente de Joni).
- Migrar el DNS de agencymac.com (hoy en Vercel) a Cloudflare al lanzar.
