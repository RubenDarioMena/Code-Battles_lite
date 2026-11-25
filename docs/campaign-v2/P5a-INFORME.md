# P5a · Movimiento, VEH y tirador

## Coste real

Recuento respecto al índice recibido, incluida la sesión interrumpida. Las dos cifras de cada carpeta corresponden a `ficha.js` y `reglas.js`. Las líneas ES/EN incluyen ambos idiomas.

| Pieza | Archivos propios | Líneas compartidas |
| --- | --- | --- |
| Capacidad de movimiento | `mecanicas/movimiento/` · 10 + 72 | 1 importación y 1 llamada en `paso.js`, 16 líneas ES/EN |
| VEH y su proyectil | `mecanicas/vehiculo/` · 11 + 72 | 1 importación y 1 llamada en `paso.js`, 1 modelo, 10 líneas ES/EN con la cuenta atrás |
| Tirador | `mecanicas/tirador/` · 4 + 25 | 1 importación y 1 llamada en `paso.js`, 1 modelo, 2 líneas ES/EN |
| Ensayo Salida | `ensayos/salida.js` · 22 | 1 exportación pública, selección de ensayo en la composición y 8 líneas ES/EN |
| Coste único de War, ya en el índice | `reglas-war/index.js` · 1 archivo compartido, unas 20 líneas | Lectura de enemigos y daño en área. Cero líneas adicionales en P5a |
| Costes únicos de P5a | `paso.js` · 122 líneas, 6 de registro | Campo en metros, puente de impactos, espera por evento, recarga, ficha de editor, puerta y entidades móviles en las dos vistas |

El ticket 10 acertó con los dos archivos propios y la línea de modelo. El registro necesita dos líneas compartidas por pieza contando el import estático. La prueba inserta un cuarto módulo en memoria y ejecuta su paso. Para interpretar ese coste, el primer corte modifica además 32 archivos de producto ya presentes en el índice (+280/−88, incluidos catálogo, modelos y contratos). De ellos, el anfitrión ocupa +55/−10, la composición de la app +47/−24 y las dos vistas +41/−9. Pruebas y documentación se cuentan aparte.

## Archivos tocados

- Reglamento en `paquetes/reglas-campaign-v2/{index.js,index.d.ts,marco.js,niveles/nivel-1/nivel.js,README.md}` y las carpetas y archivos propios de la tabla.
- Runtime en `paquetes/anfitrion/{anfitrion,api,trabajador}.js` e `index.d.ts`. Composición en `paquetes/app/juego/{arranque,campaign-v2,ciclo-programas,estado,gestos-clic,paleta,proveedor-v2}.js`.
- Editor en `paquetes/editor/seudo-{edicion,modelo,vista}.js` y `paquetes/lenguaje/{instrumentar.js,index.d.ts}`. Pantalla en `paquetes/interfaz/{info-reto,maquinas,panel-hito,retos}.js` y `Prototypes/Rocket Launcher/css/campaign-v2.css`.
- Vistas en `paquetes/vista-2d/{iconos-hito,war}.js` y `paquetes/vista-3d/cv2/{ficha,index,modelos,paisaje}.js`. Catálogo en `shared/i18n/campaign-v2/nivel-1.js`.
- Pruebas en `pruebas/campaign-v2-{mecanicas,intento-base,escena-three,vista}.mjs` y `pruebas/todas.mjs`. Documentación en este informe, `PLAN-PORCIONES.md`, `docs/pantallas/editor.md` y `PROGRESO.md`.

## Cómo se prueba

- `node pruebas/todas.mjs` dio **81 ok, 7 falla, 0 omitida**. Fallan vfx-dibujantes, medir-carga-node, publicables, steam-empaquetado, steam-vdf, globales-juego y juego-identificadores, las siete de la línea base. Los 41 scripts JS/MJS de la porción pasaron `node --check`. El diff frente al índice de `paquetes/reglas-war` y `pruebas/referencias/partidas.json` está vacío.
- `node pruebas/campaign-v2-mecanicas.mjs` juega con semilla 29, comprueba la puerta y la llegada, y relaciona cada impacto con el derribo de War en el paso siguiente. Cubre redirección, parada, límites, observación de la baja desde JS y Python, edición durante la reposición, reinicio y huella de paridad. El árbol se prueba en DOM emulado.
- `node pruebas/three-r180.mjs` carga el GLB, comprueba la posición del VEH, que desaparece y vuelve, y selecciona el tirador con un rayo. Se inspeccionó una captura de la geometría proyectada de Salida, rasterizada por software.
- Al pulsar Ejecutar, VEH-01 sale por la puerta, alcanza su puesto y abate drones. TIR-01 abre fuego y el árbol indica los segundos hasta que vuelve el VEH. [Abrir Salida en el puerto de QA](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&ensayo=salida).

## Suposiciones

- La puerta ocupa la fila local 7, entre bastiones. El programa usa metros del mapa. El ensayo toma los valores de las fichas experimentales, permite dos brechas y pide dos derribos.
- El tirador está apostado, aplica el daño al disparar y muestra una traza breve. Seis segundos después de la baja, la base repone el VEH con vida y cargador completos. El anfitrión arranca la última fuente aplicada.
- El GLB tubular existente sirve como sustituto visual del VEH. El tirador usa la primitiva terrestre de War. En Python el programa parte de una copia de `home` para construir su destino.

## Faltantes

El sandbox denegó abrir el puerto 8771. Queda la revisión con navegador y GPU reales. El chequeo adicional de TypeScript conserva diagnósticos previos de dependencias de escritorio, Playwright y dos accesos a `mundo.hito`. WHL, minador y menú de pruebas quedan en P5b.
