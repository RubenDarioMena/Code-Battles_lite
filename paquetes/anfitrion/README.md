# anfitrion

Ejecuta programas contra un reglamento y recoge órdenes y avisos. Su interfaz asíncrona permite Workers hoy e intérprete después.

## Puede importar

`nucleo`, `protocolo`, `lenguaje`. Véanse las reglas de [paquetes](../README.md).

## Contrato

`crearAnfitrion({ reglas, lenguaje })`; `await cargar(unidad, fuente)`; `await ceder(instantanea)` devuelve órdenes y avisos cuando todos esperan.

## De dónde sale

`Prototypes/Rocket Launcher/js/runtime.js`, `Prototypes/Rocket Launcher/js/juego.js` (sección «Ciclo de los programas» de `juego.js`).

## Pruebas

Vivirán en `paquetes/anfitrion/pruebas/`. Criterio: Cesión asíncrona, órdenes y avisos; partida completa con vista nula.

## Estado

Vacío desde la fase 0: solo manifiesto y contrato. No se crea `index.js` todavía; las entradas públicas empiezan en la fase 1.
