# Esfera de observación con dientes helicoidales · generador procedural

Rediseño de la esfera de la torreta según las imágenes generadas (`referencias/04` y `05`), montada en la torre, con dos mecanismos de movimiento. **Elegido: S, sinfín con relevo.** C (cardán) queda como alternativa documentada.

## Comandos

Blender 5.2 sin ventana, desde esta carpeta:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python torreta_esfera.py -- --salida previas/NN --mecanismo S --estudio --torre --corte
```

| Opción | Salida |
| --- | --- |
| `--estudio` | esfera sola: `estudio_cerrada`, `_desplegada`, `_dientes`, `_comparativa` (1600×1600) |
| `--torre` | `torre_reposo`, `torre_uso` (1600×1200) |
| `--corte` | `corte_<X>`, `_lateral`, `_detalle`: torre y media carcasa cortadas |
| `--animacion` | `anim_<X>/####.png`: torre y media carcasa cortadas (1280×720, 288 cuadros a 24 fps) |
| `--animacion-exterior` | `anim_<X>_exterior/`: torre entera |
| `--animacion-menu` | `anim_<X>_menu/`: torre cortada con la esfera entera (menú de máquinas de Campaign) |
| `--animacion-bucle` | `anim_<X>_bucle/`: bucle de presentación de 15 s (apagada → activa mirando en tres direcciones → guardada). Torre entera, esfera 10 cm más baja para ocultar la banda en reposo y mecanismo sin dibujar; cierra mientras gira hacia 360°, con holguras comprobadas |
| `--cuadros A-B` | intervalo de cuadros (por defecto 1-288) |

Siempre escribe `reporte.json` con medidas, relaciones de transmisión y holguras.

## Esfera

- Ø 1000 mm, pared de 12 mm, centro a z 0,75 en la torre.
- Dos bandas hundidas de 130 mm (meridiano YZ y ecuador XY) con 56 dientes helicoidales por vuelta: paso 56,1 mm, relieve 20 mm, inclinación 32°.
- Cabeza Allen elevada 25 mm (Ø 230, hexágono r 58 mm × 46 mm) y tapón en el polo opuesto.
- Compuerta de dos hojas que se abren como pétalos y telescopio de 4 tramos, con la boca abierta sin cristal.

## Mecanismo S (elegido)

- **Inversión e inclinación:** dos sinfines Ø 110 × 242 mm (paso axial 56,1 mm, avance 10,98°, unos 3,8 dientes abrazados) engranan con la banda meridiana a 90° uno del otro. Un solo motor los mueve a través de un eje con juntas cardán. Al invertir 180°, uno de los dos cruza el polo, donde la banda se corta, mientras el otro sigue engranado: en los 288 cuadros siempre hay al menos uno.
- **Apoyo:** cuatro rodillos acanalados Ø 120 ruedan junto a la banda ecuatorial. En las inclinaciones, la carga pasa a transferencias de bola sobre los gajos.
- **Azimut:** *slewing drive* (corona y sinfín) bajo la base giratoria.
- **Límite:** con un avance de 10,98° el sinfín **no** se autorretiene (μ 0,1). Un mecanismo real llevaría freno en el motor.
- Holgura mínima con la carcasa: 3,95 mm en toda la secuencia.

## Carpetas

- `torreta_esfera.py` (escena, render, CLI), `geometria_esfera.py` (carcasa, bandas, dientes, polos, compuerta), `transmision_esfera.py` (torre, mecanismos, secuencia) y `control_esfera.py`.
- `referencias/`: imágenes de partida (las generadas tienen un trazo rojo del autor).
- `prompts/`: tareas de Astra, ronda por ronda.
- `previas/`: renders por ronda. Solo se versionan JPG, MP4 y reportes.

## GLB de juego

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python arte/blender/torreta_observacion/esfera/exportar_torreta.py -- "Prototypes/Rocket Launcher/modelos/torreta_observacion.glb"
```

- Tres raíces, `L0_/L1_/L2_TorretaObservacion`, con 51,4k / 15,7k / 4,5k triángulos y 1,9 MB. Es la convención de `t1.glb` y del vehículo tubular: una malla rígida por pivote, materiales planos y sin animaciones.
- Solo el exterior, como el bucle: la esfera 10 cm más baja y sin el mecanismo.
- Pivotes: `base_giro`, `munon`, `hoja_i`, `hoja_d` y `telescopio_1…4`. Cada uno lleva en `rig` reglas `MANDO` en ejes de glTF y en su marco local: `q = q_reposo · eje_ángulo(eje, factor·mando)` y `p = p_reposo + q_reposo · eje · factor·mando`.
- La raíz lleva `controles` (`azimut`, `inclinacion`, `hojas`, `extension`) y `bucle`, las claves del bucle de presentación a 24 fps, para reproducirlo en el menú sin clip.
- Comprobado en three.js r180: aplicar las reglas reproduce la pose del modelo de Blender con un error de 6·10⁻⁸ m en los tres niveles.
