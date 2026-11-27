## Campaign-V2 · Hallazgos medios del QA · 27 de noviembre de 2026

Segunda tanda de los dos informes del 26-nov (`docs/qa/campaign-v2-*-2026-11-26/`), tras C1, A1 y A2.

- **Títulos de B6–B8 sin traducir (M7).** Las tarjetas entre etapas mostraban `cv2.b6.titulo`. Las Batallas propias guardan una clave y las de War el texto: `tituloBatalla` traduce la clave, y lo usan la tarjeta de la Batalla y la de la fábrica.
- **Checkpoints de otra revisión (revisión, hallazgo 2).** Al cambiar la revisión del nivel solo se descartaba el último checkpoint; los demás seguían en la lista y llevaban a un H0 sin explicación. Ahora `purgarHistorialV2` quita todos los de otra revisión al escribir un checkpoint, al abrir la página de Batalla y al abrir la sesión de fábrica, y la consola avisa una vez.
- **Revisión 3 del nivel (revisión, hallazgo 7).** P7 añadió el taller de carcasas y H6 sin subir la revisión: un guardado anterior se restauraba sin esas unidades y H6 no se podía cumplir. **Cambio de formato de guardado:** todo progreso de la revisión 2 se purga y la partida vuelve a H0 con los programas del jugador. `campaign-v2-revision` guarda la huella de la planta y de los hitos: si cambian sin subir la revisión, la prueba falla.
- **Metas «hechos» de H5 (revisión, hallazgo 3, y O7).** Contaban los misiles que la planta montó sola durante la Batalla anterior, que ya se habían disparado. Al ganar una Batalla seguida de fábrica, la producción de partida del hito se fija en ese momento.
- **Base de un brazo aún ausente (revisión, hallazgo 4).** El colocador dejaba poner una tarima donde aparecerá ARM-02 en H2. Ahora la base de un brazo anclado está reservada desde el principio (`motivoColocar`, motor compartido; Factory y Campaign siguen pasando sus pruebas).
- **Aviso de bodega (M8 y O5).** Contaba enemigos, y las orugas blindadas de B7 y B8 aguantan 7 y 5 impactos. Ahora cuenta puntos de vida: con los datos del QA estima 23 para B5, 19 para B6 y 40 para B8 (gastados de la bodega: 19, 17 y 30). La tarjeta de H4 ya avisa para B5.
- **Perder sin munición (M6).** Con la bodega y los cargadores vacíos, la tarjeta de derrota dice «Sin munición…» en lugar de una pista que culpaba al programa, y esa pista no avanza.
- **Estado con la bodega llena (revisión, hallazgo 5).** Las vistas V2 y la ficha llaman a `estadoMaquina` con el mundo: ASM-01 con la bodega llena se ve bloqueada, como la leen los programas.
- **Guía de soluciones** (`docs/campaign-v2-soluciones-nivel-1.html`, fuera del repositorio): rellenar la bodega después de Ejecutar (M5), reabrir un programa escrito por consola en vez de recargar (M2) y borrar el guardado desde otra página (M1).
- **Pruebas:** `campaign-v2-revision` (nueva), y casos en `campaign-v2-batallas-propias` (títulos y aviso de bodega), `campaign-v2-secuencia` (metas «hechos»), `campaign-v2-fabrica` (base reservada), `campaign-v2-sesion-fabrica` (purga en la fábrica) y `campaign-v2-ui` (tarjeta sin munición). Las que cubren un fallo fallan sin su arreglo. La suite da 94 correctas (93 más la nueva) y los 7 fallos conocidos por las dependencias npm.
- **Probado en el navegador:** `?ensayo=b4` perdido con la bodega a 0 muestra «Sin munición»; un guardado real de la revisión 2 (h0, b1, h1) se purga al abrir, queda H0 de la revisión 3, sale el aviso y H1 desaparece de la lista. Sin errores.
- **Pendiente, por decidir:** el balance de la bodega (M3) y si una máquina que espera material debe verse en ámbar (M4 y la duda de 9.2). También quedan los hallazgos bajos (O1–O11, `sinEnergia`, mover una torreta a mitad de Batalla).

## Campaign-V2 · Arreglos del QA en el navegador (C1, A1, A2) · 26 de noviembre de 2026

El QA jugando la campaña entera (`docs/qa/campaign-v2-campana-navegador-2026-11-26/`) encontró tres fallos que paraban el juego. La revisión de código del mismo día (`docs/qa/campaign-v2-revision-codigo-2026-11-26/`) confirmó el A1.

- **C1 · Un pedido de la planta paraba la Batalla.** La planta sigue durante la Batalla y sus pedidos (el polímero de H2, las placas de H6…) llegan con el campo de War en pantalla. La página buscaba BAY-1 en ese campo, donde no existe, y el fallo salía como «Error en el programa de LAU-01». Ahora el pedido deja su línea en la consola, el globo solo sale si la bahía está en pantalla y la Batalla sigue (`campaign.js`, `ciclo-programas.js`).
- **A1 · Error en la vista al ganar una Batalla seguida de fábrica.** Al ganar, las reglas quitaban la Batalla y las vistas 2D y 3D recibían la escena de la planta. Ahora la Batalla terminada queda en `m.cerrada` y `escena`/`escenaMetros` la siguen dibujando quieta detrás de la tarjeta hasta que la página recarga en la fábrica. `cerrada` no entra en el checkpoint y se borra al montar la Batalla siguiente.
- **A2 · Elegir la rueda o el minador congelaba el juego.** Su ficha no tiene modelo propio y caían en la rama de enemigos del inspector. Ahora entran por la rama de unidades del campo (`programable`), con `charges` para el minador. Las métricas vivas ya no fallan si una ficha no tiene métricas.
- **Pruebas:** cada arreglo tiene su regresión, y las tres fallan sin él con el mismo error que vio el QA:
  - `campaign-v2-sesion-fabrica` (7b): B2 en la página con el pedido llegando;
  - `campaign-v2-secuencia`: la escena tras ganar la B1;
  - `campaign-v2-ui`: las fichas de WHL-01 y MIN-01.
  
  La suite da 93 correctas y los 7 fallos conocidos por las dependencias npm.
- **Probado en el navegador:** H0 → B1 ganada → tarjeta sobre el campo, en 3D y en plano, sin errores; MIN-01 elegido en `?ensayo=b8` con la Batalla en marcha.
- **Pendiente de los informes:** el balance de la bodega (B4 llega con 0 misiles), los guardados anteriores a P7, los checkpoints viejos en la lista, las metas de H5 que cuentan producción de la Batalla, los títulos de B6–B8 sin traducir en las tarjetas y el resto de hallazgos medios y bajos.

## Campaign-V2 · Esperas en ámbar y depósito de recortes lleno · 26 de noviembre de 2026

Dos pendientes del consolidado del 23-nov: el lenguaje de estados de 9.2 («ámbar = espera; verde = ejecutando; rojo reservado para daño o ataque») y el caso de prueba de 12.3 «el depósito de sobrantes se llena».

- **Esperas en ámbar en la fábrica V2:** una máquina con la salida llena o sin energía enciende su piloto ámbar. Pasa en 3D, en el plano, en la franja y en la ficha, y la etiqueta lleva ⚠ también sin energía. Antes era rojo y solo con la salida llena.
  - La regla vive en `luzEstado` (reglas-campaign-v2/fabrica). Las vistas compartidas la usan si las reglas la traen, así que Campaign del trunk sigue igual.
  - El programa de partida de las luces pasa a `light(outputFull ? "amber" : "green")` y la ayuda de máquinas dice «ámbar». Las partidas ya guardadas conservan su programa.
- **Depósito de recortes lleno:** con PAL-R llena, `deliver` responde «lleno» y el recorte sigue en las manos del obrero, sin perderse. El programa lo puede desviar a la fundidora. Prueba en `campaign-v2-circular`, junto con la tabla de luces: ningún estado de trabajo se pinta de rojo.
- **Probado en el navegador** en H6 con la sierra bloqueada: esfera ámbar en su consola 3D, punto ámbar en el plano y «SALIDA LLENA» en ámbar en la ficha. Sin errores.

## Campaign-V2 · Colocador de la fábrica con fantasma, giro y confirmación · 26 de noviembre de 2026

MISION-1 pedía «confirmar, girar, cancelar y fijar», como en el feedback del 17-nov, y el consolidado del 23-nov (2.1) habla de una «imagen fantasma de colocación». Antes, un toque colocaba al instante y no se podía girar.

- **Dos fases:**
  - apuntar: al pulsar «Mover», un fantasma de la pieza sigue al ratón, verde si cabe y rojo si no;
  - fijar: el toque lo deja en el suelo y abre una barra encima con ↻ (girar, R), ✓ (confirmar, Intro) y ✕ (cancelar, Esc). Tocar otro punto lo lleva allí.
  
  La pieza real no se mueve hasta confirmar.
- **El motor decide, también para el fantasma:** `probarColocar` (paquetes/fabrica) da la misma respuesta que `colocar`, sin tocar el mundo, y dice dónde quedaría el punto de trabajo. Donde no cabe, el ✓ se apaga y el aviso explica por qué.
- **Girar tiene efecto en el juego:** cada cuarto de vuelta lleva el punto de trabajo (donde se para el obrero) alrededor del centro, y con él el frente de la máquina o la tarima. El punto ha de quedar en la losa. El giro viaja en la orden (`args: [x, y, giro]`) y en el checkpoint. Un brazo anclado no tiene frente, así que ↻ se apaga.
- **Vistas:**
  - en 3D, el fantasma es una copia translúcida de la pieza con un disco amarillo en el punto de trabajo;
  - en el plano, un aro y un punto.
- **Arreglado:** en la fábrica, «ocupado» decía «El bastión ya está ocupado» (el texto de las Batallas). Ahora tiene el suyo.
- **Pruebas:**
  - `campaign-v2-fabrica`: giros, prueba en seco, punto girado fuera de la losa, suceso y checkpoint;
  - `campaign-v2-sesion-fabrica`: el recorrido en la página (fijar sin mover, girar, cancelar, ✓ apagado donde no cabe, confirmar).
- **Probado en el navegador** en H6, en 3D y en el plano, con PC y móvil: R gira, el toque lleva el fantasma, Intro confirma y PAL-6 queda con su punto de trabajo al oeste. Sin errores.

## Campaign-V2 · P8 · Daño por componentes y recuperación · 26 de noviembre de 2026

Segunda porción del consolidado del 23-nov: su corte vertical 13.B, «Un experimento aislado de daño y recuperación», en la versión mínima sin vóxeles (8.2). El diseño está en [P8-DANIO.md](docs/campaign-v2/P8-DANIO.md).

- **Reglas puras** en `reglas-campaign-v2/danio`. Una oruga blindada de 77 kg en 8 componentes (proa, chasis central, popa, motor, dos orugas, arma y electrónica), con caja, masa, integridad y uniones.
- **Tres ataques abstractos:**
  - explosivo: arranca mucha masa y rompe uniones;
  - preciso: solo al componente más cercano, quita la función con muy poca masa;
  - corrosivo: por dosis, erosiona poco a poco.
- **El resultado se lee en las cuatro categorías de 7.4:** reutilizable, fragmento, chatarra y perdido. Las masas van en gramos enteros, así que la suma es siempre la original.
- **Estado funcional por regla:** movilidad y fuego. Sin ninguna de las dos, queda fuera de combate.
- **Recogida:** los restos se agrupan en lotes de recortes de 4 kg, la masa del catálogo de la fábrica, y cada resto se recoge una sola vez.
- **Prueba nueva `campaign-v2-danio.mjs`:**
  - la masa cuadra en cada golpe;
  - el ácido en el centro deja dos fragmentos grandes (popa con motor, 20,1 kg; proa con electrónica, 14,6 kg);
  - dos disparos precisos lo dejan fuera de combate perdiendo 1,1 kg, frente a los 11,7 kg de una explosión (18 lotes frente a 15);
  - un láser en un borde suelta solo la electrónica;
  - golpear lo destruido no da botín y nada reaparece;
  - el resultado es el mismo con 500 o con 50 000 triángulos;
  - dos mil erosiones pequeñas no corrompen nada;
  - los lotes pasan por la fundidora de V2 y la masa del tanque cuadra hasta las placas y la escoria.
- **Banco visual `Prototypes/Campaign-V2/danio.html`**, en el menú de pruebas («Daño y recuperación»):
  - se elige el ataque y se hace clic sobre la oruga;
  - la máscara de daño va en el color de los vértices (tizne, ácido, punto al rojo) y el contorno rojo marca lo que perdió la función;
  - los fragmentos se separan y caen fuera del casco, y la chatarra queda en el suelo;
  - el panel muestra el balance, los fragmentos, los componentes y la recogida con las placas que daría la fundidora;
  - la calidad alta o baja cambia la máscara, no el balance.
- **Probado en el navegador:** escritorio y móvil, sin errores de consola.
- **H6:** el objetivo dice ahora que las placas se suben a PAL-6 con FRK-01.
- **Velocidad 1× a un tercio del tiempo real (pendiente anterior):** medido con `__banco.alFotograma`. En el panel oculto del navegador integrado, la página del juego recibe 1 fotograma por segundo. El bucle recorta cada fotograma a 0,25 s para no dar saltos, así que el juego avanza a 0,25×. Los programas no restan tiempo (0 s sin acumular). En una pestaña visible a 60 fps no pasa, así que no es un fallo del juego.
- **Dibujos propios del taller en la minificha:** la embutidora, la sierra y el láser ya no reutilizan los de otras máquinas. Siguen el estilo de Campaign 1 (contorno oscuro, bloques en sombra, base y luz, bandeja de entrada cian y de salida amarilla):
  - embutidora: columnas naranjas, matriz redonda y punzón semiesférico;
  - sierra: mesa con disco dentado, guarda amarilla y motor;
  - láser: cabina con cama de rejilla, pórtico y cabezal con el haz rojo.

  La prueba de la minificha comprueba que cada dibujo exista.
- **Frente este del decorado:** diez piezas del kit (esparto, matorral, espigas, pino joven, laja, roca y alcornoque) a los dos lados del carril este, que estaba desnudo. La prueba del decorado da 57 piezas sin solapes ni invasiones.
- **Pendiente de tu decisión:** si las orugas derribadas en las Batallas dejan restos que lleguen a la fundidora de H6, y cuántos.

## Campaign-V2 · P7 · Producción circular: reglas, hito H6 jugable y taller en 3D · 26 de noviembre de 2026

Primera porción del consolidado del 23-nov que no venía de War ni de Campaign 1: su corte vertical 13.A, «Producción circular mínima». El diseño está en [P7-CIRCULAR.md](docs/campaign-v2/P7-CIRCULAR.md).

- **Cadena:** placa (10 kg) → embutidora → domo → sierra o láser → semiesfera (6 kg) + recortes (4 kg). La fundidora convierte tres recortes en una placa y pierde 2 kg de escoria.
- **Motor compartido** (`paquetes/fabrica`), con tres mecánicas opcionales. Solo se activan si el catálogo las declara, así que la misión 1 y Campaign del trunk dan lo mismo que antes (`campaign-reglas`, `partida-campaign`, `fronteras-campaign`, `campaign-v2-fabrica`):
  - `sub`: subproductos por la misma salida; la máquina se bloquea si nadie los retira;
  - `masa`: con `masa.js`, ninguna receta crea materia, la pérdida queda registrada y viaja en el checkpoint;
  - `ritmo`: sierra y láser con la misma receta, a distinto tiempo y kW.
- **Catálogo de V2:** cuatro piezas y cuatro máquinas nuevas, con sus nombres en español e inglés.
- **Prueba nueva `campaign-v2-circular.mjs`:** conserva la masa en cada paso. Reciclando, 5 placas dan 7 semiesferas (sin reciclar, 5, con los recortes amontonados). Si solo se retiran las semiesferas, a la tercera la sierra se bloquea. Comprueba también que no hay duplicados, las capacidades, que cada máquina rechaza lo que no le toca y la repetición exacta. La sierra tarda 6 s con 1 kW y el láser 2 s con 5 kW (2,5 s si solo hay 4 kW). Un catálogo que crea masa no deja crear el motor.
- **H6 «Carcasas» en la misión 1**, tras la B8. Se enciende un taller al nordeste de la losa: EMB-01, SAW-01, LSR-01, FND-01, el robot libre BOT-01 y las tarimas PAL-6, PAL-7 y PAL-8. Llegan 5 placas a BAY-1 y la meta pide 6 semiesferas en PAL-7 y al menos una placa refundida, así que sin reciclar no se puede. Tiene objetivo, lección y tres pistas en español e inglés.
- **Pruebas de la misión:**
  - `campaign-v2-fabrica.mjs` la juega ahora de H0 a H6: el guion de H6 tarda 102 s y comprueba que la masa se conserva de principio a fin;
  - `campaign-v2-demo-fabrica.mjs` cumple H6 en la página con un programa escrito como lo haría el jugador (97 s).
- **Menú de pruebas:** nuevo inciso «H6 · Carcasas». `datos/plantas-demo.json` se regeneró con la planta al empezar H6.
- **Vista:**
  - `vista-3d/cv2/taller.js`, con las cuatro máquinas en el estilo papercraft:
    - embutidora naranja con su punzón de media esfera;
    - sierra con su disco girando;
    - láser con el cabezal y el haz rojo;
    - fundidora con la boca encendida mientras funde. Mira al oeste, hacia su punto de trabajo.
  - Las piezas nuevas tienen forma en 3D (el domo con su ala, la semiesfera recortada y el medio anillo de recortes) y color en el plano.
  - La minificha usa los SVG de prensa y CNC de Campaign 1.
- **Probado en el navegador:** H6 se completa con el programa del editor (6/6 y 1/1, +50 de premio), y el HUD marca 2, 5 y 7 kW según qué máquinas trabajan.

## Campaign-V2 · P6 · Documentación de la rama · 26 de noviembre de 2026

- `AGENTS.md` tiene una sección «Rama `Campaign-V2`» con lo que rige, dónde está el código, cómo se prueba la paridad y el balance, y cómo se publica. `CLAUDE.md` apunta a ella.
- `CONTEXT.md` deja de ser borrador y suma *Batalla propia*, *Unidad móvil* y *Minificha*.
- `PROGRESO.md` empieza ahora en Campaign-V2. Lo anterior, del 23-nov hacia atrás, está en `docs/historico/PROGRESO-hasta-2026-11-23.md`, con los enlaces relativos corregidos.
- El consolidado preprototipo del 23-nov lo aportó el autor y está en `docs/Vision/2026-11-23/DECISIONES-PREPROTOTIPO.md`.

## Campaign-V2 · Rueda y minador con modelo, cargas visibles y detonaciones · 26 de noviembre de 2026

La rueda kamikaze y el minador no tenían modelo: se dibujaban como la caja gris de un edificio. Ahora tienen modelos sencillos de colores planos (`vista-3d/cv2/moviles.js`):

- **WHL**: neumático con buje y radios rojos y un piloto ámbar que parpadea. Rueda sobre su eje al avanzar y mira hacia donde va.
- **MIN**: chasis de orugas oliva con franja ámbar delante y una tolva que enseña las cargas que le quedan (`cargas` entra en la escena desde `entidadesCampo`).

Las cargas sembradas eran la bolita de un misil. Ahora son un disco en el suelo con un piloto rojo que late, sin estela (`instancias-war.js`, solo para `carga: true`).

Las detonaciones no tenían efecto, porque `danoEnArea` solo anota golpes y derribos. Ahora `paso.js` anota una `explosion` por cada impacto del campo:

- la de la rueda y las cargas va marcada `carga` y usa la receta nueva `detonacion` (`vfx/recetas/war.js`): destello ancho, bola de fuego baja, aro de 2 m, restos y columna de humo, dentro de los límites del esquema;
- la del misil del vehículo usa la receta `impacto` de los misiles de War (antes tampoco tenía efecto).

Como en War, los efectos atribuyen a la explosión los derribos del mismo paso.

Pruebas: `vfx.mjs` (diez recetas, selección de `detonacion`, radio configurable) y `campaign-v2-rueda-minador.mjs` (una explosión por estallido y por carga). Se vio en el navegador la rueda en el carril de la B7, y el minador con sus cuatro cargas sembradas en la B8.

El laboratorio de VFX (`herramientas/laboratorio-vfx`) también enseña la detonación (`?receta=detonacion`). `vfx-calidad.mjs` sigue fijando el hash de las nueve recetas anteriores; la nueva se valida igual pero queda fuera del hash.

Otros arreglos del mismo paso:

- **Cabecera del editor:** «▸ Unidades · N» quedaba montado sobre el selector de lenguaje, porque el selector no cedía ancho. Ahora los botones de esa barra miden 30 px y caben enteros el rótulo y «JavaScript». Si falta sitio, cede primero el selector (hasta 7,8em) y después el rótulo, que se corta con puntos suspensivos (`campaign-v2.css`). Revisado a 1024 px, publicado, y en móvil.
- **Meta de piezas hechas:** decía «misil fabricadas en este hito». Ahora dice «{pieza} de este hito», sin participio que concordar, en el mismo estilo que «{pieza} en lotes».
- **Prueba de textos:** `campaign-v2-i18n.mjs` comprueba que español e inglés tienen las mismas claves, ningún texto vacío y los mismos `{parámetros}`. También comprueba que existe cada clave `cv2.…` escrita literalmente en el código.

## Campaign-V2 · B6–B8: las unidades móviles entran en la campaña · 26 de noviembre de 2026

Tras H5 vienen tres Batallas propias (`niveles/nivel-1/b6.js`, `b7.js`, `b8.js`). Antes H5 cerraba el nivel y su bodega no abastecía a nadie. Cada Batalla estrena una unidad que hasta ahora solo existía en su ensayo suelto, en el orden en que crecen las ideas de programación:

- **B6 · Fuera de la muralla** (vehículo VEH-01 y tirador): moverse con `moveTo` y esperar con `await arrive()`. Llegan orugas y un enjambre de 20 drones. Las torretas solas dejan pasar orugas porque persiguen drones. Se gana con el vehículo cazando drones fuera, o repartiendo el trabajo: torretas a por las orugas y vehículo a por los drones.
- **B7 · La rueda** (WHL-01): un bucle de espera sobre `nearest` y `detonate()`. Cinco orugas blindadas (7 de vida) en fila. La rueda reaparece y su programa vuelve a empezar.
- **B8 · Siembra** (MIN-01): `for…of` con `drop()` y la función registrada con `onDetonation`. Una columna de ocho orugas llega a los 16 s. Es la última Batalla y al ganarla aparece el cierre del nivel.

Las tres conservan las dos torretas y el sensor de la B5, así que los programas del jugador siguen valiendo. Los números se afinaron en Node con el intérprete real:

| Batalla | Brechas solo con torretas | Brechas con la unidad nueva | Máximo |
|---|---|---|---|
| B6 | 3 | 1 | 2 |
| B7 | 2 | 0 | 1 |
| B8 | 4 | 2 | 3 |

La B6 era frágil con solo más drones: según la cadencia, el vehículo no bastaba. Repartir el trabajo gana en todas las cadencias probadas, y esa es la pista. Los textos están en ES y EN (`cv2.b6.*`–`cv2.b8.*`). La B6 se llama «Fuera de la muralla» para no repetir el nombre del ensayo «Salida», que sigue en el menú.

Pruebas: `campaign-v2-batallas-propias.mjs` (nueva); se actualizaron contenido, secuencia, página, sesión y demo de fábrica para el nivel más largo. Se comprobó en el navegador que la B6 carga, su HUD (máximo 2, mínimo 14) y que el vehículo sale y dispara sin errores.

## Campaign-V2 · La velocidad 1× es real · 26 de noviembre de 2026

En el panel del navegador de Claude, la Batalla parecía ir a un tercio de la velocidad. Se midió en la B1 con una torreta en marcha:

- en el panel oculto, 10 s reales dan 4 s de juego;
- el panel oculto entrega 1,3 fotogramas por segundo, aunque el hilo principal está libre (sin tareas largas, `setTimeout(0)` en 5 ms) y la página se cree visible;
- `bucle.js` limita cada fotograma a 0,25 s de simulación (`Math.min(0.25, transcurrido)`), así que a 1 fps el juego va a 0,25–0,4×;
- con `requestAnimationFrame` sustituido por un reloj de 16 ms, 10 s reales dan 10 s de juego.

No se cambia nada. El tope evita que el juego salte hacia delante tras una pausa larga, y en un navegador normal una pestaña de fondo detiene los fotogramas del todo. Solo un equipo por debajo de 4 fps notaría el efecto.

## Campaign-V2 · Cámara a ras del suelo · 26 de noviembre de 2026

La cámara 3D de la fábrica y de las Batallas baja ahora hasta unos 17° sobre el suelo (`PITCH_RASANTE = .3` en `vista-3d/cv2/decorado.js`). Antes no pasaba de 45° (.78). Hay cuatro formas de inclinarla:

- el deslizador vertical de la derecha del campo (`interfaz/inclinacion.js`), que solo aparece en 3D y sigue a los gestos;
- Mayúsculas + rueda;
- dos dedos que suben o bajan juntos en el teléfono, distinguidos del pellizco y del giro (`modoDosDedos` en `vista-3d/camara.js`);
- el arrastre con la rueda pulsada (órbita), como siempre.

Cuanto más rasante es la cámara, más cerca empieza la niebla y más lejos acaba, para que el borde del mapa no se vea. La fábrica ya usaba la niebla de horizonte. La vista expone `inclinacion(valor?)` y `limitesInclinacion`. Los demás prototipos conservan su mínimo de .78.

Prueba: el deslizador entra en `campaign-v2-minificha.mjs`. Suite: **89 ok, 7 falla** (las mismas dependencias sin instalar). Se comprobó en el navegador:

- deslizador y Mayúsculas + rueda en la B1 (3D) y en la fábrica;
- 375×812;
- sin errores en la consola.

## Campaign-V2 · Fábrica al estilo Campaign 1 sobre el papercraft y minificha · 26 de noviembre de 2026

La fábrica ya no usa la planta antigua del trunk. La nueva vista `vista-3d/cv2/fabrica.js` tiene el mismo contrato que `crearCampaign3D` y la dibuja sobre el mapa papercraft, junto a la muralla y con su puerta. Cuelga de un gancho de una línea (`crearBase` en `vista.js`, aportado por `fabricaV2.crearVista3D`). Las máquinas siguen el lenguaje de los SVG de Campaign 1, copiados a `img/campaign/`:

- colores planos con contorno oscuro;
- prensa amarilla en H con ariete blanco;
- moldeadora morada con cilindros;
- mezcladora verde con rotor blanco;
- ensambladora turquesa con chevrones y franja de peligro;
- bandeja de entrada cian y de salida amarilla;
- consola con pantalla y piloto.

Los robots son el brazo azul con pinza blanca y el montacargas rojo. Las máquinas sin corriente se ven apagadas pero conservan su color. La losa tiene el pasillo con líneas amarillas, el borde de peligro y una baldosa de 1 m. Se asienta a la altura del relieve a medida que llegan las teselas.

La cámara es la de las Batallas. Encuadra solo la losa y deja pasear 5 m alrededor. La niebla de horizonte empieza detrás de la cámara.

Al elegir una unidad, la tira del inspector pasa a ser la **minificha** de Campaign 1 (`interfaz/minificha.js`). Aparece abajo a la izquierda, en la fábrica y en las Batallas, también en el teléfono, en lugar de la ficha completa. Muestra:

- el dibujo de la unidad;
- id, estado y clase;
- dos propiedades con su valor en vivo;
- tres órdenes como tokens con el rótulo corto.

Sus filas se toman de la ficha completa, así que coinciden con ella en contenido e idioma. Un clic en un token ya no abre la ficha. En el teléfono, los botones de vista ya no quedan tapados por «!».

El menú de pruebas tiene una sección nueva, **Fábrica por hito**. Abre H1–H5 con la planta que deja la demo automática (`datos/plantas-demo.json`, que genera `DEMO_PLANTAS=… node pruebas/campaign-v2-demo-fabrica.mjs`).

Prueba: `campaign-v2-minificha.mjs`. Suite: **89 ok, 7 falla** (las mismas dependencias sin instalar). Se comprobó en el navegador, en 800×600 y en 375×812:

- H0 y H5 se dibujan sin errores;
- la minificha aparece en la prensa, ARM-01, ASM-01, DEP-01 y LAU-01;
- el doble clic en `goTo()` lo inserta en el editor.

## Campaign-V2 · P5b · Rueda WHL, minador y menú de pruebas · 25 de noviembre de 2026

Hay dos mecánicas nuevas, cada una en su carpeta (`ficha.js` + `reglas.js`) y con una línea en el paso del campo. La **rueda WHL** es kamikaze: lee `nearest`, los metros hasta la oruga más cercana, y con `detonate()` estalla con daño en área. Al estallar desaparece y reaparece en casa, y su programa vuelve a la primera línea. El **minador** siembra cargas con `drop()` y lleva la cuenta en `charges`. Cuando un enemigo de suelo pisa una carga, esta estalla y avisa al programa con `onDetonation(carga)`, que da la posición y los enemigos alcanzados. Las cargas se dibujan como puntos sobre el carril. Las lecturas propias de una unidad ahora llegan al programa de forma genérica. Cada mecánica tiene su ensayo (`?ensayo=rueda`, `?ensayo=minador`), con programa de ejemplo en JS y Python y textos en es/en. Además, `index.html?pruebas=1` abre un **menú de pruebas** (`pruebas.html`) con un inciso por caso: B1–B5, las tres mecánicas, cámara y mando, campaña y paridad, y los otros prototipos. Cada inciso tiene «qué mirar» y, donde hace falta, un programa para copiar. Al final hay un botón para borrar solo el progreso de V2. La guía equivalente está en [MENU-PRUEBAS.md](docs/campaign-v2/MENU-PRUEBAS.md). Prueba: `campaign-v2-rueda-minador.mjs`. Suite: **88 ok, 7 falla** (las mismas dependencias sin instalar). Se comprobó en el navegador (puerto 8779) que los dos ensayos ganan. La rueda estalla a los 14,6 s, 25,3 s y 33,3 s, y reaparece 6 s después de cada estallido. El minador deja cuatro cargas visibles y la consola muestra cuatro «¡Carga! 1 enemigos». El menú carga sin errores y cabe en 375 px.

## Campaign-V2 · Cámara de las Batallas (alejar sin tope falso, zoom anclado) y mando táctil · 25 de noviembre de 2026

En móvil, y también en escritorio, el encuadre inicial quedaba más lejos que el tope de zoom (74 m y 49 m frente a 36 m). Por eso el primer pellizco o giro de rueda acercaba la cámara de golpe y ya no dejaba volver a alejarla. Ahora el tope nunca baja de 1,5 veces el encuadre. Para que al alejarse no se vean los bordes, las 10 teselas restantes del mapa se cargan después de las 6 del campo. El pellizco y la rueda dejan quieto el punto del suelo entre los dedos o bajo el cursor (`vista-3d/camara.js`). Además, si se tocaba la cámara antes del primer encuadre, se quedaba mirando un punto vacío; ahora el primer encuadre siempre la centra. Hay también un **mando táctil** para las Batallas (`interfaz/mando-tactil.js`), con tres partes:
- un joystick semitransparente abajo a la izquierda, que desplaza la cámara, con zona muerta y respuesta progresiva;
- los botones L y R en sus esquinas inferiores, que hacen de clic izquierdo y derecho;
- una zona de ratón a la derecha que mueve un cursor.

Los clics llegan al lienzo como eventos de ratón, así que reutilizan la selección, el recuadro (L mantenido mientras se arrastra en la zona), apuntar arrastrando y las órdenes puntuales con R. Se muestra solo en pantallas táctiles, o con `?mando=1`, y el botón 🕹/✕ recuerda si estaba oculto. Prueba: `campaign-v2-mando.mjs`. Suite: **87 ok, 7 falla** (las mismas dependencias sin instalar). Se comprobó en el navegador en 375×812 y 1280×760: L selecciona y deselecciona, el recuadro aparece, R deja «Orden puntual» en la consola y el joystick mueve la cámara.

## Campaign-V2 · Misión 1 jugable: seis hitos de fábrica entre las Batallas · 25 de noviembre de 2026

La misión del autor ya se puede recorrer entera: H0 → B1 → H1 → … → B5 → H5. Cada hito de fábrica abre la página como una sesión de la serie Campaign sobre la planta del nivel, con el HUD de V2 (misión, metas, checkpoints, idioma) y el botón «Mover» para colocar tarimas, máquinas y brazos. Entre hito y Batalla la página se recarga desde el checkpoint, y durante la Batalla la planta sigue trabajando y abastece la bodega. La fábrica corre sobre el motor compartido `paquetes/fabrica`, extraído de `reglas-campaign` (cierra el ticket 04.3). Sus mecánicas son el brazo anclado con alcance, la zona de tarimas de la mezcladora, la tarima de salida y el umbral de energía de la ensambladora. Se corrigió un fallo que también tenía el Campaign del trunk: en una planta restaurada con t > 0 cada orden esperaba ese tiempo entero antes de aplicarse (`app/conductor.js`). La suite de Node dio **86 ok, 7 falla**, y los fallos son todos de dependencias sin instalar (`typescript`, `playwright`, `@electron/packager`). Las regresiones de War, Factory y Campaign pasan. `campaign-v2-demo-fabrica.mjs` juega los seis hitos en la página con programas escritos como los del jugador. Se comprobó en el navegador real (puerto 8779): H0 → B1 → H1, el HUD, el colocador, el menú de checkpoints y la vuelta a H0. Las Batallas B2–B5 seguidas de su hito no se jugaron en el navegador. [Misión 1](docs/campaign-v2/MISION-1.md) · [motor compartido](paquetes/fabrica/README.md).

## Campaign-V2 · Jugabilidad del recorrido y decorado · 25 de noviembre de 2026

H0 ya no sale en negro: una regla de `campaign-v2.css` dejaba su campo en 0 px. Entre Batallas aparece una tarjeta con el resultado, la Batalla siguiente y la bodega, y la simulación espera hasta «Continuar». Tras B5 hay un cierre del nivel con reinicio de campaña, comprobado solo por código. H0 tiene velocidad 1×/4×. Astra (T10, `codex-astra`, 11 llamadas, 5 % de la ventana) calculó las teselas (6), el tope de zoom (36 m) y 47 piezas del kit en `vista-3d/cv2/decorado.js`, con su prueba. La suite de Node dio **83 ok, 7 falla, 0 omitida**, con los siete fallos de base. Se comprobó en navegador real (puerto 8779, pane oculto): H0 visible, victoria en B1 → tarjeta → B2, y derrota en B3 con el selector de checkpoint. Queda decidir con el autor qué se hace en los hitos de fábrica. [Revisión frente al grill y el wayfinder](docs/campaign-v2/REVISION-2026-11-25.md).

## Campaign-V2 · Página propia · 24 de noviembre de 2026

El prototipo abre H0, B1–B5 y Salida desde `Prototypes/Campaign-V2/`. El editor, el idioma y el modo revisión usan almacenamiento propio. H0 conserva los checkpoints de P2 y su fábrica vive en el reglamento V2. Rocket Launcher conserva el acceso antiguo mediante redirección. La suite de Node dio **82 ok, 7 falla, 0 omitida**. Las fronteras de War, Factory y Campaign pasaron. El arranque y los controles se comprobaron en DOM emulado. Queda la revisión visual de Claude en el puerto 8779. [Informe de la porción](docs/campaign-v2/PAGINA-INFORME.md).

## Campaign-V2 · P5a · Movimiento, VEH y tirador · 24 de noviembre de 2026

En Salida, VEH-01 cruza la puerta, espera la llegada y derriba drones con un proyectil de V2. El tirador puede destruirlo. El árbol muestra la reposición y el intérprete vuelve a la primera línea de la fuente vigente. Cada pieza ocupa dos archivos propios, una importación y una llamada explícita en el paso. La primera integración requirió además cambios en el anfitrión, el editor y ambas vistas. La suite dio **81 ok, 7 falla, 0 omitida**, con los siete fallos de base. Se verificaron JS y Python, la conversión de Seudo, el árbol en DOM emulado y la escena de Three con GLB locales. El puerto 8771 quedó bloqueado para la revisión en navegador. P5b recoge WHL, minador y menú de pruebas. [Coste real y ensayo local](docs/campaign-v2/P5a-INFORME.md).

## Campaign-V2 · P4b · UI del primer hito · 24 de noviembre de 2026

El árbol comparte selección con el mapa y guarda los programas vinculados en los checkpoints. H0 y Batalla tienen Misión y metas en vivo. La ficha completa muestra el modelo en rotación y los enemigos muestran su vida en ambas vistas. La cámara incluye los bastiones y la entrada, también en vertical. La suite de Node dio **80 ok, 7 falla, 0 omitida**, con los siete fallos de base. Se comprobaron controles en DOM emulado, proyecciones con GLB reales y vistas rasterizadas por software. Queda revisar la disposición final en navegador a 375 × 812 y en PC. [Informe de P4b, supuestos y enlaces de QA](docs/campaign-v2/P4b-INFORME.md).

## Campaign-V2 · P4a · Escenario 3D en metros · 24 de noviembre de 2026

H0 y las Batallas de campaña y ensayo muestran la fábrica y el frente de Traba en metros. La torreta sigue el objetivo con el rig del GLB. El colocador funciona en el plano y en 3D, antes de ejecutar y en pausa. Las pruebas de Node dieron **79 ok, 7 falla, 0 omitida**, con los siete fallos de la línea base. El cargador y los rayos de Three se comprobaron con los GLB reales y el renderer emulado. Quedan la revisión visual y la reubicación de la losa horneada. P4b recoge la UI del primer hito. [Informe de P4a y enlaces locales](docs/campaign-v2/P4a-INFORME.md).

## Campaign-V2 · P4a lógica y daño de War · 24 de noviembre de 2026

Las vistas de V2 ya tienen la escena en metros (`escenaMetros`): la Batalla se traslada en (204, 72) y la fábrica de H0 en (103, 22). La escena de War, la instantánea y las huellas siguen en casillas. El Nivel 1 declara tres bastiones, que coinciden con los puestos de War, y el validador los comprueba. La orden `colocar` mueve una torreta a un bastión libre: si la Batalla no ha empezado, la vuelve a montar con la misma semilla; si ya corre, vale para la siguiente y entra en el checkpoint. En paridad no existe. War expone `leerEnemigos` y `danoEnArea` para las mecánicas de P5a; sin llamarlas, las referencias no cambian. La suite de Node dio **78 ok, 7 falla, 0 omitida**, con los siete fallos conocidos. P2, P3a y P3b se revisaron en navegador real con un servidor sin caché. La vista 3D de P4a queda para Astra ([brief](docs/campaign-v2/BRIEF-P4a.md)).

## Campaign-V2 · P3b · Eventos y gestos · 24 de noviembre de 2026

En campaña y ensayo, cada torreta entrega el clic a su programa o reserva un disparo puntual. La repetición conserva los clics y vuelve a ejecutar sus oyentes. JS, Python y Seudo comparten las fichas de eventos. La suite de Node dio **75 ok, 7 falla, 0 omitida**, con los siete fallos conocidos. El recorrido de editor, mapa, icono y consola pasó en emulación. Queda pendiente la revisión visual en navegador real por la denegación del puerto 8771. [Informe y pruebas de P3b](docs/campaign-v2/P3b-INFORME.md).

## Campaign-V2 · P3a · Runtime base · 24 de noviembre de 2026

Campaña y ensayo aíslan los errores por unidad, permiten aplicar el programa durante la batalla y registran las órdenes y recargas al salir de pausa. El último intento se puede repetir con su semilla desde el checkpoint o el inicio del ensayo. En paridad el error termina la partida como en War. La suite de Node dio **72 ok, 7 falla, 0 omitida**, con los siete fallos conocidos. El recorrido por los controles y la consola pasó con DOM emulado. Queda pendiente el contraste en navegador real porque el entorno denegó el puerto 8771. P3b recoge los eventos y el clic programado. [Informe y prueba manual de P3a](docs/campaign-v2/P3a-INFORME.md).

## Campaign-V2 · P2 · Fábrica, puente y checkpoint · 24 de noviembre de 2026

H0 produce munición y abre B1. La fábrica y la bodega continúan entre batallas, con un checkpoint por hito. El plano 2D de Campaign muestra H0. Las 12 referencias de paridad de War coinciden y las 41 referencias previas del archivo conservan sus datos. La suite de Node dio **68 ok, 7 falla, 0 omitida** con los siete fallos conocidos. El recorrido de pantalla se comprobó en emulación. El entorno denegó el puerto 8771 para el navegador real. P3 recogerá la semilla de intento en la grabación. [Informe de P2](docs/campaign-v2/P2-INFORME.md).

## Campaign-V2 · P1 · Esqueleto y paridad · 24 de noviembre de 2026

Las cinco Batallas del Nivel 1 se ejecutan por el reglamento V2 con War inyectado. Las diez partidas de referencia coinciden en huella, pasos y resultado completo. La suite de Node dio 65 ok y los siete fallos de la línea base. Las tres rutas arrancaron en 2D y 3D emulados. El entorno denegó el puerto 8771 para el contraste en navegador real. La siguiente porción es P2, fábrica, puente y checkpoint. [Informe de P1](docs/campaign-v2/P1-INFORME.md).

## Antes de Campaign-V2

Lo anterior al 24 de noviembre de 2026 (trunk, fases 0–5, unificación y rama `assets-3d`) está en [docs/historico/PROGRESO-hasta-2026-11-23.md](docs/historico/PROGRESO-hasta-2026-11-23.md).
