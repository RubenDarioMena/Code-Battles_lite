## Campaign-V2 · P6 · Documentación de la rama · 26 de noviembre de 2026

- `AGENTS.md` tiene una sección «Rama `Campaign-V2`» con lo que rige, dónde está el código, cómo se prueba la paridad y el balance, y cómo se publica. `CLAUDE.md` apunta a ella.
- `CONTEXT.md` deja de ser borrador y suma *Batalla propia*, *Unidad móvil* y *Minificha*.
- `PROGRESO.md` empieza ahora en Campaign-V2. Lo anterior, del 23-nov hacia atrás, está en `docs/historico/PROGRESO-hasta-2026-11-23.md`, con los enlaces relativos corregidos.
- Pendiente: el consolidado preprototipo del 23-nov (21:33) que pide `DECISIONES-GRILL.md` para `docs/Vision/2026-11-23/` no está en el repositorio ni en los ZIP del 23-nov. Hace falta que el autor lo aporte.

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

- **Cabecera del editor:** «▸ Unidades · N» quedaba montado sobre el selector de lenguaje, porque el selector no cedía ancho. Ahora el selector se encoge hasta 6,2em y el rótulo, si aun así no cabe, se corta con puntos suspensivos (`campaign-v2.css`). Revisado a 1024 px y en móvil.
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
