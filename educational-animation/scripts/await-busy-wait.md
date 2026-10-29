# Guion · `await` frente a polling ocupado

**Duración objetivo:** 20–40 s (con los parámetros por defecto ≈ 23 s).
**Parámetros:** [`shared/await-pilot.json`](../shared/await-pilot.json). Los tiempos de abajo se derivan de ahí con `cues()` en [`shared/awaitPilot.ts`](../shared/awaitPilot.ts).

## Objetivo de aprendizaje

El jugador distingue entre **comprobar repetidamente sin pausa** (polling ocupado) y **esperar a que una operación real avise** (`await` sobre una promesa).

## Malentendidos que hay que evitar

- «`await` siempre es eficiente / siempre libera un hilo». Depende del lenguaje, la promesa y el entorno.
- «Todo código sin `await` es espera activa». No: solo el bucle que comprueba sin pausa.
- «Mientras uno espera, el otro trabaja en paralelo». La escena no habla de concurrencia; solo de qué hace cada uno mientras espera.

## Cues semánticos (para sincronizar con la voz)

| Cue | Por defecto | Qué ocurre | Frase de narración (borrador) |
|---|---|---|---|
| `intro` | 0 s | Título y código de ambos lados | «Dos robots esperan la misma caja.» |
| `busyStart` | 3 s | El de la izquierda empieza a agacharse; se ilumina el `while` | «Este comprueba una y otra vez si ya llegó.» |
| aceleración | 3 → ~11 s | El contador sube cada vez más rápido hasta volverse una mancha | «…y otra, y otra…» |
| `staggerStart` | ~11 s | Deja de comprobar, se tambalea | — (silencio cómico) |
| `collapseEnd` | ~13 s | Se desploma | — |
| `shrugStart` | ~14 s | El de la derecha mira atrás y se encoge de hombros | «Este otro dijo: avísame cuando llegue.» |
| `boxArrives` | 17 s | Caen las cajas; se ilumina la línea siguiente al `await` | «La caja llega, y el programa sigue.» |
| `outroStart` | ~19 s | Mensaje final y matiz | Lee el `takeaway`. |

Cuando haya voz grabada, sustituir los segundos de `timing` por las marcas de palabra (p. ej. de un forced aligner) en lugar de ajustar a ojo.

## Casos límite a revisar (principio 7)

1. **JavaScript de un solo hilo:** un `while` síncrono que bloquea el event loop impide que llegue *cualquier* aviso del mismo hilo; la caja nunca llegaría. Por eso el ejemplo usa `sensor.hayCaja()` (un valor que cambia fuera del programa, como un registro de hardware), no una promesa del mismo hilo. ¿Lo entiende así un espectador? Validar con personas.
2. `await` en un entorno que no libera nada (p. ej. un `await` sobre algo ya resuelto): no hay ahorro que mostrar.
3. Polling *con pausa* (`await esperar(1)` en bucle) es legítimo y común en el propio juego (`yo.esperar`). No ridiculizarlo: la escena es sobre polling **sin pausa**.
4. El personaje que espera no está «haciendo otras cosas»: está quieto. No sugerir ejecución simultánea.
