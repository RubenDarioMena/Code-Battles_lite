# Tarea 03 · Puente que cede y se parte, y piezas interiores

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Las tareas 01 y 02 están hechas y en commit (`64543a2`): no
deshagas nada. Toca solo:
- `paquetes/destruccion/`;
- `herramientas/laboratorio-destruccion/` (salvo `prompts/`);
- `docs/DESTRUCCION-PIEZAS.md`.

No hagas commits. Deben seguir pasando:
- `node paquetes/destruccion/pruebas/destruccion.mjs`;
- `node pruebas/fronteras.mjs`;
- `npm run tipos`, si hay `node_modules`. Si no lo hay, dilo y no instales nada.

No puedes abrir un navegador. El orquestador revisará el laboratorio en WebGL.

## Idea de juego
El ácido rara vez corta limpio. Suele dejar un **puente** delgado de metal. Queremos ver el cañón de una torreta, o
medio tanque, **combarse** por su propio peso mientras el ácido adelgaza el puente, y después **partirse** y caer.
No es física blanda: es una regla sobre la rejilla que ya tenemos.

Y un tanque partido por la mitad debe **enseñar sus tripas**. Un casco hueco con piezas dentro (motor, munición,
batería) que el corte deja a la vista, y que se reparten entre las dos mitades.

Se mantienen todas las reglas del paquete:
- determinista, sin `Math.random`, reloj, DOM ni Three;
- paso fijo y `serializar()` idéntico byte por byte;
- la máscara de celdas es la verdad;
- las constantes nuevas van en tablas congeladas con nombre (`PUENTE`, por ejemplo) y documentadas.

## A. El puente

### Detección
- Tras cada pasada de láser o ácido que deja la pieza en **una sola componente**, comprueba si queda un cuello cerca
  del volumen que acaba de actuar.
- El **puente** son las celdas vivas de una capa fina (unas dos celdas) alrededor de ese volumen. Si al quitarlas
  hipotéticamente la pieza se divide en componentes que no son escoria, esas componentes están unidas solo por el
  puente.
- **El lado anclado** es la componente con apoyo, con la misma regla que ya usa `repartir`. Las demás son **lados
  colgantes**.
- **La sección** `n` es el número de celdas del puente en su capa más delgada que tocan a la vez los dos lados
  (vecindad de 6). Documenta el algoritmo exacto.
- Solo hay puente si el lado anclado está quieto: en pie o en reposo. Un grupo que vuela es rígido.
- El coste debe ser acotado. Calcula solo en piezas cuya máscara cambió en el tick y cerca del volumen activo.
  Mide y documenta el coste.

### Carga y razón
- El peso del lado colgante es `W = masa × gravedad`, con la masa provisional que ya usa `vuelo.js`.
- **Momento:** `M = W × brazo`, donde `brazo` es la distancia **horizontal** del centro de masa colgante al
  centroide del puente.
- **Tracción:** si el centro colgante está por debajo del puente, todo `W` tira de él. Si está encima, el puente
  trabaja a compresión y la tracción es 0.
- **Capacidad:**
  - de flexión, `PUENTE.flexion × n^1,5`, porque el módulo de una sección crece más rápido que su área;
  - de tracción, `PUENTE.traccion × n`.
  - Multiplícalas por el `aguante` de la pieza.
- La **razón** es el mayor de los dos cocientes, carga entre capacidad.

### Ceder, partirse
- Si `razón < PUENTE.ceder` (alrededor de 0,55), no pasa nada.
- Entre `ceder` y 1, **cede**.
  - El lado colgante se separa como fragmento, pero queda **colgado** del lado anclado: `padre` sigue apuntando a
    él y la unión es de tipo puente, con su sección.
  - Su pose gira alrededor del centroide del puente, por un eje horizontal perpendicular al brazo, en el sentido en
    que su centro de masa baja.
  - El ángulo es `PUENTE.caidaMax × (razón − ceder) / (1 − ceder)`, con una caída máxima de unos 14°.
  - El ángulo **nunca disminuye**: el metal no recupera la forma.
  - El cambio de ángulo es suave. Limítalo a unos grados por tick para que no salte de golpe.
  - Las celdas del puente se quedan en el lado anclado.
- Si el ácido sigue adelgazando el puente, recalcula `n` y la razón en cada tick.
- Si `razón ≥ 1`, **se parte**.
  - Suelta el fragmento sin impulso, con el campo de velocidad que tuviera.
  - Emite el suceso `puente-roto` con su sección y su razón.
  - El suceso `puente-cede` se emite una vez, al empezar a ceder.
- Un golpe cinético sobre un lado colgante rompe el puente si su impulso supera una resistencia derivada de la
  sección. Documéntala.
- El ácido que sigue activo acompaña a ambos lados, como ya hace en un corte.
- `estado()` expone, por pieza colgante, `puente: { seccion, razon, angulo, pivote }`, y `null` si no hay puente.
- Los guardados conservan todo lo necesario para continuar igual.

### Calibración
Ajusta `PUENTE` con el laboratorio, no a ojo, para que se cumpla esto:
- En el **cañón** de la Torreta (un cilindro de r 0,135 × 0,88 m en x), un ácido en su mitad que deja un puente de
  unas pocas celdas lo hace **ceder y después partirse** mientras crece.
  - Si deja más de unas 25 celdas de sección, **aguanta**, sin ceder o cediendo apenas.
- Un torso cortado en horizontal, con el centro colgante encima del puente, **no se parte** solo por su peso con
  una sección moderada, porque trabaja a compresión.

## B. Piezas interiores

### Cascos huecos
- `forma.hueco` (opcional, en metros) en `caja` y `cilindro`: el grosor de la pared.
  - Las celdas cuyo centro está a más de `hueco` hacia dentro de la superficie no existen en la máscara base.
  - Valida que `hueco ≥ celda` y que quede cavidad y pared.
- El raycast DDA ya atraviesa celdas vacías. Comprueba que un rayo desde fuera choca con la pared y que, tras
  abrir un agujero, el mismo rayo llega a lo que hay dentro.

### Piezas dentro del casco
- Una pieza interior es una pieza normal, con `padre` igual al casco, colocada en la cavidad.
  - Valida que sus celdas no se solapen con celdas vivas de la pared, y da un error claro si se solapan.
- **Su unión** se apoya en el suelo de la cavidad: el parche del padre es la zona de pared **bajo** la pieza, no la
  celda más próxima a su centro, que podría ser una pared lateral.
  - Documenta la regla. Aplícala solo cuando la pieza hija esté dentro de la envolvente del padre. Las uniones
    actuales no cambian.
- Cuando el casco se parte, cada interior sigue a la mitad que conserva su parche, como ya hacen las hijas.
  - Si su parche se pierde, cae dentro de la cavidad o fuera, con el contacto de la tarea 02.
  - El contacto debe tratar la cavidad como **vacía**: el SDF de un casco hueco es el de una cáscara.
- Botín, etiquetas y función funcionan igual en las piezas interiores.

### Tanque de laboratorio
Añade a `escenas.js` un robot `Tanque`, y descríbelo en la documentación:
- `casco`: raíz hueca, de unos 1,30 × 0,62 × 0,36 m y pared de 4 cm, de acero;
- dentro, `motor` (`motor`, acero y cobre) atrás, `municion` (`arma`) en el centro y `bateria` (`energia`) delante;
  cada uno con su color, su material y su zona funcional;
- encima, una `torreta` con un `cañón` largo en x.

## Vista
- **La cavidad.** La textura 3D debe distinguir tres casos: celda viva, celda quitada (había material) y celda que
  nunca tuvo material (cavidad). Usa un segundo canal o un código.
  - Al buscar la primera pared tras el hueco del corte, una **cara de la cavidad** (vecina de una celda que nunca
    tuvo material) se pinta como el interior del casco: imprimación gris o rojiza, mate y algo más oscura.
  - Una **cara de corte** (vecina de una celda quitada) conserva el borde del láser o del ácido.
  - La búsqueda debe llegar a la pared opuesta de la cavidad, no rendirse a mitad: revisa su número de pasos.
- **Las piezas interiores** se ven a través del corte con su profundidad correcta y quedan ocultas mientras el casco
  esté entero.
- **El puente que cede** se ve como una bisagra: el lado colgante gira desde el puente, sin dejar una franja vacía
  ni solaparse visiblemente con el lado anclado.
  - Si no se puede evitar del todo, que el solape quede dentro del metal y no se vea.
- Si alguna sombra muestra la pieza entera, la pasada de sombra necesita el mismo descarte. Si el laboratorio no
  usa sombras, dilo.

## Demos nuevas
- `?demo=puente`: un ácido en la mitad del cañón de la Torreta. El cañón cede unos segundos y después se parte y cae.
- `?demo=tanque`: dos ácidos fuertes en los costados del casco, a media eslora. El tanque se parte en dos, se ven
  la cavidad y las piezas interiores, y cada mitad se lleva las suyas.
- `?demo=tanque&fin`: la tabla de botín con las dos mitades y los interiores.
- Encuadre centrado en la acción, como en la tarea 02.
- La cámara de `tanque` mira el corte en diagonal, para ver dentro.

## Pruebas (deben fallar si la regla está mal)
En `paquetes/destruccion/pruebas/destruccion.mjs`:
- **Sección exacta.** Una barra en voladizo con una muesca construida a mano deja un puente de sección conocida
  (por ejemplo 2 × 2 = 4 celdas). La sección medida coincide.
- **Monotonía.**
  - Más sección baja la razón.
  - Un lado colgante más pesado, o más lejos, la sube.
- **Cede.**
  - Con la razón entre `ceder` y 1, el fragmento sigue colgado (`padre` no nulo).
  - Su ángulo es mayor que 0 y no disminuye en los ticks siguientes.
  - Su centro de masa queda por debajo del original.
- **Se parte.** Con la razón ≥ 1:
  - aparece `puente-roto`;
  - el fragmento vuela, cae y reposa;
  - la suma de materiales se conserva.
- **Sin falso puente.**
  - Un agujero esférico en el centro de un bloque grande, con paredes anchas, no crea fragmentos.
  - Un torso cortado en horizontal con la sección moderada de la calibración no se parte.
- **Casco hueco.**
  - El número de celdas es igual al de la cuenta analítica de la cáscara.
  - Un rayo choca con la pared; tras abrirla, el mismo rayo llega a la pieza interior.
- **Interiores.**
  - Un interior solapado con la pared da error.
  - En el tanque, el casco se parte en dos componentes, y cada interior queda con la mitad que tiene su parche.
  - Las funciones y el botín siguen a sus piezas.
  - Ningún interior queda dentro de la pared al reposar.
- **Continuación.** Un guardado en mitad de un puente que cede continúa idéntico byte por byte.
- Mide el coste del paso con el puente activo y el del tanque partiéndose, e imprímelo.

## Documentación
En `docs/DESTRUCCION-PIEZAS.md` y en el README del paquete:
- la regla del puente con sus fórmulas;
- la tabla `PUENTE`;
- el casco hueco y la regla del parche de los interiores;
- el robot `Tanque`;
- las demos nuevas;
- el coste.
Quita de los límites lo que ya no lo sea.

## Respuesta final
Breve y en lenguaje claro:
- qué cambiaste;
- los valores de `PUENTE` y cómo los calibraste;
- qué comprueban las pruebas nuevas y su resultado;
- el coste;
- qué debe mirar el orquestador en el laboratorio.
