# Destrucción por piezas

Cada robot es un árbol de primitivas. La rejilla local de 4 cm conserva los centros interiores. Cada celda contiene la misma fracción de cada material de la pieza. La máscara viva decide impactos, masa, funcionamiento y botín.

Una unión exterior tiene dos parches, uno por pieza, alrededor de la celda más próxima al centro de su vecina. Un corte que vacía cualquiera de ellos suelta la unión. Tras retirar volumen se buscan componentes por seis caras. Se conserva la componente con apoyo o, en vuelo, la mayor. Las demás se separan y conservan su máscara, su pose y el movimiento que tenían. Hasta tres celdas aisladas se pierden como escoria. El módulo queda en una sola componente si conserva al menos el 52 % de su zona original. Perder o soltar la energía, o quedarse sin piezas en pie, derriba al robot.

| Arma | Efecto en el laboratorio a potencia 1 |
| --- | --- |
| Cinético | Impulso 9. El 48 % del exceso alcanza las uniones vecinas. Cráter de hasta 4,7 cm con aguante 1. |
| Explosivo | Impulso radial 14 con caída lineal hasta 80 cm. Cráter superficial de hasta 10,5 cm. |
| Láser | Cápsula de 5,2 cm de radio y 80 cm de perforación desde el primer impacto. El borde de 2,4 cm queda fundido. |
| Ácido | Sobre la pieza tocada, una esfera pasa de 4,5 a 22 cm en 2,4 s. Un ruido de valor 3D suave, en el marco de la pieza, reduce su borde hasta un 13 %. La vista recibe el hueco en la máscara. La mancha acompaña a los fragmentos que se separan. |
| Granada | Llega en parábola y al estallar deposita ácido principal y diez salpicaduras. Al caer al suelo forma un charco. |
| Chorro | Gotas continuas de ácido a presión variable. El directo concentra el impacto y el caótico lo abre con viento y turbulencia. |

| Estado de la pieza | Criterio | Factor |
| --- | --- | ---: |
| `intacta` | Sin daño | 1 |
| `dañada` | Golpe cinético o explosivo, o solo borde térmico sin perder volumen | 0,96 |
| `partida` | Pérdida de volumen por láser o ácido | 0,86 |
| `fundida` | El láser eliminó más del 25 % del volumen original | 0,60 |
| `null` | Se consumieron todas las celdas recuperables | 0 |

## Del impacto a la recolección

```text
en pie → pieza suelta o robot caído → vuelo → reposo y registro
                                               ↓ tras 3 s
                                   hundirse o desvanecerse (1 s)
                                               ↓
                                             oculto

terminarBatalla → completar vuelos y corrosión → exponer todos los restos
                                                 en la pose registrada
```

La simulación gira conjuntos de piezas alrededor de su centro de masas. El suelo plano limita el extremo inferior según la orientación. Las formas cortadas usan además la envolvente de sus columnas vivas.

Un grupo en vuelo también choca, con el mismo rebote y fricción que el suelo, contra las piezas quietas: las fijas de cualquier robot, los restos en reposo y los grupos que ya apoyan y casi no se mueven (un robot caído al que el ácido aún corroe). Sus puntos de prueba, las esquinas, aristas y caras de su caja más hasta 64 extremos de columna si está cortada, se comparan con el SDF de la otra forma en su marco local, y solo cuenta como sólida una celda viva. Dos grupos que vuelan rápido no chocan entre sí. Si el gradiente del SDF se anula (el centro exacto de una caja), el empuje va hacia arriba. `terminarBatalla` deja correr como mucho 60 s simulados y fuerza el reposo de lo que quede. El reposo guarda identidad, etiqueta, materiales, módulo, pose, instante y máscara RLE.

La etiqueta tiene el formato `material-cantidad-función-estado`, por ejemplo `acero-3+cobre-1-sensor-dañada`. Usa la masa **actual** a una décima, omite el cero decimal y escribe `sin` cuando falta el módulo. `funcionOriginal` conserva el diseño.

Por material, **botín = cantidad inicial × (celdas sanas + 0,38 × celdas fundidas) / celdas iniciales × factor de estado**. Cada resto con función aporta un módulo. Toda la regla de rendimiento está en `recuperar`. En la comparación de los tres Andadores caídos se recuperan aproximadamente 2,87, 2,39 y 0,97 unidades de acero del torso con cinético, láser y ácido respectivamente. El chasis aporta sus cinco unidades en los tres casos.

## Puente de metal

Al quitar celdas con láser o ácido, la pieza se somete primero al reparto ordinario. Si queda una sola componente útil, en pie o en reposo, se ensayan dos capas por eje de la rejilla local. Para la esfera se toma el centro del impacto. Para la cápsula se toma, en cada eje recorrido, la media de los índices de sus extremos recortados a la rejilla. Se ensaya la capa inferior de ese índice y la siguiente. Se excluyen los planos extremos. Solo entran en la prueba los centros vivos a distancia del segmento de impacto menor o igual que el radio actual más dos celdas.

Para cada capa se retiran provisionalmente esos centros y se buscan componentes por seis caras. Las de hasta tres celdas cuentan como escoria para esta prueba. La anclada se elige igual que en un corte, por el parche de la montura o, en una raíz en pie, por los parches de sus hijas. Entre candidatas se prefiere la mayor. Para una raíz sin parche se toma la mayor. Para cada lado colgante, **la sección n cuenta una vez cada celda retirada que tenga al menos una cara vecina anclada y otra vecina colgante**. Un plano con sección cero no ofrece bisagra. Se elige el plano con la menor sección positiva y se desempata por orden x, y, z y de capa. Los vóxeles del cuello permanecen en el ancla. El pivote es la media de los centros de sus celdas de sección vivas.

El peso es **W = masa × 9,81**. La masa suma las cantidades presentes del fragmento y de las hijas que conservan allí su parche. El brazo es la distancia horizontal entre el pivote y el centro de masa de ese conjunto. La carga de flexión es **M = W × brazo**. La tracción **T = W** cuando el centro está más bajo que el pivote y **T = 0** a su altura o por encima. Con aguante **A**, la razón de carga es **máx(M / (A × flexion × n¹·⁵), T / (A × traccion × n))**.

| Valor de `PUENTE` | Ajuste | Uso |
| --- | ---: | --- |
| `capas` | 2 | Capas candidatas por eje y margen del volumen en celdas |
| `flexion` | 0,28 | Capacidad de momento por n¹·⁵ |
| `traccion` | 2 | Capacidad de tracción por celda |
| `ceder` | 0,55 | Inicio de la deformación permanente |
| `caidaMax` | 14° | Caída angular máxima, en radianes en la API |
| `giroPorPaso` | 2° | Incremento máximo por tick de 1/60 s |
| `impulsoPorCelda` | 0,8 | Resistencia al impulso por celda y unidad de aguante |

Por debajo de 0,55 se conserva la pieza. Desde 0,55 hasta 1 se emite una sola vez `puente-cede` y se crea un fragmento con `padre`. Su ángulo objetivo es `caidaMax × (razón − ceder) / (1 − ceder)`. El giro se acumula alrededor del eje horizontal perpendicular al brazo inicial, hacia abajo, hasta el objetivo o la vertical. El metal conserva la caída adquirida. Ambas máscaras heredan el ácido en su propio marco local. Un cambio de máscara en cualquiera de ellas vuelve a contar las caras que sobreviven y sitúa el pivote en su centroide. Un conjunto en vuelo conserva rígida la pose.

Con razón ≥ 1 o sin sección se emite `puente-roto` con sección y razón. Para sección cero se registra `Number.MAX_VALUE` como sobrecarga serializable. La caída por peso hereda la velocidad lineal y angular en el centro de masa, incluido el giro de la bisagra. Un golpe cinético rompe la unión cuando su impulso supera `impulsoPorCelda × n × aguante`. La rotura cinética conserva también el empuje del golpe.

## Cascos e interiores

En cajas y cilindros, `forma.hueco` es el espesor de pared en metros. Se conservan los centros de la envolvente cuya profundidad sea como máximo ese espesor. La caja interior reduce cada dimensión en dos espesores. En el cilindro se descuentan un espesor al radio y dos a la altura. Se exige al menos una celda de espesor y centros de pared y cavidad. El contacto usa la máscara viva y la distancia con signo de la cáscara, `max(SDF exterior, −SDF de la cavidad)`.

Si el centro de una hija está dentro de la envolvente del padre hueco, se comprueba que sus centros estén dentro y que ninguno de sus vóxeles vivos penetre una celda de pared. Se admite tangencia incluso con montajes girados. De cada centro vivo de la hija se lanza un rayo vertical hacia abajo en la pose del robot. El parche del padre contiene la primera celda de pared alcanzada por cada rayo. El de la hija conserva la celda más baja que proyectó a cada uno de esos apoyos. Cada interior sigue al dueño de su parche. Si lo pierde, cae y puede apoyar en la cara interior. Los vértices de los vóxeles del contorno de un interior en vuelo se barren por DDA desde la pose anterior contra las mitades quietas del casco. La primera pared viva impide que atraviese el suelo de 4 cm entre dos ticks. Un resto cortado vuelve a volar si pierde su apoyo, con una tolerancia de contacto de 0,1 mm.

El **Tanque** monta un casco de acero de 1,30 × 0,62 × 0,36 m con pared de 4 cm, el centro del casco a z = 0,18 m y la base a ras de suelo. Los centros de la torreta y del cañón largo en x quedan a 0,44 y 0,52 m de altura. Dentro lleva el motor de acero y cobre a popa, munición con función de arma en el centro y batería con función de energía a proa. Los centros del motor, la munición y la batería quedan a 0,13, 0,11 y 0,13 m del suelo, respectivamente. Cada pieza conserva su zona funcional, sus cantidades y su etiqueta.

## Guiones de la tarea 03

- [Puente](../herramientas/laboratorio-destruccion/index.html?demo=puente). Un ácido de potencia 1,45 crece durante 12 s en el cañón de la Torreta. La duración ampliada permite seguir la bisagra a velocidad normal. En la semilla 129, con 26 celdas todavía aguanta. Cede en el paso 555 con 11 celdas y razón 0,563. Alcanza 10,4° y rompe en el paso 677 con 5 celdas y razón 1,051. Son 2,03 s de deformación. [Ver el puente a los 10,5 s](../herramientas/laboratorio-destruccion/index.html?demo=puente&t=10.5).
- [Tanque](../herramientas/laboratorio-destruccion/index.html?demo=tanque). Dos ácidos de potencia 3,8 abren los costados a media eslora y a 0,18 m del suelo. En el paso 108 se separa el casco. El motor y la munición quedan a popa y la batería a proa. En la toma diagonal se ven el motor, la munición y la batería. [Ver el corte a los 3,33 s](../herramientas/laboratorio-destruccion/index.html?demo=tanque&t=3.33&captura).
- [Botín del tanque](../herramientas/laboratorio-destruccion/index.html?demo=tanque&fin). La tabla presenta siete restos, incluidas las dos mitades, las tres piezas interiores, la torreta y el cañón.

## Tarea 04 · Ácido en vuelo y en el suelo

La granada y cada gota avanzan a 60 Hz. En cada tick, el suelo y la máscara de las piezas compiten por el primer contacto a lo largo del segmento recorrido. La granada integra gravedad de 9,81 m/s² con el desplazamiento de medio paso de aceleración. Las gotas añaden el arrastre de su velocidad respecto al aire. El hash de semilla, número de disparo e índice de gota fija la dispersión y el ruido. El vuelo caduca a los 6 s o a 35 m del emisor.

| Tabla | Constantes y regla |
| --- | --- |
| `ARMAS.granada` | 10 m/s por defecto, con velocidad configurable. A potencia 1, el ácido principal termina con 9,3 cm de radio. Diez satélites salen del impacto en sectores del plano tangente. Recorren entre 15 y 25 cm mientras se elevan 9 cm respecto a la cara. Si el trayecto está libre, un rayo de 17 cm busca la superficie en sentido contrario a la normal. El hash de cada satélite fija su radio final entre 2,4 y 4,4 cm. |
| `ARMAS.chorro` | Duración de 1,2 s y una gota por tick, con tope global de 160 gotas vivas. Presión 1 durante dos tercios, seguida de una bajada lineal hasta ⅓. La velocidad es 15 m/s × presión. La amplitud angular aumenta hasta cuatro veces en la cola. El directo concentra las muestras hacia el eje con exponente 2. |
| Modos | Directo con semicono de 1° y arrastre de 0,12 s⁻¹. Caótico con semicono de 6°, arrastre de 1,1 s⁻¹ y turbulencia suave de amplitud 3 m/s² por eje en una red de 0,8 m que cambia con el tiempo. El viento se expresa en m/s. |
| Gotas sobre piezas | Los centros a menos de 6,5 cm de un depósito activo de chorro alimentan su radio final. Parte de 1,8 cm y crece durante 2,4 s hasta 3,8 cm × raíz de la potencia acumulada, con tope de 11 cm. En una pieza se conservan hasta seis volúmenes analíticos de chorro. Las manchas adicionales se dibujan con una textura de la película local que guarda distancia al borde y tiempo de secado por celda. Un depósito sigue aceptando gotas mientras está activo en cualquiera de las dos representaciones. |
| `CHARCO` | El radio objetivo es de 36 cm por granada y 6,5 cm por gota, escalado por la raíz de la potencia. Dos aportes próximos suman sus áreas, con centro ponderado y radio máximo de 48 cm. El disco crece en 0,5 s y su altura llega a 10 cm en 3 s. El ruido de escala 14 cm reduce el radio hasta un 12 %. El núcleo y el decal comparten la función del borde. |

El charco corroe centros vivos de piezas visibles en su pose actual. Las piezas que caen en él pierden material desde que lo alcanzan. El hueco queda en la máscara y el cilindro local delimita el borde verde. Cada corte sigue el mismo reparto de componentes, peso de puentes, materiales y botín que el ácido adherido. A los 6 s del último aporte cesa la corrosión y el decal pasa a pardo durante 3 s.

El informe inmediato lleva `impacto: null` y el `proyectil` o `emisor` creado. `granada-estalla` da el punto y la normal, `salpicadura` reúne los diez rayos, `gota` registra cada contacto con su presión de salida, `charco` anuncia un disco nuevo y `chorro-fin` señala el fin de la emisión. Los impactos en suelo tienen `unidad: null`. La instantánea expone proyectiles, emisores y charcos. El guardado **v: 2** conserva sus estados y el acumulador de subpasos. Los guardados v: 1 cargan con las tres colecciones vacías. El fin de batalla completa los efectos dentro del límite de 60 s simulados.

**Capturas del laboratorio.** El clic conserva el emisor a 6 m y elige un punto de la pieza o del suelo. La granada usa el ángulo bajo, o 45° fuera de alcance. El chorro compensa la caída a presión plena con el arrastre del modo seleccionado.

- [Granada al estallar, 0,78 s](../herramientas/laboratorio-destruccion/index.html?demo=granada&t=.78&captura) y [charco bajo la Oruga, 3,3 s](../herramientas/laboratorio-destruccion/index.html?demo=granada&t=3.3&captura). La primera granada toca el torso del Andador en el paso 43 y la segunda toca el suelo en el 125. A los 3,3 s quedan once manchas separadas en el torso y la cabeza, con los diez satélites a 20,9 cm de media del impacto principal.
- [Chorro directo a presión plena](../herramientas/laboratorio-destruccion/index.html?demo=chorro&t=.88&captura) y [cola de la ráfaga](../herramientas/laboratorio-destruccion/index.html?demo=chorro&t=1.45&captura). La vista une las gotas consecutivas del mismo emisor con un tubo translúcido de unos 4 cm. A menor presión aparecen huecos, tramos cada vez más cortos y gotas sueltas de unos 3 cm. [Toma a los 0,90 s](../herramientas/laboratorio-destruccion/index.html?demo=chorro&t=.9&captura) · [Captura fija del emisor y la Torreta a los 0,90 s](qa/destruccion-ronda2-2026-11-20/chorro-directo.png).
- [Chorro caótico](../herramientas/laboratorio-destruccion/index.html?demo=chorro-caotico&t=.88&captura). Mismo blanco y encuadre, con un viento lateral inicial de 2 m/s.

En la placa de prueba a 6 m, **47 de las 48 gotas** a presión plena impactaron a menos de 10 cm del blanco. El último tercio alcanzó 4,65 m de media. La desviación típica lateral del caótico fue 7,6 veces la del directo. Con viento de 3 m/s su media se desplazó 40 cm. En Node 22.19.0, macOS arm64, la mediana con chorro y charco activos fue de **0,10 ms por paso**. Se midieron 350 ticks individuales después del calentamiento, con ambos efectos sobre la misma pieza y sin dibujo. La suite comprueba el objetivo de 1,5 ms y vuelve a imprimir la medida.

## Dibujo y coste

La vista usa las primitivas de Three r180. El shader combina las últimas **12** esferas o cápsulas locales con una textura 3D RG. El rojo indica ocupación actual y el verde, material de origen. La vista lee los vóxeles exactos en un casco y filtra la máscara de las piezas macizas. Al superar el tope, la textura conserva los cortes anteriores, que pierden su borde SDF individual. En cada píxel perforado busca la primera pared interior, corrige la profundidad y oscurece el corte y las caras traseras. El recorrido cubre la diagonal completa de la forma en pasos de 0,22 celdas. Si el vecino anterior era cavidad, la pared lleva imprimación rojiza mate. Si era material retirado, se dibuja el borde del corte. La profundidad del primer material alcanzado decide la oclusión de cada interior. Entre las dos poses de una bisagra se dibujan únicamente los laterales de las caras que siguen unidas, con los extremos 0,5 mm dentro del metal y rugosidad 0,92 (`ACABADO`). El laboratorio no usa mapas de sombras. El láser se enfría de naranja a carbón en 3,5 s. El ácido tiene, de fuera a dentro, una aureola mate con picaduras, un filo verde fino con espuma que se mueve despacio y el hueco; al terminar de corroer, el verde se apaga en 3 s a una costra parda. La alta frecuencia se atenúa con `fwidth`. El láser sale de un emisor visible a 6 m y 1 m de altura; el clic solo elige el punto. El grupo de escena convierte (x, y, z) del mapa a (x, z, −y) de Three.

Las tablas congeladas están en `paquetes/destruccion/tablas.js`. `ARMAS` reúne los perfiles anteriores. `MATERIALES` enumera los cinco materiales base del laboratorio. `FISICA` fija paso 1/60 s, gravedad 9,81, restitución 0,22, fricción tangencial 0,79 y amortiguación angular 0,84 por contacto. Dieciocho pasos de contacto bajo 0,11 m/s y 0,11 rad/s fijan la pose. El radio del parche de unión es 4,5 cm. `RESTOS` fija los tiempos de salida y `RENDIMIENTO` contiene los factores de recuperación.

Una caja de 48 cm tiene 12 × 12 × 12 = 1 728 celdas. Medición en Node 22.19.0, macOS arm64, con tres robots y nueve piezas en vuelo (12 288 celdas iniciales): **0,51 ms por paso y 0,010 ms por raycast** (0,063 ms antes del contacto entre piezas). Son medianas de 12 tandas de 16 pasos o 400 consultas sobre nueve piezas, sin GPU ni construcción de instantáneas. La prueba repite la medida en cada ejecución.

En la tarea 03 la búsqueda se limita al volumen activo de las máscaras que perdieron celdas. Cada una requiere a lo sumo seis recorridos de conectividad de su rejilla (tope de 262 144 celdas). Una bisagra creada vuelve a probar únicamente su parche cuando cambia una de sus dos máscaras. En Node 22.19.0 sobre Apple M1 se midieron **0,22 ms por paso con el puente activo** y **2,7 ms en el tick que parte el tanque**. Son medianas de 12 repeticiones tras tres de calentamiento. Se restaura el estado previo fuera del cronómetro y se mide solo el avance del mundo. La primera medida promedia el intervalo colgado y la segunda aísla el paso 108.

Quedan para otras tareas el inventario, la integración con War, Factory y Campaign y el equilibrio definitivo del botín. La física no hace choques entre dos grupos en vuelo rápido ni apilamiento con varias iteraciones. El orquestador revisó las diez demos en el navegador con GPU y guardó once tomas en [`docs/qa/destruccion-ronda2-2026-11-20/`](qa/destruccion-ronda2-2026-11-20/). En esa revisión corrigió además unas franjas oscuras en los cilindros dañados: al filtrar la máscara, las celdas de fuera de la forma bajaban el canal vivo junto a la superficie curva. Ahora una celda solo cuenta como quitada si tuvo material y ya no lo tiene.

[Contrato del núcleo](../paquetes/destruccion/README.md) · [Abrir laboratorio](../herramientas/laboratorio-destruccion/index.html)
