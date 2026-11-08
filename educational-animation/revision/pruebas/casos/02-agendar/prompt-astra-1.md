Ciclo 02 · turno 1 de Astra (rol: diagnosticar y proponer la regla). El ciclo 01 quedó commiteado (7f97284). Opus implementa; tú solo lees y ejecutas. Máximo ~550 palabras.

Antes, en 2 líneas: el cierre del ciclo 01 no quitó la lista GUARDAN como pediste. Exige que el receptor esté acreditado: una variable del programa creada con `[]`, `new Set` o `new Map`, o `setTimeout`/`setInterval`/`queueMicrotask` sin redefinir (`guardada()` en motor/flujo.js). ¿Lo aceptas o lo rompes con un caso concreto?

Caso nuevo: lee educational-animation/revision/pruebas/casos/02-agendar/caso.md. Están la pregunta, el par, la evidencia de Opus (la traza pierde los eventos del microtask) y las variantes cercanas. Reproduce con `node educational-animation/revision/pruebas/caso.cjs <archivo.js> [--lectura]` (puedes usar /dev/stdin como en el ciclo 01).

Tu turno:
1. Diagnóstico por capa (trazador/ejecutar, flujo/recorrido, explicación, presentación), con archivo:línea. ¿La pérdida de eventos es un fallo del ejecutor? ¿Pasa también en el juego (Prototypes/Rocket Launcher/js/…, el Worker y su trazador)? Compruébalo leyendo el código.
2. Propón la regla mínima, separando lo que puede afirmarse en **lectura** (estructura: agendar frente a llamar ahí mismo) de lo que solo la **traza** puede mostrar (el callback corre después de la fila 2: ¿un paso más que vuelve a la fila 1, o un aviso en el final?). Di qué debe ver el lector en cada fila para contestar la pregunta antes de mirar la consola.
3. Contraejemplos: qué NO debe activar la regla (forEach/map síncronos, un `queueMicrotask` redefinido por el usuario, una función con nombre que se llama queueMicrotask…).
4. Riesgos de regresión en el juego (await esperar, pulsos del editor). Si propones tocar el trazador, explica el impacto.
Formato: «Ciclo 01», «Diagnóstico», «Regla», «Contraejemplos», «Riesgos». Cada afirmación con evidencia ejecutada o «razonado».
