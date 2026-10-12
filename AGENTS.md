# AGENTS.md — AgencyMac

Monorepo de AgencyMac (agencia de Marketing, Análisis y Coding). Contiene la web pública de la agencia, su carta de presentación ante clientes (debe impresionar y posicionar en ES/EN), y el Centro de Control, un panel interno para gestionar contactos, clientes y proyectos.

## Stack y estructura

- Monorepo con pnpm workspaces. Código en TypeScript.
- `apps/web`: web pública. Astro + GSAP/ScrollTrigger + Lenis + Rive. Idiomas ES (principal) y EN.
- `apps/control`: Centro de Control (uso interno). React. Protegido con Cloudflare Access.
- Infraestructura: Cloudflare (Workers con static assets, D1 como base de datos, Access como login) y Resend (correos). CI en GitHub Actions; entorno de prueba en el Worker `agencymac-staging` (`docs/staging.md`).
- Cada app tiene su propio `AGENTS.md` con sus reglas específicas.
- Marca: colores, tipografías (Lilita One + Lato), logos e ilustraciones (planetas, Mac) en los assets del proyecto.

## Comandos

Requisitos: Node 24 LTS (`.node-version`) y pnpm (versión fijada en `packageManager`, vía corepack). Todo se ejecuta desde la raíz.

- Instalar: `pnpm install` (falla con otra versión de Node o si se usa npm/yarn)
- Instalar Chromium para tests y auditoría: `pnpm browsers:install`
- Arrancar: `pnpm dev:web` (web) y `pnpm dev:control` (Centro de Control)
- Tests: `pnpm test` (Vitest para lógica + comprobación de Chromium + Playwright e2e de las dos apps)
- Auditoría: `pnpm quality` (Lighthouse CI de la web: ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO)
- Lint: `pnpm lint`
- Formato: `pnpm format` (corrige) / `pnpm format:check` (comprueba)
- Build: `pnpm build` (las dos apps)
- Staging en local: `pnpm --filter web staging:local` (copia de la build + `_headers` en `apps/web/.staging/` y `wrangler dev` en el 8787, sin cuenta ni token; requiere `pnpm --filter web build` antes)
- Smoke test: `pnpm smoke --url http://localhost:8787 --version local` (en el CI compone la URL con el secreto del subdominio; detalles en `docs/staging.md`)
- Variables de entorno: si una app las necesita, se añade un `.env.example` con los nombres y sin valores reales. Los `.env` de verdad nunca se versionan.

## Convenciones

- Código, nombres y comentarios en inglés. Specs y documentación en español.
- Textos de la interfaz pública en ES y EN; nunca un texto visible solo en un idioma.

## Reglas de dominio / trampas conocidas

- Solo se ofrecen 3 servicios: Web (Hexaweb), SEO + mantenimiento (Rankia) y Google Ads (Adara). El resto de planetas de la web antigua no se usan.
- La mascota es el alien Mac. El CTA principal es "Quiero despegar" (pedir presupuesto).
- El repo es PÚBLICO: el historial de git también. Ningún secreto ni dato de cliente puede llegar nunca a un commit.
- Las animaciones nunca deben ocultar contenido a Google: el texto va en el HTML.
- Todo CSS con movimiento (`transition`, `animation`, `scroll-behavior: smooth`) va bajo `prefers-reduced-motion`; lo vigila `motion-css.test.ts`.
- Ninguna librería de animación o de scroll se carga antes del evento `load`: va en un módulo diferido (presupuestos y detalle en `apps/web/AGENTS.md`).
- Puertos fijos: web `astro dev` 4321 y preview de tests/Lighthouse 4322, servida por `scripts/serve-static.mjs`, que imita los static assets de Cloudflare Workers (códigos en `apps/web/AGENTS.md`) y falla si el puerto está ocupado; control dev 5173 y preview 4173 (con `--strictPort`); staging local (`wrangler dev`) 8787.
- En Windows, parar tareas en segundo plano puede dejar procesos node huérfanos ocupando esos puertos: comprobarlos y matarlos antes de lanzar los tests. Parar `wrangler dev` deja vivo `workerd.exe` en el 8787 (y a veces el propio wrangler, que lo relanza): matar el árbol con `taskkill /PID <pid> /T /F`, solo los procesos de este repo, y comprobar que el puerto queda libre.
- Staging (spec 003): solo despliega el CI, tras un push a `main` con todo el CI en verde (`.github/workflows/ci.yml`). Ningún agente ejecuta `wrangler login` ni `wrangler deploy`, ni crea cuentas o tokens. La URL de prueba, el subdominio de la cuenta, el Account ID y los tokens nunca se versionan (en la documentación: `agencymac-staging.<subdominio>.workers.dev`); `scripts/no-leaks.test.mjs` lo vigila y `.wrangler/` está ignorado. La telemetría de wrangler está desactivada (`WRANGLER_SEND_METRICS=false`) en los scripts y en el CI.
- CI: una sola build por ejecución; con `PREBUILT_DIST=1`, Playwright sirve la build existente sin compilar. En local, `pnpm test` y `pnpm quality` siguen compilando por sí mismos.

## SDD

- Lee `docs/constitution.md` y la spec activa (`specs/NNN-*/`) antes de tocar código.
- Funcionalidades nuevas: flujo SDD (/coordinator en Claude Code, agente coordinator en OpenCode, o comandos /sdd-*). Cambios pequeños: /feature.
- El usuario aprueba la spec y el plan con tareas. Lo demás avanza solo y se para si algo falla o falta una decisión.

## Memoria

- Al empezar, lee `MEMORY.md`. Actualízalo al cerrar cada spec o ante una decisión importante o un error a evitar.
- Máximo ~50 líneas. Si algo pasa a ser regla permanente, propón moverlo aquí. Nunca datos sensibles.

## Límites

- ✅ Siempre: comprobar ES y EN; actualizar `MEMORY.md` al cerrar cada spec.
- ⚠️ Pregunta antes: dependencias nuevas, cambios en el esquema de D1, cambios de dominio/DNS, desplegar a producción.
- 🚫 Nunca: subir claves, tokens o archivos .env; guardar contraseñas de clientes en la base de datos o el repo.

## Verificación

- Tests en verde + revisión visual en el navegador (escritorio y móvil de 375 px) + Lighthouse sin bajar del mínimo de la constitución.
