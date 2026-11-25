# Runtime del laboratorio frente al anfitrión e intérprete de trunk

Type: research
Label: wayfinder:research
Status: resolved
Blocked by: —

## Question

¿Qué capacidades del runtime del laboratorio (`ccr-684f16c6-yq5at1:laboratorio/batalla/js/runtime.js`) existen ya en el `anfitrion` + `interprete` de trunk, cuáles faltan y qué costaría cada una?

- varios hilos por programa (cuerpo y oyentes);
- entrega de entradas del jugador entre pasos fijos (lockstep);
- grabación y repetición de entradas;
- errores aislados por unidad;
- «aplicar ahora», que reinicia un programa en caliente;
- reaparición con el programa desde la primera línea;
- espera asociada a una orden (`await arrive()`).

Indicar también si el intérprete de trunk (sin Workers, cola propia) hace más barato o más caro lo que el laboratorio resolvió con un Worker por unidad.

## Pistas

`paquetes/anfitrion/{anfitrion,unidad,api,despertar,canal}.js`, `paquetes/interprete/README.md`, `paquetes/anfitrion/README.md`; en ccr, `runtime.js`, `mundo.js` y `docs/PROPUESTA-MECANICAS-BATALLA.md` («Qué haría falta para llevarlo a War o Campaign»).

## Answer

Detalle con líneas en [`research/02-runtime-laboratorio-vs-anfitrion.md`](../research/02-runtime-laboratorio-vs-anfitrion.md). Estado en `origin/trunk`:

| Capacidad | Trunk | Evidencia clave | Archivos a tocar |
|---|---|---|---|
| Varios hilos (cuerpo + oyentes) | Missing (War), partial (Campaign: varias esperas, sin oyentes) | `api.js:200,203,288`; `anfitrion.js:60-61`; `api.js:57,82`; `despertar.js:13` | `api.js`, `anfitrion.js`, `despertar.js`, `index.d.ts`, traductor Python |
| Entradas del jugador entre pasos | Partial: lockstep y `origen:'jugador'` existen; no hay canal al programa | `conductor.js:94-109`; `protocolo/index.js:8`; `anfitrion.js:83,87` | `anfitrion.js`, `conductor.js`, `ciclo-programas.js`, `reglas-war` |
| Grabar/repetir entradas | Partial: se repiten órdenes, no programas ni clics | `nucleo/index.js:126-149` | `reglas-war/mundo.js` (verbos), `nucleo` (guardar reprogramaciones) |
| Errores aislados por unidad | Missing en anfitrión/juego (un `error` global termina la partida); presente en el intérprete | `anfitrion.js:34,43-50`; `conductor.js:53,97`; `ciclo-programas.js:156-178`; `unidad.js:62-69` | `anfitrion.js`, `conductor.js`, `ciclo-programas.js` (cambia las 41 referencias si no es opcional) |
| «Aplicar ahora» | Missing (`cargar` falla si la unidad existe; «Ejecutar» recrea todo) | `anfitrion.js:147`; `ciclo-programas.js:22,60,63` | `anfitrion.js` (`recargar`), `ciclo-programas.js`, `pulsos.js` |
| Reaparición desde la 1ª línea | Missing: War no modela destrucción ni reposición de lanzadores | `reglas-war/mundo.js` (solo `e.muerto` enemigos) | reglas + `recargar` + conductor lee el suceso |
| `await arrive()` | Partial: el patrón encargo/respuesta/`resultado` existe; faltan `moveTo`/`arrive` y unidades móviles en War | `api.js:77,283,288`; `conductor.js:59-64`; `anfitrion.js:66-71`; `api.js:272` | `api.js`, `war.js`, `anfitrion.js`, `reglas-war/mundo.js` |

**Intérprete sin Workers:** más barato crear/destruir unidades (reprogramar, reaparecer), orden determinista y presupuesto por tarea en vez de vigía de 2,5 s. Más caro o sin resolver: interpretar en lugar de JIT (no se leyeron las cifras de `docs/qa/interprete-2026-11-17`), y falta el contador de hilos activos que en el laboratorio sale de los Workers. No se midió nada.
