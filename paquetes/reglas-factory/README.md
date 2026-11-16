# reglas-factory

Estado: fase 2, paso 8c (exportaciones con nombre; herramientas por el anfitrión). Reglamento Factory sin pantalla, en módulos ES ejecutables en
Node. Procede de `js/factory.js` y `js/factory-retos.js` de la aplicación común.
Conserva sus reglas, textos, materiales, retos, tiempos y stock por intento.
Solo importa la entrada pública de `nucleo`; puede importar también `protocolo`.
Véanse las [fronteras](../README.md). Contratos en `index.d.ts`.

## Entrada pública

`index.js` exporta por defecto `{ id: 'factory', version: 1, crearMundo, paso,
aplicarOrden, respuestas, instantanea, evaluar, api }`:

- `crearMundo({ reto, intento = 1 }, rng)` recibe un reto adaptado de `retos`
  y devuelve el mundo activo. El intento selecciona `stockPorIntento` con la
  misma fórmula anterior. Evalúa las metas una vez al terminar de crear el mundo.
  El RNG del núcleo no se consume: Factory nunca ha
  usado azar para el stock. Para reproducir un intento, debe ir en el escenario;
  la semilla del núcleo por sí sola no lo selecciona.
- `paso(mundo, dt)` usa la conexión existente guardada por mundo en un `WeakMap`.
  Mantiene primero el avance de las máquinas, después el robot y la evaluación.
- `aplicarOrden(mundo, orden)` delega `verbo` y `args` a `iniciarOrden`:
  `recoger(origen, material)`, `entregar(destino)`, `esperar(segundos)`.
  Esos son los verbos internos que ya envía el Worker; R1 es el único robot.
  La validación de argumentos corresponde al anfitrión.
  El anfitrión detecta los encargos simultáneos. La orden de sistema
  `programa-acabado` marca el programa como acabado y evalúa sin avanzar.
- `respuestas(mundo)` devuelve y vacía la cola de
  `{ unidad: 'R1', resultado, instantanea, ref? }` (conserva `orden.ref` si existe). Un `WeakMap` privado por mundo
  conserva el encargo en curso, el programa acabado y la cola; los ganchos de
  la conexión leen ese estado. La instantánea de respuesta se toma con
  `structuredClone` en `terminarOrden`, antes de evaluar el final del paso,
  conservando la forma histórica (incluidos campos `undefined`).
  Los registros `eventos`, `verbos`, `resultados` y `consolas` los escribe el
  anfitrión; las reglas no los leen ni escriben.
- `instantanea(mundo)` devuelve `{ t, maq: {}, auto: {}, vib: {}, factory }`.
  `factory` conserva las lecturas históricas, con copia profunda y sin campos
  `undefined`, para cumplir el protocolo de datos planos sin prestar existencias.
- `evaluar(mundo)` devuelve `mundo.final ?? null`. Al terminar guarda
  `{ fin, motivo, mensaje }`, desactiva el mundo, cancela la tarea y revela el stock.
- `api` contiene datos planos: `ordenes`, `lecturas`, `materiales` y `nombres`
  que relaciona los verbos internos con `pickUp`, `deliver`, `wait` y `count`.

Se integra con `crearPartida({ reglas, escenario: { reto, intento }, semilla })`
del núcleo; `restaurar` repite pasos y órdenes, reconstruyendo las clausuras de
las tareas en curso. El juego y las herramientas usan el anfitrión y el conductor.


## Escena para las vistas (fase 2)

`escena(mundo)` devuelve lo que dibujan las vistas: `t`, `revelado`, `entidades`, `robot` (con `cx`/`cy`) y `porId`. Es una copia en
datos planos (`copiaPlana` del núcleo) independiente del mundo: cambiarla no lo
toca. No es `instantanea(mundo)`, que es lo que ven los programas y lo que
protegen las huellas de referencia. El juego la entrega a las vistas una vez por
fotograma (`estado.escena`); las vistas ya no leen el mundo.

## Sucesos

El registro no enumerable se adjunta al crear el mundo. No cambia las colecciones
ni los registros de presentación existentes y se consulta con `partida.sucesos()`.
Cada suceso lleva el `paso` calculado por el núcleo y estos datos:

| Tipo | Unidad | Datos |
| --- | --- | --- |
| `recogida` | R1 | `origen`, `mat`, al recoger con éxito |
| `entrega` | R1 | `destino`, `mat`, al entregar con éxito |
| `produccion` | Máquina | `producido`, `ciclos`, al terminar un ciclo |
| `orden-terminada` | R1 | `resultado`, incluidos rechazos, vacíos y esperas |
| `fin` | Sin unidad | `fin`, `motivo` (cadena o null) |

Se anota junto a la operación y antes de llamar al hook correspondiente.
Los sucesos no se leen para decidir reglas. Se conserva el límite del núcleo.

## Compatibilidad temporal

La entrada exporta `crear`, `validar`, `instantaneaHistorica`, `MATERIALES` y
`retos`. La lectura histórica conserva referencias y campos `undefined` para
las huellas de fase 0. El puente publica esa función como `FACTORY.instantanea`
y conserva las demás claves anteriores salvo `conectar`.
`conectar(mundo, hooks)` queda dentro de `mundo.js`, usado por el reglamento
y las pruebas del paquete. Los consumidores externos usan órdenes y respuestas.

`validar` es autocontenida: declara su catálogo local de materiales porque
el anfitrión (`fuenteTrabajador`, antes `runtime.js`) interpola `validar.toString()` en el Worker. No debe referirse a
imports ni a funciones o constantes externas. Conserva los diagnósticos previos.

`retos` tiene las mismas claves de `FACTORY_RETOS`: `RETOS`, `propio`, `normalizar`
y `generar`. Mantiene las conversiones del modelo antiguo y los guardados.

La composición `paquetes/app/juego/estado.js` importa el reglamento y sus retos.
`interfaz/factory-form.js` recibe los catálogos al crear el formulario; las
vistas reciben la escena y sus servicios. No se publican `FACTORY` ni
`FACTORY_RETOS`: el puente se retiró en el paso 11c. El anfitrión recibe
`validar` por parámetro y sigue serializando la misma función autocontenida.

## Pruebas

```sh
node paquetes/reglas-factory/pruebas/reglas-factory.mjs
node pruebas/factory-reglas.cjs
node pruebas/partida-factory.mjs
node pruebas/partida-referencias.mjs
node pruebas/fronteras-factory.mjs
npm test
npm run tipos
node pruebas/fronteras.mjs
```

La suite propia se registra en `pruebas/todas.mjs`: validación de la función
serializada en un contexto vacío, claves del puente, datos planos, stock por
intento sin consumir RNG, determinismo, restauración por JSON durante un viaje
y al terminar, independencia de instantáneas, límite de tiempo y sucesos.
Compara estado enumerable y hooks con y sin registro; comprueba también el
orden de scripts requerido por los lectores al cargar.

Las suites de partidas protegen el oráculo y las 41 referencias de fase 0 sin
regrabarlas. Estas comprobaciones son de Node/VM; el contraste con Workers y
el arranque en navegador real se verifica aparte.

`fronteras-factory` compara estrictamente las 28 referencias con
`crearAnfitrion` y `jugarPartida`: huella, pasos, resultado completo y
repetición exacta, 28/28. La huella histórica (fase 0) se calculó sobre la
instantánea histórica, que conserva campos `undefined` (`acepta`/`entrada` de
las bodegas, `stock` de las máquinas); la instantánea pública los quita para
cumplir el protocolo, así que la prueba calcula la huella con
`instantaneaHistorica(mundo)`, que mide el mismo estado del mundo.

La aplicación cancela un intento mediante la orden de origen `sistema`
`fin-intento`: cancela la tarea del robot y revela el stock, también al detener
o fallar un programa. No evalúa metas ni cambia el resultado del reglamento.
