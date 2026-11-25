# Decisiones del wayfinder de Campaign-V2 (23–24 nov 2026)
Fuente: los tickets resueltos del mapa local. Cada sección es la pregunta y su respuesta. Los valores de juego (alcances, vidas, cadencias) son experimentales.

## 01 · Línea base: cuánto cuesta hoy en trunk añadir un reto, una orden, un evento y un tipo de unidad

Medido sobre `origin/trunk` (sin ejecutar pruebas). Detalle y citas por archivo y línea: [research/01-linea-base-coste-trunk.md](../research/01-linea-base-coste-trunk.md).

| Caso | Archivos tocados | Paquetes | Líneas (archivos enteros) | Mínimo funcional | Suites afectadas |
|---|---|---|---|---|---|
| 1 Reto War nuevo | 2 (`reglas-war/retos.js`, `shared/i18n/retos.js`) | 1 + shared | 315 | 315 | `i18n-catalogos` (exige claves es/en por reto); referencias no (casos fijos 1–5) |
| 2 Verbo `moveTo` | 15 | 8 | 2 154 | ≈ 726 (5 archivos: `api.js`, `mundo.js`, `index.js`, `datos-proveedor.js`, `vocabulario.js`) | `reglas-war.mjs:60` (lista de `ordenes`), `anfitrion`, `lenguaje`, `python-*`, `editor-*`, navegador |
| 3 Evento `onDamage` | ≈ 10 | 5 | ≈ 1 400 | ≈ 980 (mundo, index, anfitrión, api, unidad, war) | `anfitrion`, `unidad`, `paso-a-paso*`, `partida-*`, `partida-referencias` |
| 4 Tipo de enemigo | 9 + 1 PNG | 6 | 1 918 | ≈ 780 | `vfx`, `vista-2d/3d`, `instancias-war`, `i18n-catalogos` |

Hechos clave:
- Cada verbo existe dos veces: simulado en `anfitrion/api.js` (se serializa al Worker) y regla real en `reglas-war/mundo.js`; `api.ordenes` es solo una lista que una prueba compara literalmente.
- No hay camino de eventos hacia el programa: el Worker solo recibe `run` y `despierta`; los sucesos del mundo (`golpe`, `derribo`…) solo los usan VFX y anotaciones.
- Un tipo de enemigo ya se propaga solo (`TIPOS` → `api.tipos` → validación de `autoTarget`); lo manual es dibujo, receta VFX, nombre i18n y PNG de ficha. Los enemigos 3D de War son mallas procedurales (solo `suelo`/`aire`); no hay flujo GLB para ellos.
- Sin medir: resultado real de las suites, efecto sobre los hashes de `pruebas/referencias/partidas.json` (no se regraban), líneas añadidas por diff.

## 02 · Runtime del laboratorio frente al anfitrión e intérprete de trunk

Detalle con líneas en [`research/02-runtime-laboratorio-vs-anfitrion.md`](../research/02-runtime-laboratorio-vs-anfitrion.md). Estado en `origin/trunk`:

| Capacidad | Trunk | Evidencia clave | Archivos a tocar |
|---|---|---|---|
| Varios hilos (cuerpo + oyentes) | Missing (War), partial (Campaign: varias esperas, sin oyentes) | `api.js:200,203,288`; `anfitrion.js:60-61`; `api.js:57,82`; `despertar.js:13` | `api.js`, `anfitrion.js`, `despertar.js`, `index.d.ts`, traductor Python |
| Entradas del jugador entre pasos | Partial: lockstep y `origen:'jugador'` existen; no hay canal al programa | `conductor.js:94-109`; `protocolo/index.js:8`; `anfitrion.js:83,87` | `anfitrion.js`, `conductor.js`, `ciclo-programas.js`, `reglas-war` |
| Grabar/repetir entradas | Partial: se repiten órdenes, no programas ni clics | `nucleo/index.js:126-149` | `reglas-war/mundo.js` (verbos), `nucleo` (guardar reprogramaciones) |
| Errores aislados por unidad | Missing en anfitrión/juego (un `error` global termina la partida); presente en el intérprete | `anfitrion.js:34,43-50`; `conductor.js:53,97`; `ciclo-programas.js:156-178`; `unidad.js:62-69` | `anfitrion.js`, `conductor.js`, `ciclo-programas.js` (cambia las 41 referencias si no es opcional) |
| «Aplicar ahora» | Missing (`cargar` falla si la unidad existe; «Ejecutar» recrea todo) | `anfitrion.js:147`; `ciclo-programas.js:22,60,63` | `anfitrion.js` (`recargar`), `ciclo-programas.js`, `pulsos.js` |
| Reaparición desde la 1ª línea | Missing: War no modela destrucción ni reposición de lanzadores | `reglas-war/mundo.js` (solo `e.muerto` enemigos) | reglas + `recargar` + conductor lee el suceso |
| `await arrive()` | Partial: el patrón encargo/respuesta/`resultado` existe; faltan `moveTo`/`arrive` y unidades móviles en War | `api.js:77,283,288`; `conductor.js:59-64`; `anfitrion.js:66-71`; `api.js:272` | `api.js`, `war.js`, `anfitrion.js`, `reglas-war/mundo.js` |

**Intérprete sin Workers:** más barato crear/destruir unidades (reprogramar, reaparecer), orden determinista y presupuesto por tarea en vez de vigía de 2,5 s. Más caro o sin resolver: interpretar en lugar de JIT (no se leyeron las cifras de `docs/qa/interprete-2026-11-17`), y falta el contador de hilos activos que en el laboratorio sale de los Workers. No se midió nada.

## 03 · Assets 3D disponibles para la Batalla 1 y su cadena de carga

Detalle y evidencia: [research/03-assets-batalla-1-y-carga.md](../research/03-assets-batalla-1-y-carga.md). Todo en `origin/assets-3d` (trunk no tiene rig, ni la torreta, ni la muralla papercraft).

| Asset | Tamaño | Contenido | Ajuste a Batalla 1 |
|---|---|---|---|
| `Prototypes/Rocket Launcher/modelos/torreta_observacion.glb` | 1 942 088 B | 3 LOD, 51 nodos, sin animaciones glTF; rig `cbl-rig` v2 con controles `azimut`, `inclinacion`, `hojas`, `extension` | Sirve para apuntar, compuerta y telescopio. **No hay control de disparo ni de atasco.** |
| `papercraft/glb/muralla/opcion-03-tramo.glb` / `-nudo.glb` | 21 580 / 28 180 B | 1 malla, 180 / 240 tris, 7 × 10,5 × 3,2 m / 7 × 16 × 5,6 m; sin rig ni anclas | Existen. Dependen de `../../texturas/{relieve,fibra}.png` (3,1 MB). Escala distinta de la banda de 1,5 × 3,4 m del motor de vóxeles. **Punto de apoyo del bastión: no definido en ningún archivo.** |
| `opcion-07-nudo.glb` (torreón Cordón) | 78 352 B | 696 tris | Existe |
| `papercraft/glb/mapa/terreno-{0..3}-{0..3}.glb` | 16 trozos, 11 948 864 B (0,58 a 1,16 MB c/u) | 100 × 52 m c/u, mapa 400 × 208 m | Existen; qué trozos entran en la Batalla 1 no está fijado |
| VEH y WHL (`arte/blender/unidades_batalla.py/.blend`) | 24 985 / 319 659 B | Solo Blender; "No exporta GLB" | **Faltan los GLB** y su descriptor de exportación |

Cadena de carga en trunk: `recursos.js` solo libera recursos (no carga). El único modelo es `modelos/t1.glb`: `servicios.js:5-6` (import perezoso de GLTFLoader r180) llega por `vistas.js:46-47` y `war.js:168` a `factory.js:4,19-25,106`, con la URL relativa fija y sin resolución a raw.githubusercontent. Esa reescritura solo existe copiada en los visores de assets-3d (`muralla.js:8`, `visor.js:8`, `finalistas.mjs:4`). `paquetes/rig` y `conectarRig` (`vista-3d/rig.js`) son genéricos, pero faltan en trunk. Para una unidad nueva con rig se puede escribir un módulo propio sin tocar `rig.js` (cargar, `leerRig`, `conectarRig`, URL a raw). No existe registro de modelos ni un punto de enganche por tipo de unidad en `war.js`/`instancias-war.js`; eso obligaría a tocar un archivo compartido.

## 04 · Forma del mundo continuo: fábrica y batalla en un mismo reglamento, con paridad

Resuelto con el autor el 24-nov-2026 (grilling, ronda única más confirmación).

1. **Paquete nuevo `reglas-campaign-v2`.** Implementa el contrato de reglamento de trunk y solo importa `nucleo` y `protocolo`. `app` le inyecta War y la producción, sin excepción en `pruebas/fronteras.mjs`.
2. **War como caja negra.** Cada Batalla crea un mundo de `reglas-war` sin cambios de lógica. Se añade una sola función pública en `reglas-war/index.js` para fijar el suministro. Hoy el suministro es infinito: `reglas-war/mundo.js:164` recarga `def.suministro × dt`.
3. **Producción extraída.** `reglas-campaign` expone `produccion.js` (robots, máquinas y recetas como datos), que H0–H5 sigue usando. V2 la compone con la receta de munición básica.
   - Motivo: hoy `PIEZAS`, `RECETAS` y `MAQUINAS` son constantes de `estado.js:14-41`, y `mundo.js` fija números de hito en el código.
   - Las referencias de H0–H5 vigilan la extracción.
4. **Continuidad entre Batallas.** Pasan la fábrica, la bodega, los programas y la posición de la torreta en su bastión. La torreta empieza cada Batalla con el cargador de su reto y sin atasco, y las oleadas cuentan el tiempo desde 0.
5. **Un solo reloj.** Cada paso de 0,05 s va en este orden: fábrica → puente → batalla. Entre Batallas no hay mundo de War, y en modo paridad solo corre la batalla.
6. **Puente bodega → torretas.** La torreta recarga al ritmo de `suministro` de su Batalla mientras quede munición en la bodega. Cada misil cargado resta 1, y con la bodega vacía el suministro es 0.
7. **Paridad.** Se ejecutan las 10 referencias (`pruebas/referencias/partidas.json`) por el camino de V2 con el puente apagado.
   - Además, antes de tocar nada, se graban desde War una victoria de la Batalla 1 y una partida con atascos.
   - Motivo: las semillas 1 y 7 coinciden en las Batallas 1, 2, 3 y 5, y las 10 referencias acaban en derrota.

Descartado: refactorizar `reglas-war` en `defensa.js` (Astra) mientras ninguna mecánica necesite entrar en mitad de su paso. También queda descartado V2 dentro de `reglas-campaign/v2/`.

Consecuencias:
- Se abre «Formato del checkpoint de Campaign-V2».
- La colocación en el bastión cambia la posición del lanzador en la definición de la Batalla (ver ticket 09).
- Las mecánicas nuevas viven en `reglas-campaign-v2` (ver ticket 05).

## 05 · Cómo se añade una mecánica sin tocar archivos compartidos

Resuelto con el autor el 24-nov-2026 (grilling, ronda única más confirmación del orden de paso).

1. **Unidad de extensión.** Cada mecánica es una carpeta `reglas-campaign-v2/mecanicas/<m>/` con dos archivos:
   - `reglas.js`, puro: paso, órdenes, lecturas y eventos;
   - `ficha.js`, solo datos: verbos con clase y espera, nombres JS/Python, firma, nota, paleta, seudocódigo, i18n e id del modelo. Amplía el formato de `app/juego/datos-proveedor.js`.

   Se suma una línea por mecánica en `paso.js`, que la llama explícitamente.
2. **Una sola fuente por verbo.** La regla es una función autocontenida en `reglas.js`, que corre en el mundo y también dentro del programa para el efecto inmediato. Es el patrón de `reglas-campaign/validacion.js`, copiado con `toString()`. Los verbos de War no cambian.
3. **El editor lee las fichas.** Un único cambio hace que paleta, vocabulario, nombres Python, sugerencias, seudocódigo, ayuda e i18n lean las fichas desde el proveedor de V2. War conserva sus listas.
4. **Eventos con transporte genérico**, añadido una sola vez al anfitrión:
   - la ficha declara los nombres de evento y el paso de la mecánica los emite como `{ evento, unidad, datos }`;
   - se entregan entre pasos, en un orden determinista, a manejadores que corren como hilos propios;
   - el jugador ve nombres concretos (`onDamage(fn)`).

   Si entran en el primer corte se decide en el ticket 07.
5. **Interacción con War.** Dos funciones públicas en `reglas-war/index.js`: leer los enemigos (copia plana) y aplicar daño en un área `(x, y, radio, daño)`. Los enemigos que disparan (tirador, cañón de asedio) son de V2 y viven en un campo propio de V2. No se extrae `defensa.js`.
6. **Dibujo y asset.** La ficha guarda un id de modelo (solo texto). `vista-3d/cv2/modelos.js` traduce el id a URL, escala y mapa del rig, con un placeholder si falla la carga. `vista-3d/cv2/<m>.js` existe solo si la mecánica necesita un dibujo propio, y lo mismo en 2D con iconos.
7. **Orden del paso.** Fábrica → puente → batalla de War → mecánicas, en el orden de `paso.js`. El daño de una mecánica llega a War en el paso siguiente (+0,05 s). En modo paridad no hay mecánicas.

**Coste esperado de una mecánica nueva** (hay que comprobarlo en el ticket 10):
- dos archivos propios y una línea en `paso.js`;
- una línea en `modelos.js` si tiene GLB;
- además, el catálogo i18n, salvo que `i18n-catalogos` aprenda a leer las fichas.

**Coste único, que se paga una vez:**
- el transporte de eventos en el anfitrión;
- que el editor lea las fichas;
- las funciones de lectura y daño de War;
- el registro de modelos.

Queda para el ticket 10:
- si los textos ES/EN viven en la ficha o en `shared/i18n`;
- comprobar el coste con VEH, la rueda y el minador.

## 06 · Orden puntual frente a `onClick`

Resuelto con el autor el 24-nov-2026: grill en HTML (Q1–Q5) y una ronda corta en el chat (Q6–Q9). Respuestas originales: `~/Documents/ticket-06-respuestas.md`.

1. **Relación (Q1 = B, uno sobre otro).** El clic derecho sobre enemigo o terreno (en móvil, mantener ~0,45 s) se entrega primero al programa de cada unidad seleccionada que escucha `onClick`. Esa entrega es el **clic programado**. Si la unidad no escucha, el clic es una **orden puntual**. Con selección mixta, cada unidad decide por su cuenta.
2. **Gestos (Q2 = A, con la nota del autor):**
   - Clic izquierdo o toque: seleccionar.
   - Arrastrar desde el terreno: recuadro.
   - Clic derecho o mantener 0,45 s: orden o clic programado.
   - Dos dedos: cámara.

   Se retiran Alt+clic y el botón «Señalar» (Q6 = A).
3. **Apuntar arrastrando** (nota del autor; Q7 = A, Q8 = A). Se mantiene pulsado ~0,45 s sobre una torreta propia y se arrastra hasta el objetivo. Se ve una línea punteada de la torreta al dedo o cursor, con una diana bajo él. Es **siempre una orden puntual**, aunque el programa escuche: es la vía manual garantizada. Funciona igual en móvil y en PC (clic izquierdo mantenido; antes del umbral sigue siendo selección o recuadro).
4. **Puntería (Q3 = B).** Si el clic cae sobre un enemigo, la torreta apunta con la predicción de `autoTarget`, de War. Es un solo disparo, sin seguimiento por identidad.
5. **Prioridad (Q4 = A).** La orden puntual ocupa el siguiente turno de fuego permitido y respeta cadencia, munición y atasco. Después sigue el modo del programa. Si la torreta no puede disparar, la orden se descarta con un aviso y no queda en cola. Esto requiere una función pública de War para el «intento puntual», separada de los modos (ver ticket 05).
6. **Nombre (Q5 = A).** «Clic programado».
7. **Indicación (Q9, provisional).** Un icono junto a la unidad mientras su programa escucha `onClick`, más una línea en la consola. El juego completo lo explicará en un tutorial.

En modo paridad no hay órdenes de jugador ni clics programados.

Queda para el ticket 07:
- si el clic programado (transporte de eventos) entra en el primer corte;
- la marca de 6 s y `track`.

## 07 · Qué partes del modo de batalla integrado entran para probar las Batallas 1–5

Resuelto con el autor el 24-nov-2026 (grill en HTML). Respuestas originales: `~/Documents/ticket-07-respuestas.md`.

1. **Tres maneras de jugar una Batalla (Q1 = A):**
   - **campaña:** progresión, fábrica y checkpoints;
   - **ensayo** (menú de pruebas, `?ensayo=…`): cualquier Batalla o caso de mecánica con las reglas de campaña, sin progresión ni checkpoint, con la bodega en un valor fijo y la fábrica opcional; las cifras experimentales viven en el ensayo;
   - **paridad:** War exacto.

   Los casos del laboratorio («Salida», «Rueda kamikaze», «Observador», «Órdenes», «Campaña 1») serán ensayos cuando lleguen sus mecánicas.
2. **Piezas (Q2):**

   | Entran en el primer corte | Extensión prevista | Necesita definición |
   | --- | --- | --- |
   | Errores aislados por unidad · aplicar ahora · grabar y repetir entradas · pausa con órdenes en espera · **clic programado** | `onDamage` · `onArrive` · `onEnemySeen` · radar `RAD_01` · reaparición | marca de 6 s + `track(id)` |
3. **Piezas activadas por modo (Q3 = A).** En paridad, todo como War: un error termina, no hay entradas y no se aplica nada en caliente. En campaña y ensayo, las piezas nuevas están activas. Las referencias no se regraban.

Consecuencias:
- **Que entre el clic programado** adelanta al primer corte el coste único del transporte de eventos y los varios hilos por programa en el anfitrión (ticket 05), con `onClick` como único evento. Después, `onDamage`, `onArrive` y `onEnemySeen` solo añaden su ficha y su emisión.
- **Oyentes en Python y seudocódigo:** el grill exige seudocódigo en las Batallas desde el primer hito y mantiene Python, así que el clic programado los necesita en el primer corte. Pasa de la niebla al ticket «Forma del clic programado en JS, Python y seudocódigo».
- **La marca y `track`** se quedan en la niebla de visibilidad compartida.
- **Glosario:** se añade «Ensayo».

## 08 · Formato de la definición de nivel e hitos

Resuelto el 24-nov-2026 con el grill en HTML. Las seis preguntas se respondieron con la opción A.

1. **Contenedor:** una carpeta por nivel con módulos JS de datos, como `retos.js` y `nivel.js` en trunk:
   - `reglas-campaign-v2/niveles/nivel-1/nivel.js`: la secuencia de hitos, el mapa, la instalación inicial y las mecánicas activas;
   - un archivo por hito: `h0.js`… para los de fábrica y `b1.js`… para las Batallas;
   - un `niveles/README.md` con la receta.

   Añadir la Batalla 6 es crear `b6.js`, añadir una línea a la secuencia de `nivel.js` y poner sus textos en el catálogo del nivel.
2. **B1–B5 frente a War:**
   - Mientras una Batalla sea idéntica a su reto, su archivo solo apunta a él: `{ war: N }`. `app` resuelve la referencia con `normalizar(RETOS[N-1])` y la inyecta, porque `reglas-campaign-v2` no puede importar `reglas-war` (fronteras).
   - Cuando una Batalla cambia, se copia su reto una vez a su archivo y se edita ahí. No hay parches del tipo `{ war: N, cambios }`.
   - La paridad siempre usa el reto original de War.
3. **Textos:** catálogo i18n propio por nivel en `shared/i18n/campaign-v2/nivel-1.js`. Respeta la regla de `docs/PLAN-ARQUITECTURA.md:33`, y los datos llevan claves, no textos. Esto también responde lo que el ticket 10 dejaba abierto: los textos de las fichas de mecánica van en catálogos i18n (uno por mecánica o uno común), no dentro de la ficha.
4. **Metas:** cada tipo de hito usa su formato.
   - Las Batallas terminan con el resultado del `evaluar` de War (`brechasMax`, `atascosMax`, `derribosMin`, `tiempoMax`).
   - Los hitos de fábrica usan la lista de Campaign `[{ k, tipo: "en" | "lotes" | "banda", … }]`, que pasa a `produccion.js`.
   - Si V2 necesita una meta extra, se añade como tipo nuevo en esa lista. No hay formato unificado.
5. **Programas entre hitos:** al empezar una Batalla se conserva el programa del jugador. Un botón «Programa de la lección» carga el programa de partida de esa Batalla, y el cambio se puede deshacer. El programa de partida también se usa para las unidades que aparecen nuevas. El Archivo de programas sigue fuera del primer corte.
6. **Validación:**
   - Un validador de contenido al cargar, con errores que dicen el archivo y el campo: ids repetidos, `{ war: N }` inexistente, tipo de enemigo o mecánica desconocidos, claves i18n que faltan.
   - Una prueba de contenido (`pruebas/contenido.mjs`) que carga todos los niveles y juega cada hito con semilla en Node, sin vista.
   - `normalizar()` de War no se toca: sigue recortando sin avisar para los retos de War.

**Coste de añadir la Batalla 6:** 2 archivos propios del nivel más 1 línea en `nivel.js`. No toca archivos compartidos de la serie. Es el mismo número de archivos que un reto en trunk (ticket 01), y ahora la prueba de contenido lo valida.

## 09 · Escala, coordenadas y espacio del mundo

Resuelto el 24-nov-2026 con el grill en HTML. Las seis preguntas se respondieron con la opción A.

1. **Marco del mundo:** los metros del mapa papercraft (`mapa-ampliado.json`, 400 × 208 m, x hacia el este, y hacia el sur, 1 unidad = 1 m). Los datos de fábrica de Campaign se trasladan una vez sumando (103, 22), que es `antiguo.origen`.
2. **Marco de batalla:** solo un desplazamiento, sin escala; 1 casilla = 1 m.
   - Cada nivel lo declara en `nivel.js`: `marco: { origen: [204, 72] }`, de modo que la línea de brechas local x = 3 cae en la muralla x = 207 y el «Paso del este» (y = 81) queda en el centro.
   - War sigue en sus casillas, intacto. Los valores del laboratorio en casillas pasan tal cual a metros.
   - Si hay batallas en el frente sur, se añade un giro al marco; es un campo más, no un cambio de forma.
3. **Campo activo:** el propio marco de batalla. Las unidades V2 (VEH, WHL…) no salen del rectángulo donde existen los enemigos de War. Una Batalla que necesite más campo se copia (ticket 08) y amplía `mapa.cols`. Las filas las fija hoy la app, y hacerlas configurables queda para la implementación.
4. **Arte frente a simulación:** manda la simulación. Las posiciones de las reglas no se mueven por el arte. Cada modelo lleva en `modelos.js` su escala, su desplazamiento y su punto de anclaje. Traba se escala ≈ 0,54: el nudo queda con 3 m de fondo (de x = 3 a x = 6) y ≈ 8,6 m de alto. El anclaje del bastión se define en esos datos, porque los GLB no lo traen.
5. **Fábrica:** pegada a la muralla, como en Campaign: la instalación trasladada (103, 22) ocupa x ≈ 174–207. La losa del papercraft se mueve a ese sitio en `mapa-ampliado.json`.
   - **Pendiente de verificar en la implementación:** si la losa está horneada en `terreno-F-C.glb`. En ese caso hay que regenerar los trozos con `mapa.py`, porque es un cambio de arte.
   - Si resulta caro, la salida aceptada es poner la instalación sobre la losa actual (opción B) sin tocar ninguna regla.
6. **Traducción:** solo en `reglas-campaign-v2`.
   - Al leer enemigos de War los convierte a metros, y al aplicar daño en área lo pasa a casillas.
   - La escena llega a las vistas ya en metros.
   - El colocador y los clics (orden puntual, clic programado) entregan metros, y V2 los traduce.
   - Las vistas y las mecánicas nuevas no conocen el marco.

**Consecuencias:**
- `vista-3d/war.js` dibuja hoy en casillas; la vista de Campaign-V2 dibujará en metros.
- En modo paridad se usa el mismo marco, así que se ve igual.
- El encuadre del corte del mapa (en Not yet specified) ya tiene escala y posición: la batalla ocupa x 204–236, y 72–90.

## 10 · Receta de extensibilidad sobre papel: VEH, WHL y minador

Resuelto el 24-nov-2026 con el HTML conjunto (Q8–Q12). Los esqueletos están en `prototipo/receta/`.

- **Q8 · La promesa se sostiene (A):**
  - Mecánica nueva: 2 archivos propios (`reglas.js`, `ficha.js`), 1 línea en `paso.js`, 1 en `modelos.js` si tiene GLB, y textos en i18n.
  - Batalla nueva: `bN.js`, 1 línea en `nivel.js` y sus claves en el catálogo del nivel.
  - Costes únicos (van al plan por porciones): la capacidad `movimiento/`, las puertas en el marco, la reaparición (recrear la unidad y usar «aplicar ahora»), el nodo «cuando» del seudocódigo y el proyectil V2.
- **Q9 · Movimiento (A):** capacidad compartida en `mecanicas/movimiento/` (`moveTo`, `stop`, `await arrive()`, evento `onArrive`). Las fichas la declaran con `capacidades: ["movimiento"]`.
- **Q10 · Arma del VEH (A):** un proyectil propio de V2 que, al impactar, llama a `war.danoEnArea`. War no expone su disparo.
- **Q11 · Puertas (A):** en el marco del nivel, `marco: { origen, puertas: [filas locales] }`, compartidas por todas sus Batallas.
- **Q12 · Unidad destruida (A):** mientras no existe vale `null` (`None` en Python). Su programa se detiene y vuelve a la primera línea al reaparecer. El árbol de unidades la muestra en gris con una cuenta atrás.

Con el verbo de Q2 del ticket 12, el VEH usa `regularShoot(objetivo)` en lugar del `shootAt` de los esqueletos.

## 11 · Formato del checkpoint de Campaign-V2

Resuelto el 24-nov-2026 con el grill en HTML.

1. **Estrategia (A):** una instantánea en la frontera del hito, como el Campaign de trunk (`guardarCheckpoint` / `volverA`).
   - Al restaurar, el mundo de War se crea desde el reto de la Batalla y cada programa arranca en su primera línea.
   - Una espera a medias en la fábrica vuelve a empezar; es una pérdida aceptada.
   - La grabación del primer corte (ticket 07) empieza en el checkpoint y sirve para repetir y probar, no para guardar. Se descarta la repetición desde el inicio del nivel (propuesta de Astra).
2. **Contenido:**
   - Entran: la fábrica y la bodega (`serializar` de `produccion.js`), la posición de las torretas, los programas por unidad con sus vínculos compartidos, las fuentes Python, y la semilla, la clave y la revisión del nivel.
   - No entran: el mundo de War (se crea desde el reto), el estado de las ejecuciones (arrancan de nuevo), la grabación anterior al checkpoint y el programa anterior del botón «Programa de la lección».
3. **Semilla (B):** cada intento de una Batalla usa una semilla nueva, así que el programa tiene que aguantar atascos en momentos distintos.
   - Para que siga siendo reproducible, la semilla del intento se anota al empezar en su grabación, y repetir ese intento la reutiliza.
   - El menú de pruebas, la prueba de contenido y la prueba del checkpoint fijan la semilla de forma explícita.
   - La semilla guardada en el checkpoint es la de la fábrica, que es continua.
4. **Programas al volver tras perder (A):** se mantienen los programas actuales. Una casilla del diálogo de derrota trae los del checkpoint (`conProgramas` de trunk).
5. **Revisión distinta (B):** se descarta el mundo, se conservan los programas, se vuelve al inicio del nivel y se avisa en la consola. No hay migraciones.
6. **Dónde y cuántos (A):** un checkpoint por hito alcanzado, bajo la clave `campaign-v2-nivel-1`, y repetir un hito sustituye su checkpoint. No hay guardado en vivo a mitad de hito: al cerrar la pestaña vuelves al último checkpoint con tus programas actuales, que se guardan aparte como en trunk.
7. **Comprobación (A):**
   - ida y vuelta: `serializar(restaurar(c))` es igual a `c`;
   - restaurar el checkpoint de una Batalla y jugarla con una semilla dada da la misma huella que un ensayo de esa Batalla con la misma bodega, programas, torretas y semilla;
   - un checkpoint de otra revisión sigue la regla del punto 5.

## 12 · Forma del clic programado en JS, Python y seudocódigo

Resuelto el 24-nov-2026 con el HTML conjunto de los tickets 12 y 10.

1. **API (A):** dos oyentes por destino, `terrain.onClick(fn)` → `{ x, y }` y `enemies.onClick(fn)` → `{ id, type, x, y, hp, vx, vy }`, datos del instante del clic.
   - Un clic sobre un enemigo va a `enemies.onClick`.
   - Si la unidad solo escucha el terreno, va a `terrain.onClick` con el punto.
   - Si no escucha nada, es una orden puntual (ticket 06).
2. **Disparar a un enemigo:** sin opción marcada; la nota del autor dice que `regularShoot` haría «pretty much the same» que `shootAt()`. **Confirmado por el autor (24-nov):** no hay verbo nuevo; se amplía `regularShoot`.
   - `regularShoot()` sin argumento es el modo de War, igual que hoy.
   - `regularShoot(objetivo)` con un enemigo o un lugar es el disparo dirigido, con la misma regla que la orden puntual del ticket 06: predicción de War, siguiente turno de fuego y descarte con aviso.
   - La forma con argumento solo existe en campaña y ensayo; en paridad, la API es la de War sin cambios.
3. **Coordenadas (A):** los programas ven las del marco de batalla (las de War, con la muralla en x = 3), iguales en paridad, ensayo y campaña. `reglas-campaign-v2` traduce también en la frontera de la API del programa.
4. **Python (A):** `def` o `async def` con nombre, o `lambda` para una línea: `terrain.on_click(al_clic)`. Ya cabe en el subconjunto; se añaden casos a las pruebas del traductor. Un manejador con `await` tiene que ser `async def`.
5. **Seudocódigo (A):** un nodo genérico «cuando <evento> → <parámetro>» con cuerpo en `seudo-modelo`. El texto sale de la ficha del evento, y los eventos futuros no tocan el editor.
6. **Concurrencia (A):** cada clic abre un hilo del manejador, que puede solaparse con otros del mismo manejador. Los oyentes corren en orden de registro, y un programa con solo oyentes sigue vivo.
7. **Registro (A):** solo al principio, antes del primer `await`. Registrar después da un error con la línea, aislado en esa unidad.
