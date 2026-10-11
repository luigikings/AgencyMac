# AGENTS.md — apps/web

Web pública de AgencyMac: la carta de presentación de la agencia ante clientes. Tiene que impresionar y posicionar en buscadores en ES y EN. Las reglas generales están en el `AGENTS.md` raíz; aquí solo van las de esta app.

## Stack

- Astro 7 con salida estática (`output: "static"`). GSAP/ScrollTrigger, Lenis y Rive llegan en la spec 002.
- Tests: Vitest para la lógica (`src/lib/*.test.ts`) y Playwright + axe-core para e2e (`e2e/`), con JavaScript desactivado.
- Auditoría: Lighthouse CI (`lighthouserc.cjs`) con el `chrome-headless-shell` de Playwright, perfil móvil, mediana de 3 ejecuciones.

## Comandos (desde la raíz)

- Arrancar: `pnpm dev:web`
- Build: `pnpm --filter web build` (preview de producción en el puerto 4322: `pnpm --filter web preview`; `astro dev` usa el 4321)
- Tests: `pnpm test` (incluye el proyecto `web` de Playwright)
- Auditoría: `pnpm quality`

## Reglas

- Todo texto visible existe en ES (principal) y EN. Nunca un texto en un solo idioma. Comprueba los dos idiomas en cada cambio.
- El contenido va en el HTML generado y se ve sin JavaScript. Las animaciones solo decoran: nunca ocultan texto a Google.
- Toda animación respeta `prefers-reduced-motion`: con movimiento reducido, el contenido aparece directamente.
- SEO en cada página: `lang`, `<title>` y meta description propios, un solo `h1`, y lo que pida la skill seo-tecnico.
- Nunca `noindex` en la web pública.
- Lighthouse (móvil) ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO. `pnpm quality` falla si alguna baja.
- Accesibilidad: contraste AA y sin infracciones de axe en los e2e.
- La telemetría de Astro está desactivada en los scripts (`ASTRO_TELEMETRY_DISABLED=1`); mantenla así en los scripts nuevos.
- Los tokens de marca (colores, tipografías Lilita One + Lato) vivirán en un solo lugar cuando lleguen en la spec 002; no se escriben colores sueltos por los componentes.
