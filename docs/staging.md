# Entorno de prueba (staging) y CI

La web pública tiene un entorno de prueba en Cloudflare: un Worker llamado `agencymac-staging` que sirve la build de producción en `agencymac-staging.<subdominio>.workers.dev`. El CI de GitHub Actions lo actualiza solo en cada push a `main`, siempre que todo el CI termine en verde. Es la misma build que se prueba (tests y Lighthouse), con un único añadido: un archivo de cabeceras que marca todas las respuestas con `X-Robots-Tag: noindex` (Google no la indexa) y con la versión desplegada (`X-Staging-Version`, el SHA del commit).

La URL de prueba no aparece en el repositorio ni en los registros del CI. Se consulta en el panel de Cloudflare: Workers & Pages → `agencymac-staging`.

## Cómo funciona el CI

El workflow está en `.github/workflows/ci.yml` y tiene dos jobs:

- **`check`** (cada push y cada PR hacia `main`): instala con el lockfile congelado, instala Chromium, pasa lint y formato, compila las dos apps **una sola vez** y ejecuta los tests y Lighthouse sobre esa build. En los pushes, guarda la build de la web para el despliegue.
- **`deploy`** (solo push a `main`, después de `check` en verde): comprueba que los tres secretos existen y que el commit sigue siendo la punta de `main`; si no, se salta con un aviso y el CI queda en verde. Después prepara la copia de staging (build + archivo de cabeceras), despliega el Worker con wrangler y pasa el smoke test contra la URL de prueba. Si el smoke test falla, el check queda en rojo y se corrige con otro push (no hay vuelta atrás automática).

Los despliegues van en serie y nunca se cancelan. No hay forma de lanzarlo a mano ni despliegues por PR.

## Alta inicial (una sola vez, la hace el usuario)

Ningún agente crea cuentas ni ve, copia o guarda tokens, IDs de cuenta, el subdominio ni secretos. Sigue estos pasos **en este orden**:

1. **Cuenta de Cloudflare y subdominio de `workers.dev`.** Crea una cuenta gratuita de Cloudflare y activa el subdominio de `workers.dev` de la cuenta (Cloudflare lo pide al crear el primer Worker, o desde Workers & Pages). Anota el subdominio solo en un lugar privado.
   - **Elige un subdominio largo y poco común** (nada de `agency`, `mac`, `test` ni palabras frecuentes). GitHub enmascara ese texto con `***` en **todo** el registro del CI: un subdominio corto o común taparía partes normales de los registros y los haría ilegibles.
2. **Token de API personalizado.** En Cloudflare: My Profile → API Tokens → Create Token → Create Custom Token.
   - Permisos: **solo** `Account` → `Workers Scripts` → `Edit`.
   - Account Resources: solo tu cuenta.
   - TTL: fecha de fin a **12 meses como máximo**. Anota la fecha de renovación en un lugar privado.
   - Riesgo aceptado: el token puede editar cualquier Worker de la cuenta. Se revisará al pasar a producción.
   - Anota también el **Account ID** (aparece en el panel de la cuenta, en Workers & Pages). Copia el token una sola vez directamente al paso 4; no lo guardes en ningún archivo.
3. **Entorno `staging` en GitHub, ANTES de subir el workflow a `main`.** En el repositorio: Settings → Environments → New environment → nombre `staging` → Deployment branches and tags → Selected branches and tags → añade solo `main`.
   - Si el entorno ya existe porque GitHub lo creó automáticamente (por ejemplo, porque el workflow llegó a `main` antes que este paso), **revísalo y restríngelo a `main`** antes de seguir.
   - No pongas URL en el entorno.
4. **Los tres secretos, en el entorno `staging`** (no en los secretos del repositorio): Settings → Environments → `staging` → Environment secrets → Add secret.

   | Secreto                 | Valor                                                           |
   | ----------------------- | --------------------------------------------------------------- |
   | `CLOUDFLARE_API_TOKEN`  | El token del paso 2                                             |
   | `CLOUDFLARE_ACCOUNT_ID` | El Account ID del paso 2                                        |
   | `CF_WORKERS_SUBDOMAIN`  | Solo el subdominio del paso 1, sin `https://` ni `.workers.dev` |

   **Crear los secretos equivale a autorizar el despliegue.** Mientras falte alguno, el job `deploy` se salta con un aviso que dice qué secreto falta (por nombre, nunca por valor) y el CI queda en verde.

5. **Primer despliegue.** Relanza la última ejecución del workflow en `main` (Actions → la ejecución → Re-run all jobs) o haz un push nuevo a `main`. Cuando el job `deploy` termine en verde, abre la URL desde el panel de Cloudflare (Workers & Pages → `agencymac-staging`) y revísala en el móvil y en el escritorio.

## Renovar el token

Antes de la fecha de caducidad, crea un token nuevo con los mismos permisos (paso 2) y sustituye el valor de `CLOUDFLARE_API_TOKEN` en el entorno `staging`. Después revoca el token antiguo en Cloudflare. Si el token caduca, el paso de despliegue falla en rojo hasta que lo renueves.

## Probar la copia de staging en local

Sin cuenta ni token: wrangler sirve la copia en local con el mismo motor de archivos estáticos que Cloudflare.

```sh
pnpm --filter web build
pnpm --filter web staging:local                           # copia + wrangler dev en el 8787
pnpm smoke --url http://localhost:8787 --version local    # en otra terminal
```

- `staging:local` crea `apps/web/.staging/` (copia de la build + `_headers`, ignorada por git). La carpeta `dist` no se modifica.
- En Windows, parar `wrangler dev` deja vivo `workerd.exe` en el 8787: mata el árbol de procesos con `taskkill /PID <pid> /T /F` y comprueba que el puerto queda libre.
- La telemetría de wrangler está desactivada (`WRANGLER_SEND_METRICS=false`) en los scripts y en el CI.

## Comportamiento del Worker (y del servidor local)

Cloudflare sirve los archivos con `html_handling: "auto-trailing-slash"` y `not_found_handling: "404-page"`. El servidor local de la preview (`scripts/serve-static.mjs`) copia estos códigos, observados con `wrangler dev`:

| Petición                                 | Respuesta                               |
| ---------------------------------------- | --------------------------------------- |
| `/en`, `/en?x=1`                         | 307 a `/en/` (conserva la query)        |
| `/index.html`, `/en/index.html`          | 307 a `/` y `/en/` (conserva la query)  |
| `/404`, `/en/404`                        | 200 con la página 404 de su idioma      |
| `/404.html`, `/en/404.html`              | 307 a `/404` y `/en/404`                |
| URL inexistente (`/no-existe/`, `/en/x`) | 404 con la página de error de su idioma |
| Mayúsculas (`/EN/`, `/Favicon.svg`)      | 404 en español                          |
| `/_headers`, `/_redirects`               | 404 (nunca se sirven)                   |

En staging, todas las respuestas llevan además `X-Robots-Tag: noindex`.

## Lo que nunca se versiona

La URL de prueba, el subdominio de la cuenta, el Account ID, los tokens y la carpeta `.wrangler/` (estado local de wrangler). Un test (`scripts/no-leaks.test.mjs`) falla si aparece cualquier host concreto de `workers.dev`, un secreto con valor o un archivo `.env`, `.dev.vars` o de `.wrangler/`. En la documentación, escribe siempre la parte variable como `<subdominio>` o `*`.
