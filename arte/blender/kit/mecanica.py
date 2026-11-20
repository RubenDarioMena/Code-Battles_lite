from math import cos, pi, sin, tau

from .estructura import SEGMENTOS, caja, tubo
from .geometria import (cruz, ensamblar, pieza, por, resta, suma, superficie,
                        torno, unidad)


def casquillo(ri, ro, h, detalle, material):
    b = min((ro-ri)*.18,h*.08)
    perfil = [(ro,-h/2),(ro,h/2),(ri,h/2),(ri,-h/2)]
    if detalle==0:
        perfil = [(ro-b,-h/2),(ro,-h/2+b),(ro,h/2-b),(ro-b,h/2),
                  (ri+b,h/2),(ri,h/2-b),(ri,-h/2+b),(ri+b,-h/2)]
    return torno(perfil,SEGMENTOS[detalle],material,True)


def bola(r, detalle, material):
    n = (10,6,4)[detalle]
    perfil = [(0,-r)]+[(r*sin(pi*i/n),-r*cos(pi*i/n)) for i in range(1,n)]+[(0,r)]
    return torno(perfil,(16,12,8)[detalle],material)


@pieza("rodamiento")
def rodamiento(diametro=.16, agujero=.07, ancho=.034, material="acero", *, detalle):
    r,i = diametro/2, agujero/2
    if not 0<i<r or ancho<=0:
        raise ValueError("Dimensiones de rodamiento inválidas")
    pista = (r+i)/2
    rb = min((r-i)*.24,ancho*.46)
    partes = [casquillo(i,pista-rb,ancho,detalle,material),
              casquillo(pista+rb,r,ancho,detalle,material)]
    if detalle==0:
        for j in range(12):
            a = tau*j/12
            partes.append(bola(rb,1,"cromo").trasladar((pista*cos(a),pista*sin(a),0)))
    else:
        partes.append(casquillo(pista-rb,pista+rb,ancho*.75,detalle,"grafito"))
    return ensamblar(*partes)


@pieza("eje")
def eje(diametro=.055, longitud=.28, material="acero", *, detalle):
    r,h = diametro/2,longitud/2
    cuerpo = torno([(r*.9,-h),(r,-h+r*.1),(r,h-r*.1),(r*.9,h)],SEGMENTOS[detalle],material)
    chaveta = caja(r*.55,r*.34,longitud*.56,r*.07,"bronce",detalle=detalle)
    return ensamblar(cuerpo,chaveta.trasladar((0,r*1.04,0)))


@pieza("cardan")
def cardan(diametro=.14, longitud=.25, material="acero", *, detalle):
    r,h = diametro/2,longitud/2
    partes = []
    for signo in (-1,1):
        base = torno([(r*.46,-h),(r*.46,-.66*h),(r*.84,-.55*h),
                      (r*.84,-.43*h)],SEGMENTOS[detalle],material)
        horquilla = [base]
        for lado in (-1,1):
            brazo = caja(.28*r,.55*r,.52*h,.08*r,material,detalle=detalle)
            horquilla.append(brazo.trasladar((lado*.68*r,0,-.22*h)))
            oreja = casquillo(.22*r,.33*r,.28*r,detalle,material)
            horquilla.append(oreja.alinear((1,0,0)).trasladar((lado*.68*r,0,0)))
        grupo = ensamblar(*horquilla)
        if signo==1:
            grupo = grupo.rotar((1,0,0),pi).rotar((0,0,1),pi/2)
        partes.append(grupo)
    for x,y in ((r,0),(0,r)):
        partes.append(tubo((-x,-y,0),(x,y,0),r*.21,material="bronce",detalle=detalle))
    return ensamblar(*partes)


@pieza("rotula")
def heim(diametro=.12, longitud=.17, agujero=.032, material="acero", *, detalle):
    r,orificio = diametro/2,agujero/2
    if not 0<orificio<r*.6 or longitud<=diametro:
        raise ValueError("Dimensiones de rótula inválidas")
    aro = casquillo(r*.7,r,r*.48,detalle,material)
    perfil = [(r*.52,-r*.46),(r*.65,-r*.27),(r*.70,0),
              (r*.65,r*.27),(r*.52,r*.46),(orificio,r*.46),(orificio,-r*.46)]
    cojinete = torno(perfil,SEGMENTOS[detalle],"cromo",True)
    cola = tubo((0,-longitud+r,0),(0,-.85*r,0),r*.33,material=material,detalle=detalle)
    return ensamblar(aro,cojinete,cola)


@pieza("resorte")
def resorte(diametro=.094, hilo=.009, longitud=.23, vueltas=6, material="acero", *, detalle):
    if vueltas<2 or not 0<hilo<diametro/2 or longitud<=vueltas*hilo:
        raise ValueError("El resorte necesita espacio entre vueltas")
    r = (diametro-hilo)/2
    n = max(8,round(vueltas*(32,20,12)[detalle]))
    puntos = []
    for j in range(n+1):
        u = vueltas*j/n
        # Un cuarto de vuelta plano en cada asiento, con tangente horizontal.
        z = max(0,min(1,(u-.25)/(vueltas-.5)))*(longitud-hilo)
        puntos.append((r*cos(tau*u),r*sin(tau*u),z-(longitud-hilo)/2))
    # Marco radial explícito: el diámetro exterior se conserva en las cuatro
    # direcciones cardinales. La segunda dirección es normal al paso de hélice.
    filas = []
    for j,p in enumerate(puntos):
        a = tau*vueltas*j/n
        radial = (cos(a),sin(a),0)
        tangente = resta(puntos[min(j+1,n)],puntos[max(j-1,0)])
        lateral = unidad(cruz(tangente,radial))
        lados = (12,8,4)[detalle]
        filas.append([suma(p,por(suma(por(radial,cos(tau*i/lados)),
                                      por(lateral,sin(tau*i/lados))),hilo/2)) for i in range(lados)])
    return superficie(filas,material)


@pieza("amortiguador")
def amortiguador(longitud=.38, diametro=.072, fuelle=True, material="pintura", *, detalle):
    r,h = diametro/2,longitud
    perfil = [(r*.88,0),(r*.96,.02*h),(r*.96,.54*h),(r,.55*h),(r,.59*h),
              (r*.43,.59*h),(r*.43,h)]
    cuerpo = torno(perfil,SEGMENTOS[detalle],material)
    # El hombro y el vástago comparten una única piel.
    n = SEGMENTOS[detalle]
    cuerpo.materiales[5*n:6*n] = ["cromo"]*n
    cuerpo.materiales[-1] = "cromo"
    if fuelle:
        perfil = [(r*.45,.59*h)]
        for j in range((8,5,2)[detalle]):
            paso = .23*h/(8,5,2)[detalle]
            base = .59*h+j*paso
            perfil.extend([(r*.71,base+.15*paso),(r*.86,base+.48*paso),
                           (r*.66,base+.9*paso)])
        perfil.extend([(r*.45,.82*h),(r*.45,.60*h)])
        cuerpo = ensamblar(cuerpo,torno(perfil,n,"goma",True))
    return cuerpo


@pieza("led")
def led(diametro=.044, alto=.026, material="luz", *, detalle):
    r = diametro/2
    base = torno([(r,0),(r,.30*alto),(r*.81,.30*alto)],SEGMENTOS[detalle],"grafito")
    lente = torno([(r*.8,.30*alto),(r*.78,.59*alto),(r*.56,.87*alto),
                   (0,alto)],SEGMENTOS[detalle],material)
    return ensamblar(base,lente)
