## Revisión · ciclo 05 con Astra (xhigh): forEach con cuerpo expresión · 8 de noviembre de 2026

- **Proceso.** Quinto ciclo. Astra en Codex CLI con esfuerzo xhigh y solo lectura. Hubo 3 turnos: diagnóstico, un rechazo y la aceptación. El caso y la imagen antes/después están en `revision/pruebas/casos/05-foreach-expresion/`.
- **Pregunta.** ¿Cuántas vueltas y qué vale `x`? `forEach(x => console.log(x))` era una sola fila «Ejecuta […] → undefined». Con llaves, en cambio, era un bucle «por cada».
- **Trazador (compartido con el juego).** `x => (__T.c(id,x),__T.s(idExpr),expr)` en las mismas posiciones. Un `forEach` anidado en un cuerpo expresión también se reconoce, y su llamada queda sin gancho de valor. Un callback `async` ya no se instrumenta como bucle. Con llaves (no async), el resultado es idéntico byte a byte a HEAD; los pulsos salen idénticos en 77 programas (comprobado por Astra).
- **Diagrama.** El cuerpo expresión es una fila cuyo nodo es la expresión (`P.cuerpoExpr`, `FL.expresion`); etiqueta, lectura, traza, tarjeta y píldora la tratan como una sentencia expresión. Las continuaciones `async` se narran «sigue […], que se había quedado esperando», una por ejecución. `x => y => x` se narra «Crea la función […], sin llamarla».
- **Verificación actual.** Flujo **420** (18 nuevas), trazador **27**, lógica **124**, i18n **1146 / 12697**, editor Python **34**, traductor Python **64**. Navegador 8771: `depuracion.mjs` **173** (la versión del renderizador pasa a v11). Capturas antes/después revisadas.
- **Límites.**
  - `l?.forEach`, `forEach(f)` y `forEach` con segundo argumento no se representan como bucle.
  - No se repitió `juego.mjs` (falta Playwright).
  - Versiones: en War, trazador v6, flujo v9 y revisión v11; en la página de ejemplos, v11.

## Revisión · ciclo 04 con Astra (xhigh): for…of con y sin llaves, y saltos con etiqueta · 8 de noviembre de 2026

- **Proceso.** Cuarto ciclo. Astra en Codex CLI con esfuerzo **xhigh**, en la misma sesión y solo lectura. Hubo 3 turnos: diagnóstico, «aceptar con cambios» y la aceptación. El caso y la imagen antes/después están en `revision/pruebas/casos/04-forof-llaves/`.
- **Pregunta.** ¿Cuántas vueltas da y qué vale `x`? `for (const x of l) f(x)` sin llaves no tenía ni vueltas ni valores, y con llaves sí. El trazador solo ponía el gancho de cada vuelta dentro de un bloque.
- **Trazador (compartido con el juego).** Sin llaves, el cuerpo se envuelve en las mismas líneas: `{__T.c(id,x);{__T.s(…);sentencia}}`. Con llaves, el resultado es **idéntico byte a byte**: lo comprobé en 51 programas, y Astra en 68 programas y sondas con el filtro de pulsos. `pulsos.js`: el filtro de condiciones exige `campo === "test"` (antes aceptaba cualquier sentencia colgada de un `if`).
- **Diagrama.** Los saltos con etiqueta van a su destino: `continue fuera` vuelve al bucle de fuera, `a: b: for` reconoce las dos etiquetas, un bloque `b: {…}` consume su `break b`, y un `switch` deja pasar `break fuera`. Cada `break` dice si sale de un bucle, de un `switch` o de un bloque. Una desestructuración ya no narra `= true`.
- **Verificación actual.** Flujo **402** (19 nuevas), trazador **27**, lógica **124**, i18n **1146 / 12697**, editor Python **34**, traductor Python **64**. Navegador 8771: `depuracion.mjs` **173**. Capturas antes/después; la del `continue fuera` «antes» se sacó de HEAD en un worktree temporal (puerto 8772).
- **Límites.**
  - `forEach(x => expr)` con cuerpo expresión sigue sin vueltas: es el ciclo 05 propuesto.
  - `do…while` cuenta una sola vuelta (ya pasaba antes).
  - No se repitió `juego.mjs` (falta Playwright).
  - Versiones: en War, trazador v5, flujo v8, pulsos v3 y revisión v10; en la página de ejemplos, v10.

## Revisión · ciclo 03 con Astra: crear un generador frente a consumirlo · 7 de noviembre de 2026

- **Proceso.** Tercer ciclo adversarial. Astra en Codex CLI, con esfuerzo alto y solo lectura. Hubo 4 turnos: diagnóstico, dos rechazos y la aceptación. El caso, las respuestas, el registro y la imagen antes/después están en `revision/pruebas/casos/03-generador/`.
- **Pregunta.** ¿Se imprime «cuerpo»? Antes, el motor **afirmaba algo falso**: «Ejecuta la función g y, cuando acaba, sigue aquí» y «sigue en (3)», cuando el cuerpo no corre. Además, en `g().next()` narraba el resultado antes que el cuerpo.
- **Árbol.** `trazador.js` marca `generador` y `delega` (`yield*`) en la tabla de nodos. Son solo metadatos: no cambian los ganchos ni `V`, y el juego no los lee. En `python.js`, un `def` con `yield` es generador; además, un **`yield` sin valor ya no da error de sintaxis** (limitación de lezer 1.1.19 tolerada solo ahí).
- **Vista.**
  - Etiquetas: «Crea un generador con [g()]», «Pide el siguiente valor a [g()]», «Generador g()», «Entrega 1 y se para» y «Entrega uno a uno los valores de…».
  - Lectura: «todavía no ejecuta el cuerpo», y en la fila del generador «corre a trozos».
  - Traza: pide → cuerpo → yield → **«Vuelve de [it.next()]: el generador se paró en un yield y da «1»»**, también con `await it.next()`. Con un generador async sin `await`: «sin esperarlo… devuelve una promesa».
  - Un nombre de función que se reasigna ya no se enlaza a ningún cuerpo. Asignar una función ya no se narra como «undefined».
- **Verificación actual.**
  - Flujo **383**: 30 nuevas (creado o consumido, varios yield, yield dentro de otra sentencia, función normal, `next` propio, reasignaciones, async, `function*` en expresión, `yield*`, Python `yield`/`yield from`, inglés).
  - Trazador **27**, lógica **124**, i18n **1146 / 12697**, editor Python **34**, traductor Python **64**.
  - Navegador 8771: `depuracion.mjs` **173**. Capturas antes/después revisadas.
- **Límites.**
  - El objeto generador sigue como `{}` en la píldora de la traza.
  - Un `for (x of …)` sin llaves no da pasos por vuelta (ya pasaba antes).
  - Las tablas antiguas solo se acreditan por la sintaxis reconocida.
  - Python solo tiene lectura. No se repitieron `interfaz.mjs`/`juego.mjs`.
  - Versiones: en War/Factory, trazador v4, flujo v7, python v2 y revisión v9; en la página de ejemplos, v9.

## Revisión · ciclo 02 con Astra: agendar un callback frente a ejecutarlo · 7 de noviembre de 2026

- **Proceso.** Segundo ciclo adversarial. Astra en Codex CLI con esfuerzo **alto**, en la misma sesión que el ciclo 01 y solo lectura. Hubo 4 turnos: diagnóstico, dos rechazos y la aceptación final. El caso, las respuestas, el registro y la imagen antes/después están en `revision/pruebas/casos/02-agendar/`.
- **Pregunta.** ¿Qué se imprime primero, «callback» o «fin»? `queueMicrotask(cb)` y `(cb)()` se veían iguales («→ undefined»), y la traza ni siquiera tenía los eventos del callback, porque el trazador vaciaba su búfer antes de que corriera.
- **Ejecutor (`ejecutar.js`, solo «Tu código» y la página de ejemplos).** `setTimeout`/`setInterval`/`clear*`/`queueMicrotask` propios, con temporizadores virtuales sobre el reloj del programa (`esperar` es uno más) y un bucle de eventos propio. Nada queda vivo al devolver el resultado, y los errores de los callbacks, también los `async`, van al informe. Marcas `["corre"]`/`["/corre"]` por ejecución y `["luego"]` desde el `finally` del cuerpo. Un `setInterval` sin fin se corta.
- **Vista.**
  - Etiqueta «Agenda [fn] para después», o «…; su número, en [id]».
  - Lectura «no se ejecuta ahora y el programa sigue sin esperarla», con el «cuándo» plegado, frente a «Ejecuta [fn] ahora mismo. Escribe "callback"».
  - La última fila dice «Aquí acaba el código principal; después corre lo que siga agendado de (1)».
  - Traza: 1 agenda → 2 imprime → **1 «Ya terminó el código principal: ahora se ejecuta [fn]…»**, o «El código principal está esperando: mientras…» si corre durante un `await`. Un paso por ejecución.
  - El ciclo 01 se reforzó: un `push` sustituido (`f.push = cb => cb()`) ya no acredita que la función se guarde.
- **Verificación actual.** Flujo **353** (30 nuevas del ciclo 02: orden, `await`, redefinido, `forEach`, `setTimeout` por nombre, `then`, dos ejecuciones, llamada directa, retraso de 30 ms, errores síncrono y `async`, intervalos, orden de temporizadores, intervalo infinito, cancelaciones e inglés), trazador **27**, lógica **124**, i18n **1146 / 12697**. Navegador 8771: `depuracion.mjs` **173**. Capturas antes/después a 1000 px revisadas (`antes-despues.png`).
- **Límites.**
  - Los tiempos y el orden entre fuentes de tareas no son fieles al navegador ni a Node (el reloj es virtual).
  - No se capturan los rechazos sueltos de promesas. Los `then` no llevan marcas durante un `await`.
  - La píldora `undefined` sigue en la fila que agenda.
  - El juego no cambia: su visor solo lee el código. El Worker sigue sin vaciado final de pulsos.
  - No se repitieron `interfaz.mjs`/`juego.mjs` (falta Playwright).
  - Versiones: `flujo.js` v6 en War/Factory; motor v8.
- **Siguiente ciclo propuesto por Astra.** Un generador creado (`g()`) frente a uno consumido (`g().next()`).

## Revisión · ciclo 01 con Astra: funciones guardadas en un bucle (`var`/`let`) · 7 de noviembre de 2026

- **Proceso.** Primer ciclo adversarial: Opus implementa y Astra ataca (Codex CLI, `codex exec`, esfuerzo medio, sandbox de solo lectura). Antes se verificó que `revision-flujo` ya contenía todo lo remoto (`origin/*`: nada pendiente de pull) y se commiteó Depurar (`05e3812`). Hubo 3 turnos de Astra. El caso, las respuestas y el registro están en `revision/pruebas/casos/01-var-let/` (`caso.md`, `astra-1..3.md`).
- **Pregunta.** ¿Qué parte de la vista permite predecir `3 3 3` (`var`) frente a `0 1 2` (`let`)? Antes no había ninguna: filas, etiquetas, frases y narración salían idénticas.
- **Fallo corregido (`flujo.js`).** Las lecturas que ocurren dentro de una función en línea (`() => i`) al llamarla se atribuían a pasos *anteriores* de la fila donde se escribió, en orden invertido. Ahora pertenecen al paso que la llama (`paso.lecturas`, agrupadas por llamada, también con `await f()`).
- **Lo nuevo.** En lectura, la fila que crea la función dice «[() => i] no se ejecuta aquí: se queda con la [i] de esta vuelta…» (`let`) o «…leerá [i] cuando la llamen, y todas las de este bucle comparten la misma [i]» (`var`, variable de fuera, Python). En traza, la fila que llama dice «Al llamar: [f[0]()] lee [i] «3» · …». La resolución de ámbitos (`declaracion`) es real: bloques, cabecera del `for`, `var` por función, parámetros y Python por función. «No se ejecuta aquí» solo aparece con receptores acreditados (lista `[]`, `new Set`/`new Map` del programa, `setTimeout` sin redefinir); con `map` o un `receptor.push` cualquiera, la frase es neutral. La pista de una `let`/`const` del cuerpo va plegada, y en traza solo aparece en la primera visita.
- **Verificación actual.** Flujo **323** (26 nuevas: var/let, contraejemplo `f.push(i)`, llamada inmediata, parámetro homónimo, `let` de fuera, dos llamadas, `map`, llaves, bloque hermano, `await`, `receptor.push`, Python, inglés), trazador **27**, lógica **124**, i18n **1146 claves / 12697**. Navegador 8771 con Ego Browser: `depuracion.mjs` **173** correctas. Capturas de la fila 4 en traza a 1280 y 390 px revisadas. Python comparado con CPython (`2 2 2`).
- **Límites.** Astra no revisó la última variante del criterio de receptor acreditado (propuso quitar la lista). En traza, `push` sigue mostrando «→ «1»» (ruido; R3 no se aplicó). Python solo tiene lectura. No se repitieron `interfaz.mjs`/`juego.mjs` (Playwright no está instalado). Versiones: `flujo.js` v5 en War/Factory, motor `v=7` en `revision-juego.js` y en la página de ejemplos.
- **Siguiente ciclo propuesto.** Un callback agendado frente a uno ejecutado (`queueMicrotask(...)` frente a `(() => …)()`).

## Revisión · informe del código y su representación · 7 de noviembre de 2026

- **Rama y petición.** Trabajo en `revision-flujo` (recuperada desde `origin/revision-flujo`), para compartir casos del diagrama entre el usuario y los agentes y poder convertirlos en regresiones de representación.
- **Acceso.** Botón **Depurar** en la esquina inferior derecha del diagrama, en la página de ejemplos y en War/Factory. Tiene una franja propia y un objetivo de 44 px: permanece accesible al desplazar/ampliar el flujo y no tapa sus filas. Abre un diálogo de solo lectura con **Copiar JSON** y **Descargar JSON**; pausa el avance automático y conserva el programa, paso y selección al cerrar. Si falla el portapapeles, selecciona todo el JSON para copiar manualmente. Controles ES/EN.
- **Contenido.** Informe `cmg-revision-debug` v1: entrada original completa de todos los programas (JS/Python sin conversión), árbol/comentarios/eventos; filas con código y rangos UTF-16, etiquetas, frases, destinos, orden, salidas, flechas de vuelta y recorrido; idioma/selección/reparto; HTML/SVG, narración y medidas de la vista actual, y URL/versiones del motor cargado. Captura congelada al abrir; copia y descarga usan exactamente ese contenido. Maps/Sets se serializan como listas; BigInt/números no finitos, con etiquetas reversibles.
- **Agentes y regresión.** `window.__revisionJuego.vista.depurar()` (juego) y `window.__revision.depurar()` (ejemplos) devuelven objetos JSON independientes sin mover ni ejecutar el programa. [Contrato y reproducción](educational-animation/revision/README.md#depurar-una-representación): compartir el JSON, volver a montar su entrada y comparar `salida` con el motor actualizado. Los archivos originales del motor siguen en `educational-animation/revision/motor/`.
- **Verificación actual.** Nueva suite `revision/pruebas/depuracion.mjs` con Ego Browser/Chromium en el puerto dedicado **8771**: **173 comprobaciones** correctas, a 1280, 390 y 320 px. Incluye descarga real, portapapeles permitido/denegado simulado (sin tocar el del sistema), copia exacta e independiente, selección/foco/teclado del diálogo, traducción sin alterar la captura, Python, traza con valores, Unicode/HTML como texto, serialización especial, reproducción idéntica del resultado y limpieza al destruir. Integración por binoculares/menú ⋯ en War y Factory, PC/teléfono, JS/Python, conservación del editor y sin arrancar la partida. Capturas del botón en PC y teléfono y del diálogo móvil revisadas visualmente. Lógica **124**, flujo **297**, trazador **27**, runtime i18n y catálogos **1146 claves / 12697 comprobaciones** correctos; sintaxis de los scripts modificados y diff-check correctos.
- **Límites.** QA de navegador emulado; pendiente teclado/tacto y descarga en Android/Safari físicos. El informe contiene datos y HTML/SVG, no una captura de píxeles ni una página autónoma. No se repitieron las suites históricas completas `interfaz.mjs`/`juego.mjs` (su dependencia Playwright no está instalada en este checkout); la suite nueva recorre la interacción modificada y su integración con ambos juegos. No cambia la simulación ni la semántica de programas. Versiones de recursos de revisión `v=6`. Sin commits, push ni publicación.

## Modo revisión · también en Factory · 7 de noviembre de 2026

- **Por qué.** Feedback del usuario: Factory comparte la interfaz con War pero no tenía el visor. El motor ya era genérico y el catálogo ya tenía al robot con sus textos ES/EN; lo que lo apagaba eran tres bloqueos: el aviso «El modo revisión todavía no está en Factory» en `revision-juego.js`, el botón oculto con `[data-serie="factory"] .b-revisar` y la entrada «Revisar» del menú ⋯ oculta en `layout.js`.
- Se quitan los tres; la revisión recibe la serie real (`cmg.revision.serie`), así `pickUp`, `deliver`, `count` y `wait` (y `pick_up` en Python) se explican con el catálogo del robot: «Va a "ENT-1" y recoge "cobre"», «¿cuánto "cobre" hay en "ENT-1" es mayor que 0?».
- Textos nuevos `revision.cat.robot.{recoger,entregar}.corta` (ES/EN) para `const r = await deliver("FUN")`: «Guarda en r: el resultado de entregar en "FUN"». Se borra la clave `juego.revision.factory`.
- Fuera de este cambio: los pulsos del código durante la partida siguen solo en War (el runtime de Factory no los envía).
- **Pruebas:** `juego.mjs` 72 (Factory en PC y teléfono: botón y menú ⋯, filas y frase del robot en JavaScript y en Python, sin ejecutar nada). Siguen pasando `flujo.cjs` 297, `interfaz.mjs` 206, `interaccion.cjs` 124, i18n y catálogos (1146 claves).

## Modo revisión · forEach como bucle y salidas laterales sin solaparse · 7 de noviembre de 2026

- **Por qué.** Feedback del usuario con dos capturas del mismo programa: en Python el `for` dibuja la flecha de vuelta del `if` a su bucle, y en JavaScript el `lista.forEach(elemento => { … })` no (salía como un paso y una «Función sin nombre» aparte). Y en JavaScript la condición `Array.isArray(elemento)` se montaba sobre su salida lateral `true →`.
- **forEach** (`motor/flujo.js`, `explicar.js`, `trazador.js`): `lista.forEach(x => { … })` (o con `function (x) { … }`) como sentencia se lee como un `for…of`: fila «Por cada elemento de lista», flechas de vuelta, el código ilumina `elemento`, y su función ya no sale en «Funciones». Un `return` dentro acaba solo esa vuelta (como `continue`). Con la traza, el trazador pone `__T.c(id, x)` al abrir la función y cuenta las vueltas. `P.porCada` reúne los tres tipos de bucle «por cada».
- **Salidas laterales** (`motor/revision.css`): el código largo parte la línea (`overflow-wrap: anywhere`) en vez de salirse de su caja; la fila guarda al menos el 42 % para su caja; y la salida lateral baja debajo de su fila según el ancho del diagrama (container query), no de la pantalla: así también en el panel junto al código del escritorio.
- **Juego:** los archivos del motor que cargan los binoculares llevan versión (`?v=4` en `revision-juego.js`) para que el navegador no use los de la caché.
- **Pruebas:** `flujo.cjs` 297 (forEach = for de Python: mismas filas, flechas y frases; return; traza con 3 vueltas), `interfaz.mjs` 206 (forEach dibujado como bucle; la salida lateral no se monta ni se sale a 390, 900, 1280 y 1600 px; falla con el CSS anterior), `juego.mjs` 58, `trazador.cjs` 27.

## Modo revisión · Python · 7 de noviembre de 2026

- **Lector de Python** (`educational-animation/revision/motor/python.js`): árbol de lezer → la tabla de nodos de acorn, con posiciones en el texto de Python. Con eso el diagrama, el recorrido de lectura, las tarjetas y la documentación funcionan igual que en JavaScript. El reto 5 en Python da el mismo diagrama y las mismas frases que en JavaScript (`pruebas/flujo.cjs` lo compara).
- La precedencia de `not`, `and`/`or`, `is not` y `not in` se rehace con la tabla de Python. Los nombres del juego en Python se buscan en el catálogo por su nombre de JS (`desdePython`); `wait` y `print` son alias de `esperar` y `console.log`.
- Las frases, los valores, las flechas del diagrama, el resaltado del código y los títulos de la documentación usan `None`, `True`, `False`, `print`, `elif`, `FOR…IN`…
- **Juego:** los binoculares leen también los programas en Python (se quita el aviso «solo JavaScript»). Los pulsos de Python laten en la llamada de su línea con el color de su fila (antes, la línea entera con un color por clase).
- **Página de revisión:** ejemplo «Reto 5 · Python» y selector JavaScript/Python en «Tu código».
- **Pruebas:** `flujo.cjs` 287, `interfaz.mjs` 200, `juego.mjs` 58, `trazador.cjs` 27. Siguen pasando i18n, catálogos (420 claves), interacción 124, traductor 64, editor Python 34, Python en el juego 27, ejecución 26 e idiomas del juego 45.

## Modo revisión · frases de lectura más cortas · 7 de noviembre de 2026

- Recorrido de lectura: ninguna frase pasa de ~75 caracteres visibles en el reto 5 (antes, hasta 127 en ES y 143 en EN). Se quita «Solo pasa por aquí si…» (la decisión anterior ya lo dice), las órdenes del lanzador y `esperar` tienen frases breves nuevas, y el final ya no repite «Ese es todo el programa» cuando el bucle es sin fin.
- `??` encadenado: «Guarda en pos lo primero que encuentre, probando 3 opciones en orden», con las opciones en «Más detalles».
- Una lectura del juego dice el null en la misma frase: «Lo guarda en pos (null si no ve ninguno)». Corrige el inglés «If it it sees none».
- Tiempo de lectura: los detalles plegados no cuentan. Abrir «Más detalles» durante ▶ para el avance.
- Pruebas: `flujo.cjs` 232, `interfaz.mjs` 182, `juego.mjs` 50, `trazador.cjs` 27.

## Modo revisión · recorrido de lectura sin partida y pulsos del código en la batalla · 7 de noviembre de 2026

- **Por qué.** Feedback del usuario: priorizar que se entienda el código antes que la precisión de lo que pasó; desligar la revisión de la batalla (sin haberlo corrido); ▶ a ritmo de lectura humana; ✕ no debe quitar la selección; tarjetas largas en el teléfono (S24 Ultra); montaña en toda la app; «Revisar» también en el menú ⋯; quitar el modo mapa/código/diagrama; en la batalla, pulsos de color en el código que se activa (inspirados en shock/wave de la bug tool).
- **Motor** (`educational-animation/revision/motor`):
  - `flujo.js`: `estructura(P, F)` (una visita por fila en orden de lectura, `R.estructural`) y `dentro(P, F, i)`.
  - `explicar.js`: `describir` y `resumen` (qué hace cada fila y adónde sigue, en lenguaje de personas); segmento `{ mas }` plegado para lo secundario de las tarjetas; sin cuentas de ejecución en la lectura.
  - `textos.js`: claves `revision.r.*`, `ui.texto`, `ui.ocultar`, `ui.lectura`, `que.b.mas` y frases `breve` del catálogo (ES/EN).
  - `trazador.js`: opción `filtro` para poner solo algunos ganchos.
  - `catalogo.js`: el global pasa a `CMGCatalogoRevision` (pisaba el `CMGCatalogo` de la paleta).
- **Interfaz** (`revision.js`, `revision.css`, `index.html`):
  - Modo `lectura` por defecto (`?modo=traza` conserva la traza grabada).
  - ▶: caracteres ÷ 21,8 por segundo × 1,15, con un mínimo de 1,2 s, dividido por la velocidad. Las 7 velocidades se recuerdan.
  - ✕ oculta el texto y deja la selección. El botón del globo (o T) lo devuelve; Esc quita la selección.
  - En el teléfono, narración más baja.
  - «Tu código» se lee sin ejecutarse.
  - Fuera: «junto», el reloj del mundo y `alInstante`.
- **Juego** (`Prototypes/Rocket Launcher`):
  - `juego.js` vuelve a como estaba antes de la repetición del intento.
  - `cmg.revision` mínimo: `programas()`, `reto`, `titulo`, `seleccionado`, `serie`.
  - `revision-juego.js` lee el código actual sin ejecutar.
  - «Revisar» en el menú ⋯ (`layout.js`).
  - Montaña en `#b-mapa-movil` y `#b-ver-mapa`.
  - `js/pulsos.js` y su CSS en `componentes.css`, más el trazador y flujo cargados al arrancar.
- **Pendiente para la próxima sesión** (lo pidió el usuario): repasar la lectura y los textos (#15).
- **Verificación.**
  - `revision/pruebas`: `interfaz.mjs` **174** (PC y teléfono), `flujo.cjs` **230**, `trazador.cjs` **27**, `juego.mjs` **50**. Esta última comprueba que la partida instrumentada es la misma que la grabada.
  - `pruebas/interaccion.cjs` **124**, `i18n-catalogos.cjs` 422 claves, `i18n.cjs`.
  - `idiomas-juego.mjs` **45** (menú con «Revisar»).
  - `editor-movil.mjs` actualizado para el menú. Su regresión 13 (consola tras ejecutar) se queda en un tiempo de espera igual en `537d92a`: no viene de este cambio.

## Modo revisión · dentro del juego, escritorio a dos columnas y las tres cosas a la vez · 6 de noviembre de 2026

- **Por qué.** El usuario pidió el botón para entrar (sugirió libro o binoculares), una montaña nevada en lugar del mapa («se ve el mundo»), código y flujo lado a lado en el escritorio, y un botón solo de escritorio que junte código y flujo con el mapa en su sitio para ver las tres cosas reproduciéndose. Señaló The Farmer Was Replaced: allí ver el código ejecutarse está mucho mejor coordinado con lo que pasa en el juego.
- **En el juego** (`js/revision-juego.js`, ganchos `cmg.revision` en `juego.js`, botón `#b-revisar` con binoculares en la barra del mapa):
  - Cada intento de War que termina queda guardado: programas, semilla y resultado.
  - Los binoculares cargan el motor de `educational-animation/revision/motor` solo la primera vez. Instrumentan los programas y repiten el intento con `ejecutar({ revision })`, a velocidad turbo, sin contar intento, telemetría ni récords. El juego guarda la traza y una foto del mundo por paso (0,05 s).
  - Al cambiar de paso, el mapa enseña la foto de ese instante; al salir, vuelve el mundo del final. Ejecutar, Reiniciar y cambiar de reto cierran la revisión.
  - Python y Factory lo avisan; todavía no.
- **Carrera corregida.** El trazador envía su último lote después del mensaje `espera`. Si esa espera era la que terminaba la partida, el juego cerraba los Workers antes de recibir el lote y la última vuelta se perdía (145 de 146 vueltas, a veces). Ahora la repetición cierra 120 ms más tarde, cuando el mundo ya tiene fin. La traza es idéntica a la de `grabar.mjs` en todas las ejecuciones probadas.
- **Interfaz** (`motor/revision.js`, `revision.css`):
  - Disposición `lado` desde 900 px: código a la izquierda; diagrama y narración a la derecha; franja abajo. El asa pasa a vertical y cada disposición recuerda su reparto.
  - La montaña nevada sustituye al mapa.
  - Botón «junto», solo en el escritorio y cuando hay un mapa al lado: código y diagrama apilados en el panel del código, con pocos botones.
  - Velocidad ½×–4×.
  - **Al compás de la partida**, como en un juego de programar: con el mapa al lado, ▶ deja el mundo quieto mientras se leen los pasos de un instante. Mientras el programa espera, el mundo avanza a velocidad de juego hasta el paso siguiente, y la franja y los segundos siguen al reloj.
- **Verificación.**
  - `revision/pruebas/juego.mjs`: **32** en el puerto 8771, en PC 1440×900 y teléfono 390×844. Cubre el aviso sin intento, misma partida y exactamente la misma traza que `grabar.mjs`, una foto por paso, `lado`/apilado, «junto» en el panel del código con el mapa al lado, el mapa en el instante del paso (adelante y atrás), ▶ moviendo código y mapa a la vez, salir con `</>` devolviendo el mundo final y Ejecutar cerrando la revisión.
  - `interfaz.mjs`: **118**. `flujo.cjs`: 167. `trazador.cjs`: 25. `pruebas/interaccion.cjs`: 124. `i18n-catalogos.cjs`: 421 claves.
  - `idiomas-juego.mjs`: **45**, con un adaptador `page.cdp` sobre Playwright, también a 320 px con el botón nuevo.
  - `pruebas/navegador.mjs` no corre con ese adaptador: se queda en «Cerrar el inspector», igual en la versión anterior a estos cambios.

## Modo revisión · asa, documentación por pulsación larga y barra del juego · 6 de noviembre de 2026

- **Por qué.** Feedback del usuario sobre el diagrama de flujo (paso 1 de 3; luego el botón en el juego y Python).
- **Qué cambia.**
  - **Barra.** Sale el selector ES/EN: el idioma es el de la interfaz del juego (misma preferencia `cmg-interfaz-idioma`). En su lugar, los símbolos de las otras pantallas: el mapa y `</>`. Fuera del juego son placeholders que vuelven al juego (`alMapa`, `alCodigo` en `CMGRevision.montar`).
  - **Asa** entre el código y el diagrama, como el divisor del juego. Arriba del todo, el diagrama ocupa toda la pantalla. Doble clic o Intro alterna; ↑ ↓ e Inicio desde el teclado. El reparto se recuerda (`cmg-revision-reparto`).
  - **Documentación.** Mantener pulsado 1,2 s un elemento de `.rv-flujo` (fila, salida, conector o ficha de la etiqueta) abre una página que tapa el código. Una barra se llena mientras se pulsa, y el clic al soltar no cuenta como toque. El tema sale de `motor/documentacion.js` (árbol y catálogo: `IF`, `ELSE IF`, `FOR…OF`, `ARGUMENTO CON VALOR POR DEFECTO`, `MÉTODO DE LISTA · push`, `ORDEN DEL JUEGO · burstFire`…). Por ahora el texto es «TEMA: PLACEHOLDER» y hay un recuadro «ANIMACIÓN: PLACEHOLDER».
- **Verificación.** `flujo.cjs` **167** (temas de documentación, ES/EN, y todos los nodos de 9 programas variados sin claves sueltas); `interfaz.mjs` **112** en PC y teléfono (sin ES/EN, iconos, asa y su memoria, pulsación corta frente a larga, la documentación tapa el código, Esc, ✕ y cambio de idioma con la página abierta); `trazador.cjs` 25.

## Modo revisión · diagrama de flujo con un color por fila · 6 de noviembre de 2026

- **Rama.** `revision-flujo`, creada desde `refactor/idiomas-interfaz` y con `trunk` unido, para seguir los cambios de idioma que afecten a cómo se expresa esta herramienta.
- **Por qué.** El usuario vio el primer prototipo «muy preparado» y lejos de su idea. Pidió:
  - seguir la imagen de los seis cafés: código arriba y, abajo, un diagrama donde la correlación sea evidente;
  - que funcione como su bug tool multilenguaje: cada campo tiene su color y, al recibir el foco, ilumina su parte del texto generado;
  - nada de texto escrito para el reto: el modo debe explicar cualquier código por sí solo.
- **Qué cambia.**
  - Abajo ahora está el programa como diagrama, generado del árbol (`flujo.js`): filas numeradas, `true →` al lado, `↓ false` y flechas de vuelta. Los seis cafés salen con la misma forma que la infografía.
  - Cada fila tiene número y color propios, repetidos en el margen del código y en la franja de tiempo.
  - Tocar o señalar el código ilumina su fila y la explica. Tocar una fila ilumina su código y dice cuántas veces se ejecutó y cuántas fue true o false.
  - La narración es una sola frase por paso, con los valores reales.
  - Desaparecen la introducción del reto, los tramos resumidos, la comparación con la variante y las fichas de «lo que vio».
  - La franja de tiempo queda con un tramo por vuelta, del color de la rama que tomó.
- **Genérico.**
  - `explicar.js` y `catalogo.js` se reescribieron sin frases por reto: plantillas por tipo de nodo y catálogo del juego.
  - `ejecutar.js` corre cualquier JavaScript con traza y reloj virtual, y se usa en «Tu código…» y para grabar ejemplos sueltos en Node. Ejemplos: los cafés, pares con función y `for…of`, y el reto 5 regrabado en el juego en esta rama (misma partida, 1099 eventos).
- **Idiomas.**
  - Todas las frases están en `motor/textos.js` como catálogo `CMGI18n` (claves `revision.*`, ES/EN, plantillas con huecos para fichas).
  - El catálogo de máquinas declara sus claves (`clavesDe`).
  - El selector ES/EN usa el mismo runtime y la misma preferencia que el juego.
- **Trazador.** Añade un evento por vuelta de `for…of`/`for…in` y deja de envolver el nombre de una función declarada (rompía la sintaxis). El búfer también se vacía en condiciones y valores, para cortar un `while (true) {}`.
- **Verificación actual.**
  - `revision/pruebas/trazador.cjs`: **25** comprobaciones.
  - `flujo.cjs`: **158**. Forma del diagrama de los cafés, valores por vuelta, recursión, `for…of`, reto 5 en los dos programas, paridad ES/EN y claves del catálogo, un robot nuevo, 9 programas variados sin claves sin traducir, corte de un bucle infinito, errores y reloj virtual.
  - `interfaz.mjs`: **76** en Chromium a 1280×800 y 390×844. Comprueba la pareja de color entre fila y código, tocar y señalar, la franja, el idioma, el avance solo, LAU-01/LAU-02 en el mismo instante y «Tu código…». Sin desplazamiento lateral ni errores.
  - En la rama siguen pasando `pruebas/i18n.cjs`, `i18n-catalogos.cjs` (414 claves), `python-traductor.cjs` (64), `python-semantica-regresiones.cjs` (3), `python-conversion-regresiones.cjs` (20) y `editor-contrato.cjs`.
- **Límites.**
  - Solo JavaScript. Para Python, el diagrama tendría que salir del árbol de lezer, y el traductor tendría que conservar columnas.
  - Fuera del juego: falta el botón junto al mapa.
  - La franja divide solo por el bucle principal.
  - Pendiente QA en un teléfono real y revisión humana de las frases.

## Cierre de textos pendientes ES/EN · 6 de noviembre de 2026

- **Alcance.** Traducidas las ayudas completas de Órdenes en War/Factory, las fichas de enemigos, explicaciones/unidades del inspector, resultados y estadísticas de victoria/fallo, botones y pistas de banners, avisos y sugerencias del editor, orden de la barra y diagnósticos de JS/Python. El anuncio Campaign, el probador de dispositivos y los controles experimentales también respetan ES/EN. Las etiquetas descriptivas de bloques del formulario Factory se localizan conservando sus valores.
- **Presentación.** Nuevo catálogo `shared/i18n/pendientes.js` con 478 mensajes heredados y `presentacion.js`, invocado explícitamente desde los renderizadores. Se reconocen frases/plantillas y se marcan hojas y atributos para refrescar texto sin reconstruir controles, mover foco, reiniciar temporizadores ni resolver acciones pendientes. No hay observación global del DOM. Los ejemplos y valores insertables, nombres personalizados, programas, datos de simulación y guardados mantienen sus valores originales.
- **Diagnósticos.** Se traducen al presentarlos: los emisores, tipos/motivos, respuestas de la API y telemetría siguen crudos. Se conservan parámetros, líneas, nombres y valores de código. Los mensajes libres de `console` y `print` no se traducen. Los errores nativos externos que no son mensajes del juego conservan su texto técnico. Comprobado que parámetros con etiquetas HTML se muestran como texto, sin ejecutar código.
- **Resultados abiertos.** Victoria real de Factory y fallo real de War comprobados en inglés y al volver a español. Se conservan mundo, telemetría, botones, foco y pistas; no se vuelven a ejecutar callbacks. El probador conserva sus iframes y URL al cambiar idioma; sus modelos y valores guardados siguen iguales.
- **Regresión corregida.** La sustitución de títulos de la pasada local anterior había alcanzado el selector `?poc=1`, introduciendo una referencia a `i` fuera de ámbito. Corregido sin alterar las opciones visuales y añadido un check de arranque/traducción específico.
- **Verificación actual.** **1141 claves ES/EN, 12644 comprobaciones de catálogos**, incluidas 478 resoluciones de patrones con parámetros concretos para detectar colisiones/pérdidas. Runner de Chromium en contextos aislados y vista Plano: **261 comprobaciones correctas**, incluidas 22 nuevas de ayudas, diagnósticos, resultados reales, preservación del texto del jugador, edición, Campaign, probador y selector experimental. Tras ajustar el título Factory del probador se repitieron sus 22 comprobaciones, correctas. Runtime i18n, interacción 124, contratos/lenguajes, editor Python 34, traductor Python 64 y reglas Factory correctos. Sintaxis JS y scripts inline, diff-check y paquete estático correctos: 9 páginas y 107 referencias locales.
- **Límites.** Sin lotes conocidos de textos de interfaz pendientes en las zonas inventariadas. Código, API, contenido del jugador, mensajes libres y documentación conservan su idioma. Siguen pendientes QA con teclado/gestos en teléfonos físicos y validación específica del Worker en 3D; esta pasada usa Plano y emulación de Chromium.
- **Entrega local.** Misma rama `refactor/idiomas-interfaz`, sin commit, push ni publicación. Versiones: `juego.js?v=44`, `factory-form.js?v=3`, catálogo Factory `v=2`, `inicio.js?v=2`, `edicion.js?v=8`, `nucleo-ui.js?v=6`; presentador y catálogo nuevos `v=1`.

## Idiomas · contenido de retos, pistas y metas · 6 de noviembre de 2026

- **Continuación.** Se conserva el trabajo local anterior en `refactor/idiomas-interfaz`. Nuevo catálogo `shared/i18n/retos.js`: 87 claves adicionales, **659 claves ES/EN** en total.
- **Contenido.** Títulos del selector y de las cabeceras, objetivos, lecciones y pistas de los cinco retos War y seis Factory se traducen en presentación. Los datos originales de `RETOS`/`def`, programas, telemetría, formularios y JSON se conservan. Los retos propios, importados o copiados mantienen su contenido original, incluso si coincide con un reto incluido.
- **Pistas.** Cada parte tiene una clave propia ligada a la división española original. El cambio de idioma conserva número de partes, desbloqueos, nodos de pistas ya abiertas y guardados. Se traducen también las instrucciones para pedir/desbloquear partes. El contrato de catálogos comprueba el español contra las fuentes de los retos.
- **Metas.** Etiquetas, límites, estados de la ficha y HUD de War (brechas, derribados, atascos, coste, récord y tooltip) usan el idioma vigente. El refresco conserva las filas de la ficha, sus pestañas, foco y portales del inspector/consola; no cambia los valores de la simulación.
- **Verificación actual.** Runtime i18n; 659 claves/7339 comprobaciones de catálogos; interacción 124; contratos y lenguajes; editor Python 34; traductor Python 64; reglas Factory: correctos. Runner completo en Chromium/Plano: **239 comprobaciones**, incluidas 46 nuevas de retos, pistas, metas, conservación de datos y cabeceras a 320/393 px. Sintaxis y diff-check correctos. Paquete: 9 páginas y 100 referencias locales.
- **Pendientes.** Ayuda extensa de Órdenes, fichas de enemigos, resúmenes y banners de resultado (incluida su pista), explicaciones/unidades restantes del inspector, otros avisos del editor y diagnósticos de ejecución. Los campos de los formularios siguen mostrando los datos originales del escenario. QA física de teclado y gestos y validación del Worker en 3D fuera de esta pasada.
- **Entrega local.** `juego.js?v=43` y catálogo `retos.js?v=1`. Sin commit, push ni publicación.

## Revisión de la rama de idiomas · formulario War · 6 de noviembre de 2026

- **Estado recibido.** `refactor/idiomas-interfaz` en `68e2e5b`, cuatro commits por delante de `main`, sin commits de `main` pendientes ni cambios locales al recuperar la rama. La traducción era parcial: 537 claves ES/EN. Se verificaron de nuevo las suites de lógica y las 170 comprobaciones de idiomas en navegador antes de continuar.
- **Formulario War.** Nuevo catálogo `shared/i18n/war-form.js`, con 35 claves `escenario.*`: enunciado, metas, defensa, oleadas, aviso del reto fijo, acciones, accesibilidad y mensajes de JSON. Total: **572 claves ES/EN**. Los cambios de idioma actualizan hojas y atributos sobre los mismos controles, sin guardar el borrador ni cambiar foco, selección, programas o mundo. Los tipos de enemigos y los IDs siguen visibles como valores de la API; el enunciado y el contenido escrito o importado conservan su idioma.
- **Acciones y JSON.** La delegación admite pulsar las etiquetas internas de copiar, añadir/quitar oleadas, guardar y aplicar. El aviso «Copiado» conserva su estado y temporizador original al cambiar de idioma; al vencer, muestra la etiqueta del idioma vigente. Los errores localizan el prefijo y conservan el detalle técnico del parser como texto escapado. Se comprueban copia con/sin portapapeles, JSON inválido, importación válida, guardado y recarga.
- **Móvil.** Las oleadas usaban una cuadrícula de siete columnas que desbordaba el formulario. En la distribución de teléfono pasan a dos columnas, con Quitar al final. Comprobado sin desplazamiento horizontal a 320 y 393 px; captura inglesa de 393 px revisada. La prueba usa el reparto automático, sin forzar la distribución de PC en el teléfono.
- **Verificación actual.** Runtime i18n; 572 claves y 6370 comprobaciones de catálogos; interacción 124; contratos y lenguajes del editor; editor Python 34; traductor Python 64; reglas Factory: correctos. Runner completo de idiomas: **193 comprobaciones correctas** en contextos aislados y vista Plano, incluidas las 23 nuevas del formulario War. Paquete estático: 9 páginas y 99 referencias locales correctas. Sintaxis de los scripts modificados/nuevos y `git diff --check` correctos. Sin excepciones durante el recorrido nuevo de War.
- **Pendientes.** Contenido de retos/escenarios y sus indicadores de metas, ayudas extensas, explicaciones/unidades restantes del inspector, otros avisos del editor y diagnósticos de ejecución. QA con teclado y gestos en teléfonos físicos; esta pasada emula Chromium y no valida el watchdog del Worker en 3D. Campaign y el laboratorio de animación siguen separados. La traducción global continúa siendo parcial.
- **Entrega local.** Cambios en la misma rama, sin commit, push ni publicación. Versiones: `juego.js?v=42`, `componentes.css?v=23` y nuevo catálogo `war-form.js?v=1`.

## Idiomas de interfaz · formulario Factory y estados del inspector · 6 de noviembre de 2026

- **Rama.** Continuación con dos subagentes Luna en `refactor/idiomas-interfaz`. Se añaden 123 claves; total 537 ES/EN. El formulario de Factory traduce etiquetas, leyendas, opciones descriptivas, botones y mensajes de JSON; los títulos, textos del reto, materiales, IDs, valores de opciones y JSON guardado se conservan.
- **Borrador.** Cambiar idioma refresca hojas y atributos, sin reconstruir el formulario, perder valores pendientes, mover el foco ni reiniciar el estado/temporizador de copia. La delegación de clic resuelve el botón ancestro para admitir etiquetas internas. Se comprueban borradores sin guardar, selección y guardado posterior, también a 393 px.
- **Inspector.** Estados, clases, roles y etiquetas de métricas se localizan en presentación; `estadoDe` y `metricasDe` siguen dando datos crudos. Los refrescos vivos usan el idioma vigente y el evento lee el estado actual de la entidad. Ensambladora y Muelle mantienen su identidad; los nombres personalizados se muestran sin traducir.
- **Verificación.** Runtime i18n, 537 claves/5980 comprobaciones, lógica 124, contratos, lenguajes, editor Python 34, traductor 64 y reglas Factory correctos. Nuevas pruebas de navegador: formulario 7 e inspector 12 (incluidos estado que cambia tras abrir la ficha y nombre personalizado). Paquete: 9 páginas y 98 referencias locales. Runner completo: 170 comprobaciones de idiomas en contextos aislados y vista Plano. Sintaxis y diff-check correctos.
- **Pendientes.** Contenido de retos/escenarios, ayudas extensas, formulario War, explicaciones/unidades aún no migradas del inspector, otros avisos del editor y diagnósticos; QA con teclado y gestos de teléfono real. El contenido escrito por el jugador conserva su idioma original.
- **Versiones.** `juego.js?v=41`, `factory-form.js?v=2`, catálogo `inspector.js?v=2` y nuevo `factory-form.js?v=1` en `shared/i18n/`.

## Idiomas de interfaz · paletas e inspector · 6 de noviembre de 2026

- **Rama y alcance.** Se continúa en `refactor/idiomas-interfaz` con dos subagentes Luna y revisión cruzada: paletas de inserción JS/Python y presentación del inspector de War/Factory. Se añaden 97 claves; total 414 claves ES/EN en los catálogos.
- **Paletas.** Metadatos `i18n` opcionales en el catálogo común y en las órdenes de cada serie. Se traducen nombres, tooltips, accesibilidad, variantes abiertas y nombres descriptivos de teclas. Los textos de código, operadores, huecos, `data-tip-cod` y valores funcionales de las plantillas no se traducen. El idioma actualiza solo atributos y textos existentes; la demo autónoma mantiene el respaldo español.
- **Inspector.** Encabezados, leyenda, pistas, botones y etiquetas vitales traducidos mediante marcadores sobre hojas y atributos. Se conservan los tokens arrastrables/insertables, sus `data-ins`/`data-fin`, las firmas, unidades seleccionadas y los valores de la simulación. El evento de idioma no reconstruye el inspector; sus repintados normales ya generan las etiquetas en el idioma elegido. Estados, clases, roles y métricas detalladas siguen pendientes.
- **Verificación actual.** Catálogos: 414 claves, 4439 comprobaciones; runtime i18n, interacción 124, contratos, lenguajes, editor Python 34, traductor 64 y reglas de Factory correctos. Runner de navegador: 151 comprobaciones de idiomas (115 previas más 36 nuevas); demo autónoma 73. Nueva suite `idiomas-paleta-inspector.mjs`: War/Factory y JS/Python, menú abierto, nodos, foco, selección, datos y texto insertable. La identidad de botones del inspector se compara dentro de la misma tarea que emite el evento para aislarla de los repintados diferidos del editor. Paquete: 9 páginas y 97 referencias locales; sintaxis y `git diff --check` correctos.
- **Pendientes.** Resto de diálogos y avisos del editor, estados/clases/roles y métricas del inspector, contenido de retos y escenarios, ayudas extensas, formularios y diagnósticos; QA en teléfono real. Campaign y el laboratorio de animación siguen fuera del ámbito del juego.
- **Versiones.** `nucleo-ui.js?v=5`, `plantillas.js?v=6` en juego/demo; `paleta.js?v=6`, `juego.js?v=40`; catálogos `paleta.js?v=1` e `inspector.js?v=1`.

## Idiomas de interfaz · barra de edición y modo sin teclado · 6 de noviembre de 2026

- **Continuidad.** Recuperada la rama `refactor/idiomas-interfaz` tras su subida en `b0c6c6e`. La portada, Ajustes y controles ya tenían ES/EN. Se continúa con dos subagentes Luna, en esta misma rama, sobre la interfaz; el arreglo JS/Python de `trunk` es independiente.
- **Lote.** 42 claves nuevas en `shared/i18n/editor.js`: acciones de edición, etiquetas de variantes móviles, selección/ProtoMouse y descripciones activas del modo sin teclado. El catálogo integrado suma 317 claves ES/EN. La demo autónoma conserva el respaldo español sin cargar i18n.
- **Estado.** El evento de idioma actualiza atributos y textos de la barra y de sus variantes abiertas sin reconstruir controles ni cambiar selección, foco, historial o modo de teclado. El listener usa el ciclo de vida de la instancia. La regresión anterior del botón de teclado ahora exige traducir la descripción manteniendo su estado activo.
- **Verificación actual.** Catálogos: 317 claves y 3463 comprobaciones; runtime i18n, lógica 124, contratos, editor Python 34 y traductor 64 correctos. Chromium/Playwright: las 105 comprobaciones previas de idiomas, las 10 nuevas de barra y las 73 de la demo autónoma pasan. La suite nueva comprueba variantes abiertas ES→EN→ES, nodos, selección, foco, modo sin teclado, undo/redo y recreación JS→Python. Sus fuentes se preparan mediante el selector de cabecera oculto en móvil; no sustituye QA manual de ese flujo. Paquete: 9 páginas y 95 referencias locales; sintaxis y `git diff --check` correctos. Sin cambios de reglas de simulación ni de formatos de guardado.
- **Pendientes.** Paletas de inserción, demás diálogos/avisos del editor, inspector, contenido de retos/escenarios, ayudas extensas, formularios y diagnósticos; QA en teléfono real. La traducción global sigue siendo parcial.
- **Versiones.** `edicion.js?v=7` en juego y demo; catálogo `editor.js?v=1`.

## Idiomas de interfaz · navegación, controles y diálogos · 5 de noviembre de 2026

- **Rama:** `refactor/idiomas-interfaz`. Se amplía la migración a navegación, controles principales, información de pantalla completa y textos estáticos de los diálogos. El catálogo integrado suma **275 claves ES/EN**; las fuentes de traducción siguen separadas del código del juego.
- **Presentación dinámica.** Ejecutar/Detener, Pausa/Seguir, intento/reloj, selector JS/Python y sus vistas, selección múltiple, Replace abierto, confirmaciones de copiar/restaurar/borrar, estados vacíos, ruteo y resumen tienen refrescos de texto propios. Los menús móviles y las etiquetas accesibles de paneles/pantalla completa se actualizan sobre los mismos nodos. Los textos específicos de War/Factory tienen un único propietario dinámico para evitar que el HTML vuelva a poner etiquetas genéricas.
- **Estado conservado.** El cambio de idioma no reabre documentos, reconstruye opciones, cambia valores de la API/telemetría, toca guardados, modifica pausa/velocidad ni reinicia temporizadores. Replace conserva destinos, checkbox, foco y promesa pendiente. Los catálogos se insertan como texto o atributos, incluido un caso de prueba con marcado HTML hostil.
- **Doble revisión.** Agentes Luna High/Max implementaron módulos separados y una revisión independiente comprobó handlers, carga, nodos y timers. La revisión final retiró un marcador estático de los botones de teclado: su descripción activa pertenece al editor compartido y no debe volver al estado genérico al traducir. Queda una regresión específica; su traducción completa se hará con el componente del editor.
- **Verificación actual.** `node pruebas/ejecutar-idiomas.cjs` pasa **105** comprobaciones en contextos aislados y vista Plano: 34 de infraestructura, 26 de bordes y **45 nuevas** de controles/confirmaciones. Pasan también runtime, paridad/variables/duplicados/referencias de los catálogos, lógica **124**, contratos, lenguajes, editor Python **34**, traductor **64** y reglas de Factory. Navegador: War **92**, arranque/Python **27**, editor Factory **18**, vistas Factory **31**, editor móvil **72 en Plano**, entrada/paquete **8**. Paquete regenerado: **9 páginas y 94 referencias locales**; sintaxis y `git diff --check` correctos. El límite previo del Worker con 3D por software sigue documentado en la etapa anterior.
- **Continuidad.** README y [contrato de idiomas](docs/IDIOMAS-INTERFAZ.md) explican cómo añadir textos y repetir la QA con un comando. Quedan pendientes el editor/paletas compartidos, ayudas extensas, formularios, contenido de retos/escenarios y diagnósticos; el mensaje de Ajustes indica que la migración aún es parcial. Los textos se podrán revisar globalmente en sus catálogos sin alterar reglas. Versiones: `juego.js?v=39`, `layout.js?v=19`, `ajustes.js?v=2`; nuevos catálogos `juego-estatico.js`, `juego-dinamico.js` y `disposicion.js`, `?v=1`.

## Idiomas de interfaz · primera etapa · 5 de noviembre de 2026

- **Rama:** `refactor/idiomas-interfaz`, sin commits, push ni publicación. Primera entrega: infraestructura compartida y portada/Ajustes en español e inglés; el resto del juego y los diálogos secundarios siguen pendientes y el selector lo indica.
- **Runtime y catálogos.** `shared/i18n/` separa el motor de las 96 claves ES/EN de las dos pantallas. El selector funciona sin recargar y guarda únicamente `cmg-interfaz-idioma`; español es el idioma por defecto y el respaldo de claves ausentes. Se traducen textos de hojas y atributos accesibles permitidos, sin interpretar HTML ni sustituir controles. Ajustes vuelve a pintar su nota de orientación, descripciones de las vistas previas y estado de pantalla completa.
- **Contratos conservados.** Idioma de interfaz, idioma del seudocódigo y lenguaje JS/Python son independientes. No cambian API, simulación, RNG, programas ni formatos de guardado. Las pruebas comprueban identidad de objetos, fuentes JS/Python, selección, foco, controles, almacenamiento y continuidad de un Worker activo.
- **Revisión por lotes.** Implementación acotada con agentes Luna High/Max y revisión independiente de runtime y casos límite. Se detectó y corrigió la carrera de los scripts `defer` que aplicaban claves antes de registrar los catálogos; queda una regresión específica para `readyState=interactive` y para registro posterior a inicialización completa.
- **Verificación actual.** Runtime, catálogos (paridad, duplicados, variables y referencias), lógica **124**, contratos, lenguajes, editor Python **34**, traductor **64** y reglas de Factory correctos. Navegador/Playwright con adaptador `page.cdp`: idiomas **34**, casos límite **26**, War **92**, editor de Factory **18**, vistas de Factory **31**, entrada/paquete **8** y editor móvil **72 en vista Plano**. El adaptador externo selecciona el control visible cuando la suite histórica encuentra etiquetas duplicadas. Paquete: **9 páginas y 91 referencias locales**. Sintaxis y `git diff --check` correctos.
- **Límite confirmado en 3D.** La suite móvil en 3D por software llega a 51 comprobaciones principales y 12 de regresión; después, el arranque del Worker activa el watchdog de 2,5 s antes de producir `fila 99`. Se reprodujo el mismo error con el HTML y layout originales de `HEAD`, servidos sin modificar el checkout; no es una regresión atribuible a i18n. La suite completa pasa con la preferencia de vista Plano, sin alterar runtime, watchdog ni assertions. Pendiente QA de teclado y gestos en teléfonos reales.
- **Continuidad.** [Contrato, glosario y migración por lotes](docs/IDIOMAS-INTERFAZ.md). Futuras traducciones deben recibir solo claves nuevas/modificadas y su contexto de pantalla; una clave nueva sin extraer en las zonas migradas falla en QA. Versiones: `inicio.css?v=3`, `layout.js?v=18`, nuevos módulos i18n `?v=1`.

## Modo revisión · prototipo con el reto 5 · 6 de noviembre de 2026

- **Origen.** Propuesta del usuario: un modo junto al del mapa que deje la pantalla en dos franjas de borde a borde, con el código arriba (sin editar) y su explicación abajo en lenguaje natural, con el resaltado en el orden real de ejecución. Tocar un texto debe mostrar qué representa. Pidió probarlo con el reto 5, que la solución use los nombres de las máquinas como objetos y el dato `jammed`, y que cada máquina o robot nuevo se pueda ir añadiendo. Scrimba queda solo como referencia.
- **Solución del reto 5** (`educational-animation/revision/ejemplos/reto-5/`): si `LAU_02.jammed` (o `LAU_01.jammed`), disparo normal, porque el único reparador está ocupado; si no, ráfaga mientras `failureRate < 0.12`; espera 0,25 s.
  - Se eligió con un barrido en el juego real (headless, puerto 8771): 12 de 12 semillas sin brechas y con 2 atascos.
  - Sin la regla también gana, pero con 3 atascos en 9 de 12. La primera idea (cubrir al compañero con ráfaga) perdía con 2 brechas.
- **Cómo se hace, sin LLM.**
  - `trazador.js` instrumenta el programa por su árbol (acorn) sin mover líneas.
  - `grabar.mjs` ejecuta el juego real con esos programas, recoge la traza de cada Worker y repite la partida sin traza con la misma semilla. Falla si cambia el resultado o los eventos de alguna máquina. El orden entre Workers dentro de un mismo instante sí varía, porque es concurrencia real; no cambia el mundo.
  - `pasos.js` agrupa vueltas y tramos.
  - `explicar.js` y `catalogo.js` escriben las frases con los valores reales.
- **Interfaz** (`revision/index.html`):
  - Pantalla partida a todo el ancho. Arriba están el código, con anillos y bandas de color por papel e insignias de valor, y el selector LAU-01/LAU-02, que conserva el momento de la partida.
  - Abajo están la narración, lo que vio el programa (las dos máquinas y si REP-01 está reparando), ‹ ▶ › y la franja de tramos con atascos y reparaciones.
  - Tocar el código abre «¿qué es?»; otro toque sube al bloque que lo contiene. Tocar un fragmento de la explicación lo señala en el código.
  - Los comentarios del programa aparecen como «nota del autor».
- **Catálogo ampliable.** Una máquina nueva es una llamada a `CMGCatalogo.registrar(...)` con sus propiedades y métodos. Trae el lanzador, el sensor de vibración, la espera, la consola y el robot de Factory (este, sin grabación de ejemplo).
- **Verificación actual.**
  - `revision/pruebas/trazador.cjs`: **20** comprobaciones. Mismas líneas y mismo resultado con traza; «seis cafés»; `else if`, etiquetas, `?.`, `typeof`, `await`, `this`.
  - `pasos.cjs`: **43** comprobaciones. Grabación, vueltas, orden de los pasos, textos sin `undefined`, la historia de los dos atascos y una máquina nueva registrada en la prueba.
  - `interfaz.mjs`: **42** comprobaciones en Chromium a 1280×800 y 390×844 (puerto 8793). Sin desplazamiento lateral ni errores.
  - Grabación: misma partida con y sin traza (1099 eventos del juego). Dos grabaciones seguidas son idénticas byte a byte; los eventos de un mismo instante se guardan ordenados por máquina. Repetida tras el commit remoto de Python (`bfb205b`) con el mismo resultado.
- **Límites.**
  - Solo JavaScript. Python llegaría por líneas, y por expresiones si el traductor conserva columnas.
  - Fuera del juego: falta el botón junto al mapa y repetir el último intento instrumentado.
  - Solo se agrupa el bucle principal.
  - Pendiente QA en un teléfono real y revisión humana de las plantillas.
  - No cambia el juego. Publicado como artifact privado para revisión; commit en `trunk` a petición del hook de la sesión.

## Continuidad de lenguajes · conversión JS/Python · 6 de noviembre de 2026

- **Punto de partida.** Revisión del historial y de las ramas remotas: el trabajo de Python se hizo en `trunk` y E5–E7 ya estaban incorporadas también a `main`. Se retoma `trunk` desde `fd15451`, con dos subagentes Luna a petición del usuario. El registro del 4 de noviembre dejaba pendientes diferencias de nombres, parámetros por defecto y Unicode; no se encontró una rama de traducción de la interfaz.
- **Python → JS.** Los valores por defecto de `def`, `async def` y `lambda` se evalúan una sola vez al definir, en el ámbito exterior. Se conservan la lista mutable compartida, `None`, los argumentos por nombre y los efectos laterales aunque se pase un argumento explícito. Los nombres del jugador `__r` y `__tN` ya no colisionan con auxiliares de comprensiones y desempaquetado. Se mantienen las líneas del programa.
- **JS → Python.** El renombrado evita colisiones entre palabras reservadas, builtins, nombres con `$`, identificadores Unicode normalizados a NFKC y destinos de API. Los nombres de propiedades no pasan por el renombrado de variables. Los defaults dinámicos, `undefined` explícito en llamadas a funciones con defaults, los parámetros obligatorios después de uno opcional y los alcances que no se pueden conservar se rechazan con un motivo y línea. La comprobación de alcance es conservadora: puede pedir renombrar o reescribir un programa válido. El JS original se conserva.
- **Regresiones.** `python-semantica-regresiones.cjs`: tres programas contrastados con CPython. `python-conversion-regresiones.cjs`: 20 comprobaciones, con ejecución de las salidas en CPython 3.12.14. `python-ejecucion.mjs` añade cinco comprobaciones del Worker y del selector, incluidos errores con su línea y conservación del JS al fallar la conversión.
- **Verificación actual.** Interacción 124, editor Python 34, traductor 64, regresiones nuevas, contratos, catálogo de lenguajes y reglas de Factory correctos. Chromium/Playwright, puerto 8771: Python en el juego 27; ejecución JS/Python en War y Factory 26 (las 21 previas más las cinco nuevas), sin excepciones en esta última suite. La suite de arranque fuerza una excepción deliberada por un recurso ausente. Una pasada con 3D por software se detuvo con la consola vacía; la pasada completa de ejecución en Plano dio 26/26. No se modificó el runtime ni su watchdog. Paquete estático: 9 páginas y 87 referencias locales. Sintaxis y `git diff --check` correctos.
- **Pendientes.** QA de teclado y gestos en un teléfono físico; normalización de identificadores y operaciones Unicode en textos escritos directamente en Python. Diccionarios, tuplas completas y D8 siguen como ampliaciones/decisiones del plan, fuera de estas correcciones. Correcciones en `trunk`; el usuario solicitó después el enlace de raw.githack, por lo que se guardan en un commit y se suben a esa rama. No se despliega en Netlify.
- **Versiones.** `traductor.js?v=2` y `desde-js.js?v=3`.

## Infografías animadas · skill, motor y ejemplo «seis cafés» · 5 de noviembre de 2026

- **Origen.** Tutoriales animados del juego: infografías paso a paso como las de aprendejavascript.dev. Cada explicación debe tener vídeo en horizontal y en vertical, en JavaScript y en Python, y una versión interactiva por diapositivas para releer. El sitio de referencia no es accesible desde la nube (red bloqueada) y su código no es público. El análisis sale de **8 capturas** del usuario (`for`, tipos, comparación, `if`), así que el movimiento está inferido.
- **Decisión técnica.** HTML + GSAP 3.13 sin compilación: una sola spec por concepto produce el reproductor interactivo y los 4 vídeos. La animación es una línea de tiempo en pausa: el reproductor la reproduce y el render la coloca en cada fotograma (Playwright + CDP + FFmpeg), sin depender del reloj. Remotion y Motion Canvas siguen para las piezas de personajes. GSAP (licencia estándar gratuita, uso comercial) y las fuentes OFL viven en `educational-animation/infografias/`, **no en el juego**.
- **Receta (skill `.claude/skills/infografia-animada`).**
  - Mapa completo atenuado con un foco que avanza.
  - Código, estado, diagrama y narración cuentan lo mismo a la vez.
  - **El color es el papel**, a raíz de la observación del usuario: en la primera versión todo era ámbar. Ahora la condición es amarilla, el cuerpo cian o cobre, la actualización morada, `break` roja y `continue` cian, igual en anillos, nodos, líneas y narración. Varias partes pueden encenderse a la vez.
  - Valores concretos, causa antes que efecto, preguntas de predicción, vueltas comprimidas con casos especiales en detalle.
  - Paridad JS/Python con glosario (`{{true}}` → `True`) y anclas en lugar de números de línea.
- **Motor.** Paneles de código, fichas, consola, flujo (salidas, vueltas por carriles), fila (catálogo, lista, vueltas) y expresión. Pasos con `foco`, `hecho`, `marca` (varios anillos), `linea`, `valores` (secuencias con `en`, iconos), `consola`, `mostrar`/`ocultar` y `pregunta` (el reproductor espera la respuesta). Lienzo de 960×540 / 540×960 que se escala; en pantallas estrechas pasa solo a vertical. Sin ligaduras para que `===` se lea tal cual.
- **Render.** `render.mjs --hoja` genera un PNG por variante y avisa de desbordes en vídeo y en interactivo. Sin `--hoja` genera los MP4 (1920×1080 y 1080×1920, 30 fps), `.vtt` y un manifiesto con sha256. La captura por CDP y la reutilización de fotogramas en las pausas lo aceleraron ≈5× (la primera versión iba a ~1 fotograma/s).
- **Ejemplos.**
  - `while-cinta`: 9 pasos, 1 pregunta.
  - `seis-cafes`: el `while` del usuario con `break` y `continue`. Tiene 12 pasos y 2 preguntas, y la traza real se comprobó con `node` y `python3`: 6 cafés, vuelta 5 `continue`, vuelta 8 `break`. La condición `< 10` nunca llega a `false`.
- **Verificación actual.**
  - Hojas de las 8 variantes sin avisos.
  - Reproductor del `while`: **22** comprobaciones (auto-avance, pausa, ‹ ›, teclado, puntos, pregunta, JS↔Python, final, móvil 390×844).
  - Reproductor del café: **12** comprobaciones (pregunta, 6 tazas, Python con `==`/`True`/`drink_coffee`, móvil).
  - Sintaxis de motor, render y specs.
  - Render de los 4 vídeos del café: 1920×1080 y 1080×1920, 30 fps, H.264, comprobados con ffprobe. JS: 106,8 s y 3204 fotogramas. Python: 106,4 s y 3192 fotogramas. Cada uno con `.vtt` y manifiesto, sin avisos. Tardó 5 min 49 s en total, con 2 en paralelo y ≈45 % de fotogramas capturados. Los MP4 no se versionan.
- **Pendiente.**
  - Voz: elegir entre grabación y TTS; el motor y el render ya aceptan un clip por paso.
  - Revisión humana de las metáforas y prueba en un teléfono real. En ejemplos densos, el código queda a ~11 px en un teléfono de 390 px.
  - Decidir si GSAP entra en `shared/vendor/` para mostrar infografías dentro del juego.
- **Límite.** No cambia el juego. Cambios locales, sin commits, push ni publicación en el repo; el ejemplo se publicó como artifact privado para revisión.

## Correcciones del review del editor móvil · 5 de noviembre de 2026

- **Ficha accesible en todas las vistas.** JS, Seudo y Bloques comparten un contenedor para el programa y la ficha ⓘ. Ocultar el textarea ya no retira el acceso al Inspector y a la Consola; el asa mide ese contenedor común. Se conservan los mismos nodos, valores vivos y preferencias de alto.
- **Tab en líneas vacías.** Con solo el cursor, sangrar y quitar sangría actúan también sobre una línea vacía o con espacios (dos por nivel en JS, cuatro en Python). Al comienzo de una línea se usa esa línea, no la anterior; se conserva la posición del cursor. El tratamiento de las líneas vacías dentro de una selección múltiple se mantiene.
- **Listas de Seudo/Bloques.** El desplegable queda dentro de la vista del programa y del viewport visible, respetando las barras tanto arriba (PC) como abajo (teléfono). Se recoloca al desplazar o redimensionar; una opción sigue editando el mismo hueco.
- **Consola larga.** Al abrirla o recibir mensajes visibles, se desplaza el contenedor real hasta el último mensaje, sin saltar a los ajustes posteriores ni mover el resto de la pantalla. Una consola oculta por el mapa conserva el aviso de novedades.
- **Regresiones.** `pruebas/editor-movil-regresiones.mjs` añade **21** comprobaciones de los cuatro fallos, integradas en `editor-movil.mjs`, incluido volver del mapa con mensajes pendientes y la ficha aún abierta. La prueba del ProtoMouse usa la anchura real del carácter y movimientos sin aceleración desde el primer paso: ya no necesita una preferencia previa de letra de 13 px.
- **Verificación actual.** Chromium/Playwright, puerto 8771: móvil **72** (51 previas + 21 nuevas, con la letra predeterminada); War **92**; demo **73**; editor de Factory **18** y vistas **31**; Python en el juego **27** y ejecución JS/Python **21**. La excepción de arranque de la suite Python es deliberada. Lógica **124**, editor Python **34**, traductor **64**, contratos, lenguajes y reglas de Factory correctos. Sintaxis y `git diff --check` correctos; paquete con **9 páginas y 87 referencias**. Medidas de la distribución de PC comparadas con `56435c7`, sin diferencias; capturas del inspector en Seudo y de la consola larga revisadas.
- **War.** La primera pasada llegó a 90 comprobaciones y reprodujo el fallo previo al review: watchdog de 2,5 s antes del primer mensaje del Worker con el mapa 3D por software. La prueba final de los botones pasa a Plano después de comprobar los gestos y las cámaras en 3D; la suite elige 3D explícitamente al empezar. No se cambia el runtime ni su límite. La repetición completa dio **92/92**.
- **Límite.** Emulación de Chromium; pendiente comprobar el teclado y los gestos en un teléfono real. Cambios locales, sin commits, push ni publicación.
- **Versiones:** `layout.css?v=24`, `layout.js?v=17`, `edicion.js?v=6` (juego y demo), `seudo.js?v=2`.

## Editor del teléfono · hoja ⓘ, edición en la barra de inserción y sin teclado arriba · 5 de noviembre de 2026

- **Origen.** Ajustes pedidos sobre el rediseño (capturas del usuario): la ficha ⓘ desaprovechaba el ancho y desaparecía con el teclado; faltaban línea nueva, tab, comentar y borrar a mano; el modo sin teclado merecía un botón propio. Solo cambia el teléfono (`data-forma="movil"`); PC igual.
- **Ficha ⓘ como hoja.** El botón redondo pasa a ser una pestaña con una flecha en la esquina inferior derecha del código, apoyada en la barra de edición, también con el teclado abierto. Abre una hoja del ancho del código que empieza en la mitad de la pantalla (o lo que quepa). El asa de arriba cambia el alto, que se guarda como fracción del código (`cmg-juego-info-alto`) y se recuerda al cerrar y al recargar; con el teclado la hoja se adapta. La flecha hacia abajo, Escape o soltar el asa casi abajo la cierran (vuelve la pestaña, sin olvidar el alto). Tocar el código ya no la cierra en el teléfono: se puede leer el inspector mientras se escribe. El asa también responde a las flechas del teclado.
- **Barra superior.** Comentar deja su sitio al interruptor del modo sin teclado (rojo y tachado al estar activo; oculto en seudocódigo). Sale del menú ⋯, que pierde su marca roja.
- **Barra de inserción, dos conjuntos.** Edición y sintaxis: línea nueva (debajo de la línea actual, esté donde esté el cursor, ya sangrada), tab (mantener: quitar sangría), comentar, borrar (no toca el portapapeles), pares y signos. Bloques: bucles, if, operadores, variable, órdenes y consola. Con teclado, edición y sintaxis van primero; sin teclado se cambian de sitio (solo CSS, `order`) y la tira vuelve al principio al cambiar de modo. Los tres botones nuevos son entradas `movil` del catálogo común con `accion`, que llama a la acción de la barra (`cmg.edicion.accion`); no cuentan como inserciones en la telemetría.
- **Verificación.** `editor-movil.mjs` 51 (15 nuevas: pestaña, hoja, asa, alto recordado, botones nuevos, orden por modo); War 92 (adaptada al interruptor); Factory 28, 31, 18, 10 y 7; Python en el juego 27 y ejecución 21; demo 73; entrada 8; lógica 124 (catálogo ampliado); contratos, lenguajes, Python del editor 34, traductor 64 y reglas de Factory correctos. Playwright con el adaptador `page.cdp`; la excepción de `python-juego.mjs` es la deliberada. PC: la ficha flotante y la paleta sin cambios a la vista.
- **Pendiente:** QA en teléfono real (alto inicial de la hoja, asa con el pulgar, pestaña junto a la franja del ProtoMouse).
- **Versiones:** `componentes.css?v=22`, `layout.css?v=23`, `iconos.js?v=6`, `plantillas.js?v=5`, `edicion.js?v=5`, `nucleo-ui.js?v=4`, `juego.js?v=38`, `layout.js?v=16` (y las compartidas también en la demo).

## Editor del teléfono rediseñado · rama `ui-movil-editor` · 5 de noviembre de 2026

- **Origen.** [Lineamientos acordados](docs/REDISENO-EDITOR-MOVIL.md) para dar más sitio al código y facilitar la edición táctil sin perder las herramientas ni el metal. Precisiones: lenguaje y letra se elegirán al empezar y después en Ajustes; bucles e `if` usan los botones metálicos que ya existían; puntuación y envolventes llevan ese estilo. Rama propia para pruebas de UI. Solo cambia el teléfono (`data-forma="movil"`).
- **Reparto.** De arriba abajo: barra mínima, código, barra de edición con ProtoMouse y barra metálica de inserción. Con el teclado abierto, las dos barras quedan justo encima de él y el código ocupa el resto del viewport visible; la antigua barra de símbolos ya no aparece.
- **Barra superior.** Programas (también a pantalla completa), ▶ (■ en rojo mientras corre), comentar, mapa (con pantalla completa), pantalla completa (si el código ocupa la esquina) y ⋯. No se pliega, ni con el teclado. El ⋯ abre placas metálicas: Programa, Registro, Órdenes, Escenario, Sin teclado (que ⋯ recuerda con una marca roja) y Ajustes. Fuera del programa reaparecen las pestañas para volver. Lenguaje, letra y colores: Ajustes (sección nueva **Editor**, también en PC).
- **Barra de edición.** deshacer · rehacer · selección · **ProtoMouse** · cortar · copiar · pegar. Lo demás, manteniendo pulsado su pariente (esquina marcada, las placas de las variantes): Selección → ampliar, reducir, subir, bajar; Cortar → borrar, desenvolver; Copiar → duplicar; Pegar → línea nueva, sangrar, quitar sangría (nuevas en el teléfono; con solo el cursor, la sangría lo conserva en su sitio). En seudocódigo vuelve la barra completa. El orden de Ajustes sigue valiendo para PC y seudocódigo.
- **ProtoMouse.** Trackpad relativo en `shared/editor/edicion.js`: arrastrar mueve un puntero virtual (aceleración hasta ×2,6) y el cursor salta al carácter más cercano por renglones visuales, con el espejo del textarea; sin teclado usa la vista de bloques. La captura del puntero deja seguir fuera de la franja; al pasar arriba o abajo, el código se desplaza. No enfoca el código: el teclado se queda como estaba. Con el teclado cerrado pinta su cursor y su selección. El interruptor de selección (luz azul) hace que amplíe desde el extremo fijo; se apaga al cambiar el texto o usar otra acción.
- **Inserción.** La paleta de siempre, al pie. Delante, dos botones nuevos del catálogo común (JS y Python), solo en el teléfono: pares `( ) [ ] { } " "` (rodean lo elegido) y puntuación `. , ; :`, con variantes. Van al final del catálogo, así no cambian los índices de PC. Comentar sale de la paleta porque está arriba. Desplazar la tira anula la pulsación larga.
- **Ficha ⓘ.** Inspector (segunda pestaña) y Consola (última) muestran los nodos vivos del panel inferior, que se retira en el teléfono; la ⓘ marca los mensajes nuevos. Las sugerencias ya no suben por encima del código ni tapan las barras de abajo.
- **PC sin cambios:** columna del código idéntica píxel a píxel a la de `trunk` en War, Factory y a 1100 px.
- **Verificación** (detalle y capturas en `docs/qa/editor-movil-2026-11-05/`): nueva `editor-movil.mjs` 36; War 92 (parte del teléfono adaptada, 2 nuevas); Factory 28, 31, 18, 10 y 7; Python en el juego 27 y ejecución 21; demo 73; entrada 8; paquete 9 páginas y 87 referencias; lógica 123 (grupos de la paleta ampliados), contratos, lenguajes, Python del editor 34, traductor 64. Ejecutadas con Playwright y un adaptador de `page.cdp`; con él, `trunk` da War 90/90.
- **Pendiente:** QA en teléfonos reales (tacto y ganancia del ProtoMouse, franja de ~70 px a 360 px, teclado de Android; iOS sin revisar); elegir lenguaje y letra al empezar; teléfono en horizontal (sigue con la distribución de PC); demo del editor con la barra clásica.
- **Versiones:** `edicion.css?v=7`, `layout.css?v=22`, `iconos.js?v=5`, `plantillas.js?v=4`, `edicion.js?v=4`, `nucleo-ui.js?v=3`, `juego.js?v=37`, `layout.js?v=15` (y las compartidas también en la demo).

## Arreglo · concatenaciones JS → Python y diagnóstico de arranque · 4 de noviembre de 2026

- **Concatenaciones.** `"x=" + (1 + 2)` conserva la suma agrupada y produce `x=3`. La conversión respeta el orden del árbol: solo aplana el lado derecho cuando ya se sabe que es texto. Los literales se convierten a texto antes de montar la f-string, para no perder números al final de una concatenación con variables y conservar `true`/`null` literales. Las expresiones mixtas no representables siguen dando un diagnóstico.
- **Arranque.** La página usa `window.__juegoListo`, que se activa al terminar la inicialización, en lugar de dar por listo el juego cuando aparece `__banco`. Si falta `factory-form.js`, ahora muestra el recurso ausente y la excepción tardía; al recuperar el archivo, Factory crea el mundo sin aviso. El aviso diagnostica el fallo: no sustituye un recurso ausente.
- **Verificación actual.** Traductor: 64 comprobaciones (6 regresiones nuevas de concatenación); nueve conversiones comparadas también con CPython 3.12 real. Interacción: 123; editor Python: 34. Navegador Chromium: Python en el juego 27 (2 nuevas de arranque), ejecución JS/Python en War y Factory 21, entrada/paquete 8. La excepción de la prueba que fuerza el 404 es deliberada; las suites de ejecución y entrada no registran excepciones. Sintaxis y `git diff --check` correctos. Paquete: 9 páginas y 87 referencias.
- **Pendiente.** No se cambian renombrado/colisiones de variables, parámetros por defecto, Unicode ni las demás diferencias semánticas detectadas en la revisión. El renombrado requiere más pruebas. Sin QA de teléfono físico y sin publicación.
- Versiones: `desde-js.js?v=2`, `juego.js?v=36`.

## Arreglo · Factory en negro otra vez: caché con versiones mezcladas · 4 de noviembre de 2026

- **Causa.** El catálogo se había publicado como archivo nuevo (`catalogo.js`), con su propia etiqueta en `index.html`, y `plantillas.js` pasó a depender de él. Una caché que sirve un `index.html` anterior junto con el `plantillas.js` nuevo deja `CMGCatalogo` sin definir. raw.githack ignora `?v=`, y las copias por rama se renuevan a destiempo. `CMGPaleta.crear` lanzaba un error y el arranque se cortaba antes de la rama de Factory: «Primer blanco», pestaña «Escenario», paleta e inspector vacíos, mapa negro. Se reprodujo sirviendo cada archivo cambiado en su versión anterior (`cc10e0b` y `92c1b09`), uno por uno.
- **Arreglo.**
  - El catálogo vive dentro de `plantillas.js`, que todas las páginas ya cargan antes que `python.js`. `catalogo.js` desaparece y no hay etiqueta nueva de la que dependa el arranque.
  - La paleta ya no puede tumbar el juego. Los adaptadores leen sus plantillas de forma perezosa y protegida. `juego.js` arma la paleta con `paletaSegura`: si falla, el juego arranca con la paleta vacía y avisa en el editor que hay que recargar sin caché.
  - `index.html` registra los errores del arranque. Si el juego no llega a arrancar, muestra un aviso con el detalle («no cargó juego.js…») en vez de quedarse en negro.
  - Con estas tres medidas, todas las mezclas de un archivo viejo con los demás nuevos arrancan, contra las dos versiones anteriores.
- **Pruebas.** En `python-juego.mjs`: unas plantillas rotas no cortan el arranque de Factory, y la página avisa si falta `juego.js`.
- **Para probar en raw.githack** conviene la URL fijada al commit en lugar de `trunk`, que puede mezclar copias.
- Versiones: `plantillas.js?v=3`, `adaptador-js.js?v=2`, `adaptador-python.js?v=4`, `juego.js?v=35`.

## Catálogo único de la paleta (JS y Python) · 4 de noviembre de 2026

- `CMGCatalogo` (en `shared/editor/plantillas.js`; primero fue `catalogo.js`, ver la entrada de arriba) es una sola tabla de botones comunes con el texto de cada lenguaje. `plantillas.js` (JS) y `plantillas()` de `python.js` ya no tienen listas propias: las generan desde la tabla.
- **Sin cambio visible.** Se comprobó que las listas generadas son idénticas a las anteriores, en JS y en Python, con y sin pausa (War 0,5 s y Factory).
- Un botón nuevo se añade una vez y aparece en JS, Python, War, Factory y el IDE. Lo propio de un lenguaje es la entrada que el otro no declara.
- Pruebas: `editor-contrato.cjs` comprueba los botones compartidos, la pausa por lenguaje y que cada lista sea independiente.
- Versiones: `plantillas.js?v=2`, `python.js?v=3` (juego y demo).

## Paleta común en War y Factory · 4 de noviembre de 2026

- **Problema.** La paleta de Factory se armaba a mano en `juego.js` y sustituía a la común. En JS y en Python le faltaban If / else (con If e If / else if), los operadores (`??`, `&&`, `||`, `!`, comparaciones; en Python `and`, `or`, `not`, `is None`) y Variable. Los bucles tampoco eran los de War: For y While sueltos, sin While true, Do … while ni Salir del bucle.
- **Ahora.** Todas las paletas siguen la misma composición en `js/paleta.js`: `comentar | sección común del lenguaje + Esperar | órdenes de la serie | consola`.
  - La sección común sale del catálogo del lenguaje (`shared/editor/plantillas.js`, `CMGEditorPython.plantillas`), el mismo que usa la demo del IDE.
  - Cada serie declara solo su pausa de bucle y sus órdenes, escritas una vez en JS. Python las obtiene con `aPython`. War pone pausa `esperar(0.5)` porque disparar no espera. Factory no la necesita: sus órdenes ya llevan `await`.
- **Cambio visible.** Factory muestra los mismos bucles (While true, con While, For, Do … while y Salir del bucle como variantes), If / else, operadores y Variable que War. Esperar pasa a la sección común. Consola (Aviso o `print`) va al final, como en War.
- **Sincronía.** `pruebas/editor-contrato.cjs` comprueba que War y Factory tienen la misma sección común en JS y en Python, y que cada serie solo aporta sus órdenes. Si alguien vuelve a armar una paleta aparte, la prueba falla.
- Versiones: `paleta.js?v=5`, `juego.js?v=34`.

## Arreglo · Factory en negro en Netlify y desplegable de lenguaje · 4 de noviembre de 2026

- **Causa de la pantalla negra.** Factory buscaba el enlace con `a[href="probar.html"]`. En Netlify, «Pretty URLs» reescribe ese `href` como `probar`, así que el selector no encontraba nada y el `TypeError` cortaba el arranque de Factory (juego.js, rama `ES_FACTORY`). Por eso no había mapa ni inspector, Ejecutar no hacía nada, la paleta seguía siendo la de War y Python no aparecía. En local y en `dist/` no se veía, porque nadie reescribe el HTML.
- **Arreglo.** El enlace se busca por id (`#b-probar`) y se le añade `serie=factory` sobre la URL que tenga. `probar.html` tenía el mismo patrón con `a[href="index.html"]` y ahora usa `#abrir-solo`. La regresión está en `pruebas/python-juego.mjs`: reescribe el `href` como Netlify y comprueba que Factory arranca sin errores.
- **Desplegable de lenguaje (D7) en la cabecera del juego.** Sustituye a los botones JS/Bloques/Seudo/Py por `<select id="sel-lenguaje">` con JavaScript y Python. Debajo, en «Vistas de JavaScript», están Seudocódigo y, solo en Factory, Bloques. Con varias unidades en lenguajes distintos muestra «Varios lenguajes». El comportamiento no cambia: Python convierte o recupera; JS, Seudo y Bloques vuelven a JavaScript y aplican la vista. Ajustes conserva sus botones. Las pruebas que pulsaban los botones de la cabecera ahora eligen en el desplegable.
- Versiones: `juego.js?v=33`, `componentes.css?v=21`, `layout.css?v=21`.

## Editor · E5–E7: Python se ejecuta, listas y conversión desde JS · 4 de noviembre de 2026

- **Se retiró `?python=1`.** Py (cabecera) y Python (Ajustes) están siempre. Cambio visible declarado: las capturas de War y Factory ya no son las de E4b, porque el botón Py aparece en la cabecera.
- **E5: Python se ejecuta.**
  - `shared/python/traductor.js` traduce Python a JS con las mismas líneas. Usa el árbol de lezer para las sentencias y reasocia las expresiones con la precedencia de Python, porque lezer agrupa distinto `not a and b` y `await f() + 1`.
  - Resuelve los ámbitos (`global`, `nonlocal`, comprensiones, lambdas) y renombra con `$` lo que choca con JS o con la API. Las funciones locales llamadas como la API, como `count`, siguen siendo locales.
  - La API pasa por `proveedor.alias("python")` (D1). Una orden que espera sin `await`, o una `async def` llamada sin `await`, se avisa antes de ejecutar (D2).
  - El preludio `__py` va dentro del Worker (`runtime.js`): verdad de vacíos, operadores con sus `TypeError`, igualdad profunda, `print`/`repr`, f-strings con formato y redondeo mitad al par. Los errores de JS se reescriben al estilo de Python (`NameError`, `AttributeError`…).
  - Sintaxis, sangría y huecos se revisan al pulsar Ejecutar, con la línea de Python. Los mensajes de la API usan los nombres Python.
  - D3 aplicada: `print` va al registro; `info`, `warn` y `error`, a sus niveles.
  - Telemetría: lleva el texto Python y `lenguajes`, también en la remota y en la columna del CSV.
  - Récords (D6): una tabla por reto con el lenguaje como etiqueta. War lo guarda en `records-lenguaje` para no cambiar `records`; Factory, en `lenguaje` dentro del récord.
- **E6: listas.** Índices negativos, trozos con paso, métodos de lista y de texto, `enumerate`, comprensiones con varios `for` e `if`, `del xs[i]` y tuplas para desempacar.
- **E7: conversión y documentación.**
  - `shared/python/desde-js.js` convierte JS a Python por el árbol de acorn. Conserva comentarios y líneas en blanco y convierte también el código comentado. Pasa el `for` clásico a `range`, el `??` de una lectura a `or` y las sumas que empiezan por texto a f-strings.
  - Py convierte el JS de una unidad que aún no tiene Python, y el programa de partida sale convertido. Si algo no cabe, explica el motivo con su línea y el JS se conserva.
  - Documentación actualizada: `REGLAMENTO` (sección Python), `VISION`, `README`, `AGENTS`, `TELEMETRIA`, el plan y `CONTRATO.md`.
- **Teléfono.** La pestaña del programa dice solo la unidad (`R1`, `LAU-01`). Ya no la recorta la fila JS/Bloques/Seudo/Py (era el pendiente de E4b).
- **Verificación** (detalle en `docs/qa/editor-e5-e7-2026-11-04/`):
  - Nuevas: `python-traductor.cjs` 58 (27 salidas iguales a CPython 3.13, copiadas en la prueba) y `python-ejecucion.mjs` 21. Esta última es la compuerta de E5: mismos eventos con sus líneas, tiempos y resultados en JS y en Python, en War y en Factory.
  - `python-juego.mjs` 22, adaptada a E5.
  - War 90/90, editor 18, vistas 31, API 7, paridad 28/28, 3D 10, demo 73.
  - Python del editor 34, lógica 123, contratos e integridad, paquete de 9 páginas con 88 referencias.
  - `telemetria.mjs` no se ejecutó: necesita `npm install`.
- **Límites:**
  - No hay QA en un teléfono real; la compuerta de E7 sigue **pendiente** y solo hay emulación.
  - No se distingue entero de real (`4 / 2` → `2`).
  - Diccionarios y tuplas completas quedan para la etapa siguiente.
  - Py recupera el último Python guardado en vez de volver a convertir.
  - D8 (Bloques y Seudo) sigue sin decidir.
- **Versiones:** juego 32, runtime 4, traductor y conversión 1, remota 3, paleta 4, adaptador Python 3, componentes 20, layout 20.

## Editor · E4b: Python en el juego detrás de ?python=1 · 4 de noviembre de 2026

- **Sin el flag nada cambia.** Las suites dan las mismas cifras y las 32 capturas de War y Factory son idénticas píxel a píxel. El juego carga los módulos Python, pero no los ofrece ni lee `fuentes-<reto>`.
- **Con `?python=1`:**
  - el botón **Py** de la cabecera y **Python** en Ajustes pasan la unidad a Python; JS, Seudo y Bloques la devuelven a JavaScript;
  - `programas` y `prog-<reto>` siguen siendo solo JS; el Python va a `fuentes-<reto>` (`{ lenguaje, texto, enUso }`) y se conserva al volver a JS;
  - Ejecutar muestra un aviso: Python todavía no se ejecuta (E5);
  - paleta, inspector, sugerencias y valores vivos salen en Python mediante `aPython`: nombres D1 (`esperar` → `wait`), huecos D4, sin `;`, operadores y literales de Python;
  - Add y Replace solo con unidades del mismo lenguaje; copiar y restaurar, por lenguaje.
- **Cambios de código:**
  - `CMGPaleta.crearPython`;
  - las plantillas Python ponen la pausa como en JS (línea vacía y luego la pausa);
  - el juego llama siempre a la fachada vigente del editor, y `window.cmg.edicion` y `window.cmg.seudo` son getters.
- **Verificación** (detalle en `docs/qa/editor-e4b-2026-11-04/`):
  - Nueva `python-juego.mjs`: 22.
  - War 90/90, editor 18, vistas 31, API 7, 3D 10, demo 73, Python sin DOM 34, lógica 123, contratos, paquete.
  - Paridad: 28/28 en tres repeticiones; **falló una vez** dentro de la pasada completa («sin-await: tiempo», un caso de error que depende de cuándo llega el mensaje del Worker). No se declara resuelto.
- **Límites:**
  - Python no se ejecuta.
  - En el teléfono con Factory, Py recorta la pestaña del programa (solo con el flag).
  - El lenguaje aún no llega a telemetría y récords (E5).
  - Solo emulación.
- **Versiones:** juego 31, paleta 3, python.js 2.

## Editor · E4a: Python en el componente · 4 de noviembre de 2026

- **E4 se dividió en dos entregas.** E4a (esta) cubre el componente y la demo; E4b, el juego detrás de `?python=1`. Así cada una se revisa por separado.
- **lezer en el repo.** `@lezer/python` 1.1.19, con lr 1.4.11, common 1.5.4 y highlight 1.2.5, está empaquetado en `shared/vendor/lezer-python-1.1.19.js`. Lo genera `herramientas/lezer-python/construir.sh` (esbuild 0.28.2 y `package-lock.json` fijados; regenerarlo da el mismo archivo, byte a byte). Su licencia y su SHA-256 están en el manifiesto. Jugar y probar no usan npm ni CDN.
- **Módulos nuevos:**
  - `python.js`: léxico, huecos `__nombre__` (D4), líneas lógicas, niveles de sangría, `pass` para bloques vacíos, plantillas, operadores, teclas y `#`.
  - `estructura-python.js`: pasa el árbol de lezer a los nodos del editor.
  - `adaptador-python.js`.
- **Código compartido con el juego.** `estructura.js` expone `consultas(...)` y JS usa la instancia por defecto, que se comporta como antes. `edicion.js` toma del adaptador la sangría, los huecos, el final de sentencia y las sugerencias. Con sangría significativa:
  - mover, arrastrar (el nivel lo da la columna del puntero), borrar, pegar y desenvolver respetan los bloques de Python;
  - un bloque que se queda vacío recibe `pass`.

  El proveedor recibe el lenguaje. Hay iconos Python para `and`, `or`, `not`, `==`, `!=` e `is None`.
- **Demo:** cada espacio tiene un documento por lenguaje y el segundo editor empieza en Python. `AGENTS.md`, el plan y `CONTRATO.md` están actualizados.
- **Verificación** (detalle en `docs/qa/editor-e4a-2026-11-04/`):
  - Python sin DOM: 34, nueva.
  - Demo: 73, de las cuales 22 son nuevas.
  - War 90/90, editor 18, vistas 31, API 7, paridad 28/28 y 3D 10.
  - Lógica 123, contratos e integridad correctos, entrada 8, paquete de 9 páginas con 79 referencias.
  - 32 capturas de War y Factory idénticas píxel a píxel contra E3.
- **Límites:**
  - Solo emulación de Chromium; el arrastre táctil con nivel está pendiente de QA manual.
  - La demo no convierte entre lenguajes.
  - El juego aún no carga Python (E4b).
- **Versiones:** estructura 4, edicion 3, nucleo-ui 2, editor 4, iconos 4, demo 4; módulos Python v1.

## Editor · E3: lenguaje del documento · 4 de noviembre de 2026

- **Alcance revisado por el usuario antes de empezar:**
  - Los lenguajes del juego (se traducen a JS y corren en su Worker) son distintos de los del editor (los que el componente sabe editar).
  - Otra aplicación puede usar el editor con su propio motor; eso queda fuera de este proyecto.
  - Solo se añade Python.
  - Bloques y probablemente Seudo saldrán, porque no son prioridad para un IDE. Queda como decisión pendiente D8 y el juego no cambia mientras tanto.
- **`CMGLenguajes`** ahora tiene un catálogo de presentación (`js`, `python`) y las funciones `describir` y `disponibles`. Un adaptador sin entrada en el catálogo usa su propio nombre.
- **Las instancias autónomas** tienen un `<select>` nativo de lenguaje (D7 aplicada). Cambiar de lenguaje es pedírselo al anfitrión con `alCambiarLenguaje`, que responde con un documento, con `{ motivo }` o con una promesa. Las respuestas tardías se descartan. `abrir` con otro lenguaje rehace el interior con su adaptador, sin oyentes duplicados y conservando la forma, la letra, la pantalla completa, el modo sin teclado y un historial por documento. `edicion.js` acepta el mapa de historiales de la instancia.
- **Vistas opcionales** (`opciones.vistas`): el juego las pide y la demo no, y la demo ya no carga `seudo.js`. Con eso desaparece la fuga de los ladrillos de War que se anotó en E2.1. La API está documentada en `shared/editor/CONTRATO.md` y el plan quedó actualizado (E3 revisada, E4 con el selector del juego, D7–D9).
- **Verificación** (detalle en `docs/qa/editor-e3-2026-11-04/`):
  - War 90/90, editor 18, vistas 31, API 7, paridad 28/28 y 3D 10.
  - Demo 51, de las cuales 13 son nuevas.
  - Lógica 123, contratos y catálogo correctos, entrada 8, y paquete de 9 páginas con 79 referencias.
  - 32 capturas de War y Factory idénticas píxel a píxel contra `d739dec`.
- **Límites y versiones:**
  - Sin dispositivos reales.
  - El juego todavía no tiene selector: llega en E4 junto con Python detrás de `?python=1`.
  - Versiones: editor.js 3, edicion.js 2, lenguajes.js 2, autonomo.css 3 y demo 3.

## Editor · E2.1: paridad de la demo con War y pantalla completa · 4 de noviembre de 2026

- Pedido por el usuario antes de E3, tras revisar la demo a 1920×1080, 1400×900, 1024×768, 768×1024, 390×844, 360×640 y 844×390: editor fijo de 300 px sin pantalla completa, siempre con tamaños de PC, barras de edición y símbolos siempre visibles, sin tooltips ni A−/A+, ajustes junto al editor y primer ejemplo sin Seudo.
- Reglas por forma de paleta, barra de edición y Seudo trasladadas de `layout.css` a `shared/css/edicion.css` con `.cmg-anfitrion` (la `.app` del juego o la raíz autónoma). Tooltips trasladados de `layout.js` a `shared/editor/tips.js`, que usan el juego y la demo. Las instancias autónomas deducen su forma, muestran los símbolos solo al escribir en el teléfono y montan JS/Seudo, sin teclado, A−/A+, Ajustes y pantalla completa con el aspecto del juego.
- Pantalla completa por editor: cubre el viewport visual (también con el teclado del teléfono), pide la del navegador donde existe (no en iPhone) y sale con el botón, Esc, el Esc del navegador o `destruir()`. API `pantallaCompleta(si?)`, `forma()`, opciones `forma`, `pantallaNavegador`, `alPantallaCompleta`; documentado en `shared/editor/CONTRATO.md`. Distinta del modo pantalla completa del juego.
- Verificación actual: War y Factory idénticos píxel a píxel en 32 capturas (4 tamaños × 4 estados × 2 series). **War 90/90** en esta pasada, editor 18, vistas 31, API 7, paridad 28/28, Factory 3D 10, demo **38** (18 nuevas; dos expectativas de E2 adaptadas al nuevo ejemplo), lógica 123, contratos, reglas, entrada 8, paquete 9 páginas/79 referencias. Corregido un fallo hallado en la prueba: salir antes de que el navegador concediera la pantalla completa la dejaba puesta. Reporte y capturas en `docs/qa/editor-e2-1-2026-11-04/`.
- Límites: emulación de Chromium, sin dispositivos reales (pendiente iPhone y Android con teclado). El Seudo de la demo muestra los ladrillos de War (catálogo de E3). War sigue tratando el teléfono en horizontal como PC. Versiones: edicion.css6, layout.css19, layout.js14, editor.js2, tips.js1, autonomo.css2, demo2.

## Editor · E2: demo y acceso desde la portada · 4 de noviembre de 2026

- Nueva `shared/editor/demo.html`, con dos instancias reales de `CMGEditor`, proveedor declarativo de mensajes y documentos Principal/Borrador. Historial, selección, menús, modo sin teclado y preferencias son independientes. Solo lectura y recrear editor se prueban en cada panel; la demo no carga `cmg`, `__banco`, simulaciones ni Workers. Sin persistencia del anfitrión, los documentos duran mientras la página está abierta.
- Enlace «Probar el editor de código» al pie de la portada, debajo de Factory/War/Campaign, como pidió el usuario. No es una copia del editor: ambas entradas cargan los mismos módulos de `shared/editor/`. Las correcciones de UI se hacen una vez en esos archivos.
- Verificación E2: `editor-demo.mjs`, **20 comprobaciones** (sin globals del juego, IDs únicos, documentos e historial por instancia/documento, atajos acotados al foco, solo lectura y barra, revisión/marcas antiguas incluidas las de otro documento, recrear tres veces sin duplicación, destruir idempotente y edición sin proveedor/persistencia). Revisión visual a 1400×900 y 390×844, sin desborde; capturas en el reporte. Portada/paquete: 8 comprobaciones de entrada, enlace del footer hasta dos editores funcionando, paquete final 9 páginas/77 referencias locales. E1 por separado también se empaquetó: 8 páginas/57 referencias.
- Se mantienen los resultados de Factory y la limitación de War de E1: la suite completa no se declara pasada. En otra repetición con un adaptador de clic distinto también apareció la intermitencia del anillo táctil; no se cambiaron las expectativas para ocultarla. Requiere revisión manual del arranque a pantalla completa y los gestos en un dispositivo real.
- Listo para que el usuario revise la demo antes de seguir. E3 (dropdown) y E4/E5 (editar/ejecutar Python) siguen pendientes. Cambios de esta etapa: inicio.css2 y demo HTML/CSS/JS v1; sin nuevas dependencias ni CDN.

## Editor · E1: instancia compartida e integración · 4 de noviembre de 2026

- `CMGEditor.crear` en `shared/editor/editor.js`: marcado propio, documento/revisión, selección, marcas con descarte por revisión, solo lectura, modo sin teclado, preferencias inyectadas y `destruir()` idempotente. Fichas/historial y Seudo/Bloques son fábricas compartidas. El juego crea una instancia, conserva IDs, fachadas y claves locales, y aporta funciones/sugerencias/plantillas de sus máquinas. Las plantillas genéricas y las teclas se definen una sola vez; símbolos, medición y resaltado salen de juego/layout. Las simulaciones y el runtime no cambian.
- `vida.js` retira oyentes con AbortController, cancela timers/RAF/microtareas, desconecta observers y retira portales por instancia; el portapapeles asíncrono descarta trabajo tras destruir. Las instancias autónomas tienen IDs y ámbito propios. Tokens y estilos de edición también se comparten.
- Corregida una hoja de sugerencias demasiado baja con coordenadas visibles en móvil, reproducida en el trunk anterior: se omiten encabezados de grupo con menos de 160 px para que quepan los valores completos. Ninguna opción se elimina. El aspecto normal del editor es idéntico al anterior en las capturas comparadas.
- Verificación: 123 lógica, contratos E0 y D1/D2, reglas Factory; navegador Factory editor 18, vistas 31, API 7 y paridad 28/28. Chromium 155/Playwright en 8771, caché desactivada y adaptador de clic sobre el primer elemento visible; expectativas sin modificar. Capturas PC/móvil de `#v-programa` idénticas píxel a píxel contra dfa5f33 (546×770 y 360×314). Sintaxis y diff correctos.
- Límite observado: War llega a 88/90; al ejecutar desde pantalla completa el Worker alcanzó el vigía de 2.5 s sin mensajes en esa secuencia larga de emulación. El mismo botón arrancó bien en prueba dirigida en dfa5f33 y en E1 (672/739 ms); no se declara pasada la suite completa. Referencia actualizada y evidencia en `docs/qa/editor-e1-e2-2026-11-04/`. Sin QA en dispositivos físicos.
- Versiones: juego30, layout13, paleta2, base4, componentes19, edición CSS5; módulos compartidos nuevos v1. E2 entrega la demo con dos instancias y acceso desde la portada.

## Editor · E0: contrato y red de pruebas preparados · 4 de noviembre de 2026

- Continuación autorizada tras D1/D2, sobre `trunk` en `0319866`. `shared/editor/CONTRATO.md` documenta API actuales, puertos, rangos UTF-16, líneas desde 0/1, estructura tolerante, sugerencias reales, fachada `cmg`, eventos, historial, preferencias, dependencias DOM y ciclo de vida previsto para E1. Distingue explícitamente lo implementado de `CMGEditor.crear` todavía pendiente.
- `pruebas/interaccion.cjs` ya no recorta `juego.js`. Léxico, huecos y operaciones JS en `shared/editor/javascript.js`; catálogo de atajos en `js/paleta.js`; Add/Replace en `js/programas.js`. El juego y las pruebas cargan los mismos módulos de producción. Expectativas de las 123 comprobaciones conservadas literalmente; solo cambió el arnés. Estructura se resuelve al operar, respetando su carga actual posterior a juego.js. Sin cambios de CSS; juego29 y módulos nuevos v1.
- Verificación actual: 123 lógica; nuevo `editor-contrato.cjs` correcto (carga sin DOM/juego/almacenamiento, aislamiento de puertos/paletas, UTF-16, estructura diferida y confirmaciones asíncronas ante cambio de reto/ejecución, cancelación y error); D1/D2 e integridad de dependencias correctos; reglas Factory correctas; sintaxis, expectativas y diff correctos; paquete con 8 páginas y 50 referencias locales.
- `shared/editor/REFERENCIA-E0.json` registra cifras históricas: War 90, editor 18, vistas 31, paridad 28/28 y API 7. **No se han vuelto a ejecutar estas suites ni comparado capturas.** Intento Chromium headless con perfil temporal: `setsockopt: Operation not permitted`; no se solicitó otra espera de permisos. La compuerta de navegador/QA visual de E0 permanece pendiente; el usuario revisará manualmente esta entrega y D1/D2.
- Siguiente etapa: E1, instancia de editor con marcado propio, adaptador JS completo, preferencias inyectadas y destruir; después E2 con dos interfaces independientes. Esta entrega prepara la separación y conserva las fachadas actuales; no implementa todavía la extracción completa ni edición/ejecución Python.

## Editor · decisiones D1/D2 y dependencias locales · 3 de noviembre de 2026

- Plan subido primero a `trunk` en `b11039e`, incorporando la condición del usuario de no usar CDN. D1/D2 son las decisiones sobre nombres y await, distintas de las etapas E1/E2.
- Nuevo proveedor declarativo del juego: nombres principales, formas Python, alias españoles, firmas, esperas, vocabulario y tabla de resolución para el futuro traductor. `cmg.funciones()` conserva la fachada y `cmg.proveedor` expone el proveedor. El editor recibe los nombres como datos. El generador inicial de llamadas escribe los nombres Python y await explícito; documentados async def y await superior al estilo del REPL de asyncio.
- Acorn 8.11.3, Three r128 y GLTFLoader r128 se sirven desde `shared/vendor/`, con licencias y manifiesto SHA-256. Eliminadas las cargas de fuentes externas del juego y probador: se usan alternativas locales del dispositivo, con posible variación de métricas. Versiones juego28 y factory-3d2.
- Verificación actual: 123 comprobaciones de lógica, reglas Factory, contrato D1/D2 e integridad/versiones de dependencias, sintaxis de scripts modificados, paquete con 8 páginas y 47 referencias locales correctas. No se ejecutaron las suites de navegador ni QA visual: el entorno denegó abrir el servidor de prueba en 8771. No se afirma equivalencia visual ni QA en dispositivos físicos.
- Alcance: contrato inicial de D1/D2; Python todavía no se edita ni ejecuta. La extracción del editor, demo y traductor siguen pendientes de las etapas E0–E5. La tabla de alias deberá usarse tras resolver ámbitos para conservar funciones locales como count. Detalles en `docs/EDITOR-D1-D2.md`.

## Factory en 3D con el transporte T1 · 3 de noviembre de 2026

- Factory tiene vista 3D (por defecto; plano disponible y elección recordada en `factory-vista`, separada de la de War). Usa el visor común de `vistas.js`: misma cámara, zoom, selección, etiquetas y centrado. Su contenido está en el nuevo `factory-3d.js`: suelo y cuadrícula sin cordillera, puertas discontinuas, bodegas con cajas por material y stock, y máquinas con tolva hacia la puerta, chimenea, franja del material, cola de entrada, barra de progreso y engranaje que gira al procesar. Zoom de 2,5 a 30 m. El anillo de selección sigue a R1.
- R1 es el transporte T1 de `arte/blender/robots.py`. `arte/blender/exportar_t1.py` lo exporta sin ventana a `modelos/t1.glb` (743 KB; 297 KB con gzip) con tres niveles: **LOD0 11.016**, **LOD1 4.430** y **LOD2 1.018** triángulos. Los tres tienen los mismos pivotes (torreta, hombro, codo, muñeca, dedos y carga), con una malla rígida por pivote y sin esqueleto. En el juego los materiales pasan a Lambert sRGB como el resto del escenario; el turquesa toma el color de la función (`--rol-utilitaria`) y la caja se tiñe del material que lleva.
- El nivel se elige por **tamaño del robot en pantalla** (110 px y 45 px, con un margen del 12 % para que no parpadee), no por distancia: el teléfono baja de nivel a la misma distancia aparente que el PC. Pose: rumbo según el desplazamiento; al recoger o entregar, la torreta gira hacia el edificio y el brazo lo alcanza con cinemática inversa de dos tramos, con la pinza hacia el suelo. En los traslados, plegado con o sin caja. Todo se suaviza en tiempo real, así que a 4× el gesto sigue viéndose.
- Dependencia aprobada por el usuario: GLTFLoader r128 (jsdelivr `three@0.128.0`), que `factory-3d.js` inyecta solo al abrir el 3D de Factory; War no lo descarga. Si no carga, R1 se dibuja como un bloque. `factory.js` añade a la orden en curso `verbo` y `lugar`, que solo lee el dibujo: ninguna regla cambia.
- Versiones: `factory-retos.js?v=6`, `factory.js?v=4`, `vistas.js?v=2`, `factory-3d.js?v=1`, `juego.js?v=27`, `modelos/t1.glb?v=1`.
- **Verificación actual** (Ego Browser, 8771, caché desactivada): nueva `pruebas/factory-3d.mjs` **10** (abre en 3D, pivotes en los tres LOD, triángulos decrecientes, LOD0 al acercar y LOD2 al alejar, un solo nivel visible, IK, caja visible al recoger y ausente tras entregar, victoria en 8,7 s igual que en plano, vista recordada por serie). Paridad **28/28**, vistas **31**, editor **18**, API **7**, reglas, **123** lógica, **90 War**, entrada **8**, paquete **8 páginas/43 referencias** con `modelos/t1.glb`. Capturas revisadas en [docs/qa/factory-3d-2026-11-03](docs/qa/factory-3d-2026-11-03/): vista general, alcance, transporte con caja y teléfono a 390 × 844.
- **Límites:** emulación de Chromium; no se midió el rendimiento en un teléfono real. Ajustes visuales pendientes: la pinza queda algo por encima de las cajas al recoger, los edificios son primitivas provisionales y las ruedas no giran (están dentro de la malla rígida del chasis). Pendiente la charla técnica sobre primitivas frente a GLB y piezas rígidas frente a esqueleto.

## Unificación · etapas 4 y 5: resto de Factory y retirada del original · 3 de noviembre de 2026

- **Etapa 4.** Seis retos y «Tu reto» (editor de enunciado, metas y mapa en `factory-form.js`) en `?serie=factory`; bloques, seudocódigo y JS sobre el texto JS como fuente, con `ladrillos` por reto; récord por tiempo (`comun-v1`) y telemetría local. Lección de «Hasta vaciar»: `count` lee al instante y no necesita `await` (cierra 3.7 en Factory; War ya lo explica en «Primer blanco»). Móvil: los ladrillos de la paleta son solo icono (nombre en `aria-label`); antes la etiqueta asomaba junto al último botón, muy visible con los tres ladrillos de Factory y también presente en War.
- **Etapa 5.** `Prototypes/Tres vistas/index.html`, su `probar.html` y `Prototypes/02_tres_vistas.html` redirigen a `Rocket Launcher/?serie=factory` (o a su probador) conservando query y hash. La portada apunta Factory a la nueva entrada; desaparece con el original la franja «War es la versión más actualizada». Borrados `Prototypes/Tres vistas/css`, `js`, `pruebas/tres-vistas.mjs` y `pruebas/factory-editor.mjs`: quedan en el historial (`b76411b`). `factory-oraculo.mjs` y su documentación indican que regenerar el oráculo exige un checkout de ese commit. `server.ps1` ya no exige el original.
- Versiones: `layout.css?v=18`, `factory-retos.js?v=5`.
- **Verificación actual** (Ego Browser, 8771, caché desactivada): oráculo común **28/28** (13 deltas aprobados, 15 exactos); vistas comunes **31** (seis soluciones con el mismo tiempo en bloques, seudocódigo y JS, ida y vuelta de los iniciales, importación de árbol y texto desde `cmg-banco02`, Tu reto); editor común **18**; API **7**; `factory-reglas.cjs` correcto; **123 lógica**; **90 War** a la primera. Récord tipado y telemetría local comprobados en los seis retos. Paquete: `preparar-netlify` y `publicacion.mjs` (**8 páginas, 42 referencias**); `entrada.mjs` **8** sobre `dist/`. Enlaces antiguos con `?forma=` y hash llegan a la nueva entrada y al reto guardado en `cmg-banco02:reto`. Capturas revisadas a 1400 × 900 y 390 × 844 ([móvil](docs/qa/unificacion-2026-11-03/etapa4-movil.png)). `node --check` y `git diff --check` correctos.
- **Límites:** emulación de Chromium, sin dispositivos físicos. En móvil, `pickUp` y `deliver` comparten casi el mismo icono. `pruebas/telemetria.mjs` sigue sin poder ejecutarse en este checkout (falta `@netlify/blobs`); Factory no envía telemetría remota. El plan de unificación queda cerrado; Campaign y el primer reto mixto se planificarán aparte.

## Unificación · etapas 3.4–3.7: API y reglamento · 3 de noviembre de 2026

- `yo.` opcional, edificios como variables reutilizables y API `pickUp/deliver/wait/count`; alias españoles conservados. Inspector, sugerencias y paleta enseñan la API principal. Nuevo `docs/REGLAMENTO.md` explica encargos, modos, lecturas, tiempo, metas, resultados y compatibilidad.
- Verificación actual: 8 casos comunes correctos (deltas de victoria/null explícitos), 6 casos de API en navegador, todos ganan en 8,7 s; 123 comprobaciones de lógica. Una función local llamada `count` conserva su significado. Sintaxis correcta. Versiones juego23, runtime2, factory3, factory-retos3.

## Unificación · etapa 3.3: lecturas null/0 · 3 de noviembre de 2026

- `cuantos` devuelve `null` para lugar inexistente y `0` para un material ausente en un edificio existente. Material inválido sigue siendo error. `await` en lecturas sigue aceptado.
- Verificación: pruebas puras de ambos valores y validación de encargos; expectativa del caso histórico `lugar-inexistente` actualizada explícitamente en el arnés común (ahora termina incompleto tras leer `null`).

## Unificación · etapa 3.2: entregas rechazadas · 3 de noviembre de 2026

- Destino lleno devuelve `lleno`; material incompatible devuelve `rechazado`. Ambos conservan carga y procedencia, cuentan rechazos y no crean derrames. Retos y límites pasan a «Sin entregas rechazadas»; `maxDerrames` antiguo se importa como `maxRechazos`.
- Verificación actual: `node pruebas/factory-reglas.cjs`, encargos con paso fijo, devolución a bodega, conservación, rechazo por material y límite. Récords bajo `comun-v1`, separados de reglas anteriores.

## Unificación · etapa 3.1: victoria por metas · 3 de noviembre de 2026

- Factory gana al alcanzar las metas del mundo, incluso con código pendiente. Récords separados con regla `metas-v1`.
- Verificación: 8 casos en el runtime común; el bucle continuo ahora coincide con la solución finita (8,7 s). Los otros siete conservan la referencia histórica. Fixture original intacto; delta explícito en el arnés común.

# Code-battle-lite · progreso

## Unificación · etapa 2 completada · 3 de noviembre de 2026

- Trasladados combate y constantes a `war.js`, datos/normalización a `war-retos.js`, Worker y despertar de programas a `runtime.js`, paso fijo compartido a `nucleo.js`, y visores 3D/plano a `vistas.js`. `juego.js` conserva coordinación, editor e interfaz y pasa de ~3.400 a ~2.350 líneas. Los visores reciben estado y colaboradores explícitos; las familias usan el mismo ciclo y runtime. Sin nuevas reglas en este traslado.
- Versiones: `juego.js?v=21`; cinco módulos nuevos `?v=1`. El empaquetador ya copia la carpeta completa del juego: no necesita otra excepción en la lista permitida.
- Verificación actual: **123 lógica, 90 navegador War, 8 casos exactos de paridad Factory, 43 Tres vistas y 23 editor Factory**. War pasó en la repetición tras el fallo conocido de doble toque emulado. **8 páginas/53 referencias locales** del paquete estático verificadas; sintaxis y diff correctos. La prueba adicional `pruebas/telemetria.mjs` no arrancó: este checkout no tiene instalado `@netlify/blobs`; la función remota no fue modificada. No se instalaron dependencias.
- Usuario confirmó para etapas 3/4: **JS como fuente; «Sin entregas rechazadas»; `pickUp`, `deliver`, `wait`, `count` y alias españoles; `null` para lugar inexistente; `await` en lecturas aceptado sin aviso; telemetría Factory local; mantener la ruta de War**. Estas decisiones se implementan después de este traslado.

## Unificación · etapa 1 completada · 3 de noviembre de 2026

- «Primer viaje» disponible dentro de War mediante `Prototypes/Rocket Launcher/?serie=factory`, también desde el selector de series en la hoja de retos. Misma interfaz, editor, inspector, ficha de metas, selección y pantalla completa. La portada y Factory original siguen intactos.
- Nuevos módulos `factory-retos.js`, `factory.js` y `factory-vista.js`: datos y reglas de logística trasladados del original, con mapa 9×7 por reto y dibujo plano. R1 es una máquina programable propia; no se incluye en la colección de lanzadores. El Web Worker y ciclo de War reciben encargos, resultados e instantáneas; las lecturas no avanzan el reloj. Se conserva el fin por programa, derrame, mensajes y límites de la fase de paridad.
- Importación de solo lectura de `cmg-banco02:prog-0`; copia independiente en `cmg-banco03:prog-factory-0`, selección `factory-reto`, telemetría local separada y récord tipado de tiempo con regla `paridad`. Sin envío remoto de la nueva serie.
- Versiones: `juego.js?v=20`, `seudo.js?v=4`, `remota.js?v=2`, módulos nuevos `?v=1`. JS de Factory en esta etapa; bloques/seudocódigo y resto de retos se incorporan después.
- Verificación actual: **8 casos de Primer viaje idénticos al oráculo** con Worker real (incluidos eventos, tiempos exactos, errores y líneas); comprobado que no escribe en banco 02. **123 lógica y 90 navegador War correctas**, sin modificar suites; primer intento War falló en el doble toque emulado ya conocido y el segundo pasó completo. Sintaxis y diff correctos. Capturas revisadas a [1400×900](docs/qa/unificacion-2026-11-03/etapa1-pc.png) y [390×844](docs/qa/unificacion-2026-11-03/etapa1-movil.png). Emulación de Chromium; no dispositivos físicos.
- Continúa la etapa 2: separación de responsabilidades conservando las reglas. Pendientes las decisiones de etapas 3/4 planteadas al usuario. Sin commits ni publicación.

## Unificación · etapa 0 completada · 3 de noviembre de 2026

- Inicio solicitado por el usuario. Leídos el plan revisado, la visión, el progreso y los dos análisis. `git fetch --prune origin`: `auto-testing-ui` (rama de trabajo) y `trunk` coinciden con sus remotos en `b76411b`; `main` y su rama Claude están 4 commits detrás, y la rama del plan VFX 14 detrás, sin commits exclusivos pendientes. No hizo falta pull ni fusión. Conservados los cambios locales previos del plan, este progreso y `docs/Vision/`.
- `AGENTS.md` y `CLAUDE.md` fijan War como base de la unificación y Factory original como referencia congelada; solo recibe arreglos que impidan usarlo. README y plan enlazan el oráculo y distinguen esta preparación de la etapa 1 jugable, aún pendiente.
- Nuevo [oráculo de Factory](pruebas/factory-oraculo.md): `pruebas/factory-oraculo.mjs` ejecuta programas en el navegador y los Web Workers originales mediante `window.__banco`/`window.cmg`, sin extraer ni duplicar la simulación. El [fixture JSON](pruebas/factory-oraculo.json) identifica el commit completo `b76411b31a020dbf8a3b5039f82f03c37017b25e` y SHA-256 de la fuente.
- **28 casos y 56 ejecuciones**: inicial y victoria de cada uno de los seis retos y un reto propio explícito; los cinco stocks de «Hasta vaciar»; derrame con/sin límite, viaje vacío permitido/prohibido, falta de `await`, vigía, bucle que cumple metas pero no termina, límite de sensores, lugar inexistente y material rechazado. Guarda fin, motivo, mensaje/línea, tiempo sin redondear, intento, stock, metas, carga/posición, resultados y eventos. Marcados todos los casos que derraman (incluidos iniciales) y el bucle continuo para los cambios de etapa 3.
- **Verificación actual**: las dos pasadas completas en Ego Browser, origen **8771**, coincidieron exactamente en todos los campos. Velocidad oficial 4× y paso fijo sin sustituciones del reloj. `node pruebas/interaccion.cjs`: **123 correctas**. War: **90 comprobaciones correctas** en la segunda ejecución; la primera falló en la 18, doble toque emulado, intermitencia ya registrada antes de esta etapa. Suite sin editar. `node --check pruebas/factory-oraculo.mjs`, identidad de la fuente/fixture, identificadores únicos, marcas de etapa 3 y `git diff --check` correctos.
- El arnés solo admite localhost/127.0.0.1:8771 y restaura las claves de Factory al acabar, incluso ante errores controlados. No sobrescribe un fixture existente. Las suites de interacción de Factory (43/23) no se repitieron en esta etapa: aquí se ejecutó el oráculo nuevo de reglas/runtime. No cambia ningún CSS/JS del producto, así que no hay versiones `?v=` ni lista de publicación que actualizar.
- **Límites y siguiente paso**: etapa 1, «Primer viaje» dentro de War, todavía sin implementar; el oráculo no demuestra paridad de una versión migrada. La prueba de War usó ratón y tacto/teclado emulados, no dispositivos físicos. Campaign, decisiones de etapa 3 y retirada del original siguen fuera de esta entrega. Sin commits, push ni publicación.

## Plan de unificación revisado y visión de Campaign · 3 de noviembre de 2026

- [Plan de unificación](docs/PLAN-UNIFICACION.md) reescrito con el feedback del autor del 2 de noviembre. Queda acotado a Factory + War: nueva tabla de decisiones del autor y lista de cambios respecto al plan anterior. Etapa 3: reglas ya aprobadas, aplicadas una a una después de la paridad con el oráculo (victoria por metas del mundo, carga que se queda en el robot ante destino lleno, `null` frente a `0`, `yo.` opcional, máquinas como variables, API en inglés con alias). Salen del plan el primer reto mixto y Campaign. Pendiente nuevo: qué hacer con el reto «Sin derrames».
- Nueva carpeta [`docs/Vision/2026-11-03/`](docs/Vision/2026-11-03/VISION-CAMPANA.md) (markdown y [HTML](docs/Vision/2026-11-03/vision-campana.html)): principio central, narrativa, escala, armas y sensores, Control Maestro, bandas y túneles, producción adaptable, matriz de decisiones y una ruta de pruebas propuesta (no decidida) hacia Campaign. Nada de esto se implementa todavía.
- Solo documentación. HTML revisado en el navegador a 1024 y 390 px (sin desbordamiento horizontal; el filtro de la matriz funciona).

## Plan de unificación Factory + War · 2 de noviembre de 2026

- Nuevo [plan para el agente ejecutor](docs/PLAN-UNIFICACION.md): llevar Factory a la base de War por etapas, como catálogo de máquinas en un mismo mundo (no como modo aparte), con el runtime de War para todos (un encargo es una espera que decide la simulación) y el Factory original congelado como oráculo hasta la paridad. Incluye estado de partida comparado, arquitectura objetivo, invariantes, ocho etapas (0–7) con criterio de hecho, decisiones pendientes del usuario y riesgos.
- Solo documentación: reglas, APIs, editor y guardados sin cambios. No se ejecutaron pruebas; los datos del documento se comprobaron leyendo el código actual.

## `??` y operadores ajustados a la estructura, «Apuntar» en un hueco y EJECUTAR flotante · 2 de noviembre de 2026

- Bugs del vídeo de QA (War): el atajo «Si no hay (??)» y sus variantes (`&&`, `||`, `!`, comparaciones) usaban el texto elegido tal cual. Ahora el operando se ajusta con `ESTRUCTURA`. Una sentencia o declaración aporta su expresión (`const pos = X;` → `X ?? /* valor */;`, también eligiendo `pos` o la línea entera). El nombre de una función o el objeto de `a.b` arrastran la llamada entera. Sin selección se usa la expresión que acaba en el cursor (tras el `;`, la de esa sentencia). Sin nada que tomar se escriben dos huecos. Lo que no es una expresión (un `while`…) avisa y no cambia el código. Se añaden paréntesis cuando hacen falta: `(a || b) ?? x`, `(a ?? b) && x`.
- Con un hueco elegido, una plantilla `const x = valor;` («Apuntar», «Sensor de vibración») rellena el hueco con su valor y elige su primer hueco. Antes abría otra línea con un segundo `const pos`.
- No se restringen por tipo las sugerencias de «Valor»: decisión de diseño, se prefieren muchas opciones mientras la mecánica cambie.
- Pantalla completa: con las herramientas plegadas (`.cabecera-editor.plegada`), un botón **▶ EJECUTAR** (`#b-ejecutar-flot`) flota abajo a la izquierda del código. Hace lo mismo que el de la barra (ejecuta y pasa al mapa; DETENER mientras corre) y se oculta con el teclado del teléfono abierto.
- Versiones: `juego.js?v=19`, `componentes.css?v=18`, `layout.css?v=16`.
- Verificación: `node pruebas/interaccion.cjs` (**123 comprobaciones**, 27 nuevas de operadores y hueco). Navegador integrado en **8771**: `??` tras el `;` y con `autoTarget` elegido, y «Apuntar» en el hueco, con los botones reales de la paleta. Tableta emulada 768×1024 en pantalla completa: el botón aparece al plegar, ejecuta, pasa al mapa, alterna DETENER y se oculta al desplegar; consola sin errores. No se ejecutó `pruebas/navegador.mjs` (Ego Browser), ni tacto real.

## Análisis jugable de Factory + War para Campaign · 1 de noviembre de 2026

- Nuevo [HTML ilustrado de reglas para la campaña](docs/analisis/factory-war-reglas-campana.html), autónomo y sin recursos de red. El centro es jugable: autonomía, encargos frente a modos persistentes, seguimiento frente a coordenadas, bloqueos, suministro y metas. JavaScript y la hipótesis sobre el diseño de las demos quedan en un apartado breve. Cuatro situaciones permiten comparar la regla actual y la recomendación.
- Recomendaciones por validar: seguimiento de entidades mediante una orden nueva (conservar el significado actual de `regularShoot`), mantener la carga ante una entrada llena, conectar producción y munición, programas por unidad y victoria por metas del mundo aun con bucles activos. Se explican sus costes educativos y los sistemas que aún faltan. No son decisiones aprobadas ni implementaciones de Campaign; reglas, APIs, editor y guardados del juego sin cambios.
- Verificación de esta entrega: `node pruebas/interaccion.cjs` (**96 comprobaciones**), `node --check` del script extraído del HTML, 30 identificadores únicos, 11 enlaces locales válidos y ausencia de recursos externos. Ego Browser en **8771**: cuatro situaciones actualizan texto e ilustración; sin desbordamiento de página a 1440, 768, 390 y 320 px en claro/oscuro. Capturas de PC y móvil emulado revisadas visualmente; no prueba de balance de las reglas propuestas.
- Límite de interacción: el selector se verificó con `selectOption`; no se confirmó su cambio con flechas/Home sintéticos de Ego. Pendiente teclado físico y tacto real. Documento local, sin publicación ni commits.

## Fusión de `main` en `trunk` · 1 de noviembre de 2026

- `trunk` (Desenvolver, inspector cerrado, hoja móvil) y `main` (pantalla completa, panel inferior, información del reto, telemetría, VFX) habían divergido: el enlace de githack a `trunk` no tenía las 9 commits de `main`. Fusionado `origin/main` en `auto-testing-ui`; conflictos solo en `?v=` y en este archivo. Versiones: `juego.js?v=18`, `edicion.js?v=17`, `estructura.js?v=3`, `seudo.js?v=3`.
- Verificación: 96 lógica, 90 navegador War (dos veces seguidas), 43 Tres vistas, 23 editor Factory. La comprobación «un botón justo después de un toque…» falló una vez en la fusión y también en un `main` limpio: es intermitente por tiempos.

## Desenvolver e inspector cerrado por defecto · 1 de noviembre de 2026

- **Desenvolver** (P3 de la tanda de 20 ciclos): botón nuevo de la barra de edición, al final del grupo de líneas. Quita el `if`/`while`/`for`/`do` más cercano que contiene lo elegido y deja su contenido elegido, un nivel menos sangrado; Deshacer lo devuelve. Un `else` (o `else if`) que solo tiene plantilla se descarta; si tiene código, no cambia nada y avisa. En seudocódigo avisa de que está en JavaScript. Lógica en `shared/js/estructura.js` (`ESTRUCTURA.desenvolver`), botón en `shared/js/edicion.js`. Un orden de barra guardado recibe el botón en un grupo nuevo al final (Ajustes lo recoloca).
- **Inspector cerrado por defecto**: causa, `abrirPrograma()` llamaba a `seleccionar(id)` y en el teléfono (ficha «completo») eso desplegaba la ficha al cargar el reto, al cambiar de pestaña de programa, al restaurar y al saltar a un error. Ahora abrir un programa, y la corrección de selección cuando desaparece una unidad, cambian de unidad conservando el estado del inspector (`inspeccionar: "conservar"`). Elegir en el campo, en los chips o en un enlace sigue abriéndolo.
- Versiones: `juego.js?v=14` (Rocket), `edicion.js?v=16`, `estructura.js?v=3`, `seudo.js?v=3`; `pruebas/war-20-ciclos.mjs` exige las nuevas.
- Verificación: **96 lógica** (9 de Desenvolver), **73 navegador War** dos veces seguidas (nuevas: Desenvolver + Deshacer, inspector cerrado al cargar y tras abrir programa, abierto al elegir), **43 Tres vistas**, **23 editor Factory**. La comprobación 18 («doble toque selecciona el mismo tipo visible») falló 2 de 6 ejecuciones y pasó al repetir: intermitente por tiempos del doble toque sintético, previa a estos cambios. Móvil emulado, no tacto real.

## Corrección WAR-20-UI-01 (hoja móvil sobre el asa de línea) · 1 de noviembre de 2026

- `shared/js/edicion.js` (v15): cuando la lista de sugerencias pasa a hoja inferior, primero desplaza la vista de bloques para subir lo elegido (como mucho hasta su borde superior) y vuelve a colocarla; si aún hace falta hoja, esta deja libre la columna de asas (números a la izquierda o borde derecho). Un toque en el número elige la línea con la lista abierta, sin cerrarla antes.
- Hallado al reproducirlo con toque emulado: la hoja podía abrirse bajo el dedo y el clic de ese mismo toque elegía la opción de debajo (`missiles`). Ahora un clic en la lista solo cuenta si la pulsación empezó en ella (o viene del teclado).
- Verificación: **87 lógica, 68 navegador War** (2 nuevas: hoja sin tapar números y toque en el número elige la línea; fallan con el `edicion.js` anterior), **43 Tres vistas, 23 editor Factory**. Comprobado además a mano en 393×660 y 393×600. Móvil emulado con CDP, no tacto real. `pruebas/war-20-ciclos.mjs` exige ahora `edicion.js?v=15`.
- Desenvolver (P3) se implementó después: ver la entrada de arriba.

## Verificación posterior y 20 ciclos aleatorios · 30 de octubre de 2026

- Tanda válida con build actual y caché desactivada: **20/20 recuperaciones exactas**, 10 PC y 10 móvil emulado, 12 en nivel 4, fixtures R1–R5 y semilla `war-postfix-20-20261030-v1`. Tres recuperaciones con Borrar, dos terminando con borrado por línea y quince con Deshacer de la perturbación; 56 clics dentro del área y dos cierres de sugerencias fuera. Son pruebas de edición, no veinte partidas ni búsqueda de estrategia ganadora.
- **87 comprobaciones de lógica y 66 de navegador War correctas**. Vídeos nuevos de SEL-01: 0/2 rápidos envuelven el while anterior (68/65 ms), controles pausados iguales y recuperación exacta. Tres MP4 decodificados completos y revisados por fotogramas.
- Fricción **WAR-20-UI-01**: hoja móvil sobre el asa de línea (ciclo 14); un clic en el punto del número elige `missiles`. Vídeo dirigido confirma el efecto; cerrar lista → elegir línea → Borrar recupera el texto. No se confirma pérdida de datos ni se reabre ED-04. Carencia de desenvolver conserva interés; el ensayo local fue acotado y no agota alternativas manuales.
- La primera tanda mezcló HTML actual en PC y antiguo en móvil por caché. Se conserva aparte y se excluye; se repitieron los veinte con verificación de versiones por intento. [Reporte, trazas, capturas, diagrama y vídeos](docs/qa/war-20-ciclos-2026-10-30/REPORTE.md). Recursos del producto sin cambios; adaptadores de QA nuevos y grabador con carpeta configurable. Sin commits/publicación, ratón y móvil emulado, tokens sin medir.

## Aviso en Factory: War es la versión vigente · 31 de octubre de 2026

- Factory (`Prototypes/Tres vistas/`) muestra una franja fija arriba: «War es la versión más actualizada del juego», con el botón «Ir a War» y ×, que lo oculta durante la sesión. La app baja 36 px para que no tape nada. La franja se oculta con el teclado de código abierto y en pantallas estrechas usa un texto corto. `componentes.css?v=6`.
- Verificación: Tres vistas 43 OK y editor Factory 23 OK. La primera versión, flotante abajo, tapaba controles y rompía la suite; se cambió por la franja. Revisado en PC 1400 y teléfono 390.

## Telemetría mínima para la prueba con compañeros · 31 de octubre de 2026

- War envía eventos `entrada`, `reto` e `intento` (resultado, motivo, línea y código de cada lanzador, incluidos los errores de sintaxis al pulsar EJECUTAR) a `/api/t`. La función de Netlify `netlify/functions/t.mjs` los guarda en Netlify Blobs. Se leen con la clave `TELEMETRIA_CLAVE` como JSON, CSV o un resumen por persona y reto. Detalle en `docs/TELEMETRIA.md`.
- `juego.js` solo emite `CustomEvent` (`cmg:intento`, `cmg:reto`); el envío está en `js/remota.js` (`sendBeacon`). Hay un id anónimo por navegador, `?quien=` opcional para etiquetar enlaces, y un ajuste o `?telemetria=0` para desactivarlo. No envía nada en local, en githack ni en la red local.
- Nuevo `package.json` con la única dependencia `@netlify/blobs@^8.2.0`, que es solo para la función; el juego sigue sin compilación. `netlify.toml` declara `netlify/functions`.
- Versiones: `juego.js?v=17` y `remota.js?v=1`.
- Verificación: `pruebas/telemetria.mjs` (11 OK) y `interaccion.cjs` (87 OK). En el navegador, el envío se probó interceptando `/api/t`: nada en local, la entrada con quien/id/sesión, el intento con error de sintaxis y su código, el intento terminado, el cambio de reto y el ajuste desactivado. War: 82 OK; paquete de Netlify verificado.
- Pendiente: definir `TELEMETRIA_CLAVE` en Netlify y comprobar un evento real tras el despliegue. Conviene avisar a los compañeros de que se guarda su código.

## Información del reto con pestañas (en curso) · 31 de octubre de 2026

- La ficha ⓘ del editor tiene una tira de pestañas deslizable (dedo, rueda, arrastre con ratón) con flechas que avisan de que hay más: **Objetivo**, **Metas** en vivo (verde cumplida, rojo rota), **Enemigos** del reto con miniatura (`img/enemigos/*.png`, capturas del modelo actual con `cmg.retrato(tipo)`), **Pista** escalonada por frases (la primera a petición; cada intento fallido muestra y abre la siguiente; el aviso de fallo muestra la última parte) y **Último intento** (motivo, «Ir a la línea» en errores, economía mínima). Paleta, barra de edición y pestañas se deslizan 36 px más allá del último botón.
- Versiones: `juego.js?v=16`, `layout.js?v=12`, `componentes.css?v=17`.
- Verificación parcial: 87 de lógica; capturas en PC (metas en vivo hasta la victoria) y teléfono 390 × 844.
- Pendiente: progreso de derribos necesarios para que las metas se pongan en verde durante el intento; en el teléfono emulado del navegador de pruebas un programa con `await` termina por el vigía a t = 0 (sin comprobar si ya pasaba antes); posible solape de CBL con el número del reto en PC durante un intento; comprobaciones de navegador de las pestañas.

## Cámara giratoria, campo girado, terreno con montañas y objetivo desde el código · 31 de octubre de 2026

- **Girar con dos dedos** (War, todas las formas, vista 3D): además de pellizcar y desplazar, girar dos dedos gira el escenario alrededor del punto entre ellos. Un umbral de ~7° evita girar sin querer al pellizcar. La pista del inspector lo menciona.
- **Campo girado 90° en pantalla completa** (War): con el modo activo y la pantalla en vertical, la cámara pasa a una vista girada con la base abajo y los enemigos llegando desde arriba, encuadrada para que el ancho del campo llene la pantalla. Al girar el teléfono a horizontal vuelve la vista normal. Se desactiva en Ajustes («Con la pantalla en vertical, girar el campo 90°», preferencia `cmg-juego-pantalla-girar`, activa por defecto). Hay una cámara por postura (horizontal, vertical y vertical girada): cada una recuerda durante la sesión dónde la dejó el jugador; ⌖ la devuelve a su encuadre inicial. Se interpretó «vertical» como la postura en la que el giro aprovecha la pantalla, según el ejemplo enviado por el usuario.
- **Terreno «infinito» y montañas** (War, todas las formas): el suelo y su cuadrícula siguen más allá del campo de 32 × 18 (algo más oscuros) hasta perderse en una bruma de horizonte que no toca el campo; el reto con niebla conserva su niebla. Detrás del borde norte hay una cordillera de columnas de 1 m de lado y terrazas de 1 m (picos fijos + ruido suave sin `Math.random`, una sola `InstancedMesh`, sin colisión ni efecto en la simulación), con cumbres claras. La cámara horizontal inicial se inclinó un poco (1,02 → 0,93 rad) y mira 1,3 m más al norte para dejar ver las laderas; orbitando se ve la cordillera entera. El plano 2D prolonga la cuadrícula, tenue, hasta los bordes. El desplazamiento de cámara admite 4 m más allá del campo.
- **Botón del mapa** (War, pantalla completa): ya no está abajo en el editor; flota bajo el botón de pantalla completa con su mismo estilo, algo menos brillante. La paleta se acorta para no quedar debajo.
- **Botón de información** (War, todas las formas): en el sitio del antiguo botón del mapa, abajo a la derecha del editor, abre una ficha con el reto, su objetivo y la lección (lo mismo que `section.objetivo` de la hoja del reto). Se cierra con ×, Esc o tocando fuera, y se actualiza al cambiar de reto.
- `window.cmg.camara()` devuelve la postura y el estado de la cámara 3D (para pruebas).
- Versiones: `juego.js?v=15`, `layout.js?v=11`, `componentes.css?v=16`, `layout.css?v=15`.
- Verificación actual en 8771 (Chromium/Playwright con el adaptador de Ego y CDP para tacto real de dos dedos): **87 de lógica** y **82 de War** (8 nuevas: campo girado en vertical, giro con dos dedos en su sentido, umbral, ajuste, memoria por cámara, botón del mapa bajo el de pantalla completa, botón de información), todas correctas salvo ED-04 («la lista de sugerencias cabe con dos opciones a la vista»), que falla igual sin estos cambios solo con el cambio de viewport del adaptador; paquete de Netlify verificado. Capturas revisadas en PC 1400, teléfono 390 × 844 y 844 × 390, y tableta 768 × 1024.
- Límites: tacto emulado por CDP; falta QA real del giro con dos dedos en Android/iPhone y del cambio de cámara al girar el dispositivo. Desde la cámara inicial se ven las laderas, no las cumbres. Factory sin cambios.

## Pantalla completa, alternativas sin teclado y panel inferior · 31 de octubre de 2026

- **Atajo Ctrl+Alt+A** (ambos juegos, `shared/js/edicion.js`): activa o desactiva el modo sin teclado desde cualquier parte; no actúa con un diálogo abierto ni en seudocódigo. El tooltip del botón lo muestra.
- **Menú de alternativas sin teclado** (ambos juegos): clic derecho sobre un elemento, o con el dedo mantener 2 s sin arrastrar (el primer segundo no pasa nada; el segundo se llena un anillo). Sobre una función: todas las funciones disponibles (`cmg.funciones()`, nuevo en ambos `juego.js`), conservando los argumentos cuyo nombre de parámetro coincide y añadiendo/quitando `await`. Sobre un operador: los de su familia (comparar, combinar, calcular, asignar). Sobre `const`/`let`, `true`/`false`/`null`, variables, propiedades, textos y números: lo que encaja en su sitio (argumento, condición, comparación) más los de su tipo. En un hueco vacío de `( )` sus valores, y en una línea vacía dentro de `{ }` las órdenes como sentencias. Usa la misma lista de sugerencias (teclado ↑↓/Intro/Esc).
- **Tooltip de la paleta** (ambos juegos): queda debajo de la paleta y del menú de variantes, y se recoloca si el menú se abre o se cierra; su capa queda por debajo de `.variantes`.
- **Modo pantalla completa** (War): botón semitransparente de cuatro esquinas solo en teléfono/tableta (forma móvil, ≤ 1100 px, o puntero táctil ≤ 1400 px), en la esquina superior derecha de la app: junto a Ajustes si ahí está el mapa, o flotando bajo ▴ si está el código. Se activa y desactiva manteniéndolo 2 s (círculo grande que se llena); un toque corto solo avisa. Activo, el icono brilla en blanco, aparece «Full screen mode active. More details on settings.» y la batalla pasa a pantalla completa. `</>` junto a Ajustes lleva al código; en el editor, **▶ EJECUTAR** sustituye a las pestañas de programas, corre el código, vuelve a la batalla y cierra el inspector; el botón del mapa abajo a la derecha del editor vuelve sin ejecutar. «Ir a la línea» y «Editar el programa» llevan al código. El divisor sigue funcionando; los botones vuelven a pantalla completa mientras el modo siga activo. Ajustes muestra el estado y abre un diálogo explicativo. Preferencia `cmg-juego-pantalla-completa`; el reparto guardado no se toca.
- **▴ de las herramientas siempre visible** (ambos juegos): queda fijo a la derecha de las pestañas, que se deslizan por debajo (en 1024 px y en el teléfono quedaba fuera).
- **Inspector** (War, todas las formas): cabecera más baja; los signos vitales pasan al final de la ficha abierta (la tira de PC los conserva); las unidades son botones delgados en una fila deslizante.
- **Panel inferior** (War, todas las formas): donde estaba la consola hay una barra arrastrable como el divisor (hasta abajo lo cierra; un toque o ▾/▴ lo cierra o recupera su último alto) con el selector Inspector/Consola. El inspector, por defecto, muestra solo lo que el programa abierto puede usar: funciones, propiedades con valores vivos, variables y constantes del programa y la red de sensores; doble toque inserta y se puede arrastrar. La consola marca con un punto los mensajes nuevos mientras está oculta. En PC empieza abierto (170 px) y en el teléfono cerrado. Preferencias `cmg-juego-pie-*`.
- Verificación actual en 8771 con Chromium/Playwright mediante un adaptador del objeto `page` de Ego Browser (CDP para tacto): **75 de lógica**, **67 de War** (10 nuevas: Ctrl+Alt+A, anillo y menú de funciones por pulsación de 2 s, conservación de argumentos, botón, toque corto, activación, EJECUTAR, salida), **43 de Tres vistas** y **23 del editor Factory**, todas correctas. La comprobación de la consola móvil se adaptó al panel nuevo. Capturas revisadas en PC 1400, tableta 1024 y teléfono 390. Los CDN no eran accesibles: Three.js r128 y Acorn 8.11.3 se sirvieron desde copias locales solo para la prueba.
- Después: «Editar programa» del aviso de fallo también pone el código a pantalla completa. Unidas en `main` las ramas `auto-testing-ui` (incluye `trunk`: arnés de recuperación, QA de War, arte y animación; correcciones ED-01–ED-09) y `claude/inspiring-feynman-9clnvf` (plan de VFX). Conflictos solo en versiones `?v=` (subidas por encima de ambas) y en este archivo.
- Límites: el arrastre de una palabra a `stopFire(` de la suite de War falla de forma intermitente (~1 de 4 en una reproducción aislada) también con el código anterior: depende del tiempo entre dos arrastres seguidos y no es una regresión. Tacto emulado; falta QA real de los 2 s en Android/iPhone (menú del sistema, vibración) y del cambio de panel al girar la tableta. El modo pantalla completa no usa la API Fullscreen del navegador: reparte los paneles de la app. Factory no tiene el modo ni el panel inferior nuevo.

## Correcciones del editor sin teclado (ED-01–ED-09) · 30 de octubre de 2026

- Corregidas las nueve incidencias de la regresión del mismo día. Cambios en `shared/js/edicion.js` (selección pendiente, Borrar sin restos, operandos, cursor y colocación de la lista), `shared/js/estructura.js` (contexto de operandos y nivel «línea» en Ampliar), `shared/css/edicion.css` (animación solo de opacidad y hoja inferior compacta) y `Prototypes/Rocket Launcher/js/juego.js` (envolver con 2 espacios y según la categoría de lo elegido; Variable con la misma regla). Tres vistas recibe la sangría de 2 espacios y los módulos compartidos.
- Versiones: `edicion.js?v=14`, `estructura.js?v=2`, `edicion.css?v=3`, `juego.js?v=13` (Rocket) y `juego.js?v=7` (Tres vistas).
- Verificación actual en 8771 con la caché desactivada: **87 comprobaciones de lógica** (12 nuevas; la suite carga ahora `estructura.js`), **66 de navegador de Rocket** (9 nuevas), **43 de Tres vistas** y **23 del editor Factory**, todas correctas. Barrido de Borrar repetido: 0 restos en 143 borrados (antes 24/133); diagnóstico de SEL-01 sin reproducción. Detalle en [el reporte](docs/qa/editor-2026-10-30/REPORTE.md). Móvil emulado, sin tacto real; el piloto aleatorio no se repitió.

## Regresión del editor sin teclado (Rocket Launcher) · 30 de octubre de 2026

- Misión de QA sin correcciones al juego: regresión dirigida de WAR-SEL-01/EDIT-02/VIEW-03, barrido de Borrar sobre todas las fichas de R1–R5 y **primer piloto real R1–R5 × PC/móvil** del ciclo de recuperación (semilla `rocket-piloto-v1`): **10/10 recuperados exactos**, 7 locales y 3 con Deshacer, sin teclado.
- [Reporte con prioridades, causa y propuesta por incidencia](docs/qa/editor-2026-10-30/REPORTE.md). P1: **ED-01** la selección pendiente de 380 ms hace que Borrar rápido vacíe el programa entero; **ED-02** los operandos de `??`/`&&`/`||` se clasifican como condición (`estructura.js:510`) y Borrar los rechaza o deja `/* condición */`. P2: lista de sugerencias que tapa el código y se coloca 80 ms tarde por `@keyframes tip`; lista fuera de pantalla en móvil (`max(90, …)`); envolver con 4 espacios; plantillas que envuelven sin respetar la categoría (`;;`, `);`, `if` en expresiones); 18 % de borrados con restos. P3: cursor tras borrar una línea intermedia y Ampliar sin nivel «línea».
- Verificación actual: **75 comprobaciones de lógica y 57 de navegador correctas**; ninguna cubre estas incidencias. Ego restablece la emulación entre rondas: los intentos 2–5 se cerraron a 1224×670. Móvil emulado con ratón. Tokens no medidos. Sin commits.

## Skill de QA visual · 30 de octubre de 2026

- Creada la skill personal `qa-regresion-visual` en `~/.codex/skills/`, con las capturas, cuatro vídeos, trazas y diagrama de War como assets históricos, más instrucciones reutilizables para recopilación, reproducción y recuperación. Diez ciclos por tanda como valor predeterminado ajustable.
- Retirado de esta entrega el caso descartado por el usuario: menciones, medios, diagnóstico y entradas del manifiesto. Se conservan los casos de selección, borrado y espacio móvil. Recursos y reglas del juego sin cambios.

## Vídeos de reproducción de incidencias de War · 30 de octubre de 2026

- **WAR-SEL-01 reproducido en ambos formatos**: intervalos rápidos de unos 51 y 77 ms hacen operar sobre el `while` anterior; Deshacer recupera el texto exacto y el control con pausa de 450 ms utiliza la ficha nueva. El control evalúa la selección, no que la inserción elegida genere un programa correcto.
- Fricciones filmadas sin reclasificarlas como bugs: restos `??`, `const =` y `;` tras borrar; en móvil plegar herramientas aumenta la altura de fichas de 111,7 a 262 px.
- Grabador externo `pruebas/grabar-regresiones-war.mjs`, mediante CDP `Page.startScreencast` y FFmpeg ya instalado. MP4 H.264 sin audio, tiempos reales de captura y duplicación a 30 fps de salida; no se promete 30 capturas distintas por segundo. HUD de QA solo sobrepuesto, sin cambios en recursos del juego. Preparación con fixtures fuera de la recuperación; solo origen 8771.
- Verificación actual: cuatro MP4 examinados con FFprobe, decodificados íntegramente con FFmpeg y revisados visualmente por fotogramas; script con sintaxis válida, **75 comprobaciones de lógica correctas** y hashes de juego idénticos a los del reporte anterior. Las 57 comprobaciones de navegador citadas el día 29 son históricas y no se repitieron para esta grabación. Ratón y móvil emulado; pendiente tacto real. Sin correcciones del juego, commits, push ni publicación.


## Robots 3D en Blender (exploración de arte) · 29 de octubre de 2026

- `arte/blender/robots.py` genera por código tres robots con la estética «fábrica de juguete» (crema, turquesa «rol», grafito, amarillo y luces emisivas) y las convenciones de Concepto2 (1 m = 1 casilla, mirada a +Y, pivotes con nombre, animación «ciclo» de 2 s). Escena guardada en `arte/blender/robots.blend`; render en `arte/blender/render_familia.png`.
- Transporte T1 con orugas y brazo largo alineado con su torreta, según la referencia. Araña de ocho patas con cara pixel art en «pantalla» (candidata a protagonista de Campaign). Escarabajo explorador de seis patas y cuerpo único: los élitros se abren y despliegan un propulsor a cada lado (`pose_vuelo`). Las patas caminan con cinemática inversa y los pies de apoyo no resbalan.
- Sin integrar en los juegos ni exportar GLB. `dist/` no incluye `arte/`. Sin commits. *(El 3 de noviembre el T1 se integró en Factory: ver la entrada «Factory en 3D».)*

## QA exploratoria de War con inputs aleatorios · 29 de octubre de 2026

- Misión de recopilación, sin corregir recursos del juego: **10 ciclos de edición/recuperación, 6 sobre el nivel 4**, cinco en escritorio y cinco en móvil emulado. Las diez perturbaciones efectivas se recuperaron con texto exacto mediante UI, sin teclado durante los intentos. Se guardan partida, perturbación y final de cada ciclo, selección, coordenadas, tiempos y cadena de botones.
- Hallazgo prioritario **WAR-SEL-01**: un clic dentro de una selección espera 380 ms; un botón pulsado antes puede actuar sobre el bloque anterior. Evidencia clara en 7/10 ciclos y reproducción dirigida rápida 2/2; el control con pausa de 450 ms usa la nueva selección. Deshacer permitió continuar. Queda pendiente corregir y añadir la aserción de regresión cuando cambie la UI; no se ha corregido el juego en esta misión.
- Fricciones: tres reparaciones locales dejaron `??`, `const =` o `;` residual; no son bugs confirmados de Borrar. En móvil, las preferencias con herramientas/inspector desplegados dejan pocas líneas visibles. Las seis ejecuciones del programa inicial del nivel 4 con semilla 17 finalizaron en 33 derribos, 2 brechas y 4 atascos a 49,2 s; no se buscó una estrategia ganadora.
- [Reporte priorizado, evidencia y diagrama secuencial](docs/qa/war-2026-10-29/REPORTE.md), [cadena de inputs por ciclo](docs/qa/war-2026-10-29/LOG-INPUTS.md) y diagnóstico reutilizable `pruebas/war-recuperacion-regresion.mjs`. Arnés externo adaptado a fichas y barra actual; se conservan diferencias temporales entre los primeros tres ciclos y los siguientes. No corresponde a la matriz R1–R5 del piloto original.
- Verificación actual: **75 comprobaciones de lógica y 57 de navegador de War correctas**, sintaxis de arnés/diagnóstico y `git diff --check` correctos. Diagrama Archify: 9/9 comprobaciones, evidencia de navegador y revisión visual de capturas. Solo puerto 8771, Chromium con ratón/móvil emulado; pendiente tacto y teclado reales. Esta misión no hizo commits, push ni publicación.


## Plan de efectos visuales · 29 de octubre de 2026

- Añadido [docs/PLAN-VFX.md](docs/PLAN-VFX.md). Propone efectos procedurales definidos como recetas de datos y partículas sin estado, calculadas en función del tiempo. Un módulo compartido sin dependencias las dibujaría en Three.js r128 (nubes de puntos con un shader propio) y en canvas 2D. La simulación anotaría los sucesos visibles en `mundo.fx`; ninguna regla, instantánea de los programas ni telemetría lee esa lista. Fases: base y laboratorio, combate de War, estado de War, Factory y Ajustes.
- Validación con un prototipo desechable fuera del repositorio: War real en Chromium sin pantalla (WebGL por SwiftShader, Three r128) y tres recetas (disparo, impacto, derribo de dron) comparadas con la explosión actual en hojas de contactos 3D/plano. Bastaron dos iteraciones de ajuste. 60 efectos simultáneos (869 partículas) cuestan 0,7–0,8 ms de CPU por fotograma. Detalle: `mundo.derribados` se anota, pero hoy no se dibuja.
- En esta nube la red del entorno bloquea cdnjs y jsdelivr. Las pruebas sirvieron la misma Three r128 y Acorn 8.11.3 desde el registro npm, interceptando las peticiones sin cambiar el juego.
- Comprobación actual: 75 comprobaciones de lógica correctas (solo cambió documentación).
- Límites: no se modificaron juegos, pruebas, `window.cmg` ni formatos de guardado, y el juego no tiene efectos nuevos. SwiftShader dibuja en la CPU: la fluidez y el coste de GPU se medirán en Android/iPhone reales. Pendiente: aprobación del enfoque y Fase 0.

## Corrección del despliegue de main en Netlify · 29 de octubre de 2026

- Reproducido el 404 de `https://codewar-mageddon.netlify.app/`. Netlify tenía publicado `main@49bd493`, sin `index.html` en la raíz; la portada, recursos compartidos y configuración de publicación seguían sin seguimiento en la carpeta local.
- Incluido en `main` mediante `4175c37` el conjunto estático ya implementado: entrada Factory / War / Campaign (Próximamente), recursos de ambos juegos, `netlify.toml` y generador de `dist/`. El laboratorio de animación y el arnés de recuperación quedaron fuera de esta subida.
- Comprobación actual: 75 pruebas de lógica, sintaxis de scripts, 8 HTML y 41 referencias locales del paquete correctos. Las 131 comprobaciones de navegador pasan en 8771: War (57), Tres vistas (43), editor Factory (23) y entrada (8), incluidos arranque de Factory/War, Campaign, retorno al inicio y anchos móviles emulados. En Netlify se confirmó base `/`, sin comando ni directorio de publicación configurados; el archivo TOML versionado aporta ambos valores.
- Netlify confirmó **Published deploy** para `main@4175c37` (despliegue `6ae338eb20d6be29f4801ccd`). Verificación real en el dominio público: portada disponible, Factory y War arrancan con sus módulos/CDN, Campaign muestra Próximamente y los enlaces permiten regresar al inicio. La suite que modifica programas se ejecutó solo en 8771. Los programas continúan guardándose por origen, y el tacto/teclado real sigue pendiente de QA manual.

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

