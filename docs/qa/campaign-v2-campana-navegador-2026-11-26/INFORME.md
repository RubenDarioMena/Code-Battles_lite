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

## Hallazgos (por gravedad)

### Alta

- **A1 · Error no capturado al terminar una Batalla y pasar a la fábrica.** `TypeError: Cannot read properties of undefined (reading 'map')` en `paquetes/vista-3d/cv2/index.js:148` (`e.enemigos.map`), desde `bucle.js:16`. Sale una vez, justo cuando se gana B1 y aparece la tarjeta «superado» (la vista 3D de Batalla recibe una instantánea sin `enemigos`). La simulación sigue y la tarjeta funciona.
  - Reproducir: partida limpia → H0 → B1 con el programa de la guía → al ganar, leer la consola.

### Media

- **M1 · El borrado de la campaña desde la consola no funciona con la página abierta.** La guía (sección «Partida guardada») propone borrar las claves `campaign-v2*` en la consola y recargar. Con `index.html` abierto, al recargar el guardado en vivo vuelve a escribir las claves antes de salir y la partida reaparece (en esta prueba volvieron los programas de H6 de una sesión anterior). Funciona si se borra desde otra página del mismo origen (p. ej. `/`) o con el botón del menú de pruebas.
  - Reproducir: abrir `index.html` con una partida avanzada → consola: `Object.keys(localStorage).filter(k => k.startsWith("campaign-v2")).forEach(k => localStorage.removeItem(k))` → recargar → los programas siguen ahí.

### Baja / observaciones

- **O1 · El selector de checkpoints ofrece todas las Batallas desde el principio.** En H0 el menú ⋯ → Checkpoint lista H0, B1…B8 y SALIDA (`etapasDisponibles` solo filtra los hitos de fábrica). Se puede saltar a B8 o al banco «SALIDA» sin haber jugado nada. Si es intencionado (Batallas siempre rejugables), conviene ocultar SALIDA en la campaña.
- **O2 · Recargar a mitad de una Batalla la reinicia a t = 0.** El programa se conserva; el intento no. Probablemente intencionado (la fábrica sí guarda en vivo), pero no se avisa.
- **O3 · HUD de H0 adelantado.** Al cumplir H0, la barra ya muestra la meta de H1 («ojiva en PAL-2 0/6») mientras el título sigue en «Llegada».
- **O4 · Contador de derribos con un fotograma de retraso.** Al ganar B1, el HUD decía «Derribados 5/6» mientras la tarjeta ya decía 6/6; un instante después el HUD pasó a 6/6.
