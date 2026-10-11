# Constitución — AgencyMac

Principios innegociables. Toda spec, plan y tarea debe cumplirlos.

1. **Stack mínimo y gratuito**: solo se usan las tecnologías de `AGENTS.md`; toda dependencia o servicio nuevo se justifica en el plan y lo aprueba el usuario, y ningún servicio con coste se añade sin su OK.
2. **La spec manda**: no se implementa nada que no esté en una spec aprobada; todo cambio de requisitos pasa primero por la spec, luego por el plan y las tareas, y por último por el código.
3. **Lógica separada de la interfaz**: las reglas (validación de formularios, estados del CRM, traducciones, cálculos) viven en funciones puras sin acceso al DOM, la red ni la fecha actual; los componentes solo pintan y llaman a esas funciones.
4. **Tests primero**: cada requisito funcional tiene al menos un test (Vitest para la lógica, Playwright para los flujos), escrito antes que el código; ninguna tarea se cierra con tests en rojo.
5. **Datos y secretos protegidos**: el repo es público, así que ninguna clave, token, .env ni dato de contacto o cliente llega nunca a un commit; esos datos solo viven en D1, no aparecen en logs, el Centro de Control solo es accesible tras Cloudflare Access y las contraseñas de clientes nunca se guardan en el sistema.
6. **Idiomas**: el código, los nombres y los comentarios van en inglés; specs y documentación en español; todo texto visible de la web pública existe en ES y EN.
7. **SEO y rendimiento**: toda página pública cumple la skill seo-tecnico, su contenido está en el HTML sin depender de JavaScript, las animaciones respetan `prefers-reduced-motion` y Lighthouse (móvil) no baja de 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO.
