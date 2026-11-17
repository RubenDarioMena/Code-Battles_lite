# anfitrion

Estado: fase 5, paso 3. War, Factory y Campaign ejecutan sus programas con
unidades del intérprete, en el hilo principal y sin Workers.

Ejecuta los programas del jugador contra un reglamento y recoge órdenes y avisos.
El juego y la herramienta sin pantalla usan el mismo intérprete y presupuesto
por tarea. El resto de la aplicación conserva el canal de mensajes histórico.

## Puede importar

`nucleo`, `protocolo`, `lenguaje`, `interprete`. Véanse las reglas de [paquetes](../README.md).
No importa reglamentos: las funciones de validación que necesita el Worker se
reciben como argumentos.

## Contrato vigente

- `fuenteTrabajador({ validarFactory, validarCampaign, modoCampaign, preludioPython })`
  devuelve el texto del Worker, **idéntico byte a byte** al que construía
  `js/runtime.js` (comprobado contra `fb9a8e9`). Cada pieza es una función (se
  copia su `toString()`) o una cadena. Sin pieza se usan los valores de antes:
  `() => null` y, para el modo de Campaign, `() => 'ok'`. Las funciones deben ser
  **autocontenidas**: `validar` de Factory y Campaign y `modoEnSnap` de Campaign
  lo son, y sus suites las evalúan desde su texto en un contexto vacío.

### Unidad determinista

`crearTrabajadorInterprete({ acorn, presupuesto = 600000, mensajePresupuesto? })`
devuelve `crearTrabajador(fuente, unidad, recibir, maxOrdenes = 4000)`:

- Ejecuta el texto completo del arnés histórico con `crearInterprete`. Acorn se
  inyecta: script clásico en el juego, distribución local en Node.
- `postMessage` clona inmediatamente; `entregar()` ejecuta una tarea FIFO y vacía
  los trabajos del intérprete y sus salidas síncronamente. Los temporizadores son
  locales, virtuales y ordenados por vencimiento/id; no avanzan la simulación.
- Cada tarea reinicia el presupuesto de **600 000 nodos**, incluyendo el código
  de la API y las microtareas. Un límite menor altera `factory-limite-sensores`.
  `CBL_PRESUPUESTO` se entrega como `{ type: 'error', mensaje, linea, code }`,
  con la línea del intérprete. `mensajePresupuesto(unidad)` permite inyectar el
  texto de catálogo; no usa el último pulso ni reloj real.
- `terminate()` cancela colas/timers y llama a `liberar()`, idempotentemente;
  `medir()` permite comprobar la liberación. No ejecuta continuaciones al cerrar.
  Los límites de memoria/operaciones nativas son los del README de `interprete`.

El juego lo compone con `crearConductor` en `paquetes/app/juego/ciclo-programas.js`, sin puente clásico.
La herramienta usa `crearAnfitrion` y `jugarPartida` mediante
`herramientas/partida/jugar.mjs`. Ambos reciben las mismas piezas del Worker.
`despertarCampaign` es un auxiliar interno; el despertar de War/Factory forma
parte de `crearAnfitrion`. No hay funciones públicas para el ciclo anterior.

## `crearAnfitrion` (War, Factory y Campaign)

`crearAnfitrion({ reglas, crearTrabajador, contexto?, piezas?, maxOrdenes = 4000, ahora? })`:

- `crearTrabajador(fuente, unidad, recibir)` devuelve una unidad con `postMessage`,
  `terminate` y `entregar()` síncrono: el anfitrión la bombea por unidades.
  Conserva compatibilidad con adaptadores asíncronos sin `entregar`, a los que
  espera por mensajes; la VM sigue disponible para comparación sin pantalla.
- `contexto` completa el mensaje `run`: `nombres` (unidades nombrables),
  `tipos`, `sensores` y `conf`; por defecto, de `reglas.api` (War añade
  `api.conf` en este paso).
- `await cargar(unidad, codigo, { lenguaje })`: código ya revisado,
  instrumentado o traducido (eso sigue en el juego hasta que exista `lenguaje`).
- `await ceder(instantanea, respuestas = [])`: entrega primero las respuestas,
  arranca los programas nuevos, despierta a los que
  esperan con `despertar <= t + 1e-9` y cede hasta que ninguno corre. Devuelve
  `{ ordenes, avisos, error }`: órdenes `{ paso: pasoDe(t), origen: 'programa',
  unidad, verbo, args: [lugar] }` y los mensajes del Worker como avisos.
- **Orden fijo** (decisión pendiente del plan, resuelta aquí): los mensajes se
  anotan al llegar, pero órdenes y avisos se entregan ordenados por unidad
  (orden de carga) y llegada. Dos órdenes del mismo instante ya no dependen del
  reloj real entre Workers. Coincide con la imitación sin pantalla y no cambió
  ninguna referencia (las 10 de War se reproducen con este anfitrión).
- MAX_ORDENES cuenta lecturas, órdenes y consola por despertar; la que supera el
  límite se entrega y las siguientes no, como en el juego. Un error del Worker
  (`error` u `onerror`) para la cesión y se devuelve en `error`. Una imitación
  sin nada que entregar devuelve `error.motivo = 'sin-cesion'`.
- `algunoCorre()`, `estado(unidad)`, `proximaEspera()` y `detener()`.
- `vigilar(ahora, ms, mensaje)` queda como API opcional para adaptadores
  asíncronos y conserva sus pruebas. **El juego no lo llama** y ya no hay
  `VIGIA_MS`: sus diagnósticos ES/EN proceden del presupuesto. Examina los programas en estado `corre`. Si
  alguno lleva `ms` o más desde `p.desde` (marcado con el reloj `ahora` inyectado
  al crear el anfitrión), falla con `mensaje(unidad)`, despierta el turno pendiente
  como `onerror` y devuelve esa unidad. En otro caso devuelve `null`. No consulta
  un reloj propio, no vigila esperas ni sustituye un error anterior. La aplicación
  decide el umbral y el texto del diagnóstico. Detener también libera al turno pendiente.

War guarda fuera del mundo `{ eventos, uso, consolas, lecturas }`. Registra las
lecturas (`fmtValor`, clase `sensor`), órdenes (`verbo(lugar)` o `stopFire()`,
resultado y clase `ok`/`warn`) y consola con los formatos exactos del juego:
`console.nivel` en JS y `print`/nivel en Python. El uso cuenta `fn`, `verbo` y
`esperar` por programa. `lecturas` cuenta por sensor de vibración identificado
en `instantanea.vib`, incluidos los sensores sin uso con valor cero; las lecturas
de lanzadores no incrementan ese contador. No escribe `sensor.st.lecturas`,
`mundo.uso`, `mundo.consolas` ni `mundo.eventos`.

Para las tres series, `registro({ desde = 0 } = {})` devuelve una copia profunda
de los eventos a partir de ese índice absoluto y todos los contadores acumulados.
Sin argumento conserva la lista completa. El consumidor incrementa su cursor
por la cantidad de eventos recibidos. En Campaign, los modos conservan su índice
y se completan al recibir la respuesta: hay que leer tras resolverla para obtener
el resultado final de ese evento; el cursor no vuelve a entregar eventos previos.

Factory conserva sus encargos por programa: un encargo cede el turno sin
contar como «corre», y `done` espera a su encargo antes de quedar en «fin».
Como en el ciclo antiguo, el encargo simultáneo y el sensor 501 fallan sin
producir órdenes ni registro; la consola que pasa del límite de 4000 se
registra y después falla. El contador de sensores se pone a
cero con cada encargo. War conserva su tratamiento anterior de MAX_ORDENES.

- `await responder(respuestas)` entrega `{ unidad, resultado, instantanea }`,
  despierta el encargo con esa foto y cede hasta que nadie corre; devuelve
  `{ ordenes, avisos, error }`. No despierta esperas vencidas por tiempo.
  Las respuestas sin encargo se ignoran.
- `registro()` copia `{ eventos, verbos, resultados, consolas }` de Factory.
  El registro se hace al ceder, en el mismo orden fijo que las órdenes; los
  resultados usan el tiempo de su instantánea de respuesta.
- `detener(respuestas = [])` acepta las respuestas terminales: las registra y
  entrega antes de cerrar las unidades, sin ejecutar continuaciones tras el fin.
  Evita perder el último encargo cuando su entrega cumple las metas.

Campaign conserva varias esperas y encargos por programa (`p.pend`) y usa
`despertarCampaign`. Un `cede` deja esperando al programa si tiene pendientes;
`done` lo termina y los encargos que finalicen después se registran sin despertarlo.
Los modos, lecturas y consolas cuentan para el límite (diagnóstico con `await wait(...)`).
`registro()` devuelve `{ eventos, uso, consolas }`, con uso por programa y función,
sin escribir esos campos en el mundo. Los eventos siguen el orden del lote del turno.
Los modos reservan su evento al registrar el mensaje y completan resultado/clase
al recibir la respuesta: así conservan su posición respecto de la consola.
Las órdenes de encargo llevan `ref: programa#id`; las de modo llevan una referencia
propia `programa#modo:n` porque el Worker no asigna id a los modos. La respuesta
de encargo identifica al programa por `ref` y registra el robot como `maquina`.
Las respuestas sin referencia reconocida se ignoran. El Worker no cambia.

La prueba `pruebas/fronteras-campaign.mjs` contrasta ambos lenguajes, todos los
tramos, la secuencia paso a paso y la repetición desde las órdenes serializadas.
Coinciden las 2 referencias completas y las 12 repeticiones, tanto con orden
por unidad como en la medición temporal por llegada. Se conserva el orden por
unidad. La aplicación entrega primero las respuestas de encargos y cede sus
continuaciones; después despierta las esperas por tiempo, como el ciclo antiguo.

Si varias unidades fallan en el mismo turno, gana la primera por orden de carga.
La VM opcional conserva su timeout de diagnóstico y no reproduce el presupuesto
de nodos del intérprete. No es el motor predeterminado de ninguna serie.

## De dónde sale

`Prototypes/Rocket Launcher/js/runtime.js` (retirado) y la sección «Ciclo de los
programas» de `Prototypes/Rocket Launcher/js/juego.js` (migrada en el paso 8b).

## Pruebas

```sh
node paquetes/anfitrion/pruebas/anfitrion.mjs
```

`pruebas/unidad.mjs` comprueba clonación nativa/propia, aislamiento, FIFO, timers,
trabajos, presupuesto por tarea, línea y liberación. `pruebas/partida-interprete.mjs`
compara las 41 partidas con VM/intérprete, incluidos mensajes, y prueba los bucles
deterministas y el cierre/reinicio/creación de mundo de las tres series. Ambas
están registradas en `pruebas/todas.mjs`. La suite histórica también está registrada; ejecuta el texto del Worker en `node:vm`
(lectura, orden, espera, despertar, consola, fin, errores con línea, validación
inyectada de Factory), comprueba el auxiliar interno `despertarCampaign` con programas
falsos y `crearAnfitrion` con Workers asíncronos falsos cuyos mensajes llegan en
distinto orden (mismo resultado), MAX_ORDENES, errores y `sin-cesion`.
`pruebas/fronteras-fase2.mjs` lo usa con la imitación real de Worker y compara
el registro combinado de War con el ciclo antiguo (10/10, orden y contadores).
La suite propia cubre formatos JS/Python, cursor/copia en las tres series,
umbral del vigía, reloj inyectado, reinicio al despertar y liberación del turno.
La paridad con el juego la dan `partida-referencias` (41 partidas) y el
contraste con Chromium.
`pruebas/fronteras-factory.mjs` juega las 28 referencias Factory por el camino
nuevo: huella, pasos, resultado completo y repetición exacta coinciden 28/28.

En `Turno.avisos`, `unidad` identifica siempre al programa emisor (también
cuando el maestro Campaign actúa sobre otra máquina). El destino de la acción
sigue en `Turno.ordenes`. El juego usa el emisor para las líneas del editor.
