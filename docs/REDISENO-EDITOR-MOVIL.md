# Rediseño del editor móvil — lineamientos generales

## Objetivo

Dar más espacio al código y facilitar la edición táctil **sin perder las herramientas ni la estética metálica del juego**. Estas son decisiones de diseño acordadas en conversación, no una especificación técnica cerrada. Quien implemente deberá revisar primero el comportamiento actual del editor y reutilizar lo que ya funciona.

## Distribución propuesta (de arriba hacia abajo)

1. **Barra superior mínima:** conservar solo unas 4–5 acciones esenciales, como ejecutar (icono ▶), comentar, cambiar a mapa/otra vista y salir de pantalla completa. Mover opciones poco frecuentes —por ejemplo, tamaño de letra, resaltado, registro, órdenes y configuración del escenario— a menús secundarios según corresponda. El resaltado puede permanecer activo por defecto.
2. **Editor de código:** debe ocupar la mayor parte de la pantalla y mantenerse lo más despejado posible.
3. **Barra de edición y ProtoMouse:** seis botones compactos, con iconos, alrededor de una zona táctil central:
   - Izquierda: **deshacer · rehacer · selección**.
   - Centro: **ProtoMouse**, para mover el cursor al mantener presionado y arrastrar.
   - Derecha: **cortar · copiar · pegar**.
4. **Barra metálica de inserción:** una fila horizontal desplazable con acciones de programación y símbolos. Aprovechar los botones metálicos existentes y sus menús de variantes.
5. **Teclado nativo:** mantener el teclado habitual de Android; iOS es una prioridad secundaria. Las dos barras propias deben acomodarse sobre el teclado cuando esté abierto.

## Interacciones acordadas

- **Reservar el gesto de arrastre principalmente para el ProtoMouse.** Su superficie debe ser suficientemente cómoda para movimientos precisos.
- El botón de **selección** funciona como interruptor visual: desactivado, el ProtoMouse desplaza el cursor; activado, extiende la selección de texto. La luz/estado del botón debe hacer evidente el modo activo.
- En los botones metálicos, **una pulsación prolongada despliega más botones metálicos y después se toca la opción deseada**. No introducir selección por deslizamiento: conservar el comportamiento que ya existe en la aplicación y su feedback visual.
- **Agrupar símbolos para ahorrar espacio:** un botón de envolventes (`()`, `[]`, `{}`); otro de puntuación (`.`, `,`, `;`, `:`); y grupos similares para estructuras (`if`, `while`, `for`, etc.). Al insertar una estructura debe poder aplicarse sobre código seleccionado cuando corresponda.
- Las **sugerencias de funciones y variables** pueden seguir en el desplegable que ya tiene el editor; la barra metálica no necesita duplicar ese sistema ni ser completamente contextual desde el inicio.
- Colocar el **Inspector** —información, propiedades y funciones del robot programado— como primera o segunda opción del botón de información.

## Criterios para la implementación

- Priorizar **espacio útil para código, claridad de los iconos y pocos toques por operación**.
- Reutilizar los componentes, animaciones, luces y menús metálicos existentes antes de rediseñarlos.
- Evitar que tocar las barras cierre el teclado, pierda la selección o cambie inesperadamente la posición del cursor.
- Comprobar que desplazarse por la barra de inserción no active por accidente una pulsación prolongada.
- Mantener accesibles las funciones que se retiren de la pantalla principal.
- Ajustar tamaños y distribución en teléfonos reales; no asumir que todas las pantallas o teclados ocupan el mismo espacio.

## Alcance de esta nota

Este documento define **la intención de experiencia de usuario**, no obliga a una arquitectura ni a APIs concretas. Las dimensiones exactas, la agrupación final de botones y los detalles del ProtoMouse quedan para validación durante la implementación.

---

## Primera implementación (rama `ui-movil-editor`, 5 de noviembre de 2026)

Notas añadidas al aplicar los lineamientos; el texto de arriba es el acordado. Precisiones del usuario: lenguaje y tamaño de letra se elegirán al principio y después solo en Ajustes; los bucles e `if` usan los botones metálicos que ya existían; puntuación y envolventes van con ese mismo estilo.

| Lineamiento | Cómo quedó |
| --- | --- |
| Barra superior mínima | ▶ (■ al correr), comentar, mapa (con pantalla completa), pantalla completa (si el código ocupa la esquina) y ⋯. Los programas (`LAU-01`…) siguen a la izquierda, también a pantalla completa. No se pliega, ni con el teclado. |
| Menús secundarios | ⋯ abre placas metálicas: Programa, Registro, Órdenes, Escenario, Sin teclado y Ajustes. Fuera del programa reaparece la fila de pestañas para volver. |
| Lenguaje, letra, resaltado | En Ajustes (Lenguaje del programa y la sección nueva Editor: tamaño de letra y colores). El resaltado sigue activo por defecto. **Pendiente:** elegir lenguaje y letra al empezar. |
| Editor | Ocupa todo lo demás. El panel inferior (inspector/consola) se retira en el teléfono. |
| Barra de edición + ProtoMouse | deshacer · rehacer · selección · ProtoMouse · cortar · copiar · pegar. Lo retirado sigue manteniendo pulsado su pariente (esquina marcada, placas metálicas): Selección → ampliar, reducir, subir y bajar línea; Cortar → borrar, desenvolver; Copiar → duplicar; Pegar → línea nueva, sangrar y quitar sangría. |
| ProtoMouse | Trackpad relativo: arrastrar mueve un puntero virtual (con aceleración) y el cursor salta al carácter más cercano, por renglones visuales. El arrastre sigue fuera de la franja; al llegar arriba o abajo el código se desplaza. Nunca enfoca el código: el teclado sigue como estaba. Con el teclado cerrado pinta su propio cursor y selección. Un toque sin arrastrar explica cómo se usa. |
| Selección | Interruptor con luz azul (y la franja del ProtoMouse se tiñe). Encendida, el ProtoMouse amplía desde el extremo fijo. Se apaga al cambiar el texto y al usar cortar, copiar, pegar u otra acción. |
| Barra metálica de inserción | La paleta de siempre, al pie y sobre el teclado. Delante, dos botones nuevos con variantes: pares `( )` `[ ]` `{ }` `" "` (rodean lo elegido) y puntuación `.` `,` `;` `:`. Comentar sale de esta barra porque está arriba. Sustituye a la antigua barra de símbolos. Desplazarla no abre variantes. |
| Teclado nativo | Las dos barras propias quedan justo encima; el código ocupa el viewport visible. |
| Inspector | Segunda pestaña de la ficha ⓘ (tras Objetivo); la consola, la última. La ⓘ marca los mensajes nuevos. |

Límites de esta entrega: solo emulación de Chromium (falta probar en teléfonos reales, sobre todo el ProtoMouse y el teclado de Android); el teléfono en horizontal sigue usando la distribución de PC; la demo del editor (`shared/editor/demo.html`) conserva la barra clásica; iOS sin revisar.
