# Brief para Astra · Campaign-V2 · porción P3b «Eventos, clic programado y gestos»

Trabajas solo, sin humano disponible. **No hagas preguntas.** Si falta un dato, decide una suposición razonable, anótala en `docs/campaign-v2/P3b-INFORME.md` («Suposiciones») y sigue.

## Dónde

- Worktree: `/Users/rubenmena/Documents/Dev/Code-battle-lite-cv2`, rama `Campaign-V2`. P1, P2 y P3a están hechas y sin commit: son tu punto de partida y no las deshagas.
- Escribe **solo dentro de este worktree**. No hagas commits, push, checkout, stash ni reset. No hagas `npm install` ni descargas (escribe menos de 50 MB en total).

## Lee primero (no leas enteros los archivos de más de 600 líneas: usa `grep -n` y rangos)

1. `docs/campaign-v2/P3a-INFORME.md` (y, si lo necesitas, P1 y P2).
2. `docs/campaign-v2/DECISIONES-WAYFINDER.md`, tickets **05** (fichas y transporte de eventos), **06** (orden puntual y gestos) y **12** (forma del clic programado). Son decisiones cerradas, salvo la aclaración de abajo sobre `regularShoot`.
3. `docs/campaign-v2/research/02-runtime-laboratorio-vs-anfitrion.md` (los varios hilos y las entradas del jugador).
4. `docs/campaign-v2/receta/` (los esqueletos de `ficha.js` y `paso.js`).
5. `paquetes/anfitrion/` (`anfitrion.js`, `api.js`, `despertar.js`, `war.js`), `paquetes/app/juego/datos-proveedor.js`, `paleta.js`, `python.js`, `paquetes/lenguaje/vocabulario.js`, `paquetes/editor/seudo-modelo.js` y `seudo.js`, el traductor Python (en `paquetes/lenguaje` o `paquetes/interprete`; búscalo) y el código que hoy convierte un clic en el mapa de War en una orden del jugador (busca Alt+clic, «Señalar» y `origen: 'jugador'`).

## Aclaración obligatoria sobre `regularShoot` (sustituye al punto 2 del ticket 12)

En War, `regularShoot(lugar)` ya recibe un lugar y deja un modo de fuego continuo, y el programa de la lección de B1 depende de eso. Por tanto:

- `regularShoot(lugar)` se comporta **exactamente como en War** en todos los modos;
- solo en campaña y ensayo, `regularShoot(enemigo)` acepta también el objeto que llega de `enemies.onClick`. Se convierte en un lugar con la predicción de War (la de `autoTarget`) en ese instante, y desde ahí se comporta igual que `regularShoot(lugar)`;
- el **disparo único** con la regla del ticket 06 (siguiente turno de fuego permitido, respetando cadencia, munición y atasco, y descarte con aviso si no puede) es solo para la **orden puntual**, que es el clic del jugador sin oyente o el gesto de apuntar arrastrando.

## Objetivo de P3b

El clic programado completo en JS, Python y seudocódigo, sobre un transporte de eventos genérico que sirva después para `onDamage`, `onArrive` y `onEnemySeen` sin tocar el anfitrión. También los gestos y la orden puntual del ticket 06. Solo en los modos campaña y ensayo de Campaign-V2. En modo paridad y en las demás series, todo sigue como hoy.

## Entregables

1. **Transporte de eventos genérico en el anfitrión** (ticket 05, punto 4), como opción que V2 enciende:
   - el mundo emite `{ evento, unidad, datos }`;
   - se entregan entre pasos, en orden determinista, a manejadores que corren como **hilos propios** del programa;
   - cada evento abre un hilo, y los hilos del mismo manejador pueden solaparse;
   - los oyentes corren en orden de registro;
   - un programa con solo oyentes sigue vivo;
   - registrar después del primer `await` da un error con su línea, aislado en esa unidad (la pieza de P3a);
   - las entradas que llegan a los programas se graban y se repiten con la grabación de P3a.
2. **Fichas de V2** (ticket 05, puntos 1 y 3):
   - `reglas-campaign-v2/mecanicas/clic/ficha.js` declara solo datos para los eventos `terrain.onClick` → `{ x, y }` y `enemies.onClick` → `{ id, type, x, y, hp, vx, vy }`: nombres JS y Python (`on_click`), firma, nota, texto del seudocódigo, claves i18n y la ampliación de `regularShoot`;
   - un proveedor de V2 en `app/juego/` junta las listas de War con las fichas, y paleta, vocabulario, nombres Python, sugerencias, seudocódigo y ayuda leen de él;
   - War conserva sus listas sin cambios;
   - los textos van en catálogos i18n (`shared/i18n/campaign-v2/`), no en la ficha.
3. **Reparto del clic** (tickets 06 y 12):
   - el clic derecho, o mantener pulsado ~0,45 s en móvil, sobre un enemigo o el terreno se entrega primero a cada unidad seleccionada que escucha;
   - sobre un enemigo va a `enemies.onClick`; si la unidad solo escucha el terreno, va a `terrain.onClick` con el punto;
   - si no escucha, es una **orden puntual**;
   - con selección mixta, cada unidad decide por su cuenta;
   - los datos son los del instante del clic, en coordenadas del marco (las de War).
4. **Orden puntual:**
   - una función pública nueva en `reglas-war/index.js` para el «intento puntual», separada de los modos, con la regla de la aclaración;
   - si cae sobre un enemigo, apunta con la predicción de `autoTarget`;
   - después sigue el modo del programa;
   - War sin llamarla se comporta igual, y sus referencias no cambian.
5. **Gestos en V2** (ticket 06, puntos 2 y 3):
   - clic izquierdo o toque: seleccionar;
   - arrastrar desde el terreno: recuadro;
   - clic derecho o mantener 0,45 s: orden o clic programado;
   - dos dedos: cámara;
   - **apuntar arrastrando:** mantener ~0,45 s sobre una torreta propia y arrastrar hasta el objetivo, con una línea punteada y una diana. Es **siempre** una orden puntual.

   En V2 se retiran Alt+clic y el botón «Señalar». Si ese código es compartido con War, deja War como está y concentra el cambio en la composición de V2.
6. **Indicación:** un icono junto a la unidad mientras su programa escucha `onClick` (2D y 3D, con lo que ya exista para iconos de unidad) y una línea en la consola.
7. **Python:**
   - `terrain.on_click(al_clic)` con `def`, `async def` o `lambda`;
   - un manejador con `await` tiene que ser `async def`;
   - añade casos a las pruebas del traductor.
8. **Seudocódigo:**
   - un nodo genérico «cuando <evento> → <parámetro>» con cuerpo, en `seudo-modelo`;
   - su texto sale de la ficha del evento;
   - un evento nuevo no toca el editor: demuéstralo en una prueba con una ficha falsa de `onDamage` que aparece como nodo sin cambiar el editor.
9. **Pruebas** registradas en `pruebas/todas.mjs`, en Node y con semilla:
   - el reparto del clic (enemigo, terreno, solo terreno, sin oyente, selección mixta);
   - los hilos (dos clics seguidos con un manejador que espera se solapan, y el orden de registro se respeta);
   - el registro tardío da un error aislado;
   - la orden puntual respeta cadencia, munición y atasco, y se descarta con aviso;
   - `regularShoot(enemigo)` frente a `regularShoot(lugar)`;
   - la repetición de un intento con clics da la misma huella;
   - el traductor Python y el nodo «cuando», con la ficha falsa;
   - todo lo anterior en verde: las 41 referencias, la paridad de V2, el checkpoint, P3a y la frontera.
10. **`docs/campaign-v2/P3b-INFORME.md`** (60 líneas como mucho): qué se hizo, los archivos tocados, cómo se prueba, Suposiciones y Faltantes. Marca P3b como «hecha» en `PLAN-PORCIONES.md` solo si las pruebas pasan.

## Fuera de P3b (no lo hagas; si tienta, anótalo)

`onDamage`, `onArrive` y `onEnemySeen` reales, la marca de 6 s y `track(id)`, el radar, la reaparición, 3D nuevo (P4) y las mecánicas (P5).

## Criterio de terminado

- `node pruebas/todas.mjs`: las pruebas que ya pasaban siguen en ok, más las nuevas en ok, con los mismos 7 fallos de la línea base (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`). No arregles esos 7.
- `git diff -- paquetes/reglas-war` solo añade la función del intento puntual a lo que había, y `pruebas/referencias/partidas.json` no cambia.

## Cómo trabajar

- Cambios mínimos y localizados.
- Las opciones nuevas se encienden en `app/juego/campaign-v2.js`, sin repartir ramas por serie.
- No añadas abstracciones que P3b no pida, salvo el transporte de eventos y el proveedor de fichas, que son el coste único decidido.
- Haz una sola pasada. Si tras dos intentos una prueba sigue fallando por algo fuera de P3b, anótalo en Faltantes y para.
- Al terminar, tu último mensaje es solo esto: la lista de archivos creados o cambiados, y el resultado de `node pruebas/todas.mjs` (la línea de resumen y los nombres de las pruebas que fallan).
