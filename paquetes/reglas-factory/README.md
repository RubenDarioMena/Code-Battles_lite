# reglas-factory

Estado: fase 2, paso 7a (respuestas de encargos). Reglamento Factory sin pantalla, en módulos ES ejecutables en
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
  Como en el legado, la validación de argumentos corresponde al anfitrión.
  El anfitrión detecta los encargos simultáneos. La orden de sistema
  `programa-acabado` marca el programa como acabado y evalúa sin avanzar.
- `respuestas(mundo)` devuelve y vacía la cola de
  `{ unidad: 'R1', resultado, instantanea }`. Un `WeakMap` privado por mundo
  conserva el encargo en curso, el programa acabado y la cola; los ganchos de
  la conexión leen ese estado. La instantánea de respuesta se toma con
  `structuredClone` en `terminarOrden`, antes de evaluar el final del paso,
  conservando la forma del legado (incluidos campos `undefined`).
  Los registros `eventos`, `verbos`, `resultados` y `consolas` los escribe el
  anfitrión; las reglas no los leen ni escriben.
- `instantanea(mundo)` devuelve `{ t, maq: {}, auto: {}, vib: {}, factory }`.
  `factory` conserva las lecturas del legado, con copia profunda y sin campos
  `undefined`, para cumplir el protocolo de datos planos sin prestar existencias.
- `evaluar(mundo)` devuelve `mundo.final ?? null`. Al terminar guarda
  `{ fin, motivo, mensaje }`, desactiva el mundo, cancela la tarea y revela el stock.
- `api` contiene datos planos: `ordenes`, `lecturas`, `materiales` y `nombres`
  que relaciona los verbos internos con `pickUp`, `deliver`, `wait` y `count`.

Se integra con `crearPartida({ reglas, escenario: { reto, intento }, semilla })`
del núcleo; `restaurar` repite pasos y órdenes, reconstruyendo las clausuras de
las tareas en curso. El juego y la herramienta antigua conservan su detección
mediante `legado.conectar`, sin cambios.


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

`legado` tiene exactamente las claves anteriores de `FACTORY`: `crear`,
`conectar`, `validar`, `instantanea`, `MATERIALES`. `crear(def, intento)` conserva
el arranque inactivo y `instantanea` conserva sus referencias y campos originales.
`conectar` recibe `terminarOrden`, `terminar`, `programaAcabado` y
`llamadaPendiente`; devuelve `paso`, `iniciarOrden`, `sensor`, `metaCumplida`,
`faltantes` y `evaluar`.

`validar` es autocontenida: declara su catálogo local de materiales porque
el anfitrión (`fuenteTrabajador`, antes `runtime.js`) interpola `validar.toString()` en el Worker. No debe referirse a
imports ni a funciones o constantes externas. Conserva los diagnósticos previos.

`retos` tiene las mismas claves de `FACTORY_RETOS`: `RETOS`, `propio`, `normalizar`
y `generar`. Mantiene las conversiones del modelo antiguo y los guardados.

`compat-paquetes.js?v=2` publica copias planas de ambos objetos. Los dos lectores
al cargar son el propio puente (interpolación de `validar` con `paquetes/anfitrion`, fase 2) y `juego.js` (retos,
normalización y arranque); ambos ya están después del puente. `factory-form.js`
lee los catálogos dentro de `crear`, llamado después; `paquetes/vista-2d` (antes `factory-vista.js`),
`paquetes/vista-3d` no lee estos dos catálogos al cargar. No se necesita
reordenar scripts. Los encargos ya se delegaban a `logistica.iniciarOrden`;
no se trasladan órdenes desde `juego.js`. La fase 2 retira el puente.

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
instantánea del legado, que conserva campos `undefined` (`acepta`/`entrada` de
las bodegas, `stock` de las máquinas); la instantánea pública los quita para
cumplir el protocolo, así que la prueba calcula la huella con
`legado.instantanea(mundo)`, que mide el mismo estado del mundo.
