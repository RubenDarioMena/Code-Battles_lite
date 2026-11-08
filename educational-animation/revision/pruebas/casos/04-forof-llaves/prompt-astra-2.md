Ciclo 04 · turno 2 de Astra (rol: romper la implementación). Opus implementó tu propuesta, sin commitear (`git diff`). Máximo ~450 palabras.

Cambios:
- motor/trazador.js: for…of/for…in con cuerpo sin llaves → `abrir(body.start, "{__T.c(id,x);", profBucle)` + `cerrar(body.end, "}", profBucle)`, por fuera del `{__T.s(…);…}` de la sentencia suelta. Con llaves, nada cambia: 51 programas de casos/ejemplos dan un código instrumentado idéntico byte a byte al de HEAD, y solo cambian los 9 sin llaves.
- Prototypes/Rocket Launcher/js/pulsos.js: el filtro de `c` exige `campo === "test"` (tu hallazgo).
- explicar.js: una desestructuración ya no dice `[a, b] = true`, sino «Vuelta n: [[a, b]] toma el siguiente elemento».
- motor/flujo.js, **fallo previo que encontró Opus**: `continue fuera`/`break fuera` iban al bucle más cercano. Ahora un salto con etiqueta solo lo consume el bucle cuya LabeledStatement lleva esa etiqueta (`saltoA`); los demás se propagan hacia fuera.
- Fuera de este ciclo: `forEach(x => expr)` con cuerpo expresión (requiere representar la expresión en el diagrama).
Fixtures: casos/04-forof-llaves/{a..k}. Flujo 397.

Tu turno: 2–4 variantes nuevas, ejecutadas, que lo rompan. Prioriza:
(1) instrumentación: ASI y saltos de línea (cuerpo en la línea siguiente, comentarios entre la cabecera y el cuerpo, cuerpo `if…else` anidado, `for await`, un cuerpo que es otro for…of sin llaves, cuerpo `class`/`function` (inválido sin llaves en estricto), cuerpo con etiqueta);
(2) los pulsos del juego con el filtro nuevo: compara con HEAD (`git show HEAD:…`) el código instrumentado con el filtro de pulsos para programas del juego (Prototypes/Rocket Launcher/js/pulsos.js) y di si cambia algo más que lo esperado;
(3) etiquetas: `break` con etiqueta de un bloque que no es un bucle (`b: { … break b; }`), etiquetas en un switch, `continue` con etiqueta dentro de un forEach, etiquetas con el mismo nombre anidadas en funciones distintas;
(4) regresiones de los ciclos 01–03.
Formato: Variantes / Ajuste mínimo / Veredicto.
