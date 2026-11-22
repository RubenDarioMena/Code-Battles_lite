# Inspector de bloques

Convierte los bloques reales del juego en un documento inspeccionable. Un **bloque** es una parte funcional: Mapa, Código, Misión, Máquinas, Ficha de máquina, Historial, Registro, Órdenes, Investigación, Mundo, Guardado, Biblioteca, Revisión y Ajustes. No es la pantalla completa.

A la izquierda está la captura del bloque. A la derecha está la lista de sus elementos: los grandes, con llaves plegables, y los pequeños dentro. Pasar el cursor por uno ilumina el otro, como «Seleccionar elemento» de las herramientas del navegador.

«Comparar» pone el mismo bloque de otra rama al lado: azul a la izquierda, rojo a la derecha y morado lo que está en las dos. Si un bloque no existe en una rama o plataforma, ese lado lo dice y explica por qué. Por ejemplo: «el menú ⋯ no tiene esta entrada».

| Pieza | Qué es |
| --- | --- |
| `docs/pantallas/inspector/manifiesto.json` | Lo único que se escribe a mano. Define las plataformas y, para cada bloque, cómo se abre (panel, entrada del menú ⋯, clics) y su raíz. Define también los elementos, con título, selector CSS y función en la interfaz y en el juego. |
| `capturar.mjs` | Abre cada bloque en cada plataforma y rama con Playwright, como lo haría el jugador. Recorta la captura al bloque y mide la caja de cada elemento. Lista también los controles visibles que el manifiesto no nombra. |
| `generar.mjs` | Junta manifiesto y capturas en un HTML autocontenido. Con `--en` lo inserta al principio de otra página. |
| `inspector.js`, `inspector.css` | La interfaz, que se incrusta en el HTML. |

```bash
node harness/inspector/capturar.mjs --rama campaign-nivel-1=<checkout> --rama trunk=<checkout> --salida <dir>
```

```bash
node harness/inspector/generar.mjs --capturas <dir> --en <página.html> --salida docs/salidas/<fecha>-<tema>.html
```

- Un checkout por rama se saca con `git worktree add --detach <dir> origin/<rama>`.
- La primera rama es la que se ve al abrir; `generar.mjs --primera <rama>` la cambia.
- Con `BLOQUES=mapa,codigo` solo se capturan esos.

La presencia de cada elemento la mide el navegador. Si un selector deja de existir o se oculta en una rama, la tarjeta cambia de color sola. Un elemento que existe pero queda fuera de la vista del bloque lleva una flecha ↓: hay que desplazar para verlo.

## Añadir un bloque

1. Añade el bloque a `bloques` en el manifiesto, con `serie`, `panel` (`mapa` o `codigo`), `raiz` y, si hace falta, `menu` (el `data-menu` de la entrada del ⋯) y `clic` (selectores que se pulsan después).
   - Sin menú ⋯, el capturador prueba la pestaña `#t-<menu>` o el botón `#b-<menu>`.
2. Añade su lista a `elementos`.
   - `panel` es la cabecera común de los bloques que ocupan el sitio del código.
   - Los controles que salgan en «Sin describir» dicen qué falta.
