# Tarea 01 · Blockout del vehículo tubular

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Trabaja en la carpeta actual
(raíz del repo). No modifiques nada fuera de `arte/blender/vehiculo-tubular/`.

## Contexto
Vehículo ligero de combate para Code Battle Lite. Sustituye a un carrito diminuto que
llevaba un lanzamisiles absurdo para su tamaño. Este es un chasis TUBULAR del tamaño de
un auto real con una ametralladora ligera. Fase 1 = blockout: formas simples con las
proporciones, pivotes y jerarquía DEFINITIVOS. Sin detalle fino, sin UVs, sin texturas.

Lee `arte/blender/robots.py` (solo para estilo de código y la PALETA de colores; no lo
importes ni lo cambies). Escribe un script autónomo.

## Entregable
`arte/blender/vehiculo-tubular/tubular.py`, ejecutable así:

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python arte/blender/vehiculo-tubular/tubular.py -- --salida <carpeta>

Debe: construir la escena, guardar `<carpeta>/tubular_blockout.blend`, renderizar 4 vistas
PNG 1280×720 (`vista_34.png` tres cuartos frontal-derecha elevada, `vista_frente.png`,
`vista_lateral.png` desde +X, `vista_superior.png`) y escribir `<carpeta>/reporte.json`
con: lista de objetos (nombre, tipo, padre), bounding box global en metros, triángulos totales.
Todas las medidas como constantes en un dict `DIM` al inicio del script.

## Convenciones (obligatorias)
- Metros, escala aplicada 1.0. Z arriba. El FRENTE mira a +Y. Derecha = +X.
- Origen en el centro del aro proyectado al suelo; las llantas apoyan en z = 0.
- Blender 5.2. Busca nodos por tipo, no por nombre. Motor de render: lee el enum de
  `scene.render.engine` y usa EEVEE (asígnalo dentro de try/except). Colores en el nodo
  Principled BSDF, usando la PALETA de robots.py: chasis "grafito", aro y corona "acero",
  llantas "goma", motor "naranja", torreta/arma "crema" con acentos "rol".
- Suelo gris claro neutro, luz de sol + mundo suave. Cámara ortográfica en frente/lateral/superior.

## Geometría (valores de partida, respétalos ±2 cm)
1. **aro**: toro horizontal. Centro (0,0,0.75). Radio mayor 0.60, radio del tubo 0.06.
2. **Llantas** (4): centro en x = ±0.825, y = ±1.50, z = 0.33. Radio 0.33, ancho 0.25,
   eje de giro paralelo a X. Rin simple (cilindro más pequeño, color "acero").
   Nombres: `rueda_dd` (delantera derecha, +X +Y), `rueda_di`, `rueda_td`, `rueda_ti`.
3. **Manguetas** (4): poste vertical corto (tubo r 0.045, de z 0.20 a z 0.55) en
   x = ±0.60, y = ±1.50, más un muñón horizontal hasta el centro de su llanta.
4. **Brazos** (4): tubo recto r 0.05 desde el punto del aro que apunta hacia su llanta
   (a radio 0.60, en dirección del vector (±0.825, ±1.50)) hasta lo alto de su mangueta
   (z 0.55). Ángulo descendente resultante ~10–15°: repórtalo en el JSON.
   Nombres `brazo_dd`, `brazo_di`, `brazo_td`, `brazo_ti`.
5. **jaula_motor**: debajo del aro. Marco de tubos r 0.03 formando una caja
   0.90 (X) × 0.70 (Y) × 0.42 (Z), de z 0.27 a z 0.69, con 4 tubos verticales que suben
   a tocar el aro. **motor**: caja 0.60 × 0.45 × 0.32 dentro de la jaula, con una tapa
   cilíndrica encima (filtro) para leerse como motor.
6. **corona_fija**: anillo plano (corona de giro, NO un rodamiento pequeño) sobre el aro:
   radio exterior 0.62, interior 0.48, de z 0.81 a z 0.86. **corona_movil**: anillo
   r ext 0.58, int 0.44, de z 0.86 a z 0.90, hijo de `torreta`.
7. **torreta** (Empty, pivote yaw) en (0,0,0.90). Hijos: placa base disco r 0.44 × 0.03;
   pedestal tubo r 0.07 hasta z 1.22; horquilla (dos placas) que sostiene el muñón.
8. **arma** (Empty, pivote pitch, hijo de torreta) en (0,0,1.30), eje de giro X.
   Hijos: cajón del mecanismo 0.14 (X) × 0.55 (Y) × 0.16 (Z) centrado ligeramente atrás
   del pivote; cañón cilindro r 0.022 de 0.65 hacia +Y; camisa perforada simple
   (cilindro r 0.035 sobre la mitad trasera del cañón); caja de munición 0.12×0.22×0.16
   al lado izquierdo (−X); empuñaduras dobles atrás. **boca** (Empty) en la punta del cañón.
9. **raiz** (Empty) en el origen: padre de todo.

## Criterios de aceptación (comprueba TÚ antes de terminar)
- Bounding box global ≈ 1.90 (X) × 3.66 (Y) × 1.45–1.55 (Z), mínimo z = 0.
- Jerarquía: raiz > {aro, brazos, manguetas, ruedas, jaula, motor, corona_fija, torreta};
  torreta > {corona_movil, base, pedestal, horquilla, arma}; arma > {cañón, cajón, …, boca}.
- Rotar `torreta` 90° en Z y `arma` −15° en X no deja piezas flotando ni separadas.
- Triángulos totales < 40k.
- Ejecuta el comando de arriba con `--salida /tmp/tubular_01` y revisa que existan los
  6 archivos. Si Blender no puede ejecutarse en tu sandbox, dilo y entrega el script igual.

## Respuesta final
Breve: archivos creados, bbox medida, ángulo de los brazos, triángulos, y cualquier
desviación de este documento con su motivo. No inventes resultados que no ejecutaste.
