# Pantalla · Editor de código

Estado: **borrador, pendiente de tu aprobación** · Revisada contra: `trunk` tras la unificación (fase 5 + CodeMirror) · Fecha: 2026-11-19

El editor es el paquete `paquetes/editor/` (contrato en su `README.md`). Lo usan el juego (War, Factory y Campaign) y la demo autónoma (`paquetes/editor/demo/demo.html`). Una sola copia del código sirve a todos los anfitriones; los servicios externos (acorn, lezer, CodeMirror, i18n) se inyectan con `configurar`.

> Primera spec del harness. Las features salen de `paquetes/editor/README.md`, `docs/CODEMIRROR-QA.md` y la demo. Las marcadas `[x]` las cubren suites que pasaron el 19-11-2026 (sobre todo `pruebas/editor-demo.mjs` y `pruebas/codemirror.cjs`); las `[ ]` existen pero ninguna prueba automática las verifica todavía. Corrige lo que no coincida con lo que quieres.

## Índice de palabras clave

| Clave | Dónde |
| --- | --- |
| `instancia`, `crear`, `destruir` | F01–F03 · `paquetes/editor/editor.js` (`grep: CMGEditor.crear`) |
| `documento`, `revision` | F04–F05 · `editor.js` (`grep: revision`) |
| `historial`, `deshacer`, `rehacer` | F06 · `paquetes/editor/edicion*.js` (`grep: deshacer`) |
| `codemirror`, `superficie`, `cm-content` | F08–F09 · `paquetes/editor/codemirror.js`, `estilos/codemirror.css` |
| `puerto`, `codigo`, `textarea` | F09 · `codemirror.js` (`grep: puerto`) |
| `lenguaje`, `python`, `javascript` | F10 · `lenguajes.js`, `adaptador-js.js`, `adaptador-python.js` |
| `diagnostico`, `sintaxis`, `acorn`, `lezer` | F11 · `codemirror.js` (`grep: diagnost`) |
| `fichas`, `paleta`, `variantes`, `sin-teclado` | F12–F13 · `edicion.js`, `nucleo-ui.js`, `plantillas.js` |
| `atajos`, `teclado` | F14 · `nucleo-ui.js` (`grep: Control`) |
| `solo-lectura` | F07 · `editor.js` (`grep: soloLectura`) |
| `plegado` | F15 · `codemirror.js` (`grep: fold`) |
| `pantalla-completa` | F16 · `nucleo-ui.js` (`grep: completa`) |
| `ajustes`, `orden-barra`, `letra` | F17 · `nucleo-ui.js` (`grep: ajustes`) |
| `movil`, `layout`, `protomouse` | F18 · `paquetes/interfaz/layout.js`, `docs/REDISENO-EDITOR-MOVIL.md` |
| `marcas`, `irALinea` | F05 · `editor.js` |
| `cmg`, `fachada`, `integracion` | F19 · `editor.js` (`grep: fachada`), `paquetes/app/juego/arranque.js` |

## Features

- [x] `EDITOR-F01` · `CMGEditor.crear` monta un editor completo dentro de cualquier raíz, sin globals del juego.
- [x] `EDITOR-F02` · Varias instancias en la misma página son independientes: documento, selección, historial, menús y preferencias propios.
- [x] `EDITOR-F03` · `destruir()` es idempotente y retira interfaz, oyentes y nodos auxiliares. «Recrear» deja una sola interfaz y un solo atajo global.
- [x] `EDITOR-F04` · `documento()` devuelve una copia. La revisión crece al editar y al cambiar de documento.
- [x] `EDITOR-F05` · `marcas(revision, lista)` rechaza diagnósticos de una revisión antigua o de otro documento.
- [x] `EDITOR-F06` · Historial propio por instancia y por documento (deshacer y rehacer), compartido con botones y fichas. No hay un segundo historial de CodeMirror.
- [x] `EDITOR-F07` · Solo lectura bloquea `insertar` y la barra lo refleja (botones deshabilitados). En las batallas de campaña y ensayo de Campaign-V2 se puede editar una unidad durante el intento y pulsar «Aplicar ahora», también en pausa.
- [x] `EDITOR-F08` · La superficie editable es CodeMirror (`.cm-content`), una por instancia.
- [x] `EDITOR-F09` · `#codigo` sigue como puerto oculto (value, selección, foco y eventos) para el anfitrión. La geometría y el foco se consultan con `tieneFoco()` y `motorTexto`, nunca con el puerto.
- [x] `EDITOR-F10` · Selector de lenguaje JavaScript/Python. Cada lenguaje abre su propio documento; no convierte el texto. Con un solo adaptador, el selector aparece deshabilitado.
- [ ] `EDITOR-F11` · Diagnósticos de sintaxis: Acorn para JS, Lezer para Python (excepción conocida: `yield` sin valor).
- [ ] `EDITOR-F12` · Paleta de fichas con variantes (mantener pulsado) que inserta plantillas del lenguaje activo.
- [x] `EDITOR-F13` · Modo sin teclado (Ctrl+Alt+A) por instancia; el atajo afecta solo al editor enfocado.
- [ ] `EDITOR-F14` · Barra de edición: comentar, duplicar, borrar, pegar, desenvolver, ampliar o reducir selección, subir o bajar línea.
- [x] `EDITOR-F15` · El plegado solo existe en la superficie CodeMirror y nunca elimina texto. `irALinea` expande el rango oculto.
- [x] `EDITOR-F16` · Pantalla completa por editor; Esc o el mismo botón la cierran.
- [ ] `EDITOR-F17` · Ajustes del editor (tamaño de letra, asa, orden de la barra) por instancia.
- [ ] `EDITOR-F18` · Usable en móvil sin scroll horizontal de la página.
- [x] `EDITOR-F19` · En el juego, `window.cmg`, `cmg.edicion`, `cmg.seudo` y `cmg.tieneFoco()` siguen funcionando, y las vistas Seudo y Bloques se conservan.
- [ ] `EDITOR-F20` · `?editor=textarea` activa el motor anterior para comparar (el anfitrión no inyecta CodeMirror).

- [x] `EDITOR-F21` · En campaña y ensayo de Campaign-V2, la paleta ofrece los dos eventos de clic en JS y Python. Seudo permite insertar «cuando», editar su cuerpo y volver a JS. Cada ficha aporta el nombre del evento, el parámetro y el rótulo ES/EN.

- [x] `EDITOR-F22` · En campaña y ensayo de Campaign-V2, el árbol del panel abre los documentos de las unidades seleccionadas desde el mapa o sus casillas. Una edición compartida se propaga a las vinculadas. Desvincular conserva la fuente actual de la unidad. Lo verifica `pruebas/campaign-v2-ui.mjs`.
- [x] `EDITOR-F23` · En Salida, VEH-01 tiene programa de partida en JS y Python. Seudo reconoce sus bloques de movimiento y llegada. Durante la reposición, el árbol muestra la unidad en gris y los segundos restantes. Lo verifica `pruebas/campaign-v2-mecanicas.mjs`.


## Límites intencionales

- La demo no ejecuta programas: solo edita. Ejecutar es del juego (Worker y traductor).
- La demo no carga Seudo: sus vistas son opcionales y no aparecen en el IDE autónomo.
- Cambiar de lenguaje abre otro documento; no traduce el código.
- Las restricciones del traductor Python y los errores de ejecución no son diagnósticos del editor.

## Partes conectadas

| Parte | Archivo o documento | Versión vigente |
| --- | --- | --- |
| Contrato del paquete | `paquetes/editor/README.md` | `trunk` |
| QA y comparación CodeMirror | `docs/CODEMIRROR-QA.md` (histórico, rama `codemirror-mobile`) | `trunk` |
| Superficie CodeMirror | `paquetes/editor/codemirror.js`, `shared/vendor/codemirror/` | `trunk`. El bundle se regenera en `herramientas/codemirror/` |
| Lenguajes | `docs/PLAN-EDITOR-LENGUAJES.md`, `docs/EDITOR-D1-D2.md` | — |
| Rediseño móvil | `docs/REDISENO-EDITOR-MOVIL.md` | — |
| Anfitrión juego | `Prototypes/Rocket Launcher/index.html`, `js/servicios.js`, `paquetes/app/juego/`, `paquetes/interfaz/` | `trunk` |
| Anfitrión demo | `paquetes/editor/demo/demo.html`, `demo.js` | `trunk` |
| Mobile-Coder | Repo aparte | **Sin sincronizar.** Al integrar allí, partir de `trunk`, no de una copia anterior |

**Antes de integrar el editor en otro lugar:** parte de `trunk`. Las ramas `codemirror-mobile`, `arquitectura/fase-*` y `shared/editor/` (ruta antigua) son historia.

## Método de QA

### Nivel 1 · gratis y repetible

```bash
node pruebas/clicker-editor.mjs --pasos 200
```

Recorre la demo en escritorio (1280×800) y móvil (390×844) con una semilla fija. Hace clics al azar en los controles visibles (dentro del diálogo abierto, si lo hay), teclea, escribe fragmentos JS y Python y prueba atajos. Después de cada paso comprueba:

| Invariante | Qué detecta |
| --- | --- |
| `sin-errores-js` | Excepciones o `console.error` |
| `documento-legible` | `documento()` deja de responder |
| `una-superficie` | Superficies `.cm-content` duplicadas o desaparecidas (F03, F08) |
| `revision-no-baja` | Revisión que retrocede sin recrear el editor (F04) |
| `sin-scroll-horizontal` | La página se desborda a lo ancho (F18) |

Los pasos «omitidos» (un control tapado o que desaparece) no son fallos, pero si hay muchos, el clicker está probando poco. Cuando falla algo: la semilla y el número de paso lo reproducen, y el informe incluye una captura.

Suites existentes del editor:

```bash
npm test
```

```bash
npm run test:navegador
```

```bash
node pruebas/codemirror.cjs
```

`npm test` y `npm run test:navegador` incluyen las suites del editor (`pruebas/ejecutar-editor-demo.cjs`, 73 comprobaciones de la demo).

`codemirror.cjs` (63 comprobaciones en demo, War y Factory) necesita el servidor en 8771 y `CBL_CHROMIUM_PATH` si Chromium no está en `/usr/bin/chromium`.

### Nivel 2 · escenarios guionados (pendiente)

Un recorrido por cada feature `[ ]` hasta poder marcarla `[x]`. Prioridad: F14 (barra), F18 (móvil), F12 (fichas), F11 (diagnósticos).

### Nivel 3 · juicio (solo si 1 y 2 pasan)

Capturas de escritorio y móvil para tu QA o la de un modelo: legibilidad, solapes, controles tapados por diálogos y coherencia visual entre juego y demo.

## Roadmap (no requerido)

- Sincronizar el editor en Mobile-Coder.
- Ampliar el clicker a War y Factory con sus propias invariantes.
