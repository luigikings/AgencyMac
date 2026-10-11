# Tareas — Spec 001: Base del monorepo

Orden de dependencia. Tests primero en cada tarea con código. No se hace ningún commit hasta terminar T1.

- [x] **T1. Saneamiento previo a cualquier commit: `.gitignore`, URL de Notion fuera de MEMORY.md y `.mcp.json` sin rutas locales.** RF-19, RF-20, RF-21, RF-22
  - Hecho cuando:
    - `.gitignore` tiene las entradas del plan.
    - La URL de Notion solo está en `MEMORY.local.md`.
    - `.mcp.json` usa `${CHROME_DEVTOOLS_EXECUTABLE}`.
    - `git check-ignore -v .env apps/web/.env.local .dev.vars .claude/settings.local.json MEMORY.local.md` lista los 5.
    - `git grep -n -I -e "notion.site" -e "Program Files" -- . ":!specs"` no devuelve nada.

- [x] **T2. Workspace raíz (`package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.node-version`, `tsconfig.base.json`, `vitest.config.ts`) y `scripts/check-env.mjs` con su test escrito primero.** RF-1, RF-2, RF-3, RF-13, RF-14
  - Hecho cuando:
    - Versiones exactas confirmadas con Context7 y anotadas en el plan.
    - `check-env.test.mjs` estuvo en rojo y ahora pasa con `pnpm vitest run` (Node 23/25 → error, user agent de npm → error, pnpm + Node 24 → ok).
    - `pnpm install` termina con código 0.

- [x] **T3. Lint y formato: `eslint.config.js` (TS + Astro + React + eslint-config-prettier), `.prettierrc.json`, `.prettierignore` y scripts `lint`, `format`, `format:check`.** RF-6, RF-7
  - Hecho cuando:
    - `pnpm lint` y `pnpm format:check` terminan con código 0.
    - Desformatear un archivo de prueba hace fallar `pnpm format:check`, y se revierte.

- [x] **T4. Playwright + Chromium: `playwright.config.ts` base (solo Chromium, informes, `forbidOnly` en CI; sin proyectos ni `webServer` todavía), `browsers:install` y `scripts/check-browser.mjs` con su test escrito primero.** RF-4, RF-13, RF-18
  - Hecho cuando:
    - `pnpm browsers:install` termina con código 0.
    - `check-browser.test.mjs` estuvo en rojo y ahora pasa.
    - El script `test` encadena `vitest run` y check-browser, sin `playwright test`, y `pnpm test` termina con código 0.

- [x] **T5. Esqueleto `apps/control` (React + Vite) y primer e2e: primero `documentTitle.test.ts` y `e2e/home.spec.ts` en rojo; después `index.html` (lang es, noindex), `App.tsx` y scripts dev/build/preview. Se añade el proyecto `control` y su entrada en `webServer` (build + preview en 4173, `reuseExistingServer: !process.env.CI`) a `playwright.config.ts`, y `playwright test` se encadena al script `test`.** RF-5, RF-9, RF-11, RF-12, RF-14, RF-15, RF-16
  - Riesgo: en el entorno del agente, el `cmd.exe` que lanza `webServer` no encontraba `pnpm`, porque los shims de fnm están en la junction `%LOCALAPPDATA%\fnm_multishells`. Hay que comprobarlo. Si sigue pasando, para y propone una alternativa al usuario (CLI de vite con `node` y su ruta en `node_modules`, `npx --no-install` o documentar el PATH) antes de aplicarla.
  - Hecho cuando:
    - Ambos tests pasaron de rojo a verde con `pnpm test`, que ahora incluye `playwright test` y levanta el servidor de control por su cuenta.
    - El riesgo de `pnpm` en `webServer` está comprobado y, si hizo falta, resuelto con la alternativa aprobada.
    - `pnpm --filter control build` termina sin errores ni advertencias propias.
    - `pnpm lint` sigue en verde.

- [x] **T6. Esqueleto `apps/web` (Astro): primero `site.test.ts` y `e2e/home.spec.ts` (JS desactivado + axe) en rojo; después `astro.config.mjs` e `index.astro` (lang es, title, description, h1 "AgencyMac", contraste AA). Se añade el proyecto `web` y su entrada en `webServer` (build + preview en 4321, `reuseExistingServer: !process.env.CI`) a `playwright.config.ts`.** RF-5, RF-8, RF-10, RF-14, RF-15, RF-16, RF-24
  - Hecho cuando:
    - Ambos tests pasaron de rojo a verde con `pnpm test`, que ejecuta los proyectos `control` y `web`.
    - `pnpm build` termina con código 0 en las dos apps.
    - `pnpm lint` y `pnpm format:check` siguen en verde.

- [x] **T7. Lighthouse CI: `apps/web/lighthouserc.cjs` (`chrome-headless-shell` de Playwright localizado con `findHeadlessShell`, 3 ejecuciones, mediana, ≥ 0.9 en 4 categorías, informes en `.lighthouseci/`) y comando `pnpm quality`.** RF-17, RF-18
  - Hecho cuando:
    - Los tests de `findHeadlessShell` en `check-browser.test.mjs` pasaron de rojo a verde.
    - `check-browser` comprueba el `chrome-headless-shell` y no el Chromium completo, y `pnpm test` sigue en verde.
    - `pnpm quality` termina con código 0 usando el `chrome-headless-shell` de Playwright.
    - Subir temporalmente el umbral lo hace fallar con código distinto de cero, y se revierte. Se probó con 1.01, porque la página saca 1.0 y con un umbral de 1.0 no falla.
    - `.lighthouseci/` está ignorado.

- [x] **T8. Licencias y README: `LICENSE` (MIT, "Copyright (c) 2026 AgencyMac"), `LICENSE-BRAND.md` y `README.md` en español para portfolio.** E-1, E-2, E-3
  - Hecho cuando:
    - `LICENSE` es el texto MIT íntegro y no tiene añadidos.
    - `LICENSE-BRAND.md` cubre marca, Mac, logos, ilustraciones y textos de marca.
    - El README tiene todas las secciones de E-3, incluida la instalación de Chromium y la variable `CHROME_DEVTOOLS_EXECUTABLE`, sin datos de contacto personales.
    - `pnpm format:check` está en verde.

- [x] **T9. AGENTS.md de `apps/web` y de `apps/control`, sección Comandos del AGENTS.md raíz con la regla `.env.example`, y MEMORY.md con los permisos de Metal Renova y Magnar concedidos.** E-4, E-5, E-6, E-7
  - Hecho cuando:
    - Los tres AGENTS.md cubren lo pedido en E-4 a E-6.
    - Ningún comando del AGENTS.md raíz dice "pendiente".
    - MEMORY.md tiene ≤ ~50 líneas y no contiene la URL de Notion.

- [x] **T10. Verificación final antes del primer commit: comprobaciones manuales y de saneamiento en Windows.** RF-1, RF-2, RF-3, RF-8, RF-9, RF-16, RF-18, RF-20, RF-23
  - Hecho cuando:
    - En un clon limpio, `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm test` y `pnpm quality` terminan con código 0.
    - Se ha comprobado y anotado:
      - El error con otra versión de Node y con `npm install`.
      - `pnpm dev:web` y `pnpm dev:control` en el navegador.
      - Reutilización del servidor en local y fallo con `CI=1`.
      - El mensaje de Chromium ausente.
      - Que un `.env` de prueba no aparece en `git status`.
    - `git grep` sobre los archivos preparados (rutas `C:\`/`/Users/`, `notion.site`, correos personales, `.env`) no da resultados fuera de `specs/`.

- [x] **T11. Correcciones de validación: `.gitattributes` con LF, `engineStrict` en `pnpm-workspace.yaml`, preview de la web en 4322 y ajustes de documentación.** RF-2, RF-7, RF-15, RF-16, RF-17, RF-19, E-3, E-6
  - Pasos:
    - Crear `.gitattributes` con `* text=auto eol=lf` y los binarios marcados.
    - Quitar `engine-strict` de `.npmrc` (borrar el archivo si queda vacío) y poner `engineStrict: true` en `pnpm-workspace.yaml`.
    - En `apps/web`, `preview` pasa a `--port 4322 --strictPort`. Actualizar baseURL y `webServer` del proyecto `web` en `playwright.config.ts` y la URL de `lighthouserc.cjs`. `astro dev` sigue en 4321.
    - Añadir `package-lock.json` y `yarn.lock` a `.gitignore`.
    - README: corregir la frase de los puertos (línea 92) y añadir la nota de `cmd /c` en `.mcp.json` (solo Windows), con su adaptación para Linux/macOS.
    - AGENTS.md raíz: quitar "(se crean en la spec 001)" (línea 11).
  - Hecho cuando:
    - Finales de línea verificados en un repo temporal dentro del scratchpad, sin commit en el repo real. Se copia el proyecto sin `node_modules`, se hace `git init` y commit allí, y después `git clone` local con `core.autocrlf=true`. En el clon, `pnpm install` y `pnpm format:check` terminan con código 0.
    - `pnpm config get engine-strict` (o la clave equivalente de pnpm 12) devuelve `true`.
    - Con Node 22 y `node_modules` ya instalado, `pnpm install` falla indicando Node 24. Si no falla, se para y se pregunta al usuario.
    - `pnpm test` y `pnpm quality` terminan con código 0 usando la preview en 4322.
    - Con `pnpm dev:web` arrancado en 4321, `pnpm test` no reutiliza ese servidor.
    - `git check-ignore -v package-lock.json yarn.lock` lista los dos.
    - `pnpm lint` y `pnpm format:check` siguen en verde.
