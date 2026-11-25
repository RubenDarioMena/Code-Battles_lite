# Tarea 03 · Acero como chapa de blindaje, no como bloques

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Lee primero:
- `AGENTS.md`;
- `docs/MURALLA-VOXELES.md` (sobre todo «Destrucción en tres capas», «Tensión visible» y «Material procedural»);
- `shared/muralla/voxeles.js`, `shared/muralla/vista-three.js` y `shared/muralla/material-three.js`.

Toca únicamente:
- esos tres archivos de `shared/muralla/`;
- `herramientas/muralla/`;
- `pruebas/muralla-voxeles.cjs`;
- una sección nueva de `docs/MURALLA-VOXELES.md`.

No hagas commits. Corre `node pruebas/muralla-voxeles.cjs`: deben pasar todas, las viejas y las nuevas. No puedes
abrir un navegador; el orquestador lo revisará en WebGL.

## Por qué
Un muro de cubos de acero de 0,5 m no se parece a nada real. El acero de una muralla es **chapa de blindaje**:
planchas de unos centímetros, atornilladas a la cara de la piedra o del hormigón. Al recibir golpes:
- se abollan;
- protegen lo que tienen detrás mientras aguantan;
- cuando pierden sus anclajes, se desprenden enteras: cuelgan de un lado y se mecen, o caen al suelo.

No se desmenuzan.

## Modelo (núcleo, `voxeles.js`)
- **Blindaje.** `blindar({ eje, lado: "fuera" | "dentro", u0, u1, z0, z1, panel: [1, 1], grosor: .08 })` planea una
  obra de **paneles** sobre la cara exterior de las paredes de ese eje.
  - Cada panel es un rectángulo plano de `panel[0]` m a lo largo del eje por `panel[1]` m de alto.
  - Su cara interior queda a una holgura pequeña de la banda de las paredes (`s` máxima o mínima, como hace `capa`).
  - En los tramos curvos, cada panel sigue la cuerda entre sus dos extremos sobre el eje desplazado.
  - El blindaje entra en la cola de obras y avanza con `avanzar(n)`, como las paredes: un panel equivale a un
    número fijo de unidades, documentado. El plano translúcido muestra los paneles pendientes.
  - Debe poder usarse con `ampliar`, o al menos no romperse si se amplía el eje.
- **Anclajes.** Al colocarse, cada panel registra sus anclajes: los vóxeles sólidos que tiene justo detrás, dentro de
  su huella y a menos de 1,5 vóxeles de su cara interior.
  - Un panel sin ningún anclaje no se puede colocar: la obra lo salta y lo dice.
  - El escombro no ancla.
- **Daño al panel.** En `romper`, cada panel recibe `poder · (1 − d/radio)`, con `d` la distancia del golpe al
  punto más cercano del rectángulo.
  - Por debajo de su resistencia (empieza con .3) no le pasa nada.
  - Por encima, acumula daño. Con la mitad de su aguante (empieza con 1.6) queda **abollado**: guarda el centro y la
    profundidad de la abolladura, para dibujarla.
  - Al llegar a su aguante, **se desprende** (como si perdiera los anclajes). Nunca desaparece sin más.
- **Protección.** Mientras un panel no se ha desprendido, los vóxeles que tiene detrás reciben el golpe con
  `poder · (1 − absorcion)` (empieza con .7), **solo si el golpe llega por delante del panel** (el centro del golpe está
  del lado exterior de su plano). Un golpe desde dentro o por un hueco no se absorbe.
- **Pérdida de anclajes.** Tras cada golpe y cada derrumbe, cuenta los anclajes que siguen sólidos.
  - Con al menos la mitad, sigue fijo.
  - Si quedan anclajes, pero solo en un lado del panel (izquierdo, derecho o superior), **cuelga** de una bisagra en
    ese borde y se mece. Usa la misma idea y las mismas fórmulas de pose que las piezas de vóxeles: ángulo final
    buscado en pasos de 3° hasta tocar el suelo o la muralla, vaivén amortiguado y `matriz` en función de `t`.
  - Sin anclajes, **cae**: gira o se desliza hasta quedar tumbado en el suelo, y se queda ahí como chapa caída
    (estado `suelo`, pose final guardada). No se convierte en vóxeles de escombro.
  - Un panel colgado se suelta con un golpe cercano o si pierde sus anclajes restantes.
- Generaliza lo que haga falta de `anguloFinal`, `duracion`, `pose` y `matrizPieza` para que sirvan a piezas y
  paneles, sin cambiar el resultado de las piezas actuales (sus pruebas deben seguir pasando igual).
- **Tensión.** Un panel que cuelga va a nivel 4 y uno abollado, a nivel 2. Los vóxeles siguen con sus reglas.
- **Guardado.** `formato: "cmg-muralla", v: 3`, con los paneles: definición, anclajes, daño, abolladura, estado y
  pose. `cargar` sigue aceptando `v: 1` y `v: 2`.
- **El acero en vóxeles se queda** para cargar guardados viejos, pero ya no se usa para paredes nuevas en el
  laboratorio.
- Determinismo, igual que todo: sin `Math.random` ni reloj; mismas órdenes, mismo guardado.
- Todas las constantes nuevas (holgura, grosor, resistencia, aguante, absorción, unidades por panel) en un sitio, con
  nombre, como `MATERIALES`. Son provisionales del laboratorio.

## Vista (`vista-three.js`)
- Paneles fijos y abollados: **una sola malla combinada**, que se rehace cuando un panel cambia de estado o de
  abolladura, no en cada fotograma.
  - Cada panel es una caja fina. Los abollados se subdividen (4×4 en la cara) y hunden sus vértices hacia la
    muralla con una campana alrededor del centro de la abolladura.
  - Lleva atributos de color (con el tinte de tensión) y `material` con el id del acero, para que
    `material-three.js` le ponga costuras, remaches y rayado. Revisa que el patrón del acero encaje con un panel
    de 1 × 1 m. Si las costuras de 1 × 2 m quedan raras, ajústalas para que coincidan con los bordes del panel.
- Paneles que cuelgan o caen: una malla propia por panel, movida con su matriz, como las piezas.
- Paneles en el suelo: en la malla combinada de los fijos, en su pose final.
- Paneles pendientes: en el plano translúcido.
- Raycast: los paneles se pueden seleccionar, igual que los vóxeles, para que el laboratorio los golpee.
  `voxelDe(hit)` debe seguir funcionando y dar un punto de golpe válido cuando se toca un panel.
- Sin materiales nuevos: se usa el mismo material de la muralla.

## Laboratorio
- El botón de material «Acero» pasa a ser **«Blindaje»**. Con él, «Capa por fuera» y «Capa por dentro» planean
  `blindar` del lado correspondiente sobre todo el eje. «Subir 1 m» con Blindaje avisa de que no aplica.
- `?demo=blindaje`: una secuencia fija de golpes al cargar, con la cámara encuadrando el tramo.
  - Un tramo de piedra blindado por fuera.
  - Un panel abollado.
  - Un panel colgado de un lado tras socavar sus anclajes.
  - Un panel caído en el suelo.
  - Al lado, el mismo golpe sobre piedra sin blindar, para comparar el hueco.
- En las estadísticas: paneles por estado.

## Pruebas nuevas
- `blindar` sobre la muralla base da el número de paneles esperado. Todos tienen anclajes y quedan a la holgura
  pedida de la cara.
- El mismo golpe desde fuera rompe **menos vóxeles** con blindaje que sin él; desde dentro, los mismos.
- Golpes sucesivos: el panel pasa de intacto a abollado y luego se desprende.
- Quitar los anclajes de un lado lo deja colgado de la bisagra opuesta; quitarlos todos lo deja en el suelo, sin
  atravesarlo. Un golpe cercano suelta el colgado.
- Guardado: ida y vuelta idéntica con paneles en todos los estados; un guardado `v: 2` sigue cargando.
- Determinismo: la misma secuencia da el mismo guardado.
- Las pruebas anteriores de piezas y tensión dan lo mismo que antes.

## Documento
Una sección «Blindaje de acero» corta:
- el modelo;
- las constantes;
- la tabla de estados de un panel;
- cómo se guarda;
- qué cambió del acero en vóxeles.

## Respuesta final
Breve y en lenguaje claro:
- qué cambiaste;
- qué comprueban las pruebas y su resultado;
- qué decisiones tomaste y por qué;
- qué debe mirar el orquestador en WebGL.
