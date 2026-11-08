### Ciclo 01

**Lo rompo:** ejecuté `const f=[]; f.push=cb=>cb(); for(let i=0;i<2;i++) console.log(f.push(()=>i));`: consola `0 / 1`, pero afirma «no se ejecuta aquí».
Acreditar el inicializador no acredita el método vigente (`motor/flujo.js:466–469`); ante sustituciones, usar la frase neutral.

### Diagnóstico

Rutas del motor relativas a `educational-animation/revision/`. **Ejecutado:** el par reproduce `fin / callback` frente a `callback / fin`. El agendado entrega eventos `1,2,10,11`, sin el `console.log` del callback; el inmediato sí contiene su evento `4`.

- **Trazador/ejecutor:** fallo conjunto de entrega y cierre, no de ejecución del callback. `fin()` vacía el búfer antes del microtask; los eventos posteriores quedan pendientes. También existe vaciado por tamaño, además de `w()` y `fin()` (`motor/trazador.js:176–179`). El ejecutor pone `fin()` dentro del cuerpo y devuelve el resultado tras esperarlo, sin otro vaciado (`motor/ejecutar.js:35–43`).
- **Recorrido:** aunque llegasen, los eventos de una flecha sin filas propias se acumularían en el paso vigente; no abren un paso de callback (`motor/flujo.js:318–322`). Recuperarlos solamente no basta.
- **Explicación:** describe la llamada exterior; las lecturas añadidas filtran identificadores externos, no acciones como imprimir (`motor/explicar.js:301–307,568–570`).
- **Presentación:** ya admite pasos que repitan fila y narración propia; el problema precede al dibujo (`motor/revision.js:437–445,502–508`).

**Juego, razonado leyendo código:** comparte trazador mediante `js/pulsos.js:82–93`; el Worker ejecuta `await fn(__L)` y manda `done`, sin vaciado final (`Prototypes/Rocket Launcher/js/runtime.js:162–164`). Un callback corto también puede quedar sin pulso hasta otro vaciado. La consola viaja separadamente (`runtime.js:103`). Factory no recibe esa instrumentación (`js/juego.js:245–248`). El visor integrado actualmente solo analiza estructura, sin ejecutar (`js/revision-juego.js:56–64`).

### Regla

**Propuesta, razonada:**

- Lectura, agendado, fila 1: «Agenda esta función para después del tramo síncrono; continúa en 2».
- Lectura, inmediato, fila 1: «Llama ahora a esta función: imprime “callback”; después continúa en 2».
- Fila 2: «Imprime “fin”». En el agendado, evitar «Aquí acaba el programa»: todavía puede quedar trabajo pendiente.

En **traza**, prefiero un paso posterior que vuelva a fila 1: «Ahora se ejecuta el callback agendado: imprime “callback”». Así se observa **1 agenda → 2 imprime → 1 callback → final**. Requiere distinguir entrada al callback de evaluación del agendador y entregar sus eventos; un aviso final sería insuficiente para mostrar el orden como recorrido.

### Contraejemplos

**Razonado:** `map`/`forEach` no activan “agendar”. Tampoco parámetros, variables o declaraciones de función llamados `queueMicrotask`: resolver el callee, incluyendo declaraciones de función; no basta comparar nombres. `Promise.then` y temporizadores necesitan reglas propias, no prometer el mismo turno.

### Riesgos

**Razonado:** instrumentar entrada/salida del callback debe conservar líneas, retorno, excepciones y receptor, sin insertar `await` ni alterar colas. Mantener `w()` y el reloj virtual: `esperarAPI` suspende hasta `despierta` (`runtime.js:96–101,148–151`). Cualquier cambio compartido exige verificar pulsos y equivalencia de ejecución; no asumir que esperar una microtarea drena temporizadores o callbacks encadenados.