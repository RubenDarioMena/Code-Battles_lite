# Tarea 01 · Esfera de observación según las imágenes generadas, montaje en la torre y dos mecanismos

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Crea
`arte/blender/torreta_observacion/esfera/torreta_esfera.py`, un generador de Blender 5.2 que se ejecute
sin ventana: `blender -b --factory-startup --python torreta_esfera.py -- --salida <carpeta> [opciones]`.
No toques nada fuera de `arte/blender/torreta_observacion/esfera/`. No ejecutes Blender: tu sandbox no
puede y el orquestador renderiza. Verifica en Python puro todo lo que puedas: geometría de dientes,
relaciones de transmisión, holguras y ángulos. Todo es procedural, sin archivos externos ni descargas.

Mira las imágenes de `esfera/referencias/`:
- **04 y 05 (las generadas, con un trazo rojo del usuario) son la referencia de la esfera y de sus
  dientes. Síguelas.**
- 02 y 03 son el diseño anterior dentro de la torre: dan la proporción de la torre y las dos poses.
- 01 es un render de juego del diseño anterior, solo como contexto de color.

## 1. Esfera (según 04 y 05)
- Carcasa de Ø 1000 mm con pared de 12 mm, centro a z = 0,750 m (torre) o z = 0,5 (estudio aislado).
- **Dos bandas dentadas que se cruzan**: un **meridiano** (plano YZ) y el **ecuador** (plano XY), de
  unos 80 mm de ancho. Las bandas están **hundidas**. Los paños de carcasa quedan como gajos
  ligeramente salientes, con una ranura fina a cada lado de la banda; mira cómo los gajos «flotan»
  sobre la banda en la 05. La banda se interrumpe en el polo, alrededor del tornillo.
- **Dientes como en las generadas**:
  - Crestas helicoidales gruesas y redondeadas, inclinadas unos 30–35° respecto al eje de la banda.
  - El hueco entre crestas es del mismo ancho que la cresta y profundo (~14 mm). La cresta queda
    al ras del gajo o un poco por debajo.
  - En el cruce de las dos bandas se ve el dentado de una pasar por encima del de la otra, como en
    la 05: no un parche plano.
  - Paso uniforme y cerrado sobre la circunferencia: elige un número de dientes entero (≈ 80–110)
    coherente con el mecanismo de la sección 3. Construye cada cresta como una malla de perfil
    redondeado barrida por la hélice, no como cajas.
- **Tornillo Allen** en el polo superior: cabeza cilíndrica rebajada en un asiento, borde moleteado
  fino, hexágono hundido profundo (vértices r 37 mm, profundidad 24,5 mm). En el polo opuesto, un
  tapón liso.
- **Compuerta y telescopio (según la 04, «desplegada»)**:
  - Dos hojas de carcasa con bisagra lateral que se abren hacia fuera como pétalos.
  - Detrás, un telescopio de 4 tramos concéntricos que sale en radial.
  - La boca queda **abierta y hueca, sin cristal**: decisión vigente del proyecto; la lente de la 04
    no se copia. Pon un anillo emisivo verde-azulado tenue en la boca.
  - Posición de la compuerta: centrada en el cuadrante entre las dos bandas, a 45° de cada una y a
    −45° de latitud en reposo, como en el diseño anterior. Así queda oculta en la torre en reposo y
    arriba al invertir la esfera 180°.
- Materiales PBR procedurales:
  - Carcasa de acero satinado cepillado (metálico 1, rugosidad ~0,3, anisotropía siguiendo los gajos).
  - Bandas y dientes en acero algo más oscuro y pulido en las crestas.
  - Fondo del hexágono oscuro, y suciedad sutil en las ranuras.

## 2. Torre
Torre cilíndrica de r 0,69 m desde z = 0,055 hasta el labio en z = 0,742–0,760, como la 02/03. Lleva
una boca interior que deja ver media esfera, holgura de 8–12 mm entre esfera y labio, y un bisel
suave en el labio. Por fuera, gris azulado claro mate con una franja de junta oscura abajo. Por
dentro, cavidad para el mecanismo.
`--corte` muestra la torre seccionada (media torre quitada, con la cara del corte en otro color),
para ver el mecanismo.

## 3. Mecanismos (mínimo dos propuestas, plausiblemente realistas)
La esfera tiene que poder:
- **invertirse 180°** (reposo, con el tornillo arriba y la compuerta oculta → uso, con la compuerta
  arriba);
- **girar en azimut** sin límite;
- **inclinarse** para mirar, ±35° alrededor de la pose de uso.

Diseña al menos dos propuestas distintas. Cada una lleva motores, transmisión, apoyos y
rodamientos visibles en `--corte`, con sus relaciones calculadas y comprobadas.
- **Propuesta S (tornillo sinfín).** El usuario quiere aprovechar los dientes helicoidales con un
  **tornillo sinfín**. Una banda dentada helicoidal es, de hecho, una corona de sinfín, así que es
  una idea con sentido. Evalúa la viabilidad y, si la ves viable, diséñala.
  - Una pista posible: un *slewing drive* (rodamiento de giro con sinfín, un producto comercial
    real) para el azimut de la base interior. Sobre esa base, un sinfín que engrana con la banda
    meridiana para la inversión y la inclinación, con la esfera apoyada en rodillos que ruedan sobre
    las bandas.
  - Considera la autorretención del sinfín (frena la esfera sin energía) y el ángulo de avance
    coherente con la inclinación de los dientes. Cuida que el sinfín siga engranado en todo el
    recorrido y qué hace la banda ecuatorial en tu diseño.
  - **Si no lo ves viable**, dilo con el motivo y usa el sinfín solo donde funcione, o diseña otra
    propuesta. No fuerces un sinfín que no engrane.
- **Propuesta C (otro principio).** Por ejemplo un cardán con muñones y coronas, engranajes
  esféricos cruzados (como ABENICS), rodillos, o lo que creas más plausible. Debe ser distinta de
  la S y no copiar la antigua «B, tres ruedas omni».

En el script, el mecanismo es **la causa del movimiento**: cada propuesta anima los ángulos de sus
motores, y la esfera se mueve según las relaciones de transmisión (sin deslizamiento en engranes y
sinfines). Comprueba y reporta en `reporte.json`, para cada propuesta:
- Relaciones (dientes, entradas del sinfín, ángulo de avance y si es autorretenido con μ ≈ 0,1).
- Engrane continuo: la distancia del sinfín o piñón al paso de su banda es constante en toda la
  secuencia, en 200 muestras.
- Holguras mínimas entre piezas móviles y fijas, y con la torre, en toda la secuencia (≥ 3 mm).
- Que el telescopio desplegado no choca con la torre ni con el mecanismo.

## 4. Secuencia y renders
Secuencia de cada propuesta, 24 fps y ~12 s:
1. reposo;
2. inversión de 180° con todo cerrado;
3. apertura de hojas;
4. extensión del telescopio;
5. dos o tres miradas que combinen azimut e inclinación;
6. cierre y vuelta a reposo (opcional si se alarga demasiado).

Opciones de CLI:
- `--mecanismo S|C` (por defecto S).
- `--estudio`: esfera sola sobre fondo claro, cerrada y desplegada lado a lado, para comparar con
  la 04. Escribe `estudio_cerrada.png`, `estudio_desplegada.png` y `estudio_dientes.png` (este
  último un primer plano del cruce de bandas como la 05). A 1600 × 1600.
- `--torre`: `torre_reposo.png` y `torre_uso.png` (vista 3/4 como la 03) a 1600 × 1200.
- `--corte`: `corte_<mecanismo>.png` (vista 3/4 y otra lateral del mecanismo) a 1600 × 1200.
- `--animacion`: PNG en `<salida>/anim_<mecanismo>/####.png` a 1280 × 720, cámara 3/4 fija sobre la
  torre en corte parcial (que se vea la esfera y el mecanismo), y `--cuadros A-B`. El orquestador
  arma el MP4.

Render en EEVEE con luz de estudio suave (área grande y rebote, sombras suaves) y AgX. Organiza la
escena en colecciones: esfera, compuerta y telescopio, torre, mecanismo_<X>, estudio. Usa Empties de
pivote con nombres claros (`esfera`, `hoja_i`, `hoja_d`, `telescopio_1…4`, `base_giro`, motores…).

## Criterios de aceptación (repórtalos)
- Diámetro y centro exactos; holgura con el labio de 8–12 mm.
- Dientes con un número entero sobre la circunferencia, con la misma inclinación y paso en ambas
  bandas.
- Engrane continuo y holguras ≥ 3 mm en ambas propuestas, en toda la secuencia.
- Menos de 400k triángulos por escena.
- `reporte.json`: medidas, relaciones de transmisión, viabilidad del sinfín (con su razonamiento),
  holguras mínimas por propuesta y lista de pivotes.

## Respuesta final
Breve:
- cómo hiciste los dientes;
- qué propuestas diseñaste y cómo se mueve cada una;
- si el sinfín es viable y por qué;
- valores medidos;
- desviaciones, con su motivo.
