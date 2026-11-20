# destruccion

Simulación aislada de rotura y recuperación de piezas. La entrada pública es
`index.js`. Funciona en Node y en el navegador y tiene cero dependencias.
El laboratorio consume el mismo contrato que usaría una vista de juego.

```js
import { crearMundo, definirRobot, cargar } from './index.js';

const muestra = definirRobot({ id: 'Banco', piezas: [{
  id: 'cuerpo', forma: { tipo: 'caja', medidas: [.48, .32, .40] },
  pos: [0, 0, .20], rot: [0, 0, 0, 1], padre: null, union: { resistencia: 6 },
  materiales: [{ material: 'acero', cantidad: 4 }], funcion: 'sensor',
  zonaFuncion: { tipo: 'esfera', pos: [0, -.08, 0], radio: .05 },
  aguante: 1, color: '#E7DFCE',
}] });
const mundo = crearMundo({ semilla: 7 });
mundo.agregarRobot(muestra, { pos: [0, 0, 0], rumbo: 0 });
const informe = mundo.disparar({ arma: 'laser', origen: [0, -1, .20], direccion: [0, 1, 0] });
mundo.avanzar(.5);
const copia = cargar(mundo.serializar());
copia.terminarBatalla();
```

## Definiciones y órdenes

- `definirRobot` valida y congela una copia del árbol. Se admite cualquier orden de las piezas, una sola raíz y materiales con nombres únicos y cantidades positivas. `MATERIALES` enumera los materiales de muestra. El tamaño máximo de una rejilla es de 262 144 celdas.
- `forma.tipo` acepta `caja`, `cilindro` o `esfera`. Las medidas y alturas son completas, los radios son radios. `eje` es `x`, `y` o `z`. La posición y la rotación de cada pieza son locales **al robot**. La forma funcional tiene su centro `pos` **en la pieza** y sus mismos ejes. Una zona funcional debe contener al menos un centro vivo.
- `agregarRobot` devuelve la identidad de la instancia. Al repetir una definición, añade `#2`, `#3`… `rumbo` gira en radianes desde +x hacia +y. Las poses usan metros, altura z y cuaterniones [x, y, z, w].
- `raycast({origen,direccion})` devuelve el índice de la primera celda ocupada que cruza, la distancia y el punto de **entrada a la celda**. Devuelve `null` en un fallo. La dirección se normaliza. Los restos en retirada u ocultos dejan de ser blancos.
- `disparar` admite potencia positiva (por defecto 1). En un impacto de ácido se puede fijar `duracionAcido` en segundos positivos. Por defecto crece durante 2,4 s. Devuelve impacto, identificadores `uid` afectados, celdas y cantidad perdida por material, uniones rotas, módulos perdidos y sucesos de la orden. En una mezcla homogénea, cada celda perdida cuenta para cada material presente. El informe del ácido cubre el contacto inicial. Su evolución posterior se lee en las instantáneas y los sucesos.
- `avanzar` acumula el resto en unidades enteras de 1/3 600 000 000 de paso (4,63 ps). Cada tick completo emite y mueve los proyectiles, aplica los charcos y los depósitos de ácido, actualiza las bisagras y después integra los conjuntos rígidos. `desaparicion('hundiendose'|'desvaneciendose')` cambia la presentación de la retirada.
- `terminarBatalla` completa los vuelos y las corrosiones pendientes mediante ticks ordinarios, expone los restos y congela el reloj. Puede llamarse varias veces. Solo generan botín las piezas sueltas o de robots caídos.

## Lecturas y guardado

`estado()` entrega tiempo, robots, piezas y restos registrados. En el orden original de la definición, `robots[].piezas` contiene el `uid` de cada pieza original sobreviviente o `null` si se consumió. `padre` en la instantánea referencia el `uid` al que la pieza sigue unida. Un fragmento conserva el `id` de origen y tiene un número de fragmento positivo. Las salidas, poses, materiales, zona, máscara y volúmenes están tipados en [index.d.ts](index.d.ts).

La máscara RLE alterna **valor, longitud**. Los valores son 0 (vacío), 1 (vivo) y 2 (vivo fundido). Se expande con x como eje rápido, luego y y z. El centro del índice tridimensional `i` es `(i + 0.5 − dim/2) × celda` en cada eje. `version` permite reutilizar una textura mientras cambia la pose. Los volúmenes de daño están en coordenadas locales. Formas, definiciones y RLE pueden compartirse como datos de solo lectura.

`sucesos()` devuelve una copia del historial en orden de emisión. `botin()` entrega materiales **recuperables** por resto y totales por material y módulo. La etiqueta usa siempre las cantidades **presentes**. `estado().restos` conserva el registro previo al rendimiento.

`serializar()` devuelve texto JSON con `formato: "cbl-destruccion", v: 2`. Guarda definiciones, máscaras, uniones, velocidades, corrosión, acumulador, números de disparo y fragmento, reposos e historial. `mundo.cargar(texto)` reemplaza el estado, y `cargar(texto)` crea otro mundo. La versión 2 incluye proyectiles, emisores, charcos, película local y corrosiones en curso. La carga de un guardado de versión 1 crea las tres colecciones de vuelo y suelo vacías.

## Granada, chorro y charco

| Orden y constantes | Comportamiento a potencia 1 |
| --- | --- |
| `arma: 'granada'`, `velocidad?` | 10 m/s por defecto. El primer contacto deposita un ácido de radio final 9,3 cm en la pieza o un charco en el suelo. Diez satélites se reparten a 15–25 cm en el plano tangente y buscan la superficie con un rayo de 17 cm. Su radio final varía entre 2,4 y 4,4 cm según el hash. |
| `arma: 'chorro'`, `modo?`, `duracion?`, `viento?` | Por defecto, directo, 1,2 s y viento [0, 0, 0] m/s. Una gota por tick, 60/s y hasta 160 vivas entre todos los emisores. Velocidad plena de 15 m/s durante los primeros dos tercios. En el último tercio cae linealmente hasta 5 m/s y el cono se abre hasta cuatro veces. |
| `ARMAS.chorro.directo` y `.caotico` | Semiconos de 1° y 6°, arrastres de 0,12 y 1,1 s⁻¹ respecto al aire. Solo el caótico añade ruido suave de hasta 3 m/s² por eje, con escala espacial de 0,8 m. |
| Depósito de chorro | Dentro de 6,5 cm en el marco de la pieza se alimenta el depósito activo. Crece de 1,8 cm hasta 3,8 cm × raíz de la potencia acumulada, con techo de 11 cm. Hasta seis manchas de chorro se conservan como esferas para el shader. Los impactos distantes adicionales crecen por la misma regla y pintan la rejilla local. Al secarse solo persiste su huella en `pelicula`. |
| `CHARCO` | Radio inicial objetivo de 36 cm por granada o de 6,5 cm por gota. Los aportes se funden por área hasta 48 cm. Crece en 0,5 s. El borde varía hasta un 12 % con ruido de escala 14 cm. La altura llega a 10 cm en 3 s. Se apaga a los 6 s del último aporte. La mancha parda se disipa en otros 3 s. |

La gravedad es 9,81 m/s². Cada segmento del paso de 1/60 s se compara con el suelo y la primera celda seleccionable. `PROYECTIL` limita el vuelo a 6 s o 35 m del origen. El charco contrasta los centros vivos en la pose actual, también en reposo y en vuelo. Comparte con el ácido la pérdida de material, el reparto de componentes y la revisión de puentes.

`disparar` devuelve `impacto: null` y una copia del `proyectil` o del `emisor`. La instantánea expone `proyectiles` con posición y velocidad, `emisores` con dirección y presión y `charcos` con centro, radio, altura, edad y actividad. `radioDelCharco(c, x, y)` devuelve el radio del borde en esa dirección horizontal. Los sucesos posteriores se pueden leer con `sucesos(indiceInicial)`.

- `granada-estalla` registra el disparo, el punto y la normal. `salpicadura` agrupa los diez extremos de los rayos y el uid de la pieza que tocó cada uno.
- `gota` registra el disparo, índice de gota, presión de salida y punto de contacto. `unidad` vale `null` en el suelo.
- `charco` anuncia la creación y el centro del disco. Su crecimiento y fusión se leen en la instantánea. `chorro-fin` señala la última emisión. Las gotas que quedan en vuelo siguen hasta su contacto o caducidad.

El laboratorio usa el clic para elegir pieza o suelo a 6 m del emisor. En el modo caótico el deslizador fija el viento lateral del siguiente disparo. [Granada sobre el Andador y charco junto a la Oruga](../../herramientas/laboratorio-destruccion/index.html?demo=granada&t=3.3&captura) · [Chorro a presión plena](../../herramientas/laboratorio-destruccion/index.html?demo=chorro&t=.9&captura) · [Cola del chorro](../../herramientas/laboratorio-destruccion/index.html?demo=chorro&t=1.45&captura) · [Chorro caótico con viento](../../herramientas/laboratorio-destruccion/index.html?demo=chorro-caotico&t=.88&captura).

El banco de coste mide 350 pasos individuales a partir de diez ráfagas tras dos de calentamiento, con un emisor y un charco corroyendo una placa. En Node 22.19.0 para macOS arm64 la mediana fue de **0,10 ms por paso**, frente al objetivo de 1,5 ms. La medida comprende la simulación sin construir instantáneas ni dibujar.

## Puentes y cascos

Al retirar material con láser o ácido de una pieza quieta y conexa, se prueban dos capas locales por eje junto al volumen activo. En la capa más débil, `n` cuenta los vóxeles que tienen vecinos por cara tanto en la componente con apoyo como en la colgante. Conserva el cuello la pieza anclada. La sección se vuelve a medir cuando cambia cualquiera de las dos máscaras.

Con peso `W = masa × gravedad` y distancia horizontal `b` al centroide del cuello, la flexión vale `W × b`. La tracción `T` vale `W` solo con el centro de masa por debajo del pivote. La razón es el máximo de `W × b / (aguante × flexion × n¹·⁵)` y `T / (aguante × traccion × n)`. La masa y el centro incluyen las hijas que conserva el fragmento.

| Tabla congelada `PUENTE` | Valor |
| --- | ---: |
| `capas` | 2 |
| `flexion` | 0,28 |
| `traccion` | 2 |
| `ceder` | 0,55 |
| `caidaMax` | 14° en radianes |
| `giroPorPaso` | 2° en radianes |
| `impulsoPorCelda` | 0,8 |

Entre `ceder` y 1, la unión emite `puente-cede`. El ángulo crece hacia `caidaMax × (razón − ceder) / (1 − ceder)` sin retroceder. Al llegar a 1, perder toda la sección o recibir un impulso superior a `impulsoPorCelda × n × aguante`, emite `puente-roto`. La pieza hereda el movimiento local. El guardado conserva el parche, el giro y la corrosión de ambos lados.

En la instantánea, `puente` contiene `{ seccion, razon, angulo, pivote }` o vale `null`. El ángulo está en radianes y el pivote en coordenadas del mundo. `carasUnion` contiene las caras vivas de montaje en la rejilla local original. `mascaraBase` es la RLE original compartida, con la que se distingue una celda eliminada de una cavidad de origen.

Cajas y cilindros admiten `forma.hueco` en metros. Se conservan los centros con profundidad ≤ espesor, con al menos una celda de grosor y una pared y cavidad representables. Se comprueba el solape de los vóxeles de una hija interior con la pared. Su parche proyecta las celdas vivas verticalmente al primer suelo de la cavidad. La mitad que conserva el parche se lleva la hija. Sin apoyo, la hija cae y el contacto usa el SDF de la cáscara. [Algoritmo de selección de capa y parches](../../docs/DESTRUCCION-PIEZAS.md#puente-de-metal).

El [Tanque](../../herramientas/laboratorio-destruccion/index.html?demo=tanque) tiene casco de acero de 1,30 × 0,62 × 0,36 m con pared de 4 cm, motor a popa, munición central, batería a proa y torreta con cañón en x. Dos ácidos reparten los interiores entre ambas mitades. [Tabla con los siete restos](../../herramientas/laboratorio-destruccion/index.html?demo=tanque&fin).

La [demo del puente](../../herramientas/laboratorio-destruccion/index.html?demo=puente) calibra el cañón de la Torreta con un ácido de 12 s. Con 26 celdas aguanta. Pasa 2,03 s colgado entre las secciones de 11 y 5 celdas. La medida en Node 22.19.0 sobre Apple M1 da 0,22 ms por paso con la bisagra activa y 2,7 ms para el paso que divide el tanque. Se miden 12 repeticiones tras el calentamiento, sin dibujo, guardado ni instantáneas.

## Verificación

`node paquetes/destruccion/pruebas/destruccion.mjs` comprueba geometría, daño, vuelo, restos, economía y continuación byte a byte. Imprime además la mediana de paso y raycast. Forma parte de `npm test`.

[Modelo y constantes](../../docs/DESTRUCCION-PIEZAS.md) · [Laboratorio](../../herramientas/laboratorio-destruccion/index.html)
