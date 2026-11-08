Ciclo 03 · turno 1 de Astra (rol: diagnosticar y proponer la regla). El ciclo 02 quedó commiteado (95614fc). Opus implementa; tú solo lees y ejecutas. Máximo ~550 palabras.

Lee educational-animation/revision/pruebas/casos/03-generador/caso.md: la pregunta, el par, lo que hoy se afirma (y es falso) y la evidencia de Opus. Reproduce con `node educational-animation/revision/pruebas/caso.cjs <archivo.js> [--lectura]` (o /dev/stdin).

Tu turno:
1. Diagnóstico por capa (árbol/trazador, flujo/recorrido, explicación, presentación) con archivo:línea. ¿Cómo debe saber el motor que una función es generadora (acorn `generator`, texto, `yield`) para JS y para Python (motor/python.js)? ¿Conviene añadir `generador` a la tabla de nodos del trazador y un valor propio para el objeto generador en `V`? Evalúa el impacto en el juego (pulsos usan el mismo trazador; los guardados/grabaciones existentes tienen `{}`).
2. Regla mínima, separando **lectura** (crear el generador no ejecuta el cuerpo; `next()` lo ejecuta hasta el primer `yield`; `for…of`/spread lo consumen entero) y **traza** (orden: el cuerpo antes que el resultado de `next()`; qué dice el paso de `g()` en `a`). Di qué debe ver el lector en la fila 1 y en la fila 3 para contestar la pregunta antes de mirar la consola.
3. Contraejemplos que NO deben activar la regla (función normal, async, un objeto con un método `next` propio, una variable `g` que no es generadora…).
4. Riesgos de regresión, incluido lo que hicimos en los ciclos 01–02 (paso.lecturas, pasos diferidos).
Formato: «Diagnóstico», «Regla», «Contraejemplos», «Riesgos». Cada afirmación con evidencia ejecutada o «razonado».
