# Editor mínimo de terreno · fase A

Abrir [`herramientas/terreno/`](../herramientas/terreno/index.html) desde el servidor local del juego. No requiere npm, compilación, CDN ni conexión. Es una herramienta de desarrollo para preparar pocos mapas de War.

El editor usa Three.js r180 ESM y `WebGPURenderer`. Prefiere WebGPU y cae a WebGL 2 si no está disponible; si falla la inicialización de WebGPU, vuelve a intentar con un canvas nuevo y WebGL 2. `?motor=webgl` permite comprobar el respaldo. WebGPU necesita un contexto seguro: HTTPS o localhost. La insignia del visor muestra el backend realmente activo. El juego conserva su Three r128; ambos comparten datos y el adaptador de malla, sin mezclar instancias de Three.

## Uso

- Subir, bajar, suavizar y aplanar altura; pintar mezclas de hierba, tierra, roca y arena, más una capa de agua. Radio e intensidad ajustables, borde suave y presión opcional del lápiz mediante Pointer Events.
- El agua tiene una máscara independiente y una cota horizontal ajustable. Solo aparece donde el suelo queda bajo esa cota. Shift con el pincel Agua borra su máscara. No consume un canal de los cuatro materiales del suelo.
- La pestaña Bloques añade cajas, rampas, cilindros y planos para preparar el escenario. Se pueden mover, rotar, escalar y colorear, editar vértices y extruir caras triangulares. Selección múltiple con Shift o las casillas de la lista; «Unir mallas» combina la selección en un objeto editable. Conserva el color del primer objeto seleccionado y las caras interiores: es una unión de mallas, sin booleanas de sólidos.
- Ratón izquierdo para dibujar, derecho para girar, central para desplazar y rueda para zoom. Shift invierte subir/bajar. En táctil, elegir «Mover cámara» para girar con un dedo y usar dos para zoom/desplazamiento. Un trazo acepta un solo puntero; al dibujar con lápiz se ignoran los demás. Cancelar un puntero o pulsar Escape revierte el trazo.
- Deshacer/rehacer guarda hasta veinte operaciones durante la sesión. Ctrl/⌘ Z y Ctrl/⌘ Shift Z. El mapa nuevo y la importación también se pueden deshacer.
- El borrador se guarda tras cada operación en `cmg-terreno:borrador-v1`. No se mezclan las claves de programas ni las preferencias del juego. Si el almacenamiento falla se mantiene el mapa en memoria y se ofrece guardar JSON.
- «Probar en War» guarda una copia en `cmg-terreno:war-v1` y abre `Prototypes/Rocket Launcher/?terreno=editor`. Solo esta URL carga el mapa. War normal y Factory conservan sus paisajes. La copia de War se actualiza al volver a pulsar el botón; una partida ya abierta debe recargarse.

## Formato v2 y compatibilidad

JSON lleva `formato: "cbl-terreno"`, `version: 2`, `nombre`, `columnas: 129`, `filas: 97`, `paso: 0.5`, `origen: {x: -16, z: -18}`, `alturas`, `pesos`, `agua` y `bloques`. No contiene objetos serializados de Three ni información de la simulación. La importación migra los mapas v1 añadiendo agua vacía y una lista vacía de bloques; conserva sus alturas y materiales. Las claves locales se mantienen para recuperar automáticamente un borrador anterior.

El mapa ocupa 64 × 48 metros: X de −16 a 48, Z de −18 a 30, Y vertical. Índice `i = fila * 129 + columna`, con X y Z crecientes. `alturas[i]` está en metros (−2 a 20); `pesos[i*4 + canal]` son números de 0 a 1 cuya suma es 1. Canales: hierba, tierra, roca, arena. Los colores están fijados en `CMGTerreno.PALETA`. El editor interpola colores lineales; el adaptador r128 respeta la gestión de color heredada del juego.

El campo War ocupa X de 0 a 32 y Z de 0 a 18. Su altura y un margen de 1 m se mantienen en cero en los pinceles. La importación rechaza alturas distintas de cero en esa zona. Se puede pintar el campo completo. El JSON se valida antes de reemplazar el mapa; se rechazan versiones, dimensiones, valores no finitos, pesos o nombres inválidos, y archivos mayores de 5 MB en la interfaz.

`agua` contiene `nivel` (metros, −2 a 20) y `mascara` (129 × 97 valores entre 0 y 1, mismo orden que las alturas). La geometría de agua usa alfa por vértice y omite los triángulos secos; el suelo oculta el agua que queda por debajo.

Cada bloque guarda `id`, `nombre`, `color` hexadecimal, `vertices` XYZ locales, `indices` de triángulos, `posicion`, `rotacion` (radianes XYZ) y `escala`. Límite: 64 objetos, 4096 vértices y 24576 índices en total. El validador comprueba transformaciones, índices y datos antes de sustituir el mapa. El JSON conserva las mallas modificadas; los PNG solo contienen las capas de terreno y agua.

El escenario es **visual**: terreno, agua y bloques no cambian colisiones, línea de visión, trayectorias, RNG, paso fijo, programas ni coordenadas del juego. Las montañas del editor sustituyen las decorativas de War. Las mallas no interceptan la selección de unidades. Un dato local inválido deja el paisaje predeterminado.

## PNG reutilizables

«Texturas PNG» descarga tres archivos de 129 × 97 píxeles. Cada fila sigue el mismo orden Z creciente del JSON; no se invierte verticalmente al exportar.

| Archivo | Formato | Lectura |
| --- | --- | --- |
| `*-altura16.png` | Gris de 16 bits sin pérdida | `altura = -2 + muestra / 65535 * 22` metros; error máximo aproximado de 0,000168 m |
| `*-mezcla.png` | RGBA de 8 bits | R=hierba, G=tierra, B=roca, A=arena. Los cuatro bytes suman 255. A es un peso, no opacidad. |
| `*-agua.png` | Gris de 8 bits | Máscara de agua: `valor / 255`. La cota está en el JSON. |

La mezcla es un mapa de datos: cargar sin conversión sRGB y leer los cuatro canales, incluido alfa. En Three, elegir conscientemente `flipY` de acuerdo con las UV de la malla receptora. Conservar el JSON junto a los PNG para las dimensiones físicas, el origen, nombre y pesos de precisión completa. Esta fase reabre JSON; no importa PNG. PNG requiere `CompressionStream`, disponible en los navegadores actuales compatibles con el visor.

## Arquitectura y límites

- `shared/terreno/datos.js`: formato, validación, relieve determinista y pinceles sin dependencia gráfica.
- `shared/terreno/malla.js`: buffers de geometría y color, compatible con r128/r180.
- `shared/terreno/bloques.js`: primitivas, unión de mallas y extrusión de triángulos.
- `herramientas/terreno/editor.js`: interacción, historial, almacenamiento y visor.
- `herramientas/terreno/bloques-ui.js`: selección y herramientas de modelado.
- `herramientas/terreno/png.js`: exportación PNG, incluida altura real de 16 bits.
- `shared/vendor/three-r180/`: distribución oficial local, licencia y manifiesto SHA-256. No sustituye el vendor original.

Quedan fuera booleanas de sólidos, UV, subdivisión, animación, carreteras, erosión, simulación de fluidos, mapas de tamaño arbitrario y cambios de reglas. No se intenta migrar el resto del juego a WebGPU. El S Pen y el rechazo de palma requieren QA físico; los eventos sintéticos solo comprueban el código de presión y cancelación.

Pruebas sin dependencias: `node pruebas/terreno.cjs`, `node pruebas/terreno-bloques.cjs` y `node pruebas/terreno-png.mjs`. Servir en el puerto dedicado 8771 para pruebas de navegador. `pruebas/terreno-navegador.mjs` y `pruebas/terreno-modelado.mjs` exportan `probarTerreno(page)` y `probarModelado(page)` para una Page de Playwright. Preparar el paquete estático también incluye este editor, sin publicar nada.

[Captura WebGPU con agua y bloques](qa/editor-terreno-2026-11-12/webgpu.png) · [Captura móvil](qa/editor-terreno-2026-11-12/movil.png).
