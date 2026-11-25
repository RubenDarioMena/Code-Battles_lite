# Brief para Astra · Campaign-V2 · porción P4a «Escenario 3D en metros»

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en `docs/campaign-v2/P4a-INFORME.md` («Suposiciones») y sigue.

## Dónde

- Worktree: `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`, rama `Campaign-V2`. P1, P2, P3a y P3b están hechas y sin commit, igual que la parte lógica de P4a (abajo): no las deshagas.
- **Los archivos de `origin/assets-3d` ya están copiados en el worktree**: `paquetes/rig`, `vista-3d/rig.js`, `arte/blender/papercraft/glb/…`, `torreta_observacion.glb` y `shared/muralla`. No hagas merge ni operaciones de git.
- Escribe **solo dentro de este worktree**. No hagas commits, push, checkout, stash ni reset. No hagas `npm install` ni descargas. No regeneres arte con Blender. Escribe menos de 30 MB nuevos.

## Lee primero (no leas enteros los archivos de más de 600 líneas: usa `grep -n` y rangos)

1. `docs/campaign-v2/research/03-assets-batalla-1-y-carga.md`: el inventario, los rigs, la cadena de carga y la reescritura a raw.githubusercontent.
2. `docs/campaign-v2/DECISIONES-WAYFINDER.md`, tickets **03, 05 (punto 6) y 09**, y en `docs/campaign-v2/DECISIONES-GRILL.md` la sección «Mundo y 3D». Son decisiones cerradas.
3. Los informes `P1` a `P3b` en `docs/campaign-v2/`.
4. `paquetes/vista-3d/` (`war.js`, `instancias-war.js`, `factory.js`, `rig.js`, `camara.js`, `index.js`), `paquetes/app/juego/vistas.js`, `Prototypes/Rocket Launcher/js/servicios.js`, `paquetes/rig/README.md`, y en `arte/blender/papercraft/` `README.md`, `mapa-ampliado.json` y `visor/visor.js` (cómo el visor carga el terreno, la muralla y sus texturas).

## Objetivo de P4a

En los modos campaña y ensayo de Campaign-V2, la vista 3D muestra la Batalla dentro del mundo papercraft, en metros:

- la sección del mapa delante de la muralla;
- la muralla Traba con sus bastiones;
- la torreta esfera (GLB con rig) que apunta, abre la compuerta, dispara y muestra el atasco;
- los enemigos con las primitivas actuales de War;
- la vista de combate oscura, que se enciende sola al empezar una Batalla.

La simulación manda: ninguna regla cambia de sitio por el arte.

## Ya hecho (no lo rehagas; léelo y úsalo)

La lógica de P4a ya está escrita y probada en `pruebas/campaign-v2-marco.mjs` (en verde):

- `paquetes/reglas-campaign-v2/marco.js`: `escenaEnMetros`, `puntoEnMarco(punto, origen)` y `puntoEnMetros`, reexportados desde `reglas-campaign-v2/index.js`.
- **`reglas.escenaMetros(mundo)`**: la escena en metros que deben consumir las vistas de V2. `reglas.escena(mundo)` sigue en casillas y no se toca, igual que la `instantanea` y las huellas.
  - En Batalla suma `marco.origen` = (204, 72) y añade `marco: { origen, tam: [32, 18] }`.
  - En H0 suma el origen de la fábrica `nivel.fabrica.origen` = (103, 22) y añade `marco: { origen }`.
  - Fuera de paridad añade `bastiones: [{ indice, cx, cy, ocupado }]`, en metros; `ocupado` es el id de la torreta o `null`. En paridad no hay bastiones.
  - War guarda las máquinas en `cx/cy` y los enemigos en `x/y`; ambos pares llegan trasladados.
- `marco.bastiones` = `[[6, 5], [6, 9], [6, 13]]`, en casillas locales, igual a los puestos de War. El validador los comprueba.
- **Orden del colocador**: `{ verbo: 'colocar', unidad: 'LAU-01', args: [indiceBastion], origen: 'jugador' }`.
  - Con la Batalla en t = 0, la vuelve a montar con la misma semilla.
  - Con la Batalla en marcha, vale para la siguiente y entra en el checkpoint.
  - Si el bastión está ocupado, no existe o la unidad no existe, anota el suceso `colocar-descartada` con `datos.motivo`.
  - En paridad se ignora.
- **Geometría**: la muralla de `mapa-ampliado.json` pasa por x = 207 m, que es la línea de brechas de War (x local 3). Los bastiones están en x local 6 (centro en 210,5 m), es decir, sobresalen 3,5 m por delante de la cara de la muralla. No los muevas: cambiaría el equilibrio de War.

## Entregables

1. **Registro de modelos `paquetes/vista-3d/cv2/modelos.js`** (ticket 05, punto 6, y ticket 09, punto 4):
   - cada id de modelo (texto) da su URL, escala, desplazamiento, punto de anclaje y mapa del rig;
   - una caché de cargas, y un placeholder si una carga falla;
   - una sola función común que resuelve las URL de binarios: si el host acaba en `githack.com`, los `.glb` y sus `.png` se piden a `raw.githubusercontent.com` con la misma ruta, como hace `visor.js`. Debe servir también para las texturas externas de los GLB papercraft (`../../texturas/*.png`);
   - entradas: `torreta-esfera`, `muralla-traba-tramo`, `muralla-traba-nudo` (escalados ≈ 0,54: el nudo debe tener 3 m de fondo y ≈ 8,6 m de alto), `torreon-cordon` y los trozos de terreno que hagan falta.
2. **Vista 3D de Campaign-V2 en `paquetes/vista-3d/cv2/`** (con un `index.js` y los módulos que necesite). Se elige en un solo sitio, `app/juego/campaign-v2.js` o `vistas.js`, mediante la composición, y se alimenta con `reglas.escenaMetros(mundo)`:
   - reutiliza el dibujo de unidades de War (primitivas e instancias) para enemigos, sensores y reparador, alimentado con metros;
   - **terreno:** carga solo los trozos `terreno-F-C.glb` que cubren la batalla (x 204–236, y 72–90) y la franja de la fábrica (x ≈ 174–207). Encuadra la cámara para que el corte del mapa no se note: niebla, límites de cámara y un fondo de color del papel;
   - **muralla:**
     - tramos de Traba que siguen la polilínea de la muralla de `mapa-ampliado.json` en la zona visible, con la cara frontal en x = 207 m;
     - un nudo de Traba (bastión) en cada `escenaMetros().bastiones`;
     - como el bastión sobresale 3,5 m, únelo a la muralla con un tramo corto perpendicular o como mejor encaje con las piezas;
   - **torreta:** `torreta_observacion.glb` con `leerRig` y `conectarRig`, puesta sobre el bastión en la posición de simulación del lanzador:
     - `azimut` sigue el `yaw` de War, e `inclinacion` va hacia el objetivo;
     - `hojas` se abre mientras está en modo de fuego;
     - `extension` da un retroceso corto en cada disparo;
     - el atasco se muestra como estado de la vista (hojas cerradas y luz o emisivo ámbar), porque el rig no tiene control de atasco;
     - usa el LOD L0 cerca y L1/L2 lejos, si es barato;
     - la traducción del estado del lanzador a los valores del rig es una **función pura sin Three**, para poder probarla en Node;
   - **material papercraft compartido** (`vista-3d/cv2/materiales.js`): color por vértice y texturas de relieve y fibra, como el visor. Debe funcionar con el `WebGLRenderer` actual. Deja la estructura lista para una variante TSL, pero no cambies de renderizador: los VFX GLSL no corren en WebGPU. Anótalo en Suposiciones;
   - **vista de combate:** un modo oscuro, sin texturas, con aristas o emisivos estilo Tron, sobre la misma escena. Se enciende sola al empezar una Batalla y se puede volver al papercraft con el selector que ya exista;
   - **durante H0:** la cámara encuadra la fábrica. Basta con dibujar las máquinas de la fábrica de P2 como placeholders en sus metros, que ya llegan trasladados. El plano 2D de Campaign sigue disponible.
3. **Clics en 3D:**
   - `app/juego/gestos-clic.js` recibe de cada vista `coordenadasEn(x, y)`, que debe devolver **casillas del marco**, como hoy en 2D. En 3D, el rayo sobre el terreno da metros: tradúcelos con `puntoEnMarco(punto, escena.marco.origen)` en el adaptador de la vista o en la composición, nunca dentro de las reglas;
   - `unidadEn` debe acertar enemigos y torretas en 3D;
   - la orden puntual y el clic programado de P3b funcionan igual en 2D y en 3D.
4. **UI mínima del colocador:**
   - en campaña y ensayo, con la Batalla sin empezar (t = 0) o en pausa, se selecciona una torreta y se hace clic en un bastión libre; eso envía la orden `colocar` por la cola de órdenes de la partida, igual que las demás órdenes del jugador;
   - resalta los bastiones libres mientras hay una torreta seleccionada;
   - si llega `colocar-descartada`, muestra un aviso breve;
   - en paridad no aparece.
5. **Losa de la fábrica** (ticket 09, punto 5): comprueba si la losa está horneada en `terreno-F-C.glb` leyendo los GLB o `mapa.py`. **No regeneres arte.** Si está horneada y no coincide con x ≈ 174–207, deja las máquinas donde mandan las reglas y anótalo en Faltantes con la propuesta.
6. **2D:** la vista 2D sigue funcionando en V2. Puede seguir leyendo `reglas.escena` en casillas si pasarla a metros cuesta más que restar el origen del marco; anota lo que elijas. No hace falta arte nuevo en 2D.
7. **Pruebas** registradas en `pruebas/todas.mjs`, en Node:
   - el registro: cada id resuelve, la reescritura githack → raw de `.glb` y `.png`, y el placeholder cuando falla;
   - el rig: los valores de `azimut`, `hojas`, `extension` y el atasco que calcula la función pura para un estado de lanzador dado;
   - la traducción de clics: un punto en metros llega a `coordenadasEn` en casillas del marco;
   - `pruebas/campaign-v2-marco.mjs`, las pruebas de Three que ya existen (`three-r180`, `rig-three` y las de `vista-3d/pruebas`) y todo lo anterior siguen en verde.
8. **`docs/campaign-v2/P4a-INFORME.md`** (60 líneas como mucho):
   - qué se hizo, los archivos tocados, cómo se prueba, Suposiciones y Faltantes;
   - **una lista de URL locales para revisar a mano en el navegador** (por ejemplo `?serie=campaign-v2&ensayo=b1`), con lo que debe verse en cada una. La revisión visual la hace otra persona: tu validación en Node no basta, así que describe lo que debe verse.
   - En `PLAN-PORCIONES.md`, divide la fila P4 en P4a (esta porción) y P4b (la UI del primer hito: botón Misión «!», metas en columna, selector 3D/2D centrado, fichas, árbol de unidades y menú ⋯), y marca P4a como «hecha» solo si las pruebas pasan.

## Fuera de P4a (no lo hagas; si tienta, anótalo)

La UI del primer hito (P4b), cambiar la lógica del marco o del colocador (si ves un fallo, anótalo), el menú de pruebas, el selector de renderizador y WebGPU, los GLB de VEH y WHL, la muralla de vóxeles rompible, mover las máquinas de la fábrica con el colocador y regenerar el terreno.

## Criterio de terminado

- `node pruebas/todas.mjs`: las pruebas que ya pasaban siguen en ok, más las nuevas en ok, con solo los 7 fallos de la línea base (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`). Si las pruebas que llegan de `assets-3d` añaden un fallo que solo se debe a que falta `node_modules`, anótalo.
- `git diff -- paquetes/reglas-war pruebas/referencias/partidas.json` (respecto al índice) queda vacío.

## Cómo trabajar

- Cambios localizados.
- War, Factory y Campaign H0–H5 se ven exactamente como antes.
- Haz una sola pasada. Si tras dos intentos una prueba sigue fallando por algo fuera de P4a, anótalo en Faltantes y para.
- Al terminar, tu último mensaje es solo esto: la lista de archivos creados o cambiados, y el resultado de `node pruebas/todas.mjs` (la línea de resumen y los nombres de las pruebas que fallan).
