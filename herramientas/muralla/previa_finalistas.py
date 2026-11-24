"""Hoja 2 × 2 con la malla y los colores exactos del laboratorio tras comparar()."""
import bpy, math, shutil, subprocess, sys, tempfile
from pathlib import Path
from mathutils import Vector
import numpy as np

raiz=Path.cwd()
arte=raiz/'arte/blender/papercraft'
sys.dont_write_bytecode=True
sys.path.insert(0,str(arte))
from previas import estudio

def cargar(fichero):
    datos=fichero.read_bytes()
    nv,nt=map(int,np.frombuffer(datos,'<u4',count=2))
    xyz=np.frombuffer(datos,'<f4',count=3*nv,offset=8).reshape(-1,3)
    rgb=np.frombuffer(datos,'<f4',count=3*nv,offset=8+12*nv).reshape(-1,3)
    tris=np.frombuffer(datos,'<u4',count=3*nt,offset=8+24*nv).reshape(-1,3)
    m=bpy.data.meshes.new(fichero.stem)
    m.from_pydata(xyz.tolist(),[],tris.tolist());m.update()
    tinta=m.color_attributes.new(name='Tinta',type='FLOAT_COLOR',domain='POINT')
    # El dibujante r128 entrega RGB de pantalla al framebuffer del laboratorio.
    lineal=np.maximum(0,(rgb+.055)/1.055)**2.4
    tinta.data.foreach_set('color',np.column_stack([lineal,np.ones(nv)]).astype('float32').ravel())
    m.materials.append(papel)
    obj=bpy.data.objects.new(fichero.stem,m);bpy.context.collection.objects.link(obj)
    return obj

bpy.ops.wm.read_factory_settings(use_empty=True)
cam=estudio()
cam.data.type='ORTHO';cam.data.sensor_fit='HORIZONTAL';cam.data.ortho_scale=46
eje=Vector((.34,-1,.42)).normalized()
rot=(-eje).to_track_quat('-Z','Y')
cam.rotation_euler=rot.to_euler();cam.location=eje*150+Vector((0,0,5.2))
derecha=rot@Vector((1,0,0));arriba=rot@Vector((0,1,0))
papel=bpy.data.materials.new('Cartulina fracturada');papel.use_nodes=True
arbol=papel.node_tree;bs=arbol.nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value=.98
tinta=arbol.nodes.new('ShaderNodeVertexColor');tinta.layer_name='Tinta'
fibra=arbol.nodes.new('ShaderNodeTexImage');fibra.image=bpy.data.images.load(str(arte/'texturas/fibra.png'));fibra.projection='BOX'
coords=arbol.nodes.new('ShaderNodeTexCoord');escala=arbol.nodes.new('ShaderNodeVectorMath')
escala.operation='SCALE';escala.inputs['Scale'].default_value=1/12
arbol.links.new(coords.outputs['Object'],escala.inputs[0]);arbol.links.new(escala.outputs[0],fibra.inputs[0])
mezcla=arbol.nodes.new('ShaderNodeMixRGB');mezcla.blend_type='MULTIPLY';mezcla.inputs[0].default_value=.82
arbol.links.new(tinta.outputs[0],mezcla.inputs[1]);arbol.links.new(fibra.outputs[0],mezcla.inputs[2])
arbol.links.new(mezcla.outputs[0],bs.inputs['Base Color'])
letra=bpy.data.materials.new('Rótulo');letra.use_nodes=True
em=letra.node_tree.nodes.new('ShaderNodeEmission');em.inputs[0].default_value=(1,.94,.8,1)
letra.node_tree.links.new(em.outputs[0],letra.node_tree.nodes.get('Material Output').inputs[0])
suelo=bpy.data.materials.new('Base');suelo.use_nodes=True
suelo.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.47,.40,.31,1)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,-.27))
base=bpy.context.object;base.dimensions=(80,65,.5);base.data.materials.append(suelo)
esc=bpy.context.scene;esc.render.resolution_x=480;esc.render.resolution_y=288;esc.render.resolution_percentage=100
esc.render.image_settings.file_format='PNG'
node=shutil.which('node') or str(sorted((Path.home()/'.nvm/versions/node').glob('*/bin/node'))[-1])
ffmpeg=shutil.which('ffmpeg') or '/opt/homebrew/bin/ffmpeg'
with tempfile.TemporaryDirectory(dir=raiz/'.cola-blender') as temp:
    subprocess.run([node,'herramientas/muralla/previa-finalistas.mjs',temp],check=True)
    for i,nombre in enumerate(['Gavión','Pie en T + Cordón','Traba + Cordón','Talud']):
        id=chr(65+i);obj=cargar(Path(temp)/(id+'.bin'))
        texto=bpy.data.curves.new(id,'FONT');texto.body=id+'   '+nombre;texto.size=1.62
        pie=bpy.data.objects.new('Nombre '+id,texto);bpy.context.collection.objects.link(pie)
        pie.location=Vector((0,0,5.2))-derecha*21+arriba*10.2+eje*38
        pie.rotation_euler=rot.to_euler();texto.materials.append(letra)
        esc.render.filepath=str(Path(temp)/f'{i}.png')
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(obj,do_unlink=True);bpy.data.objects.remove(pie,do_unlink=True)
    salida=arte/'previas/destruccion-finalistas.jpg'
    subprocess.run([ffmpeg,'-loglevel','error','-y','-i',str(Path(temp)/'%d.png'),
                    '-vf','tile=2x2','-frames:v','1','-q:v','2','-threads','1',str(salida)],check=True)
