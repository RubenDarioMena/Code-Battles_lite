"""Adaptador para Blender 4.1+. Las máquinas comparten su paleta entre piezas."""
import json
from math import radians

import bpy


def materiales(paleta):
    """Valores lineales (RGB, metalicidad, rugosidad, fuerza de emisión)."""
    resultado = {}
    for clave, (rgb, metal, rugosidad, emision) in paleta.items():
        mat = bpy.data.materials.new(clave)
        mat.diffuse_color = (*rgb,1)
        if not mat.node_tree:
            mat.use_nodes = True
        bsdf = next(n for n in mat.node_tree.nodes if n.type=="BSDF_PRINCIPLED")
        for entrada, valor in (("Base Color",(*rgb,1)),("Metallic",metal),
                               ("Roughness",rugosidad),("Emission Color",(*rgb,1)),
                               ("Emission Strength",emision)):
            bsdf.inputs[entrada].default_value = valor
        resultado[clave] = mat
    return resultado


def pivote(nombre, padre=None, posicion=(0,0,0), reglas=()):
    obj = bpy.data.objects.new(nombre,None)
    bpy.context.collection.objects.link(obj)
    obj.parent = padre
    obj.location = posicion
    obj.empty_display_size = .035
    if reglas:
        obj["rig"] = json.dumps(list(reglas),ensure_ascii=False)
    return obj


def objeto(malla, paleta, padre=None, angulo_vivo=36):
    if not malla.caras:
        return None
    nombre = f"{malla.familia}_{malla.nombre}"
    mesh = bpy.data.meshes.new(nombre)
    mesh.from_pydata(malla.vertices,[],malla.caras)
    mesh.update()
    claves = dict.fromkeys(malla.materiales)
    indices = {k:i for i,k in enumerate(claves)}
    for k in claves:
        mesh.materials.append(paleta[k])
    for pol, clave in zip(mesh.polygons,malla.materiales):
        pol.material_index = indices[clave]
        pol.use_smooth = True
    mesh.set_sharp_from_angle(angle=radians(angulo_vivo))
    obj = bpy.data.objects.new(nombre,mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = padre
    obj["familia"] = malla.familia
    obj["ultimo_nivel"] = malla.ultimo_nivel
    return obj
