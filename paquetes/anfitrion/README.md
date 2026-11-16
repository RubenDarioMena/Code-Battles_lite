# anfitrion

Estado: fase 2, paso 1 (texto del Worker y despertar).

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

## Contrato previsto (siguiente paso)

`crearAnfitrion({ reglas, lenguaje })`; `await cargar(unidad, fuente)`;
`await ceder(instantanea)` devuelve órdenes y avisos cuando todos esperan. Debe
absorber los mensajes comunes de «Ciclo de los programas» de `juego.js` y fijar
el orden de los mensajes de distintas unidades en el mismo instante.

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
falsos. La paridad con el juego la dan `partida-referencias` (41 partidas) y el
contraste con Chromium.
