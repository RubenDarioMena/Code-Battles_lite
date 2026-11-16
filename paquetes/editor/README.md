# editor

Editor de código por botones reutilizable. Debe poder montarse solo, sin el juego.

## Puede importar

`lenguaje`. Véanse las reglas de [paquetes](../README.md).

## Contrato

Se define en la fase 2.

## De dónde sale

`shared/editor/`, `shared/js/estructura.js`, `shared/js/edicion.js`

## Pruebas

Vivirán en `paquetes/editor/pruebas/`. Criterio: Editor montado solo y conservación del contrato y de los programas existentes.

Prueba de frontera 4 de la fase 2 (editor montado solo, fuera del juego): hoy
sobre `shared/editor/demo.html`, con `pruebas/ejecutar-editor-demo.cjs`
(Playwright, en `npm run test:navegador`): 73 comprobaciones, sin globales del
juego (`cmg`, `__banco`, `RUNTIME`, `WAR`) ni errores de página.

## Estado

Vacío desde la fase 0: solo manifiesto y contrato. No se crea `index.js` todavía; las entradas públicas empiezan en la fase 1.
