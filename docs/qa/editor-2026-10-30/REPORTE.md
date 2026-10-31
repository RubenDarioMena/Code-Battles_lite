# Editor sin teclado · regresión y propuestas · 30-oct-2026

Rocket Launcher en 127.0.0.1:8771, Ego Browser, modo sin teclado, JavaScript. Build: `edicion.js?v=13`, `estructura.js?v=1`, `juego.js?v=12`, `componentes.css?v=14`, `edicion.css?v=1`. La tanda se hizo sin tocar el juego. Las correcciones vinieron después y se describen a continuación.

## Estado tras las correcciones (30-oct, build `edicion.js?v=14`, `estructura.js?v=2`, `edicion.css?v=3`, `juego.js?v=13`)

Se corrigieron las nueve incidencias (ED-01 a ED-09), con regresiones nuevas en `pruebas/interaccion.cjs` (12) y `pruebas/navegador.mjs` (9):

| ID | Corrección |
| --- | --- |
| ED-01 | `resolverPendiente()`: un `pointerdown` fuera de `#bloques` o una tecla aplica en el momento el toque pendiente; un cambio de texto lo anula. |
| ED-02 | `contexto()` solo marca «condición» si la expresión lógica es el `cond` de un if/while (`enCondicion`). `quitar()` borra el operando junto con su operador. |
| ED-03 | La animación `sug-entra` es solo de opacidad. La lista va a la derecha de la selección si cabe y, si no, deja libre la línea vecina. |
| ED-04 | Sin mínimo forzado de 90 px. Si no cabe junto a la selección, se muestra como hoja inferior compacta, siempre dentro de la pantalla. |
| ED-05 | Envolver usa 2 espacios en `envolver()` y en las envolventes (también en Tres vistas). |
| ED-06 | Los bloques envuelven sentencias completas. Las plantillas de sentencia solo envuelven la expresión de una sentencia, sin `;` doble; con cualquier otra selección se insertan en una línea nueva. Variable aplica la misma regla. |
| ED-07 | `contenedorNecesario()`: borrar el nombre declarado, lo que sigue a `await`, el nombre de una función o el objeto/método de una llamada borra la construcción; el valor inicial pasa a `/* valor */`. |
| ED-08 | Tras borrar líneas enteras, el cursor queda al final de la línea anterior. |
| ED-09 | `ampliar()` pasa por la línea cuando esta tiene más de una sentencia. |

Verificación tras corregir:

- **Suites:** 87 comprobaciones de lógica, 66 de navegador de Rocket, 43 de Tres vistas y 23 del editor Factory, todas correctas.
- **Barrido de Borrar repetido a 1366×900:** 143/143 borrados efectivos, **0 restos** (antes 24/133) y 0 fallos de Deshacer (`evidencia/barrido-borrar-corregido.json`).
- **Diagnóstico de SEL-01:** 0/2 pulsaciones rápidas envuelven el `while`, con el mismo resultado que el control con pausa.

Límites: el móvil se probó emulado, sin tacto real. El piloto aleatorio de 10 intentos no se repitió.

Tres bloques de prueba:

1. **Regresión dirigida** de las incidencias de War del 29-oct (WAR-SEL-01, WAR-EDIT-02 y WAR-VIEW-03), cada una con su control.
2. **Barrido de Borrar**: cada ficha visible de R1–R5 se pulsa, se borra, se analiza con acorn (huecos sustituidos por un identificador) y se deshace. 136 fichas visibles y 133 borrados efectivos.
3. **Piloto R1–R5 × escritorio/móvil**: el ciclo de [CICLO-RECUPERACION-EDITOR.md](../../CICLO-RECUPERACION-EDITOR.md), semilla `rocket-piloto-v1`, 40 clics/180 s. Resultado: **10/10 recuperados con el texto exacto**, sin teclado, de los cuales 7 con reparación local y 3 con Deshacer.

Suites existentes sobre esta build: **75 comprobaciones de lógica y 57 de navegador, todas correctas**. Ninguna de las incidencias de abajo está cubierta por ellas.

## Prioridades

| ID | Prioridad | Estado | Evidencia (denominador) | Efecto |
| --- | --- | --- | --- | --- |
| ED-01 | P1 | Bug confirmado | SEL-01 2/2 rápidos frente a 0/1 pausado. Variante Borrar 1/1 frente a 0/1 pausado | **Borrar rápido elimina el programa entero** (193 → 0 caracteres) |
| ED-02 | P1 | Bug confirmado | 5/5 variantes dirigidas y 1 control. Bloqueó la reparación local del intento 3 | Borrar un operando de `??`/`&&`/`\|\|` se rechaza con un mensaje falso o deja `/* condición */` |
| ED-03 | P2 | Bug confirmado | Intento 3, pre-clic del intento 4 y 1 dirigido. 4 muestras temporales | La lista de sugerencias tapa las líneas siguientes y se traga el toque; durante 80 ms está invisible en otra posición |
| ED-04 | P2 | Bug confirmado (móvil emulado) | Intento 6 y 2/2 dirigidos | La lista queda fuera de pantalla o muestra 0–1 opciones de 3–6 |
| ED-05 | P2 | Bug confirmado | Intentos 2 y 6, 1 dirigido y 1 control | Envolver con If/While sangra 4 espacios; el resto del editor usa 2 |
| ED-06 | P2 | Bug confirmado | 6/10 perturbaciones del piloto y 2 dirigidos | Las plantillas envuelven nombres, expresiones o sentencias sin respetar su categoría: `;;`, `);`, `};`, `if` dentro de una expresión |
| ED-07 | P2 | Fricción confirmada (WAR-EDIT-02) | 24/133 borrados efectivos (18 %) | Borrar deja restos no analizables: `const =`, `const pos =;`, `await;`, `();`, `.warn(…)` |
| ED-08 | P3 | Fricción confirmada | Intento 7, 1 dirigido y 1 control | Tras borrar una línea intermedia, la siguiente inserción cae debajo de la línea posterior |
| ED-09 | P3 | Límite de UI | Intento 1 (1/1) | Ampliar salta de la sentencia al programa entero si la línea tiene dos sentencias |
| VIEW-03 | P3 | Fricción (WAR-VIEW-03 vigente) | Capturas a 393×852 | El código visible se reduce a 4–5 líneas, lo que agrava ED-03/ED-04 |

Carencias repetidas, que no son bugs: **Desenvolver** (quitar una envoltura y conservar el contenido; intentos 2 y 10) y un **nivel «línea» en Ampliar** (intento 1).

---

## ED-01 · Selección pendiente: la barra y la paleta actúan sobre la selección anterior (P1)

**Regla:** un toque elige el elemento entero, y el botón siguiente actúa sobre lo elegido.

**Observado:** un toque *dentro* de la selección actual difiere la nueva selección 380 ms ([edicion.js:498](../../../shared/js/edicion.js)). Ni la barra ni la paleta la resuelven antes de actuar ([edicion.js:835](../../../shared/js/edicion.js)): `tSimple` solo se cancela dentro de `toque()`. Después, el temporizador se ejecuta sobre el texto ya cambiado y deja el cursor en un offset obsoleto.

| Caso (R5, `while` elegido → toque en `console`) | Intervalo | Resultado |
| --- | --- | --- |
| Ráfaga rápida ×2 | ~50–80 ms | `burstFire(while (true) {…})` en 2/2 |
| Ráfaga tras 450 ms (control) | 450 ms | Actúa sobre `console` |
| **Borrar rápido** | 102 ms | **Programa vacío** (193 → 0). Deshacer lo recupera |
| Borrar tras 450 ms (control) | 563 ms | Solo actúa sobre `console` |
| Selección tardía tras Ráfaga | +450 ms | El cursor salta a 146, un offset del texto antiguo |

**Propuesta** (en `shared/js/edicion.js`):

1. Guardar el toque pendiente (`pendiente = g.o`) junto a `tSimple`.
2. Añadir `resolverPendiente()`: hace `clearTimeout(tSimple)` y, si había toque pendiente, llama a `simple(pendiente, false)`.
3. Llamarla al empezar cualquier acción, con un `pointerdown` en captura sobre `document` cuyo objetivo esté fuera de `#bloques` (barra, paleta, sugerencias, Ajustes). Así se cubre la paleta de `juego.js` sin acoplar módulos.
4. Cancelar `tSimple` en el `input` de `#codigo`: un cambio de texto invalida el offset pendiente.

El doble toque no cambia, porque solo depende de toques sobre `#bloques`.

**Regresión que añadir:** R5, elegir `while`, tocar `console` y pulsar Borrar en menos de 100 ms. Esperado: solo desaparece `console` y el programa conserva 186 o más caracteres. Repetir con Ráfaga y comprobar que a los 450 ms la selección sigue en la inserción.

Evidencia: `evidencia/sel-01/*.png`, `evidencia/sel-01/seleccion-dirigida.json`.

## ED-02 · Los operandos lógicos se tratan como «condición» (P1)

**Regla:** Borrar un elemento deja su hueco o quita el elemento sin romper lo que lo rodea. El aviso «La condición no puede quedar vacía» solo corresponde cuando lo que se borra es la condición entera.

**Observado** (`evidencia/dirigido-intento3.json`):

| Selección | Borrar | Aviso |
| --- | --- | --- |
| `/* valor */` en `if (pos ?? /* valor */)` | Sin cambio | «La condición no puede quedar vacía» (falso) |
| `/* valor */` en `while (pos ?? /* valor */)` | Sin cambio | Igual (falso) |
| `/* valor */` en `const x = pos ?? /* valor */;` | Sin cambio | Igual. **Aquí no hay condición** |
| `target` en `if (pos ?? target)` | `pos ?? /* condición */` | Hueco con el nombre equivocado |
| `/* condición */` en `if (/* condición */)` (control) | Sin cambio | Aviso correcto |

**Causa:** en [estructura.js:510](../../../shared/js/estructura.js), cualquier hijo de una `binaria` con `&&`, `||` o `??`, o de `!`, recibe `tipo = "condicion"`, esté o no en el `cond` de un `if` o `while`. [edicion.js:191](../../../shared/js/edicion.js) actúa con esa clasificación.

En el intento 3 esto impidió la reparación local: no hay manera de volver de `pos ?? /* valor */` a `pos` sin Deshacer.

**Propuesta:**

1. En `contexto()`, subir por la cadena de lógicos o `!` y marcar `"condicion"` solo si la raíz es el `cond` de su padre. En otro caso, el operando de `??` es `"valor"` y el de `&&`/`||` es `"operando"`.
2. En `quitar()`, si el nodo es operando de una `binaria` (de cualquier operador), quitar el operador y ese operando y conservar el hermano: `pos ?? X` → `pos`. Si el hermano es un hueco, se queda el hueco.
3. Rechazar solo cuando el nodo *es* la condición (`pa.cond === n`) y ya es un hueco.

**Regresión que añadir:** las cinco filas de la tabla. Esperado: `pos`, `pos`, `const x = pos;`, `if (pos)` y el control sin cambios.

## ED-03 · La lista de sugerencias tapa el código y se traga el toque (P2)

**Observado:** al elegir un valor (`pos`, `"visual"`), la lista se abre debajo y cubre las 3–4 líneas siguientes (`evidencia/sugerencias-tapan-1366.png`, `sug-tapa-linea4.png`). Un toque sobre `else` con la lista abierta no hace nada y la selección sigue en `pos`.

Además, la lista aparece con `animation: tip` ([componentes.css:353](../../../Prototypes/Rocket%20Launcher/css/componentes.css)), que anima `transform` y pisa el `transform: translate(x, y)` con que se coloca ([edicion.js:716](../../../shared/js/edicion.js)). Durante unos 80 ms está invisible en (0, 3) y después salta a su sitio. Medido: el punto (809, 379) da `else` a 0, 16 y 50 ms, y la lista a 120 y 400 ms.

Esto explica el intento 3: el inyector eligió el punto cuando aún estaba libre y el clic llegó con la lista ya encima (no queda ningún clic en la traza del editor). En el intento 4, `/* lugar */` no era pulsable.

**Propuesta:**

1. Colocar con `left`/`top` (o la propiedad `translate`) y dejar `@keyframes tip` solo para la opacidad, o animar con `translate` aparte. Así la posición es la definitiva desde el primer fotograma.
2. En `colocarSugerencias()`, preferir el lateral derecho de la selección cuando quepa (PC). Si no cabe, dejar libre al menos la línea siguiente a la selección.
3. Toque que atraviesa: con `pointer-events: none` en el fondo de `.sugerencias` y `auto` en `.sug`, `.sug-cab` y el formulario, un toque fuera de las opciones llega a la ficha y cierra la lista (la regla de [edicion.js:784](../../../shared/js/edicion.js) ya la cierra).

**Regresión que añadir:** R3, elegir `pos` en `if (pos)` y tocar `else` sin pausa. Esperado: queda elegido `else`.

## ED-04 · En móvil la lista no cabe (P2, emulación 393×852)

**Observado:**

- Intento 6: la lista de «lugar» ocupaba y = 776–866 con un viewport de 852. Solo se podía pulsar `pos` en su franja visible (y ≈ 848–852).
- Dirigido: en un hueco de la línea 4 la lista se abre arriba con 1/6 opciones visibles (`movil-lista-fuera.png`). En `"visual"` de la línea 2, 0/3 visibles (`movil-lista-control.png`, que no sirve como control porque también falla).

**Causa:** [edicion.js:712](../../../shared/js/edicion.js) `Math.max(90, Math.min(320, …))` fuerza 90 px aunque solo haya unos 72. Con 4–5 líneas de código visibles (VIEW-03) casi nunca hay sitio.

**Propuesta:**

1. Si el hueco disponible es menor que cabecera + 2 opciones (~110 px), desplazar `#bloques` para llevar la selección a la parte superior (`mostrarRango`) y volver a colocar la lista.
2. Si sigue sin caber, en pantallas estrechas usar una hoja inferior fija sobre la consola (`position: fixed; bottom: 0`), sin tapar la paleta ni la barra.
3. Nunca superar `innerHeight`: `max = Math.min(320, disponible)`, sin el mínimo de 90.

**Regresión que añadir:** 393×852, R4, tocar `/* lugar */`. Esperado: al menos 2 opciones completamente visibles dentro del viewport.

## ED-05 · Envolver sangra con 4 espacios (P2)

**Observado:** con una sentencia de nivel superior elegida, If / else da `if (…) {\n    regularShoot(pos);\n} else {\n    \n}`. En una línea vacía, el control da 2 espacios. Lo mismo en los intentos 2 y 6 (`evidencia/dirigido-piloto.json`).

**Causa:** [juego.js:2353](../../../Prototypes/Rocket%20Launcher/js/juego.js) usa `sangria + "    "`, y las `envolvente` de la paleta ([juego.js:2413-2421](../../../Prototypes/Rocket%20Launcher/js/juego.js)) llevan líneas `"    "`. `UNIDAD` ([edicion.js:18](../../../shared/js/edicion.js)) es de 2 espacios.

**Propuesta:** usar una sola constante de 2 espacios en `envolver()` y en las envolventes (`"\n} else {\n  \n}"`).

**Regresión:** el mismo caso, comprobando 2 espacios y que la línea vacía del `else` tenga la sangría correcta.

## ED-06 · Las plantillas envuelven sin respetar la categoría (P2)

**Observado** en el piloto (6/10 perturbaciones) y en los dirigidos:

| Selección | Botón | Resultado |
| --- | --- | --- |
| Nombre `regularShoot` | Ráfaga | `burstFire(regularShoot);(pos);` (intentos 1 y 9) |
| Nombre `autoTarget` | If / else | `const pos = if (…) {\n autoTarget\n } else {…}("crawler", …)` (intento 2) |
| Llamada `regularShoot(pos)` | If / else | `…}\n};`, con el `;` fuera de la llave (intento 6) |
| `await esperar(0.5)` | Sensor de vibración | `const pos = VIB_01.detect(await esperar(0.5));;` (intento 7) |
| Sentencia `if` completa | Disparo | `regularShoot(if (pos) {…});` (intento 10) |
| `regularShoot(pos)` / `regularShoot(pos);` | Ráfaga | `…;;` / `burstFire(regularShoot(pos););` (dirigido) |

**Causa:** `insertarBloque()` ([juego.js:2358-2361](../../../Prototypes/Rocket%20Launcher/js/juego.js)) envuelve el texto tal cual, tanto con `envolvente` como con el primer hueco de la plantilla.

**Propuesta:** antes de envolver, consultar `cmg.edicion` o `estructura`:

- Para plantillas de bloque (`if`, `while`, `for`, `do`), ampliar la selección a sentencias completas (`lineasDe`).
- Para plantillas de sentencia con hueco (`burstFire(/* lugar */);`), envolver solo si la selección es una expresión. Si la sentencia ya termina en `;`, quitar el `;` interior; si al texto elegido le sigue un `;`, no añadir otro.
- Si la selección es una sentencia o un bloque y la plantilla espera una expresión, insertar como línea nueva en lugar de envolver.
- Valorar una acción **Desenvolver** en la barra (sustituir la envoltura por su contenido), solicitada dos veces en el piloto.

**Regresión:** las seis filas de la tabla, comprobando que el resultado se analiza con los huecos sustituidos.

## ED-07 · Restos al borrar (WAR-EDIT-02, P2)

Barrido de los cinco ejercicios: 24 de 133 borrados efectivos dejan código no analizable incluso sustituyendo los huecos (`evidencia/barrido-borrar.json`).

| Patrón | Casos |
| --- | --- |
| Inicializador `autoTarget(…)` → `const pos =;` | 13 |
| Nombre declarado `pos` → `const = autoTarget(…)` | 5 |
| `esperar(0.5)` → `await;` | 3 |
| Nombre de función `stopFire` → `();` | 1 |
| Objeto `console` → `.warn(…)`; método `warn` → `console.(…)` | 2 |

Deshacer devolvió el texto exacto en todos los borrados medidos limpiamente. La única discrepancia (`0.5` → `0.55`) la produjo el barrido al pulsar el «+» de la lista (ED-03), no Deshacer.

**Propuesta:** escalonar `quitar()` ([edicion.js:181-204](../../../shared/js/edicion.js)) cuando lo elegido sea un hijo obligatorio:

- Inicializador → hueco `/* valor */`.
- Nombre declarado → la declaración entera.
- Operando de `await` → la sentencia.
- Nombre de función u objeto/método de un miembro → la llamada entera, con la misma regla que los argumentos.

Como red de seguridad: si el resultado no se analiza (con los huecos sustituidos), subir un nivel con `E.ampliar` y volver a intentar antes de aplicar.

**Regresión:** convertir el barrido en una prueba con 0 restos esperados en R1–R5.

## ED-08 · Cursor tras borrar una línea intermedia (P3)

**Observado:** al borrar la línea 3 de R2, el cursor queda al principio de la línea 4 y Esperar se inserta *debajo* de ella. En el intento 7 quedó fuera del `while` y hizo falta «Subir». En el control (borrar la última línea), el cursor queda al final de la anterior y la inserción va en el mismo sitio.

**Propuesta:** en `quitar()` con líneas enteras, dejar el cursor al final de la línea anterior. Alternativa: en `insertarBloque()` ([juego.js:2374](../../../Prototypes/Rocket%20Launcher/js/juego.js)), si el cursor está en la columna 0 de una línea con texto, insertar *antes* de ella. Así, borrar y volver a insertar repone el contenido en su sitio.

## ED-09 · Ampliar sin nivel «línea» (P3)

Con `burstFire(regularShoot);(pos);` (dos sentencias en una línea), Ampliar pasó de la sentencia al programa entero y el Borrar siguiente vació todo. El asa del número sí elige la línea.

**Propuesta:** en `ampliar()` ([estructura.js:441](../../../shared/js/estructura.js)), insertar el nivel `unidadLinea` entre la sentencia y el bloque cuando la línea tenga más de una sentencia.

---

## Piloto · resultados

| # | Ejercicio | Carácter → botón | Resultado | Clasificación | Clics de reparación* | s | Viewport real |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | R1 PC | `l` → Ráfaga | recuperado | limite-ui | 11 | 56 | 1224×670 |
| 2 | R2 PC | `t` → If / else | recuperado (Deshacer) | limite-ui | 4 | 27 | 1224×670 |
| 3 | R3 PC | `s` → ?? | recuperado (Deshacer) | bug-sospechado | 4 | 72 | 1224×670 |
| 4 | R4 PC | `;` → Detener | recuperado | evaluar | 2 | 19 | 1224×670 |
| 5 | R5 PC | `e` → Esperar | recuperado | evaluar | 2 | 15 | 1224×670 |
| 6 | R1 móvil | `)` → If / else | recuperado | bug-sospechado | 3 | 152 | 393×852 |
| 7 | R2 móvil | `t` → Sensor | recuperado | limite-ui | 4 | 36 | 393×852 |
| 8 | R3 móvil | `s` → Variable | recuperado | evaluar | 7 | 38 | 393×852 |
| 9 | R4 móvil | `t` → Ráfaga | recuperado | evaluar | 4 | 24 | 393×852 |
| 10 | R5 móvil | `f` → Disparo | recuperado (Deshacer) | limite-ui | 1 | 12 | 393×852 |

\*El arnés solo cuenta clics dentro de `config.area`. Las opciones de la lista de sugerencias (`.sugerencias`, fuera del área) no suman.

En el intento 1, un desvío del agente (ED-09) vació el programa y se recuperó con 2 Deshacer. Detalle, trazas y capturas en `evidencia/piloto/` (`resumen.json`, `caso-NN.json/png` de las incidencias).

## Límites de esta tanda

- **Viewport:** Ego restablece la emulación al terminar cada ronda. Los intentos 2–5 se cerraron a 1224×670 (diseño de PC) en lugar de 1366×900. En móvil la emulación se volvió a aplicar al comienzo de cada ronda, pero en el intento 6 la geometría cambió una vez a mitad de la reparación.
- **Emulación:** el móvil se emuló con ratón, así que no valida tacto real, pulsación larga ni menús de Android/iOS.
- **Artefactos descartados:** en los primeros barridos, fichas recortadas bajo la barra (con la vista desplazada tras `fill`) y clics sobre la lista de sugerencias abierta produjeron falsos «Deshacer no exacto» y borrados sin efecto. Se repitió el barrido comprobando la visibilidad con `elementFromPoint`; las cifras de arriba son las de esa repetición.
- **Muestra:** 10 sorteos no dan cobertura de todos los gestos. Los conteos son descriptivos.
- **Tokens:** no se midió el uso de tokens; no hay lector del proveedor Claude implementado (`uso: null`).
- **Sin cambios:** no se modificaron recursos del juego, la simulación ni `window.cmg`. Tampoco hubo commits ni push.

## Orden sugerido de corrección

1. **ED-01** (pérdida del programa, cambio pequeño y local).
2. **ED-02** (`contexto` + `quitar`).
3. **ED-03.1 y ED-05** (CSS y constante, triviales).
4. **ED-06 y ED-07**: comparten la consulta a `estructura` antes de editar; conviene diseñarlos juntos.
5. **ED-04**, con la decisión de diseño de la hoja inferior en móvil.
6. **ED-08 y ED-09.**

Cada corrección debería añadir su caso a `pruebas/navegador.mjs` y subir las versiones de CSS/JS en `index.html`.
