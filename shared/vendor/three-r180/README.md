# Three.js r180 para el editor de terreno

Distribución ESM local de **Three.js 0.180.0**, obtenida del [tag oficial r180](https://github.com/mrdoob/three.js/tree/r180). No requiere npm, compilación ni CDN durante el uso. La licencia MIT original se conserva en `LICENSE`.

| Archivo local | Ruta en el tag r180 | SHA-256 |
| --- | --- | --- |
| `three.webgpu.min.js` | `build/three.webgpu.min.js` | `4164104213767dcf6933f86096a8f25d93b95723dab2cf420e2cb3209067698f` |
| `three.core.min.js` | `build/three.core.min.js` | `61ba0df005b05991361d040d8ff670e1aadfd0ce7aeebd1fdb0725957a8957de` |
| `OrbitControls.js` | `examples/jsm/controls/OrbitControls.js` | `b97879c748170baadeb3fb84cea1ffdf4674e283dc06042f34e2acb95a76042c` |

`manifest.json` contiene las URL oficiales exactas, los tamaños y los SHA-256 de cada archivo, incluida la licencia. Son copias byte a byte de `https://raw.githubusercontent.com/mrdoob/three.js/r180/…`, sin transformación.

`three.webgpu.min.js` importa y reexporta únicamente `./three.core.min.js`; el core no tiene imports. `OrbitControls.js` importa `three`, que el documento del editor resuelve hacia `three.webgpu.min.js` con su import map. Importar OrbitControls por su ruta local no requiere instalar ni resolver `three/addons/`: esa ruta solo aparece en su ejemplo de documentación.

`WebGPURenderer` se inicializa de forma asíncrona y utiliza su respaldo WebGL 2 cuando WebGPU no está disponible. El editor puede solicitar `forceWebGL: true` para comprobar ese respaldo. La disponibilidad real depende del navegador, el dispositivo y el contexto seguro (HTTPS o localhost).

Estos módulos no reemplazan el `THREE` global r128 del juego ni su GLTFLoader. Las dos versiones se mantienen separadas por documento; se comparten datos de terreno, sin trasladar objetos o materiales entre instancias.

Para actualizar, cambiar todos los archivos de esta carpeta juntos desde otro tag explícito, conservar la licencia, revisar imports y API, y recalcular los hashes. El manifiesto original de `shared/vendor/manifest.json` no cubre esta carpeta.
