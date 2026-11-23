# CODEMAGEDDON · Taller de mecanizado

Escena de Blender 5.3. La tarea de arte 05 dura **14,5 s** a 24 fps. La placa de acero cepillado mide 1,40 × 1,05 m. La plantilla galvanizada, las letras y sus alojamientos tienen 25 mm de espesor. La holgura es de 0,05 mm por canto.

## Montaje y cuadros de revisión

| Plano | Cuadros | Qué mirar |
|---|---|---|
| A · N | 1–60 | La N llega a la placa entre 10 y 11, rebota y entra en el alojamiento hacia el 20. En 31 y 44 se frena contra la pared. En 55 ya está enrasada. |
| D · fresa | 61–156 | Foco en placa en 65, pinza en 93 y placa en 135. Las pasadas terminan en 93 y 127. La herramienta sube 36 mm hasta 138 y termina de apartarse en 150. |
| B · láser O | 157–216 | En 158 el cinc está intacto. Comparar 167 y 178 para seguir la huella exterior. En 192 el haz está apagado durante el salto. En 201 corta el interior mientras el exterior se enfría. En 216 queda la marca. |
| C · O | 217–288 | Vista a 29° hacia abajo. Contacto hacia 229, deslizamiento desde 233 y entrada hacia 240. Los atascos se producen hacia 250 y 262. En 274 ya está enrasada. |
| E · palabra | 289–348 | El bloque sube de 291 a 324. En 348 se revisan el rojo de MAGEDDON y la lectura de la palabra completa. |

B y D conservan el deslizamiento lateral de 12 y 9 mm. D usa f/2,8 con la oscilación de foco del montaje. C se acerca 18 mm durante el hundimiento. E conserva el acercamiento del 5 %. El soporte en T y los elementos de la fresa quedan fuera del plano E.

## Calor y metal

Cada contorno de la O tiene su propia ventana de corte, exterior en 159–189 e interior en 194–209. La posición del haz y el instante de llegada usan la longitud de arco del mismo recorrido. En el troquel se interpola el atributo `arco_m`. En la pieza, una textura UV guarda el instante del segmento más cercano y acompaña la O durante la caída.

La temperatura del filo en kelvin sigue `650 + 4050 exp(−0,23 a)`, donde `a` es la edad en cuadros desde el impacto. Un nodo de cuerpo negro da el color y la intensidad cae con el cuadrado del factor térmico. El cinc cubre la junta y el bisel hasta el paso del haz. Detrás quedan la ranura oscura de unos 0,2 mm y una zona de revenido de 1,6 mm en el galvanizado fijo, con tonos azules cerca del corte, bronce y pajizo hacia el cinc. El paso del haz revela en la pieza el mismo acero y rojo de marca que lleva la N. El núcleo del haz conserva 0,44 mm de diámetro y emisión 2,4.

Las letras llevan acero anisótropo con estrías verticales en los flancos. La transición de las bandas sigue la textura local de la pieza. El centro de la tapa conserva acero pulido y la banda ocupa hasta 3 mm. El rojo tiñe la reflexión del metal y sólo el filo conserva una emisión moderada tras enfriarse.

EEVEE calcula el reflejo de áreas rectangulares directamente en el material. Un panel frontal ancho, dos tiras verticales y un techo especular dan al acero superficies claras que reflejar contra el fondo negro. Las letras y la herramienta añaden un relleno de estudio calculado a partir de la dirección de reflexión, con dos degradados amplios y una intensidad mínima para las zonas en sombra. Su contribución difusa, volumétrica y de transmisión es cero. Esta solución funciona con el trazado de rayos desactivado. Las luces de taller mantienen su factor global de `2**-2.5`. La plantilla conserva la flor de cinc y la placa conserva el cepillado longitudinal. La reflectancia de la base cepillada baja al 12 % de su valor original en D y al 6,8 % en E.

### Grabado de CODE

Las ocho pasadas tienen 0,40 mm de separación y bajan 0,28 mm cada una hasta un fondo a 2,24 mm. En C, D y E, una triangulación restringida une las terrazas entre isolíneas del glifo. La O tiene dos familias de contornos convexos y su vertiente interior ya está pulida al comienzo. En las dos últimas pasadas, el modificador reduce los espesores restantes al paso de la bola de 3 mm. Sus tres filos helicoidales avanzan 49° por cuadro. Las virutas rizadas usan la semilla 202704 y conservan su pose final al depositarse sobre la placa.

## Caída y contacto

El integrador NumPy usa metros, semillas 501 y 502 y 64 subpasos por cuadro. Con cámara lenta ×4,5, el paso físico es 1/6912 s. En vuelo se integran exactamente los incrementos de aceleración constante, `Δz = vz·dt − g·dt²/2` y `Δvz = −g·dt`, con g = 9,81 m/s². La aceleración en pantalla se mide por segundas diferencias de las posiciones horneadas antes del impacto.

La plantilla de la O está desplazada 16,8 mm hacia el frente. Se modela un impulso lateral de liberación de 0,16 m/s cuando la pieza libra el troquel. La N empieza ya liberada, a 23,0 mm de su eje final. La restitución normal es 0,13. Tras el rebote, la desaceleración lateral sobre la placa es 0,22 g. Una inclinación de hasta 1,1° cede durante el deslizamiento y acaba de corregirse en los primeros 3 mm de inserción.

En la entrada, con Z positiva hacia arriba, `az = −g + μk·N/m − 34·vz`. El coeficiente cinético parte de 0,30 y aumenta con la profundidad, con un incremento adicional en el último tercio y ruido espacial de semilla fija. El coeficiente estático es 1,24 veces el cinético. Dos estrechamientos elevan la presión lateral cerca del 48 % y del 82 % de profundidad. Durante un atasco la precarga se relaja con constante de 22 ms hasta permitir el deslizamiento. El tope del alojamiento fija el enrase. Posición e inclinación se hornean a claves lineales por cuadro.

## Render y medición

Desde este directorio, el orquestador puede generar imágenes de revisión con este comando.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-exit-code 1 \
  --python codemageddon.py -- --salida /tmp/codemageddon-05 --previa \
  --cuadro 10 --cuadro 44 --cuadro 93 --cuadro 150 --cuadro 178 --cuadro 201 \
  --cuadro 229 --cuadro 262 --cuadro 348
```

| Opción | Salida |
|---|---|
| `--cuadro N` o `--cuadros a-b` | Un JPG o un intervalo en `fotogramas/`. |
| `--planos` | Cuadro medio de cada plano, en orden de montaje 30, 108, 186, 252 y 318. |
| `--muestra` | Pose independiente con la N a 37 mm de altura y el corte exterior de la O en 178. |
| `--mp4` | H.264 para el intervalo indicado o los 348 cuadros completos. |
| `--previa` | 960 × 540, 16 muestras y JPEG 85. El final usa 1920 × 1080, 32 muestras y JPEG 94. |
| `--guardar` | Escena editable con las texturas empaquetadas. |
| `--autoprueba` | Informe geométrico y temporal con NumPy y CoreText. |

En `escena.json`, cada entrada de `animacion.caidas` contiene `fisica` con aceleración esperada y medida en pantalla, velocidad de contacto en tiempo físico, hitos, número de atascos y profundidad de cada uno. El orquestador añade las medidas de malla y cámara evaluadas y la fotometría de los JPG que renderiza.
