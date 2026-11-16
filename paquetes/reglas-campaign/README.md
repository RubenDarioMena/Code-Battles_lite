# reglas-campaign

Estado: fase 2, paso 8c. Campaign continua sin pantalla, en módulos ES ejecutables en
Node. Conserva la lógica de `js/campaign.js`, el nivel de `js/campaign-nivel.js`,
la API de los programas y el formato de los checkpoints. Solo importa la entrada
pública de `nucleo`; puede importar `protocolo`. [Fronteras](../README.md).
Los contratos de datos y operaciones están en `index.d.ts`.

## Corte de los archivos

- `estado.js`: catálogos, creación e indexación, serialización de checkpoints,
  lecturas y metas. No avanza el reloj.
- `validacion.js`: `validar` y `modoEnSnap`, sin imports. Cada función es
  autocontenida porque el anfitrión (`fuenteTrabajador`, antes `runtime.js`) copia su `toString()` al texto del Worker.
  El modo modifica únicamente la instantánea del programa, como antes.
- `mundo.js`: conexión, encargos, modos sobre el mundo, paso fijo y avance de
  hitos. Usa las operaciones de estado y anota sucesos.
- `nivel.js`: mapa, instalación, hitos y programas iniciales, sin cambios.
- `index.js`: entrada pública y adaptador de reglamento, como War y Factory.

La separación sigue la costura entre estado/lecturas, funciones del Worker y
simulación. Ningún archivo del paquete supera 500 líneas.


## Escena para las vistas (fase 2)

`escena(mundo)` devuelve lo que dibujan las vistas: `t`, `activo`, `hito`, `maquinas`, `robots`, `tarimas`, `misiles`,
  `explosiones`, `bahia` y `porId`. Es una copia en
datos planos (`copiaPlana` del núcleo) independiente del mundo: cambiarla no lo
toca. No es `instantanea(mundo)`, que es lo que ven los programas y lo que
protegen las huellas de referencia. El juego la entrega a las vistas una vez por
fotograma (`estado.escena`); las vistas ya no leen el mundo.

## Entrada pública

`index.js` exporta por defecto `{ id: 'campaign', version: 1, crearMundo, paso,
aplicarOrden, respuestas, instantanea, evaluar, api }`:

- `crearMundo({ reto, guardado? }, rng)` crea o carga un mundo y lo activa.
  `reto` es el nivel; `guardado` es opcional y usa el formato histórico.
  No consume el RNG: estas reglas no usan azar.
- `paso(mundo, dt)` conserva una conexión por mundo en un `WeakMap`. Mantiene
  el orden original: robots, energía, máquinas, banda, bahía, arsenal, salva y metas.
- `aplicarOrden(mundo, orden)` delega `pickUp`, `deliver` y `goTo` a
  `iniciarOrden(unidad, { id, verbo, args })`; los demás verbos van a
  `aplicarModo`. El id del encargo es `orden.ref` si existe y, en otro caso,
  `origen:paso:unidad`. La orden de sistema `fin-tramo` cancela tareas y suelta
  las luces sin tocar `activo`, `eventos`, `uso` ni `consolas`.
  La validación y la autorización por programa siguen a cargo del anfitrión.
- `respuestas(mundo)` devuelve y vacía una cola por mundo en `WeakMap`:
  `{ unidad, ref, resultado, instantanea }` al terminar un encargo, con la foto
  tomada en ese momento, y `{ unidad, ref, resultado, modo: true }` por modo.
  El anfitrión ignora respuestas sin referencia reconocida.
- `quieto(mundo)` se exporta fuera del contrato para decidir el final de un tramo.
- `instantanea(mundo)` devuelve `{ t, maq: {}, auto: {}, vib: {}, campaign }`,
  una copia profunda de las lecturas existentes sin referencias a catálogos.
- `evaluar(mundo)` devuelve `null` hasta completar el nivel y después
  `{ fin: 'victoria', hito, completado: true }`. No pone `mundo.fin` ni lo
  desactiva: la planta continúa, incluida la salva de prueba y el suministro.
- `api` contiene datos planos de encargos, modos, lecturas, espera, piezas,
  recetas, máquinas, robots y luces. `wait` y las lecturas los gestiona el
  anfitrión; no son órdenes que muten el mundo.

La conexión del adaptador no ejecuta programas ni decide sus cortes. La herramienta
conserva una partida entre tramos H0–H5 mediante `jugarPartida`, con `detener`,
`quieto` y la orden de sistema `fin-tramo`.

## Guardado y restauración

Se exportan `serializar(mundo)` y `restaurar(guardado, reto = nivel.NIVEL)`.
Restaurar delega en la misma `crear(reto, guardado)` histórica y devuelve el
mundo inactivo, listo para conectar programas. Se mantienen versión 1, clave
del nivel y revisión: un guardado incompatible arranca el estado inicial.

El checkpoint mantiene exactamente estas claves y su orden:

```text
version, nivel, rev, t, hito, completado, hitosT, presupuesto, gastado,
ingresado, unidades, tarimas, sigTarima, sigMisil, tSuministro, producidos, pedidos
```

Las unidades y tarimas conservan sus datos originales. Las tareas de robots se
guardan como `null`, porque al cargar no existen los programas que las esperan;
serializar no cancela las tareas del mundo original. Los procesos y cambios de
receta sí se conservan. La carga reindexa el mundo y reinicia salva, misiles y
explosiones transitorios, igual que antes. No se añaden sucesos, metadatos del
adaptador ni campos al guardado. Las claves de almacenamiento y la envoltura
de historial de `juego.js` no cambian.

El guardado del núcleo (`crearPartida`/`restaurar` de `nucleo`) es otro contrato:
guarda escenario, semilla y órdenes para repetir pasos exactamente, incluso con
un encargo en curso. No sustituye al checkpoint histórico de Campaign.

## Sucesos

El registro del núcleo es no enumerable, está fuera del checkpoint y de las
instantáneas y no se lee para decidir reglas. Se anota junto a cada operación,
antes de sus hooks, conservando orden y resultados. `paso` se calcula desde `t`.

| Tipo | Unidad | Datos |
| --- | --- | --- |
| `encargo-terminado` | Robot | `encargo`, `resultado`, también en rechazo inmediato |
| `recogida`, `entrega` | Robot | `lugar`, `carga` (pieza u objeto de tarima/máquina) |
| `produccion` | Máquina | `pieza`, `hechos` |
| `entrega-pedido` | Bahía | `pieza`, `n`, `tarima` |
| `misil-banda` | Banda | `desde` (ensambladora o robot) |
| `misil-arsenal` | Arsenal | `desde` (banda o robot), `misiles` |
| `suministro` | Torreta | `desde` (arsenal), `misiles` |
| `disparo` | Torreta | `misil`, destino `x`, `y` |
| `explosion` | Sin unidad | `misil`, `x`, `y`, `z` |
| `hito` | Sin unidad | `hecho`, `siguiente` (o null), `completado` |

## Puente temporal

Los catálogos, `VERSION`, `crear`, `serializar`, `indexar`, `validar`,
`modoEnSnap`, `metas`, `cuantos`, `enLotes`, `estadoMaquina`, `totalEntrada`,
`esMaquina`, `esRobot` y `instantaneaHistorica` son exportaciones con nombre.
La lectura histórica conserva los campos originales para las huellas de fase 0.
`nivel` conserva `RETOS`, `NIVEL` y `MAPA`. La composición importa el reglamento
y esos datos por la entrada pública en `paquetes/app/juego/estado.js`.
`interfaz/campaign-ui.js` recibe los catálogos y la instantánea histórica al
llamar a `crear`; las vistas reciben sus datos por parámetros. No se publican
`CAMPAIGN` ni `CAMPAIGN_NIVEL`: el puente se retiró en el paso 11c. El anfitrión
recibe las funciones autocontenidas y las serializa como antes.

## Pruebas

```sh
node paquetes/reglas-campaign/pruebas/reglas-campaign.mjs
node pruebas/campaign-reglas.cjs
node pruebas/partida-campaign.mjs
node pruebas/fronteras-campaign.mjs
node pruebas/partida-referencias.mjs
npm test
npm run tipos
node pruebas/fronteras.mjs
```

La suite propia, registrada en `pruebas/todas.mjs`, verifica ambas funciones por
`toString()` en contextos vacíos, arranque ES sin puente, datos planos, determinismo,
repetición con encargo en curso, checkpoints exactos, guardados incompatibles,
RNG no consumido y sucesos de logística, producción, hitos y salva. Compara
estado enumerable y orden de hooks con y sin registro. Las 41 referencias de
fase 0 protegen la paridad sin regrabación. Estas pruebas de Node/VM no sustituyen
el arranque ni el contraste de Workers en navegador real.
