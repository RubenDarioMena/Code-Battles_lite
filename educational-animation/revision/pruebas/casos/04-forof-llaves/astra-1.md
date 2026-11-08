### Diagnóstico

**Ejecutado:** el par imprime `1 / 2 / fin`; sin llaves registra **0 vueltas**, con llaves **2**. Causa: el gancho de vuelta exige `BlockStatement` (`motor/trazador.js:125–127`). Rutas relativas a `educational-animation/revision/`.

Otras formas ejecutadas con el mismo cargador:

- `for…in`: consola `a / b`; **0 vueltas** sin llaves, **2** con ellas.
- `for(x of…)`, desestructuración y `for await…of` sin llaves: consola correcta, pero sin eventos de vuelta.
- `forEach(x=>console.log(x))`: imprime `1 / 2`, pero solo narra una llamada. Con bloque hay dos vueltas y dos impresiones. Lo bloquean tanto trazador (`:133`) como estructura (`motor/flujo.js:78`).
- `while`, `for` clásico e `if` sin llaves conservan sus condiciones y acciones: sus ganchos dependen del campo `test`, no del bloque (`trazador.js:139–140`).
- `do…while` ejecuta dos cuerpos pero registra una vuelta tanto con llaves como sin ellas: límite previo distinto.
- Probé cuerpo vacío, bucle bajo `if/else`, y `continue etiqueta`: ejecutan correctamente, pero sus `for…of` pierden vueltas.
- Desestructuración **con** bloque ya narra falsamente `[a,b] = true`; es el sustituto actual del valor (`trazador.js:127`).

### Instrumentación

**Propuesta razonada:** conservar intacta la rama con bloque. Para cuerpos sin él, insertar en sus límites:

```js
{__T.c(idBucle, valor); sentenciaOriginal}
```

Sin saltos nuevos. Usar profundidad del bucle para esa envoltura exterior; el gancho `s` existente del cuerpo queda dentro. Revisar aperturas y cierres coincidentes: orden exterior→interior al abrir, inverso al cerrar (`trazador.js:103–104,157–163`).

Envolver **el cuerpo**, nunca separar una etiqueta de su bucle. Así `continue etiqueta` conserva destino. Un cuerpo `;` queda `{gancho;;}`; cerrar exactamente antes del `else` preserva su asociación. `let`/`const` como sentencia directa ya son sintaxis inválida: no convertirlas en programas válidos.

Para flechas expresión de `forEach`, prefiero:

```js
x => (__T.c(id,x), expresionOriginal)
```

Conserva retorno y evaluación única. También hay que representar esa expresión como cuerpo en flujo; añadir solo el gancho no basta. No releer destinos complejos para obtener valores.

### Juego

**Hallazgo ejecutado:** reproduciendo el filtro de pulsos, `if(true) for…of…` recibe gancho `c` únicamente con llaves. El filtro acepta cualquier nodo cuyo padre sea `IfStatement` (`Prototypes/Rocket Launcher/js/pulsos.js:51`). **Corregirlo para exigir el campo `test`**, evitando convertir las nuevas vueltas en pulsos de condición.

**Razonado:** respetando `quiere`, no deben añadirse esos pulsos ni moverse líneas de error. No cambia el formato de programas guardados; las grabaciones nuevas sí incorporarán eventos adicionales.

Repetir `pruebas/trazador.cjs`, `pruebas/flujo.cjs` y `pruebas/juego.mjs` del laboratorio: esta última comprueba pulsos y equivalencia de partida (`juego.mjs:124–146`).

### Contraejemplos y riesgos

**Razonado:** exigir identidad byte a byte del código instrumentado para cuerpos ya bloqueados. Mantener Python, `map`, retorno de callbacks, etiquetas, ASI y `else` intactos. Añadir equivalencia de consola y trazas para ciclos 01–03; no presentar el marcador `true` de desestructuración como valor real.