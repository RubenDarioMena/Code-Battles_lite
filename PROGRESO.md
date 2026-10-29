# Code-battle-lite · progreso

## Corrección del despliegue de main en Netlify · 29 de octubre de 2026

- Reproducido el 404 de `https://codewar-mageddon.netlify.app/`. Netlify tenía publicado `main@49bd493`, sin `index.html` en la raíz; la portada, recursos compartidos y configuración de publicación seguían sin seguimiento en la carpeta local.
- Se prepara la inclusión en `main` del conjunto estático ya implementado: entrada Factory / War / Campaign (Próximamente), recursos de ambos juegos, `netlify.toml` y generador de `dist/`. El laboratorio de animación y el arnés de recuperación quedan fuera de esta subida.
- Comprobación actual: 75 pruebas de lógica, sintaxis de scripts, 8 HTML y 41 referencias locales del paquete correctos. Las 131 comprobaciones de navegador pasan en 8771: War (57), Tres vistas (43), editor Factory (23) y entrada (8), incluidos arranque de Factory/War, Campaign, retorno al inicio y anchos móviles emulados. En Netlify se confirmó base `/`, sin comando ni directorio de publicación configurados; el archivo TOML versionado aporta ambos valores.
- Publicación y comprobación del dominio real pendientes al iniciar esta corrección; los resultados finales se registrarán tras el despliegue. Los programas continúan guardándose por origen, y el tacto/teclado real sigue pendiente de QA manual.

## Factory refinado, entrada común y preparación Netlify · 29 de octubre de 2026

- Entrada nueva en `index.html` con **tres cuadros**, según la aclaración del usuario: Factory → Tres vistas, War → Rocket Launcher y Campaign → «Próximamente». Portada adaptable, navegación por teclado, página Campaign y 404. Ambos juegos vuelven al inicio desde CBL en PC o desde Ajustes en móvil.
- Herramientas de editor extraídas a `shared/`: iconos generales, estructura tolerante y editor sin teclado, más su CSS. Factory añade sus iconos y datos de edificios/materiales/sensores. War consume los mismos módulos; no se duplicó la simulación ni se añadieron dependencias.
- Factory incorpora fichas sin teclado, selección semántica ampliable/reducible, arrastre de valores y líneas, asas por número o borde, sugerencias para rellenar argumentos/huecos, variantes por pulsación larga/clic derecho y barra reordenable por grupos. La barra actúa también sobre bloques/seudocódigo (cortar/copiar/pegar, duplicar, borrar, mover y seleccionar al contenedor); sustituye visualmente a los controles de selección antiguos. Seudocódigo refinado con placas por categoría, chips y guías de sangría. Paleta/barra en una línea y consola móvil cerrada.
- El historial de Factory guarda texto y árbol juntos. Los ids de UI se regeneran y se excluyen de la identidad del documento; cambiar de reto conserva el historial correspondiente durante la sesión. Se guarda antes de cambiar de reto y se vacía el guardado pendiente al ocultar/abandonar la página. Comentar e insertar sin teclado no enfocan el textarea. Programas y preferencias mantienen `cmg-banco02:*` y `cmg-banco02-ui-*`; no comparten las preferencias de War.
- Review de War: corregida la traducción que cambiaba `let`/`var` a `const`, convertía reasignaciones en declaraciones o renombraba el índice de un `for`. Ahora conserva esas formas. Se rechazan con aviso las comparaciones con coerción (`==`/`!=`), los ámbitos de bloque independientes y `console[variable](…)`, que antes podían cambiar de significado al editarse. Corregida la supresión de un clic antiguo tras elegir variantes. Regresiones añadidas a la suite de War; el fixture de seudocódigo ya no depende de programas guardados por una prueba anterior.
- Comparación textual con HEAD: runtime/Web Worker, modelo/generador/traductor y núcleo de creación/simulación de Factory sin cambios; RNG y creación del mundo de War sin cambios. No se cambió la API del jugador ni el formato de guardado. `window.cmg` conserva sus miembros y añade el adaptador opcional del historial/edición.
- Netlify: `netlify.toml` ejecuta `node scripts/preparar-netlify.mjs` y publica `dist/`. La lista permitida incluye solo portada, Campaign, juegos, `shared/` y la redirección heredada de `Prototypes/`. Excluye animación educativa, pruebas, documentación y metadatos. `dist/` está generado e ignorado; también puede subirse manualmente. README/VISION actualizados; PowerShell ajustado a servir la raíz completa con los recursos compartidos.
- Verificación actual en el puerto dedicado 8771: **75 comprobaciones de lógica y 131 de navegador correctas** (43 de Tres vistas, 23 nuevas de Factory, 57 de War y 8 de portada/paquete). Un mismo programa completa el reto con idéntico tiempo en los tres modos. Paquete regenerado: **8 HTML y 41 referencias locales** verificados, con exclusión del material de desarrollo. Sintaxis de los scripts y pruebas, lectura de TOML y `git diff --check` correctos. Capturas de PC/móvil emulado revisadas. PowerShell no está instalado en este entorno.
- Límites: Factory conserva su plano 2D, un robot programable y sus retos de recogida; 3D, selección múltiple/Add/Replace y sensores de defensa pertenecen a War. Se mantiene el subconjunto de cada traductor, los CDN y el almacenamiento por origen: Netlify no importa automáticamente los programas locales. Tacto y teclado de las pruebas son emulación de Chromium; pendiente QA en Android/iPhone reales. No se validó PowerShell en Windows ni un despliegue real en Netlify. Sin commits, push ni publicación; cambios previos de animación educativa/arnés conservados.

## Seudocódigo, barras de una línea y orden de la barra · 29 de octubre de 2026

- Seudocódigo en Rocket Launcher (`js/seudo.js`, nuevo), traído de Tres vistas y adaptado al lanzador. Interruptor JS/Seudo junto a la letra y en Ajustes → Lenguaje del programa, con idioma ES/EN (`cmg-juego-modo`, `cmg-juego-idioma-seudo`). Renglones: apunta (con alternativa `??`), escucha (red de sensores), dispara, ráfaga, deja de disparar, espera, avisa, repite siempre, repite N, mientras, si / si no (con `else if`) y sal del bucle. Condiciones: variable o propiedad que existe o no, o comparada con un número o un modo.
- El programa se sigue guardando y ejecutando como JavaScript: al entrar se traduce con Acorn y cada cambio reescribe el texto, así que deshacer/rehacer de la barra sirven igual. El programa de partida comentado se ve como el de partida y el texto no cambia hasta editar. Lo no traducible se queda intacto en JavaScript con un aviso; si hay comentarios, se avisa de que se quitan al editar en seudocódigo. La línea en ejecución ilumina su renglón y la edición se bloquea mientras corre. El inspector no inserta en seudocódigo.
- Edición como en Tres vistas: tocar un valor abre su lista (datos de la máquina y variables del programa); tocar un renglón coloca el cursor; los ladrillos se tocan o se arrastran; un renglón se arrastra (con el dedo, mantener 0,28 s) y soltado sobre la paleta se borra. La barra de edición actúa sobre el renglón elegido: borrar, cortar/copiar/pegar bloques, duplicar, subir/bajar, ampliar al bloque que lo contiene y reducir.
- Estilo nuevo de los renglones: placas con franja del color de su clase (órdenes, sentidos, espera, control), valores en chips con los colores del código y guía de sangría en los bloques.
- La paleta y la barra de edición ocupan una línea cada una y se deslizan; en PC la rueda las desplaza en horizontal. En el teléfono la consola empieza cerrada (solo el asa «Consola»).
- Ajustes → «Ordenar botones y grupos…» abre un diálogo para arrastrar botones dentro de su grupo o a otro, mover grupos enteros por su asa ⋮⋮ y crear un grupo nuevo; «Restaurar» vuelve al orden de fábrica (`cmg-juego-barra`). Los separadores de la barra salen de los grupos.
- Verificación actual en el puerto 8771: **75 comprobaciones de lógica**, **52 de navegador de Rocket Launcher** (11 nuevas: seudocódigo, orden de la barra, consola y una línea por barra en el teléfono) y **43 de Tres vistas**, todas correctas.
- Límites: tacto emulado en Chromium; falta QA en el teléfono del arrastre de renglones y del diálogo de orden. El seudocódigo no cubre variables propias (`let x = 1`), operadores `&&`/`||` en condiciones ni funciones: esos programas se quedan en JavaScript. Tres vistas no cambia.

## Modo sin teclado y edición por bloques en Rocket Launcher · 29 de octubre de 2026

- Corregido el bug «un clic elige otro elemento». `getComputedStyle(textarea).font` llega vacío por `font-variant-ligatures: none` y el espejo de `caracterCodigo` medía con la letra proporcional del body. Con dos argumentos, el doble clic en el primero elegía el segundo. Ahora copia las propiedades sueltas, también en Tres vistas (`juego.js?v=4`). La suite de navegador medía igual y se corrigió.
- Modo sin teclado (`js/edicion.js`, nuevo). Un botón con un teclado se tacha en rojo: en PC va junto a la letra y en el teléfono es el primero de la barra de edición. El textarea sigue siendo el modelo (valor, selección, guardado y ejecución sin cambios); en pantalla lo sustituye una vista de fichas que no abre el teclado ni la selección nativa del sistema. Un toque elige un elemento entero: textos con sus comillas, comentarios, nombres y números. Una palabra clave, un signo o una llave eligen su construcción. El doble toque o doble clic amplía: `"oro"` → `entregar("oro")` → `yo.entregar("oro")` → el `if`. «Reducir» deshace la ampliación.
- Arrastre: un valor se copia sobre un hueco, un argumento o dentro de `( )`/`[ ]`, con las comas necesarias. Con el dedo, primero se mantiene pulsado. Las líneas completas se mueven con la sangría del destino y Alt/Ctrl las copia. No se suelta partiendo otra construcción. Las asas van en el número de línea o en el borde derecho (Ajustes «Asa para mover líneas»). Se guardan `cmg-juego-sin-teclado` y `cmg-juego-asa`. En PC la vista acepta Supr, Ctrl+Z/Y/D/C/X/V, Alt+↑↓, Mayús+Alt+→/← y flechas.
- `js/estructura.js` (nuevo, sin DOM): análisis tolerante sobre `lexico()`. Huecos, argumentos vacíos y código a medio escribir no lo rompen. Da átomos, niveles semánticos, unidades de línea, fronteras válidas, contexto de argumentos y condiciones, y destinos de soltar.
- Sugerencias con los datos de la máquina, `cmg.sugerencias` en `juego.js`: tipos (primero los del reto), sensores con su alcance (y niebla), lugares (variables, `autoTarget` del reto, red de sensores, `target`, `null`, lugar manual), condiciones (propiedades, variables y operadores con huecos), valores, segundos y mensajes. Elegir rellena y pasa al siguiente hueco de la línea. Los números tienen −/+ y «Escribir otro valor…» abre un campo. Con teclado se usan ↑↓, Intro/Tab y Esc. La lista no sube por encima de la paleta ni de la barra.
- Barra de edición: deshacer, rehacer, cortar, copiar, pegar, borrar, ampliar, reducir, duplicar, subir, bajar y línea nueva. Está siempre bajo la paleta en el teléfono, también con el teclado abierto; en PC solo sin teclado. Sin teclado, borrar un argumento deja su hueco (`/* sensor */`) y borrar una condición, `/* condición */`. Las líneas se quitan enteras. El historial es propio, por documento.
- Paleta con variantes (mantener ~0,45 s o clic derecho; se puede soltar el dedo sobre la variante). While true: While, For, Do … while y Salir del bucle. If / else: If e If / else if. `??`: `&&`, `||`, `!`, `===`, `!==`, `>`, `<`. Variable: `let` y asignar. Aviso: log, info y error. El `While` deja de ser un botón aparte. If / else conserva su inserción por defecto. Los operadores usan lo elegido como primer operando y «Aviso» deja `/* mensaje */`. Los huecos comparten vocabulario (`NOMBRES_HUECO`) para resaltar, seleccionar y revisar antes de ejecutar. Insertar en una línea vacía toma la sangría de la anterior.
- `window.cmg` suma `lexico`, `clasificar`, `sugerencias`, `firma`, `reHueco`, `aviso`, `alDesplazar`, `alternarEjecucion`, `claveDocumento` y `edicion`. Eventos del textarea: `cmg:medido`, `cmg:documento`, `cmg:seleccion` y `cmg:estado`. API del jugador, simulación y formatos de guardado sin cambios.
- Verificación actual en el puerto 8771: **75 comprobaciones de lógica** (25 nuevas), **41 de navegador de Rocket Launcher** (16 nuevas, con ratón real por CDP y tacto emulado) y **43 de Tres vistas**, todas correctas. Sintaxis de los ocho scripts correcta. Una ejecución intermedia falló en el cuadro táctil del mapa por latencia del puente de automatización: aislado pasó 3/3 y la ejecución final fue completa.
- Límites: los gestos táctiles son emulación de Chromium. Falta QA en Android/iPhone de mantener pulsado, desplazar frente a arrastrar, asas y ausencia del menú nativo. Con teclado sigue el menú nativo de Android al seleccionar: suprimirlo quitaría el pegado del sistema. Sin teclado no se escribe texto libre salvo con «Escribir otro valor…». En la IP de la red local, pegar usa lo copiado en el juego. Tres vistas solo recibió el arreglo del clic. Sin commits.
- Para el arnés de recuperación que se prepara aparte (aún sin commit): barra `#edicion`, interruptor `#b-teclado` en PC y `#edicion .b-teclado` en el teléfono, vista `#bloques`, variantes `.variantes .variante` y sugerencias `.sugerencias .sug`. La paleta conserva `#paleta button.atajo[data-i]`.

## Arnés de recuperación sin teclado · 29 de octubre de 2026

- Preparado un ciclo externo para **Rocket Launcher**, en `pruebas/recuperacion-editor.mjs`, sin modificar archivos del juego, simulación, `window.cmg` ni formatos de guardado. La UI nueva de Claude todavía no estaba presente al iniciar esta preparación; otros procesos comenzaron a modificar el juego durante el trabajo y sus cambios se conservaron.
- Cada intento cuenta 1–4 clics reales en editor/botoneras y entonces pulsa un carácter visible y un botón de código, con RNG propio con semilla y exclusión de copiar/pegar. Una sola perturbación por intento; durante la reparación se suspende el inyector. Verificador de reconstrucción textual exacta, clasificación separada de bugs sospechados, límites de UI, fallos del agente e infraestructura; inyección sin efecto o teclado observado quedan inconclusos.
- Resumen de todos los intentos; JSON con código, selección, coordenadas, pasos y estados antes/después, más PNG al cierre, únicamente para incidencias. Las trazas sanas se descartan. Evidencias fuera de Git en `.qa-recuperacion/`. Reproductor del clic+botón y reanudación entre escritorio/móvil conservando numeración y RNG.
- `pruebas/recuperacion-ejercicios.mjs` define cinco referencias repetidas en escritorio/móvil para un piloto de 10 intentos. `docs/CICLO-RECUPERACION-EDITOR.md` documenta el ciclo, los límites, el uso y un prompt para el agente. Evaluación inspirada en RLVR, sin entrenamiento de pesos.
- `pruebas/uso-tokens.mjs` lee contadores `token_count` de un rollout Codex indicado, separa entrada, salida y subconjuntos de caché/razonamiento, conserva `null` cuando el intervalo no puede medirse y explicita el retraso del proveedor. No hay extracción de uso de Claude implementada ni consumo medido de un piloto real.
- Verificación actual del arnés sobre el editor anterior: **50 comprobaciones de lógica existentes y 36 del arnés en Ego Browser**, con clics reales en el puerto 8771, reproducción, exportación selectiva, cambio a móvil emulado y detección de teclado. Sintaxis de los cuatro módulos nuevos y `git diff --check` correctos en esa revisión. Capturas de calibración de escritorio/móvil revisadas. No se repitió la suite completa histórica de navegador del juego.
- La calibración tiene cuatro casos sintéticos, usa restauración de fixtures y recompensa `null`: **no cuenta como los 10 intentos reales ni valida la nueva UI sin teclado**. Pendiente estabilizar esa UI, adaptar sus selectores/activar el modo, ejecutar el piloto y medir sus tokens. No demuestra tacto, teclado ni menú contextual de Android/iPhone reales. Sin commits, push ni publicación.

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
- Remotion: el Chrome headless que descarga (Chromium 157) se cierra al abrir la página en macOS 26.5.1 (`icudtl.dat not found in bundle`, `GPU process isn't usable`, `Session closed`), también en la terminal del usuario. Actualizar a 4.0.539 no cambió el navegador. Solución aplicada: `remotion.config.ts` usa el Google Chrome instalado (156) en modo `chrome-for-testing`; con eso renderiza.
- Pendiente: personajes StykAnimate, variante B, voz, HyperFrames/Motion Studio.

### 29-oct-2026 · pnpm y MCP de StykAnimate

- `educational-animation/` usa pnpm 11.1.2 (ya instalado con Homebrew) con `pnpm-workspace.yaml`; se eliminó `package-lock.json`. Scripts de instalación aprobados solo para esbuild y ffmpeg/ffprobe.
- `tools/render-manifest.mjs` busca las versiones en el `node_modules` de cada workspace.
- Verificado con pnpm: `pnpm typecheck`, Motion Canvas en navegador (fotograma 300, sin errores en consola) y `pnpm render:remotion` (23 s, 1920×1080, 30 fps, con manifiesto).
- MCP `stykanimate` (mashhoorahdal, commit `de645ec`) registrado en local con `pnpm dlx`; `prepare` descargó StykAnimate `def97214` y `claude mcp get` lo da por conectado. `npx` falló por un error de npm 10.9.3 con paquetes de GitHub. Sus herramientas aparecen solo en sesiones nuevas; aún no se ha usado.

### 29-oct-2026 · Actuación de los stickmen con el MCP de StykAnimate

- Escena del piloto `await` creada con `build_animation` (1920×1080, 30 fps, 23 s, mismas posiciones que la composición): el de polling se agacha cada vez más rápido, se tambalea y se desploma; el de `await` respira, mira, se encoge de hombros y recoge su caja en el segundo 17. Cajas y caída con `physics_plan`.
- Guardado `educational-animation/characters/stickman-wait.styk`. Referencia en `educational-animation/renders/stykanimate/stickman-wait.mp4` (691 fotogramas, verificado con ffprobe) y hoja de revisión. El spec se genera con `experiments/stykanimate-await-spec.mjs`.
- Sin trabajo manual en la app; tres iteraciones revisadas con `preview_frames`. Detalles y limitaciones en `experiments/observations.md`.
- Pendiente para Remotion: el MCP no exporta PNG con alfa. Hay que exportar la secuencia PNG a mano desde stykanimate.com o usar el MP4 opaco como capa inferior.
