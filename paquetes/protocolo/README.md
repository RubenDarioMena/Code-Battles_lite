# protocolo

Define instantáneas, sucesos y órdenes como datos planos serializables. Solo contiene tipos y validadores.

## Puede importar

Nada. Véanse las reglas de [paquetes](../README.md).

## Contrato

Instantánea: estado visible sin funciones; suceso: hecho de un paso, solo para ver y oír. Orden: `{ paso, origen, unidad, verbo, args }`, con origen `programa`, `jugador` o `sistema`. Los nombres definitivos se fijan en la fase 2.

## De dónde sale

`Prototypes/Rocket Launcher/js/nucleo.js`, `Prototypes/Rocket Launcher/js/juego.js`

## Pruebas

Vivirán en `paquetes/protocolo/pruebas/`. Criterio: Validación y serialización de los tres mensajes en Node.

## Estado

Vacío desde la fase 0: solo manifiesto y contrato. No se crea `index.js` todavía; las entradas públicas empiezan en la fase 1.
