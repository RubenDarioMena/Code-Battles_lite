# Astra frente a Claude · comparación legible

Resumen para el autor de [ARQUITECTURA-ASTRA.md](../astra/ARQUITECTURA-ASTRA.md) y [ARQUITECTURA-CLAUDE.md](ARQUITECTURA-CLAUDE.md). Es insumo de «Forma del mundo continuo» (ticket 04) y «Cómo se añade una mecánica» (ticket 05). No decide nada.

## En una frase cada una

- **Astra:** un solo mundo, un solo reloj y una sola bodega. Para lograrlo se extraen de War («defensa») y de la campaña H0–H5 («producción») las operaciones, y un reglamento V2 dentro de `reglas-campaign/v2/` las llama en su propio orden. La app las inyecta.
- **Claude:** War y la fábrica siguen intactos y se ejecutan lado a lado. Un compositor fino los une con un puente (bodega → suministro), y cada mecánica nueva es un archivo con un contrato común.

## Dónde difieren de verdad

| Tema | Astra | Claude | Comprobado |
| --- | --- | --- | --- |
| Paridad con War | Refactoriza `reglas-war/mundo.js` → `defensa.js`; el riesgo es desplazar un sorteo un paso, y lo vigila con las 10 huellas | No toca `reglas-war`: la paridad sale gratis | Las huellas existen: 755/493/692/1014/500 pasos, todas acaban en derrota |
| Fronteras | Inyección desde `app`, sin excepción en `pruebas/fronteras.mjs` | `reglas-cv2` importa dos reglamentos: **rompe la frontera** (`reglas-*` solo puede importar `nucleo` y `protocolo`) | Sí, en `pruebas/fronteras.mjs:9-11` |
| Unidad de extensión | Archivo de mecánica + **llamada explícita** en `V/paso.js` + ficha en `V/unidades.js`. Se sigue leyendo el código, sin descubrimiento en tiempo de ejecución | Archivo de mecánica con contrato uniforme que el compositor recorre según el nivel (registro implícito) | — |
| Archivos compartidos por mecánica | 4–7 (paso, unidades, lecturas, escena, índice de ensayos) | 1–2 (registro de modelos, i18n) | Estimaciones de ambos, sin medir |
| Modo de batalla integrado | **«Ensayos»**: casos jugables en `V/ensayos/`, abiertos desde el menú con el mismo reglamento | No lo concretaba | — |
| Checkpoint | Repetir desde el inicio del nivel con las entradas grabadas; reconstruye también las esperas de los programas | Sin definir | — |
| Disparo puntual | Un intento en el siguiente turno de fuego; después el programa recupera su modo. Exige separar «intento» de «modo» en War | Sin detalle | — |

## Lo que cada una ve y la otra no

- **Astra ve:**
  - el tiempo de oleadas y metas se mide desde el inicio de cada Batalla, mientras el registro y las esperas usan el paso global;
  - la reaparición necesita una «generación» para descartar respuestas tardías;
  - las semillas 1 y 7 dan la **misma huella** en las Batallas 1, 2, 3 y 5, así que la paridad se apoya casi en una sola semilla.
- **Claude ve:**
  - el coste real hoy está en las ramas `ES_CAMPAIGN`/`ES_FACTORY` repartidas por `app/juego/*`;
  - Astra propone añadir una ruta V2 a ese mismo esquema (`anfitrion.js admite tres identificadores`, `api.js elige la API por serie`), lo que agranda los archivos compartidos.

## Combinación que parece más fuerte (para discutir en el ticket 04)

1. Composición inyectada desde `app` (Astra), para respetar las fronteras.
2. War sin refactor mientras sea posible (Claude). Extraer `defensa.js` solo si el puente no cabe como orden de `sistema`.
3. Ensayos como modo de batalla integrado (Astra).
4. Mecánicas con llamada explícita (Astra), en carpeta propia con un README corto (Claude), para que el agente lea poco y pueda seguir la llamada.
5. Checkpoint por repetición (Astra), medido en el teléfono.
