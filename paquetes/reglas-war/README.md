# reglas-war

Estado: fase 2, paso 8c (exportaciones con nombre; ganchos internos).

Reglamento War sin pantalla, en módulos ES y ejecutable en Node. Conserva las
operaciones, textos, catálogo y retos de los antiguos `js/war.js` y
`js/war-retos.js`. Solo importa entradas públicas de `nucleo` y `protocolo`;
véanse las [fronteras de paquetes](../README.md). Contratos en `index.d.ts`.

## Entrada pública

`index.js` exporta por defecto el reglamento con `id: 'war'` y `version: 1`:

- `crearMundo({ reto }, rng)` recibe un reto **ya normalizado** y un RNG creado
  por el núcleo. Devuelve el mundo activo con `semilla: null`; la semilla de la
  partida pertenece al núcleo. Adjunta el registro de sucesos no enumerable.
- `paso(mundo, dt)` e `instantanea(mundo)` reutilizan una conexión por mundo
  guardada en un `WeakMap`. No dibujan ni escriben `mundo.eventos`; anotan
  los sucesos de presentación en el registro no enumerable del núcleo.
  La instantánea conserva `{ t, maq, auto, vib }`, con las mismas lecturas y
  predicciones de los programas del juego.
- `aplicarOrden(mundo, orden)` lee `unidad`, `verbo` y `args[0]` como lugar.
  Conserva ese objeto por referencia y no valida en este camino. `stopFire` o
  un lugar nulo dejan el lanzador parado; `burstFire` selecciona ráfaga y
  `regularShoot` selecciona disparo regular (el mismo nombre que la API del jugador). Las órdenes se validan en el núcleo.
- `evaluar(mundo)` devuelve `mundo.final ?? null`. Al terminar se guardan
  `{ fin, motivo, mensaje }`, se actualiza `mundo.fin` y se desactiva el mundo.
- `api` contiene datos planos: `ordenes` (`regularShoot`, `burstFire`, `stopFire`),
  `tipos` y `sensores`, copiados de los catálogos existentes. Desde la fase 2, también
  `conf` (`fallaRafaga`, `cadencia`, `cadenciaRafaga`), que el anfitrión entrega al Worker.

La partida se crea con `crearPartida({ reglas, escenario: { reto }, semilla })`
de `nucleo`. Su guardado conserva escenario, semilla y órdenes; `restaurar`
repite los pasos para recuperar mundo, sucesos y resultado.


## Escena para las vistas (fase 2)

`escena(mundo)` devuelve lo que dibujan las vistas: `t`, `def.niebla`, `lanzadores`, `sensores`, `deposito`, `reparadores`,
  `maquinas`, `enemigos`, `misiles`, `explosiones` y `porId` (sobre `maquinas`). Es una copia en
datos planos (`copiaPlana` del núcleo) independiente del mundo: cambiarla no lo
toca. No es `instantanea(mundo)`, que es lo que ven los programas y lo que
protegen las huellas de referencia. El juego la entrega a las vistas una vez por
fotograma (`estado.escena`); las vistas ya no leen el mundo.

## Sucesos

Se anotan junto a las operaciones originales, sin cambiar el orden de sus
mutaciones ni de sus hooks. Cada suceso lleva `paso`, `tipo`, una `unidad`
cuando procede y los siguientes `datos`. Solo usan números finitos, cadenas
y `null`; `sin-misiles` no necesita datos.

| Tipo | Unidad | Datos |
| --- | --- | --- |
| `aparece` | Enemigo | `tipo`, `x`, `y` al crearse, antes de avanzar |
| `brecha` | Enemigo | `tipo`, `x`, `y` al cruzar la base |
| `disparo` | Lanzador | `misil` (número), destino `x`, `y`, `z`, `objetivo` (id o null) |
| `sin-misiles` | Lanzador | Sin datos; una vez al entrar en espera de suministro |
| `atasco` | Lanzador | `falla`, `tReparar` |
| `explosion` | Lanzador | `x`, `y`, `z`, `golpe` (0 o 1), `misil` (número o null en atasco) |
| `golpe` | Enemigo | `hp` después del impacto |
| `derribo` | Enemigo | `tipo`, `por` (lanzador) |
| `reparado` | Lanzador | `por` (reparador) |
| `fin` | Sin unidad | `fin`, `motivo` (cadena o null) |
| `registro` | Máquina del registro | `maquina`, `linea` (número o null), `que`, `resultado`, `clase` |
| `aviso` | Sin unidad | `texto` |
| `globo` | Máquina del globo | `nivel`, `texto` |

Un atasco genera también su explosión local. El registro queda fuera de
`Object.keys`, `JSON.stringify` y las copias enumerables del mundo; se consulta
con `partida.sucesos()`. Conserva el límite habitual del núcleo (2000 sucesos).
Los sucesos `registro`, `aviso` y `globo` se anotan antes de llamar al hook
correspondiente, con sus mismos argumentos y en el mismo orden. Los hooks
son internos al paquete, en `mundo.js`. No entran en instantáneas ni huellas.

## Exportaciones con nombre y puente

La entrada exporta `crear`, `aplicarOrden`, `TIPOS`, `SENSOR`, `LAU`, `MISIL`,
`REP`, `COSTE` y `cadencia`. `crear(def, semilla, rng = crearRng(semilla))`
conserva el arranque inactivo y la siembra anterior. `retos` contiene `RETOS`,
`PROPIO_BASE`, `POS_LANZADORES` y `normalizar`.

`conectar(mundo, hooks)` vive en `mundo.js`: lo usa el reglamento y sus pruebas
internas, y no se exporta desde `index.js`. Los consumidores avanzan el mundo
por `crearPartida` y órdenes. La app importa la entrada pública en
`paquetes/app/juego/estado.js`, sin `WAR` ni `WAR_RETOS` globales. El puente
se retiró en el paso 11c.

## Pruebas

```sh
node paquetes/reglas-war/pruebas/reglas-war.mjs
node pruebas/partida-war.mjs
node pruebas/partida-referencias.mjs
node pruebas/fronteras.mjs
npm run tipos
npm test
```

La suite propia está registrada en `pruebas/todas.mjs`: brecha sin órdenes,
disparos periódicos sobre objetivos automáticos, validación de todas las
instantáneas y sucesos recogidos, determinismo, restauración por JSON al terminar
y durante la partida con una orden pendiente, referencia del lugar, RNG,
atasco, reparación y agotamiento de misiles. Compara también evolución y orden
de llamadas a hooks con y sin registro. Se ejecuta sin entorno de navegador.
Las pruebas importan `../../nucleo/index.js` y `../../protocolo/index.js`: desde
`pruebas/` la ruta exacta a la entrada pública sube un nivel más.

Las suites de partidas y las 41 referencias de fase 0 protegen la paridad;
estas verificaciones son de Node/VM. No sustituyen el contraste con Workers
reales en navegador.
