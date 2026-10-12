# Spec 004 — Portada real de la web pública

Estado: implementada (2026-10-12)

Depende de: spec 002 (esqueleto bilingüe) y spec 003 (staging con despliegue automático en cada push a main), ambas implementadas.

## Contexto y objetivo

La web pública es la carta de presentación de AgencyMac y tiene que posicionar en español de España (mercado principal) y en inglés (mercado angloparlante). Hoy `/` y `/en/` solo muestran un texto provisional con el nombre de la marca escrito en una fuente. Esta spec convierte esas dos páginas en la portada real: presenta la agencia con su logo y su mascota Mac, explica sus tres servicios como planetas, enseña dos proyectos reales, presenta al equipo y ofrece el botón principal "Quiero despegar". Además estrena el movimiento de la marca (Mac viajando entre planetas y un fondo distinto por planeta) sin poner en riesgo el posicionamiento, la accesibilidad ni la velocidad: el contenido completo está en el HTML, se ve sin JavaScript y nunca arranca oculto en la parte visible; las animaciones solo lo decoran.

El botón "Quiero despegar" todavía no tiene formulario detrás (llega en la spec 006). Esta spec lo deja visible y funcional como enlace a una sección de contacto de la propia portada, preparada para que la 006 coloque ahí el formulario sin rediseñar nada.

## Usuarios

- Posibles clientes (negocios que buscan web, SEO o publicidad en Google) en España y en el mercado angloparlante, en móvil y en escritorio.
- Buscadores, redes sociales (al compartir la URL) y lectores de pantalla.
- El equipo de AgencyMac, que revisa la portada en el entorno de prueba (staging) desde el móvil.
- Los desarrolladores de las specs siguientes (páginas por servicio, formulario).

## Historias de usuario

- HU-1. Como posible cliente, quiero entender en segundos qué hace AgencyMac y qué servicios ofrece para decidir si me interesa.
- HU-2. Como posible cliente, quiero ver proyectos reales de la agencia para fiarme de ella.
- HU-3. Como posible cliente, quiero conocer a las personas del equipo y su especialidad.
- HU-4. Como posible cliente, quiero un botón claro para pedir presupuesto ("Quiero despegar"), sin enlaces rotos ni falsos.
- HU-5. Como visitante, quiero que la web se vea y funcione igual en mi idioma (ES o EN), en móvil de 320 px o más y sin tener que esperar a animaciones.
- HU-6. Como visitante con movimiento reducido o sin JavaScript, quiero ver todo el contenido directamente, sin animaciones ni desplazamiento suave.
- HU-7. Como buscador y como red social, quiero metadatos, datos estructurados y un mapa del sitio propios de cada idioma para indexar y mostrar bien la portada.
- HU-8. Como responsable de la marca, quiero que se vea el logo real y la mascota Mac, y que los archivos originales de las ilustraciones no usadas nunca lleguen al repositorio público.

## Definiciones

- **Portada**: las dos páginas de inicio, la española (ruta raíz) y la inglesa (con prefijo `/en/`).
- **Sección**: cada bloque de la portada: hero, servicios, proyectos, equipo y contacto.
- **Hero**: la primera sección: titular, lema, frase de marca, subtítulo, Mac sobre la Luna y botón "Descubre cómo".
- **Planeta de servicio**: cada uno de los tres servicios: Hexaweb (web), Rankia (SEO + mantenimiento) y Adara (Google Ads).
- **Plan base**: Hexaweb + Rankia. **Propulsor**: Adara, servicio extra que se suma al plan base.
- **CTA principal**: el botón "Quiero despegar" (pedir presupuesto).
- **Sección de contacto**: la sección final de la portada. Hoy muestra el estado "Formulario próximamente"; la spec 006 colocará ahí el formulario.
- **Planeta activo**: el planeta de servicio cuyo bloque contiene la línea de referencia, el centro vertical de la ventana. Solo existe cuando hay animación de desplazamiento (con JavaScript y sin movimiento reducido).
- **Parte visible al cargar**: lo que el visitante ve sin desplazarse (cabecera y hero).
- **Movimiento reducido**: el visitante tiene activada la preferencia del sistema de reducir el movimiento.
- **Animación de desplazamiento**: toda animación o desplazamiento suave disparado por el desplazamiento de la página.
- **Imagen recortada**: ilustración con fondo transparente derivada de un original que trae fondo opaco; el recorte quita solo el fondo exterior y deja intacto el interior de la ilustración.
- **Originales**: los archivos de ilustración y logo tal como los entrega el diseño (carpeta de trabajo sin versionar).
- **Textos propuestos**: los textos de la sección "Textos propuestos", redactados por el equipo de especificación y pendientes de aprobación del usuario.
- **Contenido visible sin JavaScript**: el que el servidor entrega en el HTML y un navegador sin JavaScript muestra sin pulsar nada.

## Requisitos funcionales

Cada RF indica cómo se verifica: _test automatizado_ (lógica o navegador, el plan concreta cuál) o _revisión manual_.

### Contenido y estructura

- RF-1: EL SISTEMA muestra en la portada, en este orden, las secciones hero, servicios, proyectos, equipo y contacto, en español en la ruta raíz y en inglés bajo `/en/`. _Verifica: test automatizado en los dos idiomas._
- RF-2: EL SISTEMA muestra en el hero un único encabezado principal que nombra el servicio y la propuesta de valor (agencia de diseño web, SEO y Google Ads que consigue clientes), el lema "Creamos ideas que parecen de otro planeta" como texto visible justo debajo, la frase de marca "¡Hazlo Galáctico! Hazlo MAC", un subtítulo, la imagen de Mac sobre la Luna y el botón "Descubre cómo", todo en HTML y sin depender de JavaScript. _Verifica: test automatizado sin JavaScript._
- RF-3: CUANDO el visitante pulsa "Descubre cómo", EL SISTEMA lo lleva a la sección de servicios de la propia portada, sin cargar otra página. _Verifica: test automatizado._
- RF-4: EL SISTEMA muestra en la sección de servicios exactamente tres planetas: Hexaweb (desarrollo web), Rankia (SEO y mantenimiento) y Adara (Google Ads), cada uno con su nombre como encabezado, una descripción, su ilustración con texto alternativo y una etiqueta que indica "Plan base" (Hexaweb y Rankia) o "Propulsor extra" (Adara). _Verifica: test automatizado._
- RF-5: EL SISTEMA no muestra ningún precio, tarifa ni símbolo de moneda en los textos de la portada. _Verifica: test automatizado de una regla de redacción sobre todos los textos en los dos idiomas (con casos de falsos positivos como "coste" o "gratis" documentados) + revisión manual de que ninguna imagen contiene precios ni texto de tarifas._
- RF-6: EL SISTEMA muestra en la sección de proyectos dos proyectos reales, Metal Renova y Magnar WarGames, cada uno con su nombre, una breve descripción y un enlace externo a su web (chatarreriametalrenova.es y magnarwargames.com) que se abre en una pestaña nueva y cuyo texto indica el destino y avisa de ello. _Verifica: test automatizado (destino, apertura y aviso en los dos idiomas) + revisión manual de que cada web abre._
- RF-7: EL SISTEMA no muestra capturas de pantalla ni otras imágenes de los proyectos. _Verifica: test automatizado._
- RF-8: EL SISTEMA muestra en la sección de equipo a Joni (Marketing), Samuel (Análisis) y Luigi (Coding), solo con su nombre y su rol, sin fotos, avatares ni apellidos. _Verifica: test automatizado._
- RF-9: EL SISTEMA muestra el botón "Quiero despegar" (en inglés, su traducción) en la cabecera y en la sección de contacto. _Verifica: test automatizado sin JavaScript._
- RF-10: CUANDO el visitante pulsa "Quiero despegar", EL SISTEMA lo lleva a la sección de contacto de la propia portada, que indica de forma visible "Formulario próximamente" (o su equivalente en inglés). _Verifica: test automatizado._
- RF-11: EL SISTEMA no incluye ningún enlace interno vacío, roto o falso: todo enlace de la portada hacia la propia web lleva a una sección que existe en la página o a una página que responde correctamente. Los enlaces externos de la sección de proyectos quedan fuera de esta comprobación (se verifican a mano en RF-6). _Verifica: test automatizado._
- RF-12: EL SISTEMA muestra en la navegación de la cabecera los enlaces Servicios, Proyectos, Quiénes somos y Contacto, cada uno hacia la sección que nombra, más el enlace al otro idioma de la spec 002. _Verifica: test automatizado en los dos idiomas._
- RF-13: EL SISTEMA no muestra ni incluye en la página ningún teléfono, correo, dirección ni otro dato de contacto o personal. _Verifica: test automatizado de la regla de redacción y del contenido servido + revisión en la validación._
- RF-14: EL SISTEMA tiene todo texto traducible nuevo en español y en inglés, sin ninguno vacío ni faltante, y mantiene los nombres propios (marca, servicios, proyectos y personas) en un único sitio y no dispersos por las páginas. _Verifica: test automatizado (la comprobación de traducciones de la spec 002 sigue en verde) + revisión de que no hay texto escrito a mano en las páginas._
- RF-15: EL SISTEMA muestra todo el contenido de la portada, incluidos los botones y la navegación por secciones, sin depender de JavaScript. _Verifica: test automatizado con JavaScript desactivado._

### Marca

- RF-16: EL SISTEMA muestra en la cabecera el logo real de la marca, en la variante con letras blancas apta para fondo oscuro, dentro del enlace al inicio de su idioma y con texto alternativo real, en lugar del nombre escrito. _Verifica: test automatizado._
- RF-17: EL SISTEMA no define ni usa el cian provisional de la spec 002 en ningún sitio de la web: la paleta es la del logo (naranjas y amarillos que ya son colores de marca) más los colores de marca existentes y los nuevos de esta spec. _Verifica: test automatizado (ámbito: el código fuente de la web) + test de colores sueltos en verde._
- RF-18: EL SISTEMA define el color de fondo de cada uno de los tres planetas de servicio como color de marca y cumple contraste WCAG 2.1 AA (≥ 4,5:1 en texto normal) en toda combinación de color de texto y fondo que use la portada, incluidos el blanco, el amarillo de acento y el verde de acento sobre el fondo general, el fondo oscuro y cada fondo de planeta, y el texto de los botones. _Verifica: test automatizado del cálculo de contraste + comprobación automática de accesibilidad._
- RF-19: EL SISTEMA muestra cada planeta de servicio sobre su propio fondo de color sólido, de modo que al recorrer la sección el fondo cambia de planeta en planeta, también sin JavaScript y con movimiento reducido. _Verifica: test automatizado del color calculado de cada bloque._
- RF-20: EL SISTEMA usa como favicon una versión del isologo de la marca, declarada en todas las páginas, y mantiene el favicon vectorial actual funcionando (misma dirección y mismo tipo) sin cambiar las pruebas de la spec 002; además declara un icono de imagen y un icono para dispositivos Apple derivados del isologo. _Verifica: test automatizado._
- RF-21: EL SISTEMA no incluye en el repositorio ni en su historial ninguna imagen original sin usar: solo los logos y las ilustraciones que la portada emplea (logo, isologo, Mac, Luna, Hexaweb, Rankia, Adara y, si encaja, la Tierra), y la carpeta de originales no se versiona. _Verifica: test automatizado._
- RF-22: EL SISTEMA muestra Mac, la Luna y los planetas sin cajas ni fondos de color alrededor: el fondo exterior es transparente y el interior de cada ilustración (por ejemplo, los ojos de Mac y las zonas oscuras de los planetas) queda opaco y sin alterar. _Verifica: test automatizado sobre píxeles de muestra (esquinas transparentes, interior opaco) + revisión visual sobre el fondo general, el fondo oscuro y cada fondo de planeta, que aprueba el usuario._
- RF-23: EL SISTEMA mantiene actualizado el aviso de licencias de marca para que cubra los logos, la mascota, los planetas, los textos de marca y el favicon incluidos, la procedencia de cada imagen derivada y las licencias de terceros añadidas. _Verifica: revisión manual._

### Imágenes

- RF-24: EL SISTEMA sirve cada imagen de la portada en formato moderno y en varios tamaños, con dimensiones declaradas y texto alternativo real (vacío solo si es meramente decorativa). _Verifica: test automatizado._
- RF-25: EL SISTEMA carga de inmediato las imágenes visibles al cargar (logo, Mac y Luna), con prioridad alta en las del hero, y de forma diferida todas las demás. _Verifica: test automatizado._

### SEO y datos estructurados

- RF-26: EL SISTEMA incluye en cada página de la portada un título, una descripción, un único encabezado principal y una jerarquía de encabezados sin saltos propios de su idioma, además de lo exigido por la spec 002 (idioma, URL canónica, alternativas de idioma, sin `noindex`). _Verifica: test automatizado sin JavaScript._
- RF-27: EL SISTEMA incluye en cada página de la portada los metadatos de redes sociales (título, descripción, imagen absoluta con dimensiones y texto alternativo, URL, tipo, nombre del sitio, idioma con la alternativa del otro, tarjeta grande), en el idioma de la página: `es_ES` para el español y `en_US` para el inglés. Las direcciones absolutas se forman a partir de la URL base del sitio. _Verifica: test automatizado de la lógica + test en navegador de que la imagen existe en el servidor bajo prueba._
- RF-28: EL SISTEMA incluye en cada página de la portada datos estructurados de organización válidos con nombre, URL del sitio, logo (dirección absoluta) y descripción en el idioma de la página, sin teléfono, correo ni dirección, y sin redes sociales mientras no existan. _Verifica: test automatizado._
- RF-29: EL SISTEMA publica un mapa del sitio con las dos páginas de la portada en su URL canónica y sus alternativas de idioma, sin ninguna página de error. _Verifica: test automatizado._
- RF-30: EL SISTEMA publica un archivo de reglas para robots que permite el rastreo y enlaza al mapa del sitio. _Verifica: test automatizado._

### Animación y movimiento

- RF-31: EL SISTEMA carga el código de las animaciones de desplazamiento de forma diferida, después de terminar la carga de la página y de un breve retardo, sin bloquear el primer pintado ni la interacción, y no lo carga cuando el visitante tiene movimiento reducido. _Verifica: test automatizado._
- RF-32: SI el código de animación no llega a cargarse (red caída o bloqueado), ENTONCES EL SISTEMA muestra todo el contenido igualmente, porque ningún elemento depende de ese código para ser visible. _Verifica: test automatizado con el código bloqueado._
- RF-33: MIENTRAS el visitante tiene movimiento reducido, EL SISTEMA muestra todo el contenido directamente, sin desplazamiento suave, sin animaciones ni transiciones, y con Mac estático. _Verifica: test automatizado._
- RF-34: MIENTRAS el visitante no tiene movimiento reducido y el código de animación está activo, CUANDO se desplaza por la sección de servicios, EL SISTEMA marca como planeta activo el que contiene el centro vertical de la ventana (el primero antes de llegar al primer bloque y el último después del último) y coloca a Mac sobre ese planeta, de modo que el centro de Mac queda dentro de la ilustración del planeta activo cuando el desplazamiento se detiene. Sin animación de desplazamiento no hay planeta activo ni Mac viajero. _Verifica: test automatizado de la lógica (incluidos casos límite) + test en navegador._
- RF-35: MIENTRAS el visitante no tiene movimiento reducido y el código de animación está activo, CUANDO llega a cada bloque de planeta, EL SISTEMA hace aparecer a la vez la ilustración y el texto del bloque desde lados opuestos (en pantallas estrechas, desde abajo), alternando el lado en cada planeta, sin desplazar el contenido ya pintado. El contenido parte visible en el HTML y solo los bloques situados por debajo de la parte visible adoptan el estado inicial oculto cuando el código está activo. _Verifica: test automatizado de la lógica + test en navegador (estado final visible; cambio de diseño ≤ 0,1)._
- RF-36: MIENTRAS el visitante no tiene movimiento reducido y el código de animación está activo, CUANDO toca, pulsa o activa con el teclado (Intro o Espacio) a Mac en el hero, EL SISTEMA reproduce un gesto de Mac de 0,6 s, observable por una marca de estado que se activa al empezar y se retira al terminar, sin cambiar ni ocultar texto. Mac es alcanzable con Tab solo mientras el código de animación está activo, con foco visible y nombre accesible; sin animación, Mac sigue siendo una imagen decorativa sin foco. _Verifica: test automatizado (ratón y teclado) y axe sin infracciones._
- RF-37: MIENTRAS el visitante usa un puntero fino y no tiene movimiento reducido, EL SISTEMA aplica desplazamiento suave a la página, y los enlaces a secciones y el teclado (Tab, Espacio, flechas, Inicio y Fin) siguen funcionando. _Verifica: test automatizado de enlaces y teclado + revisión manual de la búsqueda en la página y de la sensación del desplazamiento._
- RF-38: EL SISTEMA no oculta nunca ningún texto a los buscadores ni a ningún visitante en la parte visible al cargar: todo el texto está en el HTML servido, nada del hero ni de lo visible al cargar parte invisible, y no hay texto sobre degradados o imágenes que impidan calcular su contraste. _Verifica: test automatizado sin JavaScript y con la comprobación de accesibilidad ejecutada también tras revelar todo el contenido._

## Textos propuestos (pendientes de aprobación del usuario)

Estos textos los han redactado los especialistas (el Notion de la agencia solo daba el recorrido; las páginas de servicios, "Sobre nosotros" e "Identidad" estaban vacías), con tono "agencia de otro planeta" pero claro y orientado a captar clientes y a posicionar. El español es de España; el inglés, para el mercado angloparlante. **El usuario debe revisarlos y aprobarlos (o corregirlos) antes de cerrar la spec** (criterio de finalización). Mientras no estén aprobados son provisionales y cualquier cambio se hace solo en las traducciones.

Notas: los nombres propios (AgencyMac, Hexaweb, Rankia, Adara, Metal Renova, Magnar WarGames, Joni, Samuel, Luigi) y los dominios de los proyectos no son texto traducible. Las descripciones de los dos proyectos son genéricas porque no se conoce el alcance del trabajo realizado: confirma o corrige qué hicimos en cada uno. Los textos alternativos de imágenes están **a revisar con las imágenes finales**.

| Clave                              | ES                                                                                                                                                               | EN                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home.title`                       | Diseño web, SEO y Google Ads para tu negocio                                                                                                                     | Web design, SEO and Google Ads for your business                                                                                                      |
| `home.description`                 | AgencyMac, agencia de marketing, análisis y desarrollo web: creamos tu web, la posicionamos en Google y gestionamos tus anuncios. ¡Hazlo galáctico con Mac!      | AgencyMac, a marketing, analytics and web development agency: we build your website, rank it on Google and run your ads. Make it galactic with Mac!   |
| `og.imageAlt`                      | Logotipo de AgencyMac: un cohete naranja y las palabras MAC Agency                                                                                               | AgencyMac logo: an orange rocket and the words MAC Agency                                                                                             |
| `nav.services`                     | Servicios                                                                                                                                                        | Services                                                                                                                                              |
| `nav.projects`                     | Proyectos                                                                                                                                                        | Projects                                                                                                                                              |
| `nav.team`                         | Quiénes somos                                                                                                                                                    | About us                                                                                                                                              |
| `nav.contact`                      | Contacto                                                                                                                                                         | Contact                                                                                                                                               |
| `cta.takeOff`                      | Quiero despegar                                                                                                                                                  | I want to take off                                                                                                                                    |
| `hero.heading` (encabezado único)  | Agencia de diseño web, SEO y Google Ads para conseguir más clientes                                                                                              | Web design, SEO and Google Ads agency that wins you more clients                                                                                      |
| `hero.tagline`                     | Creamos ideas que parecen de otro planeta                                                                                                                        | We create ideas that look out of this world                                                                                                           |
| `hero.kicker`                      | ¡Hazlo Galáctico! Hazlo MAC                                                                                                                                      | Make it Galactic! Make it MAC                                                                                                                         |
| `hero.subtitle`                    | Webs rápidas, posicionamiento en Google y anuncios que funcionan, de la mano de un equipo de marketing, análisis y desarrollo.                                   | Fast websites, Google rankings and ads that work, from a team of marketing, analytics and development specialists.                                    |
| `hero.macGestureLabel`             | Saludar a Mac                                                                                                                                                    | Say hi to Mac                                                                                                                                         |
| `hero.discover`                    | Descubre cómo                                                                                                                                                    | Find out how                                                                                                                                          |
| `hero.macAlt`                      | Mac, el alien mascota de AgencyMac, asomado a su nave                                                                                                            | Mac, the AgencyMac alien mascot, peeking out of his spaceship                                                                                         |
| `services.heading`                 | Tres planetas para despegar                                                                                                                                      | Three planets to take off                                                                                                                             |
| `services.intro`                   | Mac te lleva de planeta en planeta: empieza por el plan base, web y posicionamiento, y suma un propulsor cuando quieras acelerar.                                | Mac takes you from planet to planet: start with the base plan, website and search ranking, and add a booster whenever you want to speed up.           |
| `services.tagBase`                 | Plan base                                                                                                                                                        | Base plan                                                                                                                                             |
| `services.tagBooster`              | Propulsor extra                                                                                                                                                  | Extra booster                                                                                                                                         |
| `services.hexaweb.role`            | Desarrollo web                                                                                                                                                   | Web development                                                                                                                                       |
| `services.hexaweb.body`            | Diseñamos y programamos webs rápidas, claras y pensadas para convertir visitas en clientes. Se ven bien en el móvil, cargan en un suspiro y Google las entiende. | We design and build fast, clear websites made to turn visitors into clients. They look great on mobile, load in a blink and Google understands them.  |
| `services.hexaweb.alt`             | Hexaweb, el planeta turquesa de las webs, con un anillo dorado                                                                                                   | Hexaweb, the turquoise web planet with a golden ring                                                                                                  |
| `services.rankia.role`             | SEO y mantenimiento                                                                                                                                              | SEO and maintenance                                                                                                                                   |
| `services.rankia.body`             | Hacemos que te encuentren: SEO técnico y de contenido, y mantenimiento continuo para que tu web siga rápida, segura y bien posicionada mes a mes.                | We make sure you get found: technical and content SEO, plus ongoing maintenance so your website stays fast, secure and well ranked month after month. |
| `services.rankia.alt`              | Rankia, el planeta azul verdoso del posicionamiento, con un anillo                                                                                               | Rankia, the blue-green search ranking planet, with a ring                                                                                             |
| `services.adara.role`              | Google Ads                                                                                                                                                       | Google Ads                                                                                                                                            |
| `services.adara.body`              | El propulsor: campañas de Google Ads que ponen tu web delante de quien ya está buscando lo que ofreces, con resultados que se pueden medir.                      | The booster: Google Ads campaigns that put your website in front of people already searching for what you offer, with results you can measure.        |
| `services.adara.alt`               | Adara, el planeta naranja de la publicidad, con un anillo amarillo y rosa                                                                                        | Adara, the orange advertising planet, with a yellow and pink ring                                                                                     |
| `projects.heading`                 | Proyectos que ya han aterrizado                                                                                                                                  | Projects that have already landed                                                                                                                     |
| `projects.intro`                   | Algunas de las webs con las que hemos trabajado.                                                                                                                 | Some of the websites we have worked on.                                                                                                               |
| `projects.metalrenova.description` | Chatarrería y reciclaje de metales.                                                                                                                              | Scrap yard and metal recycling.                                                                                                                       |
| `projects.magnar.description`      | Web de wargames y juegos de miniaturas.                                                                                                                          | Wargames and miniatures website.                                                                                                                      |
| `projects.visit`                   | Visitar                                                                                                                                                          | Visit                                                                                                                                                 |
| `projects.newTab`                  | (se abre en una pestaña nueva)                                                                                                                                   | (opens in a new tab)                                                                                                                                  |
| `team.heading`                     | Quiénes somos                                                                                                                                                    | About us                                                                                                                                              |
| `team.intro`                       | La tripulación de Mac: tres personas, tres especialidades y una misión, que tu negocio despegue.                                                                 | Mac's crew: three people, three specialities and one mission, to make your business take off.                                                         |
| `team.role.marketing`              | Marketing                                                                                                                                                        | Marketing                                                                                                                                             |
| `team.role.analytics`              | Análisis                                                                                                                                                         | Analytics                                                                                                                                             |
| `team.role.coding`                 | Coding                                                                                                                                                           | Coding                                                                                                                                                |
| `contact.heading`                  | Prepara el despegue                                                                                                                                              | Get ready for take-off                                                                                                                                |
| `contact.body`                     | Estamos terminando el formulario para pedir presupuesto. Muy pronto podrás contarnos tu proyecto desde aquí y despegar con nosotros.                             | We are finishing the quote request form. Very soon you will be able to tell us about your project right here and take off with us.                    |
| `contact.status`                   | Formulario próximamente                                                                                                                                          | Form coming soon                                                                                                                                      |

Claves existentes que se conservan sin cambio de texto: `nav.label`, `nav.home`, `nav.switchLanguage`, `a11y.skipToContent`, `footer.text` y las de la 404. Se retiran las claves provisionales de la 002 (`home.heading`, `home.intro`, `home.sectionHeading`, `home.sectionBody`), sustituidas por las de esta tabla.

## Requisitos no funcionales

### SEO técnico (skill seo-tecnico; constitución, principio 7)

- RNF-1: cada página de la portada cumple el checklist de seo-tecnico: título único (orientativo 50-60 caracteres), descripción única (orientativa 150-160), un solo encabezado principal con las palabras clave del servicio, HTML semántico, URL canónica, alternativas de idioma, metadatos de redes sociales, imágenes con texto alternativo, dimensiones y formato moderno, enlaces internos con texto descriptivo, datos estructurados válidos que coinciden con lo visible, mapa del sitio y archivo de robots, y nunca `noindex`. _Verifica: tests automatizados + checklist de la validación._
- RNF-2: las URLs siguen siendo la raíz y `/en/` (minúsculas, barra final). Las secciones se enlazan con anclas iguales en los dos idiomas que no son páginas indexables.

### Rendimiento (Core Web Vitals)

- RNF-3: la auditoría de calidad en móvil (mediana de 3 ejecuciones) da ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO en las dos páginas, con LCP ≤ 2,5 s y CLS ≤ 0,1. _Verifica: auditoría de calidad del proyecto._
- RNF-4: el tiempo de bloqueo total (TBT) es ≤ 200 ms en la mediana de la auditoría (indicador de laboratorio de INP) y, con la animación activa, ninguna interacción de la prueba (pulsar a Mac, pulsar un enlace de sección, usar el teclado, desplazarse) tarda más de 200 ms en responder. _Verifica: auditoría de calidad (si el usuario aprueba el nuevo límite) + test automatizado de interacciones._
- RNF-5: el JavaScript de la portada tiene presupuesto: antes de terminar la carga, ≤ 3 KB comprimidos; en total, con el código de animación cargado, ≤ 60 KB comprimidos (cifra provisional que el plan fija con la medición real). _Verifica: test automatizado._
- RNF-6: las imágenes visibles al cargar (logo, Mac y Luna) pesan en conjunto ≤ 90 KB en un móvil de 375 px; las demás se cargan solo al acercarse. Ninguna imagen provoca cambios de diseño. _Verifica: test automatizado + auditoría._
- RNF-7: la animación solo usa propiedades que no provocan reflujo de la página; ningún elemento animado desplaza el contenido. _Verifica: cambio de diseño ≤ 0,1 en la auditoría + revisión del código._

### Accesibilidad y diseño

- RNF-8: la comprobación automática de accesibilidad no da infracciones en la portada ni en las 404, en español e inglés, con la regla de contraste ejecutada de verdad (ni "pendiente de revisar"), antes y después de revelar todo el contenido en la fase de animación. Foco visible en todos los elementos interactivos nuevos, que se pueden usar con teclado. _Verifica: test automatizado + recorrido manual con Tab._
- RNF-9: sin desbordamiento horizontal ni texto cortado a 320 y 375 px de ancho ni en móvil apaisado, con y sin animación, en español e inglés. _Verifica: test automatizado + revisión visual a 375 px._
- RNF-10: las imágenes decorativas (Mac viajero, adornos) llevan texto alternativo vacío y quedan fuera del árbol de accesibilidad; las informativas, texto alternativo descriptivo en el idioma de la página.

### Idiomas, licencias y dependencias

- RNF-11: todo texto visible o leído por buscadores y lectores de pantalla existe en español e inglés (spec 002, RF-6 y RF-7).
- RNF-12: ninguna dependencia nueva se instala sin que el usuario apruebe la lista del plan (versión exacta sin `^`, no publicada el mismo día, licencia que permita uso comercial en un repositorio público, coste 0 €).
- RNF-13: ningún secreto, dato de cliente, dato de contacto ni URL de entornos de prueba llega al repositorio, sus specs o su historial. Ningún original de ilustración sin usar llega nunca a un commit.
- RNF-14: sin analítica, cookies ni peticiones a terceros: la portada solo pide recursos de su propio dominio (los enlaces a los proyectos son navegación).

## Casos límite

- JavaScript desactivado, bloqueado, o que falla al cargar (RF-15, RF-32, RF-38).
- Movimiento reducido activado (RF-33) y activado a mitad de la visita.
- Dispositivo táctil sin ratón: no hay desplazamiento suave (RF-37) y Mac se coloca igualmente (RF-34).
- Pantalla de 320 px y orientación horizontal del móvil (RNF-9).
- Ventana muy alta o muy baja: el centro de la ventana puede quedar entre dos planetas, antes del primero o después del último; con animación siempre hay un planeta activo definido (RF-34).
- Redimensionar o girar el dispositivo con la animación en curso: las posiciones se recalculan y Mac no se queda fuera de su planeta.
- Entrar directamente con un enlace a una sección en la URL: el contenido es correcto desde el principio y el planeta activo, cuando hay animación, también.
- Texto más largo en inglés o con tamaño de letra ampliado por el visitante: sin texto cortado ni desbordamiento.
- Un enlace de proyecto que ya no responda: el sitio no se rompe (la comprobación del destino es manual).
- Compartir la URL de la versión inglesa en una red social: la tarjeta sale en inglés y la española en español.
- Imagen que no carga: el texto y los botones siguen siendo legibles sobre su fondo.
- Ilustración con zonas oscuras interiores (ojos de Mac, manchas de planetas) que un recorte descuidado volvería transparentes (RF-22).
- Páginas 404: no cambian (sin URL canónica, alternativas de idioma ni enlace de idioma), mantienen su diseño de una sola columna y no cargan el código de animación.

## Fuera de alcance

- Páginas propias por servicio (spec 005): "Descubre cómo" lleva a la sección de servicios de la portada.
- Formulario, envío de correo y almacenamiento de contactos (spec 006): "Quiero despegar" no envía nada.
- Centro de Control, `agencymac.com`, DNS y despliegue a producción.
- Rive y cualquier animación de la mascota que no sea la descrita.
- Capturas de pantalla de los proyectos, fotos o avatares del equipo, precios y paquetes.
- Los otros ocho planetas de la web antigua y sus servicios.
- Redes sociales, teléfono, correo, dirección, mapa y SEO local (no hay datos que mostrar).
- Páginas legales (aviso legal, privacidad, cookies): se abordarán antes del lanzamiento.
- Blog y contenido SEO adicional.

## Criterios de finalización

- Todos los RF y RNF verificados según su método: tests automatizados (lógica y navegador, incluidos sin JavaScript, con movimiento reducido, 320 y 375 px, accesibilidad y presupuestos) y auditoría de calidad en verde.
- **Textos aprobados por el usuario**: todos los textos de la sección "Textos propuestos" (incluidos los textos alternativos, revisados con las imágenes finales) aprobados o corregidos por el usuario por escrito antes de cerrar la spec, con el resultado anotado aquí. Sin ese OK la spec no se cierra.
- **Aspecto aprobado por el usuario**: los recortes de Mac, Luna y planetas y los colores de fondo de los planetas, revisados sobre cada fondo.
- Revisión visual a 375 px y en escritorio de las dos páginas con y sin movimiento reducido, y revisión en la URL de staging (`agencymac-staging.<subdominio>.workers.dev`) desde el móvil, anotadas en la validación.
- Comprobación manual de que los dos enlaces de proyecto abren la web correcta y de la búsqueda en la página con el desplazamiento suave.
- Recorrido con Tab completo (foco visible, orden lógico) en español e inglés.
- Documentación al día: reglas de la web, aviso de licencias de marca y memoria del proyecto.
- Lista de originales usados y de derivados revisada por el usuario: ningún original sin usar en el repositorio ni en su historial.

### Cierre (2026-10-12)

- VEREDICTO: APROBADO (validación RF por RF; CI en verde en los dos pushes; Lighthouse 100/100/100/100, LCP ~1,5 s, CLS 0, TBT 0).
- Aprobados por el usuario en el chat: los textos propuestos, el aspecto de los recortes y los colores de fondo de los planetas.
- Siguen como comprobaciones manuales del usuario (no automatizables, no bloquean el cierre): revisión en staging desde el móvil, que los dos enlaces de proyecto abren la web correcta, Ctrl+F y sensación del scroll con Lenis y recorrido con Tab.

## Decisiones de clarificación (para el plan)

- "Descubre cómo" va a la sección de servicios de la propia portada porque las páginas de servicio (spec 005) aún no existen.
- "Quiero despegar" apunta a la sección de contacto de la propia portada (con el estado "Formulario próximamente"): no hay enlaces falsos y la spec 006 sustituye el contenido de esa sección sin tocar el botón. "Contacto" en la navegación apunta a esa misma sección.
- El encabezado principal lleva las palabras clave (servicio y propuesta de valor); el lema "Creamos ideas que parecen de otro planeta" es el texto visible que lo sigue; la frase "¡Hazlo Galáctico! Hazlo MAC" sigue en el hero.
- Mercado principal España (es-ES) y mercado angloparlante (en-US) para los metadatos de redes sociales.
- La paleta sale del logo (sin cian). El cian provisional de la spec 002 se elimina por decisión del usuario.
- Mac, la Luna y los planetas salen como imágenes recortadas: el fondo exterior se elimina por relleno desde los bordes, no por eliminación global de un color, para no vaciar zonas oscuras interiores; los originales no se versionan.
- El plan decide qué se vectoriza y qué no y la herramienta de procesado de imágenes (aprobación del usuario).
- Una sola spec con dos fases de ejecución (A: contenido, marca y SEO; B: animación); el usuario ha aprobado expresamente que supere las 10 tareas. Las dependencias de animación se aprueban con el plan completo.
- Rive queda fuera.

## Supuestos (revisables al aprobar; no son dudas abiertas)

- Permisos: los dos proyectos del portfolio (Metal Renova y Magnar WarGames) tienen permiso concedido (constancia en la memoria del proyecto); el equipo aparece por petición del usuario. GSAP y Lenis los ha pedido el usuario.
- Las descripciones de los dos proyectos son genéricas (sector) porque no se conoce el alcance del trabajo; se confirman junto con los textos.
- Los dos proyectos se enlazan por HTTPS y sin `www`; se comprueba a mano en la validación.
- No hay capturas de los proyectos: si se quieren, el usuario las proporciona y se tratan en un cambio posterior.
- Hasta que exista el formulario (spec 006), la web no ofrece ningún canal de contacto real; no bloquea esta spec (solo hay staging con `noindex`) pero sí bloquea el lanzamiento en `agencymac.com`.

## Dudas abiertas

- Ninguna.
