# Dos propuestas para la torreta de observación

Ambas conservan la esfera de 1 m, el alojamiento Allen ampliado, la compuerta centrada a 45° y el telescopio sin cristal. Se muestran en corte para revisar sus apoyos y transmisión.

| Aspecto | A · Cardán dentado | B · Tres ruedas omnidireccionales |
|---|---|---|
| Accionamiento | M1 en muñón X; M2 en muñón Y; M3 gira la base | Tres ruedas omni con ejes tangentes oblicuos |
| Base | Giratoria | Fija |
| Esfera | Pistas anteriores conservadas como referencia; el par entra por los muñones | Bandas de rodadura lisas y bisagras interiores |
| Descenso adicional | 25 mm respecto a la última versión | 50 mm respecto a la última versión |
| Centro bajo el borde | 35 mm | 60 mm |
| Punto fuerte | Transmisión positiva y ejes definidos | Conjunto más compacto y esfera sin muñones |
| Trabajo pendiente | Cargas, refuerzos, rodamientos, cableado, perfil dentado y holguras | Precarga, adherencia, encoders, juntas y control de deslizamiento |

A evita depender del contacto de dos piñones fijos sobre pistas esféricas que cambian de plano durante los movimientos combinados. Los motores y piñones permanecen ligados a sus soportes: el de M2 viaja con la cuna.

En B, los rodillos pequeños de la periferia permiten movimiento lateral libre. Las velocidades de las tres ruedas se calculan a partir del giro de la esfera. La base fija es parte de esta alternativa; la tercera rueda aporta el tercer grado de libertad. Las zonas polares y el alojamiento Allen se mantienen libres de las bandas de rodadura.

## Archivos

- `Comparacion_mecanismos.mp4` y `.gif`: las dos opciones lado a lado.
- `A_Cardan_dentado.mp4` / `.gif` y `B_Rodillos_omni.mp4` / `.gif`: cada ejemplo por separado.
- Los dos `.blend` individuales conservan los controles de la secuencia y sus cámaras de inspección. `Comparacion_mecanismos.blend` reúne ambos.
- `B_Rodillos_vista_inferior.png` permite ver las tres ruedas a la vez.

Las animaciones duran 13 segundos. Los archivos nativos tienen 312 fotogramas a 24 fps; las previsualizaciones usan 12 poses por segundo. Pulsa Espacio desde el fotograma 1 en Blender. La torre completa también se conserva oculta en cada archivo, dentro de `07_REFERENCIA_MONTAJE`.

Las alturas y aberturas de la torre son referencias ajustables. Las propuestas ilustran arquitectura y movimiento; todavía requieren dimensionamiento mecánico y validación de contacto, cargas y holguras para fabricar.
