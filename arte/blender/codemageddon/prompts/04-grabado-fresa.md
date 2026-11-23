# Tarea 04 · Grabado de CODE con pasadas concéntricas y la fresa que termina la O

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Las tareas 01 y 03 (y lo útil de la 02
interrumpida) están en el árbol, sin commit: no las deshagas. Toca solo
`arte/blender/codemageddon/codemageddon.py` y su `README.md`. No toques `prompts/`, `referencias/`,
`previas/`, `muestra_estilo.py`, `variantes.py` ni `hoja_variantes.py`. No hagas commits.

No puedes abrir Blender (sandbox sin Metal). El orquestador renderiza y mira. Verifica en Python puro
(o con `/Applications/Blender.app/Contents/Resources/5.3/python/bin/python3.13` para numpy) medidas,
trayectorias, encuadres y que los contornos desplazados no se cruzan.

## Ya corregido por el orquestador, no lo deshagas
El usuario eligió el aspecto en hojas de variantes; estos valores son suyos:
- `LUCES`: una línea tras el diccionario multiplica todas las potencias por 2^−2.5. Déjala.
- `LETRA['tapa_m'] = .0030` y `LETRA['emision'] = 7.2`.
- Galvanizado y cepillado con sus valores «medios» actuales: no los cambies.
- **Haz del láser: solo una línea roja fina, sin aura.** Se quitó el `Halo`; el `Núcleo` es rojo
  (1, .02, .03) con emisión 2.4, por debajo del umbral del Glare para que no haga halo. No añadas
  neblina, halo ni bloom al haz.
- `main()` renderiza aunque falle una comprobación (lo anota y aborta al final).

## Encargo del usuario para esta parte
«Justo al lado, un taladro / fresa CNC **termina de grabar** unas letras en metal cepillado, con
**surcos concéntricos** como en la imagen 2021.» **CODE** va grabada con la fresa y **la última letra
grabada es la O**. Mira `referencias/grabado-2027-taladro.png` (te llega como imagen): números
fresados en acero cepillado con **pasadas concéntricas** que bajan en terrazas hacia el centro del
trazo, crestas finas que atrapan la luz, fondo pulido y borde superior limpio y vivo.

## 1. Grabado de C, O, D, E (función `grabar_code()`)
- En la placa-suelo de acero cepillado, con el contorno de cada letra (índices 0–3).
- **Perfil**: 7–10 pasadas concéntricas. Cada pasada está 0.35–0.45 mm más adentro que la anterior y
  0.22–0.30 mm más honda. Profundidad máxima 2.0–2.6 mm. Donde el trazo es más ancho que todas las
  pasadas, queda un fondo plano a la profundidad máxima.
- **Crestas de fresa de punta esférica**: entre pasada y pasada, una cresta redondeada (no un escalón
  con arista viva). Que cada cresta capte un brillo fino, como en la referencia.
- **Robusto en esquinas cóncavas** (interior de la C, uniones de la E y la D): los contornos
  desplazados no pueden cruzarse ni invertirse. Recomendado: sacar cada contorno desplazado como
  isolínea del campo de distancia que ya tienes (marching squares en numpy), simplificarlo y restar
  prismas apilados con booleanas exactas, o construir la superficie del hueco como malla de altura
  dentro de la letra cosida al borde. Tú eliges; justifícalo.
- **Material del grabado**: el mismo acero, mecanizado: rugosidad 0.08–0.16, sin el rayado del
  cepillado, con un microrrelieve concéntrico fino (por ejemplo, bump con
  `sin(2π·distancia/paso)` del campo de distancia) y, si se puede, anisotropía que siga las pasadas.
  El borde superior del grabado, vivo y brillante.
- Triángulos totales < 800 k.

## 2. La fresa termina la O de CODE · cuadros 115–144 (plano D)
- C, D y E de CODE ya están grabadas desde el cuadro 1. La O tiene todo hecho **menos las 2 últimas
  pasadas (las más hondas)**.
- **115–136**: la fresa recorre una vuelta completa de la O por la trayectoria de la penúltima pasada y
  vuelve por la última (o una vuelta con las dos, como quede mejor). Por delante de la herramienta,
  el material sin mecanizar; por detrás, la pasada terminada. Hazlo con un relleno de esas dos pasadas
  partido en ≥ 96 sectores a lo largo del trazo, que desaparecen (visibilidad o escala) cuando pasa la
  herramienta. Sin costuras visibles entre sectores.
- La herramienta: fresa de punta esférica de 3 mm con 2–4 filos helicoidales, girando (que se note el
  giro: desenfoque de movimiento o geometría de filos rotando con un ángulo que no produzca efecto
  estroboscópico). Portaherramientas y pinza en acero claro; el cuerpo del husillo oscuro, casi
  invisible, como los soportes.
- **Virutas**: 10–25 vivas a la vez, pequeñas (0.5–2 mm), rizadas y metálicas brillantes (no
  emisivas), salen tangentes al filo, caen con gravedad y se quedan en la placa. Semilla fija.
- **137–144**: la herramienta sube 2–3 cm y se aparta. En el plano E (145–192), la fresa está fuera de
  cuadro o arriba, apenas visible.
- **Luz del plano D**: una luz suave y rasante dedicada a la zona de CODE (en `LUCES`, ya escalada con
  el resto) para que las crestas concéntricas se lean con alto contraste, como en la referencia. El
  fondo sigue negro.

## 3. Arreglos pendientes
- **Comprobación del láser**: `error_punta_mm` da 5.3 mm en algún cuadro (la comprobación «Claves y
  cámaras evaluadas» falla). Busca el cuadro, corrige las claves o la interpolación (p. ej.
  interpolación lineal en el recorrido) y que vuelva a pasar.
- **Franja clara en el suelo**: en `--muestra`, arriba a la izquierda, el reflejo de una de las luces
  grandes deja una franja casi blanca en la placa. Recoloca o gira esa luz para que su reflejo caiga
  fuera de cuadro; la placa debe caer a negro hacia los bordes. No cambies las potencias.

## 4. Cámara D y salida
- `cam_D_fresa`: macro 3/4 sobre la O de CODE, 35–50° hacia abajo, 60–100 mm, f/2.8–4, foco en la
  punta de la herramienta. La O de CODE ocupa el **30–45 % del ancho**; la herramienta y la pinza
  entran por arriba; se ve parte de la C y la D grabadas a los lados.
- El plano E debe mostrar CODE grabada y legible junto a MAGEDDON (aunque el bloque galvanizado aún
  tape parte: el revelado es la tarea siguiente).
- Sugiere en tu respuesta los `--cuadro` clave del plano D para la previa.

## Comprobaciones (en `escena.json` y en tu respuesta)
- Profundidad máxima del grabado y número de pasadas por letra; ningún contorno desplazado se cruza.
- Trayectoria de la fresa: error respecto a la pasada < 0.1 mm; sectores ocultos en orden y todos
  ocultos en el 136.
- Ninguna viruta bajo z = 0 fuera de los surcos.
- Encuadre de D en rango en 115–144; la herramienta dentro del cuadro.
- «Claves y cámaras evaluadas» en OK. Triángulos < 800 k.

## Respuesta final
Breve y clara: cómo hiciste el perfil de las pasadas y por qué ese método, el material del grabado, la
fresa, las virutas, los arreglos, los comandos exactos para la previa y las **desviaciones con motivo**.
