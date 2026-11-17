# VFX: singularidad y artillería (pruebas de concepto)

Efectos generados por código, fuera del juego. Nada de esta carpeta se carga en War ni en Factory ni entra en el paquete de Netlify. Sirve para decidir el aspecto antes de la migración a WebGPU.

| Archivo | Qué hace | Estado |
| --- | --- | --- |
| `singularidad.py` | Agujero negro del arma de final de juego: lente, arcos, spaghettificación, fusión y el haz que carga el piso. | Prototipo completo |
| `carga.py` | Piso cargado: figura de Lichtenberg, su reparto y su latido. Solo numpy; lo usa `singularidad.py`. | Prototipo completo |
| `singularidad_config.json` | Todos los parámetros de la singularidad y de la carga del piso. | — |
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

## Unificación · 16 de noviembre de 2026

La rama canónica es `vfx-explosiones-singularidad`. Se reúnen la singularidad de `ccr-62599b2d-2y0dow` (`346d4e2`), la artillería de `ccr-293f5765-o1sulj` (`57402d7`) y la previa adicional de `ccr-f2aee30f-2ivzok` (`ec18c69`). Sus commits quedan como antecesores de la rama canónica aunque se retiren esos nombres de rama.

La misma carpeta se sincroniza a `trunk` y `campaign-nivel-1`; esto no integra los efectos en el juego. Las hojas `explosion_*_borrador_hoja.jpg` y `explosiones_fuego_polvo.mp4` se conservan como referencias históricas: no representan las recetas actuales de artillería.

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
- **`--demo carga`**: el haz carga el piso, queda la figura latiendo y aparece un agujero que crece un poco. Las otras dos demos empiezan con el piso ya cargado (`demo.<nombre>.piso_cargado`).

### El haz que carga el piso

Un rayo descarga; lo que deposita carga es un haz de electrones. El arma hace las dos cosas en orden:

1. **Golpe** (0,18 s): un rayo grueso y quebrado cae sobre el punto, con fogonazo.
2. **Haz** (1,7 s): el rayo se endereza en una columna recta de núcleo blanco y borde violeta, el color con que el aire brilla al paso de electrones. Se abre un poco al bajar y lleva filamentos que giran a su alrededor.
3. **Reparto**: la carga se reparte por el piso en ramas, una figura de Lichtenberg. El frente sale del impacto, frena al alejarse y deja un fogonazo que se apaga.
4. **Reposo**: la figura se queda como marca oscura con luz morada. Brilla más bajo cada agujero y late con dos golpes por ciclo, al ritmo del vaivén del agujero. Suben motas de polvo cargado.

La figura se sortea una vez con la semilla y no guarda estado: cada punto sabe cuánto camino hay hasta el impacto, y de ahí salen el frente y el latido. La lente de los agujeros la deforma como al resto del piso. El piso cargado es solo vista: el agujero no lo lee para flotar.

### Qué es Blender y qué es el pase de pantalla

Blender solo renderiza el escenario de prueba: color y profundidad. Todo el efecto es un pase de numpy que hace lo que hará el motor:

- **Lente**: una pasada sobre el color y la profundidad de la escena. Suma las lentes puntuales de hasta `max_lentes` agujeros (β = θ − θE²/θ) y el pulso de la onda. La profundidad pondera cada lente, así que lo que está delante del agujero no se deforma.
- **Entorno**: la oscuridad es un volumen esférico alrededor del agujero, calculado con la profundidad.
- **Líneas**: cada enemigo absorbido y cada arco es una polilínea. La posición de cada punto es una fórmula del tiempo y de una semilla, sin estado ni sistema de partículas. En el motor serían cintas evaluadas en el vertex shader: 14 tramos por arco y 48 por anillo. Dentro de una línea los tramos no se suman entre sí, como en una cinta.
- **Piso cargado**: en el motor, una textura del suelo generada por código (máscara de las ramas, camino hasta el impacto y un desfase por rama) y unas líneas de fragment shader. Aquí se dibuja una vez por cámara.
- **Haz**: tres cintas (núcleo, envoltura y filamentos), como los arcos.
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
| `carga.haz` | Duración del golpe, del haz y de su apagado; origen, zigzag, anchos, cuánto se abre, brillos, colores y filamentos. |
| `carga.destello` | Fogonazo del impacto, cuánto alumbra el encuadre y la luz en el suelo mientras dura el haz. |
| `carga.figura` | Forma de las ramas: radio, troncos, giro, ramificación, reparto del largo y anchos. |
| `carga.reparto` | Tiempo que tarda el frente, brillo y duración de su fogonazo. |
| `carga.reposo` | Brillo bajo el agujero y lejos de él, tamaño del foco, colores, fuerza, frecuencia y retardo del latido, quemadura y cuánto lo apaga el entorno. |
| `carga.motas` | Cantidad, altura, ritmo, tamaño y brillo del polvo que sube. |
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

El JSON de salida lista los eventos con su instante: `haz_impacto`, `piso_cargado` (al terminar el haz), `agujero_creado`, `enemigo_absorbido`, `repulsion`, `orbita`, `fusion` (con masa, asimetría y retroceso), `ringdown_fin`, `super_arma` y `masa_critica`. `carga_perdida` está reservado y nadie lo emite: el efecto no depende del estado de carga.

`Guion.pos(agujero, t)` es una función pura del tiempo. El juego puede llamar a la misma fórmula para saber dónde está cada agujero durante la fusión.

### Límites conocidos

- La lente es de espacio de pantalla: no puede traer lo que está fuera de cámara ni lo que está tapado. En los bordes refleja la imagen, y donde la fuente sería un objeto de delante deja el píxel sin deformar.
- Las trayectorias de la fusión son coreografía con forma de inspiral, no una simulación.
- El enemigo desaparece al ser absorbido y lo sustituye una mancha de luz que se estira. El estirado de la malla del enemigo no está prototipado.
- Los arcos caen sobre el plano del suelo; no buscan edificios ni unidades.
- La figura del piso es plana y no rodea los edificios: pasa por debajo y se ve solo donde hay suelo a la vista. Las unidades la tapan.
- El haz viene de un punto fijo en lo alto (`carga.haz.origen_m`); no hay modelo del arma que lo dispara.
- Sin agujeros, el foco del reposo queda en el punto de impacto.
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
