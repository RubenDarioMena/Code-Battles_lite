# app

Estado: fase 2, pasos 2 y 7a (partida sin pantalla, vista nula y respuestas Factory).

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
  maxPasos = 10000, alPaso? })` crea la partida con `crearPartida` del núcleo y
  juega en lockstep: primero `anfitrion.ceder(instantánea inicial)` (arranca los
  programas cargados) y después, tras cada `paso()`,
  `ceder(instantánea, reglas.respuestas?.(mundo))`. Aplica las órdenes del turno
  con `partida.aplicarOrdenes()` y entrega las respuestas inmediatas mediante
  `anfitrion.responder`, repitiendo hasta vaciar la cola, un error o el final.
  Así `manos_llenas`, `manos_vacias` y `programa-acabado` no añaden un paso.
  Las órdenes del paso actual se aplican antes de evaluar también sin anfitrión,
  así que para repetir una partida de `jugarPartida` se llama `aplicarOrdenes()`
  tras `restaurar` (una orden puede terminarla sin avanzar: Factory,
  `programa-acabado`). `alPaso(paso, instantanea, partida)` recibe la partida.
  Al terminar entrega las respuestas restantes a `detener(respuestas)` para
  registrar el último encargo sin ejecutar la continuación del programa. Para
  cuando `reglas.evaluar` devuelve algo, cuando el anfitrión informa un error de
  programa o al llegar a `maxPasos`. La vista recibe la instantánea inicial y la
  de cada paso con fracción 1, y cada suceso nuevo una vez (por `paso`
  creciente). Devuelve `{ partida, pasos, error, limite, evaluacion,
  instantanea }`. Sin anfitrión, repite una partida a partir de sus `ordenes`.

Límite conocido: un suceso anotado al aplicar una orden lleva el paso anterior y
la vista no lo recibiría; ningún reglamento lo hace hoy.

## Pruebas

- `node paquetes/app/pruebas/app.mjs`: vista nula y bucle con un reglamento
  mínimo y un anfitrión falso (orden de aplicación, error, límite).
- `node pruebas/fronteras-fase2.mjs` (en `pruebas/` porque usa el instrumentador
  y la imitación de Worker de `herramientas/partida/`): pruebas de frontera 1–3
  del plan. Las 10 partidas War de referencia juegan con `reglas-war`,
  `crearAnfitrion` y la vista nula, y dan **la misma huella, pasos y final** que
  `pruebas/referencias/partidas.json`. Después, la partida War 2/7 se repite
  exacta desde escenario, semilla y órdenes (`restaurar` y `jugarPartida` sin
  anfitrión), y una orden de origen `jugador` hace disparar a `LAU-01` en el
  paso indicado y se repite igual.

También `node pruebas/fronteras-factory.mjs`: 28 referencias Factory, por las
entradas públicas: huella, pasos, resultado completo y repetición exacta 28/28
(la huella se mide sobre la instantánea del legado, como en la fase 0; véase el
README de `reglas-factory`).

Estas suites están registradas en `pruebas/todas.mjs`. La cuarta prueba de frontera
(editor montado solo) es de navegador.

## Pendiente

El juego todavía no usa este paquete: `juego.js` y `layout.js` deben repartirse
entre `interfaz` y `app`, y las vistas pasar a instantáneas y sucesos.
