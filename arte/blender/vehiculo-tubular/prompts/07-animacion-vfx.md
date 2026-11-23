# Tarea 07 · Animación de acción + VFX: avance, frenada fuerte, giro de torreta y ráfagas

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Modifica
`arte/blender/vehiculo-tubular/tubular.py` (léelo entero: tiene el modelo de detalle, el rig por
drivers y los materiales PBR). Puedes leer `arte/blender/vfx/capas.py` como referencia de estilo
de destellos y chispas, pero no lo importes ni lo modifiques. No toques nada fuera de
`arte/blender/vehiculo-tubular/`. No ejecutes Blender (tu sandbox no puede): el orquestador
renderiza. Verifica en Python puro lo que puedas (perfiles, tiempos, alcances, rangos).

No cambies la geometría, los materiales existentes, los pivotes, la huella ni los controles del rig.
Las opciones de CLI que ya existen deben seguir funcionando igual.

## 0. Arreglo previo: contacto con el suelo (obligatorio)
Hoy, al comprimir, `recorrido` sube la rueda y el cuerpo se queda quieto. En la animación debe
ser al revés: **las ruedas pisan el suelo y el cuerpo es el que se mueve.**
- Crea un Empty `vehiculo` (nuevo padre de `raiz`) para el avance en Y y el rumbo.
- Añade a `vehiculo` los controles `altura_cuerpo` (−0.10…+0.08 m), `cabeceo_cuerpo` y
  `balanceo_cuerpo` (±5°), que mueven `raiz` (pivote del cabeceo en (0, 0, 0.55) del vehículo).
  Cabeceo positivo = morro abajo.
- `apoyar(t)`: con la pose del cuerpo y el terreno, calcula `recorrido` de cada esquina para que
  el punto más bajo de cada neumático quede sobre el terreno. Resuélvelo de forma analítica o con
  2–3 iteraciones de `view_layer.update()`; error < 1 cm en todos los cuadros. Si un recorrido se
  sale de rango, recórtalo y anota el cuadro en el reporte (no debería pasar).
- El terreno es una función `terreno(x, y)` única que usan a la vez la malla del suelo y el
  contacto: arena plana con ondulación suave (amplitud ≤ 3 cm, longitud de onda 3–6 m) y un
  par de baches bajos en el tramo de avance para que la suspensión trabaje.

## 1. Guion (24 fps, 240 cuadros = 10 s; deja los tiempos en una tabla `GUION` editable)
| Cuadros | Acción |
|---|---|
| 1–60 | Avanza en +Y a 10 m/s. Las ruedas giran según la distancia (`giro` = −dist/r en grados). Los baches mueven las esquinas; el cuerpo y el aro responden con retraso. Polvo detrás de las ruedas traseras. |
| 61–92 | **Frenada fuerte** (~0.9 g hasta parar): morro abajo (cabeceo 3.5–4.5°), delanteras comprimidas, traseras extendidas, el aro se adelanta con retraso (cabeceo del aro hacia delante) y el motor oscila. Las delanteras se bloquean ~6 cuadros y luego ruedan hasta parar. Discos delanteros al rojo (emisión que sube y se apaga despacio), nube de arena hacia delante desde las delanteras, y **marcas de derrape** en el suelo. |
| 93–120 | Rebote al parar: el cuerpo cabecea hacia atrás más allá del reposo y oscila amortiguado ~2 ciclos. El aro y el motor, con 3 y 5 cuadros de retraso. El polvo se asienta y deriva. |
| 105–140 | **Giro de la torreta** ~110° hacia +X (curva suave con un pequeño sobrepaso y asentamiento) y elevación del arma a +6°. El piñón ya gira por driver. |
| 141–210 | **Tres ráfagas** de 6, 8 y 6 disparos a 12 disparos/s (1 cada 2 cuadros), con pausas de ~10 cuadros. Entre ráfagas, una corrección pequeña de la puntería (±3°). |
| 211–240 | Alto el fuego: el humo deriva y se disipa, la boca se enfría, la torreta corrige 5°. |

### Dinámica (nada a mano: todo sale de las entradas)
Integra con subpasos (≥ 8 por cuadro) un sistema masa-resorte-amortiguador de segundo orden,
determinista, para: (a) el cuerpo respecto a las ruedas (altura y cabeceo, con la deceleración y
los baches como entrada), (b) el aro respecto al cuerpo (`raiz["flotacion_aro"]`, `cabeceo`,
`balanceo`) y (c) el motor (`motor["oscilacion"]`). Parámetros (frecuencia, amortiguamiento,
ganancias) en un diccionario `DINAMICA`. El aro debe ser la capa más «suelta» y visible:
lo que el espectador mira es cómo absorbe cada golpe.
Cada disparo empuja el arma (retroceso del conjunto `arma` 0.025 m en −Y local, vuelve en 3
cuadros), da un pequeño golpe de cabeceo al aro y un temblor a la torreta. Licencia artística:
no hace falta que el retroceso sea físico.

## 2. VFX (procedurales, compatibles con EEVEE; la luz sale de materiales emisivos, nunca lámparas)
Construye cada efecto con funciones propias y crea los objetos una sola vez (reutiliza por
visibilidad y keyframes; nada de crear y borrar por cuadro). Todo con semilla fija.
- **Fogonazo**: 2–3 mallas cruzadas (estrella de 4–5 puntas y cono corto) en `boca`, emisión
  naranja-blanca muy intensa, rotación aleatoria por disparo, visibles 1 cuadro, con un resto
  más pequeño en el cuadro siguiente. Un disco de destello lateral en el apagallamas ranurado.
- **Humo de boca**: 2–4 bocanadas por disparo (esferas con Principled Volume o shader con
  transparencia y ruido), que crecen, suben, derivan con viento suave en +X y se desvanecen en
  ~1.5 s. Gris cálido. Máximo 120 vivas a la vez.
- **Casquillos**: uno por disparo, de latón, expulsado por la ranura del lado +X con velocidad
  inicial (2.5–3.5 m/s hacia +X y arriba, dispersión aleatoria), giro sobre sí mismo, trayectoria
  balística con gravedad, un rebote en el terreno con pérdida de energía y quedan tirados. Nunca
  atraviesan el terreno ni el vehículo (si chocan con el aro, que reboten o se ignore esa
  trayectoria y se recalcule con otra semilla).
- **Eslabones**: un eslabón cae por el lado −X cada 2 disparos (misma física, más ligeros).
- **Trazadoras**: 1 de cada 3 disparos, varilla emisiva naranja de ~1.5 m que viaja a ~800 m/s
  (≈ 33 m por cuadro: aparece estirada 1–2 cuadros) hacia el blanco, con un leve desvío.
- **Blanco e impactos**: una placa de acero en un poste sobre una duna baja, a ~24 m en la
  dirección de tiro. Cada disparo impacta en la placa o cerca: chispas emisivas (6–12 líneas
  cortas que salen en abanico y caen) en la placa y surtidores de arena en los fallos.
- **Polvo de rodadura y frenada**: bocanadas de arena (#C8A97A) que nacen en el contacto de las
  ruedas, más densas al frenar; mismas reglas de volumen que el humo. Máximo 150 vivas.
- **Marcas de derrape**: tiras planas oscuras con borde suave sobre el terreno (a +2 mm), que se
  dibujan bajo las delanteras mientras están bloqueadas.
- **Calor**: discos delanteros (emisión) y punta del cañón (emisión anaranjada que sube con cada
  ráfaga y baja despacio). Controla la emisión con propiedades en `vehiculo` (`calor_frenos`,
  `calor_canon`) leídas por drivers o nodos de atributo; los materiales base no cambian para
  el resto de piezas.

## 3. Cámara y render
- Plano 1 (1–100): cámara baja de seguimiento en 3/4 delantero izquierdo que va por delante del
  vehículo y frena antes que él, para que la frenada y el morro bajando se vean de costado.
- Plano 2 (101–240): 3/4 trasero sobre el hombro izquierdo, con el blanco visible al fondo y un
  empuje lento hacia la torreta. Temblor de cámara sutil en cada disparo.
- 35–50 mm, desenfoque de movimiento de EEVEE activado (obturador 0.5) para que las ruedas y el
  fogonazo se lean.
- Añade `--animacion`: renderiza a `<salida>/animacion/####.png` a 1280×720. Añade
  `--cuadros a-b` (solo ese intervalo) y `--previa` (960×540 y menos muestras) para revisar rápido.
  El orquestador arma el MP4.
- El `.blend` guardado tras `--animacion` tiene toda la animación en keyframes (cuadros 1–240),
  para que se pueda reproducir en el editor.

## Criterios de aceptación (repórtalos; los que dependen de Blender, calcúlalos en el script y
escríbelos en `<salida>/animacion.json` para que el orquestador los lea)
- Contacto: error máximo de las 4 ruedas con el terreno < 1 cm en los 240 cuadros.
- Recorridos dentro de rango; cabeceo máximo del cuerpo en la frenada entre 3.5 y 4.5°.
- Anclajes del rig < 5 mm en los cuadros de máxima compresión y extensión (reutiliza la
  comprobación existente).
- Ningún casquillo ni eslabón por debajo del terreno en ningún cuadro.
- Lista de eventos: cuadros de cada disparo, inicio y fin de la frenada, del bloqueo y del giro.
- Triángulos del vehículo sin cambios; VFX con su propio conteo de objetos y triángulos.

## Respuesta final
Breve: cómo resolviste el contacto, la dinámica, cada efecto y las desviaciones con motivo.
