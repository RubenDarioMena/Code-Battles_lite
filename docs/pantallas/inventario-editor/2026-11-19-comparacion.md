# Editor · `trunk` vs `campaign-nivel-1`

Fecha: 2026-11-19 · `trunk` 6330c0e · `campaign-nivel-1` fabd8f0 · Fuente: inventarios de Haiku (solo lectura de código, sin navegador) en [trunk](2026-11-19-trunk.md) y [campaign-nivel-1](2026-11-19-campaign-nivel-1.md). Claude comprobó a mano 5 evidencias al azar; todas coincidían.

## Checklist de la spec, rama contra rama

| ID | `trunk` | `campaign-nivel-1` | Diferencia |
| --- | --- | --- | --- |
| F01 crear | presente | presente | Campaign usa globales compartidos (`ESTRUCTURA`, `ICONOS`, `CMGTips`, `CMGI18n`); trunk los recibe inyectados |
| F02 instancias | presente | presente | — |
| F03 destruir | presente | presente | — |
| F04 documento | presente | presente | — |
| F05 marcas | distinto | presente* | Igual en las dos: no se compara el id del documento, el rechazo depende de que la revisión suba al cambiar de documento. *Haiku lo juzgó distinto en una rama y presente en la otra |
| F06 historial | presente | presente | En Campaign convive con el deshacer nativo del textarea (`execCommand`) |
| F07 solo lectura | presente | presente | — |
| F08 superficie CodeMirror | presente | **distinto** | Campaign: textarea con capa de resaltado |
| F09 puerto `#codigo` | presente | **distinto** | Campaign: el textarea es la superficie; no hay `tieneFoco()` ni `motorTexto` |
| F10 lenguaje | presente | presente | En ambas, el juego convierte JS→Python al cambiar (lo hace el anfitrión, no el editor) |
| F11 diagnósticos | presente | **distinto** | Campaign: solo valida al ejecutar; sin marcas en vivo |
| F12 fichas | presente | presente | — |
| F13 sin teclado | presente | presente | En el juego el atajo es global en ambas (`atajosGlobales: true`) |
| F14 barra | distinto | distinto | Igual en las dos: «comentar» no está en la barra (está en paleta y Ctrl+/) |
| F15 plegado | presente | **ausente** | Solo existe con CodeMirror |
| F16 pantalla completa | distinto | distinto | Igual en las dos: en el juego es del panel (mapa/código), no del editor |
| F17 ajustes | presente | presente | Letra en A−/A+, no en el diálogo. En Campaign escritorio A−/A+ quedan ocultos |
| F18 móvil | no verificable | no verificable | Pide navegador (clicker) |
| F19 fachada `cmg` | presente | **distinto** | Campaign: falta `cmg.tieneFoco()` |
| F20 `?editor=textarea` | presente | **ausente** | No hay CodeMirror que desactivar |

**Resumen:** lo que falta en Campaign (F08, F09, F11, F15, F19, F20) es todo CodeMirror, y llega solo al portar la rama a `trunk`. F05, F14 y F16 se comportan igual en ambas ramas: son decisiones de la spec, no bugs de rama.

## Lo que `campaign-nivel-1` tiene y `trunk` no

La interfaz de escritorio de Campaign del commit `fabd8f0` no está en `trunk`: `campaign-hud.js` (762 líneas), 352 líneas de `campaign.css`, ~170 de `juego.js` y textos en `shared/i18n/campaign.js`. Lo que aporta al editor:

- Escritorio: oculta las pestañas Programa, Registro, Ayuda y Escenario y la barra `.herramientas` (lenguaje, sin teclado, A−/A+).
- Árbol de unidades con casillas, pestañas con «+» y menú ⋯.
- Pantallas en el sitio del código: misión, máquinas, historial y biblioteca.
- Biblioteca de programas con etiqueta de lenguaje.
- Selector JS/Python dentro de Ajustes (sin idioma Seudo).
- Tipografía de símbolos bajo el código en modo sin teclado.
- Panel inferior con Objetivo, Specs y Consola.
- Revisión movida a la esquina del mapa.
- Teléfono: conserva la interfaz de War y abre en pantalla completa.

En `trunk`, Campaign solo oculta los botones Seudo y Bloques (`paquetes/app/juego/arranque.js:88`) y no ofrece vistas en el selector (`programas.js:77`).

## Hallazgos para decidir (no son cambios hechos)

1. **Spec desactualizada.** F11, F12, F17 y F20 están implementados en `trunk` y siguen sin marcar en `docs/pantallas/editor.md`.
2. **F14:** ¿«comentar» debe estar en la barra, o se corrige la spec?
3. **F16:** en el juego, ¿la pantalla completa debe ser del editor o basta la del panel?
4. **F17:** ¿el tamaño de letra va dentro del diálogo de Ajustes? En Campaign escritorio no hay ningún control de letra visible.
5. **F02:** el README dice portapapeles por instancia, pero el respaldo se comparte en la sesión de la página.
6. **Factory no valida al ejecutar** (`ciclo-programas.js:41`: `ES_FACTORY ? null : revisar(texto)`), en ninguna de las dos ramas. ¿Es intencional?
7. **El modo revisión** está pensado para War y JavaScript, pero el botón aparece en las tres series. No se ha comprobado si funciona en Factory ni en Campaign.
8. **Spec sin cubrir:** 91 features de `trunk` no están en la spec (Seudo/Bloques, ProtoMouse, gestos, sugerencias, menús de variantes, i18n…). Hay que decidir cuáles merecen ID propio.

## Siguiente paso propuesto

- Portar `fabd8f0` (y los commits de arte) a `trunk` cuando termines en Campaign. Así Campaign hereda CodeMirror y desaparece la columna de diferencias.
- Con Sonnet, el HTML visual de estas diferencias en `docs/salidas/`, para que las señales en Hyper-marker.
- Pasar F18 al clicker en el juego con `?serie=campaign`.
