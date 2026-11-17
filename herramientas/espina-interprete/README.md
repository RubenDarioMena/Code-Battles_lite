# Espina de intérprete · fase 5, pasos 1–4a

Motores sin pantalla; no se importan desde el juego. P usa ahora `paquetes/interprete/`; su diferencial y el corpus real forman parte de `npm test`.
VM/P usan el Worker completo de `cargar()`; N usa la API nativa de producción y las entradas públicas de los paquetes.
No instalan dependencias, no escriben referencias y no requieren red.

```sh
export CBL_QUICKJS=/ruta/externa/quickjs-dl/node_modules
node herramientas/espina-interprete/comparar.mjs
node herramientas/espina-interprete/diagnosticos.mjs
node herramientas/espina-interprete/carga.mjs
node herramientas/espina-interprete/tamano.mjs
```

`CBL_QUICKJS` señala la carpeta con `quickjs-emscripten-core` 0.32.0 y
`@jitl/quickjs-wasmfile-release-sync`. Sin ella, Q se omite con aviso; VM, P y N siguen.
No se copia QuickJS al repositorio. Comparar, carga y diagnósticos escriben con prefijo `paso-4a-`, conservando pasos anteriores; tamaño conserva `paso-2-`, en
[`docs/qa/interprete-2026-11-17/`](../../docs/qa/interprete-2026-11-17/README.md).
Ejecutar la carga sola, sin otras suites: mide 18 procesos independientes sin Q, o 24 con Q con GC,
50/200/500 unidades, 100 cesiones tras 20 de calentamiento, paso virtual de 50 ms.
La duración virtual de un encargo sintético es tres pasos, no una medida del juego.

`jugar` usa el intérprete nativo por defecto; `motor: "vm"` selecciona la referencia. Los adaptadores
Q, P y N implementan `postMessage`, `entregar`, `terminate` y `medir`.
Q cuenta visitas al interrupt handler (20); P cuenta nodos ESTree y llamadas nativas (600 000).
El presupuesto se renueva por tarea entregada, e incluye sus trabajos pendientes;
los timers son tareas separadas. No representa un límite de tiempo ni de memoria.
Los contadores y medidas se leen fuera de la ejecución de los programas.

P usa Acorn ya presente, un árbol compartido por fuente, cierres y valores nativos,
cola propia de promesas y generadores para `async`/`await`. `new AF` y `new Function`
compilan con Acorn. El modo `motorPropio({ depurar: true })` permite consultar
`pausas()` y ejecutar `paso()` en sentencias de funciones async del programa.
El gancho no suspende callbacks síncronos nativos (getters, `map`, Proxy).
El [contrato del paquete](../../paquetes/interprete/README.md) documenta la semántica comprobada, las construcciones rechazadas y las fachadas congeladas de intrínsecos. No es un sandbox de seguridad.
`diagnosticos.mjs` verifica cortes repetibles, clonado de datos, errores y paso a paso.

Las herramientas de esta carpeta quedan fuera del `include` actual de `tsconfig`;
no se cambia esa configuración. Comprobación sintáctica: `node --check` por archivo.
Contrato y límites de cada alternativa, cifras y recomendación: informe enlazado arriba.

`corpus-diferencial.mjs` contrasta los 80 programas iniciales/soluciones y traducciones actuales con el Worker íntegro (tres reanudaciones sintéticas). `generacion/rapido.mjs` regenera los recorridos síncronos estáticos desde los generadores del paquete mediante offsets ESTree; no evalúa ni compila código del jugador. No hay compilación necesaria para ejecutar el paquete.

N comparte reino y foto por partida, interpreta solo al jugador y usa el presupuesto de producción (1 000 000; mínimo del corpus 44 024)
por tarea. El preludio Python es nativo. La VM serializa la misma fábrica API.
