# Tarea 02 · Blockout v2: aro abierto, brazos a 45° y estructura

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Modifica
`arte/blender/vehiculo-tubular/tubular.py` (ya existe; léelo entero primero). No toques
nada fuera de `arte/blender/vehiculo-tubular/`. No ejecutes Blender: tu sandbox no puede
abrirlo y el orquestador renderiza por ti. Verifica la geometría con cálculo puro en Python.

## Qué opinó el director de arte sobre la v1
- El aro no se lee: la corona de giro y la placa de la torreta lo tapan; parece un platillo.
- Brazos demasiado planos (11°). Quiere **al menos 45°**.
- Ruedas sueltas colgando de un muñón: quiere **ejes** que unan cada par de ruedas.
- Todo luce demasiado simple: más diseño estructural en todas las extremidades.

## Cambios (todas las medidas siguen en `DIM`; conserva convenciones, nombres y pivotes existentes salvo lo indicado)

### 1. Aro abierto y más alto
- Aro: radio mayor 0.75, tubo 0.07. Su altura `aro_z` NO es fija: calcúlala en el script para
  que el ángulo de los 4 brazos sea 46° (ver punto 2). Esperado ≈ 1.35–1.42.
- **cruceta**: 4 tubos r 0.04 dentro del aro en forma de "+" (sobre los ejes X e Y, no en
  diagonal, para no repetir los brazos), unidos a una placa central (disco r 0.22 × 0.03).
- **corona_fija**: r ext 0.36, int 0.26, alto 0.05, sobre la placa central.
  **corona_movil**: r ext 0.33, int 0.23, alto 0.04 (hija de `torreta`).
- **base** de la torreta: disco r 0.30 (antes 0.44). Desde arriba el aro debe verse
  ABIERTO: entre la corona y el tubo del aro tiene que verse el motor abajo.
- 4 **cartelas** (placas triangulares, espesor 0.012) donde cada brazo se une al aro.

### 2. Brazos a 46°
- Cada brazo va del punto del aro que apunta a su rueda hasta el **soporte** superior de su
  extremo de eje en (±0.78, ±1.50, 0.42).
- Añade a cada brazo un **tirante** (tubo r 0.03) desde la esquina inferior más cercana de
  la jaula del motor hasta la mitad del brazo: forma un triángulo. Nombres `tirante_dd`, etc.
- Añade un **amortiguador** coilover por esquina: cuerpo cilíndrico r 0.03 + resorte
  (hélice real con bmesh o espiras de toro, r 0.055, 7 espiras) desde un punto al 35 % del
  brazo (medido desde abajo) hasta el extremo del eje. Nombres `amortiguador_dd`, etc.

### 3. Ejes
- Ancho de vía: ruedas en x = ±0.95 (antes ±0.825); y = ±1.50; z = 0.33; mismo radio.
- **eje_delantero** y **eje_trasero**: viga tubular r 0.05 de x −0.78 a +0.78 a z 0.33.
- En cada extremo: **portamaza** (bloque con biseles) y **soporte** superior donde llega el brazo.
- Delanteras: **mangueta** con pivote vertical (kingpin, cilindro r 0.025) entre portamaza y
  rueda, y una **barra de dirección** delgada (r 0.018) que une ambas manguetas por delante del eje.
  Las manguetas son Empties-pivote para girar la dirección: `direccion_d`, `direccion_i`.
- Trasero: **diferencial** (carcasa esférica-cilíndrica r 0.13) en el centro del eje, y un
  **cardán** (tubo r 0.035 con dos crucetas) del motor al diferencial.
- Elimina los postes verticales y muñones de la v1.

### 4. Ruedas con más diseño
- Rin con 6 rayos, tapa central y 6 tuercas; **disco de freno** (r 0.20, espesor 0.02) y
  **mordaza** (caja pequeña) en el lado interior; llanta con hombro biselado.
- Jerarquía por rueda: soporte/portamaza > (direccion_X si es delantera) > rueda_X (pivote de
  giro sobre su eje X) > rin, tuercas. El disco gira con la rueda; la mordaza NO.

### 5. Jaula del motor
- Se alarga hacia arriba hasta tocar el aro más alto (z inferior 0.30). Añade diagonales en
  X en las 4 caras laterales (tubos r 0.022). Motor un poco mayor (0.70 × 0.50 × 0.40) con
  tapa de válvulas, filtro y 2 tubos de escape que salen hacia atrás (−Y).

### 6. Torreta
- Sin cambios de forma, salvo que se monta sobre la corona nueva; `yaw_z` y `pitch_z` se
  derivan de la altura del aro (pitch 0.40 por encima del yaw).

## Criterios de aceptación (verifica con cálculo y repórtalo)
- Ángulo de los 4 brazos entre 45° y 47°.
- Bbox ≈ 2.10 (X) × 3.66 (Y) × 1.9–2.15 (Z); mínimo z = 0.
- Las 4 ruedas tocan z = 0. Ninguna pieza estructural atraviesa una rueda.
- Proyección superior: el anillo entre r 0.36 y r 0.68 alrededor del centro solo lo cruzan
  la cruceta y los brazos (está abierto).
- Triángulos totales < 60k.
- `reporte.json` incluye además: aro_z calculado, ángulos de brazos y lista de pivotes.

## Respuesta final
Breve: qué cambió, valores medidos (aro_z, ángulos, bbox, triángulos) y desviaciones con motivo.
