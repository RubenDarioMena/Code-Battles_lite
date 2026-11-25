"""Exportación de los tres niveles. Sólo el archivo validado sustituye al destino."""
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

from .lectura_glb import escribir, exigir, leer
from .validar_glb import validar


def construir_nivel(descriptor, n, planos):
    import bpy
    from .geometria_exportar import decimar, piezas_de, unir
    from .rig_blender import C, ancestro, leer_pivote, seleccion

    nivel = descriptor["NIVELES"][n]
    escena = descriptor["construir"](n)
    bpy.context.view_layer.update()
    todos, nombres = seleccion(escena, descriptor)
    dg = bpy.context.evaluated_depsgraph_get()
    col = bpy.data.collections.new(f"LOD{n}")
    bpy.context.scene.collection.children.link(col)
    destinos = {}
    referencia = {}
    inv_c = C.inverted()
    # Construir con nombres temporales permite que la fuente ya tenga prefijo L0_.
    for o, nombre in nombres.items():
        # Medición independiente antes de desmontar la escena de autor.
        mundo = C @ o.evaluated_get(dg).matrix_world @ inv_c
        columna = [mundo[i][j] for j in range(4) for i in range(4)]
        columna[13] += descriptor.get("AJUSTE_SUELO_Y",0)
        referencia[nombre] = columna
        padre = ancestro(o.parent,nombres)
        local, reglas = leer_pivote(o,padre,nombres,escena,descriptor.get("MANDOS",{}),dg)
        vacio = bpy.data.objects.new("pivote_exportacion",None)
        col.objects.link(vacio)
        vacio.parent = destinos.get(padre)
        vacio.rotation_mode = "QUATERNION"
        vacio.matrix_basis = local
        if reglas:
            vacio["rig"] = json.dumps(dict(v=2,reglas=reglas), ensure_ascii=False)
        destinos[o] = vacio
    raiz = destinos[escena.raiz]
    raiz["rig_formato"], raiz["rig_v"] = "cbl-rig", 2
    # IDProperty no representa de forma portable una lista heterogénea/vacía.
    # La última pasada sobre el JSON del GLB escribe la lista nativa del contrato.
    raiz["controles"] = json.dumps(escena.controles,ensure_ascii=False)
    for k,v in escena.extras.items():
        raiz[k] = json.dumps(v,ensure_ascii=False)
    for k,v in escena.paleta.items():
        planos.setdefault(k,v)
    grupos = piezas_de(todos,nombres,escena,nivel)
    decimar(grupos,nombres,nivel)
    dg = bpy.context.evaluated_depsgraph_get()
    salidas = [(vacio, f"L{n}_{nombres[o]}") for o, vacio in destinos.items()]
    for p,piezas in grupos.items():
        malla = unir(p,piezas,destinos[p],col,dg,planos)
        salidas.append((malla, f"L{n}_{nombres[p]}_malla"))
    for o in reversed(todos):
        bpy.data.objects.remove(o,do_unlink=True)
    for o, nombre in salidas:
        o.name = nombre
        exigir(o.name == nombre, f"nombre final ocupado o truncado: {nombre}")
        if o.type == "MESH":
            o.data.name = nombre
    return referencia


def finalizar(ruta, pres, ajuste=0, referencia=None):
    doc = leer(ruta)
    d = doc.d
    raices = [d["nodes"][i] for i in d["scenes"][0]["nodes"]]
    for n in raices:
        n["extras"]["controles"] = json.loads(n["extras"]["controles"])
    # Origen de diseño declarado por el descriptor. Un cambio posterior de
    # altura de la máquina debe detectarse en la validación.
    for n in raices:
        if not ajuste:
            continue
        if "matrix" in n:
            n["matrix"][13] += ajuste
        else:
            n.setdefault("translation",[0.,0.,0.])[1] += ajuste
        if "rig" in n["extras"]:
            rig = json.loads(n["extras"]["rig"])
            if rig["reglas"][0]["tipo"] == "LOCAL":
                rig["reglas"][0]["base"]["t"][1] += ajuste
                n["extras"]["rig"] = json.dumps(rig,ensure_ascii=False)
    escribir(ruta,d,doc.binario)
    informe = validar(ruta,pres,referencia)
    exigir(not informe["errores"], "\n"+"\n".join(informe["errores"]))
    return informe


def ejecutar(descriptor):
    import bpy
    args = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    destino = Path(args[0] if args else descriptor["ARCHIVO"]).resolve()
    destino.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    planos = {}
    referencia = [construir_nivel(descriptor,n,planos) for n in range(3)]
    # Libera los nombres originales antes de renombrar la paleta de exportación.
    for m in list(bpy.data.materials):
        if m not in planos.values():
            bpy.data.materials.remove(m)
    for k,m in planos.items():
        m.name = k
    with TemporaryDirectory(dir=destino.parent) as temporal:
        ruta = Path(temporal)/destino.name
        bpy.ops.export_scene.gltf(filepath=str(ruta), export_format="GLB", export_yup=True,
                                  export_apply=True, export_animations=False, export_extras=True)
        informe = finalizar(ruta,descriptor["PRESUPUESTO"],descriptor.get("AJUSTE_SUELO_Y",0),referencia)
        ruta.replace(destino)
    print("EXPORTADO", destino, json.dumps(informe,ensure_ascii=False))
