# Tarea 02 · Correcciones de la escena + vidrio final + corte láser de la O + caída y encaje

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. La tarea 01 (`codemageddon.py` y
`README.md` en `arte/blender/codemageddon/`) está en el árbol sin commit: no la deshagas, amplíala.
Toca solo esos dos archivos. No toques `prompts/`, `referencias/`, `previas/` ni nada fuera de la
carpeta. No hagas commits.

No puedes abrir Blender (tu sandbox bloquea Metal). El orquestador ejecuta el script y mira las
imágenes. Verifica en Python puro (o con `/Applications/Blender.app/Contents/Resources/5.3/python/bin/python3.13`
para numpy) todo lo que puedas: trayectorias, tiempos, encuadres cuadro a cuadro.

**Ya corregido por el orquestador, no lo deshagas:** en Blender 5.3 el enchufe del Principled se
llama `Anisotropic` (no `Anisotropic IOR Level`) y la dirección del cepillado va con un nodo
`ShaderNodeTangent` (radial, eje X) enlazado a `Tangent`. Lista real de enchufes del Principled en
5.3: Base Color, Metallic, Roughness, IOR, Alpha, Thin Wall, Normal, Weight, Diffuse Roughness,
Subsurface Weight/Radius/Scale/IOR/Anisotropy, Specular IOR Level, Specular Tint, Anisotropic,
Anisotropic Rotation, Tangent, Transmission Weight, Coat Weight/Roughness/IOR/Tint/Normal,
Sheen Weight/Roughness/Tint, Emission Color, Emission Strength, Thin Film Thickness/IOR.
Usa solo esos nombres.

## Lo que vio el orquestador en la previa de la tarea 01 (960×540, `--planos`)

Bien y se mantiene: medidas de las letras (Arial Black, 3.0 cm, separación 4 mm, palabra 39.2 cm),
huecos enrasados, plantilla del bloque superior con MAGEDD_N calada, mordazas con estrías, láser en
su riel, bokeh de fondo, pieza N colgando bajo el bloque superior.

Mal, corrígelo:
1. **Metal quemado a blanco.** En B, C y D el bloque superior y la placa salen casi blancos y planos;
   en B la cara superior es un blanco liso. Debe parecerse a `grabado-2027-taladro.png`: acero
   oscuro-medio con **reflejos alargados** del cepillado, negros profundos y luces rasantes. Baja las
   potencias de `LUCES` (hasta un 40–60 % de las actuales), baja el color base del acero a un gris
   0.30–0.40 lineal con metálico 1, y que el softbox que se refleja en las caras grandes sea una
   franja, no toda la cara. Objetivo medible que calcularás donde puedas y que el orquestador
   comprobará en la imagen: **menos del 3 % de los píxeles de cada plano a blanco puro**, salvo los
   emisivos (láser, chispas, bordes del vidrio).
2. **El vidrio parece rosa pastel opaco.** Ver más abajo.
3. **Plano E demasiado rasante**: la palabra ocupa el 81 % del ancho pero solo el 4.5 % del alto y
   las letras no se leen. Sube la cámara a **40–50° hacia abajo**, palabra al **75–90 % del ancho**
   y la altura de las letras ≥ 6 % del alto de imagen.
4. **Planos A y C demasiado rasantes**: la boca del hueco no se ve. Sube el centro óptico a
   **2.5–4 cm sobre z = 0** con **6–12° hacia abajo**, para que la cara superior de la placa y la
   boca del hueco se lean como una franja (≥ 8 % del alto de imagen entre el borde delantero de la
   placa y la línea del fondo). La pieza que cae debe estar **entera en el cuadro en todos los cuadros
   de su caída** (márgenes ≥ 3 %). Quita los sensores «virtuales» de 96 y 139 mm: sensor de 36 mm y
   ajusta la focal (50–100 mm) y la distancia.
5. **Bokeh**: hoy son círculos grandes y saturados tipo luces de Navidad. Menos (6–10), más pequeños,
   más tenues, en azul verdoso y algún cálido, más un resplandor suave azul verdoso grande al fondo,
   como en `hoja-1.jpg`.

## Vidrio final de MAGEDDON
Referencia: las piezas del vídeo (`hoja-1..3.jpg`) parecen acrílico/vidrio iluminado por dentro, con
**líneas muy brillantes en las aristas** (contorno superior y aristas verticales) y cuerpo más oscuro.
- Color base **#E380AE**. Translúcido semiopaco: transmisión 0.5–0.75, rugosidad 0.2–0.3, algo de
  subsuperficie o volumen con absorción rosa-roja para que tenga cuerpo y no sea transparente.
- **Gradiente en la cara superior**: con el campo de distancia que ya tienes, brillo máximo en los
  0.6–1.0 mm junto al borde (emisión fuerte, casi blanco-rosado), cayendo hasta un centro con un
  **35–50 %** del brillo del borde. Que el centro siga siendo claramente rojo-rosa, no gris.
- **Laterales**: banda emisiva de 1.5–3 mm junto a la arista superior e inferior de la pieza (como las
  franjas brillantes arriba y abajo de la columna del vídeo), y aristas verticales con más brillo
  (Layer Weight / Fresnel). Cuerpo lateral más oscuro y translúcido.
- Las piezas encajadas solo muestran la cara superior: el gradiente debe leerse ahí a 960×540.
- Valores en un diccionario `VIDRIO` editable.

## Animación (24 fps, cuadros 1–192, tabla `GUION` editable)
Todo con keyframes o drivers sobre objetos que se crean una vez. Semillas fijas.

### Caída de la N · cuadros 1–30 (plano A)
- Cuadro 1: la N colgando justo debajo del bloque superior (cara superior de la pieza a z = 0.085).
- Cae **sin girar ni moverse en XY** (alineada con su hueco al 0.0 mm). Acelera (ease-in) hasta
  entrar por la boca hacia el cuadro 15–17, luego **se frena como un pistón con colchón de aire** y
  se hunde despacio hasta quedar **enrasada** (cara superior en z = 0 ± 0.01 mm) en el cuadro 26,
  con un asentamiento mínimo (0.2–0.4 mm por debajo y vuelta) hasta el 30. Nunca baja de −0.05
  la cara inferior.
- **Línea de la boca** (como en el vídeo): un contorno emisivo fino (0.5–0.8 mm, siguiendo el
  contorno de la letra, a +0.1 mm sobre la placa) que se enciende cuando la base de la pieza llega a
  la boca, brilla mientras entra y **se apaga en ~10 cuadros** tras enrasar. Color: el borde del vidrio,
  más blanco.

### Corte láser de la O · cuadros 31–78 (plano B)
- El carro del láser se mueve en X por el riel y el cabezal en Y, de modo que la punta de la
  boquilla **recorre el contorno exterior de la O** (cuadros 33–55, velocidad constante a lo largo
  del contorno), salta al interior (56–58, láser apagado) y **recorre el contorno interior** (59–70).
  Luego se aparta a un lado (71–78).
- **Haz**: cilindro emisivo muy fino (núcleo 0.3–0.5 mm blanco, halo 1.5 mm rosa-rojo #E380AE más
  saturado) de la boquilla a la cara superior, solo cuando corta.
- **Punto de corte**: destello pequeño muy brillante y **chispas** (líneas emisivas cortas, 10–25 vivas,
  balísticas con gravedad, de blanco-amarillo a naranja, vida 6–12 cuadros), saliendo hacia arriba y
  atrás del avance. Objetos creados una vez y reutilizados por visibilidad/keyframes.
- **Sangría incandescente**: una tira fina sobre el contorno recorrido (cara superior del bloque
  superior, 0.3–0.5 mm de ancho) que se enciende al pasar el haz (blanco-amarillo), pasa a naranja y
  rojo y se oscurece en ~15 cuadros. Hazlo con un parámetro de longitud de arco por vértice y un valor
  animado `progreso` (propiedad en el Empty `laser`) leído por el material.
- **Transformación de metal a vidrio** (cuadros 64–78): la O pasa del acero del bloque al vidrio rojo
  **desde el borde hacia el centro** usando el campo de distancia (un frente que avanza, con un brillo
  en el frente). En el cuadro 78 la O es vidrio rojo completo, igual que las demás.

### Caída de la O · cuadros 79–114 (plano C)
Igual que la N, con sus tiempos: cae desde su sitio en el bloque superior (cara superior a z = 0.135,
es decir, sale por abajo del bloque; mientras está dentro del bloque no se ve desde C, no pasa nada),
entra por la boca hacia el 96, enrasa en el 106, asienta hasta el 110, línea de boca apagada en el 114.

### Resto (no animes todavía, lo hace la tarea 04)
Cuadros 115–192 quedan con todo en su estado final (N y O enrasadas, láser apartado).

## CLI nueva (mantén la existente)
- `--cuadros a-b`: renderiza ese intervalo a `<salida>/fotogramas/NNNN.jpg` con la cámara de cada
  plano (marcadores).
- `--mp4`: renderiza el intervalo (o 1–192) **directo a un MP4 H.264** con la salida FFMPEG de
  Blender en `<salida>/codemageddon.mp4` (sin fotogramas sueltos; el disco está casi lleno).
- `--previa` sigue: 960×540, muestras bajas.
- `--guardar` sigue igual (save_version = 0).

## Comprobaciones (en `escena.json` → `animacion` y en tu respuesta)
- N y O: desplazamiento XY respecto a su hueco = 0 en todos los cuadros; z monótona (salvo el
  asentamiento) y enrasada ± 0.01 mm en 26–30 (N) y 106–114 (O).
- Encuadre: la pieza que cae entera en el cuadro (márgenes ≥ 3 %) en **todos** los cuadros 1–30 en A
  y 79–114 en C; la O y la punta del láser dentro del cuadro en 31–78 en B.
- Recorrido del láser: error de la punta respecto al contorno < 0.1 mm; longitud de los contornos
  y velocidad (mm/cuadro).
- Lista de eventos con su cuadro: inicio y fin de cada contorno, transformación, entradas por la boca,
  enrasados, apagado de las líneas de boca.
- Triángulos totales < 400 k.

## Respuesta final
Breve y clara: qué cambiaste en luces y cámaras (cifras nuevas), cómo hiciste el vidrio, el haz, las
chispas, la sangría y la transformación, los eventos, los comandos exactos para la previa
(sugiere una lista de `--cuadro` clave) y las **desviaciones con motivo**.
