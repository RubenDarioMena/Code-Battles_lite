# Tarea 01 · Destrucción por piezas: núcleo determinista y laboratorio

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Lee primero:
- `AGENTS.md`;
- `paquetes/README.md` (dependencias, imports y determinismo);
- `pruebas/fronteras.mjs`;
- `paquetes/vfx/` (un paquete puro con README, `index.d.ts` y pruebas propias: úsalo de modelo);
- `herramientas/laboratorio-vfx/` (un laboratorio con Three r180 vendorizado);
- la línea 129 de `docs/Vision/2026-11-03/VISION-CAMPANA.md`.

Toca únicamente:
- `paquetes/destruccion/` (nuevo);
- `herramientas/laboratorio-destruccion/` (nuevo; no toques `prompts/`);
- `docs/DESTRUCCION-PIEZAS.md` (nuevo);
- en `pruebas/fronteras.mjs`, `paquetes/README.md`, `pruebas/todas.mjs` y `tsconfig.json`, **solo** las líneas para
  registrar el paquete nuevo, sus pruebas y el laboratorio.

No hagas commits. Deben pasar:
- `node paquetes/destruccion/pruebas/destruccion.mjs`;
- `node pruebas/fronteras.mjs`;
- `node pruebas/fronteras-autoprueba.mjs`;
- `npm run tipos`.

No puedes abrir un navegador. El orquestador revisará el laboratorio en WebGL.

## Idea de juego
Los robots se fabrican con unas **3 piezas** unidas entre sí (chasis, cuerpo y cabeza o arma). La batalla los
destruye **por piezas**, y cómo se destruyen decide qué se recupera después:
- **Un proyectil cinético o una explosión** rompe uniones y hace **saltar piezas casi intactas**. Es lento, pero deja
  buen botín.
- **Un láser** de alta potencia perfora un canal estrecho y funde lo que toca.
- **Un ácido** corroe una zona que crece durante unos segundos.

Ninguno de los dos toca el resto de la máquina. Si un láser atraviesa solo el sensor, el acero del chasis se recupera
entero, pero el sensor queda sin función.

Las piezas sueltas caen, rebotan y se quedan quietas. Unos segundos después **se hunden o se desvanecen**, pero el
núcleo guarda dónde quedaron, con qué pose y en qué estado. Lo mismo pasa con el resto de un robot caído. Al
**terminar la batalla** se encienden las luces normales y todos los restos reaparecen donde quedaron, para la fase de
**recolección**: el botín que se recupera de cada pieza.

Esta tarea hace **solo la mecánica de destrucción y su simulación**. La recolección queda así:
- el núcleo calcula el botín;
- el laboratorio lo muestra en una tabla;
- no hay inventario ni interfaz de juego.

No se integra con War, Factory ni Campaign: es un módulo aislado y su laboratorio. La física se limita al vuelo de
piezas sueltas contra el suelo plano. No hay colisiones entre piezas ni con el robot (coherente con la línea 129 de
la visión).

## Paquete `paquetes/destruccion/` (puro)
- **Dependencias:** solo `protocolo`, o nada. Regístralo como puro en `fronteras.mjs` y en la tabla de
  `paquetes/README.md`.
- **Determinismo:**
  - sin `Math.random`, reloj, temporizadores, DOM ni Three;
  - el azar sale de un **hash entero** de la semilla, el robot, la pieza y el número de disparo;
  - paso fijo `dt = 1/60` (`avanzar(segundos)` hace subpasos enteros y acumula el resto);
  - mismas órdenes, mismo `serializar()`, byte por byte.
- **Coordenadas como `vfx` y el protocolo:**
  - `x`, `y` del mapa y `z` de altura, en metros;
  - suelo en `z = 0`;
  - las rotaciones como cuaterniones `[x, y, z, w]`;
  - la vista convierte a los ejes de Three.
- **Constantes** provisionales del laboratorio en tablas congeladas con nombre (`ARMAS`, `MATERIALES`, `FISICA`,
  `RESTOS`, `RENDIMIENTO`), documentadas.

### Robots y piezas
- `definirRobot({ id, piezas })` valida y congela una definición. Cada pieza tiene:
  - `id`;
  - `forma`: `caja { medidas }`, `cilindro { radio, alto, eje }` o `esfera { radio }`;
  - `pos` y `rot` locales al robot;
  - `padre`: el id de otra pieza o `null` para la raíz;
  - `union`: `{ resistencia }`, el impulso que la rompe;
  - `materiales`: lista `[{ material, cantidad }]`;
  - `funcion`: `null` o un nombre, por ejemplo `"sensor"`, `"motor"`, `"arma"` o `"energia"`;
  - si tiene función, `zonaFuncion`: una esfera o caja local que contiene el módulo que la hace funcionar;
  - `aguante` cinético;
  - `color` para la vista.
- **Volumen interno.** Cada pieza se discretiza en **celdas** de tamaño fijo, alrededor de 4 cm: solo las celdas cuyo
  centro cae dentro de la forma.
  - La cantidad de cada material se reparte entre ellas.
  - Una pieza de unos 50 cm tiene unas 12 o 13 celdas por eje: mide el total y el coste.
  - La máscara de celdas vivas es el estado de verdad para todo lo que viene.
- **Etiqueta.** `etiqueta(pieza)` devuelve el formato del diseño, `material-cantidad-función-estado`:
  - ejemplo: `acero-4-sensor-intacta`;
  - varios materiales se unen con `+`: `acero-3+cobre-1-sensor-dañada`;
  - sin función, la palabra `sin`;
  - las cantidades son las **actuales**, redondeadas a una décima.

  En los datos, la función es `null` cuando la pieza no tiene o cuando la perdió, y se distingue con
  `funcionOriginal`.
- **Estados** de una pieza:

  | Estado | Cuándo |
  | --- | --- |
  | `intacta` | Sin daño |
  | `dañada` | Daño cinético o explosivo; sin pérdida de volumen o con muy poca |
  | `partida` | Perdió volumen por láser o ácido |
  | `fundida` | Perdió más de cierta fracción con láser; las celdas del borde del canal quedan «fundidas» y rinden menos |
  | `null` | Destruida, sin nada recuperable: el hueco de la pieza en el robot queda a `null`, como manda la visión de Campaign |

### Armas (`ARMAS`)
`disparar({ arma, origen, direccion, potencia? })` devuelve un informe:
- dónde impactó;
- piezas afectadas;
- celdas quitadas por material;
- uniones rotas;
- funciones perdidas;
- sucesos.

El impacto se calcula con un **raycast puro** contra las piezas. Recorre las celdas con DDA en el espacio local de cada
pieza, así un disparo **pasa por los huecos** ya abiertos. Los perfiles:

- **`cinetico` (cañón).**
  - Transfiere un impulso a la pieza tocada.
  - Si supera la `union.resistencia`, la unión se rompe y la pieza sale volando, con sus hijas unidas, si las tiene.
  - Velocidad y giro salen del impulso, del punto de impacto respecto al centro de masas y de un poco de hash.
  - El impulso que sobra se propaga, atenuado, a las uniones vecinas, para que un buen golpe pueda soltar dos piezas.
  - Pérdida de volumen mínima: unas pocas celdas junto al punto de impacto.
  - La pieza queda `dañada`.
- **`explosivo`.**
  - Impulso radial a todas las piezas dentro de su radio, con caída según la distancia.
  - Quita algo más de volumen en la superficie cercana al centro.
- **`laser`.**
  - Una **cápsula** a lo largo del rayo, de radio pequeño (unos 5 cm), y un alcance de perforación según la potencia.
  - Atraviesa varias piezas si le alcanza.
  - Quita las celdas dentro de la cápsula. Las de un anillo alrededor quedan **fundidas**: cuentan como presentes,
    pero rinden menos.
  - Impulso casi nulo.
- **`acido`.**
  - Una esfera en el punto de contacto que **crece durante unos segundos** con `avanzar`, con un borde irregular por
    hash.
  - Quita las celdas que cubre y se detiene.
  - Impulso nulo.
  - Si la pieza se suelta mientras corroe, el ácido sigue con ella.

### Daño parcial, funciones y uniones
- Las celdas quitadas restan su parte de cada material.
- Si la `zonaFuncion` pierde más de cierta fracción de sus celdas (constante), la pieza **pierde la función**, aunque
  el resto esté entero. Es el caso estrella: un láser al sensor deja el acero recuperable y el sensor muerto.
- **Corte de unión.** La unión de una pieza con su padre ocupa una región de celdas de contacto. Si láser o ácido la
  vacían, la unión se corta sin impulso y la pieza cae por su peso.
- **Corte de una pieza en dos.** Tras quitar celdas, calcula las componentes conexas de la pieza (vecindad de 6).
  - La componente que sigue unida al robot, o la mayor si la pieza está suelta, se queda.
  - Las demás se separan como **fragmentos**: piezas nuevas con la misma forma base y la máscara de su componente, sus
    materiales proporcionales y la etiqueta heredada.
  - Las componentes de muy pocas celdas se pierden como escoria.
- **Robot caído.** Un robot queda fuera de combate cuando:
  - pierde o suelta la pieza con función `energia`, si la tiene;
  - o se queda sin piezas en pie.

  Lo que quede de él es un resto más.

### Vuelo, reposo y restos
- **Vuelo de piezas sueltas:**
  - gravedad;
  - velocidad lineal y angular;
  - contacto con el suelo usando los puntos extremos de la forma, o las celdas vivas de su envolvente;
  - rebote con restitución baja, fricción y amortiguación angular;
  - nunca queda por debajo del suelo.
- **Reposo.** Una pieza que pasa N pasos por debajo de un umbral de velocidad queda en reposo, con su pose final.
- **Restos (`RESTOS`).** Al reposar, la pieza se registra como **resto**:
  - robot de origen;
  - id de la pieza y del fragmento;
  - etiqueta;
  - materiales;
  - función;
  - estado;
  - pose (posición y cuaternión);
  - máscara de celdas compacta (RLE o base64, documentado);
  - instante.

  El resto de un robot caído se registra igual.
- **Desaparición.** Tras `RESTOS.visible` segundos (unos 3), el resto pasa a `hundiendose` o `desvaneciendose` durante
  `RESTOS.salida`. Después queda `oculto`. Es solo un estado para la vista: el resto sigue guardado.
- `terminarBatalla()` pone todos los restos en `expuesto`, en su pose guardada, y congela la simulación.
- `botin()` devuelve, por resto y en total:
  - el material recuperable, según `RENDIMIENTO`: un factor por estado, el volumen vivo y menos rendimiento en las
    celdas fundidas;
  - los módulos de función recuperados.

  Deja la regla de `RENDIMIENTO` en **una sola función pequeña y bien comentada**: es la palanca de equilibrio del
  juego y se va a ajustar a mano.

### Interfaz del mundo
- `crearMundo({ semilla })`.
- `agregarRobot(def, { pos, rumbo })`.
- `disparar(...)`.
- `avanzar(segundos)`.
- `estado()`. Es lo que la vista necesita para dibujar sin calcular nada. Por pieza o fragmento:
  - pose;
  - versión de su máscara;
  - volúmenes de daño;
  - estado de salida;
  - opacidad o hundimiento.
- `sucesos()`: los del protocolo, `{ paso, tipo, unidad, datos }`, con estos tipos:
  - `impacto`;
  - `union-rota`;
  - `pieza-suelta`;
  - `funcion-perdida`;
  - `fragmento`;
  - `reposo`;
  - `robot-caido`;
  - `resto-oculto`.
- `terminarBatalla()`.
- `botin()`.
- `serializar()` y `cargar()`, con `formato: "cbl-destruccion", v: 1`.
- `index.d.ts` con el contrato completo, y un README como el de `vfx`.

## Laboratorio `herramientas/laboratorio-destruccion/`
Es una página con Three r180 vendorizado, como `laboratorio-vfx`. La vista vive en el laboratorio. Que no use nada
que impida moverla mañana a `vista-3d`.

### Escena y robots
- Suelo y cuadrícula.
- Tres robots de muestra de 3 piezas con primitivas, en la paleta «fábrica de juguete» (crema `#E7DFCE`, turquesa
  `#2E8C93`, grafito `#464B53` y amarillo `#EAA937`):
  - **Andador:** chasis, torso con `energia` y cabeza con `sensor` y una lente.
  - **Torreta:** base, cuerpo con `motor` y cañón con `arma`.
  - **Oruga:** bloque bajo, cabina con `energia` y antena con `sensor`.
- Materiales de muestra: `acero`, `cobre`, `circuito`, `cristal` y `bateria`. El color y el brillo de cada uno se
  deciden en la vista, no en el núcleo.

### Dibujo del daño parcial
No se dibuja en cubitos.
- Cada pieza es su malla de primitiva, con un material que en el fragmento **descarta** lo que el daño quitó:
  - las cápsulas del láser y las esferas del ácido, como SDF (uniforms con tope por pieza; documenta qué pasa si se
    supera);
  - y la máscara de celdas, para los fragmentos separados, como `Data3DTexture` con filtrado lineal y umbral, así el
    borde no sale escalonado.
- Las caras traseras se pintan oscuras, como la **tapa del corte** (`gl_FrontFacing`), para que la pieza parezca
  maciza y no hueca.
- **Borde del daño, por distancia al SDF:**
  - el láser deja un anillo incandescente naranja que se enfría a carbón en unos segundos;
  - el ácido, un borde verdoso, irregular y burbujeante.
- Las piezas sueltas se mueven con la pose del núcleo.
- Hundirse es bajar en `z` atravesando el suelo, recortado bajo el suelo. Desvanecerse es opacidad.
- Cada disparo lleva un trazo sencillo: bala con estela, rayo láser o chorro de ácido. Sin depender de `vfx`.

### Controles
- Selector de arma con potencia.
- **Clic sobre un robot dispara** desde la cámara, con el raycast del núcleo, no el de Three.
- Pausa y velocidad 1× / 0,25×.
- Selector de desaparición: hundir o desvanecer.
- **«Terminar batalla».** Cambia la iluminación de **batalla**, oscura y con fogonazos, a **luces normales**, hace
  reaparecer los restos en su sitio y muestra la tabla de **botín**: por resto, etiqueta, estado, materiales y
  función, y los totales.
- «Reiniciar».
- Estadísticas:
  - celdas por pieza;
  - tiempo del raycast y del paso;
  - restos por estado.

### Demos deterministas
Cada demo es una secuencia fija al cargar. Con `&t=<segundos>`, avanza hasta ese instante y se queda en pausa, para
las capturas. Con `&fin`, termina la batalla tras la secuencia.
- `?demo=cinetico`: un cañonazo suelta la cabeza del Andador, que vuela, rebota y queda en el suelo.
- `?demo=laser`: un láser atraviesa solo la cabeza sensora de la Torreta. El resto queda intacto y el sensor pierde su
  función. Primer plano del canal incandescente.
- `?demo=acido`: el ácido corroe la unión de la antena de la Oruga hasta que cae.
- `?demo=corte`: un láser barre en varios disparos y parte una pieza en dos fragmentos.
- `?demo=comparar`: tres Andadores iguales, uno con cada arma (cinética, láser y ácido), hasta derribarlos, y luego
  `terminarBatalla`. La tabla de botín muestra la diferencia de rendimiento entre armas.

## Pruebas `paquetes/destruccion/pruebas/destruccion.mjs`
- Definiciones: validación, celdas por pieza y reparto de materiales (la suma da la cantidad original).
- `etiqueta` en los casos del formato (varios materiales, sin función, función perdida).
- Raycast:
  - acierta la pieza correcta;
  - pasa por un hueco abierto y da en lo de detrás;
  - no da a nada si apunta fuera.
- Cinético:
  - por encima de la resistencia suelta la pieza y sus hijas;
  - por debajo, no;
  - la pieza vuela, toca el suelo, nunca queda por debajo de `z = 0` y reposa;
  - pérdida de material mínima.
- Láser:
  - solo quita celdas dentro de la cápsula (comprueba la geometría);
  - el material perdido es proporcional;
  - las piezas que no toca quedan idénticas;
  - un disparo a la zona de función la pierde y deja casi todo el material.
- Ácido:
  - crece con el tiempo y se detiene;
  - vaciar la región de unión suelta la pieza sin impulso.
- Corte en dos: genera fragmentos con la máscara de su componente y la suma de materiales cuadra.
- Restos:
  - pose al reposar;
  - transición a hundiéndose u oculto según los tiempos;
  - `terminarBatalla` los expone en la pose guardada.
- `botin`:
  - con la misma víctima, el cinético rinde más material que el láser;
  - el láser conserva más que el ácido en la zona no tocada, o documenta lo que salga;
  - las funciones se cuentan bien.
- Determinismo: la misma secuencia da el mismo `serializar()`. Ida y vuelta de `cargar`.
- Coste: anota el tiempo de un paso con 3 robots y varias piezas en vuelo, y el de un raycast.

## Documento `docs/DESTRUCCION-PIEZAS.md`
Corto y claro:
- el modelo (piezas, celdas, uniones);
- la tabla de armas con lo que hace cada una;
- la tabla de estados;
- el ciclo de vida de un resto (diagrama de estados en texto);
- el formato de etiqueta;
- la regla de rendimiento;
- cómo dibuja la vista el daño parcial;
- las constantes;
- el coste medido;
- qué queda fuera: inventario, integración con War y Campaign, colisiones entre piezas y la regla definitiva del
  botín.

## Respuesta final
Breve y en lenguaje claro:
- qué hiciste;
- qué comprueban las pruebas y su resultado;
- las decisiones que tomaste y por qué;
- qué debe mirar el orquestador en WebGL (URLs de las demos y qué debería verse).
