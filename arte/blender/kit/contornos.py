"""Extrusión de contornos simples disjuntos mediante franjas verticales y paridad."""
from collections import defaultdict
from math import dist

from .geometria import Malla


def redondear(contorno, tramos):
    """Recorta cada esquina con una Bézier cuadrática tangente a sus dos lados."""
    contorno = [p for i,p in enumerate(contorno) if p != contorno[i-1]]
    if len(contorno)<3:
        raise ValueError("Se requieren al menos tres puntos distintos")
    if not tramos:
        return list(contorno)
    puntos = []
    for i, p in enumerate(contorno):
        a, b = contorno[i-1], contorno[(i+1)%len(contorno)]
        la, lb = dist(a,p), dist(b,p)
        radio = min(.00024, .12*la, .12*lb)
        inicio = [x+(y-x)*radio/la for x,y in zip(p,a)]
        fin = [x+(y-x)*radio/lb for x,y in zip(p,b)]
        for j in range(tramos+1):
            t = j/tramos
            puntos.append(tuple((1-t)**2*x+2*t*(1-t)*y+t*t*z
                                for x,y,z in zip(inicio,p,fin)))
    return puntos


def extruir(contornos, espesor, material):
    # En cada corte se comparten TODOS los vértices, incluso si en una cara
    # son colineales. Esto suelda las dos franjas también al comenzar un hueco.
    if espesor <= 0 or any(len(c)<3 for c in contornos):
        raise ValueError("Contorno o espesor insuficiente")
    vertices, caras, cache, bordes = [], [], {}, set()
    lineas = defaultdict(set)
    segmentos = []
    for contorno in contornos:
        contorno = [(round(x,12), round(y,12)) for x,y in contorno]
        for i, (x,y) in enumerate(contorno):
            u,v = contorno[i-1]
            lineas[round(x,12)].add(round(y,12))
            if round(x,12) != round(u,12):
                segmentos.append(((x,y),(u,v)))
    cortes = sorted(lineas)

    def ordenada(s, x):
        (a,b),(c,d) = s
        return round(b + (d-b)*(x-a)/(c-a), 12)

    def vertice(x,y):
        clave = (x,y)
        if clave not in cache:
            cache[clave] = len(vertices)
            vertices.append((x,y,espesor/2))
        return cache[clave]

    franjas = []
    for x,u in zip(cortes,cortes[1:]):
        mitad = (x+u)/2
        vivos = sorted((s for s in segmentos if min(s[0][0],s[1][0]) < mitad <
                        max(s[0][0],s[1][0])), key=lambda s: ordenada(s,mitad))
        for s in vivos:
            for k in (x,u):
                lineas[k].add(ordenada(s,k))
        franjas.append((x,u,vivos))

    for x,u,vivos in franjas:
        for inferior, superior in zip(vivos[::2], vivos[1::2]):
            def lado(k):
                bajo, alto = ordenada(inferior,k), ordenada(superior,k)
                return [vertice(k,y) for y in sorted(lineas[k]) if bajo<=y<=alto]
            pol = lado(x)[::-1] + lado(u)
            centro = len(vertices)
            vertices.append(tuple(sum(vertices[i][j] for i in pol)/len(pol) for j in range(3)))
            for i,b in enumerate(pol):
                a = pol[i-1]
                caras.append((a,b,centro))
                if (b,a) in bordes:
                    bordes.remove((b,a))
                else:
                    bordes.add((a,b))
    n = len(vertices)
    vertices.extend((x,y,-z) for x,y,z in vertices[:])
    caras.extend(tuple(i+n for i in reversed(c)) for c in caras[:])
    caras.extend((b,a,a+n,b+n) for a,b in sorted(bordes))
    return Malla(vertices, caras, [material]*len(caras))
