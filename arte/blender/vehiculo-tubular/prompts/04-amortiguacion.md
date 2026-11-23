# Tarea 04 · Amortiguación en todas partes + rig de suspensión

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Modifica
`arte/blender/vehiculo-tubular/tubular.py` (léelo entero; es la v3 «buggy de dunas»).
No toques nada fuera de `arte/blender/vehiculo-tubular/`. No ejecutes Blender (tu sandbox no
puede); el orquestador renderiza. Verifica con cálculo en Python puro lo que puedas.

## Dirección de arte
La animación del vehículo girará en torno a los AMORTIGUADORES. Quiero amortiguación no solo
en las ruedas, sino también en la estructura que sostiene las ruedas: el vehículo debe leerse
como un sistema de varias capas que absorben el golpe, en este orden:
rueda → suspensión de la esquina → clip → brazos del aro → aro; y el motor cuelga aparte.
El centro sigue siendo minimalista: el aro y sus brazos destacan, y no se añade ninguna jaula.

## 1. Más amortiguación por esquina
- Mantén el coilover. Añade a su lado un **amortiguador bypass**: cuerpo r 0.045, 3 tubos de
  bypass externos paralelos con su válvula/tornillo en cada extremo, entre el trapecio inferior
  y la torre (anclajes propios, separados del coilover ≥ 0.07).
- **Tope hidráulico** (bump stop): cilindro corto sobre el clip, justo encima del trapecio
  inferior, con almohadilla en el trapecio que lo golpea al comprimir.
- **Silentblocks** (anillos de goma) en todos los pivotes interiores de los trapecios.

## 2. Brazos del aro amortiguados (capa nueva)
Cada uno de los 4 brazos a 45° se vuelve un **puntal telescópico**: tubo superior desde el aro,
tubo inferior desde el clip, y entre ambos una sección de amortiguador con resorte alrededor y un
fuelle. Rótulas con silentblock en ambos extremos. El ángulo en reposo sigue siendo de 45°.

## 3. Motor sobre soportes elásticos
Cada tirante del motor termina en un **soporte de goma** (cilindro de goma entre dos placas).

## 4. Rig (sin keyframes en la construcción base)
Todo se controla con propiedades personalizadas y drivers; nada se mueve a mano:
- `esquina_XX["recorrido"]` en metros (−0.18 extensión … +0.22 compresión). La mangueta sube
  y baja en Z; los trapecios apuntan a sus rótulas (Damped/Locked Track); la rueda la sigue.
- Coilover y bypass: el cuerpo apunta al anclaje inferior y el vástago al superior (Damped
  Track); el resorte se estira entre ambos anclajes (Stretch To, solo en su eje). Al comprimir,
  el vástago entra y el resorte se acorta: nunca se estira el cuerpo.
- `raiz["flotacion_aro"]` (−0.06 … +0.06): el aro, la cruceta y la torreta suben y bajan;
  los puntales del punto 2 se comprimen igual que los coilovers.
- `raiz["cabeceo"]` y `raiz["balanceo"]` (±4°): el aro se inclina sobre los puntales.
- `motor["oscilacion"]` (±0.03): el motor se mueve sobre sus soportes de goma.
- La dirección (`direccion_d/i`) y el giro de las ruedas siguen funcionando con la suspensión
  comprimida.

## 5. Pruebas que el orquestador renderizará
Añade la opción de CLI `--poses`, que, además de las 4 vistas, renderice desde la cámara 3/4:
`pose_compresion.png` (las 4 esquinas a +0.20, aro −0.05), `pose_extension.png` (todas a −0.16,
aro +0.05) y `pose_articulacion.png` (dd y ti a +0.20; di y td a −0.16; balanceo 3°).
Añade también `--demo-suspension`: 96 cuadros a 24 fps, sobre un suelo con 2 baches. Cada rueda
pasa por los baches con el desfase de su posición; el aro reacciona con unos 3 cuadros de retraso
y un pequeño rebote amortiguado (oscilación que decae); el motor, con 5 cuadros. Cámara 3/4 fija.
Guarda los PNG en `<salida>/demo_suspension/` (el MP4 lo arma el orquestador con ffmpeg).

## Criterios de aceptación (repórtalos)
- En las 3 poses, ninguna pieza se separa de su anclaje (distancia de cada extremo a su
  anclaje < 5 mm, calculada para los recorridos extremos).
- Los resortes nunca tienen una longitud mayor que la del cuerpo más el vástago.
- La rueda delantera girada ±30° con recorrido +0.22 no atraviesa ninguna estructura.
- Triángulos < 130k. Bbox en reposo sin cambios respecto a la v3 (±3 cm).
- `reporte.json`: lista de controles (propiedad, rango) y de amortiguadores por capa.

## Respuesta final
Breve: qué se añadió por capa, cómo funciona el rig, valores medidos y desviaciones con motivo.
