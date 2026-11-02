# Plan de unificación: una base para Factory, War y Campaign

Plan de trabajo para el agente que ejecute la convergencia de Factory (`Prototypes/Tres vistas/`) en la base de War (`Prototypes/Rocket Launcher/`). Está pensado para que Campaign pueda mezclar las dos mecánicas en un mismo mapa. Estado al 2 de noviembre de 2026: **plan de trabajo, nada implementado**. Las decisiones marcadas como pendientes son del usuario; el agente las prepara, no las toma.

Antes de empezar, lee `AGENTS.md`, `README.md`, `docs/VISION.md`, las entradas recientes de `PROGRESO.md` y los dos análisis de `docs/analisis/` (`Encargos y modos.html` y `factory-war-reglas-campana.html`).

## Resumen

- **Objetivo.** Una sola aplicación, derivada de War, donde corren los retos de War, los de Factory y, más adelante, retos mixtos de Campaign. Una mejora del editor, del inspector o de la distribución llega a todos sin copiarla.
- **Idea central: máquinas en un mismo mundo, no modos.** War y Factory dejan de ser dos motores y pasan a ser dos series de retos sobre un catálogo común de máquinas: lanzador, sensor, depósito, reparador, robot de carga, bodega y fundidora. Cada reto elige qué máquinas, metas y herramientas usa. Dos «modos» conectados a una interfaz común no permitirían un reto mixto, como un robot que abastece a un lanzador.
- **Un solo runtime: el de War.** Un Web Worker por máquina programable, avance sincronizado (lockstep) e instantánea del mundo al despertar. Un encargo de Factory (`await yo.recoger(...)`) es una espera cuya duración decide la simulación.
- **Factory original congelado como referencia.** No recibe mejoras. Sirve de oráculo: el mismo programa debe dar el mismo resultado y el mismo tiempo en el original y en el migrado. Se retira, con redirección, solo cuando haya paridad completa.
- **Pasos pequeños, sin reescritura.** JavaScript y CSS sin framework ni compilación. Cada etapa deja War intacto y verificable.

## Por qué ahora

- Factory ya no recibe lo nuevo de War: pantalla completa, panel inferior Inspector/Consola, ficha de información con pestañas, telemetría remota. Desde el 31 de octubre solo ha recibido la franja «War es la versión más actualizada del juego».
- La interfaz ya diverge: `css/componentes.css` difiere en unas 930 líneas entre los dos prototipos y `js/layout.js` en unas 290. Cada arreglo exige dos implementaciones y dos revisiones.
- Lo propio de Factory es pequeño. En su `js/juego.js` (2.325 líneas), las secciones Retos, Runtime, Mundo y Ciclo suman unas 540 líneas. Bloques y seudocódigo (Textos, Modelo del programa, Modos, Paleta, Edición de bloques, Arrastrar) suman unas 790, y «Tu reto», unas 100. El resto es interfaz que War ya resuelve.
- War ya tiene el germen del catálogo. `crearMundo` reúne `maquinas` con `clase` (`lanzador`, `vibracion`, `deposito`, `reparador`) y un índice `porId`. `FUNCION_DE` ya reserva la función `fabrica`. El reparador ya es una unidad que se desplaza por el mapa (`pasoReparador`).

## Estado de partida

| Aspecto | Factory hoy | War hoy |
| --- | --- | --- |
| Mapa | 9 × 7 casillas, plano 2D en canvas | 32 × 18 casillas de 1 m (`COLS`, `ROWS`, constantes), 3D con Three.js r128 y plano |
| Unidades programables | Un robot, R1 | Uno o dos lanzadores, cada uno con su programa |
| Runtime | Un worker. Cada `yo.*` envía `call` y espera `res`: petición y respuesta. Instrumentación con expresiones regulares | Un worker por lanzador. Instantánea al despertar, órdenes sin respuesta, el reloj avanza cuando todos los programas están en `await esperar(...)`. Instrumentación con el léxico propio y sintaxis comprobada con Acorn |
| API | `yo.recoger(lugar, mat)`, `yo.entregar(lugar)`, `yo.esperar(s)`, `yo.cuantos(lugar, mat)`, todas con `await` y `yo.` obligatorio. Lugares como texto: `"ENT-1"` | `autoTarget`, `regularShoot`, `burstFire`, `stopFire`, propiedades (`failureRate`, `missiles`, `jammed`…), `VIB_01.detect`, `await esperar(s)`. `yo.` opcional; otras máquinas como `LAU_02` |
| Resultado de una orden | Al terminar el encargo: `"ok"`, `"viaje_vacio"`, `"rechazado"`, `"derrame"`, `"manos_llenas"`, `"manos_vacias"` | Al darla: `"ok"` o un motivo |
| Límites | `T_LIMITE` 300 s, 2,5 s de bucle sin `await`, 500 consultas seguidas sin orden, «Falta await en la línea N…» | `T_LIMITE` 400 s, 2,5 s sin `await`, 4000 órdenes y lecturas sin esperar |
| Victoria | El programa termina con las metas cumplidas | El mundo cumple las metas, aunque el programa siga |
| Azar | Sin RNG. `stockPorIntento` fija el stock oculto según el número de intento | `mulberry32` con semilla (`semilla = intento`, salvo semilla fija) |
| Qué se mejora | Tiempo de juego | Coste por derribo |
| Programa guardado | `cmg-banco02:prog-<i>` = `{ modelo, texto, fuente, comentado }`. Manda el árbol | `cmg-banco03:prog-<reto>` = `{ "LAU-01": "…", … }`. Manda el texto JS |
| Vistas del programa | Bloques, seudocódigo EN/ES y JS sobre un árbol común | JS y seudocódigo ES/EN (`js/seudo.js`) traducido desde el JS |
| Pruebas | `pruebas/tres-vistas.mjs` (43) y `pruebas/factory-editor.mjs` (23) | `pruebas/interaccion.cjs` (lógica, 123) y `pruebas/navegador.mjs` |
| Telemetría | Lista local | Local y remota (`js/remota.js`, `sandbox: "03_lanzamisiles"`) |

Cita el código por el encabezado de su sección (`// ---------- Mundo ----------`), no por números de línea: se desplazan con cada cambio.

## Arquitectura objetivo

| Capa | Contenido | De dónde sale |
| --- | --- | --- |
| **Aplicación** | Distribución PC/móvil, divisor, pantalla completa, editor y barra de edición, inspector, consola, ficha de información, Ajustes, telemetría | War: `index.html`, `js/layout.js`, secciones de interfaz de `js/juego.js`, y `shared/` |
| **Núcleo** | Estado del mundo, paso fijo `DT = 0.05`, RNG con semilla, sucesos (`mundo.eventos`; `mundo.fx` cuando exista, según `docs/PLAN-VFX.md`), evaluación de metas y fin del intento | `crearMundo`, `paso`, `evaluar` y `terminar` de War, generalizados |
| **Runtime** | Un worker por máquina programable, lockstep, instantánea, órdenes, esperas y encargos, límites y errores con línea | Runtime y «Ciclo de los programas» de War |
| **Catálogo de máquinas** | Un archivo por familia; cada clase declara lo que necesita el resto | Lanzador, sensor, depósito y reparador desde War; robot, bodega y fundidora desde Factory |
| **Vistas del programa** | JS, seudocódigo y bloques como vistas del mismo programa | `seudo.js` de War; Modelo, Paleta y bloques de Factory |
| **Retos** | Datos: serie, mapa, máquinas, metas, pistas, programas iniciales, herramientas | `RETOS` de cada juego |
| **Campaign** | Secuencia de misiones, progreso y desbloqueos | Nuevo, al final |

### Qué declara cada clase de máquina

- `crear(def, mundo)`: su estado inicial.
- `paso(maquina, dt, mundo)`: su avance en cada paso fijo.
- **Lecturas**: lo que entra en la instantánea que leen los programas (propiedades y funciones de sensor).
- **Órdenes**, cada una con su clase:
  - **encargo**: dura, ocupa a la máquina y devuelve cómo terminó;
  - **modo**: instantáneo, persiste hasta otra orden y devuelve si se pudo aplicar;
  - **lectura**: instantánea y sin efectos.
  Hoy las órdenes de War son modos y lecturas. Las de Factory son encargos, salvo `yo.cuantos`, que es una lectura.
- **Programable** o no.
- **Inspector y sugerencias**: propiedades y valores posibles de cada argumento (lugares, materiales, tipos, sensores).
- **Dibujo**: plano 2D obligatorio; 3D opcional. Sin modelo 3D, el reto permite solo la vista de plano.
- **Función y aspecto**: `FUNCION_DE`, radio de selección, luces.

El registro sigue el patrón de los módulos actuales: un IIFE que publica un objeto global, como `window.ESTRUCTURA` o `window.ICONOS`, cargado con `<script>` antes de `juego.js`. La parte de cada clase que corre dentro del worker (sus funciones de API) se inyecta en el código del worker; War ya lo construye como texto en `WORKER_SRC`.

### Cómo encaja un encargo en el runtime de War

- **Hoy en War**, el programa corre hasta un `await esperar(s)` y queda en espera. Cuando todos los programas esperan, la simulación avanza. Al cumplirse la espera, el programa despierta con una instantánea nueva.
- **Un encargo es lo mismo con duración variable.** `await yo.recoger("ENT-1", "cobre")` manda la orden y deja el programa en espera. La simulación lo despierta cuando el robot termina, con el resultado (`"ok"`, `"viaje_vacio"`…) y una instantánea nueva.
- **Orden a una máquina ocupada**: da el error actual de Factory («Falta await en la línea N: R1 seguía con … cuando llegó la orden de la línea M»), con las mismas líneas.
- **`yo.cuantos` se lee de la instantánea**, sin gastar tiempo. Los programas guardados con `await yo.cuantos(...)` siguen funcionando: `await` delante de un número no cambia nada.
- **El reloj avanza cuando todos los programas esperan**, en `esperar` o en un encargo. Con un solo robot, Factory debe dar exactamente el mismo tiempo que hoy.
- **Límites y mensajes por serie** mientras no se decida el reglamento: 500 consultas seguidas para el robot, 4000 mensajes para los lanzadores, `T_LIMITE` por reto (300 s en Factory, 400 s en War).

### Retos como datos

Campos que necesita la aplicación unificada (los nombres concretos los fija el agente al implementar):

- `serie`: `"war"`, `"factory"` y, más adelante, `"campaign"`.
- **Clave estable** por reto.
- `mapa`: `{ cols, rows }`. Por defecto, los 32 × 18 de War; Factory usa 9 × 7. `COLS` y `ROWS` hoy son constantes usadas en muchos sitios (terreno, entrada de enemigos en `COLS + .4`, límites de «Tu escenario»): deben salir del reto sin cambiar los valores de War.
- `maquinas`, `oleadas`, `stock` y `stockPorIntento`.
- `metas`.
- `fin`: `"mundo"` (War) o `"programa"` (Factory), hasta que el reglamento decida.
- `limite`, en segundos.
- `mejora`: `"coste"` o `"tiempo"`.
- `inicial`: un programa por máquina programable.
- `herramientas`: vistas del programa permitidas, `ladrillos` (los de Factory) y vistas del mapa permitidas.
- Textos: `objetivo`, `leccion`, `pista`.

### Vistas del programa

- **Fuente de verdad (pendiente).** Recomendación: el texto JS, como en War. Bloques y seudocódigo se traducen desde él, y lo que no se puede representar se queda en JS con aviso, como ya hace `seudo.js`.
- **Riesgo**: hoy Factory guarda el árbol y genera el texto. Un programa de bloques podría verse distinto al pasar por texto (comentarios, formato). La migración debe comprobar que los programas de partida y los guardados de los seis retos hacen ida y vuelta sin cambiar su resultado.

### Guardado

- **localStorage es por origen, no por carpeta.** La aplicación unificada puede leer `cmg-banco02:*` directamente.
- **Sin escribir en `cmg-banco02:*` mientras convivan las dos versiones.** La nueva importa el `texto` de un reto la primera vez que lo abre y guarda en su propio espacio. El Factory original no se ve afectado.
- **Claves de reto únicas entre series**, sin cambiar las de War (`"0"` a `"4"` y `"propio"`). Por ejemplo, `factory-0` a `factory-5` y `factory-propio`. La clave `reto` de War es un número (`guardado.leer("reto", 0) | 0`), así que la serie elegida necesita su propia clave.
- **Datos por reto**: `records`, `hechos`, `pistas` y `telemetria` ya se indexan por clave de reto. El récord debe guardar qué mide (`tiempo` o `coste`).
- **Preferencias de pantalla**: las de War, comunes a todas las series. El modo de programa (bloques, seudocódigo o JS) y el idioma de los bloques pueden recordarse por serie, importando `cmg-banco02:modo` e `idioma` la primera vez.

## Invariantes durante toda la migración

- **War no cambia de comportamiento**: retos, API, mensajes, guardado `cmg-banco03:*`, récords, telemetría (`sandbox: "03_lanzamisiles"`), `window.cmg` y `window.__banco`. Sus pruebas pasan en cada etapa sin editarlas, salvo las versiones `?v=` que algunas exigen (por ejemplo, `pruebas/war-20-ciclos.mjs`).
- **Factory migrado conserva** su API, resultados, mensajes de error, límites, tiempos, victoria al terminar el programa y récord por tiempo, hasta que el reglamento diga otra cosa.
- **Determinismo**: paso fijo, RNG con semilla y `stockPorIntento`. Ninguna regla usa `Math.random` ni el reloj real.
- **Sin herramientas nuevas**: ni dependencias ni compilación. `?v=N` en el `index.html` al cambiar CSS o JS, y la lista permitida de `scripts/preparar-netlify.mjs` al añadir archivos.
- **Reglas, API o formatos de guardado** solo cambian con decisión explícita del usuario, documentada en `PROGRESO.md` y con cobertura.
- **Mover no es reescribir.** Cuando una etapa traslada código, el diff debe poder leerse como traslado.

## Etapas

Cada etapa termina con todo verificado y registrado antes de empezar la siguiente.

### Etapa 0 · Preparación

- Confirmar con el usuario el inicio del plan y actualizar la regla del prototipo canónico en `AGENTS.md` y en cualquier otro archivo de instrucciones de la raíz que la repita: la base sigue siendo War; el Factory original queda congelado (solo arreglos que impidan usarlo) y sirve de referencia.
- **Oráculo de Factory.** Para cada reto, un conjunto de programas ejecutados en el Factory original, en el puerto 8771 y con `window.__banco`, como ya hace la ejecución real de `pruebas/tres-vistas.mjs`. El conjunto incluye el de partida, uno que gana, uno con derrame, uno con viaje vacío, uno sin `await`, uno que no termina y uno de «Tu reto». De cada uno se registra:
  - `mundo.fin`, el motivo y la línea del error;
  - `mundo.t`, los derrames, los viajes vacíos y las metas;
  - el número de intento, porque `stockPorIntento` depende de él.

  Se guarda como fixture JSON en `pruebas/`, con el commit de origen.
- **Hecho cuando** el fixture cubre los seis retos y «Tu reto», y dos ejecuciones seguidas dan los mismos valores.

### Etapa 1 · «Primer viaje» en la base de War

Primer resultado jugable. Valida la arquitectura antes de migrar todo.

1. Mapa por reto: `COLS` y `ROWS` salen del reto; por defecto, los de War.
2. Clases `robot`, `bodega` y `fundidora` en un archivo nuevo del catálogo, con la lógica de la sección Mundo de Factory: `iniciarOrden`, ruta en L, `VEL` 4 casillas/s, `OP` 0,5 s, `cap`, `tProceso` y `PRODUCTO`. En `juego.js`, solo los enganches.
3. Encargos en el runtime de War, según lo descrito arriba. API del robot: `yo.recoger`, `yo.entregar`, `yo.esperar` y `yo.cuantos`, con `yo.` obligatorio como hoy.
4. Fin por programa y límites de Factory para esta serie.
5. Plano: dibujo de robot, bodega, fundidora, carga y derrames, desde la sección Dibujo de Factory. El reto permite solo la vista de plano.
6. Inspector, sugerencias (lugares y materiales) y ficha de información con las metas de Factory (`FUN ← cobre 3/3`).
7. Entrada a la serie dentro de la aplicación de War, por ejemplo `?serie=factory`. La portada no cambia todavía.
8. Guardado según la sección Guardado. Programa de partida: hoy sale del árbol `inicial` con `generar`, y la vista JS de Factory lo muestra comentado. Para esta etapa basta el texto generado y activo, como se ejecuta en bloques.

- **Hecho cuando**:
  - el oráculo de «Primer viaje» coincide: mismo `fin`, motivo y línea, y `t` con tolerancia `1e-9`;
  - la suite de War pasa sin cambios;
  - hay capturas revisadas en PC 1400 y teléfono 390.
- **No incluye**: bloques, seudocódigo del robot, otros retos, 3D de Factory ni la portada.

### Etapa 2 · Separar responsabilidades

Con dos series en la misma aplicación, partir `js/juego.js` (unos 220 KB) por las costuras que mostró la etapa 1: núcleo, runtime, catálogo (War en su propio archivo, como Factory), retos (datos), vistas del mapa e interfaz. A `shared/` va solo lo que use otra página: portada, Campaign o el laboratorio de VFX.

- **Hecho cuando**:
  - los diffs se leen como traslados;
  - todas las suites y el oráculo pasan;
  - `index.html` carga los archivos en orden y con `?v=`;
  - `node scripts/preparar-netlify.mjs` y `node pruebas/publicacion.mjs` son correctos.

### Etapa 3 · Reglamento común

Puede ir en paralelo a la etapa 2. El agente prepara las opciones a partir de `docs/analisis/` y el usuario decide (ver [Decisiones pendientes](#decisiones-pendientes-del-usuario)). El resultado es `docs/REGLAMENTO.md`. Cada cambio que aplique una decisión va aparte, con su cobertura y su entrada en `PROGRESO.md`. Si cambia el comportamiento de Factory, el oráculo se actualiza en ese mismo cambio, explicando por qué.

### Etapa 4 · Resto de Factory

- Retos «Dos materiales», «Sin derrames», «Contra reloj», «Hasta vaciar» y «Plan B», y «Tu reto» con su editor de enunciado y metas.
- Bloques y seudocódigo para programas del robot (Modelo del programa, Paleta, Edición de bloques, Arrastrar), con `ladrillos` por reto, según la decisión sobre la fuente de verdad.
- Récord por tiempo y telemetría de la serie.
- Copias de `pruebas/tres-vistas.mjs` y `pruebas/factory-editor.mjs` adaptadas a la nueva entrada. Las originales siguen hasta el corte.
- **Hecho cuando**:
  - el oráculo completo coincide;
  - el mismo programa da el mismo tiempo en bloques, seudocódigo y JS;
  - los programas guardados en el Factory original se importan y dan el mismo resultado.

### Etapa 5 · Retirar el Factory original

- `Prototypes/Tres vistas/index.html` redirige a la nueva entrada conservando query y hash, como ya hace `Prototypes/02_tres_vistas.html`.
- La portada apunta Factory a la nueva entrada y desaparece la franja «War es la versión más actualizada».
- El código viejo sale del paquete de Netlify y del árbol; queda en el historial de git. Borrar archivos requiere confirmación del usuario.
- Se retiran las suites viejas de Factory.
- **Hecho cuando** `pruebas/entrada.mjs`, `pruebas/publicacion.mjs` y todas las suites pasan, y los enlaces antiguos llegan al reto correcto.

### Etapa 6 · Primer reto mixto

Depende del reglamento. Un mapa, una cadena corta y una oleada: un robot programable lleva munición a un lanzador, y el lanzador dispara con su propio programa. Hace falta:

- el misil como material;
- una receta en una fundidora, o un depósito que acepte entregas;
- entregar a una máquina (por ejemplo, `yo.entregar("LAU-01")`);
- metas del mundo;
- dos clases de programa en el mismo lockstep.

El objetivo es comprobar que sobreviven las decisiones interesantes: el transporte como cuello de botella, la reserva y cuándo compensa una ráfaga. Cantidades, recetas y tiempos son decisiones de balance pendientes.

### Etapa 7 · Campaign

Solo cuando estén definidas las primeras misiones. Campaign es una capa: una lista de misiones que abren retos de la aplicación, con progreso (desde `hechos`) y desbloqueos (vistas, órdenes, sensores). Si más adelante necesita exploración o mecánicas propias, se añaden como máquinas y retos, no como otro motor.

## Decisiones pendientes del usuario

Cada una con la recomendación de este plan o de `docs/analisis/`:

1. **Fuente de verdad del programa**: texto JS (recomendado) o árbol de bloques.
2. **Cuándo se gana**: metas del mundo para todos, con una meta explícita «el programa termina» en los retos que la necesiten (recomendado), o conservar las dos reglas.
3. **`await` en lecturas**: `yo.cuantos` sin `await`, con un aviso suave cuando sobra (recomendado), o dejarlo como está.
4. **Idioma de la API**: inglés, como War y las palabras de JavaScript, o español, como Factory.
5. **Nombres**: cada cosa del mapa como variable con el nombre que muestra el mapa (`LAU_01`, `ENT_1`), o como texto (`"ENT-1"`). En los dos casos, el mismo nombre en mapa y código.
6. **Prefijo `yo.`**: opcional en todas las máquinas, como en War, u obligatorio.
7. **Qué se mejora en un reto mixto**: tiempo, coste o ambos.
8. **Telemetría remota de la serie Factory**: activarla con su propio `sandbox` (recomendado) o dejarla local.
9. **Ubicación final**: seguir en `Prototypes/Rocket Launcher/` o mover la aplicación a una ruta neutral con redirecciones.
10. **Ritmo de War durante las etapas 1 y 2**: pausar los cambios grandes o seguir en paralelo con etapas más cortas.

## Riesgos y cómo detectarlos

- **Tiempos distintos** por el orden de evaluación dentro de `paso` o por redondeos → el oráculo exacto.
- **Ida y vuelta entre árbol y texto** → prueba con los programas de partida y los guardados.
- **Programas del jugador** → no escribir en `cmg-banco02:*` hasta el corte; probar la importación con datos reales copiados a un origen de prueba.
- **Rendimiento del lockstep** con robot y lanzadores a la vez en teléfono → medir en emulación y pedir QA en dispositivo real.
- **War cambia mientras se migra** → etapas cortas y la suite de War en cada paso.
- **Pruebas intermitentes conocidas de War** (doble toque sintético, arrastre a `stopFire(`) → repetir antes de dar algo por regresión.
- **CDN** (Three.js r128, Acorn 8.11.3) → sin cambios; la aplicación sigue necesitando conexión.

## Cómo informar de cada etapa

Según `AGENTS.md`: una entrada en `PROGRESO.md` con qué cambió, las versiones `?v=`, la verificación (resultados de cada suite y del oráculo), los límites (emulación frente a dispositivo real) y las decisiones que quedan pendientes. Sin commits, push ni publicación salvo instrucción del usuario.

## Fuera de alcance

TypeScript, VM o representación intermedia, frameworks, Python y empaquetado móvil siguen siendo propuestas, no requisitos. También quedan fuera el modelado 3D de los edificios de Factory (opcional), el rebalanceo de los retos actuales y la exploración en Campaign.
