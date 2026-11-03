"""Exporta el transporte T1 de robots.py como un GLB con tres niveles de detalle (LOD).

Sin ventana:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python arte/blender/exportar_t1.py -- "Prototypes/Rocket Launcher/modelos/t1.glb"

Cada nivel es una raíz L0_/L1_/L2_RobotTransporte con los mismos pivotes (torreta, hombro, codo,
muneca, dedo_i/d, carga) y una malla por pivote: piezas rígidas, sin esqueleto. El juego anima los
pivotes por nombre y elige el nivel según el tamaño del robot en pantalla.

- L0: todas las piezas, biseles de dos segmentos; orugas, casco y caja decimados al 35 %.
- L1: sin piezas menores de 3,5 cm, biseles de un segmento y mallas grandes simplificadas.
- L2: sin piezas menores de 9 cm, sin biseles; silueta, brazo y luces.
Sin animaciones: el juego calcula la pose. Los materiales conservan sus nombres (el juego tiñe la
carga por material).
"""
import math
import os
import sys

import bmesh
import bpy

RAIZ = os.path.dirname(os.path.abspath(__file__))
g = {"__name__": "robots_cbl"}
exec(open(os.path.join(RAIZ, "robots.py")).read(), g)

# nivel: (tamaño mínimo de pieza en m, segmentos de bisel o None si se conservan, proporción de decimado,
#         triángulos a partir de los que una malla se decima). Las mallas pequeñas (dedos, muñeca) se
#         dejan enteras: decimarlas las deshace sin ahorrar casi nada.
NIVELES = {0: (0.0, 2, 0.35, 2000), 1: (0.035, 1, 0.35, 300), 2: (0.09, 0, 0.25, 150)}


def pivote(o):
    p = o.parent
    while p and p.type != "EMPTY":
        p = p.parent
    return p


def malla_evaluada(o, dg):
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me


def unir(piv, objs, nombre, col):
    """Une las mallas de un pivote en una sola, en coordenadas del pivote, con sus materiales."""
    bm, mats = bmesh.new(), []
    inv = piv.matrix_world.inverted()
    for o in objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        bmesh.ops.transform(tmp, matrix=inv @ o.matrix_world, verts=tmp.verts)
        remap = []
        for m in o.data.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        for f in tmp.faces:
            f.material_index = remap[f.material_index] if remap else 0
        me = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.new(nombre, me)
    col.objects.link(o)
    o.parent = piv
    return o


def aristas_vivas(o, angulo=30):
    """Sombreado suave en biseles y plano en caras grandes: separa las aristas de más de `angulo`."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    vivas = [e for e in bm.edges if e.link_faces and len(e.link_faces) == 2
             and e.calc_face_angle(0) > math.radians(angulo)]
    bmesh.ops.split_edges(bm, edges=vivas)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(o.data)
    bm.free()


def triangulos(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def nivel(n, col):
    minimo, segs, proporcion, umbral = NIVELES[n]
    raiz = g["robot_transporte"](col)
    todos = [raiz] + list(raiz.children_recursive)
    for o in todos:
        o.name = f"L{n}_" + o.name.split(".")[0]
    bpy.context.view_layer.update()
    mallas = [o for o in todos if o.type == "MESH"]
    # Piezas pequeñas fuera (nunca una que sostiene a otras).
    for o in sorted(mallas, key=lambda x: -len(x.children_recursive)):
        if minimo and max(o.dimensions) < minimo and not o.children:
            mallas.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
    for o in mallas:
        for md in o.modifiers:
            if md.type == "BEVEL" and segs is not None:
                if segs == 0:
                    o.modifiers.remove(md)
                else:
                    md.segments = segs
    dg = bpy.context.evaluated_depsgraph_get()
    for o in mallas:
        malla_evaluada(o, dg)
    bpy.context.view_layer.update()
    grupos = {}
    for o in mallas:
        grupos.setdefault(pivote(o), []).append(o)
    total = 0
    for piv, objs in grupos.items():
        base = piv.name[len(f"L{n}_"):]
        u = unir(piv, objs, f"L{n}_{base}_malla", col)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
        if triangulos(u) > umbral:
            md = u.modifiers.new("decimar", "DECIMATE")
            md.ratio = proporcion
            malla_evaluada(u, bpy.context.evaluated_depsgraph_get())
        aristas_vivas(u)
        total += triangulos(u)
        print(f"  {base}: {triangulos(u)}")
    print(f"LOD{n}: {len(grupos)} mallas, {total} triángulos")
    return raiz


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ruta = os.path.abspath(argv[0] if argv else "t1.glb")
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    g["_mats"].clear()
    esc = bpy.context.scene
    for n in NIVELES:
        col = bpy.data.collections.new(f"LOD{n}")
        esc.collection.children.link(col)
        nivel(n, col)
    bpy.ops.export_scene.gltf(filepath=ruta, export_format="GLB", export_yup=True, export_apply=True,
                              export_animations=False)
    print("EXPORTADO", ruta, os.path.getsize(ruta), "bytes")


main()
