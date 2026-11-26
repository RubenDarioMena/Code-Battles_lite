# Code Battle Lite · instrucciones de trabajo

Este proyecto es autónomo. Antes de hacer cambios lee, en este orden: [`docs/PLAN-ARQUITECTURA.md`](docs/PLAN-ARQUITECTURA.md), `docs/VISION.md`, el `README.md` y las entradas recientes de `PROGRESO.md` (solo las primeras; el archivo es largo).

## Línea canónica: `trunk` (decidido el 19 de noviembre de 2026)

- **`trunk` es la única línea canónica.** Todo trabajo «terminado» (verificado y aceptado por el autor) se integra en `trunk` con merge. Las demás ramas son de trabajo y nacen de `trunk` actualizado.
- Antes de empezar, actualiza tu rama desde `trunk`. No partas de `main`, `codemirror-mobile`, `arquitectura/fase-*` ni de copias antiguas: son historia y su contenido ya está en `trunk`.
- Una rama de trabajo no integra otras ramas de trabajo entre sí; todo pasa por `trunk`.
- Integra en `trunk` solo con `npm test` y la suite de navegador pertinente en verde, y lo indicas en `PROGRESO.md`.

## Dirección (decidida el 15 de noviembre de 2026)

- **Steam primero, Android después.** El navegador es el canal de QA, no el producto. Tecnología web, con Electron para Steam y Capacitor para Android.
- **El plan vigente es `docs/PLAN-ARQUITECTURA.md`**: núcleo de simulación sin pantalla, reglamentos por serie, vistas 2D y 3D intercambiables, editor reutilizable y anfitrión de programas. Sigue sus fases y sus criterios de «hecho». `docs/PLAN-UNIFICACION.md` está cerrado y es historia.
- **El punto de partida del código** es la aplicación común de `Prototypes/Rocket Launcher/` (War, Factory con `?serie=factory` y Campaign con `?serie=campaign`) y `shared/`. El Factory original (`Prototypes/Tres vistas/`) está retirado; su comportamiento queda en `pruebas/factory-oraculo.json` y su código en el historial (`b76411b`).
- **Editor reutilizable.** Vive en `paquetes/editor/` (contrato en `README.md`, demo en `demo/demo.html`). Solo importa `lenguaje`; los servicios externos (acorn, lezer, CodeMirror, i18n) se inyectan con `configurar`. La superficie de escritura es CodeMirror (`paquetes/editor/codemirror.js`); `?editor=textarea` usa el motor anterior para comparar. Los puentes de juego y demo conservan los consumidores clásicos.
- **El diseño no es definitivo.** El estilo gráfico, la interfaz y el combate de War, Factory y Campaign pueden cambiar mucho (control manual de unidades, muchas más unidades). No construyas suponiendo que se quedan como están, y no los rediseñes sin que se pida.
- **JavaScript y Python reales** siguen siendo el lenguaje del jugador ([plan](docs/PLAN-EDITOR-LENGUAJES.md)). Python se traduce a JS con las mismas líneas (`paquetes/lenguaje/python.js`). Si cambias su semántica, compárala con CPython y añádela a `pruebas/python-traductor.cjs`. No se añaden otros lenguajes.

## Rama `Campaign-V2` (desde el 24 de noviembre de 2026)

Campaign-V2 une fábrica y batalla en un solo nivel de hitos alternos y es la experiencia principal. War, Factory y la campaña H0–H5 siguen en el código, pero solo como QA desde el menú de pruebas. En esta rama:

- **Vocabulario:** [`CONTEXT.md`](CONTEXT.md) (nivel, hito, Batalla, munición básica, checkpoint…). Usa esos términos en código, textos y commits.
- **Qué rige:** las decisiones de [`docs/campaign-v2/DECISIONES-GRILL.md`](docs/campaign-v2/DECISIONES-GRILL.md) y `DECISIONES-WAYFINDER.md`, el plan y estado de [`PLAN-PORCIONES.md`](docs/campaign-v2/PLAN-PORCIONES.md) y la misión jugable de [`MISION-1.md`](docs/campaign-v2/MISION-1.md). Si chocan, manda el documento más reciente. Los números de juego son provisionales y se ajustan jugando.
- **Dónde está:** la página es `Prototypes/Campaign-V2/`; las reglas, niveles y mecánicas, `paquetes/reglas-campaign-v2/` (con War inyectado); la escena, `paquetes/vista-3d/cv2/`.
- **Paridad de War:** una Batalla `{ war: N }` da la misma huella que el reto N de War (`pruebas/campaign-v2-paridad.mjs`). Una Batalla propia (B6 en adelante) es un reto normalizado. Su prueba de balance demuestra que la torreta sola pierde y que con la unidad nueva se gana (`pruebas/campaign-v2-batallas-propias.mjs`).
- **Probar:** [`docs/campaign-v2/MENU-PRUEBAS.md`](docs/campaign-v2/MENU-PRUEBAS.md) tiene las URL de cada hito y ensayo (`?pruebas=1`, `?ensayo=…`) y las suites.
- **Publicar:** los checkpoints se suben a `Campaign-V2`. La rama se integra en `trunk` solo cuando el autor lo pide.

## Reglas

- **Determinismo.** Paso fijo y RNG con semilla. Sin azar global ni tiempo de reloj en las reglas.
- **Fronteras.** Núcleo, reglamentos, lenguaje y protocolo no usan `window`, `document`, relojes ni Three.js, y se ejecutan en Node. Las vistas dibujan a partir de instantáneas y sucesos y no escriben en el mundo. Todo cambio del mundo desde fuera es una orden. Nadie importa archivos internos de otro paquete.
- **Paridad durante la reestructura.** Hasta cerrar la fase 2 del plan, el juego se comporta igual: las suites actuales, el oráculo de Factory y las referencias grabadas en la fase 0 deben pasar. Si una prueba depende de algo que mueves (`window.cmg`, IDs, `?v=`), adáptala en el mismo commit; no la borres.
- **Los programas del jugador siguen funcionando.** No cambies la API de los programas ni los formatos de guardado sin petición expresa y sin documentarlo.
- **Herramientas.** Se permiten `package.json`, npm workspaces y dependencias de desarrollo. El código se ejecuta sin compilar: módulos ES, tipos en JSDoc y contratos `.d.ts` comprobados con `tsc --noEmit`. Las dependencias de ejecución se sirven desde el repositorio con licencia y hash. Añade una dependencia solo si el plan la pide o si ahorra más de lo que cuesta, y dilo en el resumen.
- **Tamaño.** Ningún archivo nuevo o partido supera unas 500 líneas. Cada paquete tiene `README.md` con su contrato y sus pruebas.
- **PC y móvil legibles.** Los textos nuevos van a los catálogos ES/EN de `shared/i18n/`.
- No ejecutes pruebas de Godot. `educational-animation/` queda fuera, salvo el motor de revisión que el juego importa.

## Verificación

- El autor tiene poco tiempo frente al ordenador: **verifica tú**. No entregues nada que no hayas ejecutado.
- Habitual hoy: `node pruebas/interaccion.cjs` y `node --check` de los scripts modificados; con Python, `node pruebas/editor-python.cjs` y `node pruebas/python-traductor.cjs`; con reglas, la suite de la serie (`factory-reglas.cjs`, `campaign-reglas.cjs`). Cuando exista `npm test` (fase 0), es la verificación habitual.
- Usa la prueba de navegador cuando el cambio afecte a interacción, arranque o dibujo. Puerto dedicado 8771: la suite escribe en localStorage, así que evita el origen donde el usuario esté jugando.
- Para cambios visuales, revisa capturas tú mismo antes de entregar.

## Entrega

- Registra cambios relevantes y pendientes en `PROGRESO.md`, arriba. Distingue resultados actuales de comprobaciones históricas y de emulación.
- **Al terminar una tarea con push, entrega siempre el enlace raw.githack** de lo publicado: `https://raw.githack.com/RubenDarioMena/Code-Battles_lite/<rama>/<ruta>` (por ejemplo `Prototypes/Rocket%20Launcher/index.html`). Da también el mismo enlace fijado al commit nuevo (`/<hash completo>/…`, que no depende de la caché) y, si sirve para comparar, el del commit anterior. Comprueba que responden 200 antes de pasarlos.
- No hagas commits, push ni publicación sin instrucciones del usuario. No crees tareas paralelas ni delegues salvo petición explícita.
- En el resumen indica qué cambió, cómo se verificó, qué fase y paso del plan queda hecho y cualquier límite material.

## Harness: reglas, specs, bugs y revisión

Lee [harness/REGLAS.md](harness/REGLAS.md) al empezar cualquier tarea. Antes de tocar una pantalla, abre su spec en `docs/pantallas/` (primera: [editor](docs/pantallas/editor.md)) y busca en [docs/bugs/INDICE.md](docs/bugs/INDICE.md). Las salidas HTML van en `docs/salidas/`. No uses memoria automática: lo que deba recordarse va a esos archivos. Flujo, roles y scripts: [harness/README.md](harness/README.md).
