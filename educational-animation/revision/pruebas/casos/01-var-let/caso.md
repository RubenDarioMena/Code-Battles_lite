# Caso 01 · `var` / `let` con funciones guardadas en un bucle

**Pregunta para el lector:** cuando termine el bucle, ¿las tres funciones leerán la misma `i`?

| Archivo | Programa | Consola |
|---|---|---|
| `a-var.js` | `for (var i …) f.push(() => i)` | `3 3 3` |
| `b-let.js` | `for (let i …) f.push(() => i)` | `0 1 2` |
| `c-valor.js` (contraejemplo) | `for (var i …) f.push(i)` | `0 1 2` — guarda el valor, no hay captura |

Reproducir: `node educational-animation/revision/pruebas/caso.cjs <archivo.js> [--lectura]` (salidas `*.txt`).

## Qué se ve hoy (diff a/b)
Filas, etiquetas, frases de lectura, destinos y narración idénticos salvo el texto del `for` y la consola.
- Fila 3, lectura: «Ejecuta [f.push(() => i)]. Luego vuelve a (2).» — no dice que la función **no** se ejecuta.
- Fila 3, traza: «[f.push(() => i)] → «1»» — enseña la longitud nueva del array (ruido para el lector).
- Fila 4, traza: «Escribe «"3 3 3"» en la consola.» — nada sobre qué `i` leyó cada llamada.

## Dónde se pierde la diferencia (diagnóstico de Opus)
No en el análisis ni en el trazador: **en la explicación** (`motor/explicar.js`).
- El árbol trae `clase: 'var' | 'let'` en el `VariableDeclaration` del `for`.
- La traza trae, durante la fila 4, la lectura del `Identifier i` **dentro** del cuerpo de cada flecha
  (nodo 21) justo antes del valor de cada `f[k]()`: `i=3,3,3` con `var`, `i=0,1,2` con `let`.

## Regla propuesta
R1 (lectura, estructural). Una función en línea (flecha o `function`) que aparece en el cuerpo de un bucle
y **lee una variable declarada en la cabecera de ese bucle** se describe como «guarda una función; todavía
no se ejecuta». Se añade la pista de ámbito:
- `var` (o variable declarada fuera del bucle): «leerá la misma [i] para todas: la que valga cuando la llamen».
- `let`/`const` en la cabecera del `for`: «cada vuelta tiene su propia [i]; esta función guarda la de su vuelta».

R2 (traza). Cuando una llamada ejecuta una función en línea sin fila propia, su paso nombra las lecturas
que hizo: «[f[0]()] leyó [i] = «3» → «3»».

R3 (ruido). En la fila 3 de traza, no mostrar «→ «1»» como resultado principal de `push`.

Contraejemplos que NO deben activar R1: `f.push(i)`; `f.push(() => 5)`; una flecha que solo lee
variables que no son del bucle.

---

## Registro del ciclo (Opus implementa · Astra ataca, `codex exec`, esfuerzo medio, solo lectura)

| Turno | Quién | Resultado |
|---|---|---|
| Caso | Astra → Opus | Par `var`/`let` + contraejemplo `f.push(i)`. Opus reproduce y diagnostica: la diferencia está en el árbol y en la traza, se pierde en `explicar.js`. Reglas R1–R3. |
| Ataque 1 | Astra (`astra-1.md`) | **Fallo nuevo en `flujo.js`**: las lecturas dentro de `() => i` se atribuían a los pasos del `push` (invertidas 2·1·0). Variantes A–D (inmediata, parámetro homónimo, `let` de fuera, dos llamadas). |
| Implementación 1 | Opus | `F.enLinea`, lecturas del paso que llama (`paso.lecturas`), `capturas`, frases ES/EN. |
| Ataque 2 | Astra (`astra-2.md`) | 4 fallos: `map` afirmaba «no se ejecuta aquí»; con llaves no había pista; `let i` de un bloque hermano daba falso positivo; `await f()` atribuía la lectura a `console.log`. |
| Implementación 2 | Opus | `declaracion()` con ámbitos reales; funciones con cuerpo propio; frase neutral (`*Uso`) si no se sabe que se guarda; `await`; asociación por callee; pista de una variable del cuerpo plegada; en traza, solo en la primera visita. |
| Ataque 3 | Astra (`astra-3.md`) | `receptor.push(fn => fn())`: el nombre del método no acredita que guarde. Propuso quitar la lista. |
| Cierre | Opus | Se acredita el receptor (variable creada con `[]`, `new Set`, `new Map`; `setTimeout` sin redefinir). Así `receptor.push` queda neutral y `f.push` conserva «no se ejecuta aquí». Astra dio «aceptar con un cambio mínimo» y proponía quitar la lista; esta alternativa **todavía no la ha revisado**. |

**Respuesta a la pregunta del ciclo:** en lectura, la fila del `push` dice si la función comparte la `i` o se queda con la de su vuelta. En traza, la fila 4 dice qué `i` leyó cada llamada: `3 3 3` frente a `0 1 2`.

**Límites:** «no se ejecuta aquí» solo con receptores acreditados de forma estructural. Una lista que se reasigna a otra cosa no se sigue. Python solo tiene lectura. En traza, la frase «Ejecuta [f.push(() => i)]» sigue mostrando el `→ «1»` del `push` (R3 no se aplicó: es cierto, aunque es ruido).

**Ciclo 02 (propuesto por Astra):** un callback agendado frente a uno ejecutado: `queueMicrotask(() => console.log("callback")); console.log("fin");` frente a `(() => console.log("callback"))(); console.log("fin");`.

Fixtures: `pruebas/flujo.cjs` § «Funciones en línea» (26 comprobaciones).
