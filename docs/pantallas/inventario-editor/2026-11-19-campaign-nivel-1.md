# Inventario de features del editor · rama `campaign-nivel-1` (commit fabd8f0)

Lectura estática, sin modificar el repo, sin commits y sin ejecutar suites ni navegador.
Raíz inspeccionada: `/tmp/claude-0/-home-user-code-battles-lite/f7d14adb-484c-516e-97cb-829786e8fb16/scratchpad/arboles/campaign`. Todas las rutas son relativas a esa raíz.

**Aviso sobre la spec.** `features-spec.md` describe otra arquitectura: `paquetes/editor/`, CodeMirror (`.cm-content`), `#codigo` como puerto oculto y `?editor=textarea`. En esta rama no existen `paquetes/` ni CodeMirror (`cm-content`, `codemirror` y `EditorView` sin coincidencias en código), y el editor vive en `shared/editor/` con un textarea. El contrato vigente es `shared/editor/CONTRATO.md`. Las marcas `[x]/[ ]` de la spec se citan en la nota de cada fila solo para comparar; no describen esta rama.

---

## 1. Checklist de la spec

| ID | Estado | Evidencia | Nota breve |
| --- | --- | --- | --- |
| EDITOR-F01 | presente | `shared/editor/editor.js:53` (`crear`), `:55` (raíz libre), `:347` (`window.CMGEditor`) | Monta el editor en cualquier raíz. No toca `window.cmg` ni globals del juego (sin coincidencias en `shared/editor`). Sí usa globals compartidos: `ESTRUCTURA` (`shared/editor/adaptador-js.js:61`), `ICONOS` (`editor.js:114`), `CMGTips` (`editor.js:175`), `CMGI18n` (`shared/editor/edicion.js:1198`). Spec: [x]. |
| EDITOR-F02 | presente | `shared/editor/editor.js:59` (uid), `:90` (preferencias en memoria), `:97` (`codigo`), `:115` (`historiales`); `shared/editor/demo.js:37` (dos instancias) | Cada instancia tiene su documento, historial, preferencias y nodos. La suite `pruebas/editor-demo.mjs` lo cubre, pero no se ejecutó. Spec: [x]. |
| EDITOR-F03 | presente | `shared/editor/editor.js:332-342` (`destruir`), `:333` (idempotente), `:339` (libera la raíz); `shared/editor/vida.js:14` (listeners con `signal`), `:29-37` (timers, RAF, observers, portales) | `destruir()` aborta listeners y restaura los nodos del anfitrión (`editor.js:337`). El atajo global Ctrl+Alt+A se registra con `vida.escuchar` (`shared/editor/edicion.js:1586`) y se retira con el mismo `signal`. «Una sola interfaz» no se comprobó en navegador. Spec: [x]. |
| EDITOR-F04 | presente | `shared/editor/editor.js:292` (`documento()` devuelve copia `{...doc}`), `:159` (revisión +1 al editar), `:300` (revisión al abrir) | La revisión crece con cada cambio de texto y al cambiar de documento. Spec: [x]. |
| EDITOR-F05 | presente | `shared/editor/editor.js:315-320` (`marcas(revision, lista)`), `:316` (rechaza si `revision !== doc.revision`) | El rechazo de «otro documento» es indirecto: `abrir` sube la revisión (`editor.js:300`), así que los diagnósticos del documento anterior dejan de coincidir. No se compara un id de documento. Spec: [x]. |
| EDITOR-F06 | presente | `shared/editor/edicion.js:85-110` (historial por documento; tope 200 en `:100`; agrupa tecleo < 1200 ms en `:100`), `:88` (usa el mapa externo), `shared/editor/editor.js:115,128` (un mapa por instancia); `edicion.js:1150` (botones), `:1617` (Ctrl+Z / Ctrl+Y); `shared/editor/nucleo-ui.js:100` e `shared/editor/CONTRATO.md:89` (`insertar` emite `input`, así que fichas y teclado entran en el mismo historial) | Pila propia por documento. Convive con el deshacer nativo del textarea, porque `insertar` usa `execCommand` (`nucleo-ui.js:97-98`). Spec: [x]. |
| EDITOR-F07 | presente | `shared/editor/editor.js:168` (`readOnly` inicial), `:157` (ignora `input`), `:314` (`insertar` bloqueado), `:331` (`refrescar`); `shared/editor/edicion.js:1369-1372` (botones deshabilitados), `:65` (aviso «Detén el programa para editarlo»); `shared/editor/nucleo-ui.js:101` (la paleta no inserta) | En el juego, `soloLectura: () => !!ejec` (`Prototypes/Rocket Launcher/js/juego.js:1720`). Spec: [x]. |
| EDITOR-F08 | distinto | `shared/editor/editor.js:29` (textarea `#codigo`), `:27-28` (capas `espejo` y `resaltado`), `shared/editor/editor.css:39`, `:65` (texto del textarea transparente sobre la capa coloreada) | La superficie es un textarea, no CodeMirror. El resaltado es una capa `<pre>` aparte. No hay `.cm-content`. |
| EDITOR-F09 | distinto | `shared/editor/editor.js:29` (el textarea es visible y editable), `:98` (`codigo.value`), `:291` (`codigo` en la fachada); `Prototypes/Rocket Launcher/js/juego.js:2814` (`get codigo()`) | No es un puerto oculto: el textarea es la superficie. Ni `tieneFoco()` ni `motorTexto` existen (sin coincidencias en el repo). `value`, selección, foco y eventos se leen directamente del textarea. |
| EDITOR-F10 | presente | `shared/editor/editor.js:200-232` (selector; `:212` deshabilitado si hay menos de 2 o falta `alCambiarLenguaje`), `:295-312` (`abrir` con otro lenguaje rehace el interior), `shared/editor/lenguajes.js:12-13` (catálogo js/python) | Matiz: en el componente no convierte. En el juego, `#sel-lenguaje` (`Prototypes/Rocket Launcher/index.html:127`) sí convierte al cambiar a Python: `cambiarLenguaje` (`juego.js:1892-1912`) llama a `convertirAPython` (`juego.js:1060-1062`, con `CMGJSaPython`). La conversión es del anfitrión. Spec: [x]. |
| EDITOR-F11 | distinto | JS: `Prototypes/Rocket Launcher/js/juego.js:220-232` (`revisar`, Acorn antes de ejecutar; mensaje en banda), `:125-127` (Acorn en `instrumentar`), `shared/editor/seudo.js:145-147` (Acorn en Seudo). Python: `shared/python/traductor.js:41` (nodos de error de Lezer, `isError`, al traducir), `shared/editor/estructura-python.js:240` (árbol Lezer). `juego.js:2009` (`marcas` solo recibe línea de ejecución y de error) | No hay diagnóstico de sintaxis en vivo en el editor. Acorn solo actúa al ejecutar (JS). Lezer solo parsea y traduce Python, sin marcas en el editor. Spec: [ ]. |
| EDITOR-F12 | presente | `shared/editor/nucleo-ui.js:150-163` (paleta), `:189-232` (variantes: pulsación de 450 ms en `:232`, clic derecho en `:189`), `shared/editor/plantillas.js:93-122` (catálogo JS/Python con `PAUSA`), `Prototypes/Rocket Launcher/js/paleta.js:12-37` (series), `juego.js:1703` (`CMGPaleta.crear`), `:1734` (`pintarPaleta` según lenguaje), `:2107` (paleta Python) | Las variantes se abren manteniendo pulsado o con clic derecho. Las plantillas dependen del lenguaje activo. Spec: [ ]. |
| EDITOR-F13 | presente | `shared/editor/edicion.js:1585-1593` (Ctrl+Alt+A), `:1549-1571` (`activar`), `:1572` (botón); `shared/editor/vida.js:7` y `:13` (sin `globales`, el atajo solo escucha si el foco está dentro del ámbito) | Matiz: en el juego `atajosGlobales: true` (`juego.js:1716`), así que el atajo escucha en `document` sin filtrar por foco (`vida.js:13`). En instancias autónomas sí es por instancia. Spec: [x]. |
| EDITOR-F14 | distinto | Acciones de la barra: `shared/editor/edicion.js:1148-1155` (teclado, deshacer, rehacer, cortar, copiar, pegar, borrar, ampliar, reducir, duplicar, subir, bajar, línea, desenvolver). Comentar: `shared/editor/adaptador-js.js:33` (botón «//» de la paleta), `shared/editor/nucleo-ui.js:88` (Ctrl+/), `:168` | Falta «comentar» como botón de la barra: vive en la paleta y en Ctrl+/. La barra solo se muestra sin teclado o en Seudo (`shared/css/edicion.css:158`, `:164`). Spec: [ ]. |
| EDITOR-F15 | ausente | Búsqueda de `plegar\|plegado\|fold\|colaps\|pliegue` en `shared/editor/*`: sin coincidencias. `shared/editor/editor.js:321-327` (`irALinea` no despliega nada) | No hay plegado de código. Las coincidencias de «plegar» son otras cosas: barra de herramientas (`Prototypes/Rocket Launcher/index.html:118`), inspector (`juego.js:1518`) y HUD de Campaign (`campaign-hud.js:266`). Spec: [x]. |
| EDITOR-F16 | distinto | `shared/editor/editor.js:240-289` (pantalla completa propia: botón, Esc en `:279-283`, `destruir` en `:287`), `:329` (`pantallaCompleta` devuelve `false` en el juego, porque `autonomo` es `null` con `adoptar`, `:167`) | Solo existe en instancias autónomas. En el juego, la pantalla completa reparte mapa y código (`Prototypes/Rocket Launcher/js/layout.js:444-460`, con botones `index.html:42`, `:141`, `:154`). Spec: [x]. |
| EDITOR-F17 | presente | `shared/editor/editor.js:37-43` (Ajustes: asa y orden de barra), `:44` y `:191-199` (letra, cinco tamaños); `shared/editor/edicion.js:22` (asa), `:1660-1667`, `:1676` y `:1727` (orden de barra, guardado con `escribir`) | En el juego: `Prototypes/Rocket Launcher/index.html:132-133` (A−/A+), `:322` (asa), `:328` y `:385` (orden de barra). Persistencia del juego: `juego.js:1707` (`cmg-juego-` en localStorage); autónomas: en memoria (`editor.js:91-94`). Spec: [ ]. |
| EDITOR-F18 | no verificable | `shared/css/edicion.css:147` (`.paleta, .barra-edicion` con `overflow-x: auto`), `shared/editor/editor.css:3`, `Prototypes/Rocket Launcher/css/componentes.css:294` | El desplazamiento horizontal está contenido en barras. Si la página gana scroll horizontal en teléfono no se puede saber sin navegador. Spec: [ ]. |
| EDITOR-F19 | distinto | `shared/editor/editor.js:291` (`fachada: cmg`), `shared/editor/edicion.js:1735` (`cmg.edicion`), `shared/editor/seudo.js:744` (`cmg.seudo`), `juego.js:2814` (`window.cmg` con getters `edicion` y `seudo`), `juego.js:2793` y `:2931` (`iniciarVistas`) | `cmg.edicion`, `cmg.seudo` y `window.cmg` existen. Falta `cmg.tieneFoco()` (sin coincidencias). Seudo y Bloques existen: Bloques solo en Factory (`shared/editor/seudo.js:245-246`, `juego.js:1854`). Spec: [x]. |
| EDITOR-F20 | ausente | Búsqueda de `editor=textarea`, `?editor=` y `motorTexto` en el repo: sin coincidencias | No hay flag de motor: el textarea es el único motor. Spec: [ ]. |

---

## 2. Features no listadas en la spec

**Superficie de texto y lectura**
- NUEVO-01 · Resaltado de sintaxis por capa `<pre>` bajo el textarea; en la vista sin teclado, clasificación con `cmg.clasificar` · `shared/editor/nucleo-ui.js:25`, `shared/editor/edicion.js:414-419`
- NUEVO-02 · Gutter con números de línea y asa de arrastre de líneas (modo «número» o «borde») · `shared/editor/editor.js:25`, `shared/editor/edicion.js:818-821`, `:1660-1667`
- NUEVO-03 · Banda de línea en ejecución (`corre`) y de error (`err`), pintada sobre el código · `shared/editor/nucleo-ui.js:39`, `shared/editor/editor.js:315-319`, `Prototypes/Rocket Launcher/js/juego.js:2009`
- NUEVO-04 · Huecos `/* nombre */`: selección del siguiente hueco y aviso antes de ejecutar · `shared/editor/nucleo-ui.js:116`, `shared/editor/edicion.js:951-964`, `Prototypes/Rocket Launcher/js/juego.js:220-223`
- NUEVO-05 · Lista de sugerencias contextuales (función, argumento, variables) con tecla propia · `shared/editor/edicion.js:841-875`, `:993`, `Prototypes/Rocket Launcher/js/juego.js:1724`
- NUEVO-06 · Tab inserta la sangría de la unidad del lenguaje; Enter hereda la sangría (en Python, `alPartirLinea`) · `shared/editor/nucleo-ui.js:87-96`, `shared/editor/adaptador-js.js:65`
- NUEVO-07 · Atajos del textarea: Ctrl+/ comenta y Ctrl+Enter ejecuta · `shared/editor/nucleo-ui.js:88-89`
- NUEVO-08 · Comentar y descomentar por bloque según el adaptador · `shared/editor/adaptador-js.js:36-59`
- NUEVO-09 · Insertar con selección: los pares (`envolver`) rodean lo elegido · `shared/editor/nucleo-ui.js:100-114`, `shared/editor/CONTRATO.md:89`, `Prototypes/Rocket Launcher/js/campaign-hud.js:307-308`
- NUEVO-10 · Arrastrar fichas desde la paleta al código (HTML5 `dragstart`, con clase `soltar`) · `Prototypes/Rocket Launcher/js/juego.js:1738-1741`, `shared/editor/edicion.js:787`

**Modo sin teclado (vista táctil y PC)**
- NUEVO-11 · Vista propia (`#bloques`) en la que se elige por elementos; cursor y selección visibles · `shared/editor/editor.js:30-31`, `shared/editor/edicion.js:1549-1571`, `:413`
- NUEVO-12 · Gestos táctiles: doble toque (`DOBLE_MS` 380), mantener pulsado (`LARGO_MS` 430), menú de fichas y arrastre de líneas o fichas · `shared/editor/edicion.js:547-600`, `:637` (`programarMenu`), `:677` (`iniciarArrastre`)
- NUEVO-13 · ProtoMouse: interruptor de selección y ratón virtual en la barra del teléfono · `shared/editor/edicion.js:1141-1143`, `:1166-1169`, `:1211`, `:1237`
- NUEVO-14 · Barra de edición reordenable por grupos, guardada por dispositivo; en teléfono, variantes por pulsación · `shared/editor/edicion.js:1156-1171`, `:1676-1727`
- NUEVO-15 · Desenvolver: quita el if/while que rodea la selección (en Python, quita la cabecera y baja el cuerpo) · `shared/editor/edicion.js:323`, `:1154`, `shared/editor/CONTRATO.md:178`
- NUEVO-16 · Sangrar y desangrar la selección (solo placas del teléfono) · `shared/editor/edicion.js:346`, `:1173`
- NUEVO-17 · Alt+↑/↓ mueve líneas; Alt+Shift+←/→ amplía o reduce la selección · `shared/editor/edicion.js:1619-1620`, `:236` (`moverLineas`)
- NUEVO-18 · Teclas en la vista: ←/→ por elementos, ↑/↓ por líneas, Tab y Shift+Tab sangran, Ctrl+Z/Y, Ctrl+D, Supr · `shared/editor/edicion.js:1614-1626`
- NUEVO-19 · Portapapeles propio con cortar, copiar y pegar; la copia se guarda en `sessionStorage` · `shared/editor/edicion.js:361-362`, `:375` (`copiar`), `:384` (`pegar`), `:1632-1644`
- NUEVO-20 · Aviso breve (toast) al pulsar teclas en el modo sin teclado · `shared/editor/edicion.js:1387`, `:1625`

**Python y lenguaje**
- NUEVO-21 · Sangría significativa en Python: niveles válidos al insertar, `pass` al vaciar un bloque, mover bloques enteros · `shared/editor/CONTRATO.md:182-199`, `shared/editor/estructura-python.js:240`
- NUEVO-22 · Huecos Python `__nombre__` con nombre legible para sugerencias · `shared/editor/CONTRATO.md:180`
- NUEVO-23 · Conversión JS a Python al cambiar de lenguaje, con aviso si no cabe · `Prototypes/Rocket Launcher/js/juego.js:1060-1062`, `:1892-1912`, `shared/python/desde-js.js:484`
- NUEVO-24 · Traductor Python a JS que usa el árbol de Lezer (`LezerPython`) · `shared/python/traductor.js:61`, `:1240`
- NUEVO-25 · Catálogo común de plantillas por lenguaje con pausa inyectable (`PAUSA`) · `shared/editor/plantillas.js:93-122`
- NUEVO-26 · Lenguajes del componente: catálogo de nombres y extensiones, y `disponibles` filtra por adaptadores · `shared/editor/lenguajes.js:12-35`
- NUEVO-27 · Demo independiente con dos instancias y un documento por lenguaje · `shared/editor/demo.js:37`, `shared/editor/demo.html:31-35`

**Vistas Seudo y Bloques**
- NUEVO-28 · Seudocódigo: árbol a texto (`generar`) y texto a árbol (`parsear`, con Acorn) · `shared/editor/seudo.js:94`, `:144-147`
- NUEVO-29 · Modo de vista (JS, Seudo, Bloques) con `aplicarModo`; Factory arranca en Bloques si no hay preferencia guardada · `shared/editor/seudo.js:245-246`, `:698`
- NUEVO-30 · Paleta de ladrillos de seudocódigo (`#paleta-seudo`) · `Prototypes/Rocket Launcher/index.html:160`

**Interfaz de la página y del juego**
- NUEVO-31 · Tooltips compartidos de la página (`CMGTips`, adquirir y soltar) · `shared/editor/tips.js:1-4`, `:81`, `shared/editor/editor.js:175`
- NUEVO-32 · Modo revisión (binoculares): lee el código fila a fila; la cabecera declara War y JavaScript · `Prototypes/Rocket Launcher/js/revision-juego.js:1-3`, `Prototypes/Rocket Launcher/index.html:44`
- NUEVO-33 · Pulsos del editor durante la partida: solo War · `Prototypes/Rocket Launcher/js/juego.js:261`, `Prototypes/Rocket Launcher/js/pulsos.js:1`
- NUEVO-34 · Confirmación previa a Replace, guardada en `cmg-juego-confirmar-replace` · `Prototypes/Rocket Launcher/js/juego.js:1922`
- NUEVO-35 · Paleta compuesta por serie: «Esperar» antes de la variable; órdenes propias de War o de Factory y Campaign · `Prototypes/Rocket Launcher/js/paleta.js:12-37`, `:41-45`
- NUEVO-36 · Preferencias del juego en `localStorage` con prefijo `cmg-juego-`, envueltas en try/catch · `Prototypes/Rocket Launcher/js/juego.js:1707-1710`
- NUEVO-37 · API `cmg.edicion` completa (activo, elegir, ampliar, deshacer, copiar, pegar, borrar, duplicar, moverLineas, lineaNueva, desenvolver, portapapeles) · `shared/editor/edicion.js:1735`, `shared/editor/CONTRATO.md:98`
- NUEVO-38 · Pruebas del componente (demo, contrato, interacción); no ejecutadas aquí · `pruebas/editor-demo.mjs`, `shared/editor/CONTRATO.md:118-123`

---

## 3. Qué expone cada serie

Las tres series comparten el mismo marcado (`Prototypes/Rocket Launcher/index.html`). La serie se lee de `?serie=` en `juego.js:10-11`. Campaign se distingue en CSS (`[data-serie="campaign"]`, `css/campaign.css`) y en JS (`ES_CAMPAIGN`).

| Feature del editor | War | Factory | Campaign | Evidencia |
| --- | --- | --- | --- | --- |
| Barra del código (`.barra-prog` > `.herramientas`) | Sí | Sí | Escritorio: oculta. Teléfono: sí | `index.html:121-133`; `campaign.css:161` |
| Selector de lenguaje `#sel-lenguaje` | Sí (JS, y Python si `PYTHON`) | Sí | Escritorio: fuera de la barra; se usa desde Ajustes (JS/Python) | `juego.js:1849`; `campaign.css:161`; `campaign-hud.js:660-664`, `:670-676` |
| Vistas en el selector (Seudo, Bloques) | Seudo | Seudo y Bloques | Ninguna | `juego.js:1850-1854`; `campaign-hud.js:658-659` |
| Paleta de fichas (órdenes propias) | Apuntar, Disparo, Ráfaga, Detener, Sensor | Recoger, Entregar, Cuántos | Recoger, Entregar, Cuántos | `paleta.js:12-21`, `:22-29`, `:30-37` |
| Símbolos `#simbolos` | Oculta por defecto (`index.html:270`); visibilidad por forma no verificada | Igual | Escritorio: repetida como `#cmp-tipografia` bajo el código en modo sin teclado | `campaign-hud.js:303-318`; `campaign.css:200` |
| Modo sin teclado | `#b-teclado` (`index.html:130`) | Igual | `#b-teclado-movil` (`index.html:139`; `campaign.css:169-171`) | `edicion.js:1586` (Ctrl+Alt+A) |
| A−/A+ (letra) | Sí (`index.html:132-133`) | Sí | Escritorio: oculto con `.herramientas` (`campaign.css:161`) | No verificado si hay otro control de letra |
| Ajustes del editor (asa, orden de barra) | Sí (`index.html:322-328`, `:385`) | Sí | Sí, en el mismo diálogo reagrupado | `campaign-hud.js:639`, `:652-660` |
| Pantalla completa (la del juego; la del editor solo existe en autónomas) | `#b-pantalla` (`index.html:42`), `#b-pantalla-cod` (`:154`) | Igual | Escritorio: `#b-pantalla-movil` oculto (`campaign.css:166-167`). Teléfono: pantalla completa al inicio | `campaign.css:166-167`; `layout.js:444-460`, `:450-451` |
| Pestañas Programa, Registro, Ayuda, Escenario | Sí (`index.html:113-116`) | Sí | Escritorio: ocultas (`campaign.css:160`); sustituidas por selector de unidades, pestañas con «+» y menú ⋯ | `campaign.css:160`; `campaign-hud.js:245-251`; `index.html:142` |
| Pantallas en el sitio del código (misión, máquinas, historial, biblioteca) | No | No | Sí | `campaign-hud.js:344-362` |
| Revisión (`#b-revisar`) | Sí (`index.html:44`) | Sí, no verificado | Movido a la esquina del mapa | `campaign-hud.js:131`; `campaign.css:38` |
| Pulsos del editor | Sí | No | No | `juego.js:261`; `pulsos.js:1` |
| Sugerencias contextuales | `sugerencias(c)` (`juego.js:1724`) | Igual | Propias (`uiC.sugerencias`) | `juego.js:2116` |
| Ayuda (órdenes) | Pestaña Ayuda | Igual | Propia (`uiC.ayuda`) | `juego.js:2281` |
| Historial o escenario | No verificado | No verificado | `uiC.historial` | `juego.js:2368` |
| Copiar a otras unidades (`#b-copiar-prog`) | Visible según la condición `varios` (`juego.js:1798`) | Igual | Visible solo si la unidad tiene gemelos (`juego.js:1798`, `:1982`) | `juego.js:1798`, `:1965`, `:1982` |
| Biblioteca de programas con etiqueta de lenguaje | No | No | Sí | `campaign-hud.js:510`, `:518`, `:524` |
| Árbol de unidades con casillas | No | No | Sí | `campaign-hud.js:1-14`, `:247-251` |
| Solo lectura mientras corre | Sí | Sí | Sí | `juego.js:1720` |
| Arrastrar fichas al código | Sí | Sí | Sí | `juego.js:1738` |

### Campaign en detalle

**Oculta (escritorio)**
- Pestañas Programa, Registro, Ayuda y Escenario: `Prototypes/Rocket Launcher/css/campaign.css:160`.
- Barra `.herramientas` con selector de lenguaje, modo sin teclado y A−/A+: `campaign.css:161`; `index.html:125-133`.
- Botones de `.acciones-movil` salvo teclado y menú ⋯: `campaign.css:166-167`.
- `#simbolos` (el HUD dice que está oculta en escritorio y repite sus signos): `campaign-hud.js:307`.
- Idioma Seudo en Ajustes: `campaign-hud.js:658-659`.
- Vistas JS/Seudo/Bloques del selector: `juego.js:1850-1851`.

**Desactiva**
- Pulsos del editor: `juego.js:261`.
- Vistas Seudo y Bloques: `juego.js:1850-1851` (no se crea el grupo de vistas).
- Copiar a gemelos solo con gemelos: `juego.js:1798`.

**Añade**
- Interfaz de escritorio con cabecera propia, árbol de unidades y pestañas con «+»: `campaign-hud.js:1-14`, `:245-251`.
- Selector JS/Python en Ajustes: `campaign-hud.js:661-676`.
- Tipografía de símbolos bajo el código (modo sin teclado): `campaign-hud.js:309-318`; `campaign.css:200`.
- Pantallas en el sitio del código y menú ⋯: `campaign-hud.js:344-362`; `index.html:142`.
- Panel inferior con Objetivo, Specs y Consola: `campaign-hud.js:740`; `layout.js:328-329`.
- Vocabulario de órdenes propio (`goTo`, `irA`, `start`, `stop`, `light`, `setRecipe`, `request`): `juego.js:108-111`.
- Instrumentación con Acorn también en Campaign: `juego.js:125`.
- Sugerencias y ayuda propias: `juego.js:2116`, `:2281`.
- Checkpoint con confirmación en el botón de reinicio: `juego.js:1204-1210`.
- Biblioteca con etiqueta de lenguaje por programa: `campaign-hud.js:510`.
- Revisión movida a la esquina del mapa: `campaign-hud.js:131`; `campaign.css:38`.

**Solo en teléfono (no cambia en escritorio)**
- El HUD declara que en el teléfono se queda la interfaz de War: `campaign-hud.js:10-11`.
- Pantalla completa al inicio en teléfono: `layout.js:450-451`.

---

## 4. Dudas

- **Seudo en Campaign.** El juego llama a `iniciarVistas` (`juego.js:2793`, `:2931`) y el editor crea Seudo si `vistas` incluye `pseudo` (`editor.js:113`, `:143-144`). No he confirmado si `cmg.seudo` queda inactivo en Campaign o si se puede activar por otra vía.
- **Letra en Campaign escritorio.** A−/A+ quedan ocultos (`campaign.css:161`) y `campaign-hud.js:248` no es un control de letra (es el «+» de pestañas). No he encontrado otro control de tamaño en Campaign.
- **Pantalla completa en Campaign escritorio.** `#b-pantalla-cod` aparece flotante (`index.html:153-154`, `campaign.css:172`). No he comprobado en navegador si se ve ni si funciona.
- **Revisión en Campaign.** `revision-juego.js:1-3` declara War y JavaScript; el botón se mueve a Campaign (`campaign-hud.js:131`). No he verificado si el modo revisión funciona en Campaign.
- **Esc en la pantalla completa del juego.** `layout.js:661` cierra el menú, no la pantalla completa. No he localizado el manejo de Esc para la pantalla completa del juego.
- **F05 y «otro documento».** El rechazo depende de que `abrir` suba la revisión (`editor.js:300`). No he encontrado comparación por id de documento.
- **F11 y Python.** Lezer solo aparece para parsear y traducir (`estructura-python.js:240`, `traductor.js:41`). No he encontrado diagnósticos de Python en el editor; conviene confirmarlo en navegador.
- **F18 (móvil).** Sin navegador no puedo afirmar que no haya scroll horizontal de página.
- **Suites.** `pruebas/editor-demo.mjs`, `pruebas/editor-contrato.cjs` y `pruebas/interaccion.cjs` no se ejecutaron. Los estados «presente» salen de la lectura del código.
- **Protomouse.** La spec no lo nombra como feature, pero existe y es amplio (ver NUEVO-13). No lo he tratado como ausente.
- **Spec y rama.** Las marcas `[x]/[ ]` de `features-spec.md` no coinciden con esta rama en varios puntos (F11, F12, F14, F15, F17 y F20). Conviene decidir si la spec se reescribe para `shared/editor/` o si queda como referencia de otra rama.
