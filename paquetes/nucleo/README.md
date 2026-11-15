# nucleo

Gestiona el paso fijo, RNG con semilla, entidades, órdenes y sucesos. Guarda y restaura partidas sin pantalla.

## Puede importar

`protocolo`. Véanse las reglas de [paquetes](../README.md).

## Contrato

`crearPartida({ reglas, escenario, semilla })` devuelve `ordenar(orden)`, `paso()`, `instantanea()`, `sucesos(desdePaso)` y `serializar()`; `restaurar(datos)` recupera la partida.

## De dónde sale

`Prototypes/Rocket Launcher/js/nucleo.js`

## Pruebas

Vivirán en `paquetes/nucleo/pruebas/`. Criterio: Determinismo, guardar/restaurar y repetición exacta con las referencias de fase 0.

## Estado

Vacío desde la fase 0: solo manifiesto y contrato. No se crea `index.js` todavía; las entradas públicas empiezan en la fase 1.
