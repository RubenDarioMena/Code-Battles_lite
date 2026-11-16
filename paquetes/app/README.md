# app

Estado: fase 2, paso 8a (conductor común listo para integrar el juego).

Compone reglamento, vistas, anfitrión e interfaz. Conecta sus entradas públicas
y deja la plataforma a las cáscaras.

## Puede importar

`protocolo`, `nucleo`, `reglas-war`, `reglas-factory`, `reglas-campaign`,
`lenguaje`, `anfitrion`, `editor`, `vfx`, `vista-2d`, `vista-3d`, `interfaz`.
Véanse las reglas de [paquetes](../README.md).

## Contrato vigente

- `crearVistaNula()` cumple el contrato de vista del plan (`dibujar(anterior,
  actual, fraccion)`, `alSuceso(suceso)`, `elegir(x, y)` → `null`,
  `redimensionar()`, `destruir()`) sin dibujar, y añade `resumen()` →
  `{ fotogramas, sucesos, t }`. Rechaza fracciones fuera de [0, 1] y dibujar
  tras destruir.
- `await jugarPartida({ reglas, escenario, semilla, anfitrion?, vista?, ordenes?,
  maxPasos = 10000, alPaso?, alSucesos?, alTurno?, partida?, detener? })` crea la partida con `crearPartida` del núcleo y
  juega en lockstep: primero `anfitrion.ceder(instantánea inicial)` (arranca los
  programas cargados) y después, tras cada `paso()`,
  entrega las respuestas del paso con `responder` antes de `ceder(instantánea)`.
  Las continuaciones de los encargos preceden así al despertar de esperas por
  tiempo, igual que en el ciclo antiguo. Aplica las órdenes del turno
  con `partida.aplicarOrdenes()` y entrega las respuestas inmediatas mediante
  `anfitrion.responder`, repitiendo hasta vaciar la cola, un error o el final.
  Así `manos_llenas`, `manos_vacias` y `programa-acabado` no añaden un paso.
  Las órdenes del paso actual se aplican antes de evaluar también sin anfitrión,
  así que para repetir una partida de `jugarPartida` se llama `aplicarOrdenes()`
  tras `restaurar` (una orden puede terminarla sin avanzar: Factory,
  `programa-acabado`). `alPaso(paso, instantanea, partida)` recibe la partida.
  Si se recibe `partida`, continúa sobre esa misma instancia con un anfitrión
  nuevo; no recrea mundo, reloj ni órdenes. `detener(partida)` se comprueba
  después de cada paso, antes de ceder, y entre turnos para detectar el final
  quieto. El corte por hito precede a entregar los mensajes del paso del hito.
  El cierre de Campaign se solicita después mediante la orden `fin-tramo`.
  Al terminar entrega las respuestas restantes a `detener(respuestas)` para
  registrar el último encargo sin ejecutar la continuación del programa. Para
  cuando `reglas.evaluar` devuelve algo, cuando el anfitrión informa un error de
  programa o al llegar a `maxPasos`. La vista recibe la instantánea inicial y la
  de cada paso con fracción 1, y cada suceso nuevo una vez (por `paso`
  creciente). Devuelve `{ partida, pasos, error, limite, evaluacion,
  instantanea }`. Sin anfitrión, repite una partida a partir de sus `ordenes`.

## Conductor por llamadas

`crearConductor({ reglas, partida, anfitrion?, vista?, alPaso?, alSucesos?,
alTurno?, detener? })` recibe una partida ya creada. Es el mismo lockstep que
usa `jugarPartida`, dividido para poder dosificarlo desde el juego:

- `await iniciar()` entrega los sucesos iniciales, dibuja la primera instantánea
  y solicita el primer `ceder`. Es idempotente.
- `await avanzar(maxPasos)` devuelve `{ pasos, terminada }`. El presupuesto es
  un entero no negativo y se renueva en cada llamada. Aplica las órdenes al
  recibir cada turno y agota las respuestas inmediatas sin consumir pasos.
  Tras cada paso procesa primero las respuestas y sus continuaciones, después
  las esperas vencidas mediante `ceder`. Corta por error, evaluación o `detener`.
  Si un Worker sigue corriendo devuelve el control y conserva su turno pendiente;
  la llamada siguiente lo recoge sin duplicar cesiones ni avanzar el reloj
  mientras corre. También `iniciar` puede dejar pendiente el primer turno.
  Las llamadas se hacen secuencialmente, con `await`.
- `alPaso(numero, instantanea, partida)` cuenta desde este conductor, incluso
  cuando la partida ya tenía pasos. `alSucesos(lista)` recibe los sucesos iniciales
  y los nuevos tras cada paso (también listas vacías), después de entregarlos
  a la vista. Conserva los del mismo paso añadidos después de una entrega previa.
  `alTurno({ ordenes, avisos, error })` se llama después de aplicar las órdenes
  de cada turno, incluidos los de `responder`, antes de solicitar el siguiente.
- `reanudar()` permite seguir tras un corte de `detener` cuando la condición ya
  se retiró. Conserva las respuestas del último paso y las entrega antes de las
  esperas y los programas nuevos cargados durante la pausa. No reabre un
  conductor cerrado ni borra errores.
- Los getters `error` y `terminada` reflejan el corte; agotar el presupuesto de
  una llamada no termina el conductor. `cerrar()` lo termina y llama una sola
  vez a `anfitrion.detener` con las respuestas restantes. No destruye la vista.

`jugarPartida` espera internamente los turnos pendientes sin sondeo, incluidos
los del último paso permitido, y cierra el conductor al terminar o lanzar una
excepción. Conserva su resultado y su límite total de pasos. La aplicación en
vivo puede atender al vigía entre llamadas a `avanzar`.

## Pruebas

- `node paquetes/app/pruebas/app.mjs`: vista nula y bucle con un reglamento
  mínimo y un anfitrión falso (orden de aplicación, error, límite), lotes del
  conductor, callbacks, continuaciones inmediatas, corte por tramo, Workers
  asíncronos simulados y vigía. Comprueba que `jugarPartida` recoge el turno
  asíncrono del último paso antes de cerrar por límite.
- `node pruebas/fronteras-fase2.mjs` (en `pruebas/` porque usa el instrumentador
  y la imitación de Worker de `herramientas/partida/`): pruebas de frontera 1–3
  del plan. Las 10 partidas War de referencia juegan con `reglas-war`,
  `crearAnfitrion` y la vista nula, y dan **la misma huella, pasos y final** que
  `pruebas/referencias/partidas.json`. Después, la partida War 2/7 se repite
  exacta desde escenario, semilla y órdenes (`restaurar` y `jugarPartida` sin
  anfitrión), y una orden de origen `jugador` hace disparar a `LAU-01` en el
  paso indicado y se repite igual.
  En las 10 partidas compara además el registro combinado: sucesos `registro`
  en `alSucesos` y eventos incrementales del anfitrión en `alTurno`, sin
  reordenarlos, contra `mundo.eventos` del ciclo antiguo sobre un mundo accesible.
  Coinciden el orden completo, el uso por programa, consolas y lecturas por sensor.

También `node pruebas/fronteras-factory.mjs`: 28 referencias Factory, por las
entradas públicas: huella, pasos, resultado completo y repetición exacta 28/28
(la huella se mide sobre la instantánea del legado, como en la fase 0; véase el
README de `reglas-factory`).

`node pruebas/fronteras-campaign.mjs` comprueba las 2 referencias Campaign:
huellas y resultados de H0–H5, secuencia paso a paso y 12 repeticiones exactas.

`node pruebas/juego-conductor.mjs` extrae el adaptador de `juego.js` y lo ejecuta
sin DOM en VM, con el texto real del Worker y un canal emulado. Compara las
41 huellas, pasos y resultados con las referencias, los seis cortes Campaign
y la reanudación con las unidades nuevas. No verifica Workers ni dibujo reales;
eso lo comprueban las suites de navegador sobre `__banco`.

Estas suites están registradas en `pruebas/todas.mjs`. La cuarta prueba de frontera
(editor montado solo) es de navegador.

## Pendiente

El juego usa el conductor con Workers reales. `juego.js` y `layout.js` deben repartirse
entre `interfaz` y `app`, y las vistas pasar a instantáneas y sucesos.
