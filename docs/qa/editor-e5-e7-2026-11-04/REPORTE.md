# QA · E5–E7 Python ejecutable, listas y conversión desde JS · 4 de noviembre de 2026

## Resultados

| Suite | Resultado |
|---|---|
| Traductor sin DOM (`python-traductor.cjs`, nueva) | 58: 27 salidas iguales a CPython 3.13 (núcleo, listas y errores), líneas, precedencia, 14 diagnósticos, D1/D2 y conversión JS → Python |
| Ejecución en el juego (`python-ejecucion.mjs`, nueva) | 21 |
| Python en el juego (`python-juego.mjs`, adaptada a E5) | 22 |
| War | 90/90 |
| Factory: editor, vistas, API, 3D | 18, 31, 7, 10 |
| Paridad | 28/28 |
| Demo | 73 |
| Python del editor sin DOM | 34 |
| Lógica, contratos e integridad | 123 y correctos |
| Paquete | 9 páginas / 88 referencias |

`pruebas/telemetria.mjs` no se ejecutó: necesita `npm install` (`@netlify/blobs`). El cambio en `netlify/functions/t.mjs` es una columna más del CSV.

**Compuerta de E5 (equivalencia).** Con la misma semilla, el mismo programa en JS y en Python, escrito línea a línea igual, da los mismos eventos (con sus líneas), tiempo, derribos y misiles en War (retos 1 y 2) y el mismo resultado, tiempo y eventos en Factory (reto 1). El programa convertido por Py hace lo mismo que su JS (eventos iguales salvo la línea, porque la conversión quita las líneas de llaves).

**Compuerta de E6.** Las salidas esperadas de `python-traductor.cjs` son las de CPython 3.13, copiadas en la prueba: la prueba no ejecuta CPython.

**Compuerta de E7 (QA en un teléfono real): pendiente.** Solo hay emulación de Chromium (390 × 844 y 844 × 390, táctil).

## Capturas

- `war-pc-python-victoria.png`: War en PC con un programa Python ganado; el récord lleva la etiqueta PYTHON y el globo muestra el `print`.
- `factory-movil-python.png`, `war-movil-python.png`: teléfono emulado. La pestaña del programa dice solo la unidad (`R1`, `LAU-01`) y ya no se recorta con JS, Bloques, Seudo y Py.

## Límites

- Sin distinción entero/real: `4 / 2` se muestra `2` (CPython: `2.0`). Enteros exactos solo hasta 2⁵³.
- Diccionarios, conjuntos, clases, `import`, `try` y `with` están fuera y se avisan con su línea. Las tuplas solo sirven para desempacar y para `enumerate`.
- Py recupera el último Python guardado de la unidad; solo convierte el JS si la unidad aún no tiene Python.
