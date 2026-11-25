# Brief · kit papercraft y mapa ampliado de Campaign

Encargo para Astra (Codex). Lo redacta y revisa Claude; el autor del juego dará feedback al final.

## 1. Contexto

Code Battle Lite es un juego de programación en el navegador. Su serie Campaign tiene un mapa de 200 × 104 m: fábrica al oeste, una muralla en forma de «J» y un campo de batalla al este. La imagen adjunta `mapa-actual-cenital.png` es ese mapa visto desde arriba (verde = lado de la fábrica, ocre = frente, línea oscura = muralla). Es todo lo que necesitas de él: no hace falta leer el código de Campaign.

Ese prototipo va a desaparecer. Lo que queremos de este experimento son **assets de Blender reutilizables** con un aspecto papercraft, montados sobre un mapa cuatro veces mayor, y un visor mínimo para recorrerlo y opinar. No es un juego: nada jugable, nada de interfaz de partida.

**Empieza desde cero.** El mapa del repo es solo una referencia de composición. No reutilices su código ni sus estructuras de datos, y no estás atado a Three.js r128 ni a ninguna limitación del juego actual: el próximo prototipo se adaptará a lo que salga de aquí.

## 2. Objetivo único de esta iteración

Un kit papercraft en Blender (materiales, texturas y piezas), el mapa ampliado montado con ese kit y exportado a glTF, y un visor web mínimo para navegarlo. La ampliación del mapa es el lienzo del estilo, no una segunda meta que optimizar.

## 3. Dirección de arte

Referencias adjuntas, **solo para ánimo, paleta y luz. Nunca las uses como textura ni como fondo**:

- `estilo.png`: el objetivo de estilo. Papel rasgado en capas, con el alma blanca y fibrosa visible en cada borde, luz cálida y sombras suaves entre capas.
- `moonmender.png`: un juego Three.js que hiciste tú con ese estilo, todo en código y en tiempo real. Es el nivel de calidad que buscamos en el visor.

Toma de ellas **el tratamiento del material**, no sus objetos (nada de casas, molinos, setas, personajes, lunas ni planetas).

**Técnica que ya te funcionó en Moonmender.** Es un punto de partida para trasladar a Blender y al visor; cámbiala si encuentras algo que se vea mejor:

1. **Una sola textura de fibra compartida**, generada por script: ruido en varias escalas más miles de trazos cortos de fibra, claros y oscuros. Va como `baseColor` (modula un color casi blanco) y como mapa normal suave para el grano.
2. **El color de cada lámina va en colores de vértice** (`COLOR_0`), con un moteado leve por anillo o cara. Así el próximo prototipo puede recolorear zonas sin texturas nuevas.
3. **Contorno «deckle»** irregular: suma de senos con fase por pieza más un poco de ruido con semilla.
4. **Canto en dos bandas**: abajo una línea de cola oscura, encima una banda clara de alma de cartulina expuesta, y luego la cara de color.
5. **Sombras de cola**: calcos suaves de degradado radial oscuro bajo las piezas superpuestas (malla con alfa, sin escribir profundidad), además de las sombras reales del visor.

Dirección:

- **Cartulina mate recortada.** Cada zona es una lámina de color casi plano con el grano de fibra. Las láminas se superponen como un collage: parches de verde, ocre y turquesa a alturas apenas distintas (0,1–0,3 m), cada uno con su canto de dos bandas (0,15–0,4 m en total) y su contorno deckle.
- **Relieve escalonado.** Los montes son pisos de cartulina apilados (1,5–3 m por piso, con el contorno de cada piso desplazado y algo irregular), no una superficie lisa. Las cumbres altas pueden llevar un último piso blanco roto.
- **Agua.** Lámina turquesa apagada, hundida bajo el suelo, con canto claro y unas pocas ondas recortadas en papel más claro.
- **Vegetación y rocas.** Pinos de dos o tres conos facetados apilados, árboles frondosos de poliedro facetado y aplanado, troncos de cartón marrón, arbustos y rocas facetadas. Sombreado plano (flat).
- **Muralla.** Bloques de cartón gris cálido con almenas, canto visible y juntas como trazo de lápiz tenue en la textura. Torres en los quiebres de su trazado.
- **Caminos y carriles.** Tiras de papel kraft beige superpuestas al suelo, con borde recortado.
- **Paleta.** Sale de `estilo.png`: verdes salvia y musgo, ocres y kraft, turquesa apagado, gris piedra cálido y crema de papel para el alma de los cantos. El lado de la fábrica es verde; los frentes, ocres y secos, para que se lean distintos a primera vista. Guárdala en `paleta.json` con nombres en español.

## La regla

**El papel se ve en el visor web, no solo en Blender.** El autor opinará recorriendo el visor, así que el look tiene que llegar ahí. Elige tú la técnica: Three.js moderno, shaders propios, texturas horneadas desde Blender o lo que dé mejor resultado. Lo único que no vale es un look que exista solo en el render de Blender y se pierda en el visor. Haz las previas de `previas/` con una luz equivalente a la del visor, para que muestren lo mismo.

## 4. Mapa ampliado

- **Tamaño:** 400 × 208 m (cuatro veces el área actual). 1 unidad = 1 m.
- **Misma composición, redibujada desde cero.** Conserva lo que define el mapa actual: la fábrica al oeste con su losa y su carretera de proveedores, la muralla en «J» (un tramo recto norte-sur y una curva hacia el suroeste), los montes donde se apoyan sus dos extremos, el río del norte y los carriles del frente que convergen hacia la muralla. Las coordenadas y las formas exactas son tuyas.
- **Zonas explícitas.** El lado de la fábrica («casa») y los frentes son polígonos cerrados en los datos, no algo que se deduzca del trazado de la muralla.
- **Cordilleras.** Los montes donde se apoya la muralla se prolongan como cordilleras hasta el borde del mapa, de modo que muralla y cordilleras separen de forma creíble la casa (oeste y noroeste) de los frentes (este y sur).
- **Frente sur (lo más importante).** Hoy la cara sur de la muralla, la curva de abajo, mira a una franja de 10 m y luego nada. Tiene que mirar a un campo de batalla amplio y coherente con el frente este: llanura seca ondulada, un carril de flanco que se acerca a esa cara y algún otero.
- **Frente este.** El campo llega hasta el borde, con carriles que nacen en él.
- **Norte.** El río nace o entra por el borde norte, entre bosque y montes.
- **Oeste.** La carretera de proveedores entra por el borde oeste, entre campos y bosque.
- **Fuente de verdad:** `mapa-ampliado.json` (trazados, zonas, cordilleras, montes, río, caminos y carriles). Los scripts de Blender y el visor lo leen; nada de coordenadas repetidas a mano en el código.
- **Lado de la fábrica:** basta con suelo verde, la losa plana y el camino. Nada de máquinas ni robots: eso ya existe aparte.

## 5. Entregables

Todo dentro de `arte/blender/papercraft/`:

| Ruta | Qué es |
| --- | --- |
| `README.md` | 60 líneas como máximo: qué hay, cómo regenerarlo y convenciones. |
| `DECISIONES.md` | Una línea por cada decisión que tomaste sin preguntar. |
| `mapa-ampliado.json`, `paleta.json` | Datos (sección 4 y paleta). |
| `comun.py` | Utilidades compartidas: material de papel, canto recortado, capas, exportación. |
| `kit.py` | Construye la biblioteca de piezas → `kit.blend` y `glb/kit/<pieza>.glb`. |
| `mapa.py` | Construye el terreno por trozos y las colocaciones → `glb/mapa/*.glb` y `colocaciones.json`. |
| `texturas/` | Como mucho 6 PNG tileables de 1024 px o menos, **generados por script**. |
| `previas/` | Como mucho 6 JPG: vista general, muralla con frente sur, hoja de contacto del kit y lo que necesites. |
| `visor/index.html` | Visor mínimo (sección 6). |

**Reutilización.** El próximo prototipo colocará estas piezas con su propio código:

- Cada pieza del kit es un objeto con nombre en español, centrado en su base y apoyado en z = 0.
- Las colocaciones (árboles, rocas, torres…) van en `colocaciones.json` como `{ pieza, x, y, z, giro, escala }` en coordenadas del mapa, no fundidas en el terreno.
- El terreno va en trozos de 100 × 52 m (4 × 4) para poder cargarlos por partes.

## 6. Visor mínimo

- `visor/index.html`, sin compilación: tiene que abrirse servido como archivos estáticos (el autor lo abrirá desde raw.githack).
- **Three.js a tu elección.** El repo trae r128 en `shared/vendor/`. Sin red, hay un Three.js 0.187 completo, con `examples/jsm` (GLTFLoader, OrbitControls…), en `/Users/rubenmena/Downloads/GPT 6.2/T07-tiny-planets/fable 5.2/source/node_modules/three/`. Si lo usas, copia a `visor/vendor/` solo los archivos que cargues, más su licencia.
- Carga los trozos del terreno, instancia las piezas según `colocaciones.json` y pone un cielo en degradado crepuscular (azul arriba, lavanda hacia el horizonte), con luz cálida y sombras suaves.
- Navegación de PC y móvil: arrastrar para orbitar, rueda o pellizco para acercar, botón derecho o dos dedos para desplazar.
- Dos interruptores pequeños: «Mapa antiguo» (el contorno de 200 × 104 sobre la zona equivalente, para comparar la escala) y «Rejilla». Nada más en pantalla: sin subtítulos, paneles ni textos explicativos.

## 7. Convenciones técnicas

- **Coordenadas.** El mapa usa x hacia el este e y hacia el sur, en metros. En Three.js eso es `(x, altura, y)`. Para que el glTF llegue así, en Blender X = x del mapa, Y = −y del mapa y Z = altura (el exportador glTF convierte Z-arriba en Y-arriba).
- **Determinista.** Nada de aleatorio sin semilla fija. Ejecutar dos veces da lo mismo.
- **Presupuestos.** Terreno total ≤ 150 000 triángulos (≤ 10 000 por trozo). Cada pieza del kit ≤ 1 500. GLB en total ≤ 25 MB. `kit.blend` ≤ 20 MB. Carpeta completa ≤ 60 MB.
- **Nombres en español** (archivos, objetos, materiales) y comentarios breves en español.
- **Blender 5.2** headless: `/Applications/Blender 5.2.app/Contents/MacOS/Blender -b --factory-startup --python <script>`.

## 8. Cómo ejecutar Blender

Blender **no arranca dentro de tu sandbox** (no ve la GPU Metal y se cae). No lo intentes directamente. Usa la cola:

1. Escribe un script de Python para Blender en `.cola-blender/NNN-nombre.py`, en la raíz del repo. `NNN` es un número creciente (`001`, `002`…): nunca reutilices un nombre.
2. Un vigilante fuera del sandbox lo ejecuta con `Blender -b --factory-startup --python-exit-code 1 --python <script>`, con la raíz del repo como directorio actual. Usa rutas relativas a la raíz.
3. Cuando termina, aparece `.cola-blender/NNN-nombre.log` con toda la salida y, en la última línea, `exit=0` si fue bien. Espera con `sleep 5` en bucle hasta que exista.
4. Los trabajos van de uno en uno, con un máximo de 15 minutos cada uno. Si la carpeta del repo pasa de 1,5 GB o el disco baja de 6 GB libres, el log dice `PAUSA` (`exit=99`): borra salidas intermedias y vuelve a encolar con un número nuevo.
5. `.cola-blender/ESTADO.txt` dice qué está ejecutando el vigilante.

Lo normal es que el trabajo encolado solo llame a tus scripts de verdad (`exec(open("arte/blender/papercraft/kit.py").read())` o similar), para que estos se puedan ejecutar también a mano con el comando del README. Para ver un render, guárdalo en PNG o JPG y ábrelo con tu herramienta de imágenes. Las salidas de la cola no se conservan: lo que valga va a `arte/blender/papercraft/`.

## 9. Reglas de trabajo

- **No hay ningún humano disponible durante la ejecución. No hagas preguntas ni te bloquees esperando respuesta.** Ante una duda, elige la opción más simple que cumpla este brief, anótala en `DECISIONES.md` y sigue.
- Si un mismo problema te falla tres veces, para de insistir: descríbelo en el informe y pasa a lo siguiente.
- Escribe solo dentro de `arte/blender/papercraft/` (y de `.cola-blender/` si la sección 8 lo indica). No toques nada más del repo.
- Nada de git: ni commit, ni checkout, ni ramas. Claude lo hará.
- Sin red y sin descargas: todo se genera por script.
- No intentes abrir navegadores: tampoco arrancan en el sandbox. Claude probará el visor en un navegador real. Tú asegúrate de que las rutas, los imports y la sintaxis son correctos.
- **Disco.** Al equipo le quedan pocos GB libres. Borra renders y archivos intermedios en cuanto dejen de servir; conserva solo las previas finales. Renders de prueba de 960 px de ancho como mucho.
- Prioriza un pase completo de todos los entregables antes de pulir uno. Apunta a unas dos horas de trabajo.

## 10. Hecho cuando

- [ ] `kit.py` y `mapa.py` regeneran todo desde cero sin errores, con los comandos del README.
- [ ] `mapa-ampliado.json` mide 400 × 208 m, mantiene la composición de la sección 4 y define zonas, cordilleras y los cuatro alrededores.
- [ ] El frente sur se ve como campo de batalla en la previa de la muralla.
- [ ] Las previas muestran cartulina con cantos y capas, no un terreno liso de colores.
- [ ] Los GLB se validan (al menos, cabecera y JSON legibles con `node`) y respetan los presupuestos.
- [ ] El visor apunta a archivos que existen, y su JS pasa `node --check` si lo separas en un archivo.

## 11. Informe final

Tu último mensaje sigue exactamente esta plantilla, en español llano, en 25 líneas como máximo. Sin rutas de archivos temporales, sin nombres internos de tus pasos y sin explicar el código línea a línea.

```
RESULTADO: <una frase: qué se puede ver ahora>
HECHO:
- <hasta 5 viñetas, cada una de una línea>
NO HECHO O A MEDIAS:
- <lo que falta o falla, o «nada»>
DECISIONES:
- <hasta 5, las que más afectan al aspecto>
REGENERAR:
<los comandos exactos>
TAMAÑOS: terreno <N> triángulos · GLB <N> MB · carpeta <N> MB
```
