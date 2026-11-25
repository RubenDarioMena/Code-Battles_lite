# P3b · Eventos, clic programado y gestos

En campaña y ensayo, el clic derecho o la pulsación táctil de 450 ms se reparte por torreta seleccionada. Cada oyente recibe los datos del clic en su propio hilo. Puede esperar mientras se ejecuta otro clic. El registro tardío identifica la unidad y la línea. La consola anuncia cada registro y la etiqueta proyectada de la torreta muestra ⌖ en ambas vistas.

El recuadro selecciona unidades y dos dedos controlan la cámara. Mantener una torreta y arrastrar la diana reserva un disparo manual. Ese intento usa el paso de fuego de War y conserva el modo y el objetivo del programa. En JS, Python y Seudo, disparar al enemigo recibido calcula el punto de intercepción y activa el fuego continuo.

## Archivos

- Transporte y contratos en `paquetes/anfitrion/{anfitrion,api,trabajador}.js`, `index.d.ts`, su README, `paquetes/nucleo/index.d.ts` y `paquetes/app/conductor.js`.
- Reglamento y contrato en `paquetes/reglas-campaign-v2/{index.js,index.d.ts,README.md}`, `mecanicas/clic/{ficha,reglas}.js` y `paquetes/reglas-war/{index.js,index.d.ts}`.
- Composición en `paquetes/app/juego/{arranque,campaign-v2,campo,ciclo-programas,datos-proveedor,estado,gestos-clic,paleta,proveedor,proveedor-v2,python,vistas}.js`.
- Editor en `paquetes/editor/seudo-{edicion,gestos,modelo,vista}.js`. Ayuda e indicación en `paquetes/interfaz/{ayuda,etiquetas,info-reto,inspector,sugerencias}.js`.
- Cámara y guía en `paquetes/vista-2d/{index.d.ts,vista.js,war.js}`, `paquetes/vista-3d/{camara.js,index.d.ts,vista.js}` y `Prototypes/Rocket Launcher/css/campaign.css`. Textos ES/EN en `shared/i18n/campaign-v2/nivel-1.js`.
- Pruebas en `pruebas/campaign-v2-{clic,gestos,intento-base,seudo}.mjs`, `juego-arranque.mjs`, `python-traductor.cjs` y `todas.mjs`. Entrega en este informe, el plan de porciones, la spec del editor y `PROGRESO.md`.

## Verificación

- `node pruebas/todas.mjs` dio **75 ok, 7 falla, 0 omitida**. Fallaron vfx-dibujantes, medir-carga-node, publicables, steam-empaquetado, steam-vdf, globales-juego y juego-identificadores, los siete de la línea base.
- `node pruebas/campaign-v2-clic.mjs` cubre selección mixta, copias de datos, solapamiento y orden de oyentes, error aislado, predicción comparada con autoTarget, cadencia, descarte y repetición con la misma huella y órdenes.
- `node pruebas/campaign-v2-gestos.mjs` recorre los punteros con temporizador emulado. `node pruebas/juego-arranque.mjs` ejecuta el clic desde el editor en JS y Python y comprueba icono y consola con DOM y vistas emulados.
- `node pruebas/python-traductor.cjs` ejecuta registros con def, async def y lambda. `node pruebas/campaign-v2-seudo.mjs` comprueba paleta, cuerpo y conversión de ida y vuelta con una ficha ficticia de onDamage.
- Pasaron las 41 referencias, la paridad de V2, los checkpoints, P3a y las fronteras. El diff de P3b en War añade la función pública y su declaración. El archivo de referencias coincide con el índice recibido.

## Suposiciones

- Se graba una entrada por unidad con el destino resuelto y sus datos al pulsar. Así la repetición ejecuta también los oyentes cuyos clics solo escriben en consola.
- Se reserva un turno por torreta. Una segunda orden puntual antes de ese turno se descarta con aviso. La falta de munición o el atasco se comprueban al procesar el intento. Desde reposo, un disparo usa la cadencia regular.
- Soltar sobre la torreta sin arrastrar conserva la selección de esa unidad. Alt+clic y «Señalar» no figuraban entre los controles del mapa de esta rama.

## Faltantes

Queda pendiente revisar capturas en navegador real. El entorno denegó abrir el puerto 8771 (EPERM). La comprobación adicional con TypeScript quedó limitada por las dependencias de escritorio y Playwright ausentes y por dos diagnósticos sobre el tipo de `mundo.hito` en la repetición de P3a.
