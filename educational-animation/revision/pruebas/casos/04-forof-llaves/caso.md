# Caso 04 · `for…of` con llaves frente a sin llaves

**Pregunta para el lector:** ¿cuántas vueltas da el bucle y qué vale `x` en cada una?

| Archivo | Programa | Consola |
|---|---|---|
| `a-sin-llaves.js` | `for (const x of [1, 2]) console.log(x); console.log("fin");` | `1 / 2 / fin` |
| `b-con-llaves.js` | lo mismo con `{ console.log(x); }` | `1 / 2 / fin` |

Mismo comportamiento: la vista debería ser **igual**. Aquí el par mínimo es al revés que en los ciclos anteriores: una diferencia
de forma, sin efecto en la semántica, que hoy cambia lo que se ve.

## Qué se ve hoy
- `b` (con llaves): «1 Vuelta 1: [x] = «1».» → «2 Escribe "1"» → «1 Vuelta 2: [x] = «2».» → …
- `a` (sin llaves): «1 Entra en el bucle.» → «2 Escribe "1"» → «2 Escribe "2"». No hay vueltas ni valor de `x`, y la franja de
  tiempo no tiene tramos por vuelta.
- La lectura es igual en los dos («Repite la fila (2) una vez por cada [x] de [1, 2]»).

## Evidencia (Opus)
- `motor/trazador.js:66`: el gancho `__T.c(idBucle, x)` de cada vuelta de for…of/for…in **solo se pone si el cuerpo es un
  BlockStatement**, porque se inserta tras la llave de apertura (`abrir(n.body.start + 1, …)`). Lo mismo para `forEach(x => …)` sin
  llaves (`trazador.js:74`).
- Eventos `a`: 1 (for), 8/13/9 (vuelta 1), 8/13/9 (vuelta 2). Falta `[1, valor]` por vuelta. En `b` sí está: `1 = 1`, `1 = 2`.
- El trazador lo comparte el juego (`Prototypes/Rocket Launcher/js/pulsos.js`, con un filtro de ganchos), y cualquier cambio de
  instrumentación tiene que conservar líneas, semántica y rendimiento del Worker.

## Variantes cercanas
- `for (const k in obj) …`, `for (x of …)` sin declaración, desestructuración `for (const [a, b] of …)`.
- `lista.forEach(x => console.log(x))` (cuerpo expresión) frente a `forEach(x => { … })`.
- Cuerpo sin llaves que es otro bucle o un `if`: `for (const x of l) if (x) console.log(x);`
- `continue`/`break` en un for…of sin llaves (`for (const x of l) if (x > 1) break;`).
- Python: `for x in l: print(x)` en una línea (solo lectura).

---

## Registro del ciclo (Opus implementa · Astra diagnostica y ataca, `codex exec`, esfuerzo **xhigh**, solo lectura)

| Turno | Quién | Resultado |
|---|---|---|
| Caso | Opus | Par al revés: la misma semántica con dos vistas distintas. Causa: `trazador.js:66`. Capturas «antes». |
| Diagnóstico | Astra (`astra-1.md`) | Enumeró las formas afectadas (for…in, sin declaración, desestructuración, for await y forEach con cuerpo expresión) y propuso envolver el cuerpo como `{__T.c(id,x); sentencia}` sin tocar los que llevan llaves. **Fallos previos:** el filtro de pulsos aceptaba cualquier hijo de un `if` (`pulsos.js:51`), y la desestructuración narraba `= true`. |
| Implementación 1 | Opus | La envoltura, el filtro `campo === "test"` y «toma el siguiente elemento». Los 51 programas con llaves dan un código instrumentado idéntico byte a byte. Opus encontró otro **fallo previo**: `continue fuera` iba al bucle más cercano. Lo corrigió con `saltoA`. |
| Ataque | Astra (`astra-2.md`) | Instrumentación y pulsos aceptados: comparó 68 programas con HEAD y solo cambia el gancho espurio. **Aceptar con cambios** en las etiquetas: dos etiquetas sobre un bucle, el `break` de un bloque etiquetado y un `break fuera` que atraviesa un `switch`. |
| Cierre | Opus + Astra (`astra-3.md`) | `etiquetasDe`, bloques con etiqueta, el `switch` propaga los ajenos y `destino` en cada `break` (bucle, switch o bloque), con sus frases. **Astra: «aceptar».** |

**Respuesta a la pregunta:** sin llaves ya se ven «Vuelta 1: [x] = «1»», «Vuelta 2…» y los tramos de la franja, igual que con llaves. Imagen: `antes-despues.png`.

**Límites:**
- `forEach(x => expr)` con cuerpo expresión sigue sin vueltas: hay que representar la expresión en el diagrama (ciclo 05 propuesto por Astra).
- `do…while` cuenta una sola vuelta, con llaves o sin ellas (ya pasaba antes).
- No se repitió `pruebas/juego.mjs` (falta Playwright). La equivalencia de pulsos la comprobó Astra comparando el código instrumentado con HEAD.

Fixtures: `pruebas/flujo.cjs` § «for…of con llaves frente a sin llaves» (19 comprobaciones).
