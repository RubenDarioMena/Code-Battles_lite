# Inspector de pantallas

Convierte las pantallas reales del juego en un documento inspeccionable: a la izquierda la captura; a la derecha la lista de sus elementos (grandes, con llaves plegables, y pequeños dentro). Pasar el cursor por una ilumina la otra, como «Seleccionar elemento» de las herramientas del navegador. «Comparar» pone la misma pantalla de otra rama al lado: azul a la izquierda, rojo a la derecha y morado lo que está en las dos.

| Pieza | Qué es |
| --- | --- |
| `docs/pantallas/inspector/manifiesto.json` | Pantallas, plataformas y elementos: título, selector CSS y función en la pantalla y en el juego. Es lo único que se escribe a mano. |
| `capturar.mjs` | Abre cada pantalla en cada plataforma y rama con Playwright, hace la captura y mide la caja de cada elemento. Lista también los controles visibles que el manifiesto no nombra. |
| `generar.mjs` | Junta manifiesto y capturas en un HTML autocontenido. Con `--en` lo inserta al principio de otra página. |
| `inspector.js`, `inspector.css` | La interfaz, que se incrusta en el HTML. |

```bash
node harness/inspector/capturar.mjs --rama trunk=<checkout de trunk> --rama campaign-nivel-1=<checkout de campaign> --salida <dir>
```

```bash
node harness/inspector/generar.mjs --capturas <dir> --en <página.html> --salida docs/salidas/<fecha>-<tema>.html
```

Un checkout por rama se saca con `git worktree add --detach <dir> origin/<rama>`. La presencia de cada elemento la mide el navegador: si un selector deja de existir o se oculta en una rama, la tarjeta cambia de color sola.
