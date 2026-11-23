# Tarea 04 · Acabado del arte de la muralla: bordes de rotura, escombro y abolladuras

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Lee primero `AGENTS.md`, `docs/MURALLA-VOXELES.md` (sobre todo
«Material procedural» y «Blindaje de acero») y `shared/muralla/`. Las tareas 01–03 están hechas en el árbol de
trabajo, sin commit: no las deshagas. Toca únicamente:
- `shared/muralla/`;
- `herramientas/muralla/`;
- `pruebas/muralla-voxeles.cjs`;
- `docs/MURALLA-VOXELES.md`.

No hagas commits. Corre `node pruebas/muralla-voxeles.cjs` y `node pruebas/interaccion.cjs`: deben pasar todas. No
puedes abrir un navegador; el orquestador revisará en WebGL.

## Situación
Con el material procedural, la cara intacta de la muralla ya parece sillería. Pero en cuanto hay daño vuelve
«Minecraft», por tres cosas:
- los huecos tienen bordes de cubo perfecto con el mismo aparejo que la cara;
- el escombro son cubos;
- la abolladura de las chapas apenas se ve, porque solo baja unos centímetros y la normal no cambia.

Esta tarea cierra el arte de los materiales. **Solo cambia el aspecto**: la rejilla, los apoyos, el guardado, el
raycast (`voxelDe`) y todas las reglas siguen igual. La superficie suave (Surface Nets) **queda fuera**: no la hagas.

## 1. Caras de rotura
- Una cara expuesta es **de rotura** si la celda vacía a la que da pertenece al volumen de alguna pared (una celda
  que «debería» estar llena). Si da al exterior previsto, es cara original.
- El núcleo ofrece esa consulta con una caché que se invalida cuando cambian las paredes (`planear`, `ampliar`,
  `blindar`, cargar). Reutiliza `voxelesDe` o su lógica, y mide el coste.
- `mallar` marca esas caras con un atributo por vértice (`rotura`, 0 o 1). El shader las pinta como **piedra recién
  partida**:
  - sin la retícula de juntas;
  - grano más fuerte y algo más claro que la cara curtida;
  - unas pocas grietas finas.

  Lo mismo, con su carácter propio, en el hormigón (árido visible).

## 2. Bordes irregulares (geometría solo de vista)
- Los vértices de la red que tocan una rotura se desplazan con un **desplazamiento 3D que depende solo de la
  posición del vértice en la red global** (hash entero), nunca de la cara ni del trozo. Así el mismo vértice se
  mueve igual en todas las caras y en todos los trozos, y **no se abren grietas**.
  - Un vértice «de rotura» es el que tiene, entre sus 8 celdas vecinas, al menos una sólida y al menos una vacía que
    pertenece a una pared.
  - Amplitud: alrededor de 0,18 del tamaño del vóxel. Constante con nombre.
- Las caras desplazadas necesitan su normal recalculada: Lambert de r128 ilumina por vértice. Las caras intactas
  lejos de la rotura quedan planas y con su normal de siempre.
- Si un vóxel cambia, también cambian los vértices de los trozos vecinos que comparten su borde. Comprueba que se
  marcan como sucios los trozos correctos.
- Una muralla sin daño debe producir **exactamente la misma malla que hoy**: mismo número de vértices y mismos
  valores en posiciones, normales, índices, colores y materiales.

## 3. Escombro como cascajo
- Los vértices del escombro se desplazan más (alrededor de 0,3 del vóxel), con el mismo criterio de red global, para
  que los montones parezcan piedras y no cubos. Elige y documenta qué pasa en un vértice compartido entre escombro y
  pared sana: no debe abrir grietas ni deformar la pared sana.

## 4. Abolladuras legibles
- La abolladura se ve desde la cámara del juego.
  - La cara del panel se subdivide más (8×8) y la abolladura llega hasta unos 12 cm. Puede hundirse en la piedra de
    detrás: queda oculta.
  - Recalcula las normales del panel abollado.
  - Oscurece un poco el centro, como si el golpe lo hubiera chamuscado.
  - Haz saltar uno o dos remaches cerca del golpe: en el shader, un remache que falta en un hash del panel basta.
- Revisa que las costuras del acero coincidan con los bordes del panel de 1 × 1 m.

## Laboratorio
- Casilla «Bordes de rotura», activada por omisión, y `?rotura=0` para comparar.
- `?demo=rotura`: plano cercano y determinista con lo siguiente.
  - Un túnel con sus bordes partidos.
  - Un montón de escombro.
  - Una chapa abollada vista de tres cuartos.

  Debe servir para las capturas.
- En las estadísticas, el tiempo de mallado: compara con la rotura activada y desactivada.

## Pruebas nuevas
- Sin daño, la malla es idéntica a la de antes, byte por byte.
- Tras un túnel:
  - hay caras de rotura y solo junto al hueco;
  - las caras de la cara exterior prevista siguen siendo originales;
  - ningún vértice de la red aparece con dos posiciones distintas, ni dentro de un trozo ni entre trozos vecinos.
    Comprueba esto expresamente en un borde de trozo.
- El escombro se desplaza y la pared sana vecina no se deforma, según la regla que elijas.
- El panel abollado tiene normales recalculadas y una profundidad máxima de unos 12 cm.
- `serializar()` es idéntico con la rotura activada o apagada. Determinismo de todo lo anterior.
- El coste del mallado de toda la muralla sigue en el mismo orden que hoy (anota la cifra).

## Documento
Actualiza «Material procedural» con las caras de rotura, los bordes irregulares, el cascajo y las abolladuras:
- la regla de la red global;
- las constantes;
- el coste.

Deja escrito por qué la superficie suave queda fuera y qué haría falta.

## Respuesta final
Breve y en lenguaje claro:
- qué cambiaste;
- qué comprueban las pruebas y su resultado;
- qué decisiones tomaste;
- qué debe mirar el orquestador en WebGL.
