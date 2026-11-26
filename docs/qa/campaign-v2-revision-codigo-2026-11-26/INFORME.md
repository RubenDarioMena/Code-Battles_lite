# Revisión de código de Campaign-V2 · 26 de noviembre de 2026

**Estado:** parcial (se completa por tandas).

- **Rama:** `Campaign-V2` frente a `origin/trunk`, con el merge-base `6330c0ed5ff91e79f2d16f05c91bbefc281ee232` como punto fijo (16 commits, unos 11 300 líneas añadidas).
- **Prioridad:** lo de los últimos días: `paquetes/reglas-campaign-v2/` (fábrica, daño P8, `luzEstado` 9.2, depósito lleno 12.3, H6 circular), `paquetes/fabrica/motor.js`, `paquetes/app/juego/mover-fabrica.js`, `checkpoints-v2.js`, `paso.js`, las vistas `vista-2d/campaign.js` y `vista-3d/cv2/`, y `interfaz/campaign-ui.js`.
- **Método:** lectura del diff, una pasada de la skill `code-review` (esfuerzo high) y verificación propia de cada hallazgo con un script de Node. Los scripts están en el scratchpad de la sesión y no se suben. Cada hallazgo indica cómo se reprodujo.
- **Sin corregir código:** este informe solo describe los problemas.
- **Hallazgo conocido, no repetido:** los ensayos `?ensayo=b4/b5` arrancan con `BODEGA_ENSAYO = 16` y no se pueden ganar.

Gravedad: **Alta**, rompe la partida o pierde progreso en un camino normal. **Media**, resultado incorrecto visible o un camino menos frecuente que rompe. **Baja**, incoherencia menor, un caso raro o un error latente que el contenido actual no alcanza.

---

## Hallazgos verificados

### 1 · Media/Alta · Ganar una Batalla seguida de un hito de fábrica detiene el bucle de dibujo

- **Dónde:** `paquetes/reglas-campaign-v2/index.js:93` (`escenaMetros`), `index.js:86-88` (`escena`), `index.js:162`. El fallo salta en `paquetes/vista-3d/cv2/index.js:148` (y `:99` si cambia el relieve) y en `paquetes/vista-2d/war.js:42`.
- **Qué falla:** al ganar `b1` (o `b2`, `b3`, `b4`, `b5`, `b8`) en modo campaña, `paso()` deja `m.batalla = null` y `m.hito = 'hN'`. La página de Batalla sigue viva tras la tarjeta de transición, y `bucle.js:16` sigue dibujando en cada fotograma:
  - con la vista 3D, `escenaMetros(m)` toma la rama de fábrica. Esa escena no trae `enemigos`, `puertas` ni `marco.tam`, y `crearVistaCV2.dibujar` llama a `e.enemigos.map(...)`;
  - con el plano, la escena de fábrica no trae `def` y `war.js:42` lee `estado.escena.def.niebla`.

  La excepción salta antes de `requestAnimationFrame(bucle)` (`bucle.js:27`), así que el bucle de la página muere. La tarjeta queda sobre un fotograma congelado y dejan de correr `pintarHud`, `actualizarVivos`, el colocador y los avisos. «Ir a la fábrica» sigue funcionando porque es un botón del DOM que recarga.
- **Reproducción (Node):** `v1b-vista3d.mjs`. Usa Three r180 del repositorio con un renderer falso y la vista 2D real de War, monta B1 en campaña y aplica lo que hace `paso()` al ganar:
  - `batalla dibuja OK`;
  - `3D dibujar lanza: Cannot read properties of undefined (reading 'map')`;
  - `2D dibujar lanza: Cannot read properties of undefined (reading 'niebla')`.

  `v1-dibujo-tras-batalla.mjs` confirma con el arnés DOM (H0 → B1 ganada) que el mundo queda en `h1` con `batalla null` y la tarjeta abierta. La escena devuelta trae `enemigos undefined`, `puertas undefined` y `marco {"origen":[103,22]}`. Ninguna suite lo detecta: `campaign-v2-sesion-fabrica.mjs` no llama al bucle y la vista falsa del arnés tiene 0 px.
- **Propuesta:** mientras no haya Batalla montada en la página de Batallas, `escenaMetros` y `escena` deben devolver una escena con forma de Batalla vacía: la última escena de la Batalla, o `enemigos`, `misiles`, `lanzadores` y `puertas` vacíos más `marco.tam` y `def`. Otra opción es que el bucle deje de dibujar en cuanto se anuncia un hito de fábrica, hasta la recarga.

### 2 · Media · Tras subir la revisión del nivel, los checkpoints viejos siguen en la lista y llevan a un mundo de fábrica dentro de la página de Batalla

- **Dónde:** `paquetes/app/juego/fabrica-v2.js:31-40` y `checkpoints-v2.js:8-13` y `:53-61`.
- **Qué falla:** si `ultimo` es de otra revisión, `prepararFabricaV2` crea un H0 nuevo con `escribirCheckpointV2`. Esa función conserva el resto de `historial.hitos`, todos de la revisión anterior. La purga de `abrirCheckpoints` (`historial = { ultimo: null, hitos: {} }` y el aviso `cv2.revision`) solo corre si el **último** checkpoint es incompatible. Al terminar H0, el último ya es el `b1` nuevo y la purga no llega a correr. Consecuencias:
  - En la sesión de fábrica, `tieneCheckpoint('b3')` y `tieneCheckpoint('h1')` dan `true`. Elegirlos recarga, `prepararFabricaV2` ve el checkpoint incompatible y vuelve a sembrar H0 sin explicar nada.
  - En la página de Batalla (`b1` nuevo), la lista ofrece `h1`, `b2` y `b3` viejos. Elegir `b3` llama a `volverACheckpoint` y luego a `elegirReto`. `crearMundo` ve el checkpoint incompatible y devuelve `hito 'h0'`, `batalla null` y `aviso 'cv2.revision'`. Es decir, un mundo de fábrica dentro de la interfaz de Batalla, con el mismo fallo de dibujo del hallazgo 1.
  - Los programas guardados en esos checkpoints viejos también se mezclan con la partida nueva.
- **Reproducción (Node):** `v2-revision.mjs`, con un almacén en memoria que contiene `h0, b1, h1, b2, b3` en la revisión 1:
  - `tras recargar: fábrica h0 | último h0 | hitos h0@r2 b1@r1 h1@r1 b2@r1 b3@r1`;
  - `tieneCheckpoint(b3): true tieneCheckpoint(h1): true`;
  - `página de Batalla: aviso null | lista h0@r2 b1@r2 h1@r1 b2@r1 b3@r1`;
  - `elegir b3 → hito h0 batalla null aviso cv2.revision`.
- **Propuesta:** si el último checkpoint es incompatible, `prepararFabricaV2` debe vaciar `historial.hitos` antes de escribir el H0 nuevo, con el mismo aviso que `abrirCheckpoints`. Además, `lista`, `tieneCheckpoint` y `etapasDisponibles` deberían filtrar por `clave` y `revision`.

### 3 · Media · Las metas «hechos» de H5 cuentan los misiles que la planta fabricó sola durante la Batalla B5

- **Dónde:** `paquetes/fabrica/motor.js:625` (`empezarHito`, foto de `baseHito`), `:178` (`valorMeta`) y `paquetes/reglas-campaign-v2/fabrica/index.js:56` (la planta de Batalla con `sinHitos`).
- **Qué falla:** `baseHito` se fotografía cuando se cumple el hito anterior, en la sesión de fábrica. Después viene una Batalla en la que la planta sigue con `paso(dt, { sinHitos: true })`: las máquinas con zona de tarimas toman piezas sin que corra ningún programa. Al cumplir H4 (4 misiles), a ASM-01 le pueden quedar tarimas con ojivas, bases y cargas en su zona. Durante B5 sigue montando misiles, y al abrir H5 la meta `hechos missile 8` ya va adelantada. H3 y H6 no se ven afectados con el contenido actual (MIX-01 y FND-01 empiezan su hito sin material), pero el mecanismo es el mismo.
- **Reproducción (Node):** `v3-motor.mjs [3]`. Pone a ASM-01 en H4 con 7 juegos en su zona y avanza hasta cumplir H4:
  - `H4 cumplido: hito 5 misiles hechos 4 baseHito 4 metas H5 ["0/8"]`;
  - tras 60 s de `paso(..., { sinHitos: true })` (lo que hace la Batalla): `metas H5 ["3/8"]`.
- **Propuesta:** volver a fotografiar `baseHito` al abrir la sesión de fábrica del hito, por ejemplo en `prepararFabricaV2` o en la transición Batalla → fábrica de `paso()`. Otra opción es contar la producción de la sesión aparte de `producidos`. Si la intención es que lo fabricado en Batalla cuente, hay que decirlo en la pista del hito.

### 4 · Media · El colocador deja poner una tarima o una máquina sobre la base de un brazo que aún no ha aparecido

- **Dónde:** `paquetes/fabrica/motor.js:430-434` (`motivoColocar`).
- **Qué falla:** el bucle de colisiones salta las unidades con `!o.presente`, y los obreros no están presentes hasta su hito `desde` (ARM-02 desde H2, BOT-01 desde H6). En H1 se puede dejar PAL-3, MLD-01 o cualquier tarima justo encima de la base de ARM-02. Al llegar H2, el brazo aparece dentro de la pieza. Como su base no se mueve, la pieza le queda a 0 m (`puntoBrazo` la toca) y el siguiente movimiento de cualquiera de las dos da `ocupado`. Con BOT-01 (H6), una tarima puesta en (97.6, 45.8) antes de H6 deja al obrero encima.
- **Reproducción (Node):** `v3-motor.mjs [4]`:
  - `H1: ARM-02 presente? false | probar PAL-3 en (89, 48.6): ok | colocar: ok`;
  - `H2: ARM-02 presente true en { x: 89, y: 48.6 } | PAL-3 en 89 48.6 | distancia 0.00`.
- **Propuesta:** en `motivoColocar`, comprobar también los obreros anclados no presentes (por su `base`, o por `cx/cy` si no la tienen). Otra opción es reservar su huella desde el principio. Conviene un caso en `campaign-v2-sesion-fabrica.mjs`.

### 5 · Baja · Las vistas y la ficha no ven el «bloqueado» de ASM-01 con la bodega llena

- **Dónde:** `paquetes/interfaz/campaign-ui.js:40` y `:61`, `paquetes/vista-2d/campaign.js:118`, `paquetes/vista-3d/cv2/fabrica.js:506`. Todas llaman a `C.estadoMaquina(e)` sin el mundo, y el motor (`motor.js:156`) cae en su fórmula sin mundo.
- **Qué falla:** sin `m`, `estadoMaquina` no usa `salidaLlena` y solo mira `q.salida`. ASM-01 entrega directamente a DEP-01 (`entregaA`), así que su `salida` siempre está vacía. Con DEP-01 en `ARSENAL.cap` (60), la ensambladora no arranca y los programas leen `state: 'blocked'` y `outputFull: true`. Las vistas, en cambio, la pintan como `idle`: luz apagada, sin ⚠ en la etiqueta y sin ámbar en el piloto. El aviso 9.2 («la espera necesita a otro») falla justo en el caso que pretende cubrir. Con el resto de máquinas del nivel 1, las dos fórmulas coinciden.
- **Reproducción (Node):** `v3-motor.mjs [6]`: `bodega 60/60: vistas estadoMaquina(e) = idle luz {"luz":"off","aviso":false} | programas state = blocked outputFull true proceso false`.
- **Propuesta:** calcular el estado una vez en la escena (`escena(mundo)` del reglamento) con `estadoMaquina(q, m)` y que las vistas lo lean. Otra opción es pasar el mundo a `estadoMaquina` en las cuatro llamadas.

### 6 · Baja (latente) · `sinEnergia` no se borra si la máquina deja de esperar energía por otra causa

- **Dónde:** `paquetes/fabrica/motor.js:531-535`.
- **Qué falla:** `q.sinEnergia` solo vuelve a `false` cuando la máquina arranca. Si deja de esperar energía y no arranca por falta de material, `estadoMaquina` sigue devolviendo `no_power`: los programas leen `state === 'no_power'` y `luzEstado` enciende el aviso ámbar. En el nivel 1, ASM-01 (la única máquina con `umbral`) no puede perder material de su zona sin arrancar, así que hoy no se alcanza. Sí se alcanzaría con un catálogo cuya máquina con umbral reciba material en `entrada` (un obrero puede retirarlo, `motor.js:276`) o tenga varias recetas (cambio de receta).
- **Reproducción (Node):** `v3-motor.mjs [7]`, vaciando la zona a mano:
  - `con 7 kW ocupados: ASM state no_power`;
  - `2 s después, 0 kW en uso y sin material: ASM state no_power energía uso 0 luz {"luz":"amber","aviso":true}`.
- **Propuesta:** en las máquinas con `umbral`, poner `q.sinEnergia = false` en las ramas de bloqueo y de falta de material, y cuando `marcha` sea false.

---

## Dudas no verificadas

(Se completa al final.)
