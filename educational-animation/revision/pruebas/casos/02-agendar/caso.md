# Caso 02 · Agendar un callback frente a ejecutarlo

**Pregunta para el lector:** ¿qué se imprime primero, «callback» o «fin»?

| Archivo | Programa | Consola |
|---|---|---|
| `a-agendado.js` | `queueMicrotask(() => console.log("callback")); console.log("fin");` | `fin / callback` |
| `b-inmediato.js` | `(() => console.log("callback"))(); console.log("fin");` | `callback / fin` |

Reproducir: `node educational-animation/revision/pruebas/caso.cjs <archivo.js> [--lectura]` (salidas `*.txt`).
Capturas «antes» (traza y lectura, fila 1 y final): fuera del repo, en el informe final de Opus.

## Qué se ve hoy (diff a/b)
Mismas filas y mismas frases salvo el código; solo cambia la consola final.
- Fila 1, lectura: «Ejecuta [queueMicrotask(…)].» frente a «Ejecuta [(() => …)()].». La primera no dice que la función queda pendiente.
- Fila 1, traza: «[…] → «undefined».» en los dos casos. El `undefined` es ruido y no dice nada del orden.
- Ningún paso dice cuándo se imprime «callback»: la narración salta del paso 2 al final, y solo la consola lo delata.

## Evidencia ya encontrada (Opus)
- **Traza perdida.** En `a-agendado`, los eventos del callback (`console.log("callback")`) no llegan a la traza.
  `motor/trazador.js:177-179`: el lote solo se envía en `w()` (await) o en `fin()`. `motor/ejecutar.js` llama a
  `__T.fin()` en el `finally` del cuerpo; el microtask corre después y sus eventos se quedan en el búfer `B`.
  Volcado de eventos: `a-agendado` = 1, 2(queueMicrotask=undefined), 10, 11 (nada del callback); `b-inmediato` =
  1, 4(console.log("callback")), 2, 9, 10.
- **Ya se distingue en el árbol:** `(() => …)()` es una función llamada como callee (el ciclo 01 ya trata ese caso
  como «llamada inmediata»). `queueMicrotask` es un global no redefinido (lo detecta `declaracion()` del ciclo 01).
- En `b-inmediato`, las lecturas internas ya se agrupan con la llamada (`paso.lecturas`, ciclo 01), pero
  `console.log("callback")` no es un identificador y no se narra.

## Variantes cercanas (para la regla y sus contraejemplos)
- `setTimeout(cb, 0)`, `Promise.resolve().then(cb)`, `await null` antes de un `console.log`.
- Contraejemplo: `[1].forEach(cb)` y `[1].map(cb)` ejecutan el callback **ahí mismo**.
- En el juego (War/Factory) el reloj es virtual (`esperar`); ¿qué existe allí de lo anterior?

---

## Registro del ciclo (Opus implementa · Astra diagnostica y ataca, `codex exec`, esfuerzo alto, solo lectura)

| Turno | Quién | Resultado |
|---|---|---|
| Caso | Opus | Par, evidencia (la traza perdía el callback: se vaciaba antes del microtask), capturas «antes». |
| Diagnóstico | Astra (`astra-1.md`) | Volvió a romper el ciclo 01 (`f.push = cb => cb()`). Fallo en dos capas: ejecutor (búfer) y recorrido (sin paso propio para el callback). Regla: **1 agenda → 2 imprime → 1 callback → final**; en lectura, agendar frente a «ahora mismo». |
| Implementación 1 | Opus | Marcador `["luego"]`, `agendada()`, `paso.diferido`, frases, `guardada()` con método sustituido. Opus se atacó a sí mismo con `await` en medio: la frase «después de que termine» era falsa. Se corrigió. |
| Ataque | Astra (`astra-2.md`) | **Rechazo** con 4 fallos: dos ejecuciones se fundían, una llamada directa se narraba como agendada, `setTimeout(…, 30)` cambiaba el resultado ya devuelto y un error en el callback tumbaba el proceso. |
| Implementación 2 | Opus | Temporizadores virtuales con el reloj del programa y un bucle de eventos propio. Cada ejecución va entre `["corre"]` y `["/corre"]`, con sus errores en el informe, y nada sobrevive al resultado. Un paso por ejecución. Un callback durante una espera ya no cierra la espera. |
| Ataque 2 | Astra (`astra-3.md`) | **Rechazo** con 2 fallos: el rechazo de un callback `async` se escapaba, y `const id = setInterval(…)` perdía «agenda». |
| Cierre | Opus + Astra (`astra-4.md`) | Ambos corregidos y con fixtures. **Astra: «aceptar», con los límites documentados.** |

**Respuesta a la pregunta:** la etiqueta de la fila 1 ya dice «Agenda [fn] para después» frente a `(() => …)()`. En lectura: «no se ejecuta ahora y el programa sigue sin esperarla» frente a «Ejecuta [fn] ahora mismo. Escribe "callback"». En traza, el callback tiene su propio paso después de «fin». Imagen: `antes-despues.png`.

**Límites:** el reloj es virtual, sin fidelidad a tiempos mínimos ni al orden entre fuentes de tareas del navegador o Node. Los rechazos de promesas que no son callbacks agendados no se capturan (`Promise.reject` suelto). Los callbacks de `then` no llevan marcas: se ven tras «luego» si corren al final, pero no si corren durante un `await`. En traza, la fila 1 conserva la píldora `undefined`. El juego no cambia: el visor del juego solo lee el código y no ejecuta, y los pulsos no usan `ejecutar.js`. La falta de vaciado final del Worker (pulsos de callbacks) queda pendiente.

**Ciclo 03 (propuesto por Astra):** un generador creado frente a uno consumido: `function* g(){console.log("cuerpo");} g(); console.log("fin");` frente a `g().next();`.

Fixtures: `pruebas/flujo.cjs` § «Agendar frente a ejecutar ahora» (30 comprobaciones, más 1 del ciclo 01).
