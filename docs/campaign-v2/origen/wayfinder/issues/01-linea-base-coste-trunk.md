# Línea base: cuánto cuesta hoy en trunk añadir un reto, una orden, un evento y un tipo de unidad

Type: research
Label: wayfinder:research
Status: resolved
Blocked by: —

## Question

En `origin/trunk`, ¿qué archivos (y de qué paquetes) hay que tocar hoy para cada uno de estos cambios, y qué pruebas se ven afectadas?

1. Un reto War nuevo que solo reutiliza mecánicas.
2. Un verbo de orden nuevo, como `moveTo`.
3. Un evento del mundo hacia el programa, como `onDamage`.
4. Un tipo de unidad nuevo con su dibujo 2D, su modelo 3D y su ficha.

Para cada caso, contar archivos compartidos, líneas aproximadas que el agente debe leer y suites afectadas (`pruebas/`, huellas de referencia, `pruebas/fronteras`). Es la línea base contra la que se comparan las dos arquitecturas.

## Pistas

`paquetes/reglas-war/{index,mundo,retos}.js`, `paquetes/anfitrion/{api,war,unidad}.js`, `paquetes/vista-3d/{war,instancias-war,recursos}.js`, `paquetes/app/juego/*`, `paquetes/interfaz`, `docs/REGLAMENTO.md`.

## Answer

Medido sobre `origin/trunk` (sin ejecutar pruebas). Detalle y citas por archivo y línea: [research/01-linea-base-coste-trunk.md](../research/01-linea-base-coste-trunk.md).

| Caso | Archivos tocados | Paquetes | Líneas (archivos enteros) | Mínimo funcional | Suites afectadas |
|---|---|---|---|---|---|
| 1 Reto War nuevo | 2 (`reglas-war/retos.js`, `shared/i18n/retos.js`) | 1 + shared | 315 | 315 | `i18n-catalogos` (exige claves es/en por reto); referencias no (casos fijos 1–5) |
| 2 Verbo `moveTo` | 15 | 8 | 2 154 | ≈ 726 (5 archivos: `api.js`, `mundo.js`, `index.js`, `datos-proveedor.js`, `vocabulario.js`) | `reglas-war.mjs:60` (lista de `ordenes`), `anfitrion`, `lenguaje`, `python-*`, `editor-*`, navegador |
| 3 Evento `onDamage` | ≈ 10 | 5 | ≈ 1 400 | ≈ 980 (mundo, index, anfitrión, api, unidad, war) | `anfitrion`, `unidad`, `paso-a-paso*`, `partida-*`, `partida-referencias` |
| 4 Tipo de enemigo | 9 + 1 PNG | 6 | 1 918 | ≈ 780 | `vfx`, `vista-2d/3d`, `instancias-war`, `i18n-catalogos` |

Hechos clave:
- Cada verbo existe dos veces: simulado en `anfitrion/api.js` (se serializa al Worker) y regla real en `reglas-war/mundo.js`; `api.ordenes` es solo una lista que una prueba compara literalmente.
- No hay camino de eventos hacia el programa: el Worker solo recibe `run` y `despierta`; los sucesos del mundo (`golpe`, `derribo`…) solo los usan VFX y anotaciones.
- Un tipo de enemigo ya se propaga solo (`TIPOS` → `api.tipos` → validación de `autoTarget`); lo manual es dibujo, receta VFX, nombre i18n y PNG de ficha. Los enemigos 3D de War son mallas procedurales (solo `suelo`/`aire`); no hay flujo GLB para ellos.
- Sin medir: resultado real de las suites, efecto sobre los hashes de `pruebas/referencias/partidas.json` (no se regraban), líneas añadidas por diff.
