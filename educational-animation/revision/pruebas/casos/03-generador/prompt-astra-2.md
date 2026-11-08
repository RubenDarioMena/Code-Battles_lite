Ciclo 03 · turno 2 de Astra (rol: romper la implementación). Opus implementó tu regla, sin commitear (`git diff`). Máximo ~450 palabras.

Cambios:
- trazador.js: la tabla de nodos marca `generador` (acorn `generator`). No cambian ni los ganchos ni `V`.
- python.js: un `def` con yield en su cuerpo (no en defs/lambdas de dentro) → `generador`. Se tolera el error vacío de lezer tras un `yield` sin valor, solo dentro de Yield(Statement|Expression).
- flujo.js:
  - `generadora(P, fn)`: la marca o, si falta (tablas antiguas), el texto `function*`.
  - `creaGenerador(P, llamada)`: la llamada resuelve por `declaracion` a una función generadora.
  - `avance(P, llamada)` → {fn, gen}: `g().next()`, `it.next()` con `it = g()` sin reasignar, o `next(it)` en Python.
  - En `recorrer`, si el cuerpo corrió entre medias, el resultado de un next() abre un paso de vuelta (`paso.regreso`) en su fila.
- explicar.js:
  - Etiquetas: «Crea un generador con [g()]» (también `const it = g()` e `it = g()`), «Pide el siguiente valor a [g()]», «Generador g()» y «Entrega {v} y se para».
  - Lectura: «todavía no ejecuta el cuerpo, en (3)» y «Pide a [g()] su siguiente valor: el cuerpo, en (3), corre hasta el siguiente yield o hasta el final…». En la fila del generador: «Llamarlo crea un generador sin ejecutar nada: su cuerpo corre a trozos…». En el yield: «Se para aquí y entrega 1…». Si hay un next() dentro de otra cosa: «Antes, [it.next()] pide…».
  - Traza: 1 pide → cuerpo → yield «Se para aquí y entrega «1»…» → 1 «Vuelve de [it.next()]: el generador se paró en un yield y da «1»» (+ el resto de la sentencia).
  - Resumen: «Los generadores de (3) solo avanzan cuando alguien les pide un valor».
Fixtures: casos/03-generador/{a..k}. Flujo 373. Límite conocido que ya existía: `for (x of …) sentencia` sin llaves no da pasos por vuelta (pasa igual con un array).

Tu turno: 2–4 variantes nuevas, ejecutadas, que lo rompan. Prioriza: (1) afirmaciones falsas («Crea un generador» o «Pide…» donde no lo es: sombreado, métodos `*m(){}` de objetos o clases, `yield*`, `return` dentro del generador, generadores async, `it.next(valor)`); (2) orden falso en la traza (un generador que llama a otro, recursión, next() dentro de una condición `while (!it.next().done)`, un next() que lanza); (3) regresiones de los ciclos 01–02 (lecturas en línea, pasos diferidos, temporizadores que avanzan un generador); (4) el juego (¿la marca nueva en la tabla de nodos afecta a pulsos o a los guardados?). Formato: Variantes / Ajuste mínimo / Veredicto.
