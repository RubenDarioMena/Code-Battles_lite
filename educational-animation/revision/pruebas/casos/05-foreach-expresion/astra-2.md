### Variantes

Ejecutadas con `caso.cjs /dev/stdin`. La suite actual pasa: **414 comprobaciones**.

**1. Callback async: orden y atribución invertidos**
```js
[1,2].forEach(
  async x => console.log(await esperar(x * 0.01), x)
);
console.log("fin");
```
Consola: **`fin / ok 1 / ok 2`**. Traza: **`ok 2 / ok 1 / fin`**. Los resultados de continuaciones posteriores vuelven a rellenar pasos anteriores, además en orden inverso. Reaparece el fallo del ciclo 01: una fila estática no identifica cada ejecución suspendida.

**2. `forEach` anidado en la nueva fila**
```js
[[1,2],[3]].forEach(
  l => l.forEach(x => console.log(x))
);
console.log("fin");
```
Consola: `1 / 2 / 3 / fin`. Solo representa las dos vueltas exteriores; las interiores quedan como llamadas con resultado `undefined`, sin impresiones. El reconocimiento sigue buscando `ExpressionStatement`, aunque ahora el cuerpo también puede ser una fila `CallExpression`. La representación no se aplica recursivamente.

**3. Devuelve una función**
```js
[1,2].forEach(x => y => x);
console.log("fin");
```
Consola: `fin`. Lectura y traza dicen **«Ejecuta [y => x]»**. Deben distinguir evaluar una expresión de función y llamar a esa función: aquí se crea y devuelve una función que `forEach` descarta.

**4. Optional chaining**
```js
const l=[1,2];
l?.forEach(x => console.log(x));
console.log("fin");
```
Consola: `1 / 2 / fin`; ninguna vuelta ni impresión del cuerpo en la narración. Es una forma todavía no cubierta, por el `ChainExpression`; conviene declararla fuera del alcance si no se amplía ahora.

**Pulsos:** comparé HEAD con worktree usando el filtro real de `pulsos.js`: código instrumentado **idéntico en los 77 programas** encontrados en casos/ejemplos. El archivo `motor/python.js` también coincide exactamente con HEAD; no ejecuté una suite Python.

### Ajuste mínimo

- Para async, asociar continuaciones a cada invocación; alternativamente excluirlas temporalmente de esta representación de bucle. No conservar una traza que imprime resultados futuros e invertidos.
- Reconocer el `forEach` también cuando la llamada constituye una fila de cuerpo expresión, compartiendo el criterio entre trazador y flujo.
- Describir una expresión de función como creación, sin sugerir invocación.
- Optional chaining puede quedar como límite explícito de este ciclo.

### Veredicto

**Rechazar esta versión**, principalmente por la traza falsa del callback async. Añadir fixtures de los tres primeros casos, verificando orden y filas además de consola.