# T10 · Datos de decorado: qué teselas se cargan y dónde va el kit de paisaje

Trabajas solo y sin humano. No hagas preguntas. Esta tarea es corta: cumple el resultado y para. Eres el asesor de 3D y matemáticas: aquí solo se piden **datos y su prueba**, no cambios en la vista.

## Reglas fijas
- Escribe solo en `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`. Sin commits, push, checkout, stash, reset, instalaciones ni descargas.
- No intentes abrir puertos ni navegadores: el sandbox no lo permite y la revisión visual la hace Claude.
- Determinismo: si generas posiciones con azar, usa un generador con semilla fija dentro del script y deja en el archivo **la lista literal** resultante.
- No abras ningún archivo que no esté en «Puedes abrir». Nada de `cat` de archivos enteros salvo el JSON del mapa (4,6 kB).
- Si te falta algo que no está aquí, no explores: termina con «Falta contexto: …».

## Resultado
Un módulo de datos `paquetes/vista-3d/cv2/decorado.js` que dice (1) qué teselas de terreno cargar para que, con la niebla de la cámara, nunca se vea el borde del mapa cargado, y (2) dónde colocar entre 40 y 80 piezas del kit de paisaje, fuera del campo de juego, para que la batalla y la fábrica se vean dentro de un paisaje y no sobre un recorte. Más una prueba que lo comprueba.

## Archivos
- Crea: `paquetes/vista-3d/cv2/decorado.js`, `pruebas/campaign-v2-decorado.mjs`
- Puedes abrir (solo lectura): `arte/blender/papercraft/mapa-ampliado.json` (entero), `paquetes/vista-3d/cv2/modelos.js` (41 líneas)
- No toques nada más.

## Contexto (todo en metros del mapa papercraft)

**Ejes.** Mapa de 400 × 208 m. x hacia el este; la `y` del mapa es la `z` de three.js (hacia el sur). Y es arriba. 1 unidad = 1 m.

**Teselas.** 16 GLB `terreno-{fila}-{col}` (fila 0–3, col 0–3). Cada una cubre x ∈ [100·col, 100·col + 100], z ∈ [52·fila, 52·fila + 52]. Pesan 0,6–1,2 MB cada una (11,9 MB en total), así que no se cargan todas sin motivo. Hoy se cargan solo `terreno-1-1` y `terreno-1-2` (x 100–300, z 52–104).

**Zonas que el kit no puede tapar:**
- Campo de batalla (marco): x 204–236, z 72–90. Amplíalo 3 m por cada lado como margen.
- Muralla: polilínea de cara exterior `muralla` del JSON (empieza en (207, 44) y baja hacia el suroeste). Margen de 6 m a cada lado.
- Bastiones con torreta: (210, 77), (210, 81), (210, 85). Ya están dentro del margen del campo.
- Carriles del JSON (`carriles`, cada uno con `ancho`): margen de ancho/2 + 2 m. Los enemigos llegan por el «Paso del este».
- Fábrica de la campaña, dentro de la muralla: x 170–207, z 60–90.
- Losa del JSON (`losa`: centro y metros) y carretera (`carretera`, con `ancho`): mismo margen que los carriles.
- Río (`rio`, puntos con anchos): sin piezas encima.

**Dónde sí.** Prioriza los rectángulos de `bosques` del JSON (formato `[x, z, ancho, fondo, n]`, interprétalo con su centro o esquina como sea coherente con los demás datos y dilo en un comentario), las laderas cercanas a `cordilleras` y el anillo visible alrededor del campo. Mezcla de piezas creíble: más pinos y matorral que torres; como mucho 2 `torre` y 2 `lienzo`.

**Kit** (`arte/blender/papercraft/glb/kit/<id>.glb`; caja en metros, Y arriba, origen en la base):

| id | min x,y,z | max x,y,z |
|---|---|---|
| alcornoque | −3.49, 0, −2.47 | 3.28, 6.30, 2.35 |
| esparto | −0.80, 0, −0.84 | 0.75, 1.47, 0.65 |
| espigas | −0.92, 0, −0.92 | 0.56, 2.02, 0.77 |
| laja | −1.37, 0, −1.07 | 1.68, 0.77, 1.07 |
| lienzo | −3.71, 0, −1.68 | 3.71, 6.49, 1.68 |
| matorral | −1.37, 0, −1.07 | 1.68, 1.91, 1.07 |
| pino-alto | −2.10, 0, −2.45 | 2.57, 8.30, 2.45 |
| pino-joven | −1.47, 0, −1.71 | 1.80, 5.80, 1.71 |
| roca | −1.37, 0, −1.07 | 1.68, 1.91, 1.07 |
| torre | −2.60, 0, −2.84 | 2.60, 9.19, 2.84 |

La pieza entera (su caja girada y escalada) debe quedar fuera de las zonas prohibidas y dentro de las teselas cargadas.

**Cámara de la vista 3D** (perspectiva, fov vertical 38°, far 500):
- Batalla: encuadra la zona x 204–236, z 72–90 con yaw 0,15 rad y pitch 1,15 rad (casi cenital), y la distancia sale de encuadrar esa caja; con relación 16:10 ronda 30–40 m.
- Fábrica: encuadra x 170–207, z 60–90 con yaw −0,6 y pitch 1.
- Zoom permitido: distancia entre 8 y 160. El jugador puede rotar y desplazar.
- Niebla lineal: empieza en 0,55·dist y es opaca a 1,75·dist desde la cámara. Lo que quede más lejos que eso no se ve.

Con esto, calcula qué teselas hacen falta para que el borde del terreno cargado quede siempre más allá de la niebla opaca **en el encuadre inicial de batalla y de fábrica y hasta dist = 60** (por encima de 60 se acepta ver el borde). Si eso exige más de 6 teselas, propone en un comentario un tope de zoom que lo evite con 6 como máximo.

## Forma del módulo
```js
// Comentario breve con el razonamiento del encuadre (niebla, distancias, por qué esas teselas) y el tope de zoom recomendado.
export const terrenosBatalla = ['terreno-1-1', 'terreno-1-2', /* … */];
export const zoomMax = 60; // o el que justifiques
/** @type {Array<{ id: string, x: number, z: number, giro: number, escala: number }>} giro en radianes alrededor de Y, escala 0,8–1,25 */
export const kit = [ /* lista literal, 40–80 entradas */ ];
export const zonasProhibidas = { /* las que usaste, en forma de datos, para que la prueba y la vista las reutilicen */ };
```

## Comprobación
- Crea `pruebas/campaign-v2-decorado.mjs` (Node, `node:assert/strict`, importando solo `decorado.js` y leyendo el JSON con `readFile`). Debe afirmar: 40–80 piezas; ids del kit válidos; como mucho 2 torres y 2 lienzos; cada caja girada y escalada fuera de todas las zonas con su margen y dentro de las teselas de `terrenosBatalla`; sin solapes entre piezas (cajas en planta); y que para el encuadre de batalla y de fábrica a dist = `zoomMax` el anillo de niebla opaca cae dentro de las teselas cargadas (aproxima la huella del encuadre en el suelo como quieras, explícalo en un comentario).
- Al terminar ejecuta solo `node pruebas/campaign-v2-decorado.mjs` y `node --check paquetes/vista-3d/cv2/decorado.js`. No ejecutes la suite completa.

## Topes
- Unas 20 llamadas al modelo. Si te acercas sin terminar, deja el árbol coherente y termina con lo que falta.

## Mensaje final (solo esto)
1. Los archivos creados.
2. La salida de la prueba.
3. En 5 líneas como máximo: qué teselas, el tope de zoom y por qué.
4. Si aplica: «Falta contexto: …».
