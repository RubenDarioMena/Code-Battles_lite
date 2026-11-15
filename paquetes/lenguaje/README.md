# lenguaje

Reúne léxico, estructura tolerante, traducción de Python, seudocódigo e instrumentación. Funciona sin DOM y conserva los programas del jugador.

## Puede importar

Nada. Véanse las reglas de [paquetes](../README.md).

## Contrato

Se define en la fase 2.

## De dónde sale

`shared/python/`, `Prototypes/Rocket Launcher/js/juego.js`, `shared/js/estructura.js` (léxico e `instrumentar` de `juego.js`).

## Pruebas

Vivirán en `paquetes/lenguaje/pruebas/`. Criterio: Paridad del lenguaje y traducción de Python comparada con CPython.

## Estado

Vacío desde la fase 0: solo manifiesto y contrato. No se crea `index.js` todavía; las entradas públicas empiezan en la fase 1.
