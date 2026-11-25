# Assets 3D disponibles para la Batalla 1 y su cadena de carga

Type: research
Label: wayfinder:research
Status: resolved
Blocked by: —

## Question

¿Qué assets de `origin/assets-3d` sirven tal cual para la Batalla 1, cuáles faltan y por dónde se cargan hoy?

- **Torreta esfera:** `torreta_observacion.glb`, con sus huesos o animaciones (apuntar, compuerta, disparo, atasco).
- **Muralla:** tramo y nudo de Traba (`opcion-03`), con escala y punto de apoyo del bastión.
- **Terreno:** losetas del mapa ampliado.
- **Unidades futuras sin GLB:** VEH y WHL (`unidades_batalla.blend/.py`).

Medir tamaño en disco de cada GLB. Describir la cadena actual de trunk para cargar un modelo: `vista-3d/recursos.js`, `paquetes/rig` en assets-3d, `shared/muralla`, y la resolución de URL a raw.githubusercontent (memoria: raw.githack da 403 en binarios). Responder qué haría falta para asociar un GLB con rig a una unidad nueva sin tocar archivos compartidos.

## Pistas

`git ls-tree -r --name-only origin/assets-3d`, `arte/blender/papercraft/{BRIEF,DECISIONES,MURALLA-OPCIONES}.md`, `paquetes/rig/README.md` (assets-3d), `paquetes/vista-3d/README.md` (trunk).

## Answer

Detalle y evidencia: [research/03-assets-batalla-1-y-carga.md](../research/03-assets-batalla-1-y-carga.md). Todo en `origin/assets-3d` (trunk no tiene rig, ni la torreta, ni la muralla papercraft).

| Asset | Tamaño | Contenido | Ajuste a Batalla 1 |
|---|---|---|---|
| `Prototypes/Rocket Launcher/modelos/torreta_observacion.glb` | 1 942 088 B | 3 LOD, 51 nodos, sin animaciones glTF; rig `cbl-rig` v2 con controles `azimut`, `inclinacion`, `hojas`, `extension` | Sirve para apuntar, compuerta y telescopio. **No hay control de disparo ni de atasco.** |
| `papercraft/glb/muralla/opcion-03-tramo.glb` / `-nudo.glb` | 21 580 / 28 180 B | 1 malla, 180 / 240 tris, 7 × 10,5 × 3,2 m / 7 × 16 × 5,6 m; sin rig ni anclas | Existen. Dependen de `../../texturas/{relieve,fibra}.png` (3,1 MB). Escala distinta de la banda de 1,5 × 3,4 m del motor de vóxeles. **Punto de apoyo del bastión: no definido en ningún archivo.** |
| `opcion-07-nudo.glb` (torreón Cordón) | 78 352 B | 696 tris | Existe |
| `papercraft/glb/mapa/terreno-{0..3}-{0..3}.glb` | 16 trozos, 11 948 864 B (0,58 a 1,16 MB c/u) | 100 × 52 m c/u, mapa 400 × 208 m | Existen; qué trozos entran en la Batalla 1 no está fijado |
| VEH y WHL (`arte/blender/unidades_batalla.py/.blend`) | 24 985 / 319 659 B | Solo Blender; "No exporta GLB" | **Faltan los GLB** y su descriptor de exportación |

Cadena de carga en trunk: `recursos.js` solo libera recursos (no carga). El único modelo es `modelos/t1.glb`: `servicios.js:5-6` (import perezoso de GLTFLoader r180) llega por `vistas.js:46-47` y `war.js:168` a `factory.js:4,19-25,106`, con la URL relativa fija y sin resolución a raw.githubusercontent. Esa reescritura solo existe copiada en los visores de assets-3d (`muralla.js:8`, `visor.js:8`, `finalistas.mjs:4`). `paquetes/rig` y `conectarRig` (`vista-3d/rig.js`) son genéricos, pero faltan en trunk. Para una unidad nueva con rig se puede escribir un módulo propio sin tocar `rig.js` (cargar, `leerRig`, `conectarRig`, URL a raw). No existe registro de modelos ni un punto de enganche por tipo de unidad en `war.js`/`instancias-war.js`; eso obligaría a tocar un archivo compartido.
