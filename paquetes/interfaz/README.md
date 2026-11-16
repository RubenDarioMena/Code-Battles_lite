# interfaz

HUD, inspector, consola, fichas de reto y pestañas del juego. Fase 2, paso 11a:
primer traslado desde `Prototypes/Rocket Launcher/js/juego.js`.

## Puede importar

Solo `protocolo` y `editor`, por sus entradas públicas. Los instaladores actuales
no tienen imports: los datos de los reglamentos y los servicios de lenguaje,
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

`ContextoInterfaz` en `index.d.ts` describe el estado compartido. La composición
conserva sus variables locales y las ofrece mediante getters y setters:
`mundo`, `def`, `partida`, `ejec`, `programas`, `fuentes`, `seleccion`,
`seleccionadas`, `vista`, `pausa`, etc. Los módulos leen `ctx.x` en cada llamada,
sin capturar una copia que quede obsoleta tras cambiar de reto o ejecutar.

El contexto también aporta constantes de reglas (`TIPOS`, `SENSOR`, `factory`),
`uiC` de Campaign, servicios del editor, `ti18n`, presentación, guardado y
callbacks de las otras secciones. Las declaraciones compartidas mutables
permanecen en la composición; el estado privado de cada sección queda en su
instalador. Los tipos de retorno se derivan de las implementaciones.

El orden actual es ciclo/cierre de programas → consola → vistas y campo →
info del reto → máquinas → inspector/editor → pestañas → programas/editor →
registro → ayuda → escenario/Campaign → bucle → arranque. Los accesores permiten
referencias diferidas a secciones posteriores; estas no se invocan al importar.

## Pruebas

- `node paquetes/interfaz/pruebas/interfaz.mjs`: entrada pública en Node sin DOM,
  siete instaladores de interfaz.
- `node pruebas/imports-juego.mjs`: recorre imports/reexports locales
  desde el juego, comprueba archivos y nombres exportados, contexto e instalación,
  y orden de scripts module/defer y publicaciones explícitas del juego.
- `npm test`, `npm run tipos` y `node pruebas/fronteras.mjs`.
- QA de navegador pendiente en este paso: arranque de las tres series, inspector,
  ficha móvil, pestañas, consola y banners, guardado y cambio de reto, 2D/3D.

## Pendiente

La sección de información del reto todavía contiene composición y guardado,
y el inspector monta el editor, como en el archivo original. Se han conservado
los bloques completos y su secuencia; repartir esas responsabilidades y trasladar
`layout.js` queda para los siguientes pasos. El ciclo y el bucle están en
`app/juego`, siempre accesibles por la entrada pública de `app`.
