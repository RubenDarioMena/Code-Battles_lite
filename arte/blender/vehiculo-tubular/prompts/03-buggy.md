# Tarea 03 · Rediseño: buggy de dunas minimalista con aro central

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Reescribe la construcción en
`arte/blender/vehiculo-tubular/tubular.py` (léelo entero primero; conserva su CLI, materiales,
render, reporte y convenciones). No toques nada fuera de `arte/blender/vehiculo-tubular/`.
No ejecutes Blender (tu sandbox no puede); verifica con cálculo en Python puro.

La imagen adjunta (`referencias/buggy-dunas.jpg`) es la referencia de POSTURA y SUSPENSIÓN:
un UTV/buggy de dunas. NO copies su carrocería ni su jaula de pasajeros: este vehículo no
lleva pasajeros.

## Dirección de arte (lo más importante)
- **Complejidad en las esquinas**: ruedas, suspensión, amortiguadores y sus soportes son lo
  más detallado del vehículo. Deben leerse como un buggy de competencia de recorrido largo.
- **Minimalismo en el centro**: solo el ARO, sus 4 brazos, el motor colgado debajo y la
  torreta encima. Nada de jaula alrededor del motor. El aro es lo que une todo y debe destacar.
- Postura baja, ancha y agresiva; ruedas grandes que sobresalen; casi sin voladizos.

## Disposición (medidas de partida; ajústalas si algo choca, y reporta)
Convenciones: metros, Z arriba, frente +Y, derecha +X, ruedas apoyadas en z = 0.

**Ruedas** (4): r 0.40, ancho 0.30, centro (±0.88, ±1.45, 0.40). Llanta con **tacos**
(bloques alternados en la banda de rodadura, 2 filas desfasadas, ~22 por fila) y hombro
biselado. Rin beadlock: anillo exterior con 12 tornillos, 6 rayos, tapa y tuercas. Disco de
freno ventilado y mordaza en el interior (la mordaza no gira).

**Clips delantero y trasero** (la "estructura de las esquinas", uno por eje): marco tubular
compacto y trapezoidal (tubo r 0.035) centrado en y = ±1.10, ancho ~0.60, de z 0.25 a z 0.75.
Contiene el **diferencial** (carcasa r 0.11) y soporta:
- **Torre de amortiguador** a cada lado: tubos triangulados que suben a un punto de anclaje
  en ≈ (±0.42, ±1.25, 1.00), con placa de anclaje.
- **Pivotes interiores** de los trapecios.

**Suspensión independiente por rueda (doble trapecio)**:
- **Trapecio inferior** (A-arm): 2 tubos r 0.03 desde dos pivotes del clip (separados 0.35 en Y)
  hasta una rótula en la mangueta, con una placa de refuerzo. Casi horizontal.
- **Trapecio superior**: igual pero más corto y más fino (r 0.025), por encima.
- **Mangueta / portamaza** vertical entre ambas rótulas.
- **Coilover de recorrido largo**: cuerpo r 0.04, vástago, resorte doble (dos hélices de
  distinto paso con un anillo separador), **depósito externo** (cilindro r 0.03 paralelo, unido
  con una manguera corta) — desde el trapecio inferior cerca de la rueda hasta la torre.
  Inclinación fuerte hacia dentro, como en la referencia.
- **Palier** (eje de transmisión) del diferencial a la rueda con dos **fuelles** (cubrepolvos
  cónicos acanalados) en los extremos.
- Delanteras: **barra de dirección** desde una cremallera en el clip delantero.
Pivotes Empty: `direccion_d/i` (delanteras, eje Z en la mangueta), `rueda_XX` gira en su eje.
Agrupa cada esquina bajo un Empty `esquina_XX` en el pivote del trapecio para poder animar la
suspensión después (el recorrido se anima en fases posteriores, no ahora).

**Centro**:
- **Aro**: toro r 0.68, tubo 0.075, horizontal. Altura derivada para que los **4 brazos bajen a
  45°** desde el aro hasta la esquina superior interna de su clip (≈ ±0.30, ±0.95, 0.75).
  Esperado aro_z ≈ 1.0–1.2. Cartelas en las uniones brazo-aro.
- **Motor**: bloque compacto (0.62 × 0.48 × 0.38) con tapa, filtro y 2 escapes hacia atrás,
  COLGADO bajo el aro con 4 tirantes delgados (r 0.02) inclinados: que se vea suspendido, sin jaula.
  Parte baja del motor a ≥ 0.30 del suelo.
- **Cardanes** del motor a cada diferencial (tubo r 0.03 con juntas en los extremos).
- **Cruceta** en "+" dentro del aro (tubos r 0.035) + placa central + **corona de giro**
  (fija r 0.34/0.24, móvil r 0.31/0.21). El aro debe verse abierto desde arriba.

**Torreta** (escálala ×1.4 respecto a la v2; antes se veía de juguete): Empty `torreta` sobre la
corona, `arma` 0.45 por encima, `boca` en la punta. Mantén la misma composición (pedestal,
horquilla, cajón, cañón con camisa, caja de munición a −X, empuñaduras).

## Render
Encuadra cada vista automáticamente con el bbox (margen 8 %); la v2 cortaba una rueda en la
vista 3/4. Mismas 4 vistas y nombres.

## Criterios de aceptación (repórtalos medidos)
- Ángulo de los 4 brazos del aro: 44–46°.
- Bbox ≈ 2.06 (X) × 3.70 (Y) × 1.7–2.0 (Z); mínimo z = 0; 4 ruedas tocan z = 0.
- Nada estructural atraviesa una rueda girada ±30° de dirección (comprueba las delanteras).
- Desde arriba, entre r 0.34 y r 0.62 del centro solo cruzan la cruceta y lo que está debajo.
- Triángulos < 90k.
- `reporte.json`: aro_z, ángulos, pivotes, triángulos por grupo (centro / esquinas / torreta).

## Respuesta final
Breve: qué cambió, valores medidos y desviaciones con motivo.
