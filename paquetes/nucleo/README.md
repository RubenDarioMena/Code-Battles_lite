# nucleo

Estado: fase 1.

Paso fijo, RNG con semilla, órdenes, sucesos y partidas sin pantalla. Módulo ES
con JSDoc y contratos en `index.d.ts`, sin compilación. Solo importa la entrada
pública de `protocolo`; funciona en Node y navegador.

## Contrato

- `DT = 0.05` y `avanzar(acum, mundo, control)` conservan el reloj anterior:
  avanza mientras el mundo está activo, no ha terminado y ningún programa corre;
  se detiene al despertar programas y devuelve el acumulador restante.
- `mulberry32(a)` conserva el generador de War; `crearRng(semilla)` conserva su
  siembra `(semilla * 2654435761) >>> 0`. `pasoDe(t)` redondea `t / DT`.
- `crearColaOrdenes()` ofrece `poner(orden)`, `tomar(paso)` y `pendientes()`.
  Valida con protocolo, copia al recibir y ordena por paso y llegada. `tomar`
  extrae las órdenes vencidas; `pendientes` devuelve copias.
- `crearRegistroSucesos({ limite = 2000 })` ofrece `anotar`, `desde(paso)`
  (inclusivo) y `vaciar`. Valida con protocolo y conserva copias independientes.
  Descarta los más antiguos al superar el límite, entero no negativo; cero
  desactiva la retención.
- `adjuntarSucesos(mundo, registro)` devuelve el registro existente o adjunta uno
  como propiedad no enumerable. Así queda fuera de guardados, JSON y clonación
  estructurada del mundo. `anotarSuceso(mundo, tipo, unidad, datos)` usa
  `pasoDe(mundo.t)`, omite campos opcionales nulos y no actúa sin registro.
- `crearPartida({ reglas, escenario, semilla })` devuelve `mundo`, `ordenar`,
  `paso`, `instantanea`, `sucesos(desdePaso = 0)`, `evaluar`, `serializar` y el
  lector `pasoActual`. Cada paso aplica las órdenes vencidas antes de avanzar
  el reglamento con `DT` e incrementar el contador. Las órdenes deben recibirse
  antes de ejecutar su paso para garantizar repetición exacta.

El reglamento aporta `{ id, version, crearMundo(escenario, rng), paso(mundo, dt),
aplicarOrden(mundo, orden), instantanea(mundo), evaluar(mundo) }`. El escenario
contiene datos planos; se copia antes de entregarlo al reglamento. La evolución
debe depender únicamente del escenario, la semilla y las órdenes.

- `copiaPlana(valor)` (fase 2): copia profunda de arreglos y objetos que
  conserva referencias compartidas y ciclos, omite las propiedades con
  funciones (Factory guarda una en `robot.tarea`) y copia por su valor los
  getters propios, también los no enumerables (`cx`/`cy` del robot de Factory). La usan las `escena(mundo)`
  de los reglamentos para entregar a las vistas datos planos independientes.

## Guardado por repetición

`serializar()` devuelve copias de datos planos
`{ reglas, version, escenario, semilla, paso, ordenes }`, incluidas todas las
órdenes recibidas en su orden de llegada, aplicadas o pendientes. No guarda
funciones ni el mundo. `restaurar(datos, reglas)` comprueba identificador y
versión, recrea la partida y repite los pasos. El RNG recupera su posición al
repetir; los sucesos se generan de nuevo con el límite habitual.

## Compatibilidad y pruebas

`Prototypes/Rocket Launcher/js/compat-paquetes.js` publica temporalmente
`DT` y `avanzar` en el juego. La herramienta de partidas importa el paquete.

```sh
node paquetes/nucleo/pruebas/nucleo.mjs
node pruebas/fronteras.mjs
npm run tipos
npm test
```

La suite propia cubre cortes y resto del acumulador, paridad literal del RNG,
órdenes estables y válidas, copias y límite de sucesos, no enumerabilidad,
determinismo y restauración con evolución posterior. Está registrada en
`pruebas/todas.mjs`; las referencias de fase 0 comprueban la paridad del juego.
