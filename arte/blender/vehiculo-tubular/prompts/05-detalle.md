# Tarea 05 · Modelado de detalle

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Modifica
`arte/blender/vehiculo-tubular/tubular.py` (léelo entero: es la v5, con rig de suspensión por
drivers y torreta alta). No toques nada fuera de `arte/blender/vehiculo-tubular/`. No ejecutes
Blender (tu sandbox no puede); el orquestador renderiza. Verifica con cálculo en Python puro.

## Dirección de arte (no cambia)
Complejidad en las esquinas (ruedas, suspensión y sus soportes) y minimalismo en el centro, donde
destaca el aro. Esta fase añade DETALLE MECÁNICO CREÍBLE sin cambiar proporciones, pivotes,
controles del rig ni el tamaño (huella de 2.06 × 3.70 m y altura de 2.16 m, ±2 cm).
Licencia artística aceptada: el pedestal de la torreta se queda como está.

## Reglas
- Todo detalle nuevo debe ser hijo de la pieza que lo mueve (p. ej., las rótulas del vástago
  van con el vástago). Al mover cualquier control del rig, nada puede quedar flotando.
- Biseles reales en las aristas visibles (modificador Bevel con límite por ángulo; no lo apliques).
- Crea las funciones auxiliares que repitas (tornillo, cordón de soldadura, rótula) una sola vez.
- Presupuesto: < 250k triángulos en total; repórtalos por grupo.

## Detalle por zona
**Estructura tubular (clips, torres, brazos del aro)**
- Cordón de soldadura (toro fino irregular) en cada unión de tubos; tapones en los tubos abiertos.
- Cartelas con agujeros de aligeramiento (2–3 por cartela).
- Pestañas de anclaje con tornillo en cada punto de montaje.

**Aro y corona**
- Corona fija: 24 tornillos en círculo. Corona móvil: dentado exterior (~60 dientes) y un pequeño
  motor de giro con piñón engranado, fijo al aro (no gira con la torreta).
- 2 bridas soldadas en cada unión de brazo con el aro.

**Suspensión (lo más detallado)**
- Coilover: cuerpo roscado (anillos finos), collarín de precarga con muescas, asientos del resorte
  y rótulas tipo heim con tornillo pasante en ambos extremos.
- Bypass: perillas de ajuste en las válvulas. Depósito: manguera curva (curva con bevel) con
  racores en sus extremos.
- Trapecios: placas de refuerzo, rótulas y tornillos; latiguillo de freno (curva) del chasis a la mordaza.
- Fuelles del palier: mantén su acanalado y añade abrazaderas.

**Ruedas**
- Flanco del neumático con protector de llanta y nervios (sin texto); tacos con laminillas.
- Válvula, tuerca central y tornillos del beadlock ya existentes: revisa su escala.

**Motor y transmisión**
- Aletas de refrigeración en el bloque; colector de admisión; los escapes como colectores curvos
  que se unen en un silenciador; mazo de cables (3–4 curvas finas) hasta el clip delantero.
- Radiador pequeño con ventilador y carcasa en el clip trasero.

**Torreta y arma**
- Arma: tapa del alimentador con bisagra, palanca de carga, alza y punto de mira, apagallamas
  ranurado en la boca, asa de transporte y cinta de munición (eslabones a lo largo de una curva)
  de la caja al alimentador. `boca` sigue en la punta del apagallamas.

**Luces** (materiales emisivos, no lámparas; convención del proyecto)
- Barra LED en el clip delantero y 2 pilotos traseros.

## Renders de revisión
Añade `--detalle`, que renderice primeros planos a 1280×720 con cámara en perspectiva:
`detalle_esquina.png` (esquina delantera derecha, a la altura de la rueda),
`detalle_torreta.png`, `detalle_motor.png` (desde abajo y atrás) y `detalle_aro.png` (desde arriba
a 45°, con la corona y su motor de giro).

## Criterios de aceptación (repórtalos)
- Huella y altura sin cambios (±2 cm); 4 ruedas en z = 0 en reposo.
- Las comprobaciones del rig existentes siguen pasando (anclajes < 5 mm en poses extremas).
- < 250k triángulos.
- `reporte.json` incluye triángulos por grupo y conteo de piezas nuevas por zona.

## Respuesta final
Breve: qué se añadió por zona, triángulos y desviaciones con motivo.
