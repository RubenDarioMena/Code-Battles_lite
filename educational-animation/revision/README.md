# Modo revisión · prototipo

La pantalla se parte en dos:
- **el código**, que no se edita;
- **el mismo programa como diagrama de flujo**, al estilo de la infografía de los seis cafés, y una línea que cuenta el paso actual con los valores reales.

En el teléfono van apilados (código arriba, diagrama abajo); en el escritorio, uno al lado del otro (código a la izquierda, diagrama y narración a la derecha, franja de tiempo abajo de borde a borde).

**En el juego** (War, JavaScript) se abre con los binoculares de la barra del mapa: repite el último intento con la misma semilla y los programas instrumentados, y lo explica. En el escritorio, el botón «junto» apila código y diagrama en el panel del código y deja el mapa en su sitio: el mapa sigue al paso, así que código, diagrama y mundo se reproducen a la vez (abajo, «Dentro del juego»).

Cada fila del diagrama tiene **número y color propios**, como cada campo de un formulario que ilumina su parte del texto generado. El número y el color se repiten en el margen del código y en la franja de tiempo. Al recorrer el programa, la fila activa y su fragmento de código se iluminan juntos. Tocar, o señalar con el ratón, cualquier cosa de un lado ilumina su pareja en el otro:
- el código ilumina su fila y explica qué es;
- una fila ilumina su código y dice cuántas veces se ejecutó (y cuántas fue true o false);
- una ficha de la narración ilumina su fragmento.

**Mantener pulsado 1,2 s** cualquier elemento del diagrama (una fila, `true →`, `↓ false` o una ficha de su etiqueta) abre la **documentación** de lo que es. Es una página clásica, con texto y una animación de apoyo, que tapa el código. El tema sale del árbol y del catálogo (`motor/documentacion.js`): `IF`, `ELSE IF`, `FOR…OF`, `ARGUMENTO CON VALOR POR DEFECTO`, `MÉTODO DE LISTA · push`, `ORDEN DEL JUEGO · burstFire`… Por ahora cada página dice «TEMA: PLACEHOLDER» y un recuadro «ANIMACIÓN: PLACEHOLDER»; se irán llenando junto con las animaciones.

**El asa** entre el código y el diagrama se arrastra como el divisor del juego (horizontal apilado, vertical en el escritorio). En el extremo, el diagrama con su lenguaje natural ocupa toda la pantalla. Doble clic (o Intro) alterna entre eso y el reparto anterior, y el reparto se recuerda en el navegador.

**La barra** lleva una montaña nevada (ver el mundo: el mapa) y `</>` (el código normal); en el escritorio del juego, también «junto». Fuera del juego, la montaña y `</>` son placeholders que vuelven al juego.

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

## Dentro del juego

`Prototypes/Rocket Launcher/js/revision-juego.js` y unos ganchos en `juego.js` (`cmg.revision`):
1. Al terminar un intento de War, el juego guarda sus programas, su semilla y su resultado.
2. Los binoculares cargan el motor de esta carpeta (solo la primera vez), instrumentan los programas con el trazador y **repiten el intento** a velocidad turbo, sin contarlo como intento. El juego guarda la traza y **una foto del mundo por paso** (0,05 s).
3. La revisión se monta con esa grabación y comprueba que la partida es la misma que la del intento. La traza es idéntica a la de `grabar.mjs`.
4. Al cambiar de paso, el mapa enseña la foto de ese instante (`cmg.revision.ver`); al salir, el mundo vuelve al final del intento. Ejecutar, Reiniciar o cambiar de reto cierran la revisión.

**Al compás de la partida.** Con el mapa al lado, ▶ avanza como un juego de programar: mientras el programa corre, el mundo está quieto y se leen sus pasos (deprisa si la vuelta repite el camino de la anterior); mientras espera (`await esperar`), el mundo se mueve a velocidad de juego hasta el paso siguiente. El botón 1× cambia la velocidad (½×, 1×, 2×, 4×).

Python y Factory todavía no: los binoculares lo avisan.

## Cómo funciona

```text
programa ──trazador.js──▶ programa con ganchos (mismas líneas) ──juego real (grabar.mjs) o ejecutar.js──▶ traza
programa ──flujo.js──▶ filas del diagrama (número, color, true/false, a dónde sigue cada una)
traza ──flujo.js──▶ pasos (una visita a una fila) y vueltas ──explicar.js + catalogo.js + textos.js──▶ frases ──revision.js──▶ pantalla
```

| Archivo | Qué hace |
|---|---|
| `motor/trazador.js` | Instrumenta el JavaScript por su árbol (acorn, el mismo del juego) sin mover líneas. Ganchos: sentencia (`s`), condición (`c`, también cada vuelta de `for…of`), valor (`v`) y espera (`w`). La línea en ejecución y los errores del juego siguen coincidiendo. |
| `grabar.mjs` | Con serie (`war`): ejecuta el juego real en Chromium con los programas instrumentados y **repite la partida sin traza con la misma semilla**. Falla si cambia el resultado o algún evento de alguna máquina. Sin serie: ejecuta el programa en Node con `ejecutar.js`, dos veces, y comprueba que la traza no cambia. |
| `motor/ejecutar.js` | Ejecuta un programa suelto con traza. Tiene un reloj virtual para `esperar(s)` y corta un programa que no termina a los 60 000 eventos o 3 s. |
| `motor/flujo.js` | Del árbol, las filas del diagrama: sentencias, decisiones con su salida lateral (`true → break`), bucles con su flecha de vuelta, `else if` en cadena, `switch`, `try` y funciones como secciones aparte. De la traza, los pasos, las vueltas del bucle principal y su camino. Los valores de una recursión van a su llamada. |
| `motor/explicar.js` | Plantillas por tipo de nodo: la etiqueta de cada fila («¿drinkCoffee vale 8?», «Suma 1 a drinkCoffee»), la narración de cada paso con sus valores y la tarjeta «¿qué es?». |
| `motor/documentacion.js` | El tema de la documentación de cada elemento (`doc.tema.<clave>` en textos.js), para la pulsación larga. |
| `motor/catalogo.js` | Qué objetos, funciones y propiedades tiene el juego. **Es lo único que hay que ampliar** cuando aparece una máquina o un robot nuevo (abajo). |
| `motor/textos.js` | Todas las frases, en español e inglés, como catálogo de `CMGI18n` (claves `revision.*`). |
| `motor/revision.js`, `motor/revision.css` | La interfaz. |

## Añadir un objeto o un robot

Cada máquina se registra una vez en `motor/catalogo.js` y pone sus frases en `motor/textos.js`, en los dos idiomas. Desde ese momento, sus lecturas y órdenes salen en el diagrama, en la narración y en la tarjeta «¿qué es?». No hace falta tocar las plantillas.

```js
CMGCatalogo.registrar({
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

- `CMGCatalogo.clavesDe(tipo)` dice qué claves necesita un tipo.
- `pruebas/flujo.cjs` comprueba que todas existen en español e inglés, con los mismos huecos, y registra este mismo dron.

Una propiedad booleana añade `si`, `no`, `pregunta` y `preguntaNo` («¿{s} está atascado?»). Un método que se usa dentro de una expresión puede añadir `corta`: el `autoTarget` de `pos` es solo «dron».

Ya están el lanzador (`LAU_xx`), el sensor de vibración (`VIB_xx`), `esperar`, `console` y el robot de Factory (`yo`, sin grabación de ejemplo).

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

- **Solo JavaScript.** Python se ejecuta en el juego traducido a JS con las mismas líneas. Para Python harían falta dos cosas:
  - el diagrama, sacado del árbol de lezer que ya usa el editor, porque el JS traducido lleva auxiliares `__py.*`;
  - que el traductor conserve las columnas, para que el resaltado llegue a expresiones y no solo a líneas.

  Las etiquetas del diagrama ya son lenguaje natural, sin sintaxis de JS, así que valen para los dos.
- **En el juego, solo War y JavaScript.** Falta unir este catálogo con `Prototypes/Rocket Launcher/js/proveedor.js`, que ya tiene nombres y firmas. Las fotos del mundo ocupan memoria (unas 730 en el reto 5); para partidas muy largas habría que espaciarlas.
- **Una vuelta = el bucle principal.** Los bucles anidados y las funciones se recorren paso a paso, pero la franja solo divide por el bucle de fuera.
- **Detalles sin resolver:**
  - En una llamada a una función propia, la narración del paso ya enseña lo que devolvió.
  - Una condición que llama recursivamente a su misma función puede mezclar los valores de sus operandos.
- **Revisión pendiente:** QA en un teléfono real y revisión humana de las frases en los dos idiomas.
