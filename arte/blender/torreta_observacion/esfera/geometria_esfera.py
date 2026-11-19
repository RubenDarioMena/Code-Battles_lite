"""Mallas en metros y coordenadas locales. No requiere bpy."""
from math import acos, asin, atan2, cos, floor, hypot, pi, sin, sqrt, tan, radians, tau

R = .5
N = 56
PITCH = tau / N
SKEW = radians(32)
POLAR = acos(.125 / R)
HALF = asin(.065 / R)
LON, LAT = radians(-32), -pi/4
H, W = .234, .390


def mix(a, b, t):
    return a + (b-a)*t


def xyz(lon, lat, r):
    return (r*cos(lat)*cos(lon), r*cos(lat)*sin(lon), r*sin(lat))


class Part:
    def __init__(self, name, parent, group, material, loc, rot):
        self.name, self.parent, self.group, self.material = name, parent, group, material
        self.loc, self.rot = loc, rot
        self.verts, self.faces, self.accents = [], [], []


class Model:
    def __init__(self):
        self.parts = {}
        self.group = 'esfera'

    def part(self, name, parent=None, mat=None, loc=(0,0,0), rot=(0,0,0)):
        assert name not in self.parts, name
        p = Part(name, parent, self.group, mat, loc, rot)
        self.parts[name] = p
        return p


def grid(p, nu, nv, fn, wrap_u=False, wrap_v=False):
    """Rejilla con costuras soldadas y descarte de caras colapsadas por recorte."""
    indices, cache = {}, {}
    for j in range(nv + (not wrap_v)):
        for i in range(nu + (not wrap_u)):
            v = tuple(round(x, 10) for x in fn(i/nu, j/nv))
            if v not in cache:
                cache[v] = len(p.verts)
                p.verts.append(v)
            indices[i,j] = cache[v]
    for j in range(nv):
        for i in range(nu):
            ii = (i+1)%nu if wrap_u else i+1
            jj = (j+1)%nv if wrap_v else j+1
            face = tuple(dict.fromkeys(indices[k] for k in ((i,j),(ii,j),(ii,jj),(i,jj))))
            if len(face) >= 3:
                p.faces.append(face)


def lathe(p, profile, n=96, sector=(0,tau)):
    # Perfil recorrido desde el exterior inferior hacia el superior.
    def point(u,v):
        r,z = profile[round(v*len(profile)) % len(profile)]
        a = mix(*sector,u)
        return (r*cos(a),r*sin(a),z)
    full = sector == (0,tau)
    grid(p,n,len(profile),point,full,True)
    if not full:
        for u in (0,1):
            face = [len(p.verts)+i for i in range(len(profile))]
            p.verts.extend(point(u,i/len(profile)) for i in range(len(profile)))
            p.accents.append(len(p.faces))
            p.faces.append(tuple(reversed(face)) if u else tuple(face))
    return p


def tube(m, name, parent, mat, ri, ro, lo, hi, **kw):
    b = min(.0012,(ro-ri)/4,(hi-lo)/4)
    profile = [(ro-b,lo),(ro,lo+b),(ro,hi-b),(ro-b,hi),(ri,hi),(ri,lo)]
    return lathe(m.part(name,parent,mat,**kw),profile)


def panel(p, bounds, offset=(0,0,0)):
    def pos(u,v,r):
        a,b = bounds(u,v)
        return tuple(q-o for q,o in zip(xyz(a,b,r),offset))
    for r, flip in ((R,False),(.488,True)):
        grid(p,32,20,lambda u,v:pos(1-u if flip else u,v,r))
    for edge in (0,1):
        grid(p,32,1,lambda u,v:pos(1-u if edge else u,edge,mix(.488,R,v)))
        grid(p,20,1,lambda u,v:pos(edge,u if edge else 1-u,mix(.488,R,v)))


def shell(m):
    bottom,top = LAT-H,LAT+H
    for half in range(2):
        for row,(lo,hi) in enumerate(((-POLAR,bottom),(bottom,top),(top,-HALF),(HALF,POLAR))):
            def limits(b):
                edge = acos(.065/(R*cos(b)))
                return (half*pi-edge,half*pi+edge)
            def panel_bounds(u,v):
                b = mix(lo,hi,v)
                return (mix(*limits(b),u),b)
            p = m.part(f'Gajo {half}.{row}','esfera','acero')
            if half==0 and row==1:
                for side in (-1,1):
                    def split(u,v):
                        b=mix(lo,hi,v)
                        left,right=limits(b)
                        a = mix(left,LON-W,u) if side<0 else mix(LON+W,right,u)
                        return a,b
                    panel(p,split)
            else:
                panel(p,panel_bounds)


def dist_angle(points,mer):
    # Evita tapas reducidas a una recta sobre el límite del recorte.
    angles=[atan2(z,y) if mer else atan2(y,x) for x,y,z in points]
    return max(angles)-min(angles)


def bands(m):
    # El mismo desarrollo angular se usa en ambos grandes círculos.
    # El recorte se hace por columna transversal, incluso para crestas parciales.
    for mer in (False,True):
        ridge=m.part('Crestas '+('meridiano' if mer else 'ecuador'),'esfera','cresta')
        bed=m.part('Canal '+('meridiano' if mer else 'ecuador'),'esfera','ranura')
        def point(a,s,r):
            q=xyz(a,asin(s/R),r)
            return (q[2],q[0],q[1]) if mer else q
        def spans(s):
            if mer:
                a=asin(sin(POLAR)/sqrt(1-(s/R)**2))
                return [(-a,a),(pi-a,pi+a)]
            a=asin(.065/(R*sqrt(1-(s/R)**2)))
            return [(-pi/2+a,pi/2-a),(pi/2+a,3*pi/2-a)]
        # Fondo y flancos hasta el canto de los paños.
        profile=[(-.065,.471),(.065,.471),(.065,.465),(-.065,.465)]
        for span in (0,1):
            def floorpoint(u,v):
                s,r=profile[round(v*4)%4]
                return point(mix(*spans(s)[span],u),s,r)
            grid(bed,128,4,floorpoint,False,True)
            for tooth in range(-N//2,N+1):
                center=tooth*PITCH
                if not any(lo-.26<center<hi+.26 for lo,hi in [spans(0)[span]]):
                    continue
                # Sección con flancos pronunciados y cresta redondeada.
                section=[(-.28,.470),(-.26,.480),(-.22,.488),(-.15,.490),
                         (0,.491),(.15,.490),(.22,.488),(.26,.480),(.28,.470)]
                def crest(u,v):
                    s=mix(-.061,.061,u)
                    f,r=section[round(v*len(section))%len(section)]
                    a=center-s/(R*tan(SKEW))+f*PITCH
                    lo,hi=spans(s)[span]
                    return point(max(lo,min(hi,a)),s,r)
                # Omit cells wholly outside window; otherwise clamping would
                # stack curved slivers against the edge of the polar seat.
                for u in (0,1):
                    end=[crest(u,k/len(section)) for k in range(len(section))]
                    if len(set(end))>3 and dist_angle(end,mer)>1e-7:
                        start=len(ridge.verts)
                        ridge.verts.extend(end)
                        ridge.faces.append(tuple(range(start,start+len(end))))
                for i in range(12):
                    ss=[mix(-.061,.061,k/12) for k in (i,i+1)]
                    if all(center-s/(R*tan(SKEW))+.28*PITCH<spans(s)[span][0] for s in ss):
                        continue
                    if all(center-s/(R*tan(SKEW))-.28*PITCH>spans(s)[span][1] for s in ss):
                        continue
                    grid(ridge,1,len(section),lambda u,v:crest((i+u)/12,v),False,True)


def poles(m):
    for sign in (-1,1):
        parent=m.part('Asiento '+str(sign),'esfera',rot=(0 if sign==1 else pi,0,0)).name
        lathe(m.part('Junta polar '+str(sign),parent,'ranura'),
              [(.125,.477),(.125,.484),(.122,.485),(.117,.485),(.115,.479),(.064,.474)])
        if sign<0:
            lathe(m.part('Tapón',parent,'acero'),[(.115,.477),(.115,.485),(.111,.492),(.108,.495),(0,.503),(0,.477)])
            continue
        p=m.part('Allen moleteado',parent,'cresta')
        count=384
        profile_count=12
        def screw(u,v):
            a=u*tau
            hex_r=.058*cos(pi/6)/cos((a%(pi/3))-pi/6)
            knurl=.11435+(round(u*count)%2)*.00065
            return [(r*cos(a),r*sin(a),z) for r,z in
                    [(.112,.478),(knurl,.484),(knurl,.505),(.114,.5075),
                     (.1125,.5093),(.110,.510),(.062,.510),(hex_r,.509),
                     (hex_r,.463),(0,.463),(0,.459),(.072,.459)]][round(v*profile_count)%profile_count]
        grid(p,count,profile_count,screw,True,True)
        p.accents.extend(range(7*count,9*count))


def aperture(m):
    m.group='compuerta y telescopio'
    for sign,key in ((-1,'i'),(1,'d')):
        a=LON+sign*(W-.032)
        origin=xyz(a,LAT,.499)
        # Eje local Y tangente al meridiano, X tangente al paralelo.
        mount=m.part('Bisagra '+key,'esfera',loc=origin,rot=(pi/2-LAT,0,a+pi/2))
        # Para X tangencial e Y hacia el norte la rotación X es pi/2 - lat.
        hinge=m.part('hoja_'+key,mount.name)
        leaf=m.part('Pétalo '+key,hinge.name,'acero')
        def bounds(u,v):
            left,right=(a,LON-.019) if sign<0 else (LON+.019,a)
            return mix(left,right,u),mix(LAT-H+.016,LAT+H-.016,v)
        # Cuatro perfiles concéntricos dejan dos chaflanes alrededor del canto.
        def surface(u,v,r,inset):
            lon,lat=bounds(mix(inset,1-inset,u),mix(inset,1-inset,v))
            return tuple(x-y for x,y in zip(xyz(lon,lat,r),origin))
        profile=[(.5,.024),(.497,0),(.479,0),(.476,.024)]
        for r,k in (profile[0],profile[-1]):
            grid(leaf,16,12,lambda u,v:surface(u,v,r,k))
        for (r,k),(rr,kk) in zip(profile,profile[1:]):
            for side in (0,1):
                grid(leaf,16,1,lambda u,t:surface(u,side,mix(r,rr,t),mix(k,kk,t)))
                grid(leaf,12,1,lambda v,t:surface(side,v,mix(r,rr,t),mix(k,kk,t)))
        # Deshacer la orientación de la bisagra en los vértices de la hoja.
        sa,ca=sin(a),cos(a)
        east=(-sa,ca,0)
        north=(-sin(LAT)*ca,-sin(LAT)*sa,cos(LAT))
        normal=xyz(a,LAT,1)
        leaf.verts=[tuple(sum(x*y for x,y in zip(v,k)) for k in (east,north,normal))
                    for v in leaf.verts]
        tube(m,'Pasador '+key,hinge.name,'grafito',.001,.003,-.035,.035,rot=(pi/2,0,0))
    # Embudo opaco desde el reverso del recorte hasta el casquillo radial.
    # El perfil vuelve por detrás del reborde para darle espesor al canto.
    throat=m.part('Revestimiento de la abertura','esfera','grafito')
    axis=xyz(LON,LAT,1)
    east=(-sin(LON),cos(LON),0)
    north=(-sin(LAT)*cos(LON),-sin(LAT)*sin(LON),cos(LAT))
    def funnel(u,v):
        a=tau*u
        scale=max(abs(cos(a)),abs(sin(a)))
        j=round(v*4)%4
        if j in (0,1):
            margin=(.015 if j==0 else -.006)
            return xyz(LON+(W+margin)*cos(a)/scale,LAT+(H+margin)*sin(a)/scale,
                       .4885 if j==0 else .478)
        radius=.094 if j==2 else .100
        depth=.450 if j==2 else .446
        return tuple(depth*k+radius*(cos(a)*e+sin(a)*n) for k,e,n in zip(axis,east,north))
    grid(throat,96,4,funnel,True,True)
    radial=m.part('Guía radial','esfera',rot=(0,pi/2-LAT,LON)).name
    tube(m,'Casquillo del observador',radial,'grafito',.091,.099,.316,.465)
    for i in range(4):
        name='telescopio_'+str(i+1)
        m.part(name,radial)
        r=.085-i*.014
        sleeve=tube(m,'Camisa '+str(i+1),name,'cresta',r-.005,r,.313,.451+i*.002)
        sleeve.accents.extend(range(4*96,5*96))
        tube(m,'Collar '+str(i+1),name,'grafito',r-.005,r+.002,.443+i*.002,.449+i*.002)
        radial=name
    tube(m,'Aro de estado',radial,'luz',.038,.044,.457,.458)


def inspect_ridges(m):
    """Mide las nubes de vértices de las dos pistas en un tramo sin recortes."""
    result={}
    for mer in (False,True):
        label='meridiano' if mer else 'ecuador'
        p=m.parts['Crestas '+label]
        by_side={}
        for v in p.verts:
            x,y,z=(v[1],v[2],v[0]) if mer else v
            r=sqrt(x*x+y*y+z*z)
            s=round(z*R/r,5)
            if abs(r-.491)<1e-8 and abs(s)<=.01018:
                a=atan2(y,x)
                if -.9<a<.9:
                    by_side.setdefault(s,set()).add(round(a,8))
        centers=sorted(by_side[0.])
        steps=[b-a for a,b in zip(centers,centers[1:])]
        assert len(steps)>8 and max(abs(d-PITCH) for d in steps)<1e-7
        nearest=lambda side:min(by_side[side],key=abs)
        shift=nearest(min(by_side))-nearest(max(by_side))
        angle=atan2(.122/6,R*shift)
        bed=m.parts['Canal '+label].verts
        coord=0 if mer else 2
        widths=[v[coord]*R/hypot(*v) for v in bed]
        result[label]=dict(posiciones=round(tau/steps[0]),paso_mm=R*steps[0]*1000,
            ancho_mm=1000*(max(widths)-min(widths)),
            relieve_mm=1000*(max(hypot(*v) for v in p.verts)-max(hypot(*v) for v in bed)),
            inclinacion_grados=angle*180/pi)
        assert abs(angle-SKEW)<1e-6
    return result


def inspect_door(m,door,extension):
    """Cotas por cara contra el borde del hueco, la otra hoja y cada camisa.
    La segunda hoja es la reflexión de la primera en el plano radial central.
    """
    p=m.parts['Pétalo i']
    mount=m.parts['Bisagra i']
    a=LON-W+.032
    east=(-sin(a),cos(a),0)
    north=(-sin(LAT)*cos(a),-sin(LAT)*sin(a),cos(LAT))
    axis=xyz(LON,LAT,1)
    normal=xyz(a,LAT,1)
    theta=-radians(100)*door
    lo,hi=LAT-H,LAT+H
    samples=[]
    seam=float('inf')
    for x,y,z in p.verts:
        u,w=cos(theta)*x+sin(theta)*z,-sin(theta)*x+cos(theta)*z
        X,Y,Z=(mount.loc[i]+u*east[i]+y*north[i]+w*normal[i] for i in range(3))
        rho=hypot(X,Y)
        r=hypot(rho,Z)
        side=X*sin(LON)-Y*cos(LON)
        seam=min(seam,2*side)
        axial=X*axis[0]+Y*axis[1]+Z*axis[2]
        # side es una proyección lineal y una cota inferior de distancia al eje.
        port=min(Y*cos(LON-W)-X*sin(LON-W),X*sin(LON+W)-Y*cos(LON+W),
                 Z*cos(lo)-rho*sin(lo),rho*sin(hi)-Z*cos(hi))
        northing=Z*cos(LAT)-sin(LAT)*(X*cos(LON)+Y*sin(LON))
        samples.append((port,r,side,axial,northing,-northing))
    edge_gap=scope_gap=float('inf')
    for f in p.faces:
        port,r,side,axial,n0,n1=map(min,zip(*(samples[k] for k in f)))
        # Facetado del gajo vecino <= .65 mm (arco <= 5.63 grados);
        # flecha de una cara del pétalo < .2 mm. Las caras laterales miden 12 mm.
        edge_gap=min(edge_gap,max(port-.00085,r-R-.0002))
        for i in range(4):
            outer=.087-i*.014
            end=.451+i*.002+(i+1)*.1*extension+(.001 if i==3 else 0)
            scope_gap=min(scope_gap,max(hypot(max(0,side),max(0,n0,n1))-outer,axial-end))
    return edge_gap,scope_gap,seam
