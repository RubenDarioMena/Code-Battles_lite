# anfitrion

Estado: fase 2, pasos 1 (texto del Worker y despertar) y 2 (`crearAnfitrion` para War).

Ejecuta los programas del jugador contra un reglamento y recoge órdenes y avisos.
Hoy, un Web Worker por unidad programable; en la fase 5, un intérprete con
presupuesto de instrucciones. El resto de la aplicación no debe saber cuál.

## Puede importar

`nucleo`, `protocolo`, `lenguaje`. Véanse las reglas de [paquetes](../README.md).
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
- `algunoCorre(ejec)`, `despertar(ejec, mundo, instantanea, ahora?)` y
  `despertarCampaign(ejec, mundo, instantanea, ahora?)`: el despertar del
  lockstep, sin cambios. `ahora` solo marca `p.desde` para el vigía de 2,5 s de
  reloj real del juego (`performance.now` en el navegador, `() => 0` sin
  pantalla); no decide ningún paso. Tipos en `index.d.ts`.

Quién lo usa:

- El juego, mediante `js/compat-paquetes.js`, que crea la URL del Worker y
  publica el antiguo `window.RUNTIME` (`url`, `algunoCorre`, `despertar`,
  `despertarCampaign`). Ese módulo se carga después de `shared/python/traductor.js`
  por el preludio de Python. `js/runtime.js` ya no existe.
- La partida sin pantalla (`herramientas/partida/cargar.mjs` y `ciclo.mjs`), que
  importa el paquete en vez de capturar el Worker por `Blob`.

## `crearAnfitrion` (paso 2, solo War)

`crearAnfitrion({ reglas, crearTrabajador, contexto?, piezas?, maxOrdenes = 4000, ahora? })`:

- `crearTrabajador(fuente, unidad, recibir)` devuelve un Worker (o su imitación
  sin pantalla) con `postMessage` y `terminate`. Si además tiene `entregar()`
  (imitación síncrona de `herramientas/partida/programa.mjs`), el anfitrión lo
  bombea por unidades; si no, espera a sus mensajes.
- `contexto` completa el mensaje `run`: `nombres` (unidades nombrables),
  `tipos`, `sensores` y `conf`; por defecto, de `reglas.api` (War añade
  `api.conf` en este paso).
- `await cargar(unidad, codigo, { lenguaje })`: código ya revisado,
  instrumentado o traducido (eso sigue en el juego hasta que exista `lenguaje`).
- `await ceder(instantanea)`: arranca los programas nuevos, despierta a los que
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

Límites: Factory y Campaign todavía no (sus encargos terminan por un gancho del
mundo que el reglamento de la fase 1 no expone; ver «Decisiones pendientes»).
Si dos unidades fallan en el mismo instante con Workers reales, gana la primera
en llegar. El juego aún no usa `crearAnfitrion`: sigue con `window.RUNTIME`.

## De dónde sale

`Prototypes/Rocket Launcher/js/runtime.js` (retirado) y la sección «Ciclo de los
programas» de `Prototypes/Rocket Launcher/js/juego.js` (pendiente).

## Pruebas

```sh
node paquetes/anfitrion/pruebas/anfitrion.mjs
```

Registrada en `pruebas/todas.mjs`. Ejecuta el texto del Worker en `node:vm`
(lectura, orden, espera, despertar, consola, fin, errores con línea, validación
inyectada de Factory), comprueba `despertar`/`despertarCampaign` con programas
falsos y `crearAnfitrion` con Workers asíncronos falsos cuyos mensajes llegan en
distinto orden (mismo resultado), MAX_ORDENES, errores y `sin-cesion`.
`pruebas/fronteras-fase2.mjs` lo usa con la imitación real de Worker. La paridad con el juego la dan `partida-referencias` (41 partidas) y el
contraste con Chromium.
