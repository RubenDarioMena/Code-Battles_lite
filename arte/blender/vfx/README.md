# VFX: singularidad y explosiones (pruebas de concepto)

Efectos generados por código, fuera del juego. Nada de esta carpeta se carga en War ni en Factory ni entra en el paquete de Netlify. Sirve para decidir el aspecto antes de la migración a WebGPU.

| Archivo | Qué hace | Estado |
| --- | --- | --- |
| `singularidad.py` | Agujero negro del arma de final de juego: lente, arcos, spaghettificación y fusión. | Prototipo completo |
| `singularidad_config.json` | Todos los parámetros de la singularidad. | — |
| `explosion.py`, `empaquetar.py` | Explosión por simulación de gas y su atlas de flipbook. | En pausa, a medio ajustar |
| `comun.py` | Lectura de EXR, tono, PNG, hojas de contactos y vídeo. | — |
| `previas/` | Vídeos, hojas de contactos y JSON de las últimas ejecuciones. | — |

Requiere Blender oficial (probado con 5.2.4 LTS) y `ffmpeg` para los MP4. El módulo `bpy` de PyPI y el Blender 4.0.2 de `apt` no sirven para `explosion.py`: su Mantaflow no arranca.

## Singularidad

Un agujero negro diminuto y con carga eléctrica flota repelido por el piso. Todo lo que se ve sale de la **masa** (agujeros fusionados más enemigos comidos) y de unos pocos eventos. No hay disco de acreción estable: el disco son las líneas de los enemigos absorbidos.

La protagonista es la deformación del espacio. El disco es azul casi negro con un resplandor morado pegado al borde por dentro; las líneas de los enemigos son finas y forman anillos concéntricos en un mismo plano (color del enemigo lejos, blancas al caer, moradas al rozar el horizonte); los rayos al piso son uno o dos, delgados. Justo antes de la derrota el disco mide 1,4 casillas de radio.

```bash
blender -b --factory-startup --python arte/blender/vfx/singularidad.py -- --salida <carpeta> --demo fusion --calidad final
```

```bash
blender -b --factory-startup --python arte/blender/vfx/singularidad.py -- --salida <carpeta> --demo masa --calidad final
```

Opciones: `--modo simple` (ruta degradada), `--config otro.json`, `--cuadros 60,150` (solo esos cuadros, en una hoja de prueba), `--orbita 30`, `--elevacion`, `--yaw`, `--distancia`.

- **`--calidad`**: `borrador` (512 × 288), `final` (768 × 432) o `alta` (1280 × 720). Las líneas finas solo se juzgan bien en `alta`: por debajo de un píxel se dibujan más tenues, no más delgadas.
- **`--ajuste seccion.clave=valor`**: cambia un valor del JSON solo en esa ejecución; se puede repetir. Sirve para comparar variantes sin copiar el archivo. Ejemplo, tamaño final al 200 % en vez de al 250 %:

```bash
blender -b --factory-startup --python arte/blender/vfx/singularidad.py -- --salida <carpeta> --demo masa --calidad alta --nombre singularidad_masa_200 --ajuste curvas.radio_horizonte.exponente=1.2
```

- **`--demo fusion`**: un agujero come enemigos; llega un segundo agujero, se repelen, orbitan cada vez más rápido mientras derivan hacia el fondo, y se fusionan.
- **`--demo masa`**: un solo agujero cuya masa sube de 1 a la crítica. Enseña la apariencia según la masa.

### Qué es Blender y qué es el pase de pantalla

Blender solo renderiza el escenario de prueba: color y profundidad. Todo el efecto es un pase de numpy que hace lo que hará el motor:

- **Lente**: una pasada sobre el color y la profundidad de la escena. Suma las lentes puntuales de hasta `max_lentes` agujeros (β = θ − θE²/θ) y el pulso de la onda. La profundidad pondera cada lente, así que lo que está delante del agujero no se deforma.
- **Entorno**: la oscuridad es un volumen esférico alrededor del agujero, calculado con la profundidad.
- **Líneas**: cada enemigo absorbido y cada arco es una polilínea. La posición de cada punto es una fórmula del tiempo y de una semilla, sin estado ni sistema de partículas. En el motor serían cintas evaluadas en el vertex shader: 14 tramos por arco y 48 por anillo. Dentro de una línea los tramos no se suman entre sí, como en una cinta.
- **Horizonte, brillo de Hawking y destellos**: un sprite por agujero. El resplandor morado del borde va dentro del disco y no pasa por el bloom.

### Parámetros ajustables (`singularidad_config.json`)

| Sección | Qué controla |
| --- | --- |
| `masa` | Masa de un agujero y de un enemigo, umbral de súper arma y masa crítica. |
| `curvas` | Radio del horizonte, radio de Einstein, radio de absorción y letalidad, como `base · masa^exponente`. El exponente fija el tamaño final (ver abajo). |
| `hawking` | Brillo y su exponente inverso, tramo en que se apaga, colores pequeño/grande, núcleo, halo y parpadeo. `color_borde` y `borde`: tinte morado de su borde interior. |
| `horizonte` | Color del interior del disco y su resplandor morado: colores, ancho, brillo, lado hacia el que carga y difuminado del filo. |
| `oscuridad` | Inicio, exponente, máximo y contraste del apagado del entorno; su radio; atenuación del pozo; desaturación. |
| `lente` | Aberración cromática, alcance, peso por profundidad (del fondo y, aparte, de las líneas), suavizado, bloom y número máximo de lentes. |
| `flotacion` | Altura, altura por masa, vaivén, frecuencia y temblor. |
| `arcos` | Cantidad, alcance y brillo según la masa; frecuencia de resorteo; tramos, zigzag, ancho, ramas, colores, luz en el suelo y arcos entre agujeros. |
| `espagueti` | Duración del estiramiento y de la órbita, largo de la línea, despegue del suelo, vueltas, inclinación, forma de la espiral, ancho, brillo, tramos, calentamiento y colores (final y al rozar el horizonte). |
| `aparicion` | Destello al crearse un agujero. |
| `fusion` | Velocidad de disparo, distancias, duración de repulsión y órbita, vueltas, exponentes del inspiral, inclinación, deriva y su dirección, retroceso y su asimetría, destello, onda y ringdown. |
| `eventos` | Ganchos que emite y los reservados. |
| `demo` | Guion de las dos vistas previas; el juego no lo usa. |

Las claves `_` del JSON explican cada sección.

**Tamaño antes de la derrota.** A masa 1 el disco mide `curvas.radio_horizonte.base`; a la masa crítica, `base · crítica^exponente`. Con masa crítica 10, cada +0,1 de exponente multiplica el tamaño final por 1,26 sin tocar el inicial:

| Exponente | Radio a la masa crítica | Frente al original |
| --- | --- | --- |
| 0,9 | 0,56 m | 100 % |
| 1,2 | 1,11 m | 200 % |
| 1,3 (actual) | 1,40 m | 250 % |

El radio de Einstein (`curvas.lente`) no se cambió: la zona deformada es la misma y el disco ocupa más parte de ella.

### Eventos

El JSON de salida lista los eventos con su instante: `agujero_creado`, `enemigo_absorbido`, `repulsion`, `orbita`, `fusion` (con masa, asimetría y retroceso), `ringdown_fin`, `super_arma` y `masa_critica`. `carga_perdida` está reservado y nadie lo emite: el efecto no depende del estado de carga.

`Guion.pos(agujero, t)` es una función pura del tiempo. El juego puede llamar a la misma fórmula para saber dónde está cada agujero durante la fusión.

### Límites conocidos

- La lente es de espacio de pantalla: no puede traer lo que está fuera de cámara ni lo que está tapado. En los bordes refleja la imagen, y donde la fuente sería un objeto de delante deja el píxel sin deformar.
- Las trayectorias de la fusión son coreografía con forma de inspiral, no una simulación.
- El enemigo desaparece al ser absorbido y lo sustituye una mancha de luz que se estira. El estirado de la malla del enemigo no está prototipado.
- Los arcos caen sobre el plano del suelo; no buscan edificios ni unidades.
- No hay medida en GPU. Los tiempos del JSON son de numpy en CPU y solo sirven para comparar ejecuciones.

## Explosiones (en pausa)

```bash
blender -b --factory-startup --python arte/blender/vfx/explosion.py -- --variante polvo --semilla 1 --salida <carpeta> --calidad borrador
```

```bash
blender -b --factory-startup --python arte/blender/vfx/empaquetar.py -- --entrada <carpeta> --destino <carpeta> --nombre explosion_polvo --previa
```

- Una receta base y tres variantes (`polvo`, `fuego`, `seca`) con semilla. Tres emisores: nube de gas caliente, ráfaga de partículas para la bola de fuego y chorros balísticos para las púas de escombro, más una oleada a ras de suelo.
- La salida prevista es un atlas de 8 × 8 cuadros con alfa premultiplicado (`ONE, ONE_MINUS_SRC_ALPHA`).
- Solo se probó en calidad `borrador` (hojas en `previas/`). Las calidades `media` y `final`, el atlas y la vista previa de `empaquetar.py` no se han ejecutado.
