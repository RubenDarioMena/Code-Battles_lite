# Tarea 02 · Material procedural que oculte la rejilla de vóxeles

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Lee primero `AGENTS.md`, `docs/MURALLA-VOXELES.md` y
`shared/muralla/vista-three.js`. Toca únicamente:
- `shared/muralla/material-three.js` (nuevo);
- `shared/muralla/voxeles.js` (solo `mallar`, para un atributo nuevo);
- `shared/muralla/vista-three.js`;
- `herramientas/muralla/`;
- `pruebas/muralla-voxeles.cjs`;
- una sección nueva de `docs/MURALLA-VOXELES.md`.

No hagas commits. Corre `node pruebas/muralla-voxeles.cjs`: deben pasar todas. No puedes abrir un navegador; el
orquestador revisará el resultado en WebGL. Por eso el código del shader debe ser simple, conservador y
legible.

## Objetivo
Hoy cada vóxel de 0,5 m es un cubo de un solo color, y la muralla se lee como «Minecraft». Queremos que parezca
**sillería de piedra** (y hormigón encofrado) **sin cambiar la geometría ni la simulación**. Es solo aspecto: el
núcleo, el guardado y las pruebas de destrucción no cambian.

## Restricciones del motor
- Three.js **r128** (`shared/vendor/three-r128.min.js`), sin texturas descargadas: todo es procedural en el shader.
- Parte de `MeshLambertMaterial` con `onBeforeCompile` (o un `ShaderMaterial` mínimo si lo justificas). Ojo: en r128
  la iluminación Lambert se calcula **por vértice**. Cambiar la normal en el fragmento no sirve. El relieve se
  finge **modulando `diffuseColor`** en el fragmento: oscurecer las juntas y aplicar un sombreado de bisel según el
  gradiente del patrón frente a una dirección de luz fija.
- El patrón se calcula en **coordenadas del objeto** (el atributo `position`), no del mundo. Los trozos están en la
  identidad, así que da lo mismo. Pero las piezas que cuelgan o caen se mueven con una matriz, y el patrón debe ir
  pegado a ellas, sin «nadar».
- Proyección triplanar elegida por la normal dominante. La malla solo tiene caras alineadas con los ejes, así que
  basta escoger el plano con la normal, sin mezclar.
- Precisión: las coordenadas llegan a 200 m. En `mediump` el patrón se rompería. Usa `highp` en el fragmento (r128
  lo pide por omisión si el dispositivo lo admite) y documéntalo. Si no hay `highp`, aplica un respaldo razonable
  (por ejemplo, restar un origen por trozo).
- Coste: pocas operaciones por fragmento y nada de bucles de ruido con muchas octavas. Debe ir bien en teléfono.

## Material por vértice
- `mallar` añade un atributo por vértice con el id de material (`materiales`, Float32 o Uint8), sin cambiar
  posiciones, normales, índices ni colores. La vista lo pasa a la geometría como atributo `material`.
- El color por vértice sigue siendo la base: paleta, variación por hash, oclusión ambiental y **tinte de tensión**.
  El patrón lo modula alrededor de 1 (multiplicativo, con media cercana a 1), para que el rojo de la tensión se siga
  leyendo igual.

## Patrones
- **Piedra:**
  - sillares de unos 0,62 × 0,31 m, con las hiladas desplazadas media pieza. Los sillares **no coinciden con
    los 0,5 m del vóxel**, y eso es lo que rompe la rejilla;
  - juntas de mortero de 1,5 a 2 cm, más oscuras;
  - cada sillar con su propio tono (hash del id del sillar) y un bisel suave en sus bordes;
  - un poco de ruido de valor de baja frecuencia para que no parezca impreso.
- **Hormigón:**
  - paneles de encofrado de 1,2 × 0,6 m con una junta fina;
  - agujeros de los latiguillos (puntos oscuros pequeños) en cada panel;
  - vetas verticales muy suaves.
- **Acero:**
  - planchas de 1 × 2 m con costura;
  - remaches en el borde;
  - un rayado direccional muy sutil.

  Más adelante el acero será chapa de blindaje (otra tarea), pero este patrón servirá.
- **Escombro** (ids 4–6): sin juntas, con un grano de ruido más fuerte y algo más oscuro. Debe leerse como cascajo,
  no como pared.
- En las caras de arriba (normal +Y), el patrón de piedra se ve como la coronación: sillares más grandes o el
  mismo patrón girado. Elige y justifícalo.
- Todos los tamaños y colores en una tabla de constantes al principio del archivo, con nombres claros.

## Vista y laboratorio
- `CMGMurallaMaterial.crear(THREE, op)` devuelve el material. `CMGMurallaVista.crear(..., { material })` ya acepta
  uno propio; si hace falta pasar el atributo, adapta la vista.
- Las piezas en movimiento (`mallaPieza`) usan el mismo material y su atributo.
- El plano translúcido no cambia.
- Laboratorio: casilla «Textura procedural», activada por omisión, y `?textura=0` para apagarla. Al cambiarla se
  intercambia el material sin rehacer las mallas.
- Mantén el mismo número de draw calls y de materiales que hoy.
- `?demo=tension` debe seguir funcionando, ahora con textura.

## Pruebas (node)
- `mallar` produce un id de material por vértice que coincide con el vóxel de cada cara; un vértice por cada
  posición.
- Las posiciones, normales, índices y colores son idénticos a los de antes del cambio.
- `material-three.js` se carga en node sin THREE (o con un THREE simulado mínimo) y su texto de shader contiene las
  constantes del patrón. Comprueba de forma básica que las llaves y paréntesis del GLSL están equilibrados.

## Documento
Una sección corta «Material procedural»:
- qué patrón lleva cada material;
- por qué el patrón va en coordenadas de objeto;
- la nota sobre la precisión;
- el coste;
- qué falta para la capa 2 (bordes de rotura irregulares) y la capa 3 (superficie suave).

## Respuesta final
Breve y en lenguaje claro:
- qué cambiaste;
- qué comprueban las pruebas y su resultado;
- qué decisiones tomaste;
- qué debe mirar el orquestador en WebGL.
