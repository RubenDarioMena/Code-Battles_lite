# Tarea 03 · Propuesta S legible y apoyada; cabeza Allen; animaciones

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Modifica los scripts de
`arte/blender/torreta_observacion/esfera/` (léelos enteros). No toques nada fuera de esa carpeta. No
ejecutes Blender: el orquestador renderiza. Verifica en Python puro.

Quedan aprobados:
- los dientes (56 por vuelta, 130 mm, 20 mm, 32°);
- las bandas y los gajos;
- la propuesta C;
- la lógica del relevo de S (0 muestras sin engrane).

La imagen adjunta es tu corte lateral de S. Estos son los problemas que tiene, por orden.

## 1. S: se ve un mecanismo que no sostiene la esfera
- **Dos varillas verticales atraviesan la carcasa** por dentro (de la plataforma hasta el ecuador).
  Es una interferencia real: tu comprobación de holguras no las incluyó. Quítalas o llévalas fuera
  de la esfera, y **añade todas las piezas de S a la comprobación de holguras** con la carcasa.
- **Los sinfines son diminutos** y no se ve que engranen. Hazlos a escala de la banda:
  - Ø exterior ~110 mm y longitud ~240 mm, con la hélice bien marcada y el paso axial igual al paso
    de la banda (56,1 mm), con la misma mano;
  - abrazan la banda meridiana en **3–4 dientes visibles**;
  - cada sinfín va en una carcasa abierta por el lado de la banda, con rodamientos en los extremos.
- Une los dos sinfines con una **transmisión visible**: un eje con juntas cardan o una caja de
  engranes cónicos, y un solo motor (cuerpo cilíndrico gris oscuro y reductor) sobre la base giratoria.
- **Apoyo de la esfera**: 3 o 4 **rodillos acanalados** grandes (Ø ~120 mm) bajo la esfera, sobre la
  base giratoria, que ruedan sobre la **banda ecuatorial** cuando la esfera está en reposo o en uso.
  En las inclinaciones se apoya en los gajos con rodillos de bola: dibuja cómo. La esfera debe verse
  sostenida, sin flotar. Si la banda ecuatorial no puede hacer de pista durante la inclinación, dilo
  y usa transferencias de bola sobre los gajos.
- La corona de azimut y su sinfín (*slewing drive*) deben verse en el corte a la misma escala de
  detalle que lo demás.
- Mismo nivel de acabado que C: colores de estructura distintos de la esfera. Para S, gris
  grafito con acentos naranja en las carcasas de los sinfines.

## 2. Tornillo Allen como en la 05
Hoy queda al ras y se lee como un hexágono pintado. En la 05 es una **cabeza cilíndrica elevada**:
- sobresale ~25 mm sobre un asiento hundido con anillo;
- canto superior redondeado y lateral moleteado fino;
- hexágono profundo con sus paredes visibles.
El tapón del polo opuesto también sobresale un poco.

## 3. Animación (comprueba que `--animacion` funciona en S y en C)
Secuencia de ~12 s a 24 fps:
1. reposo;
2. inversión de 180°;
3. apertura de hojas;
4. telescopio;
5. dos miradas combinadas;
6. cierre parcial.
Cámara 3/4 fija, con la torre en corte y la mitad delantera de la carcasa invisible desde el cuadro 1,
para que se vea el mecanismo moverse. **Los sinfines y piñones deben verse girar** a la velocidad
que dicta su relación de transmisión. Añade `--animacion-exterior`, la misma secuencia sin corte y
con la torre entera, para ver el aspecto final. Escribe en `anim_<X>/` y en `anim_<X>_exterior/`.

## Criterios (en `reporte.json`)
- Holguras ≥ 3 mm entre **todas** las piezas de S y C y la carcasa, en toda la secuencia.
- Contacto de los rodillos de apoyo con la esfera (distancia al radio exterior ≤ 1 mm) en reposo y
  en uso.
- Sinfines: paso axial, Ø, dientes abrazados y ángulo de avance.

## Respuesta final
Breve: qué cambió, valores medidos y desviaciones con su motivo.
