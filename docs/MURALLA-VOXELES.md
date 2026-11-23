# Muralla de vóxeles

Sistema de vóxeles **solo para la muralla**: el terreno sigue siendo el relieve de cada serie. Sirve para ampliar la muralla, ponerle capas y subirla construyendo paredes. Los golpes le abren huecos, y lo que pierde apoyo cuelga de una bisagra o cae y queda como escombro; luego se repara. Estado al 19 de noviembre de 2026: **núcleo, adaptador 3D, laboratorio y pruebas en la rama `muralla-voxeles`; ningún juego lo carga todavía**. La primera versión, sin derrumbe, también quedó en `vfx-vehiculo-tubular` (`a2b2333`). El destino es Campaign (rama `campaign-nivel-1`), donde hoy la muralla son cajas instanciadas de 2 m.

| Archivo | Qué hace |
| --- | --- |
| `shared/muralla/voxeles.js` | Núcleo sin DOM ni dependencias: rejilla, ejes, paredes, obras, romper/reparar, apoyos, piezas y escombro, consultas, guardado y malla. `window.CMGMuralla` (y `module.exports` en node). |
| `shared/muralla/vista-three.js` | Adaptador para Three r128: una malla por trozo, solo rehace los que cambian; el plano translúcido aparte; una malla por pieza en movimiento. `window.CMGMurallaVista`. |
| `herramientas/muralla/` | Laboratorio con el trazado del nivel 1 de Campaign. Fuera del juego y del paquete de Netlify. |
| `pruebas/muralla-voxeles.cjs` | Pruebas de reglas, guardado, geometría y raycast en Node. |

Abrir el laboratorio con el servidor del README: `http://localhost:8770/herramientas/muralla/` (`?tam=0.25` cambia el tamaño del vóxel).

## Conceptos

- **Rejilla.** Dispersa, en trozos de 16 × 16 × 16 vóxeles, con índices negativos. Un byte por vóxel: 0 vacío, 1–3 material, 4–6 su escombro. Vóxel de 0,5 m por omisión (configurable).
- **Eje.** Una polilínea guía con nombre, en metros del mapa (x este, y sur). La muralla del boceto es el eje `principal`.
- **Pared.** Una banda alrededor de un eje: `s0..s1` es la distancia lateral con signo, `z0..z1` la altura y `u0..u1` el tramo a lo largo del eje. `s` es positiva a la izquierda del avance; en el boceto, hacia el campo de batalla (el mismo criterio de «dentro» que `campaign-terreno.js`). Puede llevar almenas en un borde. Los extremos del eje son planos: la pared no se redondea más allá.
- **Capa.** Otra pared sobre el mismo eje con la banda contigua: `capa(eje, "fuera" | "dentro", grosor)` devuelve la banda y la altura actual. Las bandas son semiabiertas, así que dos capas contiguas no se solapan ni dejan hueco (lo comprueba la prueba).
- **Hilada.** Otra pared encima de todo el ancho: `hilada(eje, alto)`.
- **Ampliar.** `ampliar(eje, punto)` alarga el eje y planea el tramo nuevo de cada pared que llegaba al final; la unión queda cerrada.
- **Pared nueva.** Un eje propio (dos o más puntos) y una pared sobre él.
- **Obra.** Lo que falta de una pared, en orden de construcción: tramos de 2 m a lo largo del eje y, dentro de cada uno, de abajo arriba. `avanzar(n)` coloca los n siguientes de la primera obra de la cola; saltar un vóxel ya lleno no gasta. Lo pendiente está en otra rejilla, el **plano**, que la vista dibuja translúcido.
- **Romper.** `romper(x, y, z, radio, poder, { t, escombros, derrumbe })`: cada vóxel recibe `poder · (1 − d/radio)` en su centro y cae si supera la resistencia de su material. Después actúan la onda y el derrumbe (abajo). Devuelve los vóxeles caídos con su material, los restos lanzados, las piezas nuevas y las que se soltaron.
- **Reparar.** Volver a planear las paredes: entran los vóxeles vacíos y los de escombro que quedaron dentro de la pared, con el material de cada pared. El escombro de fuera se queda (limpiarlo sería otra obra).

## Destrucción en tres capas

Inspirada en la temporada 12 de THE FINALS (ver abajo). Todo se calcula **al golpear**, nunca en cada fotograma:

1. **Integridad.** Cada vóxel necesita un camino hasta el suelo. Subir o bajar no cuesta; cada paso en horizontal gasta **voladizo** del material (piedra 1,5 m, hormigón 3 m, acero 6 m, provisionales). Es una búsqueda en anchura por niveles sobre la rejilla: un túnel de 4 m tumba el dintel de piedra y el de acero aguanta.
2. **Destrucción gradual.** Lo que pierde el apoyo no desaparece: se agrupa en piezas (islas conectadas) que salen de la rejilla.
   - **Colgada de un lado** (voladizo): gira sobre una bisagra en el canto de abajo de la unión. Si la unión es ancha (cada cara de unión sostiene 10 vóxeles), se queda **colgando** a 8–30° y se mece hasta calmarse. Un golpe cerca, o perder su unión, la suelta.
   - **Sujeta por los dos lados o suelta** (dintel): se hunde recta hasta lo que tenga debajo.
   - La pose es una fórmula del tiempo (`pose(p, t)`, `matrizPieza(p, t)`): la vista mueve una malla con una matriz y no rehace geometría. El ángulo final se busca una vez, en pasos de 3°, hasta tocar el suelo o la muralla.
3. **Escombro.** Al terminar de caer (`paso(t)`), la pieza vuelve a la rejilla como escombro en su pose final: un tramo tumbado queda como rampa y el dintel tapa el túnel. El escombro es estático: no entra en el cálculo de apoyos.
   - **Onda.** Una fracción de lo roto (35 % por omisión, por hash de la posición) cae lejos del centro según el poder y se amontona al pie de la muralla. Nunca flota.

`t` es el tiempo de la simulación. En el juego lo da el paso fijo; en el laboratorio, su propio reloj (que la pausa detiene).

## Reglas que conserva

- **Determinismo.** Sin `Math.random` ni reloj; la prueba los sustituye por funciones que fallan. La variación de tono es un hash de la posición del vóxel. Misma secuencia de órdenes, mismo resultado y mismo guardado.
- **Paso fijo.** El núcleo no mide tiempo: quien lo use decide cuántos vóxeles coloca por paso. El ritmo del laboratorio (vóxeles por segundo con el reloj de la página) es solo del laboratorio.
- **Coordenadas.** El núcleo trabaja en metros del mapa; la malla sale en coordenadas de Three (X = x, Y = altura, Z = y), las de la vista 3D de Campaign.
- **Interacción.** El adaptador acepta `seleccionable: false` para quitar el raycast, como los demás adornos de Campaign. El plano nunca es seleccionable.

## API

```js
const M = CMGMuralla.crear({ tam: .5, origen: [0, 0, 0] });   // origen en metros del mapa (x, y, z)
M.eje("principal", MAPA.muralla);
M.construir({ eje: "principal", s0: -.75, s1: .75, z0: 0, z1: 3.5, material: "piedra", almenas: { alto: .5, paso: 1 } });
M.planear({ ...M.capa("principal", "fuera", 1), material: "hormigon" });   // obra; avanza con M.avanzar(n)
M.planear({ ...M.hilada("principal", 1), material: "acero" });
M.ampliar("principal", [40, 92.8]);
M.romper(x, y, z, 1.3, 1, { t });  M.paso(t);  M.reparar();   // t: tiempo de la simulación
M.altoEn(104.5, 47);        // cima de la muralla en ese punto (torretas), o null
M.huella();                 // columnas para el plano 2D: { x, y, lado, alto, material }
const datos = M.serializar(); const copia = CMGMuralla.cargar(datos);

const vista = CMGMurallaVista.crear(THREE, M, { seleccionable: false, paleta, colorPlano });
escena.add(vista.grupo);    // en cada fotograma: vista.actualizar(t)
```

Otras: `apoyo()`, `derrumbar(t, golpe)`, `piezas`, `pose(p, t)`, `matrizPieza(p, t)`, `completar(obra)`, `cancelar(obra)`, `obrasResumen()`, `solido(x, y, z)`, `indice`, `centro`, `estadisticas()`, `largo(eje)`; en la vista, `verPlano(sí)`, `ponerPaleta(lista, colorPlano)` (por piel), `voxelDe(hit)` y `liberar()`.

**Guardado** (`formato: "cmg-muralla", v: 2`; carga también la `v: 1`): ejes, paredes, obras con lo que les falta, piezas colgadas o cayendo y los trozos en pares `[material, repeticiones]`. La muralla del boceto con dos capas, una hilada, una pared nueva y reparaciones ocupa unos 29 KB en JSON; con una capa de acero a medias, unos 42 KB, porque cada obra guarda la lista de lo que le falta.

## Medidas (esta nube, CPU)

| Vóxel | Muralla del boceto | Trozos | Caras | Malla completa |
| --- | --- | --- | --- | --- |
| 0,5 m | 4 589 vóxeles | 22 | 4 998 | ~20–30 ms (node y Chromium) |
| 0,25 m | 36 290 vóxeles | 50 | 19 840 | ~60 ms (Chromium) |

Al construir o romper solo se rehacen los trozos tocados: 1–3 ms por cambio a 0,5 m. El cálculo de apoyos de la muralla con dos capas cuesta 3,5 ms a 0,5 m (7.564 vóxeles) y 30 ms a 0,25 m (60.328), una vez por golpe. Las piezas en movimiento cuestan una matriz por fotograma. Los fotogramas por segundo de SwiftShader no representan un teléfono; falta medir en los dispositivos reales.

## Tensión visible

El tinte indica cuánto voladizo ha consumido cada vóxel sólido. La proporción es el coste del camino al suelo en pasos horizontales dividido por el límite de su material en pasos. Una columna continua hasta el suelo queda a nivel 0. Al agotar el voladizo, o si la obra aún carece de camino al suelo, llega a nivel 4. Con un límite de cero pasos solo queda sin teñir el coste cero.

| Nivel | Proporción | Mezcla de rojo | Oscurecimiento |
| --- | --- | ---: | ---: |
| 0 | Menor que 1/2 | 0 % | 0 % |
| 1 | Desde 1/2 hasta antes de 2/3 | 16 % | 3 % |
| 2 | Desde 2/3 hasta antes de 5/6 | 30 % | 6 % |
| 3 | Desde 5/6 hasta antes de 1 | 45 % | 9 % |
| 4 | Límite alcanzado | 60 % | 12 % |

La piedra de 0,5 m usa la escala discreta indicada para ese caso. Sus costes 0, 1, 2 y 3 dan los niveles **0, 1, 3 y 4**. La pieza que cuelga toma nivel 4 y su bisagra eleva cada soporte al menos a 3. El escombro y el plano conservan su color. La mezcla con `0xd8452f` y el oscurecimiento se aplican antes de la oclusión, en los colores de vértice existentes. Cada piel puede elegir el rojo con `paleta.colorTension` al llamar a `ponerPaleta`.

| Vóxel | Celdas ocupadas tras el golpe, dos capas | Tensión con apoyos reutilizados | Tensión incluida la búsqueda |
| --- | ---: | ---: | ---: |
| 0,5 m | 7 412 | 0,7 ms | 4,0 ms |
| 0,25 m | 59 202 | 4,1 ms | 31,3 ms |

Medianas de nueve cálculos en Node 22 en CPU, sin mallado. Tras un golpe se reutilizan los apoyos del derrumbe. Las lecturas sucesivas de `tension()` devuelven el mismo mapa hasta que cambia la rejilla o se suelta una bisagra. Un cambio de nivel solo ensucia el trozo que contiene el vóxel.

En el laboratorio, `?demo=tension` abre los tres daños con la cámara encuadrada y la simulación en pausa. La casilla **Ver tensión** o `?tension=0` permiten comparar la misma escena. El recuento incluye los sólidos de la rejilla y las piezas colgadas. El guardado conserva el formato v2. Para la fase 2 queda calcular el peso sostenido por cada columna y combinar su nivel con el actual tomando el máximo.

En CPU pasaron 153 comprobaciones de muralla y 124 de interacción. Se comprobaron los colores de vértice de paisaje y batalla y el encuadre de la demo a los tres tamaños de vóxel. Queda pendiente la inspección visual en WebGL.

## Material procedural

La casilla **Textura procedural** arranca activada. `?textura=0` muestra los colores de vértice originales y se puede combinar con `?demo=tension` para comparar el mismo daño en pausa.

| Material | Acabado |
| --- | --- |
| Piedra | Sillares de 0,86 × 0,38 m a media pieza, mortero de 18 mm, bisel, tono por sillar y manchas suaves. La coronación usa piezas de 1,1 × 0,55 m para distinguir la hilada que remata el muro. |
| Hormigón | Paneles de 1,2 × 0,6 m con junta fina, cuatro huellas de latiguillo por panel y vetas verticales. |
| Acero | Las chapas de blindaje llevan la costura en el perímetro del módulo de 1 × 1 m y cuatro remaches por canto. El acero en vóxeles de partidas antiguas conserva el patrón de 1 × 2 m. |
| Escombro | Grano de mayor contraste, con un tono medio más oscuro y sin juntas. Conserva la paleta del material del que procede. |

Con textura, el laboratorio baja al 20 % la variación de tono por vóxel (`paletaPara`): el tono lo pone cada sillar, y la variación completa dibujaba la rejilla de 0,5 m debajo del aparejo.

Cada cara elige un plano según su normal y usa la posición de objeto en metros. Así las hiladas cruzan los límites de los vóxeles y los trozos, y viajan con la matriz de una pieza que cuelga o cae. El fragmento usa la precisión `highp` que selecciona Three r128. En equipos limitados a `mediump` o `lowp` se usa el color Lambert de vértice para conservar el tinte de tensión y evitar juntas inestables a 200 m.

**Caras de rotura.** Una cara expuesta que mira a una celda prevista por alguna pared lleva el atributo de vértice `rotura = 1`. La piedra muestra un corte más claro, grano de 55 mm y grietas discontinuas de 7 mm. En el hormigón asoma árido de unos 45 mm. El exterior previsto, incluidos los entrantes de las almenas, conserva su aparejo. La consulta `enPared(i, j, k)` reúne las paredes en una caché con el mismo recorrido que las obras. Se reconstruye en la primera consulta tras añadir una pared, modificar su eje, encargar blindaje o cargar la partida. Un golpe puede reutilizarla.

**Bordes y cascajo.** Cada vértice consulta las ocho celdas que lo tocan. Si entre ellas hay pared sólida y un vacío previsto, se desplaza hasta **0,18 vóxeles por eje** (`BORDE_ROTURA`). En el cascajo libre se permiten **0,22** (`BORDE_CASCAJO`; con 0,30 parecía cristal oscuro). En el contacto manda la pared. El cascajo adopta la posición plana de la pared sana o su mismo desplazamiento si ya estaba rota. Los tres componentes proceden de un hash entero del vértice en la red global. Cada trozo puede reconstruir su lado de la unión por separado. Un cambio en una esquina ensucia hasta ocho trozos. La normal de una cara desplazada suma las normales de sus dos triángulos ponderadas por área. Las demás conservan su normal axial.

**Chapa abollada.** La cara visible tiene 8 × 8 divisiones y alcanza **12 cm** en el centro de un golpe de intensidad máxima. La vista usa la marca que ya guardaba el panel, vuelve a calcular sus normales y oscurece el centro hasta un 26 %. En la cara frontal falta el remache más cercano al impacto. El id del panel desempata a igualdad de distancia. Las UV locales sitúan la costura en los cuatro bordes, también al colgar o caer. La selección de trozos deformados y chapas abolladas usa su superficie lógica anterior.

**Comparación en el laboratorio.** `?demo=rotura` abre en pausa un encuadre de tres cuartos con túnel, montón y chapa. **Bordes de rotura** está activado por omisión. La casilla o `?rotura=0` permiten comparar el túnel y el cascajo. Al alternar la casilla, «Malla sólida completa» conserva los dos tiempos de reconstrucción de los trozos de la misma escena, incluidos los buffers de Three. El tiempo de la última actualización parcial sigue en las estadísticas generales.

**Coste en CPU.** En Node 22.19, el boceto a 0,5 m tenía 4 589 vóxeles y 4 998 caras intactas. Antes del cambio la mediana de mallarlo era 3,6 ms. Con un túnel y escombro, la mediana de nueve mallados completos fue **3,9 ms con bordes apagados y 6,2 ms con bordes activos**. La primera consulta del volumen intacto costó unos 20 ms aparte. Estas medidas corresponden al núcleo con la caché caliente durante el mallado. La vista añade un byte de rotura por vértice de vóxel y conserva una sola llamada de dibujo por trozo. Queda pendiente medir el sombreado en GPU y en teléfono.

**Superficie suave.** Surface Nets exigiría extraer una superficie nueva de un campo de densidad. Habría que definir ese campo, compartir muestras y normales entre trozos, decidir cómo rematar las uniones entre materiales y mantener la correspondencia con el vóxel seleccionado. El acabado actual conserva las caras y sus índices, lo que permite preservar exactamente la malla de la sillería intacta.

## Blindaje de acero

En el laboratorio, **Blindaje → Capa por fuera / por dentro** encarga chapas sobre el eje activo. La demo `?demo=blindaje` abre en pausa con un golpe sobre chapa y otro idéntico sobre piedra expuesta. **Seguir** reanuda el balanceo.

`blindar({ eje, lado, u0, u1, z0, z1, panel, grosor })` llena el tramo con módulos completos. Conserva el tamaño pedido y deja libres las franjas finales donde ya no cabe un módulo. En el boceto caben 106 por hilada y tres hiladas de 1 m. Cada panel sigue la cuerda de la guía desplazada. Si un anclaje sobresale de la banda por la forma escalonada de los vóxeles, el montaje adelanta la chapa para mantener la holgura. Al ampliar el eje, se puede encargar el tramo nuevo con el mismo botón.

Las constantes provisionales están en `BLINDAJE`. El módulo mide **1 × 1 m**, tiene **8 cm de grosor**, deja **4 cm de holgura** y consume **4 unidades de obra**. Al colocarlo se buscan centros de vóxel sólido dentro de su huella y a menos de **1,5 vóxeles** de la cara interior. La obra informa de los módulos omitidos por falta de anclajes. Cada impacto que supera **0,3** de resistencia acumula su energía local. La chapa absorbe el **70 %** en los trayectos del golpe que cruzan su cara desde fuera. Se usa la posición que tenía al llegar el golpe, incluido el que la suelta.

| Estado | Comportamiento |
| --- | --- |
| Fijo | Permanece atornillado con al menos la mitad de los anclajes originales. |
| Abollado | Desde 0,8 de daño conserva el centro y la profundidad de la marca. La vista aplica la marca sobre 8 × 8 divisiones, con tinte de tensión 2. |
| Cuelga | Con menos de la mitad de los anclajes y todos en el lado izquierdo, derecho o superior, gira sobre ese borde con tinte 4. Los apoyos repartidos aún lo sujetan. |
| Cae | Al sumar 1,6 de daño, perder el último anclaje o recibir otro golpe mientras cuelga, gira y baja desde la pose actual. |
| Suelo | La chapa descansa entera sobre su cara posterior y conserva su matriz final. |

El guardado **cmg-muralla v3** conserva la definición de cada chapa, anclajes iniciales (cantidad) y restantes (celdas), daño, abolladura, estado y parámetros de pose. Una obra pendiente conserva sus paneles y el crédito del módulo a medio montar. Las versiones 1 y 2 siguen cargando paredes y obras de acero en vóxeles con sus reglas originales. Para las paredes nuevas, el laboratorio ofrece piedra y hormigón.

## Inspiración: THE FINALS, temporada 12

La temporada 12 («PRIME TIME», 20 de octubre de 2026) añadió una capa de **destrucción gradual** entre la integridad de los edificios y los escombros. Los edificios se doblan, se inclinan y cuelgan en vez de caer enteros al pasar el umbral. Además trajo ondas expansivas que empujan restos, montones de escombro persistentes, estructuras suspendidas que se mecen, humo que respeta la geometría rota y un solver estático de roturas más rápido. Sus detalles internos no son públicos: lo de abajo es una lectura de lo que se ve, adaptada a una rejilla determinista. No es una copia.

| En THE FINALS | Aquí | Coste |
| --- | --- | --- |
| Solver estático de integridad con reparto de carga | Camino al suelo con voladizo por material | Búsqueda en anchura al golpear: 3,5 ms a 0,5 m |
| Capa gradual: bisagras, pisos que se hunden, piezas que se inclinan | Piezas con bisagra que cuelgan o se hunden; pose analítica | Una matriz por pieza y fotograma |
| Estructuras suspendidas que se mecen antes de ceder | La pieza colgada se mece y cede con el siguiente golpe | Una fórmula (seno amortiguado) |
| Onda expansiva que empuja restos | Parte de lo roto sale despedida según el poder | Al golpear, proporcional a lo roto |
| Montones de escombro persistentes (también al unirse a la partida) | Escombro en la rejilla, en el guardado y en los checkpoints | Ninguno extra: son vóxeles |
| Destrucción en el servidor, una sola verdad | Simulación con paso fijo y lockstep, sin azar global | Ninguno extra |

**Descartado por caro o por no servir a una muralla:** física de cuerpos rígidos con colisiones entre piezas (aquí, pose analítica y búsqueda del ángulo final), deformación y flexión de mallas, humo volumétrico que se adapta a la geometría (más adelante, como mucho, partículas que consulten `solido()`) y piezas colgadas de cuerdas o cables.

Fuentes: [Update 12.0.0, THE FINALS Wiki](https://www.thefinals.wiki/wiki/Update:12.0.0), [KitGuru](https://www.kitguru.net/gaming/joao-silva/embark-studios-reveals-major-destruction-system-update-for-the-finals/), [MMOHuts](https://mmohuts.com/news/the-finals-season-12-overhauls-destruction-and-adds-solo-showdown), [GDC 2024: Engineering Mayhem](https://schedule.gdconf.com/session/engineering-mayhem-technical-deep-dive-into-environmental-destruction-in-the-finals/900179).

## Plan para Campaign

Sin cambiar reglas de Campaign hasta que se decida (VISION-CAMPANA §7 deja pendientes costes, resistencia, construcción y reparación):

1. **Solo vista.** En `campaign-3d.js`, sustituir `muro` y `almenas` (InstancedMesh) por `CMGMurallaVista` con el eje `MAPA.muralla` y la misma banda de 1,5 m × 3,4 m. Para enterrar el cimiento, `origen` con z negativa o una pared de `z0 = −2`. La paleta sale de `conPiel` para las dos pieles. Las torretas leen `altoEn` en vez de `MURO.alto`. En el plano 2D, `huella()`.
2. **Estado del mundo.** La muralla entra en la simulación y en los checkpoints con `serializar()`/`cargar()`. Cada paso fijo decide cuántos vóxeles coloca según robots y material; los misiles enemigos llaman a `romper` con el tiempo de la simulación y `paso(t)` asienta las piezas. Los restos lanzados y las piezas pueden alimentar los VFX de `docs/PLAN-VFX.md`, sin entrar en las reglas.
3. **Programas.** Encargos para planear y construir paredes (capa, hilada, ampliar, reparar) y una lectura del estado de la muralla. Requiere diseñar la API y documentarla en el reglamento.

## Pendiente

- Costes, resistencias y ritmos de juego: los del laboratorio son provisionales.
- Animar el vuelo de los restos que lanza la onda (hoy aparecen ya en el montón) y el polvo del derrumbe.
- Decidir si el escombro sirve de rampa a los enemigos y si se limpia con una obra.
- Puertas y huecos planeados (pared con tramos vacíos), escaleras o rampas para subir unidades.
- Fusión de caras coplanares (greedy meshing) si el coste de GPU lo pide a 0,25 m.
- Medir en teléfono y en Safari. Revisión visual del usuario en el laboratorio.
