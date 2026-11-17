# Capturas de las vistas

```sh
python3 -m http.server 8771 --bind 127.0.0.1
node herramientas/capturas-vista.mjs capturar http://127.0.0.1:8771 /tmp/vista-a
node herramientas/capturas-vista.mjs capturar http://127.0.0.1:8771 /tmp/vista-b
node herramientas/capturas-vista.mjs comparar /tmp/vista-a /tmp/vista-b
```

El servidor y las capturas los ejecuta el autor en este paso. Se usan contextos
nuevos, viewport 1280×800, escala 1 y el origen dedicado de QA (8771). Se
conservan las capturas finales de War/Factory e iniciales de Campaign.
`comparar` incluye todos los PNG, también `war-combate-2d.png` y
`war-combate-3d.png`; devuelve salida 1 si difieren o falta algún PNG en cualquiera de las carpetas.

## Combate reproducible

`capturas-combate.mjs` fija reto 3 (índice 2), semilla 7 y paso **512**, a
25,6 s. Dentro de `__banco.alPaso`, al llegar a `partida.pasoActual===512`,
`__banco.congelarVista()` pone pausa y cierra el conductor y sus Workers.
Así no se ejecuta el resto del lote del fotograma ni se entregan nuevas
órdenes. Es un gancho de QA terminal: para jugar otra vez, ejecutar/reiniciar.
No modifica el mundo, las reglas, el RNG ni los programas.

No se espera un tiempo de reloj para escoger la escena: el sondeo solo espera
el indicador que deja ese hook. La pausa fuerza `off=0`; `performance.now` y
las marcas de rAF se fijan a 123456, se esperan fuentes y nueve fotogramas a
esa misma marca. En ese paso hay 6 orugas, 3 drones normales, 2 fríos y 1 misil;
es el primer disparo, sin derribos previos cuyo origen visual dependa de los
fotogramas de la ejecución. No hay golpe reciente en esta escena; las pruebas
Node cubren los materiales de golpe de ambos modelos y frío.

La misma escena, sucesos, pose y reloj producen la misma captura usando la
misma versión de navegador, GPU, tamaño y fuentes. `pruebas/capturas-combate.mjs`
comprueba repetición de escena/sucesos y corte exacto del conductor sin GPU;
la identidad píxel a píxel debe comprobarse con las dos ejecuciones anteriores.
Factory conserva el ruido histórico del suavizado de su brazo.

Para comparar con la versión anterior, servirla en otro worktree/puerto y
copiarle únicamente los ganchos de QA de `arranque.js` (`congelarVista`,
`escenaVista`, `dibujarCaptura`) y el contador `dibujo` de `camara.js`;
ejecutar esta herramienta contra los dos orígenes. No copiar las instancias.

## Llamadas de dibujo y saturación

La salida y `resumen.json` guardan `dibujo.calls` y `dibujo.triangles` de
`cmg.camara()`; solo el caso 3D corresponde al render capturado. Son totales
del fotograma, con paisaje, máquinas, anillos y VFX. Errores de página también
quedan en el resumen. No son una medida de tiempo GPU.

Para C orugas, D drones y P misiles, los elementos móviles pasan de
`3C + 9D + 2P` llamadas a `K + D + P`, con K parejas no vacías (hasta 11).
Las D+P líneas se conservan. En combate: **65→14**, reducción de 51 llamadas;
**3528 triángulos móviles en ambos casos**, más el resto de la escena.
Son cifras estructurales esperadas con los elementos dentro del encuadre;
la lectura real del renderer queda a cargo de la ejecución del autor.

```sh
node herramientas/capturas-vista.mjs capturar http://127.0.0.1:8771 /tmp/carga --enemigos 2000
```

Este modo captura solo `war-carga-3d-2000.png`. Tras el mismo paso 512, detiene
el bucle visual y dibuja una copia de la escena con posiciones y IDs sintéticos,
normal/frío/golpe, sin tocar el mundo ni su RNG. Retiene el misil real.
Con 2000 enemigos: 1092 orugas y 908 drones; esperado **11450→919** llamadas
móviles, más los objetos fijos/VFX, y 577200 triángulos móviles en ambos casos.
El crecimiento de los triángulos sigue siendo lineal: se reduce el envío de
mallas, no la geometría. Con muchos drones las líneas siguen siendo el límite.

Revisar siluetas, brazos/rotores, altura discontinua, transparencias y sombras;
selección con clic/toque, anillos, golpe y cambio de tema; mover/rotar cámara
y ejecutar/reiniciar varias veces. No hay navegador ni rasterizado emulado en
los resultados Node de este paso.
