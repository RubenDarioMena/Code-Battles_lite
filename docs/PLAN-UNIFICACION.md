# Plan de unificación: una base común para Factory y War

Plan de trabajo para el agente que ejecute la convergencia de Factory (`Prototypes/Tres vistas/`) en la base de War (`Prototypes/Rocket Launcher/`). Revisado el 3 de noviembre de 2026 con el feedback del autor del 2 de noviembre. **Inicio autorizado por el usuario el 3 de noviembre de 2026. Etapas 0 a 5 completadas el mismo día: el plan está cerrado.** El Factory original está retirado; su comportamiento queda en el oráculo.

Antes de empezar, lee `AGENTS.md`, `README.md`, `docs/VISION.md`, las entradas recientes de `PROGRESO.md` y los dos análisis de `docs/analisis/` (`Encargos y modos.html` y `factory-war-reglas-campana.html`). Los análisis son **propuestas de agentes, no decisiones del autor**: lo que manda es la sección [Decisiones del autor](#decisiones-del-autor) de este plan.

La visión de Campaign (narrativa, Control Maestro, bandas transportadoras, producción adaptable, nuevas armas y sensores) está en [`docs/Vision/2026-11-03/`](Vision/2026-11-03/VISION-CAMPANA.md). **No es trabajo de este plan.** Consúltala solo para no cerrar puertas; no implementes nada de ella.

## Resumen

- **Objetivo.** Una sola aplicación, derivada de War, donde corren los retos de War y los de Factory sobre una misma base de simulación. Una mejora del editor, del inspector o de la distribución llega a las dos series sin copiarla.
- **Idea central: máquinas en un mismo mundo, no modos.** War y Factory dejan de ser dos motores y pasan a ser dos series de retos sobre un catálogo común de máquinas: lanzador, sensor, depósito, reparador, robot de carga, bodega y fundidora. Cada reto elige qué máquinas, metas y herramientas usa.
- **Un solo runtime: el de War.** Un Web Worker por máquina programable, avance sincronizado (lockstep) e instantánea del mundo al despertar. Un encargo de Factory (`await yo.recoger(...)`) es una espera cuya duración decide la simulación.
- **Primero paridad, después reglas nuevas.** El Factory migrado reproduce exactamente el original (oráculo). Las reglas que el autor ya aprobó se aplican después, una por una, con pruebas y con el oráculo actualizado a propósito.
- **Factory original congelado como referencia.** No recibe mejoras. Se retira, con redirección, solo cuando haya paridad completa.
- **Pasos pequeños, sin reescritura ni sobreingeniería.** JavaScript y CSS sin framework ni compilación. Se generaliza solo lo necesario para que las dos familias de máquinas convivan. Ninguna abstracción se crea porque «podría servir» para una mecánica futura.

## Por qué ahora

- Factory ya no recibe lo nuevo de War: pantalla completa, panel inferior Inspector/Consola, ficha de información con pestañas, telemetría remota. Desde el 31 de octubre solo ha recibido la franja «War es la versión más actualizada del juego».
- La interfaz ya diverge: `css/componentes.css` difiere en unas 930 líneas entre los dos prototipos y `js/layout.js` en unas 290. Cada arreglo exige dos implementaciones y dos revisiones.
- Lo propio de Factory es pequeño. En su `js/juego.js` (2.325 líneas), las secciones Retos, Runtime, Mundo y Ciclo suman unas 540 líneas. Bloques y seudocódigo (Textos, Modelo del programa, Modos, Paleta, Edición de bloques, Arrastrar) suman unas 790, y «Tu reto», unas 100. El resto es interfaz que War ya resuelve.
- War ya tiene el germen del catálogo. `crearMundo` reúne `maquinas` con `clase` (`lanzador`, `vibracion`, `deposito`, `reparador`) y un índice `porId`. `FUNCION_DE` ya reserva la función `fabrica`. El reparador ya es una unidad que se desplaza por el mapa (`pasoReparador`).

## Decisiones del autor

Tomadas el 2 de noviembre de 2026. **Decidido** orienta este plan; **dirección** marca el sentido sin fijar detalles; **pendiente** lo decide el usuario más adelante y el agente solo prepara opciones.

| Tema | Estado | Qué significa para la unificación |
| --- | --- | --- |
| Unificar Factory y War | Decidido | Una base de aplicación y simulación común. War es la base; Factory migra por etapas. |
| Temporalidad y `await` | Decidido | Se mantienen tres clases de órdenes: **encargos** (consumen tiempo y se esperan), **modos** (se configuran al instante y siguen funcionando) y **lecturas** (consultan sin avanzar el tiempo). Las máquinas siguen operando mientras su programa espera. Los tutoriales deben explicar que `await` introduce temporalidad y sincronización. |
| Victoria | Decidido | Se gana cuando se cumplen las metas del mundo, no cuando el programa termina. Un `while (true)` no falla si las metas ya se cumplieron. Los límites contra bloqueos (bucle sin `await`, demasiadas órdenes sin esperar) se mantienen y no son una penalización por continuidad. |
| `null` y `0` | Decidido conceptualmente | No son equivalentes. En materiales, `0` es «existe y no tiene material»; `null` puede ser «la máquina no existe o fue destruida». El significado de `null` se documenta por operación: en un sensor sigue siendo «no detectó nada». |
| Entrega a una máquina llena | Decidido | La carga se queda en el robot. No se derrama ni desaparece. El resultado del encargo comunica que no se pudo entregar. |
| Idioma de la API | Decidido provisionalmente | Inglés como idioma principal. Selector de idiomas más adelante, fuera de este plan. Sin refactorización de internacionalización. |
| Nombres de máquinas | Dirección | Referenciar máquinas por nombre o variable reutilizable, sin obligar a escribir identificadores como texto. |
| Prefijo `yo.` | Decidido | Una máquina que se programa a sí misma no necesita escribir su nombre, `yo.` ni `self.`. |
| Compatibilidad | Decidido | Los programas existentes de las dos series siguen funcionando durante la migración. |
| Azar industrial | Dirección | Bajo, previsible o comprensible. Sin averías frecuentes en la fábrica. No se añade azar nuevo en este plan. |
| Economía | Dirección | Los costes serán una métrica relevante. La fórmula de eficiencia de los retos mixtos está pendiente. No se diseña mercado, moneda ni precios. |
| Percepción | Dirección | Progresión como la de War: primero consultas fiables, después sensores con límites. Sin cambios en este plan. |
| Proyectiles | Decidido conservar | La simulación actual (destino fijo, explosión al llegar, radio de daño, predicción de `autoTarget`) se queda como está. Sin motor físico. |
| Suministro automático de War | Decidido | La recarga automática de munición y la reparación autónoma son simplificaciones de los retos de War. Se conservan durante la migración; su sustitución pertenece al diseño futuro de escenarios mixtos. |
| Programación local | Dirección | Cada máquina programable tiene su propio programa y, desde su editor, llama a sus funciones directamente. Es el modelo actual de War y debe seguir siéndolo. |
| Tamaño del mapa | Pendiente | 9 × 7 y 32 × 18 son parámetros de los retos actuales, no el tamaño de Campaign. El mapa sale del reto; no se fija ningún tamaño definitivo. |

### Cambios respecto al plan del 2 de noviembre

- **Victoria.** El plan anterior conservaba «gana al terminar el programa» en Factory hasta que el reglamento decidiera. Ahora está decidido: metas del mundo para todas las series. Se aplica en la etapa 3, después de la paridad, no en la etapa 1. Desaparece el campo `fin: "programa"` como regla permanente; solo existe mientras dure la paridad.
- **Derrame.** El plan anterior conservaba el derrame de Factory. Ahora, una entrega en una máquina llena deja la carga en el robot. Afecta a `"derrame"`, a `maxDerrames`, al dibujo del suelo y al reto «Sin derrames» (ver [pendientes](#decisiones-pendientes-del-usuario)). Se aplica en la etapa 3.
- **Idioma, nombres y `yo.`.** Las decisiones 4, 5 y 6 del plan anterior quedan resueltas: inglés, máquinas por nombre o variable, y `yo.` opcional. Los nombres concretos en inglés de la API del robot los propone el agente y los confirma el usuario. Los nombres actuales en español se mantienen como alias.
- **Qué se mejora en un reto mixto.** Ya no es «tiempo, coste o ambos»: la dirección es la eficiencia económica. La fórmula queda pendiente y no corresponde a este plan.
- **Etapas 6 (primer reto mixto) y 7 (Campaign).** Salen del plan. Pasan a la [visión](Vision/2026-11-03/VISION-CAMPANA.md) como experimentos futuros. Este plan termina cuando Factory corre en la base común y el original se retira.
- **Recomendaciones de `docs/analisis/` que no se adoptan como decisión**: el seguimiento por entidad como orden habitual, el rechazo de un encargo dado a una máquina ocupada, el suministro explícito que sustituye la recarga gratuita y la propuesta de primera campaña. Siguen siendo material de referencia.

## Estado de partida

| Aspecto | Factory hoy | War hoy |
| --- | --- | --- |
| Mapa | 9 × 7 casillas, plano 2D en canvas | 32 × 18 casillas de 1 m (`COLS`, `ROWS`, constantes), 3D con Three.js r128 y plano |
| Unidades programables | Un robot, R1 | Uno o dos lanzadores, cada uno con su programa |
| Runtime | Un worker. Cada `yo.*` envía `call` y espera `res`: petición y respuesta. Instrumentación con expresiones regulares | Un worker por lanzador. Instantánea al despertar, órdenes sin respuesta, el reloj avanza cuando todos los programas están en `await esperar(...)`. Instrumentación con el léxico propio y sintaxis comprobada con Acorn |
| API | `yo.recoger(lugar, mat)`, `yo.entregar(lugar)`, `yo.esperar(s)`, `yo.cuantos(lugar, mat)`, todas con `await` y `yo.` obligatorio. Lugares como texto: `"ENT-1"` | `autoTarget`, `regularShoot`, `burstFire`, `stopFire`, propiedades (`failureRate`, `missiles`, `jammed`…), `VIB_01.detect`, `await esperar(s)`. `yo.` opcional; otras máquinas como `LAU_02` |
| Resultado de una orden | Al terminar el encargo: `"ok"`, `"viaje_vacio"`, `"rechazado"`, `"derrame"`, `"manos_llenas"`, `"manos_vacias"` | Al darla: `"ok"` o un motivo |
| Destino lleno | La pieza se derrama (`"derrame"`) y el robot queda con las manos libres | Sin entrega logística: la recarga es automática |
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

La arquitectura solo tiene que **no impedir** futuras familias de máquinas (por ejemplo, entregar a otra máquina o que una máquina deje de existir). No hace falta prepararlas: basta con que el catálogo y el runtime no supongan que solo hay lanzadores o solo hay un robot.

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
- **Orden a una máquina ocupada**: da el error actual de Factory («Falta await en la línea N: R1 seguía con … cuando llegó la orden de la línea M»), con las mismas líneas. La alternativa de `docs/analisis/` (rechazar la orden nueva y conservar la anterior) no está aprobada.
- **`yo.cuantos` es una lectura**: se lee de la instantánea, sin gastar tiempo. Los programas guardados con `await yo.cuantos(...)` siguen funcionando: `await` delante de un número no cambia nada.
- **El reloj avanza cuando todos los programas esperan**, en `esperar` o en un encargo. Con un solo robot, Factory debe dar exactamente el mismo tiempo que hoy.
- **Límites y mensajes por serie**: 500 consultas seguidas para el robot, 4000 mensajes para los lanzadores, `T_LIMITE` por reto (300 s en Factory, 400 s en War). Unificarlos no es necesario para este plan.

### Retos como datos

Campos que necesita la aplicación unificada (los nombres concretos los fija el agente al implementar):

- `serie`: `"war"` o `"factory"`. La serie `"campaign"` llegará con la visión, no con este plan.
- **Clave estable** por reto.
- `mapa`: `{ cols, rows }`. Por defecto, los 32 × 18 de War; Factory usa 9 × 7. `COLS` y `ROWS` hoy son constantes usadas en muchos sitios (terreno, entrada de enemigos en `COLS + .4`, límites de «Tu escenario»): deben salir del reto sin cambiar los valores de War.
- `maquinas`, `oleadas`, `stock` y `stockPorIntento`.
- `metas`.
- `fin`: `"mundo"` para War. Factory usa `"programa"` solo hasta la etapa 3, que lo pasa a `"mundo"`.
- `limite`, en segundos.
- `mejora`: `"coste"` o `"tiempo"`, como hoy en cada serie.
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
- **Datos por reto**: `records`, `hechos`, `pistas` y `telemetria` ya se indexan por clave de reto. El récord debe guardar qué mide (`tiempo` o `coste`). Si una regla nueva de la etapa 3 cambia lo que mide un récord, el récord anterior no se compara con el nuevo.
- **Preferencias de pantalla**: las de War, comunes a todas las series. El modo de programa (bloques, seudocódigo o JS) y el idioma de los bloques pueden recordarse por serie, importando `cmg-banco02:modo` e `idioma` la primera vez.

## Invariantes durante toda la migración

- **War no cambia de comportamiento**: retos, API, mensajes, recarga y reparación automáticas, guardado `cmg-banco03:*`, récords, telemetría (`sandbox: "03_lanzamisiles"`), `window.cmg` y `window.__banco`. Sus pruebas pasan en cada etapa sin editarlas, salvo las versiones `?v=` que algunas exigen (por ejemplo, `pruebas/war-20-ciclos.mjs`).
- **Factory migrado reproduce el original** (API, resultados, mensajes de error, límites, tiempos, victoria y récord) hasta la etapa 3. A partir de ahí solo cambian las reglas aprobadas en [Decisiones del autor](#decisiones-del-autor), cada una en su propio cambio.
- **Compatibilidad de programas**: todo programa guardado de War o de Factory sigue ejecutándose. Los nombres nuevos (inglés, máquinas como variables, sin `yo.`) se añaden; los antiguos quedan como alias.
- **Determinismo**: paso fijo, RNG con semilla y `stockPorIntento`. Ninguna regla usa `Math.random` ni el reloj real.
- **Sin herramientas nuevas**: ni dependencias, ni motores, ni compilación. `?v=N` en el `index.html` al cambiar CSS o JS, y la lista permitida de `scripts/preparar-netlify.mjs` al añadir archivos.
- **Reglas, API o formatos de guardado** solo cambian con decisión explícita del usuario, documentada en `PROGRESO.md` y con cobertura.
- **Mover no es reescribir.** Cuando una etapa traslada código, el diff debe poder leerse como traslado.

## Etapas

Cada etapa termina con todo verificado y registrado antes de empezar la siguiente.

### Etapa 0 · Preparación

**Completada el 3 de noviembre de 2026.** Instrucciones de raíz actualizadas y [oráculo reproducible](../pruebas/factory-oraculo.md) guardado: 28 casos, seis retos y «Tu reto», 56 ejecuciones reales en 8771, dos pasadas idénticas. Fuente: `b76411b`; detalle de comprobaciones y límites en `PROGRESO.md`.

- Confirmar con el usuario el inicio del plan y actualizar la regla del prototipo canónico en `AGENTS.md` y en cualquier otro archivo de instrucciones de la raíz que la repita: la base sigue siendo War; el Factory original queda congelado (solo arreglos que impidan usarlo) y sirve de referencia.
- **Oráculo de Factory.** Para cada reto, un conjunto de programas ejecutados en el Factory original, en el puerto 8771 y con `window.__banco`, como ya hace la ejecución real de `pruebas/tres-vistas.mjs`. El conjunto incluye el de partida, uno que gana, uno con derrame, uno con viaje vacío, uno sin `await`, uno que no termina y uno de «Tu reto». De cada uno se registra:
  - `mundo.fin`, el motivo y la línea del error;
  - `mundo.t`, los derrames, los viajes vacíos y las metas;
  - el número de intento, porque `stockPorIntento` depende de él.

  Se guarda como fixture JSON en `pruebas/`, con el commit de origen. Los casos de derrame y de programa que no termina son los que la etapa 3 cambiará a propósito; márcalos en el fixture.
- **Hecho cuando** el fixture cubre los seis retos y «Tu reto», y dos ejecuciones seguidas dan los mismos valores.

### Etapa 1 · «Primer viaje» en la base de War

**Completada el 3 de noviembre de 2026:** entrada `?serie=factory`, 8 casos de paridad exacta, 123 pruebas de lógica y 90 de War, capturas PC/móvil revisadas. Detalle en `PROGRESO.md`.

Primer resultado jugable. Valida la arquitectura antes de migrar todo. Paridad estricta con el original: ninguna regla nueva todavía.

1. Mapa por reto: `COLS` y `ROWS` salen del reto; por defecto, los de War.
2. Clases `robot`, `bodega` y `fundidora` en un archivo nuevo del catálogo, con la lógica de la sección Mundo de Factory: `iniciarOrden`, ruta en L, `VEL` 4 casillas/s, `OP` 0,5 s, `cap`, `tProceso` y `PRODUCTO`. En `juego.js`, solo los enganches.
3. Encargos en el runtime de War, según lo descrito arriba. API del robot: `yo.recoger`, `yo.entregar`, `yo.esperar` y `yo.cuantos`, con `yo.` obligatorio como hoy.
4. Fin por programa y límites de Factory para esta serie, solo para la paridad.
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

**Completada el 3 de noviembre de 2026.** Módulos de combate, retos, runtime, núcleo y vistas separados; paridad y suites vigentes correctas. Ver `PROGRESO.md`.

Con dos series en la misma aplicación, partir `js/juego.js` (unos 220 KB) por las costuras que mostró la etapa 1: núcleo, runtime, catálogo (War en su propio archivo, como Factory), retos (datos), vistas del mapa e interfaz. A `shared/` va solo lo que use otra página: portada, Campaign o el laboratorio de VFX.

- **Hecho cuando**:
  - los diffs se leen como traslados;
  - todas las suites y el oráculo pasan;
  - `index.html` carga los archivos en orden y con `?v=`;
  - `node scripts/preparar-netlify.mjs` y `node pruebas/publicacion.mjs` son correctos.

### Etapa 3 · Reglamento común y reglas aprobadas

**Completada el 3 de noviembre de 2026.** Las siete reglas, cada una con su delta en `pruebas/factory-deltas.json`, y [`docs/REGLAMENTO.md`](REGLAMENTO.md). Ver `PROGRESO.md`.

Puede ir en paralelo a la etapa 2. Resultado: `docs/REGLAMENTO.md`, que fija para las dos series qué es un encargo, un modo y una lectura, cuándo pasa el tiempo, cuándo se gana y qué devuelve cada operación (incluido el significado de `null` y `0` en cada una).

Cambios ya aprobados, **cada uno en su propio cambio**, con cobertura, entrada en `PROGRESO.md` y el oráculo actualizado en ese mismo cambio explicando por qué:

1. **Victoria por metas del mundo en Factory.** `fin: "mundo"` para todos los retos. Un `while (true)` con las metas cumplidas gana. El aviso «¿Hay un bucle que nunca termina?» al llegar a `T_LIMITE` solo aparece si las metas no se cumplieron. Revisar los retos cuyas metas hoy se cumplen antes de que el programa termine («Hasta vaciar», por ejemplo) para que el resultado siga teniendo sentido.
2. **Entrega a una máquina llena.** El robot conserva la carga y el encargo devuelve un motivo legible (el agente propone el nombre; por ejemplo `"lleno"`). Desaparece el derrame implícito. Ajustar el inspector, la consola, el dibujo y las metas que hoy cuentan derrames, según lo que el usuario decida para «Sin derrames».
3. **`null` frente a `0`.** `yo.cuantos` devuelve `0` para una máquina existente sin ese material. Para un lugar que no existe, documentar el comportamiento actual y proponer `null` o error; hoy no hay máquinas destruibles, así que no se inventa la destrucción.
4. **`yo.` opcional en el robot**, como en War.
5. **Máquinas como variables** (`ENT_1`, `FUN`, como `LAU_02` en War), con el texto `"ENT-1"` aceptado como alias.
6. **API del robot en inglés.** El agente propone los nombres (verbos en la línea de `autoTarget` y `regularShoot`) y el usuario los confirma antes de implementarlos. Los nombres en español siguen funcionando. Seudocódigo y bloques muestran los nombres nuevos.
7. **Textos de tutorial sobre `await`**: dejar claro en las lecciones de las dos series qué líneas esperan (encargos y `esperar`) y cuáles no (modos y lecturas).

Las decisiones que sigan pendientes se preparan como opciones, con la recomendación del agente, y las decide el usuario.

### Etapa 4 · Resto de Factory

**Completada el 3 de noviembre de 2026.** Seis retos y «Tu reto», bloques/seudocódigo/JS, récord por tiempo y telemetría local; oráculo completo 28/28 con 13 deltas aprobados. Ver `PROGRESO.md`.

- Retos «Dos materiales», «Sin derrames» (según la decisión pendiente), «Contra reloj», «Hasta vaciar» y «Plan B», y «Tu reto» con su editor de enunciado y metas.
- Bloques y seudocódigo para programas del robot (Modelo del programa, Paleta, Edición de bloques, Arrastrar), con `ladrillos` por reto, según la decisión sobre la fuente de verdad.
- Récord por tiempo y telemetría de la serie.
- Copias de `pruebas/tres-vistas.mjs` y `pruebas/factory-editor.mjs` adaptadas a la nueva entrada. Las originales siguen hasta el corte.
- **Hecho cuando**:
  - el oráculo completo coincide, con las diferencias aprobadas en la etapa 3 marcadas;
  - el mismo programa da el mismo tiempo en bloques, seudocódigo y JS;
  - los programas guardados en el Factory original se importan y dan el resultado esperado según el reglamento.

### Etapa 5 · Retirar el Factory original

**Completada el 3 de noviembre de 2026.** Redirecciones con query y hash, portada a la nueva entrada, código y suites viejas fuera del árbol. Ver `PROGRESO.md`.

- `Prototypes/Tres vistas/index.html` redirige a la nueva entrada conservando query y hash, como ya hace `Prototypes/02_tres_vistas.html`.
- La portada apunta Factory a la nueva entrada y desaparece la franja «War es la versión más actualizada».
- El código viejo sale del paquete de Netlify y del árbol; queda en el historial de git. Borrar archivos requiere confirmación del usuario.
- Se retiran las suites viejas de Factory.
- **Hecho cuando** `pruebas/entrada.mjs`, `pruebas/publicacion.mjs` y todas las suites pasan, y los enlaces antiguos llegan al reto correcto.

Aquí termina este plan. El primer escenario mixto (robot que abastece a un lanzador) y Campaign se planificarán aparte, a partir de la visión.

## Decisiones pendientes del usuario

**Confirmación del 3 de noviembre de 2026:** JS como fuente; «Sin entregas rechazadas»; API `pickUp`, `deliver`, `wait`, `count` con alias; `null` para lugar inexistente; lecturas con `await` sin aviso; Factory solo con telemetría local; conservar `Prototypes/Rocket Launcher/`. Los puntos siguientes conservan las alternativas históricas; 1–7 están resueltos por esta confirmación.

Cada una con la recomendación de este plan o de `docs/analisis/`:

1. **Fuente de verdad del programa**: texto JS (recomendado) o árbol de bloques.
2. **Reto «Sin derrames»**: sin derrame, el reto pierde su regla. Opciones: convertirlo en «sin entregas rechazadas» (el robot vuelve con la carga y eso cuesta tiempo), sustituirlo por otro reto o conservar un derrame explícito solo si el reto lo anuncia (una orden de descarte). Recomendado: «sin entregas rechazadas», que mantiene la lección de planificar la capacidad.
3. **Nombres en inglés de la API del robot**: los propone el agente en la etapa 3.
4. **`await` en lecturas**: dejar `await yo.cuantos(...)` sin aviso, o mostrar un aviso suave cuando sobra (recomendado).
5. **Lugar inexistente en `yo.cuantos`**: `null` o error.
6. **Telemetría remota de la serie Factory**: activarla con su propio `sandbox` (recomendado) o dejarla local.
7. **Ubicación final**: seguir en `Prototypes/Rocket Launcher/` o mover la aplicación a una ruta neutral con redirecciones.
8. **Ritmo de War durante las etapas 1 y 2**: pausar los cambios grandes o seguir en paralelo con etapas más cortas.

## Riesgos y cómo detectarlos

- **Tiempos distintos** por el orden de evaluación dentro de `paso` o por redondeos → el oráculo exacto.
- **Cambios de regla mezclados con traslados** → la etapa 3 aplica cada regla aparte y nunca dentro de un traslado.
- **Ida y vuelta entre árbol y texto** → prueba con los programas de partida y los guardados.
- **Programas del jugador** → no escribir en `cmg-banco02:*` hasta el corte; probar la importación con datos reales copiados a un origen de prueba.
- **Rendimiento del lockstep** con robot y lanzadores a la vez en teléfono → medir en emulación y pedir QA en dispositivo real.
- **War cambia mientras se migra** → etapas cortas y la suite de War en cada paso.
- **Pruebas intermitentes conocidas de War** (doble toque sintético, arrastre a `stopFire(`) → repetir antes de dar algo por regresión.
- **CDN** (Three.js r128, Acorn 8.11.3) → sin cambios; la aplicación sigue necesitando conexión.

## Cómo informar de cada etapa

Según `AGENTS.md`: una entrada en `PROGRESO.md` con qué cambió, las versiones `?v=`, la verificación (resultados de cada suite y del oráculo), los límites (emulación frente a dispositivo real) y las decisiones que quedan pendientes. Sin commits, push ni publicación salvo instrucción del usuario.

## Fuera de alcance

No se implementa en este plan, aunque esté en la [visión](Vision/2026-11-03/VISION-CAMPANA.md):

- Campaign: historia, sistema político o narrativo, árbol de decisiones, progresión tecnológica y escenarios mixtos.
- Economía: mercado, precios, contratos o fórmula de eficiencia.
- Combate nuevo: armas, láseres, sensores de seguimiento avanzado o por identidad, IA de enemigos, cinemática inversa y física avanzada.
- Coordinación: Control Maestro, redes de fibra óptica, comunicación remota y reutilización de programas entre máquinas.
- Logística: bandas transportadoras, túneles reforzados, destrucción de edificios y sustitución del suministro automático de War.
- Producción: recetas reconfigurables y tecnologías finales de fabricación.
- Selector de idioma de la API.

También siguen fuera TypeScript, VM o representación intermedia, frameworks, Python, empaquetado móvil, el modelado 3D de los edificios de Factory (opcional) y el rebalanceo de los retos actuales.
