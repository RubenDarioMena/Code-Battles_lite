# Caso 03 · Crear un generador frente a consumirlo

**Pregunta para el lector:** ¿se imprime «cuerpo»? Y si se imprime, ¿antes o después de «fin»?

| Archivo | Programa | Consola |
|---|---|---|
| `a-creado.js` | `function* g(){ console.log("cuerpo"); } g(); console.log("fin");` | `fin` |
| `b-consumido.js` | igual, con `g().next();` | `cuerpo / fin` |

Reproducir: `node educational-animation/revision/pruebas/caso.cjs <archivo.js> [--lectura]` (salidas `*.txt`).
Capturas «antes»: fuera del repo, en el informe final de Opus.

## Qué se ve hoy: es FALSO, no solo ambiguo
- `a-creado`, lectura fila 1: «Ejecuta la función g ((3)) y, cuando acaba, sigue aquí.» Falso: el cuerpo no se ejecuta.
- `a-creado`, traza fila 1: «Llama a [g()]: sigue en (3). [g()] devolvió «{}».» Falso, porque no va a (3); además, el generador sale como `{}`.
- Fila 3 (las dos): «Define la función g. Su cuerpo, la fila (4), se ejecuta cuando alguien la llama.» No dice que es un generador
  ni que llamarla no ejecuta el cuerpo.
- `b-consumido`, lectura fila 1: «Ejecuta [g().next()].» No dice que `next()` ejecuta el cuerpo hasta el primer `yield` (o hasta el final).
- `b-consumido`, traza: la fila 1 muestra «→ {"done":true}» y **después** viene el paso 4 «Escribe "cuerpo"». El resultado
  de `next()` se narra antes que el cuerpo que lo produce.
- Resumen final: «Las funciones de (3) solo se ejecutan si alguien las llama.» En `a`, alguien la llamó y aun así no se ejecutó.

## Evidencia (Opus)
- Eventos `a-creado`: 10 (g();), 11 g() = `{}`, 13, 14. No hay ningún evento del cuerpo.
- Eventos `b-consumido`: 10, 13 g() = `{}`, 4 y 5 (cuerpo), 11 g().next() = `{"done":true}`, 16, 17.
- La tabla de nodos no marca `generator` (`motor/trazador.js:46-53` copia `async` solo en Python). Hoy solo se sabe por el
  texto (`function*`, `*metodo()`) o por un `yield` dentro.
- `V(x)` del trazador (`motor/trazador.js:171-173`) serializa el objeto generador con `JSON.stringify` → `{}`.
- El juego usa el mismo trazador para los pulsos. Cualquier cambio en `V` o en la tabla de nodos lo comparte.

## Variantes cercanas
- `const it = g(); it.next(); it.next();` con `yield` en medio: cada `next()` avanza hasta el siguiente `yield`.
- `for (const x of g())`, `[...g()]`, `Array.from(g())`: consumen el generador entero.
- Contraejemplo: una función normal `function h(){…} h();` sí ejecuta el cuerpo. Una `async function` también corre hasta su primer `await`.
- Python: `def g(): print("cuerpo"); yield` y `g()` frente a `next(g())` (solo lectura).

---

## Registro del ciclo (Opus implementa · Astra diagnostica y ataca, `codex exec`, esfuerzo alto, solo lectura)

| Turno | Quién | Resultado |
|---|---|---|
| Caso | Opus | Par, evidencia y capturas «antes». El motor afirmaba algo falso: «Ejecuta la función g y, cuando acaba, sigue aquí». |
| Diagnóstico | Astra (`astra-1.md`) | Marcar `generador` en la tabla (acorn ya lo da) sin tocar `V`. Separar en la traza «pide avanzar → cuerpo → resultado». **Fallo nuevo:** en Python, un `yield` sin valor daba `SyntaxError`. |
| Implementación 1 | Opus | Marca `generador` (JS y Python), `creaGenerador`/`avance`, paso `regreso`, frases. Opus se atacó a sí mismo: faltaba decir qué hace una fila `yield` («se para y entrega») y el `next()` dentro de otra sentencia. Se corrigió. |
| Ataque | Astra (`astra-2.md`) | **Rechazo** con 3 fallos: una `function*` reasignada seguía siendo «generador», `yield*` inventaba el valor y `await it.next()` narraba el resultado antes del cuerpo. |
| Implementación 2 | Opus | Una reasignación invalida la acreditación. `delega` en la tabla y frases de delegación. El disparo del regreso es el `await`. De paso: `g = () => …` ya no «pasa a valer undefined». |
| Ataque 2 | Astra (`astra-3.md`) | **Rechazo** con 2 fallos: con `g` reasignada, seguía enlazando al cuerpo antiguo, y un `next()` async sin `await` prometía «después sigue aquí». |
| Cierre | Opus + Astra (`astra-4.md`) | Un nombre reasignado sale de `P.funciones`, y hay frase propia para el `next()` async sin `await`. **Astra: «aceptar».** |

**Respuesta a la pregunta:**
- Fila 1: «Crea un generador con [g()]: todavía no ejecuta el cuerpo» frente a «Pide el siguiente valor a [g()]».
- Fila 3: «Generador g()…», cuyo cuerpo «corre a trozos».
- Traza: pide → cuerpo → «Vuelve de [g().next()]…».

Imagen: `antes-despues.png`.

**Límites:**
- Con tablas antiguas sin marca, solo se acreditan `function*`, `yield*` y `yield from`; el resto lleva una frase neutral.
- El objeto generador sigue apareciendo como `{}` en la píldora de la traza: no se tocó `V`, que comparte el juego.
- Un `for (x of …) sentencia` sin llaves no da pasos por vuelta (pasa igual con arrays).
- Si un `next()` vuelve sin que su cuerpo genere pasos (`yield*` reanudado), no hay paso de «pide».
- Python solo tiene lectura.

**Siguiente ciclo:** a elegir. Pendientes vistos: la píldora `undefined`/`{}` en las filas que agendan o crean, el vaciado final del Worker para los pulsos de callbacks y el `for…of` sin llaves.

Fixtures: `pruebas/flujo.cjs` § «Crear un generador frente a consumirlo» (30 comprobaciones).
