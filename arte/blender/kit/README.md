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

`pivote(nombre,padre,posicion,reglas)` crea un Empty. Su propiedad `rig` contiene una **cadena JSON que representa una lista de reglas**, igual que la torreta. Con `export_extras=True` se conserva en `node.extras.rig`. Un ejemplo de regla de esa lista es:

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
