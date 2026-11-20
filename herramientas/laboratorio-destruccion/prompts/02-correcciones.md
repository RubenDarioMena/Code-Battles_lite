# Tarea 02 · Correcciones tras la revisión en WebGL

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Tu tarea 01 está hecha en el árbol de trabajo, sin commit: no
la deshagas. Toca solo:
- `paquetes/destruccion/`;
- `herramientas/laboratorio-destruccion/` (salvo `prompts/`);
- `docs/DESTRUCCION-PIEZAS.md`.

No hagas commits. Deben seguir pasando:
- `node paquetes/destruccion/pruebas/destruccion.mjs`;
- `node pruebas/fronteras.mjs`;
- `npm run tipos`.

El orquestador revisó las demos en WebGL. La mecánica y el botín están bien. Corrige esto:

## 1. Las piezas sueltas atraviesan el robot
En `?demo=acido`, la antena cae y queda **metida dentro del chasis**. En `?demo=corte`, el trozo del cañón queda
dentro de la base o flotando junto a ella.
- Añade un contacto barato de cada pieza suelta contra las **piezas que siguen fijas** en cualquier robot, y contra
  los restos ya en reposo.
- Usa los mismos puntos de contacto que con el suelo, probados contra la forma de la otra pieza (SDF de caja,
  cilindro o esfera en su marco local). Si la otra pieza tiene huecos, cuenta como sólida solo una celda viva.
- Con el mismo rebote, fricción y reposo que el suelo.
- Sigue determinista y sin choques entre dos piezas que vuelan a la vez.
- Prueba nueva: tras reposar, ningún punto de contacto de una pieza suelta queda dentro de una pieza fija, en
  ninguna demo.
- Mide el coste del paso otra vez.

## 2. El ácido parece un tablero de ajedrez
El borde verde es un patrón de cuadros de alta frecuencia (`sin(73x)·cos(91y)`) que parpadea y no parece corrosión.
En la tabla de `?demo=comparar&fin`, el torso corroído es una banda de ruido blanco y verde.
- Cambia a un **ruido de valor o gradiente 3D suave**, con 2 o 3 octavas, en el espacio local de la pieza. Lo mismo
  en el radio irregular del SDF, para que ambos coincidan.
- Al mirarla, debe leerse:
  - el metal sano;
  - una aureola de corrosión mate y oscura, con picaduras, que se aclara hacia fuera;
  - un borde verde ácido fino, con espuma o burbujas que se mueven despacio mientras el ácido está activo;
  - el hueco.
- Al terminar de corroer, el verde se apaga a una costra parda en unos segundos, como el láser se enfría a carbón.
- Sin aliasing a la distancia de las demos: atenúa la frecuencia alta con `fwidth`.

## 3. El borde del láser es demasiado ancho
En `?demo=laser`, el disco incandescente es varias veces más ancho que el canal, y el canal casi no se ve.
- El anillo incandescente debe ser estrecho, unos 1,5 a 2 cm más allá del canal.
- El canal debe verse **hondo**: tapa oscura dentro y algo de incandescencia en las paredes del tubo.
- Comprueba que la sección quitada en el núcleo y el agujero dibujado tengan el mismo radio.

## 4. El rayo pinta una franja naranja en el suelo
El trazo del láser sale del origen del disparo, junto a la cámara, y en pantalla se ve como una franja ancha sobre
el suelo.
- En las demos y en el clic, el disparo sale de un **emisor visible** fuera del robot, por ejemplo a 6 m, a 1 m de
  altura y en dirección al punto. Un marcador pequeño indica el arma.
- El clic solo elige el punto de impacto: el rayo del núcleo va del emisor a ese punto.
- El haz es fino, con núcleo blanco y halo, y se desvanece.

## 5. Encuadre
- La cámara inicial de cada demo debe encuadrar la acción en el centro.
- En `comparar`, los tres robots y sus restos, también los que salieron volando.

## Respuesta final
Breve y en lenguaje claro:
- qué cambiaste;
- qué comprueban las pruebas nuevas y su resultado;
- el coste nuevo del paso;
- qué debe mirar el orquestador.
