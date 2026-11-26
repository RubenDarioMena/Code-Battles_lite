# QA en el navegador · Campaign-V2 nivel 1 completo · 26-nov-2026

**Estado:** parcial (se actualiza y se sube tras cada etapa).

- Rama `Campaign-V2`, worktree `Code-battle-lite-cv2`. Servidor sin caché (`.claude/servidor-sin-cache.py`, puerto 8779). Página `Prototypes/Campaign-V2/index.html`.
- Navegador incorporado de la app (herramientas `mcp__Claude_Browser__*`), viewport 1024×768. El panel estaba oculto, así que se sustituyó `requestAnimationFrame` por un `setTimeout` de 16 ms tras cada carga, como indica la tarea.
- Programas: los de `docs/campaign-v2-soluciones-nivel-1.html`. Se escribieron con el editor (CodeMirror) en B1 y en otras etapas indicadas en la tabla; en el resto, con `__banco.programas[id] = …`.
- Partida limpia: borradas las claves `campaign-v2*` de `localStorage` (ver hallazgo M1: hay que hacerlo con la página cerrada).
- Turbo ×4 en las Batallas salvo que se diga otra cosa. Los tiempos son de simulación.
- No se ha corregido código: solo se informa.

## Tabla por etapa

| Etapa | Resultado | Tiempo (sim) | Brechas / derribos | Bodega antes → después | Errores de consola | Vía del programa | Notas |
|---|---|---|---|---|---|---|---|
| H0 · Llegada | cumplido | 4,8 s | — | 48 → 48 | 0 | programa de partida | Tarjeta «H0 · Llegada · cumplido» con bodega 48 y «checkpoint guardado». Recargar en la tarjeta lleva directo a B1. |
| B1 · Primer blanco | victoria | 35,9 s | 0 / 6 | 48 → 37 | **1** (A1) | editor (tecleado) | 12 misiles gastados. Recarga a los 10 s: la Batalla vuelve a t = 0 con el programa conservado. |
| H1 · Máquina rápida | cumplido | ≈ 34 s de planta (40,8 → 75,0) | — | 37 → 37 | 0 | editor (ARM-01) | Luz de PRS-01 verde mientras prensa. La recarga «a mitad» llegó tarde: el hito ya se había cumplido y la recarga saltó la tarjeta y abrió B2 directamente (el checkpoint de B2 estaba guardado). |
| B2 · Prioridades | **bloqueada (C1)**; victoria con parche de consola | 34,7 s | 0 / 13 | 37 → 18 | 1 (A1) + error de programa falso (C1) | `__banco.programas` + `abrirPrograma` | Sin parche, *cualquier* programa (incluso vacío) termina en «Error en el programa de LAU-01 · Cannot read properties of undefined (reading 'id')» a los 3,0 s; 5 intentos y una recarga. En `?ensayo=b2` el mismo programa va bien. Con el parche: 20 misiles gastados, 13/13. |
| H2 · Dos brazos | cumplido | ≈ 44 s de planta (109,6 → 153,3) | — | 18 → 18 | 0 | `__banco.programas` + `abrirPrograma` (FRK-01, ARM-02); ARM-01 seguía con el de H1 | PAL-3 movida con la interfaz real: seleccionar → «Mover» → toque junto a ARM-02 → barra ↻ ✓ ✕ → ✓. Quedó en (86,97; 47,59), a 2,2 m de ARM-02 (alcance 2,8); aviso «PAL-3 colocado.». Luces: ver M4. Al cumplir, BAY-1 pide acero (llega a +3 s) y polímero (+6 s): B3 empezará con dos pedidos en camino (C1). |

## Hallazgos (por gravedad)

### Crítica

- **C1 · B2 no se puede jugar en la campaña: la llegada de un pedido a BAY-1 durante la Batalla se atribuye como error al programa de LAU-01.** Al cumplir H1, la fábrica pide 12 de polímero que llegan 3,0 s después (`BAY-1.pedidos[0].llega = 77,95` con la planta en 74,95). La fábrica sigue corriendo durante B2, y a los 3,0 s de Batalla emite el suceso `entrega-pedido`. `ciclo-programas.js:221` llama a `ctx.entregaCampaign(ctx.mundo.porId[s.unidad], d)`, pero en la Batalla `ctx.mundo` es el mundo de la Batalla y `porId["BAY-1"]` es `undefined`; `entregaCampaign` (`campaign.js:85`) lee `bahia.id` y lanza. El `.catch` de `avanzar` (`ciclo-programas.js:253-254`) lo achaca al programa seleccionado: «Error en el programa de LAU-01 · Cannot read properties of undefined (reading 'id')» e «Ir a la línea» señala `await esperar(0.5)`.
  - Comprobado: pasa con el programa de la guía, con el de B1, con `log(pos)`, con `while (true) { await esperar(0.5); }` y con `// nada`. Siempre a t = 3,0 s. En `?ensayo=b2` (sin fábrica) no pasa.
  - Confirmación: con `setInterval(() => { const p = __banco.mundo?.porId; if (p && !p["BAY-1"]) p["BAY-1"] = { id: "BAY-1" }; }, 20)` en la consola, B2 pasa de los 3 s y se gana. **Ese parche de consola se usó para seguir la campaña** en las Batallas siguientes en las que hacía falta (se indica en la tabla).
  - Es probable que afecte a toda Batalla que empiece con un pedido de BAY-1 en camino (cada hito de fábrica que pide material al cumplirse).
  - Reproducir: partida limpia → H0 → B1 → H1 con los programas de la guía → B2 con cualquier programa → Ejecutar → a los 3 s, error.

### Alta

- **A1 · Error no capturado al terminar una Batalla y pasar a la fábrica.** `TypeError: Cannot read properties of undefined (reading 'map')` en `paquetes/vista-3d/cv2/index.js:148` (`e.enemigos.map`), desde `bucle.js:16`. Sale una vez, justo cuando se gana B1 y aparece la tarjeta «superado» (la vista 3D de Batalla recibe una instantánea sin `enemigos`). La simulación sigue y la tarjeta funciona.
  - Reproducir: partida limpia → H0 → B1 con el programa de la guía → al ganar, leer la consola.

### Media

- **M1 · El borrado de la campaña desde la consola no funciona con la página abierta.** La guía (sección «Partida guardada») propone borrar las claves `campaign-v2*` en la consola y recargar. Con `index.html` abierto, al recargar el guardado en vivo vuelve a escribir las claves antes de salir y la partida reaparece (en esta prueba volvieron los programas de H6 de una sesión anterior). Funciona si se borra desde otra página del mismo origen (p. ej. `/`) o con el botón del menú de pruebas.
  - Reproducir: abrir `index.html` con una partida avanzada → consola: `Object.keys(localStorage).filter(k => k.startsWith("campaign-v2")).forEach(k => localStorage.removeItem(k))` → recargar → los programas siguen ahí.
- **M2 · `__banco.programas[id] = …` seguido de recarga pierde el programa.** La guía dice «Escribe un programa sin el editor (después recarga o vuelve a abrirlo)». Al recargar, el guardado de salida escribe el texto que hay en el editor y el programa asignado desaparece. «Volver a abrirlo» sí funciona (`__banco.abrirPrograma(id)` o tocar su pestaña).
  - Reproducir: en B2, `__banco.programas["LAU-01"] = "…"` → recargar → el editor y `__banco.programas["LAU-01"]` muestran el programa anterior.
- **M4 · Una máquina parada por falta de material luce verde.** En H2, PRS-01 sin proceso, sin acero en la entrada y con `tSinMaterial` creciendo (111 s) tenía `luz = "green"`; MLD-01 igual mientras esperaba polímero. El programa de luz de partida es `light(outputFull ? "amber" : "green")`: solo pone ámbar con la salida llena, no cuando la máquina espera material. Choca con la regla «ámbar = espera, verde = trabajando».
  - Reproducir: H2 con los programas de la guía → mirar PRS-01 cuando ARM-01 espera acero: verde.
- **M3 · Bodega muy justa para B4.** La bodega empieza en 48; B1 gasta 12 (→ 37) y B2 gasta 20 (→ 18). H1–H3 no fabrican misiles, así que B3 y B4 llegan con menos de 20, lejos de los ~45 que necesita B4 (ver filas B3–B4).

### Baja / observaciones

- **O1 · El selector de checkpoints ofrece todas las Batallas desde el principio.** En H0 el menú ⋯ → Checkpoint lista H0, B1…B8 y SALIDA (`etapasDisponibles` solo filtra los hitos de fábrica). Se puede saltar a B8 o al banco «SALIDA» sin haber jugado nada. Si es intencionado (Batallas siempre rejugables), conviene ocultar SALIDA en la campaña.
- **O2 · Recargar a mitad de una Batalla la reinicia a t = 0.** El programa se conserva; el intento no. Probablemente intencionado (la fábrica sí guarda en vivo), pero no se avisa.
- **O3 · HUD de H0 adelantado.** Al cumplir H0, la barra ya muestra la meta de H1 («ojiva en PAL-2 0/6») mientras el título sigue en «Llegada».
- **O4 · Contador de derribos con un fotograma de retraso.** Al ganar B1, el HUD decía «Derribados 5/6» mientras la tarjeta ya decía 6/6; un instante después el HUD pasó a 6/6.
