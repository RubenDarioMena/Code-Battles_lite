# reglas-campaign-v2

La app resuelve los retos y entrega a `crearReglamento(war, contenido, retos)` el reglamento de War con `fijarSuministro` y las definiciones del nivel.

## Hitos de fábrica y Batallas

El nivel intercala hitos de fábrica (`h0`…`h5`, `esFabrica(clave)`) con Batallas (`b1`…`b5`, referencias a War). Tras H5 siguen tres Batallas propias seguidas (`b6`–`b8`), que estrenan el vehículo, la rueda y el minador. La fábrica es el motor compartido `paquetes/fabrica` con el catálogo de `fabrica/catalogo.js` y la planta de `niveles/nivel-1/fabrica.js`. Cada hito tiene su archivo (`hN.js`, con metas y entregas al empezar).

- **En un hito de fábrica** la página juega la planta como una sesión de la serie Campaign (`moduloFabrica(contenido)`). El jugador escribe los programas de los robots, coloca tarimas, máquinas y brazos, y cumple las metas del hito. El reglamento de V2 no avanza nada mientras `m.hito` es de fábrica.
  - `luzEstado(estado)` da la luz de cada estado de máquina con el lenguaje del consolidado (9.2): verde trabaja, ámbar espera y el rojo queda para el daño. `aviso` marca la espera que necesita a otro (salida llena, sin energía): enciende el piloto. Las dos vistas y la ficha la usan si las reglas la traen; sin ella (Campaign del trunk), siguen con el rojo.
- **En una Batalla** la misma planta sigue trabajando dentro del mundo compuesto (`m.fabrica`): sin programas, sin cambiar de hito (`paso(dt, { sinHitos: true })`), terminando lo que tenía en cola. Su arsenal es `mundo.bodega`: los misiles que fabrica abastecen las torretas.
- **`reglas.cerrarFabrica(m, plantaJugada?)`** cierra un hito de fábrica. Sustituye la planta por la jugada y pasa al hito siguiente. Si el siguiente es una Batalla, la monta. Tras el último hito, el nivel termina en victoria (`m.final`). Devuelve false en paridad, en una Batalla o si el hito no es de fábrica.
- Al ganar una Batalla seguida de un hito de fábrica, `m.hito` pasa a ese hito sin Batalla montada. El checkpoint guarda la planta y la página abre la fábrica.

`escenario(-1)` en la composición es el primer hito de fábrica, es decir, la partida nueva. Las Batallas empiezan con su propio tiempo local. Los sucesos del mundo compuesto llevan el paso de la partida.

En paridad el reglamento delega el paso y las lecturas a War. Un ensayo juega un único hito. Para fijar las condiciones de un ensayo se pueden pasar `fabrica`, `bodega` (cantidad), `torretas` (casillas por ID), `programas`, `vinculos`, `fuentes`, `semillaFabrica` y `semillaIntento`.

`reglas.serializar(mundo)` copia los datos de la frontera. `reglas.restaurar(checkpoint, semillaIntento, actuales?)` crea un mundo con una batalla nueva. La app puede entregar el mismo checkpoint en el escenario de `crearPartida`. Una revisión incompatible devuelve H0, conserva los programas y expone la clave del aviso en `mundo.aviso`. El guardado persistente pertenece a la app: `paquetes/app/juego/checkpoints-v2.js` (historial por hito) y `fabrica-v2.js` (la sesión de fábrica, que siembra su guardado en vivo desde el checkpoint).

`validarNivel(carpeta, contenido, tipos, catalogo)` devuelve errores con archivo y campo. El catálogo inyectado contiene los diccionarios ES/EN del nivel.

La ficha de clic declara los registros y los nombres de editor. En campaña y ensayo, `repartirClic` produce una entrada por torreta. El reglamento emite los clics de programa mediante `eventos(mundo)`, que vacía la lista. Para el disparo manual, la composición inyecta `pasoConIntentoPuntual` y la velocidad de misil de War. El intento usa la cadencia de la torreta y conserva el objetivo de su programa.

Las pruebas `pruebas/campaign-v2-{clic,gestos,seudo}.mjs` cubren el reparto, la concurrencia, la predicción, los controles y las fichas de editor.

Desde la raíz, las pruebas `pruebas/campaign-v2-{contenido,paridad,puente,secuencia,checkpoint}.mjs` cubren el contenido, las doce referencias de War y la continuidad en Node. `campaign-v2-fabrica.mjs` juega la misión 1 de H0 a H5 sobre el motor, y `campaign-v2-sesion-fabrica.mjs` la página entre fábrica y Batalla con sus recargas.

En campaña y ensayo, una batalla puede declarar `unidades` y `hostiles` con tipo de ficha y puesto inicial local. `paso.js` monta sus reglas en metros, traduce las lecturas de War con `leerEnemigos` y entrega los impactos pendientes con `danoEnArea` antes del siguiente paso de War. Cada mecánica aporta `ficha.js` y `reglas.js`, una importación y una entrada ordenada en `pasos`. Una capacidad puede inyectar la misma función de orden en el intérprete y en el mundo.

`ensayos/salida.js` fija la dotación, las oleadas y los programas de partida. En `pruebas/campaign-v2-mecanicas.mjs` se ejecuta el ensayo hasta la victoria y se observa el ciclo de vida de VEH-01 desde otra unidad.

## Daño por componentes (P8)

`danio` (de `danio/index.js`) es el experimento aislado del consolidado 13.B: `crearRestos(vehiculo)`, `golpear(restos, { perfil, punto, energia })`, `balance`, `fragmentos`, `estado` y `recuperar`. Las masas van en gramos enteros, así que el balance cuadra exacto. No depende de la vista ni de la malla, y todavía no se usa en las Batallas. El diseño está en `docs/campaign-v2/P8-DANIO.md` y la prueba en `pruebas/campaign-v2-danio.mjs`.
