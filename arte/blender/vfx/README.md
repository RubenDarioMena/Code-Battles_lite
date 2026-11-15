# VFX: singularidad y artillería (pruebas de concepto)

Efectos generados por código, fuera del juego. Nada de esta carpeta se carga en War ni en Factory ni entra en el paquete de Netlify. Sirve para decidir el aspecto antes de la migración a WebGPU.

| Archivo | Qué hace | Estado |
| --- | --- | --- |
| `singularidad.py` | Agujero negro del arma de final de juego: lente, arcos, spaghettificación y fusión. | Prototipo completo |
| `singularidad_config.json` | Todos los parámetros de la singularidad. | — |
| `explosion.py` | Simulación de gas de cada efecto de artillería: explosión en tierra, aérea, incendio y bocanada de estela. | Recetas en calidad media |
| `empaquetar.py` | Convierte los cuadros en atlas de flipbook con su JSON, hoja de contactos y vista previa. | — |
| `capas.py` | Capas baratas sin estado: destello, luz, onda expansiva, chispas, quemadura y sombra proyectada. | — |
| `artilleria.py`, `artilleria_config.json` | Escena de prueba: cohetes con estela, impactos por poder, estallidos aéreos e incendio. | Prototipo completo |
| `comun.py` | Lectura de EXR y PNG, tono, hojas de contactos y vídeo. | — |
| `generar_artilleria.sh` | Regenera todos los atlas y la escena de prueba (cerca de hora y media por CPU). | Sin ejecutar entero; sus pasos sí, uno a uno |
| `previas/` | Vídeos, hojas de contactos y JSON de las últimas ejecuciones. Las de artillería, en `previas/artilleria/`. | — |

Requiere Blender oficial (probado con 5.2.4 LTS) y `ffmpeg` para los MP4. El módulo `bpy` de PyPI y el Blender 4.0.2 de `apt` no sirven para `explosion.py`: su Mantaflow no arranca. En una sesión en la nube se instala así (unos 400 MB, no queda guardado entre sesiones):

```bash
mkdir -p /opt/blender && cd /opt/blender && curl -fL -o b.tar.xz https://download.blender.org/release/Blender5.2/blender-5.2.4-linux-x64.tar.xz && tar -xf b.tar.xz && ln -sf /opt/blender/blender-5.2.4-linux-x64/blender /usr/local/bin/blender
```

## Singularidad

Un agujero negro diminuto y con carga eléctrica flota repelido por el piso. Todo lo que se ve sale de la **masa** (agujeros fusionados más enemigos comidos) y de unos pocos eventos. No hay disco de acreción estable: el disco son las líneas de los enemigos absorbidos.

```bash
blender -b --factory-startup --python arte/blender/vfx/singularidad.py -- --salida <carpeta> --demo fusion --calidad final
```

```bash
blender -b --factory-startup --python arte/blender/vfx/singularidad.py -- --salida <carpeta> --demo masa --calidad final
```

Opciones: `--modo simple` (ruta degradada), `--config otro.json`, `--cuadros 60,150` (solo esos cuadros, en una hoja de prueba), `--orbita 30`, `--elevacion`, `--yaw`, `--distancia`.

- **`--demo fusion`**: un agujero come enemigos; llega un segundo agujero, se repelen, orbitan cada vez más rápido mientras derivan hacia el fondo, y se fusionan.
- **`--demo masa`**: un solo agujero cuya masa sube de 1 a la crítica. Enseña la apariencia según la masa.

### Qué es Blender y qué es el pase de pantalla

Blender solo renderiza el escenario de prueba: color y profundidad. Todo el efecto es un pase de numpy que hace lo que hará el motor:

- **Lente**: una pasada sobre el color y la profundidad de la escena. Suma las lentes puntuales de hasta `max_lentes` agujeros (β = θ − θE²/θ) y el pulso de la onda. La profundidad pondera cada lente, así que lo que está delante del agujero no se deforma.
- **Entorno**: la oscuridad es un volumen esférico alrededor del agujero, calculado con la profundidad.
- **Líneas**: cada enemigo absorbido y cada arco es una polilínea. La posición de cada punto es una fórmula del tiempo y de una semilla, sin estado ni sistema de partículas. En el motor serían cintas de 14–24 tramos evaluadas en el vertex shader.
- **Brillo de Hawking y destellos**: un sprite por agujero.

### Parámetros ajustables (`singularidad_config.json`)

| Sección | Qué controla |
| --- | --- |
| `masa` | Masa de un agujero y de un enemigo, umbral de súper arma y masa crítica. |
| `curvas` | Radio del horizonte, radio de Einstein, radio de absorción y letalidad, como `base · masa^exponente`. |
| `hawking` | Brillo y su exponente inverso, tramo en que se apaga, colores pequeño/grande, núcleo, halo y parpadeo. |
| `oscuridad` | Inicio, exponente, máximo y contraste del apagado del entorno; su radio; atenuación del pozo; desaturación. |
| `lente` | Aberración cromática, alcance, peso por profundidad, suavizado, bloom y número máximo de lentes. |
| `flotacion` | Altura, altura por masa, vaivén, frecuencia y temblor. |
| `arcos` | Cantidad, alcance y brillo según la masa; frecuencia de resorteo; tramos, zigzag, ancho, ramas, colores, luz en el suelo y arcos entre agujeros. |
| `espagueti` | Duración del estiramiento y de la órbita, largo de la línea, despegue del suelo, vueltas, inclinación, forma de la espiral, ancho, brillo, tramos y color final. |
| `aparicion` | Destello al crearse un agujero. |
| `fusion` | Velocidad de disparo, distancias, duración de repulsión y órbita, vueltas, exponentes del inspiral, inclinación, deriva y su dirección, retroceso y su asimetría, destello, onda y ringdown. |
| `eventos` | Ganchos que emite y los reservados. |
| `demo` | Guion de las dos vistas previas; el juego no lo usa. |

Las claves `_` del JSON explican cada sección.

### Eventos

El JSON de salida lista los eventos con su instante: `agujero_creado`, `enemigo_absorbido`, `repulsion`, `orbita`, `fusion` (con masa, asimetría y retroceso), `ringdown_fin`, `super_arma` y `masa_critica`. `carga_perdida` está reservado y nadie lo emite: el efecto no depende del estado de carga.

`Guion.pos(agujero, t)` es una función pura del tiempo. El juego puede llamar a la misma fórmula para saber dónde está cada agujero durante la fusión.

### Límites conocidos

- La lente es de espacio de pantalla: no puede traer lo que está fuera de cámara ni lo que está tapado. En los bordes refleja la imagen, y donde la fuente sería un objeto de delante deja el píxel sin deformar.
- Las trayectorias de la fusión son coreografía con forma de inspiral, no una simulación.
- El enemigo desaparece al ser absorbido y lo sustituye una mancha de luz que se estira. El estirado de la malla del enemigo no está prototipado.
- Los arcos caen sobre el plano del suelo; no buscan edificios ni unidades.
- No hay medida en GPU. Los tiempos del JSON son de numpy en CPU y solo sirven para comparar ejecuciones.

## Artillería

Referencia visual: el tráiler de *Defilade* (estelas de humo a bocanadas, bola de fuego que se vuelve hongo oscuro, nubes redondas en el aire, sombras del humo sobre el suelo).

### Las tres piezas

1. **Flipbooks simulados** (`explosion.py` → `empaquetar.py`). Fuego y humo salen de una simulación de gas (Mantaflow) renderizada con Cycles desde la inclinación de la cámara del juego. Cada efecto es un atlas PNG con alfa premultiplicado y un JSON.
2. **Capas baratas** (`capas.py`). Lo que no merece simulación: destello, luz en el suelo, chispas, quemadura, onda expansiva y sombra. Son fórmulas del tiempo desde el estallido y de una semilla, sin estado. El JSON de cada atlas dice cuáles lleva.
3. **Escena** (`artilleria.py`). Junta todo como lo hará el motor, con cohetes y estelas.

### Variantes y poder

```bash
blender -b --factory-startup --python arte/blender/vfx/explosion.py -- --variante tierra --poder 2 --semilla 1 --salida <carpeta> --calidad media
```

```bash
blender -b --factory-startup --python arte/blender/vfx/empaquetar.py -- --entrada <carpeta> --destino <atlas> --nombre tierra_p2 --previa
```

| Variante | Qué es |
| --- | --- |
| `tierra` | Proyectil explosivo en el suelo: destello, bola de fuego compacta, hongo oscuro y falda de polvo. |
| `aerea` | Estallido en el aire (misil contra dron): bola clara, nube redonda que se queda colgada. Sin suelo. |
| `incendio` | Llama y columna de humo en bucle de 32 cuadros, para restos ardiendo. |
| `bocanada` | Bocanada de humo blanco de 16 cuadros para las estelas. Se empaquetan cuatro semillas, una por fila. |
| `polvo`, `fuego` | Impacto en tierra blanda y explosión de combustible. Recetas de la tanda anterior: se ejecutaron en poder 2, pero no se ajustaron contra la referencia. |

`--poder` (1–3) cambia el tamaño en el juego, el ritmo y las capas:

| Poder | Cuadro en el juego | Duración | Onda expansiva |
| --- | --- | --- | --- |
| 1 · misil ligero | 5 m (aérea 4,4 m) | 2,7 s | No tiene |
| 2 · artillería media | 8 m | 3,2 s | Leve: aro de 4,2 m en 0,34 s (aérea 3 m) |
| 3 · pesada | 12,8 m (aérea 12 m) | 4 s | Fuerte: aro de 9,5 m en 0,55 s, con refracción y velo de polvo |

La onda vive en `capas` dentro de `PODERES` (`explosion.py`): `onda` es su fuerza (0 = sin onda), `radio_onda` y `duracion_onda` su alcance y su tiempo. Viaja hasta el JSON del atlas, así que el motor no necesita otra tabla.

### Qué entrega cada atlas

- `<nombre>.png`: 8 × 8 cuadros (la bocanada, 16 × 4). RGB en sRGB con alfa premultiplicado; se mezcla con `ONE, ONE_MINUS_SRC_ALPHA`. El motor interpola entre cuadros vecinos.
- `<nombre>.json`: rejilla, `fps`, `encuadre_m` (metros del juego que cubre el cuadro), `ancla` (dónde cae el punto del estallido), `bucle` y `capas`.
- `<nombre>_hoja.jpg` y, con `--previa`, `<nombre>.mp4` con las capas puestas.

### Escena de prueba

```bash
blender -b --factory-startup --python arte/blender/vfx/artilleria.py -- --atlas <atlas> --salida <carpeta>
```

Opciones: `--config otro.json`, `--cuadros 2.2,4.9` (solo esos instantes, en una hoja), `--sin-rotulos`.

Todo lo ajustable está en `artilleria_config.json`: cámara, cohete, las dos estelas (`ligera` y `pesada`), fogonazo, lanzadores, blancos y el guion de disparos.

- **Estela.** Es una fila de bocanadas sin estado. La bocanada *i* nace en `t0 + i·paso/velocidad`, en el punto de la trayectoria de ese instante. Su tamaño, opacidad, deriva y cuadro del atlas dependen solo de su edad. `tinte` multiplica el atlas blanco: la estela clara y la oscura usan la misma textura.
- **Sombra.** No hay textura de sombra: es el mismo cuadro del flipbook, aplastado y sesgado sobre el suelo según el sol (`sombra_proyectada`). Vale también para los estallidos aéreos, que la proyectan lejos.
- **Onda expansiva.** Un aro sobre el suelo (un círculo de pantalla si el estallido es aéreo) que brilla, desplaza la imagen que pisa y, si es fuerte, levanta polvo.
- **Quemadura.** Un decal que aparece con el estallido y se queda.

Los atlas PNG no están en el repositorio (38 MB en total; `tierra_p3` pesa 9,5 MB). En `previas/artilleria/` quedan el vídeo y la hoja de la escena, y de cada atlas su JSON, su hoja de contactos y su vista previa.

### Límites conocidos

- **El incendio es la pieza menos lograda**: la llama sale como una bola en la base en vez de lenguas de fuego.
- La luz va horneada: el sol de los flipbooks viene siempre de la izquierda y por delante. Girar o voltear un sprite la contradice.
- Los flipbooks se renderizan a 53° de elevación. Con la cámara del juego muy inclinada o cenital se notará que son planos.
- La escena es composición 2D en numpy sobre un suelo liso. No hay edificios, ni oclusión entre sprites y objetos más allá de pintar de lejos a cerca.
- La trayectoria del cohete es una coreografía de la vista previa. El juego usará la suya.
- Sin GPU: todo se renderizó por CPU y no hay medida de rendimiento en WebGL ni WebGPU. Los atlas van a 256 px por cuadro (384 px en `tierra` poder 3); la calidad `final` no se ha ejecutado.
- En calidad media queda algo de grano en el humo que se deshace.
