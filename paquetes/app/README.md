# app

Estado: fase 2, paso 14 (plataforma de guardado inyectada).

Compone reglamento, vistas, anfitrión e interfaz. Conecta sus entradas públicas
y deja la plataforma a las cáscaras.

## Plataforma y guardado

`Plataforma = { almacen: Almacen, sesion: Almacen }` se declara en `index.d.ts`.
Cada `Almacen` ofrece `leer(clave): string | null`,
`escribir(clave, texto): void` y `borrar(clave): void`, con claves y valores en
texto tal cual. El adaptador absorbe errores de almacenamiento: lectura fallida
→ `null`, escritura y borrado fallidos → sin efecto. Quien llama conserva sus
conversiones JSON y migraciones; no se añade ningún prefijo en la plataforma.

La interfaz es síncrona a propósito: escritorio cargará los datos al arrancar y
persistirá en disco por detrás. `crearPlataformaMemoria()` crea dos almacenes
independientes y aislados por llamada, sin DOM ni persistencia. Es el valor por
defecto de `arrancarJuego({ plataforma?, servicios? })` y permite pruebas y
partidas sin pantalla; las partidas de `jugarPartida` no necesitan guardado.

La entrada del juego inyecta la plataforma web. App e interfaz la consultan por
`ctx.plataforma`; el editor recibe `configurar({ sesion: plataforma.sesion })`.
Las claves, valores y el orden de las migraciones siguen intactos. El inventario
por archivo y la limitación de i18n están en
[`cascaras/web/README.md`](../../cascaras/web/README.md).
Pruebas: `node pruebas/plataforma.mjs`, `node pruebas/juego-arranque.mjs` y
`npm test`; no requieren navegador.

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
  reordenarlos, contra el ciclo real importado de `app/juego` con contexto en VM
  (`pruebas/juego-adaptador.mjs`), que compone la partida por separado.
  Coinciden el orden completo, el uso por programa, consolas y lecturas por sensor.

También `node pruebas/fronteras-factory.mjs`: 28 referencias Factory, por las
entradas públicas: huella, pasos, resultado completo y repetición exacta 28/28
(la huella se mide sobre la lectura histórica `instantaneaHistorica`, como en la fase 0; véase el
README de `reglas-factory`).

`node pruebas/fronteras-campaign.mjs` comprueba las 2 referencias Campaign:
huellas y resultados de H0–H5, secuencia paso a paso y 12 repeticiones exactas.

`node pruebas/juego-conductor.mjs` importa `instalarCicloProgramas` y lo ejecuta
con un `ctx` falso sin DOM, con el texto real del Worker y un canal emulado. Compara las
41 huellas, pasos y resultados con las referencias, los seis cortes Campaign
y la reanudación con las unidades nuevas. No verifica Workers ni dibujo reales;
eso lo comprueban las suites de navegador sobre `__banco`.

Estas suites están registradas en `pruebas/todas.mjs`. La cuarta prueba de frontera
(editor montado solo) es de navegador.

## Pendiente

El juego usa el conductor con Workers reales. Falta adoptar el contrato completo
de las vistas y retirar los globales de compatibilidad que aún tienen consumidores.


## Juego en vivo (pasos 11a–11c)

La entrada pública exporta `instalarCicloProgramas(ctx)`,
`instalarCierreIntentos(ctx)` e `instalarBucleJuego(ctx)`, implementados en
`juego/`. Importarlos no accede al DOM ni arranca fotogramas o Workers.

- El ciclo devuelve `ejecutar`, `arrancarPrograma`, `avanzar`, `cerrarProgramas`,
  `registroActual`, `vigia` y los auxiliares de revisión/formato. Recibe las
  fábricas de partida, anfitrión y conductor; el reglamento, el instrumentador,
  las fuentes Python y los callbacks de presentación por `ctx`. El entorno
  de Workers (`Worker`, `URL`, `Blob`, `performance`) también se inyecta.
- El cierre devuelve `terminar` y `detener`. Conserva la telemetría, récords,
  banners y guardado de los intentos; Campaign delega en su composición actual.
  Separarlo del ciclo permite probar este con una presentación falsa.
- El bucle devuelve `bucle(now)`. La composición lo inicia mediante
  `requestAnimationFrame`; conserva el cálculo de tiempo, dibujo y refrescos.

`arrancarJuego({ plataforma?, servicios? } = {})` instala la aplicación una vez
sobre el DOM y las dependencias clásicas ya cargadas, conservando la selección
actual por URL/guardado. Importar `app` sigue sin acceder al navegador.
`juego.js` importa esta función, los servicios y la plataforma web y la llama.

`juego/estado.js` crea `ctx`, las constantes y tablas visuales, guardado,
lenguaje y las variables compartidas con accesores. Los demás instaladores
leen `ctx.x` al llamar; sus descriptores se conectan sin evaluar getters, por
lo que no se pierden sustituciones ni se adelantan lecturas de inicializadores.
El orden de instalación explícito está en `juego/iniciar.js`.

| Archivo de `juego/` | Responsabilidad |
| --- | --- |
| `vistas.js` | Escena por fotograma, montaje 3D/plano, proyección, elección 2D y cámara. Importa solo las entradas públicas de las vistas. |
| `campo.js` | Ratón, tacto, selección en cuadro y entrada de coordenadas. |
| `programas.js` | Programas, selección/lenguaje del documento y Add/Replace. |
| `python.js` | Conversión de fragmentos, opciones del traductor, vocabulario y atajos Python. |
| `escenario.js` | Formulario, copia/importación y guardado del escenario propio. |
| `campaign.js` | Planta viva, hitos, checkpoints, historial y cierre de tramos. |
| `proveedor.js` | Datos del juego inyectados al editor y los traductores. |
| `arranque.js` | Publicación de `window.__banco`, `window.cmg`, formulario Factory, primer reto y textos dinámicos. |

Se conservan el aviso de fallo de carga de `index.html`, los IDs, las claves de
guardado. Los proveedores Factory/Campaign se importan por la entrada pública
de `interfaz`; layout recibe `cmg` por parámetro. `juego/entorno.d.ts` declara estos globales para
`checkJs`; no crea globales en ejecución. No hay dependencias nuevas.

El adaptador de pruebas importa el ciclo real. Solo extrae `nuevoMundo`
de `interfaz/info-reto.js` y tres funciones de `app/juego/campaign.js`, sin
copiar su implementación ni modificar sus aserciones: 41 referencias y la
reanudación de Campaign.

`pruebas/imports-juego.mjs` comprueba archivos, exports y servicios del contexto
por el grafo real. `pruebas/juego-identificadores.mjs` comprueba todos los módulos
del juego/interfaz y la entrada con resolución de ámbitos y detección de TDZ
directa (incluye tres mutaciones de autoprueba y una lista explícita de globales del navegador). `pruebas/juego-arranque.mjs`
ejecuta además los inicializadores y sus llamadas indirectas en Node, con
DOM/editor/GPU emulados y un contexto que rechaza servicios leídos antes de
conectarse: tres series, 2D/3D, escenario propio, `?poc=1` y respaldo sin GPU.
Ambas entran en `npm test`. Esta emulación no verifica aspecto, gestos ni GPU;
las suites y capturas de navegador siguen siendo necesarias para la paridad.

## Auxiliares ES (paso 11c)

`juego/datos-proveedor.js`, `paleta.js` y `aplicar-programas.js` exportan
`CMGProveedor`, `CMGPaleta` y `CMGProgramas` por la entrada pública de `app`,
también para las herramientas/pruebas Node. `crearPulsos(motor)` recibe
trazador, flujo, lector Python y Acorn; los tres primeros siguen siendo scripts
clásicos de `educational-animation/revision/motor/`, sin modificarlos.

La composición configura los servicios del editor y registra los iconos antes
de instalarlo. Después instala revisión, layout y telemetría remota, y publica
`__juegoListo` al terminar todo. El puente clásico del juego y el archivo
vacío `seudo.js` están retirados; la demo tiene su entrada independiente en
`paquetes/editor/demo/demo.js`.

Los únicos globales propios de diagnóstico son `cmg`, `__banco` y
`__juegoListo`. `cmg.revisionJuego` expone abrir/cerrar/abierta/vista;
`cmg.pulsos`, `cmg.remota`, `cmg.estructura` y `cmg.factory3d` sustituyen los
antiguos ganchos separados. Las suites de revisión y Factory 3D usan esas
mismas instancias. Se conservan API del jugador y formatos de almacenamiento.
No se añaden dependencias. Los proveedores clásicos restantes son i18n,
presentación, terreno, vendors y motor de revisión.


## Servicios clásicos inyectados (fase 2, paso 13)

`arrancarJuego({ servicios })` recibe i18n, presentación, terreno, Three,
Acorn, Lezer y el motor de pulsos. Solo la entrada
`Prototypes/Rocket Launcher/js/servicios.js` lee esas bibliotecas de `window`.
`cargarRevision()` conserva la carga diferida y ordenada del resto del motor;
devuelve catálogo y visor al terminar, sin lecturas globales en la app.
Layout recibe los servicios por opciones; el formulario Factory y Campaign
reciben i18n. Las vistas reciben Three por `crearVista` y sus ayudantes por parámetros.
No cambia el orden de los scripts clásicos ni se modifican sus bibliotecas.

El HTML y los recursos que carga el juego ya no llevan versiones `?v=`.
Para evitar mezclas de caché en QA, usar el enlace raw.githack **fijado al hash
completo del commit**, por ejemplo
`https://raw.githack.com/RubenDarioMena/Code-Battles_lite/<hash-completo>/Prototypes/Rocket%20Launcher/index.html`.
El enlace de rama puede conservar caché. En las cáscaras de escritorio y Android
los recursos se renuevan con el empaquetado de cada publicación.

`pruebas/globales-juego.mjs` verifica la frontera de servicios y la ausencia de
versiones manuales; `juego-identificadores` y `juego-arranque` verifican nombres
y lecturas prematuras. Las regresiones de revisión del juego y de depuración
están registradas en `npm run test:navegador`, con el origen dedicado del ejecutor
(`CBL_QA_ORIGIN`); la primera solo crea su servidor cuando ese origen no se proporciona.
