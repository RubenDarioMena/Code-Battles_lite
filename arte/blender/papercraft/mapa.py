"""Recorta las caras físicas del collage contra las dieciséis ventanas métricas."""
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path("arte/blender/papercraft").resolve()))
from comun import *

def dentro(pt,pol):
    x,y=pt
    cruces=0
    for i,(a,b) in enumerate(pol):
        c,d=pol[i-1]
        if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:
            cruces+=1
    return cruces%2

def cinta(puntos,anchos,semilla):
    r=azar(semilla)
    if isinstance(anchos,(float,int)):
        anchos=[anchos]*len(puntos)
    muestras=[]
    for i,((x,y),(u,v)) in enumerate(zip(puntos,puntos[1:])):
        n=max(1,math.ceil(math.hypot(x-u,y-v)/2.4))
        for k in range(n):
            s=k/n
            muestras.append((x+(u-x)*s,y+(v-y)*s,anchos[i]*(1-s)+anchos[i+1]*s))
    muestras.append((*puntos[-1],anchos[-1]))
    lados=[[],[]]
    for i,(x,y,w) in enumerate(muestras):
        a=muestras[max(0,i-1)]; b=muestras[min(i+1,len(muestras)-1)]
        dx,dy=b[0]-a[0],b[1]-a[1]
        largo=math.hypot(dx,dy)
        for lado,sg in zip(lados,[1,-1]):
            d=sg*w*.5*(1+.045*math.sin(i*.86)+r.uniform(-.046,.046))
            lado.append((x-d*dy/largo,y+d*dx/largo))
    return lados

def recortar(cara,eje,limite,signo):
    salida=[]
    a=cara[-1]
    for b in cara:
        da=(a[eje]-limite)*signo; db=(b[eje]-limite)*signo
        if (da<0)!=(db<0):
            t=da/(da-db)
            v=[u+(w-u)*t for u,w in zip(a,b)]
            v[eje]=limite
            salida.append(tuple(v))
        if db>=0:
            salida.append(b)
        a=b
    return salida

def repartir(p):
    w,h=MAPA['metros']; nx,ny=MAPA['trozos']; dx=w/nx; dy=h/ny
    lotes=[[Papel(f'terreno-{j}-{i}') for i in range(nx)] for j in range(ny)]
    for cara,mat,tono in p.caras:
        xs,ys,_=zip(*cara)
        for j in range(min(ny-1,max(0,int(min(ys)//dy))),min(ny-1,int(max(ys)//dy))+1):
            for i in range(min(nx-1,max(0,int(min(xs)//dx))),min(nx-1,int(max(xs)//dx))+1):
                pol=cara
                for eje,lim,sg in [(0,i*dx,1),(0,(i+1)*dx,-1),(1,j*dy,1),(1,(j+1)*dy,-1)]:
                    pol=recortar(pol,eje,lim,sg)
                    if len(pol)<3: break
                if len(pol)>=3:
                    pol=[b for a,b in zip(pol[-1:]+pol[:-1],pol) if math.dist(a,b)>1e-7]
                    if len(pol)>=3:
                        lotes[j][i].cara(pol,mat,tono)
    return [p for fila in lotes for p in fila]

class Paisaje:
    def __init__(self):
        self.p=Papel('Collage')
        self.capas=[]
        self.reservas=[]
        self.colocaciones=[]
        self.r=azar(MAPA['semilla'])

    def hoja(self,pol,z,alto,mat,tono=1,reserva=False):
        self.p.lamina(pol,z,alto,mat,tono)
        self.capas.append((pol,z+alto, (min(x for x,y in pol),max(x for x,y in pol),min(y for x,y in pol),max(y for x,y in pol))))
        if reserva: self.reservas.append(pol)

    def altura(self,x,y):
        return max((z for pol,z,(a,b,c,d) in self.capas if a<=x<=b and c<=y<=d and dentro((x,y),pol)),default=0)

    def colocar(self,n,x,y,giro,escala):
        self.colocaciones.append(dict(pieza=n,x=round(x,4),y=round(y,4),z=round(self.altura(x,y),4),
                                      giro=round(giro,6),escala=round(escala,5)))

    def base(self):
        w,h=MAPA['metros']
        rect=[(0,0),(w,0),(w,h),(0,h)]
        for z,alto,mat in [(-3.5,.95,'cartón'),(-2.55,1.1,'kraft'),(-1.45,.95,'cartón')]:
            self.p.lamina(rect,z,alto,mat)
        zonas=MAPA['zonas']
        rio=MAPA['rio']
        a,b=cinta(rio['puntos'],rio['ancho'],'ribera')
        a[0]=(a[0][0],0); b[0]=(b[0][0],0)
        cauce=a+b[::-1]
        self.hoja(cauce,-.5,.48,'agua',reserva=True)
        self.casa=[zonas['casa'][0]]+cauce+zonas['casa'][1:-1]
        self.hoja(self.casa,-.5,.66,'prado')
        self.hoja(zonas['frentes'][:-1],-.5,.66,'ocre')
        for i in range(2,len(a)-2,2):
            x,y=a[i]; u,v=b[i]
            t=self.r.uniform(.21,.72)
            pts=contorno(x*t+u*(1-t),y*t+v*(1-t),self.r.uniform(.6,1.5),.12,9,i,.25)
            self.p.lamina(pts,-.02,.065,'orilla' if i%4 else 'espuma')

    def retazos(self):
        # Parches anchos con bordes dentados y tiras de cultivo orientadas con los campos.
        r=self.r; w,h=MAPA['metros']
        for i in range(223):
            x=r.uniform(-8,w+8); y=r.uniform(-6,h+6)
            casa=dentro((x,y),self.casa)
            pol=contorno(x,y,r.uniform(10,37),r.uniform(4,14),24,i,r.uniform(-.65,.4),.16)
            if not all(bool(dentro(p,self.casa))==bool(casa) for p in pol):continue
            if any(dentro(p,pol) for p in MAPA['rio']['puntos']):continue
            z=.16+.0009*i
            mat=r.choice(['oliva','salvia','musgo','prado'] if casa else ['rastrojo','arcilla','miel','ocre','kraft','tierra'])
            self.hoja(pol,.16,z-.16+.32,mat,r.uniform(.96,1.04))
        for i,(x,y,a,b,t) in enumerate(MAPA['campos']):
            def punto(u,v):
                return (x+u*math.cos(t)-v*math.sin(t),y+u*math.sin(t)+v*math.cos(t))
            pts=[punto(u,v) for u,v in [(-a,-b*.7),(-a*.83,-b),(a*.9,-b*.95),(a,-b*.65),(a*.94,b*.84),(-a*.74,b)]]
            self.hoja(pts,.48,.23,'rastrojo' if i%2 else 'liquen',reserva=True)
            for k in range(-3,4):
                u,v=punto(-a*.76,k*b/4.5); s,q=punto(a*.85,k*b/4.5)
                l,d=cinta([(u,v),(s,q)],.32,(i,k))
                self.p.lamina(l+d[::-1],.71,.045,'huella' if i%2 else 'salvia')
                for j in range(4):
                    u,v=punto(r.uniform(-a*.7,a*.7),k*b/4.5)
                    self.colocar('espigas',u,v,t,r.uniform(.6,1.05))

    def montes(self):
        grupos=[*MAPA['cordilleras'].values(),MAPA['oteros']]
        for g,montes in enumerate(grupos):
            for i,m in enumerate(montes):
                x,y=m['centro']; a,b=m['radios']; h=m['altura']; n=m['pisos']
                z=.17+i*.017
                for k in range(n):
                    f=1-k/(n+.8)
                    mat=(['tierra','musgo','oliva','pizarra','piedra','caliza','nieve','nieve'] if g<2
                         else ['arcilla','tierra','rastrojo','miel','caliza'])[k]
                    pol=contorno(x+k*.48,y-k*.26,a*f,b*f,21,m['semilla']+k*.17,m['giro'],.115)
                    self.hoja(pol,z,h,'nieve' if k==n-1 and g<2 else mat,reserva=True)
                    z+=h

    def vias(self):
        for i,v in enumerate([MAPA['carretera']]+MAPA['carriles']):
            pts=v['puntos']
            l,d=cinta(pts,v['ancho'],v['nombre'])
            z=.54+i*.038
            self.hoja(l+d[::-1],z,.2,'kraft',reserva=True)
            # Recortes de desgaste siguiendo ambos márgenes del carril.
            for j in range(2,len(l)-2,3):
                for margen in [l,d]:
                    u,w=(l if margen is d else d)[j]
                    x,y=margen[j]; x=.84*x+.16*u; y=.84*y+.16*w
                    
                    ang=math.atan2(margen[j+1][1]-margen[j-1][1],margen[j+1][0]-margen[j-1][0])
                    self.p.tapa(contorno(x,y,.85,.067,6,j,ang),z+.205,'huella')
        x,y=MAPA['losa']['centro']; a,b=[s/2 for s in MAPA['losa']['metros']]
        self.hoja([(x-a,y-b+1),(x-a+1,y-b),(x+a,y-b),(x+a,y+b-1),(x+a-1,y+b),(x-a,y+b)],
                  .51,.45,'caliza',reserva=True)
        for k in range(1,4):
            u=x-a+k*a/2
            self.p.tapa([(u-.05,y-b+.2),(u+.05,y-b+.2),(u+.05,y+b-.2),(u-.05,y+b-.2)],.966,'piedra')

    def poblar(self):
        r=self.r; w,h=MAPA['metros']
        def libre(x,y):
            return 2<x<w-2 and 2<y<h-2 and all(not dentro((x,y),pol) for pol in self.reservas)
        for x,y,a,b,n in MAPA['bosques']:
            for _ in range(n):
                t=r.uniform(0,math.tau); f=math.sqrt(r.random())
                u,v=x+a*f*math.cos(t),y+b*f*math.sin(t)
                if libre(u,v):
                    self.colocar(r.choice(['pino-alto','pino-alto','pino-joven','alcornoque']),u,v,t,r.uniform(.65,1.27))
        for _ in range(300):
            x=r.uniform(0,w);y=r.uniform(0,h)
            casa=dentro((x,y),self.casa)
            for j in range(r.randint(2,6)):
                u,v=x+r.gauss(0,1.9),y+r.gauss(0,1.2)
                if libre(u,v):
                    self.colocar(r.choice(['laja','matorral','roca'] if casa else ['esparto','laja','esparto','roca']),
                                 u,v,r.uniform(-3,3),r.uniform(.4,1.08))
        # Pequeños grupos anclados en rellanos de las sierras, a ambos lados del paso.
        for cadena in MAPA['cordilleras'].values():
            for monte in cadena:
                cx,cy=monte['centro']; a,b=monte['radios']
                for _ in range(18):
                    t=r.uniform(0,math.tau); f=r.uniform(.42,1)
                    x=cx+a*f*math.cos(t);y=cy+b*f*math.sin(t)
                    if not (2<x<w-2 and 2<y<h-2): continue
                    z=self.altura(x,y)
                    if z<1 or any(abs(self.altura(x+u,y+v)-z)>.6 for u,v in [(1,0),(-1,0),(0,1),(0,-1)]):continue
                    self.colocar(r.choice(['pino-joven','laja','roca']),x,y,t,r.uniform(.65,.94))
        pts=MAPA['muralla']
        longitudes=[math.dist(a,b) for a,b in zip(pts,pts[1:])]
        total=sum(longitudes); cantidad=round(total/7)
        def sobre_muralla(distancia):
            for a,b,largo in zip(pts,pts[1:],longitudes):
                if distancia<=largo:
                    return tuple(u+(v-u)*distancia/largo for u,v in zip(a,b))
                distancia-=largo
            return pts[-1]
        for j in range(cantidad):
            x,y=sobre_muralla(total*j/cantidad)
            u,v=sobre_muralla(total*(j+1)/cantidad)
            self.colocar('lienzo',(x+u)/2,(y+v)/2,math.atan2(v-y,u-x),math.hypot(u-x,v-y)/7)
        for i,(x,y) in enumerate(pts):
            if i in (0,2,3,5,7,len(pts)-1):
                u,v=pts[min(i+1,len(pts)-1)] if i+1<len(pts) else pts[i-1]
                altura=self.altura(x,y)
                if altura>1:
                    # Zapata tallada en el contrafuerte para apoyar toda la torre.
                    huella=contorno(x,y,4.65,4.55,14,('zapata',i),aspereza=.045)
                    self.p.lamina(huella,.16,altura-.16,'pizarra')
                self.colocar('torre',x,y,math.atan2(v-y,u-x),1.08)

def construir():
    mat=iniciar()
    paisaje=Paisaje()
    paisaje.base(); paisaje.retazos(); paisaje.montes(); paisaje.vias(); paisaje.poblar()
    from oclusion import preparar, hornear
    bvh=preparar(paisaje)
    for p in repartir(paisaje.p):
        obj=p.objeto(mat)
        hornear(obj,bvh)
        exportar(obj,BASE/'glb'/'mapa'/(p.nombre+'.glb'))
    (BASE/'colocaciones.json').write_text('[\n'+',\n'.join(', '.join(json.dumps(v,ensure_ascii=False) for v in paisaje.colocaciones[i:i+4]) for i in range(0,len(paisaje.colocaciones),4))+'\n]\n')
    from previas import generar
    generar()
if __name__=='__main__':
    construir()
