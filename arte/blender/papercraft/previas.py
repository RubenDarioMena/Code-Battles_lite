"""Fotografías del mismo collage con luz de tarde y relleno frío."""
from comun import *
from kit import piezas

def lampara(nombre,tipo,pos,energia,color,tamano):
    luz=bpy.data.lights.new(nombre,tipo)
    obj=bpy.data.objects.new(nombre,luz)
    bpy.context.collection.objects.link(obj)
    obj.location=pos
    obj.rotation_euler=Vector((-.67,.48,-1)).to_track_quat('-Z','Y').to_euler()
    luz.energy=energia
    luz.color=color
    luz.angle=tamano
    return obj

def estudio():
    esc=bpy.context.scene
    esc.render.engine='CYCLES'
    esc.cycles.samples=24
    esc.cycles.use_denoising=True
    esc.cycles.max_bounces=3
    esc.world=bpy.data.worlds.new('Azul de la tarde')
    esc.world.use_nodes=True
    nodos=esc.world.node_tree.nodes
    fondo=nodos.get('Background')
    fondo.inputs[0].default_value=(.56,.66,.86,1)
    fondo.inputs[1].default_value=.43
    # El cielo de cámara se gradúa en función de la altura en el encuadre.
    camino=nodos.new('ShaderNodeLightPath')
    coords=nodos.new('ShaderNodeTexCoord')
    sep=nodos.new('ShaderNodeSeparateXYZ')
    grad=nodos.new('ShaderNodeValToRGB')
    grad.color_ramp.elements[0].color=(.315,.248,.292,1)
    grad.color_ramp.elements[1].color=(.059,.098,.161,1)
    cielo=nodos.new('ShaderNodeBackground')
    mix=nodos.new('ShaderNodeMixShader')
    conectar=esc.world.node_tree.links.new
    conectar(coords.outputs['Window'],sep.inputs[0])
    conectar(sep.outputs['Y'],grad.inputs[0])
    conectar(grad.outputs[0],cielo.inputs[0])
    conectar(camino.outputs['Is Camera Ray'],mix.inputs[0])
    conectar(fondo.outputs[0],mix.inputs[1]); conectar(cielo.outputs[0],mix.inputs[2])
    conectar(mix.outputs[0],nodos.get('World Output').inputs[0])
    lampara('Sol bajo','SUN',(0,0,40),3.0,(1,.85,.66),math.radians(7))
    esc.view_settings.view_transform='AgX'
    esc.render.image_settings.file_format='JPEG'
    esc.render.image_settings.quality=91
    cam=bpy.data.objects.new('Objetivo',bpy.data.cameras.new('Objetivo'))
    bpy.context.collection.objects.link(cam); esc.camera=cam
    cam.data.type='ORTHO'; cam.data.clip_end=2000
    return cam

def quitar_comentarios(ruta):
    """El JPEG de Blender lleva etiquetas COM con fecha y duración del render."""
    datos=ruta.read_bytes()
    partes=[datos[:2]]
    pos=2
    while datos[pos:pos+2]!=b'\xff\xda':
        largo=int.from_bytes(datos[pos+2:pos+4],'big')
        fin=pos+2+largo
        if datos[pos:pos+2]!=b'\xff\xfe':
            partes.append(datos[pos:fin])
        pos=fin
    ruta.write_bytes(b''.join(partes)+datos[pos:])

def foto(cam,nombre,centro,offset,escala,res):
    cam.location=Vector(centro)+Vector(offset)
    cam.rotation_euler=(-Vector(offset)).to_track_quat('-Z','Y').to_euler()
    cam.data.ortho_scale=escala
    esc=bpy.context.scene
    esc.render.resolution_x,esc.render.resolution_y=res
    esc.render.resolution_percentage=100
    esc.render.filepath=str(BASE/'previas'/(nombre+'.jpg'))
    bpy.ops.render.render(write_still=True)
    quitar_comentarios(Path(esc.render.filepath))

def generar():
    (BASE/'previas').mkdir(exist_ok=True)
    mat=next(m for m in bpy.data.materials if m.name.startswith('Cartulina'))
    biblioteca={p.nombre:p.objeto(mat) for p in piezas()}
    for obj in biblioteca.values(): obj.hide_render=True
    sitios=json.loads((BASE/'colocaciones.json').read_text())
    for s in sitios:
        obj=biblioteca[s['pieza']].copy()
        bpy.context.collection.objects.link(obj)
        obj.hide_render=False
        obj.location=(s['x'],-s['y'],s['z']); obj.rotation_euler.z=-s['giro']
        obj.scale=(s['escala'],)*3
    cam=estudio()
    w,h=MAPA['metros']; x,y=MAPA['muralla'][5]
    foto(cam,'panorama',(w/2,-h/2,1),(28,-210,231),430,(960,600))
    foto(cam,'frente-sur',(x-10,-y-26,2),(74,-113,79),141,(960,600))
    x,y=MAPA['rio']['puntos'][5]
    foto(cam,'ribera',(x,-y,3),(15,-38,24),63,(960,600))
    x,y=MAPA['cordilleras']['suroeste'][-1]['centro']
    foto(cam,'canto-de-la-sierra',(x+4,-y,7),(23,-31,15),43,(960,600))
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH': obj.hide_render=True
    # Dos filas en coordenadas de pantalla con igual espacio para cada silueta.
    objetivo=Vector((.42,-1,.61)).normalized()
    rot=(-objetivo).to_track_quat('-Z','Y')
    derecha=rot @ Vector((1,0,0)); arriba=rot @ Vector((0,1,0))
    tinta=bpy.data.materials.new("Marfil"); tinta.diffuse_color=(.94,.85,.66,1)
    for i,(nombre,obj) in enumerate(biblioteca.items()):
        base=derecha*((i%5-2)*9.4)+arriba*((.5-i//5)*9.4-1.7)
        obj.hide_render=False; obj.location=base
        escala=5.8/max(obj.dimensions);obj.scale=(escala,)*3
        texto=bpy.data.curves.new('Rótulo','FONT')
        texto.body=nombre.replace('-',' ').capitalize();texto.align_x='CENTER';texto.size=.82
        etiqueta=bpy.data.objects.new(nombre+' · pie',texto);bpy.context.collection.objects.link(etiqueta)
        etiqueta.location=base-arriba*1.75+objetivo*3
        etiqueta.rotation_euler=rot.to_euler();texto.materials.append(tinta)
    foto(cam,'piezas',(0,0,0),objetivo*80,48,(960,432))
