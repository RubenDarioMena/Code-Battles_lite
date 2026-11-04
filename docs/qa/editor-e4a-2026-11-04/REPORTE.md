# QA · E4a Python en el componente · 4 de noviembre de 2026

## Resultados

| Suite | Resultado |
|---|---|
| Python sin DOM (`editor-python.cjs`, nueva) | 34 |
| Demo (`editor-demo.mjs`) | 73 (22 nuevas de E4a) |
| War, Factory editor, vistas, API, paridad y 3D | 90/90, 18, 31, 7, 28/28, 10 |
| Lógica, contratos y D1/D2 con el catálogo y la integridad de lezer | 123, correcto, correcto |
| Entrada y paquete | 8; 9 páginas / 79 referencias |
| Capturas de War y Factory contra E3 | 32/32 idénticas píxel a píxel |

**Pruebas de significado.** `forma(src)` usa lezer para escribir cada sentencia bajo su bloque, y las pruebas comparan esa forma, o el texto exacto, antes y después de cada operación:

| Operación | Comprobado |
|---|---|
| Subir y bajar | Al final de un bloque, se pasa por cada nivel. |
| Sacar la única línea de un bloque | Deja `pass`. |
| Mover un bloque entero | Conserva su sangría relativa. |
| Mover desde un `else` | Salta la línea del `else`. |
| Borrar | Deja `pass` donde el bloque quedaría vacío, o el hueco del argumento. |
| Duplicar | Conserva el nivel. |
| Línea nueva tras `:` | Queda dentro del bloque. |
| Desenvolver | El cuerpo queda un nivel menos sangrado. Un `else` con código no se pierde y un cuerpo que era solo `pass` desaparece. |
| Pegar | Va al nivel de la línea de destino. |
| Enter, Tab y Ctrl+/ | Sangran, ponen la unidad de cuatro espacios y comentan con `#`. |
| Plantillas | Se insertan o envuelven con la sangría del sitio. |
| `and`, `not` e `is None` | Se aplican sobre lo elegido, con paréntesis cuando hacen falta. |
| Arrastrar con el ratón | La columna del puntero decide si la línea queda dentro o fuera del bloque. |

## Capturas

- `pc-python-sin-teclado.png`: 1400×900, el `if` de un bucle elegido en el modo sin teclado; hay un hueco `__mensaje__`.
- `movil-python-sin-teclado.png`: 390×844, el mismo estado en el teléfono.

## Límites

- Solo emulación de Chromium.
- Arrastrar con el dedo en un teléfono real (elegir el nivel con la posición horizontal) está pendiente de QA manual.
- El juego no carga Python: llega en E4b, detrás de `?python=1`.
- La demo no convierte entre lenguajes: cada lenguaje tiene su propio documento.
