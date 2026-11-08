### Variantes

Ejecutadas con `caso.cjs /dev/stdin`. Rutas relativas a `educational-animation/revision/`.

**1. Dos etiquetas sobre el mismo bucle**
```js
a: b: for(const x of [1,2]){
  if(x===1) continue a;
  console.log(x);
}
console.log("fin");
```
Consola correcta: `2 / fin`. Pero `continue a` tiene `sig=·` y falta su riel hacia el bucle; solo aparece `4→1`. La narración dice que vuelve a `(1)`, contradiciendo el grafo. Solo se reconoce la etiqueta inmediatamente superior, `b` (`motor/flujo.js:146–150`).

**2. `break` de un bloque etiquetado**
```js
for(const x of [1,2]){
  b: {
    if(x===1) break b;
    console.log("dentro");
  }
  console.log("despues",x);
}
console.log("fin");
```
Consola: `despues 1 / dentro / despues 2 / fin`. Lectura: **«Sale del bucle (1)… y el programa acaba»**. Traza: **«el programa termina»**, seguida de `despues 1`.

La etiqueta del bloque se descarta sin consumir su `break` ni conectarlo a la sentencia posterior (`motor/flujo.js:115`).

**3. `break` exterior atravesando un `switch`**
```js
fuera: for(const x of [1,2]){
  switch(x){case 1: break fuera;}
  console.log("no");
}
console.log("fin");
```
Consola: únicamente `fin`. Sin embargo, `break fuera` apunta a la fila de `console.log("no")` y narra «sigue en (4)». `segun()` consume todos los `break`, incluso los etiquetados para fuera (`motor/flujo.js:219–223`).

**Pulsos:** comparé HEAD y worktree usando sus trazadores y filtros reales, obtenidos con `git show HEAD:…`. Los **6 programas iniciales de War** producen código idéntico. En otros **68 programas/probes**, 67 coinciden; cambia únicamente un `for…of` con bloque bajo `if`, al eliminar el gancho espurio. Con el filtro nuevo en ambos trazadores, coinciden los 68: la envoltura nueva no introduce diferencias adicionales.

### Ajuste mínimo

Resolver cada salto por su **destino**, conservando todas las etiquetas consecutivas. Un bloque etiquetado consume sus propios `break`; un `switch` consume los no etiquetados y los dirigidos a él, propagando los demás. Narrar la salida del destino real, sin asumir que siempre es un bucle.

Añadir los tres fixtures, comprobando `sig`, rieles y frases además de consola.

### Veredicto

**Aceptar con cambios:** la instrumentación y el filtro superan esta comprobación; completar la resolución de etiquetas antes de integrar su ampliación. No ejecuté navegador.