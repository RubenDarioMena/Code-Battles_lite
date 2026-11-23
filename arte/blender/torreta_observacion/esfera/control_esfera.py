"""Control en metros de las envolventes del montaje y de sus contactos."""
from math import cos, hypot, pi
from geometria_esfera import R
import transmision_esfera as tr
from transmision_esfera import Z, state


def dot(a,b):
    return sum(x*y for x,y in zip(a,b))


def revisar(m,variant,pose,rotate):
    meshes=[p for p in m.parts.values() if p.verts and p.group in ('torre','mecanismo_'+variant)]
    bounds={p.name:[(min(q),max(q)) for q in zip(*p.verts)] for p in meshes}
    radial={p.name:max(hypot(x,y) for x,y,z in p.verts) for p in meshes}
    head=max(hypot(*q) for p in m.parts.values() if p.name in ('Allen moleteado','Tapón') for q in p.verts)
    minima={}
    contact={}
    surface=contacto_gajos(m) if variant=="S" else None
    active_min=4
    for frame in range(1,tr.FRAMES+1):
        st=state(frame,variant)
        frames={}
        for p in m.parts.values():
            loc,rot=pose(p,st,variant)
            axes=[rotate(k,rot) for k in ((1,0,0),(0,1,0),(0,0,1))]
            if p.parent:
                o,basis=frames[p.parent]
                rows=list(zip(*basis))
                loc=tuple(o[i]+dot(row,loc) for i,row in enumerate(rows))
                axes=[tuple(dot(row,k) for row in rows) for k in axes]
            frames[p.name]=loc,axes
        _,sphere=frames['esfera']
        active=0
        for p in meshes:
            n=p.name
            o,axes=frames[n]
            delta=(-o[0],-o[1],Z-o[2])
            c=[dot(delta,k) for k in axes]
            box=bounds[n]
            dist=[max(0,lo-q,q-hi) for (lo,hi),q in zip(box,c)]
            # Intersección de caja y cilindro circunscritos, en el marco local.
            radius=max(hypot(*dist),hypot(max(0,hypot(*c[:2])-radial[n]),dist[2]))
            if n.startswith(('Fuste','Labio','Junta inferior','Anillo exterior')):
                inn=min(hypot(x,y) for x,y,z in p.verts)
                if n=='Fuste':
                    inn=.631  # el fondo del fuste está a z <= .075
                radius=max(radius,inn*cos(pi/(96 if n=='Anillo exterior' else 128)))
            # Los dos salientes polares caben en casquetes de radio transversal
            # 115 mm y arrancan a 477 mm. Proyectar sobre los ejes de la esfera.
            intervals=[]
            for direction in sphere:
                proj=[dot(k,direction) for k in axes]
                ends=[sorted((a*(lo-q),a*(hi-q))) for a,(lo,hi),q in zip(proj,box,c)]
                spread=radial[n]*hypot(*proj[:2])
                center=-dot(proj[:2],c[:2])
                intervals.append((max(sum(t[0] for t in ends),center+ends[2][0]-spread),
                                  min(sum(t[1] for t in ends),center+ends[2][1]+spread)))
            dxy=hypot(*(max(0,lo,-hi) for lo,hi in intervals[:2]))
            cap=max(radius-head,hypot(max(0,dxy-.115),
                    max(0,.477-max(abs(q) for q in intervals[2]))))
            gap=min(radius-R,cap)
            if n.startswith(('Rueda de apoyo','Bola de transferencia')):
                if n.startswith('Bola'):
                    shell=hypot(*delta)-radial[n]-R
                else:
                    vertex=min(p.verts,key=lambda q:(q[0]-c[0])**2+(q[1]-c[1])**2+(q[2]-c[2])**2)
                    tip=tuple(sum(axis[j]*q for axis,q in zip(axes,vertex))-delta[j] for j in range(3))
                    shell=hypot(*tip)-R
                if n.startswith('Bola'):
                    tip=tuple(-k for k in delta)
                direction=tuple(dot(tip,k)/hypot(*tip) for k in sphere)
                clearance=surface(direction)+shell
                if n.startswith('Bola') and clearance<=.001:
                    active+=1
                if frame in (1,tr.KEYS[4][0]):  # reposo y primer cuadro en uso
                    assert abs(clearance)<.001,(n,frame,clearance)
                    contact[n]=round(1000*max(clearance,contact.get(n,0)/1000),4)
                gap=cap
            elif n.startswith(('Hélice meridiana','Núcleo meridiana')):
                # El sinfín cabe en el canal X y puede atravesar la cota
                # nominal hasta el fondo de pista. Los polos se miden aparte.
                lateral=.061-max(abs(q) for q in intervals[0])
                gap=min(max(radius-R,lateral),radius-.471,cap)
            elif n.startswith('Eje X'):
                # Unión rígida de C a la esfera, fuera del barrido polar.
                contact[n]='unión rígida'
                gap=cap
            minima[n]=min(minima.get(n,1),gap)
        if surface:
            active_min=min(active_min,active)
            assert active>=2,(frame,active)
    return dict(bolas_en_contacto_min=active_min if surface else None,libres_mm={n:round(q*1000,4) for n,q in minima.items()},
                contactos_reposo_uso_mm=contact)


def contacto_gajos(m):
    """Intersección radial con caras trianguladas, incluidas las juntas y el hueco."""
    cells={}
    def cell(q):
        return int((q+R)*40)
    for p in m.parts.values():
        if not p.name.startswith('Gajo'):
            continue
        for face in p.faces:
            points=[p.verts[i] for i in face]
            if min(hypot(*q) for q in points)<R-1e-6:
                continue
            for j in range(1,len(points)-1):
                a,b,c=points[0],points[j],points[j+1]
                u=tuple(y-x for x,y in zip(a,b))
                v=tuple(y-x for x,y in zip(a,c))
                normal=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
                uu,uv,vv=dot(u,u),dot(u,v),dot(v,v)
                tri=(a,u,v,normal,dot(a,normal),uu,uv,vv,uu*vv-uv*uv)
                bounds=[range(cell(min(k)-.001),cell(max(k)+.001)+1) for k in zip(a,b,c)]
                for x in bounds[0]:
                    for y in bounds[1]:
                        for z in bounds[2]:
                            cells.setdefault((x,y,z),[]).append(tri)
    def gap(direction):
        key=tuple(cell(R*k) for k in direction)
        for a,u,v,n,h,uu,uv,vv,det in cells.get(key,[]):
            div=dot(direction,n)
            if abs(div)<1e-14:
                continue
            r=h/div
            d=tuple(r*k-o for k,o in zip(direction,a))
            du,dv=dot(d,u),dot(d,v)
            s,t=(vv*du-uv*dv)/det,(uu*dv-uv*du)/det
            if s>=-1e-8 and t>=-1e-8 and s+t<=1+1e-8:
                return R-r
        return float('inf')
    return gap
