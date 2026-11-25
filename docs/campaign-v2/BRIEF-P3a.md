# Brief para Astra · Campaign-V2 · porción P3a «Runtime base del primer corte»

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en `docs/campaign-v2/P3a-INFORME.md` («Suposiciones») y sigue.

## Dónde

- Worktree: `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`, rama `Campaign-V2`. P1 y P2 están hechas y sin commit: son tu punto de partida y no las deshagas.
- Escribe **solo dentro de este worktree**. No hagas commits, push, checkout, stash ni reset. No hagas `npm install` ni descargas (escribe menos de 50 MB en total).

## Lee primero (no leas enteros los archivos de más de 600 líneas: usa `grep -n` y rangos)

1. `docs/campaign-v2/P1-INFORME.md` y `docs/campaign-v2/P2-INFORME.md`.
2. `docs/campaign-v2/research/02-runtime-laboratorio-vs-anfitrion.md`: qué falta en el anfitrión de trunk, con líneas y archivos.
3. `docs/campaign-v2/DECISIONES-WAYFINDER.md`, tickets **07** (qué entra en el primer corte y qué se activa en cada modo) y **11** (la semilla del intento y la grabación). Son decisiones cerradas: no las reabras.
4. `CONTEXT.md`, en las entradas «Ensayo», «Modo paridad», «Aplicar ahora» y «Checkpoint», si existen.
5. `paquetes/anfitrion/` (`anfitrion.js`, `api.js`, `unidad.js`, `despertar.js`), `paquetes/nucleo/index.js` (la grabación, cerca de las líneas 126–149) y, en `paquetes/app/juego/`, `ciclo-programas.js`, `aplicar-programas.js`, `pulsos.js`, `bucle.js` y `campaign-v2.js`.

## Objetivo de P3a

Las cuatro piezas de runtime del primer corte que **no** dependen de los eventos. Solo están activas en los modos campaña y ensayo de Campaign-V2. En modo paridad, y en War, Factory y Campaign H0–H5, todo sigue exactamente como hoy.

## Entregables

1. **Errores aislados por unidad.**
   - Un error en el programa de una unidad detiene solo esa unidad.
   - La consola muestra el error con su línea y la unidad.
   - Las demás unidades y la partida siguen.
   - Una unidad detenida por un error no se reinicia sola: espera a que el jugador use «Aplicar ahora» o a que se reinicie la partida.
   - Tiene que ser una opción del anfitrión que V2 enciende. Sin ella, el comportamiento sigue como hoy: un error termina la partida. Así no cambia ninguna de las 41 referencias.
2. **Aplicar ahora.**
   - Recarga en caliente el programa de una unidad (`recargar` en el anfitrión) sin recrear el mundo.
   - El programa nuevo arranca en su primera línea, y la unidad conserva su estado de juego (munición, atasco, posición).
   - En la interfaz de V2, el botón o atajo existente que hoy reinicia todo («Ejecutar» con la partida en marcha) pasa a aplicar ahora en la unidad editada. Reutiliza la UI de trunk y no crees paneles.
   - En paridad no existe.
3. **Grabar y repetir entradas.**
   - La grabación de un intento empieza en el checkpoint, o al empezar el ensayo, y guarda tres cosas:
     - la semilla del intento (`semillaIntento`, que P2 dejó en el mundo);
     - las órdenes del jugador, con su paso;
     - las reprogramaciones de «Aplicar ahora», con su paso y la fuente.
   - Repetir esa grabación desde el mismo checkpoint da la **misma huella**.
   - Extiende la grabación de `nucleo` sin cambiar el formato de las referencias existentes: la grabación vieja tiene que seguir leyéndose.
   - Sirve para repetir y probar, no para guardar: no la metas en el checkpoint.
   - En la app basta con una forma de repetir el último intento (un botón existente o un parámetro de URL); anota en el informe cómo se usa.
4. **Pausa con órdenes en espera.**
   - Con la partida en pausa, el jugador puede dar órdenes (las que ya existen en War) y aplicar programas.
   - Quedan en una cola visible en la consola y se aplican al reanudar, en orden y en el mismo paso.
   - La grabación las anota en el paso en que se aplican.
5. **Pruebas** registradas en `pruebas/todas.mjs`, en Node y con semilla:
   - **error aislado:** dos torretas, una con un programa que lanza un error en la línea 3. Esa unidad se detiene con el error y su línea, y la otra sigue disparando. En modo paridad, el mismo caso termina la partida como hoy;
   - **aplicar ahora:** a mitad de B1, cambiar el programa de una torreta conserva su munición y su atasco, y el programa nuevo empieza en la primera línea;
   - **repetir:** un intento con órdenes y una reprogramación, repetido desde su grabación, da la misma huella, los mismos pasos y el mismo resultado;
   - **pausa:** dos órdenes dadas en pausa se aplican en el paso de la reanudación y en orden;
   - todas las pruebas anteriores siguen en verde: las 41 referencias del conductor, la paridad de V2, el checkpoint y la frontera de imports.
6. **`docs/campaign-v2/P3a-INFORME.md`** (60 líneas como mucho): qué se hizo, los archivos tocados, cómo se prueba, Suposiciones y Faltantes.
   - En `PLAN-PORCIONES.md`, divide la fila P3 en P3a (esta porción) y P3b (eventos, clic programado, gestos, nodo «cuando» y Python).
   - Marca P3a como «hecha» solo si las pruebas pasan.

## Fuera de P3a (no lo hagas; si tienta, anótalo)

Transporte de eventos, varios hilos por programa, `onClick` y clic programado, `regularShoot(objetivo)`, gestos nuevos y orden puntual por clic, el nodo «cuando» y Python (todo eso es P3b). Además: 3D (P4), mecánicas (P5) y reaparición de unidades.

## Criterio de terminado

- `node pruebas/todas.mjs` da **68 ok más las pruebas nuevas en ok**, con los mismos 7 fallos de la línea base (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`, por falta de `node_modules`). No arregles esos 7.
- `git diff -- paquetes/reglas-war` no cambia respecto a lo que dejó P2, y `pruebas/referencias/partidas.json` no cambia.

## Cómo trabajar

- Cambios mínimos y localizados.
- Cada pieza nueva es una opción que el anfitrión o el conductor reciben. Se enciende en un solo sitio, `app/juego/campaign-v2.js`, y no se reparten ramas por serie.
- No añadas abstracciones que P3a no pida.
- Haz una sola pasada: lee, implementa, prueba, corrige lo que falle y termina. Si tras dos intentos una prueba sigue fallando por algo fuera de P3a, anótalo en Faltantes y para.
- Al terminar, tu último mensaje es solo esto: la lista de archivos creados o cambiados, y el resultado de `node pruebas/todas.mjs` (la línea de resumen y los nombres de las pruebas que fallan).
