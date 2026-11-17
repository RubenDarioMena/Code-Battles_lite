# Medida de carga de los efectos (fase 4, paso 3)

17 de noviembre de 2026. Herramienta: `herramientas/medir-carga.mjs`. Electron (cáscara de escritorio) con la GPU real: ANGLE Metal, Apple M1. Ventana 1280×720, `devicePixelRatio` 2, lienzo 1386×1126. 10 s por caso tras el calentamiento, a velocidad 1×. Datos completos en `resumen-120.json` y `resumen-12.json`.

- **Real:** reto 1, semilla 7, programa ganador de `RETOS[1]` para LAU-01. La ventana empieza con la primera explosión (17 s de juego).
- **Saturación:** tríos sintéticos (disparo, derribo y explosión con golpe) inyectados por `__banco.sucesosVistas`, la misma vía que usa el conductor, hacia las dos vistas. 120 tríos/s es el peor caso, muy por encima de la partida real; 12 tríos/s sigue siendo mucho más que cualquier combate actual.
- **CPU:** `particulas()` y el envío al dibujante. No incluye el render de la escena; los intervalos de fotograma sí lo incluyen todo.

## Lectura

- **Partida real:** 60 fps fijos en los cuatro niveles y las dos vistas, sin fotogramas de más de 33 ms. Picos de 194, 113 y 52 partículas en alto, medio y bajo. CPU de efectos por debajo de 0,3 ms por fotograma.
- **Saturación a 12 tríos/s:** 60 fps en todos los niveles y las dos vistas. Hasta 4,3 ms de CPU en el p95.
- **Saturación a 120 tríos/s:** medio, bajo y sin efectos mantienen 60 fps. Alto en 2D pierde fotogramas (83 de más de 33 ms). El coste es de CPU, no de GPU (dibujar en 3D cuesta 0,08 ms): el presupuesto limita lo que se dibuja, pero `particulas()` evalúa antes todas las partículas de todos los sucesos vivos, así que el coste crece con el caudal y no con el presupuesto.
- **Post-proceso:** no se añade en este paso. Nada está limitado por la GPU, Three r128 necesitaría módulos de `examples/` que no están en `shared/vendor`, y la actualización de Three está pendiente de decisión. Se reconsidera tras esa decisión y tras la medida en teléfono (fase 6).

## 120 tríos/s (peor caso)

| Calidad | Vista | Escenario | Fotogramas | Media ms | p95 ms | p99 ms | >33 ms | Vivas máx./presupuesto | CPU partículas ms | CPU dibujo ms | CPU total p95 ms |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| alto | 2d | real | 600 | 16.67 | 18.60 | 18.70 | 0 | 194/2000 | 0.27 | 0.18 | 1.40 |
| alto | 2d | saturacion | 510 | 19.64 | 33.40 | 33.50 | 83 | 2000/2000 | 15.70 | 1.66 | 18.70 |
| alto | 3d | real | 600 | 16.67 | 18.60 | 18.70 | 0 | 194/2000 | 0.27 | 0.02 | 0.90 |
| alto | 3d | saturacion | 599 | 16.72 | 17.30 | 18.70 | 2 | 2000/2000 | 15.39 | 0.08 | 16.90 |
| medio | 2d | real | 601 | 16.67 | 18.70 | 18.70 | 0 | 113/1200 | 0.18 | 0.13 | 0.90 |
| medio | 2d | saturacion | 601 | 16.67 | 18.70 | 18.70 | 0 | 1200/1200 | 9.08 | 1.02 | 10.90 |
| medio | 3d | real | 601 | 16.67 | 18.60 | 18.70 | 0 | 113/1200 | 0.19 | 0.01 | 0.60 |
| medio | 3d | saturacion | 601 | 16.67 | 18.60 | 18.70 | 0 | 1200/1200 | 9.03 | 0.05 | 10.00 |
| bajo | 2d | real | 601 | 16.66 | 18.60 | 18.70 | 0 | 52/600 | 0.11 | 0.09 | 0.60 |
| bajo | 2d | saturacion | 601 | 16.67 | 18.60 | 18.70 | 0 | 600/600 | 4.28 | 0.51 | 5.60 |
| bajo | 3d | real | 601 | 16.67 | 18.60 | 18.70 | 0 | 52/600 | 0.12 | 0.01 | 0.40 |
| bajo | 3d | saturacion | 600 | 16.67 | 18.60 | 18.70 | 0 | 600/600 | 4.47 | 0.03 | 5.60 |
| no | 2d | real | 600 | 16.67 | 18.70 | 18.70 | 0 | 0/0 | 0.02 | 0.00 | 0.10 |
| no | 2d | saturacion | 600 | 16.67 | 18.60 | 18.70 | 0 | 0/0 | 0.06 | 0.00 | 0.20 |
| no | 3d | real | 601 | 16.67 | 18.60 | 18.70 | 0 | 0/0 | 0.02 | 0.01 | 0.10 |
| no | 3d | saturacion | 601 | 16.66 | 18.70 | 18.80 | 0 | 0/0 | 0.08 | 0.01 | 0.20 |

## 12 tríos/s

| Calidad | Vista | Escenario | Fotogramas | Media ms | p95 ms | p99 ms | >33 ms | Vivas máx./presupuesto | CPU partículas ms | CPU dibujo ms | CPU total p95 ms |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| alto | 2d | real | 600 | 16.67 | 18.70 | 18.70 | 0 | 194/2000 | 0.25 | 0.18 | 1.40 |
| alto | 2d | saturacion | 601 | 16.67 | 18.40 | 18.70 | 0 | 1357/2000 | 1.56 | 1.10 | 3.50 |
| alto | 3d | real | 600 | 16.67 | 18.60 | 18.70 | 0 | 194/2000 | 0.27 | 0.02 | 0.90 |
| alto | 3d | saturacion | 601 | 16.67 | 18.40 | 18.70 | 0 | 1392/2000 | 3.14 | 0.12 | 4.30 |
| medio | 2d | real | 601 | 16.67 | 18.70 | 18.70 | 0 | 113/1200 | 0.18 | 0.13 | 0.90 |
| medio | 2d | saturacion | 601 | 16.67 | 18.60 | 18.70 | 0 | 797/1200 | 1.42 | 0.83 | 3.70 |
| medio | 3d | real | 601 | 16.66 | 18.70 | 18.70 | 0 | 113/1200 | 0.18 | 0.01 | 0.60 |
| medio | 3d | saturacion | 601 | 16.67 | 18.60 | 18.70 | 0 | 803/1200 | 2.14 | 0.13 | 2.90 |
| bajo | 2d | real | 600 | 16.67 | 18.70 | 18.70 | 0 | 52/600 | 0.12 | 0.08 | 0.50 |
| bajo | 2d | saturacion | 601 | 16.66 | 18.70 | 18.70 | 0 | 352/600 | 1.13 | 0.81 | 2.50 |
| bajo | 3d | real | 601 | 16.66 | 18.60 | 18.70 | 0 | 52/600 | 0.12 | 0.01 | 0.30 |
| bajo | 3d | saturacion | 601 | 16.67 | 18.60 | 18.70 | 0 | 366/600 | 1.14 | 0.07 | 1.50 |
| no | 2d | real | 601 | 16.67 | 18.60 | 18.70 | 0 | 0/0 | 0.02 | 0.00 | 0.10 |
| no | 2d | saturacion | 601 | 16.67 | 18.60 | 18.70 | 0 | 0/0 | 0.03 | 0.00 | 0.10 |
| no | 3d | real | 601 | 16.66 | 18.60 | 18.70 | 0 | 0/0 | 0.02 | 0.00 | 0.10 |
| no | 3d | saturacion | 600 | 16.67 | 18.60 | 18.70 | 0 | 0/0 | 0.03 | 0.01 | 0.10 |

## Tras pasar a Three r180 (paso 5), 120 tríos/s

Misma máquina y procedimiento, con el juego ya en r180 (`resumen-r180-120.json`). El resultado no cambia: 60 fps fijos en la partida real en todos los niveles y vistas; en saturación, medio, bajo y sin efectos a 60 fps y alto en 2D con 81 fotogramas de más de 33 ms. El dibujo 3D en saturación pasa de 0,08 a 0,34 ms de CPU porque cada partícula convierte su color de sRGB a lineal; sigue siendo despreciable.

| Calidad | Vista | Escenario | Fotogramas | Media ms | p95 ms | p99 ms | >33 ms | Vivas máx./presupuesto | CPU partículas ms | CPU dibujo ms | CPU total p95 ms |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| alto | 2d | real | 601 | 16.67 | 18.50 | 18.60 | 0 | 194/2000 | 0.29 | 0.20 | 1.60 |
| alto | 2d | saturacion | 515 | 19.45 | 33.40 | 34.60 | 81 | 2000/2000 | 15.54 | 1.69 | 18.20 |
| alto | 3d | real | 601 | 16.66 | 17.80 | 18.30 | 0 | 194/2000 | 0.29 | 0.05 | 1.10 |
| alto | 3d | saturacion | 593 | 16.89 | 17.10 | 33.30 | 7 | 2000/2000 | 15.47 | 0.34 | 16.60 |
| medio | 2d | real | 601 | 16.67 | 18.20 | 18.60 | 0 | 113/1200 | 0.21 | 0.15 | 1.10 |
| medio | 2d | saturacion | 600 | 16.67 | 16.90 | 18.30 | 0 | 1200/1200 | 8.94 | 1.03 | 10.50 |
| medio | 3d | real | 601 | 16.67 | 18.30 | 18.60 | 0 | 113/1200 | 0.20 | 0.04 | 0.70 |
| medio | 3d | saturacion | 601 | 16.67 | 17.10 | 18.10 | 0 | 1200/1200 | 8.95 | 0.21 | 9.90 |
| bajo | 2d | real | 601 | 16.67 | 18.30 | 18.60 | 0 | 52/600 | 0.14 | 0.10 | 0.60 |
| bajo | 2d | saturacion | 601 | 16.67 | 17.30 | 18.50 | 0 | 600/600 | 4.35 | 0.54 | 5.60 |
| bajo | 3d | real | 601 | 16.67 | 18.20 | 18.60 | 0 | 52/600 | 0.13 | 0.03 | 0.40 |
| bajo | 3d | saturacion | 601 | 16.67 | 17.70 | 18.50 | 0 | 600/600 | 4.47 | 0.12 | 5.60 |
| no | 2d | real | 601 | 16.67 | 18.10 | 18.60 | 0 | 0/0 | 0.02 | 0.00 | 0.10 |
| no | 2d | saturacion | 601 | 16.67 | 18.00 | 18.40 | 0 | 0/0 | 0.09 | 0.00 | 0.20 |
| no | 3d | real | 600 | 16.67 | 18.30 | 18.60 | 0 | 0/0 | 0.02 | 0.01 | 0.10 |
| no | 3d | saturacion | 600 | 16.67 | 18.20 | 18.50 | 0 | 0/0 | 0.10 | 0.01 | 0.20 |
