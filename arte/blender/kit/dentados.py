"""Módulo transversal en ruedas y cremallera, axial en sinfines. Ejes locales Z."""
from math import acos, atan, ceil, cos, floor, pi, radians, sin, tan, tau

from .geometria import Malla, pieza, superficie


def evolvente(r, base):
    a = acos(min(1,base/r))
    return tan(a)-a


def perfil_diente(modulo, dientes, presion, detalle, interior):
    if dientes<8 or modulo<=0 or not 10<=presion<=30:
        raise ValueError("Se requieren al menos 8 dientes, módulo positivo y presión de 10 a 30°")
    primitivo = modulo*dientes/2
    base = primitivo*cos(radians(presion))
    bajo = primitivo-modulo*(1 if interior else 1.25)
    alto = primitivo+modulo*(1.25 if interior else 1)
    # Para la corona este contorno delimita el hueco que recibe el diente.
    # Juego entre flancos: 0,08 módulos por pareja en el círculo primitivo.
    mitad = (pi/4 + (.025 if interior else -.04))*modulo/primitivo
    def flanco(r):
        # El pie se abre por debajo del círculo base para empalmar con
        # el fondo. La evolvente propiamente dicha comienza en el círculo base.
        pie = .10*max(0,base-r)/primitivo
        return mitad + evolvente(primitivo,base)-evolvente(r,base) + pie
    n = (4,2,1)[detalle]
    comienzo = max(bajo,base)
    radios = ([bajo] if bajo<comienzo else []) + [
        comienzo+(alto-comienzo)*i/n for i in range(n+1)]
    # Arco de cabeza: el vértice central conserva el diámetro exterior.
    if flanco(alto)<=0 or flanco(bajo)>=pi/dientes:
        raise ValueError("La presión y el número de dientes cierran el hueco del perfil")
    return ([(-pi/dientes,bajo)] + [(-flanco(r),r) for r in radios]
            + ([(0,alto)] if detalle==0 else [])
            + [(flanco(r),r) for r in reversed(radios)])


def dentado(modulo, dientes, ancho, presion, helice, radio_liso, interior, material, detalle):
    rp = modulo*dientes/2
    diente = perfil_diente(modulo,dientes,presion,detalle,interior)
    if ancho<=0 or not -75<helice<75:
        raise ValueError("Ancho o hélice fuera de rango")
    if ((interior and radio_liso<=max(r for _,r in diente)) or
            (not interior and not 0<radio_liso<min(r for _,r in diente))):
        raise ValueError("El aro debe tener espesor positivo en la raíz")
    perfil = [(tau*i/dientes+a,r) for i in range(dientes) for a,r in diente]
    giro = ancho*tan(radians(helice))/rp
    pasos = max(1,ceil(abs(giro)*dientes/tau*(8,5,3)[detalle]))
    filas = []
    for j in range(pasos+1):
        t = j/pasos-.5
        filas.append([(r*cos(a+t*giro),r*sin(a+t*giro),t*ancho) for a,r in perfil])
    # La misma semirrecta une el flanco y el agujero en las tapas.
    for j in reversed(range(pasos+1)):
        t = j/pasos-.5
        filas.append([(radio_liso*cos(a+t*giro),radio_liso*sin(a+t*giro),t*ancho)
                      for a,_ in perfil])
    if interior:
        filas.reverse()
    return superficie(filas,material,True)


@pieza("engrane")
def engrane(modulo=.012, dientes=24, ancho=.038, presion=20, helice=0,
            agujero=None, material="bronce", *, detalle):
    if agujero is None:
        agujero = .1875*modulo*dientes
    return dentado(modulo,dientes,ancho,presion,helice,agujero/2,False,material,detalle)


@pieza("corona")
def corona(modulo=.012, dientes=36, ancho=.038, presion=20, helice=0,
           margen=.022, material="acero", *, detalle):
    return dentado(modulo,dientes,ancho,presion,helice,
                   modulo*(dientes/2+1.25)+margen,True,material,detalle)


@pieza("cremallera")
def cremallera(modulo=.012, dientes=10, ancho=.038, presion=20, material="bronce", *, detalle):
    paso = pi*modulo
    bajo,alto = -1.25*modulo,modulo
    contorno = []
    for i in range(dientes):
        centro = (i+.5-dientes/2)*paso
        for signo, alturas in ((-1,(bajo,alto)),(1,(alto,bajo))):
            for y in alturas:
                contorno.append((centro+signo*(paso/4-.04*modulo-y*tan(radians(presion))),y))
    x = dientes*paso/2
    borde = [(-x,bajo),*contorno,(x,bajo),(x,-3*modulo),(-x,-3*modulo)]
    # Chaflanes de protección en ambos cantos del dentado.
    capas = ([(.96,-.5),(1,-.4),(1,.4),(.96,.5)],
             [(.98,-.5),(1,0),(.98,.5)],[(1,-.5),(1,.5)])[detalle]
    return superficie([[(a, min(b,bajo)+(b-min(b,bajo))*k, z*ancho)
                        for a,b in reversed(borde)] for k,z in capas],material)


def angulo_avance(modulo_axial, entradas, diametro):
    """Radianes desde el plano transversal del sinfín."""
    if min(modulo_axial,diametro)<=0 or type(entradas) is not int or entradas<1:
        raise ValueError("Parámetros de sinfín inválidos")
    return atan(entradas*modulo_axial/diametro)


@pieza("sinfin")
def sinfin(modulo_axial=.012, entradas=1, longitud=.19, diametro=.082,
           material="acero", *, detalle):
    angulo_avance(modulo_axial,entradas,diametro)
    if longitud<=0 or diametro/2<=1.25*modulo_axial:
        raise ValueError("Núcleo o longitud del sinfín insuficientes")
    paso, h = pi*modulo_axial, longitud/2
    # Tramos axiales de una rosca trapezoidal de presión 20°, con la
    # misma holgura en la primitiva que la rueda. Coordenadas en pasos.
    pendiente = tan(radians(20))/pi
    cresta = .25-.04/pi-pendiente
    valle = .25-.04/pi+1.25*pendiente
    quiebres = [k+f for k in range(floor(-h/paso)-entradas-1,ceil(h/paso)+2)
                for f in (-valle,-cresta,cresta,valle)]
    n = (40,24,12)[detalle]
    giros = {i/n for i in range(n+1)}
    # Un meridiano extra donde una hélice entra o sale por una tapa evita
    # recortar la punta del filete o crear ranuras abiertas en el extremo.
    for f in quiebres:
        for z in (-h,h):
            u = (z/paso-f)/entradas
            if 0<u<1:
                giros.add(u)
    giros = sorted({round(u,12) for u in giros})
    vertices, indices, caras = [], {}, []

    def vertice(u,z):
        fase = abs((z/paso-entradas*u+.5)%1-.5)
        t = max(0,min(1,(fase-cresta)/(valle-cresta)))
        radio = diametro/2+modulo_axial*(1-2.25*t)
        a = tau*(u%1)
        pos = tuple(round(v,10) for v in (radio*cos(a),radio*sin(a),z))
        if pos not in indices:
            indices[pos] = len(vertices)
            vertices.append(pos)
        return indices[pos]

    for u,v in zip(giros,giros[1:]):
        medio = entradas*(u+v)/2
        activos = [f for f in quiebres if -h<(medio+f)*paso<h]
        def meridiano(t):
            return [vertice(t,-h),*(vertice(t,(entradas*t+f)*paso) for f in activos),vertice(t,h)]
        a,b = meridiano(u),meridiano(v)
        for j in range(len(a)-1):
            cara = tuple(dict.fromkeys((a[j],b[j],b[j+1],a[j+1])))
            if len(cara)>=3:
                caras.append(cara)
    caras += [tuple(vertice(u,-h) for u in reversed(giros[:-1])),
              tuple(vertice(u,h) for u in giros[:-1])]
    return Malla(vertices,caras,[material]*len(caras))
