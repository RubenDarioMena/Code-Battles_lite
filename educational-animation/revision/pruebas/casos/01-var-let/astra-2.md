### Acuerdo

La suite pasa: **`flujo: 312 comprobaciones`**. El arreglo cubre los fixtures anteriores, pero aún produce afirmaciones falsas. Revisé el diff y ejecuté los programas siguientes mediante `node -e` con `pruebas/cargar.cjs`; no modifiqué archivos.

Rutas relativas a `educational-animation/revision/`.

### Variantes

**1. Callback síncrono y lecturas repetidas**
```js
for(let i=0;i<1;i++){
  console.log([0,0].map(()=> (i=i+1)));
}
```
Consola: `[1,2]`. Lectura **y traza** dicen «no se ejecuta aquí», aunque `map` ejecutó el callback dos veces. Solo se excluye una función usada directamente como `callee` (`motor/flujo.js:423`).

Además, `paso.lecturas` conserva ambas lecturas de `i`, **0 y 1**, pero la narración muestra únicamente «map(…) lee i «0»». La deduplicación por nodo elimina la segunda (`motor/explicar.js:303`). Se ha corregido el almacenamiento, pero vuelve a perderse información al explicarlo.

**2. Añadir llaves elimina la explicación de captura**
```js
const f=[];
for(let i=0;i<2;i++){f.push(()=>{return i})}
console.log(f[0](),f[1]());
```
Consola: `0 1`. Ninguna frase explica las variables por vuelta; aparecen una sección «Define la función …» y dos retornos. **Falso negativo respecto al equivalente `()=>i`**: `capturas` depende de `F.enLinea`, que excluye cuerpos con filas propias (`motor/flujo.js:259–264,421–422`). La semántica relevante no cambia al añadir llaves.

**3. Declaración en bloque hermano**
```js
let i=10; const f=[];
for(let k=0;k<2;k++){
  {let i=k;}
  f.push(()=>i);
}
console.log(f[0](),f[1]());
```
Consola: `10 10`. El motor afirma «cada vuelta tiene la suya»: **falso**. Encuentra cualquier declaración homónima dentro del bucle, aunque no sea visible desde la función (`motor/flujo.js:427–432`). La frase errónea se repite en ambos pasos de `push`.

**Atribución con `await`:**
```js
let i=4; const f=async()=>i;
console.log(await f());
```
Consola: `4`; narración: «[console.log(await f())] lee [i] «4»». Atribuye a `console.log` la lectura de `f`: agrupar con la siguiente llamada de la fila sigue siendo insuficiente (`motor/flujo.js:318–319`).

### Ajuste

Resolver declaraciones por ámbito visible; detectar capturas independientemente de las filas del cuerpo. Sustituir «no se ejecuta aquí» por una descripción neutral de captura cuando no se conoce el comportamiento del receptor.

Conservar lecturas repetidas y evitar adjudicar una llamada concreta sin asociación acreditada.

Para `h-sin-cambio`, dejar la pista en detalles plegados; no añadir heurísticas sobre utilidad. En traza, omitir la explicación estructural repetida (`motor/explicar.js:312`).

### Fixtures

Añadir los cuatro programas, comprobando texto y grupos ordenados, además de consola.

**Veredicto: aceptar con cambios**, corrigiendo ámbito, cuerpos de bloque, callbacks síncronos y atribución con `await` antes de integrar.