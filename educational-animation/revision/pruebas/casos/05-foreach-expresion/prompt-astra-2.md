Ciclo 05 · turno 2 de Astra (rol: romper la implementación). Opus implementó tu representación, sin commitear (`git diff`). Máximo ~450 palabras.
- trazador.js: `forEach(x => expr)` → `x => (__T.c(id,x),__T.s(idExpr),expr)` en las mismas posiciones, a la profundidad de la flecha (por fuera del `__T.v` de la expresión). `__T.s` respeta `quiere("s")`. Si el parámetro es `x = 7`, se usa `x`; con un patrón, `true`. Con llaves, nada cambia: 68 programas de casos/ejemplos idénticos byte a byte a HEAD; solo cambian los 7 de forEach con expresión.
- flujo.js: `forEach()` acepta un cuerpo expresión y lo apunta en `P.cuerpoExpr`. `FL.expresion(P, s)` da la expresión de una fila (la de un ExpressionStatement o la propia fila de cuerpo).
- explicar.js / revision.js: etiqueta, lectura, traza, queEs, agendaDe, regreso, avanceDentro y la píldora usan `FL.expresion`, y tratan la fila de cuerpo como una sentencia expresión.
Casos 05-foreach-expresion/{a..j}: índice, ternario, secuencia, objeto literal, patrón, contraejemplos (map, forEach(f)), forEach(function, this) y forEach con setTimeout. Flujo 414.

Tu turno: 2–4 variantes nuevas, ejecutadas, que lo rompan. Prioriza:
(1) instrumentación: callback async `async x => await …`, `x => x` (identificador solo), `x => void f(x)`, comentarios dentro del cuerpo, flecha con cuerpo entre paréntesis multilínea, `forEach(x => y => x)` (devuelve una función), optional chaining `l?.forEach(x => f(x))`;
(2) filas y recorrido: `return` (no hay; ¿algo asume un return?), errores lanzados en el cuerpo expresión, generadores (`x => it.next()`), agendas y lecturas en línea de los ciclos 01–02 dentro del cuerpo;
(3) pulsos del juego: compara con HEAD el código instrumentado con el filtro real de pulsos;
(4) Python: no hay forEach; confirma que no cambia nada.
Formato: Variantes / Ajuste mínimo / Veredicto.
