# Kit de piezas de Code Battle Lite

Las máquinas importan los constructores desde `kit`. Cada llamada produce una `Malla` en **metros**, con **Z arriba**, **+Y hacia delante** y **+X a la derecha**. La rueda gira alrededor de X, la oruga recorre el plano YZ y la cartela ocupa el plano XZ. Los engranajes, tornillos, rodamientos, resortes y cilindros se construyen alrededor de Z.

## Contrato de geometría

`Malla` contiene `vertices` XYZ, `caras` con índices de base cero, una clave en `materiales` por cara, `nombre`, `familia` y `ultimo_nivel`. Las normales exteriores siguen el orden antihorario visto desde fuera. Una pieza compuesta puede contener varios sólidos cerrados, por ejemplo los dos aros y las doce bolas del rodamiento. La unión conserva esos sólidos y sus materiales.

- `m.trasladar((x,y,z))`, `m.rotar(eje,radianes)`, `m.escalar(factor_o_terna)` y `m.alinear(destino,eje=(0,0,1))` devuelven otra malla. La rotación y la escala usan el origen local. Una escala reflejada invierte el orden de las caras.
- `Malla.unir(a,b,...,familia="caja",nombre="chasis",ultimo_nivel=2)` reúne componentes ya construidos para el mismo nivel. `m.triangulos` cuenta los triángulos y `m.limites` devuelve los pares mínimo/máximo de X, Y y Z.
- Todos los constructores admiten `nombre=`, `material=` y `detalle=0|1|2`. El nivel predeterminado es 0. En conjuntos, `material` selecciona el acabado principal. Las claves secundarias distinguen goma, pistas, metal pulido y otros acabados. La máquina controla su color.
- `constructor.ultimo_nivel` permite consultar la visibilidad antes de construir. Pedir un nivel posterior devuelve una malla vacía con sus metadatos. El adaptador devuelve `None` en ese caso.
- El nombre de objeto es `<familia>_<nombre>`. Las **24 familias** admitidas son `caja`, `prisma`, `revolucion`, `tubo`, `manguera`, `chapa`, `cartela`, `tornillo`, `tuerca`, `arandela`, `remache`, `engrane`, `corona`, `cremallera`, `sinfin`, `rodamiento`, `eje`, `cardan`, `rotula`, `resorte`, `amortiguador`, `rueda`, `oruga` y `led`. Allen comparte familia con el tornillo hexagonal. El constructor Heim pertenece a la familia rótula.

## Piezas y coste

Triángulos de la **llamada predeterminada**, incluida toda la tornillería o geometría interna que construya la pieza. El catálogo ilustra además el tubo hueco y el prisma con un agujero. El guion largo indica que la pieza desaparece.

| Constructor | Parámetros de forma (valores predeterminados) | L0 | L1 | L2 | Último |
|---|---|---:|---:|---:|---|
| `caja` | ancho .32, fondo .18, alto .12, bisel .012 | 156 | 60 | 12 | L2 |
| `prisma` | contorno XY rectangular .28 × .18, espesor .045, agujeros () | 64 | 40 | 16 | L2 |
| `revolucion` | perfil (radio,Z) de cuatro puntos, cerrado False | 252 | 124 | 60 | L2 |
| `tubo` | inicio (0,0,0), fin (0,0,.36), radio .035, espesor None | 124 | 60 | 28 | L2 |
| `manguera` | puntos XYZ de una polilínea, radio .014, suavizar True | 1020 | 380 | 124 | L2 |
| `chapa` | ancho .36, fondo .24, espesor .012, columnas 4, filas 3, radio .021 | 2416 | 1264 | 880 | L2 |
| `cartela` | base .18, altura .13, espesor .012 | 84 | 48 | 12 | L2 |
| `tornillo` | diametro .024, longitud .055 | 164 | — | — | L0 |
| `allen` | diametro .024, longitud .055 | 272 | — | — | L0 |
| `tuerca` | diametro .024, alto .019 | 216 | 72 | — | L1 |
| `arandela` | diametro .048, agujero .025, espesor .004 | 192 | — | — | L0 |
| `remache` | diametro .018, longitud .032 | 238 | 94 | — | L1 |
| `engrane` | modulo .012, dientes 24, ancho .038, presion 20°, helice 0°, agujero automático (.054) | 2688 | 1728 | 1344 | L2 |
| `corona` | modulo .012, dientes 36, ancho .038, presion 20°, helice 0°, margen .022 | 3456 | 2016 | 1440 | L2 |
| `cremallera` | modulo .012, dientes 10, ancho .038, presion 20° | 348 | 260 | 172 | L2 |
| `sinfin` | modulo_axial .012, entradas 1, longitud .19, diametro primitivo .082 | 2120 | 1412 | 876 | L2 |
| `rodamiento` | diametro .16, agujero .07, ancho .034 | 2464 | 384 | 192 | L2 |
| `eje` | diametro .055, longitud .28 | 408 | 184 | 72 | L2 |
| `cardan` | diametro .14, longitud .25 | 3424 | 1120 | 480 | L2 |
| `heim` | diametro .12, longitud .17, agujero .032 | 1084 | 412 | 204 | L2 |
| `resorte` | diametro exterior .094, hilo .009, longitud .23, vueltas 6 | 4628 | 1932 | 580 | L2 |
| `amortiguador` | longitud .38, diametro .072, fuelle True | 2172 | 796 | 252 | L2 |
| `rueda` | diametro .46, ancho .15, agujero .05 | 2304 | 1152 | 448 | L2 |
| `oruga` | centros .44, radio exterior .14, ancho .115, espesor .022, eslabones 36 | 720 | 272 | 144 | L2 |
| `led` | diametro .044, alto .026, material "luz" | 378 | 186 | 90 | L2 |

**Elección del detalle.** El bisel de la caja pasa de redondeado a facetado y desaparece en L2. El prisma redondea ligeramente las esquinas en L0 y las achaflana en L1. La chapa conserva sus taladros pasantes. Los engranajes mantienen dientes y paso en las tres versiones y reducen el muestreo de los flancos. La rueda pasa de tacos en espiga a una banda con ranura y finalmente a una banda lisa. La oruga pasa de eslabones individuales a una banda continua con dos resoluciones.

**Perfiles y taladros.** Para el prisma, usa un polígono simple y, en `agujeros`, una secuencia de polígonos interiores disjuntos. Se acepta cualquier orientación. La extrusión queda centrada en Z. En la revolución recorre el exterior del perfil de abajo arriba. `cerrado=True` une el final del perfil con su inicio y permite recorrer también el interior. Los extremos de radio cero forman polos. El tubo es macizo por defecto y admite espesor de pared. La manguera conserva sus extremos y suaviza las esquinas por subdivisión de Chaikin. Usa tramos de longitud positiva y evita invertir el sentido 180° en un vértice.

**Dimensiones.** En tornillos y remaches, `diametro` y `longitud` miden el vástago. La cara inferior de la cabeza está en Z = 0. En la tuerca, `diametro` mide el agujero. El espesor de chapa, el agujero de rueda y el diámetro del hilo se expresan en metros. La oruga tiene una longitud exterior de `centros + 2·radio`. El resorte incluye dos asientos con un cuarto de espira plano.

## Montaje de transmisiones

- La rueda dentada y la cremallera usan módulo transversal. Para dos ruedas exteriores, la distancia entre centros es `m·(z1+z2)/2`, el paso es `π·m` y la relación de giros es `−z1/z2`. Con la primera rueda apuntando un diente hacia +X, coloca la segunda a +X y gírala `π−π/z2` para enfrentar un hueco. El juego entre los dos dientes da margen al muestreo poligonal.
- Los ángulos `presion` y `helice` se dan en grados. El diámetro primitivo es `m·z`. El agujero automático del engranaje mide el 18,75 % de ese diámetro. Los flancos siguen la evolvente desde el círculo base, con una transición hasta la raíz. En la corona, `margen` mide el espesor de llanta más allá del fondo de los huecos.
- El sinfín es derecho. Con módulo axial `m`, diámetro primitivo `d` y `e` entradas, el paso axial es `π·m`, el avance por vuelta es `e·π·m` y `tan(λ) = e·m/d`. Para el montaje de la lámina, la rueda gira sobre Z y el sinfín queda a +X, paralelo a +Y, a distancia `(m·z+d)/2`. Usa una rueda de módulo transversal `m`, presión de 20° y `helice=degrees(angulo_avance(m,e,d))`. El helper devuelve radianes. La rueda helicoidal tiene cara cilíndrica.

## Blender y rig

El adaptador crea una ranura de material por clave usada, aplica sombreado suave y marca las aristas vivas a partir de 36° (ajustable con `angulo_vivo`). La paleta asigna a cada clave la tupla `(RGB lineal, metalicidad, rugosidad, fuerza de emisión)`. La lente del LED usa la clave `luz`. La paleta de ejemplo está en `muestras.py`.

`pivote(nombre,padre,posicion,reglas)` crea un Empty. En la escena de autor, su propiedad `rig` guarda una lista de reglas como cadena JSON. El exportador común traduce esta notación a `LOCAL` al generar la máquina. El catálogo de piezas ilustra la notación de autor. Ejemplo:

```json
{"tipo":"MANDO","canal":"rotacion","eje":[0,1,0],"factor":1.0,"mando":"giro"}
```

`regla_mando(mando,canal,eje,factor)` recibe el eje en el **marco local del pivote Blender**, lo normaliza y lo convierte a glTF mediante `(x,y,z) → (x,z,−y)`. El consumidor aplica la regla en ese mismo marco local, ya con Y arriba. Sea `u` el valor numérico del control identificado por `mando`:

- Rotación en radianes, `q = q_reposo · eje_angulo(eje, factor·u)`.
- Traslación en metros, `p = p_reposo + q_reposo · eje · factor·u`, donde el cuaternión rota el vector.

### Ejemplo de máquina

Quince líneas para un script situado en `arte/blender/`. La máquina entrega los tres acabados que usa esta rueda.

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit import caja, regla_mando, rueda
from kit.blender import materiales, objeto, pivote
paleta = materiales({
    "pintura": ((.07, .32, .29), .45, .34, 0),
    "goma": ((.04, .05, .05), .05, .72, 0),
    "acero": ((.40, .46, .48), .70, .30, 0)})
nivel = 0
raiz = pivote(f"L{nivel}_Escarabajo")
objeto(caja(nombre="chasis", material="acero", detalle=nivel), paleta, raiz)
regla = regla_mando("rodar", "rotacion", (1, 0, 0), 1)
buje = pivote("giro_derecho", raiz, (.28, 0, 0), [regla])
objeto(rueda(nombre="derecha", detalle=nivel), paleta, buje)
```

## Verificación y catálogo

Desde esta carpeta, ejecuta:

```sh
python3 pruebas.py
blender -b --factory-startup --python catalogo.py -- --salida ./salida --glb ./salida/catalogo.glb
```

La suite usa la biblioteca estándar. Revisa índices, áreas, aristas orientadas, volumen positivo por componente, niveles de detalle y cotas con tolerancia de 0,5 mm. Mide el paso y los flancos en los vértices de las ruedas. Para el par de 24 y 18 dientes comprueba un ciclo completo con 121 posiciones y una cota de desplazamiento entre muestras. También mide el paso y el avance de sinfines de una, dos y tres entradas, la inclinación de su rueda, el encuadre y la conversión de ejes del rig.

El catálogo genera `catalogo_L0.png`, `catalogo_L1.png`, `catalogo_L2.png` y `primeros_planos.png` a 2400 × 1600 en EEVEE. En las láminas cada pieza se amplía para poder leerla. Las parejas de transmisión mantienen una misma escala entre las dos piezas. El GLB opcional conserva las dimensiones en metros, las raíces superpuestas `L0_Catalogo`, `L1_Catalogo` y `L2_Catalogo`, y un pivote con mando en la rueda de cada nivel. Selecciona un nivel al visualizarlo.

## Exportar y validar

### Contrato del solucionador · cbl-rig v2

El solver del juego es el paquete [`paquetes/rig/`](../../../paquetes/rig/README.md). Reproduce las poses de Blender con un error máximo de 1,3e−6, y el visor está en `herramientas/visor-rig/`.

Cada GLB tiene una escena y tres raíces superpuestas llamadas `L0_<Nombre>`, `L1_<Nombre>` y `L2_<Nombre>`. Un pivote tiene los mismos padres y nombre corto en los tres niveles. Puede tener una malla hoja `L<n>_<pivote>_malla`. Una referencia dentro del rig siempre es el nombre corto y se busca en el mismo nivel. Se selecciona una raíz para dibujar. Las medidas están en metros, los ángulos en radianes y el sistema es dextrógiro, con Y arriba. El cambio de base C transforma puntos y ejes Blender mediante `(x,y,z) → (x,z,−y)`, cuaterniones XYZW mediante `(x,z,−y,w)` y matrices mediante `C · M · C⁻¹`.

Estos son los `extras` de una raíz con un control. `controles` es un array JSON nativo, idéntico en los tres niveles.

```json
{"rig_formato":"cbl-rig","rig_v":2,"controles":[{"nombre":"torreta.giro","unidad":"rad","reposo":0,"ciclico":true}]}
```

Cada control tiene `nombre` único y estable, `unidad` (`m`, `rad` o `factor`) y `reposo` numérico. `min` y `max` son límites inclusivos opcionales que deben contener el reposo. `ciclico` es un booleano opcional. Un giro cíclico admite valores continuos, incluidas varias vueltas. El juego escribe los controles. Por ejemplo, el piñón del vehículo lee `torreta.giro` y la dirección de las ruedas se expresa en radianes aunque la propiedad RNA esté en grados. Todo control declarado debe aparecer en una regla de cada nivel.

Un pivote con reglas lleva `extras.rig` de tipo **cadena**, cuyo contenido JSON tiene esta forma una vez decodificado:

```json
{"v":2,"reglas":[{"tipo":"LOCAL","base":{"t":[0,0.38,0],"r":[0,0,0,1],"s":[1,1,1]},"traslacion":[0,0,0],"rotaciones":[{"eje":[0,1,0],"angulo":"torreta.giro"}],"escala":[1,1,1]}]}
```

1. En cada evaluación, comenzar con la transformación local guardada en el nodo. Si hay `LOCAL`, sustituirla por `K · T(traslacion) · R₁ · … · Rₙ · S(escala)`. Solo se admite una `LOCAL` y ocupa el primer lugar. `K = T(base.t) · R(base.r) · S(base.s)` es constante, con cuaternión XYZW unitario. Cada rotación lleva un eje unitario y un ángulo. La traslación y la escala tienen tres componentes. Al evaluar los controles en reposo, los 16 elementos de esta matriz y los de la TRS del nodo deben coincidir con error absoluto ≤ 1e−5.
2. Evaluar primero el padre y los objetivos de la pila en orden topológico. Pasar a mundo con `W_padre · local` y aplicar las restricciones del dueño en el orden escrito. Cada restricción lee el mundo **final** del objetivo y el resultado de la anterior en el dueño. Un nivel sin reglas puede declarar `controles: []`. Una máquina articulada como T1 exige los controles del presupuesto, aunque su GLB histórico carezca de metadatos. T1 usa los giros de torreta, hombro, codo y muñeca y un único `pinza.apertura` que mueve los dedos en sentidos opuestos.
3. La TRS que alimenta la pila se conserva al exportar. Las cajas físicas incluyen el efecto de las restricciones en reposo. Para contrastar con las poses de referencia se usa `inversa(W_raíz_en_reposo) · W_pivote`, también cuando la propia raíz gira.

**Canales de Blender.** Con vectores columna, la traslación es la suma de `location` y `delta_location`, la escala es el producto componente a componente de `scale` y `delta_scale`, y la rotación es `R_delta · R_canal`. Para Euler XYZ cada uno de esos dos bloques es `Rz · Ry · Rx`. Para los otros cinco modos se invierten las letras de su propio orden al escribir el producto. Cada eje se convierte con C. Los canales conducidos se sustituyen por sus expresiones y los demás conservan su valor. [Composición en Blender 5.2](https://github.com/blender/blender/blob/v5.2.0/source/blender/blenkernel/intern/object.cc#L2700-L2742) · [TRS](https://github.com/blender/blender/blob/v5.2.0/source/blender/blenkernel/intern/object.cc#L2899-L2921) · [órdenes Euler](https://github.com/blender/blender/blob/v5.2.0/source/blender/blenlib/intern/math_rotation_c.cc#L1616-L1653)

Para aplanar, `K = inversa(W_padre_exportado) · W_padre_original · matrix_parent_inverse`, con los padres evaluados en reposo. Así se conserva el marco de los canales aunque haya padres estáticos intermedios. Para una raíz de fuente independiente, K es identidad antes del ajuste del suelo. La exportación rechaza una base con cizalla que no se pueda guardar como TRS. La medición de reposo de `ESTIRAR` y `APUNTAR_BLOQUEADO` exige ejes mundiales ortogonales en la entrada. `PLANE_Z` exige además una base mundial sin reflexión. Para `MANDO`, K es la TRS local de reposo. Un mando de giro aporta una rotación de `factor · mando`. Uno de desplazamiento aporta `eje · factor · mando` a la traslación dentro de K. El eje de autor de `regla_mando` ya llega convertido. [Evaluación del padre y de la pila en Blender](https://github.com/blender/blender/blob/v5.2.0/source/blender/blenkernel/intern/object_update.cc)

**Expresiones.** Un escalar puede ser un número finito, el nombre de un control o un array `[op,...argumentos]`. Son binarios `+ - * / **`, unarios `neg abs sqrt sin cos tan`, y `min max` toman dos o más argumentos. `clamp(x,bajo,alto)` toma tres. Los drivers se leen con el AST de Python. Se resuelven variables `SINGLE_PROP` mediante sus enlaces y se pliega `pi` junto con las operaciones constantes. Un nodo AST, variable, operador o aridad desconocidos son errores. Las propiedades en grados se leen como `["*", "nombre.del.control", 180/π]` en el árbol (el factor se serializa como número).

**Restricciones.** Todas incluyen `objetivo` e `influencia` numérica en [0,1]. A 0 se conserva la entrada, a 1 se toma la solución. Blender mezcla en mundo con `interp_m4_m4m4` para valores intermedios. [Pila de restricciones de Blender](https://github.com/blender/blender/blob/v5.2.0/source/blender/blenkernel/intern/constraint.cc) · [Interpolación de matrices](https://github.com/blender/blender/blob/v5.2.0/source/blender/blenlib/intern/math_matrix_c.cc#L2090-L2154)

| Tipo | Campos adicionales | Operación en mundo |
| --- | --- | --- |
| `COPIAR_POSICION` | `ejes`, `invertir` (tres booleanos XYZ glTF), `desplazamiento` (booleano) | Copiar las componentes habilitadas del origen del objetivo. Invertir el signo donde se indique. Si hay desplazamiento, sumar la posición de entrada del dueño. |
| `APUNTAR` | `eje` (vector local unitario) | Girar por el arco más corto para que el eje apunte al objetivo. El `TRACK_Y` de Blender se escribe `[0,0,-1]`. |
| `APUNTAR_BLOQUEADO` | `eje`, `bloqueo` (vectores locales unitarios y perpendiculares) | Conservar el eje de bloqueo y girar alrededor de él hacia la proyección de la dirección al objetivo. |
| `ESTIRAR` | `longitud_reposo` positiva, `volumen` (`NO/XZ/X/Z`), `abultamiento` numérico ≥ 0, `eje_fijo` (`Y/Z`) | Alargar el eje local `[0,0,-1]` hasta el objetivo. Las letras son nombres de los modos de Blender. En glTF los transversales X y Z de esos modos son +X y +Y. `Y` significa giro mínimo (`SWING_Y`) y `Z` conserva el plano definido por el antiguo +Y glTF y la dirección nueva (`PLANE_Z`). |

En `ESTIRAR`, el multiplicador longitudinal es distancia al objetivo dividida por la longitud de reposo y por la escala mundial entrante del eje longitudinal. El factor transversal es ese multiplicador elevado a `−abultamiento`. El modo `XZ` reparte su raíz cuadrada en los dos ejes, `X/Z` lo aplica entero en el eje elegido y `NO` conserva ambos. Se rechazan espacios distintos de WORLD, subobjetivos, `head_tail` no nulo, límites de abultamiento, `PLANE_X`, canales de driver no representables y tipos de restricción desconocidos. [Implementación de Stretch To](https://github.com/blender/blender/blob/v5.2.0/source/blender/blenkernel/intern/constraint.cc#L3282-L3421)

### Descriptor y presupuestos

Un descriptor es un script importable con CPython. Declara `NOMBRE`, `ARCHIVO`, `PRESUPUESTO = presupuesto(NOMBRE)`, tres `Nivel` y `construir(nivel)`. Esta función importa la fuente de Blender cuando se llama y devuelve una `Escena` con la raíz, la lista de controles y la paleta de materiales planos. El bloque `if __name__ == "__main__"` llama a `kit.exportar.ejecutar(globals())`. Los tres exportadores son ejemplos completos.

- Cada `Nivel(minimo,bisel,curvas,proporcion,umbral,fuera)` fija el tamaño mínimo en metros, los segmentos de bisel, la pareja de resoluciones de curva (o `None` para omitirlas), el decimado, el umbral de triángulos por pieza y el patrón de familias excluidas. `excepciones` reemplaza la proporción por patrón, como en el fuste de la torre. T1 reparte la cuota histórica de ciertos pivotes entre sus piezas porque antes simplificaba la malla unida.
- `ANIMABLES` conserva pivotes adicionales. `Escena.enlaces[(objeto,ruta_RNA)] = (nombre,factor)` conecta un control con una propiedad o un canal, como `rotation_euler[2]`. `MANDOS` asocia nombres cortos con reglas de autor. En `Escena`, `nombres` asigna alias a objetos, `visibles` selecciona la geometría y `extras` conserva datos de presentación como `bucle`. `AJUSTE_SUELO_Y` desplaza las tres raíces por igual para adaptar el origen de diseño.
- El JSON de presupuesto declara `nombre`, `medidas` XYZ glTF, `paleta`, `emisivos`, los nombres de `controles` y `niveles`. La huella `jerarquia_sha256` corresponde al mapa de nombres cortos a padre (raíz a `null`) serializado en JSON UTF-8 compacto, con claves ordenadas. El validador comprueba los bytes de los accesores y mide los vértices utilizados, con ±5 % por dimensión y 1 cm de tolerancia en el suelo. La escala de cada raíz debe ser 1.

| Máquina | Nivel | Pivotes | Mallas | Primitivas máx. | Triángulos históricos | Triángulos máx. |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| VehiculoTubular | L0 | 181 | 134 | 275 | 56 592 | 57 157 |
| | L1 | 181 | 126 | 240 | 19 356 | 19 549 |
| | L2 | 181 | 61 | 84 | 3 454 | 3 488 |
| TorretaObservacion | L0 | 9 | 8 | 23 | 51 446 | 51 960 |
| | L1 | 9 | 8 | 15 | 15 662 | 15 818 |
| | L2 | 9 | 8 | 15 | 4 498 | 4 542 |
| RobotTransporte | L0 | 9 | 9 | 30 | 11 016 | 11 126 |
| | L1 | 9 | 9 | 30 | 4 430 | 4 474 |
| | L2 | 9 | 9 | 25 | 1 018 | 1 028 |

Los pivotes y mallas son conteos exactos. Los triángulos deben estar dentro del 1 % de la referencia y descender estrictamente de L0 a L2. Las medidas físicas L0 (X × Y × Z) son 2,068 × 2,162 × 3,700 m para el vehículo, 1,382 × 1,105 × 1,382 m para la torreta y 0,747 × 1,7535 × 0,9683 m para T1. El origen antiguo de la torreta deja el zócalo a +55 mm y el de T1 deja las orugas a −12,48 mm. Sus descriptores compensan esas distancias.

### Órdenes del orquestador

Desde la raíz del repositorio, con Blender en `$B`. La carpeta temporal conserva separados los candidatos v2 y los tres archivos históricos que usa la suite.

```sh
set -e
B="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
K=arte/blender/kit
OUT=$(mktemp -d)
echo "$OUT"

"$B" -b --factory-startup --python-exit-code 1 --python arte/blender/exportar_t1.py -- "$OUT/t1.glb"
"$B" -b --factory-startup --python-exit-code 1 --python arte/blender/vehiculo-tubular/exportar_tubular.py -- "$OUT/vehiculo_tubular.glb"
"$B" -b --factory-startup --python-exit-code 1 --python arte/blender/torreta_observacion/esfera/exportar_torreta.py -- "$OUT/torreta_observacion.glb"

python3 "$K/validar_glb.py" "$OUT/t1.glb" --maquina RobotTransporte --json
python3 "$K/validar_glb.py" "$OUT/vehiculo_tubular.glb" --maquina VehiculoTubular --json
python3 "$K/validar_glb.py" "$OUT/torreta_observacion.glb" --maquina TorretaObservacion --json

"$B" -b --factory-startup --python-exit-code 1 --python "$K/poses_referencia.py" -- --maquina VehiculoTubular
python3 "$K/poses_referencia.py" --maquina TorretaObservacion
python3 "$K/pruebas.py"
```

La exportación contrasta además las matrices de mundo en reposo de los tres niveles con el depsgraph original (tolerancia 1e−5). Cada exportador imprime `EXPORTADO` y sustituye el destino solo al pasar la validación. `--maquina` también admite la ruta del descriptor Python o del presupuesto JSON. El validador devuelve 0 en éxito y 1 en fallo. Con `--json` entrega `niveles`, `medidas`, `base_y` y `errores`. Sin esa opción imprime cada fallo en una línea con `regla · nodo · detalle`.

Las referencias se escriben en `pruebas/rig/<maquina>-poses.json`. Cada archivo lleva `formato: "cbl-rig-poses"`, `v: 1`, `maquina`, `fuente` y `muestras`. Cada muestra guarda todos los controles y una matriz mundial por nombre corto, con 16 números por columnas, redondeados a siete decimales. Primero va el reposo, luego los extremos de cada mando por orden de nombre (−2,5, −1, +1, +2,5 rad para los cíclicos) y ocho combinaciones. El generador usa la semilla `0xCB120002` y la recurrencia `(1664525·s + 1013904223) mod 2³²`. Se esperan 57 muestras de 181 pivotes del depsgraph del vehículo y 21 de 9 pivotes de la transmisión S de la torreta. La opción `--salida DIR` cambia la carpeta. Para ejecutar solo la regresión del exportador se usa `python3 arte/blender/kit/pruebas_exportar.py`.
