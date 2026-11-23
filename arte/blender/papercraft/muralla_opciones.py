"""Veinte siluetas de cartulina para comparar el perímetro inicial."""
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path("arte/blender/papercraft").resolve()))
from comun import BASE, Papel, Vector, bpy, math, material, exportar
from kit import pieza_horneada
from previas import estudio, quitar_comentarios

PIEDRA='sillar'
METAL='tinta'
PAPEL='alma'

def bloque(p,x,y,z,w,d,h,tinte):
    perfil(p,x,y,d,[(0,z),(w,z),(w,z+h),(0,z+h)],tinte,centrar=w/2)

def perfil(p,x,y,fondo,contorno,tinte,centrar=0):
    # Sección en el plano XZ extruida a ambos lados.
    a=[(x+u-centrar,y-fondo/2,h) for u,h in contorno]
    b=[(u,y+fondo/2,h) for u,_,h in a]
    p.cara(a,tinte);p.cara(b[::-1],tinte)
    for i in range(len(a)):
        j=(i+1)%len(a)
        p.cara([a[i],b[i],b[j],a[j]],tinte,.96 if j%2 else 1)

def viga(p,a,b,grosor,tinte):
    a,b=Vector(a),Vector(b); eje=(b-a).normalized()
    normal=Vector((0,1,0)) if abs(eje.y)<.9 else Vector((1,0,0))
    u=eje.cross(normal).normalized()*grosor/2
    v=eje.cross(u).normalized()*grosor/2
    anillos=[[tuple(c+s*u+t*v) for s,t in [(-1,-1),(1,-1),(1,1),(-1,1)]] for c in [a,b]]
    bajo,alto=anillos
    p.cara(bajo[::-1],tinte);p.cara(alto,tinte)
    for i in range(4):p.cara([bajo[i],bajo[(i+1)%4],alto[(i+1)%4],alto[i]],tinte)

def cabina(p,x,y,z,w,d,h):
    bloque(p,x,y,z,w,d,h,'pizarra')
    bloque(p,x,y,z+h*.38,w*1.015,d*1.018,h*.36,'sombra')
    bloque(p,x,y,z+h,w*1.13,d*1.16,.24,PAPEL)

def gavion(p,n):
    filas=4 if n else 3
    for k in range(filas):
        for j in range(2):
            x=(j-.5)*3.5; z=k*2.5; d=7-k*1.15
            bloque(p,x,0,z,3.47,d,2.49,'tierra')
            for u in [-1.13,0,1.13]:
                bloque(p,x+u,0,z,.085,d+.08,2.49,'pizarra')
            for h in [.6,1.26,1.91]:
                bloque(p,x,0,z+h,3.49,d+.06,.06,'pizarra')
    if n:cabina(p,0,0,10,4.1,2.7,2.4)

def placas(p,n):
    for i in range(3):
        x=(i-1)*2.33
        # Sección transversal en T invertida.
        antes=len(p.caras)
        perfil(p,0,0,2.17,[(-1.95,0),(1.95,0),(1.95,.65),(.48,1.6),(.34,9),(-.34,9),(-.48,1.6),(-1.95,.65)],'piedra')
        for j in range(antes,len(p.caras)):
            vs,t,c=p.caras[j];p.caras[j]=([(x+y,-u,z) for u,y,z in vs],t,c)
    if n:cabina(p,0,0,9,6.2,2.8,3)

def traba(p,n):
    filas=5 if n else 3
    for k in range(filas):
        cortes=[-3.5,-1.75,1.75,3.5] if k%2 else [-3.5,0,3.5]
        for a,b in zip(cortes,cortes[1:]):
            d=3.2 if not n or k%2 else 5.6
            bloque(p,(a+b)/2,0,k*2.4,b-a-.055,d,2.36,'dovela' if k%2 else PIEDRA)
    for x in [-2.65,-.9,.9,2.65]:
        for y in [-.78,.78]:bloque(p,x,y,filas*2.4-.04,.87,.85,.39,'caliza')

def carga(p,n):
    for k in range(4 if n else 3):
        w=7 if not n or k%2 else 5.8
        x=.9 if n and k==3 else 0
        z=k*2.7
        bloque(p,x,0,z,w,3.3,2.65,'oliva' if k%2 else 'musgo')
        for j in range(7):
            bloque(p,x+(j-3)*w/8,0,z+.16,.12,3.47,2.31,'oliva')
        for h in [.03,2.48]:bloque(p,x,0,z+h,w+.04,3.48,.15,METAL)
    if n:
        bloque(p,-1.35,0,10.8,5.7,3.5,2.1,'oliva')
        for j in range(5):bloque(p,-3.4+j,0,10.9,.16,3.62,1.9,'pizarra')

def costillas(p,n):
    bloque(p,0,-.87,0,7,1.08,8,PIEDRA)
    for x in [-2.65,0,2.65] if not n else [-2.6,2.6]:
        antes=len(p.caras)
        perfil(p,0,0,.67,[(-1.5,0),(3.6,0),(3.6,.65),(-.15,10 if n else 8),(-1.5,10 if n else 8)],'piedra')
        for j in range(antes,len(p.caras)):
            vs,t,c=p.caras[j];p.caras[j]=([(x+y,-u,z) for u,y,z in vs],t,c)
    if n:cabina(p,0,0,8,5.5,3.5,1.8)

def talud(p,n):
    antes=len(p.caras)
    perfil(p,0,0,7,[(-5,0),(5,0),(5,1.8),(1.3,5.7),(-1.8,5.7),(-5,2.5)],'tierra')
    for j in range(antes,len(p.caras)):
        vs,t,c=p.caras[j];p.caras[j]=([(y,-x,z) for x,y,z in vs],t,c)
    bloque(p,0,4.94,0,7,.22,2.6,PIEDRA)
    bloque(p,0,.22,5.7,7,3.15,.15,'oliva')
    if n:
        cabina(p,0,0,5.85,5.7,3.2,1.65)
        bloque(p,-1.6,0,7.74,.24,.24,2.2,METAL)

def cordon(p,n):
    pisos=7 if n else 12
    for k in range(pisos):
        z=k*.8
        if n:
            pts=[(3.45*math.cos(i*math.tau/12),2.55*math.sin(i*math.tau/12)) for i in range(12)]
            interior=[(.77*x,.77*y) for x,y in pts]
        else:
            pts=[(-3.5+i,.85*math.sin(i*math.pi/3.5)) for i in range(8)]
            interior=[(x,y-1.05) for x,y in pts]
        for i in range(len(pts) if n else len(pts)-1):
            j=(i+1)%len(pts)
            for linea,signo in [(pts,1),(interior,-1)]:
                a,b=linea[i],linea[j]
                def labio(v):return (v[0]*(1.035 if n else 1),v[1]+(.12*signo if not n else v[1]*.06*signo),z+.19)
                p.cara([(*a,z),(*b,z),labio(b),labio(a)],'dovela')
                p.cara([labio(a),labio(b),(*b,z+.8),(*a,z+.8)],'piedra')
            if k==pisos-1:p.cara([(*pts[i],z+.8),(*pts[j],z+.8),(*interior[j],z+.8),(*interior[i],z+.8)],PAPEL)
        if not n:
            for i in [0,-1]:p.cara([(*pts[i],z),(*interior[i],z),(*interior[i],z+.8),(*pts[i],z+.8)],'piedra')

def pliegue(p,n):
    for i in range(10):
        x=-3.5+i*.7;y=.39*(-1)**i
        p.cara([(x,y,0),(x+.7,-y,0),(x+.7,-y,7.4),(x,y,7.4)],'oliva')
    for x in [-3.32,0,3.32]:
        bloque(p,x,0,0,.33,1.25,8,METAL)
        bloque(p,x,0,0,.93,2,.45,PIEDRA)
    bloque(p,0,0,7.65,7,1.1,.29,METAL)
    if n:
        for x in [-3.1,3.1]:bloque(p,x,0,8,.24,.24,2.9+.25*x,METAL)
        perfil(p,0,0,4,[(-3.6,10),(3.6,11.8),(3.6,12.1),(-3.6,10.3)],'pizarra')

def fabrica(p,n):
    for i in [-1,1]:
        x=i*1.75
        bloque(p,x,0,0,3.5,2.25,7,'arcilla')
        for h in range(1,8):bloque(p,x,1.13,h*.82,3.45,.035,.035,'tierra')
        perfil(p,x,0,2.25,[(-1.75,7),(1.75,7),(1.75,9.3)],'sillar')
        viga(p,(x-1.75,0,7),(x+1.75,0,9.3),.22,METAL)
    for x in [-3.36,0,3.36]:bloque(p,x,0,0,.27,2.45,7.14,'caliza')
    if n:
        cabina(p,0,0,9.3,5,3,1.7)
        perfil(p,0,0,3.65,[(-3,11.22),(3,11.22),(3,13.15)],'pizarra')

def ronda(p,n):
    h=8 if n else 6
    for x in [-2.9,2.9]:
        for y in [-1.35,1.35]:viga(p,(x,y,0),(x*.8,y*.65,h),.42,PIEDRA)
    for y in [-1.23,1.23]:
        viga(p,(-2.8,y,.5),(2.34,y*.72,h-.2),.22,METAL)
    bloque(p,0,0,h,7,3.5,.55,PIEDRA)
    if n:cabina(p,0,0,h+.55,5.8,3.2,3.6)
    else:
        for y in [-1.59,1.59]:
            for x in [-3.33,-1.11,1.11,3.33]:bloque(p,x,y,h+.55,.13,.13,1.23,METAL)
            bloque(p,0,y,h+1.75,7,.18,.13,METAL)

def generar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mat=material(); cam=estudio()
    cam.data.type='ORTHO';cam.data.ortho_scale=125
    eje=Vector((.38,-1,.42)).normalized()
    rot=(-eje).to_track_quat('-Z','Y'); cam.rotation_euler=rot.to_euler();cam.location=eje*145
    derecha=rot@Vector((1,0,0));arriba=rot@Vector((0,1,0))
    rotulo=bpy.data.materials.new("Marfil de imprenta");rotulo.use_nodes=True
    emisor=rotulo.node_tree.nodes.new("ShaderNodeEmission");emisor.inputs[0].default_value=(1,.95,.82,1)
    rotulo.node_tree.links.new(emisor.outputs[0],rotulo.node_tree.nodes.get("Material Output").inputs[0])
    nombres=[linea.split('**')[1] for linea in (BASE/'MURALLA-OPCIONES.md').read_text().splitlines()]
    for i,crear in enumerate([gavion,placas,traba,carga,costillas,talud,cordon,pliegue,fabrica,ronda]):
        pos=derecha*((i%5-2)*25)+arriba*((.5-i//5)*25-7)
        for n in [False,True]:
            nombre=f'opcion-{i+1:02}-'+('nudo' if n else 'tramo')
            p=Papel(nombre);crear(p,n)
            vs=[v for pol,_,_ in p.caras for v in pol]
            xmin,ymin,zmin=map(min,zip(*vs));xmax,ymax,zmax=map(max,zip(*vs))
            p.caras=[([((x-(xmin+xmax)/2)*7/(xmax-xmin),y-(ymin+ymax)/2,(z-zmin)*(16 if n else 10.5)/(zmax-zmin)) for x,y,z in pol],t,c) for pol,t,c in p.caras]
            obj=pieza_horneada(p,mat)
            exportar(obj,BASE/'glb/muralla'/(nombre+'.glb'))
            obj.location=pos if n else pos+Vector((-7,0,0))
            if not n:
                otro=obj.copy();bpy.context.collection.objects.link(otro);otro.location=pos+Vector((7,0,0))
        fuente=bpy.data.curves.new('Rótulo','FONT');fuente.body=f'{i+1:02}   '+nombres[i]
        fuente.materials.append(rotulo);fuente.size=1.78;fuente.align_x='CENTER'
        obj=bpy.data.objects.new('Nombre',fuente);bpy.context.collection.objects.link(obj)
        obj.rotation_euler=rot.to_euler();obj.location=pos-arriba*3.9+eje*7
    esc=bpy.context.scene
    esc.render.resolution_x=960;esc.render.resolution_y=400;esc.render.resolution_percentage=100
    cam.data.sensor_fit='HORIZONTAL'
    ruta=BASE/'previas/muralla-opciones.jpg';esc.render.filepath=str(ruta)
    bpy.ops.render.render(write_still=True);quitar_comentarios(ruta)

if __name__=='__main__':generar()
