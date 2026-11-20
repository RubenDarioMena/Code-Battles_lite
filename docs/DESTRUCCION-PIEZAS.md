# Destrucción por piezas

**Tarea 01 del laboratorio.** Cada robot es un árbol de primitivas. La rejilla local de 4 cm conserva los centros interiores. Cada celda contiene la misma fracción de cada material de la pieza. La máscara viva decide impactos, masa, funcionamiento y botín.

Una unión tiene dos parches, uno por pieza, alrededor de la celda más próxima al centro de su vecina. Un corte que vacía cualquiera de ellos suelta la unión. Tras retirar volumen se buscan componentes por seis caras. Se conserva la componente con apoyo o, en vuelo, la mayor. Las demás se separan y conservan su máscara, su pose y el movimiento que tenían. Hasta tres celdas aisladas se pierden como escoria. El módulo queda en una sola componente si conserva al menos el 52 % de su zona original. Perder o soltar la energía, o quedarse sin piezas en pie, derriba al robot.

| Arma | Efecto en el laboratorio a potencia 1 |
| --- | --- |
| Cinético | Impulso 9. El 48 % del exceso alcanza las uniones vecinas. Cráter de hasta 4,7 cm con aguante 1. |
| Explosivo | Impulso radial 14 con caída lineal hasta 80 cm. Cráter superficial de hasta 10,5 cm. |
| Láser | Cápsula de 5,2 cm de radio y 80 cm de perforación desde el primer impacto. El borde de 2,4 cm queda fundido. |
| Ácido | Sobre la pieza tocada, una esfera pasa de 4,5 a 22 cm en 2,4 s. Un ruido de valor 3D suave, en el marco de la pieza, reduce su borde hasta un 13 %; la vista usa el mismo ruido. La mancha acompaña a los fragmentos que se separan. |

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

## Dibujo y coste

La vista usa las primitivas de Three r180. El shader combina las últimas **12** esferas o cápsulas locales con una textura 3D lineal de la máscara. Al superar el tope, la textura conserva los cortes anteriores, que pierden su borde SDF individual. En cada píxel perforado busca la primera pared interior, corrige la profundidad y oscurece el corte y las caras traseras. El láser se enfría de naranja a carbón en 3,5 s. El ácido tiene, de fuera a dentro, una aureola mate con picaduras, un filo verde fino con espuma que se mueve despacio y el hueco; al terminar de corroer, el verde se apaga en 3 s a una costra parda. La alta frecuencia se atenúa con `fwidth`. El láser sale de un emisor visible a 6 m y 1 m de altura; el clic solo elige el punto. El grupo de escena convierte (x, y, z) del mapa a (x, z, −y) de Three.

Las tablas congeladas están en `paquetes/destruccion/tablas.js`. `ARMAS` reúne los perfiles anteriores. `MATERIALES` enumera los cinco materiales base del laboratorio. `FISICA` fija paso 1/60 s, gravedad 9,81, restitución 0,22, fricción tangencial 0,79 y amortiguación angular 0,84 por contacto. Dieciocho pasos de contacto bajo 0,11 m/s y 0,11 rad/s fijan la pose. El radio del parche de unión es 4,5 cm. `RESTOS` fija los tiempos de salida y `RENDIMIENTO` contiene los factores de recuperación.

Una caja de 48 cm tiene 12 × 12 × 12 = 1 728 celdas. Medición en Node 22.19.0, macOS arm64, con tres robots y nueve piezas en vuelo (12 288 celdas iniciales): **0,51 ms por paso y 0,010 ms por raycast** (0,063 ms antes del contacto entre piezas). Son medianas de 12 tandas de 16 pasos o 400 consultas sobre nueve piezas, sin GPU ni construcción de instantáneas. La prueba repite la medida en cada ejecución.

Quedan para otras tareas el inventario, la integración con War, Factory y Campaign y el equilibrio definitivo del botín. La física no hace choques entre dos grupos en vuelo rápido ni apilamiento con varias iteraciones. La inspección visual en WebGL corresponde al orquestador.

[Contrato del núcleo](../paquetes/destruccion/README.md) · [Abrir laboratorio](../herramientas/laboratorio-destruccion/index.html)
