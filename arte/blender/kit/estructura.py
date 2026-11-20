from math import cos, dist, pi, sin, tau

from .contornos import extruir, redondear
from .geometria import (circulo, cruz, pieza, por, punto, resta, suma, superficie,
                        torno, unidad)

SEGMENTOS = (32, 16, 8)
RECTANGULO = ((-.14,-.09),(.14,-.09),(.14,.09),(-.14,.09))


@pieza("caja")
def caja(ancho=.32, fondo=.18, alto=.12, bisel=.012, material="pintura", *, detalle):
    if min(ancho, fondo, alto)<=0 or bisel<0:
        raise ValueError("Dimensiones inválidas")
    x,y,z = ancho/2, fondo/2, alto/2
    b = min(bisel, .8*min(x,y,z))
    esquinas = [(x,y),(-x,y),(-x,-y),(x,-y)]
    if detalle==2 or not b:
        pasos = (4,2,1)[detalle]
        return superficie([[(a,c,z*(2*i/pasos-1)) for a,c in esquinas]
                           for i in range(pasos+1)],material)
    segmentos = (4,1)[detalle]
    def fila(h, radio):
        return [(a*(1-b/x)+radio*cos((k+j/segmentos)*pi/2),
                 c*(1-b/y)+radio*sin((k+j/segmentos)*pi/2),h)
                for k,(a,c) in enumerate(esquinas) for j in range(segmentos+1)]
    return superficie([fila(-z,b*.32),fila(-z+b*.68,b),
                       fila(z-b*.68,b),fila(z,b*.32)],material)


@pieza("prisma")
def prisma(contorno=RECTANGULO, espesor=.045, agujeros=(), material="pintura", *, detalle):
    return extruir([redondear(c,(2,1,0)[detalle]) for c in (contorno,*agujeros)],
                   espesor,material)


@pieza("revolucion")
def revolucion(perfil=((.09,-.1),(.12,-.08),(.08,.08),(.05,.1)), cerrado=False,
               material="acero", *, detalle):
    return torno(perfil,SEGMENTOS[detalle],material,cerrado)


@pieza("tubo")
def tubo(inicio=(0,0,0), fin=(0,0,.36), radio=.035, espesor=None, material="acero", *, detalle):
    largo = dist(inicio,fin)
    if largo<=0 or radio<=0 or (espesor is not None and not 0<espesor<=radio):
        raise ValueError("Dimensiones del tubo inválidas")
    perfil = [(radio,0),(radio,largo)]
    hueco = espesor is not None and espesor < radio
    if hueco:
        perfil += [(radio-espesor,largo),(radio-espesor,0)]
    return torno(perfil,SEGMENTOS[detalle],material,hueco).alinear(resta(fin,inicio)).trasladar(inicio)


def barrer(puntos, radio, lados):
    """Transporta el marco con la rotación mínima entre tangentes sucesivas."""
    filas = []
    direcciones = [unidad(resta(b,a)) for a,b in zip(puntos,puntos[1:])]
    tangentes = [direcciones[0], *(unidad(suma(a,b)) for a,b in zip(direcciones,direcciones[1:])),
                 direcciones[-1]]
    normal = min(((1,0,0),(0,1,0),(0,0,1)),key=lambda v: abs(punto(v,tangentes[0])))
    anterior = tangentes[0]
    normal = unidad(resta(normal,por(anterior,punto(normal,anterior))))
    for p,t in zip(puntos,tangentes):
        giro = cruz(anterior,t)
        # Fórmula de Rodrigues para la rotación que lleva anterior a t.
        v = cruz(giro,normal)
        normal = unidad(suma(suma(normal,v),por(cruz(giro,v),1/(1+punto(anterior,t)))))
        anterior = t
        binormal = cruz(t,normal)
        filas.append([suma(p,suma(por(normal,radio*cos(tau*i/lados)),
                                  por(binormal,radio*sin(tau*i/lados)))) for i in range(lados)])
    return superficie(filas,"goma")


@pieza("manguera")
def manguera(puntos=((0,0,0),(.12,0,.1),(.15,.12,.2),(.3,.14,.16)), radio=.014,
             suavizar=True, material="goma", *, detalle):
    if len(puntos)<2 or radio<=0:
        raise ValueError("La manguera necesita dos puntos y radio positivo")
    camino = list(puntos)
    if suavizar:
        for _ in range((3,2,1)[detalle]):
            nuevo = [camino[0]]
            for a,b in zip(camino,camino[1:]):
                nuevo.extend(suma(por(a,1-t),por(b,t)) for t in (.25,.75))
            camino = nuevo+[camino[-1]]
    m = barrer(camino,radio,(16,12,8)[detalle])
    m.materiales = [material]*len(m.caras)
    return m


@pieza("chapa")
def chapa(ancho=.36, fondo=.24, espesor=.012, columnas=4, filas=3, radio=.021,
          material="pintura", *, detalle):
    if min(columnas,filas)<1 or not 0<2*radio<min(ancho/columnas,fondo/filas):
        raise ValueError("Los taladros deben caber separados dentro de la chapa")
    borde = [(a*ancho/2,b*fondo/2) for a,b in ((1,1),(-1,1),(-1,-1),(1,-1))]
    base = circulo(radio,(24,12,8)[detalle],0)
    huecos = [[(x+ancho*((i+.5)/columnas-.5),y+fondo*((j+.5)/filas-.5))
               for x,y,_ in base] for i in range(columnas) for j in range(filas)]
    return extruir([borde,*huecos],espesor,material)


@pieza("cartela")
def cartela(base=.18, altura=.13, espesor=.012, material="pintura", *, detalle):
    return prisma(((0,0),(base,0),(0,altura)),espesor,material=material,
                  detalle=detalle).rotar((1,0,0),pi/2)
