# AgencyMac

Agencia de **Marketing, Análisis y Coding**. Este monorepo contiene la web pública de la agencia y el Centro de Control, el panel interno con el que se gestionan contactos, clientes y proyectos.

La mascota de la agencia es **Mac**, un alien que acompaña al visitante por un pequeño sistema de planetas: cada planeta es un servicio y el destino final es siempre el mismo botón, **"Quiero despegar"**.

## Servicios

| Servicio                   | Nombre  | Qué incluye                                                     |
| -------------------------- | ------- | --------------------------------------------------------------- |
| Diseño y desarrollo web    | Hexaweb | Webs rápidas, accesibles y preparadas para posicionar           |
| SEO y mantenimiento        | Rankia  | Posicionamiento en buscadores y cuidado continuo de la web      |
| Publicidad en Google (SEM) | Adara   | Campañas de Google Ads orientadas a contactos y ventas medibles |

## Aplicaciones

- **`apps/web` — Web pública.** Carta de presentación de la agencia, en español (idioma principal) e inglés. HTML estático pensado para posicionar: el contenido está en el HTML y las animaciones nunca lo ocultan a los buscadores.
- **`apps/control` — Centro de Control.** Panel interno (CRM de empresas, clientes y proyectos). No se indexa y, cuando se despliegue, solo será accesible tras Cloudflare Access.

Ahora mismo ambas aplicaciones son esqueletos mínimos: la base técnica (herramientas, tests y auditoría) está lista y el contenido llega en las siguientes fases. Todavía no hay nada en producción; la web pública tiene preparado un entorno de prueba (ver [CI y entorno de prueba](#ci-y-entorno-de-prueba)).

## Tecnologías

- **Monorepo**: pnpm workspaces y TypeScript.
- **Web pública**: [Astro](https://astro.build), con GSAP/ScrollTrigger, Lenis y Rive para las animaciones.
- **Centro de Control**: React + Vite.
- **Infraestructura**: Cloudflare Workers con archivos estáticos (entorno de prueba de la web); previstos D1 como base de datos, Access como login y Resend para los correos. CI en GitHub Actions.
- **Calidad**: Vitest (lógica), Playwright + axe (flujos end-to-end y accesibilidad), Lighthouse CI (rendimiento, accesibilidad, buenas prácticas y SEO), ESLint y Prettier.

## Estructura del repositorio

```text
.
├── apps/
│   ├── web/          # Web pública (Astro) + configuración de Lighthouse CI
│   └── control/      # Centro de Control (React + Vite)
├── .github/workflows/ci.yml  # CI y despliegue al entorno de prueba
├── docs/
│   ├── constitution.md   # Principios innegociables del proyecto
│   └── staging.md        # Entorno de prueba: alta, CI y comportamiento
├── scripts/          # Comprobaciones, servidor de la preview y scripts de staging, con sus tests
├── specs/            # Especificaciones (Spec-Driven Development): spec, plan y tareas
├── AGENTS.md         # Cómo se trabaja en el proyecto (también para agentes de IA)
├── MEMORY.md         # Estado del proyecto y decisiones tomadas
├── playwright.config.ts
├── vitest.config.ts
└── eslint.config.js
```

El proyecto se desarrolla con **Spec-Driven Development**: cada funcionalidad empieza como una especificación aprobada en `specs/`, que se traduce en un plan con tareas y, por último, en código con sus tests.

## Requisitos

- **Node.js 24** (la versión está fijada en `.node-version`). Por ejemplo, con [fnm](https://github.com/Schniz/fnm):

  ```sh
  fnm install
  fnm use
  ```

- **pnpm**, en la versión fijada en `package.json` (`packageManager`). La forma más sencilla es activarlo con Corepack:

  ```sh
  corepack enable
  ```

La instalación se detiene con un mensaje claro si se usa otra versión de Node o un gestor distinto de pnpm (por ejemplo, `npm install`).

## Instalación

```sh
pnpm install
pnpm browsers:install
```

`pnpm browsers:install` descarga el Chromium de Playwright, que usan tanto los tests end-to-end como la auditoría de Lighthouse. No hace falta tener Chrome instalado en el sistema.

## Comandos

Todos se ejecutan desde la raíz del repositorio.

| Comando                 | Qué hace                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm dev:web`          | Arranca la web pública en modo desarrollo                                                  |
| `pnpm dev:control`      | Arranca el Centro de Control en modo desarrollo                                            |
| `pnpm build`            | Compila las dos aplicaciones                                                               |
| `pnpm lint`             | Revisa el código con ESLint (sin advertencias permitidas)                                  |
| `pnpm format`           | Formatea todo el repositorio con Prettier                                                  |
| `pnpm format:check`     | Comprueba el formato sin modificar archivos                                                |
| `pnpm test`             | Tests unitarios (Vitest), comprobación del navegador y tests end-to-end (Playwright + axe) |
| `pnpm quality`          | Compila la web y la audita con Lighthouse CI                                               |
| `pnpm browsers:install` | Instala o actualiza el Chromium de Playwright                                              |
| `pnpm smoke`            | Smoke test del entorno de prueba (en local: `--url http://localhost:8787 --version local`) |

`pnpm test` compila y sirve cada aplicación por su cuenta antes de los tests end-to-end. La web usa dos puertos: `pnpm dev:web` (`astro dev`) arranca en el **4321**, y la build de producción que prueban Playwright y Lighthouse se sirve en el **4322** con un pequeño servidor estático propio (`scripts/serve-static.mjs`, sin dependencias), que responde igual que Cloudflare Workers: página 404 por idioma, distingue mayúsculas y minúsculas, redirecciones 307 que conservan la query (`/en` → `/en/`, `/index.html` → `/`, `/404.html` → `/404`) y `/404` servida con 200. Falla si el puerto está ocupado, así que un servidor de desarrollo abierto nunca se confunde con la build bajo prueba. En local, si ya hay una preview levantada en el 4322 (o la del Centro de Control en el 4173), los tests la reutilizan.

## CI y entorno de prueba

- **CI** (GitHub Actions, `.github/workflows/ci.yml`): en cada push y cada PR hacia `main` instala con el lockfile congelado, pasa lint y formato, compila las dos apps una sola vez y ejecuta los tests y Lighthouse sobre esa build. Solo tiene permiso de lectura sobre el repositorio.
- **Entorno de prueba (staging)**: tras cada push a `main` con el CI en verde, la misma build de la web se despliega en un Worker de Cloudflare (`agencymac-staging`) y un smoke test la comprueba. Todas sus respuestas llevan `X-Robots-Tag: noindex`, así que los buscadores no la indexan. La URL no se publica en el repositorio: se consulta en el panel de Cloudflare.
- El alta inicial (cuenta, token, entorno y secretos), la prueba en local con `wrangler dev` y el comportamiento del Worker están en [`docs/staging.md`](docs/staging.md).

## Calidad

- Cada requisito funcional tiene al menos un test, escrito antes que el código.
- Los tests end-to-end de contenido de la web se ejecutan **con JavaScript desactivado**, para garantizar que el contenido está en el HTML, y la página pasa además una auditoría de accesibilidad con axe.
- `pnpm quality` audita la web en **perfil móvil** con Lighthouse CI: 3 ejecuciones, se toma la mediana y falla si cualquiera de las 4 categorías (Rendimiento, Accesibilidad, Buenas prácticas y SEO) baja de **90**. Actualmente la web obtiene **100 en las 4**.
- Los informes de Lighthouse se guardan en local, en `apps/web/.lighthouseci/` (ignorado por git); no se suben a ningún servicio externo.

## Privacidad y configuración local

- La **telemetría de Astro está desactivada** en todos los scripts de la web (`ASTRO_TELEMETRY_DISABLED=1`).
- La **telemetría de wrangler está desactivada** en los scripts y en el CI (`WRANGLER_SEND_METRICS=false`).
- El repositorio es público: ninguna clave, token ni archivo `.env` se sube a git. Los archivos `.env*` (salvo `.env.example`), `.dev.vars` y `.wrangler/` están ignorados, y un test falla si aparece una URL de `workers.dev`, un secreto con valor o uno de esos archivos.

### MCP para agentes de IA

`.mcp.json` configura los servidores MCP que usan los agentes de IA del proyecto (documentación de librerías, documentación de Astro y Chrome DevTools). Para no escribir rutas locales en el repositorio, el servidor de Chrome DevTools lee la ruta del navegador de la variable de entorno **`CHROME_DEVTOOLS_EXECUTABLE`**. Defínela en tu sistema con la ruta completa al ejecutable de Chrome o Edge antes de abrir el cliente de IA:

```sh
# macOS / Linux (bash o zsh)
export CHROME_DEVTOOLS_EXECUTABLE="/ruta/al/navegador"
```

```powershell
# Windows (PowerShell), de forma persistente para tu usuario
[Environment]::SetEnvironmentVariable("CHROME_DEVTOOLS_EXECUTABLE", "<ruta al navegador>", "User")
```

Si tu cliente de IA no expande variables `${...}` en `.mcp.json`, configura esa ruta en la configuración local del cliente, nunca en el archivo del repositorio.

`.mcp.json` lanza el servidor de Chrome DevTools con `cmd /c npx ...`, que **solo funciona en Windows**. En Linux o macOS, en tu configuración local del cliente usa `"command": "npx"` y quita `"/c"` de `args` (el resto de argumentos no cambia).

## Licencia

- **Código**: licencia [MIT](LICENSE). Puedes reutilizarlo libremente con sus condiciones.
- **Marca y contenidos**: la marca AgencyMac, la mascota Mac, los logos, las ilustraciones (planetas y Mac) y los textos de marca y de la web **no** están cubiertos por la licencia MIT; todos sus derechos están reservados. Consulta [LICENSE-BRAND.md](LICENSE-BRAND.md).
