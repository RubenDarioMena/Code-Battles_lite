"""Cartulinas en metros. Las caras se describen en coordenadas del mapa."""
import bpy
import hashlib
import json
import math
import random
import struct
import zlib
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
import numpy as np

BASE = Path("arte/blender/papercraft").resolve()
PALETA = json.loads((BASE / "paleta.json").read_text())
MAPA = json.loads((BASE / "mapa-ampliado.json").read_text())
GRANO = 36  # Metros por repetición.
def azar(nombre):
    return random.Random(int.from_bytes(hashlib.sha256(str(nombre).encode()).digest()[:8], "big"))

def png(ruta, rgb):
    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos))
    h,w,_ = rgb.shape
    datos = b"".join(b"\0" + fila.tobytes() for fila in rgb)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n" + bloque(b'IHDR',struct.pack(">IIBBBBB",w,h,8,2,0,0,0))
                     + bloque(b'IDAT',zlib.compress(datos,9)) + bloque(b'IEND',b''))

def texturas():
    carpeta = BASE / "texturas"
    carpeta.mkdir(exist_ok=True)
    n = 1024
    gen = np.random.default_rng(1709)
    ruido = gen.normal(0, 3, (n,n))
    for paso, amplitud in [(128,7),(32,10),(8,9),(2,4)]:
        rejilla = gen.normal(0, amplitud, (n//paso,n//paso))
        pos = np.arange(n)/paso
        i, f = pos.astype(int), pos%1
        filas = rejilla[:,i]*(1-f) + np.roll(rejilla,-1,axis=1)[:,i]*f
        ruido += filas[i,:]*(1-f[:,None]) + np.roll(filas,-1,axis=0)[i,:]*f[:,None]
    for _ in range(13500):
        x,y = gen.integers(n,size=2)
        t = gen.uniform(-.95,.95)
        v = gen.uniform(-36,32)
        for k in range(gen.integers(9,47)):
            for ancho in (-1,0,1):
                ruido[(y+round(k*t)+ancho)%n,(x+k)%n] += v*(1-.22*abs(ancho))
    gris = np.clip(225+ruido,0,255).astype('uint8')
    png(carpeta/'fibra.png',np.repeat(gris[:,:,None],3,axis=2))
    normal = np.stack([(np.roll(ruido,1,axis=i)-np.roll(ruido,-1,axis=i))*.006 for i in (1,0)]
                      + [np.ones_like(ruido)],axis=2)
    normal /= np.linalg.norm(normal,axis=2,keepdims=True)
    png(carpeta/'relieve.png',((normal*.5+.5)*255).astype('uint8'))

def color(nombre,tono):
    rgb = bytes.fromhex(PALETA[nombre][1:])
    return tuple(min(1,((c/255+.055)/1.055)**2.4*tono) for c in rgb)+(1,)

def material():
    m=bpy.data.materials.new("Cartulina de trapo")
    m.use_nodes=True
    nodos=m.node_tree.nodes
    unir=m.node_tree.links.new
    bs=nodos.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=.96
    vc=nodos.new('ShaderNodeVertexColor')
    vc.layer_name="COLOR_0"
    mezcla=nodos.new('ShaderNodeMixRGB')
    mezcla.blend_type='MULTIPLY'
    mezcla.inputs[0].default_value=1
    unir(vc.outputs['Color'],mezcla.inputs[1])
    for nombre in ('fibra','relieve'):
        tex=nodos.new('ShaderNodeTexImage')
        tex.image=bpy.data.images.load(str(BASE / 'texturas' / (nombre+'.png')))
        if nombre=='fibra':
            unir(tex.outputs[0],mezcla.inputs[2])
            unir(mezcla.outputs[0],bs.inputs['Base Color'])
        else:
            tex.image.colorspace_settings.name='Non-Color'
            nor=nodos.new('ShaderNodeNormalMap')
            nor.inputs['Strength'].default_value=.24
            unir(tex.outputs[0],nor.inputs['Color'])
            unir(nor.outputs[0],bs.inputs['Normal'])
        tex.image.pack()
    return m

def contorno(x,y,a,b,n,semilla,giro=0,aspereza=.05):
    r=azar(semilla)
    fases=[r.uniform(0,6.28) for _ in range(3)]
    puntos=[]
    for i in range(n):
        t=i*math.tau/n
        k=1+aspereza*(math.sin(3*t+fases[0])+.66*math.sin(5*t+fases[1])
                      +.37*math.sin(9*t+fases[2])+r.uniform(-.45,.45))
        u,v=a*k*math.cos(t),b*k*math.sin(t)
        puntos.append((x+u*math.cos(giro)-v*math.sin(giro),y+u*math.sin(giro)+v*math.cos(giro)))
    return puntos

class Papel:
    def __init__(self,nombre):
        self.nombre=nombre
        self.caras=[]

    def cara(self,puntos,tinte,tono=1):
        self.caras.append((list(puntos),tinte,tono))

    def tapa(self,puntos,z,tinte,tono=1):
        vs=[Vector((p[0],p[1],z)) for p in puntos]
        for ids in tessellate_polygon([vs]):
            a,b,c=[vs[i] for i in ids]
            if (b-a).cross(c-a).z < 0:
                b,c=c,b
            self.cara([tuple(a),tuple(b),tuple(c)],tinte,tono)

    def lamina(self,puntos,z,alto,tinte,tono=1):
        # Alma y línea de cola. En los pisos altos una tercera cara de cartón prensado.
        capas=[(0,.08,'cola'),(.08,.88,'cartón'),(.88,1,'alma')] if alto>.65 else [(0,.28,'cola'),(.28,1,'alma')]
        area=sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(puntos,puntos[1:]+puntos[:1]))
        if area<0: puntos=puntos[::-1]
        for i,p in enumerate(puntos):
            q=puntos[(i+1)%len(puntos)]
            def nivel(fraccion,indice):
                onda=math.sin(indice*2.31+.5*z)+.5*math.sin(indice*4.6+z)
                return z+alto*(fraccion+(.055*onda if 0<fraccion<1 else 0))
            for bajo,arriba,mat in capas:
                self.cara([(*p,nivel(bajo,i)),(*q,nivel(bajo,(i+1)%len(puntos))),
                           (*q,nivel(arriba,(i+1)%len(puntos))),(*p,nivel(arriba,i))],
                          mat,tono*(.97+.035*math.sin(i*4.49)))
            if alto>.28 and len(puntos)>=20 and i%3==1:
                # Barbas cortas que quedaron prendidas al desgarrar el canto.
                dx,dy=q[0]-p[0],q[1]-p[1]
                l=math.hypot(dx,dy)
                if l>.2:
                    fx,fy=dy/l,-dx/l
                    for t in (.31,.56):
                        u,v=p[0]+dx*t,p[1]+dy*t
                        d=.19+.13*math.sin(i+t)
                        self.cara([(u+fx*.012,v+fy*.012,z+alto*.92),
                                   (u+dx*.13+fx*.012,v+dy*.13+fy*.012,z+alto*.93),
                                   (u+dx*.21+fx*d,v+dy*.21+fy*d,z+alto*(.48+.18*math.sin(i)))],
                                  'alma',.92)
        if len(puntos)==24 and .30<alto<.62:
            cx=sum(v[0] for v in puntos)/len(puntos)
            cy=sum(v[1] for v in puntos)/len(puntos)
            interior=[]
            for i,(x,y) in enumerate(puntos):
                margen=.023+.019*math.sin(i*2.38+z)
                interior.append((x+(cx-x)*margen,y+(cy-y)*margen))
            for i,a in enumerate(puntos):
                j=(i+1)%len(puntos)
                self.cara([(*a,z+alto),(*puntos[j],z+alto),(*interior[j],z+alto),(*interior[i],z+alto)],'alma',.96)
            puntos=interior
        self.tapa(puntos,z+alto,tinte,tono)

    def objeto(self,mat):
        verts=[]; caras=[]; colores=[]; uvs=[]
        for puntos,tinte,tono in self.caras:
            # Invertir el eje sur y conservar el frente de la cartulina.
            v=[Vector((x,-y,z)) for x,y,z in reversed(puntos)]
            n=(v[1]-v[0]).cross(v[2]-v[0])
            if n.length_squared<1e-16:
                continue
            eje=max(range(3),key=lambda i:abs(n[i]))
            caras.append(tuple(range(len(verts),len(verts)+len(v))))
            verts.extend(v)
            colores.extend([color(tinte,tono)]*len(v))
            periodo=GRANO if self.nombre.startswith('terreno-') else GRANO*.32
            uvs.extend([(p[(eje+1)%3]/periodo,p[(eje+2)%3]/periodo) for p in v])
        mesh=bpy.data.meshes.new(self.nombre)
        mesh.from_pydata(verts,[],caras)
        mesh.update()
        mesh.materials.append(mat)
        col=mesh.color_attributes.new(name="COLOR_0",type='FLOAT_COLOR',domain='POINT')
        col.data.foreach_set('color',np.asarray(colores,dtype='float32').ravel())
        limpio=mesh.color_attributes.new(name="COLOR_1",type="FLOAT_COLOR",domain="POINT")
        limpio.data.foreach_set("color",np.asarray(colores,dtype="float32").ravel())
        mesh.color_attributes.active_color=mesh.color_attributes["COLOR_0"]
        uv=mesh.uv_layers.new(name="Fibra")
        uv.data.foreach_set('uv',np.asarray(uvs,dtype='float32').ravel())
        obj=bpy.data.objects.new(self.nombre,mesh)
        bpy.context.collection.objects.link(obj)
        return obj

def iniciar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    texturas()
    return material()

def exportar(obj,ruta):
    ruta.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    # El exportador 5.2 blanquea el primer color cuando añade un segundo.
    # Exportar la tinta limpia como atributo RGB independiente conserva ambos.
    mesh=obj.data
    rgba=np.empty((len(mesh.vertices),4),dtype=np.float32)
    mesh.color_attributes["COLOR_1"].data.foreach_get("color",rgba.ravel())
    limpio=mesh.attributes.new("_tinta_limpia","FLOAT_VECTOR","POINT")
    limpio.data.foreach_set("vector",rgba[:,:3].flatten())
    try:
        bpy.ops.export_scene.gltf(filepath=str(ruta),use_selection=True,export_format='GLB',
            export_vertex_color='NAME',export_vertex_color_name='COLOR_0',
            export_all_vertex_colors=False,export_attributes=True,export_yup=True,
            export_image_format='AUTO',export_materials='EXPORT')
    finally:
        mesh.attributes.remove(limpio)

    # Dejar las imágenes compartidas junto al mapa evita duplicarlas 26 veces.
    bruto=ruta.read_bytes()
    fin=20+struct.unpack_from('<I',bruto,12)[0]
    doc=json.loads(bruto[20:fin]); binario=bruto[fin+8:]
    for primitiva in doc['meshes'][0]['primitives']:
        atributos=primitiva['attributes']
        atributos['COLOR_1']=atributos.pop('_TINTA_LIMPIA')
    vistas=doc['bufferViews']
    bloques=[]
    for imagen in doc['images']:
        indice=imagen.pop('bufferView')
        bloques.append(indice)
        imagen['uri']='../../texturas/'+imagen['name']+'.png'
    assert sorted(bloques)==list(range(len(vistas)-len(bloques),len(vistas)))
    doc['bufferViews']=vistas[:min(bloques)]
    binario=binario[:vistas[min(bloques)]['byteOffset']]
    doc['buffers'][0]['byteLength']=len(binario)
    datos=json.dumps(doc,separators=(',',':')).encode()
    datos+=b' '*(-len(datos)%4)
    ruta.write_bytes(struct.pack('<4sIIII',b'glTF',2,28+len(datos)+len(binario),len(datos),0x4e4f534a)+datos+struct.pack('<II',len(binario),0x004e4942)+binario)
