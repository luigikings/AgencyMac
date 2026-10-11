# AGENTS.md — apps/control

Centro de Control: panel interno de AgencyMac para gestionar contactos, clientes y proyectos. Solo lo usa el equipo. Las reglas generales están en el `AGENTS.md` raíz; aquí solo van las de esta app.

## Stack

- React 19 + Vite 8, TypeScript estricto.
- Tests: Vitest para la lógica (`src/lib/*.test.ts`) y Playwright para e2e (`e2e/`).
- Login: Cloudflare Access (no se programa autenticación propia). Datos: Cloudflare D1 cuando llegue el CRM.

## Comandos (desde la raíz)

- Arrancar: `pnpm dev:control`
- Build: `pnpm --filter control build` (preview en el puerto 4173: `pnpm --filter control preview`)
- Tests: `pnpm test` (incluye el proyecto `control` de Playwright)

## Reglas

- Uso interno: la interfaz va solo en español (excepción a la regla ES/EN de la web pública).
- Siempre `noindex, nofollow`: el panel no debe aparecer en buscadores.
- Nunca se despliega sin Cloudflare Access delante.
- Los datos de clientes y contactos nunca llegan al repo (ni en fixtures, seeds ni capturas) ni a los logs. Los tests usan datos inventados.
- La lógica va en funciones puras en `src/lib/`, separada de los componentes, con su test.
