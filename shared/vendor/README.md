# Dependencias locales

Se sirven directamente; jugar no necesita npm, compilación ni CDN.

| Archivo | Versión | Fuente fijada |
| --- | --- | --- |
| acorn-8.11.3.js | 8.11.3 | `nodejs/node`, tag `v22.0.0`, `deps/acorn/acorn/dist/acorn.js` |
| three-r128.min.js | r128 | `mrdoob/three.js`, tag `r128`, `build/three.min.js` |
| GLTFLoader-r128.js | r128 | `mrdoob/three.js`, tag `r128`, `examples/js/loaders/GLTFLoader.js` |
| lezer-python-1.1.19.js | @lezer/python 1.1.19 (+ lr 1.4.11, common 1.5.4, highlight 1.2.5) | npm, empaquetado con `herramientas/lezer-python/construir.sh` (esbuild 0.28.2, versiones y `package-lock.json` fijados) |

Acorn corresponde a la distribución UMD publicada de 8.11.3, conservada en Node 22.0.0. Three y su cargador deben actualizarse juntos. Se conservan las licencias MIT de Acorn, Three y lezer en esta carpeta. Los archivos incluyen un salto de línea final adicional respecto a la fuente descargada.

`manifest.json` fija los SHA-256 de los archivos distribuidos. `node pruebas/editor-lenguajes.cjs` comprueba integridad, versiones y contrato D1/D2. Para actualizar, obtener los archivos desde los tags indicados, conservar las licencias, revisar cambios y actualizar explícitamente los hashes. Las URL de esta documentación son procedencia; la aplicación no las consulta.

lezer se publica como módulos ESM. El guion genera un único script clásico que define `LezerPython.parser`: el adaptador Python del editor lo usa para el árbol, y en E5 el traductor usará ese mismo árbol. Regenerarlo con el mismo `package-lock.json` da un archivo idéntico, byte a byte. Ni el juego ni las pruebas necesitan npm.
