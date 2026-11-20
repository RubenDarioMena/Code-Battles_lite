"""Exporta la torreta de observación (mecanismo S) como un GLB de juego con tres niveles de detalle.

Sin ventana, desde la raíz del repositorio:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python arte/blender/torreta_observacion/esfera/exportar_torreta.py -- \
        "Prototypes/Rocket Launcher/modelos/torreta_observacion.glb"

Misma convención que exportar_t1.py y exportar_tubular.py: cada nivel es una raíz
L0_/L1_/L2_TorretaObservacion con los mismos pivotes y una malla rígida por pivote, sin esqueleto
ni animaciones. El juego pone la pose.

Se exporta el exterior, como en el bucle de presentación (--animacion-bucle): torre, esfera,
compuerta y telescopio, con la esfera 10 cm más baja para que la banda ecuatorial quede oculta
tras el labio en reposo. El mecanismo de sinfines queda dentro de la torre y no se exporta.

Mandos (extras de la raíz, `controles`):
- `azimut` (rad, cíclico): giro de la base.
- `inclinacion` (rad, cíclico): 0 = reposo (Allen arriba), π = uso; las miradas van a π ± 35°.
- `hojas` (0-1): apertura de la compuerta (100° por hoja).
- `extension` (0-1): telescopio; cada tramo sale 10 cm respecto al anterior.
Cada pivote lleva en sus extras `rig` (JSON) una lista de reglas
`{tipo: "MANDO", canal: "rotacion"|"traslacion", eje: [x, y, z], factor, mando}`, en ejes de glTF
(Y arriba) y en el marco LOCAL del pivote:
    rotacion:   q = q_reposo · eje_angulo(eje, factor · mando)
    traslacion: p = p_reposo + q_reposo · eje · factor · mando
La raíz lleva además `bucle`: las claves del bucle de presentación en unidades de mando (24 fps),
para que el menú lo reproduzca sin clip de animación.

- L0: todo el exterior; piezas de más de 1500 triángulos decimadas al 45 % (la torre, entera).
- L1: sin juntas, pasadores, collares ni casquillos; decimado al 18 % (torre al 50 %).
- L2: silueta: sin crestas (la banda queda como canal oscuro); decimado al 7 % (torre al 25 %).
"""
import json
import math
import os
import re
import sys

import bmesh
import bpy
from mathutils import Matrix

RAIZ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, RAIZ)
import torreta_esfera as t  # noqa: E402
import transmision_esfera as tr  # noqa: E402

NOMBRE = "TorretaObservacion"
BAJADA = t.BAJADA_BUCLE
VISIBLES = ("torre", "esfera", "compuerta y telescopio")
# Pivotes del juego: nombre en el modelo -> nombre exportado.
PIVOTES = {"base_giro": "base_giro", "muñón motriz": "munon", "hoja_i": "hoja_i", "hoja_d": "hoja_d",
           "telescopio_1": "telescopio_1", "telescopio_2": "telescopio_2",
           "telescopio_3": "telescopio_3", "telescopio_4": "telescopio_4"}
_L1 = r"Junta polar|Pasador|Collar|Revestimiento|Casquillo|Junta inferior"
# nivel: (proporción de decimado, triángulos de pieza a partir de los que se decima, familias fuera)
# La torre es una superficie de revolución: el decimado por colapso le deja pliegues verticales.
# Lleva su propia proporción, más suave (L0 sin decimar).
TORRE = re.compile(r"Fuste|Labio|Junta inferior")
TORRE_PROPORCION = {0: 1, 1: .5, 2: .25}
NIVELES = {0: (.45, 1500, r"Junta polar"),
           1: (.18, 800, _L1),
           2: (.07, 300, _L1 + r"|Crestas")}

# Reglas en ejes de glTF. Blender (x, y, z) pasa a glTF (x, z, -y): el giro en Z de Blender es el
# giro en +Y de glTF; el giro en +Y de Blender es el giro en -Z de glTF.
HOJA = math.radians(100)
RIG = {"base_giro": [("rotacion", [0, 1, 0], 1, "azimut")],
       "munon": [("rotacion", [1, 0, 0], 1, "inclinacion")],
       "hoja_i": [("rotacion", [0, 0, 1], HOJA, "hojas")],
       "hoja_d": [("rotacion", [0, 0, 1], -HOJA, "hojas")]}
for i in range(1, 5):
    RIG[f"telescopio_{i}"] = [("traslacion", [0, 1, 0], .100, "extension")]
CONTROLES = [dict(nombre="azimut", unidad="rad", reposo=0, ciclico=True),
             dict(nombre="inclinacion", unidad="rad", reposo=0, ciclico=True,
                  uso=math.pi, mirada=math.radians(35)),
             dict(nombre="hojas", min=0, max=1, reposo=0),
             dict(nombre="extension", min=0, max=1, reposo=0)]


def bucle():
    """Claves del bucle de presentación en unidades de mando."""
    claves = [dict(cuadro=k[0], inclinacion=round(math.radians(k[1]), 6), azimut=round(math.radians(k[2]), 6),
                   hojas=k[3], extension=k[4]) for k in tr.KEYS_BUCLE]
    return dict(fps=24, cuadros=tr.KEYS_BUCLE[-1][0] - 1, claves=claves,
                interpolacion="smoothstep por tramo",
                cierre="en el tramo que gira hacia 2π y cierra, extensión en 0-30 % del tramo y hojas en "
                       "25-50 %, cada una con su smoothstep")


def triangulos(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def materiales_planos():
    planos = {}
    for clave, (r, gc, b, metal, rugosidad) in t.COLORS.items():
        m = bpy.data.materials.new("exp_" + clave)
        m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (r, gc, b, 1)
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Roughness"].default_value = rugosidad
        if clave == "luz":
            bsdf.inputs["Emission Color"].default_value = (r, gc, b, 1)
            bsdf.inputs["Emission Strength"].default_value = 1
        planos[clave] = m
    return planos


def objetos(m, col, planos, n):
    """Partes del modelo como objetos de Blender, en la pose de reposo."""
    objs = {}
    for p in m.parts.values():
        me = None
        if p.material and p.verts:
            me = bpy.data.meshes.new(f"{p.name}~{n}")
            me.from_pydata(p.verts, [], p.faces)
            me.materials.append(planos[p.material])
            if p.accents:
                me.materials.append(planos["corte" if p.group == "torre" else "ranura"])
                for i in p.accents:
                    me.polygons[i].material_index = 1
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            bm.to_mesh(me)
            bm.free()
        o = bpy.data.objects.new(f"{p.name}~{n}", me)
        col.objects.link(o)
        o.parent = objs.get(p.parent)
        o.location = p.loc
        o.rotation_euler = p.rot
        objs[p.name] = o
    return objs


def unir(pivote, piezas, nombre, col, dg):
    bm, mats = bmesh.new(), []
    inv = pivote.matrix_world.inverted()
    for o in piezas:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        tmp = bmesh.new()
        tmp.from_mesh(me)
        bmesh.ops.transform(tmp, matrix=inv @ o.matrix_world, verts=tmp.verts)
        remap = []
        for mat in me.materials:
            if mat not in mats:
                mats.append(mat)
            remap.append(mats.index(mat))
        for f in tmp.faces:
            f.material_index = remap[min(f.material_index, len(remap) - 1)]
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    for mat in mats:
        me.materials.append(mat)
    u = bpy.data.objects.new(nombre, me)
    col.objects.link(u)
    u.parent = pivote
    return u


def aristas_vivas(o, angulo=30):
    bm = bmesh.new()
    bm.from_mesh(o.data)
    vivas = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angulo)]
    bmesh.ops.split_edges(bm, edges=vivas)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(o.data)
    bm.free()


def nivel(n, col, planos):
    proporcion, umbral, familias = NIVELES[n]
    fuera = re.compile(familias)
    m = t.build("S")
    x, y, z = m.parts["muñón motriz"].loc
    m.parts["muñón motriz"].loc = (x, y, z - BAJADA)
    objs = objetos(m, col, planos, n)
    raiz = bpy.data.objects.new(f"L{n}_{NOMBRE}", None)
    col.objects.link(raiz)
    bpy.context.view_layer.update()

    pivotes = {objs[k]: v for k, v in PIVOTES.items()}

    def pivote_de(o):
        while o is not None and o not in pivotes:
            o = o.parent
        return o or raiz

    piezas = {}
    for nombre, p in m.parts.items():
        o = objs[nombre]
        if p.group not in VISIBLES or o.type != "MESH" or fuera.match(p.name):
            continue
        piezas.setdefault(pivote_de(o), []).append(o)
        k = TORRE_PROPORCION[n] if TORRE.match(p.name) else proporcion
        if k < 1 and triangulos(o.data) > umbral:
            o.modifiers.new("decimar", "DECIMATE").ratio = k

    dg = bpy.context.evaluated_depsgraph_get()
    unidas = []
    for piv, lista in piezas.items():
        nombre = raiz.name if piv is raiz else f"L{n}_{pivotes[piv]}"
        unidas.append(unir(piv, lista, f"{nombre}_malla", col, dg))
    for u in unidas:
        aristas_vivas(u)
    total = sum(triangulos(u.data) for u in unidas)

    # Pivotes colgados del pivote ancestro más cercano (o de la raíz) con su transformación de mundo.
    mundo = {o: o.matrix_world.copy() for o in pivotes}
    def profundidad(o):
        k = 0
        while o.parent is not None:
            o, k = o.parent, k + 1
        return k

    orden = sorted(pivotes, key=profundidad)
    for o in orden:
        o.parent = pivote_de(o.parent)
        o.matrix_parent_inverse = Matrix.Identity(4)
        o.matrix_world = mundo[o]
        bpy.context.view_layer.update()
    for u in unidas:
        mw = u.matrix_world.copy()
        u.matrix_parent_inverse = Matrix.Identity(4)
        u.matrix_world = mw
    for o in objs.values():
        if o not in pivotes:
            bpy.data.objects.remove(o, do_unlink=True)
    for o, nombre in pivotes.items():
        o.name = f"L{n}_{nombre}"
        o["rig"] = json.dumps([dict(tipo="MANDO", canal=c, eje=e, factor=round(k, 6), mando=mando)
                               for c, e, k, mando in RIG[nombre]], ensure_ascii=False)
    raiz["controles"] = json.dumps(CONTROLES, ensure_ascii=False)
    raiz["bucle"] = json.dumps(bucle(), ensure_ascii=False)
    print(f"LOD{n}: {len(pivotes) + 1} nodos de pivote, {len(unidas)} mallas, {total} triángulos")
    return dict(pivotes=len(pivotes), mallas=len(unidas), triangulos=total)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ruta = os.path.abspath(argv[0] if argv else "torreta_observacion.glb")
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    esc = bpy.context.scene
    planos = materiales_planos()
    resumen = {}
    for n in NIVELES:
        col = bpy.data.collections.new(f"LOD{n}")
        esc.collection.children.link(col)
        resumen[f"L{n}"] = nivel(n, col, planos)
    for mat in list(bpy.data.materials):
        if not mat.name.startswith("exp_") or not mat.users:
            bpy.data.materials.remove(mat)
    for mat in bpy.data.materials:
        mat.name = mat.name.removeprefix("exp_")
    bpy.ops.export_scene.gltf(filepath=ruta, export_format="GLB", export_yup=True, export_apply=True,
                              export_animations=False, export_extras=True)
    resumen["bytes"] = os.path.getsize(ruta)
    print("EXPORTADO", ruta, json.dumps(resumen))


main()
