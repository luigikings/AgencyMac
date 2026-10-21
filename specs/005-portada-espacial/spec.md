# Spec 005 — Portada espacial (impacto visual y detalle)

Estado: aprobada (2026-10-12; presupuestos propuestos en manos del criterio del coordinador, suelo Lighthouse >= 90 de la constitución)

Depende de: spec 004 (portada real, implementada). Sustituye parcialmente algunos requisitos de la 004 (sección "Cambios respecto a la spec 004"). Las páginas por servicio (spec 007) y el formulario (spec 006) quedan para después y no se tocan aquí.

## Contexto y objetivo

La portada de la 004 es correcta y está muy bien medida (Lighthouse 100, 52,6 KB de JavaScript), pero se queda "muy sencilla, muy básica": bandas de color plano, planetas que entran de lado y un Mac que se coloca junto a cada planeta. La web de AgencyMac es su carta de presentación ante clientes y compite con otras webs de marketing: tiene que provocar el "wow, esta es la que mejor se ve" y mostrar cariño en los detalles.

Esta spec convierte la portada en un viaje espacial vivo: un cielo con estrellas en capas, nebulosas y fundidos de color entre planetas; planetas con vida (flotación, brillo, órbitas, lunas); un hero cinematográfico en el que Mac aterriza; un Mac protagonista (vuela en curva con estela, mira al cursor, habla, tiene un huevo de pascua); y un conjunto de microinteracciones y detalles (progreso del viaje, salto en el espacio, tarjetas con borde cósmico, constelaciones del equipo, pie con horizonte).

Prioridades, por orden: (1) impacto visual y riqueza de detalle; (2) que el SEO no se resienta. El usuario acepta explícitamente perder algo de rendimiento: ya no hace falta Lighthouse 100. El suelo no cambia: constitución (≥ 90 en las 4 categorías, móvil) y Core Web Vitals (LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms), porque son SEO. Por eso se revisan al alza el presupuesto de JavaScript y el tiempo de bloqueo total (RNF-3, RNF-4, RNF-5), con cifras razonadas que el usuario aprueba con esta spec.

Lo que no cambia: todo el contenido sigue en el HTML y se ve sin JavaScript; con movimiento reducido todo aparece directamente y el cielo es estático (y bonito); nada del hero ni del contenido inicial arranca invisible; sin audio; sin dependencias nuevas.

## Usuarios

- Posibles clientes (negocios que buscan web, SEO o publicidad en Google) en España y en el mercado angloparlante, en móvil (la mayoría) y en escritorio.
- Buscadores y redes sociales: ven el mismo contenido que hoy, sin pérdida de posicionamiento.
- Visitantes con movimiento reducido, sin JavaScript, con lector de pantalla o con un móvil modesto: deben tener una portada completa, legible y rápida.
- El equipo de AgencyMac, que revisa cada bloque en el entorno de prueba (staging) desde el móvil y el escritorio.

## Historias de usuario

- HU-1. Como posible cliente, quiero que la web me sorprenda y me parezca más cuidada que la de otras agencias, para fiarme de ella.
- HU-2. Como visitante curioso, quiero encontrar pequeños detalles (Mac que me mira, mensajes, destellos, un secreto) para sentir que hay personas detrás.
- HU-3. Como visitante con móvil modesto, quiero que la web vaya fluida: los efectos caros se reducen o desaparecen en mi dispositivo.
- HU-4. Como visitante con movimiento reducido o sin JavaScript, quiero ver todo el contenido directamente, con un cielo estático, sin animaciones ni partículas.
- HU-5. Como buscador, quiero que los efectos no oculten ni retrasen el contenido ni empeoren los Core Web Vitals.
- HU-6. Como responsable de la marca, quiero que todo el espacio, los planetas y Mac sigan la marca (paleta, tipografías, mascota) y que no entren imágenes ni librerías externas.
- HU-7. Como equipo, quiero revisar y aprobar la portada por bloques (hero, cielo y servicios, Mac, microinteracciones, proyectos/equipo/contacto/pie) en el entorno de prueba.

## Definiciones

- **Cielo**: el conjunto decorativo de estrellas, polvo cósmico y nebulosas detrás del contenido.
- **Capa de estrellas**: cada nivel de profundidad del cielo (lejana, media, cercana). Las capas se mueven a velocidades distintas (paralaje) cuando hay animación.
- **Zona**: cada tramo de la portada con su propio ambiente de color: hero, Hexaweb, Rankia, Adara, proyectos, equipo y contacto (7 zonas).
- **Ambiente**: color base sólido de la zona más sus resplandores y polvo propios.
- **Fundido**: la transición gradual de color entre el final de una zona y el principio de la siguiente.
- **Texto sobre el cielo**: todo texto que se pinta directamente sobre una zona con resplandores o degradados (no sobre un panel o tarjeta de color sólido).
- **Contraste medido por píxeles**: el contraste del texto calculado sobre los píxeles realmente pintados detrás de él (con el texto ocultado), no sobre el color declarado del fondo.
- **Capa de efectos**: el código opcional y diferido que añade movimiento e interacción (la "capa de animación" de la 004, ampliada).
- **Clase de dispositivo**: bajo, medio o alto, según el ancho, el tipo de puntero y la potencia declarada del dispositivo. Fija cuántos efectos se activan.
- **Partícula**: cada punto de luz animado de los efectos (estela, chispas, ráfagas, estrellas fugaces, rastro del cursor).
- **Estela**: las partículas que Mac deja detrás al volar.
- **Burbuja**: el globo de texto breve que aparece junto a Mac. Es decorativo.
- **Entrada del hero**: la secuencia que se reproduce al abrir la página: sube la Luna, llega Mac y aterriza, y el texto se coloca.
- **Planeta activo**, **movimiento reducido**, **parte visible al cargar**, **animación de desplazamiento**: como en la spec 004.
- **Coste propio por fotograma**: el tiempo de JavaScript que la capa de efectos consume en cada fotograma.

## Requisitos funcionales

Cada RF indica cómo se verifica: _test automatizado_ (lógica o navegador, el plan concreta cuál) o _revisión manual_ (aprobación visual del usuario en staging).

### Cielo y ambientes

- RF-1: EL SISTEMA muestra en la portada un cielo de al menos 3 capas de estrellas (lejana, media y cercana), con al menos 110, 60 y 30 estrellas por capa en pantallas de 48 rem o más y al menos 40, 22 y 10 en pantallas más estrechas, generadas con una semilla fija de modo que el cielo es idéntico en cada carga y cada compilación. _Verifica: test automatizado de la lógica (recuentos y determinismo) + test en navegador del recuento por capa._
- RF-2: MIENTRAS hay animación, la clase de dispositivo es media o alta y el visitante se desplaza, EL SISTEMA mueve las capas de estrellas con velocidades distintas: al recorrer toda la página la lejana se desplaza 4 vh, la media 8 vh y la cercana 16 vh (en clase media, solo las dos primeras). _Verifica: test automatizado de la lógica + test en navegador (posición de cada capa al principio y al final)._
- RF-3: MIENTRAS hay animación, EL SISTEMA hace centellear cada capa de estrellas con un ciclo de duración distinta (entre 7 y 15 s) y una variación de brillo suave (nunca más de tres cambios de brillo por segundo). _Verifica: test automatizado (duraciones distintas y rango) + revisión manual._
- RF-4: MIENTRAS hay animación, la clase de dispositivo es media o alta, y la pestaña está visible, EL SISTEMA lanza una estrella fugaz a intervalos aleatorios (con semilla en las pruebas) de entre 12 y 24 s en clase media (1 a la vez) y de entre 8 y 16 s en clase alta (hasta 2 a la vez), y ninguna en clase baja. Cada una dura entre 0,6 y 1,2 s. _Verifica: test automatizado de la lógica (intervalos y límites) + test en navegador con reloj simulado._
- RF-5: EL SISTEMA da a cada una de las 7 zonas un ambiente propio y distinto (color base y color de resplandor), con la tabla de ambientes del plan, y los muestra también sin JavaScript y con movimiento reducido. _Verifica: test automatizado de la tabla (7 ambientes, todos distintos) + test en navegador sin JavaScript del color base de cada zona._
- RF-6: EL SISTEMA une cada zona con la siguiente con un fundido gradual de al menos 8 rem de altura, sin ningún corte brusco de color: en ninguna frontera entre zonas, a 375 y a 1280 px de ancho, dos píxeles consecutivos en vertical difieren más de 12 niveles por canal (sobre 255). _Verifica: test automatizado sobre capturas de pantalla._
- RF-7: EL SISTEMA mantiene en cada bloque de planeta un color base sólido igual al color de marca de su planeta (el de la 004), sobre el que se añaden los resplandores. _Verifica: test automatizado del color de fondo calculado de cada bloque._
- RF-8: EL SISTEMA garantiza la legibilidad de todo texto sobre el cielo: sobre los píxeles realmente pintados detrás de cada texto (con el texto oculto), el 98 % de los píxeles tiene un contraste ≥ 4,5:1 con el color del texto (≥ 3:1 en texto grande), en las 7 zonas, a 375 y 1280 px, en español e inglés, con y sin movimiento reducido. El texto de tarjetas, botones, burbujas y etiquetas va sobre superficies de color sólido y sigue verificándose con la comprobación automática de accesibilidad como "pasa". _Verifica: test automatizado de contraste por píxeles + de la lógica de luminancia máxima del cielo + comprobación de accesibilidad._
- RF-9: MIENTRAS el visitante no tiene JavaScript, tiene movimiento reducido, o el código de efectos no se carga, EL SISTEMA muestra el cielo completo en estado estático (estrellas, polvo, ambientes y fundidos) con el mismo aspecto que el estado inicial con animación. _Verifica: test automatizado (sin JavaScript, con movimiento reducido y con el código bloqueado) + revisión manual._

### Planetas con vida

- RF-10: MIENTRAS hay animación, EL SISTEMA hace que cada planeta de servicio flote (amplitud entre 6 y 14 px, ciclo entre 6 y 10 s) y gire de forma sutil (entre 2 y 4 grados, ciclo entre 14 y 24 s), con desfase distinto en cada planeta. _Verifica: test automatizado de las animaciones calculadas._
- RF-11: EL SISTEMA muestra detrás de cada planeta un halo del color de resplandor de su zona que, con animación, pulsa suavemente (brillo entre 60 y 100 %, ciclo entre 4 y 6 s). _Verifica: test automatizado + revisión manual._
- RF-12: EL SISTEMA muestra alrededor de cada planeta de servicio al menos una órbita decorativa y sus lunas pequeñas (Hexaweb 1, Rankia 2, Adara 1), todas visibles en cualquier clase de dispositivo y sin JavaScript; MIENTRAS hay animación, las lunas que recorren su órbita (en un ciclo de entre 10 y 20 s) son 1/2/1 en clase media y alta y 1 por planeta en clase baja, y cada luna que no se anima queda quieta y visible en su propio punto de la órbita: dentro de la ilustración de su planeta y sin solaparse con otra luna (nunca en una esquina ni fuera de la órbita). _Verifica: test automatizado (lunas visibles 1/2/1, lunas animadas por clase, duración, y posición de las lunas quietas en clase baja a 375 px táctil)._ (Cambiado el 2026-10-19, ver "Cambios de requisitos".)
- RF-13: MIENTRAS el visitante usa un puntero fino, hay animación y la clase de dispositivo es media o alta, CUANDO mueve el cursor sobre la portada, EL SISTEMA desplaza cada planeta hasta 14 px en función del cursor, con más desplazamiento cuanto más cercana es la capa, y lo devuelve a su sitio en menos de 1 s al sacar el cursor. _Verifica: test automatizado de la lógica + test en navegador._
- RF-14: MIENTRAS el visitante usa un puntero fino, hay animación y la clase de dispositivo es media o alta, CUANDO el cursor entra en un planeta, EL SISTEMA hace crecer ligeramente el planeta (hasta un 5 %) y emite chispas de los colores de marca mientras el cursor permanece dentro, con un máximo de 20 chispas simultáneas por planeta en clase media y 40 en clase alta. _Verifica: test automatizado de la lógica (límites) + test en navegador._
- RF-15: CUANDO un planeta o cualquier decoración animada sale de la pantalla, EL SISTEMA pausa sus animaciones y las reanuda al volver a entrar. _Verifica: test automatizado en navegador (estado de reproducción dentro y fuera de pantalla)._

### Hero cinematográfico

- RF-16: MIENTRAS hay movimiento no reducido, CUANDO se abre la portada, EL SISTEMA reproduce la entrada del hero sin esperar a que cargue ningún código: la Luna sube hasta su sitio (entre 0 y 1,2 s), Mac llega y aterriza sobre la Luna (entre 0,2 y 1,7 s) y los textos y el botón se asientan en escalón (todos en su sitio antes de 0,5 s tras empezar), con la secuencia completa en 2,0 s como máximo. _Verifica: test automatizado en navegador sin JavaScript (estado a los 0 s, a mitad y al final)._
- RF-17: EL SISTEMA no oculta nunca durante la entrada del hero ningún texto, imagen principal ni botón: en cada fotograma, el encabezado principal, el lema, la frase de marca, el subtítulo, el botón "Descubre cómo", Mac y la Luna tienen opacidad 1 y están dentro de la ventana, y la entrada solo mueve o escala (no cambia la opacidad de nada que no sea puramente decorativo). _Verifica: test automatizado que muestrea cada fotograma desde el inicio._
- RF-18: EL SISTEMA muestra durante el vuelo de entrada de Mac un propulsor (llama) que desaparece al aterrizar (antes de 1,8 s) y un pequeño rebote al tocar la Luna (entre 0,3 y 0,5 s). _Verifica: test automatizado + revisión manual._
- RF-19: EL SISTEMA muestra en el hero un aura alrededor de la Luna, al menos una órbita con un cuerpo pequeño que la recorre y al menos 3 destellos decorativos que parpadean, todo sin tapar ni desplazar texto. _Verifica: test automatizado (recuento y que no solapan texto)._
- RF-20: MIENTRAS hay animación, CUANDO el visitante pasa el cursor o el foco por el botón principal "Quiero despegar", EL SISTEMA lo eleva 2 px, hace un barrido de brillo de 0,6 s y le da un resplandor; CUANDO lo pulsa, lo comprime (escala 0,97). Con movimiento reducido solo cambia el color, como en la 004. _Verifica: test automatizado del estilo calculado en hover, foco y pulsación._

### Mac protagonista

- RF-21: MIENTRAS hay animación, CUANDO cambia el planeta activo, EL SISTEMA hace volar a Mac por una trayectoria curva entre los dos planetas: la separación máxima entre la trayectoria y la línea recta es al menos el 12 % de la distancia, el vuelo dura entre 0,7 y 1,6 s (proporcional a la distancia) y, al terminar, el centro de Mac queda dentro de la ilustración del planeta activo (RF-34 de la 004). Si el visitante cambia de planeta a mitad de vuelo, Mac redirige desde donde está. _Verifica: test automatizado de la lógica (curva, duración, destino) + test en navegador._
- RF-22: MIENTRAS Mac vuela, EL SISTEMA lo inclina según la dirección de vuelo (entre -25 y 25 grados) y lo endereza en menos de 0,4 s al llegar. _Verifica: test automatizado de la lógica + test en navegador._
- RF-23: MIENTRAS Mac vuela, EL SISTEMA emite una estela de partículas desde su parte trasera: al menos 36 por segundo en clase alta, 20 en media y 8 en baja, que se desvanecen en menos de 0,6 s, y ninguna cuando Mac no vuela. _Verifica: test automatizado de la lógica + test en navegador (recuento de emisión)._
- RF-24: CUANDO Mac llega a un planeta, EL SISTEMA reproduce un rebote de llegada (escala hasta 1,12 y vuelta, 0,4 s) y muestra una burbuja con el mensaje de ese planeta. _Verifica: test automatizado en navegador._
- RF-25: MIENTRAS el visitante usa un puntero fino y hay animación, EL SISTEMA hace que Mac (el del hero mientras está en pantalla y el viajero) se incline hasta 6 grados y se desplace hasta 8 px hacia el cursor, y vuelva al centro en menos de 1 s al sacarlo. _Verifica: test automatizado de la lógica + test en navegador._
- RF-26: MIENTRAS hay animación, CUANDO Mac termina de aterrizar en el hero, EL SISTEMA lo hace saludar (balanceo de 0,8 s) con una burbuja de saludo, una sola vez por visita. _Verifica: test automatizado._
- RF-27: EL SISTEMA muestra los mensajes de Mac en burbujas decorativas (texto en la tabla "Textos propuestos"): una a la vez, de entre 2,0 y 2,8 s, sin repetir el mismo mensaje dos veces seguidas, tras saludar, al llegar a cada planeta, al pulsar a Mac y tras 8 s sin ninguna interacción (una vez por periodo de reposo). La burbuja es de color sólido, está oculta a los lectores de pantalla y a los buscadores (no está en el HTML) y no aparece con movimiento reducido. _Verifica: test automatizado de la lógica (selección y repeticiones) + test en navegador (una a la vez, duración, accesibilidad)._
- RF-28: CUANDO el visitante pulsa, toca o activa con el teclado a Mac (RF-36 de la 004), EL SISTEMA reproduce además del gesto de 0,6 s una ráfaga de entre 12 y 20 partículas (con el límite de la clase de dispositivo) y una burbuja, sin cambiar ni ocultar ningún texto. _Verifica: test automatizado (ratón y teclado)._
- RF-29: CUANDO el visitante activa a Mac 5 veces en 3 s como máximo, EL SISTEMA reproduce el "modo turbo": Mac cruza la pantalla en un arco de 1,4 s como máximo con una ráfaga de al menos 60 partículas (con el límite de la clase de dispositivo) y la burbuja de turbo, observable por una marca de estado que se activa al empezar y se retira al terminar; no se puede repetir hasta pasados 10 s y funciona también con el teclado. _Verifica: test automatizado de la lógica (ventana, cuenta, enfriamiento) + test en navegador._

### Microinteracciones y detalles

- RF-30: MIENTRAS hay animación, EL SISTEMA muestra un indicador del progreso del viaje: un trazo fijo en el borde de la pantalla (horizontal en móvil, vertical en pantallas de 64 rem o más) con 5 paradas (una por sección) y el isologo de la marca como cohete que avanza con el desplazamiento, iluminando las paradas ya visitadas. Es decorativo (oculto a lectores de pantalla), mide como máximo 6 px de grosor en móvil y no cubre ningún texto ni botón. _Verifica: test automatizado de la lógica (progreso y paradas) + test en navegador (posición, solapamientos, 320 y 375 px)._
- RF-31: MIENTRAS hay animación y la clase de dispositivo es media o alta, CUANDO el visitante activa un enlace a una sección (navegación, "Quiero despegar" o "Descubre cómo"), EL SISTEMA muestra durante el desplazamiento un "salto en el espacio": estrellas estiradas en la dirección del movimiento con longitud proporcional a la velocidad, de 0,9 s como máximo, con como máximo 40 trazos en clase media y 80 en alta, observable por una marca de estado, sin impedir ni retrasar la llegada a la sección. _Verifica: test automatizado de la lógica + test en navegador._
- RF-32: MIENTRAS el visitante usa un puntero fino, hay animación y la clase de dispositivo es alta, EL SISTEMA deja un rastro de como máximo 14 partículas detrás del cursor, que se apaga si el cursor lleva quieto más de 0,6 s. El cursor nativo nunca se oculta ni se sustituye. _Verifica: test automatizado de la lógica + test en navegador._
- RF-33: EL SISTEMA muestra las tarjetas de proyectos con un borde cósmico (degradado de al menos dos colores de marca) que, con animación, gira mientras la tarjeta tiene el cursor o el foco, con su texto sobre un panel de color sólido. _Verifica: test automatizado (borde, animación solo en hover/foco, contraste del texto "pasa")._
- RF-34: EL SISTEMA muestra en la tarjeta de cada miembro del equipo un emblema decorativo de constelación (entre 5 y 8 estrellas unidas por líneas), distinto para cada uno y siempre el mismo para la misma persona, que con animación "se dibuja" en 0,8 s al pasar el cursor o el foco. No hay fotos ni retratos. _Verifica: test automatizado de la lógica (determinismo, distintos, 5 a 8 estrellas) + test en navegador._
- RF-35: EL SISTEMA muestra en la sección de contacto una plataforma de lanzamiento decorativa con el isologo como cohete y, con animación, un pulso del botón "Quiero despegar" cada 3 s; mantiene el estado "Formulario próximamente" y el espacio donde la spec 006 colocará el formulario. _Verifica: test automatizado._
- RF-36: EL SISTEMA muestra en el pie de página un horizonte curvo de planeta con un satélite que, con animación, lo orbita, y una frase breve con cariño (en la tabla de textos), sobre fondo sólido. _Verifica: test automatizado + revisión manual._

### Transversales: dispositivos, coste y accesibilidad

- RF-37: EL SISTEMA clasifica cada visita en clase baja, media o alta y aplica los límites de la tabla del plan (estrellas animadas, partículas simultáneas, resolución de los efectos, estrellas fugaces, estela, rastro, salto, lunas animadas; ninguna clase oculta lunas, ver RF-12), con estas reglas: movimiento reducido o dispositivo sin capa de efectos = sin efectos; ahorro de datos activado o memoria declarada ≤ 2 GB = baja; móvil con puntero táctil y ancho menor de 48 rem = baja; táctil de más ancho = media; puntero fino con 8 o más núcleos y memoria no limitada = alta; puntero fino con 4 a 7 núcleos = media; resto = baja. El máximo de partículas simultáneas es 24 en baja, 80 en media y 160 en alta. _Verifica: test automatizado de la lógica (tabla de casos) + marca de estado con la clase en el navegador._
- RF-38: SI durante 45 fotogramas seguidos el coste propio medio por fotograma supera 12 ms, ENTONCES EL SISTEMA baja una clase de dispositivo (y aplica sus límites de inmediato) y nunca la sube durante esa visita. _Verifica: test automatizado de la lógica + test en navegador con CPU ralentizada._
- RF-39: MIENTRAS la pestaña está oculta, EL SISTEMA no ejecuta ningún bucle de dibujo; y MIENTRAS no hay partículas activas ni efectos en curso, EL SISTEMA no pide ni un fotograma por encima de 2 en 2 s. _Verifica: test automatizado de la lógica (cuándo debe correr el bucle) + test en navegador (recuento de peticiones de fotograma en reposo)._
- RF-40: MIENTRAS el visitante tiene movimiento reducido, EL SISTEMA no muestra ni crea ninguna partícula, burbuja, indicador de progreso, salto, rastro, paralaje ni animación, ni siquiera con duración 0 en su estilo; el cielo es estático y completo; y SI el visitante activa el movimiento reducido a mitad de la visita, ENTONCES EL SISTEMA retira todos los efectos y deja la página en el estado estático sin mover el desplazamiento. _Verifica: test automatizado (carga con reducción, y reducción a mitad de visita)._
- RF-41: SI el código de efectos no carga, o el dibujo de efectos no está disponible en el navegador, ENTONCES EL SISTEMA muestra todo el contenido, el cielo estático, la entrada del hero y las animaciones de decoración que no dependen de ese código, y ningún elemento queda a medias. _Verifica: test automatizado con el código bloqueado y con el dibujo no disponible._
- RF-42: EL SISTEMA no permite que los efectos intercepten el ratón, el toque o el teclado, ni oculten texto ni controles: toda decoración es ignorada por los lectores de pantalla, ninguna recibe foco y los efectos no tapan ningún enlace ni botón en reposo. _Verifica: test automatizado (eventos de puntero atraviesan, foco, árbol de accesibilidad) + comprobación de accesibilidad._
- RF-43: EL SISTEMA tiene todos los textos nuevos (mensajes de Mac y frase del pie) en español y en inglés, solo en el sitio de las traducciones, sin ninguno vacío, y los textos de la tabla "Textos propuestos" coinciden con las traducciones. _Verifica: test automatizado (la comprobación de traducciones sigue en verde)._

## Textos propuestos (pendientes de aprobación del usuario)

Textos nuevos. Las burbujas son humor breve de Mac ("alien simpático"); el español es de España y el inglés para el mercado angloparlante. **El usuario debe revisarlos y aprobarlos (o corregirlos) antes de cerrar la spec.** Los nombres propios no se traducen.

| Clave                | ES                                             | EN                                                       |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `mac.greet`          | ¡Hola, terrícola!                              | Hello, earthling!                                        |
| `mac.arrive.hexaweb` | Hexaweb: aquí se construyen webs que despegan. | Hexaweb: this is where websites that take off are built. |
| `mac.arrive.rankia`  | Rankia: que Google te encuentre a la primera.  | Rankia: so Google finds you first time.                  |
| `mac.arrive.adara`   | Adara: ¡propulsor a tope!                      | Adara: booster at full power!                            |
| `mac.arrive.contact` | ¡Todo listo para despegar!                     | Everything is ready for take-off!                        |
| `mac.click.1`        | ¡Eh, cosquillas!                               | Hey, that tickles!                                       |
| `mac.click.2`        | Beep boop. Te veo.                             | Beep boop. I see you.                                    |
| `mac.click.3`        | Despegando... casi.                            | Lift-off... almost.                                      |
| `mac.idle`           | ¿Seguimos el viaje?                            | Shall we carry on with the trip?                         |
| `mac.turbo`          | ¡Modo turbo activado!                          | Turbo mode on!                                           |
| `footer.detail`      | Hecho en la Tierra, con cariño galáctico.      | Made on Earth, with galactic love.                       |

Los textos de la tabla de la spec 004 (hero, servicios, proyectos, equipo y contacto) no cambian. `hero.macGestureLabel` y el resto de claves existentes se conservan.

## Requisitos no funcionales

### SEO técnico (skill seo-tecnico; constitución, principio 7)

- RNF-1: cada página de la portada sigue cumpliendo el checklist de seo-tecnico exactamente como en la 004 (título y descripción propios, un solo encabezado principal, jerarquía sin saltos, HTML semántico, canonical, hreflang, metadatos sociales, imágenes con alt, ancho, alto y formato moderno, JSON-LD coherente, sitemap, robots, 404 real y nunca `noindex`). Los efectos no cambian ni retiran ningún texto del HTML servido, y los textos de las burbujas no se renderizan en el HTML visible. _Verifica: tests automatizados existentes de la 004 en verde + checklist de la validación._

### Rendimiento (Core Web Vitals) y presupuestos (cambios frente a la 004)

- RNF-2: la auditoría de calidad en móvil (mediana de 3 ejecuciones) da ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO en las dos páginas, con LCP ≤ 2,5 s y CLS ≤ 0,1 (sin cambio frente a la 004). Se propone además un objetivo interno de Rendimiento ≥ 92 (mediana) como margen de seguridad sobre el suelo de 90. El elemento LCP debe ser el contenido del hero (texto o imagen), nunca una decoración del cielo. _Verifica: auditoría de calidad._
- RNF-3 (**cambia el RNF-5 de la 004**): presupuesto de JavaScript comprimido (gzip): antes de terminar la carga, ≤ 3 KB (sin cambio); en total, con todos los módulos cargados (animación, efectos y desplazamiento suave), ≤ 100 KB (antes 60 KB); el módulo de efectos, ≤ 30 KB; y el código propio (todo menos las librerías de animación y de desplazamiento suave: GSAP y Lenis; ScrollTrigger dejó de usarse el 2026-10-14), ≤ 45 KB. Justificación: hoy son 52,6 KB (de ellos, 49,1 KB son las tres librerías ya aprobadas) y el código propio de esta spec se estima en 15 a 20 KB; el tope de 100 KB deja ~30 KB de margen y no se pide más porque no hay con qué justificarlo. Se mide en la tarea de medición inicial y el valor definitivo se confirma ahí: si lo medido supera 100 KB se para y se pide aprobación expresa de un nuevo tope (máximo absoluto 150 KB). _Verifica: test automatizado de presupuestos._
- RNF-4 (**cambia el RNF-4 de la 004**): el tiempo de bloqueo total (TBT) en la mediana de la auditoría es ≤ 300 ms (antes 200 ms; hoy mide 0 ms). Justificación: con 300 ms la métrica de TBT puntúa en torno a 0,8 y deja el Rendimiento por encima de 90 con las demás métricas intactas; el valor definitivo lo fija la medición inicial. Además, en una medición controlada con la CPU ralentizada ×4, la suma del tiempo de bloqueo de las tareas largas de los primeros 6 s de la capa de efectos es ≤ 300 ms, y ninguna interacción de la prueba (pulsar a Mac, enlaces de sección, teclado, desplazamiento, turbo) tarda más de 200 ms en responder (INP, sin cambio). _Verifica: auditoría de calidad + tests automatizados._
- RNF-5 (**cambia el presupuesto de CSS del plan de la 004**): el CSS de la portada comprimido es ≤ 30 KB (antes 20 KB), porque las capas de estrellas y las animaciones decorativas viven en CSS. _Verifica: test automatizado._
- RNF-6: las imágenes no cambian: ninguna imagen nueva; al cargar ≤ 90 KB y en total ≤ 400 KB en móvil de 375 px. Ninguna decoración provoca cambios de diseño (CLS ≤ 0,1; objetivo 0). _Verifica: test automatizado + auditoría._
- RNF-7: en una medición controlada de 6 s de desplazamiento automático (ventana de 1280 × 720, sin GPU, CPU sin ralentizar y clase alta), el coste propio por fotograma tiene una media ≤ 4 ms y un percentil 95 ≤ 10 ms, y el intervalo entre fotogramas tiene una mediana ≤ 18 ms y un percentil 95 ≤ 34 ms (≥ 30 FPS); con la CPU ×4 y clase baja, el percentil 95 del coste propio por fotograma ≤ 16 ms. Los FPS en navegador sin GPU se registran y se contrastan con una prueba manual en un móvil real (fluidez aceptada por el usuario). _Verifica: test automatizado (con la tolerancia que fije la medición inicial) + revisión manual._
- RNF-8: los efectos solo animan propiedades que no provocan reflujo ni repintado de página completa; como máximo 10 elementos con promoción a capa propia a la vez; ningún filtro de desenfoque en animación; la resolución interna del dibujo está limitada a 2 megapíxeles y a 1, 1,25 y 1,5 de densidad según la clase. _Verifica: test automatizado + revisión del código._

### Accesibilidad y diseño

- RNF-9: la comprobación automática de accesibilidad no da infracciones en la portada ni en las 404, en español e inglés, antes y después de revelar todo el contenido y con los efectos activos. Los únicos elementos con contraste "incompleto" permitidos son los textos sobre el cielo (RF-8), cada uno de los cuales debe pasar el contraste medido por píxeles. Foco visible en todo elemento interactivo; tamaño de objetivo táctil de Mac y enlaces ≥ 24 × 24 px. _Verifica: test automatizado + recorrido manual con Tab._
- RNF-10: ningún efecto parpadea más de 3 veces por segundo ni cubre más de un 25 % de la ventana con cambios bruscos de luminosidad (WCAG 2.3.1). _Verifica: test automatizado de los parámetros + revisión manual._
- RNF-11: sin desbordamiento horizontal ni texto cortado a 320 y 375 px ni en móvil apaisado, con y sin animación, en español e inglés, incluidas las burbujas y el indicador de progreso. _Verifica: test automatizado + revisión visual._
- RNF-12: el color solo viene de los tokens de la marca; los nuevos colores de resplandor se añaden a los tokens y su luminancia máxima sobre el texto se comprueba (RF-8). _Verifica: tests de tokens y de colores sueltos en verde._

### Idiomas, activos, licencias, privacidad y dependencias

- RNF-13: todo texto visible existe en español y en inglés (constitución, principio 6). _Verifica: test de traducciones._
- RNF-14: ninguna dependencia nueva: los efectos usan lo ya instalado (GSAP y Lenis; ScrollTrigger, aunque viene en el mismo paquete, dejó de usarse el 2026-10-14 para cumplir RF-39) y las capacidades nativas del navegador. Cualquier dependencia que se proponga durante la ejecución se detiene y se somete a aprobación del usuario con su peso y alternativas. _Verifica: el archivo de dependencias no cambia._
- RNF-15: ninguna imagen nueva: cielo, nebulosas, estela, chispas, órbitas, lunas y emblemas se generan con código; el cohete del indicador y de la plataforma es el isologo ya incluido; los 8 planetas no usados nunca entran y solo se usan Hexaweb, Rankia, Adara, Luna y Tierra. Nada de `Assets/` se versiona. _Verifica: tests de higiene de assets de la 004 en verde._
- RNF-16: sin audio, analítica, cookies, almacenamiento local ni peticiones a terceros (RNF-14 de la 004). Ningún dato de entorno de prueba llega al repositorio, a las specs ni al historial. _Verifica: tests existentes de filtraciones y de peticiones._

## Cambios respecto a la spec 004

Qué requisitos de la 004 cambian y cómo (al cerrar esta spec se actualiza la 004 solo donde figura aquí; el resto de la 004 no se toca):

| Requisito de la 004                                                                       | Cambio                                                                                                                                                      | Aquí       |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RNF-5 (JS ≤ 60 KB gzip)                                                                   | Pasa a ≤ 100 KB en total (3 KB antes de la carga sin cambio), con tope por módulo                                                                           | RNF-3      |
| RNF-4 (TBT ≤ 200 ms)                                                                      | Pasa a ≤ 300 ms (INP ≤ 200 ms sin cambio); aserción de `lighthouserc.cjs` ajustada                                                                          | RNF-4      |
| Presupuesto de CSS (≤ 20 KB, plan sección 8)                                              | Pasa a ≤ 30 KB                                                                                                                                              | RNF-5      |
| RF-38, cláusula "sin texto sobre degradados o imágenes que impidan calcular su contraste" | Se sustituye por el contraste medido por píxeles (RF-8). Se mantienen las otras cláusulas: todo el texto en el HTML y nada del hero parte invisible (RF-17) | RF-8       |
| RF-19 (cada planeta sobre su propio fondo sólido)                                         | Se conserva el color base sólido de cada bloque (mismo test de color calculado) y se le añaden resplandores y fundidos                                      | RF-5, RF-7 |
| RF-8 (equipo "sin fotos, avatares ni apellidos")                                          | Se mantiene sin fotos, retratos ni apellidos; se permite un emblema decorativo de constelación por persona (aprobado, duda abierta 3: 2026-10-19)           | RF-34      |
| RF-36 (gesto de Mac)                                                                      | Se conserva (0,6 s, ratón, toque y teclado) y se amplía con ráfaga y burbuja                                                                                | RF-28      |
| RF-33 (movimiento reducido: Mac estático, sin animaciones)                                | Se mantiene y se extiende a todos los efectos nuevos                                                                                                        | RF-40      |
| RF-35 (aparición de bloques desde lados opuestos) y RF-34 (planeta activo)                | Sin cambio                                                                                                                                                  | —          |

Las reglas de `apps/web/AGENTS.md` que cambian (fondos siempre sólidos, presupuestos, "Mac viajero") se actualizan en la tarea de cierre.

## Casos límite

- JavaScript desactivado, bloqueado, o que falla a mitad: cielo estático, entrada del hero (solo estilos) y todo el contenido visibles (RF-9, RF-41).
- Movimiento reducido al cargar y activado a mitad de la visita: cielo estático, sin partículas, sin burbujas y sin mover el desplazamiento (RF-40).
- Dispositivo táctil: sin paralaje de ratón, sin chispas de hover, sin rastro; Mac y las lunas siguen vivos (RF-13, RF-14, RF-32, RF-37).
- Móvil modesto, ahorro de datos o poca memoria: clase baja; si aun así el coste sube, baja de clase solo (RF-37, RF-38).
- Clase baja (o bajada a baja por coste) con la 2.ª luna de Rankia: queda quieta y visible en su punto de la órbita, dentro de la ilustración y sin pisar a la otra luna; no desaparece ni salta a una esquina (RF-12).
- Pestaña oculta o fuera de pantalla: nada se dibuja ni anima (RF-15, RF-39).
- Pantalla de 320 px, apaisado y cambio de tamaño o giro con efectos activos: el cielo, Mac, las burbujas y el indicador se recalculan; sin desbordamiento (RNF-11).
- Burbuja larga en inglés o con letra ampliada: sin texto cortado ni desbordamiento; la burbuja no tapa el botón principal.
- Cursor que sale de la ventana: planetas y Mac vuelven al reposo; el rastro se apaga.
- Activar a Mac muchas veces seguidas: el gesto y las burbujas no se apilan; el turbo respeta el enfriamiento (RF-27, RF-29).
- Desplazamiento muy rápido por varios planetas: Mac redirige sin saltos y sin acumular vuelos (RF-21).
- Entrar con un enlace a una sección: el contenido y el planeta activo son correctos desde el principio, sin "salto en el espacio" al cargar.
- Dispositivo con pantalla de muy alta densidad: la resolución interna del dibujo está limitada (RNF-8).
- Navegador sin soporte de alguna capacidad (p. ej. mezcla de colores, trayectorias en CSS o el dibujo de efectos): la decoración afectada se omite y el resto funciona (RF-41).
- Texto sobre el cielo en una zona con resplandor intenso: no se admite; el contraste por píxeles lo detecta y se baja la intensidad del resplandor, no el contraste del texto (RF-8).
- Búsqueda en la página y copia de texto: los efectos no interfieren (RF-42).
- Rastreadores (Googlebot): ven el mismo HTML y CSS; los efectos no se necesitan para entender la página.

## Fuera de alcance

- Páginas propias por servicio (spec 007) y formulario de contacto (spec 006): "Descubre cómo" y "Quiero despegar" siguen apuntando a las secciones de la portada.
- Centro de Control, `agencymac.com`, DNS y despliegue a producción.
- Audio y sonido de cualquier tipo.
- Gráficos 3D, Rive y cualquier librería de partículas o de animación nueva.
- Imágenes nuevas (incluido el cohete de los originales, ver duda abierta 2), capturas de proyectos, fotos o avatares del equipo.
- Cambios en los textos informativos de la 004 (hero, servicios, proyectos, equipo, contacto), en los precios, en los datos de contacto o en el SEO de contenido.
- Sustituir el cursor nativo, giroscopio y cualquier almacenamiento de preferencias del visitante.
- Los otros ocho planetas de la web antigua y sus servicios.
- Un modo claro o un conmutador para desactivar los efectos (la preferencia del sistema de movimiento reducido es el control).

## Criterios de finalización

- Todos los RF y RNF verificados según su método: tests automatizados en verde (`pnpm test`) y auditoría de calidad en verde (`pnpm quality`) con los presupuestos nuevos medidos y anotados.
- Medición inicial hecha antes de construir: sus cifras confirman o corrigen los presupuestos de RNF-3, RNF-4, RNF-5 y RNF-7, y el usuario los aprueba con la spec y el plan.
- **Aprobación visual del usuario por bloques en staging, en móvil y en escritorio** (cada bloque se revisa tras su push): (R1) hero; (R2) cielo y servicios; (R3) Mac; (R4) microinteracciones; (R5) proyectos, equipo, contacto y pie. Cada aprobación se anota aquí.
- **Textos nuevos aprobados por el usuario** por escrito (tabla "Textos propuestos"), con el resultado anotado aquí.
- Prueba manual en un móvil real (con y sin movimiento reducido) y en escritorio: fluidez aceptable y nada oculto.
- Revisión de la comprobación de accesibilidad y de las capturas de contraste por píxeles de las 7 zonas.
- Recorrido con Tab completo en español e inglés.
- Spec 004 actualizada solo donde figura en "Cambios respecto a la spec 004", documentación al día (`apps/web/AGENTS.md`, `LICENSE-BRAND.md` si procede) y `MEMORY.md`.

## Cambios de requisitos

- 2026-10-19, RF-12 (y RF-37): en clase baja deja de exigirse que solo se muestre 1 luna por planeta. Ahora: 1 luna animada por planeta y las demás quietas y visibles en su punto de la órbita; sin JavaScript siguen 1/2/1 lunas. Motivo: las hojas de estilo servidas no pueden ocultar contenido, y el plan ya fijaba "Lunas por planeta (animadas): 1". Aprobado por el usuario el 2026-10-19 (opción a).

## Dudas abiertas

- [NECESITA ACLARACIÓN] 1. Referencias visuales: ¿hay webs concretas (de marketing o de otro sector) que el usuario quiera usar como referencia de "wow"? No bloquea; si las hay, afinan la revisión visual de cada bloque.
- [NECESITA ACLARACIÓN] 2. Cohete de los originales: recomendación, no usarlo. Mac ya viene sobre su nave y el isologo (un cohete naranja) cubre el indicador de progreso y la plataforma de lanzamiento sin añadir imagen ni peso. Si se quiere usar, se aprueba aquí, se añade al manifiesto de assets y a `LICENSE-BRAND.md` y se mide su peso.
- [RESUELTA] 3. Emblemas de constelación del equipo (RF-34): ¿se aceptan como decoración, o se interpreta que la 004 ("sin avatares") lo prohíbe? Recomendación: aceptarlos (no son retratos ni datos personales y se generan por código); si no, se retira RF-34 y queda la tarjeta con borde cósmico.
  - **Resolución:** aprobados por el usuario (comunicado por el coordinador el 2026-10-19, anotado en T29): emblemas generados por código, sin fotos ni avatares.
- [RESUELTA] 4. Presupuestos propuestos (JS ≤ 100 KB, CSS ≤ 30 KB, TBT ≤ 300 ms, Rendimiento interno ≥ 92): ¿se aprueban con la medición inicial como confirmación? Sin aprobación no se cambia `lighthouserc.cjs`.
  - **Resolución:** el usuario dejó los presupuestos en manos del criterio del coordinador al aprobar la spec (línea de estado, 2026-10-12); T2 los midió y el coordinador los confirmó sin cambios (plan, sección 12). El usuario ratificó el tope de 100 KB de JS al aprobar D19 (2026-10-14) y eligió la opción (a) de T32 (2026-10-19). `lighthouserc.cjs` se cambió en T32.
- [RESUELTA] 5. Textos nuevos y tono de Mac (tabla "Textos propuestos"), y el huevo de pascua (5 activaciones de Mac en 3 s): ¿se aprueban o se cambian?
  - **Resolución:** textos `mac.*` aprobados por el usuario el 2026-10-16 tal como están en la tabla (T23); Mac y el huevo de pascua, aprobados en R3 (2026-10-18); `footer.detail`, visto en R5 y aprobado sin cambios (2026-10-19). Falta solo la aprobación final por escrito de T33.
