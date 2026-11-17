# VFX: singularidad, rayo láser y explosiones (pruebas de concepto)

Efectos generados por código, fuera del juego. Nada de esta carpeta se carga en War ni en Factory ni entra en el paquete de Netlify. Sirve para decidir el aspecto antes de la migración a WebGPU.

| Archivo | Qué hace | Estado |
| --- | --- | --- |
| `singularidad.py` | Agujero negro del arma de final de juego: lente, arcos, spaghettificación y fusión. | Prototipo completo |
| `singularidad_config.json` | Todos los parámetros de la singularidad. | — |
| `rayo.py` | Rayo láser con textura: serpenteo, hebras, turbulencia, chispas, impacto y cicatriz. | Prototipo completo |
| `rayo_config.json` | Todos los parámetros del rayo. | — |
| `explosion.py`, `empaquetar.py` | Explosión por simulación de gas y su atlas de flipbook. | En pausa, a medio ajustar |
| `comun.py` | Lectura de EXR, tono, PNG, hojas de contactos y vídeo. | — |
| `previas/` | Vídeos, hojas de contactos y JSON de las últimas ejecuciones. | — |

Requiere Blender oficial (probado con 5.2.4 LTS) y `ffmpeg` para los MP4. El módulo `bpy` de PyPI y el Blender 4.0.2 de `apt` no sirven para `explosion.py`: su Mantaflow no arranca.

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

## Rayo láser

Un haz que no es una línea uniforme: serpentea, late y lleva textura. Reutiliza el escenario, la cámara y las utilidades de `singularidad.py`.

```bash
blender -b --factory-startup --python arte/blender/vfx/rayo.py -- --salida <carpeta> --calidad final
```

```bash
blender -b --factory-startup --python arte/blender/vfx/rayo.py -- --salida <carpeta> --calidad final --vista cerca
```

Opciones: `--modo simple` (ruta degradada), `--config otro.json`, `--cuadros 26,50` (solo esos cuadros, en una hoja de prueba), `--nombre`.

La demo: una torre carga, dispara al suelo, barre hasta un enemigo y lo destruye, pasa a otro, sube por la fachada de un edificio y corta.

### Cómo está hecho

El haz es una cinta entre el arma y el punto de impacto. Cada píxel calcula `s` (metros desde el arma) y `x` (metros hacia un lado), y el color sale de una fórmula de `s`, `x` y el tiempo. No hay estado: se puede pausar, saltar o evaluar en cualquier orden. En el motor sería un quad orientado a la cámara con ese fragment shader y una textura de ruido que se desplaza.

- **Serpenteo y grosor**: la línea central se aparta con ondas que viajan hacia el blanco, y el ancho late con pulsos y ruido. Pegado al arma, el haz sale recto.
- **Capas**: núcleo casi blanco, vaina naranja con ruido que fluye, halo rojo y jirones que se desprenden del borde.
- **Hebras**: hélices de plasma trenzadas alrededor del núcleo, que se interrumpen a ratos.
- **Nudos**: bultos brillantes que recorren el haz y lo engordan a su paso.
- **Chispas**: partículas sin estado a lo largo del haz, en el impacto (con gravedad) y convergiendo al arma durante la carga.
- **Extremos**: destello con raya de lente en la boca del arma, bola que hierve en el impacto, y cicatriz al rojo que se enfría y deja quemadura.
- **Entorno**: luz roja sobre el escenario según la distancia real al haz, penumbra general mientras dispara, refracción de calor y bloom.
- **Fases**: carga, disparo (el frente avanza a `velocidad_frente`), sostenido y corte (la cola se va del arma y queda un rescoldo).

### Parámetros ajustables (`rayo_config.json`)

| Sección | Qué controla |
| --- | --- |
| `haz` | Radios y colores del núcleo, la vaina y el halo; brillo general. |
| `onda` | Serpenteo y pulsos de grosor: amplitud, longitud de onda y velocidad de cada onda, más su parte irregular. |
| `filamentos` | Cantidad de hebras, radio, ancho, paso, giro, interrupciones y color. |
| `turbulencia` | Escala, velocidad y contraste del ruido; fuerza y alcance de los jirones. |
| `nudos` | Separación, velocidad, largo, engrosamiento y brillo. |
| `chispas` | Cantidad, vida, velocidad, frenado, gravedad y color de las del haz, el impacto y la carga. |
| `origen`, `impacto` | Destellos de los extremos; `impacto.cicatriz` para la marca que deja. |
| `luz` | Luz sobre el escenario, penumbra y neblina. |
| `calor` | Refracción del fondo. |
| `fases` | Duración de la carga, velocidad del frente, exceso de potencia al arrancar, respiración y rescoldo. |
| `demo` | Guion y cámaras de la vista previa; el juego no lo usa. |

Para un haz más liso, baja `onda.serpenteo`, `onda.grosor_irregular` y `turbulencia.contraste`. Para uno más salvaje, súbelos junto con `turbulencia.jirones` y `filamentos.cantidad`.

### Eventos

El JSON de salida lista `carga`, `disparo`, `impacto` (con la superficie), `objetivo_destruido`, `corte` y `apagado` con su instante.

### Límites conocidos

- El efecto recibe el punto de impacto; no lo busca. En la demo lo decide el guion (la mira, o el primer enemigo que se cruce).
- La destrucción del enemigo es solo un fogonazo: la explosión es otro efecto.
- La cinta mira a la cámara. Vista casi de punta (el haz hacia la cámara) no está resuelta.
- La penumbra oscurece todo el escenario para que el haz destaque a plena luz. Es una decisión de aspecto y se quita con `luz.penumbra: 0`.
- La cicatriz no se aplasta con la perspectiva del suelo, y las chispas no rebotan.
- No hay medida en GPU. Los tiempos del JSON son de numpy en CPU.

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
