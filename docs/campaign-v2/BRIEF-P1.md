# Brief para Astra · Campaign-V2 · porción P1 «Esqueleto y paridad»

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en `docs/campaign-v2/P1-INFORME.md` («Suposiciones») y sigue.

## Dónde

- Worktree: `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`, rama `Campaign-V2`, creada desde `origin/trunk`.
- Escribe **solo dentro de este worktree**. No hagas commits, push, checkout, stash ni reset. No hagas `npm install` ni descargas (disco justo: < 50 MB escritos en total).

## Lee primero (en este orden; no leas archivos de más de 600 líneas enteros: usa `grep -n` y rangos)

1. `docs/campaign-v2/DECISIONES-WAYFINDER.md`, sobre todo los tickets 04, 05, 07, 08, 09 y 11. Son decisiones cerradas: no las reabras.
2. `CONTEXT.md` (glosario: «Batalla», «Marco de batalla», «Ensayo», «Modo paridad»…).
3. `docs/campaign-v2/PLAN-PORCIONES.md` (qué es P1 y qué queda para después).
4. Arquitectura de trunk: `paquetes/README.md`, `docs/REGLAMENTO.md`, `pruebas/fronteras.mjs`, y el `README.md` e `index.js` de `paquetes/reglas-war`, `paquetes/reglas-campaign`, `paquetes/nucleo` y `paquetes/app`. Mira cómo `?serie=factory` elige reglamento en `paquetes/app`.
5. Cómo se comprueba hoy la paridad de War: `pruebas/referencias/partidas.json` (war-1..5 × semillas 1 y 7) y la prueba que la verifica (busca `fronteras-fase2` en `pruebas/todas.mjs`).

## Objetivo único de P1

Que las Batallas 1–5 corran **a través de** un reglamento nuevo `reglas-campaign-v2` y den exactamente las mismas huellas que War, con el formato de nivel decidido. Todavía sin fábrica, sin 3D nuevo y sin eventos.

## Entregables

1. **`paquetes/reglas-campaign-v2/`**, con el mismo contrato de reglamento que los demás `{ id, version, crearMundo, paso, aplicarOrden, instantanea, escena, evaluar, api }`, más `package.json`, `README.md` (corto) e `index.d.ts` si los demás paquetes lo tienen.
   - Solo importa `nucleo` y `protocolo` (frontera de `pruebas/fronteras.mjs`). **War se recibe por inyección** desde `app` (ticket 04): un mundo de War por Batalla, sin tocar `reglas-war`.
   - El mundo compuesto guarda el hito actual. En P1, cada hito es una Batalla y su paso delega en War.
2. **`paquetes/reglas-campaign-v2/niveles/`**, con el formato del ticket 08:
   - `README.md`: la receta para añadir una Batalla, en 15 líneas como mucho;
   - `nivel-1/nivel.js`: `clave`, `revision`, la secuencia `hitos: ["b1", "b2", "b3", "b4", "b5"]` y `marco: { origen: [204, 72], puertas: [] }` (ticket 09);
   - `nivel-1/b1.js` … `b5.js`: cada uno es `export default { clave: "bN", war: N }`.
3. **Resolución de `{ war: N }` en `app`**: `normalizar(RETOS[N-1])` de `reglas-war` se inyecta en V2. Una Batalla con datos propios (sin `war`) debe poder cargarse con el mismo camino (formato de reto normalizado). No hace falta crear ninguna.
4. **Validador de contenido** dentro de `reglas-campaign-v2`, puro: ids de hito repetidos, `war: N` fuera de 1–5, campos obligatorios ausentes. Da errores con el archivo y el campo.
5. **Modos por URL** en `app`, reutilizando la vista actual de War (2D y 3D) sin crear vistas nuevas:
   - `?serie=campaign-v2&modo=paridad&batalla=b1`: la Batalla con los parámetros exactos de su reto de War;
   - `?serie=campaign-v2&ensayo=b3`: la Batalla suelta con reglas de campaña. En P1 es igual a paridad porque aún no hay fábrica; déjalo como un camino separado para P2.
   - Sin parámetros, `?serie=campaign-v2` abre B1 en modo campaña (por ahora, igual que el ensayo de B1).
   - **Sin ramas `ES_CAMPAIGN_V2` dispersas:** si `app` necesita un caso para la serie, concéntralo en un solo módulo de composición.
6. **Pruebas**, registradas en `pruebas/todas.mjs`:
   - `pruebas/campaign-v2-paridad.mjs`: B1–B5 × semillas 1 y 7 a través de `reglas-campaign-v2` en modo paridad dan **las mismas huellas, los mismos pasos y el mismo resultado** que `pruebas/referencias/partidas.json`;
   - `pruebas/campaign-v2-contenido.mjs`: carga todos los niveles, pasa el validador, juega cada hito con semilla en Node sin vista, y comprueba que un nivel roto (por ejemplo `war: 7`) da el error esperado;
   - la frontera de imports sigue en verde con el paquete nuevo.
7. **`docs/campaign-v2/P1-INFORME.md`** (60 líneas como mucho): qué se hizo, los archivos tocados, cómo se prueba, Suposiciones y Faltantes. Actualiza la fila P1 de `PLAN-PORCIONES.md` a «hecha» solo si las pruebas pasan.

## Criterio de terminado

- `node pruebas/todas.mjs` da **63 ok más las pruebas nuevas en ok**, con los mismos 7 fallos de la línea base (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego`, `juego-identificadores`, por falta de `node_modules`). No arregles esos 7.
- `reglas-war` no cambia. Comprueba que `git diff --stat -- paquetes/reglas-war` sale vacío.

## Cómo trabajar

- Cambios mínimos y localizados. Ninguna abstracción que no pida P1. Si algo de P2–P5 tienta, anótalo en el informe y no lo hagas.
- Una sola pasada: lee, implementa, prueba, corrige lo que falle y termina. Si tras dos intentos una prueba sigue fallando por algo fuera de P1, anótalo en Faltantes y para.
- Al terminar, tu último mensaje es solo: la lista de archivos creados o cambiados y el resultado de `node pruebas/todas.mjs` (la línea de resumen y los nombres de las pruebas que fallan).
