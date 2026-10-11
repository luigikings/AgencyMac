# Tareas — Spec 003: Entorno de prueba (staging) y CI

Van en orden de dependencia. En cada tarea, primero los tests (vistos en rojo) y después el código. Cada una cierra con `pnpm test`, `pnpm lint` y `pnpm format:check` en verde.

Entorno de agente: si `node -v` no devuelve 24, antepón al PATH la carpeta de instalación real de Node 24 antes de usar pnpm, Playwright o wrangler (ver MEMORY.md y AGENTS.md). Antes de los tests, comprobar que no hay procesos node huérfanos en 4321, 4322 u 8787.

Nunca: crear cuentas, manejar tokens, ejecutar `wrangler login` o `wrangler deploy`, hacer push ni escribir la URL de prueba, el subdominio o el ID de cuenta en ningún archivo. Las dependencias N1-N3 del plan (sección 0) se instalan solo si el usuario las aprobó junto con el plan.

- [x] **T1. Dependencias y archivos ignorados: añadir `yaml` 2.9.1 (raíz) y `wrangler` 4.149.0 (`apps/web`) como devDependencies exactas; si pnpm lo exige, autorizar solo los scripts de instalación de `workerd` en `pnpm-workspace.yaml`; ignorar `.wrangler/` y `apps/web/.staging/` en `.gitignore`, `.prettierignore` y `eslint.config.js`.** RF-36, RNF-2, RNF-3
  - Tests primero: ninguno (configuración); la regla (c) de T2 vigilará `.wrangler/`.
  - Hecho cuando:
    - `pnpm install --frozen-lockfile` funciona tras actualizar el lockfile, y `pnpm --filter web exec wrangler --version` imprime 4.149.0.
    - `git check-ignore` confirma `.wrangler/` y `apps/web/.staging/`.
    - `pnpm test`, `pnpm lint` y `pnpm format:check` siguen en verde.

- [ ] **T2. Anti-filtraciones y build sin `noindex`: primero `scripts/lib/leaks.test.mjs`, `scripts/no-leaks.test.mjs`, `scripts/lib/dist-check.test.mjs` y `apps/web/e2e/dist-clean.spec.ts`; después `scripts/lib/leaks.mjs` (reglas a/b/c de la sección 6 del plan) y `scripts/lib/dist-check.mjs`.** RF-9, RF-12, RF-36, RNF-9
  - Hecho cuando:
    - Los tests pasaron de rojo a verde; los marcadores `agencymac-staging.<subdominio>.workers.dev`, `<subdominio de la cuenta>.workers.dev` y `*.workers.dev` no fallan, y `ejemplo123.workers.dev` sí.
    - Al añadir temporalmente `CLOUDFLARE_API_TOKEN=abc` a un archivo versionado de prueba, `pnpm test` falla con archivo y línea (se revierte).
    - Al añadir temporalmente un meta robots `noindex` a una página, `dist-clean.spec.ts` falla indicando el archivo (se revierte).

- [ ] **T3. Lógica pura del smoke test: primero `scripts/staging/smoke-checks.test.mjs` (tabla de la sección 5 del plan en verde y en rojo, fuentes, favicon, `relativize`, `formatFailure` sin host, `stagingUrl`, `waitForVersion` con reloj inyectado); después `scripts/staging/smoke-checks.mjs`.** RF-13 a RF-27, RF-39, RNF-5
  - Hecho cuando:
    - Los tests pasaron de rojo a verde, incluidos: 404 servida con 200 → rojo; `/en?x=1` sin query en el destino → rojo; sin `X-Robots-Tag` en una 3xx → rojo; título "Centro de Control" → rojo.
    - `waitForVersion` termina en rojo sin superar 180 s de reloj simulado.
    - Ningún mensaje de fallo contiene el host recibido.

- [ ] **T4. Copia de staging, comprobación previa y CLI del smoke test: primero `staging-copy.test.mjs` y `preflight.test.mjs`; después `scripts/staging/staging-copy.mjs`, `scripts/staging/preflight.mjs`, `scripts/staging/smoke.mjs` (CLI fino con `--url` o el secreto del subdominio, `redirect: "manual"`), script raíz `smoke` y scripts `staging:copy` y `staging:deploy` de `apps/web` con `WRANGLER_SEND_METRICS=false`.** RF-4, RF-9, RF-10, RF-11, RF-12, RF-13, RF-37, RF-39
  - Hecho cuando:
    - Los tests pasaron de rojo a verde: `_headers` exacto, identificador validado, negativa si la build trae `_headers`, `dist` intacta; `preflight` no listo si falta uno, dos o tres secretos o el commit no es la punta, con avisos solo por nombre.
    - `pnpm --filter web staging:copy` (con `local`) crea `apps/web/.staging/` con la build más `_headers`, y `apps/web/dist` no cambia.
    - `pnpm smoke` sin `--url` ni secreto sale con código distinto de cero y un mensaje claro.

- [ ] **T5. Worker y paridad en local con `wrangler dev`: primero los tests de `wrangler.json` en `scripts/ci-workflow.test.mjs`; después `apps/web/wrangler.json` (sección 2 del plan) y el script `staging:local` (copia + `wrangler dev --port 8787`). Ejecutar `pnpm smoke --url http://localhost:8787 --version local` y anotar en `tasks.md` la tabla observada (códigos de `/en`, `/index.html`, `/404`, `/404.html`, mayúsculas, `_headers`, noindex en 3xx).** RF-6, RF-7, RF-17 a RF-25, RP-4
  - Hecho cuando:
    - El test de `wrangler.json` pasó de rojo a verde (nombre, `workers_dev`, `preview_urls: false`, assets, sin rutas, dominios, `account_id` ni `vars`).
    - La tabla observada está anotada.
    - **Si `/404`, `/404.html`, `/en/404` o `/en/404.html` no dan 404, o la 3xx no lleva `X-Robots-Tag`: PARAR y avisar al coordinador (RP-4); no se sigue con T6.**
    - Ninguna petición sale a Cloudflare (sin login, sin cuenta).

- [ ] **T6. Servidor local alineado con Cloudflare: primero la columna "local" de la tabla de la sección 5 en `scripts/serve-static.test.mjs` (con los códigos observados en T5 y una carpeta ficticia con `_headers` y `_redirects`) y el ajuste de `apps/web/e2e/routing.spec.ts` si cambia el código de `/en`; después `scripts/serve-static.mjs` y su comentario de cabecera.** RF-17, RF-18, RF-20, RF-21, RF-24
  - Hecho cuando:
    - Los tests pasaron de rojo a verde: `/404.html` y `/en/404.html` → 404 (ya no 200), `_headers`/`_redirects` → 404, y `/en` e `/index.html` con el código observado.
    - `pnpm smoke --url http://localhost:4322 --version local` solo falla en la versión y el noindex (que el servidor local no añade), nada más.
    - `pnpm test` y `pnpm quality` en verde.

- [ ] **T7. Una sola build en el CI: primero un test en `ci-workflow.test.mjs` o en un test de configuración que compruebe que, con `PREBUILT_DIST=1`, los `webServer` de `playwright.config.ts` no compilan; después `playwright.config.ts` y `--no-sandbox` condicionado a `CI` en `apps/web/lighthouserc.cjs`.** RF-11, RF-28, RNF-9
  - Hecho cuando:
    - El test pasó de rojo a verde.
    - En local, `pnpm test` y `pnpm quality` sin la variable siguen compilando y en verde.
    - Con `pnpm build` previo y `PREBUILT_DIST=1`, `pnpm test` no vuelve a compilar (el registro no muestra `astro build` ni `vite build`) y queda en verde.

- [ ] **T8. Workflow: primero el resto de `scripts/ci-workflow.test.mjs` (sección 8 del plan); después `.github/workflows/ci.yml` (sección 3 del plan, acciones fijadas por SHA con la versión en comentario).** RF-1 a RF-6, RF-10, RF-11, RF-12, RF-28 a RF-35, RF-37, RF-39, RF-40, RNF-3
  - Hecho cuando:
    - Los tests pasaron de rojo a verde.
    - Al cambiar temporalmente `cancel-in-progress` del despliegue a `true`, añadir `workflow_dispatch`, poner `url` en el entorno o usar `@v7` en una acción, el test falla (se revierte cada vez).
    - `pnpm format:check` acepta el YAML y `no-leaks` sigue en verde.

- [ ] **T9. Documentación: `docs/staging.md` (alta de la sección 7 del plan, con el aviso del subdominio largo y poco común, permiso solo de Workers, caducidad ≤ 12 meses, entorno antes del workflow), `AGENTS.md` raíz (comandos, puerto 8787, regla de despliegue, datos que nunca se versionan), `apps/web/AGENTS.md` (códigos del servidor local, Worker, `.staging/`), `README.md` (CI y entorno de prueba, sin URL) y nota en `MEMORY.md` de la decisión de staging.** RF-38, RP-1, RP-2
  - Hecho cuando:
    - Las instrucciones siguen el orden de RF-38 y avisan de revisar y restringir el entorno si GitHub lo creó solo.
    - `apps/web/AGENTS.md` ya no dice "`/en` → 308" si el código cambió.
    - `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm format:check` y `pnpm quality` terminan con código 0, y `no-leaks` no encuentra nada.
    - Todo commiteado en local, **sin push**.

- [ ] **Parada final (coordinador, no implementer). Autorización y alta (RP-2, RF-38, sección 10 del plan).** RF-1, RF-7, RF-8, RF-35, RF-37, RF-39
  - El coordinador pide la autorización al usuario y le guía: crear el entorno `staging` restringido a main → push a main (CI en verde con el despliegue omitido por falta de secretos) → crear los tres secretos → relanzar → despliegue y smoke en verde.
  - Se anotan en la spec: fecha de autorización; RF-7 (panel), RF-8 (coste 0 €), RF-35 (restricción del entorno), RF-38 (alta), RF-39 (registro sin la URL en claro); revisión del usuario en el móvil y en escritorio (inicio y 404, ES y EN); cabecera `X-Robots-Tag: noindex` comprobada.
  - Si el smoke real difiere de lo observado en T5: RP-3 o RP-4, con tareas nuevas.
