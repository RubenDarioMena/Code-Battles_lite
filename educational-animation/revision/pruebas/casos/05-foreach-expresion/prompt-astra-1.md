Ciclo 05 · turno 1 de Astra (diagnosticar y proponer la regla). El ciclo 04 quedó commiteado (63b9dd2). Opus implementa; tú solo lees y ejecutas. Máximo ~550 palabras.

Lee educational-animation/revision/pruebas/casos/05-foreach-expresion/caso.md (el par lo propusiste tú). Reproduce con `node educational-animation/revision/pruebas/caso.cjs <archivo.js> [--lectura]`.

Tu turno:
1. Diagnóstico por capa con archivo:línea (trazador, `forEach()`/porCada en flujo, construcción de filas, explicar, presentación).
2. Propón cómo representar un cuerpo expresión como **una fila** del bucle sin inventar una sentencia. Por ejemplo, una fila cuyo nodo es la expresión del cuerpo, con un evento de paso propio: `x => (__T.c(id,x), __T.s(idExpr), expr)`. Indica qué partes del motor suponen hoy que una fila es una sentencia (etiqueta, describir, detalle, foco/línea, rieles, recorrer, documentación) y qué hay que cambiar como mínimo. Valora también la alternativa de no tener fila de cuerpo y narrar la vuelta en la fila del bucle.
3. Instrumentación sin mover líneas ni cambiar la semántica: valor de retorno del callback, `this` en `function`, parámetros con patrón o por defecto, y el filtro de pulsos del juego (`Prototypes/Rocket Launcher/js/pulsos.js`). Comprueba con HEAD que los cuerpos con llaves quedan byte a byte iguales.
4. Contraejemplos (map, filter, forEach(f), forEach con 2 argumentos) y riesgos para los ciclos 01–04 (lecturas en línea de la flecha, pasos diferidos, etiquetas).
Formato: «Diagnóstico», «Representación», «Instrumentación», «Contraejemplos y riesgos». Evidencia ejecutada o «razonado».
