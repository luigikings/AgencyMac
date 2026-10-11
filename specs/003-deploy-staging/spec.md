# Spec 003 — Entorno de prueba (staging) y CI

Estado: aprobada (2026-10-11)

Depende de: spec 002 (esqueleto de la web pública), ya implementada.

## Contexto y objetivo

Hoy la web pública solo se ve en local, y nada comprueba automáticamente que cada cambio que llega a main pase lint, formato, build, tests y Lighthouse. El equipo necesita una URL de prueba que se actualice sola con cada push a main para revisar la web desde el móvil, y saber cuanto antes si el alojamiento real (Cloudflare) se comporta igual que el servidor local que lo imita (404 por idioma, redirección de `/en`, mayúsculas, tipos de archivo). Así, el día del lanzamiento en `agencymac.com` no habrá sorpresas. Todo con coste 0 €, sin tocar el dominio `agencymac.com` ni su DNS, sin que Google indexe el entorno de prueba, sin que la build de producción lleve nunca `noindex` y sin que ningún secreto ni dato reservado llegue al repositorio público ni a sus registros. El Centro de Control no se despliega en esta spec.

## Usuarios

- El equipo de AgencyMac (revisa la web en la URL de prueba, también desde el móvil).
- Los desarrolladores y agentes de IA, que reciben el resultado del CI en cada push a main y en cada PR hacia main.
- Colaboradores externos que abren PRs desde un fork (su código pasa el CI, pero no puede desplegar ni leer secretos).
- Buscadores, que no deben indexar el entorno de prueba.

## Historias de usuario

- HU-1. Como miembro del equipo, quiero que un push a main actualice sola la web de prueba para revisarla desde el móvil sin instalar nada ni dar pasos manuales.
- HU-2. Como desarrollador, quiero que cada push a main y cada PR hacia main pasen automáticamente lint, formato, build, tests y Lighthouse para no romper la web sin darme cuenta.
- HU-3. Como desarrollador, quiero comprobar contra la URL desplegada que Cloudflare responde igual que el servidor local para que los tests locales sigan siendo fiables.
- HU-4. Como responsable de SEO, quiero que el entorno de prueba no se indexe y que la build de producción nunca lleve `noindex`.
- HU-5. Como responsable del repo público, quiero que el despliegue no exponga ningún secreto ni dato reservado, ni siquiera a PRs de forks, a otras ramas o en los registros.

## Definiciones

- **Entorno de prueba (staging)**: despliegue de la web pública en el Worker de Cloudflare `agencymac-staging`, servido en el subdominio gratuito `*.workers.dev` de la cuenta. Nunca en `agencymac.com` ni en sus subdominios.
- **Subdominio de la cuenta**: la parte variable de las URLs `*.workers.dev` de la cuenta de Cloudflare. Es un dato reservado.
- **URL de prueba**: `https://agencymac-staging.<subdominio de la cuenta>.workers.dev/`, la URL principal y estable del Worker (no las URLs de vista previa por versión). El job de despliegue la compone a partir del secreto con el subdominio de la cuenta; nunca se versiona ni se muestra en claro en los registros.
- **Producción**: la futura web en `https://agencymac.com`. No se despliega en esta spec.
- **Build de producción (dist)**: el resultado de compilar la web tal cual se publicaría en producción. En el CI se genera una sola vez por ejecución y la usan los tests en navegador, Lighthouse y el despliegue.
- **Copia de staging**: la build de producción que pasó el CI más un único archivo de reglas de cabeceras que el despliegue añade solo a lo que sube a staging. Ese archivo nunca está en el repo ni en la build de producción.
- **Identificador de versión**: el identificador del commit desplegado, que la copia de staging expone en una cabecera HTTP propia.
- **Entorno de GitHub "staging"**: entorno de despliegue de GitHub restringido a la rama main, donde viven los secretos de despliegue.
- **Secretos de despliegue**: los tres datos reservados guardados solo como secretos del entorno "staging": el token de API de Cloudflare, el ID de cuenta de Cloudflare y el subdominio de la cuenta.
- **Alta inicial**: lo que el usuario hace una sola vez y a mano: crear la cuenta de Cloudflare, el token, el entorno "staging" con su restricción a main y los tres secretos en él. Crear los secretos equivale a autorizar el despliegue.
- **CI**: ejecución automática en GitHub Actions por push a main o por un PR hacia main.
- **Comprobación del CI completa**: install (con lockfile congelado), lint, format:check, build, test (Vitest + Playwright de las dos apps) y quality (Lighthouse), todas en verde.
- **Smoke test de staging**: comprobaciones HTTP contra una URL desplegada. Su lógica (qué se espera de cada respuesta) es pura y se prueba con respuestas simuladas; solo una capa fina hace las peticiones reales.
- **Servidor local**: el servidor estático que sirve la build en local para tests y Lighthouse e imita a Cloudflare.

## Requisitos funcionales

Métodos de verificación:

- _Test del workflow_: test automático (en `pnpm test`) que lee la definición del workflow y comprueba su estructura.
- _Test de lógica_: test automático de la lógica pura del smoke test con respuestas simuladas (y reloj inyectado cuando haga falta), en verde y en rojo.
- _Test de dist_: test automático sobre la build de producción.
- _Test local_: test automático del servidor local.
- _Test del repo_: test automático que recorre los archivos versionados.
- _Smoke_: ejecución real del smoke test contra la URL de prueba, automática tras cada despliegue.
- _Manual (excepción)_: no automatizable; se verifica a mano y se anota en la spec al cerrar, como RF-21 de la 002.

### Despliegue automático

- RF-1: CUANDO se hace push a main en GitHub y la comprobación del CI completa termina en verde, EL SISTEMA despliega la copia de staging en la URL de prueba de forma automática, sin ningún paso manual (la única intervención humana es el alta inicial, una sola vez). _Verifica: Test del workflow (el despliegue solo corre en push a main y depende de todos los pasos del CI) + Smoke (se sirve el commit recién subido)._
- RF-2: SI algún paso de la comprobación del CI falla antes del despliegue (install, lint, format:check, build, test o quality, incluido un Lighthouse por debajo del mínimo), ENTONCES EL SISTEMA no despliega y la URL de prueba sigue sirviendo la versión anterior. _Verifica: Test del workflow (el despliegue depende de todos los pasos)._
- RF-3: CUANDO el evento es un PR (de una rama del repo o de un fork) o cualquier otro que no sea un push a main, EL SISTEMA no despliega; no existe forma de lanzar el despliegue a mano. _Verifica: Test del workflow (condición de despliegue; sin disparador manual)._
- RF-4: SI en el momento de desplegar el commit de la ejecución ya no es la punta de main, ENTONCES EL SISTEMA omite el despliegue con un aviso, el check queda en verde y nunca se publica un commit anterior al ya desplegado. _Verifica: Test del workflow (comprobación previa al despliegue) + prueba con dos pushes seguidos anotada._
- RF-5: SI el smoke test falla después de desplegar, ENTONCES EL SISTEMA marca la ejecución en rojo y no vuelve atrás automáticamente; la versión puede quedar publicada en staging y se corrige con otro push. _Verifica: Test del workflow (sin paso de vuelta atrás; el smoke test es un paso obligatorio tras el despliegue)._
- RF-6: EL SISTEMA despliega solo la web pública; el Centro de Control no se publica en ningún sitio en esta spec. _Verifica: Test del workflow (solo se sube la build de la web) + Smoke (RF-15)._
- RF-7: EL SISTEMA no crea, modifica ni enlaza ningún dominio propio, ruta, registro DNS ni zona de `agencymac.com`; solo usa el subdominio gratuito `*.workers.dev`. _Verifica: Test del workflow y de la configuración de despliegue (sin dominios ni rutas) + Manual (excepción): el usuario confirma en el panel de Cloudflare que `agencymac.com` no tiene cambios._
- RF-8: EL SISTEMA funciona dentro del plan gratuito de Cloudflare Workers y de los minutos gratuitos de GitHub Actions para repos públicos, sin activar ningún plan de pago. _Verifica: Manual (excepción): el usuario lo confirma en sus paneles al cerrar._

### Build única, limpia, y copia de staging

- RF-9: EL SISTEMA genera una build de producción sin ningún `noindex`: ningún HTML lleva meta robots con `noindex` o `none` y ninguna regla de cabeceras de la build contiene `noindex`; en esta spec la build no contiene ningún archivo de reglas de cabeceras. _Verifica: Test de dist (falla indicando el archivo)._
- RF-10: CUANDO despliega, EL SISTEMA añade solo a la copia que sube a staging un único archivo de reglas de cabeceras que aplica a todas las rutas (`/*`) la cabecera `X-Robots-Tag: noindex` y la cabecera con el identificador de versión. _Verifica: Test del workflow (el archivo se crea en el job de despliegue, fuera del repo, sobre la copia) + Smoke (RF-14, RF-25)._
- RF-11: EL SISTEMA compila cada app una sola vez por ejecución del CI; los tests en navegador, Lighthouse y el despliegue usan esa misma build de la web (los mismos bytes), sin volver a compilar, y el despliegue solo le añade el archivo de RF-10. El uso local de `pnpm test` y `pnpm quality` no cambia (siguen compilando por sí mismos). _Verifica: Test del workflow (un solo paso de build; tests, quality y despliegue reciben esa build y no ejecutan ningún build) + ejecución local de `pnpm test` y `pnpm quality` en verde._
- RF-12: EL SISTEMA compone la URL de prueba en el job de despliegue a partir del nombre del Worker y del secreto con el subdominio de la cuenta (no la lee de la salida de la herramienta de despliegue), y nunca la guarda en un archivo versionado. _Verifica: Test del workflow (la URL se compone a partir del secreto) + Test del repo (RF-36)._

### Smoke test de staging (paridad con el servidor local)

- RF-13: EL SISTEMA ofrece un smoke test que recibe la URL a comprobar y el identificador de versión esperado, ejecuta todas las comprobaciones de RF-14 a RF-27 y termina con código distinto de cero si alguna falla. _Verifica: Test de lógica (casos en verde y en rojo) + Smoke._
- RF-14: CUANDO arranca el smoke test, EL SISTEMA reintenta, con un límite fijo de 3 minutos como máximo, hasta que la cabecera de versión de la URL de prueba coincida con el identificador esperado; SI no coincide dentro del límite, ENTONCES falla indicando la versión obtenida. _Verifica: Test de lógica con reloj inyectado (coincide a la primera, coincide tras reintentos, se agota el límite)._
- RF-15: CUANDO se pide `/` o `/en/`, EL SISTEMA (staging) responde 200 con la página de inicio de la web pública en su idioma (atributo de idioma `es` o `en` y nombre de la web en el título) y nunca con la página del Centro de Control (su título no aparece). _Verifica: Test de lógica + Smoke._
- RF-16: CUANDO se pide una URL inexistente sin prefijo `/en/` (`/no-existe/` y `/no-existe`), EL SISTEMA (staging) responde 404 con la página de error en español; CUANDO empieza por `/en/` (`/en/no-existe/` y `/en/no-existe`), responde 404 con la página de error en inglés. _Verifica: Test de lógica + Smoke (estado e idioma)._
- RF-17: CUANDO se pide `/404`, `/404.html`, `/en/404` o `/en/404.html`, EL SISTEMA (staging y servidor local) responde con estado 404 y la página de error de su idioma (ES para las dos primeras, EN para las dos últimas); una página de error servida con estado 200 nunca es aceptable. _Verifica: Test de lógica + Smoke + Test local._ (Si la configuración de Cloudflare no lo permite, se aplica RP-4.)
- RF-18: CUANDO se pide `/index.html` o `/en/index.html`, EL SISTEMA (staging y servidor local) redirige a `/` y `/en/` respectivamente, o responde 200 con la misma página y su canonical; nunca 404. El comportamiento de Cloudflare se anota y el servidor local se alinea con él. _Verifica: Test de lógica + Smoke + Test local._
- RF-19: CUANDO se pide `/en` sin barra final, EL SISTEMA (staging) redirige a `/en/` conservando la query string (`/en?x=1` → `/en/?x=1`) y nunca responde 404. _Verifica: Test de lógica + Smoke (estado y cabecera de destino)._
- RF-20: EL SISTEMA (servidor local) usa en RF-18 y RF-19 los mismos códigos de redirección que Cloudflare; SI difieren, ENTONCES se ajusta el servidor local a Cloudflare. _Verifica: Smoke + Test local con el código observado en Cloudflare._
- RF-21: SI se pide una URL con mayúsculas (`/EN/`, `/En/`, `/Favicon.svg`), ENTONCES EL SISTEMA (staging) responde 404 con la página de error en español, igual que el servidor local. _Verifica: Test de lógica + Smoke + Test local._
- RF-22: CUANDO se pide el favicon declarado en las páginas, EL SISTEMA (staging) responde 200 con tipo de contenido `image/svg+xml`. _Verifica: Test de lógica + Smoke._
- RF-23: CUANDO se pide cualquier tipografía woff2 referenciada por `/` o por `/en/`, EL SISTEMA (staging) responde 200 con tipo de contenido `font/woff2`. _Verifica: Test de lógica + Smoke (lee las URLs de fuentes del HTML/CSS servido)._
- RF-24: CUANDO se pide un archivo de reglas de cabeceras o de redirecciones del alojamiento, EL SISTEMA (staging y servidor local) responde 404 y nunca lo sirve como contenido. _Verifica: Smoke + Test local con una build de prueba ficticia que contiene esos archivos._
- RF-25: EL SISTEMA (staging) incluye `X-Robots-Tag: noindex` en las respuestas 200, 3xx y 404 (al menos `/`, `/en/`, `/en` → `/en/`, una 404 ES, una 404 EN y el favicon). _Verifica: Test de lógica + Smoke._ (Si Cloudflare no permite añadirla a sus 3xx, se aplica RP-4.)
- RF-26: EL SISTEMA (staging) mantiene la canonical y los hreflang de `/` y `/en/` apuntando a `https://agencymac.com`. _Verifica: Test de lógica + Smoke._
- RF-27: SI una comprobación del smoke test no se cumple, ENTONCES EL SISTEMA indica en el registro la ruta relativa (p. ej. `/en/no-existe/`), el valor esperado y el obtenido, sin imprimir en claro la URL de prueba ni el host. _Verifica: Test de lógica (los mensajes no contienen el host recibido)._

### Integración continua

- RF-28: CUANDO se hace push a main o se abre o actualiza un PR hacia main, EL SISTEMA ejecuta la comprobación del CI completa y marca el commit o el PR como fallido si cualquier paso falla; los pushes a otras ramas no lanzan el CI. _Verifica: Test del workflow (disparadores) + ejecución real en un push y en un PR anotada._
- RF-29: EL SISTEMA no usa disparadores que den secretos o permisos de escritura a código de PRs (p. ej. `pull_request_target` o `workflow_run`) ni disparadores manuales. _Verifica: Test del workflow._
- RF-30: EL SISTEMA instala las dependencias con el lockfile congelado (falla si no coincide con `package.json`), con la versión de Node fijada en el repo y la de pnpm fijada en el repo vía corepack, de forma que la instalación falle igual que en local si no coinciden. _Verifica: Test del workflow + registro del CI con las versiones impresas._
- RF-31: EL SISTEMA instala en el CI el navegador de Playwright junto con las dependencias del sistema que necesita en Linux, antes de los tests y la auditoría. _Verifica: Test del workflow + registro del CI._
- RF-32: EL SISTEMA concede al CI únicamente el permiso `contents: read` sobre el repositorio, en todos los jobs (incluido el de despliegue), y ningún permiso de escritura. _Verifica: Test del workflow._
- RF-33: CUANDO llega un push o una actualización de PR nueva en la misma rama, EL SISTEMA cancela las ejecuciones antiguas del CI de esa rama, pero nunca cancela un despliegue en curso; los despliegues se ejecutan en serie, nunca solapados. _Verifica: Test del workflow (concurrencia del CI y grupo de concurrencia propio del despliegue sin cancelación)._
- RF-34: CUANDO un paso del CI falla, EL SISTEMA muestra en el registro el paso y el motivo; los únicos artefactos que sube el CI son la build de producción (que es pública), nunca informes, trazas ni capturas con datos reservados. _Verifica: Test del workflow (artefactos subidos) + fallo provocado anotado._

### Secretos, URL y alta inicial

- RF-35: EL SISTEMA guarda los tres secretos de despliegue solo en el entorno de GitHub "staging", restringido a la rama main, y solo el job de despliegue (incluido su smoke test) los usa; los PRs (incluidos los de forks) y las demás ramas no pueden leerlos. _Verifica: Test del workflow (los secretos solo aparecen en el job de despliegue con el entorno "staging") + Manual (excepción): el usuario confirma la restricción a main en la configuración del entorno._
- RF-36: EL SISTEMA no guarda en el repositorio ningún token, ID de cuenta, subdominio de la cuenta, URL de prueba, archivo `.env` ni credencial de Cloudflare. _Verifica: Test del repo que falla, indicando archivo y línea, si en los archivos versionados (a) aparece cualquier host `*.workers.dev` distinto del marcador literal `agencymac-staging.<subdominio>.workers.dev`; (b) alguno de los tres nombres de secreto aparece asignado a un valor literal en lugar de a una referencia a los secretos de GitHub; o (c) hay un archivo `.env` versionado distinto de `.env.example`. No busca cadenas hexadecimales genéricas, para no dar falsos positivos con el lockfile ni con los SHA de las acciones._
- RF-37: SI falta cualquiera de los tres secretos de despliegue (todos o solo algunos), ENTONCES EL SISTEMA omite el despliegue y su smoke test con un aviso visible que indica qué falta (por nombre, nunca por valor) y el CI termina en verde. _Verifica: Test del workflow + ejecución real antes del alta inicial anotada._
- RF-38: EL SISTEMA incluye en la documentación del repo las instrucciones paso a paso del alta inicial, en este orden: (1) crear la cuenta de Cloudflare y anotar su subdominio de `workers.dev`; (2) crear un token con permiso solo de Workers y caducidad de 12 meses como máximo, sabiendo que podrá editar cualquier Worker de la cuenta (riesgo aceptado, se revisa al pasar a producción) y anotando la fecha de renovación; (3) crear el entorno "staging" restringido a main ANTES de que el workflow que lo referencia llegue a main; (4) guardar en él los tres secretos. _Verifica: revisión de la documentación + Manual (excepción): el usuario completa el alta._
- RF-39: EL SISTEMA no muestra la URL de prueba en claro en los registros de GitHub Actions: se compone a partir del secreto con el subdominio de la cuenta, que GitHub enmascara, y el smoke test nunca la imprime. _Verifica: Test del workflow (la URL solo se forma a partir del secreto) + Test de lógica (RF-27) + Manual (excepción): revisión del registro de un despliegue real sin la URL en claro._
- RF-40: EL SISTEMA no publica la URL de prueba como URL del entorno de GitHub ni en Deployments, PRs o commits. _Verifica: Test del workflow (el entorno "staging" no declara URL)._

## Requisitos de proceso

- RP-1: Ningún agente crea cuentas ni genera, ve, copia o guarda tokens, IDs de cuenta, el subdominio de la cuenta ni secretos; el alta inicial la hace solo el usuario (RF-38).
- RP-2: Crear los secretos en el entorno "staging" equivale a autorizar el despliegue. Antes de eso no hay despliegue real (RF-37); el coordinador pide la autorización al usuario y el usuario crea los secretos. La fecha queda anotada en la spec.
- RP-3: Si el smoke test detecta una diferencia entre Cloudflare y el servidor local (RF-27), se corrige la configuración del alojamiento o el servidor local antes de cerrar la spec, y la diferencia y su solución quedan anotadas en esta spec y en `MEMORY.md`.
- RP-4: Si la configuración de Cloudflare no permite cumplir RF-17 (estado 404 en `/404`, `/404.html`, `/en/404` y `/en/404.html`) o RF-25 (`noindex` en las 3xx), el implementer PARA y decide el usuario. No se añade código de Worker ni dependencias nuevas sin su aprobación.

## Requisitos no funcionales

- RNF-1 (Coste): 0 €. Solo planes gratuitos de Cloudflare y GitHub Actions (repo público) (constitución 1).
- RNF-2 (Dependencias): la herramienta de despliegue (wrangler o la acción oficial de Cloudflare) y cualquier otra dependencia o acción nueva (incluida la que haga falta para leer el workflow en los tests) se justifican en el plan con su versión exacta y las aprueba el usuario (constitución 1, AGENTS.md "Pregunta antes").
- RNF-3 (Versiones): herramientas del CI con versión exacta; las acciones de terceros, fijadas por SHA de commit con la versión en un comentario, sin etiquetas móviles.
- RNF-4 (Reproducibilidad): la copia desplegada es la build que pasó el CI en ese mismo commit más el único archivo de cabeceras de RF-10 (RF-11).
- RNF-5 (Lógica separada): la lógica del smoke test (qué se espera de cada respuesta, cómo se comparan, los reintentos) son funciones puras sin red ni reloj; la red y el reloj se pasan como parámetro (constitución 3).
- RNF-6 (Tests primero): todo RF tiene test automático salvo las excepciones manuales anotadas (RF-7 en parte, RF-8, RF-35 en parte, RF-38 en parte, RF-39 en parte) (constitución 4).
- RNF-7 (Tiempo del CI): orientativo ≤ 15 min por ejecución completa; no bloquea el cierre.
- RNF-8 (Idiomas): el smoke test comprueba ES y EN. La spec no añade textos visibles en la web; el identificador de versión va en una cabecera, no en el HTML.
- RNF-9 (SEO producción): la build de producción sigue cumpliendo la spec 002 (RF-15 sin `noindex`, canonical y hreflang a `https://agencymac.com`) y Lighthouse ≥ 90 contra esa misma build, en local y en el CI (en el CI, la build única de RF-11).
- RNF-10 (Datos): el entorno de prueba no recoge datos de visitantes ni activa analíticas.

## Casos límite

- `/en` sin barra y con query string (RF-19); Cloudflare puede usar un código distinto del 308 local (RF-20).
- `/no-existe` y `/en/no-existe` sin barra (RF-16).
- `/404`, `/404.html`, `/en/404`, `/en/404.html`: estado 404 siempre, nunca 200 (RF-17). Hoy el servidor local sirve `/404.html` con 200: se corrige. Si Cloudflare no lo permite: RP-4.
- `/index.html`, `/en/index.html` (RF-18).
- `/EN/`, `/En/`, `/Favicon.svg` → 404 ES (RF-21).
- Archivos de reglas de cabeceras o redirecciones pedidos directamente (RF-24).
- Cloudflare no añade `X-Robots-Tag` a sus 3xx: RP-4.
- Cloudflare tarda en servir la versión nueva: el smoke test reintenta hasta el límite de 3 min (RF-14).
- Smoke test en rojo tras desplegar: la versión queda publicada en staging, sin vuelta atrás; se arregla con otro push (RF-5).
- Dos pushes seguidos a main: se cancela el CI antiguo, nunca un despliegue en curso; los despliegues van en serie y nunca se publica un commit anterior (RF-4, RF-33).
- Relanzar a mano una ejecución antigua de main: si su commit ya no es la punta de main, el despliegue se omite en verde (RF-4).
- PR desde un fork o PR que modifica el propio workflow: no recibe secretos ni despliega (RF-29, RF-35).
- Faltan uno, dos o los tres secretos: despliegue omitido con aviso y CI en verde (RF-37).
- Token caducado o revocado: falla el paso de despliegue en rojo y se renueva según el alta (RF-38).
- GitHub crea automáticamente el entorno "staging" sin restricción (p. ej. porque el workflow llegó a main antes que el alta): se revisa y se restringe a main antes de añadir los secretos (RF-38).
- Lighthouse en rojo por ruido del runner: se relanza el CI a mano; nunca se relajan los umbrales.
- Fallo de red al instalar dependencias o el navegador: el paso falla con mensaje claro; se relanza a mano.
- Lighthouse contra la URL de prueba: no se ejecuta (su SEO bajaría por el `noindex`).
- Robots.txt y sitemap aún no existen (fuera de alcance de la 002): el `noindex` de staging se garantiza solo por cabecera.
- Una regla de `noindex` que llegara a la build por error: el test de dist falla antes de desplegar (RF-9).

## Fuera de alcance

- Despliegue en producción, dominio `agencymac.com`, subdominios, DNS y migración del DNS.
- Despliegue del Centro de Control, Cloudflare Access, D1 y Resend.
- CI en pushes a ramas distintas de main; despliegues de vista previa por PR; lanzamiento manual del despliegue.
- Vuelta atrás automática.
- Cloudflare Pages y la compilación en Cloudflare.
- Código de Worker propio (solo assets estáticos), salvo aprobación según RP-4.
- Protección del entorno de prueba con contraseña o Cloudflare Access.
- Robots.txt, sitemap, Open Graph y JSON-LD (spec de la web pública).
- Lighthouse contra la URL desplegada. Analíticas, monitorización y alertas. Contenido real de la web.

## Criterios de finalización

- Todos los RF verificados según su método: `pnpm test` en verde (tests del workflow, de la lógica del smoke test, de dist, del servidor local y del repo); `pnpm quality` en verde en local; smoke test en verde contra la URL de prueba tras un despliegue real; CI en verde en un push a main y en un PR.
- Excepciones manuales hechas y anotadas: RF-7 (panel de Cloudflare), RF-8 (coste 0 €), RF-35 (restricción del entorno a main), RF-38 (alta completada), RF-39 (registro de un despliegue real sin la URL en claro); fecha de autorización (RP-2).
- Diferencias entre Cloudflare y el servidor local resueltas y anotadas (RP-3).
- Revisión manual por el usuario de la URL de prueba en el móvil (375 px aprox.) y en escritorio: inicio y 404, en ES y EN.
- Documentación actualizada: `AGENTS.md` raíz (comando del smoke test y regla de despliegue), `apps/web/AGENTS.md` (comportamiento del servidor local, hoy "`/en` → 308", si cambia), el comentario de cabecera del servidor local si cambia su comportamiento, y las instrucciones del alta (RF-38).
- `MEMORY.md` actualizado al cerrar.

## Decisiones (y por qué)

Decididas o confirmadas por el usuario el 2026-10-11.

- D1. **Workers con static assets** (URL `*.workers.dev`). Descartado: Cloudflare Pages con integración Git. Por qué: es lo que Cloudflare recomienda hoy para proyectos nuevos, soporta la 404 más cercana con estado 404, el control de la barra final y las reglas de cabeceras y redirecciones, y encaja con el futuro Centro de Control. Lo esencial para el usuario: un push a GitHub actualiza la web de prueba sola, sin pasos manuales después del alta inicial (RF-1).
- D2. **Build y despliegue desde GitHub Actions**, solo en push a main y con todo el CI en verde; **un fallo de Lighthouse bloquea el despliegue** (RF-1, RF-2). Descartado: build en Cloudflare (Workers Builds), porque compila fuera de la toolchain controlada del CI (Node, pnpm, `engineStrict`, `preinstall`), podría desplegar aunque el CI falle y complica el smoke test. La herramienta de despliegue concreta y su versión exacta se aprueban en el plan (RNF-2).
- D3. Nombre del Worker: **`agencymac-staging`**.
- D4. **Todo gira en torno a main**: CI en push a main y en PR hacia main; despliegue solo en push a main (RF-1, RF-3, RF-28). Se aparta del "cada push" literal de la petición inicial porque así lo ha confirmado el usuario.
- D5. **Sin despliegues de vista previa por PR**.
- D6. Si las redirecciones difieren, **se ajusta el servidor local a Cloudflare** (RF-18, RF-20), porque producción será Cloudflare.
- D7. **Canonical y hreflang siguen apuntando a `https://agencymac.com`** en staging (RF-26): el `noindex` evita la indexación y la canonical señala la URL definitiva.
- D8. **Secretos en el entorno de GitHub "staging", restringido a main**, no secretos de repositorio: así ni los forks ni las demás ramas pueden leerlos (RF-35); el entorno se crea en el alta, antes de que el workflow llegue a main (RF-38).
- D9. **El `noindex` no va en ningún archivo versionado ni en la build**: el despliegue añade solo a la copia de staging una regla `/*` con `X-Robots-Tag: noindex` (RF-10); la build queda limpia y un test la vigila (RF-9). Descartado: una regla limitada al host de prueba dentro de la build, porque obligaría a versionar la URL y metería `noindex` en el artefacto de producción.
- D10. **Sin vuelta atrás automática**: si el smoke test falla tras desplegar, el check queda en rojo y se arregla con otro push (RF-5). Por qué: es un entorno de prueba y la vuelta atrás añade complejidad y permisos.
- D11. **Crear los secretos = autorizar el despliegue**; si falta alguno, el despliegue se omite con aviso y el CI queda en verde (RF-37, RP-2).
- D12. **Sin lanzamiento manual, despliegues en serie y sin publicar commits antiguos**: el despliegue comprueba que su commit sigue siendo la punta de main y la concurrencia no cancela un despliegue en curso (RF-3, RF-4, RF-33). Por qué: evita que un relanzamiento o una carrera entre pushes deje en staging una versión vieja.
- D13. **Comprobación de versión por cabecera**: la regla de cabeceras de la copia de staging añade el identificador del commit y el smoke test reintenta hasta 3 min a que coincida (RF-10, RF-14). Por qué: no añade texto visible, no toca la build de producción y cabe en el único archivo añadido de D9. Descartada: la URL de versión que devuelve el despliegue, porque comprobaría esa versión aislada y no la URL principal que el equipo abre en el móvil.
- D14. **Una sola build por ejecución del CI**: los tests en navegador, Lighthouse y el despliegue usan la misma build, sin recompilar; el uso local de `pnpm test` y `pnpm quality` no cambia (cómo se consigue se decide en el plan) (RF-11, RNF-9). Como artefacto del CI solo se sube la build, que es pública; nunca informes de Lighthouse, trazas ni capturas, porque los artefactos de Actions de un repo público son descargables (RF-34).
- D15. **La URL de prueba no se versiona ni se muestra en claro en los registros**: un tercer secreto del entorno "staging" guarda el subdominio de la cuenta, el job compone la URL con él y GitHub la enmascara (RF-12, RF-39, RF-40). El usuario consulta la URL en su panel de Cloudflare. Descartados: leer la URL de la salida de la herramienta de despliegue (la imprimiría antes de poder enmascararla) y dejarla visible en los registros públicos.
- D16. **Riesgo del token aceptado**: el token solo tiene permiso de Workers, pero puede editar cualquier Worker de la cuenta; caduca en 12 meses como máximo y vive en el entorno restringido a main. Se revisará al pasar a producción (RF-38).

## Dudas abiertas

- Ninguna.
