# Tarea 02 · Exportador común, formato de rig único y validador de GLB

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Lee primero:
- `AGENTS.md`;
- `arte/blender/kit/README.md` (sobre todo «Blender y rig»);
- los tres exportadores que existen hoy:
  - `arte/blender/exportar_t1.py` (sobre `robots.py`);
  - `arte/blender/vehiculo-tubular/exportar_tubular.py` (sobre `tubular.py`, con restricciones y drivers reales de
    Blender);
  - `arte/blender/torreta_observacion/esfera/exportar_torreta.py` (reglas `MANDO` escritas a mano).

Toca únicamente:
- `arte/blender/kit/` (salvo `prompts/` y `previas/`);
- esos tres exportadores, que pasan a ser descriptores cortos;
- los README de sus carpetas.

**No cambies** `robots.py`, `tubular.py` ni los módulos de la torreta. No hagas commits.

**No puedes ejecutar Blender.** El orquestador correrá las exportaciones y te devolverá los errores. Por eso:
- separa todo lo que no necesita `bpy` en módulos de Python puro, probados con la biblioteca estándar: la conversión
  de ejes, las expresiones, la composición de reglas, el validador y la lectura del GLB;
- deja el código de `bpy` fino, directo y bien comentado.

Deben pasar `python3 arte/blender/kit/pruebas.py` y las pruebas nuevas.

## Por qué
Hay tres exportadores con la misma convención (raíces `L0_/L1_/L2_<Nombre>`, una malla rígida por pivote, sin
esqueleto) pero con el rig en dos formatos:
- el del vehículo copia las restricciones y drivers de Blender **en ejes de Blender**;
- el de la torreta escribe `MANDO` **en ejes de glTF**.

El juego necesita **un solo formato**, que un solucionador en three.js (la tarea siguiente) reproduzca con exactitud.
Y ningún GLB debe llegar al juego rompiendo sus presupuestos.

## 1. Formato de rig `cbl-rig` v2 (el contrato de la tarea siguiente)
Todo va **en ejes de glTF**: Y arriba, y Blender `(x, y, z)` → glTF `(x, z, −y)` para posiciones y ejes. Los nombres
de pivote van **sin el prefijo de nivel**: el solucionador los resuelve dentro de su raíz `L<n>_`.

### En la raíz de cada nivel
- `rig_formato: "cbl-rig"` y `rig_v: 2`.
- `controles`: una lista JSON con
  `{ nombre, unidad: "m" | "rad" | "factor", min?, max?, reposo, ciclico? }`.
  - Unidades del juego: los ángulos en **radianes**, aunque en Blender el mando esté en grados. La conversión va en la
    expresión.
  - Nombres estables: `azimut`, `esquina_dd.recorrido`, `torreta.giro`…

### El principio
**El juego solo toca controles.** Los pivotes que hoy anima el juego directamente (en el vehículo, `ANIMABLES`:
`torreta`, `arma`, `plataforma_aro`, `motor`, `boca`…) pasan a tener un control con su regla.

Si un driver lee el canal de otro objeto (en el vehículo, `torreta` `rotation_euler[2]`), el exportador lo convierte
en una lectura del control correspondiente, aquí `torreta.giro`.

### En cada pivote con reglas
`rig` es una cadena JSON `{ v: 2, reglas: [...] }` y las reglas se aplican en orden.

**`LOCAL`.** Es la transformación local del pivote en función de los controles. Va como mucho una, y siempre la
primera:
```
{ tipo: "LOCAL",
  base: { t: [x,y,z], r: [qx,qy,qz,qw], s: [x,y,z] },   // matriz constante K, del padre exportado al marco de los canales
  traslacion: [ex, ey, ez],                            // cada componente: número o expresión
  rotaciones: [ { eje: [x,y,z], angulo: número | expresión }, ... ],   // producto en este orden
  escala: [ex, ey, ez] }
```
- La matriz local es `K · T(traslacion) · R₁ · R₂ · … · S(escala)`.
- **Sale de los canales de Blender.**
  - Un driver de `location[i]`, `rotation_euler[i]` (respeta `rotation_mode`), `delta_rotation_euler[i]`, `scale[i]` o
    `delta_*` se escribe en su componente.
  - Los canales no conducidos quedan como constantes.
- **`K` cubre el aplanado.** El exportador cuelga cada pivote del pivote ancestro más cercano. `K` es la parte
  constante entre ese padre y el marco donde actúan los canales: padres intermedios estáticos y
  `matrix_parent_inverse`.
- **Orden y signos.** La composición exacta de Blender (`delta` respecto al canal y orden de los ejes de Euler) la
  confirmas en la fuente o la documentación de Blender, y la dejas escrita con su referencia. El orquestador lo
  comprobará con poses reales.
- **El `MANDO` de la torreta y del kit (`regla_mando`)** se traduce a `LOCAL` en el exportador:
  - rotación: `base` = reposo y una rotación `[eje, factor·mando]`;
  - traslación: `base` = reposo y `traslacion = eje·factor·mando`, en el marco ya rotado.
- **Coherencia.** Evaluar `LOCAL` con los controles en reposo debe dar la TRS del nodo en el GLB, con un error de
  1e-5 como mucho.

**Restricciones**, en espacio de mundo y en el orden de la pila de Blender, después de `LOCAL`. Todas llevan
`objetivo` (el nombre del pivote) e `influencia`.
- **`COPIAR_POSICION`:** `{ ejes: [bool,bool,bool], invertir: [...], desplazamiento: bool }` (`COPY_LOCATION`).
- **`APUNTAR`:** `{ eje: [x,y,z] }` (`DAMPED_TRACK`, eje local del dueño en glTF; por ejemplo, `TRACK_Y` → `[0,0,-1]`).
- **`ESTIRAR`:** `{ longitud_reposo, volumen: "NO" | "XZ" | "X" | "Z", abultamiento, eje_fijo: "Y" | "Z" }`
  (`STRETCH_TO`, que alarga el eje local Y de Blender).
- **`APUNTAR_BLOQUEADO`:** `{ eje, bloqueo }` (`LOCKED_TRACK`).
- **Ajustes no admitidos.** Cualquier ajuste que el solucionador no vaya a soportar **hace fallar la exportación**
  con un mensaje claro. Por ejemplo: espacios que no sean de mundo, `head_tail` distinto de 0, subobjetivos o tipos de
  restricción desconocidos.

### Expresiones
Árbol JSON, **nunca una cadena para `eval`**:
- un número;
- el nombre de un control, como cadena;
- `[op, ...args]`, con `op` entre `+ - * / ** neg min max abs sqrt sin cos tan clamp`.

El exportador:
- convierte la expresión de Python de cada driver con `ast` (solo esos nodos; cualquier otro hace fallar);
- sustituye cada variable por el nombre de su control;
- pliega las constantes (`pi`).

## 2. Exportador común `arte/blender/kit/exportar.py`
Generaliza lo que repiten los tres. Para cada nivel:
- construir;
- elegir los pivotes (lo que se mueve, lo que mueve el juego, los mandos y los objetivos de las reglas);
- filtrar las piezas por familia y tamaño;
- ajustar los biseles y las curvas;
- decimar cada pieza por separado antes de unir;
- unir las piezas por pivote, con los materiales planos de la paleta;
- partir las aristas vivas;
- aplanar la jerarquía a pivotes;
- poner los nombres finales `L<n>_`;
- escribir los extras v2;
- exportar el GLB con `export_yup`, sin animaciones y con extras.

Cada máquina se describe con un **descriptor** corto: su exportador actual queda en unas decenas de líneas. El
descriptor indica:
- `nombre`;
- `construir(nivel)`;
- la tabla de niveles (tamaño mínimo, bisel, curvas, decimado, umbral y familias fuera, más las excepciones como la
  torre);
- la paleta y los emisivos;
- los animables y sus controles;
- las reglas escritas a mano, si las hay (torreta);
- el **presupuesto**.

**Regresión.**
- Con la misma máquina, el GLB nuevo debe dar los mismos pivotes y el mismo número de mallas que el actual.
- Los triángulos de cada nivel pueden variar como mucho un 1 %.

Cifras de hoy, que anotarás en el presupuesto:

| Máquina | Nivel | Pivotes | Mallas | Primitivas | Triángulos |
|---|---|---:|---:|---:|---:|
| `VehiculoTubular` | L0 | 181 | 134 | 275 | 56 592 |
| | L1 | 181 | 126 | 240 | 19 356 |
| | L2 | 181 | 61 | 84 | 3 454 |
| `TorretaObservacion` | L0 | 9 | 8 | 23 | 51 446 |
| | L1 | 9 | 8 | 15 | 15 662 |
| | L2 | 9 | 8 | 15 | 4 498 |
| `RobotTransporte` | L0 | 9 | 9 | 30 | 11 016 |
| | L1 | 9 | 9 | 30 | 4 430 |
| | L2 | 9 | 9 | 25 | 1 018 |

## 3. Validador `arte/blender/kit/validar_glb.py` (Python puro, sin `bpy`)
`python3 validar_glb.py <archivo.glb> --maquina <descriptor o JSON de presupuesto>` sale con 0 o con 1. Con `--json`
saca un resumen. Cada fallo va en una línea: `regla · nodo · detalle`.

Comprueba:
- GLB bien formado. Sin animaciones, pieles, cámaras ni luces.
- Exactamente las raíces `L0_`, `L1_` y `L2_<Nombre>`.
- La misma jerarquía de pivotes, sin prefijo, en los tres niveles. Cada malla cuelga de su pivote, se llama
  `<pivote>_malla` y hay una por pivote como mucho.
- Presupuesto por nivel:
  - triángulos y primitivas (llamadas de dibujo) máximos;
  - L0 > L1 > L2 en triángulos.
- Escala:
  - la caja de L0 en metros, dentro de las medidas declaradas con un ±5 %;
  - la base en Y = 0, con 1 cm de margen;
  - escala de la raíz 1.
- Materiales: solo los de la paleta. Emisión solo en los declarados.
- Rig v2:
  - formato y versión;
  - `controles` válidos y sin duplicados;
  - cada regla cumple el esquema;
  - cada objetivo existe en el mismo nivel;
  - las expresiones usan solo operadores permitidos y controles declarados;
  - el grafo de dependencias (padre, objetivos y controles) no tiene ciclos;
  - **coherencia de `LOCAL` en reposo con la TRS del nodo** (1e-5);
  - todo control lo usa al menos una regla.

## 4. Poses de referencia `arte/blender/kit/poses_referencia.py` (`bpy`; la corre el orquestador)
Para la tarea siguiente hacen falta poses **de la fuente original**, no del GLB.
- **Vehículo:** la escena de `tubular.construir()` con su rig vivo de Blender. Por cada muestra:
  - pon los mandos;
  - evalúa el depsgraph;
  - guarda la matriz de mundo de cada pivote exportado, convertida a ejes de glTF (`C · W · C⁻¹`) y relativa al mundo
    de la raíz exportada en reposo.
- **Torreta:** sus mandos aplicados con su propio modelo de pose (`torreta_esfera` y `transmision_esfera`), en Blender
  o en Python puro, lo que sea más fiel a la fuente.
- **Muestras deterministas:**
  - reposo;
  - cada control solo a su mínimo y a su máximo (en los cíclicos, ±1 rad y ±2,5 rad);
  - 8 combinaciones con un generador congruencial con semilla fija.
- Salida: `pruebas/rig/<maquina>-poses.json`, con este formato:
  ```
  { formato: "cbl-rig-poses", v: 1, maquina, fuente,
    muestras: [ { controles: {...}, mundo: { <pivote>: [16 números en orden de columnas] } } ] }
  ```
  Redondea a 1e-7. Dentro del repositorio, crea la carpeta `pruebas/rig/` solo con lo necesario.

## 5. Pruebas nuevas (biblioteca estándar)
En `arte/blender/kit/pruebas_exportar.py`, llamadas también desde `pruebas.py`, o documenta cómo correrlas.
- Conversión de ejes (puntos, ejes y cuaterniones) en ida y vuelta.
- Conversión de expresiones: todas las que aparecen hoy en el vehículo y en la torreta. Las tienes en los GLB de
  `Prototypes/Rocket Launcher/modelos/`, en los extras `rig`. También expresiones que deben fallar.
- Evaluación de expresiones y de `LOCAL`, con casos calculados a mano: un Euler XYZ con un canal conducido, `delta`,
  traslación conducida con `K` no trivial, y `MANDO` traducido.
- El validador sobre GLB sintéticos que escribas en la prueba:
  - uno correcto;
  - uno por cada regla rota: raíz que falta, pivote distinto entre niveles, triángulos por encima, escala mal,
    material fuera de paleta, objetivo inexistente, ciclo, expresión prohibida, `LOCAL` incoherente.
- El validador sobre los tres GLB actuales:
  - los rechaza por **formato de rig antiguo** con un mensaje claro;
  - salvo `t1.glb`, que no tiene rig: decide y documenta qué controles exige a una máquina sin rig.

## Documento
Una sección nueva «Exportar y validar» en `arte/blender/kit/README.md`, con:
- el formato v2 completo (es el contrato del solucionador);
- cómo se escribe un descriptor;
- las órdenes para exportar, validar y sacar poses;
- la tabla de presupuestos.

## Respuesta final
Breve y en lenguaje claro:
- qué hiciste;
- qué comprueban las pruebas y su resultado;
- las decisiones que tomaste y por qué, sobre todo la composición de canales de Blender y sus fuentes;
- las **órdenes exactas** que debe ejecutar el orquestador en Blender (exportar las tres máquinas, validar y sacar
  poses), y qué salida espera.
