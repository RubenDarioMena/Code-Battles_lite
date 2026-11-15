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

Vacío desde la fase 0: solo manifiesto y contrato. No se crea `index.js` todavía; las entradas públicas empiezan en la fase 1.
