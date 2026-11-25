"""Adaptación de las partes del mecanismo S al convenio de la máquina."""
import math
import sys
from pathlib import Path

ESFERA = Path(__file__).resolve().parents[1]/"torreta_observacion"/"esfera"
sys.path.insert(0, str(ESFERA))
import torreta_esfera as t
import transmision_esfera as tr

PIVOTES = {"base_giro":"base_giro", "muñón motriz":"munon", "hoja_i":"hoja_i", "hoja_d":"hoja_d",
           **{f"telescopio_{i}":f"telescopio_{i}" for i in range(1,5)}}
VISIBLES = ("torre","esfera","compuerta y telescopio")


def modelo():
    m = t.build("S")
    p = m.parts["muñón motriz"]
    x,y,z = p.loc
    p.loc = (x,y,z-t.BAJADA_BUCLE)
    return m


def bucle():
    claves = [dict(cuadro=f, inclinacion=round(math.radians(el),6), azimut=round(math.radians(az),6),
                   hojas=h, extension=e) for f,el,az,h,e in tr.KEYS_BUCLE]
    return dict(fps=24, cuadros=claves[-1]["cuadro"]-1, claves=claves, interpolacion="smoothstep por tramo",
                cierre="extensión en 0-30 % del tramo y hojas en 25-50 %, cada una con su smoothstep")


def escena(controles):
    import bmesh
    import bpy
    from .blender import materiales
    from .descriptor import Escena
    planos = materiales({k: (v[:3],v[3],v[4],int(k=="luz")) for k,v in t.COLORS.items()})
    col = bpy.context.scene.collection
    raiz = bpy.data.objects.new("TorretaObservacion",None)
    col.objects.link(raiz)
    objetos, visibles = {}, set()
    for p in modelo().parts.values():
        me = None
        if p.material and p.verts:
            me = bpy.data.meshes.new(p.name)
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
        obj = bpy.data.objects.new(p.name,me)
        col.objects.link(obj)
        obj.parent = objetos.get(p.parent,raiz)
        obj.location, obj.rotation_euler = p.loc,p.rot
        objetos[p.name] = obj
        if p.group in VISIBLES:
            visibles.add(obj)
    return Escena(raiz, controles, nombres={objetos[k]:v for k,v in PIVOTES.items()},
                  visibles=visibles, paleta=planos, extras={"bucle":bucle()})
