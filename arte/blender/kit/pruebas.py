"""Ejecutar con python3 pruebas.py. Todas las mediciones se hacen sobre vértices y caras."""
import sys
import unittest
from collections import defaultdict
from math import acos, atan2, cos, degrees, dist, hypot, isfinite, pi, radians, sin, tan, tau
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
import kit
from kit.geometria import cruz, punto, resta
from kit.muestras import PALETA, encuadrar, primeros_planos, rejilla


def normal(m,c):
    a = m.vertices[c[0]]
    normales = [cruz(resta(m.vertices[b],a),resta(m.vertices[d],a)) for b,d in zip(c[1:],c[2:])]
    return tuple(map(sum,zip(*normales)))


def area2(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])


def bordes(pol):
    return list(zip(pol,pol[1:]+pol[:1]))


def dentro(p,pol):
    x,y = p
    return sum((a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]
               for a,b in bordes(pol))%2


def contorno_rueda(m,z):
    # El agujero y el exterior comparten el plano de la tapa, pero están
    # en lazos separados. Seleccionar el lazo de mayor radio de este engrane.
    pol = [(x,y) for x,y,h in m.vertices if abs(z-h)<1e-10 and hypot(x,y)>.05]
    return sorted(pol,key=lambda p: atan2(p[1],p[0]))


def girar(pol,angulo,dx):
    c,s = cos(angulo),sin(angulo)
    return [(x*c-y*s+dx,x*s+y*c) for x,y in pol]


def distancia_segmento(p,a,b):
    dx,dy = b[0]-a[0], b[1]-a[1]
    t = ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)
    t = max(0,min(1,t))
    return hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)


def interfieren(a,b,margen=0):
    # Las proyecciones x permiten descartar los bordes alejados del engrane.
    izquierda,derecha = min(x for x,y in b)-margen,max(x for x,y in a)+margen
    def candidatos(pol):
        return [(p,q) for p,q in bordes(pol) if min(p[0],q[0])<=derecha
                and max(p[0],q[0])>=izquierda]
    cb = candidatos(b)
    for p,q in candidatos(a):
        for r,s in cb:
            if min(p[1],q[1])>max(r[1],s[1])+margen or min(r[1],s[1])>max(p[1],q[1])+margen:
                continue
            if (area2(p,q,r)*area2(p,q,s)<0 and area2(r,s,p)*area2(r,s,q)<0):
                return True
            if margen and min(distancia_segmento(p,r,s),distancia_segmento(q,r,s),
                              distancia_segmento(r,p,q),distancia_segmento(s,p,q))<=margen:
                return True
    return dentro(max(a),b) or dentro(min(b),a)


def longitudes(m):
    return tuple(b-a for a,b in m.limites)


class Kit(unittest.TestCase):
    def cerrada(self,m):
        self.assertTrue(all(len(p)==3 and all(map(isfinite,p)) for p in m.vertices))
        self.assertEqual(len(m.caras),len(m.materiales))
        aristas = {}
        vecinos = defaultdict(list)
        volumen = []
        for i,c in enumerate(m.caras):
            self.assertGreaterEqual(len(c),3)
            self.assertEqual(len(set(c)),len(c))
            self.assertTrue(all(0<=v<len(m.vertices) for v in c))
            n = normal(m,c)
            self.assertGreater(hypot(*n),1e-19,(m.nombre,i))
            volumen.append(punto(m.vertices[c[0]],n)/6)
            for a,b in bordes(c):
                self.assertNotIn((a,b),aristas)
                if (b,a) in aristas:
                    otro = aristas[b,a]
                    vecinos[otro].append(i)
                    vecinos[i].append(otro)
                aristas[a,b] = i
        self.assertTrue(all((b,a) in aristas for a,b in aristas))
        # También detecta un sólido entero vuelto del revés dentro de un conjunto.
        pendientes = set(range(len(m.caras)))
        componentes = 0
        while pendientes:
            cola = [pendientes.pop()]
            total = 0
            while cola:
                i = cola.pop()
                total += volumen[i]
                for j in vecinos[i]:
                    if j in pendientes:
                        pendientes.remove(j)
                        cola.append(j)
            self.assertGreater(total,0,m.nombre)
            componentes += 1
        return componentes

    def test_catalogo_completo(self):
        self.assertEqual(len(kit.PIEZAS),25)
        self.assertEqual({f.familia for f in kit.PIEZAS},kit.FAMILIAS)
        for fn in kit.PIEZAS:
            anterior = float("inf")
            for d in range(3):
                with self.subTest(pieza=fn.__name__,detalle=d):
                    m = fn(detalle=d,nombre="muestra")
                    self.assertEqual((m.familia,m.nombre,m.ultimo_nivel),
                                     (fn.familia,"muestra",fn.ultimo_nivel))
                    if d>fn.ultimo_nivel:
                        self.assertEqual((m.vertices,m.caras,m.materiales),([],[],[]))
                        continue
                    self.cerrada(m)
                    self.assertGreater(anterior,m.triangulos)
                    anterior = m.triangulos
                    self.assertTrue(set(m.materiales)<=PALETA.keys())
        for pieza,tope in ((kit.tornillo,300),(kit.allen,300),(kit.engrane,3000),(kit.rueda,6000)):
            self.assertLessEqual(pieza().triangulos,tope)

    def test_dimensiones(self):
        casos = [(kit.caja,dict(ancho=.48,fondo=.21,alto=.14),(.48,.21,.14)),
                 (kit.prisma,dict(espesor=.07),(.28,.18,.07)),
                 (kit.revolucion,dict(perfil=((.1,-.2),(.08,.12))),(.2,.2,.32)),
                 (kit.tubo,dict(inicio=(1,2,3),fin=(1,1.6,3),radio=.05,espesor=.008),(.1,.4,.1)),
                 (kit.manguera,dict(puntos=((0,0,0),(0,0,.3)),radio=.02), (.04,.04,.3)),
                 (kit.chapa,dict(ancho=.45,fondo=.28,espesor=.015),(.45,.28,.015)),
                 (kit.cartela,dict(base=.23,altura=.15,espesor=.013),(.23,.013,.15)),
                 (kit.tornillo,{},(.024*1.88,.024*1.88*cos(pi/6),.055+.024*.64)),
                 (kit.allen,{},(.024*1.64,.024*1.64,.079)),
                 (kit.tuerca,{},(.024*1.92,.024*1.92*cos(pi/6),.019)),
                 (kit.arandela,{},(.048,.048,.004)),(kit.remache,{},(.03384,.03384,.04118)),
                 (kit.engrane,dict(modulo=.014,dientes=24,ancho=.052),(.364,.364,.052)),
                 (kit.corona,{},(.506,.506,.038)),(kit.cremallera,{},(.12*pi,.048,.038)),
                 (kit.sinfin,{},(.106,.106,.19)),(kit.rodamiento,{},(.16,.16,.034)),
                 (kit.eje,{},(.055,.060775,.28)),(kit.cardan,{},(.14,.14,.25)),
                 (kit.heim,{},(.12,.17,.0552)),(kit.resorte,{},(.094,.094,.23)),
                 (kit.amortiguador,{},(.072,.072,.38)),(kit.rueda,{},(.15,.46,.46)),
                 (kit.oruga,{},(.115,.72,.28)),(kit.led,{},(.044,.044,.026))]
        for fn,opciones,esperado in casos:
            for d in range(fn.ultimo_nivel+1):
                with self.subTest(pieza=fn.__name__,detalle=d):
                    m = fn(detalle=d,**opciones)
                    for valor,medida in zip(longitudes(m),esperado):
                        self.assertAlmostEqual(valor,medida,delta=.0005)
                    if fn is kit.manguera:
                        for x,y,z in m.vertices:
                            self.assertAlmostEqual(hypot(x,y),.02)

    def test_agujeros_y_opciones(self):
        exterior = [(0,0),(.4,0),(.4,.15),(.22,.15),(.22,.30),(0,.30)]
        agujeros = [[(.05,.1),(.13,.14),(.15,.05)],[(.07,.19),(.07,.24),(.15,.24),(.15,.19)]]
        for d in range(3):
            m = kit.prisma(exterior[::-1],.018,agujeros,detalle=d)
            self.cerrada(m)
            # Característica de Euler 2-2g. Dos huecos reales en el prisma y seis en la chapa.
            for geo,huecos in ((m,2),(kit.chapa(filas=2,columnas=3,detalle=d),6)):
                self.assertEqual(len(geo.vertices)-sum(map(len,geo.caras))//2+len(geo.caras),2-2*huecos)
            for x,y,lleno in ((.10,.10,False),(.11,.21,False),(.32,.24,False),(.19,.16,True)):
                caras = [[m.vertices[i][:2] for i in c] for c in m.caras
                         if all(m.vertices[i][2]>0 for i in c)]
                self.assertEqual(any(dentro((x,y),c) for c in caras),lleno)
            for geo in (kit.revolucion(((.12,-.1),(.12,.1),(.08,.1),(.08,-.1)),True,detalle=d),
                        kit.revolucion(((0,-.1),(.08,0),(0,.1)),detalle=d),
                        kit.manguera(puntos=((0,0,0),(0,0,.12),(.15,0,.22)),
                                     suavizar=False,detalle=d),
                        kit.amortiguador(fuelle=False,detalle=d)):
                self.cerrada(geo)
        a = kit.allen()
        # Fondo horizontal dentro de la cabeza y pared hexagonal vertical.
        fondo = a.caras[-1]
        self.assertEqual(len(fondo),6)
        z = a.vertices[fondo[0]][2]
        self.assertTrue(0<z<max(p[2] for p in a.vertices))
        self.assertGreater(normal(a,fondo)[2],0)
        self.assertTrue(all(abs(a.vertices[i][2]-z)<1e-12 for i in fondo))
        self.assertEqual(self.cerrada(kit.rodamiento()),14)
        self.assertEqual(self.cerrada(kit.oruga(eslabones=32)),32)
        self.assertEqual(self.cerrada(kit.oruga(detalle=1)),1)

    def test_variantes_de_construccion(self):
        cuadrado = [(0,0),(.2,0),(.2,.2),(0,.2),(0,0)]
        anillo = [(.10,0),(.11,.08),(.05,.08),(.05,0),(.10,0)]
        cajas = [kit.caja(bisel=0,detalle=d) for d in range(3)]
        self.assertGreater(cajas[0].triangulos,cajas[1].triangulos)
        self.assertGreater(cajas[1].triangulos,cajas[2].triangulos)
        for d,m in enumerate(cajas):
            self.cerrada(m)
            self.cerrada(kit.prisma(cuadrado,.02,detalle=d))
            self.cerrada(kit.revolucion(anillo,True,detalle=d))
            self.cerrada(kit.engrane(modulo=.003,dientes=12,helice=-16,detalle=d))
            self.cerrada(kit.corona(modulo=.009,dientes=48,presion=24,helice=12,detalle=d))
            self.assertEqual(self.cerrada(kit.amortiguador(fuelle=False,detalle=d)),1)
            self.assertEqual(self.cerrada(kit.amortiguador(fuelle=True,detalle=d)),2)
            r = kit.cremallera(modulo=.014,dientes=8,presion=22,detalle=d)
            self.cerrada(r)
            # Cada pico conserva su distancia al siguiente incluso en la tapa achaflanada.
            crestas = sorted({round(x,10) for x,y,z in r.vertices if abs(y-.014)<1e-10})
            self.assertEqual(len(crestas),16)
            for a,b in zip(crestas,crestas[2:]):
                self.assertAlmostEqual(b-a,.014*pi)
        with self.assertRaises(ValueError):
            kit.corona(dientes=12,presion=30)
        self.assertEqual(kit.tornillo.ultimo_nivel,0)
        self.assertEqual(kit.arandela.ultimo_nivel,0)

    def test_transformaciones_y_rig(self):
        m = kit.caja()
        t = m.escalar((-2,1,1)).rotar((0,0,3),pi/2).trasladar((1,2,3))
        self.cerrada(t)
        self.assertLess(dist(longitudes(t),(.18,.64,.12)),1e-9)
        self.assertLess(dist([sum(x)/2 for x in t.limites],(1,2,3)),1e-9)
        for vec in ((1,0,0),(0,0,-1),(0,0,1),(.3,.4,.5)):
            barra = kit.tubo((0,0,0),vec)
            for c,p in zip(barra.caras[-2:],((0,0,0),vec)):
                centro = [sum(barra.vertices[i][j] for i in c)/len(c) for j in range(3)]
                self.assertLess(dist(centro,p),1e-9)
        par = kit.Malla.unir(m,t,nombre="par",familia="caja")
        self.assertEqual(par.triangulos,2*m.triangulos)
        self.assertEqual(self.cerrada(par),2)
        self.assertEqual(kit.eje_gltf((1,2,3)),[1,3,-2])
        for canal in ("rotacion","traslacion"):
            self.assertEqual(kit.regla_mando("avance",canal,(0,3,0),-.3),
                             dict(tipo="MANDO",canal=canal,eje=[0,0,-1],factor=-.3,mando="avance"))
        for d in (-1,3,.5):
            with self.assertRaises(ValueError):
                kit.tornillo(detalle=d)
        with self.assertRaises(ValueError):
            kit.regla_mando("giro","rotacion",(0,0,0))

    def test_paso_evolvente_y_engranamiento(self):
        modulo,z1,z2 = .012,24,18
        centros = modulo*(z1+z2)/2
        for d in range(3):
            a,b = [contorno_rueda(kit.engrane(dientes=z,detalle=d),-.019) for z in (z1,z2)]
            for pol,z in ((a,z1),(b,z2)):
                rp = modulo*z/2
                base = rp*cos(radians(20))
                paso_vertices = len(pol)//z
                for i,(x,y) in enumerate(pol):
                    u,v = pol[(i+paso_vertices)%len(pol)]
                    arco = (atan2(v,u)-atan2(y,x))%tau*rp
                    self.assertAlmostEqual(arco,pi*modulo)
                    self.assertAlmostEqual(hypot(x,y),hypot(u,v))
                # En un diente, las dos ramas se estrechan según tan(alpha)-alpha.
                flancos = [(abs(atan2(y,x)),hypot(x,y)) for x,y in pol if
                           1e-8<abs(atan2(y,x))<pi/z and hypot(x,y)>=base-1e-10]
                self.assertGreaterEqual(len(flancos),4)
                for ang,r in flancos:
                    alfa = acos(min(1,base/r))
                    esperado = (pi/4-.04)*modulo/rp+tan(radians(20))-radians(20)-tan(alfa)+alfa
                    self.assertAlmostEqual(ang,esperado)
            # Entre muestras, cada vértice recorre como máximo radio × ángulo.
            # La separación debe superar la suma de los dos desplazamientos
            # hasta la muestra más cercana, cubriendo también las fases intermedias.
            margen = pi/120*(max(hypot(*p) for p in a)/z1+max(hypot(*p) for p in b)/z2)
            for i in range(121):
                fase = tau*i/(120*z1)
                pol1 = girar(a,fase,0)
                pol2 = girar(b,pi-pi/z2-fase*z1/z2,centros)
                self.assertFalse(interfieren(pol1,pol2,margen),(d,i))
            # Control positivo: si se enfrenta diente con diente, la prueba debe detectarlo.
            self.assertTrue(interfieren(a,girar(b,pi,centros)))

    def test_avance_del_sinfin(self):
        for entradas in (1,2,3):
            m,d = .011,.09
            for nivel in range(3):
                worm = kit.sinfin(m,entradas,.19,d,detalle=nivel)
                self.cerrada(worm)
                # Alturas de los dos bordes de cada cresta en +X y +Y.
                # Los valores se miden en dos meridianos reales separados 90°.
                def centros(eje):
                    altos = sorted(z for x,y,z in worm.vertices if abs(z)<.094999 and
                                   abs(hypot(x,y)-(d/2+m))<1e-8 and
                                   (x>0 and abs(y)<1e-9 if eje=="X" else y>0 and abs(x)<1e-9))
                    return [(a+b)/2 for a,b in zip(altos,altos[1:]) if b-a<pi*m/2]
                xs,ys = centros("X"),centros("Y")
                self.assertGreaterEqual(len(xs),3)
                for a,b in zip(xs,xs[1:]):
                    self.assertAlmostEqual(b-a,pi*m)
                # Seguir el mismo filete. Con tres entradas otras crestas
                # también pasan por el meridiano en el intervalo de un giro.
                centro = min(xs,key=abs)
                siguiente = min((y for y in ys if y>centro+1e-9),default=None)
                self.assertIsNotNone(siguiente)
                avance = 4*(siguiente-centro)
                self.assertAlmostEqual(avance/(pi*d),entradas*m/d)
                beta = kit.angulo_avance(m,entradas,d)
                self.assertAlmostEqual(tan(beta),entradas*m/d)
                rueda = kit.engrane(modulo=m,helice=degrees(beta),detalle=nivel)
                self.cerrada(rueda)
                tapas = [contorno_rueda(rueda,z) for z in (-.019,.019)]
                def fase(pol):
                    z = 24
                    ang = [z*atan2(y,x) for x,y in pol if abs(hypot(x,y)-m*13)<1e-9]
                    return atan2(sum(map(sin,ang)),sum(map(cos,ang)))/z
                self.assertAlmostEqual((fase(tapas[1])-fase(tapas[0]))*12*m/.038,tan(beta))

    def test_encuadre_y_paleta(self):
        for d in range(3):
            celdas = list(rejilla(d))
            self.assertEqual(len({(x,y) for x,y,_,_ in celdas}),25)
            for x,y,_,m in celdas:
                if not m.caras:
                    continue
                vista = encuadrar(m,x,y,2.35,1.3)
                ancho,alto,_ = longitudes(vista)
                self.assertLessEqual(ancho,2.35+1e-9)
                self.assertLessEqual(alto,1.3+1e-9)
                for limites,centro in zip(vista.limites,(x,y)):
                    self.assertAlmostEqual(sum(limites)/2,centro)
                self.assertAlmostEqual(vista.limites[2][0],.035)
        planos = primeros_planos()
        self.assertEqual(len(planos),5)
        for _,m in planos:
            self.cerrada(m)
        self.assertGreater(PALETA[kit.led().materiales[-1]][-1],0)


if __name__=="__main__":
    unittest.main(verbosity=2)
