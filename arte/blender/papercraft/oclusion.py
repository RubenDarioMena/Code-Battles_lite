"""Muestreo de contacto contra las caras reales y las diez mallas colocadas."""
from comun import *
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt
from collections import defaultdict

def arbol(caras):
    vertices=[]; indices=[]
    for pol,_,_ in caras:
        indices.append(range(len(vertices),len(vertices)+len(pol)))
        vertices.extend(pol)
    return BVHTree.FromPolygons(vertices,indices)

def preparar(paisaje):
    from kit import piezas
    terreno=paisaje.p.caras
    suelo=arbol(terreno)
    formas={p.nombre:p for p in piezas()}
    escena=list(terreno)
    muestras=defaultdict(list)
    def muestra(x,y):
        punto,normal,i,_=suelo.ray_cast((x,y,60),(0,0,-1))
        if punto and abs(normal.z)>.99 and len(terreno[i][0])==3:
            muestras[i].append(Vector((x,y)))
    for sitio in paisaje.colocaciones:
        x,y,z=(sitio[k] for k in ('x','y','z'))
        a=sitio['giro']; e=sitio['escala']; nombre=sitio['pieza']
        c,s=math.cos(a)*e,math.sin(a)*e
        forma=formas[nombre]
        for pol,mat,tono in forma.caras:
            escena.append(([(x+c*u-s*v,y+s*u+c*v,z+e*w) for u,v,w in pol],mat,tono))
        radio=max(abs(v[0]) for pol,_,_ in forma.caras for v in pol)*e
        muestra(x,y)
        for k in range(5):
            t=k*math.tau/5+a
            muestra(x+radio*1.55*math.cos(t),y+radio*1.55*math.sin(t))
    for pol,z,_ in paisaje.capas:
        for i,(x,y) in enumerate(pol):
            if i%3: continue
            u,v=pol[(i+1)%len(pol)]
            l=math.hypot(u-x,v-y)
            if l<.2: continue
            for d in [-1.1,-.12,.12,1.1]:
                muestra((x+u)/2+d*(v-y)/l,(y+v)/2-d*(u-x)/l)
    bvh=arbol(escena)
    nuevas=[]
    for i,(pol,mat,tono) in enumerate(terreno):
        if i not in muestras:
            nuevas.append((pol,mat,tono));continue
        pts=[Vector(v[:2]) for v in pol]+muestras[i]
        vs,_,fs,*_=delaunay_2d_cdt(pts,[],[[0,1,2]],1,1e-6)
        for ids in fs:
            nuevas.append(([(vs[j].x,vs[j].y,pol[0][2]) for j in ids],mat,tono))
    paisaje.p.caras=nuevas
    return bvh

def hornear(obj,bvh,intensidad=1):
    mesh=obj.data
    col=mesh.color_attributes['COLOR_0']
    base=mesh.color_attributes['COLOR_1']
    rayos=[Vector((math.cos(i*2.4)*math.sqrt(1-z*z),math.sin(i*2.4)*math.sqrt(1-z*z),z))
           for i in range(16) for z in [(.5+i)/16]]
    cache={}
    for v in mesh.vertices:
        x,y,z=v.co; clave=(round(x,4),round(y,4),round(z,4))
        if clave not in cache:
            total=0
            for r in rayos:
                _,_,cara,d=bvh.ray_cast((x,-y,z+.028),r,2.8)
                if cara is not None: total+=1-d/2.8
            cache[clave]=1-intensidad*min(.46,.8*total/len(rayos))
        col.data[v.index].color=tuple(c*cache[clave] for c in base.data[v.index].color[:3])+(1,)
