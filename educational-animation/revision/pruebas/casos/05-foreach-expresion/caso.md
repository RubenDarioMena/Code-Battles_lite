# Caso 05 · `forEach` con cuerpo expresión frente a cuerpo bloque

**Pregunta para el lector:** ¿cuántas vueltas da y qué vale `x` en cada una?

| Archivo | Programa | Consola |
|---|---|---|
| `a-expresion.js` | `[1, 2].forEach(x => console.log(x)); console.log("fin");` | `1 / 2 / fin` |
| `b-bloque.js` | `[1, 2].forEach(x => { console.log(x); }); …` | `1 / 2 / fin` |

Misma semántica, dos vistas distintas (como en el ciclo 04).

## Qué se ve hoy
- `b`: «Por cada [x] de [[1, 2]]» con su fila de cuerpo, «Vuelta 1: [x] = «1»», «Escribe "1"»…
- `a`: una sola fila «[[1, 2].forEach(x => console.log(x))]», «Ejecuta […]», traza «→ «undefined»». Ni vueltas ni lo que imprime.

## Evidencia (Opus)
- `motor/flujo.js:78` (`forEach()`): exige `BlockStatement` como cuerpo.
- `motor/trazador.js:74`: el gancho de vuelta `__T.c(id, x)` solo se inserta tras la llave del cuerpo.
- El cuerpo expresión no es una sentencia: hoy no puede ser una fila (las filas salen de sentencias y sus pasos de eventos `s`).
- En el ciclo 01, lo que corre dentro de una flecha en línea va a `paso.lecturas`/`vals` del paso que la llama.

## Variantes cercanas
- `lista.forEach(function (x) { … })` (ya va) y `forEach(function (x) { return … })`.
- `forEach((x, i) => …)`, `forEach(x => cond ? a(x) : b(x))`, `forEach(x => (a(x), b(x)))`.
- Contraejemplos: `map(x => …)` y `filter(x => …)` (devuelven valor; no son «por cada» hoy), `forEach(f)` con una función por nombre.
- Pulsos del juego: el mismo gancho de forEach está en el trazador compartido.

---

## Registro del ciclo (Opus implementa · Astra diagnostica y ataca, `codex exec`, esfuerzo **xhigh**, solo lectura)

| Turno | Quién | Resultado |
|---|---|---|
| Caso | Opus (par de Astra) | Misma semántica, dos vistas. Lo exigían `flujo.js:78` y `trazador.js:74`. Capturas «antes». |
| Diagnóstico | Astra (`astra-1.md`) | Una fila cuyo nodo es la propia expresión del cuerpo (sin inventar una sentencia). Instrumentación `x => (__T.c(id,x), __T.s(idExpr), expr)`. Tratamiento común de la expresión en etiqueta, lectura, traza y píldora. |
| Implementación 1 | Opus | `P.cuerpoExpr`, `FL.expresion()` y la envoltura. Con llaves, el código instrumentado es idéntico byte a byte (68 programas). |
| Ataque | Astra (`astra-2.md`) | **Rechazo**: un callback `async` daba una traza con resultados futuros e invertidos, un `forEach` anidado en el cuerpo no se reconocía y `x => y => x` se narraba como «Ejecuta». `l?.forEach` queda como límite. Pulsos idénticos a HEAD en 77 programas. |
| Implementación 2 | Opus | Un callback `async` no es un bucle (con llaves o sin ellas), y sus continuaciones salen como «sigue […], que se había quedado esperando», una por ejecución. `forEach` anidado: `cuerposForEach` y `sinValor`, para que su `undefined` no cuente como vuelta. «Crea la función […], sin llamarla». |
| Cierre | Astra (`astra-3.md`) | **Aceptar**. Verificó también tres niveles de anidamiento. |

**Respuesta a la pregunta:** `forEach(x => console.log(x))` ya se ve como «Por cada [x] de [[1, 2]]», con su fila «Imprime [x]» y las vueltas, igual que con llaves. Imagen: `antes-despues.png`.

**Límites:** `l?.forEach`, `forEach(f)` por nombre y `forEach` con segundo argumento conservan la representación genérica. Los callbacks `async` se muestran como llamadas y continuaciones, no como un bucle que espera sus promesas.

Fixtures: `pruebas/flujo.cjs` § «forEach con cuerpo expresión frente a bloque» (18 comprobaciones).
