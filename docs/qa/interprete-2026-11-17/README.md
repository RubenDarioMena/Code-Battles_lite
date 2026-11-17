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
