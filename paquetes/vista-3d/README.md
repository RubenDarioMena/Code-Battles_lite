# vista-3d

Dibuja el mundo en 3D a partir de instantáneas y sucesos. Interpola sin leer ni escribir el mundo.

## Puede importar

`protocolo`, `vfx`. Véanse las reglas de [paquetes](../README.md).

## Contrato

`crearVista(contenedor, { tema, calidad })`; `dibujar(anterior, actual, fraccion)`, `alSuceso(suceso)`, `elegir(x, y)` devuelve id o null, `redimensionar()` y `destruir()`.

## De dónde sale

`Prototypes/Rocket Launcher/js/vistas.js`, `Prototypes/Rocket Launcher/js/factory-3d.js`, `Prototypes/Rocket Launcher/js/campaign-3d.js`

## Pruebas

Vivirán en `paquetes/vista-3d/pruebas/`. Criterio: Dibujo desde datos, selección y cambio 2D/3D sin reiniciar; revisión de capturas.

## Estado

Fase 2, paso 4: **las vistas ya dibujan solo con la escena del reglamento**.
El código sigue en `Prototypes/Rocket Launcher/js/` (`vistas.js`,
`factory-3d.js`, `campaign-3d.js`) como scripts globales; todavía no
es un módulo de este paquete.

- Las vistas leen `estado.escena` (antes `estado.mundo`): `escena(mundo)` de
  cada reglamento, datos planos copiados una vez por fotograma por `juego.js`
  (se invalida al empezar el fotograma y al crear un mundo). No pueden escribir
  en el mundo.
- Se mantiene la extrapolación de antes: dibujan la escena actual adelantada
  `off` segundos (`off = fracción × DT`). El contrato `dibujar(anterior, actual,
  fraccion)` del plan se adoptará con esa semántica al mover el código aquí.
- Las explosiones y misiles llegan en la escena (estado visible). Usar los
  sucesos para efectos queda para el paquete `vfx` (fase 4).
- Cambio 2D/3D en caliente: `aplicarVista` alterna las dos vistas sin tocar la
  partida; `pruebas/vista-caliente.cjs` lo comprueba en las tres series.
- Verificación del paso: capturas deterministas (tiempo congelado) idénticas
  píxel a píxel antes y después en War, Factory y Campaign, y el mismo instante
  a mitad de batalla (misiles y explosiones) dibujado desde el mundo y desde la
  escena, idéntico. Las únicas diferencias son ruido que ya existía entre dos
  capturas de la base (brazo animado del robot de Factory 3D y un chip de texto).

Pendiente: mover el código a este paquete como módulo ES con `crearVista`,
`elegir(x, y)` (hoy `elegir2D` y `V3.elegir` en `juego.js`) y `destruir()`.
