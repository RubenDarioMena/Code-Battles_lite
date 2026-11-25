# reglas-campaign-v2

La app resuelve los retos y entrega a `crearReglamento(war, contenido, retos)` el reglamento de War con `fijarSuministro` y las definiciones del nivel. H0 usa el ciclo de producción y el formato de guardado propios de `fabrica/produccion.js`.

El núcleo recibe un escenario con `hito`, `modo` y `reto`. En campaña cada paso avanza la fábrica, asigna el suministro disponible y avanza la batalla. El arsenal de la fábrica y `mundo.bodega` son el mismo depósito. La meta de H0 y las victorias de B1 a B4 abren el siguiente hito. B5 completa el nivel. Las batallas empiezan con su propio tiempo local. Los sucesos del mundo compuesto llevan el paso de la partida.

En paridad el reglamento delega el paso y las lecturas a War. Un ensayo juega un único hito. Para fijar las condiciones de un ensayo se pueden pasar `fabrica`, `bodega` (cantidad), `torretas` (casillas por ID), `programas`, `vinculos`, `fuentes`, `semillaFabrica` y `semillaIntento`.

`reglas.serializar(mundo)` copia los datos de la frontera. `reglas.restaurar(checkpoint, semillaIntento, actuales?)` crea un mundo con una batalla nueva. La app puede entregar el mismo checkpoint en el escenario de `crearPartida`. Una revisión incompatible devuelve H0, conserva los programas y expone la clave del aviso en `mundo.aviso`. El guardado persistente pertenece a la app.

`validarNivel(carpeta, contenido, tipos, catalogo)` devuelve errores con archivo y campo. El catálogo inyectado contiene los diccionarios ES/EN del nivel.

La ficha de clic declara los registros y los nombres de editor. En campaña y ensayo, `repartirClic` produce una entrada por torreta. El reglamento emite los clics de programa mediante `eventos(mundo)`, que vacía la lista. Para el disparo manual, la composición inyecta `pasoConIntentoPuntual` y la velocidad de misil de War. El intento usa la cadencia de la torreta y conserva el objetivo de su programa.

Las pruebas `pruebas/campaign-v2-{clic,gestos,seudo}.mjs` cubren el reparto, la concurrencia, la predicción, los controles y las fichas de editor.

Desde la raíz, las pruebas `pruebas/campaign-v2-{contenido,paridad,puente,secuencia,checkpoint}.mjs` cubren el contenido, las doce referencias de War y la continuidad en Node.

En campaña y ensayo, una batalla puede declarar `unidades` y `hostiles` con tipo de ficha y puesto inicial local. `paso.js` monta sus reglas en metros, traduce las lecturas de War con `leerEnemigos` y entrega los impactos pendientes con `danoEnArea` antes del siguiente paso de War. Cada mecánica aporta `ficha.js` y `reglas.js`, una importación y una entrada ordenada en `pasos`. Una capacidad puede inyectar la misma función de orden en el intérprete y en el mundo.

`ensayos/salida.js` fija la dotación, las oleadas y los programas de partida. En `pruebas/campaign-v2-mecanicas.mjs` se ejecuta el ensayo hasta la victoria y se observa el ciclo de vida de VEH-01 desde otra unidad.
