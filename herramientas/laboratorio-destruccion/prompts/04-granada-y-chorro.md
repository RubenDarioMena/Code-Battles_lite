# Tarea 04 · Dos presentaciones más del ácido: granada y chorro

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Las tareas 01 a 03 están hechas en el árbol de trabajo (la 03,
puente e interiores, sin commit): no las deshagas. Toca solo:
- `paquetes/destruccion/`;
- `herramientas/laboratorio-destruccion/` (salvo `prompts/`);
- `docs/DESTRUCCION-PIEZAS.md`.

No hagas commits. Deben seguir pasando:
- `node paquetes/destruccion/pruebas/destruccion.mjs`;
- `node pruebas/fronteras.mjs`;
- `npm run tipos`, si hay `node_modules`. Si no lo hay, dilo y no instales nada.

No puedes abrir un navegador. El orquestador revisará el laboratorio en WebGL.

## Idea de juego
El disparo ácido actual pega una gota que crece sobre la pieza tocada. Gusta mucho. Queremos dos presentaciones más
del mismo ácido, con la misma corrosión, el mismo aspecto y la misma regla de botín:
1. **Granada.** Vuela en parábola y revienta al contacto. Deja una **salpicadura** sobre la unidad tocada o, si cae
   al suelo, un **charco** que corroe lo que lo pisa.
2. **Chorro.** Un lanzador que escupe ácido en un chorro continuo, que puede ser:
   - **directo:** un chorro limpio y concentrado. Al final del disparo la presión cae y el chorro se rompe en gotas
     que se quedan cortas y se dispersan;
   - **caótico:** el aire lo abre y lo desvía (viento y turbulencia), y salpica en un abanico irregular.

Se mantienen todas las reglas del paquete:
- determinista, sin `Math.random`, reloj, DOM ni Three;
- el azar sale del hash de la semilla, el número de disparo y el índice de gota;
- paso fijo y `serializar()` idéntico byte por byte, también con proyectiles en el aire;
- la máscara de celdas es la verdad;
- las constantes nuevas van en `ARMAS` (`granada`, `chorro`) y en tablas congeladas con nombre (`CHARCO`, por
  ejemplo), documentadas.

## Núcleo

### Proyectiles
- Un estado nuevo del mundo guarda los **proyectiles en vuelo**: la granada y las gotas del chorro.
  - Cada tick integran gravedad, más arrastre lineal y viento en las gotas.
  - Prueban el **segmento** recorrido en el tick contra las piezas seleccionables, con el mismo DDA de `buscar`
    pero limitado a la longitud del segmento, y contra el suelo `z = 0`.
  - Gana el primer contacto. Un proyectil que sale de un radio de trabajo razonable o pasa demasiado tiempo en el
    aire desaparece sin efecto.
- `disparar` sigue devolviendo un informe inmediato. En estas dos armas, `impacto` es `null` y el informe trae el
  `proyectil` (o el `emisor`) creado. Los efectos llegan en ticks posteriores, como sucesos: `granada-estalla`,
  `salpicadura`, `charco`, `gota` (agrégalas si son muchas), `chorro-fin`.
- `estado()` expone, para la vista:
  - los proyectiles (tipo, posición, velocidad);
  - los emisores de chorro activos (origen, dirección, presión actual);
  - los charcos (centro, radio, edad, si siguen activos).

### Granada (`arma: 'granada'`)
- `disparar({ arma: 'granada', origen, direccion, potencia, velocidad? })` lanza la granada con esa velocidad
  inicial (por defecto la de `ARMAS.granada`) en esa dirección.
- **Al tocar una pieza** revienta:
  - un **ácido principal** en el punto, como el disparo ácido, con su potencia algo reducida;
  - unas **8 a 12 gotas satélite** que salen del punto en un cono alrededor de la normal de la superficie y del
    rebote de la dirección de llegada, con direcciones y longitudes por hash. Cada una es un rayo corto (unos
    0,45 m como mucho):
    - si toca una pieza, de esa unidad o de una vecina, deja allí un ácido pequeño;
    - si toca el suelo, alimenta un charco.
- **Al tocar el suelo** revienta en un **charco** y unas gotas satélite que pueden manchar las piezas cercanas.
- **Charco** (`CHARCO`):
  - un disco en el suelo, de borde irregular por ruido suave, que crece hasta su radio en medio segundo y dura
    unos 6 s;
  - corroe las celdas vivas de cualquier pieza no oculta, en pie, suelta o en reposo, cuyo centro está dentro del
    disco y por debajo de una altura que sube despacio, hasta unos 10 cm;
  - una pieza que cae en un charco activo también se corroe;
  - los charcos cercanos se funden en uno;
  - la corrosión del charco sigue las reglas del ácido: estado `partida`, componentes, fragmentos, puente y botín;
  - el borde del corte que deja el charco se ve verde en la pieza: registra un volumen local equivalente o pasa el
    charco al shader;
  - después de apagarse queda una mancha parda que se borra en la vista, sin efecto en el núcleo.

### Chorro (`arma: 'chorro'`)
- `disparar({ arma: 'chorro', origen, direccion, potencia, modo: 'directo' | 'caotico', duracion?, viento? })` crea
  un **emisor** que dispara gotas durante `duracion` (por defecto unos 1,2 s).
  - Unas 60 gotas por segundo, o una por tick.
  - `viento` es un vector en m/s y vale 0 por defecto.
- **Presión.** Plena durante unos dos tercios de la duración. Después cae de forma lineal hasta un tercio,
  aproximadamente, al terminar.
  - La velocidad de salida es proporcional a la presión.
  - La dispersión crece cuando la presión baja.
  - Así, el final del chorro se queda corto y se rompe en gotas.
- **Directo:**
  - cono estrecho, de alrededor de 1°;
  - arrastre bajo;
  - sin turbulencia.
- **Caótico:**
  - cono más abierto, de alrededor de 6°;
  - más arrastre;
  - una **turbulencia** suave, determinista, de ruido en el espacio y el tiempo, de unos 3 m/s² de amplitud;
  - el viento empuja las gotas.
- **Cada gota que toca una pieza** deposita ácido.
  - Para no multiplicar volúmenes, si la pieza ya tiene un ácido de chorro activo a menos de unos 6 cm del punto,
    en su marco local, la gota **alimenta** ese volumen: su radio final crece con la raíz del número de gotas, con
    un tope. Si no, abre un volumen nuevo pequeño.
  - Debe seguir bajo el tope de 12 volúmenes del shader en una ráfaga normal.
- **Cada gota que toca el suelo** alimenta un charco pequeño, o lo funde con uno cercano.
- Limita las gotas vivas, por ejemplo a 160, y documenta el tope.

### Fin de batalla y guardado
- `terminarBatalla` deja terminar los proyectiles, los emisores, los charcos y sus corrosiones, dentro del tope de
  60 s que ya existe. Después expone los restos.
- Sube el formato a `v: 2`. Carga `v: 1` con proyectiles, emisores y charcos vacíos.

## Laboratorio
- El selector de arma añade `granada`, `chorro directo` y `chorro caótico`.
  - Con el chorro caótico, un deslizador de viento lateral.
- **El clic** elige el blanco, como ahora, desde el emisor a 6 m:
  - la **granada** se lanza en parábola. Resuelve el ángulo bajo para su velocidad. Si no alcanza, usa 45°;
  - el **chorro directo** apunta compensando la caída de las gotas a presión plena;
  - el **chorro caótico** apunta igual. El aire hace el resto.
- **Vista:**
  - la granada es una esfera pequeña verde con brillo y una estela corta. Al reventar, un destello verde y gotas
    visuales;
  - las gotas del chorro son pequeñas esferas o trazos alargados según su velocidad, verdes, emisivos y translúcidos,
    con instancias;
  - el **charco** es un decal sobre el suelo: verde, brillante y húmedo, de borde irregular, con burbujas lentas.
    Al apagarse pasa a una mancha parda que se borra;
  - la salpicadura sobre la unidad se lee como varias manchas de ácido repartidas, no como un único círculo.
- **Demos nuevas**, con encuadre centrado en la acción:
  - `?demo=granada`: una granada sobre el torso del Andador, que lo salpica, y otra al suelo junto a la Oruga, cuyo
    charco corroe la parte baja de su bloque;
  - `?demo=chorro`: un chorro directo sobre la Torreta; se ve el final que se queda corto;
  - `?demo=chorro-caotico`: el mismo chorro en modo caótico con viento lateral, que salpica en abanico.
- `?demo=…&t=…&captura`, como ahora, deja una vista fija para captura.

## Pruebas (deben fallar si la regla está mal)
- **Balística.** Sin robots, la granada cae donde dice la parábola analítica, a menos de 1 cm.
- **Salpicadura.**
  - Una granada sobre una pieza crea su ácido principal y al menos un satélite sobre esa pieza.
  - Con el mismo hash, el resultado es el mismo.
  - Junto a otra unidad, algún satélite la alcanza.
- **Charco.**
  - Corroe la parte baja de una pieza dentro de su radio y no toca una pieza fuera de él ni celdas por encima de
    su altura.
  - Se apaga a su tiempo.
  - Un resto que cae en un charco activo se corroe.
- **Chorro directo.**
  - En la fase de presión plena, al menos el 80 % de las gotas impactan a menos de 10 cm del punto apuntado.
  - En la fase final, la distancia media de impacto es claramente menor: se queda corto.
- **Chorro caótico.**
  - La dispersión, como desviación típica de los impactos, es al menos 3 veces la del directo.
  - Con viento lateral, el impacto medio se desplaza en la dirección del viento.
- **Tope de volúmenes.** Una ráfaga de 1,2 s sobre una pieza deja como mucho unos 6 volúmenes de ácido en ella.
- **Botín.** Lo que corroen la granada, el charco y el chorro se descuenta igual que el ácido, y la suma de
  materiales se conserva entre restos y pérdidas.
- **Continuación.** Un guardado con una granada en el aire, un chorro a medias y un charco activo continúa idéntico
  byte por byte. Un guardado `v: 1` carga.
- **Coste.** Mide la mediana del paso con un chorro activo y un charco, e imprímela. Objetivo: menos de 1,5 ms.

## Documentación
En `docs/DESTRUCCION-PIEZAS.md` y en el README del paquete:
- las dos armas;
- el charco y la presión del chorro, con sus constantes;
- los sucesos nuevos;
- el formato `v: 2`;
- las demos;
- el coste.

## Respuesta final
Breve y en lenguaje claro:
- qué cambiaste;
- las constantes elegidas;
- qué comprueban las pruebas nuevas y su resultado;
- el coste;
- qué debe mirar el orquestador en el laboratorio.
