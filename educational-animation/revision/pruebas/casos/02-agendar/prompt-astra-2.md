Ciclo 02 · turno 2 de Astra (rol: romper la implementación). Opus implementó tu regla, sin commitear (`git diff`). Máximo ~450 palabras.

Cambios:
- motor/ejecutar.js: el AF recibe `__traza(__T)`. Tras el cuerpo se añade el evento ["luego"], se espera un setTimeout(0) y se vuelve a vaciar el búfer (`traza.fin()`). Si no llega nada, el marcador se quita. Un temporizador más largo no se espera.
- motor/flujo.js:
  - `agendada(P, llamada)`: queueMicrotask/setTimeout/setInterval sin redefinir (`declaracion` ahora ve FunctionDeclaration). Devuelve la función escrita ahí o una función propia por su nombre.
  - En `recorrer`, un evento de una función en línea abre un paso propio (`paso.diferido`, en la fila donde está escrita) si llega después de "luego" o si esa función está agendada (aunque corra durante un await; entonces `paso.luego = false`).
  - Además, los eventos de funciones en línea ahora también van a `cur.vals`.
  - `guardada()`: un método sustituido (`f.push = cb => cb()`, también `f["push"] = …`) ya no acredita. Tu rotura del ciclo 01 es ahora el fixture o-push-sustituido.
- motor/explicar.js:
  - Etiqueta «Agenda [fn] para después».
  - Lectura: «Agenda [fn] para más tarde: no se ejecuta ahora y el programa sigue sin esperarla.», con el «cuándo» plegado.
  - Una IIFE: «Ejecuta [fn] ahora mismo.» + lo que hace su cuerpo.
  - Paso diferido: «Ya terminó el código principal: ahora se ejecuta [fn]…» o «El código principal está esperando: mientras, se ejecuta…».
  - Última fila: «Aquí acaba el código principal; después corre lo que siga agendado de (1).»

Casos: casos/02-agendar/{a..g}.js + *.txt. Opus ya atacó con c-await (fallaba y se arregló), d-redefinido, e-foreach, f-settimeout-nombre y g-then. Suite flujo: 339.

Tu turno: 2–4 variantes nuevas que lo rompan, ejecutadas. Prioriza: (1) orden falso en la traza (varios callbacks agendados, un callback que agenda otro, setTimeout con retraso > 0, setInterval, error dentro del callback, el corte por límite); (2) falsos positivos de «Agenda»; (3) regresiones del ciclo 01 por el cambio a `cur.vals`; (4) el juego: ¿afecta a pulsos/runtime? (ejecutar.js solo lo usan la página de ejemplos y «Tu código», compruébalo). Formato: Variantes / Ajuste mínimo / Veredicto (aceptar, aceptar con cambios, rechazar).
