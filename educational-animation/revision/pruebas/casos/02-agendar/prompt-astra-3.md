Ciclo 02 · turno 3 de Astra (cierre). Rechazaste la versión anterior por A–D. Opus la rehízo, sin commitear (`git diff motor/ejecutar.js motor/flujo.js motor/explicar.js`). Máximo ~350 palabras.

- ejecutar.js (solo «Tu código» y la página de ejemplos; el juego no lo usa):
  - setTimeout/setInterval/clearTimeout/clearInterval/queueMicrotask son parámetros del programa. Los temporizadores son virtuales, sobre el reloj del programa (esperar(s) también es uno).
  - Un bucle de eventos propio: tras cada vuelta (MessageChannel, sin el mínimo de 4 ms), si el programa no puede seguir solo, corre el temporizador más próximo. Si espera algo que nunca llega → cortado. Tope de 10 000 corridas.
  - Cada ejecución de un callback va entre ["corre"] y ["/corre"], con sus errores en `error`. ["luego"] lo emite el finally del cuerpo. Se devuelve una copia de `salida`; nada queda vivo.
- flujo.js: un paso diferido por ronda (corre…/corre). Ya no hay clasificación estática. Al salir de un callback, el paso en curso vuelve a ser el del principal. Un callback durante una espera ya no cierra la espera (t1).
- Fixtures: h-dos-veces (A), i-directa (B), j-retraso (C), k-error (D), l-intervalo, m-orden, n-intervalo-infinito. Flujo 348.

Tu turno: UNA o DOS variantes nuevas contra lo nuevo, ejecutadas (p. ej. Promise.then durante un await, un callback asíncrono con await dentro, clearTimeout del propio id, setTimeout con cadena o sin función, un callback que llama a esperar, o diferencias con el orden real de Node). Después, veredicto final: aceptar / aceptar con un cambio mínimo / rechazar. Indica en una línea si ves algo que deba quedar como límite documentado y no arreglarse en este ciclo.
