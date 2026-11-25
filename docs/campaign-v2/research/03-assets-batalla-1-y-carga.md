# Assets 3D para la Batalla 1 y cadena de carga de modelos

Ticket: `issues/03-assets-batalla-1-y-carga.md`. Fuentes: `origin/assets-3d` (ac1d810; su merge-base con `origin/trunk` es 6330c0e, el HEAD actual de trunk, así que assets-3d es trunk más sus commits) y `origin/trunk`. Los tamaños salen de `git ls-tree -r -l`; nodos, mallas, triángulos y cajas, del chunk JSON de cada GLB leído con `git show` (sin extraer a disco). Los tris de torreta y vehículo no se contaron (solo T1, muralla, kit y terreno).

## 1. Inventario de assets

### Torreta esfera
`Prototypes/Rocket Launcher/modelos/torreta_observacion.glb` · **1 942 088 B** (en trunk no existe; solo en assets-3d).
- 51 nodos, 24 mallas, 6 materiales, 0 texturas, **0 animaciones, 0 skins**. Raíces: `L0_`, `L1_`, `L2_TorretaObservacion` (tres LOD, 17 nodos cada uno). Caja de malla: x±0,69, y -0,50..0,76, z±0,69 m (aprox. 1,4 × 1,3 × 1,4 m).
- Pivotes L0: `base_giro`, `munon`, `hoja_i`, `hoja_d`, `telescopio_1..4` (más `TorretaObservacion` raíz).
- Rig `cbl-rig` v2 en `extras` (cadena JSON en `extras.rig` de cada nodo; en la raíz, `controles` y `bucle`). **Cuatro controles**: `azimut` (rad, cíclico), `inclinacion` (rad, cíclico), `hojas` (0..1), `extension` (0..1).
- Mapeo (según `arte/blender/torreta_observacion/esfera/exportar_torreta.py`, MANDOS): azimut gira `base_giro` en Z; inclinación gira `munon` en X; hojas giran `hoja_i`/`hoja_d` ±100° en Y; extensión traslada `telescopio_1..4` 0,1 m en Z.
- Hay `bucle` (24 fps, 359 cuadros, 11 claves) que solo es una secuencia de demostración de esos cuatro controles. No es una animación glTF.
- **Ajuste a Batalla 1:** apuntar = `azimut` + `inclinacion`; compuerta = `hojas`; telescopio = `extension`. **No existe control ni nodo de "disparo" ni de "atasco".** Eso tendría que salir de la lógica, efectos o materiales, o de un rediseño S (DECISIONES-GRILL.md:31 dice que se usa este GLB "mientras se exporta el rediseño S").

### Otras máquinas con rig (referencia)
- `vehiculo_tubular.glb` · 5 378 992 B · 864 nodos, 321 mallas, sin animaciones. 18 controles (`raiz.giro`, `torreta.giro`, `arma.elevacion`, `boca.recorrido`, `rueda_*.giro`, `direccion_*`, `esquina_*.recorrido`, `raiz.cabeceo/balanceo/flotacion_aro`, `motor.oscilacion`). Es el vehículo tubular, no el VEH de `unidades_batalla`.
- `t1.glb` · 768 988 B en assets-3d (**742 812 B** en trunk: son blobs distintos; assets-3d lo reexportó con rig). 54 nodos, 27 mallas, 16 462 tris. 5 controles (`torreta.giro`, `hombro.giro`, `codo.giro`, `muneca.giro`, `pinza.apertura`). Es el único GLB que trunk carga hoy (Factory).

### Muralla (papercraft; `arte/blender/papercraft/glb/muralla/`)
Decisión del autor (MURALLA-OPCIONES.md, "Elección del autor · 23 de noviembre de 2026"): **C · Traba + Cordón**, tramo de Traba, nudo de Traba donde la muralla sigue recta con torre, torreón de Cordón (opción 07) en los cambios de ángulo fuertes.

| Pieza | Bytes | Tris | Caja (x largo, y alto, z fondo) | Notas |
|---|---|---|---|---|
| `opcion-03-tramo.glb` | 21 580 | 180 | 7,0 × 10,5 × 3,2 m (x -3,5..3,5; y 0..10,5; z ±1,6) | 1 nodo, 1 malla, sin rig |
| `opcion-03-nudo.glb` | 28 180 | 240 | 7,0 × 16,0 × 5,6 m (z ±2,8) | idem |
| `opcion-07-tramo.glb` | 82 536 | 734 | 7,0 × 10,5 × 2,95 m | |
| `opcion-07-nudo.glb` | 78 352 | 696 | 7,0 × 16,0 × 5,41 m | torreón hueco oval |

- Un nodo cada uno (nombre = archivo), sin animaciones ni extras. Origen en el centro de la base (y = 0 es el pie).
- **Cada GLB referencia dos PNG externos por URI relativa** `../../texturas/relieve.png` (2 134 868 B) y `../../texturas/fibra.png` (1 006 413 B): hay que servir esa estructura de carpetas tal cual (README papercraft: "Conserva esta estructura"). Material "Cartulina de trapo", COLOR_0/COLOR_1 por vértice.
- Escala: el tramo mide 7 m de largo y 10,5 m de alto; la muralla procedural actual del motor de vóxeles es una banda de 1,5 m × 3,4 m (docs/MURALLA-VOXELES.md, "Plan para Campaign"). Son escalas distintas; el mapa papercraft es de 400 × 208 m. Queda para el ticket 09.
- **Punto de apoyo del bastión:** no se encuentra en ningún archivo de assets-3d ni de trunk. Lo único escrito es la decisión del grill: cara frontal en x = 3 (`LINEA_BASE`) y torretas en bastiones (nudo de Traba) que sobresalen hasta x = 6 (DECISIONES-GRILL.md:30). Los GLB no traen ningún empty/ancla; habría que derivarlo de la caja del nudo (5,6 m de fondo, 16 m de alto) o añadirlo.
- Existe además una pieza `kit/torre.glb` (95 600 B, 810 tris, 5,19 × 9,19 × 5,68 m), ajena a la elección.
- Otros diez pares tramo/nudo (opciones 01-10), entre 6 400 y 82 536 B cada uno, se conservan como referencia.

### Terreno (mapa ampliado)
- `glb/mapa/terreno-{F}-{C}.glb`, F y C en 0..3: 16 trozos, **11 948 864 B en total** (580 332 a 1 162 016 B cada uno; p. ej. `terreno-0-0` 728 988 B, 5 383 tris, caja 100 × 4,25 × 52 m). Mapa 400 × 208 m en 4 × 4 trozos de 100 × 52 m, vértices en coordenadas absolutas (x este, z sur, Y altura). Mismas dos texturas externas. Sin animaciones.
- Zona de combate: `mapa-ampliado.json` define "casa" y "frentes" como polígonos; la muralla ("J") sigue `[[207,44],[207,60],…,[113,117]]`. Qué trozos cubren la sección de la Batalla 1 no está decidido en los archivos (la decisión de grill habla de "una sección del mapa papercraft", DECISIONES-GRILL.md:29).
- Colocaciones (árboles, rocas, torres) en `colocaciones.json` (128 221 B), no fundidas en el terreno; kit en `glb/kit/` (10 piezas, 316 284 B en total).

### Unidades futuras sin GLB: VEH y WHL
- `arte/blender/unidades_batalla.py` (24 985 B) y `unidades_batalla.blend` (319 659 B). El propio docstring dice: "No exporta GLB ni está integrado en el juego".
- Pivotes declarados: VEH = `torreta`, `elevacion`, `rueda_i/d_0..1`, `vida_0..3`; WHL = `aro`, `nucleo`, `iman_1/2`, `pata_*`, `rodilla_*` (y `pose_rueda(raiz, t)`).
- No tienen script de exportación (los exportadores del kit, p. ej. `exportar_torreta.py`, no los cubren ni hay equivalente para ellas) ni extras `cbl-rig`. Para ser un GLB con rig hay que escribir un descriptor del kit (`arte/blender/kit/descriptor.py`) como el de la torreta. No verificado cuánto trabajo es.

## 2. Cadena de carga actual (trunk)

1. `paquetes/vista-3d/recursos.js` **no carga modelos**: solo exporta `liberarEscena` y `escucharEn` (recursos.js:1-24). El ticket lo señalaba como cadena de carga; no lo es.
2. `Prototypes/Rocket Launcher/js/servicios.js:5-6` define `cargarGLTFLoader = () => import('../../../shared/vendor/three-r180/loaders/GLTFLoader.js').then(m => m.GLTFLoader)` y lo expone en `servicios` (servicios.js:11). Es lazy: nada se descarga hasta que alguien lo llama.
3. `paquetes/app/juego/vistas.js:46-47` pasa `servicios.cargarGLTFLoader` a las vistas. `paquetes/vista-3d/war.js:10` lo recibe y, solo en Factory, lo reenvía (war.js:168) a `factory3d.construir`.
4. `paquetes/vista-3d/factory.js:4` fija `const MODELO = "modelos/t1.glb"` (relativa a la página; no hay registro ni mapa de modelos). `cargar()` (factory.js:19-25) guarda una promesa módulo-global y llama `new GLTFLoader().load(MODELO, ok, undefined, () => ok(null))`; si falla, devuelve `null` y se queda un bloque provisional. Se llama en factory.js:106; se clonan `L0..L2_RobotTransporte` por nombre (`getObjectByName("L{n}_...")`) y la pose se escribe a mano con `rotation.*` (hombro, codo, etc.).
5. **No hay resolución a raw.githubusercontent en trunk** (búsqueda en `origin/trunk` sin resultados fuera de PROGRESO/docs). La URL es relativa y funciona porque el binario está en el mismo origen. Con raw.githack el binario da 403 (memoria del proyecto).
6. Donde sí existe la reescritura: `arte/blender/papercraft/visor/muralla.js:6-8`, `visor.js:6-8` y `herramientas/muralla/finalistas.mjs:4` (solo en assets-3d): `new URL(aqui.pathname, 'https://raw.githubusercontent.com')` si el host acaba en `githack.com`, con comentario de que raw.githubusercontent usa la misma ruta y permite CORS. Es código local de cada visor, no una utilidad compartida.
7. Rig (solo assets-3d, no está en trunk): `paquetes/rig/` es puro (sin Three): `leerRig(gltfJson)` y `crearSolver(rig, nivel)` (README.md). `paquetes/vista-3d/rig.js:4-23` `conectarRig(THREE, raiz, rig, nivel)` busca los nodos por `L{nivel}_{nombre}` en `raiz`, pone `matrixAutoUpdate = false` y devuelve `{controles, aplicar(valores)}`. Lanza `Error('Falta el pivote del rig: …')` si falta un nodo. `factory.js` de assets-3d lo usa para el T1 (líneas 5, 120-125, leyendo `g.parser.json`) y se exporta desde `vista-3d/index.js:8`. Cadena de versión: `cbl-rig` v2 (README del kit).
8. `shared/muralla/{voxeles,vista-three,material-three}.js` (solo assets-3d): motor de vóxeles procedural (`CMGMuralla`, `CMGMurallaVista`), **no carga GLB de muralla**. Los GLB de `opcion-*` solo los usan los visores papercraft. Los GLB del mapa también.

## 3. Qué haría falta para asociar un GLB con rig a una unidad nueva sin tocar archivos compartidos

Derivado de lo anterior; es análisis, no está implementado.
- Hoy hay tres puntos compartidos y fijos: la constante `MODELO` y el nombre `RobotTransporte` en `factory.js` (un solo modelo, un solo cargador), los nombres de nodo `L{n}_{pivote}` que exige `conectarRig`, y el preámbulo de resolución de URL que cada visor copia.
- Con la base de assets-3d, un GLB con rig nuevo solo necesita: (a) estar exportado con `cbl-rig` v2 y tres raíces `L0..L2_<Nombre>`; (b) un módulo propio que cargue con `cargarGLTFLoader` (ya inyectable), llame a `leerRig(g.parser.json)` y a `conectarRig(THREE, copia, rig, n)`, y (c) una función de URL que reescriba githack a raw.githubusercontent para el `.glb` y sus PNG (las texturas externas de papercraft también dan 403). `conectarRig` no tiene nada específico de T1, así que ese paso no obliga a tocar `rig.js` ni `paquetes/rig`.
- Lo que **no** existe y obligaría a tocar un archivo compartido o crear uno: un registro/caché de modelos y la resolución de URL común (DECISIONES-GRILL.md lista ambos como "cambios de arquitectura permitidos para el 3D"), y una forma de enganchar un modelo a un tipo de unidad en `war.js`/`instancias-war.js` (las unidades de War se dibujan con primitivas: `war.js:65-67`, `instancias-war.js`; la selección de modelo por tipo no está en los archivos revisados). No se verificó cómo `crearInstanciasWar` decidiría usar un GLB: no se encontró un punto de extensión.
- Para el caso de la torreta con la base de assets-3d, el rig ya expone los cuatro controles necesarios para apuntar, compuerta y telescopio; disparo y atasco serían estado de la vista, no del rig.
