# anfitrion

Estado: fase 5, paso 4a. War, Factory y Campaign interpretan únicamente los
programas del jugador; la API de confianza corre nativamente en el anfitrión.

## Puede importar

`nucleo`, `protocolo`, `lenguaje`, `interprete`. No importa reglamentos:
las validaciones, modos y preludio Python se inyectan como piezas autocontenidas.

## Fuente única y referencia VM

`api.js` contiene `crearAPI`: sin imports ni cierres externos, recibe el global de
la unidad, compilador, Promise, emisor, timer y piezas. `fuenteTrabajador(piezas)`
serializa **esa misma fábrica con `toString()`**, junto con las piezas, para que
la VM la ejecute en su contexto independiente. El contrato es de valores, errores,
líneas y mensajes ordenados; ya no es identidad textual con el antiguo runtime.
Las piezas nativas son funciones; el generador VM admite también cadenas.
Juego y herramienta inyectan las piezas al crear el trabajador (`piezas`).
El registro interno de compatibilidad (32 fuentes) permite recuperarlas al consumir
la firma histórica `crearTrabajador(fuente, unidad, recibir)` sin evaluar texto.

### Unidad determinista

`crearTrabajadorInterprete({ acorn, presupuesto = PRESUPUESTO, mensajePresupuesto? })`
devuelve `crearTrabajador(fuente, unidad, recibir, maxOrdenes = 4000)`:

- Un reino por creador/partida, con fachadas, caché de árboles y Promise/cola
  compartidas; un ámbito global, canal, API y estado de esperas por unidad.
  Cada entrega activa su ámbito y drena todos sus trabajos antes de pasar a otra.
- Solo se compila el programa instrumentado/traducido con Acorn. Las promesas de
  la API son del motor; no se usan microtareas ni timers reales del anfitrión.
  El preludio Python corre nativamente y mantiene `__py.mensaje`.
- `postMessage` comparte la referencia de `snap`; copia los demás datos del
  mensaje. La foto queda inaccesible directamente al programa: todas las lecturas
  de objetos devuelven copias. War superpone una copia diferida de la fila propia
  para `mode`, `target`, `fireRate` y `failureRate`; se descarta con cada foto.
  Los mensajes de salida se clonan antes de encolarse para evitar referencias
  mutables del programa o de esa fila. No se añade un clon por unidad de la foto.
- Cada tarea reinicia **`PRESUPUESTO` = 1 000 000 unidades** (nodos y llamadas
  nativas, incluyendo trabajos). Cada llamada API cuesta una llamada nativa,
  sin interpretar su cuerpo. 7 024 conserva toda la traza del sensor 501 y
  44 024 es el mínimo para las 4001 consolas de la suite; el valor por defecto
  es holgado a propósito para no cortar programas guardados con más cálculo
  legítimo por turno (el vigía antiguo dejaba 2,5 s). Corte medido en un M1
  (`herramientas/espina-interprete/corte.mjs`): ~60 ms un bucle vacío, ~90 ms
  uno de cálculo y ~0,3 s el peor (un getter que copia en cada vuelta).
  `CBL_PRESUPUESTO` se entrega como `{ type: 'error', mensaje, linea, code }`.
- `terminate()` cancela entradas, salidas y timers y libera solo su ámbito.
  Cerrar la última unidad libera el reino; el creador puede abrir otra partida.
  `medir()` conserva el último presupuesto de cada unidad, también tras cerrar.
  El arnés genérico sin fábrica se conserva para las pruebas del canal.

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

Paso 4a: `pruebas/api-nativa.mjs` (raíz) prueba ámbitos y compilación dinámica,
intrínsecos compartidos intactos, liberación independiente, capa propia de dos
lanzadores, errores JS/Python, pila sintética y mínimos de presupuesto.
`pruebas/partida-interprete.mjs` compara también **cada mensaje completo**, no
solo contadores, en las 41 partidas (Factory 28 y Campaign 12 tramos).
El corpus real ejecuta además la API nativa frente a la VM (80/17 Python).
Medidas y límites actuales: [Paso 4a](../../docs/qa/interprete-2026-11-17/README.md#paso-4a).
