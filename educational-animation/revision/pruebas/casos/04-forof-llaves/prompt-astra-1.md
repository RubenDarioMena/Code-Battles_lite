Ciclo 04 · turno 1 de Astra (rol: diagnosticar y proponer la regla). El ciclo 03 quedó commiteado (02447fa). Opus implementa; tú solo lees y ejecutas. Máximo ~550 palabras.

Lee educational-animation/revision/pruebas/casos/04-forof-llaves/caso.md. Este par es al revés que los anteriores: dos programas con la **misma** semántica que hoy se ven distintos. Reproduce con `node educational-animation/revision/pruebas/caso.cjs <archivo.js> [--lectura]` (o /dev/stdin).

Tu turno:
1. Confirma la causa con archivo:línea y busca **todas** las formas afectadas por la misma restricción (for…of, for…in, forEach con cuerpo expresión, otros ganchos que dependan de un bloque: while/for sin llaves, if sin llaves, etc.). Ejecútalas y di qué se pierde en cada una.
2. Propón cómo instrumentar un cuerpo sin llaves **sin mover líneas ni cambiar la semántica** (p. ej., envolver la sentencia en un bloque `{__T.c(...);sentencia}` en las mismas posiciones; o emitir el gancho en la cabecera). Considera `let`/`const` en el cuerpo (no permitido sin llaves), etiquetas y `continue etiqueta`, `if (a) for (x of l) f(x); else …`, y que un `else` o un `;` vacío no se rompan. Revisa `abrir`/`cerrar` y su manejo de profundidad (`prof`).
3. Impacto en el juego: `Prototypes/Rocket Launcher/js/pulsos.js` usa el mismo trazador con un filtro `quiere`. ¿Cambian los pulsos, la línea de error que ve el jugador o los guardados/grabaciones? ¿Hay alguna suite del juego que deba repetirse?
4. Contraejemplos y riesgos: qué NO debe cambiar (cuerpos con llaves idénticos byte a byte a hoy, Python, el recorrido de los ciclos 01–03).
Formato: «Diagnóstico», «Instrumentación», «Juego», «Contraejemplos y riesgos». Cada afirmación con evidencia ejecutada o «razonado».
