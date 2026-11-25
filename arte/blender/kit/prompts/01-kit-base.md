# Tarea 01 · Kit de piezas común para las máquinas de Code Battle Lite

Eres el ejecutor 3D de un pipeline. Haz SOLO esta tarea. Escribe en `arte/blender/kit/` y no toques
nada fuera de esa carpeta. No ejecutes Blender: tu sandbox no puede, y el orquestador renderiza.
Todo lo que no dependa de `bpy` debe estar probado en Python puro, con pruebas que corras tú.

## Objetivo
Hoy cada máquina rehace sus piezas a su manera. Hay tres fuentes que puedes leer, pero **no
modificar**:
- `/Users/rubenmena/Documents/Dev/Code-battle-lite-vehiculo/arte/blender/vehiculo-tubular/tubular.py`
  (buggy: `revolucion`, `tubo`, `prisma`, `caja`, `biselar`, `tornillo`, `curva`, `soldadura`,
  `chapa_calada`, `engrane`, `rueda`, `resorte`, `ojo`, `heim`, `telescopio`)
- `/Users/rubenmena/Documents/Dev/Code-battle-lite-torreta/arte/blender/torreta_observacion/esfera/`
  `geometria_esfera.py` y `transmision_esfera.py` (esfera: `grid`, `lathe`, `tube`, `wheel` con
  flanco evolvente, sinfín, rodamientos, cardán)
- `arte/blender/robots.py` en esta rama (robots de juguete: `caja`, `cilindro`, `prisma`,
  `engrane`, `articulacion`, `oruga`, `rueda`, `elipsoide`)

El kit las sustituirá en las máquinas nuevas, empezando por el escarabajo de `robots.py`. Que sea
pequeño, coherente y fácil de leer. Es mejor tener pocas piezas bien hechas que muchas a medias.

## Arquitectura (obligatoria)
1. **`geometria.py`, Python puro sin `bpy`.** Una clase `Malla` con vértices, caras (polígonos),
   material por cara, nombre y familia. Debe ofrecer transformaciones (trasladar, rotar, escalar,
   alinear un eje con un vector), unir varias mallas y contar triángulos. Las primitivas
   devuelven `Malla`, y unidades en metros, Z arriba y +Y hacia delante (la misma convención que
   `robots.py`).
2. **Detalle por construcción.** Cada pieza recibe `detalle` ∈ {0, 1, 2} y se construye con menos
   resolución en 1 y en 2: segmentos, dientes simplificados, sin biseles... Nada de decimar después.
   Cada pieza declara también el **último nivel en que existe**. Por ejemplo, un tornillo existe en
   L0 y desaparece en L1, y una arandela solo existe en L0. Así el exportador omite piezas sin
   reglas de nombres.
3. **`blender.py`, adaptador fino con `bpy`** (no lo puedes probar; mantenlo mínimo y obvio):
   - `Malla` → objeto con su material, sombreado suave y aristas vivas por ángulo;
   - Empties de pivote;
   - extras de rig en el formato de abajo;
   - materiales planos desde una paleta que entrega la máquina.

   Busca los nodos por tipo (`BSDF_PRINCIPLED`), nunca por nombre.
4. **Nombres por familia.** Nombre de objeto `<familia>_<nombre>`, con familias de una lista
   cerrada y documentada (`tornillo`, `tuerca`, `arandela`, `tubo`, `engrane`, `rodamiento`...).

## Piezas mínimas
Parámetros con nombres claros y valores por defecto razonables (escala de máquina de 1 a 4 m).
- **Estructura:**
  - caja con bisel real;
  - prisma desde un contorno 2D (con agujeros opcionales);
  - revolución desde un perfil;
  - tubo entre dos puntos, con espesor opcional;
  - barrido de un perfil circular a lo largo de una polilínea o curva (cables y mangueras), con
    curvas suavizadas;
  - chapa con agujeros pasantes en rejilla;
  - cartela triangular.
- **Tornillería:** tornillo de cabeza hexagonal, tornillo Allen (cabeza cilíndrica con hexágono
  hundido y paredes visibles), tuerca, arandela y remache.
- **Transmisión:**
  - engranaje recto **con flanco evolvente** (módulo, dientes, ancho, ángulo de presión,
    hélice opcional), corona interior y cremallera;
  - **sinfín** (módulo axial, entradas, longitud) compatible con una rueda helicoidal del mismo
    módulo;
  - rodamiento (aros y bolas visibles en L0), eje con chaveta, junta cardán, rótula (heim);
  - resorte helicoidal (vueltas, diámetro de hilo, extremos planos);
  - amortiguador telescópico (cuerpo, vástago y fuelle opcional).
- **Rodaje:** rueda con neumático y tacos (la banda de rodadura simplificada en L1 y lisa en L2) y
  oruga sobre un estadio (eslabones en L0, banda continua en L1 y L2).
- **Luces:** LED con material emisivo.

## Rig y exportación
Documenta y ofrece un helper para la regla de rig que ya usa la torreta:
`{tipo: "MANDO", canal: "rotacion"|"traslacion", eje: [x, y, z], factor, mando}`. Va en ejes de
glTF (Y arriba) y en el marco local del pivote:
- `q = q_reposo · eje_angulo(eje, factor·mando)`;
- `p = p_reposo + q_reposo · eje · factor·mando`.

Incluye la conversión de un eje de Blender a glTF: (x, y, z) → (x, z, −y).

## Pruebas en Python puro (`pruebas.py`, ejecutable con `python3 pruebas.py`)
- Sin caras degeneradas (área > 0) ni índices fuera de rango. Las piezas que deben ser cerradas
  son **variedades cerradas** (cada arista compartida por exactamente dos caras con orientación
  coherente) en los tres niveles.
- Triángulos estrictamente decrecientes de L0 a L2 en cada pieza que exista en los tres niveles.
- Dimensiones: la caja envolvente coincide con los parámetros (tolerancia de 0,5 mm).
- Engranajes:
  - dos ruedas del mismo módulo a la distancia `m·(z1+z2)/2` no se interpenetran;
  - el paso en la circunferencia primitiva es `π·m`.
- El sinfín y su rueda: el ángulo de avance y el paso axial cumplen `tan λ = entradas·m/d`.
- Presupuesto orientativo en L0: tornillo ≤ 300 triángulos, engranaje de 24 dientes ≤ 3000, rueda
  completa ≤ 6000.

## Catálogo (para que el orquestador lo vea)
`catalogo.py`: script de Blender sin ventana,
`blender -b --factory-startup --python catalogo.py -- --salida <carpeta>`.
- Coloca todas las piezas en una rejilla con su nombre como texto debajo, sobre un fondo claro, y
  escribe `catalogo_L0.png`, `catalogo_L1.png` y `catalogo_L2.png` a 2400×1600, con luz de
  estudio suave en EEVEE.
- Escribe también `primeros_planos.png`: engranajes engranando, el sinfín con su rueda, el
  tornillo Allen, el rodamiento y la rueda, en L0.
- Con `--glb <ruta>` exporta el catálogo como GLB con raíces `L0_/L1_/L2_Catalogo`, para probar el
  camino completo hasta el juego.

## README.md
Debe recoger:
- la convención de ejes y unidades;
- la lista de familias;
- la tabla de piezas con sus parámetros, triángulos en L0/L1/L2 y el último nivel en que existen;
- el formato de rig;
- cómo usar el kit desde una máquina, con un ejemplo de 15 líneas.

## Respuesta final
Breve y en lenguaje claro, sin jerga interna:
- qué piezas hay;
- qué comprueban las pruebas y su resultado;
- qué decisiones tomaste y por qué;
- qué queda pendiente.
