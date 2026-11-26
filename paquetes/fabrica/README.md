# @cbl/fabrica · motor de fábrica compartido

Lo usan Campaign (trunk, `paquetes/reglas-campaign`) y Campaign-V2 (`paquetes/reglas-campaign-v2/fabrica`). Cada campaña aporta su **catálogo** (piezas, recetas, máquinas, robots, energía, costes) y su **nivel** (unidades, hitos, metas). El motor no conoce ninguna campaña. Funciona con paso fijo, sin DOM ni reloj real, y guarda el estado en datos planos que van tal cual a los checkpoints.

## API

- `crearMotor(catalogo)` devuelve el motor:
  - `crear(def, guardado?)`, `serializar(m)`, `instantanea(m)`;
  - `metas(m)`, `cuantos(m, id, pieza)`, `estadoMaquina(q)`, `masaEnPlanta(m)`;
  - `conectar(m, hooks)`, que es la conexión que avanza el mundo.
- `conectar(m, { terminarOrden })` ofrece:
  - `paso(dt, { sinHitos })`;
  - `iniciarOrden(id, { id: ref, verbo, args })` para los encargos;
  - `aplicarModo(id, verbo, args)` para los modos;
  - `colocar(id, x, y)`, `empezarHito()` y `cancelarTareas()`.
- `crearReglamentoFabrica(motor, { id, catalogo, alCrear })` envuelve el motor en el contrato de `crearPartida`: `crearMundo`, `paso`, `aplicarOrden`, `respuestas`, `instantanea`, `escena` y `evaluar`.
  - Los resultados de los encargos y de `colocar` salen en `respuestas(mundo)`.
- `validar` y `modoEnSnap` comprueban un nivel contra su catálogo.

## Órdenes

| Clase | Verbos | Comportamiento |
|---|---|---|
| Encargos | `pickUp`, `deliver`, `goTo` | Tardan y el programa los espera. Su resultado es un texto (`ok`, `fuera_de_alcance`, `viaje_vacio`…). |
| Modos | `start`, `stop`, `setRecipe`, `light`, `request` | Se aplican al instante. |
| Lecturas | `count` y las propiedades | No avanzan el reloj. |
| Jugador | `colocar` | Solo con `origen: 'jugador'`; si la da un programa, el reglamento la rechaza. Devuelve `ok`, `no_movible`, `fuera_de_losa` u `ocupado`. |

## Mecánicas opcionales

Solo se activan si las declara el catálogo o la unidad.

- **`alcance`** en un obrero: es un brazo anclado y solo opera lo que queda a esa distancia de su base.
- **`zona: n`** en una máquina: acepta n tarimas con piezas y toma de ellas lo que pide la receta. Así la máquina lenta absorbe de su propia tarima.
- **`salidaTarima`**: la máquina deja lo que produce sobre una tarima vacía en su salida.
- **`entregaA: 'DEP-01'`**: la máquina entrega lo que produce directamente a esa unidad (la bodega).
- **`umbral`**: la máquina solo arranca si sus kW caben enteros en la energía libre de la base. Si no caben, no se ralentiza: se para.
- **`colocar(id, x, y)`** mueve tarimas, máquinas sin puesto y brazos dentro de la losa. Los radios del catálogo (`RADIO`) impiden solapes. El punto de trabajo y la base del brazo se mueven con la unidad.
- **`sub`** en una receta (P7): subproductos que salen con la pieza por la misma salida, como los recortes de chapa. La máquina solo arranca si caben todas las piezas del ciclo, así que se bloquea si nadie los retira. Cuentan en `producidos`.
- **`masa`** en las piezas (P7, `masa.js`): una receta lleva masa en todas sus piezas o en ninguna, y nunca crea materia (el motor no se crea si lo hace). Lo que entra y no sale es pérdida registrada (`m.perdida`, kg, viaja en el checkpoint). `masaEnPlanta(m)` suma lo que hay en tarimas, máquinas, procesos, obreros y banda.
- **`ritmo`** en una máquina (P7): multiplica su velocidad de trabajo. La sierra y el láser comparten la receta y difieren en tiempo y kW.

## Pruebas

- `node pruebas/campaign-v2-fabrica.mjs`: la misión 1 de V2, de H0 a H5, con programas guionizados, el colocador y las mecánicas anteriores.
- `node pruebas/campaign-v2-circular.mjs`: la producción circular (P7) y sus invariantes: conservación de masa en cada paso, acumulación que bloquea, sin duplicados, capacidades, procesos compatibles, sierra frente a láser, repetición exacta y catálogo honesto.
- `node pruebas/campaign-reglas.cjs`, `node pruebas/partida-campaign.mjs` y `node pruebas/fronteras-campaign.mjs`: la paridad del trunk sobre el mismo motor.
