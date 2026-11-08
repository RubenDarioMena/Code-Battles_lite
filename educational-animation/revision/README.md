# Modo revisión · prototipo

La pantalla se parte en dos:
- **el código**, que no se edita;
- **el mismo programa como diagrama de flujo**, al estilo de la infografía de los seis cafés, y una línea que dice qué hace cada fila en lenguaje de personas.

Por defecto es un **recorrido de lectura** (`FL.estructura`, `E.describir`): fila a fila, en orden de lectura, sin ejecutar el programa. No hace falta haberlo corrido; primero se entiende el código y después la partida. `?modo=traza` enseña en cambio la ejecución grabada (`grabar.mjs`) con sus valores reales.

**Al leer.** ▶ avanza a ritmo de lectura: cada paso dura lo que se tarda en leer su texto con un 15 % más para mirar el código y el diagrama (238 palabras por minuto en silencio, Brysbaert 2019, y 5,5 caracteres por palabra en nuestras frases: ≈ 21,8 caracteres por segundo; mínimo 1,2 s). Velocidades 0,5× 0,75× 1× 1,25× 1,5× 2× 4× (botón, o + y −). ✕ oculta el texto pero deja la selección en el código y el diagrama; el botón del globo (o T) lo vuelve a mostrar. Esc quita la selección. En las tarjetas, lo secundario va plegado en «Más detalles».

En el teléfono van apilados (código arriba, diagrama abajo); en el escritorio, uno al lado del otro (código a la izquierda, diagrama y narración a la derecha, franja de tiempo abajo de borde a borde).

**En el juego** (War, JavaScript) se abre con los binoculares de la barra del mapa o con «Revisar» del menú ⋯ del teléfono: lee el código que hay en el editor (abajo, «Dentro del juego»).

Cada fila del diagrama tiene **número y color propios**, como cada campo de un formulario que ilumina su parte del texto generado. El número y el color se repiten en el margen del código y en la franja de tiempo. Al recorrer el programa, la fila activa y su fragmento de código se iluminan juntos. Tocar, o señalar con el ratón, cualquier cosa de un lado ilumina su pareja en el otro:
- el código ilumina su fila y explica qué es;
- una fila ilumina su código y dice cuántas veces se ejecutó (y cuántas fue true o false);
- una ficha de la narración ilumina su fragmento.

**Mantener pulsado 1,2 s** cualquier elemento del diagrama (una fila, `true →`, `↓ false` o una ficha de su etiqueta) abre la **documentación** de lo que es. Es una página clásica, con texto y una animación de apoyo, que tapa el código. El tema sale del árbol y del catálogo (`motor/documentacion.js`): `IF`, `ELSE IF`, `FOR…OF`, `ARGUMENTO CON VALOR POR DEFECTO`, `MÉTODO DE LISTA · push`, `ORDEN DEL JUEGO · burstFire`… Por ahora cada página dice «TEMA: PLACEHOLDER» y un recuadro «ANIMACIÓN: PLACEHOLDER»; se irán llenando junto con las animaciones.

**El asa** entre el código y el diagrama se arrastra como el divisor del juego (horizontal apilado, vertical en el escritorio). En el extremo, el diagrama con su lenguaje natural ocupa toda la pantalla. Doble clic (o Intro) alterna entre eso y el reparto anterior, y el reparto se recuerda en el navegador.

**La barra** lleva una montaña nevada (ver el mundo: el mapa; la misma montaña que ahora usa todo el juego) y `</>` (el código normal). Fuera del juego, la montaña y `</>` son placeholders que vuelven al juego.

**No hay texto escrito para ningún programa.** Todo sale de tres fuentes:
- **el árbol del programa** (acorn), que da la forma del diagrama y las frases;
- **el catálogo del juego**, que dice qué significan `LAU_02.jammed` o `burstFire`;
- **la traza de una ejecución real**, que da los valores y el camino de cada vuelta.

Por eso explica cualquier código: los seis cafés, un `for…of` con una función, una recursión, el reto 5 grabado en el juego o lo que se escriba en «Tu código…».

Es un prototipo fuera del juego, como las infografías. No cambia el juego.

```text
1 drinkCoffee empieza en 0
2 ¿drinkCoffee es menor que 10?          false → Fin del bucle
    ↓ true
  3 Suma 1 a drinkCoffee
  4 ¿drinkCoffee vale 8?                  true → 5 break
    ↓ false
  6 ¿drinkCoffee vale 5?                  true → 7 continue
    ↓ false
  8 Imprime 'Café'                        (8 y 7 vuelven a 2)
```

## Uso

```bash
python3 -m http.server 8790        # desde la raíz del repo; abre /educational-animation/revision/?ej=cafes
node educational-animation/revision/grabar.mjs educational-animation/revision/ejemplos/cafes   # programa suelto, en Node
node educational-animation/revision/grabar.mjs educational-animation/revision/ejemplos/reto-5  # partida real del juego (puerto 8771)
node educational-animation/revision/pruebas/trazador.cjs
node educational-animation/revision/pruebas/flujo.cjs
node educational-animation/revision/pruebas/interfaz.mjs
node educational-animation/revision/pruebas/juego.mjs     # dentro del juego, puerto 8771
```

Ejemplos: `?ej=cafes`, `?ej=pares` y `?ej=reto-5`. «Tu código…» ejecuta en la página cualquier JavaScript con `console.log` y `await esperar(s)`, este último con un reloj virtual.

**Teclado y gestos:**
- ← → o deslizar en la narración: paso anterior o siguiente.
- Espacio o ▶: avanzar solo. Va despacio cuando una vuelta toma un camino distinto de la anterior y deprisa cuando se repite.
- Inicio y Fin: primer y último paso.
- `1` / `2`: cambiar de programa.
- Esc: cerrar la documentación o quitar el foco.
- En el asa: ↑ ↓ cambian el reparto; Inicio deja el diagrama a pantalla completa; Intro alterna.

**La franja de tiempo** tiene un tramo por vuelta del bucle principal. Cada tramo lleva el color de la primera fila de una rama (`if`/`else`) por la que pasó esa vuelta; las vueltas seguidas del mismo color se juntan y las que no entran en ninguna rama quedan en gris. Así se ve cuándo cambia el comportamiento. Tocar o arrastrar salta a esa vuelta. En el reto 5, ▲ rojo marca un atasco y ▲ verde, una reparación.

**Idioma:** el de la interfaz del juego, con su runtime de idiomas (`shared/i18n/i18n.js`) y la misma preferencia `cmg-interfaz-idioma`. No hay selector propio; si cambia, todo se traduce al momento (también la documentación abierta).

## Depurar una representación

**Depurar**, en la esquina inferior derecha del diagrama, abre una captura de solo lectura con **Copiar JSON** y **Descargar JSON** (`revision-debug.json`). Funciona en la página de ejemplos y dentro de War/Factory, con JavaScript y Python. Abrirla pausa el recorrido automático; cerrar con ✕ o Escape conserva el programa, el paso y la selección. Si el portapapeles no está disponible, selecciona el JSON para copiarlo manualmente; la descarga sigue disponible.

El informe `cmg-revision-debug`, versión 1, contiene:

- `entrada`: todos los programas de la revisión, con su fuente original completa (Python permanece Python), tabla de nodos, comentarios y eventos, además del contexto del reto o de la grabación. No incluye otros guardados del navegador.
- `salida[programa]`: filas con número, color, código original y rango UTF-16 `[a, b)`, etiqueta y frase de lectura; destinos `si`/`no`/`sig`, orden, salidas laterales, flechas de vuelta (`rieles`), secciones y recorrido. Los `Map` del recorrido se serializan como listas de pares; los `Set`, como listas. BigInt y números no finitos usan `{ "$": "bigint" | "number", "v": "…" }`.
- `contexto`: idioma, modo lectura/traza, programa, paso, foco, documentación, texto, velocidad y reparto actuales.
- `vista`: tamaño de pantalla, escala, desplazamiento y medidas de las filas del programa visible, HTML del diagrama con sus flechas SVG y narración actual. Es evidencia de presentación; no es una captura de píxeles ni un HTML autónomo.
- `motor`: URL y versión de los scripts y el CSS cargados del motor. Su código está en `educational-animation/revision/motor/`.

Un agente con acceso a la página puede leer la misma estructura sin abrir el diálogo:

```js
const informe = window.__revisionJuego.vista.depurar(); // dentro del juego
// const informe = window.__revision.depurar();        // página de ejemplos
JSON.stringify(informe, null, 2);
```

Cada llamada devuelve un objeto independiente; no mueve el recorrido ni ejecuta el programa. El JSON abierto en el diálogo permanece fijo hasta la próxima apertura, también si cambia el idioma. Para entregar el caso a otro agente, adjunta el archivo descargado o pega el JSON; no necesita acceso al localStorage del jugador.

Para reproducir y comparar el resultado con una versión nueva del motor, cargar sus dependencias en la página de revisión y volver a montar la entrada del informe (usar el origen de QA 8771):

```js
const informe = JSON.parse(textoDelArchivo, (_, v) => {
  if (v && v.$ === 'bigint') return BigInt(v.v);
  if (v && v.$ === 'number') return Number(v.v);
  return v;
});
CMGI18n.cambiarIdioma(informe.contexto.idioma);
// Destruir la vista anterior antes de reutilizar su raíz.
const vista = CMGRevision.montar(raiz, informe.entrada, informe.contexto);
vista.ir(informe.contexto.paso);
const foco = informe.contexto.foco;
if (foco && foco.id != null) vista.enfocar(foco.id, { deFila: foco.fila });
const resultadoActual = vista.depurar().salida;
// Comparar resultadoActual con informe.salida; conservar el caso como fixture de regresión.
```

La reproducción recalcula las filas y frases a partir del árbol original; para investigar cambios en el analizador, volver a leer también `entrada.programas[id].fuente` con acorn/lezer. Las medidas visuales se comparan usando el mismo ancho, escala y reparto del informe.

Prueba del informe con Ego Browser y el servidor de QA 8771 activo:

```bash
ego-browser nodejs <<'JS'
const task = await taskSpace('QA depuración revisión');
const { probarDepuracion } = await import('file:///Users/rubenmena/Documents/Dev/Code-battle-lite/educational-animation/revision/pruebas/depuracion.mjs');
console.log(await probarDepuracion(task.page('p1')));
await task.finish({ keep: [] });
JS
```

**Lo agendado en «Tu código».** `ejecutar.js` da al programa `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` y `queueMicrotask` propios. Los temporizadores son virtuales, sobre el mismo reloj que `esperar`, y corren por orden de tiempo cuando el programa no puede seguir solo. Nada queda vivo al devolver el resultado. En la traza, cada ejecución de un callback va entre `["corre"]` y `["/corre"]`, y lo que pasa tras el código principal, después de `["luego"]`. El recorrido da a cada ejecución su propio paso (`paso.diferido`).

**Casos sin navegador.** `node educational-animation/revision/pruebas/caso.cjs <programa.js | revision-debug.json> [--lectura|--traza] [--en]` imprime en texto comparable, para cada programa, sus filas (código, etiqueta, frase de lectura y destinos), la consola y la narración de cada paso. Con un `.js`, ejecuta el programa como «Tu código»; con un informe, vuelve a montar su `entrada`. Los ciclos de revisión entre agentes guardan cada caso en `pruebas/casos/<nn-nombre>/`, con su pregunta, su par mínimo, sus contraejemplos, las salidas y el registro de turnos, y lo convierten en regresión de `pruebas/flujo.cjs`.

## Python

`motor/python.js` (`CMGPythonRevision.leer`) lee un programa de Python con lezer (el analizador del editor, `shared/vendor/lezer-python-1.1.19.js`) y devuelve la misma tabla de nodos que el trazador da para JavaScript, con los tipos de acorn y las posiciones en el texto de Python. El diagrama, el recorrido, las tarjetas y la documentación son los mismos:
- la primera asignación de un nombre en su ámbito es una declaración; `if/elif/else` son `if` encadenados; `for … in` es `for…of`; `and`/`or`/`not` son `&&`/`||`/`!`; `None`/`True`/`False`, literales;
- la precedencia se rehace con la tabla de Python, porque lezer deja `not a and b` plano (como hace el traductor);
- los nombres del juego en Python (`auto_target`, `failure_rate`, `wait`, `print`) se buscan en el catálogo por su nombre de JavaScript (`CMGCatalogoRevision.desdePython`); el código se ve como está escrito;
- las frases dicen `None`, `True`, `False`, `print`, `elif`…, también en las flechas del diagrama y en los títulos de la documentación (`revision.doc.tema.<clave>.py`);
- lo que no tiene equivalente (clases, `import`, comprensiones) sale como sentencia o expresión con su código.

Solo se lee: el modo traza (con valores) sigue siendo solo de JavaScript. En la página, «Reto 5 · Python» y «Tu código» (JavaScript o Python).

## Dentro del juego

`Prototypes/Rocket Launcher/js/revision-juego.js` y `cmg.revision` en `juego.js` (los programas del reto, el elegido en el editor y el título):
- Los binoculares cargan el motor de esta carpeta (solo la primera vez), leen el código actual de cada lanzador (acorn para JavaScript, lezer para Python; sin ejecutar nada) y montan el recorrido de lectura a pantalla completa. Un error de sintaxis se avisa con su línea.
- Factory usa los mismos binoculares (y «Revisar» en el menú ⋯ del teléfono) con la serie `factory`: `pickUp`/`pick_up`, `deliver`, `count` y `wait` se explican con el catálogo del robot. Los pulsos de la batalla siguen siendo solo de War.
- El modo mapa/código/diagrama a la vez (la repetición del intento con fotos del mundo) se quitó: daba muchos problemas y el resultado era menos claro.

**Pulsos en el editor durante la partida** (`js/pulsos.js`). Mientras el programa corre, cada fragmento que actúa late con el color de su fila de este diagrama (una onda y un anillo, como la navegación de la bug tool): las lecturas del juego solo si dan algo (ni null ni false), las órdenes (no `regularShoot(null)`), la consola y las condiciones de `if` y `?:` solo cuando se cumplen; las de los bucles, nunca. El trazador instrumenta los programas de JavaScript con un filtro (solo esos ganchos: menos coste y mensajes de error limpios); la partida es la misma que sin él (`pruebas/juego.mjs` lo compara con la grabada). En Python (sin ganchos: corre traducido a JS) los mensajes del Worker traen la línea; con el lector de Python, en esa línea pulsa la llamada (`auto_target(…)`, `regular_shoot(…)`, `print(…)`) con el color de su fila.

**Catálogo.** El global del catálogo de esta carpeta es `CMGCatalogoRevision`: `CMGCatalogo` ya es el de la paleta del editor (`shared/editor/plantillas.js`) y cargarlo en el juego lo pisaba.

## Cómo funciona

```text
programa ──trazador.js──▶ programa con ganchos (mismas líneas) ──juego real (grabar.mjs) o ejecutar.js──▶ traza
programa ──flujo.js──▶ filas del diagrama (número, color, true/false, a dónde sigue cada una)
traza ──flujo.js──▶ pasos (una visita a una fila) y vueltas ──explicar.js + catalogo.js + textos.js──▶ frases ──revision.js──▶ pantalla
```

| Archivo | Qué hace |
|---|---|
| `motor/trazador.js` | Instrumenta el JavaScript por su árbol (acorn, el mismo del juego) sin mover líneas. Ganchos: sentencia (`s`), condición (`c`, también cada vuelta de `for…of` y de `lista.forEach(x => { … })`), valor (`v`) y espera (`w`). La línea en ejecución y los errores del juego siguen coincidiendo. |
| `grabar.mjs` | Con serie (`war`): ejecuta el juego real en Chromium con los programas instrumentados y **repite la partida sin traza con la misma semilla**. Falla si cambia el resultado o algún evento de alguna máquina. Sin serie: ejecuta el programa en Node con `ejecutar.js`, dos veces, y comprueba que la traza no cambia. |
| `motor/ejecutar.js` | Ejecuta un programa suelto con traza. Tiene un reloj virtual para `esperar(s)` y corta un programa que no termina a los 60 000 eventos o 3 s. |
| `motor/flujo.js` | Del árbol, las filas del diagrama: sentencias, decisiones con su salida lateral (`true → break`), bucles con su flecha de vuelta (`lista.forEach(x => { … })` es un bucle «por cada», como `for…of`), `else if` en cadena, `switch`, `try` y funciones como secciones aparte. De la traza, los pasos, las vueltas del bucle principal y su camino. Los valores de una recursión van a su llamada. |
| `motor/explicar.js` | Plantillas por tipo de nodo: la etiqueta de cada fila («¿drinkCoffee vale 8?», «Suma 1 a drinkCoffee»), la narración de cada paso con sus valores y la tarjeta «¿qué es?». |
| `motor/documentacion.js` | El tema de la documentación de cada elemento (`doc.tema.<clave>` en textos.js), para la pulsación larga. |
| `motor/catalogo.js` | Qué objetos, funciones y propiedades tiene el juego. **Es lo único que hay que ampliar** cuando aparece una máquina o un robot nuevo (abajo). |
| `motor/textos.js` | Todas las frases, en español e inglés, como catálogo de `CMGI18n` (claves `revision.*`). |
| `motor/revision.js`, `motor/revision.css` | La interfaz. |

## Añadir un objeto o un robot

Cada máquina se registra una vez en `motor/catalogo.js` y pone sus frases en `motor/textos.js`, en los dos idiomas. Desde ese momento, sus lecturas y órdenes salen en el diagrama, en la narración y en la tarjeta «¿qué es?». No hace falta tocar las plantillas.

```js
CMGCatalogoRevision.registrar({
  clave: "dron", patron: /^DRN_\d+$/, idDe: (n) => n.replace(/_/g, "-"),
  propiedades: { bateria: { tipo: "numero" } },
  metodos: { patrullar: { clase: "orden", args: [{}], resultados: ["ok"] } },
});
```

```js
'revision.cat.dron.nombre': 'dron explorador',
'revision.cat.dron.descripcion': 'Dron del jugador.',
'revision.cat.dron.bateria.que': 'La batería que le queda.',
'revision.cat.dron.patrullar.hace': 'Vuela en círculos por esa zona.',
'revision.cat.dron.patrullar.etiqueta': 'Patrulla {0}',          // la fila del diagrama: «Patrulla "norte"»
'revision.cat.dron.patrullar.arg0': 'la zona',
'revision.cat.dron.patrullar.resultado.ok': 'el dron sale a patrullar',
```

- `CMGCatalogoRevision.clavesDe(tipo)` dice qué claves necesita un tipo.
- `pruebas/flujo.cjs` comprueba que todas existen en español e inglés, con los mismos huecos, y registra este mismo dron.

Una propiedad booleana añade `si`, `no`, `pregunta` y `preguntaNo` («¿{s} está atascado?»). Un método que se usa dentro de una expresión puede añadir `corta`: el `autoTarget` de `pos` es solo «dron».

Ya están el lanzador (`LAU_xx`), el sensor de vibración (`VIB_xx`), `esperar`, `console` y el robot de Factory (`pickUp`, `deliver`, `count`, `wait` y sus nombres en español; `yo.` también; sin grabación de ejemplo).

## El reto 5

El programa de cada lanzador lee al otro como objeto:

```js
// Un solo reparador para LAU-01 y LAU-02
while (true) {
  const pos = autoTarget("drone", "visual")
    ?? autoTarget("stealth", "visual")
    ?? autoTarget("crawler", "visual")
  if (LAU_02.jammed) {
    // El reparador está ocupado
    regularShoot(pos)
  } else if (failureRate < 0.12) {
    burstFire(pos)
  } else {
    // Que baje el failureRate
    regularShoot(pos)
  }
  await esperar(0.25)
}
```

Con la semilla 1 gana: 31 de 31 derribados, 0 brechas y 2 atascos, en 146 vueltas de cada programa.
- **En la franja de LAU-01** se ven 19 vueltas seguidas del color de la fila 4 («Dispara normal a pos»): son las que vio a LAU-02 atascado.
- **En la de LAU-02** son 14.

Sin ese `if`, la misma semilla también gana, pero con 3 atascos. En un barrido de 12 semillas con la misma lógica, la regla dejó siempre 2 atascos y ninguna brecha; sin ella hubo 3 atascos en 9 de las 12.

## Límites y siguientes pasos

- **Python solo se lee.** El recorrido de lectura, el diagrama y los pulsos funcionan con Python; la traza con valores (`?modo=traza`) no, porque Python corre traducido a JS y el traductor no conserva columnas.
- **En el juego, solo War.** Falta unir este catálogo con `Prototypes/Rocket Launcher/js/proveedor.js`, que ya tiene nombres y firmas. Las fotos del mundo ocupan memoria (unas 730 en el reto 5); para partidas muy largas habría que espaciarlas.
- **Una vuelta = el bucle principal.** Los bucles anidados y las funciones se recorren paso a paso, pero la franja solo divide por el bucle de fuera.
- **Detalles sin resolver:**
  - En una llamada a una función propia, la narración del paso ya enseña lo que devolvió.
  - Una condición que llama recursivamente a su misma función puede mezclar los valores de sus operandos.
- **Revisión pendiente:** QA en un teléfono real y revisión humana de las frases en los dos idiomas.
