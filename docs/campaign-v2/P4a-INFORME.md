# P4a · Escenario 3D en metros

H0 encuadra la prensa y la bodega. La Batalla muestra el frente de Traba, tres bastiones con pasos de unión y la torreta esfera. El terreno y los edificios de papel comparten el material de cartulina. El selector Batalla alterna entre papel y combate oscuro sobre la misma geometría. Se activa el combate al abrir una Batalla y al ejecutar el intento.

Los enemigos, sensores y reparadores conservan las primitivas de War. Los misiles parten del telescopio y llegan al objetivo de la simulación. El rig apunta desde el muñón, abre las hojas en fuego y recoge brevemente el telescopio en cada disparo. Durante el atasco cierra las hojas y enciende un piloto ámbar.

El colocador señala con «+» los bastiones libres cuando hay una única torreta seleccionada, a t = 0 o en pausa. La orden entra en la cola de la partida. Antes de ejecutar conserva el puesto al arrancar el intento. En pausa pasa por el conductor al reanudar y el puesto queda reservado para la siguiente Batalla. Un descarte muestra un aviso con el motivo.

## Archivos tocados

- Vista y registro en `paquetes/vista-3d/cv2/{index,modelos,materiales,paisaje,torreta}.js`. Cámara, primitivas, instancias, VFX y contrato en `paquetes/vista-3d/{camara,maquinas-war,war,instancias-war,efectos-war,index}.js`, `index.d.ts` y `README.md`.
- Composición y gestos en `paquetes/app/juego/{campaign-v2,vistas,colocador-v2,campo,gestos-clic,arranque,bucle,ciclo-programas}.js`. Selección y arranque de intentos en `paquetes/interfaz/{etiquetas,info-reto}.js`.
- Marcado, estilos y traducciones en `Prototypes/Rocket Launcher/{index.html,css/campaign.css}` y `shared/i18n/campaign-v2/nivel-1.js`.
- Pruebas en `pruebas/{campaign-v2-vista,campaign-v2-escena-three,juego-arranque,three-r180,todas}.mjs` y `paquetes/vista-3d/pruebas/vista-3d.mjs`. Entrega en este informe, `PLAN-PORCIONES.md` y `PROGRESO.md`.

## Cómo se prueba

- `node pruebas/campaign-v2-vista.mjs` abre todos los GLB y sus PNG, verifica las URL githack/raw, caché, carga fallida, dirección real del telescopio, retroceso, atasco y coordenadas entregadas al campo.
- `node pruebas/three-r180.mjs` monta los GLB de H0 y B1 con el cargador y los rayos reales de Three. Emula el renderer y la decodificación de imágenes. `node pruebas/three-r180.mjs --rig` contrasta la pose con las referencias de Blender.
- `node pruebas/juego-arranque.mjs` recorre H0 → B1, el selector, el clic en un puesto libre, el arranque con ese puesto y el descarte en la cola de pausa. El DOM está emulado.
- `node pruebas/todas.mjs` dio **79 ok, 7 falla, 0 omitida**. Fallan las siete suites de la línea base: vfx-dibujantes, medir-carga-node, publicables, steam-empaquetado, steam-vdf, globales-juego y juego-identificadores. Pasan las 43 referencias, el marco, las pruebas de Three y el adaptador del rig.
- `node --check` pasó en los 28 módulos JS/MJS tocados. La comprobación adicional con TypeScript local conserva los diagnósticos previos de dependencias ausentes y los dos de `mundo.hito` de P3a.
- `git diff -- paquetes/reglas-war pruebas/referencias/partidas.json` salió vacío.

## Revisión manual en navegador

Desde la raíz, servir el worktree con `python3 -m http.server 8771 --bind 127.0.0.1`.

1. [Campaña desde H0](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2). Con almacenamiento nuevo se ven prensa y bodega detrás de la muralla. Alternar 2D/3D durante la producción. Al alcanzar cuatro misiles aparece B1.
2. [Ensayo B1](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&ensayo=b1). En 3D, pulsar «Batalla» para ver fibra, relieve, tramos y torreta sobre el nudo. Orbitar y acercar. Seleccionar LAU-01, pulsar «+» y ejecutar. Debe conservar el puesto y volver al combate oscuro. Probar también en el plano.
3. [Ensayo B4](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&ensayo=b4). Mantener fuego en ráfaga para revisar hojas, retroceso y piloto al atascarse. Con oyentes de P3b, hacer clic derecho en enemigo y terreno y alternar 2D/3D. Los programas reciben casillas locales en ambas vistas.
4. [Paridad B1](http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/index.html?serie=campaign-v2&modo=paridad&batalla=b1). Debe aparecer la vista histórica de War y estar ausentes los botones de colocación.

## Suposiciones

- Bastión apoyado por el centro de su base y torreta sobre su coronación a 8,64 m sobre el terreno. El rumbo del rig compensa la orientación oblicua del telescopio en reposo. La altura del dibujo se adapta al relieve.
- Las dos teselas cubren x = 100–300 e y = 52–104 m. Se funden con el fondo en los últimos cinco metros. El plano 2D conserva `reglas.escena` en casillas y el adaptador del campo traduce el rayo 3D con `puntoEnMarco`.
- `materiales.js` concentra el material WebGL de cartulina y el cambio de piel para admitir una variante TSL. Se conserva WebGLRenderer porque los VFX existentes usan GLSL.

## Faltantes

- Revisión visual en navegador real, en particular el encuadre vertical, el relieve, el cambio de LOD y la legibilidad del atasco.
- `mapa.py`, en `vias()`, hornea la losa centrada en (93, 72), de 41 × 27 m. Ocupa x = 72,5–113,5. Para alinearla con la instalación x ≈ 174–207, ajustar la losa en `mapa-ampliado.json` y regenerar las teselas afectadas en una tarea de arte. Las máquinas están en sus metros de simulación.
- El empaquetado de escritorio y Netlify deberá incluir las teselas, piezas, JSON y PNG de `arte/blender/papercraft/` al preparar esa distribución. P4b recoge la UI del primer hito.
