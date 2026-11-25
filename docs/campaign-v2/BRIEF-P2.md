# Brief para Astra · Campaign-V2 · porción P2 «Fábrica, puente y checkpoint»

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en `docs/campaign-v2/P2-INFORME.md` («Suposiciones») y sigue.

## Dónde

- Worktree: `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`, rama `Campaign-V2`. P1 ya está hecha y sin commit: es tu punto de partida y no la deshagas.
- Escribe **solo dentro de este worktree**. No hagas commits, push, checkout, stash ni reset. No hagas `npm install` ni descargas (escribe menos de 50 MB en total).

## Lee primero (no leas enteros los archivos de más de 600 líneas: usa `grep -n` y rangos)

1. `docs/campaign-v2/P1-INFORME.md` y el paquete `paquetes/reglas-campaign-v2/` (lo que hay ahora).
2. `docs/campaign-v2/DECISIONES-WAYFINDER.md`, tickets **04, 08 y 11**, que son los de esta porción. Son decisiones cerradas: no las reabras. Para el orden de los hitos y la fábrica recortada, mira las líneas 14–24 de `docs/campaign-v2/DECISIONES-GRILL.md`.
3. `CONTEXT.md`, en las entradas «Bodega», «Checkpoint», «Hito», «Ensayo», «Modo paridad» y «Programa de la lección».
4. `paquetes/reglas-campaign/` (`estado.js`, `mundo.js`, `nivel.js`, `index.js`) y sus pruebas (`pruebas/campaign-*.cjs`, `pruebas/partida-campaign*.mjs`).
5. En `paquetes/reglas-war/mundo.js`, la recarga del suministro (cerca de la línea 164), y el `index.js` de `reglas-war`.
6. Cómo trunk guarda y restaura el Campaign (`guardarCheckpoint` / `volverA` / `conProgramas`; búscalos con `grep -rn` en `paquetes/`).

## Objetivo de P2

Que el Nivel 1 corra como un **mundo continuo**: el hito de fábrica H0 produce munición básica, la bodega de la muralla abastece a la torreta en B1…B5 y un checkpoint guarda y restaura el estado en la frontera de cada hito. Todo comprobable en Node. La paridad de P1 sigue en verde.

## Paso 0 · referencias antes de tocar nada (ticket 04, punto 7)

Graba desde War, sin cambios en War:

- una **victoria de la Batalla 1**: busca una semilla con un programa simple o con los programas de solución si existen;
- una **partida con atascos**, en cualquier Batalla 1–5.

Añádelas como referencias nuevas, con el mismo formato y la misma herramienta que `pruebas/referencias/partidas.json` (mira `pruebas/grabar-regresiones-war.mjs` y `pruebas/partida-referencias.mjs`). Haz que la prueba de paridad de V2 también las cubra. Las 10 referencias existentes no deben cambiar.

## Entregables

1. **`reglas-campaign/produccion.js` extraído (ticket 04, punto 3).**
   - Robots, piezas, recetas, máquinas, `serializar` / `restaurar` y la lista de metas `[{ k, tipo: "en" | "lotes" | "banda", … }]` pasan a ser datos y funciones de `produccion.js`.
   - H0–H5 de Campaign lo sigue usando. **Sus referencias y pruebas actuales no cambian**: son las que vigilan la extracción.
   - Mueve, no reescribas: cambios mínimos en `estado.js` y `mundo.js`.
2. **Una sola función pública nueva en `reglas-war/index.js` para fijar el suministro** de un lanzador (ticket 04, punto 2). Por defecto War se comporta igual que hoy (suministro infinito al ritmo del reto). No cambia ninguna otra lógica de War, y sus referencias siguen idénticas.
3. **Composición en `reglas-campaign-v2`:**
   - `app` inyecta la producción igual que inyecta War. `reglas-campaign-v2` sigue importando solo `nucleo` y `protocolo`.
   - Mundo compuesto `{ hito, modo, fabrica, bodega, batalla | null, … }`.
   - Cada paso sigue el orden **fábrica → puente → batalla**. Entre Batallas no hay mundo de War, y en modo paridad solo corre la batalla, con el puente apagado.
4. **Puente bodega → torretas (ticket 04, punto 6).** La torreta recarga al ritmo de `suministro` de su Batalla mientras quede munición en la bodega. Cada misil cargado resta 1, y con la bodega vacía el suministro es 0.
5. **Hito H0 de munición básica.**
   - `niveles/nivel-1/h0.js` usa una receta de cadena corta para la munición básica, con las máquinas mínimas ya colocadas. Toma la receta y las máquinas de `produccion.js` y recórtalas.
   - El reparador es automático, como en War.
   - La meta va en el formato de lista de Campaign.
   - La secuencia de `nivel.js` pasa a `["h0", "b1", "b2", "b3", "b4", "b5"]`. Los demás hitos de fábrica (H1–H5) no entran en P2.
   - **Avance de hito:** H0 termina al cumplir su meta. Una Batalla avanza con victoria según el `evaluar` de War. La fábrica sigue corriendo durante la batalla.
   - Al empezar cada Batalla se cumple la **continuidad**: pasan la fábrica, la bodega, los programas y la posición de la torreta, y la torreta empieza con el cargador de su reto, sin atasco y con las oleadas contando desde 0.
6. **Checkpoint (ticket 11)**, como funciones puras en `reglas-campaign-v2` más una conexión mínima en `app`:
   - instantánea en la frontera de cada hito con fábrica y bodega, posición de las torretas, programas y vínculos (como datos opacos), fuentes Python, semilla de la fábrica, clave y revisión;
   - al restaurar, el mundo de War se crea desde el reto;
   - una semilla nueva por intento de Batalla, anotada en la grabación del intento (si aún no hay grabación, guárdala en el mundo y deja una nota para P3);
   - una revisión distinta descarta el mundo, conserva los programas y vuelve al inicio del nivel con un aviso;
   - en `app`, la clave `campaign-v2-nivel-1` guarda un checkpoint por hito alcanzado, sin guardado en vivo.
7. **Catálogo i18n del nivel:** `shared/i18n/campaign-v2/nivel-1.js` con los textos de H0 y de la meta. Los datos llevan claves, no textos. El validador de P1 comprueba que las claves existan.
8. **`app` en modo campaña (`?serie=campaign-v2` sin parámetros):** empieza en H0 y, al cumplir la meta, pasa a B1 con el puente encendido.
   - **No crees vistas nuevas** (la vista 3D de la fábrica es P4).
   - Durante H0, si puedes reutilizar la vista de Campaign componiéndola en `app/juego/campaign-v2.js`, hazlo. Si no, deja un indicador mínimo de la bodega y de la meta, y anótalo en Faltantes.
   - El modo paridad y el ensayo siguen como en P1. El ensayo de una Batalla usa una bodega inicial por defecto, que se fija en un solo sitio.
9. **Pruebas** registradas en `pruebas/todas.mjs`:
   - las de P1 siguen en verde, más las referencias nuevas del paso 0;
   - las pruebas y referencias de Campaign H0–H5 siguen idénticas tras extraer `produccion.js`;
   - **puente:** con la bodega vacía la torreta no recarga, y con N de munición carga como mucho N misiles;
   - **secuencia:** H0 → B1 en Node con semilla: la meta de H0 se cumple, B1 arranca con la bodega producida y la fábrica sigue corriendo;
   - **checkpoint (ticket 11, punto 7):**
     - ida y vuelta: `serializar(restaurar(c))` es igual a `c`;
     - restaurar el checkpoint de una Batalla y jugarla con una semilla dada da la misma huella que un ensayo con la misma bodega, programas, torretas y semilla;
     - un checkpoint con otra revisión sigue la regla de la revisión distinta;
   - la frontera de imports sigue en verde.
10. **`docs/campaign-v2/P2-INFORME.md`** (60 líneas como mucho): qué se hizo, los archivos tocados, cómo se prueba, Suposiciones y Faltantes. Cambia la fila P2 de `PLAN-PORCIONES.md` a «hecha» solo si las pruebas pasan.

## Fuera de P2 (no lo hagas; si tienta, anótalo)

Eventos y clic programado, aplicar ahora, grabar y repetir completo, pausa con órdenes, seudocódigo (todo eso es P3). Vista 3D, merge de `assets-3d` y colocador (P4). Mecánicas nuevas (P5). Hitos H1–H5 de V2. Archivo de programas.

## Criterio de terminado

- `node pruebas/todas.mjs` da **65 ok más las pruebas nuevas en ok**, con los mismos 7 fallos de la línea base (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`, por falta de `node_modules`). No arregles esos 7.
- `git diff -- paquetes/reglas-war` solo muestra la función pública del suministro, y las referencias de War no cambian.
- `pruebas/referencias/partidas.json` solo crece con las 2 referencias nuevas; ninguna de las existentes cambia.

## Cómo trabajar

- Cambios mínimos y localizados. No añadas abstracciones que P2 no pida.
- Haz una sola pasada: lee, implementa, prueba, corrige lo que falle y termina. Si tras dos intentos una prueba sigue fallando por algo fuera de P2, anótalo en Faltantes y para.
- Al terminar, tu último mensaje es solo esto: la lista de archivos creados o cambiados, y el resultado de `node pruebas/todas.mjs` (la línea de resumen y los nombres de las pruebas que fallan).
