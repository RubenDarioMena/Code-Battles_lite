Ejecuté dos variantes con `caso.cjs /dev/stdin`. La suite pasa: **348 comprobaciones**.

**1. Rechazo de un callback asíncrono**
```js
setTimeout(async () => {
  await esperar(0.01);
  throw new Error("rechazo asincrono");
}, 0);
console.log("fin");
```
**Resultado:** proceso terminado con código **1**, por rechazo no capturado; no devuelve informe.

`correr()` descarta la promesa devuelta por `fn(...args)` y su `catch` solo captura excepciones síncronas (`motor/ejecutar.js:59–63`). El cierre `/corre` también ocurre antes de la continuación asíncrona.

Corrección necesaria: observar el rechazo de la promesa mediante `fallo`, sin bloquear el despacho de otros temporizadores. Añadir este fixture; no basta documentar un error que escapa del ejecutor.

**2. Cancelación propia: ejecución correcta, lectura falsa**
```js
const id = setInterval(() => {
  console.log("una");
  clearTimeout(id);
}, 1);
console.log("fin");
```
**Resultado:** `fin / una`, sin repetición: la cancelación funciona. Pero la lectura de la última fila dice **«Aquí acaba el programa»**. La declaración solo dice «Calcula setInterval(…) y lo guarda»: desaparece la explicación de que agenda trabajo.

La detección de agenda en explicación y última fila está restringida a llamadas como sentencias independientes (`motor/explicar.js`, ramas de `ExpressionStatement` y cálculo de `agendas`). Guardar el identificador del temporizador es precisamente el uso normal para cancelarlo.

Corrección necesaria: reconocer la llamada agendadora en el inicializador, conservar «guarda el identificador» y señalar el callback pendiente al terminar el principal.

**Veredicto: rechazar el cierre actual**, pendiente de estas dos correcciones acotadas y sus fixtures.

**Límite documentable:** los temporizadores usan reloj virtual; no se promete fidelidad a los tiempos mínimos ni al orden entre tareas de distintas fuentes del navegador o Node.