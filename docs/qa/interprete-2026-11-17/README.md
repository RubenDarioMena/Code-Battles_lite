# Intérpretes: prueba corta · 17 de noviembre de 2026

Fase 5, paso 1: prototipos medidos, sin integrar ningún motor en el juego. Recomiendo
**QuickJS como base para el siguiente experimento**, condicionado a resolver cesión y
paso a paso, y reducir el coste de ejecutar/transportar el Worker completo. **Ninguna
opción está lista para sustituir los Workers**: ambas exceden el presupuesto de un
fotograma con 500 unidades; Q tampoco permite suspender y reanudar desde su interrupt.
P tiene mejor coste en esta prueba y permite inspeccionar la ejecución, pero completar
JavaScript real, aislamiento y coste de operaciones nativas exige mucho más mantenimiento.

## Decisión registrada

El plan ([PLAN-ARQUITECTURA](../../PLAN-ARQUITECTURA.md), fase 5) adopta **el intérprete propio (P)**, no la recomendación de este informe. Razones: el paso a paso es un objetivo de la fase y Q publicado no puede suspender; P cuesta menos por turno y por unidad, conserva los mensajes de V8 y no añade WASM. Los límites de P demostrados aquí (semántica parcial, sin aislamiento, nativos sin presupuesto) son el trabajo del paso 2, comprobado contra V8. El coste a 500 unidades se ataca en el paso 4 (API de confianza fuera del código presupuestado e instantánea compartida), porque la VM nativa tampoco cabe hoy en 16 ms.

## Alcance y método

- Apple M1, arm64, macOS, Node v22.19.0, 16 GiB. Solo ejecución Node real;
  no son medidas de Electron, Android WebView, navegador ni emulación de esas plataformas.
- Sin red, descargas, dependencias nuevas, commits o publicación. QuickJS 0.32.0/MIT
  se importa de la instalación externa por CBL_QUICKJS. El juego publicado añade **0 B**:
  la lista de distribución de scripts/archivos-publicables.mjs no incluye estos prototipos.
- El único cambio de ejecución preexistente es la inyección opcional crearPrograma en
  herramientas/partida/jugar.mjs, con VM por defecto. El adaptador Campaign la propaga a
  sus tramos. No se modifican paquetes, reglas, API, guardado, catálogos, PROGRESO ni referencias.
- Ambos prototipos ejecutan el texto íntegro del Worker obtenido por cargar(), incluido
  el preludio Python, Proxy, getters, AF, promesas y timers. Cada unidad tiene globales y
  cola propia. Q tiene **un runtime y un contexto por unidad**, y un módulo WASM compartido.
  P comparte árboles inmutables por fuente; los estados y las promesas son por unidad.
- Cada entrega procesa una entrada o timer y drena sus trabajos pendientes. Los timers
  son FIFO por tiempo virtual local y secuencia; no avanzan el mundo. No hay Date,
  Math.random utilizable ni reloj real en Q/P; performance solo mide desde los guiones.
- El canal clona al enviar. El puente Q usa un grafo serializado para conservar undefined,
  huecos, referencias/ciclos, NaN, Infinity, -0, BigInt, Map y Set. No basta ctx.dump para
  objetos: este perdía undefined y convertía NaN a null. Se verifica el transporte de
  datos del protocolo; no se implementa toda la clonación de objetos DOM/typed arrays.

## Compatibilidad

| Motor | Hash + pasos + resultado completo | Factory | Campaign JS/Python | Tramos completos |
| --- | ---: | ---: | ---: | ---: |
| VM de referencia | 41/41 | 28/28 | 2/2 | 12/12 |
| Q, 20 visitas al interrupt | 41/41 | 28/28 | 2/2 | 12/12 |
| P, 600 000 nodos | 41/41 | 28/28 | 2/2 | 12/12 |

Ninguna diferencia con partidas.json en estos perfiles. Factory 28 y Campaign 2 son
subconjuntos de las 41 referencias, no otras 30 partidas independientes. Campaign
compara además todos los campos de cada tramo H0–H5, incluidos tiempo y eventos.
No se regraba ninguna referencia. Las diferencias fuera del corpus figuran abajo.

## Carga del Worker completo

Instantáneas **fijas** de escenarios reales y respuestas sintéticas: no se mide la
simulación ni el dibujo. Cada celda se ejecuta en un proceso Node separado con GC antes
y después, 120 turnos de 50 ms virtuales; se descartan 20 y se conservan 100 muestras.
La pasada tabulada se repitió sin otras suites ni comparadores ejecutándose en paralelo.

War usa autoTarget(crawler, visual), regularShoot y await esperar de 0,1 a 0,5 s,
repartidos por cohortes; se fija un objetivo para ejercitar órdenes completas.
Campaign repite Promise.all([pickUp(BAY_1), wait(0.2)]) y deliver(SUP_1): cada encargo
recibe resultado ok a los tres pasos; la foto se mantiene fija. Todas las unidades
se sincronizan al arrancar, exponiendo picos. El coste incluye clones, mensajes, drenaje
de trabajos, timers y recorrido de unidades inactivas. Los 18 casos terminan sin errores.
Arranque incluye crear contexto, cargar Worker, instrumentar programa y llegar al primer await;
excluye cargar el módulo WASM y preparar el escenario. No es un percentil de arranque frío por unidad.

| Motor/serie | Unidades | Media ms/ceder | p95 | Máx. | RSS total MiB | Arranque ms/unidad |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| vm/war | 50 | 0.94 | 3.10 | 4.76 | 83.25 | 0.73 |
| vm/war | 200 | 3.71 | 12.51 | 15.32 | 133.17 | 0.67 |
| vm/war | 500 | 9.12 | 30.53 | 39.66 | 204.16 | 0.69 |
| vm/campaign | 50 | 3.11 | 9.04 | 10.57 | 112.13 | 1.02 |
| vm/campaign | 200 | 12.74 | 34.74 | 37.07 | 186.53 | 1.04 |
| vm/campaign | 500 | 35.19 | 95.60 | 171.04 | 297.92 | 0.98 |
| Q/war | 50 | 3.14 | 10.32 | 13.33 | 122.06 | 6.19 |
| Q/war | 200 | 11.88 | 40.99 | 50.77 | 219.13 | 5.66 |
| Q/war | 500 | 29.41 | 102.36 | 131.34 | 379.58 | 5.52 |
| Q/campaign | 50 | 16.55 | 43.21 | 44.96 | 121.84 | 7.85 |
| Q/campaign | 200 | 64.70 | 169.97 | 178.88 | 224.17 | 7.23 |
| Q/campaign | 500 | 164.63 | 428.66 | 526.54 | 384.66 | 7.13 |
| P/war | 50 | 1.99 | 6.82 | 11.03 | 131.67 | 1.77 |
| P/war | 200 | 8.17 | 27.94 | 33.90 | 210.58 | 0.78 |
| P/war | 500 | 20.97 | 68.25 | 112.10 | 289.70 | 0.64 |
| P/campaign | 50 | 6.50 | 24.85 | 25.47 | 185.42 | 7.02 |
| P/campaign | 200 | 27.33 | 106.60 | 146.18 | 245.16 | 6.09 |
| P/campaign | 500 | 70.82 | 283.27 | 307.60 | 367.95 | 5.90 |

A 500 unidades, ninguna opción deja margen de 16 ms; Q/Campaign y P/Campaign superan
incluso 50 ms en promedio. War queda bajo 50 ms de media, pero Q y P lo superan en p95.
Tampoco VM garantiza 16 ms: es una referencia de compatibilidad, no el reemplazo propuesto.
Los turnos vacíos reducen la media; para decidir capacidad hay que mirar también p95/máximo.
No se ha optimizado el puente ni se ha eliminado el preludio innecesario por unidad.

### Memoria

RSS incluye proceso, código, JIT, arenas y WASM; no se debe sumar a heap/WASM.
La memoria se toma tras la carga y las 120 cesiones, con los contextos vivos y GC;
no es el máximo RSS del proceso. La disponibilidad de GC no impone un límite a las asignaciones.

| Motor/serie, 500 unidades | RSS MiB | Incremento RSS MiB | Heap V8 retenido MiB | Incremento heap MiB |
| --- | ---: | ---: | ---: | ---: |
| vm/war | 204.16 | 145.44 | 99.18 | 90.77 |
| vm/campaign | 297.92 | 239.67 | 111.18 | 102.70 |
| Q/war | 379.58 | 313.25 | 11.80 | 2.66 |
| Q/campaign | 384.66 | 318.33 | 12.47 | 3.26 |
| P/war | 289.70 | 231.31 | 42.91 | 34.50 |
| P/campaign | 367.95 | 309.44 | 59.79 | 51.32 |

Q computeMemoryUsage mide memoria **por runtime/contexto**, no por división de RSS:
War 431.2 KiB/contexto de media
(rango 351.1–600.9);
Campaign 411.2 KiB/contexto.
Totales internos 210.6/200.8 MiB;
el heap WASM reservado alcanza 297.9 MiB en ambos procesos.
En P no hay contador de memoria por contexto: las diferencias de heap son agregadas,
con árbol compartido, y **no** una medida de aislamiento. La caché de árboles no tiene
política de expulsión en este prototipo; crece con fuentes distintas.

## Presupuesto e interrupción determinista

El presupuesto se renueva por tarea entregada e incluye su drenaje de trabajos;
un timer es otra tarea. Q cuenta visitas del interrupt de esta compilación, **no opcodes**;
P cuenta entradas a evaluar nodos ESTree, incluidas las funciones de API interpretadas.
El reloj solo mide desde fuera: nunca decide el corte. PresupuestoAgotado es propio;
no se usa el vigía, ni el timeout de VM, ni se cambia la simulación para estos casos.

| Perfil | Caso | Cortes, dos ejecuciones (ms) | Punto comprobado |
| --- | --- | ---: | --- |
| Q | war/vacío | 1.49 / 1.44 | 21 visitas |
| Q | factory/vacío | 1.62 / 1.52 | 21 visitas |
| Q | war/sensor | 68.82 / 67.31 | 21 visitas |
| Q | war/contador | 6.60 / 6.51 | 21 visitas; contador 209305 |
| P | war/vacío | 113.95 / 89.87 | 600001 nodos; línea 1 |
| P | factory/vacío | 95.49 / 82.11 | 600001 nodos; línea 1 |
| P | war/sensor | 181.79 / 189.92 | 600001 nodos; línea 1 |
| P | war/contador | 113.28 / 103.22 | 600001 nodos; línea 2; contador 119921 |
| Q5 | war/vacío | 0.92 / 0.86 | 6 visitas |
| Q5 | factory/vacío | 0.93 / 0.95 | 6 visitas |
| Q5 | war/sensor | 19.51 / 19.35 | 6 visitas |
| Q5 | war/contador | 2.26 / 2.24 | 6 visitas; contador 59305 |
| P50000 | war/vacío | 8.98 / 8.35 | 50001 nodos; línea 1 |
| P50000 | factory/vacío | 8.38 / 8.65 | 50001 nodos; línea 1 |
| P50000 | war/sensor | 16.08 / 15.57 | 50001 nodos; línea 1 |
| P50000 | war/contador | 9.58 / 9.48 | 50001 nodos; línea 2; contador 9921 |

Los casos vacío son literalmente while (true) {} en War y Factory. El sensor es
while (true) { const lectura = yo.missiles; }: lee el getter sin emitir órdenes,
por lo que no lo corta el límite preexistente de mensajes. El caso contador añade
un contador de iteraciones observable. Se comprueba igualdad exacta de cuenta, línea
(en P) y contador entre dos contextos nuevos, no solo el texto del error.
Q no expone PC ni línea al interrumpir: se prueba prefijo de ejecución repetido,
no identidad de un opcode accesible. Cambiar compilación obliga a recalibrar sus visitas.

**Propuesta de guardia inicial para el siguiente experimento:** 5 visitas en Q o
50 000 nodos en P, con corte medido de sensor de unos 20/16 ms en este M1.
No es un límite garantizado de reloj: el coste depende de la operación y la máquina.
**No se puede activar ese perfil conservando toda la compatibilidad actual**:
ambos cambian el resultado de factory-limite-sensores a Presupuesto agotado antes
del diagnóstico de 501 lecturas. P necesita más de 566 000 nodos para llegar a él;
600 000 permite la paridad, pero tarda hasta unos 190 ms en el sensor.
Q usa 20 visitas para la comparación completa y tarda unos 69 ms en el sensor.
Hace falta abaratar o separar la API de confianza del código presupuestado antes
de fijar un límite de producción. Las operaciones nativas de P (regex, arrays,
strings, JSON) tampoco se acotan contando nodos: una llamada puede ser costosa.

## Paso a paso y errores

P suspende el generador antes de cada sentencia de funciones async del programa:
se verifican las líneas 1→2→3→4, espera virtual y reanudación en 5, salidas 3 y 4,
y done. Conserva cierres y pila de generadores. No usa eval ni Function del anfitrión
para compilar al jugador; AF y Function pasan por Acorn. También se prueba new Function.
Limitación: los getters, Proxy y callbacks síncronos llamados por funciones nativas
se ejecutan hasta volver; no se puede suspender una pila nativa de V8 desde el generador.
Los controles de depuración solo se activan en AF con parámetro __L y sus funciones async.

Q release-sync permite evaluar código y drenar trabajos, pero el interrupt **aborta**;
retornar false continúa sin devolver control para inspección. No expone un gancho por
línea ni una continuación de la pila abortada. Asyncify suspendería llamadas puente,
no proporciona por sí solo un depurador por línea; esa variante no está instalada ni
se ha probado. Alternativas a investigar: compilación con depurador o transformación
del fuente con puntos de suspensión, verificando funciones síncronas y orden de promesas.

| Error de muestra | V8 / P | QuickJS | Línea |
| --- | --- | --- | ---: |
| noExiste() | noExiste is not defined | 'noExiste' is not defined | 1 |
| null.foo | Cannot read properties of null (reading 'foo') | cannot read property 'foo' of null | 2 |
| esperar(0) | Mismo mensaje propio del juego | Mismo mensaje propio del juego | 1 |
| throw new Error(...) | Mismo texto deliberado | Mismo texto deliberado | 1 |

Los errores propios del juego se mantienen en las 41 referencias; **los mensajes
nativos de Q sí cambiarían textos visibles** si se integrara directamente. No se han
normalizado ni cambiado catálogos. P conserva loc y adjunta __linea a errores del usuario;
los errores sintácticos del compilador dinámico pasan por el catch existente del Worker.
No se promete paridad de todos los textos nativos, versiones de V8 ni errores Python.

P es deliberadamente parcial fuera del corpus: const x=1; x=2 devuelve 2,
la zona temporal sin inicializar no tiene su semántica correcta y var dentro de un
bloque no sale al ámbito de función. Estos tres límites se ejecutan y guardan en JSON.
Tampoco implementa JS completo (módulos, campos privados, todas las formas de super,
etiquetas, async generators, etc.). Pasar 41/41 no equivale a soportar JavaScript real.
El acceso a valores nativos no es un sandbox: no se debe usar P con código no confiable.

## Tamaño y decisión

| Opción | Tamaño prospectivo, sin minificar | gzip por archivos | Añadido al juego ahora |
| --- | ---: | ---: | ---: |
| P + canal, Acorn existente reutilizado | 24.4 KiB | 8.3 KiB | 0 B |
| QuickJS distribución ES/browser + WASM | 563.2 KiB | 248.4 KiB | 0 B |
| Puente Q de prototipo, adicional | 8.2 KiB | 3.5 KiB | 0 B |

El WASM solo ocupa 503 134 B; el inventario completo está en tamano.json. Son archivos
reales leídos, no una estimación de un bundle optimizado: no incluyen maps, tipos,
licencias ni una adaptación browser del cargador Node. No se copian al repositorio.
El pequeño tamaño de P no incluye el trabajo de completar la semántica ni endurecerlo.

- **Electron:** Q conserva JS en un motor independiente de V8 y permite aislamiento
  por runtime; necesita controlar memoria y el ciclo de vida. Esta prueba libera todos
  los handles/contextos al terminar. Cargar WASM local debe validarse con cbl:// y CSP.
- **Android WebView:** soporte/carga de WASM, arranque, memoria y CPU quedan sin medir
  en dispositivo. Ni los 300 MiB reservados de WASM ni la latencia M1 se extrapolan al teléfono.
- **Determinismo:** colas y temporizadores son propios; Date y random se deshabilitan.
  P aún hereda operaciones nativas de V8; Q debe fijar versión/binario y protocolo.
  El presupuesto de callbacks no es estable entre builds. No se mide determinismo entre SO.
- **Mantenimiento:** Q ofrece semántica JS real y evita mantener un lenguaje nuevo;
  el puente, la depuración y el rendimiento siguen pendientes. P facilita detener el árbol,
  pero sus diferencias demostradas contradicen la promesa de JavaScript real del proyecto.

Recomiendo invertir el siguiente paso en **Q con una API de confianza más ligera y una
prueba de suspensión por línea**, antes de integrar nada. Si no resuelve paso a paso y
p95 con muchas unidades, hay que reconsiderar la decisión, no aceptar silenciosamente
un subconjunto de JS. P queda como comparación de coste y experimento de depuración.
La fase 5 completa sigue pendiente; este paso solo aporta evidencia para decidir.

## Reproducir y verificación

Ver comandos y CBL_QUICKJS en [herramientas/espina-interprete/README.md](../../../herramientas/espina-interprete/README.md).
Medidas: [compatibilidad.json](compatibilidad.json), [carga.json](carga.json),
[diagnosticos.json](diagnosticos.json) y [tamano.json](tamano.json).
Salidas de los guiones y las suites: [salida.txt](salida.txt).
Conservar los JSON al comparar máquinas: las muestras completas permiten recalcular percentiles.

Ejecutado: npm test **60/60**, npm run tipos limpio, node pruebas/fronteras.mjs
**152 archivos / 13 paquetes sin infracciones**, node --check de cada módulo nuevo y
de los dos adaptadores modificados; comparar.mjs con Q/P/VM, carga.mjs y diagnosticos.mjs
con Q disponible. Sin navegador: no cambia interacción, dibujo ni arranque del juego;
la integración con WebView/Electron no pertenece a esta prueba sin pantalla.

## Paso 2 · paquete `interprete` (17 de noviembre de 2026)

Esta sección es la verificación actual del paquete. Las cifras, límites y recomendaciones
anteriores se conservan como evidencia histórica del paso 1; P ya no usa `propio/`.
No hay integración en el juego/anfitrión, dependencias nuevas, red, commits ni publicación.
No se modificaron PROGRESO.md, las referencias, las reglas, la API, el guardado ni los textos.

- Paquete `@cbl/interprete`, [contrato](../../../paquetes/interprete/README.md), entrada ES y `.d.ts`;
  Acorn inyectado, sin imports externos ni dependencias entre paquetes. El anfitrión tiene
  permiso de frontera para importarlo en el paso 3, pero todavía no lo importa.
- **140 fragmentos diferenciales** contra V8: valor, traza y tipo/mensaje de excepción.
  Ámbitos/TDZ/const/elevación, cierres por iteración, etiquetas/switch/finally, objetos,
  clases/super/campos privados, generadores y cierre, async flecha, opcionales/this,
  plantillas, operadores, arguments, parámetros, desestructuración e iteradores.
  Las trazas de promesas contrastan await, thenables, cadenas intercaladas, los seis
  combinadores/métodos estáticos y queueMicrotask. La cola es propia, sin microtareas de V8.
- **80 programas reales**, **17 traducidos de Python** con el traductor actual: iniciales
  de las tres series, casos del oráculo y soluciones existentes. Ejecutan el Worker íntegro
  y hasta tres reanudaciones sintéticas; comparan mensajes y errores. Además, `comparar.mjs`
  conserva **41/41**, **Factory 28/28**, **Campaign 2/2 y 12/12 tramos** completos.
- **339 comprobaciones de aislamiento**: constructores/prototipos, reflexión, descriptores,
  getters, métodos heredados y proxies. Mutaciones comparadas con V8 estricto sobre
  intrínsecos congelados; se verifica que los intrínsecos del proceso siguen intactos.
  Las fachadas locales materializan propiedades al usarlas, sin congelar originales.
  Function/AsyncFunction/GeneratorFunction compilan con Acorn y un global local.
- Presupuesto: nodos y llamadas nativas, corte terminal repetible, incluido getter sin
  órdenes y cola infinita. Pausas por sentencia async, reanudación con cierres, `loc`,
  caché LRU acotada, compilación dinámica y liberación ejecutadas en las pruebas.
  Los errores normales usan `linea` y pila sintética; **no** se les añade `__linea`,
  porque `__py.mensaje` la reserva a errores de API. Esto mantiene mensajes Python.
- Se rechazan módulos/import(), with, async generators y for await. Date/eval no están
  disponibles y Math.random no es utilizable. Acorn conserva sus diagnósticos sintácticos;
  no se promete igualdad de mensajes de sintaxis con V8 ni certificación Test262.

### Carga P, antes y después

Mismo Apple M1/Node y protocolo del paso 1: Worker completo, 120 cesiones virtuales,
100 muestras tras descartar 20, GC, un proceso por celda, sin otras suites en paralelo.
**Node real**, sin emulación ni pruebas de Electron/WebView/Android. Los valores «antes»
son los del paso 1 publicados arriba, no las pasadas de desarrollo de este paso.
Todas las celdas actuales terminaron con cero errores. VM también se volvió a medir;
las doce celdas y muestras completas están en [paso-2-carga.json](paso-2-carga.json).

| P/serie | Unidades | Media antes → ahora ms | p95 antes → ahora | Máx. ahora | RSS antes → ahora MiB | Arranque antes → ahora ms/u |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| war | 50 | 1.99 → 1.63 | 6.82 → 5.17 | 8.02 | 131.67 → 131.19 | 1.77 → 1.94 |
| war | 200 | 8.17 → 6.75 | 27.94 → 21.87 | 34.44 | 210.58 → 265.23 | 0.78 → 1.06 |
| war | 500 | 20.97 → 17.12 | 68.25 → 56.61 | 69.27 | 289.70 → 539.94 | 0.64 → 0.81 |
| campaign | 50 | 6.50 → 5.88 | 24.85 → 23.29 | 36.84 | 185.42 → 222.08 | 7.02 → 4.59 |
| campaign | 200 | 27.33 → 23.14 | 106.60 → 85.97 | 120.23 | 245.16 → 402.39 | 6.09 → 3.20 |
| campaign | 500 | 70.82 → 60.14 | 283.27 → 220.52 | 319.32 | 367.95 → 710.14 | 5.90 → 3.06 |

El recorrido recursivo evita generadores en código sin suspensiones y los índices de
ámbitos se calculan una sola vez por árbol. Con 500 unidades, la media mejora ~18 %
en War y ~15 % en Campaign; el p95 también mejora. El arranque de War sube ligeramente;
las cifras de 50 unidades incluyen más calentamiento y no son latencia fría garantizada.
La memoria empeora: las fachadas y ámbitos locales elevan el heap retenido a **112/145 MiB**
y el RSS a **540/710 MiB**, frente a 43/60 de heap y 290/368 de RSS en el paso 1.
RSS incluye arenas de V8 y no se debe sumar al heap ni interpretar como coste exacto por unidad.

**Riesgos para el paso 3:** aún no cabe en 16 ms con 500 unidades; Campaign tampoco en
50 ms de media. Las fachadas por motor requieren reducir memoria antes de fijar capacidad.
El presupuesto de 600 000 incluye el Worker entero y sigue siendo alto para una guardia
interactiva: separar la API de confianza e instantáneas compartidas sigue siendo el paso 4.
Una llamada nativa (regex/JSON/array) puede consumir mucha CPU/memoria sin ceder; esto no es
un sandbox para código hostil. Getters, traps y callbacks síncronos no se suspenden dentro
de una pila nativa. El corpus es evidencia de los casos enumerados, no de todo ECMAScript.

Verificación actual: **npm test 64/64**, `npm run tipos`, fronteras **169 archivos / 14
paquetes**, autoprueba **80 infracciones esperadas**, `node --check` de fuentes nuevas y
modificadas, comparar, diagnosticos, carga y tamano. Sin navegador: no cambia arranque,
interacción ni dibujo del juego. No se ejecutaron pruebas de Godot.
Resultados: [paso-2-compatibilidad.json](paso-2-compatibilidad.json),
[paso-2-diagnosticos.json](paso-2-diagnosticos.json), [paso-2-tamano.json](paso-2-tamano.json)
y [paso-2-salida.txt](paso-2-salida.txt).


## Paso 4a

Verificación actual del 17 de noviembre de 2026, sobre `60e6f6240d9a0ed28c560adbd532fa70d5f0d7ff`
(paso 3, HEAD separado en este directorio; mismo commit de `arquitectura/fase-5`).
Sin commits, publicación, dependencias nuevas, Chromium ni Electron. No se cambian
PROGRESO.md, referencias, reglamentos, simulación, guardado, catálogos ni traductor.

### Fuente única, reino e instantánea

- `paquetes/anfitrion/api.js` contiene la fábrica autocontenida `crearAPI` (278 líneas).
  Incluye la API War/Factory/Campaign, consola, formato/copia, globales, errores,
  calibración de líneas y entrega run/despierta. `trabajador.js` serializa esa misma
  fábrica con `toString()` y las piezas para la VM. La VM sigue compilando/ejecutando
  todo dentro de un contexto V8 independiente; N recibe los objetos como valores
  nativos e interpreta únicamente al jugador instrumentado/traducido.
- Juego y herramienta inyectan piezas **como funciones** al creador; no se evalúa
  texto en el anfitrión. Para la firma histórica por fuente existe un registro de
  compatibilidad acotado a 32 fuentes. El arnés genérico de las pruebas del canal
  conserva su camino interpretado; no se usa en producción para la API.
- Un motor por creador/partida; fachadas y Promise congeladas compartidas, una cola
  determinista y caché LRU de árboles por analizador (acotada, sin retener motores).
  `crearAmbito` separa bindings, global/self/globalThis y compilación dinámica por unidad.
  Cada entrega activa su ámbito, renueva presupuesto y drena trabajos; los timers
  siguen siendo FIFO virtual local. API y continuaciones usan Promise del motor,
  incluido el orden de `cederLuego(0)`. No hay microtareas del anfitrión en ese camino.
- Terminar una unidad cancela su canal, API y ámbito; sus funciones quedan inválidas.
  La última libera el reino. El creador puede iniciar otra partida. Las medidas
  guardan los contadores propios de cada entrega, incluso después del cierre.
- `canal.js` comparte **la misma referencia** de snap en run/despierta y copia el resto
  del mensaje. El programa solo recibe copias de las lecturas. La única escritura
  encontrada en SNAP era `orden` de War: ahora modifica una fila propia creada al
  primer uso, descartada con cada nueva foto. Otra unidad ve la foto común; la propia
  ve sus cambios de mode/target/fireRate/failureRate. Se mantienen los clones de salida
  para que ni argumentos del jugador ni esa fila puedan cambiar mensajes ya encolados.
- Los errores nativos normales reciben la pila sintética del intérprete; `fallo`
  conserva `__linea` y una pila sintética cuando la línea está instrumentada. Se corrigió
  la anotación de errores con `__linea: null`: conserva el mensaje Python y permite
  resolver la línea del llamante sin filtrar marcos del anfitrión.

### Python y presupuesto

Se elige **preludio Python nativo**. `preludio.mjs` aísla la medida con la fábrica
real, un reino ya creado, AST caliente y cinco muestras después de calentar:
500 inicializaciones pasan de **73.36 a 1.94 ms** (0.147 → 0.0039 ms/unidad);
10 000 operaciones `__py.bin` llamadas desde código interpretado pasan de
**116.93 a 8.59 ms** de media. No cambia `__py.mensaje`; la paridad incluye
los 17 programas Python reales y errores Python/API. Son micropruebas Node,
no una estimación de todo programa Python. Datos: [preludio](paso-4a-preludio.json).

Presupuesto de producción: **44 024**, por entrega y su drenaje. Se cuentan nodos
más llamadas nativas explícitas (una unidad adicional por llamada); el cuerpo de
la API y del preludio queda fuera. **7 024** es el mínimo para la traza completa
del sensor 501; **44 024** es el mínimo para conservar también la traza completa
de las 4001 consolas exigidas por `partida-war`. Las pruebas verifican que restar
uno cambia el mensaje final, aunque el anfitrión pueda haber decidido ya su error.
No se reduce el umbral a costa de quitar MAX_ORDENES ni la lectura 501.

**Revisión:** el valor por defecto de producción queda en **1 000 000**, no en el mínimo. El mínimo solo garantiza el corpus; un programa guardado con más cálculo legítimo por turno (el vigía de Workers le dejaba 2,5 s) se cortaría con un error falso. Un presupuesto mayor no cambia ningún resultado del corpus. Corte medido con `corte.mjs` (War reto 1, tres ejecuciones, M1, incluye preparar la partida): bucle vacío 57 ms, cálculo 87 ms, getter que copia 297 ms; con 44 024, 4–17, 6–15 y 18–29 ms. Las pruebas siguen comprobando el mínimo exacto con el valor explícito.

Dos ejecuciones aisladas del perfil N: while vacío War **7.33/5.32 ms**, Factory
**3.26/3.05 ms**; bucle de getter sin mensajes **15.78/15.02 ms**; contador
**10.76/10.73 ms**. Todos cortan en **44 025**, misma línea y contador repetido
(8802 en el caso contador). Frente al perfil P actual de 600 000, el getter pasa
de 190.03/188.89 ms a ~15 ms. No es una garantía de reloj: el getter sigue siendo
el caso más lento y una operación nativa masiva (JSON, regex, array) puede superar
el tiempo de un paso sin que el contador limite su cuerpo. Datos: [diagnósticos](paso-4a-diagnosticos.json).

### Paridad registrada

`npm test` registra `pruebas/api-nativa.mjs`; `partida-interprete.mjs` captura
cada mensaje completo **antes** del filtrado del anfitrión y compara unidad,
orden y todos los campos (tipo/línea/texto/valor/errores/IDs), además de huella,
pasos, resultado y tramos. Resultado **41/41**, Factory **28/28**, Campaign
**2/2 y 12/12 tramos**. El corpus real compara ahora también N con VM:
**80 programas, 17 de Python**, con tres reanudaciones sintéticas. Se conservan
los contrastes anteriores P/VM. Hay pruebas de ámbitos con nombres iguales,
intrínsecos compartidos intactos, compilación dinámica, liberar una unidad y seguir
con otra, reinicio de partida y dos lanzadores que leen el mode ajeno en el mismo
turno. La prueba del canal comprueba identidad de snap y copia de los otros campos.
También se comparan errores nativos de API con ciclos, errores Python, esperas
inválidas, copia del objetivo y las trazas de ambos límites de mensajes.

`comparar.mjs`: VM, P y N **41/41**; QuickJS omitido porque no está instalado en
CBL_QUICKJS; no se descarga. [Comparación](paso-4a-compatibilidad.json).

### Carga antes/después

Mismo protocolo: escenarios/fotos fijos, 120 cesiones virtuales de 50 ms, descarta
20, 100 muestras, GC antes/después y proceso independiente por celda. Carga corrida
sola, después de terminar todas las suites y comparadores. Son mediciones reales
Node/Apple M1; no hay simulación ni dibujo en el coste. N incluye API nativa,
mensajes, timers, drenaje, compartir foto y recorrer unidades inactivas.

Antes = **paso 2 publicado**, conservado arriba. El paso 3 integró el mismo perfil
Worker completo/600 000 en el juego; no tenía una tabla de carga independiente.
No se presenta una reconstrucción histórica como medición nueva del paso 3.
La ejecución actual incluye además VM y P como controles (Worker completo sobre
la fábrica compartida), con sus muestras completas en [carga](paso-4a-carga.json).

| Serie | Unidades | Media antes → 4a ms | p95 antes → 4a | Máx. 4a | RSS antes → 4a MiB | Arranque antes → 4a ms/u |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| war | 50 | 1.63 → 0.28 | 5.17 → 0.96 | 1.45 | 131.19 → 78.09 | 1.94 → 0.37 |
| war | 200 | 6.75 → 0.98 | 21.87 → 3.18 | 5.67 | 265.23 → 106.67 | 1.06 → 0.19 |
| war | 500 | 17.12 → 2.41 | 56.61 → 8.00 | 11.13 | 539.94 → 125.55 | 0.81 → 0.15 |
| campaign | 50 | 5.88 → 0.59 | 23.29 → 2.77 | 3.27 | 222.08 → 103.27 | 4.59 → 0.63 |
| campaign | 200 | 23.14 → 2.12 | 85.97 → 8.70 | 9.77 | 402.39 → 126.34 | 3.20 → 0.41 |
| campaign | 500 | 60.14 → 5.39 | 220.52 → 20.35 | 24.03 | 710.14 → 233.67 | 3.06 → 0.34 |

Para contextualizar el paso 1, sus 500 unidades dieron War **20.97/68.25 ms**
(media/p95), **289.70 MiB**, arranque **0.64 ms/u**; Campaign **70.82/283.27 ms**,
**367.95 MiB**, **5.90 ms/u**. Los valores de pasos 1–2 son históricos, no otra
pasada actual. En los controles actuales de 500 unidades, P da War **17.82/57.82 ms**
y Campaign **60.01/224.90 ms**; RSS **612.3/832.6 MiB**. VM/War tuvo un máximo
atípico de **438.30 ms** que se conserva en los datos, sin descartar muestras.

Las seis celdas N terminan sin errores. Con 500 unidades, War y Campaign quedan
bajo **16 ms de media y 50 ms p95**. RSS es del proceso retenido tras GC, no coste
exacto por unidad ni máximo de memoria. No demuestra una partida real con 500
entidades distintas ni rendimiento de Steam Deck/Android. Paso 4a completado;
quedan esa validación de partida completa y el paso 5 de depuración. No se cierra
la fase 5.

Verificación: **npm test 67/67**, tipos, fronteras **174 archivos/14 paquetes**,
autoprueba **80 infracciones esperadas**, `node --check` de **20 scripts**, los
identificadores y conductor del juego, comparar, diagnósticos, preludio y carga.
Sin navegador por instrucción del encargo. [Salida completa](paso-4a-salida.txt).

## Paso 4b

Medida actual del 17 de noviembre de 2026, sobre `bc383e5f8644db5985857409fa26ccc45fc7a271`
(HEAD separado, contenido de arquitectura/fase-5), con los cambios locales de este paso.
Sin commit, publicación, dependencias nuevas, Chromium ni Electron. PROGRESO.md y
pruebas/referencias/ intactos. Reglas, simulación, contrato observable de la API, guardado, retos y catálogos intactos.
La implementación interna de API/anfitrión sí se optimiza tras perfilar.

La herramienta [medir-unidades](../../../herramientas/medir-unidades/README.md) usa
crearPartida, el conductor del juego y el intérprete real del anfitrión. War instala
500 lanzadores con IDs y casillas distintos en el mapa 32×18, evitando exclusivamente
en el banco el recorte del formulario. Disparan con autoTarget y regularShoot,
con esperas repartidas de 0,1..0,5 s. Las 12 oleadas de 40 unidades conservan las
reglas de combate; el escenario de banco permite brechas para no truncar la ventana.
Campaign añade 500 obreros en el pasillo del mapa original, 20 destinos y programas
con Promise.all(goTo, wait) de ida y vuelta; deja H0 abierto. Son encargos resueltos
por las reglas, con desplazamiento real. El motor no impone colisiones ni límite
de robots; esto no prueba 500 estaciones produciendo. Factory solo programa R1:
su máximo es **1**, multiplicarlo exigiría cambiar las reglas.

### Protocolo y criterio

Node: 1200 pasos medidos + 40 de calentamiento (62 s simulados), semilla 7,
dos procesos independientes por celda; GC antes del arranque y ninguna muestra
eliminada después. Las cifras siguientes corresponden a la **primera** repetición;
la segunda conserva sus cifras y comprueba la misma huella de todas las fotos y
todas las órdenes. Hash fuera del reloj del paso. RSS muestreado tras cada paso,
sin GC final para rebajar la memoria; no es un pico instantáneo del asignador.

Simulación = paso, incluida la copia de las respuestas Campaign. Instantánea =
las dos fotos que crea el conductor por paso. Ceder y responder incluyen sus
continuaciones. Total incluye también órdenes, sucesos y callbacks del conductor;
no incluye hash, dibujo ni el recogerRegistro posterior de app. Cada columna tiene
media, p50, p95, p99 y máximo y muestras completas en el JSON. No se suman percentiles.

El criterio propuesto por el autor se conserva: 60 s **reales** a 1×, |deriva final|≤
0,05 s, ningún fotograma recortado a 0,25 s y p95 del paso completo<16,7 ms. Se añade
como diagnóstico el tiempo que el bucle no acumula porque corren programas. La
deriva usa pasos completados y reloj real, incluido terminar el último lote. Un
caso detenido, con error o incompleto no valida el criterio. Node mide costes,
no ritmo de rAF ni dibujo: por sí solo no cierra ese criterio del plan.

### Cifras sin pantalla

Apple M1, 8 núcleos, 16 GiB, macOS arm64, Node v22.19.0. **Antes**: una
repetición completa de la fuente local original, congelada en un cargador de Node
antes de editar. **Después**: comando predeterminado exacto, sin perfilador:

```sh
node herramientas/medir-unidades.mjs
```

[Datos de ambas medidas y perfiles](paso-4b-node.json): estadísticas completas,
ambas repeticiones posteriores, memoria, actividad y huellas; cada registro ocupa
una línea para evitar miles de líneas de evidencia. La tabla usa la primera
repetición y p95 por columna en **ms**, en orden **simulación / instantánea /
ceder / responder / total**. Arranque en ms; RSS máximo muestreado en MiB.

| Serie / unidades | Antes: S / I / C / R / T | Después: S / I / C / R / T | Arranque antes → después | RSS antes → después |
| --- | --- | --- | --- | --- |
| war / 50 | 0.109 / 1.297 / 1.939 / 0.000 / 2.849 | 0.090 / 0.888 / 0.564 / 0.000 / 1.449 | 61.7 → 35.1 | 215.3 → 136.6 |
| war / 200 | 0.191 / 2.209 / 26.156 / 0.000 / 27.512 | 0.119 / 1.195 / 2.363 / 0.000 / 3.394 | 1214.3 → 104.8 | 452.4 → 308.3 |
| war / 500 | 0.337 / 4.051 / 170.316 / 0.000 / 174.530 | 0.281 / 2.753 / 6.026 / 0.000 / 9.011 | 16145.7 → 386.4 | 1023.7 → 681.0 |
| campaign / 50 | 0.091 / 0.126 / 0.029 / 0.130 / 0.361 | 0.091 / 0.126 / 0.027 / 0.081 / 0.326 | 116.2 → 49.1 | 119.7 → 107.3 |
| campaign / 200 | 0.749 / 0.389 / 0.134 / 0.800 / 2.202 | 0.700 / 0.336 / 0.079 / 0.217 / 1.325 | 1738.1 → 140.1 | 229.1 → 146.9 |
| campaign / 500 | 6.819 / 2.630 / 0.550 / 5.913 / 13.232 | 4.843 / 1.473 / 0.306 / 0.624 / 6.474 | 20130.3 → 479.1 | 473.3 → 301.0 |

Las dos repeticiones a 500 dan **9,011 / 9,129 ms** (War) y **6,474 / 6,420 ms**
(Campaign): ambas por debajo de 16,7 ms. Arranques respectivos **386 / 414 ms** y
**479 / 477 ms**, frente a 16,1 s y 20,1 s anteriores. Las seis celdas conservan
exactamente las huellas de todas las fotos y órdenes **antes y después**, y las
repeticiones posteriores son deterministas. La cifra anterior de la sesión
interrumpida (War ~185 ms, arranque ~17 s, RSS ~999 MiB; Campaign ~11,4 ms) es
histórica: la tabla contiene la nueva ejecución completa, no mezcla sus muestras.

### Perfil y arreglo de la API

Antes de editar se ejecutó:

```sh
mkdir -p tmp/perfil-unidades-antes
node --cpu-prof --cpu-prof-dir=tmp/perfil-unidades-antes herramientas/medir-unidades.mjs --caso --series war --unidades 500 --pasos 120 --calentamiento 40 > tmp/perfil-unidades-antes/war-500.json
```

El perfil de 33,9 s confirma **nombreVar 48,8 %**, **__L 26,9 %** y **GC 13,2 %**
del tiempo propio muestreado: el filtro anidado recalculaba nombres durante cada
arranque, y __L creaba todos los descriptores en cada llamada. El arranque de ese
perfil fue 16,6 s; p95 ceder 169,6 ms, total 172,1 ms. Es diagnóstico con V8
instrumentado, separado de las cifras de la tabla.

Cambios en la fuente única `paquetes/anfitrion/api.js` (también serializada a VM):

- Cuentas de nombres normalizados calculadas una vez por run: O(N), frente a
  O(N²) por programa y O(N³) al arrancar N programas. Mismos duplicados, nombres
  inválidos, reservados y conflictos con globals. Primer VIB también precalculado.
- War y Campaign resuelven nombres de __L/LCampaign por índice Map y un handler
  Proxy compartido por unidad. Cada objeto conserva su línea en WeakMap; cada
  lectura sigue creando maquina(id, linea), sin cachear lecturas ni unidades.
- La reflexión o mutación materializa las propiedades originales en el mismo
  orden, con iguales getters/flags, identidad fresca y errores. Incluye los raros
  nombres que coinciden con métodos. Los globals conservan sus getters propios,
  instalados **una vez por unidad**: queda coste O(N²) de arranque, sin repetirlo
  por llamada. Moverlos al prototipo alteraría la reflexión del programa.
- Factory conserva el camino pequeño original de getters (solo R1); evita
  añadir pasos al arnés histórico que interpreta la API entera con presupuesto.
- En `anfitrion.js`, la ordenación usa el índice fijo asignado al cargar en vez
  de indexOf por comparación. Conserva exactamente unidad/carga y llegada.

Perfiles posteriores (War y Campaign por separado):

```sh
mkdir -p tmp/perfil-unidades-despues
node --cpu-prof --cpu-prof-dir=tmp/perfil-unidades-despues herramientas/medir-unidades.mjs --caso --series war --unidades 500 --pasos 240 --calentamiento 40 > tmp/perfil-unidades-despues/war-500.json
node --cpu-prof --cpu-prof-dir=tmp/perfil-unidades-despues herramientas/medir-unidades.mjs --caso --series campaign --unidades 500 --pasos 240 --calentamiento 40 > tmp/perfil-unidades-despues/campaign-500.json
```

War: __L baja al 1,9 % y conNombres supone 2,7 % del perfil completo; dominan
structuredClone (16,4 %), GC (12,4 %) e instantáneas. Campaign: structuredClone
18,7 % y las funciones instantanea 20,7 %. Estos perfiles incluyen arranque,
huella y cierre y tienen distinta ventana; sus porcentajes localizan trabajo,
no son un contraste de latencia ni suman todos los costes nativos descendientes.

En esta carga, simulación e instantánea War crecen aproximadamente con N entre
200 y 500 (0,119→0,281 y 1,195→2,753 ms). Campaign crece peor: simulación
0,700→4,843 ms. `reglas-campaign/index.js`, terminarOrden, crea y clona **la foto
completa por encargo terminado**, dentro de paso; cada robot puede acabar en un
instante distinto del mismo paso. Revisar compartir datos inmutables conservando
esas fotos intermedias sería trabajo futuro, con pruebas de paridad. No se ha
tocado esa regla ni su copia. También quedan el registro de órdenes/sucesos y
RSS elevado (War 681 MiB a 62 s): estas cifras no garantizan sesiones largas ni
Android. No hay otro recorrido de todos los nombres en la llamada habitual de
API: los recorridos de inventario o de encargos pendientes dependen de los datos
que se consultan, no de la lista de unidades.

La regresión `pruebas/api-muchos-nombres.mjs`, importada por api-nativa, hace que
50 lanzadores lean al siguiente, retengan objetos de líneas 7 y 19, lean globals
sin instrumentar y reciban otra foto; uno consulta un nombre inexistente.
Compara **cada mensaje y su orden**, y examina propiedades, flags, duplicados,
colisiones, mutación y extensibilidad en las tres series frente a VM. También
se contrastó localmente con la fuente original congelada: sin diferencias.


### Juego real

Cifras de Electron más abajo (ejecutadas por Claude tras la entrega de Codex). Emulación Node de rAF/DOM verifica el contador,
el recorte, la ventana, la deriva y el cierre; no es evidencia de GPU o de interfaz.
El gancho mínimo de app solo presta el contexto al banco y observa fotogramas;
no carga herramientas ni cambia el acumulador del jugador. La preparación usa
nuevoMundo y ejecutar reales, con UI, pulsos, eventos, escena y dibujo habituales.

```sh
node herramientas/medir-unidades.mjs --modo juego --unidades 500 --segundos 60 --salida tmp/unidades-electron
```

Cuatro casos (War/Campaign × 2D/3D), ventana visible, 1280×720, VFX alto, perfil
nuevo y temporal. Para Chromium, en dos terminales:

```sh
python3 -m http.server 8771 --bind 127.0.0.1
node herramientas/medir-unidades.mjs --modo juego --origen http://127.0.0.1:8771 --unidades 500 --segundos 60 --salida tmp/unidades-chromium
```

Para las seis cargas usar `--unidades 50,200,500`. Cada salida contiene versión/equipo/GPU/DPR/calidad,
intervalos, costes de cada paso, deriva/recortes y memoria de procesos cada segundo
(Electron getAppMetrics; Chromium CDP + RSS del SO). Suma de RSS puede duplicar
memoria compartida; un fallo al leerla queda explícito. No usar el origen donde
se esté jugando. Revisar GPU real y ausencia de errores antes de comparar equipos.

Electron, Apple M1, 1280×720, VFX alto, 60 s a 1×, semilla 7, 17 de noviembre de 2026 ([datos](paso-4b-electron.json)). RSS máx. es el del proceso de la página (pestaña); GPU 140–200 MiB y proceso principal ~150–180 MiB aparte.

| Serie / 500 | Vista | Fotogramas media/p95/p99 ms; >33 ms | Pasos/s real | Deriva | Recortes | Paso completo p95 ms | RSS pestaña | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| War | 2D | 26,6 / 33,6 / 50,0; 1159 de 2260 | 20,01 | +0,03 s (0,6 pasos) | 2 (arranque, máx. 583 ms) | 15,2 (ceder 11,2) | 1968 MiB | paso fijo sí; 60 fps no |
| War | 3D | 37,8 / 50,1 / 66,7; 1511 de 1587 | 20,06 | +0,19 s (3,7 pasos) | 1 (arranque, máx. 700 ms) | 15,3 (ceder 11,5) | 2092 MiB | paso fijo sí; 60 fps no |
| Campaign | 2D | 17,1 / 17,1 / 18,4; 3 de 3503 | 20,07 | +0,20 s (3,9 pasos) | 1 (arranque, máx. 1617 ms) | 5,4 (ceder 0,4) | 1816 MiB | paso fijo sí; 60 fps sí |
| Campaign | 3D | 20,9 / 33,4 / 34,4; 657 de 2872 | 20,07 | +0,19 s (3,9 pasos) | 1 (arranque, máx. 583 ms) | 5,5 (ceder 0,4) | 723 MiB | paso fijo sí; 60 fps casi |

**Lectura.** El **paso fijo se mantiene** en los cuatro casos: 20,0 pasos por segundo real y el paso completo (simulación + instantánea + programas) con p95 de 15,2 ms en War y 5,4 ms en Campaign, bajo 16,7 ms. La deriva positiva de 3–4 pasos no es retraso: es el primer fotograma, que carga los 500 programas (0,6–1,6 s), se recorta a 0,25 s y sus pasos caen al inicio de la ventana; sin él, 1187 pasos en 59,36 s son 19,997 pasos/s. El criterio `mantieneRitmo` de la herramienta (|deriva| ≤ 1 paso) lo marca como fallo por ese artefacto; habría que abrir la ventana después del primer fotograma.

**Límites a 500 que no son de esta fase.** (1) **War dibuja a ~30 fps**: los fotogramas de más de 33 ms (1159) coinciden casi uno a uno con los que contienen un paso (1190); el paso cuesta ~10 ms, sobre todo `ceder`, y sumado al dibujo de 500 lanzadores no cabe en 16,7 ms. Opciones: repartir el turno de las unidades entre fotogramas, abaratar más `ceder`, o llevar núcleo e intérprete a un hilo aparte (decisión pendiente del plan, que estos datos informan). Campaign 2D va a 60 fps. (2) **Memoria de la pestaña ~2 GB** con 500 unidades (frente a 681 MiB sin pantalla): sin investigar; probablemente interfaz y registro por unidad, o el pico de arranque. Es un riesgo para Android (fase 6), no para el criterio de esta fase.

### Android y cierre del paso

Para fase 6 hace falta repetir los casos en WebView/Capacitor sobre teléfonos
reales, registrar modelo, versión, memoria y temperatura, probar CPU/GPU sostenida,
calidad baja/alta, ambas vistas y pausa/reanudación. Un Mac no predice ese margen.
Antes de elegir calidad o limitar unidades, separar coste de programas, copias de
respuestas y escena/dibujo; cualquier optimización de reglas requiere otro encargo
y pruebas de determinismo/paridad. Aquí solo se optimizan la construcción de API
y el índice para ordenar mensajes; no las reglas ni la simulación.

### Verificación actual y estado

- `npm test`: **68/68**, sin omitidas; incluye api-nativa y sus 50 nombres,
  partida-interprete **41/41 con mensajes completos**, reales **80 fragmentos / 17
  Python**, Factory **28/28** y Campaign **12/12 tramos/repeticiones**.
- `npm run tipos`, `node pruebas/fronteras.mjs` (174 archivos, 14 paquetes),
  `node pruebas/fronteras-autoprueba.mjs` (80 infracciones inyectadas),
  `node pruebas/juego-identificadores.mjs` (115 módulos),
  `node pruebas/juego-conductor.mjs` (**41/41**) y `node --check` de los **17**
  scripts modificados/nuevos: correctos. La auditoría declara también los
  intrínsecos estándar WeakMap/WeakSet/Reflect usados por los índices/proxies.
- `node herramientas/espina-interprete/comparar.mjs`: **VM/P/N 41/41**, Factory
  **28/28**, Campaign **12/12 tramos**; [salida](paso-4b-compatibilidad.json).
  QuickJS omitido porque CBL_QUICKJS no está instalado/configurado; no se descarga.
  Factory conserva su construcción pequeña para mantener también el presupuesto
  histórico de P (600 000, incluyendo toda la API interpretada). El camino de
  producción N y su presupuesto no cambian.
- `node herramientas/medir-unidades.mjs`: las seis celdas, dos repeticiones,
  sin detener partidas; huellas iguales entre repeticiones y a la fuente previa.
  Ninguna dependencia nueva. PROGRESO.md, referencias y datos históricos intactos;
  el comparador escribió temporalmente su salida antigua y se restauró ese archivo,
  conservando esta ejecución en el archivo nuevo del paso 4b. Sin commit ni push.

**Fase 5 / paso 4b:** herramienta, paridad y umbral de coste sin pantalla hechos.
En el juego real (Electron), el criterio «mantiene el paso fijo» **se cumple** con 500 unidades en War y Campaign; los límites de fotogramas y memoria quedan anotados arriba.
