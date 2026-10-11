# MEMORY.md — AgencyMac

Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual

- Spec 001-base cerrada, commiteada y subida (commit d81ca25): monorepo pnpm con `apps/web` (Astro) y `apps/control` (React + Vite). Comandos en `AGENTS.md`.
- Spec 002-web-base cerrada (VEREDICTO: APROBADO, 2026-10-11), **pendiente de commit y push** (lo decide el usuario): inicio y 404 en ES (`/`) y EN (`/en/`), tokens de marca, fuentes autoalojadas, SEO base y axe sin infracciones. Vitest 167, Playwright 64, Lighthouse 100 en todo, LCP ≈1,05 s, CLS 0. El cian del logo #00E5FF es **provisional** hasta tener el archivo del logo.
- Referencias: Notion de la agencia (URL privada en `MEMORY.local.md`, ignorado por git). Portfolio: chatarreriametalrenova.es y magnarwargames.com (permisos concedidos).

## Decisiones (y por qué)

- Astro para la web: HTML estático (SEO y velocidad); Next.js descartado por enviar más JS. GSAP + Lenis + Rive para animar sin perder SEO (aún no instalados).
- Cloudflare (Pages/Workers, D1, Access) en vez de Vercel: el plan gratuito de Vercel no permite uso comercial. Objetivo de coste: 0 €.
- Centro de Control como app separada (control.agencymac.com), con login por Cloudflare Access para no programar autenticación propia.
- CRM en D1 propio en vez de Notion: tabla de empresas (estado, origen; vistas Prospección / En contacto / Clientes) + Proyectos (precio único y cuota mensual).
- Repo público (portfolio) con licencia MIT para el código y `LICENSE-BRAND.md` que reserva marca, Mac e ilustraciones.
- Node 24 LTS con fnm y pnpm 12 vía corepack; `engineStrict: true` en `pnpm-workspace.yaml` (pnpm 12 ignora `engine-strict` de `.npmrc`).
- Versiones exactas sin `^`, y nunca una versión publicada el mismo día (puede retirarse o venir rota).
- ESLint 9 (no 10) y TypeScript 6.0.3 (no 7) por compatibilidad de eslint-plugin-react y typescript-eslint.
- `.gitattributes` fuerza LF (con `core.autocrlf` Prettier marcaba todo como desformateado). `shellEmulator: true` en pnpm para `VAR=valor cmd` en Windows.
- Lighthouse CI y Playwright usan el `chrome-headless-shell` de Playwright: el chrome.exe completo no arranca en esta máquina.
- MCPs en `.mcp.json`; la ruta del navegador va en `CHROME_DEVTOOLS_EXECUTABLE`, nunca en el repo.
- 002: servidor estático propio (`scripts/serve-static.mjs`, puerto 4322) en vez de `astro preview`, porque este sirve siempre la 404 ES y no distingue mayúsculas en Windows; imita Cloudflare Pages.
- 002: i18n propio (funciones puras + diccionario TS) en lugar del i18n de Astro: su módulo virtual no se puede probar en Vitest y para 2 idiomas no aporta nada.
- 002: fuentes woff2 de Fontsource sacadas del tarball de npm (`npm pack`, sin añadir dependencias), versionadas con su OFL; Google Fonts en GitHub solo tiene TTF.
- 002: token neutro `text` #FFFFFF para el texto (los colores de marca conservan su papel); los tokens son la única fuente de hex y un test lo vigila.
- 002: la 404 EN se genera como `en/404/index.html` y la integración `relocateNotFound` la mueve a `en/404.html` (como espera Cloudflare Pages). Las 404 no llevan navegación de idioma, canonical ni hreflang.

## Aprendizajes y errores a evitar

- La web antigua (ASP.NET en Vercel) tenía como título "WebApplication1" y casi nada de texto indexable: no repetirlo.
- En entornos de agente, `cmd.exe` no atraviesa la junction de fnm: anteponer al PATH la ruta real de instalación de Node antes de pnpm o Playwright.
- Procesos node huérfanos en Windows ocupando puertos: regla en `AGENTS.md`.
- No incrustar URLs privadas, rutas locales ni datos personales en archivos versionados: el historial de git es público. Excepción aprobada: los correos de los autores en `OFL-*.txt` (la OFL obliga a conservar el aviso).
- El guardarraíl sdd-guard pregunta por comandos "amarillos" (p. ej. `export`) aunque se esté en modo automático. Los agentes deben editar con Edit/Write, nunca con `python -c`/`node -e`/`sed -i`.

## Próximos pasos

- Commit y push de la 002 (cuando el usuario lo decida).
- Siguiente, cuando el usuario la pida: web pública con contenido real (fase 1); después Centro de Control v1 con el CRM (fase 2) e integraciones (fase 3). Blog SEO más adelante.

## Pendientes del usuario

- Comprobaciones manuales de la 002: RF-21 (recorrido con Tab) y RF-23 (revisión visual en escritorio y 375 px).
- Aplicar el cambio propuesto en `~/.claude/hooks/sdd-guard.js` (implementer: amarillo → permitir; reviewer: bloquear escrituras y rojo, permitir el resto).
- Pasar el archivo del logo para fijar el cian definitivo.
- Opcional: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` para usar Node 24 (fnm) en PowerShell.
- Alta legal (empresa o autónomo): necesaria para el aviso legal ANTES de lanzar en agencymac.com.
- Correo y WhatsApp de empresa; paquetes y precios (plan base Hexaweb+Rankia, Adara como extra: propuesta pendiente de Joni).
- Migrar el DNS de agencymac.com (GoDaddy → ahora Vercel) a Cloudflare al lanzar.
