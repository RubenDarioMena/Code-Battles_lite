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

## Pendiente para el juego

Exportar el GLB por LOD con la convención de `vehiculo-tubular/exportar_tubular.py` (pivotes rígidos y reglas del rig en extras).
