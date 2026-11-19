# Vehículo tubular (sustituto del carro lanzamisiles)

Buggy de dunas sin cabina: el **aro central** une cuatro esquinas de suspensión de recorrido largo,
el motor cuelga debajo y la ametralladora va sobre una corona de giro. Todo sale de código: nada se
modela a mano. Lo escribió Astra (Codex) por tareas (`prompts/01…08`); Claude renderizó, revisó y
corrigió.

| Archivo | Qué hace |
| --- | --- |
| `tubular.py` | Construye el vehículo, su rig por drivers y los materiales PBR; renderiza vistas, poses, primeros planos, turntable, demo de suspensión y la animación de acción. |
| `exportar_tubular.py` | Exporta el GLB de juego con tres LOD a `Prototypes/Rocket Launcher/modelos/vehiculo_tubular.glb`. |
| `prompts/` | Encargos de cada fase, con sus criterios de aceptación. |
| `referencias/` | Referencia de postura y suspensión (buggy de dunas). |
| `previas/` | Selección de renders y vídeos de cada fase. Lo demás se regenera. |

Requiere Blender 5.2 LTS y `ffmpeg` para los MP4.

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python arte/blender/vehiculo-tubular/tubular.py -- --salida <carpeta> --presentacion --turntable
```

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python arte/blender/vehiculo-tubular/tubular.py -- --salida <carpeta> --animacion
```

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python arte/blender/vehiculo-tubular/exportar_tubular.py -- "Prototypes/Rocket Launcher/modelos/vehiculo_tubular.glb"
```

Otras opciones de `tubular.py`: `--detalle`, `--poses`, `--demo-suspension`, `--cuadros A-B` y
`--previa` (960 × 540, menos muestras). El MP4 se arma con ffmpeg desde `<carpeta>/animacion/`.

## Rig

Controles (propiedades personalizadas, sin keyframes en la base): `esquina_XX["recorrido"]`
(−0,18…+0,22 m), `raiz["flotacion_aro"]` (±0,06 m), `raiz["cabeceo"]` y `["balanceo"]` (±4°),
`motor["oscilacion"]` (±0,03 m), `direccion_d/i["direccion"]` (±30°) y `rueda_XX["giro"]`.
Trapecios, coilovers, bypass y puntales del aro siguen a esos mandos con Damped Track y Stretch To.
En la animación, el Empty `vehiculo` mueve el cuerpo y `apoyar()` calcula el recorrido de cada
esquina para que las ruedas pisen `terreno(x, y)`.

## GLB de juego

Misma convención que `modelos/t1.glb`: raíces `L0_/L1_/L2_VehiculoTubular`, una malla rígida por
pivote, sin esqueleto ni animaciones; materiales planos con el color de la paleta. Cada pivote que
sigue a otro lleva en sus extras `rig` (JSON) sus restricciones y drivers, y la raíz lleva
`controles` con los rangos: basta un solucionador pequeño para reproducir la suspensión.
