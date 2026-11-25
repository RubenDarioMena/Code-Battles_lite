"""Composición ortográfica del catálogo, también comprobable fuera de Blender."""
from math import degrees, pi, radians

from . import (PIEZAS, allen, angulo_avance, engrane, prisma, rodamiento, rueda,
               sinfin, tubo)
from .geometria import ensamblar

PALETA = {
    "acero": ((.33,.41,.47),.72,.30,0),
    "cromo": ((.7,.78,.83),.87,.22,0),
    "pintura": ((.045,.29,.32),.47,.34,0),
    "bronce": ((.64,.34,.105),.69,.31,0),
    "goma": ((.036,.046,.05),.05,.71,0),
    "grafito": ((.095,.12,.135),.54,.39,0),
    "luz": ((.08,.74,.96),.15,.24,2.4),
}

TITULOS = ("Caja biselada","Prisma calado","Revolución","Tubo","Manguera","Chapa perforada",
           "Cartela","Tornillo hexagonal","Tornillo Allen","Tuerca","Arandela","Remache",
           "Engranaje recto","Corona interior","Cremallera","Sinfín","Rodamiento",
           "Eje con chaveta","Junta cardán","Rótula Heim","Resorte","Amortiguador",
           "Rueda","Oruga","LED")

def muestra(fn, detalle):
    if fn is prisma:
        return fn(agujeros=([(-.06,-.038),(.068,-.038),(.04,.044),(-.06,.044)],),detalle=detalle)
    if fn is tubo:
        return fn(espesor=.008,detalle=detalle)
    return fn(detalle=detalle)


def parejas():
    m = .012
    z1,z2 = 24,18
    a = engrane(modulo=m,dientes=z1)
    b = engrane(modulo=m,dientes=z2,material="acero").rotar((0,0,1),pi-pi/z2)
    rectos = ensamblar(a,b.trasladar((m*(z1+z2)/2,0,0)))

    d,entradas = .082,1
    beta = degrees(angulo_avance(m,entradas,d))
    # Sinfín al +X de la rueda, eje +Y. En Y=0 el hueco del sinfín
    # (ángulo local pi) recibe la cabeza del diente que apunta a +X.
    helicoidal = engrane(modulo=m,dientes=z1,ancho=.024,helice=beta)
    tornillo = sinfin(modulo_axial=m,entradas=entradas,diametro=d).rotar((1,0,0),-pi/2)
    cruzados = ensamblar(helicoidal,tornillo.trasladar(((m*z1+d)/2,0,0)))
    return rectos,cruzados


def primeros_planos():
    a,b = parejas()
    return [("Engranajes rectos",a),("Sinfín y rueda helicoidal",b),
            ("Tornillo Allen",allen()),("Rodamiento",rodamiento()),("Rueda",rueda())]


def orientada(m):
    if m.familia in ("rueda","oruga"):
        return m.rotar((0,1,0),radians(-65)).rotar((0,0,1),radians(-65))
    angulo = -55 if m.familia in ("eje","resorte","tubo","sinfin","amortiguador","cardan") else -31
    return m.rotar((0,0,1),radians(-12)).rotar((1,0,0),radians(angulo))


def encuadrar(m, x, y, ancho, alto):
    m = orientada(m)
    (x0,x1),(y0,y1),(z0,z1) = m.limites
    escala = min(ancho/(x1-x0),alto/(y1-y0))
    return m.trasladar((-(x0+x1)/2,-(y0+y1)/2,-z0)).escalar(escala).trasladar((x,y,.035))


def rejilla(detalle):
    for i,(fn,titulo) in enumerate(zip(PIEZAS,TITULOS)):
        x,y = (i%5-2)*2.86, (2-i//5)*1.82
        yield x,y,titulo,muestra(fn,detalle)
