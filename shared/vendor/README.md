# Dependencias locales

Se sirven directamente; jugar no necesita npm, compilación ni CDN.

| Archivo | Versión | Fuente fijada |
| --- | --- | --- |
| acorn-8.11.3.js | 8.11.3 | `nodejs/node`, tag `v22.0.0`, `deps/acorn/acorn/dist/acorn.js` |
| lezer-python-1.1.19.js | @lezer/python 1.1.19 (+ lr 1.4.11, common 1.5.4, highlight 1.2.5) | npm, empaquetado con `herramientas/lezer-python/construir.sh` (esbuild 0.28.2, versiones y `package-lock.json` fijados) |
| `three-r180/` | Three.js r180 (0.180.0) | `mrdoob/three.js`, tag `r180`: WebGL, WebGPU, core, GLTFLoader y OrbitControls ESM; [procedencia e integridad](three-r180/README.md) |

Acorn corresponde a la distribución UMD publicada de 8.11.3, conservada en Node 22.0.0. Se conservan las licencias MIT de Acorn y lezer aquí, y de Three en `three-r180/LICENSE`. Los archivos clásicos incluyen un salto de línea final adicional respecto a la fuente descargada.

`manifest.json` fija los SHA-256 de los archivos distribuidos. `node pruebas/editor-lenguajes.cjs` comprueba integridad, versiones y contrato D1/D2. Para actualizar, obtener los archivos desde los tags indicados, conservar las licencias, revisar cambios y actualizar explícitamente los hashes. Las URL de esta documentación son procedencia; la aplicación no las consulta.

lezer se publica como módulos ESM. El guion genera un único script clásico que define `LezerPython.parser`: el adaptador Python del editor lo usa para el árbol, y en E5 el traductor usará ese mismo árbol. Regenerarlo con el mismo `package-lock.json` da un archivo idéntico, byte a byte. Ni el juego ni las pruebas necesitan npm.

El juego y el laboratorio VFX usan `three-r180/three.module.min.js` (WebGLRenderer,
WebGL 2 obligatorio, GLSL). El editor de terreno usa `three.webgpu.min.js`
(WebGPU con respaldo WebGL 2). Cada documento resuelve `three` con su propio
mapa de imports; el del juego permite cargar GLTFLoader y sus utilidades sin red,
tanto sobre HTTP como sobre `cbl://app/` en Electron. El laboratorio importa la
ruta local directamente, sin addons. No se publica `window.THREE`: las vistas y
CMGTerreno reciben el namespace por parámetro. GLTFLoader se importa de forma
diferida en `js/servicios.js` y se inyecta mediante `cargarGLTFLoader`.

Los originales de r180 son copias exactas del tag, cubiertas por su propio
manifiesto (incluidos tamaños y licencia); `editor-lenguajes.cjs` comprueba
ambos manifiestos. Los clásicos r128 y su licencia se retiraron al migrar todos
sus consumidores. `scripts/archivos-publicables.mjs` incluye `shared/` completo,
por lo que web y escritorio reciben el mismo conjunto local.
