# Tarea 01 · Escena CODEMAGEDDON: bloques, letras, máquinas, cámaras y luz

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Es la primera: la carpeta
`arte/blender/codemageddon/` está vacía salvo `prompts/` y `referencias/`. Toca solo:
- `arte/blender/codemageddon/codemageddon.py` (nuevo, el script único de toda la animación);
- `arte/blender/codemageddon/README.md` (nuevo: medidas, CLI y cómo renderizar).

No toques `prompts/`, `referencias/` ni nada fuera de esa carpeta. No hagas commits.

**No puedes abrir Blender**: tu sandbox bloquea la GPU (Metal) y Blender no arranca. El orquestador
ejecuta el script fuera del sandbox con:
`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python codemageddon.py -- --salida <carpeta> [opciones]`
y mira las imágenes. Tú verifica en Python puro todo lo que puedas: medidas, límites de cada objeto,
posiciones, que cada letra cae dentro del encuadre de cada cámara (proyección pinhole a mano con la
focal, el sensor y la resolución), y tiempos. Para numpy puedes usar el Python de Blender, que no
necesita GPU: `/Applications/Blender.app/Contents/Resources/5.3/python/bin/python3.13`. Separa la
geometría pura (contornos, medidas, encuadres) en funciones sin `bpy` para poder probarlas así, o en
un bloque `if __name__ == "__main__"` con `--autoprueba`.

Blender es **5.3** (EEVEE es `BLENDER_EEVEE`; el compositor va en `scene.compositing_node_group`,
un árbol `CompositorNodeTree`; `scene.use_nodes` existe pero está obsoleto). Busca los nodos por
tipo, nunca por nombre.

## Idea (palabras del usuario, resumidas)

Animación de 5–8 s, **plano macro de taller de mecanizado**, con la marca **CODEMAGEDDON**.
- Un **bloque grueso de 5 cm** está **sujeto por una máquina industrial** (mordazas/brazo) **sobre
  otro bloque** que tiene **huecos con forma de letras**.
- Un **láser** recorre rápido el **contorno de cada letra** del bloque de arriba y la corta. La letra
  cortada, aunque es metal, **pasa a rojo claro, como vidrio translúcido semiopaco**, con **bordes
  más brillantes y centro más apagado**. **Cae y encaja en su hueco** del bloque de abajo, **enrasada,
  sin división visible**.
- **Justo al lado**, una **fresa CNC termina de grabar** unas letras en **metal cepillado** con
  **surcos concéntricos**.
- **CODE** va grabada con la fresa (la última grabada es la **O**). **MAGEDDON** son las letras de
  vidrio rojo cortadas con láser (la última cortada también es la **O**). Solo se ven caer **dos**
  piezas: una recién cortada al empezar (la **N**) y la última (la **O**).

Referencias en `arte/blender/codemageddon/referencias/` (te llegan también como imágenes):
- `hoja-1..3.jpg`: fotogramas del vídeo principal. Una pieza alta, translúcida, extruida y con
  **bordes brillantes** baja desde arriba y **se hunde en su hueco** hasta quedar enrasada; plano
  macro muy bajo, **poca profundidad de campo**, **contraluz**, fondo con bokeh frío (azul/verde
  azulado) y una luz cálida lateral. Toma de ahí la luz y la cámara, no el puzle.
- `grabado-2027-taladro.png`: acero cepillado con números fresados en **pasadas concéntricas**
  (terrazas que bajan hacia dentro). Fondo negro, luz rasante.
- `color-numeros-js.png`: color objetivo de la letra. El orquestador lo midió en el «1» rosa:
  **#E380AE (227, 128, 174)**. Úsalo como color base del vidrio (no el `#e8668a` aproximado).

## Esta tarea: la escena estática completa, sin animar todavía

Construye todo con funciones propias, determinista (semillas fijas), desde una escena vacía
(borra el cubo, la luz y la cámara de fábrica). Unidades en metros. Ejes: X a lo largo de la
palabra (izquierda→derecha según la cámara principal), Y hacia el fondo, Z arriba. La cara superior
del bloque inferior está en **z = 0**.

### 1. Letras (todo sale de aquí)
- Fuente: `/System/Library/Fonts/Supplemental/Arial Black.ttf` (gruesa). Si falta, usa
  `Impact.ttf` de la misma carpeta y dilo.
- Palabra **CODEMAGEDDON**, una línea, mayúsculas, **altura de mayúscula 3.0 cm** (mide la O o la
  E ya convertida y ajusta el tamaño de fuente hasta que la altura real sea 3.0 cm ± 0.5 mm).
- **Justificada con separación constante**: cada letra es un objeto propio; colócalas para que el
  hueco entre las cajas de dos letras vecinas sea **siempre 4 mm** (igual entre E y M), y la
  palabra quede centrada en x = 0. Reporta el ancho total (debería rondar 35–45 cm).
- Un único generador de contornos por letra (curva de texto → malla, o sus polígonos) que usen a la
  vez: los huecos, las piezas de vidrio, el hueco del bloque de arriba, la trayectoria del láser
  (tareas siguientes) y el grabado. Expón `contorno_letra(indice)` con los polígonos en XY
  (exterior e interiores) para que el láser y la fresa los recorran después.

### 2. Bloque inferior (base)
- Una placa de **acero cepillado** que contiene toda la palabra: largo = ancho de la palabra + 3 cm
  por lado, fondo (Y) **7 cm**, espesor **6 cm** (de z = −0.06 a 0). Aristas con bisel de 0.5 mm.
- **Huecos MAGEDDON** (las 8 letras): booleana exacta con el contorno de cada letra, **profundidad
  5 cm** (de z = −0.05 a 0), paredes verticales limpias, sin bisel en la boca (encaje perfecto).
- **CODE**: por ahora deja la superficie lisa en esa zona. El grabado concéntrico es la tarea 04;
  solo reserva la función `grabar_code()` vacía y documentada.
- Material: acero cepillado anisótropo (Principled con anisotropía ~0.6–0.8 en dirección X,
  rugosidad 0.25–0.35 con ruido estirado en X para las rayas finas del cepillado; las rayas deben
  verse a 1080p sin parecer madera). Color acero frío claro.

### 3. Piezas de vidrio (MAGEDDON)
- Una pieza por letra: el mismo contorno que su hueco, **reducido 0.05 mm** (offset de la curva o
  inset de la malla) para que no haya caras coincidentes, **5 cm de alto**.
- Estado de partida de la animación (fotograma 1):
  - **M, A, G, E, D, D**: ya encajadas, enrasadas (cara superior en z = 0, abajo en −0.05).
  - **N**: pieza ya cortada, de vidrio, colgando justo debajo del bloque superior (lista para caer).
  - **O**: todavía es **metal** dentro del bloque superior (la cortará el láser).
- Material de vidrio rojo provisional, que la tarea 02 refinará: base #E380AE, translúcido
  semiopaco (transmisión 0.6–0.8, rugosidad 0.15–0.25, algo de subsuperficie o volumen para que no
  sea vidrio transparente perfecto) y **gradiente**: bordes y aristas más claros y brillantes, centro
  de la cara superior más apagado. Haz ya una primera versión del gradiente con un campo de
  distancia al borde: rasteriza el contorno de cada letra en una imagen pequeña (p. ej. 256 px en el
  lado largo) con numpy, calcula la distancia al borde, normalízala y úsala (proyección desde arriba)
  para mezclar color y emisión. Los laterales de la pieza, más brillo hacia las aristas (Layer
  Weight/Fresnel o bisel con emisión).

### 4. Bloque superior (el que se corta)
- Acero (mecanizado, más mate que la base; sin cepillado tan marcado). **Espesor 5.0 cm**. Cubre
  en X las 8 letras de MAGEDDON + 1.2 cm por lado; fondo (Y) 6 cm, centrado en Y con la base.
- Cara inferior a **z = 0.085** (hueco de 8.5 cm sobre la base, para que una pieza de 5 cm se vea
  entera cayendo por él).
- Tiene ya los agujeros pasantes de **M, A, G, E, D, D y N** (letras ya cortadas: se ve la plantilla).
  En el agujero de la **O** está la pieza O de metal (objeto aparte, mismo material que el bloque,
  mismo contorno reducido 0.05 mm), que la tarea 02 convertirá en vidrio. Ojo: el contraforme
  interior de la O (el círculo del centro) en el bloque superior quedaría suelto; resuélvelo así:
  el bloque superior conserva su isla central como objeto aparte unido al bloque (no cae). Dilo
  en el README.
- Una línea de corte (sangría) apenas visible alrededor de las letras ya cortadas en el bloque
  superior: borde oscuro, ligeramente quemado (azul/pajizo), no hace falta geometría extra.

### 5. Máquinas
- **Sujeción**: un brazo/pórtico industrial que viene desde atrás (+Y) y por arriba, con **dos
  mordazas** que aprietan el bloque superior por sus caras de los extremos en X. Mordazas de acero
  oscuro con estrías, tornillos y algún detalle (cilindro hidráulico, placa con tornillos Allen).
  No deben tapar ninguna letra desde las cámaras. Agrupa todo bajo un Empty `sujecion` para poder
  subirlo en la tarea 05 (el bloque superior y la isla de la O son hijos de `sujecion`).
- **Cabezal láser**: sobre el bloque superior, colgado de un carro en un riel (pórtico) paralelo a
  X. Cuerpo de aluminio oscuro, boquilla cónica, un anillo emisivo tenue. Empty `laser` con la punta
  de la boquilla 2 cm por encima de la cara superior del bloque superior. Colócalo para empezar sobre
  la O.
- **Fresadora CNC**: sobre la zona CODE, un cabezal de husillo (spindle) vertical con portaherramientas,
  pinza y una **fresa de punta esférica** de 3 mm de diámetro, colgado de su propio carro. Empty
  `fresa`; en reposo, la punta 1 cm sobre la O de CODE. La fresa no puede chocar con la mordaza
  izquierda: compruébalo con las cajas y repórtalo.
- Detalle suficiente para verse bien en macro con desenfoque, sin pasarse (objetivo: < 400 k
  triángulos en total).

### 6. Fondo y luz (como el vídeo)
- Mundo casi negro con un gradiente frío muy oscuro. Detrás de la placa, a 0.6–1.5 m, unas pocas
  luces pequeñas emisivas (azul verdoso, cálidas) desenfocadas que den bokeh, y un plano de mesa
  oscuro y rugoso que se pierda hacia el fondo.
- **Contraluz** fuerte desde atrás y arriba (+Y, +Z) que recorte los bordes del vidrio y del metal;
  una luz cálida lateral desde la izquierda (como el vídeo) rasante sobre el acero cepillado para
  que brillen las rayas; un relleno frío suave por delante. Usa luces de área. Valores en un
  diccionario `LUCES` editable.
- EEVEE con trazado de rayos activado (refracción del vidrio), sombras suaves. **Bloom**: con el
  compositor (nodo Glare, tipo bloom o fog glow, umbral alto para que solo brillen láser, bordes de
  vidrio y chispas). Si la API del compositor falla, sigue sin bloom y dilo en el reporte.
- Gestión de color: AgX, contraste medio-alto.

### 7. Cámaras (cifras de encuadre obligatorias)
Crea cinco cámaras con nombre y una tabla `PLANOS` (nombre, cuadro inicial y final, cámara) para
24 fps y **192 cuadros (8 s)**, con marcadores de la línea de tiempo enlazados a cada cámara:

| Plano | Cuadros | Cámara | Encuadre exigido |
|---|---|---|---|
| A · caída de la N | 1–30 | `cam_A_macro_N` | Macro muy bajo (centro óptico 1.0–2.0 cm sobre z = 0), delante (−Y) de la N, a 15–25 cm, focal 85–100 mm, apertura f/2–f/2.8 enfocada en el hueco de la N. El hueco de la N en el tercio inferior; la N colgando debajo del bloque superior ocupa **25–45 % del alto de la imagen**; se ve la parte baja del bloque superior arriba del cuadro. |
| B · corte de la O | 31–78 | `cam_B_laser_O` | 3/4 alto, mirando hacia abajo 30–40°, desde delante-derecha. La O del bloque superior ocupa **20–30 % del ancho**; se ven la boquilla del láser y parte del riel arriba. Enfoque en la cara superior de la O. |
| C · caída de la O | 79–114 | `cam_C_macro_O` | Igual de bajo que A, sobre la O: el hueco de la O en el tercio inferior y la O (en su posición colgando, z 0.085–0.135) ocupa **25–45 % del alto**. |
| D · fresa | 115–144 | `cam_D_fresa` | Macro 3/4 sobre la O de CODE, mirando hacia abajo 35–50°, 60–100 mm. La O de CODE ocupa **30–45 % del ancho**; la fresa y la pinza entran por arriba. |
| E · revelado | 145–192 | `cam_E_palabra` | Plano general algo elevado (20–30° hacia abajo), frontal. **CODEMAGEDDON entera ocupa 75–90 % del ancho** (con el bloque superior ya retirado; en esta tarea puedes dejarlo puesto). |

Para cada cámara, calcula en Python puro la caja proyectada de su objetivo (la letra o la palabra)
y escribe en el reporte qué fracción del ancho y del alto ocupa. Si no cumple el rango, mueve la
cámara hasta que cumpla. Desenfoque de lente activado en A, C y D.

### 8. CLI y salida
- `--salida <carpeta>` (obligatoria).
- `--cuadro N` (repetible): renderiza ese cuadro con su cámara a `<salida>/cuadro_NNNN.jpg`.
- `--planos`: renderiza un cuadro centrado de cada plano A–E a `<salida>/plano_<X>.jpg`.
- `--previa`: 960×540, muestras bajas (16–24) y JPG calidad 85. Sin `--previa`: 1920×1080 y
  64 muestras. Ningún render a PNG por defecto (el disco está casi lleno).
- `--guardar`: guarda `<salida>/codemageddon.blend` con `bpy.context.preferences.filepaths.save_version = 0`
  (sin `.blend1`). Sin `--guardar`, no se guarda nada.
- Escribe siempre `<salida>/escena.json`: medidas de las letras (caja y altura de cada una),
  ancho de la palabra, cajas de bloques y máquinas, triángulos totales, encuadres medidos por
  cámara y lista de comprobaciones (OK/FALLO).

## Comprobaciones (en `escena.json` y en tu respuesta)
- Altura de mayúscula 3.0 cm ± 0.5 mm; huecos de 4 mm ± 0.2 mm entre letras.
- Cada pieza de vidrio cabe en su hueco con holgura 0.05 mm por lado y su cara superior a z = 0
  (las encajadas).
- Ninguna máquina se cruza con otra ni con los bloques; ninguna tapa letras en sus planos.
- Encuadres de las cinco cámaras dentro de rango.
- Triángulos < 400 k.

## Respuesta final
Breve y en lenguaje claro: qué construiste, las medidas reales (ancho de la palabra, altura de
mayúscula), los encuadres medidos, cómo hiciste el gradiente, qué comandos exactos debe correr el
orquestador para ver los planos, y las **desviaciones con motivo**.
