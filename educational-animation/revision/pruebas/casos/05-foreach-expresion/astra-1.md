### Diagnóstico

**Ejecutado:** ambos programas imprimen `1 / 2 / fin`. La expresión produce una sola fila y ningún paso de cuerpo; el bloque produce dos vueltas y dos impresiones.

Rutas relativas a `educational-animation/revision/`:

- **Trazador:** solo instrumenta `forEach` cuyo callback tiene bloque (`motor/trazador.js:135–140`).
- **Reconocimiento:** `forEach()` también exige `BlockStatement`; por eso no registra `porCada` ni `cadaFn` (`motor/flujo.js:68–79`).
- **Construcción:** ya puede construir un paso sobre un nodo cualquiera: `bloque()` devuelve `[i]` para un nodo sin bloque, y `sentencia()` acaba en `paso()` (`flujo.js:82,112–143,153–163`). Falta reconocer este cuerpo y emitir su entrada.
- **Explicación:** etiqueta, detalle y lectura desenvuelven específicamente `ExpressionStatement` (`motor/explicar.js:198,412,698`).
- **Presentación:** foco/línea ya usan posiciones del nodo (`flujo.js:294–296`), pero la píldora de valor solo contempla declaraciones, sentencias expresión y retornos (`motor/revision.js:427–435`).

### Representación

**Propuesta razonada:** una fila `paso` cuyo nodo sea **la expresión original**, conservando ID, rango y padre. Sin fabricar `ExpressionStatement`.

Registrar el callback en `cadaFn` y el cuerpo en `porCada`. Emitir `s(idExpr)` permite abrir el paso usando el recorrido actual (`flujo.js:330–338`). El enlace cuerpo→bucle y su riel pueden usar la construcción existente.

Extraer un tratamiento común de expresión para etiqueta, lectura y detalle, invocado tanto desde `ExpressionStatement` como desde esta fila. Incluir llamadas, asignaciones, ternarios y secuencias; no describir una secuencia como si solo ejecutara su última llamada.

Adaptar también la detección de sentencia independiente en regresos de `next()` y la píldora de valor. La documentación ya acepta expresiones directamente, incluidas llamadas de consola (`motor/documentacion.js:24–27,45–55`).

La alternativa sin fila de cuerpo mezclaría vuelta y acción y conservaría la diferencia visual del par; no la recomiendo.

### Instrumentación

**Propuesta razonada:**
```js
x => (__T.c(idBucle,x), __T.s(idExpr), expresionOriginal)
```
Respetar separadamente `quiere("c",…)` y `quiere("s",…)`; conservar el gancho de valor existente y ordenar envolturas por profundidad.

**Ejecutado, prototipo en memoria:** la envoltura con coma conservó salida y líneas con índice, parámetro por defecto, patrón, secuencia y objeto literal. Un receptor de prueba que utiliza el retorno del callback siguió recibiendo `3`.

Para `x=7`, registrar el identificador ya inicializado; para patrones, marcador de vuelta sin inventar un valor ni repetir desestructuración. No sustituir `function` por flecha: conservar `this`, argumentos y retorno.

**HEAD:** el único archivo con callback bloque encontrado en casos/ejemplos produjo código instrumentado idéntico byte a byte. La implementación debe mantener esa rama intacta.

### Contraejemplos y riesgos

**Razonado:** mantener fuera `map`, `filter`, `forEach(f)` y llamadas con segundo argumento; son ampliaciones distintas. El filtro de pulsos rechaza estos nuevos `s` y `c` (`Prototypes/Rocket Launcher/js/pulsos.js:52`).

Evitar que la expresión siga atribuyéndose a la flecha como lectura en línea: su fila debe poseer sus eventos; las funciones anidadas conservan el tratamiento del ciclo 01. Añadir fixtures de callbacks async, temporizadores que ejecutan `forEach`, `next()` dentro del cuerpo y etiquetas externas. `forEach` no espera las promesas devueltas; el nuevo riel no debe implicar esa espera.