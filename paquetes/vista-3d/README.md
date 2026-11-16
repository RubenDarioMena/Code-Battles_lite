# vista-3d

Estado: fase 2, paso 6. Módulos ES con el dibujo, cámara y gestos anteriores.
Solo leen `estado.escena` (datos planos del reglamento) y la selección; no
escriben en la escena. Mantienen la extrapolación `off` en segundos.

## Contrato vigente

La entrada pública `index.js` exporta:

- `crear3D(estado, deps)`: visor común de War y Factory. `war.js` compone
  materiales, unidades y efectos; `camara.js` guarda las posturas, selección,
  proyección y gestos; `terreno.js` construye el paisaje y el terreno del editor.
- `crearCampaign3D(estado, deps)`: diorama y unidades de Campaign.
- `factory3d`: objeto mutable `{ construir, actualizar, cargar, ik, ultimo }`
  con el contenido de Factory y el gancho de inspección del último escenario.

Los creadores devuelven `null` sin `THREE` o si falla WebGL. Campaign también
lo hace si falta `deps.crearTerreno`. Las vistas ofrecen `construir`,
`actualizar(off, ahora)`, `render`, `tamano`, `proyectar`, `elegir`, `suelo`,
`centrar`, `recentrar`, `anillosDe`, `aplicarColores`, `girar`, `retrato` y
`camara`; Campaign añade `batalla`, `verCampo` y `terreno`. Tipos en `index.d.ts`.

La app inyecta `$`, colores (`leerVar`), funciones visuales y catálogos.
War recibe `terreno` (API de CMGTerreno) y `terrenoEditor` (datos ya validados
o null): la URL y el guardado se leen en `juego.js`. Campaign recibe `mapa`,
`crearTerreno` de vista-2d y `reglas` (funciones y catálogos de Campaign).
No importa otros paquetes; puede importar `protocolo` y `vfx`.

`THREE` sigue siendo global (r128 local) hasta la fase 4. DOM, canvas, tamaño
de pantalla y reloj de animación siguen dentro de las vistas. Las rutas de
modelo T1 y cargador glTF conservan su resolución relativa a la página.
El puente publica `VISTA_3D` y `FACTORY_3D` (el mismo objeto `factory3d`).

## Origen y pendientes

Traslado de `Prototypes/Rocket Launcher/js/vistas.js`, `js/factory-3d.js` y
`js/campaign-3d.js`, retirados. Pendiente el contrato final `crearVista`,
`dibujar(anterior, actual, fraccion)`, `redimensionar` y `destruir` del plan;
los efectos por sucesos quedan para `vfx` (fase 4).

## Pruebas

`node paquetes/vista-3d/pruebas/vista-3d.mjs` (en `npm test`): exportaciones,
IK, respaldo sin Three/WebGL, War con Three r128 real y renderizador falso,
escena congelada en profundidad, cámara y geometrías inyectadas del editor.
No prueba rasterizado. Para navegador: `pruebas/factory-3d.mjs`,
`pruebas/vista-caliente.cjs` y comparaciones con `herramientas/capturas-vista.mjs`.
