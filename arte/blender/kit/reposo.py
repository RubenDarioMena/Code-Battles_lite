"""Pose estática para medir los vértices del GLB con la suspensión en reposo."""
from math import atan2, cos, hypot, pi, sin, sqrt

from .geometria import cruz, por, punto, resta, unidad
from .lectura_glb import matriz
from .rig import EJES, gltf, producto, trs


def direccion(m, v):
    return tuple(sum(m[4*j+i]*v[j] for j in range(3)) for i in range(3))


def giro(m, eje, angulo):
    if hypot(*eje) < 1e-12:
        return m
    q = [*por(unidad(eje), sin(angulo/2)), cos(angulo/2)]
    resultado = producto(trs(r=q), m)
    resultado[12:15] = m[12:15]
    return resultado


def apuntar(m, eje, destino, influencia, bloqueo=None):
    actual = unidad(direccion(m, eje))
    if bloqueo is not None:
        normal = unidad(direccion(m, bloqueo))
        proyectada = resta(destino, por(normal, punto(normal, destino)))
        if hypot(*proyectada) < 1e-12:
            return m
        angulo = atan2(punto(normal, cruz(actual, proyectada)), punto(actual, proyectada))
        return giro(m, normal, influencia*angulo)
    normal = cruz(actual, destino)
    angulo = atan2(hypot(*normal), punto(actual, destino))
    if hypot(*normal) < 1e-7 and angulo > pi/2:
        # Eje auxiliar de damptrack_do_transform en el caso antiparalelo.
        ejes = [gltf(v) for v in (*EJES, *(por(e,-1) for e in EJES))]
        mas_cercano = max(range(6), key=lambda i: punto(ejes[i], eje))
        normal = cruz(actual, direccion(m, ejes[(mas_cercano+1) % 6]))
    return giro(m, normal, angulo*influencia)


def aplicar(m, r, objetivo):
    tipo, f = r["tipo"], r["influencia"]
    if not f:
        return m
    if tipo == "COPIAR_POSICION":
        m = list(m)
        for i, activo in enumerate(r["ejes"]):
            if activo:
                x = objetivo[12+i] * (-1 if r["invertir"][i] else 1)
                if not r["desplazamiento"]:
                    x -= m[12+i]
                m[12+i] += f*x
        return m

    delta = resta(objetivo[12:15], m[12:15])
    distancia = hypot(*delta)
    if distancia == 0:
        if tipo == "ESTIRAR":
            raise ValueError("ESTIRAR tiene longitud cero en reposo")
        return m
    destino = por(delta, 1/distancia)
    if tipo in ("APUNTAR_BLOQUEADO", "ESTIRAR"):
        # Para estos dos modos Blender trata la cizalla especialmente. En el
        # perfil rígido las columnas de entrada en reposo deben ser ortogonales.
        ejes = [unidad(m[j:j+3]) for j in (0,4,8)]
        if any(abs(punto(ejes[i],ejes[j])) > 1e-5 for i,j in ((0,1),(0,2),(1,2))):
            raise ValueError(f"{tipo}: cizalla mundial en reposo no admitida")
        if tipo == "ESTIRAR" and r["eje_fijo"] == "Z" and punto(ejes[0],cruz(*ejes[1:])) < 0:
            raise ValueError("ESTIRAR PLANE_Z: reflexión mundial en reposo no admitida")
    if tipo != "ESTIRAR":
        return apuntar(m, r["eje"], destino, f, r.get("bloqueo"))

    # Convenciones RNA: longitudinal Y de Blender = -Z de glTF,
    # transversal X de Blender = X, transversal Z de Blender = Y.
    eje = (0,0,-1)
    relativo = distancia / (r["longitud_reposo"] * hypot(*direccion(m,eje)))
    volumen = r["volumen"]
    bulge = relativo**(-r["abultamiento"]) if volumen != "NO" else 1
    fx = sqrt(bulge) if volumen == "XZ" else bulge if volumen == "X" else 1
    fy = sqrt(bulge) if volumen == "XZ" else bulge if volumen == "Z" else 1
    if r["eje_fijo"] == "Y":
        orientada = apuntar(m,eje,destino,f)
    else:
        # PLANE_Z conserva el plano entre el antiguo Z de Blender y el objetivo.
        # En glTF sus nuevas columnas son X, Y y -dirección.
        z = por(destino,-1)
        x = unidad(cruz(direccion(m,(0,1,0)),z))
        y = cruz(z,x)
        # Rotación entre las dos bases ortonormales. Extraer su eje/ángulo
        # permite mezclar la influencia por el arco corto, incluida media vuelta.
        anterior = [unidad(m[k:k+3]) for k in (0,4,8)]
        nueva = (x,y,z)
        relativo_rot = [[sum(nueva[k][i]*anterior[k][j] for k in range(3))
                         for j in range(3)] for i in range(3)]
        a = relativo_rot
        normal = (a[2][1]-a[1][2],a[0][2]-a[2][0],a[1][0]-a[0][1])
        traza = sum(a[i][i] for i in range(3))-1
        angulo = atan2(hypot(*normal),traza)
        if hypot(*normal) < 1e-8 and traza < 0:
            i = max(range(3),key=lambda j:a[j][j])
            normal = tuple(a[j][i]+int(i==j) for j in range(3))
        orientada = giro(m,normal,f*angulo)
    return producto(orientada, trs(s=[1+f*(s-1) for s in (fx,fy,relativo)]))


def mundos(orden, pivotes, padres, reglas):
    resultado = {}
    for k in orden:
        if k not in pivotes:  # las fuentes del grafo incluyen los controles
            continue
        m = producto(resultado[padres[k]], matriz(pivotes[k])) if padres[k] else matriz(pivotes[k])
        for r in reglas.get(k, ()):
            if r["tipo"] != "LOCAL":  # coincidencia LOCAL/TRS ya comprobada
                try:
                    m = aplicar(m,r,resultado[r["objetivo"]])
                except (ValueError, ArithmeticError) as exc:
                    raise ValueError(f"{k}/{r['tipo']}: {exc}") from exc
        resultado[k] = m
    return resultado
