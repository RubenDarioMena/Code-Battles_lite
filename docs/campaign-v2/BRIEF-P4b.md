# Brief para Astra · Campaign-V2 · porción P4b «UI del primer hito»

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en `docs/campaign-v2/P4b-INFORME.md` («Suposiciones») y sigue.

## Dónde

- Worktree: `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`, rama `Campaign-V2`. P1–P4a están hechas y sin commit: no las deshagas.
- Escribe **solo dentro de este worktree**. No hagas commits, push, checkout, stash, reset, `npm install` ni descargas. Escribe menos de 10 MB nuevos.

## Lee primero (no leas enteros los archivos de más de 600 líneas: usa `grep -n` y rangos)

1. `docs/campaign-v2/DECISIONES-GRILL.md`, secciones «Interfaz» y «Mundo y 3D» (iconos 2D). Son decisiones cerradas.
2. Los informes de P2, P3a, P3b y P4a en `docs/campaign-v2/`.
3. `CONTEXT.md`, en las entradas «Árbol de unidades», «Programa compartido», «Ficha» y «Misión», si existen.
4. `paquetes/interfaz/` (sobre todo `info-reto.js`, `inspector.js`, `layout-panel.js` y la tira de tarjetas de unidades: búscala), `paquetes/app/juego/` (`estado.js`, `programas.js`, `campaign-v2.js`) y `Prototypes/Rocket Launcher/index.html` y su CSS.
5. **Solo como referencia visual**, la rama `origin/campaign-nivel-1`, leída con `git show origin/campaign-nivel-1:<ruta>` sin hacer checkout:
   - `Prototypes/Rocket Launcher/js/campaign-hud.js`;
   - `Prototypes/Rocket Launcher/css/campaign.css`;
   - `Prototypes/Rocket Launcher/img/campaign/maquinas/svg-b/*.svg`.

   **Su código no se usa:** la UI se escribe sobre la arquitectura de trunk (`paquetes/interfaz`, i18n, el estado de `app`). Sí puedes copiar sus SVG, sus colores y su estructura de carpetas de imágenes.

## Objetivo de P4b

La interfaz del primer entregable en los modos campaña y ensayo de Campaign-V2: que la Batalla 1 se juegue con la UI nueva del mapa y el panel de código nuevo. War, Factory y Campaign H0–H5 se ven exactamente como antes. El editor (CodeMirror, paleta, sugerencias, revisión) no cambia.

## Entregables

1. **Árbol de unidades** (sustituye a la tira de tarjetas en V2, también en el móvil):
   - plegable, arriba a la izquierda del panel de código;
   - agrupado por tipo, con una casilla por unidad, una por tipo y una para todas;
   - **selección única compartida** entre el mapa y el árbol: seleccionar en uno marca en el otro;
   - las unidades vinculadas muestran su vínculo.
2. **Programas compartidos:**
   - por defecto, las unidades seleccionadas comparten un programa: editar con varias seleccionadas edita el programa común;
   - una acción «Desvincular» da a una unidad su propia copia;
   - los vínculos se guardan donde P2 guarda los programas y entran en el checkpoint (P2 ya los trata como datos opacos);
   - aprovecha lo que trunk ya tiene para editar varias unidades (`edicion.ids`, `mixto`, «Copiar a los demás lanzadores») en lugar de crear un modelo paralelo.
3. **HUD del mapa:**
   - botón **Misión «!»**: abre el título, el texto y las metas de la Batalla o del hito;
   - **metas en columna**, con su progreso en vivo (brechas, derribados, atascos y tiempo de War; en H0, la meta de fábrica);
   - **selector 3D/2D centrado** que conviva con la vista de combate automática de P4a. Hoy P4a muestra arriba a la izquierda «3D | Plano | Batalla», y «Batalla» alterna entre papel y combate: centra el conjunto sin perder ese conmutador;
   - **menú ⋯** con ajustes, idioma, volver a un checkpoint y el enlace al menú de pruebas si existe (`?pruebas=1`; si aún no existe, déjalo preparado y anótalo).
4. **Fichas:**
   - la **ficha compacta** actual adaptada al estilo nuevo;
   - una **ficha completa** con el modelo 3D de la unidad, usando el registro de P4a (`vista-3d/cv2/modelos.js`), que gira despacio, más sus estadísticas. Para unidades sin GLB se usa su placeholder.
5. **Vida de las unidades:** barras de vida sobre los enemigos en 3D y 2D, con los `hp` de War, discretas y sin tapar la escena. Las torretas de War no tienen vida: no inventes una.
6. **Iconos 2D** (DECISIONES-GRILL, «Iconos 2D»): robots vectoriales vistos desde arriba y máquinas en isométrica ligera, con los SVG de `svg-b` si encajan. Los estados van en ámbar, verde y azul, y el rojo queda reservado para el daño. Solo en la vista 2D de V2.
7. **Móvil:** la interfaz de trunk con pantalla completa por defecto; la única excepción es el árbol de unidades. Comprueba que el árbol y el HUD caben en 375 × 812.
8. **Textos:** todos van en `shared/i18n/campaign-v2/` (ES y EN), sin textos sueltos en el código.
9. **Pruebas** registradas en `pruebas/todas.mjs` (DOM emulado, como `juego-arranque.mjs`):
   - árbol: las casillas de tipo y de todas, y la selección compartida con el mapa;
   - programas compartidos y «Desvincular», y que los vínculos sobreviven al checkpoint;
   - Misión y metas en vivo;
   - menú ⋯ → volver a un checkpoint;
   - que War sigue con su tira de tarjetas;
   - todo lo anterior en verde.
10. **Ajustes de P4a vistos en el navegador real:**
    - el encuadre inicial de la Batalla en 3D enfoca la muralla y corta el fondo del campo. Debe verse el campo entero, x 204–236 m y la entrada de los enemigos, sin perder los bastiones; el encuadre está en `crearCamara3D`, con su `zona`, y en `vista-3d/cv2/index.js`;
    - en 3D, el clic izquierdo selecciona y el derecho entrega el clic al programa (P3b). Añade a la Misión o a la ficha una pista breve (i18n) para que el jugador lo sepa.
11. **`docs/campaign-v2/P4b-INFORME.md`** (60 líneas como mucho):
    - qué se hizo, los archivos tocados, cómo se prueba, Suposiciones y Faltantes;
    - **una lista de comprobaciones visuales** con su URL local, para PC y para móvil, que hará otra persona en el navegador.

    Marca P4b como «hecha» en `PLAN-PORCIONES.md` solo si las pruebas pasan.

## Fuera de P4b (no lo hagas; si tienta, anótalo)

Archivo de programas, guardado en varias ranuras, menú Máquinas, colocación libre de máquinas, el menú de pruebas completo (P5), unidades destruidas en gris con cuenta atrás (P5) y cambios en el editor.

## Criterio de terminado

- `node pruebas/todas.mjs`: las pruebas que ya pasaban siguen en ok, más las nuevas en ok, con solo los 7 fallos de la línea base (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`).
- `git diff -- paquetes/reglas-war pruebas/referencias/partidas.json` (respecto al índice) queda vacío.

## Cómo trabajar

- Cambios localizados. El caso V2 se elige en la composición (`app/juego/campaign-v2.js`), sin repartir ramas por serie.
- Haz una sola pasada. Si tras dos intentos una prueba sigue fallando por algo fuera de P4b, anótalo en Faltantes y para.
- Al terminar, tu último mensaje es solo esto: la lista de archivos creados o cambiados, y el resultado de `node pruebas/todas.mjs` (la línea de resumen y los nombres de las pruebas que fallan).
