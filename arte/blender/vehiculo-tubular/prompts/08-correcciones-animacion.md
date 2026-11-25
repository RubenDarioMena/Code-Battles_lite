# Tarea 08 · Correcciones visuales de la animación (lectura en pantalla)

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Modifica
`arte/blender/vehiculo-tubular/tubular.py` (léelo entero; la tarea 07 añadió `--animacion`).
No toques nada fuera de `arte/blender/vehiculo-tubular/`. No ejecutes Blender: el orquestador
renderiza. La dinámica, el contacto y los tiempos del `GUION` están aprobados: **no los cambies**.
El orquestador vio la previa completa y estos son los problemas, por orden de importancia.

## 1. Plano 1 (1–100): no se lee la velocidad y la cámara corta el vehículo
- La cámara sigue al vehículo pegada, así que parece quieto sobre una arena sin rasgos.
  Cámbiala por una cámara **casi fija** (un desplazamiento lento de ≤ 2 m en todo el plano) en
  3/4 delantero izquierdo, baja (~0.6 m). El vehículo llega desde lejos, crece en el encuadre,
  frena delante de ella y queda **entero en cuadro con un margen de ≥ 8 %** (torreta incluida),
  a ~6–7 m de la cámara. Paneo suave para mantenerlo en cuadro mientras se acerca.
- Referencias de velocidad junto a la pista: 15–25 piedras bajas, matas secas y 6–8 estacas con
  cinta, repartidas a ambos lados, con semilla fija y apoyadas en `terreno()`.
- **Roderas**: huellas hundidas y oscuras (tiras con alfa) detrás de las 4 ruedas a lo largo del
  recorrido, que aparecen al pasar la rueda.
- Más detalle en la arena: microondulaciones (ripples) por ruido en el material del suelo.

## 2. Polvo
- Al avanzar, **estela de arena** visible detrás de cada rueda trasera (rooster tail): bocanadas
  que salen hacia atrás y arriba, más grandes (0.3 → 1.2 m) y densas, que se quedan atrás en el
  mundo y se disipan en ~1.2 s. En la frenada, la nube delantera debe adelantarse al vehículo y
  envolver las delanteras.
- Densidad con ruido por dentro y borde suave (nada de esferas lisas). Color arena #C8A97A,
  más claro arriba.

## 3. Disparos (plano 2)
- **Fogonazo** ×3–4: largo ~0.45 m, ancho ~0.25 m, más un destello lateral visible por las
  ranuras del apagallamas. Que se lea a 1280×720 desde la cámara del plano 2.
- **Humo**: hoy es una bola gris oscura y opaca que aparece a 1 m de la boca. Debe **nacer en la
  boca** (5–10 cm) y crecer hasta 0.5–0.7 m, con ruido, gris claro cálido, translúcido
  (densidad baja), subir y derivar con el viento. Las bocanadas se acumulan en una nube tenue
  sobre la torreta durante las ráfagas.
- **Blanco** más cerca y más grande: placa de 1.2 × 0.9 m a ~14 m, en la dirección de tiro. Chispas
  más largas y brillantes (15–25 por impacto, con desenfoque de movimiento), un fogonazo pequeño
  en la placa y marcas de impacto oscuras que se quedan. Surtidores de arena de 0.6–1 m en los
  fallos. Ajusta el rumbo de la torreta (dentro del giro aprobado de ~110° ± 10°) para que el
  cañón apunte de verdad a la placa.
- **Trazadoras** más gruesas y brillantes (que se vean en 1–2 cuadros).
- **Casquillos**: el orquestador no los ve. Que salgan con más energía, de 3 a 4 cm de largo
  (escala real ×1.5 por licencia artística), con brillo de latón, y que la cámara del plano 2 los
  vea salir y caer.

## 4. Plano 2 (101–240): corta las ruedas y el vehículo
- Cámara baja (~1.2 m) en 3/4 trasero desde el lado hacia donde salen los casquillos, con el
  **vehículo entero en cuadro** (ruedas incluidas) en la mitad del encuadre y el blanco visible.
  Durante las ráfagas, un empuje lento hacia la torreta, sin perder las ruedas de la parte
  baja del encuadre. Temblor sutil en cada disparo (ya existe; mantenlo).

## Criterios de aceptación (calcula en el script y escribe en `animacion.json`)
- Por cuadro: bbox del vehículo proyectado en cámara dentro de [0.04, 0.96] en X e Y (reporta el
  peor margen por plano). En el plano 1, desde el cuadro 60.
- En el plano 2, la placa del blanco dentro de cuadro y el cañón apuntando a ella (error angular
  < 2° del eje del cañón a su centro) durante las ráfagas.
- Lo aprobado en la 07 sigue igual (contacto < 1 cm, cabeceo 3.5–4.5°, anclajes y eyecciones).

## Respuesta final
Breve: qué cambió por punto y desviaciones con motivo.
