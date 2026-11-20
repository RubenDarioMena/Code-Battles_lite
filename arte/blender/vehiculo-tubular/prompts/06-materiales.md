# Tarea 06 · Correcciones de detalle + materiales PBR + render de presentación

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Modifica
`arte/blender/vehiculo-tubular/tubular.py` (léelo entero: ya tiene detalle mecánico y rig).
No toques nada fuera de `arte/blender/vehiculo-tubular/`. No ejecutes Blender (tu sandbox no puede);
el orquestador renderiza. No descargues nada: todo es procedural.

No cambies proporciones, pivotes, controles del rig, huella (2.06 × 3.70 m) ni altura (2.16 m).

## A. Correcciones que vio el orquestador en los primeros planos
1. **Placas de la horquilla**: el agujero del muñón sale con sombreado manchado (n-gon o boolean).
   Rehazlo con geometría limpia (anillo con caras en quads) o usa un cilindro-saliente sin agujero.
   La pieza turquesa de debajo de la placa sale dentada: límpiala.
2. **Cinta de munición**: ahora está tirada encima de la tapa. Debe salir de la boca de la caja de
   munición (lado −X) y entrar por el costado del alimentador, con una curva suave colgando.
3. **Cajón del arma**: demasiado liso. Añade placas laterales con remaches, el grupo del gatillo atrás
   y una ranura de expulsión del lado +X. **Cañón y apagallamas en metal oscuro**, no en crema.
4. **Bloque del motor**: se lee como una caja naranja. Bisela el bloque, pon aletas en ambos
   costados y una tapa de culata con tornillos encima.
5. **Bridas del aro**: se leen como manchas oscuras sobre el toro. Más delgadas, del mismo metal
   que el aro y con un bisel pequeño.
6. **Sombreado**: suavizado por ángulo (30°) en todas las mallas, y Weighted Normal en las piezas
   de superficie dura con bisel. Sin artefactos visibles en los primeros planos.

## B. Materiales (Principled BSDF, procedurales, compatibles con EEVEE)
Calcula una vez, por malla, un atributo de color de vértices de suciedad/curvatura (Dirty Vertex
Colors o equivalente, en modo de fondo) y úsalo para el desgaste de bordes y la suciedad en cavidades.
Respeta la PALETA del proyecto como color base:
- **Tubos del chasis** (grafito): pintura en polvo, rugosidad 0.45; en los bordes asoma el metal
  desnudo con rayones (ruido + atributo de curvatura).
- **Aro (pieza protagonista)**: acero cepillado satinado (metálico 1, rugosidad 0.28, anisotropía
  a lo largo del toro) con un tono térmico azul-dorado muy sutil junto a las soldaduras.
- **Amortiguadores**: cuerpo de aluminio anodizado turquesa ("rol", metálico); vástagos cromados
  (rugosidad 0.05); resortes en naranja pintado ("naranja"); rótulas y tornillería de acero.
- **Neumáticos**: goma (rugosidad 0.85) con polvo de arena en la mitad inferior y en los tacos.
- **Motor**: naranja pintado con suciedad aceitosa en las cavidades; aletas de aluminio fundido.
- **Arma**: crema pintado; cañón y apagallamas pavonados oscuros; eslabones de latón.
- **Luces**: emisivas (la convención del proyecto: brillo de material, nunca lámparas).
- **Capa global de polvo de arena** (#C8A97A) que sube desde el suelo con ruido: fuerte en ruedas y
  partes bajas, nula por encima del aro.

## C. Escena de presentación
- Mundo: cielo procedural (Sky Texture), sol a ~35° de elevación, exposición ajustada, AgX.
- EEVEE con trazado de rayos, oclusión ambiental y sombras suaves.
- Suelo de arena: material con ruido y huellas suaves de rodada.
- Añade `--presentacion`: `heroe_34.png` y `heroe_bajo.png` (cámara baja a ras de suelo, 3/4 frontal)
  a 1920×1080, y `--turntable`: 120 cuadros (5 s a 24 fps) con la cámara orbitando una vuelta completa
  a la altura de la vista 3/4, PNG en `<salida>/turntable/`. El orquestador arma el MP4.
- Las vistas, poses y primeros planos existentes usan los materiales nuevos.

## Criterios de aceptación (repórtalos)
- Huella, altura y comprobaciones del rig sin cambios; < 260k triángulos.
- Ningún material depende de archivos externos; todos los nodos se buscan por tipo, no por nombre.
- `reporte.json`: lista de materiales y qué grupos de piezas usa cada uno.

## Respuesta final
Breve: correcciones hechas, materiales creados y desviaciones con motivo.
