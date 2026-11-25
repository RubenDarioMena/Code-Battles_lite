# Brief para Astra · Campaign-V2 · porción «Página propia»

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en `docs/campaign-v2/PAGINA-INFORME.md` («Suposiciones») y sigue.

## Dónde

- Worktree: `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`, rama `Campaign-V2`. P1–P5a están hechas y sin commit: no deshagas su comportamiento. `HEAD` es trunk sin nada de V2.
- Escribe **solo dentro de este worktree**. No hagas commits, push, checkout, stash, reset, `npm install` ni descargas.

## Por qué

El autor esperaba un prototipo **independiente**. Hoy V2 corre dentro de la página de Rocket Launcher como `?serie=campaign-v2`: comparte su HTML, sus menús (selector de retos de War, «Probar en dispositivos», enlaces a Factory/War/Campaign) y su almacenamiento. Lo viejo estorba al revisar, y a veces un menú viejo lo deja sin poder volver a lo nuevo. Además, V2 importa la producción de `paquetes/reglas-campaign`, y el autor no quiere nada de Campaign salvo como referencia visual.

## Lee primero (no leas enteros los archivos de más de 600 líneas: usa `grep -n` y rangos)

1. `paquetes/app/README.md` y `paquetes/app/juego/campaign-v2.js` (la composición de V2).
2. `git diff --cached HEAD --stat` para ver todo lo que V2 añadió sobre trunk.
3. `Prototypes/Rocket Launcher/index.html`, `js/juego.js` y `js/servicios.js`: cómo arranca hoy.
4. `Prototypes/Tres vistas/`: ejemplo de una página retirada que solo redirige.

## Entregables

1. **Página nueva `Prototypes/Campaign-V2/`** con `index.html`, `js/juego.js`, `js/servicios.js` y `css/`.
   - El HTML contiene **solo lo que V2 usa**: la zona de la fábrica (H0) y de la batalla con el selector 3D/Plano/Batalla, el HUD (Misión «!» y menú ⋯), el editor de código como en trunk, la ficha o inspector, el árbol de unidades, la consola y el mando (Ejecutar, Pausa, velocidad, Reiniciar).
   - Fuera: el selector de series, los enlaces a la portada, Factory, War o Campaign, «Probar en dispositivos», el selector de retos de War, el editor de terreno y todo widget que no sirva a los hitos de V2 o al editor. Regla: si no lo usa ningún hito de V2, no entra.
   - El selector de etapa lista solo las etapas de V2 (H0, B1–B5 y los ensayos).
   - Los scripts y estilos compartidos se cargan por ruta relativa (`../../shared/…`, `../../paquetes/…`). No dupliques código de los paquetes.
2. **Arranque propio.** La página fija la serie V2 desde su `js/juego.js`, sin depender de `?serie=`. `ensayo`, `modo=paridad`, `batalla` y `forma` siguen funcionando como parámetros.
3. **Almacenamiento propio.** V2 lee y escribe solo sus claves (un prefijo propio y la de checkpoints que ya tiene). No lee claves de War, Factory ni Campaign (`cmg-banco02`, `cmg-banco03` y las demás).
4. **Modelos.** Los GLB que solo usa V2 (`torreta_observacion.glb`, `vehiculo_tubular.glb` y la versión nueva de `t1.glb`) pasan a `Prototypes/Campaign-V2/modelos/`. `Prototypes/Rocket Launcher/modelos/` vuelve a `HEAD`. Ajusta las rutas del registro de modelos.
5. **Rocket Launcher vuelve a trunk.**
   - `index.html`, `css/campaign.css` y `js/servicios.js` quedan idénticos a `HEAD`, y `css/campaign-v2.css` sale de allí: sus reglas pasan a `Prototypes/Campaign-V2/css/`.
   - `?serie=campaign-v2` en Rocket Launcher ya no monta V2. Si alguien llega con ese parámetro, redirige a la página nueva conservando los demás parámetros, como hace `Tres vistas`.
6. **Nada de `paquetes/reglas-campaign`.**
   - Copia a `paquetes/reglas-campaign-v2/` (por ejemplo, `fabrica/produccion.js`) solo lo que V2 usa de la producción: robots, máquinas, recetas, bodega, `serializar` y `restaurar`.
   - `paquetes/reglas-campaign/` vuelve a quedar idéntico a `HEAD`.
   - Ningún archivo de V2 importa de `reglas-campaign`. Añade una prueba que lo compruebe.
7. **La app compartida (`paquetes/app/`).**
   - No hagas una refactorización grande. Basta con que las ramas de V2 solo se activen cuando la página nueva lo pide desde su arranque, no por un parámetro de URL en otra página.
   - War, Factory y Campaign en Rocket Launcher se comportan igual que en `HEAD`: las pruebas de fronteras lo dicen.
   - En el informe, lista cuántas líneas de V2 quedan en archivos compartidos de `paquetes/app/`, por archivo.
8. **Pruebas y documentación.**
   - Adapta las pruebas que abrían `?serie=campaign-v2` en Rocket Launcher para que usen la página nueva (el emulador DOM de `pruebas/juego-dom.mjs` sirve).
   - Añade una prueba de que el HTML nuevo no tiene enlaces ni botones a otras series ni a la portada, y de que arranca en H0 sin errores.
   - Actualiza `paquetes/app/README.md` y `PROGRESO.md`, y escribe `docs/campaign-v2/PAGINA-INFORME.md` con lo que salió, lo que entró y las suposiciones.

## Criterio de terminado

- `node pruebas/todas.mjs`: lo que ya pasaba sigue en ok, más las pruebas nuevas en ok, con solo los 7 fallos de la línea base (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`).
- `git diff HEAD -- "Prototypes/Rocket Launcher/css/campaign.css" "Prototypes/Rocket Launcher/js/servicios.js" "Prototypes/Rocket Launcher/modelos" paquetes/reglas-campaign` queda vacío.
- `git diff HEAD -- "Prototypes/Rocket Launcher/index.html"` queda vacío o contiene solo la redirección del punto 5.
- `git diff -- paquetes/reglas-war` (respecto al índice) queda vacío, y `pruebas/referencias/partidas.json` no cambia.
- `http://127.0.0.1:8779/Prototypes/Campaign-V2/` abre H0, y `?ensayo=b1` y `?ensayo=salida` abren sus etapas.

## Cómo trabajar

- Cambios mínimos y localizados. Mueve en lugar de reescribir.
- Haz una sola pasada. Si tras dos intentos una prueba sigue fallando por algo fuera de esta porción, anótalo en «Faltantes» y para.
- No abras puertos ni navegadores: el sandbox no lo permite. La revisión en navegador la hace Claude.
- Al terminar, tu último mensaje es solo esto: la lista de archivos creados, movidos o cambiados, y el resultado de `node pruebas/todas.mjs` (la línea de resumen y los nombres de las pruebas que fallan).
