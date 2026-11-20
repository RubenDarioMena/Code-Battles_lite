"""Cambios de base y composición de canales. Matrices 4×4 en orden de columnas."""
import math
from .expresiones import combinar, evaluar

CERO = (0, 0, 0)
UNO = (1, 1, 1)
Q = (0, 0, 0, 1)
EJES = ((1, 0, 0), (0, 1, 0), (0, 0, 1))


def gltf(v):
    return [v[0], v[2], -v[1], *v[3:]]


def blender(v):
    return [v[0], -v[2], v[1], *v[3:]]


def producto(a, b):
    return [sum(a[k*4+i] * b[j*4+k] for k in range(4)) for j in range(4) for i in range(4)]


def punto(m, v):
    return [m[12+i] + sum(m[k*4+i]*v[k] for k in range(3)) for i in range(3)]


def trs(t=CERO, r=Q, s=UNO):
    x, y, z, w = r
    columnas = ((1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w)),
                (2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w)),
                (2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y)))
    return [v for col, escala in zip(columnas, s) for v in (*[c*escala for c in col], 0)] + [*t, 1]


def canales(base, modo, valores):
    if modo not in ("XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"):
        raise ValueError(f"modo de canales no admitido: {modo}")
    def canal(nombre, indice):
        return valores.get((nombre, indice), 1 if nombre.endswith("scale") else 0)
    t = [combinar("+", canal("location", i), canal("delta_location", i)) for i in range(3)]
    s = [combinar("*", canal("scale", i), canal("delta_scale", i)) for i in range(3)]
    rotaciones = []
    for prefijo in ("delta_", ""):
        for letra in reversed(modo):
            i = "XYZ".index(letra)
            a = canal(prefijo + "rotation_euler", i)
            if a != 0:
                rotaciones.append(dict(eje=gltf(EJES[i]), angulo=a))
    return dict(tipo="LOCAL", base=base, traslacion=[t[0], t[2], combinar("neg", t[1])],
                rotaciones=rotaciones, escala=[s[0], s[2], s[1]])


def mandos(base, reglas):
    local = dict(tipo="LOCAL", base=base, traslacion=[0]*3, rotaciones=[], escala=[1]*3)
    for r in reglas:
        if r["tipo"] != "MANDO":
            raise ValueError(f"regla manual desconocida: {r}")
        a = combinar("*", r["factor"], r["mando"])
        if r["canal"] == "rotacion":
            local["rotaciones"].append(dict(eje=r["eje"], angulo=a))
        elif r["canal"] == "traslacion":
            for i, e in enumerate(r["eje"]):
                if e:
                    local["traslacion"][i] = combinar("+", local["traslacion"][i], combinar("*", e, a))
        else:
            raise ValueError(f"canal MANDO desconocido: {r}")
    return local


def evaluar_local(regla, controles, usados=None):
    def valor(expr):
        return evaluar(expr, controles, usados)
    base = regla["base"]
    m = producto(trs(**base), trs(t=list(map(valor, regla["traslacion"]))))
    for r in regla["rotaciones"]:
        a = valor(r["angulo"])/2
        q = [e*math.sin(a) for e in r["eje"]] + [math.cos(a)]
        m = producto(m, trs(r=q))
    return producto(m, trs(s=list(map(valor, regla["escala"]))))
