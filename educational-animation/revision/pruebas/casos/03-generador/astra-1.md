### Diagnóstico

Rutas relativas a `educational-animation/revision/`, salvo indicación.

**Ejecutado:** `a-creado` imprime solo `fin`, pero anuncia «sigue en (3)». `b-consumido` imprime `cuerpo / fin`, pero narra el resultado de `next()` antes del cuerpo.

- **Árbol/trazador:** Acorn devuelve `generator:true`; confirmé que desaparece de la tabla (`motor/trazador.js:46–54`). Conviene copiarlo como `generador`, junto con `async`: buscar `yield` no identifica generadores JS sin cesiones, como este par.
- **Python:** ejecuté el lector con `yield 1`: produce `PySentencia` con `py:"YieldStatement"`, sin marcar la función. Detectar `yield`/`yield from` en el árbol Lezer del cuerpo, excluyendo funciones anidadas, y conservar `generador` al serializar (`motor/python.js:125–133,155,299`). **Hallazgo ejecutado:** `yield` sin valor provoca `SyntaxError`; requiere fixture específico.
- **Recorrido:** los eventos ya tienen el orden correcto, pero el resultado se incorpora retrospectivamente al paso anterior de la llamada (`motor/flujo.js:347–357`).
- **Explicación:** toda función propia se trata como ejecución inmediata (`motor/explicar.js:295–298,608–609,687–690`).
- **Presentación:** dibuja valores y narración del paso recibido; corregir únicamente el texto no arreglará el orden (`motor/revision.js:427–435,502–508`).

### Regla

**Propuesta razonada:**

**Lectura, fila 3:** «Define el generador g. Llamarlo crea un objeto generador; su cuerpo empieza cuando se solicita avanzar».

**Fila 1 de a:** «Crea un generador con g; todavía no ejecuta su cuerpo».  
**Fila 1 de b:** «Crea el generador y lo avanza hasta el siguiente yield o hasta terminar». Así puede anticiparse si imprime `cuerpo`.

Para un iterador acreditado, posteriores `next()` **reanudan**, no reinician. `for…of`, spread y `Array.from` solicitan valores sucesivos; evitar «lo consumen entero» sin condiciones: puede haber `break`, excepción o generación infinita.

**Traza:** separar inicio y finalización: solicitud de avance → pasos del cuerpo → resultado de `next()`. No adelantar el resultado ni desplazar ciegamente toda la llamada, que puede tener argumentos con efectos.

En a, decir «Creó un generador; su cuerpo no se ejecutó», sin salto ficticio.

**Valor:** no ampliaría `V` globalmente como requisito mínimo. Puede ocultarse `{}` mediante el contexto de una creación acreditada. Un marcador nuevo exigiría actualizar ambos formateadores (`motor/trazador.js:183–186`, `motor/explicar.js:106–109`) y una identificación que no invoque métodos ni getters del objeto.

### Contraejemplos

**Razonado:** excluir funciones normales, `async` sin `*`, objetos con `next` propio y nombres reasignados o sombreados. Resolver declaración e inicialización; `P.funciones` solo indexa nombres (`motor/flujo.js:46–49`). En Python, un `yield` de una función anidada no convierte la exterior; comprobé que el lector conserva ambas funciones separadas.

### Riesgos

**Razonado:** conservar IDs y eventos históricos; recuperar metadatos ausentes reanalizando la fuente, sin convertir cualquier `{}` antiguo en generador. Añadir cobertura de cesiones repetidas, `paso.lecturas`, callbacks diferidos y reanudación desde temporizadores.

El juego comparte instrumentación y valores para pulsos (`Prototypes/Rocket Launcher/js/pulsos.js:82–93,132–142`): añadir metadatos es acotado; modificar `V` o los ganchos exige comprobar equivalencia y conservación de líneas.