# Muralla de vóxeles

Sistema de vóxeles **solo para la muralla**: el terreno sigue siendo el relieve de cada serie. Sirve para ampliar la muralla, ponerle capas y subirla construyendo paredes. Los golpes le abren huecos, y lo que pierde apoyo cuelga de una bisagra o cae y queda como escombro; luego se repara. Estado al 19 de noviembre de 2026: **núcleo, adaptador 3D, laboratorio y pruebas en la rama `muralla-voxeles`; ningún juego lo carga todavía**. La primera versión, sin derrumbe, también quedó en `vfx-vehiculo-tubular` (`a2b2333`). El destino es Campaign (rama `campaign-nivel-1`), donde hoy la muralla son cajas instanciadas de 2 m.

| Archivo | Qué hace |
| --- | --- |
| `shared/muralla/voxeles.js` | Núcleo sin DOM ni dependencias: rejilla, ejes, paredes, obras, romper/reparar, apoyos, piezas y escombro, consultas, guardado y malla. `window.CMGMuralla` (y `module.exports` en node). |
| `shared/muralla/vista-three.js` | Adaptador para Three r128: una malla por trozo, solo rehace los que cambian; el plano translúcido aparte; una malla por pieza en movimiento. `window.CMGMurallaVista`. |
| `herramientas/muralla/` | Laboratorio con el trazado del nivel 1 de Campaign. Fuera del juego y del paquete de Netlify. |
| `pruebas/muralla-voxeles.cjs` | 94 comprobaciones de node. |

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
