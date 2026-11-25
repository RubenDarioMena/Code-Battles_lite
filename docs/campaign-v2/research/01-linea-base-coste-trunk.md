# Línea base: coste en `origin/trunk` de añadir reto, orden, evento y tipo de unidad

Método: lectura de `origin/trunk` con `git show "origin/trunk:<ruta>"`, `git ls-tree` y `git grep` (sin cambiar de rama). Las líneas son `wc -l` del archivo completo en trunk; «a leer» es el tamaño del archivo entero, no solo el fragmento relevante (se indica el fragmento cuando se midió). No se ejecutó ninguna prueba: «afectada» significa que el código de la suite lee o enumera lo que se toca, no que haya fallado. No hay conteos de tokens. «Tipo de unidad» se interpreta como tipo de **enemigo** (`TIPOS` de War); una máquina programable nueva (como LAU/VIB/REP) no se midió.

## Hechos de arquitectura que condicionan los cuatro casos

- Fuente única de los datos de War: `paquetes/reglas-war/mundo.js` (282 líneas; `TIPOS` l.5, `SENSOR` l.10, `LAU` l.14, `instantanea()` l.116, `paso()` l.133, `aplicarOrden` l.274) y `retos.js` (135; `RETOS` más `normalizar`).
- El anfitrión no conoce los verbos de War por reglamento: `reglamento.api.ordenes` (`reglas-war/index.js` l.46) es una lista informativa; los verbos reales están escritos a mano en `paquetes/anfitrion/api.js` (323 líneas, `crearAPI`), que se serializa con `.toString()` y se ejecuta dentro del intérprete (`anfitrion/trabajador.js`). Allí `orden()` (l.~177-196) **simula localmente** el efecto de la orden sobre una copia de la máquina y a la vez emite `cmd`; `mundo.js:aplicarOrden` repite la regla de verdad. Es decir, cada verbo existe dos veces (simulación en el Worker y regla en el mundo).
- Mensajes hacia el programa: el Worker solo entiende `run` y `despierta` (`api.js:onmessage`, l.277-300). El anfitrión (`anfitrion.js:turno`) solo emite esos dos tipos, ambos con la instantánea completa (`snap`). Los sucesos del mundo (`anotarSuceso`: `golpe`, `derribo`, `brecha`, `atasco`… en `mundo.js` l.145-238) los consumen VFX/anotaciones, no los programas. No existe en trunk ningún `onDamage`, `suscrib` ni callback de evento (búsqueda en `paquetes/anfitrion`, `lenguaje`, `interprete`, `nucleo`, `reglas-war`: sin resultados).
- Nombres Python y vocabulario del editor se definen a mano en `paquetes/app/juego/datos-proveedor.js` (56) y `paquetes/lenguaje/vocabulario.js` (11): listas literales de funciones (`regularShoot`, `burstFire`, `stopFire`…).
- `pruebas/fronteras.mjs` es una barrera estática de imports entre paquetes (`reglas-war` solo puede importar `nucleo` y `protocolo`; `anfitrion` solo `nucleo`, `protocolo`, `lenguaje`, `interprete`). Ninguno de los cuatro casos necesita un import nuevo entre paquetes si el cambio se hace en los archivos existentes, así que esa suite no cambia de resultado salvo que se cree un archivo/paquete nuevo.
- Referencias de paridad: `pruebas/referencias/partidas.json` (73 125 líneas) fija hashes SHA-256 de War 1–5 × semillas 1/7 y otros; `pruebas/referencias/README.md` dice «NO se regraban para que una prueba pase». La lista de casos está en `herramientas/partida/casos.mjs` l.7 (`for (let reto = 1; reto <= 5; …)`), fija.
- `pruebas/todas.mjs` agrupa 66 suites de lógica (Node) y 8 de navegador (lista en el propio archivo).

## Caso 1 · Reto War nuevo que solo reutiliza mecánicas

| Archivo | Paquete | Líneas | Cambio |
|---|---|---|---|
| `paquetes/reglas-war/retos.js` | reglas-war | 135 | añadir un objeto al array `RETOS` (los 5 actuales ocupan l.5-95, ~15 líneas cada uno) |
| `shared/i18n/retos.js` | shared (i18n) | 180 | claves `retos.war.<N>.titulo/objetivo/leccion/pista.<j>` en `es` y en `en` (52 claves `retos.war` hoy; unas 5-6 por idioma y reto) |

- Archivos tocados: **2** (1 local de reglas-war, 1 compartido en `shared/`). Lectura mínima: 315 líneas (los dos archivos; basta con el patrón de un reto y de sus claves). Con las mecánicas disponibles: +282 (`mundo.js`) +111 (`reglas-war/README.md`) ≈ 710.
- Nada más lo enumera: `Prototypes/Rocket Launcher` y `paquetes/interfaz/retos.js` pintan los chips desde `ctx.RETOS`; `paquetes/app/juego/estado.js:112` toma `RETOS_WAR`.
- Suites afectadas (lógica): `i18n-catalogos` (`pruebas/i18n-catalogos.cjs` l.56-66 recorre `RETOS` y exige que cada `retos.war.<i>.*` exista en es/en, con el texto español idéntico al del reto y el mismo número de partes de pista; falla si falta una clave). `i18n` por cercanía (no leída). Navegador: `ejecutar-idiomas` → `idiomas-retos.mjs` (itera `titulos[serie].length`).
- No afectadas por añadir al final: `partida-referencias` (casos fijos 1–5), `reglas-war.mjs` (usa `RETOS[0]` y `RETOS[2]`), `fronteras`. Si se quisiera cubrir el reto 6 con referencia, habría que editar `herramientas/partida/casos.mjs` y regrabar `partidas.json`, lo que exige decisión explícita del autor.
- Efecto lateral medido en código: `IDX_PROPIO = RETOS.length` (`app/juego/estado.js:150`) y el reto guardado se lee como número (`guardado.leer("reto", 0)`, l.159). Un guardado con el índice del «escenario propio» (5) pasaría a apuntar al reto nuevo.

## Caso 2 · Verbo de orden nuevo (`moveTo`)

Hechos previos: en War los lanzadores no se mueven; solo los reparadores se desplazan, de forma autónoma (`moverHacia`, `mundo.js` l.220). Un `moveTo` implica también una regla de movimiento nueva en `paso()`.

| Grupo | Archivos (líneas) |
|---|---|
| Núcleo funcional | `anfitrion/api.js` (323; cuatro puntos: `orden()` l.179-196, objeto de máquina l.212-214, API propia l.243-245, lista de globales l.272), `reglas-war/mundo.js` (282; `aplicarOrden` + movimiento en `paso`), `reglas-war/index.js` (54; `api.ordenes`, y `escena()` si cambia lo que se dibuja), `app/juego/datos-proveedor.js` (56; firma y nombre Python), `lenguaje/vocabulario.js` (11; `FN_PROPIAS` y `FN_MIEMBRO`) |
| Editor/interfaz | `app/juego/paleta.js` (56), `app/juego/pulsos.js` (240; `ORDENES` l.30), `editor/seudo-modelo.js` (249; bloques ↔ código), `interfaz/sugerencias.js` (86), `interfaz/inspector.js` (220), `interfaz/maquinas.js` (301), `interfaz/ayuda.js` (78), `shared/i18n/paleta.js` (104; claves `paleta.war.*`) |
| Tipos y docs | `reglas-war/index.d.ts` (97, no cita los verbos hoy), `anfitrion/war.js` (31; solo trata `stopFire` aparte, l.~19), `docs/REGLAMENTO.md` (63), `reglas-war/README.md` (111) |

- Archivos con el nombre de los verbos actuales (búsqueda de `burstFire|stopFire` excluyendo `docs/qa` y `educational-animation`): 15 de código fuente de producción en 8 paquetes/directorios (`anfitrion`, `reglas-war`, `app`, `lenguaje`, `editor`, `interfaz`, `shared/i18n`, `docs`). Todos son «compartidos» en el sentido de que ningún verbo vive en un único paquete.
- Tamaño de esos 15 archivos: 323+282+54+31+56+56+240+11+249+78+220+301+86+104+63 = **2 154 líneas** si se leen enteros. Mínimo realista para que el verbo funcione en JS: `api.js`, `mundo.js`, `index.js`, `datos-proveedor.js`, `vocabulario.js` ≈ 726 líneas (5 archivos, 4 paquetes). El resto es paleta/ayuda/inspector/bloques/i18n.
- Si `moveTo` mueve el lanzador, las vistas leen su posición desde la escena (`vista-2d/war.js` 118, `vista-3d/war.js` 321): no se midió si ya dibujan la posición viva o la del reto.
- Suites afectadas (lógica): `reglas-war.mjs:60` (`igual(reglamento.api.ordenes, ['regularShoot','burstFire','stopFire'])`, falla si se añade el verbo a la lista), `anfitrion.mjs` y `api-nativa.mjs` (ejercitan `cmd`), `lenguaje.mjs` (instrumentación), `python-traductor.cjs`, `python-ejecucion.mjs`, `editor-lenguajes.cjs`, `editor-contrato.cjs` (nombres Python/ vocabulario), `interaccion.cjs`, `partida-war`, `partida-referencias`. Las referencias de paridad solo cambian si el verbo altera el mundo en partidas existentes; un verbo que ningún programa de referencia llama no debería alterar los hashes (no medido). Navegador: `navegador.mjs` (21 menciones de los verbos), `editor-movil*.mjs`, `ejecutar-idiomas` (paleta).

## Caso 3 · Evento del mundo hacia el programa (`onDamage`)

No hay camino hoy (ver hechos). Las piezas que habría que tocar, según el código:

| Archivo | Líneas | Por qué |
|---|---|---|
| `reglas-war/mundo.js` | 282 | el suceso `golpe` (l.205) existe pero solo va al registro; `instantanea()` (l.116) no lo incluye |
| `reglas-war/index.js` | 54 | `instantanea`/`escena` y `api` (qué ve el Worker) |
| `anfitrion/anfitrion.js` | 192 | `turno()` solo envía `run` y `despierta`; hace falta un mensaje nuevo o llevar el evento dentro de `snap` |
| `anfitrion/api.js` | 323 | `onmessage` solo atiende `run`/`despierta`; registro del manejador y despacho |
| `anfitrion/unidad.js` | 98 | `entregar()` ejecuta tareas del Worker; un manejador de evento sería una tarea nueva con presupuesto |
| `anfitrion/war.js` | 31 | `registrar` conoce `lee/cmd/consola/espera`; un mensaje nuevo se pierde o falla |
| `anfitrion/index.d.ts` | 82 | tipos de mensajes |
| `app/juego/ciclo-programas.js` | 198 | bucle que cede y entrega avisos al juego (no leído en detalle) |
| `app/juego/datos-proveedor.js`, `lenguaje/vocabulario.js` | 56 + 11 | nombre `onDamage`/`on_damage`, vocabulario |
| `lenguaje/python-preludio.js` | 499 | si el manejador debe existir en Python (no medido si basta con el alias) |

- Archivos: **10** en 5 paquetes (`reglas-war`, `anfitrion`, `app`, `lenguaje`, más interfaz/docs si se documenta), unas **1 400 líneas** si se leen enteros. Mínimo funcional (mundo, index, anfitrion, api, unidad, war) ≈ 980 líneas, 2 paquetes (`reglas-war`, `anfitrion`).
- Riesgo de determinismo: `anfitrion.mjs:50-51` y el contrato de `despierta` fijan que el Worker solo se despierta por espera cumplida. Un evento que despierte al programa fuera de `esperar` cambia el orden de mensajes (el turno ordena por unidad y llegada, `anfitrion.js` ~l.100). Eso puede mover los hashes de `partida-referencias` si algún programa de referencia lo usa; si ninguno lo declara, no. No medido.
- Frontera: el evento debe viajar como dato plano (instantánea o mensaje) porque `reglas-war` no puede importar `anfitrion` (`fronteras.mjs`); no obliga a un import nuevo.
- Suites afectadas: `anfitrion.mjs`, `unidad.mjs`, `api-nativa.mjs`, `paso-a-paso.mjs` y `paso-a-paso-control.mjs` (pausas por línea; el manejador sería una pausa nueva), `partida-interprete.mjs`, `partida-war`, `partida-referencias`, `reglas-war.mjs`, `medir-unidades-node` / `medir-carga-node` (presupuesto del Worker), `lenguaje.mjs`, `python-*`.

## Caso 4 · Tipo de unidad (enemigo) nuevo con dibujo 2D, modelo 3D y ficha

| Archivo | Paquete | Líneas | Qué contiene hoy |
|---|---|---|---|
| `reglas-war/mundo.js` | reglas-war | 282 | `TIPOS` (l.5-9: nombre, suelo, z, vel, hp, frio, letra); el resto lo deriva |
| `reglas-war/index.d.ts` | reglas-war | 97 | `type TipoEnemigo = 'crawler' \| 'drone' \| 'stealth'` (l.4) |
| `vista-2d/war.js` | vista-2d | 118 | dibujo l.93-106: solo ramifica por `tp.suelo` y `tp.frio`, no por nombre |
| `vista-3d/instancias-war.js` | vista-3d | 145 | `enemigoMesh` y `tiposModelo = { suelo, aire }` (l.32-33): dos mallas procedurales, no una por tipo |
| `vista-3d/war.js` | vista-3d | 321 | `retrato(tipo)` l.222-231 (genera el PNG de la ficha) |
| `vfx/recetas/war.js` | vfx | 65 | receta de derribo por tipo (l.63: `{crawler, drone, stealth}`) |
| `interfaz/maquinas.js` | interfaz | 301 | `inspector.enemigo.<tipo>` de reserva (l.78) |
| `interfaz/info-reto.js` | interfaz | 419 | ficha del enemigo: `<img src="img/enemigos/${t}.png">` (l.68) |
| `shared/i18n/inspector.js` | shared | 170 | `inspector.enemigo.crawler/drone/stealth` en es (l.114) y en (l.131) |
| `Prototypes/Rocket Launcher/img/enemigos/<tipo>.png` | recurso | binario | un PNG por tipo existente (crawler, drone, stealth) |

- Archivos de código: **9** + 1 recurso binario, en 5 paquetes/directorios (`reglas-war`, `vista-2d`, `vista-3d`, `vfx`, `interfaz`, más `shared/i18n`). Lectura entera de los 9: 282+97+118+145+321+65+301+419+170 = **1 918 líneas**; mínimo (`mundo.js`, `vista-2d/war.js`, `instancias-war.js`, `vfx/recetas/war.js`, `inspector.js`) ≈ 780.
- Lo que SÍ se propaga solo: `reglamento.api.tipos` se construye de `TIPOS` (`reglas-war/index.js` l.47), el anfitrión lo pasa al Worker (`anfitrion.js` ctx.tipos) y `api.js` valida `autoTarget(tipo,…)` con esa lista; `normalizar()` acepta cualquier clave de `TIPOS` en las oleadas; `ayuda.js` y `info-reto.js` listan `ctx.TIPOS` sin nombres fijos. Por eso un tipo que sea «suelo» o «aire» y «frío» o no, ya se dibuja en 2D y en 3D sin tocar las vistas; solo hace falta tocar las vistas si debe verse distinto.
- Modelo 3D: en War los enemigos son geometría procedural (`instancias-war.js`). `cargarGLTFLoader` se pasa a la vista 3D (`app/juego/vistas.js` l.46-47), pero `vista-3d/README.md` l.75-76 dice que solo Factory carga el modelo; en trunk hay un único `.glb` (`Prototypes/Rocket Launcher/modelos/t1.glb`) y ningún enemigo de War lo usa. Un modelo 3D propio por tipo no tiene flujo de carga hoy.
- Ficha: `info-reto.js` pide `img/enemigos/<tipo>.png`; el PNG se genera con `window.cmg.retrato(tipo)` (`app/juego/arranque.js` l.37) y se guarda a mano.
- Suites afectadas: `reglas-war.mjs:61` (`igual(api.tipos, W.TIPOS)`, se actualiza solo), `vfx.mjs` l.127 (enumera los tres tipos de la receta `derribo`; un tipo nuevo no la rompe pero queda sin cubrir), `vista-2d.mjs`, `vista-3d.mjs`, `instancias-war.mjs` (declara `TIPOS` propios, l.20), `vistas-contrato.mjs`, `vfx-dibujantes`/`vfx-juego`/`vfx-calidad`, `capturas-combate.mjs` (pinta una escena fija), `i18n-catalogos`/`i18n` (claves `inspector.enemigo.*`, `pendientes.js` l.690-692 lista nombres de tipos), `partida-referencias` (solo si algún reto de referencia lo usa; los 5 retos actuales no). Navegador: `ejecutar-idiomas`, `vista-caliente`.

## Resumen comparativo (archivos y líneas, medidos sobre trunk)

| Caso | Archivos tocados | Paquetes distintos | Líneas de esos archivos | Mínimo funcional | Suites principales |
|---|---|---|---|---|---|
| 1 Reto | 2 | 1 + `shared` | 315 | 315 | `i18n-catalogos` |
| 2 Orden | 15 (5 mínimos) | 8 (4 mínimos) | 2 154 | ≈ 726 | `reglas-war` l.60, `anfitrion`, `lenguaje`, `python-*`, `editor-*`, referencias |
| 3 Evento | ≈ 10 (6 mínimos) | 5 (2 mínimos) | ≈ 1 400 | ≈ 980 | `anfitrion`, `unidad`, `paso-a-paso*`, `partida-*`, referencias |
| 4 Tipo de enemigo | 9 + 1 PNG | 6 | 1 918 | ≈ 780 | `vfx`, `vista-2d/3d`, `instancias-war`, `i18n-catalogos` |

## Lo que no se pudo determinar

- Si cada suite pasa o falla tras el cambio: no se ejecutó nada (regla de no tocar la rama de trabajo).
- Si los hashes de `partidas.json` cambian con un evento nuevo o un verbo nuevo: depende de que el mundo y el orden de mensajes de los casos de referencia cambien; no medido.
- Cuántas líneas hay que **añadir** por caso: solo se contaron las líneas de los archivos tocados, no el diff.
- El caso 2 no se probó contra una unidad que se mueve; el caso 3 no tiene prototipo en trunk.
