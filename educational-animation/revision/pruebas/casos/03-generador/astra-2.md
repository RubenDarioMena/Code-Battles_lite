### Variantes

Ejecuté estas tres con `caso.cjs /dev/stdin`. La suite pasa: **373 comprobaciones**. Rutas relativas a `educational-animation/revision/`.

**1. Declaración generadora reasignada**
```js
function* g(){ yield 1; }
g=()=>console.log("normal");
g();
console.log("fin");
```
Consola: `normal / fin`. Lectura y traza afirman **«Crea un generador… todavía no ejecuta el cuerpo»**. Es falso: ejecuta la sustituta. `funcionDeLlamada` acredita cualquier declaración de función sin comprobar escrituras posteriores (`motor/flujo.js:502–508`).

**2. Delegación `yield*`**
```js
function* g(){ yield* [1,2]; }
const it=g();
console.log(it.next());
console.log(it.next());
```
Consola: `{"value":1,"done":false}` / `{"value":2,"done":false}`.

La lectura dice **«entrega [1,2]»**; la traza dice **«entrega undefined»**, seguida del regreso que entrega `1`. Ambas explicaciones del `yield*` son falsas. Se trata cualquier `YieldExpression` como una cesión simple (`motor/explicar.js:428`); el trazador tampoco conserva `delegate` (`motor/trazador.js:48–55`).

**3. Generador async con espera**
```js
async function* g(){
  await esperar(0.01);
  yield 1;
}
const it=g();
console.log(await it.next());
console.log("fin");
```
Consola correcta: `{"value":1,"done":false} / fin`. **Orden narrado incorrecto:** primero «Escribe…value:1», después la espera y el `yield`. Reaparece el fallo central del caso: resultado antes de producirlo.

El regreso solo reconoce eventos del `CallExpression` de `next()`; aquí su resolución llega mediante `AwaitExpression` (`motor/flujo.js:288,349–351`).

### Ajuste mínimo

- Invalidar la acreditación de una función generadora cuando su declaración recibe reasignaciones.
- Conservar `delegate`; para `yield*`, explicar que delega la entrega de valores. No inventar el valor cedido desde el argumento.
- Asociar también la resolución de `await next()` al regreso, preservando solicitud → cuerpo/espera → resultado.

Añadir los tres como fixtures, comprobando frases y orden, además de consola.

**Juego, razonado por diff:** la marca nueva solo añade metadatos; no cambian ganchos ni `V`. Los pulsos actuales no consultan `generador`. No hay evidencia de cambio en guardados; no ejecuté navegador.

### Veredicto

**Rechazar esta versión**, pendiente de corregir las tres afirmaciones falsas. La suite actual no cubre estos casos.