"""Preparación de piezas rígidas en Blender. Las fuentes siguen vivas hasta la unión."""
import math
import re

import bmesh
import bpy

from .rig_blender import ancestro, base_nombre


def triangulos(me):
    return sum(len(p.vertices)-2 for p in me.polygons)


def piezas_de(todos, pivotes, escena, nivel):
    grupos = {}
    fuera = re.compile(nivel.fuera)
    for o in todos:
        if o.type not in ("MESH","CURVE") or escena.visibles is not None and o not in escena.visibles:
            continue
        if fuera.match(o.get("familia", base_nombre(o))):
            continue
        if o.type == "CURVE":
            if nivel.curvas is None:
                continue
            o.data.resolution_u, o.data.bevel_resolution = nivel.curvas
        medida = max(o.dimensions)
        if medida < nivel.minimo and not any(h.type == "MESH" for h in o.children):
            continue
        for md in o.modifiers:
            if md.type == "BEVEL":
                md.segments = max(1,nivel.bisel)
                md.show_render = md.show_viewport = nivel.bisel > 0 and medida >= nivel.bisel_minimo
        grupos.setdefault(ancestro(o,pivotes), []).append(o)
    return grupos


def coste(o, dg):
    ev = o.evaluated_get(dg)
    return triangulos(ev.data)


def decimar_cuota(lista, cuota, dg):
    """Reparte la cuota histórica entre piezas. Corrige el redondeo en la siguiente pieza."""
    costes = sorted(((coste(o,dg),o) for o in lista), key=lambda par:par[0])
    pendiente = sum(n for n,_ in costes)
    for n,o in costes:
        objetivo = round(n*cuota/pendiente) if pendiente else 0
        pendiente -= n
        if n <= max(4,objetivo):
            cuota -= n
            continue
        md = o.modifiers.new("decimar","DECIMATE")
        bajo,alto = 0.,1.
        proporcion = min(1.,max(0.,objetivo/n))
        mejor = (abs(n-objetivo),1.,n)
        for _ in range(11):
            md.ratio = proporcion
            dg.update()
            actual = coste(o,dg)
            mejor = min(mejor,(abs(actual-objetivo),proporcion,actual))
            if abs(actual-objetivo) <= 1:
                break
            if actual > objetivo:
                alto = proporcion
            else:
                bajo = proporcion
            proporcion = (bajo+alto)/2
        md.ratio = mejor[1]
        cuota -= mejor[2]


def decimar(grupos, nombres, nivel):
    dg = bpy.context.evaluated_depsgraph_get()
    for p,lista in grupos.items():
        if nombres[p] in nivel.cuotas:
            decimar_cuota(lista,nivel.cuotas[nombres[p]],dg)
            continue
        for o in lista:
            if o.type != "MESH" or nivel.cuotas:
                continue
            proporcion = next((v for patron,v in nivel.excepciones if re.match(patron,o.name)), nivel.proporcion)
            if proporcion < 1 and coste(o,dg) > nivel.umbral:
                o.modifiers.new("decimar","DECIMATE").ratio = proporcion


def unir(pivote, piezas, destino, col, dg, materiales):
    bm, mats = bmesh.new(), []
    inv = pivote.evaluated_get(dg).matrix_world.inverted()
    for o in piezas:
        ev = o.evaluated_get(dg)
        me = bpy.data.meshes.new_from_object(ev)
        tmp = bmesh.new()
        tmp.from_mesh(me)
        bmesh.ops.transform(tmp, matrix=inv @ ev.matrix_world, verts=tmp.verts)
        indices = []
        for mat in (me.materials or [None]):
            clave = base_nombre(mat).removesuffix("_canto").removeprefix("exp_") if mat else "grafito"
            if clave not in materiales:
                raise ValueError(f"material · {o.name} · {clave} fuera de la paleta")
            plano = materiales[clave]
            if plano not in mats:
                mats.append(plano)
            indices.append(mats.index(plano))
        for f in tmp.faces:
            f.material_index = indices[f.material_index]
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    bm.normal_update()
    vivas = [e for e in bm.edges if len(e.link_faces)==2 and e.calc_face_angle(0) > math.radians(30)]
    bmesh.ops.split_edges(bm, edges=vivas)
    for f in bm.faces:
        f.smooth = True
    nombre = destino.name+"_malla"
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(nombre,me)
    col.objects.link(obj)
    obj.parent = destino
    return obj
