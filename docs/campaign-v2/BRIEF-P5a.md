# Brief para Astra · Campaign-V2 · porción P5a «Movimiento, VEH y tirador»

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en `docs/campaign-v2/P5a-INFORME.md` («Suposiciones») y sigue.

## Dónde

- Worktree: `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`, rama `Campaign-V2`. P1–P4b y las funciones públicas de War de abajo están hechas y sin commit: no las deshagas.
- Escribe **solo dentro de este worktree**. No hagas commits, push, checkout, stash, reset, `npm install` ni descargas.

## Lee primero (no leas enteros los archivos de más de 600 líneas: usa `grep -n` y rangos)

1. `docs/campaign-v2/DECISIONES-WAYFINDER.md`, tickets **05, 09 y 10**. Son decisiones cerradas.
2. `docs/campaign-v2/receta/`: los esqueletos de `movimiento/`, `vehiculo/`, `paso.js`, `b6.js` y `pruebas/mecanicas.mjs`. Son la forma acordada: síguela y corrige lo que no encaje con el código real.
3. Los informes de P3b (eventos y fichas) y P4a (registro de modelos y escena en metros).
4. **Valores experimentales** de alcance, vida, cadencia y velocidad: `git show origin/ccr-684f16c6-yq5at1:docs/PROPUESTA-MECANICAS-BATALLA.md` y `git show origin/ccr-684f16c6-yq5at1:laboratorio/batalla/<archivo>` (lista los archivos con `git ls-tree -r --name-only origin/ccr-684f16c6-yq5at1 laboratorio/batalla`). Son ejemplos, no requisitos: van en el ensayo y en la ficha, no en el código.

## Objetivo de P5a

Demostrar con código que **añadir una mecánica cuesta lo prometido**, que es lo que más le importa al autor: pocos archivos propios, casi nada compartido y poco contexto que cargar. P5a paga los costes únicos que quedan y añade la primera mecánica móvil: el VEH, un vehículo controlado por el jugador que sale de la muralla. Se añade también el tirador, el enemigo que le dispara. Solo en los modos campaña y ensayo; en paridad no hay mecánicas.

## Entregables

1. **Ya hecho, no lo rehagas:** `reglas-war/index.js` exporta `leerEnemigos(mundo)` (copia plana, en casillas) y `danoEnArea(mundo, x, y, radio, dano, por)`. Este último trabaja en casillas y en el plano, sin altura; devuelve los ids alcanzados, cuenta los derribos para `derribosMin` y anota `golpe`/`derribo` con `datos.por`. Está probado en `pruebas/war-dano-en-area.mjs`. Inclúyelo en «Coste real» como coste único (1 archivo compartido, unas 20 líneas).
2. **`reglas-campaign-v2/paso.js`:**
   - el orden es fábrica → puente → batalla de War → mecánicas, con una línea por mecánica y llamada explícita (ticket 05, punto 7);
   - el daño de una mecánica llega a War en el paso siguiente;
   - V2 traduce entre metros y casillas solo aquí (ticket 09, punto 6), y las mecánicas trabajan en metros sin conocer el marco.
3. **Capacidad `mecanicas/movimiento/`** (ticket 10, Q9):
   - `moveTo(lugar)`, `stop()`, `await arrive()` y el evento `onArrive` sobre el transporte de P3b;
   - el campo activo es el marco de la batalla: nadie sale del rectángulo de los enemigos de War;
   - las fichas la declaran con `capacidades: ["movimiento"]`.
4. **Mecánica `mecanicas/vehiculo/` (VEH):**
   - sale por una puerta de la muralla (`marco.puertas`, filas locales; añade una puerta en el Nivel 1);
   - se mueve con `movimiento`;
   - dispara un **proyectil propio de V2** que, al impactar, llama al daño en área de War (ticket 10, Q10);
   - su programa usa `regularShoot(lugar | enemigo)` con las reglas de P3b, sin verbo nuevo;
   - tiene vida;
   - **unidad destruida** (ticket 10, Q12): mientras no existe vale `null` (`None` en Python); su programa se detiene y vuelve a la primera línea al reaparecer, con «aplicar ahora» de P3a; el árbol de P4b la muestra en gris con una cuenta atrás.
5. **Enemigo `tirador` de V2:**
   - vive en un campo propio de V2, no en War (ticket 05, punto 5);
   - dispara al VEH dentro de su alcance;
   - usa la primitiva de War como placeholder en las vistas.
6. **Fichas y modelos:**
   - las fichas de `vehiculo` y `tirador` siguen el formato de P3b (verbos, nombres JS y Python, firma, nota, paleta, seudocódigo, claves i18n e id de modelo);
   - una línea por modelo en `vista-3d/cv2/modelos.js`, con placeholder, porque los GLB de VEH no existen (`vehiculo_tubular.glb` es otro vehículo; puedes usarlo como placeholder si encaja, y anótalo);
   - los textos ES/EN van en `shared/i18n/campaign-v2/`.
7. **Ensayo de mecánica «Salida»** (ticket 07):
   - el VEH sale por la puerta y abate drones con un programa de partida;
   - se abre con `?serie=campaign-v2&ensayo=salida`;
   - los datos van en archivo propio, donde el ensayo y su nivel lo pidan (por ejemplo `niveles/ensayos/salida.js`).
8. **Prueba de la promesa:** `pruebas/campaign-v2-mecanicas.mjs`, a partir del esqueleto `receta/pruebas/mecanicas.mjs`:
   - comprueba que la mecánica se registra solo con sus archivos y su línea en `paso.js`;
   - juega «Salida» con semilla y comprueba la salida por la puerta, el movimiento hasta `arrive`, el impacto con daño en War al paso siguiente y la destrucción con `null` y reaparición desde la primera línea;
   - comprueba que en paridad no hay mecánicas y que la huella de War no cambia.
9. **`docs/campaign-v2/P5a-INFORME.md`** (60 líneas como mucho), con estas secciones:
   - **«Coste real»**: una tabla con los archivos propios y las líneas compartidas que tocó cada pieza: capacidad, VEH, tirador, ensayo y costes únicos. Compárala con la promesa del ticket 10;
   - los archivos tocados, cómo se prueba, Suposiciones y Faltantes;
   - una URL local con lo que debe verse.

   En `PLAN-PORCIONES.md`, divide P5 en P5a (esta porción) y P5b (WHL con reaparición, minador y menú de pruebas), y marca P5a como «hecha» solo si las pruebas pasan.

## Fuera de P5a (no lo hagas; si tienta, anótalo)

WHL, minador, menú de pruebas (P5b), `onDamage` y `onEnemySeen` (salvo que el VEH los necesite de forma imprescindible), radar, la marca de 6 s, `track` y los GLB nuevos.

## Criterio de terminado

- `node pruebas/todas.mjs`: las pruebas que ya pasaban siguen en ok, más las nuevas en ok, con solo los 7 fallos de la línea base (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`).
- `git diff -- paquetes/reglas-war` (respecto al índice) queda vacío, y `pruebas/referencias/partidas.json` no cambia.

## Cómo trabajar

- Cambios mínimos y localizados.
- Si para que la mecánica entre hay que tocar más archivos compartidos que los prometidos, hazlo, pero anótalo en «Coste real»: es el dato que se busca.
- Haz una sola pasada. Si tras dos intentos una prueba sigue fallando por algo fuera de P5a, anótalo en Faltantes y para.
- Al terminar, tu último mensaje es solo esto: la lista de archivos creados o cambiados, y el resultado de `node pruebas/todas.mjs` (la línea de resumen y los nombres de las pruebas que fallan).
