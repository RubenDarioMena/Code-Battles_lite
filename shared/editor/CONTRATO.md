# Contrato del editor · E0

Base de E0: `trunk` en `dfa5f33`. E1 implementa `CMGEditor.crear` y traslada las interfaces a fábricas compartidas. La integración del juego conserva `window.cmg`, `cmg.edicion` y `cmg.seudo`. Las secciones de inventario E0 de este documento se conservan como referencia del traslado; la interfaz vigente se describe a continuación.

## Instancia vigente (E1)

`CMGEditor.crear({ raiz, documento, adaptadores, proveedor?, preferencias?, alCambiar?, alAviso?, soloLectura? })` crea el marcado dentro de una raíz libre. Devuelve `abrir`, `documento`, `insertar`, `marcas`, `irALinea`, `modoSinTeclado`, `refrescar` y `destruir`. `documento()` entrega una copia; texto original y revisión son la fuente de verdad. La revisión crece al editar y al cambiar de documento, para que `marcas(revision, lista)` no acepte diagnósticos de otro documento con la misma revisión antigua.

El anfitrión llama a `refrescar()` cuando cambian solo lectura o datos de la paleta. Los cambios del textarea se emiten a `alCambiar` y forman parte del historial. `abrir` cambia el documento sin escribir en el almacenamiento. Sin preferencias inyectadas, la instancia conserva sus preferencias en memoria durante su vida.

Las interfaces viven en `edicion.js`, `seudo.js` y `nucleo-ui.js`, dentro de esta carpeta. El adaptador JS, las plantillas y las teclas se cargan también desde aquí. Los tokens y estilos comunes viven en `tema.css`, `editor.css` y `shared/css/edicion.css`. No hay copias del editor para cada anfitrión.

La extensión de integración `adoptar`, `elemento`, `ambito` y `app` conserva IDs, controles y botones del juego. El componente crea sus nodos de edición y conserva los nodos propios del anfitrión con sus oyentes. Las nuevas instancias autónomas reciben IDs únicos y sus consultas y atajos se limitan a su raíz. Las extensiones `serie`, `datos`, `inicial`, `preferenciasVistas`, `aplazarVistas` e `iniciarVistas()` permiten mantener las vistas heredadas sin acceder a globals del juego desde el editor. La fachada por instancia está disponible en `editor.fachada`; solo la integración del juego la conecta a `window.cmg`.

`destruir()` es idempotente: aborta oyentes, cancela timers/RAF y microtareas pendientes, desconecta observers y retira nodos auxiliares. Las lecturas asíncronas del portapapeles comprueban si la instancia sigue viva. Cada instancia tiene su documento, selección, historial, portapapeles, menús y preferencias propios. No hay ejecución, traductor ni Worker dentro de la instancia.

Para mantener ambos anfitriones: corregir el módulo de `shared/editor/` correspondiente, ejecutar las suites del juego y de la demo y aumentar su `?v=` en las dos entradas si cambia un recurso ya publicado. Una versión nueva del editor no se copia al juego: ambos cargan el mismo archivo.

## Límites de responsabilidad

### Superficie CodeMirror (rama de evaluación)

Las entradas del juego y la demo cargan `shared/vendor/codemirror/codemirror.min.js`, `codemirror.js` y `codemirror.css`. La superficie editable es `.cm-content`. `codigo` sigue siendo el textarea real, oculto y fuera de tabulación/lectores de pantalla, como puerto para `value`, `readOnly`, `setSelectionRange`, `focus`, `blur`, desplazamiento y eventos del anfitrión. El puente modifica únicamente propiedades de esa instancia y las restaura al destruirse; no modifica prototipos.

No se debe consultar la geometría ni comparar el foco DOM con ese puerto oculto. La fachada ofrece `tieneFoco()` y `motorTexto` (`rect`, `rects`, `posicion`, `scroll`, `mostrar`). El ProtoMouse, las sugerencias, el layout del teléfono y los pulsos usan esas consultas. La escritura real emite `input` hacia el puerto; asignar `value` desde el anfitrión conserva la semántica anterior y necesita su evento explícito cuando sea una edición.

El historial sigue siendo el de `edicion.js`, compartido con botones, documentos y selecciones múltiples; no hay otro historial CodeMirror. La composición del teclado queda en manos del motor. Se mantienen las vistas de fichas/Seudo/Bloques; el plegado solo se presenta en la superficie CodeMirror y nunca elimina texto. `irALinea` expande el rango oculto al que se navega. `motorTexto: "textarea"` o la query `editor=textarea` permiten comparar con la superficie anterior.

Los diagnósticos de CodeMirror son de sintaxis: Acorn con las opciones del juego para JS y Lezer para Python, con la excepción conocida de `yield` sin valor. Las restricciones del traductor Python y los errores del runtime conservan su validación propia. La dependencia se prepara con `npm ci && npm run build` dentro de `herramientas/codemirror/`; jugar no necesita npm ni red. Versiones transitivas, integridad y licencias están fijadas. QA y límites: `docs/CODEMIRROR-QA.md`; suite: `node pruebas/codemirror.cjs` con el servidor dedicado 8771.

El editor mantiene texto original, selección, historial y presentación. El anfitrión decide qué documento abrir, cuándo bloquearlo, cómo guardarlo y cómo ejecutarlo. El adaptador conoce la sintaxis y las operaciones del lenguaje. El proveedor aporta nombres, funciones y sugerencias del proyecto. La instrumentación, el traductor y el Worker pertenecen al juego.

Los nombres Python y la espera explícita se describen en [D1/D2](../../docs/EDITOR-D1-D2.md). No son el contrato de ciclo de vida de una instancia del editor.

## Inventario original de E0 (antes del traslado de E1)

| Archivo | Responsabilidad y dependencias actuales |
| --- | --- |
| `shared/editor/javascript.js` | Léxico JS, huecos, selección por delimitadores, envolturas, plantillas y operadores. Recibe un puerto de texto, inserción, aviso, escape HTML y acceso diferido a la estructura. Sin DOM, almacenamiento ni runtime. |
| `shared/js/estructura.js` | Analizador tolerante y consultas estructurales; recibe texto y fichas. Publica `window.ESTRUCTURA`. |
| `shared/js/edicion.js` | Fichas, asas, arrastre, selección, historial y barra. Depende de `cmg`, `ESTRUCTURA`, IDs globales, eventos de document/window, viewport y preferencias. |
| `Prototypes/Rocket Launcher/js/juego.js` | Crea la fachada `cmg`, inserta en el textarea, mide/resalta el texto, sincroniza programas, propone valores y gestiona estado y marcas. |
| `Prototypes/Rocket Launcher/js/paleta.js` | Catálogo de atajos de War y variantes, con sensor resuelto por callback. Cada creación devuelve una lista nueva. La sustitución por atajos Factory sigue en `juego.js`. |
| `Prototypes/Rocket Launcher/js/programas.js` | Aplica borradores Add/Replace a unidades del juego. Recibe estado, confirmación y notificación de aplicación. No pertenece al componente reutilizable. |
| `Prototypes/Rocket Launcher/js/layout.js` | Barra `TECLAS`, inserción de símbolos, distribución, teclado, preferencias y tooltips. |
| `Prototypes/Rocket Launcher/js/seudo.js` | Seudo/Bloques: árbol y vuelta a JS, DOM, preferencias e importación del banco antiguo. Habla con `cmg`. |
| `Prototypes/Rocket Launcher/js/proveedor.js` | Descriptores de funciones, vocabulario y alias D1. Las sugerencias todavía se obtienen mediante `cmg.sugerencias`. |

## Coordenadas y resultados

- Todos los offsets usan índices UTF-16 de `String`/textarea. Los rangos son `[a, b)`, con `b` excluido, y pertenecen al texto que se analizó.
- La estructura numera líneas desde **0**. La banda de ejecución, los errores y `irALinea` del juego usan líneas desde **1**. No se intercambian sin convertir.
- El texto es la fuente de verdad. No se guarda el árbol tolerante: contiene relaciones `padre` y mapas, y se invalida al cambiar el texto.
- `null` indica que no hay selección/contexto/destino aplicable. Desenvolver puede devolver `{ motivo }` sin cambiar texto. Una operación de inserción devuelve `false` si el puerto está en solo lectura.

## Primitivas JavaScript cargadas en E0

```js
const { NOMBRES_HUECO, HUECO, RE_HUECO, lexico } = window.CMGEditorJS;
const operaciones = CMGEditorJS.crearEdicion({
  codigo,                     // { value, readOnly, selectionStart, selectionEnd, setSelectionRange(a,b) }
  insertar,                   // (texto, sa?, sb?) => bool; selección relativa al inicio insertado
  aviso,                      // (html) => void
  escapar,                    // (texto) => html seguro
  estructura,                 // () => ESTRUCTURA | undefined; acceso diferido por el orden actual de scripts
});
```

`lexico(src)` devuelve pares `[tipo, texto]` que, concatenados, reproducen exactamente `src`: `id`, `num`, `str`, `com`, `esp`, `nl`, `p`. Los signos se entregan uno a uno; palabras clave y funciones se clasifican después. `HUECO` reconoce un comentario completo; `RE_HUECO` encuentra el primer hueco dentro de un texto. Ninguno lleva flag `g`.

`operaciones` contiene `rangoCodigo(pos, triple)`, `envolver(antes, despues, bloque?)`, `expresionEnvolvible()`, `elegirLineasCompletas()`, `insertarBloque(texto, envolvente?)` e `insertarOperador(descriptor)`. Conservan el comportamiento de las funciones anteriores de `juego.js`, incluida sangría de dos espacios, selección del siguiente hueco y rechazo de operandos no representables.

El módulo no registra oyentes ni crea nodos. Las referencias al puerto y callbacks duran mientras el anfitrión conserve `operaciones`; las instancias no comparten selección ni texto. No es aún el adaptador JS completo de E1: clasificación, comentarios, teclas y catálogo de plantillas siguen repartidos como indica la tabla anterior.

## Estructura que consume la edición

La firma real es `ESTRUCTURA.analizar(src, fichas)`, no `analizar(src)` todavía. Devuelve `{ src, todas, sig, par, nodos, raiz, duenos, hojas, lineas }`. Las fichas posicionadas tienen `{ k, v, a, b }`; `sig` omite espacios/comentarios salvo huecos y combina operadores. Los nodos tienen al menos `{ k, a, b, h }`, con `padre` y campos según construcción; la edición usa también `args`, `cond`, `nombre`, `op`, `sel` y las ramas del árbol. E1 deberá envolver esta firma si ofrece `adaptador.estructura.analizar(src)`.

| Método actual | Resultado |
| --- | --- |
| `atomo(est, pos)` | `[a,b]` del elemento bajo el cursor, o `null`. |
| `ampliar(est, a, b)` | Siguiente rango semántico mayor, o `null`. |
| `unidadLinea(est, l)` | Líneas completas de la sentencia, con salto final cuando existe. |
| `fronteraValida(est, l)` | Si se puede soltar una línea antes de `l` sin partir una construcción. |
| `contexto(est, a, b)` | `{ nodo, tipo, funcion, objeto, indice, total, hueco, vacio, hoja, binaria? }`, o `null`. `tipo`: argumento, elemento, condicion, valor, hueco o `null`. |
| `destino(est, pos)` | `{ tipo: "reemplazar"|"insertar", a, b, vacio?, lista? }`, o `null`. |
| `enLista(src, a, b, valor)` | Texto de inserción con espacios/comas necesarios. |
| `lineaDe(est, pos)` | Índice de línea desde 0. |
| `inicioLinea(est, l)` / `finLinea(est, l)` | Offsets; el fin no incluye el salto. |
| `fichaEn(est, pos)` | Ficha posicionada, o `null`. |
| `desenvolver(est, a, b)` | `{ a, b, texto, sel: [sa,sb] }`, con selección absoluta tras reemplazar, o `{ motivo }`. |

Estas consultas toleran texto incompleto. El árbol no es un validador de programas ejecutables ni un árbol de Python.

## Fachada real `window.cmg`

| Parte | Contrato consumido hoy |
| --- | --- |
| Texto | `codigo`: textarea vivo. `insertar(texto, sa?, sb?)` sustituye selección y emite `input`; `envolver(...)`, `alternarComentario()`, `medirEditor()`. |
| Lenguaje/proyecto | `lexico(src)`, `clasificar(fichas,i)`, `reHueco`, `firma(nombre) → string[]|null`, `funciones() → descriptor[]`, `proveedor`. |
| Sugerencias | `sugerencias({ tipo, funcion, objeto, indice, hueco, variables }) → { titulo, donde?, grupos }|null`. Cada grupo: `{ titulo?, items }`; cada item: `{ ins, cls?, nota?, ver? }`. |
| Estado | `claveDocumento`: clave por reto/unidades/borrador; `ejecutando`: booleano. El textarea también refleja `readOnly`. `prefijoUI` es opcional para edición. |
| Avisos y acciones | `aviso(html)`, `alDesplazar()`, `alternarEjecucion()`. El anfitrión mantiene el significado de ejecutar. |
| Seudo/Bloques | `serie`, `datos()` (lugares/materiales/ladrillos/tipos/sensores/red/otras), `inicial() → {texto,codigo}|null`, `marcas → {corre,err}`. |
| Historial extensible | `capturarDocumento()` / `restaurarDocumento(valor)` son opcionales en `edicion.js`; el juego actual usa el texto como captura. |
| Integración externa | `confirmarReplace`, `camara()`, `retrato()` pertenecen al juego/layout, no al editor extraído. |

`cmg.edicion` expone `activo`, `activar(bool)`, `elegir(a,b,opciones?)`, `ampliar`, `reducir`, `deshacer`, `rehacer`, `copiar`, `pegar`, `borrar`, `duplicar`, `moverLineas`, `lineaNueva`, `desenvolver` y `portapapeles`.

`cmg.seudo` expone `activo`, `accion(id)`, `aplicarModo(modo)`, `generar`, `parsear` y `modelo`. Seudo y Bloques siguen escribiendo JS. Se preservan estas fachadas al extraer; no se convierten en una segunda fuente de documentos.

## Eventos, preferencias y DOM por trasladar en E1

Sobre el textarea: `input` actualiza/guarda texto; `cmg:documento` con `detail.clave` cambia historial; `cmg:estado` refresca solo lectura; `cmg:marcas` repinta marcas; `cmg:medido` anuncia medición. Edición escucha además `cmg:sincronizado` para sincronías sin nuevo paso de historial. Seudo emite `cmg:modo` en `#app`.

El historial actual mantiene hasta 200 capturas por documento, agrupa tecleo seguido con menos de 1200 ms y descarta rehacer al editar. Un cambio de documento conserva su historial cuando coincide su último texto.

Edición usa `cmg-juego-` por defecto (o `cmg.prefijoUI`) para `asa`, `sin-teclado` y `barra`. Layout guarda sus propias preferencias con ese prefijo. Seudo usa `cmg-juego-` o `cmg-juego-factory-` y lee `cmg-banco02:*` solo para importar. E1 deberá inyectar preferencias y conservar las claves en la integración del juego; sin persistencia, la instancia debe durar la sesión.

IDs actuales que hay que encapsular: `app`, `editor`, `codigo`, `gutter`, `banda`, `espejo`, `resaltado`, `bloques`, `bloques-in`, `bloques-texto`, `bloques-capa`, `asas`, `asas-in`, `edicion`, `paleta`, `simbolos`, `prog`, `paleta-seudo`, más los diálogos y controles de preferencias. CSS del editor usa tokens de `css/base.css`. Existen oyentes globales de teclado/puntero, observers, temporizadores y menús añadidos a body. Todavía no hay `destruir()`; E1 debe retirarlos sin afectar otras instancias.

## Diseño previsto durante E0 (implementado arriba)

`CMGEditor.crear({ raiz, documento, adaptadores, proveedor?, preferencias?, alCambiar?, alAviso?, soloLectura? })` creará su marcado dentro de `raiz`. Documento: `{ id, lenguaje, texto, revision }`.

La instancia ofrecerá `abrir`, `documento`, `insertar`, `marcas(revision, marcas)`, `irALinea`, `modoSinTeclado` y `destruir`. La revisión crecerá al editar; marcas de revisiones antiguas se descartarán. No se fingirá revisión actual leyendo un JS generado. `destruir` deberá liberar oyentes, observers, tareas pendientes y nodos auxiliares de esa instancia. La prueba de aislamiento de dos interfaces está en `pruebas/editor-demo.mjs` (E2).

## Red de pruebas y referencia

`pruebas/interaccion.cjs` carga módulos completos de producción con `vm`, inyecta solo el puerto de texto y colaboradores del anfitrión, y mantiene las 123 expectativas existentes. No lee ni corta `juego.js`. `pruebas/editor-contrato.cjs` comprueba carga sin globals del juego, aislamiento de puertos/paletas y confirmaciones asíncronas de Add/Replace.

La [referencia de suites](REFERENCIA-E0.json) distingue cifras históricas del commit base y resultados ejecutados en esta entrega. Las suites de navegador y las capturas no se consideran verificadas por pasar las pruebas sin DOM. Antes de cerrar la compuerta completa de E0, confirmar War 90, editor Factory 18, vistas 31, paridad 28/28 y API 7 en el origen dedicado 8771, y comparar capturas PC/móvil.


## Demo vigente (E2)

`shared/editor/demo.html` crea dos instancias con el mismo adaptador y un proveedor declarativo, sin `window.cmg`, `__banco` ni runtime. Los documentos, historiales, menús, selección, atajos y preferencias pertenecen a cada instancia. La recreación retira la instancia anterior antes de montar otra. Las preferencias y documentos de la demo se guardan en Maps del anfitrión durante la sesión; el componente no necesita almacenamiento.

La portada enlaza la demo en el footer. Los recursos JS/CSS de las dos entradas apuntan a los mismos archivos compartidos. La suite `pruebas/editor-demo.mjs` cubre aislamiento, ciclo de vida, solo lectura, marcas y edición sin proveedor; las suites del juego cubren su integración con ese mismo editor.

## Paridad y pantalla completa (E2.1)

**Anfitrión.** El componente añade la clase `cmg-anfitrion` al elemento que lleva `data-forma`, `data-modo` y `data-sin-teclado`: la `.app` del juego (`opciones.app`) o la raíz de una instancia autónoma. Las reglas por forma de la paleta, la barra de edición y el seudocódigo están una sola vez en `shared/css/edicion.css` con ese selector; `layout.css` del juego ya no las repite. Su especificidad es la misma que tenían con `.app`.

**Forma.** En el juego la sigue decidiendo `layout.js`. Una instancia autónoma usa `opciones.forma` (`"movil"` o `"escritorio"`) o la deduce: el criterio de ventana del juego (menos de 760 px, o menos de 1000 px en vertical), más el teléfono en horizontal (puntero táctil y lado menor de menos de 500 px) y una raíz de menos de 340 px. `editor.forma()` la devuelve. En PC la barra de edición solo aparece sin teclado o en Seudo; en el teléfono siempre, con la paleta compacta, y la barra de símbolos mientras el textarea tiene el foco (`data-escribiendo`).

**Interfaz autónoma.** Las instancias autónomas montan las herramientas que el juego tiene en su propia cabecera: JS/Seudo, modo sin teclado, A−/A+ (12, 13, 14, 16 y 18 px; preferencia `letra` del anfitrión), Ajustes del editor (asa de líneas y orden de la barra) y pantalla completa. En modo `adoptar` nada de esto se crea: el juego conserva sus botones.

**Tooltips.** `shared/editor/tips.js` (`CMGTips`) es el tooltip de la página que antes vivía en `layout.js`. El juego lo crea con su `#tip`; las instancias autónomas comparten uno con `adquirir()`, y la última en destruirse lo retira. La paleta y el menú de variantes se buscan dentro del `.cmg-editor` del elemento.

**Pantalla completa.** `editor.pantallaCompleta(si?)` (solo autónomas; en el juego devuelve `false`) y el botón de las cuatro esquinas. La raíz pasa a `position: fixed` sobre el viewport visual (se ajusta al abrirse el teclado del teléfono), con `z-index: 70`, por debajo de tooltips, menús y hojas. El documento queda sin desplazamiento (`data-cmg-pantalla` en `<html>`). Además se pide la pantalla completa del navegador sobre `<html>` cuando existe y `opciones.pantallaNavegador !== false`; en iPhone queda solo la del editor. Salen el botón, Esc (si no lo usaron sugerencias, variantes o la selección del modo sin teclado), el Esc propio del navegador y `destruir()`. Una petición del navegador que llega después de salir se suelta. `opciones.alPantallaCompleta(si)` avisa al anfitrión. Es distinta del modo pantalla completa del juego, que reparte la ventana entre mapa y código.

## Lenguaje del documento (E3)

**Lenguajes del editor y del anfitrión.** El editor sabe editar los lenguajes cuyos adaptadores recibe. No los ejecuta. El juego traduce a JS para su Worker; otra aplicación puede usar su propio motor. `CMGLenguajes.catalogo` (en `lenguajes.js`) solo guarda nombre, abreviatura, extensión y comentario de los lenguajes de este proyecto: `js` y `python` (Python todavía sin adaptador). `describir(id, adaptador)` usa el catálogo y, si el lenguaje no está en él, `adaptador.nombre`. Así un anfitrión puede traer adaptadores propios sin tocar el catálogo. `disponibles(adaptadores, ids?)` lista los pedidos que tienen adaptador.

**Selector.** Las instancias autónomas muestran un `<select>` nativo (D7) con los lenguajes de `opciones.lenguajes` (por defecto, todos los adaptadores). El lenguaje actual siempre aparece. Está desactivado si solo hay uno o si el anfitrión no da `alCambiarLenguaje`; en ese caso solo indica el lenguaje. En el juego (`adoptar`) no se crea: el juego conserva sus botones hasta E4.

**Cambiar de lenguaje.** Elegir otro lenguaje llama a `opciones.alCambiarLenguaje({ documento, lenguaje })`, que puede responder de forma síncrona o con una promesa:
- con un documento, se abre con `abrir`;
- con `{ motivo }`, se muestra el aviso y nada cambia;
- con nada, no pasa nada.

Mientras espera, el selector queda desactivado. Si el documento se edita o cambia antes de la respuesta, esta se descarta con un aviso. Una excepción del anfitrión se trata como motivo. El editor no convierte entre lenguajes: lo hace el anfitrión, o abre otro archivo.

**`abrir` con otro lenguaje.** Rehace el interior (texto, paleta, edición, símbolos y vistas) con el adaptador del documento, con recursos propios: los oyentes, menús y portales del anterior se retiran. El marcado, la forma, la letra, la pantalla completa y el modo sin teclado se conservan. Los historiales viven en la instancia, uno por documento, y se recuperan al volver si el texto coincide. Un lenguaje sin adaptador lanza un error sin tocar el documento. La revisión crece. La raíz lleva `data-lenguaje`, el textarea `aria-label="Código <nombre>"` y la fachada `cmg.lenguaje`. Después del cambio se emite `cmg:lenguaje` en la raíz. `editor.lenguajes()` devuelve los ofrecidos. `proveedor.atajos(lenguaje)` recibe el lenguaje.

**Vistas opcionales.** `opciones.vistas` (por defecto `["pseudo"]` con `adoptar` y `[]` sin él) decide si se crean Seudo/Bloques. Solo existen sobre JS y con `seudo.js` cargado. La demo ya no lo carga. Su futuro está en la decisión D8 del plan.

## Python en el componente (E4a)

**Módulos.**
- `shared/vendor/lezer-python-1.1.19.js` define `LezerPython.parser` y se carga como script clásico.
- `python.js` (`CMGEditorPython`) reúne léxico, huecos, líneas lógicas, niveles de sangría, `pass`, comentarios, plantillas, teclas y operaciones de texto.
- `estructura-python.js` (`ESTRUCTURA_PYTHON`) construye el árbol.
- `adaptador-python.js` (`CMGAdaptadorPython`) los junta.
- El anfitrión carga los cuatro y pasa `adaptadores: { js, python }`.

**Árbol.** `analizar(src)` parte del árbol de lezer y produce la misma forma que JS (`{ src, todas, sig, par, nodos, raiz, duenos, hojas, lineas }`) con los mismos tipos de nodo. Así las consultas (`atomo`, `ampliar`, `unidadLinea`, `fronteraValida`, `contexto`, `destino`, `enLista`) son las de `shared/js/estructura.js`, creadas con `ESTRUCTURA.consultas({ claves, logicos, compara, huecoNombre })` con las palabras de Python. JS usa la instancia por defecto, con el comportamiento de siempre.

Diferencias con JS:
- el `bloque` va de `:` a su última sentencia;
- `elif`/`else` son `rama`: no se mueven sin su `if`;
- `x = valor` con un nombre es `decl`;
- los argumentos con nombre son `nombrado`;
- los huecos son la ficha `hueco`.

`desenvolver` es propio de Python: quita la cabecera y baja el cuerpo un nivel. Un `elif`/`else` con código no se descarta; si el cuerpo era solo `pass`, desaparece.

**Huecos (D4).** Son identificadores `__nombre__`: `aHueco("tipo de enemigo")` da `__tipo_de_enemigo__`. `nombreDe` recupera el nombre con espacios y tildes para las sugerencias. Los nombres especiales de Python (`__name__`, `__init__`…) no son huecos.

**Sangría significativa.** El adaptador declara `sangria: { unidad: "    ", significativa: true, abre, alPartirLinea, niveles, rellenar }`.
- `niveles(src, pos)` devuelve las sangrías válidas para insertar líneas en el inicio de línea `pos`, de la más profunda a la menos:
  - tras una cabecera, solo su cuerpo;
  - al final de bloques anidados, cualquiera de sus niveles;
  - antes de `elif`/`else`, solo dentro del cuerpo;
  - dentro de una línea lógica (paréntesis, texto de varias líneas, `\`), ninguna.
- `rellenar(src, pos)` pone `pass` donde una cabecera se quedó sin cuerpo.

Con `significativa`, `edicion.js` aplica estas reglas:
- **Mover con las flechas:** recorre cada hueco entre líneas y, en cada uno, sus niveles. Subir desde después de un bloque entra primero al final del bloque y bajar desde su final sale de él.
- **Arrastrar:** elige el nivel cuya columna queda más cerca del puntero; la línea de destino empieza en esa columna.
- **Quitar líneas o mover la única de un bloque:** deja `pass` (elegido, al borrar).
- **Pegar en una línea vacía:** usa la sangría ya escrita si es un nivel válido; si no hay, la más profunda.
- **Sustituir líneas:** usa la sangría de la primera.
- **Enter:** sangra tras `:` y retrocede tras `return`/`pass`/`break`/`continue`/`raise`.
- **Tab y sangrar:** usan la unidad del adaptador.

Sin `significativa` (JS), el código de siempre.

**Lo que `edicion.js` toma del adaptador.**
- Huecos (`hueco.crear`) al quitar un valor, un argumento o una condición.
- Final de sentencia (`finSentencia`: `";"` en JS, `""` en Python).
- Literales, familias de operadores y declaraciones de las sugerencias (`edicion`).
- Nombre de la función en ese lenguaje (`fn.nombres[lenguaje]`, D1).

El proveedor recibe el lenguaje en `funciones(lenguaje)`, `vocabulario(lenguaje)` y `atajos(lenguaje)`, y la firma se busca también por el nombre del lenguaje. Las plantillas Python (`plantillas({ pausa })`) incluyen `while True`, `while`, `for … in range`, `break`, `if`, `if/else`, `if/elif/else`, `and`, `or`, `not`, `==`, `!=`, `>`, `<`, `is None`, la variable y `print`. `is None` es un operador nuevo, `sufijo`, que va detrás del operando. Los iconos Python están en `shared/js/iconos.js` (`yPy`, `oPy`, `noPy`, `igualPy`, `distintoPy`, `esNone`).

**Demo.** Cada espacio tiene un documento por lenguaje (`principal.js`, `principal.py`…). El selector abre el del otro lenguaje sin convertir nada. El segundo editor empieza en Python.

## Python en el juego (E4b; sin flag desde E5)

E4b lo puso detrás de `?python=1`; desde E5 el flag ya no existe y Python siempre está disponible.

- La instancia del juego recibe `adaptadores: { js, python }`.
- **Python** en el desplegable de lenguaje de la cabecera (`#sel-lenguaje`, D7) o en la hoja de Ajustes pasa las unidades elegidas a Python.
- JavaScript, Seudocódigo y Bloques (estos dos, en el grupo «Vistas de JavaScript» del desplegable) las devuelven a JavaScript; Seudo y Bloques, además, aplican su vista.

**Guardado.**
- `programas` y `prog-<reto>` siguen siendo solo JS, así que copiar a un escenario propio no cambia.
- El Python va en `fuentes-<reto>` como `{ id: { lenguaje: "python", texto, enUso } }`.
- Volver a JS deja `enUso: false` y conserva el texto. Una unidad sin Python convierte su JS (E7, `shared/python/desde-js.js`); si no cabe, explica el motivo y empieza con un comentario.

**Ejecutar (E5).** El juego, no el componente, traduce cada unidad Python con `CMGPythonJS.traducir(texto, { funciones: proveedor.alias("python"), objetos, propiedades })`. El JS sale con las mismas líneas y corre en el mismo Worker con el preludio `__py`; los diagnósticos y errores llevan la línea de Python. La telemetría guarda el texto Python y `lenguajes`.

**Varias unidades.**
- Si tienen lenguajes distintos, el borrador no se aplica y se explica por qué.
- Si comparten lenguaje, Add y Replace escriben en ese lenguaje: los de Python, en las fuentes.
- «Copiar a los demás» copia en el lenguaje de la unidad de origen.
- «Restaurar» restaura el texto inicial de su lenguaje.

**Los fragmentos del juego.** Inspector, sugerencias, paleta y valores vivos están escritos en JS. Con un documento Python pasan por `aPython`, ficha a ficha:
- nombres del proveedor según D1 (`autoTarget` → `auto_target`, `esperar` → `wait`);
- huecos `__x__` según D4;
- sin `;`;
- `&&`, `||`, `!`, `===` y `!==` → `and`, `or`, `not`, `==` y `!=`;
- `true`, `false` y `null` → `True`, `False` y `None`;
- comentarios `//` → `#`.

Las sugerencias reciben el nombre JS de la función. War y Factory arman la paleta Python con `CMGPaleta.crearPython({ serie })`, igual que la JS.

## Catálogo único de la paleta común

`CMGCatalogo` (en `plantillas.js`, que todas las páginas cargan antes que `python.js`) es la única tabla de los botones comunes: comentar, bucles, if, operadores, variable y consola. Cada entrada lleva el texto de cada lenguaje.
- Un grupo es un botón con variantes: el primer elemento que existe en el lenguaje es el botón y el resto, sus variantes.
- Lo que un lenguaje no declara no aparece en él: `do … while`, `??`, `let` y los niveles de `console` solo en JS; `is None` solo en Python.
- `pausa: true` marca los bucles que reciben la pausa del anfitrión. Cada lenguaje dice cómo se inserta (`PAUSA`).
- `CMGCatalogo.atajos(lenguaje, { pausa })` devuelve una lista nueva. `CMGPlantillasJS.crear` y `CMGEditorPython.plantillas` solo la envuelven.
- Un botón nuevo se añade una sola vez y aparece en los dos lenguajes, en War, en Factory y en el IDE. Otro lenguaje es una clave más en cada entrada y en `PAUSA`.
- `pruebas/editor-contrato.cjs` vigila que JS y Python compartan los botones salvo los propios de cada uno, y la paridad War/Factory.

**Fachada.** Al cambiar de lenguaje el interior se rehace. El juego llama siempre a la fachada vigente, y `window.cmg.edicion` y `window.cmg.seudo` son getters.
