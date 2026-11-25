# Tarea 02 · Acercar la esfera a las generadas y hacer legibles los dos mecanismos

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Modifica los scripts de
`arte/blender/torreta_observacion/esfera/` (léelos enteros). No toques nada fuera de esa carpeta. No
ejecutes Blender: el orquestador renderiza (ya corrigió en `materials()` la entrada `Anisotropic` y la
búsqueda del Principled por tipo; consérvalo). Verifica en Python puro.

El orquestador renderizó la tarea 01 y comparó con las referencias 04 y 05. Estos son los cambios.

## 1. Esfera: más fiel a las generadas (04 y 05)
- **Dientes más gruesos y menos numerosos.** En la 05 se cuentan ~22 crestas en unos 150° de
  meridiano, o sea **~52–56 por vuelta**. Haz:
  - cresta ancha y redondeada (ancho de cresta ≈ ancho de hueco);
  - **relieve de ~20 mm**, con sombra profunda entre crestas;
  - la misma inclinación de ~32° y el mismo número entero en ambas bandas.
  Hoy hay 96 crestas finas que se leen como rayado.
- **Bandas más anchas: ~130 mm.** Van hundidas: los gajos de carcasa quedan **salientes** sobre la
  banda, con un canto visible y una ranura oscura a cada lado, como en la 05.
- **Tornillo Allen como en la 05**:
  - cabeza grande, de Ø ~230 mm, en un asiento rebajado con anillo;
  - borde moleteado fino;
  - hexágono profundo, de **r de vértices ~58 mm y profundidad ~45 mm**.
  Esto sustituye la medida anterior de 37 mm: el usuario pidió seguir la imagen. El tapón liso del
  polo opuesto escala igual.
- **Compuerta como en la 04 «desplegada»**:
  - dos hojas que son **gajos de esfera gruesos** (con espesor de pared visible y canto biselado),
    con bisagra en el borde exterior, que se abren hacia fuera ~100° como pétalos;
  - el hueco tiene un fondo oscuro con un anillo de asiento;
  - telescopio de 4 tramos más robusto (Ø de la base ~170 mm, con escalones y anillos marcados en
    cada tramo), boca abierta sin cristal y anillo emisivo tenue.
  Hoy las hojas parecen aletas planas.

## 2. Propuesta S: el sinfín sobre las bandas, con relevo
Tu motivo para descartar el sinfín sobre el meridiano es correcto: con un solo sinfín, 180° de
inversión siempre hacen pasar un polo, donde la banda se interrumpe por el tornillo y el tapón. La
solución realista es el **relevo**:
- **Dos sinfines sincronizados** sobre la banda meridiana, separados ~90° a lo largo de la banda y
  montados en la base giratoria (un solo motor, con un eje y una caja de engranes que los une).
  Mientras uno cruza la interrupción polar, el otro sigue engranado, como el relevo de piñones
  sobre una cremallera partida.
  - Comprueba en las 200 muestras que **siempre hay al menos uno engranado** y que el paso es
    coherente en la reentrada; la fase de los dientes debe coincidir.
  - Calcula la longitud de la interrupción polar. Si no basta con 90°, ajusta la separación.
- **Azimut** con un *slewing drive* (sinfín sobre la corona de la base giratoria), como ahora.
- **Banda ecuatorial:** úsala de **pista de rodadura** para los rodillos de apoyo de la base (sus
  crestas ruedan sobre rodillos acanalados), o di qué otra función cumple. Que no quede decorativa
  sin explicación.
- Quita la corona independiente del muñón si el relevo funciona; si no, explica por qué.
- Sinfín de acero y bandas de acero, con el sinfín visiblemente engranado en los dientes. Los motores
  van en gris oscuro con su caja reductora.

## 3. Propuesta C: cardán como la referencia 01
Un **anillo cardán** exterior (en el plano del ecuador en reposo):
- La esfera cuelga del anillo con **muñones** en el eje X, y una corona con piñón invierte y
  ladea la esfera.
- El anillo se apoya en **dos brazos/horquillas** en el eje Y, con una segunda corona y piñón para
  la otra inclinación.
- Todo va sobre la **base giratoria** de azimut (corona y piñón).
- En C las bandas son estéticas, y dilo así. Colores de la 01: estructura turquesa, acentos
  naranja en los soportes de motor.
- Debe verse claramente distinta de S en el corte.

## 4. Cortes legibles
- `--corte`: la torre se corta por un plano vertical que quita su mitad delantera, desde el suelo
  hasta el labio, con la cara del corte en un tono más oscuro. La cámara va **más cerca y más baja**,
  y el mecanismo ocupa al menos la mitad del encuadre.
- Añade `corte_<X>_detalle.png`: primer plano de la transmisión principal (los sinfines engranando
  en S; los muñones y coronas en C).
- La esfera no debe tapar el mecanismo. En los cortes, haz la mitad delantera de la carcasa
  invisible y deja visibles las bandas y los dientes, para que se vea el engrane.

## Criterios (repórtalos en `reporte.json`)
- Número de dientes, paso, relieve y ancho de banda medidos.
- S: muestras con 0, 1 y 2 sinfines engranados (nunca 0), longitud de la interrupción polar y
  separación elegida.
- Holguras ≥ 3 mm en ambas propuestas, en toda la secuencia, con las hojas abiertas y el telescopio
  extendido.
- Menos de 400k triángulos por escena.

## Respuesta final
Breve:
- qué cambió;
- cómo funciona el relevo de S (o por qué no);
- valores medidos;
- desviaciones, con su motivo.
