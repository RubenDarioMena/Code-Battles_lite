# reglas-campaign

Define el mundo, paso, órdenes y metas de campaign. Expone las lecturas, modos y encargos de los programas sin depender de las vistas.

## Puede importar

`nucleo`, `protocolo`. Véanse las reglas de [paquetes](../README.md).

## Contrato

`export default { id, version, crearMundo(escenario, rng), paso(mundo, dt), aplicarOrden(mundo, orden), instantanea(mundo), evaluar(mundo), api }`.

## De dónde sale

`Prototypes/Rocket Launcher/js/campaign.js`, `Prototypes/Rocket Launcher/js/campaign-nivel.js`

## Pruebas

Vivirán en `paquetes/reglas-campaign/pruebas/`. Criterio: Reglas en Node y paridad con suites y referencias de fase 0; Factory conserva su oráculo.

## Estado

Vacío desde la fase 0: solo manifiesto y contrato. No se crea `index.js` todavía; las entradas públicas empiezan en la fase 1.
