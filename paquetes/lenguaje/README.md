# lenguaje

Fase 2, paso 9: léxico JavaScript, estructura tolerante, traducción Python ↔ JS,
instrumentación por línea, vocabulario por serie y formato de valores de la API.
Se ejecuta en Node, sin DOM, estado del juego ni dependencias globales.
Solo importa módulos internos del propio paquete. Contrato: [index.d.ts](index.d.ts).

## Entrada pública

- `CMGEditorJS`: `lexico`, `NOMBRES_HUECO`, `HUECO`, `RE_HUECO`, `crearEdicion`.
  La edición conserva su puerto de texto e inserción inyectado; no busca elementos.
- `ESTRUCTURA`: `analizar`, `consultas` y las mismas consultas/operaciones del editor.
  El análisis y las consultas se separan en `estructura-analisis.js` y `estructura.js`.
- `crearPython({ lezer, hueco })`: devuelve `traducir`, `traducirCache`, `preludio`.
  Recibe el objeto Lezer (`{ parser }`) y, opcionalmente, `CMGEditorPython.nombreDe`.
  `opciones.hueco` tiene prioridad; sin ambos se conserva el reconocedor de huecos
  anterior (incluida la excepción de nombres dunder). Cada instancia tiene su cache,
  por texto e identidad de opciones. No se modifica la semántica ni las líneas.
- `CMGPythonJS`: instancia sin Lezer, útil también para obtener `preludio`.
  Traducir sin analizador devuelve el diagnóstico habitual, sin buscar globales.
- `crearJSaPython({ acorn })` y `CMGJSaPython`: conservan `convertir(texto, opciones)`;
  `opciones.acorn` prevalece sobre el analizador de la instancia.
- `vocabulario(serie)`: conjuntos `KW`, `FN_PROPIAS`, `FN_MIEMBRO`, `PROPS`.
- `instrumentar(texto, { serie, objetos, acorn })`, `vecino(fichas, i, direccion)` y
  `revisar(texto, acorn)`: misma instrumentación y diagnósticos, sin capturar el mundo.
- `opcionesPython(objetos, aliasProveedor, propiedades)` construye las opciones;
  el consumidor conserva la identidad mientras no cambien los nombres de objetos.
- `mensajePython(mensaje, nombresJSaPython)`, `fmtLugar`, `fmtValor` son funciones puras.
  `anfitrion` y el juego comparten esta única copia del formato.

El traductor se divide en `python-base.js` (tablas y ámbitos), `python.js`
(sentencias y cache), `python-expresiones.js` (expresiones, con contexto explícito)
y `python-preludio.js` (función autónoma serializada con `toString()` por anfitrion).
La conversión inversa vive en `desde-js.js`. Cada archivo queda por debajo de 500 líneas.
No cambia el texto del Worker, la API del jugador ni los formatos guardados.

## Puentes temporales

El juego importa el paquete en `paquetes/app/juego/estado.js`, recibe Acorn y
Lezer clásicos e inyecta el reconocedor Python del adaptador de `editor`.
`cmg.estructura` es el gancho de QA; no hay globales separados de lenguaje.
La demo usa su propio `paquetes/editor/demo/compat-paquetes.js`, sin importar el juego.
Ambos HTML cargan los proveedores antes de la entrada ES; la demo conserva
sus consumidores clásicos con `defer` después de su puente. Los cuatro archivos antiguos se retiran, sin copias.

La interfaz de seudocódigo (`paquetes/editor/seudo.js`) pertenece al paquete editor:
su modelo y su DOM están repartidos en módulos de ese paquete; no se importa aquí.

## Pruebas

`node paquetes/lenguaje/pruebas/lenguaje.mjs` comprueba inyección, aislamiento de
cache, preludio autónomo, conversión, instrumentación por serie y diagnósticos.
`node paquetes/lenguaje/pruebas/carga.mjs` comprueba rutas, orden de los puentes y
la retirada de los scripts antiguos sin abrir un navegador. Ambas están en `npm test`,
junto con las suites originales de editor/Python y las 41 referencias de partidas.
La demo montada sola y el arranque real siguen requiriendo las suites de navegador.
