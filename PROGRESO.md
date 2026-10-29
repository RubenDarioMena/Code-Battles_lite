# Code-battle-lite · progreso

## Repositorio Git y subida inicial · 28 de octubre de 2026

- Vinculada esta carpeta a `https://github.com/RubenDarioMena/Code-Battles_lite.git`, rama `main`, conservando el commit inicial del remoto.
- Preparada la subida del estado actual: los dos prototipos, pruebas, documentación y el laboratorio `educational-animation/`. Los `.gitignore` existentes excluyen dependencias instaladas, cachés, archivos de entorno y salidas de vídeo.
- Actualizado el README para identificar el repositorio propio. No se cambian las reglas ni la interfaz del juego.
- Verificación actual: **50 comprobaciones de lógica correctas**, sintaxis de los seis scripts de los prototipos y de las dos suites de navegador correcta; `npm run typecheck` correcto en Motion Canvas y Remotion. No se repitieron las suites de navegador ni se realizó QA de dispositivos para esta subida.

## Tareas visuales de Opus en Rocket Launcher (V1–V10) · 28 de octubre de 2026

- Revisado antes de tocar: la lógica de Add/Replace, el cuadro de selección con ratón y el inspector móvil a pantalla completa (`inspector-movil`, «tira» reservada para Ajustes) ya estaban implementados. No se tocó su lógica.
- V1–V3: color por función principal con tablas provisionales en `juego.js` (`FUNCIONES`, `FUNCION_DE`): lanzador ofensivo (+ rastreo como secundaria), sensor de vibración en rastreo, reparador utilitario y depósito como fábrica. Tokens `--rol-*` en `base.css`, con tres paletas en prueba (A Neón por defecto, B Contraste, C Sobria). Los enemigos conservan sus colores.
- V4: las etiquetas de nombre solo aparecen en unidades seleccionadas, con franja del color de su función, borde claro en la principal y escalonado automático si se tocan.
- V5: halo difuso del color de la función en las máquinas no seleccionadas; la secundaria se insinúa con un arco arriba a la izquierda. El halo pasa a rojo con el lanzador atascado. La selección es el mismo círculo, nítido y claro (`--sel`), en 3D y en el plano.
- V6: cuadro de selección claro con filo oscuro, estilo RTS. En táctil, doble toque en el suelo y arrastrar con el segundo toque dibuja el cuadro; sustituye a «mantener y arrastrar» (recorrido), que se eliminó. Arrastrar con un dedo mueve la cámara; la pulsación larga sigue abriendo la ficha y el doble toque sobre una unidad sigue eligiendo las del mismo tipo.
- V7–V8: brillo como calcos aditivos (texturas de canvas sobre el suelo y puntos de luz), sin luces simuladas. Variantes: Pilotos (por defecto), Faros, Aura y sin brillo; intensidad baja/media/alta. Halo: Medio (por defecto), Suave, Neón o ninguno. Selector con `?poc=1`; la elección queda en la URL. Los calcos no cuentan al elegir con el puntero.
- V9: ficha móvil a pantalla completa con franja de color de la función, nombre a 21 px, función y estado, signos vitales en dos columnas, unidades en fila desplazable, toques de 44 px y métricas en cuadrícula.
- V10: Add con contorno verde e icono «+» (subtítulo «al final»); Replace rojo macizo («borra el anterior»), también en el diálogo de confirmación. Texto de estado encima y botones iguales.
- Verificación actual en el puerto 8771: **50 comprobaciones de lógica y 25 de navegador de Rocket Launcher correctas** (la prueba de recorrido táctil se sustituyó por cuadro con doble toque y arrastre de un dedo sin selección). Sintaxis correcta. Recorridas todas las variantes en 3D y plano sin errores de consola; capturas de PC y móvil emulado revisadas.
- Pendiente: elegir paleta, halo, brillo e intensidad en QA real (Android y iPhone); decidir si la selección sigue siendo blanca o toma el color de la función. Gestos táctiles emulados en Chromium, no en dispositivo. Tres vistas no se modificó. Sin commits ni publicación.

## Investigación de StykAnimate y tutoriales · 28 de octubre de 2026

- Añadido `docs/INFORME-STYKANIMATE.md`, con fuentes sobre el editor, MCPs comunitarios y uso junto a GSAP, Three.js, Remotion y HyperFrames. Refinado con la skill `unslop` indicada por el usuario.
- Confirmada la existencia de varias implementaciones MCP y de la PR oficial #21, abierta, sin fusionar y sin marca de borrador en la consulta actual. Distinguida la edición de archivos, el control del editor activo y la generación/exportación de vídeo.
- Comprobado en el código y el diálogo web que WebM de navegador no conserva alfa. PNG/APNG y WebM nativo de escritorio tienen capacidades diferentes. Propuesta una guía HTML separada de las reglas de simulación y una prueba de vídeo con HyperFrames.
- Verificación documental, revisión de código público y navegación por el sitio, los ejercicios y el diálogo de exportación. No se instalaron ni ejecutaron los MCPs, no se exportaron clips ni se midió rendimiento. Solo se modificó documentación; no corresponde repetir las pruebas del juego por este informe.
- Pendiente, como propuesta y sin implementar: probar una lección de recoger/entregar, elegir el flujo de autoría y comprobar sincronización, legibilidad móvil y conservación de programas/borradores.

## Tres vistas con la interfaz de Rocket Launcher · 28 de octubre de 2026

- Adaptado el prototipo de recogida en `Prototypes/Tres vistas/`, separado en `index.html`, estilos, iconos, lógica y distribución, con su propio `probar.html`. `Prototypes/02_tres_vistas.html` conserva la entrada anterior mediante redirección que mantiene query y hash. La copia `02_tres_vistas.html` de la raíz queda como referencia histórica.
- Trasladados los marcos y controles de Rocket Launcher: reparto adaptable, divisor hasta los extremos, orden independiente por eje, Ajustes, cabecera plegable, consola móvil, inspector sobre el plano y cierre fijo mientras se desplaza toda la ficha. El plano 2D se ajusta al espacio del panel y conserva sus coordenadas de interacción.
- Se conservan los modos Bloques, Pseudocódigo y JavaScript. Bloques y pseudocódigo mantienen sus textos EN/ES, edición de valores y arrastre; cada modo muestra su paleta. Ajustes permite elegir modo, idioma de los bloques y tamaño de letra. En teléfonos de poca altura, idioma/letra se consultan en Ajustes y la consola espera a desplegarse para conservar espacio de edición. En móvil los botones con etiquetas conservan su ancho natural y se desplazan horizontalmente.
- JavaScript incorpora iconos de recogida/entrega, resaltado opcional, doble clic en cadenas/comentarios, triple clic en delimitadores y elementos envolventes. La barra de símbolos aparece sobre el teclado móvil únicamente en JavaScript. El probador permite emular ese reparto desde PC.
- Conservados por comparación textual los retos, API de R1, Web Worker, generador/traductor, creación de mundo, reglas y bucle de paso fijo del banco 02. Siguen las claves y formatos `cmg-banco02:*`; las preferencias nuevas de interfaz usan `cmg-banco02-ui-*` y no comparten las de defensa. Añadida la comunicación editor/layout mediante `window.cmg` sin retirar miembros anteriores de `window.__banco`.
- Corregida la recepción del evento en la confirmación de dos pulsaciones para descartar JavaScript no traducible; la primera pulsación conserva el texto y la segunda recupera el árbol.
- Documentados arranque y estructura de los dos prototipos. Reparadas las rutas de las pruebas existentes tras el traslado previo de Rocket Launcher a `Prototypes/Rocket Launcher/`; no se modificaron sus recursos de juego.
- Verificación actual en el puerto dedicado **8771**: **50 comprobaciones de lógica, 24 de navegador de Rocket Launcher y 43 de navegador de Tres vistas correctas**. La suite nueva cubre paletas/idiomas, edición y arrastre con ratón y tacto emulado, traducción, confirmación de descarte, persistencia, inspector, divisor, Ajustes y teclado simulado. Un mismo programa completó el reto en los tres modos con idéntico tiempo de simulación. Sintaxis de los scripts nuevos y pruebas correcta; recursos locales verificados y entrada disponible en el servidor manual 8770.
- Límites: conserva el mapa 2D de recogida; no se añadió un visor 3D ni se habilitaron otros lenguajes en defensa. El teclado y el tacto automatizados son emulación de Chromium: sigue pendiente el QA con teclado real, Android y Safari/iPhone. Se mantienen las dependencias CDN y el guardado por origen. Sin commits, push ni publicación.

## Inspector en PC · 28 de octubre de 2026

- Se extendió el desplazamiento de la ficha completa al escritorio: la cabecera y los signos vitales salen de vista y solo el cierre queda fijo, igual que en móvil. Cambios en `css/layout.css` y su versión en `index.html`.
- Verificación básica: 50 comprobaciones de lógica y recurso CSS servido con las reglas para ambos formatos; pendiente QA manual de desplazamiento en PC.

## Separación del proyecto · 28 de octubre de 2026

- Creada la carpeta `/Users/rubenmena/Documents/Dev/Code-battle-lite` como proyecto independiente, copiando el estado actual del worktree de origen, incluidos los cambios sin commit y las pruebas nuevas.
- El juego vive en la raíz: `index.html`, `css/`, `js/`, `probar.html`, `server.ps1` y `pruebas/`. Se conservó la lógica y los estilos de la sesión; se actualizaron el título y la marca visible a Code Battle Lite/CBL.
- Documentación propia: README de arranque/estructura/QA, `docs/VISION.md`, este progreso e instrucciones `AGENTS.md`/`CLAUDE.md`. No se heredan las reglas ni las pruebas Godot del origen.
- Fuera de la copia: proyectos Godot, demos/bancos antiguos, SQL/backend, modelos y recursos no utilizados, imágenes de referencia, logs generales, dependencias instaladas y metadatos Git.
- `server.ps1` arranca desde la raíz nueva y ya no depende de `Concept-HTML/juego` ni de Trunk.
- La suite de navegador ahora habilita las coordenadas desde Ajustes y genera el doble toque con Chromium para evitar que la latencia del puente de automatización descomponga el gesto.
- Verificación de migración: **50 comprobaciones de lógica y 24 de navegador correctas**, sintaxis de los cuatro scripts comprobados, título y siete recursos locales disponibles por HTTP, enlaces de documentación válidos y ausencia de enlaces simbólicos/dependencias de carpetas del origen. Comparación del contenido JS/CSS tras las cabeceras: idéntico al origen.
- Servidor de uso manual en el puerto 8770: `http://localhost:8770/`, accesible también mediante la IP de la computadora en la Wi-Fi. El puerto 8771 se dedicó al QA automatizado.
- Se mantienen los identificadores internos y formatos de localStorage para no alterar el guardado durante la copia. El origen nuevo no importa automáticamente los datos del puerto anterior. Las dependencias CDN siguen requiriendo conexión.
- No se inicializó Git, no se hicieron commits ni se publicó un remoto. El historial queda en el repositorio de origen; esta separación parte de una copia limpia del estado actual.
- El proyecto original y sus servidores existentes se conservaron. Continúa pendiente el QA con teclado y dispositivos reales.

## Sesión del 28 de octubre de 2026

Registro exclusivo del proyecto HTML. Consolida el informe de revisión de la sesión interrumpida y todas las iteraciones posteriores de esta conversación. El diseño vigente se resume en `docs/VISION.md`. Las rutas y pruebas Godot citadas en la cronología corresponden al proyecto de origen.

### Estado de entrega

- Se actualizó el checkout principal con `git fetch --prune origin` y `git pull --ff-only origin Trunk`: `98c801b` → `259ac33`, sin conflictos.
- Se revisaron los cuatro commits recibidos: servidor con recarga, diagnóstico de archivos/rutas, cambios de editor/interacción/programas múltiples y registro de conversación.
- Correcciones e iteraciones en el worktree `revision-html`, rama `agente/codex/revision-html`. Todos los cambios de esta sesión permanecen sin commit, push ni merge.
- Concepto2, su simulación, contrato, esquema SQL y API de programas no se modificaron. La imagen local sin seguimiento del checkout principal se preservó.

### 1. Recuperación de la sesión interrumpida

- Ejecutar con un borrador de selección múltiple pendiente exige aplicar Add o Replace antes de arrancar los programas.
- Cerrar el inspector conserva la selección de unidades y el contexto del editor.
- Los borradores de grupos con programas distintos se recuperan al volver a seleccionar el mismo conjunto, independientemente del orden de selección.
- Add/Replace consumen el borrador; recargar o cambiar de reto lo descarta. Los borradores no se guardan en disco.
- Reconstruir el mundo sincroniza el contexto del editor con las unidades seleccionadas.
- Se revisó el servidor PowerShell existente: no requirió cambios de implementación en esta sesión.

### 2. Selección y elementos envolventes

- Doble clic selecciona comentarios `/* … */` completos, incluidos los multilínea, igual que las cadenas con sus comillas.
- Con código seleccionado, los iconos de `while (true)`, `while` e `if/else` lo envuelven y añaden cuatro espacios de sangría conservando la sangría relativa.
- Las llamadas con huecos colocan la selección en el primer argumento disponible.
- Los pares de símbolos de la barra móvil envuelven la selección con sus delimitadores.
- Sin selección se mantienen las plantillas anteriores. Los bloques nuevos pueden declarar `ATAJOS.envolvente`; `window.cmg.envolver` comparte la operación con la interfaz móvil.
- El usuario confirmó manualmente esta iteración como verificada.

### 3. Pruebas en la red de casa

- Se conservó el servidor local PowerShell con recarga en el puerto 8768.
- Se inició un servidor de pruebas accesible por Wi-Fi: `python3 -m http.server 8769 --bind 0.0.0.0 --directory Concept-HTML/juego`.
- Dirección usada en esta sesión: `http://192.168.1.70:8769/`. La IP puede cambiar y el servidor debe seguir ejecutándose. Este servidor Python requiere recargar la página tras editar archivos.
- No se publicó un sitio externo por este cambio.

### 4. Ajustes

- Engrane al final derecho de la cabecera del mapa para abrir el modal de Ajustes.
- Confirmación de Replace activable/desactivable y persistente.
- Opciones futuras de idioma (español/English) y lenguaje (seudocódigo/JavaScript/Python) visibles y deshabilitadas; siguen activos español y JavaScript.
- Opción para mostrar coordenadas manuales; quedan ocultas por defecto y la función se conserva.
- Botón para restaurar el reparto entre mapa y código.

### 5. Distribución de pantalla y divisor

- Distribución automática, izquierda/derecha o arriba/abajo.
- Dos preferencias de posición siempre disponibles: mapa a izquierda/derecha y mapa arriba/abajo. Ambas tienen vista previa y se guardan de forma independiente.
- Automático indica la distribución activa y utiliza la posición correspondiente al cambiar el tamaño de ventana o dispositivo.
- Los paneles existentes se reordenan sin reiniciar programas o cámara; se conserva el foco/selección del editor cuando corresponde y se adapta el orden de tabulación.
- El divisor permite reducir cualquiera de los paneles a cero, con ajuste a los extremos. El asa permanece disponible para recuperarlo.
- El panel oculto deja de recibir foco; si contenía el foco se retira. El divisor admite ratón, dedo, flechas del eje y Home/End; doble clic restaura el reparto inicial.
- El porcentaje representa el tamaño del mapa y se adapta al invertir el orden. Los repartos se conservan por formato y orientación según el modo.
- Se evita recalcular la cámara cuando el campo tiene ancho o alto cero.

### 6. Escritura móvil y herramientas

- Pestañas, barra de programas y coordenadas manuales agrupadas en una cabecera plegable.
- Mientras se escribe con teclado móvil, se prioriza la paleta de iconos y se pliega la cabecera. El editor aprovecha el viewport visual encima de la barra de símbolos.
- El botón permite desplegar herramientas sin cerrar el teclado ni perder la selección de código.
- Al plegar, desaparece la fila vacía: el botón flota sobre la paleta con borde rojo tenue.
- Las herramientas del programa se muestran según la pestaña activa.

### 7. Inspector en pantallas estrechas

- Etiquetas, valores y pie de gráfica admiten saltos de línea para que FailureRate y sus datos queden dentro de las tarjetas.
- Estado final: solo el botón de cerrar queda fijo en la ficha móvil completa. Nombre, controles restantes y signos vitales se desplazan con las estadísticas.
- La iteración intermedia que fijaba toda la cabecera fue sustituida por este comportamiento.

### Archivos de implementación y documentación

- `index.html`: estructura de herramientas, Ajustes, cierre móvil y versiones de recursos.
- `css/componentes.css`: estilos de Ajustes, vistas previas y adaptación de signos vitales.
- `css/layout.css`: orientación, plegado completo, teclado, herramientas y cierre flotante.
- `js/juego.js`: selección/borradores, elementos envolventes, pestañas y tamaño del campo.
- `js/layout.js`: preferencias, reordenación, divisor, foco, teclado y símbolos envolventes.
- `pruebas/interaccion.cjs`: ampliación de las pruebas de lógica.
- `pruebas/navegador.mjs`: nueva suite de navegador de la revisión inicial.
- `README.md`, este archivo y el informe general de colaboración: comportamiento, resultados y límites.

### Verificaciones realizadas durante la sesión

- Lógica: se pasó de 20 a 50 comprobaciones correctas tras añadir selección de comentarios y elementos envolventes.
- Revisión inicial: 24 comprobaciones en navegador, con ratón/tacto, Add/Replace, Web Workers, WebGL y teclado simulado; ocho comprobaciones HTTP del servidor PowerShell.
- Iteraciones posteriores: comprobaciones breves de Ajustes, persistencia, extremos del divisor, orientación/orden, foco y paleta con teclado simulado, cambio automático de eje y cierre tras desplazar hasta el final.
- A 320 px se comprobó que los signos vitales no desbordaban y que únicamente el cierre permanecía fijo.
- Sintaxis JS y `git diff --check` correctos en las revisiones correspondientes.
- Las pruebas obligatorias de Godot (`prueba_sim.gd` y `prueba_larga.gd`) se ejecutaron secuencialmente y finalizaron con código 0 en las iteraciones registradas. No hubo cambios en Godot.
- Los resultados anteriores corresponden a sus respectivas etapas: la suite completa inicial de 24 comprobaciones no se volvió a ejecutar después de todos los cambios de interfaz. Debe actualizarse, entre otros puntos, para habilitar las coordenadas manuales cuando las necesite.

### Pendientes y límites

- Continuar QA manual con teclado real, selección táctil, Samsung S24 Ultra/hyperMarker e iPhone/Safari.
- Idiomas y modos seudocódigo/Python aún no implementados.
- Persistencia de borradores múltiples entre recargas aún no implementada.
- El adjunto original con criterios T1–T12 no está disponible en el repositorio; se trabajó con el log y los comportamientos descritos.
- Servidor PowerShell sin validación en Windows; las comprobaciones HTTP se hicieron en este entorno.
- Preferencias y programas dependen del origen del navegador: cambiar IP, puerto o dominio no traslada automáticamente su almacenamiento local.


## 28-oct-2026 · Setup de animación educativa (`educational-animation/`)

- Nueva carpeta aislada del juego con npm workspaces: Motion Canvas 3.17.2 (`concepts/motion-canvas`) y Remotion 4.0.535 (`compositions/remotion`). El juego no cambia ni gana dependencias.
- Piloto `await` vs polling ocupado implementado en ambos motores con lógica compartida (`shared/`): paleta y resaltado del editor del juego (propio, no CodeMirror), stickman vectorial provisional, contador con motion blur determinista, cues con nombre.
- Verificado: `npm install` y `npm run typecheck` (ambos proyectos) correctos; el bundle de Remotion compila incluyendo `shared/`.
- Motion Canvas: corregido el arranque (el plugin es CJS; se quitó `"type": "module"` como en la plantilla oficial). Editor abierto en navegador y fotograma 300 revisado (contador borroso, estela, resaltado). Las cajas ya no flotan antes de caer. No se renderizó vídeo.
- Remotion: sin fotogramas. Su Chrome headless (Chromium 157) se cierra al abrir la página en macOS 26.5.1 (`icudtl.dat not found in bundle`, `GPU process isn't usable`, `Session closed`), también en la terminal del usuario.
- Pendiente: personajes StykAnimate, variante B, voz, HyperFrames/Motion Studio.
