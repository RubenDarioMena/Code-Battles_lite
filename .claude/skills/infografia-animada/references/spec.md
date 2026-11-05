# Referencia de la spec (`concepto.js`)

```js
Infografia.montar('#infografia', SPEC, { teclado: 'documento' });
```

`index.html` se copia tal cual de cualquier ejemplo: carga `motor/infografia.css`, `motor/vendor/gsap-3.13.0.min.js`, `motor/infografia.js` y `concepto.js`.

## Nivel superior

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | Nombre de los archivos de salida. |
| `lenguajes` | `['js','py']` | El primero es el predeterminado; con dos aparece el selector JS/Python. |
| `titulo` | texto o `{js,py}` | La tesis. Admite `**b**`, `` `c` `` y `{{glosario}}`. |
| `insignia` | texto | Por defecto «Infografía». |
| `glosario` | `{ clave: texto o {js,py} }` | Amplía el de serie: `true false null and or not imprimir lenguaje`. Se usa como `{{clave}}` en cualquier texto, incluido el código. |
| `roles` | `{ id: tono }` | Color por papel. Se aplica a anclas del código, nodos, salidas, aristas, tarjetas y fichas con ese id. |
| `iconos` | `{ nombre: '<svg…>' }` | Se suman a los de serie `saltar parar ok no nada`. SVG con `stroke="currentColor"`. |
| `audio` | `'audio/{lang}/{n}.wav'` | Opcional. `{n}` = paso con dos cifras (01…). Si falta un clip, ese paso dura según su texto. |
| `escena` | objeto | `areas`, `columnas`, `filas` (cada uno `{horizontal, vertical}`) y `paneles`. |
| `pasos` | lista | Ver abajo. |

`areas.horizontal` / `areas.vertical`: lista de filas de `grid-template-areas`, por ejemplo `['codigo flujo', 'estado flujo']`. Los nombres son los `id` de los paneles (o su `area`). Un panel no nombrado en un formato se oculta en ese formato.

Tonos: `amarillo` (foco), `verde`, `rojo`, `azul`, `morado`, `cian`, `cobre`, `rosa`, `neutro`, y los alias `foco ok bad valor`.

Texto por lenguaje: cualquier valor puede ser `{ js: …, py: … }`.

## Paneles

**`codigo`**: `{ tipo:'codigo', id, fuente:{js,py}, archivo:{js,py}|false, numeros:true, tonos:{ancla:tono}, tamano: px | {horizontal, vertical}, interlineado: n | {formato}, cabecera: bool | {formato} }`

- `[[ancla|fragmento]]` marca un fragmento que los pasos pueden señalar (`marca`) o cuya línea pueden resaltar (`linea`). La misma ancla debe existir en JS y en Python. Si falta, el render lo avisa.
- El color del anillo y de la línea sale de `tonos` o de `roles[ancla]`.
- El resaltado de sintaxis usa los colores del editor del juego (`--tk-*`). Las ligaduras están desactivadas: `===` y `>=` se ven carácter a carácter.
- Para fragmentos largos (unas 10 líneas en vertical), baja `tamano` e `interlineado` en ese formato y usa `cabecera: { vertical: false }`. La hoja avisa si aún no cabe.

**`fichas`**: `{ tipo:'fichas', id, apilar: bool|{formato}, fichas:[{ id, etiqueta, valor, tono, foco }] }`

- `valor`: texto o `{ texto, tono, icono }`. Una ficha con `tono` (o rol) pinta su valor de ese color salvo que el valor traiga el suyo. `foco:true` la hace atenuable.

**`consola`**: `{ tipo:'consola', id, titulo }`. Las líneas llegan con `paso.consola`. El cursor parpadea según el tiempo de la línea (es determinista).

**`flujo`**: `{ tipo:'flujo', id, nodos, aristas, numerar:true, hueco:px, compacto: bool|{formato}, apretado: bool|{formato} }`

- `compacto` oculta los detalles de los nodos y `apretado` reduce su relleno. Usa detalles cortos en los nodos con `salida`, porque comparten fila con la etiqueta y la caja.

- Nodo: `{ id, titulo, detalle, tono, num, salida:{ id, texto, etiqueta, tono, tonoEtiqueta } }`. `salida` añade a la derecha `etiqueta → caja`, por ejemplo `{{false}} → Fin del bucle`.
- Entre nodos consecutivos siempre hay un conector neutro. Para encenderlo o etiquetarlo, declara `{ id, de, a, etiqueta, tono }`.
- `{ id, de, a, tipo:'vuelta', carril:0|1 }` dibuja una vuelta atrás por la izquierda. Usa carriles distintos para no pisar dos vueltas (fin del cuerpo y `continue`).

**`fila`**: `{ tipo:'fila', id, items:[{ id, titulo, detalle, nota, tono, tonoDetalle }], columnas: n|{formato}, lista:bool, estilo:'vueltas', titulo }`

- Sirve para el catálogo de tarjetas, la lista de ejemplos (`lista:true`) o las vueltas de un bucle (`estilo:'vueltas'`, una casilla por iteración).
- `detalle` es un valor (texto u `{icono, texto, tono}`) que se puede cambiar con `valores` usando el id del ítem.

**`expresion`**: `{ tipo:'expresion', id, partes:[{ id, texto, tipo:'chip'|'op'|'flecha'|'texto', tono }], nota }`. Las partes con `id` aceptan `valores`.

**`html`**: `{ tipo:'html', id, html, caja:bool }`. Es una vía de escape. `data-id` + `data-foco` lo hacen atenuable, `data-valor="id"` lo hace cambiable y `data-tono` le da color.

## Pasos

```js
{
  texto: '**Condición.** `3 > 0`{amarillo} es `{{true}}`.', // narración = subtítulo = voz
  foco: ['cond', 'e-true'],    // en cada grupo (panel) tocado quedan encendidos EXACTAMENTE estos
  apagar: ['x'],               // apaga sin tocar el resto del grupo
  hecho: ['v1'],               // acumulativo: queda a plena luz, sin borde de color
  marca: ['cond'],             // anillos en el código (varios a la vez, cada uno de su color)
  linea: 'cond',               // ancla o número (o lista); null quita la línea
  valores: { 'v-x': '3', 'v-c': { texto: '3 > 0 ✓', tono: 'verde' },
             'v-n': [{ texto: '1', en: 0.4 }, { texto: '2', en: 1.5 }] },  // lista = secuencia dentro del paso
  consola: ['Quedan 3', { texto: 'Quedan 2', en: 1.2 }],
  mostrar: ['res'], ocultar: ['tmp'],  // un id que aparece en algún mostrar empieza oculto
  pregunta: { opciones: ['`A`', '`B`'], correcta: 1, etiqueta: 'Predice', sobre: 'vueltas', posicion: 'abajo' },
  duracion: 6,                 // opcional; si no, sale del audio o del texto
}
```

- `foco`, `marca` y `linea` persisten hasta que otro paso los cambie. `marca: null` y `linea: null` los quitan.
- `en` es el desfase en segundos desde el inicio del paso. Sin `en`: valores a +0,22 s y +0,6 s por elemento; consola a +0,32 s. La duración del paso se alarga para que quepan.
- Con `pregunta`: tras la narración hay 3,2 s para pensar y luego se revela la correcta (2,2 s). En el reproductor, el auto-avance se detiene hasta que se responde. ▶ salta la pregunta.
- La pregunta tapa toda la escena por abajo, salvo que uses `sobre: '<panel>'`: entonces cubre solo ese panel (`posicion: 'arriba'|'abajo'`). Elige un panel que no haga falta para responder y escribe opciones cortas (2–3 palabras) para que quepan en una fila.

## Parámetros de URL

`?lang=js|py` · `?formato=horizontal|vertical|auto` · `?paso=4` (abre en pausa en ese paso) · `?auto=0` (sin auto-avance) · `?modo=video` (lo usa el render) · `?seguro=1` (márgenes de redes en vertical).

## API en la página (`window.__infografia`)

`listo` (promesa) · `info()` (tiempos, textos, avisos) · `seek(t)` · `irA(i)` · `reproducir()` · `pausar()` · `cambiarLenguaje(l)` · `paso` · `avisos`.

## Render

```bash
cd educational-animation
node infografias/render.mjs infografias/ejemplos/<concepto> --hoja      # PNG de revisión ×4 + chequeo de desbordes
node infografias/render.mjs infografias/ejemplos/<concepto>             # 4 MP4 + .vtt + .json
node infografias/render.mjs <carpeta> --lang py --formato vertical --seguro --fps 30 --salida <dir>
```

Requiere `playwright` (o `--chrome <ruta>` con `playwright-core`) y `ffmpeg`. Si hay avisos, el render falla salvo con `--permitir-avisos`.
