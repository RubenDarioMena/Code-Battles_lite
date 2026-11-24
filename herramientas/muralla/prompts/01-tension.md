# Tarea 01 · Tensión visible en la muralla de vóxeles (fase 1: voladizo y piezas colgadas)

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Lee primero `AGENTS.md` y `docs/MURALLA-VOXELES.md`.
Toca únicamente `shared/muralla/voxeles.js`, `shared/muralla/vista-three.js`, `herramientas/muralla/`,
`pruebas/muralla-voxeles.cjs` y la sección nueva de `docs/MURALLA-VOXELES.md`. No hagas commits.
Corre tú las pruebas con `node pruebas/muralla-voxeles.cjs`: deben pasar todas, las viejas y las nuevas.

## Objetivo
El jugador debe ver, sin que nadie se lo explique, **dónde está a punto de ceder su muralla**. Las partes que
están cerca de perder el apoyo, y las piezas que ya cuelgan de una bisagra, se tiñen de rojo poco a poco.
Es solo una pista visual: **no cambia ninguna regla** de romper, derrumbar, guardar ni del resultado de la
simulación. El guardado (`serializar`) no cambia.

## Definición (fase 1)
- `apoyo()` ya da, para cada vóxel apoyado, su coste: pasos horizontales desde la columna apoyada más cercana.
  El vóxel cae cuando el coste supera `limite(m) = floor(voladizo / tam)`.
- **Proporción** de cada vóxel sólido (no escombro): `r = coste / limite(m)`, entre 0 y 1. Si `limite(m)` es 0,
  usa `r = 1` cuando el coste es mayor que 0 y `r = 0` en otro caso.
- **Nivel** entero de 0 a 4, para que el tinte sea estable y para rehacer pocos trozos:
  - nivel 0 si `r < 0,5`;
  - niveles 1, 2 y 3 en tramos iguales entre 0,5 y 1;
  - nivel 4 si `r ≥ 1` (en el límite: un paso más y cae).

  Fíjate en que con piedra a 0,5 m el límite es 3: los costes 0, 1, 2 y 3 dan los niveles 0, 1, 3 y 4. Está bien;
  documéntalo.
- **Piezas colgadas** (`estado === "cuelga"`): toda la pieza va a nivel 4. Los vóxeles de la rejilla que la
  sostienen (sus `soportes`) van al menos a nivel 3.
- El escombro y lo que está en el plano (lo que falta por construir) nunca se tiñen.
- Una muralla intacta, apoyada entera en el suelo, queda toda a nivel 0: el tinte solo aparece donde hay daño o
  donde una obra deja algo en voladizo.

## Núcleo (`voxeles.js`)
- `tension()` devuelve un mapa de clave de vóxel a nivel, solo con los vóxeles de nivel mayor que 0. Se guarda
  en caché por versión de la rejilla: si nada cambió, no se recalcula. `derrumbar` ya llama a `apoyo()`;
  aprovéchalo para no hacer la búsqueda dos veces por golpe.
- Al recalcular, compara con el mapa anterior y **marca como sucios solo los trozos** donde algún vóxel cambió
  de nivel (también los que pasan de un nivel mayor que 0 a 0). Así la vista rehace lo justo.
- La tensión no se pide en cada fotograma: se recalcula como mucho una vez por cambio de la rejilla. Mide su
  coste (a 0,5 y a 0,25 m) y ponlo en la tabla de medidas del documento.
- Determinista, igual que todo lo demás: sin `Math.random` ni reloj.

## Color (`mallar` y la vista)
- `mallar(rejilla, clave, { ..., tension })`: `tension` es una función `(i, j, k) → nivel`. El tinte se aplica
  al color base del vóxel, antes de la oclusión ambiental. **No cambia la geometría**: mismas caras e índices.
- El tinte mezcla el color base con un rojo de alerta (empieza con `0xd8452f`) en una proporción
  `[0, .16, .3, .45, .6][nivel]`, y además lo oscurece un poco (hasta un 12 % en el nivel 4). El oscurecimiento
  hace que la pista se lea también con daltonismo rojo-verde. Pon la curva en una tabla o función pequeña y
  aislada, con nombre claro, porque la ajustaremos mirando capturas.
- Debe leerse en las tres piedras (piedra, hormigón, acero) y con las dos pieles de Campaign. En `ponerPaleta`,
  la paleta puede traer su propio `colorTension`.
- La vista (`vista-three.js`) recibe `op.tension` (por omisión, activada) y `verTension(sí)`. Al cambiarla se
  rehacen todos los trozos una vez. Las piezas colgadas se construyen ya teñidas en `mallaPieza`.
- Sin draw calls ni materiales nuevos: es color por vértice en las mallas que ya existen.

## Laboratorio (`herramientas/muralla/`)
- Casilla «Ver tensión» en el panel, activada por omisión, y `?tension=0` para apagarla.
- `?demo=tension`: aplica al cargar una secuencia fija de golpes para las capturas.
  - Un túnel bajo la piedra que deja un dintel en el límite.
  - Un mordisco lateral que deja un tramo colgado de una bisagra.
  - Otro golpe parecido en una capa de hormigón, que aguanta más voladizo.
  - La cámara queda encuadrando el daño.

  Nada de reloj ni azar: misma URL, misma imagen.
- En las estadísticas del laboratorio, el número de vóxeles por nivel y lo que tardó el último cálculo.

## Pruebas nuevas (`pruebas/muralla-voxeles.cjs`)
- Muralla intacta: `tension()` vacía.
- Tras un túnel en piedra: hay vóxeles de nivel 4 justo sobre el hueco, los vecinos tienen el nivel que dicta
  su coste y ningún escombro aparece en el mapa.
- Una pieza colgada pone sus soportes al menos a nivel 3.
- Caché: dos llamadas seguidas sin cambios devuelven el mismo objeto y no recorren la rejilla.
- Trozos sucios: un golpe lejos de todo solo marca los trozos donde cambió algún nivel.
- `mallar` con y sin tensión da las mismas posiciones, normales e índices. Los colores cambian solo en los
  vóxeles teñidos, y siempre hacia el rojo (más rojo relativo, menos luminancia).
- Determinismo: la misma secuencia de órdenes da el mismo mapa de tensión.
- `serializar()` es idéntico con la tensión activada o apagada.

## Documento
Añade a `docs/MURALLA-VOXELES.md` una sección «Tensión visible» corta:
- qué mide;
- la tabla de niveles;
- la curva de color;
- el coste;
- qué falta para la fase 2.

La fase 2 es la **carga**: peso que sostiene cada columna desde arriba, para que los pilares delgados que
aguantan mucho también se tiñan. Hoy el modelo no la calcula. No la implementes; deja `tension()` preparada
para combinar otro término con el máximo.

## Respuesta final
Breve y en lenguaje claro:
- qué cambiaste y dónde;
- qué comprueban las pruebas y su resultado;
- cuánto cuesta el cálculo;
- qué decisiones tomaste y por qué;
- qué queda para la fase 2.
