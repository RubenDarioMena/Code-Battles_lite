# @cbl/interprete

Fase 5, pasos 2–4a. Intérprete ESTree sobre Acorn inyectado; no tiene dependencias
de otros paquetes ni imports externos. Su consumidor real es
`anfitrion.crearTrabajadorInterprete`: ejecuta los programas instrumentados/traducidos en War, Factory y
Campaign, tanto en el juego como sin pantalla, sin Workers. El prototipo de
medición/depuración sigue en `herramientas/espina-interprete/propio-paquete.mjs`.
El anfitrión fija 1 000 000 unidades de presupuesto por tarea entregada (API nativa), drena la cola propia y libera
el ámbito al cerrar o agotar presupuesto; al cerrar la última unidad libera el reino.
El cuerpo de la API de confianza queda fuera del presupuesto.

## Contrato

```js
const motor = crearInterprete({ acorn, presupuesto: 600000,
  globales: { console: { log: registrar } }, depurar: false });
const valor = motor.ejecutar('1 + 2'); // 3, valor de terminación del script
motor.vaciarTrabajos();             // FIFO propia, hasta quedar vacía o agotar presupuesto
motor.reiniciarPresupuesto();       // el consumidor fija las fronteras de cada tarea
motor.medir();                     // nodos, línea, trabajos, pausas, caché, liberado
motor.liberar();                    // idempotente, descarta trabajos, pausas y referencias
```

`global` es el objeto global local, también `self` y `globalThis`. Los bindings
léxicos no son propiedades; `var` global sí. Los valores retornados son nativos;
una función async devuelve la Promise del motor: observarla con `.then` y drenar
`vaciarTrabajos`, sin entregarla al `await` del anfitrión antes de drenar.
`ejecutar(fuente, { usuario: false })` sirve al arnés del Worker: no marca sus
líneas como líneas del jugador. Las funciones de compilación dinámica sí las marcan.

Cada nodo evaluado suma uno; cada llamada nativa explícita suma al menos uno,
incluso por fachadas o reflexión, y cada trabajo suma uno. No hay reloj, timers ni
azar. `PresupuestoAgotado` es terminal para la tarea (no capturable por el programa),
con `code = "CBL_PRESUPUESTO"`, `cuenta`, `linea` y `__linea`. El mismo código y entradas
producen la misma cuenta y línea, incluidos getters y trabajos sin órdenes.
Los errores normales conservan tipo y mensaje V8 y reciben `linea` desde `loc`.
La pila sintética `<anonymous>` permite la calibración del Worker histórico sin
ponerles `__linea`: el traductor Python reserva esa propiedad a errores de API.

Con `depurar: true`, `pausasPendientes()` devuelve `{ linea, nodo }` antes de cada
sentencia de funciones async del programa. `reanudar()` ejecuta hasta la siguiente
pausa o await y devuelve la pausa consumida; el consumidor decide cuándo drenar.
Los cierres sobreviven. `depurar: true` incluye las funciones dinámicas. El arnés usa
`depurar: { parametro: "__L" }` para depurar solo las compilaciones con ese parámetro
y sus funciones async anidadas, omitiendo el auxiliar de calibración del Worker. Los callbacks
síncronos, getters y traps de Proxy corren hasta volver: no suspenden una pila nativa.
`liberar` invalida también funciones interpretadas retenidas por el consumidor.

## Semántica y pruebas

`pruebas/diferencial.mjs`: 140 fragmentos intactos en `node:vm` y el motor; compara
valor, traza y excepción (tipo y mensaje), con contextos nuevos. Comprueba const,
TDZ de let/const/class, elevación de var/funciones, let por iteración, etiquetas,
switch con caída, try/finally y saltos, objetos/métodos/accesores/spread/__proto__,
clases con herencia/super/estáticos/campos públicos y privados/new.target,
generadores/yield*/cierre, async flecha, opcionales y this, plantillas etiquetadas,
typeof/delete/in/instanceof, operadores y actualizaciones, arguments, parámetros
por defecto, desestructuración e iteradores del usuario. Las promesas comprueban
trazas intercaladas con await, then, thenables, combinadores y queueMicrotask.

`pruebas/reales.mjs` llama al arnés externo para consumir las fuentes actuales de
las tres series y el traductor: 80 programas, 17 de Python, Worker completo con
hasta tres reanudaciones. No mantiene copias de programas ni altera referencias.
`comparar.mjs` añade las partidas completas y sus 41 hashes/resultados/tiempos.
`pruebas/motor.mjs` comprueba presupuesto, getters, línea, pausas/cierres, compilación,
caché y liberación. `pruebas/aislamiento.mjs` realiza 339 comprobaciones de las rutas de escape y las
mutaciones contra V8 estricto con intrínsecos congelados, sin congelar el anfitrión.

Se rechazan claramente módulos/import(), with, async generators y for await.
No se ofrece eval, Date ni Math.random utilizable. Acorn diagnostica sintaxis
inválida; sus mensajes sintácticos son los de Acorn. Las extensiones de Node/DOM y
las APIs no instaladas no existen. Este corpus no equivale a la certificación Test262.

## Aislamiento y límites

El modelo es evitar escapes accidentales y contaminación entre unidades. **No es
un sandbox de seguridad para código hostil**: se comparten V8, memoria y operaciones
nativas. El presupuesto acota el árbol y sus callbacks; no el coste/memoria de una
única regex, JSON, cadena o array nativo. No garantiza latencia máxima. Antes de
aceptar fuentes hostiles hace falta un límite externo de proceso/memoria.

Las lecturas del evaluador y resultados nativos convierten intrínsecos en fachadas
locales congeladas. Incluyen propiedades simbólicas, prototipos de iteradores,
constructores, métodos y accesores. Reflexión y descriptores reciben/devuelven esas
fachadas; asignar, borrar, defineProperty, assign y setPrototypeOf se comportan como
intrínsecos congelados en V8 estricto. Los intrínsecos originales nunca se congelan
ni escriben. Function, AsyncFunction y GeneratorFunction, incluso por constructor,
compilan con Acorn y el ámbito global local. AsyncGeneratorFunction se rechaza.
No hay ningún camino de compilación que use eval/Function del anfitrión.

`globales` son capacidades **de confianza**: el consumidor no debe inyectar process,
require, compiladores nativos, el global del anfitrión ni objetos de su sistema.
Los datos y callbacks que se inyectan pueden ser modificados o llamados por el
programa; el consumidor debe decidir su propiedad y vida útil. No se clonan aquí:
el canal de las herramientas realiza el clonado fuera del paquete.

Los árboles se comparten por fuente e identidad de Acorn, con LRU de 128 árboles y
2 millones de unidades UTF-16; una fuente mayor no se cachea. No conservan motores.
Los nodos sin await/yield recorren un evaluador recursivo síncrono. Los tres archivos
`*-rapido.js` se generan estáticamente desde sus originales con
`node herramientas/espina-interprete/generacion/rapido.mjs`; se entregan ya generados.
No hay generación dinámica de código del jugador ni fase de compilación al ejecutar.

## Ámbitos de un reino (paso 4a)

`motor.crearAmbito(globales?)` devuelve `{ global, activar(), liberar() }`.
Cada ámbito tiene bindings/global/self/globalThis propios y comparte las fachadas
congeladas, compiladores, Promise y cola del motor. El consumidor activa el ámbito
antes de entregar una tarea y drena la cola antes de activar otro; el presupuesto
se reinicia por entrega. Los compiladores dinámicos usan el ámbito activo.
Liberar un ámbito invalida sus funciones y limpia sus bindings, sin cerrar los demás.
`motor.liberar()` cierra todos los ámbitos y libera las fachadas y colas del reino.
La prueba de integración está en `pruebas/api-nativa.mjs` de la raíz.
