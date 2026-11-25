# P3a · Runtime del primer corte

En campaña y ensayo, cada error detiene el programa de su unidad. La consola identifica la unidad y la línea. «Aplicar ahora» arranca la nueva fuente desde la primera línea en la misma torreta, con su posición, munición y atasco. En paridad sigue vigente el cierre global de War.

La pausa admite órdenes manuales y recargas. La consola muestra su llegada y, al reanudar, el paso en que se aplican en orden. Cada intento conserva en memoria su escenario inicial, semilla, programas de partida y entradas con paso y fuente. La repetición ejecuta esos programas desde el mismo origen. El checkpoint sigue con el formato de P2.

## Archivos de P3a

- Runtime y contratos heredados en `paquetes/anfitrion/{anfitrion.js,index.d.ts}`, `paquetes/nucleo/{index.js,index.d.ts}` y `paquetes/app/{conductor.js,index.d.ts}`.
- Composición y controles en `paquetes/app/juego/{arranque,campaign-v2,ciclo-programas,programas,repetir-intento}.js`, `paquetes/interfaz/{editor-texto,info-reto,inspector}.js`, `Prototypes/Rocket Launcher/index.html` y `shared/i18n/campaign-v2/nivel-1.js`.
- Pruebas en `pruebas/campaign-v2-{error-aislado,aplicar,repetir,pausa,intento-base}.mjs`, `pruebas/todas.mjs` y `pruebas/juego-arranque.mjs`.
- En el cierre se amplió `juego-arranque.mjs` para pulsar los controles y leer la consola. Se retiraron el log y la configuración temporal de `.p3a-temp/`. La entrega queda registrada en este informe, el plan de porciones, la spec del editor y `PROGRESO.md`.

## Verificación en Node

- Desde la raíz, ejecutar `node pruebas/todas.mjs`. Resultado del cierre: **72 ok, 7 falla, 0 omitida**. Fallan vfx-dibujantes, medir-carga-node, publicables, steam-empaquetado, steam-vdf, globales-juego y juego-identificadores, los mismos siete de la línea base.
- `node pruebas/juego-arranque.mjs` comprueba los botones de ejecutar, aplicar, pausar, ordenar, reiniciar y repetir con el DOM emulado y el intérprete real.
- Para probar el determinismo por separado, ejecutar `node pruebas/campaign-v2-repetir.mjs`. Compara huella, pasos, órdenes y resultado desde el checkpoint de B1.

## Prueba manual en navegador

1. Desde la raíz, ejecutar `python3 -m http.server 8771 --bind 127.0.0.1` y abrir el [ensayo B5 con repetición](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&ensayo=b5&repetir=1). En Ajustes, activar «Mostrar coordenadas manuales».
2. En JavaScript, escribir en LAU-01 tres líneas, en este orden, con `// uno`, `// dos` y `throw new Error("prueba");`. En LAU-02 escribir `while (true) { regularShoot({x:20,y:6}); await esperar(0.5); }`. Ejecutar. La consola debe mostrar «prueba» junto a «LAU-01 L3», mientras LAU-02 sigue disparando.
3. Pausar, seleccionar solo LAU-01 y escribir `{x:20,y:6}` en «Lugar manual». Elegir «regularShoot» en «Orden manual». Sustituir el programa por `log("recuperada");`, pulsar «Aplicar ahora» y elegir «stopFire». La consola debe mostrar las tres entradas «En espera» en ese orden.
4. Reanudar. Las tres confirmaciones deben indicar el mismo paso. Debe aparecer «recuperada» en LAU-01 L1 y continuar el mismo intento.
5. Pulsar «Reiniciar» para cerrar el intento. Sin recargar la página, pulsar «Repetir último intento». Comprobar en la consola el paso final y el resultado «detenido».
6. Abrir la [misma batalla en paridad](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&modo=paridad&batalla=b5). Reponer el programa con el error del paso 2 y ejecutar. Debe terminar la partida con el fallo en la línea 3.

## Suposiciones

«Último intento» abarca la sesión de la pestaña. El parámetro `repetir=1` habilita el botón desde el comienzo. La reproducción se ejecuta sin dibujo y devuelve su resultado en la consola.

## Faltantes

Queda pendiente la comprobación en navegador real. El entorno denegó escuchar en 127.0.0.1:8771 (EPERM). P3b conserva eventos, clic programado, gestos, nodo «cuando» y pruebas Python.
