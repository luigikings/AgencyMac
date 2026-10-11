# MEMORY.md — AgencyMac

Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual

- Spec 001-base cerrada (implementada): monorepo funcionando con Vitest 28 tests, Playwright 5 tests y Lighthouse 100 en las 4 categorías. Aún sin commit del contenido.
- Monorepo pnpm con `apps/web` (Astro, página mínima) y `apps/control` (React + Vite). Comandos en `AGENTS.md`.
- Spec 002-web-base aprobada; falta su plan y tareas.
- Referencias: Notion de la agencia (URL privada en `MEMORY.local.md`, ignorado por git). Portfolio: chatarreriametalrenova.es y magnarwargames.com (permisos concedidos).

## Decisiones (y por qué)

- Astro para la web: HTML estático (SEO y velocidad), i18n integrado; Next.js descartado por enviar más JS. GSAP + Lenis + Rive para animar sin perder SEO.
- Cloudflare (Pages/Workers, D1, Access) en vez de Vercel: el plan gratuito de Vercel no permite uso comercial. Objetivo de coste: 0 €.
- Centro de Control como app separada (control.agencymac.com), con login por Cloudflare Access para no programar autenticación propia.
- CRM en D1 propio en vez de Notion: tabla de empresas (estado, origen; vistas Prospección / En contacto / Clientes) + Proyectos (precio único y cuota mensual).
- Repo público (portfolio) con licencia MIT para el código y `LICENSE-BRAND.md` que reserva marca, Mac e ilustraciones.
- Node 24 LTS con fnm y pnpm 12 vía corepack; `preinstall` rechaza otra versión de Node y npm/yarn. `engineStrict: true` en `pnpm-workspace.yaml`: pnpm 12 ignora `engine-strict` de `.npmrc`.
- Versiones exactas sin `^`, y nunca una versión publicada el mismo día (puede retirarse o venir rota).
- ESLint 9 (no 10): eslint-plugin-react aún no soporta 10. TypeScript 6.0.3 (no 7): typescript-eslint 8 solo admite `<6.1.0`.
- Puertos fijos (lista en `AGENTS.md`): `--strictPort` en el preview para que falle en vez de saltar a otro puerto.
- `.gitattributes` fuerza LF: con `core.autocrlf` de Windows, Prettier marcaba los archivos como desformateados.
- Lighthouse CI usa el `chrome-headless-shell` de Playwright: el chrome.exe completo no arranca en esta máquina Windows.
- `shellEmulator: true` en pnpm: los scripts con `VAR=valor cmd` funcionan igual en Windows y Linux.
- axe-core en los e2e de la web (accesibilidad automática), con JS desactivado para probar que el contenido está en el HTML.
- MCPs en `.mcp.json`: Context7, Astro Docs y Chrome DevTools; la ruta del navegador en la variable `CHROME_DEVTOOLS_EXECUTABLE`, nunca rutas locales en `.mcp.json`.
- La base se dividió en dos specs: 001 (monorepo, tooling, tests) y 002 (web base con marca, i18n y SEO).

## Aprendizajes y errores a evitar

- La web antigua (ASP.NET en Vercel) tenía como título "WebApplication1" y casi nada de texto indexable: no repetirlo.
- En entornos de agente, `cmd.exe` no atraviesa la junction de fnm (`fnm_multishells`): anteponer al PATH la ruta real de instalación de Node antes de ejecutar pnpm o Playwright.
- Procesos node huérfanos en Windows ocupando puertos: regla movida a `AGENTS.md`.
- No incrustar URLs privadas, rutas locales ni datos personales en archivos versionados: el historial de git es público.

## Próximos pasos

- Primer commit y push (lo decide el usuario) y comprobar que GitHub detecta la licencia MIT.
- Después: plan y tareas de 002-web-base, Centro de Control v1 con el CRM (fase 2) e integraciones (fase 3). Blog SEO más adelante.

## Pendientes del usuario

- Revisar las descripciones breves de Hexaweb, Rankia y Adara en el README.
- Definir la variable `CHROME_DEVTOOLS_EXECUTABLE` para el MCP de Chrome DevTools.
- Opcional: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` para usar Node 24 (fnm) en PowerShell.
- Alta legal (empresa o autónomo): necesaria para el aviso legal ANTES de lanzar en agencymac.com.
- Correo y WhatsApp de empresa; paquetes y precios (plan base Hexaweb+Rankia, Adara como extra: propuesta pendiente de Joni).
- Migrar el DNS de agencymac.com (GoDaddy → ahora Vercel) a Cloudflare al lanzar.
