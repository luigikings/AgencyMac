# Imágenes de marca (derivados)

Los originales (logos, Mac, Luna y planetas) viven en la carpeta `Assets/` de la raíz, que **no se versiona** (repositorio público): solo estos derivados, recortados y optimizados, están en el repo. Se generan con `pnpm assets:build` (`scripts/assets/build-derivatives.mjs`) y `pnpm assets:check` comprueba que los originales siguen siendo los mismos. La tabla única de procedencia y recetas es `scripts/assets/manifest.mjs`; este documento la refleja.

Todos los derivados son propiedad de AgencyMac y están cubiertos por [`LICENSE-BRAND.md`](../../../../../LICENSE-BRAND.md).

| Derivado                                  | Original (en `Assets/`)                      | SHA-256 del original                                               | Receta                                                                                    |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/assets/brand/logo-white-letters.png` | `Logos/IMAGOLOGO LETRAS BLANCAS.png`         | `4ec8c91efd73506e692c987d66f0d670e81a083f38aaa66b0de447a0896de774` | Recorte al contenido, máx. 960 × 640, PNG de paleta                                       |
| `src/assets/brand/isologo.png`            | `Logos/ISOLOGO.png`                          | `a8b138646529c11314a5c5c104c502b88cd6fd8fe9641fca7a6571800f73b8bf` | Recorte al contenido, máx. 360 × 640, PNG de paleta                                       |
| `src/assets/brand/mac.webp`               | `Mac/Alien Mac.png`                          | `ab10af543278c269f30f710cf2aa32c3f5be88afa12c67b5ab2963890ce85d2c` | Limpieza de alfa (< 16 → 0, ≥ 240 → 255), recorte al contenido, cuadrado, 768 × 768, WebP |
| `src/assets/brand/moon.webp`              | `Planetas/Luna.png`                          | `1dd4fd3b6493d1a4aa244ab8581ecf1065f465f92c19bdf12c4f9a9e114c8d36` | Ídem, 733 × 733 (el contenido cuadrado es menor que el máximo de 768)                     |
| `src/assets/brand/planet-hexaweb.webp`    | `Planetas/Hexaweb - Desarrollo web.png`      | `3d8bfe0e235c4c6e3f6f2fb9258ae766b22890e9b49e00cccac36db8971a2d58` | Ídem, 640 × 640                                                                           |
| `src/assets/brand/planet-rankia.webp`     | `Planetas/Rankia - Posicionamiento.png`      | `ded700b3b510f7b56ac7883834b38a93269a536149e13d3da660afee6d21dab1` | Ídem, 640 × 640                                                                           |
| `src/assets/brand/planet-adara.webp`      | `Planetas/Adara - Publicidad pagada SEM.png` | `48f8d531bd28eb2b9520dfbaf9ee00891c67b771fa24638080c1a1de86a9f778` | Ídem, 640 × 640                                                                           |
| `src/assets/brand/planet-earth.webp`      | `Planetas/Tierra.png`                        | `85e52092d5c90cc1c3cdee425149b1b49696c8690a404a9666f5f052f383b35d` | Ídem, 320 × 320 (adorno de proyectos)                                                     |
| `public/favicon-48.png`                   | `Logos/ISOLOGO.png`                          | `a8b138646529c11314a5c5c104c502b88cd6fd8fe9641fca7a6571800f73b8bf` | Recorte al contenido sobre cuadrado de 48 px con margen del 10 %, fondo `bgDark`          |
| `public/apple-touch-icon.png`             | `Logos/ISOLOGO.png`                          | `a8b138646529c11314a5c5c104c502b88cd6fd8fe9641fca7a6571800f73b8bf` | Ídem, 180 px, margen del 16 %, fondo `bgDark`                                             |
| `public/logo-512.png`                     | `Logos/ISOLOGO.png`                          | `a8b138646529c11314a5c5c104c502b88cd6fd8fe9641fca7a6571800f73b8bf` | Ídem, 512 px, margen del 6 %, fondo transparente                                          |
| `public/og-default.png`                   | `Logos/IMAGOLOGO LETRAS BLANCAS.png`         | `4ec8c91efd73506e692c987d66f0d670e81a083f38aaa66b0de447a0896de774` | Logo centrado en 1200 × 630 sobre `bg` (colores de `tokens.ts`)                           |

## Notas

- Los originales de Mac, la Luna y los planetas ya traen transparencia. La receta no los recorta de nuevo: limpia el ruido de alfa, recorta al contenido, los hace cuadrados y los reduce. En cada recorte, `build-derivatives` comprueba antes de escribir que las esquinas y los puntos medios de los bordes son transparentes y que las muestras interiores (ojos de Mac, base de la nave, cuerpo de cada planeta) siguen opacas.
- El SHA-256 no permite reconstruir el original: solo detecta que ha cambiado.
- Astro genera AVIF y WebP en varios tamaños en cada build a partir de estos maestros.
