### Acuerdo

**Parcial.** El árbol conserva `clase` (`motor/trazador.js:52`) y confirmé los originales: consola `3 3 3`/`0 1 2`; eventos del identificador capturado `3,3,3`/`0,1,2`. La explicación los omite (`motor/explicar.js:281–298,547–559`).

Pero **también falla la atribución en flujo**: en `originalLet`, las lecturas terminan en los pasos de `push`, en orden **2,1,0**, y ninguna queda en el paso de consola. `motor/flujo.js:310–320` busca pasos anteriores de la fila propietaria y almacena por nodo. R2 necesita corregir esto antes de narrarlo.

Rutas relativas a `educational-animation/revision/`. Evidencia ejecutada con `node -e`, cargando `pruebas/cargar.cjs` y usando ejecutar→preparar→construir→recorrer; sin archivos nuevos.

### Variantes

**A — Invocación inmediata**
```js
for(let i=0;i<2;i++){console.log((()=>i)());}
```
Salida ejecutada: `0 / 1`; lecturas: `[0,1]`. R1 diría «guarda una función; todavía no se ejecuta»: **engañoso para esta sentencia**, que la ejecuta inmediatamente. R2 debería asociar cada lectura a su invocación; actualmente solo aparece «Escribe…».

**B — Parámetro homónimo**
```js
const f=[];
for(let i=0;i<2;i++){f.push((i)=>i)}
console.log(f[0](9),f[1](8));
```
Salida ejecutada: `9 8`; lecturas internas `[9,8]`. R1, interpretada literalmente por identidad de variable, **no debe activarse**; hacerlo por nombre produciría una captura falsa. El riesgo existe: `P.variables` sobrescribe entradas por nombre (`motor/flujo.js:39–43`). R2 puede decir «leyó el parámetro i», pero no atribuirlo al contador. Hoy esas lecturas quedan en los pasos de `push`, invertidas.

**C — `let` externo y reasignación**
```js
const f=[]; let i;
for(i=0;i<2;i++){f.push(()=>i)}
i=7; console.log(f[0](),f[1]());
```
Salida ejecutada: `7 7`. La condición inicial de R1 excluye este caso porque no hay declaración en cabecera; su cláusula posterior sí contempla variables externas. **Regla contradictoria/incompleta**. La pista de variable compartida sería correcta. R2 debería atribuir `7` a ambas llamadas; hoy quedan en `push`.

**D — Dos llamadas, mismo nodo**
```js
let i=0; const f=()=> (i=i+1);
console.log(f(),f());
```
Salida ejecutada: `1 2`; lecturas crudas `[0,1]`. R1 no aplica. R2 exige distinguir ambas llamadas, pero el recorrido conserva únicamente `i=1` en la fila que guarda `f`. Narrar desde ese mapa sería engañoso (`motor/flujo.js:317–320`).

### Ajuste

R1: resolver **referencias léxicas**, incluir variables externas explícitamente y separar creación de invocación. Reservar «guarda» para almacenamiento reconocido; capturar significa conservar acceso a una variable, no congelar su valor.

R2: conservar ocurrencias ordenadas y asociarlas a invocaciones. Si no puede acreditarse esa asociación, mostrar lecturas observadas sin adjudicarlas a llamadas concretas.

### Fixtures

Conservar originales y negativos existentes; añadir A–D, comprobando consola, activación de R1 y atribución ordenada de lecturas. **Sin cambios de código.**