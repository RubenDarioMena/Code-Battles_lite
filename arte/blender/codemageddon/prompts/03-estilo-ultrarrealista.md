# Tarea 03 · Estilo nuevo y ultrarrealista: materiales, luz, escala y fotograma de muestra

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Toca solo:
- `arte/blender/codemageddon/codemageddon.py`;
- `arte/blender/codemageddon/README.md`.

No toques `prompts/`, `referencias/`, `previas/` ni `muestra_estilo.py` (es del orquestador: léelo,
no lo edites). No toques nada fuera de la carpeta. No hagas commits.

**Estado del árbol.**
- La tarea 01 (escena) está en el árbol, sin commit.
- La tarea 02 (prompt `02-laser-vidrio-caida.md`) **se interrumpió a medias** porque el usuario cambió
  el estilo. `codemageddon.py` tiene parte de ese trabajo: `GUION`, `VIDRIO`, recorrido del láser,
  caídas, sangría y chispas. Compila, pero el orquestador no lo ha renderizado.
- Conserva lo que sirva (la estructura de animación, el recorrido del láser y las caídas) y adáptalo a
  las medidas nuevas.
- El vidrio desaparece: lo sustituye el metal con gradiente descrito abajo.
- No hace falta pulir la animación en esta tarea; la siguiente la termina. Pero el script debe seguir
  funcionando con todas sus opciones.

No puedes abrir Blender (tu sandbox bloquea Metal). El orquestador renderiza y mira.
- Verifica en Python puro todo lo que puedas: medidas, encuadres y luminancias estimadas si puedes.
- Para numpy usa `/Applications/Blender.app/Contents/Resources/5.3/python/bin/python3.13`.

**Ya corregido por el orquestador, no lo deshagas.** En 5.3 el enchufe es `Anisotropic` y la dirección
va con un nodo `ShaderNodeTangent`. Usa solo los enchufes del Principled de 5.3 listados en el prompt 02.

## Lo que pide el usuario (sus palabras, ordenadas)
1. **La escena es ultrarrealista.** Los materiales actuales son provisionales: hazlos de verdad.
2. **Toda la escena es oscura** salvo sus elementos principales. Los **soportes** que sujetan las
   herramientas apenas se ven en la oscuridad.
3. **Los bloques de metal deben estar algo mejor iluminados** que en la muestra, para que la escena sea
   legible.
4. **El bloque que corta el láser mide la mitad**: grosor **2.5 cm**, en lugar de 5. Por tanto:
   - cada pieza cortada mide 2.5 cm de alto;
   - los huecos de MAGEDDON en la placa tienen 2.5 cm de profundidad;
   - en X e Y el bloque no cambia.
5. **No hay mesa de trabajo.** La «mesa» es la propia placa de **acero cepillado**, donde se graba CODE y
   están los huecos de MAGEDDON.
   - La escena son casi únicamente los dos bloques de metal y las herramientas.
   - La placa debe salirse del cuadro por todos los lados en todos los planos: unos 1.4 × 1.05 m.
   - Quita la mesa oscura y los diodos de bokeh.
6. **El bloque cortado es de acero galvanizado.** El bloque donde caen las letras es de acero cepillado.
7. **Las letras cortadas se ven mucho más metálicas, sobre todo en medio.** No son de un solo color:
   llevan un **gradiente de rojo a metal**.
   - El **borde inferior y el superior** de la letra son de un **rojo más brillante**.
   - **Ignora el color #E380AE** de antes.
8. **El cabezal del láser queda fuera de escena.** Solo se ve **el haz de luz**, que pasa rápido por el
   bloque que se está cortando. Quita el riel y el carro visibles; el haz baja desde fuera del cuadro.

## Muestra del orquestador (punto de partida visual)
- `muestra_estilo.py` genera la imagen `previas/muestra/muestra-alta.jpg`, que te llega como imagen.
  Al usuario le gustó la dirección.
- **Tu objetivo es igualarla y superarla en realismo.**
- Porta y mejora sus ideas dentro de `codemageddon.py`:
  - mapa de distancia al borde proyectado por la UV `Proyección XY` de `prisma()`;
  - selección tapa/lateral por la normal;
  - lentejuelas Voronoi del galvanizado;
  - mundo a cero y focos con caída.
- Lo que el orquestador ve mal en su propia muestra, y tú corriges:
  - **Las letras encajadas se leen como un contorno rojo con el centro negro.** El centro de metal
    refleja la escena negra. Debe leerse como **acero claro pulido**. Ponle algo que reflejar: una o dos
    tarjetas o áreas grandes y tenues fuera de cuadro, colocadas para que su reflejo especular caiga en
    las caras superiores desde las cámaras. Y haz el degradado más largo y suave.
  - **El galvanizado parece camuflaje facetado.** El real es plata clara casi uniforme:
    - cristales («spangle») de 5–15 mm con bordes dendríticos finos;
    - poca diferencia de reflectancia entre granos (brillo ±8 %, rugosidad 0.15–0.25);
    - sin relieve facetado;
    - algún matiz mate y un poco de óxido blanco en las aristas.
  - **La mancha de luz del suelo es demasiado dura.** La luz debe caer de forma suave y amplia.

## Materiales ultrarrealistas
Todo PBR con valores físicos y microdetalle procedural, con semillas fijas. Nada de texturas externas.

**Acero cepillado (la placa-suelo).**
- Metálico 1, albedo de acero (≈ 0.55–0.62 lineal).
- Rayado direccional fino en X con anisotropía real y rugosidad 0.18–0.32 que varía en bandas largas.
- Microarañazos aleatorios escasos.
- Alguna huella o mancha muy sutil, solo visible en el reflejo.
- Aristas exteriores con chaflán de 0.3–0.5 mm.
- Lo que hay que conseguir: brillos alargados como en `referencias/grabado-2027-taladro.png`.

**Acero galvanizado (el bloque cortado).** Como se describe arriba. Las **paredes del corte láser**, es
decir, los calados de las letras ya cortadas:
- más oscuras y rugosas, con estrías verticales finas;
- con un tinte térmico de azul a pajizo que se pierde a 1–2 mm del borde.

**Letras cortadas (metal con gradiente).** Son el mismo acero del bloque, ya limpio y pulido; el rojo es
el «calor» del corte que queda en los bordes.
- **Cara superior.** Rojo brillante y luminoso en el contorno, que se degrada hacia dentro a **acero claro
  pulido**. El degradado es largo y suave, de unos 3.5–4.5 mm, de modo que el centro de los trazos es
  metal limpio.
- **Laterales.** **Bandas rojas brillantes en la arista superior y en la inferior** (unos 4–6 mm cada
  una), que se degradan a **acero en la mitad del lateral**. Las aristas verticales llevan un toque rojo
  más fino.
- **El rojo.** Rojo puro brillante, no rosa: lineal aproximado (1.0, 0.04, 0.06). Emite solo en la
  franja roja, con su máximo en la arista, y además tiene color base rojo metálico. El metal no emite.
- **El metal.** Metálico 1, rugosidad 0.12–0.2, claro.
- Ponlo todo en un diccionario `LETRA` editable: anchos, colores, emisión y rugosidades.
- Las **letras encajadas** solo muestran la cara superior: el gradiente tiene que leerse ahí. La **pieza
  que cae** muestra también los laterales con sus dos bandas.
- **La O antes del corte.** Lleva el mismo galvanizado que el bloque. En la transformación, el rojo nace
  en el contorno y el metal se limpia hacia dentro.

**Soportes (mordazas, brazo, travesaño).**
- Acero pavonado o grafito casi negro, con estrías y tornillos.
- Solo un filo de luz de contra los delata. Deben apenas verse, pero estar ahí.

**Fresa CNC (el husillo).** Mismo criterio: cuerpo oscuro apenas visible y la herramienta de metal claro,
que sí se ve.

## Luz (legible, negra alrededor)
- **Mundo a 0.** Nada visible fuera de los bloques, las herramientas y lo que emite.
- **Luces de área grandes y suaves** (softboxes de 0.3–0.8 m) con caída natural, en lugar de focos de
  borde duro:
  - una contra fría desde atrás y arriba, que recorte bordes;
  - una luz cálida rasante desde la izquierda, que haga brillar el cepillado;
  - una clave suave desde delante y arriba;
  - las tarjetas de reflejo para las caras planas.
- La luz cae a negro en los bordes del cuadro: a 15–25 cm de la zona de acción, la placa se pierde en
  la oscuridad.
- **Objetivos medibles por plano** (el orquestador los mide en el JPG):
  - la cara superior de los bloques en la zona de acción, con luminancia media sRGB **70–160**;
  - las esquinas del cuadro, < 15;
  - menos del **2 %** de píxeles a blanco puro, salvo los emisivos.
- Todas las luces van en `LUCES`.
- Bloom con el compositor, con umbral alto, solo en el haz, las chispas, la sangría y el rojo de las
  aristas.
- **Haz del láser.**
  - Núcleo blanco y halo rojo, que baja vertical desde fuera del cuadro.
  - Un poco de neblina muy tenue solo alrededor del haz, para que se vea como en el aire de un taller:
    volumen local o cilindro de halo con caída radial.
  - Punto de impacto muy brillante, con chispas y sangría como ya tienes.

## Escala y medidas nuevas
- **Grosor del bloque galvanizado = alto de pieza = profundidad de hueco = 2.5 cm.** Ponlo en una
  constante (`GROSOR`) y que todo salga de ella.
- La cara inferior del bloque galvanizado está a **z = 0.06**. Quedan 6 cm de hueco, por donde cae
  entera una pieza de 2.5 cm.
- La placa-suelo de acero cepillado mide unos 1.4 × 1.05 m y tiene la cara superior en z = 0. Está
  centrada en la palabra, con algo más de fondo detrás.
- Adapta a estas medidas el `GUION`, las alturas de las caídas y el recorrido del láser de la tarea 02
  interrumpida.

## Cámaras
- **`cam_muestra`, plano nuevo de estilo.** Reproduce el encuadre de la muestra:
  - mira a (0.135, 0, 0.035);
  - posición = mira + (0.15, −0.42, 0.20);
  - 52 mm y sensor de 36 mm;
  - f/4, con el foco en la N que cae (cara superior de la N a z ≈ 0.037);
  - estado del cuadro 47: la N cayendo a mitad de camino, el haz cortando la O a ~60 % del contorno
    exterior y M A G E D D encajadas.
- Añade **`--muestra`**, que renderiza ese fotograma con esa cámara a `<salida>/muestra.jpg`. Respeta
  `--previa` (960×540) y sin ella da 1920×1080.
- Planos A–E. Mantén la tabla y aplica estas correcciones, que se vieron en la ronda 1 y siguen
  pendientes:
  - **A y C:** centro óptico a 2.5–4 cm sobre z = 0, con 6–12° hacia abajo. La pieza que cae se ve
    entera en todos los cuadros de su caída. Sensor de 36 mm, sin sensores virtuales.
  - **E:** 40–50° hacia abajo. La palabra ocupa el 75–90 % del ancho y las letras ≥ 6 % del alto.
  - **B:** como la muestra, pero más cerca de la O. La O ocupa el 20–30 % del ancho y el haz entra
    por arriba.
- **Rendimiento:** apunta a ≤ 10 s por fotograma a 1920×1080 en un M1 con EEVEE. La animación final
  tiene 192 fotogramas. Usa raytracing solo donde aporte.

## Comprobaciones (en `escena.json` y en tu respuesta)
- Medidas nuevas:
  - grosor de 2.5 cm en el bloque, las piezas y los huecos;
  - las encajadas enrasadas a z = 0 ± 0.01 mm;
  - la placa se sale de cada encuadre por los cuatro lados.
- No queda ningún objeto del cabezal láser, el riel ni el carro dentro de ningún encuadre (proyección).
- Encuadres de `cam_muestra` y de A–E dentro de rango.
- Triángulos < 800 k.
- Lista de luces con su potencia y tamaño.

## Respuesta final
Breve y clara:
- cómo hiciste cada material (sobre todo el gradiente de la letra y el galvanizado);
- qué luces y qué tarjetas de reflejo pusiste;
- qué conservaste y qué cambiaste del trabajo interrumpido de la tarea 02;
- los comandos exactos (`--muestra --previa`, `--muestra` y `--planos --previa`);
- las **desviaciones con motivo**.
