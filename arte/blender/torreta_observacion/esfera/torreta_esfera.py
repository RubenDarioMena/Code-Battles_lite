"""Blender 5.2: -b --factory-startup --python torreta_esfera.py -- --salida DIR.
Con Python normal genera el mismo informe geométrico sin cargar Blender.
"""
import argparse
import json
from math import atan2, cos, degrees, hypot, pi, radians, sin, tau
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent))
import geometria_esfera as g
import transmision_esfera as tr


def build(variant, studio=False, cut=False, sphere_cut=None):
    m=g.Model()
    if studio:
        m.part('esfera',loc=(0,0,.5))
    else:
        tr.tower(m,cut,variant)
        shaft=tr.mechanism(m,variant)
        m.group='esfera'
        m.part('esfera',shaft)
    # sphere_cut=False: torre cortada con la esfera entera (vista de menú de máquinas).
    m.cut=cut if sphere_cut is None else sphere_cut
    g.shell(m)
    g.bands(m)
    g.poles(m)
    g.aperture(m)
    return m


def rotate(v,angles):
    x,y,z=v
    a,b,c=angles
    y,z=cos(a)*y-sin(a)*z,sin(a)*y+cos(a)*z
    x,z=cos(b)*x+sin(b)*z,-sin(b)*x+cos(b)*z
    return cos(c)*x-sin(c)*y,sin(c)*x+cos(c)*y,z


def pose(p,motor,v):
    az,el,door,ext,bank=motor
    loc,rot=p.loc,p.rot
    yaw=-az*(1 if v=='S' else tr.PIN)/tr.AZ
    pitch=-el*(1/g.N if v=='S' else tr.SAT/tr.WHEEL)
    if p.name=='base_giro':
        rot=(0,0,yaw)
    elif p.name=='Portarrodillos axial':
        rot=(0,0,yaw/2)
    elif p.name.startswith('Rodillo axial '):
        rot=(0,0,-yaw*.342/(2*.003))
    elif p.name.startswith('Rueda de apoyo '):
        # Componente tangencial de la velocidad del hombro sobre el reborde.
        x,y,_=p.loc
        rot=(0,0,-pitch*.074*x/(.060*hypot(x,y)))
    elif p.name=='muñón motriz':
        rot=(pitch,0,0)
    elif p.name=='cardán':
        rot=(0,bank,0)
    elif p.name=='motor_ladeo':
        rot=(0,0,-bank*tr.WHEEL/tr.SAT)
    elif p.name in ('motor_elevacion','seguidor'):
        rot=(0,0,pi/2-el if v=='S' else el)
    elif ' cardán ' in p.name:
        i=int(p.name[-1])
        ends=tr.shaft_ends(i,tr.lift(tr.ANGLES[i],pitch))
        loc,other=ends if p.name.startswith('Manguito') else reversed(ends)
        x,y,z=(b-a for a,b in zip(loc,other))
        rot=(0,atan2(hypot(x,y),z),atan2(y,x))
    elif p.name.startswith('Carro '):
        loc=(0,0,tr.CONTACT+tr.lift(tr.ANGLES[int(p.name[-1])],pitch))
    elif p.name=='motor_azimut':
        rot=(0,0,az+(pi if v=='S' else 0))
    elif p.name in ('hoja_i','hoja_d'):
        rot=(0,(-1 if p.name=='hoja_i' else 1)*radians(100)*door,0)
    elif p.name.startswith('telescopio_'):
        loc=(0,0,.100*ext)
    return loc,rot


def apply(v,loc,rot):
    return tuple(a+b for a,b in zip(rotate(v,rot),loc))


def bbox(points):
    return [(min(k),max(k)) for k in zip(*points)]


def corners(box):
    return [(x,y,z) for x in box[0] for y in box[1] for z in box[2]]


def count(m):
    return sum(len(f)-2 for p in m.parts.values() for f in p.faces)


_door_samples={}


def verify(m,v):
    minima={}
    def measure(name,x):
        minima[name]=min(x,minima.get(name,float('inf')))
    # Envolventes convexas locales, transformadas a la horquilla. Para las
    # hojas usamos vértices reales: una caja orientada exagera el barrido.
    mobile={}
    for p in m.parts.values():
        if p.group=='compuerta y telescopio' and p.verts:
            mobile[p.name]=p.verts if p.name.startswith('Pétalo') or p.parent=='esfera' else corners(bbox(p.verts))
    def local_points(name,frame_state,stop):
        p=m.parts[name]
        origin=(0,0,0)
        axes=[(1,0,0),(0,1,0),(0,0,1)]
        while p.name!=stop:
            loc,rot=pose(p,frame_state,v)
            origin=apply(origin,loc,rot)
            axes=[rotate(k,rot) for k in axes]
            p=m.parts[p.parent]
        return [tuple(origin[i]+x*axes[0][i]+y*axes[1][i]+z*axes[2][i] for i in range(3))
                for x,y,z in mobile[name]]
    relay_counts=[0,0,0]
    phase_error=0
    # Cajas locales de los soportes, transformadas junto con el cardán.
    # La pista anular y la torre requieren una envolvente cilíndrica.
    supports=[]
    for p in m.parts.values():
        if p.group=='mecanismo_'+v and p.verts and p.name not in ('Anillo exterior',):
            mobile[p.name]=corners(bbox(p.verts))
            if p.parent and p.name not in ('Plataforma','Cubo de plataforma','Corona de azimut','Araña del colector',
                                           'Pista giratoria axial','Colector eléctrico axial'):
                root=p
                while root.parent and root.name!='base_giro':
                    root=m.parts[root.parent]
                if root.name=='base_giro':
                    supports.append(p.name)
    observer=[n for n in mobile if m.parts[n].group=='compuerta y telescopio']
    frames=range(1,tr.FRAMES+1)
    lip=(.630 if v=='S' else tr.LIP_C)*cos(pi/192)
    for frame in frames:
        st=tr.state(frame,v)
        pitch=pose(m.parts['muñón motriz'],st,v)[1][0]
        if v=='S':
            engaged=0
            for i,angle in enumerate(tr.ANGLES):
                dz=pose(m.parts['Carro '+str(i)],st,v)[0][2]-tr.CONTACT
                if dz<1e-10:
                    engaged+=1
                    rotor=m.parts['seguidor' if i else 'motor_elevacion']
                    phase=(angle-pitch)/g.PITCH+pose(rotor,st,v)[1][2]/tau-.25
                    phase_error=max(phase_error,abs(phase-round(phase)))
            relay_counts[engaged]+=1
        boxes=[]
        yaw=pose(m.parts['base_giro'],st,v)[1]
        for n in supports:
            pts=local_points(n,st,'base_giro')
            box=bbox(pts)
            if n.startswith(('Hélice meridiana','Núcleo meridiana')):
                r=max(hypot(x,y) for x,y,z in m.parts[n].verts)
                box[0]=(-r,r)
            if n.startswith('Rueda de apoyo'):
                box[:2]=[(q-.060,q+.060) for q in m.parts[n].loc[:2]]
            boxes.append(box)
            world=[rotate(q,yaw) for q in pts]
            radius=max(hypot(x,y) for x,y,z in world)
            if n.startswith('Rueda de apoyo'):
                radius=hypot(*m.parts[n].loc[:2])+.060
            zb=bbox(world)[2]
            inner=.630 if v=='S' else tr.LIP_C
            measure('transmision_labio',hypot(max(0,inner*cos(pi/192)-radius),max(0,.742-zb[1],zb[0]-.754)))
            measure('transmision_fuste',.661-radius)
        key=st[2:4]
        if key not in _door_samples:
            _door_samples[key]=g.inspect_door(m,*key)
        for name,gap in zip(('hoja_hueco','hoja_telescopio','entre_hojas'),_door_samples[key]):
            measure(name,gap)
        for name in observer:
            pts=local_points(name,st,'base_giro')
            rho=max(hypot(x,y) for x,y,z in pts)
            zmin=min(q[2] for q in pts)
            measure('observador_torre',hypot(max(0,lip-rho),max(0,zmin-.760)))
            measure('observador_plataforma',zmin-.200)
            box=bbox(pts)
            for fixed in boxes:
                gap=hypot(*(max(0,b-c,a-d) for (a,c),(b,d) in zip(box,fixed)))
                measure('observador_transmision',gap)
            if key==(1,1):
                measure('desplegado_torre',hypot(max(0,lip-rho),max(0,zmin-.760)))
                measure('desplegado_transmision',min(hypot(*(max(0,b-c,a-d)
                        for (a,c),(b,d) in zip(box,fixed))) for fixed in boxes))
            if v=='C':
                ring_pts=local_points(name,st,'cardán')
                height=bbox(ring_pts)[2]
                measure('observador_anillo',hypot(max(0,.528*cos(pi/96)-max(hypot(x,y) for x,y,z in ring_pts)),
                                                  max(0,height[0]-.014,-.014-height[1])))
    measure('camisas_concentricas',.080*cos(pi/96)-.073)
    measure('guia_collar',.091*cos(pi/96)-.087)
    measure('carcasa_plataforma',tr.Z-.5-.200)
    measure('carcasa_torre',lip-.5)
    if v=='C':
        measure('carcasa_anillo',.528*cos(pi/96)-.523)
    from control_esfera import revisar
    detail=revisar(m,v,pose,rotate)
    measure('carcasa_mecanismo',min(detail['libres_mm'].values())/1000)
    triangles=count(m)+2
    assert triangles<400000 and min(minima.values())>=.003-1e-9,(v,minima)
    result=dict(azimut='180:1, sinfín de una entrada' if v=='S' else '180:18, corona y piñón',
                inclinacion='56:1, dos sinfines sincronizados' if v=='S' else '60:18 en X e Y',
                control=detail,muestras=len(frames),triangulos_con_suelo=triangles,
                holguras_mm={k:round(x*1000,3) for k,x in minima.items()},
                pivotes=[p.name for p in m.parts.values() if p.material is None])
    if v=='S':
        # Las ventanas de relevo son disjuntas incluso entre dos muestras.
        assert 2*(tr.GAP+tr.FOOT+.05)<abs(tr.ANGLES[0]-tr.ANGLES[1])
        wire=m.parts['Hélice meridiana 0'].verts
        import math
        length=max(q[2] for q in wire)-min(q[2] for q in wire)
        lead=wire[40][2]-wire[0][2]
        assert abs(lead-g.R*g.PITCH)<1e-8
        result['sinfines_meridianos']=dict(paso_axial_mm=round(1000*lead,3),
            diametro_mm=round(2000*max(hypot(x,y) for x,y,z in wire),3),
            longitud_mm=round(1000*length,3),avance_grados=round(degrees(math.atan(lead/(tau*.046))),3),
            mano='izquierda en el marco local del sinfín',dientes_en_arco_activo=round(2*math.acos((tr.CONTACT-.055)/.491)/g.PITCH,2))
        tip=max(hypot(x,y) for x,y,z in wire)
        bed=max(hypot(*p) for p in m.parts['Canal meridiano'].verts)
        crest=max(hypot(*p) for p in m.parts['Crestas meridiano'].verts)
        assert bed+.00299<tr.CONTACT-tip<crest
        assert not relay_counts[0] and phase_error<1e-10
        result['relevo']=dict(muestras_por_numero_engranado=dict(enumerate(relay_counts)),
            interrupcion_polar_mm=2*tr.GAP*g.R*1000,interrupcion_grados=degrees(2*tr.GAP),
            separacion_grados=degrees(abs(tr.ANGLES[0]-tr.ANGLES[1])),
            penetracion_bajo_cresta_mm=round(1000*(crest-tr.CONTACT+tip),3),
            desfase_max_en_pasos=phase_error)
    return result


def audit():
    report=dict(diametro_nominal_mm=1000,pared_mm=12,centro_torre_mm=750,centro_estudio_mm=500,
                pista=dict(posiciones_por_vuelta=g.N,cresta_bajo_gajo_mm=9),
                viabilidad='S: dos sinfines en fase separados por 14 pasos. Los carros se retiran '
                'al aproximarse al asiento polar. Los rodillos sustentan el hombro junto a la banda '
                'en reposo e inversión. Las bolas soportan los gajos durante el giro. C: las dos bandas son estéticas.',
                alcance='Fase angular y holguras por envolventes de los pares enumerados en 288 cuadros. Cada malla de torre y mecanismo se comprueba frente a la esfera y los polos. '
                'Las uniones rígidas de C, los apoyos y el engrane tienen tratamiento específico. No es análisis de carga, '
                'tolerancias de fabricación ni verificación de contacto conjugado de flancos.',
                propuestas={})
    for v in 'SC':
        m=build(v)
        report['propuestas'][v]=verify(m,v)
        if v=='S':
            report['pista']['mediciones']=g.inspect_ridges(m)
    studio=build('S',studio=True)
    assert studio.parts['esfera'].loc==(0,0,.5)
    radii=[hypot(*point) for p in studio.parts.values() if p.name.startswith('Gajo') for point in p.verts]
    assert abs(max(radii)-.5)<1e-8 and abs(min(radii)-.488)<1e-8
    screw=studio.parts['Allen moleteado'].verts
    lip=[hypot(x,y) for x,y,z in screw if abs(z-.509)<1e-8 and hypot(x,y)<.060]
    well=[z for x,y,z in screw if .049<hypot(x,y)<.059]
    report['allen_medido_mm']=dict(diametro=round(2000*max(hypot(x,y) for x,y,z in screw),3),
        altura_sobre_asiento=round(1000*(max(z for x,y,z in screw)-max(z for x,y,z in studio.parts['Junta polar 1'].verts)),3),radio_vertices=round(1000*max(lip),3),profundidad=round(1000*(max(well)-min(well)),3))
    report['tapon_sobre_asiento_mm']=round(1000*(max(q[2] for q in studio.parts['Tapón'].verts)
        -max(q[2] for q in studio.parts['Junta polar -1'].verts)),3)
    report['animacion']=dict(cuadros=tr.FRAMES,fps=24,cierre_final=dict(hojas=.52,telescopio=.12))
    report['pared_medida_mm']=round((max(radii)-min(radii))*1000,6)
    report['triangulos_comparativa']=2*count(studio)+2
    assert report['triangulos_comparativa']<400000
    for v in 'SC':
        cut_count=count(build(v,cut=True))+2
        assert cut_count<400000
        report['propuestas'][v]['triangulos_corte_con_suelo']=cut_count
    return report


COLORS={'acero':(.49,.52,.56,1,.30),'cresta':(.35,.38,.41,1,.22),
        'ranura':(.09,.10,.115,.85,.42),'grafito':(.036,.049,.059,.65,.39),
        'bronce':(.38,.22,.095,.88,.29),'motor':(.075,.082,.088,.73,.33),
        'turquesa':(.025,.32,.34,.73,.32),'naranja':(.87,.26,.035,.50,.32),
        'torre':(.48,.59,.67,.38,.51),'corte':(.095,.14,.17,.55,.39),
        'luz':(.012,.53,.42,.4,.23),'fondo':(.78,.80,.82,0,.65)}


def materials(bpy):
    out={}
    for key,(r,gc,b,metal,rough) in COLORS.items():
        mat=bpy.data.materials.new(key)
        mat.diffuse_color=(r,gc,b,1)
        mat.use_nodes=True
        nodes=mat.node_tree.nodes
        bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        bs.inputs['Base Color'].default_value=mat.diffuse_color
        bs.inputs['Metallic'].default_value=metal
        bs.inputs['Roughness'].default_value=rough
        if key=='acero':
            (bs.inputs.get('Anisotropic IOR Level') or bs.inputs['Anisotropic']).default_value=.52
            tangent=nodes.new('ShaderNodeTangent')
            tangent.direction_type='RADIAL'
            tangent.axis='Z'
            mat.node_tree.links.new(tangent.outputs[0],bs.inputs['Tangent'])
        if key in ('acero','ranura'):
            noise=nodes.new('ShaderNodeTexNoise')
            noise.inputs['Scale'].default_value=240 if key=='acero' else 48
            if key=='acero':
                coords=nodes.new('ShaderNodeTexCoord')
                stretch=nodes.new('ShaderNodeVectorMath')
                stretch.operation='MULTIPLY'
                stretch.inputs[1].default_value=(.12,.12,2.8)
                mat.node_tree.links.new(coords.outputs['Object'],stretch.inputs[0])
                mat.node_tree.links.new(stretch.outputs[0],noise.inputs['Vector'])
            ramp=nodes.new('ShaderNodeValToRGB')
            for stop,d in zip(ramp.color_ramp.elements,(-.065,.065)):
                stop.color=(rough+d,rough+d,rough+d,1)
            mat.node_tree.links.new(noise.outputs['Fac'],ramp.inputs[0])
            mat.node_tree.links.new(ramp.outputs[0],bs.inputs['Roughness'])
        if key=='luz':
            bs.inputs['Emission Color'].default_value=(r,gc,b,1)
            bs.inputs['Emission Strength'].default_value=1.3
        out[key]=mat
    return out


def scene(bpy,m,v,studio):
    import bmesh
    from mathutils import Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc=bpy.context.scene
    try:
        sc.render.engine='BLENDER_EEVEE'
    except TypeError:
        sc.render.engine='BLENDER_EEVEE_NEXT'
    sc.view_settings.view_transform='AgX'
    sc.render.fps=24
    sc.frame_end=tr.FRAMES
    mats=materials(bpy)
    def cut_material(key):
        # El plano de corte en coordenadas de mundo permanece fijo durante el giro.
        coat=mats[key].copy()
        nodes=coat.node_tree.nodes
        links=coat.node_tree.links
        split=nodes.new('ShaderNodeSeparateXYZ')
        links.new(nodes.new('ShaderNodeNewGeometry').outputs['Position'],split.inputs[0])
        mask=nodes.new('ShaderNodeMath')
        mask.operation='GREATER_THAN'
        links.new(split.outputs['X'],mask.inputs[0])
        mask.inputs[1].default_value=0
        blend=nodes.new('ShaderNodeMixShader')
        links.new(mask.outputs[0],blend.inputs[0])
        links.new(next(n for n in nodes if n.type=='BSDF_PRINCIPLED').outputs[0],blend.inputs[1])
        links.new(nodes.new('ShaderNodeBsdfTransparent').outputs[0],blend.inputs[2])
        links.new(blend.outputs[0],next(n for n in nodes if n.type=='OUTPUT_MATERIAL').inputs['Surface'])
        return coat
    clipped={k:cut_material(k) for k in ('acero','cresta','ranura')} if m.cut else {}
    groups={}
    objects={}
    for group in ('esfera','compuerta y telescopio','torre','mecanismo_'+v,'estudio'):
        groups[group]=bpy.data.collections.new(group)
        sc.collection.children.link(groups[group])
    for p in m.parts.values():
        mesh=None
        if p.material:
            mesh=bpy.data.meshes.new(p.name)
            mesh.from_pydata(p.verts,[],p.faces)
            palette=clipped if m.cut and (p.group=='esfera' or p.name.startswith('Pétalo')) else mats
            mesh.materials.append(palette[p.material])
            if p.accents:
                mesh.materials.append(palette['corte' if p.group in ('torre','mecanismo_'+v) else 'ranura'])
                for idx in p.accents:
                    mesh.polygons[idx].material_index=1
            bm=bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0000001)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            for face in bm.faces:
                face.smooth=p.material in ('acero','cresta','torre','ranura') and len(face.verts)<=4
            for edge in bm.edges:
                if edge.is_manifold and edge.calc_face_angle(0)>.52:
                    edge.smooth=False
            bm.to_mesh(mesh)
            bm.free()
            mesh.update()
        obj=bpy.data.objects.new(p.name,mesh)
        groups[p.group].objects.link(obj)
        objects[p.name]=obj
        obj.parent=objects.get(p.parent)
        obj.location=p.loc
        obj.rotation_euler=p.rot
    if not studio:
        for p in m.parts.values():
            samples=[pose(p,tr.state(f,v),v) for f in range(1,tr.FRAMES+1)]
            obj=objects[p.name]
            for index,(path,rest) in enumerate((('location',p.loc),('rotation_euler',p.rot))):
                if any(sample[index]!=rest for sample in samples):
                    for f,sample in enumerate(samples,1):
                        setattr(obj,path,sample[index])
                        obj.keyframe_insert(data_path=path,frame=f)
    world=bpy.data.worlds.new('Estudio difuso')
    sc.world=world
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.76,.82,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.50
    def fixture(name,data,loc):
        obj=bpy.data.objects.new(name,data)
        groups['estudio'].objects.link(obj)
        obj.location=loc
        return obj
    for loc,power,size in [((1,-3,4),460,3),((-3,1,2),330,2.5),((2,3,3),420,2)]:
        lamp=bpy.data.lights.new('Ventana','AREA')
        lamp.energy,lamp.size=power,size
        obj=fixture('Caja de luz',lamp,loc)
        obj.rotation_euler=(Vector((0,0,.5))-obj.location).to_track_quat('-Z','Y').to_euler()
    floor=bpy.data.meshes.new('Suelo')
    floor.from_pydata([(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[],[(0,1,2,3)])
    floor.materials.append(mats['fondo'])
    fixture('Ciclorama',floor,(0,0,-.001 if studio else .054))
    sc.camera=fixture('Cámara',bpy.data.cameras.new('Ortográfica'),(0,0,0))
    sc.camera.data.type='ORTHO'
    sc.render.image_settings.file_format='PNG'
    return sc,objects


def camera(sc,target,direction,width,res):
    from mathutils import Vector
    sc.camera.location=Vector(target)+Vector(direction).normalized()*3
    sc.camera.rotation_euler=(-Vector(direction)).to_track_quat('-Z','Y').to_euler()
    sc.camera.data.ortho_scale=width
    sc.render.resolution_x,sc.render.resolution_y=res
    sc.render.resolution_percentage=100


def render(bpy,sc,dest):
    sc.render.filepath=str(dest)
    bpy.ops.render.render(write_still=True)


BAJADA_BUCLE=.10


def pictures(bpy,args,report):
    d=args.salida
    v=args.mecanismo
    if args.estudio:
        m=build(v,studio=True)
        sc,objects=scene(bpy,m,v,True)
        camera(sc,(.02,-.05,.48),(.16,-1,.49),1.32,(1600,1600))
        render(bpy,sc,d/'estudio_cerrada.png')
        camera(sc,(.02,-.44,.51),(.50,-1,.38),.55,(1600,1600))
        render(bpy,sc,d/'estudio_dientes.png')
        for name,obj in objects.items():
            obj.location,obj.rotation_euler=pose(m.parts[name],(0,0,1,1,0),v)
        from mathutils import Quaternion, Vector
        objects['esfera'].rotation_euler=Quaternion(Vector((1,1,0)).normalized(),radians(-15)).to_euler()
        camera(sc,(.13,-.15,.48),(.16,-1,.49),1.45,(1600,1600))
        render(bpy,sc,d/'estudio_desplegada.png')
        # Copia enlazada de la esfera cerrada para la comparativa solicitada.
        right=Vector((1,.16,0)).normalized()
        shift=right*1.27
        copies={}
        for name,obj in objects.items():
            cp=obj.copy()
            obj.users_collection[0].objects.link(cp)
            copies[name]=cp
            cp.parent=copies.get(m.parts[name].parent)
            cp.location,cp.rotation_euler=pose(m.parts[name],(0,0,0,0,0),v)
        copies['esfera'].location-=shift/2
        objects['esfera'].location+=shift/2
        camera(sc,(.07,-.09,.48),(.16,-1,.49),2.68,(1600,1600))
        render(bpy,sc,d/'estudio_comparativa.png')
        report['triangulos_comparativa']=2*count(m)+2
        assert report['triangulos_comparativa']<400000
    for cut,needed in [(False,args.torre or args.animacion_exterior),(True,args.corte or args.animacion)]:
        if not needed:
            continue
        sc,_=scene(bpy,build(v,cut=cut),v,False)
        camera(sc,(0,0,.64),(1,.54,.18) if cut else (-.39,1,.47),1.80 if cut else 2.22,(1600,1200))
        if not cut and args.torre:
            for f,name in [(1,'reposo'),(132,'uso')]:
                sc.frame_set(f)
                render(bpy,sc,d/f'torre_{name}.png')
        if args.corte and cut:
            sc.frame_set(132)
            render(bpy,sc,d/f'corte_{v}.png')
            camera(sc,(0,0,.67),(1,.03,.06),1.78,(1600,1200))
            render(bpy,sc,d/f'corte_{v}_lateral.png')
            target=(.03,0,.40) if v=='S' else (.29,.27,.72)
            camera(sc,target,(1,.22,.16) if v=='S' else (1,.95,.37),
                   .99 if v=='S' else 1.06,(1600,1200))
            render(bpy,sc,d/f'corte_{v}_detalle.png')
        if (args.animacion if cut else args.animacion_exterior):
            camera(sc,(0,0,.72),(1,.54,.18),2.48,(1280,720))
            folder=d/(f'anim_{v}' if cut else f'anim_{v}_exterior')
            folder.mkdir(exist_ok=True)
            for f in range(args.cuadros[0],args.cuadros[1]+1):
                sc.frame_set(f)
                render(bpy,sc,folder/f'{f:04}.png')
    if args.animacion_bucle:
        # Bucle de presentación: torre entera, sin cortes ni transparencias.
        m=build(v)
        sc,objects=scene(bpy,m,v,False)
        # Presentación: la esfera baja para que la banda ecuatorial quede oculta tras el labio en reposo,
        # y el mecanismo no se dibuja (se intuye, no se ve). Solo afecta a este render, no al control.
        for name,obj in objects.items():
            group=m.parts[name].group
            if group=='mecanismo_'+v:
                obj.hide_render=True
            if obj.parent is None and group!='torre':
                obj.delta_location.z=-BAJADA_BUCLE
        camera(sc,(0,0,.74),(1,.54,.18),2.75,(1280,720))
        folder=d/f'anim_{v}_bucle'
        folder.mkdir(exist_ok=True)
        for f in range(args.cuadros[0],args.cuadros[1]+1):
            sc.frame_set(f)
            render(bpy,sc,folder/f'{f:04}.png')
    if args.animacion_menu:
        # Menú de máquinas: solo la torre va cortada; la esfera se ve entera moviéndose sobre el mecanismo.
        sc,_=scene(bpy,build(v,cut=True,sphere_cut=False),v,False)
        camera(sc,(0,0,.72),(1,.54,.18),2.48,(1280,720))
        folder=d/f'anim_{v}_menu'
        folder.mkdir(exist_ok=True)
        for f in range(args.cuadros[0],args.cuadros[1]+1):
            sc.frame_set(f)
            render(bpy,sc,folder/f'{f:04}.png')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--salida',required=True,type=Path)
    parser.add_argument('--mecanismo',choices=['S','C'],default='S')
    for opt in ('estudio','torre','corte','animacion','animacion-exterior','animacion-menu','animacion-bucle'):
        parser.add_argument('--'+opt,action='store_true')
    parser.add_argument('--cuadros',default='1-288')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else None)
    if not re.fullmatch(r'\d+-\d+',args.cuadros):
        parser.error('Se espera --cuadros A-B')
    args.cuadros=tuple(map(int,args.cuadros.split('-')))
    if args.animacion_bucle:
        tr.usar_bucle()
        if args.cuadros==(1,288):
            args.cuadros=(1,tr.FRAMES-1)  # el último cuadro repite el primero
    if not 1<=args.cuadros[0]<=args.cuadros[1]<=tr.FRAMES:
        parser.error(f'Intervalo fuera de 1-{tr.FRAMES}')
    args.salida=args.salida.resolve()
    args.salida.mkdir(parents=True,exist_ok=True)
    if 'bpy' in sys.modules and not any((args.estudio,args.torre,args.corte,args.animacion,args.animacion_exterior,args.animacion_menu,args.animacion_bucle)):
        args.torre=True
    report=audit()
    if any([args.estudio,args.torre,args.corte,args.animacion,args.animacion_exterior,args.animacion_menu,args.animacion_bucle]):
        import bpy
        pictures(bpy,args,report)
    (args.salida/'reporte.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    main()
