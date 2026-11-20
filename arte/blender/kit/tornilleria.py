"""Tornillería centrada en XY. La cabeza nace en Z=0 y el vástago baja."""
from math import cos, pi, sin, tau

from .geometria import circulo, pieza, superficie, torno


def hexagono(radio, n, z):
    # Los seis vértices son exactos, incluso al emparejar el hexágono con un círculo.
    resultado = []
    for i in range(n):
        a = tau*i/n
        r = radio*cos(pi/6)/cos(a%(pi/3)-pi/6)
        resultado.append((r*cos(a),r*sin(a),z))
    return resultado


def vastago(d, largo, n):
    return [circulo(d*.43,n,-largo),circulo(d/2,n,-largo+d*.07),circulo(d/2,n,0)]


@pieza("tornillo",0)
def tornillo(diametro=.024, longitud=.055, material="acero", *, detalle):
    d,n = diametro,12
    filas = vastago(d,longitud,n)
    filas += [hexagono(r*d,n,z*d) for r,z in ((.88,0),(.94,.07),(.94,.57),(.84,.64))]
    return superficie(filas,material)


@pieza("tornillo",0)
def allen(diametro=.024, longitud=.055, material="acero", *, detalle):
    d,n = diametro,24
    filas = [circulo(d/2,n,-longitud),circulo(d/2,n,0)]
    filas += [circulo(r*d,n,z*d) for r,z in ((.82,0),(.82,.93),(.75,1))]
    filas += [hexagono(r*d,6,z*d) for r,z in ((.48,1),(.44,.95),(.44,.43))]
    return superficie(filas,material)


@pieza("tuerca",1)
def tuerca(diametro=.024, alto=.019, material="acero", *, detalle):
    d,h,n = diametro,alto/2,(18,6)[detalle]
    filas = [hexagono(r*d,n,z*h) for r,z in ((.86,-1),(.96,-.8),(.96,.8),(.86,1))]
    filas += [circulo(d/2,n,h),circulo(d/2,n,-h)]
    return superficie(filas,material,True)


@pieza("arandela",0)
def arandela(diametro=.048, agujero=.025, espesor=.004, material="acero", *, detalle):
    if not 0<agujero<diametro:
        raise ValueError("Diámetros de arandela inválidos")
    r,i,h = diametro/2,agujero/2,espesor/2
    return torno([(r,-h),(r,h),(i,h),(i,-h)],24,material,True)


@pieza("remache",1)
def remache(diametro=.018, longitud=.032, material="acero", *, detalle):
    d = diametro
    return torno([(d/2,-longitud),(d/2,0),(.94*d,0),(.9*d,.17*d),
                  (.65*d,.38*d),(.34*d,.48*d),(0,.51*d)],(20,8)[detalle],material)
