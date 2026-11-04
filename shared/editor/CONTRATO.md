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
