# Espina de intérprete · fase 5, paso 1

Prototipos sin pantalla; no se importan desde el juego ni forman parte de `npm test`.
Usan el Worker completo de `cargar()` y las entradas públicas de los paquetes.
No instalan dependencias, no escriben referencias y no requieren red.

```sh
export CBL_QUICKJS=/ruta/externa/quickjs-dl/node_modules
node herramientas/espina-interprete/comparar.mjs
node herramientas/espina-interprete/diagnosticos.mjs
node herramientas/espina-interprete/carga.mjs
node herramientas/espina-interprete/tamano.mjs
```

`CBL_QUICKJS` señala la carpeta con `quickjs-emscripten-core` 0.32.0 y
`@jitl/quickjs-wasmfile-release-sync`. Sin ella, Q se omite con aviso; VM y P siguen.
No se copia QuickJS al repositorio. Cada guion escribe su JSON en
[`docs/qa/interprete-2026-11-17/`](../../docs/qa/interprete-2026-11-17/README.md).
Ejecutar la carga sola, sin otras suites: mide 18 procesos independientes con GC,
50/200/500 unidades, 100 cesiones tras 20 de calentamiento, paso virtual de 50 ms.
La duración virtual de un encargo sintético es tres pasos, no una medida del juego.

`jugar({ crearPrograma })` conserva VM como valor por defecto. Los adaptadores
Q y P implementan `postMessage`, `entregar`, `terminate` y `medir`.
Q cuenta visitas al interrupt handler (20); P cuenta nodos ESTree (600 000).
El presupuesto se renueva por tarea entregada, e incluye sus trabajos pendientes;
los timers son tareas separadas. No representa un límite de tiempo ni de memoria.
Los contadores y medidas se leen fuera de la ejecución de los programas.

P usa Acorn ya presente, un árbol compartido por fuente, cierres y valores nativos,
cola propia de promesas y generadores para `async`/`await`. `new AF` y `new Function`
compilan con Acorn. El modo `motorPropio({ depurar: true })` permite consultar
`pausas()` y ejecutar `paso()` en sentencias de funciones async del programa.
El gancho no suspende callbacks síncronos nativos (getters, `map`, Proxy).
Es un subconjunto experimental de JS, sin aislamiento de seguridad del anfitrión.
`diagnosticos.mjs` verifica cortes repetibles, clonado de datos, errores y paso a paso.

Las herramientas de esta carpeta quedan fuera del `include` actual de `tsconfig`;
no se cambia esa configuración. Comprobación sintáctica: `node --check` por archivo.
Contrato y límites de cada alternativa, cifras y recomendación: informe enlazado arriba.
