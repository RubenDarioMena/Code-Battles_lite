### Variantes

Ejecutadas con `caso.cjs /dev/stdin`, salvo C, mediante el mismo cargador en Node. La suite actual pasa: **339 comprobaciones**.

**A. Dos ejecuciones se funden**
```js
const cb=()=>console.log("cb");
queueMicrotask(cb);
queueMicrotask(cb);
console.log("fin");
```
Consola: `fin / cb / cb`. La traza muestra **un único paso** de callback, que imprime una vez. `motor/flujo.js:329` mantiene el paso mientras coincide la función; falta distinguir invocaciones.

**B. Función agendada que también se llama directamente**
```js
const cb=()=>console.log("cb");
queueMicrotask(cb);
cb();
console.log("fin");
```
Consola: `cb / fin / cb`. Para la llamada síncrona, narra **«El código principal está esperando… la que estaba agendada»**, aunque no hay ningún `await`. La pertenencia estática a `agendadas` clasifica todas las ejecuciones de esa función como diferidas (`motor/flujo.js:289–290,329`).

**C. Resultado que cambia después de devolverlo**
```js
setTimeout(()=>console.log("tarde"),30);
console.log("fin");
```
Al resolver `ejecutar`, `salida` contiene solo `fin`, con `error:null` y `cortado:false`. Tras esperar 60 ms en el arnés, **el mismo resultado** contiene `fin / tarde`; sus eventos siguen sin incluir el callback. El ejecutor devuelve la colección viva y deja tareas activas (`motor/ejecutar.js:32,44–54`). Falta declarar el límite de observación y cerrar coherentemente la ejecución.

**D. Excepción fuera del manejo de errores**
```js
queueMicrotask(()=>{throw new Error("fallo callback")});
console.log("fin");
```
El comando termina con **código 1 y excepción no capturada**; no entrega informe. El `catch` rodea la promesa del cuerpo, no la ejecución independiente del callback (`motor/ejecutar.js:36–39`). En navegador, razonado, ese error tampoco quedaría registrado por este `catch`.

### Ajuste mínimo

Añadir identidad y límites de **cada ejecución de callback**; no inferirlos únicamente del nodo de función. Eso permite separar A y distinguir la llamada directa de B.

El ejecutor necesita un ciclo de vida controlado para las tareas que admite: capturar errores, cancelar temporizadores pendientes al cerrar y devolver una instantánea estable con indicación de trabajo pendiente. Un `setTimeout(0)` adicional no establece por sí solo ese contrato.

**Juego, razonado:** este ejecutor no forma parte del runtime ni de pulsos: el cargador integrado lo omite (`js/revision-juego.js:17–18`); pulsos usa directamente `T.instrumentar` (`js/pulsos.js:82`). «Tu código» sí lo llama (`revision/index.html:144`). Esta modificación no corrige el vaciado del Worker identificado anteriormente.

### Veredicto

**Rechazar esta implementación hasta corregir A–D.** Hay pérdida de ejecuciones, narración falsa y tareas que sobreviven al resultado. Añadir los cuatro programas como fixtures.