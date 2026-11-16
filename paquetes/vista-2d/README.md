# vista-2d

Estado: fase 2, paso 5. Dibuja el mundo en 2D a partir de la **escena** de cada
reglamento (`escena(mundo)`, datos planos). No lee ni escribe el mundo.

## Puede importar

`protocolo`, `vfx`. Véanse las reglas de [paquetes](../README.md). No importa
reglamentos: lo que necesita de ellos (mapa de Campaign y sus funciones
`esRobot`, `esMaquina`, `estadoMaquina`) lo inyecta la app.

## Contrato vigente

Módulos ES con el código de antes, sin cambios de dibujo:

- `crearPlano(estado, deps)` → `dibujar2D(off)`: plano de War y marco común de
  Factory (antes en `js/vistas.js`). Factory delega en `dibujarFactory`.
- `dibujarFactory(ctx, escena, colores, seleccion, geo)`: logística de Factory
  (antes `js/factory-vista.js`). Los dos iconos de la paleta que registraba ese
  archivo siguen en `js/factory-iconos.js`, porque se registran al cargar.
- `crearPlanoCampaign(estado, deps)` → `dibujar()`: plano de Campaign con zoom y
  desplazamiento propios (antes `js/campaign-plano.js`). `deps` añade `mapa`
  (`CAMPAIGN_NIVEL.MAPA`) y `reglas` (las funciones de Campaign).
- `crearTerreno(mapa)`: relieve determinista de Campaign (antes
  `js/campaign-terreno.js`). La vista 3D de Campaign también lo usa; mientras
  siga en `js/`, el puente lo publica como `CAMPAIGN_TERRENO`.

`estado` es el objeto de lectura que da `juego.js`: `escena` (una copia por
fotograma), selección, colores, `cols`/`rows` y `geo2`, donde el plano publica
su geometría para elegir y etiquetar. Se mantiene la extrapolación de antes:
la escena actual adelantada `off` segundos.

El juego carga el paquete a través de `js/compat-paquetes.js` (`VISTA_2D`).

## Decisiones y límites

- El plano de Campaign mira el botón de piel de batalla en el DOM y
  `window.__banco`, como antes; debe pasar a un dato de `estado`.
- `window.devicePixelRatio` y `performance.now()` (halos) se leen dentro de la
  vista: es lo que se espera de una vista, no de las reglas.
- Pendiente para cerrar el contrato del plan: `crearVista(contenedor,
  { tema, calidad })` con `dibujar(anterior, actual, fraccion)` (fracción × DT =
  `off`), `elegir(x, y)` (hoy `elegir2D` en `juego.js`), `redimensionar()` y
  `destruir()`.

## Pruebas

- `node paquetes/vista-2d/pruebas/vista-2d.mjs` (en `npm test`): War y Factory
  dibujan con un lienzo falso a partir de escenas **congeladas en profundidad**
  (una escritura fallaría); relieve de Campaign determinista.
- `herramientas/capturas-vista.mjs`: capturas deterministas antes y después
  del traslado, idénticas píxel a píxel en War, Factory y Campaign 2D.
- `pruebas/vista-caliente.cjs` (navegador): cambio 2D/3D en caliente.
