# interfaz

HUD, inspector, consola, fichas de reto, pestañas y pantalla del editor.
Fase 2, pasos 11a–11c: secciones de `juego.js`, distribución y presentación de las series.

## Puede importar

Solo `protocolo` y `editor`, por sus entradas públicas. Los instaladores actuales
solo importan el editor o archivos propios: los datos de los reglamentos y los servicios de lenguaje,
i18n y presentación se reciben por `ctx`.

## Contrato

Importar `index.js` en Node no requiere DOM ni instala escuchas. Cada
`instalarX(ctx)` se llama una sola vez sobre el DOM existente y devuelve sus
funciones y auxiliares; los nodos, IDs, eventos y cadenas son los del juego.
Todavía no es una interfaz autónoma ni incluye desmontaje.

| Instalador | Sección y resultados principales |
| --- | --- |
| `instalarConsola` | Consola, globos y avisos: limpiar, mostrar, cerrar y caducar. |
| `instalarInfoReto` | Ficha del reto, pistas, portales de inspector/consola móvil, programas guardados, creación del mundo y controles/HUD. |
| `instalarMaquinas` | Chips, selección, estados del inspector, tokens, traducción de etiquetas y ficha. |
| `instalarInspector` | Panel del programa, valores vivos, historia de signos vitales, inserción de tokens y montaje del editor. |
| `instalarPestanas` | Pestañas, banner y actualización de su pista. |
| `instalarRegistro` | Registro visible, resumen de telemetría, copia y borrado desde sus botones. |
| `instalarAyuda` | Ayuda de órdenes por serie. |
| `instalarVariantes` | Selector visual `?poc=1`. |
| `instalarEtiquetas` | Etiquetas y globos sobre el campo. |
| `instalarRetosPantalla` | Textos del reto, chips y hoja del enunciado. |
| `instalarEditorTexto` | Banda de ejecución/error, entrada de texto, inserción de referencias, letra, colores y ruteo de consola. |
| `instalarSugerencias` | Firmas y sugerencias de huecos, argumentos y condiciones. |

`ContextoInterfaz` en `index.d.ts` describe el estado compartido. El módulo
`app/juego/estado.js` crea las variables compartidas y sus getters y setters:
`mundo`, `def`, `partida`, `ejec`, `programas`, `fuentes`, `seleccion`,
`seleccionadas`, `vista`, `pausa`, etc. Los módulos leen `ctx.x` en cada llamada,
sin capturar una copia que quede obsoleta tras cambiar de reto o ejecutar.

El contexto también aporta constantes de reglas (`TIPOS`, `SENSOR`, `factory`),
`uiC` de Campaign, servicios del editor, `ti18n`, presentación, guardado y
callbacks de las otras secciones. El estado privado de cada sección queda en su instalador. Los nuevos
instaladores devuelven accesores para sus servicios y variables; la composición
conecta sus descriptores a `ctx`, sin evaluar los getters ni copiar valores. Los tipos de retorno se derivan de las implementaciones.

El orden de instalación está en `app/juego/iniciar.js`. Conserva la secuencia
de los bloques del juego: ciclo/cierre → consola → vistas/campo y sus etiquetas
→ retos → máquinas → inspector/editor → pestañas → programas/editor → registro
→ ayuda → escenario/Campaign → bucle → proveedor → arranque → revisión/layout/remota. Los accesores permiten
referencias diferidas a secciones posteriores; estas no se invocan al importar.

## Pruebas

- `node paquetes/interfaz/pruebas/interfaz.mjs`: entrada pública en Node sin DOM,
  instaladores de interfaz y fábricas de Campaign/Factory.
- `node pruebas/imports-juego.mjs`: recorre imports/reexports locales
  desde el juego, comprueba archivos y nombres exportados, contexto e instalación,
  y orden de scripts module/defer y publicaciones explícitas del juego.
- `node pruebas/juego-identificadores.mjs`: ámbitos resueltos y TDZ directa,
  con autopruebas que introducen un nombre desconocido y una lectura prematura.
- `node pruebas/juego-arranque.mjs`: carga en VM de la composición y sus
  instaladores reales (DOM, editor y GPU emulados), tres series, 2D/3D, escenario
  propio, `?poc=1` y respaldo sin GPU. No sustituye la QA del navegador.
- `npm test`, `npm run tipos` y `node pruebas/fronteras.mjs`.
- QA de navegador pendiente en este paso: arranque de las tres series, inspector,
  ficha móvil, pestañas, consola y banners, guardado y cambio de reto, 2D/3D.

## Pendiente

La sección de información del reto todavía contiene composición y guardado,
y el inspector monta el editor, como en el archivo original. Se han conservado
los bloques completos y su secuencia; repartir esas responsabilidades queda para los siguientes pasos. El ciclo y el bucle están en
`app/juego`, siempre accesibles por la entrada pública de `app`.

## Distribución y auxiliares (paso 11c)

`instalarLayout(cmg)` recibe la fachada viva del editor/juego. `layout.js`
conserva reparto, Ajustes, teclado y barras; `layout-panel.js` instala panel
inferior y pantalla completa; `layout-menu.js` instala menú móvil y ficha.
Sus accesores privados comparten estado sin copiarlo. No leen `window.cmg`
ni `window.__banco`; se conservan eventos, preferencias y marcado.

`CAMPAIGN_UI.crear(ctx)` recibe `campaign` (incluida la instantánea histórica)
y los callbacks de presentación. `FACTORY_FORM.crear(hooks)` recibe `factory`
y sus hooks de guardado. `registrarIconosFactory(iconos)` registra recoger y
entregar en el catálogo recibido, antes de montar el editor. Importarlos no
requiere DOM. i18n sigue siendo clásico en este paso.

Pruebas: `npm test`, `npm run tipos`, `pruebas/imports-juego.mjs`,
`pruebas/juego-identificadores.mjs` y `pruebas/juego-arranque.mjs` (emulación,
no navegador). QA pendiente del autor: divisor, Ajustes, teclado/ProtoMouse,
pantalla completa, consola y ficha móvil, formulario Factory y Campaign.
