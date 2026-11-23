"""blender -b --factory-startup --python catalogo.py -- --salida carpeta [--glb archivo]"""
import argparse
import sys
from pathlib import Path

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from kit import regla_mando
from kit.blender import materiales, objeto, pivote
from kit.muestras import PALETA, encuadrar, primeros_planos, rejilla


def estudio():
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    escena = bpy.context.scene
    try:
        escena.render.engine = "BLENDER_EEVEE"
    except TypeError:
        escena.render.engine = "BLENDER_EEVEE_NEXT"
    escena.render.resolution_x,escena.render.resolution_y = 2400,1600
    escena.render.resolution_percentage = 100
    escena.render.image_settings.file_format = "PNG"
    escena.world.use_nodes = True
    fondo = next(n for n in escena.world.node_tree.nodes if n.type=="BACKGROUND")
    fondo.inputs["Color"].default_value = (.83,.86,.89,1)
    fondo.inputs["Strength"].default_value = .58
    bpy.ops.object.camera_add(location=(0,0,20))
    camara = bpy.context.object
    camara.rotation_euler = (0,0,0)
    camara.data.type = "ORTHO"
    camara.data.ortho_scale = 15
    escena.camera = camara
    bpy.ops.mesh.primitive_plane_add(size=100)
    suelo = bpy.context.object
    paleta = materiales(dict(PALETA, papel=((.84,.86,.85),0,.85,0),
                             tinta=((.025,.057,.064),0,.75,0)))
    suelo.data.materials.append(paleta["papel"])
    for posicion,potencia,tam in (((-5,3,9),1250,8),((6,-2,8),840,7),((0,6,6),400,5)):
        bpy.ops.object.light_add(type="AREA",location=posicion)
        luz = bpy.context.object
        luz.rotation_euler = (-luz.location).to_track_quat("-Z","Y").to_euler()
        luz.data.energy = potencia
        luz.data.shape = "DISK"
        luz.data.size = tam
    return escena,paleta


def texto(cadena,x,y,tam,tinta):
    datos = bpy.data.curves.new(cadena,"FONT")
    datos.body = cadena
    datos.align_x,datos.align_y = "CENTER","CENTER"
    datos.size = tam
    obj = bpy.data.objects.new(cadena,datos)
    bpy.context.collection.objects.link(obj)
    obj.location = (x,y,.015)
    datos.materials.append(tinta)
    return obj


def render(escena, ruta, elementos):
    escena.render.filepath = str(ruta)
    bpy.ops.render.render(write_still=True)
    for obj in elementos:
        bpy.data.objects.remove(obj,do_unlink=True)


def exportar(ruta,paleta):
    objetos = []
    for nivel in range(3):
        raiz = pivote(f"L{nivel}_Catalogo")
        objetos.append(raiz)
        for x,y,_,m in rejilla(nivel):
            if m.caras:
                m.nombre = f"{m.nombre}_L{nivel}"
                posicion = (x*.30,y*.29,0)
                if m.familia=="rueda":
                    giro = pivote(f"L{nivel}_giro_rueda",raiz,posicion,
                                  [regla_mando("rodar","rotacion",(1,0,0))])
                    objetos.append(giro)
                    obj = objeto(m,paleta,giro)
                else:
                    obj = objeto(m,paleta,raiz)
                    obj.location = posicion
                objetos.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objetos:
        obj.select_set(True)
    ruta.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(ruta),export_format="GLB",use_selection=True,
                              export_yup=True,export_extras=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--salida",type=Path,required=True)
    parser.add_argument("--glb",type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    args.salida.mkdir(parents=True,exist_ok=True)
    escena,paleta = estudio()
    for nivel in range(3):
        elementos = []
        for x,y,titulo,m in rejilla(nivel):
            if m.caras:
                elementos.append(objeto(encuadrar(m,x,y+.12,2.35,1.30),paleta))
            else:
                elementos.append(texto("—",x,y+.12,.23,paleta["tinta"]))
            elementos.append(texto(titulo,x,y-.69,.205,paleta["tinta"]))
        render(escena,args.salida/f"catalogo_L{nivel}.png",elementos)

    posiciones = [(-3.56,2.2),(3.56,2.2),(-4.8,-2.2),(0,-2.2),(4.8,-2.2)]
    elementos = []
    for i,((titulo,m),(x,y)) in enumerate(zip(primeros_planos(),posiciones)):
        elementos.append(objeto(encuadrar(m,x,y+.32,6.50 if i<2 else 4.0,3.4),paleta))
        elementos.append(texto(titulo,x,y-1.70,.29,paleta["tinta"]))
    render(escena,args.salida/"primeros_planos.png",elementos)
    if args.glb:
        exportar(args.glb.resolve(),paleta)


if __name__=="__main__":
    main()
