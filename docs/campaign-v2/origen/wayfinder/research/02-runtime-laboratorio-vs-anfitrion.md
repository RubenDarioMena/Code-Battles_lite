# Runtime del laboratorio frente al anfitrión e intérprete de trunk

Ticket: `issues/02-runtime-laboratorio-vs-anfitrion.md`.

## Fuentes y método

Solo código leído con `git show` de dos refs; no se ejecutó nada.

- **Laboratorio (ccr)**: `origin/ccr-684f16c6-yq5at1` — `laboratorio/batalla/js/runtime.js` (RT), `laboratorio/batalla/js/mundo.js`, `laboratorio/batalla/js/app.js`, `docs/PROPUESTA-MECANICAS-BATALLA.md` (sección «Qué haría falta para llevarlo a War o Campaign», líneas 146-152 del documento).
- **Trunk**: `origin/trunk` — `paquetes/anfitrion/{anfitrion,unidad,api,despertar,canal,war}.js`, `paquetes/anfitrion/README.md`, `paquetes/interprete/README.md`, `paquetes/app/conductor.js`, `paquetes/app/juego/ciclo-programas.js`, `paquetes/nucleo/index.js` y README, `paquetes/protocolo/index.js`, `paquetes/reglas-war/{README.md,mundo.js}`.

Las rutas de trunk van sin prefijo; las del laboratorio como `RT` (runtime.js) y `MU` (mundo.js), `AP` (app.js). «Present/partial/missing» se refiere a trunk.

## Cómo está montado cada uno (resumen que explica el resto)

- **Laboratorio**: un Web Worker real por unidad (RT:1-5, 223). Dentro del Worker conviven el cuerpo del programa y los oyentes (`onClick`, `onDamage`; RT:14, 140-160). Cada espera es un id en `esperas` (RT:13, 127-132). El anfitrión (hilo principal) cuenta `p.activos` hilos corriendo (RT:211-216); el mundo solo avanza cuando ningún programa tiene `activos > 0` (`quieto`, RT:211; `bombear`, RT:302-310). Todo el protocolo (`run`, `despierta`, `evento`, `espera`, `llegar`, `cmd`, `oyentes`, `evfin`, `done`, `error`) es de ese runtime.
- **Trunk**: no hay Workers en el camino del juego. `crearTrabajadorInterprete` (`unidad.js:12-97`) da una unidad con `postMessage`, `entregar()` síncrono y `terminate()`: un reino compartido, un ámbito por unidad, una FIFO y timers virtuales por unidad (`canal.js:3-31`). El anfitrión mantiene **un estado por programa** (`nuevo|corre|espera|fin|error`, `anfitrion.js:148-150`) y un único `p.espera/p.despertar` (`anfitrion.js:60`). El conductor (`app/conductor.js`) da pasos fijos solo cuando `!anfitrion.algunoCorre()` (`conductor.js:94`), aplica órdenes (`:52-54`) y cede (`:70`).

## Capacidad por capacidad

### 1. Varios hilos por programa (cuerpo y oyentes) — **MISSING en War, PARTIAL en Campaign**

Laboratorio: `esperas` Map con un id por espera (RT:13, 127-132), oyentes en `oyentes` (RT:14, 140-144), contador `activos` en el host (RT:213-216, 231-237), `despachar` corre todos los oyentes con `Promise.all` y avisa `evfin` (RT:150-160).

Trunk:
- War/Factory: una sola espera por programa. `api.js:200` lanza «Falta await…» si ya hay `espera`; `api.js:203` guarda una única `espera`; `api.js:287-288` solo resuelve esa. En el host, `anfitrion.js:60` (`p.estado = 'espera'; p.espera = m.id; p.despertar = ...`) admite un id; `anfitrion.js:85-87` despierta solo ese. La propuesta del ccr lo dice igual: «el de War solo admite una espera por programa» (PROPUESTA, línea 3 de la sección).
- Campaign: sí tiene varias esperas/encargos por programa: `api.js:57` (`pend` Map), `api.js:82` (solo una espera de tiempo a la vez), `api.js:282-284`; host `despertar.js:13-19` recorre `p.pend`; `anfitrion.js:179` y README:131-134. Pero es **un solo cuerpo** que usa `Promise.all`; no hay registro de oyentes ni contador de hilos, y `done` termina el programa (`campaign.recibir`, README:132).
- No existe ningún `onClick`/`onDamage`/oyente en `paquetes/` (búsqueda `git grep -i "onClick|onDamage|oyente"` sin resultados en código de trunk).

Qué cambiaría: `anfitrion/api.js` (aceptar varias esperas en War como ya hace Campaign; API de oyentes `onClick/onDamage` y mensaje `oyentes`; recepción de `evento` en `onmessage`, hoy solo `despierta`/`run`, `api.js:277-291`); `anfitrion/anfitrion.js` (sustituir el `estado` único por un contador de hilos `activos` o equivalente, como RT:211-216; `done` no debe cerrar el programa mientras queden oyentes, hoy `anfitrion.js:61`); `anfitrion/despertar.js` (generalizar el recorrido de `pend` a War); `anfitrion/index.d.ts`; el traductor Python (la propuesta lo marca en su punto 4: pasar una función como argumento en `terrain.on_click`); y la instrumentación `__L` para marcar línea en oyentes (punto 2 de la propuesta). Los mensajes del Worker «no cambian» solo si se mantienen compatibles: el README insiste en que el contrato es de valores/errores/líneas/mensajes ordenados (README:15-17).

### 2. Entrega de entradas del jugador entre pasos fijos (lockstep) — **PARTIAL**

Laboratorio: cola `cola` en el runtime (RT:207); `entregar()` reparte a los programas que escuchan (RT:256-279); `bombear` entrega antes de despertar y antes de `sim.paso` (RT:304-308).

Trunk:
- Lockstep y pasos fijos: presentes (`conductor.js:94-109`; `nucleo/index.js:118-122`).
- Canal «jugador → mundo»: existe en el protocolo como `origen: 'jugador'` (`protocolo/index.js:8`) y la cola ordena por paso (`nucleo/index.js:37-48`, `partida.ordenar` `:113-116`). Pero en `paquetes/` no hay ningún productor de órdenes `'jugador'` en código no de pruebas (`git grep "'jugador'"` solo da el protocolo).
- Canal «jugador → programa»: no existe. El anfitrión solo envía `run` (`anfitrion.js:83`) y `despierta` (`anfitrion.js:87`); `ceder(instantanea, respuestas)` solo entrega respuestas de encargos (`anfitrion.js:66-71`, `conductor.js:59-64`). No hay método equivalente a `entregar()` del laboratorio.

Qué cambiaría: `anfitrion/anfitrion.js` (método `entregarEvento(snap, ev, ids)` que haga `postMessage({type:'evento',...})` y marque el hilo como corriendo, como RT:269-275); `app/conductor.js` (una fase de entradas entre `partida.paso()` y `ceder`, hoy las fases son `respuestas`/`ceder`, `:17,56-72`); `app/juego/ciclo-programas.js` (alimentarlo desde el ratón); `reglas-war` (resolver «qué hay bajo el clic»: en el laboratorio es `sim.clic` + marca en el mundo, MU:120-134).

### 3. Grabación y repetición de entradas — **PARTIAL**

Laboratorio: `mundo.entradas` guarda clics (`MU:130`) y reprogramaciones (`RT:263`); la repetición las reinyecta por paso (`RT:301-311`, `AP:78-81`) y **los programas se vuelven a ejecutar**.

Trunk: `crearPartida.serializar()` guarda `{reglas, version, escenario, semilla, paso, ordenes}` con todas las órdenes recibidas (`nucleo/index.js:126-129`); `restaurar` las repone y avanza (`:141-149`; README del núcleo: «Guardado por repetición»). Esa repetición reproduce las **órdenes**, no los programas. Esto sirve para entradas que son órdenes de mundo (clic que marca un enemigo, que en el laboratorio es una mutación del mundo, MU:128) porque `origen: 'jugador'` ya está permitido, pero faltan: (a) un verbo del reglamento para esa mutación (`reglas-war` solo conoce `regularShoot/burstFire/stopFire`, README reglas-war:22 y `api.ordenes`), (b) el registro de los cambios de código en caliente, que no son órdenes, y (c) que un clic que solo dispara un oyente no deja rastro alguno si no genera orden. Si los oyentes producen órdenes, la repetición por órdenes reproduce el resultado sin reejecutar programas (propiedad útil: determinista y barata).

Qué cambiaría: `reglas-war/mundo.js` (nuevos verbos), `protocolo` (nada, ya admite el origen), `nucleo` (si se quiere guardar reprogramaciones: ampliar `serializar` o guardar aparte; hoy solo `ordenes`, `nucleo/index.js:127`, README: «No cambia el formato…»).

### 4. Errores aislados por unidad — **MISSING a nivel anfitrión/juego; PRESENT a nivel intérprete**

Laboratorio: `fallar(p)` mata solo ese programa, avisa y el mundo sigue (RT:217-218, 238).

Trunk:
- Intérprete: ya aísla. Un `CBL_PRESUPUESTO` en una unidad empuja un mensaje `error`, y `terminate()` libera solo su ámbito (`unidad.js:62-69`, `:31-37`; README anfitrión:49).
- Anfitrión: **un único `error` global** (`anfitrion.js:34,43-47`): tras el primer fallo, `recibir` ignora todos los mensajes (`anfitrion.js:50`) y `esperarTurno` sale (`:109`). README:151: «Si varias unidades fallan en el mismo turno, gana la primera». El conductor lo convierte en fin: `conductor.js:53,97` y `ciclo-programas.js:156-158,171-178` (`ctx.terminar("error", ...)`). Es un comportamiento deliberado, con referencias grabadas que lo dan por bueno (partidas de referencia 41, README:179).

Qué cambiaría: `anfitrion.js` (`fallar` solo marca ese `p`, `corre()` lo excluye; `turno` devuelve una lista de errores en vez de uno; `fallo()` también), `conductor.js` (no `terminada`/`error`), `ciclo-programas.js` (`errorPrograma` ya no llama a `terminar`; pintar el aviso y seguir). Riesgo: cambia las 41 referencias de partida si se aplica a las series existentes; haría falta una opción por reglamento o por modo.

### 5. «Aplicar ahora» (reiniciar un programa en caliente) — **MISSING**

Laboratorio: `reprogramar(id, codigo)` encola; `entregar()` mata el Worker, guarda el código y relanza (RT:260-267, 285; botón en AP:367-371), y queda grabado como entrada (RT:263).

Trunk: `cargar` lanza si la unidad ya existe (`anfitrion.js:147`), no hay `recargar`; «Ejecutar» crea **un anfitrión y un mundo nuevos** (`ciclo-programas.js:22,60,63`). Existe el material: `terminate()` de la unidad libera solo su ámbito (`unidad.js:31-37`, README anfitrión:49) y `crearTrabajador` crea otra al instante (`unidad.js:14-47`).

Qué cambiaría: `anfitrion.js` (método `recargar(unidad, codigo, opciones)`: `p.worker.terminate()`, nueva unidad, `estado: 'nuevo'`, conservar `p.orden`, limpiar `espera/pend`; el siguiente `ceder` la arranca, `anfitrion.js:81-84`), `ciclo-programas.js` (compilar/instrumentar solo esa unidad: hoy la revisión y los pulsos están en `ejecutar`, `:26-47`), `app/juego/pulsos.js` (reiniciar estado de pulsos de una unidad). Necesita decidir qué pasa con órdenes ya emitidas (en el laboratorio, las órdenes aplicadas permanecen).

### 6. Reaparición con el programa desde la primera línea — **MISSING (reglas y anfitrión)**

Laboratorio: al reponerse la unidad en el mundo (`MU:283-293`, `alReponer`) el runtime vuelve a lanzarla (`RT:289`, `lanzar` `:220-228`); al destruirse, `alDestruir` mata el Worker (`RT:288`, `MU:275-281`).

Trunk: en `reglas-war/mundo.js` no hay destrucción ni reposición de lanzadores (la búsqueda de `viva|destru|muert|alive` solo da `e.muerto` para enemigos, `mundo.js:207,217`; `REP` es el reparador, `mundo.js:16,46,182,230-232`). En el anfitrión no hay entrada para «unidad destruida/repuesta» (solo `detener`, `anfitrion.js:184-190`). Cada programa solo puede cargarse una vez (`:147`).

Qué cambiaría: reglas (unidades que mueren y vuelven: `reglas-war` no las modela; tendrían que definirse en el reglamento de batalla, o en un reglamento nuevo), `anfitrion.js` (dos entradas: `cerrarUnidad(id)` y `recargar` del punto 5, que ya cubre «desde la primera línea»), `conductor.js` (leer sucesos «destruida/repuesta» del mundo y llamar al anfitrión; hoy el conductor solo lee `respuestas`, `:60`). Es el mismo mecanismo que «aplicar ahora» más un aviso del mundo.

### 7. Espera asociada a una orden (`await arrive()`) — **PARTIAL (patrón presente; verbo y mundo ausentes)**

Laboratorio: `arrive()` aparca un hilo (`RT:137`); el host guarda `{llegar:true, listo}` (`RT:232`); el mundo avisa `alLlegar` (`RT:286`, `MU:276`); `despertar` lo despierta con resultado (`RT:246-251`).

Trunk: el mismo patrón ya existe como **encargo**: el Worker emite `encargo` y devuelve una Promise (`api.js:77-78` en Campaign, `api.js:128` en Factory); el mundo responde vía `reglas.respuestas(mundo)` (`conductor.js:59-64`, README nucleo línea de `respuestas`); el anfitrión entrega la respuesta y despierta con `resultado` (`anfitrion.js:66-71`, README anfitrión:120-123); `api.js:283,288` ya aceptan `m.resultado`. En Campaign `goTo` es un encargo (`api.js:58-59`). Lo que falta para War: no hay `moveTo`/`arrive` ni unidades móviles (lista de globales de War en `api.js:272`: solo `autoTarget`, `regularShoot`, `burstFire`, `stopFire`, `esperar`, `log`, `console`); `anfitrion.js:67-70` solo conoce `factory?.responder` y `campaign?.responder` (War no tiene `responder`); War despierta solo por tiempo (`anfitrion.js:85`); el mundo de War no produce respuestas.

Qué cambiaría: `anfitrion/api.js` (verbos `moveTo/arrive/stop` en War, mensaje `encargo`/`llegar`), `anfitrion/war.js` (`responder`/`registrar` del encargo, al estilo de `campaign.js`/`factory.js`), `anfitrion/anfitrion.js:66-71`, `reglas-war/mundo.js` (unidades móviles con ruta y `respuestas`), `index.d.ts`. La propuesta lo anota como punto 3: «Unidades móviles y destruibles en el inspector, en las dos vistas».

## ¿Es más barato o más caro el intérprete sin Workers?

Hechos observables en el código, sin números inventados:

**Más barato** en lo que el laboratorio resolvió con un Worker por unidad:
- Creación/destrucción: `crearTrabajador` y `terminate()` solo crean/liberan un ámbito en el reino compartido (`unidad.js:14-47,31-37`); el laboratorio crea y destruye un Worker por cada `lanzar`/`matar` (`RT:217,223`). Reprogramar y reaparecer (capacidades 5 y 6) son por tanto más baratas en trunk.
- Orden determinista: la entrega es síncrona y los mensajes se ordenan por unidad y llegada (`anfitrion.js:93`, README:78-82). En el laboratorio la llegada depende del reloj real entre Workers y se compensa con `quieto()` (`RT:211-212`). La repetición exacta (capacidad 3) es más fácil en trunk.
- Presupuesto en lugar de vigía de reloj: 1 000 000 de unidades por tarea (`unidad.js:9`, README:40-48) frente a `VIGIA_MS = 2500` por tiempo real (`RT:205,293`). Cada entrega de evento reinicia el presupuesto (`unidad.js:88`), así que los oyentes tienen el suyo.
- Sin mensajería entre hilos: `snap` se comparte por referencia y se copian el resto de mensajes (`canal.js:9`, README:34).
- Aislamiento de errores a nivel de unidad ya existe en el motor (`unidad.js:62-69`, README:49).

**Más caro / sin resolver**:
- El motor interpreta el programa (no usa el JIT del navegador). El README admite que la depuración «no sirve como medida de rendimiento a 500 unidades» (README:245-246) y remite a `herramientas/medir-unidades/README.md` y a `docs/qa/interprete-2026-11-17/README.md`; esos documentos no se han leído aquí, así que no se afirma ningún coste.
- Pierde el contador `activos` natural de los Workers asíncronos: en trunk «quién corre» es un estado por programa (`anfitrion.js:42,148`) y los hilos múltiples exigen un contador explícito, nuevo, que hoy no existe (capacidad 1).
- Un callback síncrono, un getter o un Proxy «corren hasta volver» y no son suspendibles (README:246-247): un `onClick` síncrono que se quede en bucle consume presupuesto y se corta, no se pausa.
- Los oyentes comparten el mismo ámbito y la misma cola: una entrega «drena todos sus trabajos antes de pasar a otra» (README:30), lo que casa con el lockstep pero no permite entrelazar hilos de la misma unidad; no hay equivalente a dos hilos preemptivos (tampoco los hay en el laboratorio: son promesas).

## Lo que no se pudo comprobar

- No se ejecutaron pruebas ni el laboratorio.
- No se leyeron `docs/qa/interprete-2026-11-17/` ni `herramientas/medir-unidades/README.md`, así que no hay cifras de coste de interpretación frente a Worker.
- No se revisó `paquetes/app/juego/pulsos.js`, `campaign.js`/`factory.js` del anfitrión en detalle ni el traductor Python.
- Se asume que los números de línea corresponden a `origin/trunk` y `origin/ccr-684f16c6-yq5at1` en el momento de la lectura.
