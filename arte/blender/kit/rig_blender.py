"""Lectura del depsgraph y de las propiedades RNA. La composición vive en rig.py."""
import json
import re

from mathutils import Matrix

from .expresiones import combinar
from .reglas_fuente import expresion_driver, restriccion
from .lectura_glb import exigir
from .rig import canales, gltf, mandos

CANALES = ("location","delta_location","rotation_euler","delta_rotation_euler","scale","delta_scale")
C = Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))


def base_nombre(o):
    return re.sub(r"\.\d+$", "", o.name)


def ancestro(o, pivotes):
    while o is not None and o not in pivotes:
        o = o.parent
    return o


def drivers(o):
    return list(o.animation_data.drivers) if o.animation_data else []


def seleccion(escena, descriptor):
    raiz = escena.raiz
    todos = [raiz, *raiz.children_recursive]
    nombres = {o:escena.nombres.get(o, base_nombre(o)) for o in todos}
    animables = descriptor.get("ANIMABLES", ())
    pivotes = {raiz, *escena.nombres, *(o for o,_ in escena.enlaces)}
    declarados = set(animables) | descriptor.get("MANDOS", {}).keys()
    for o in todos:
        animacion = o.animation_data
        exigir(not animacion or (not animacion.action and not animacion.nla_tracks),
               f"{o.name}: la fuente contiene una acción o una pista NLA")
        if nombres[o] in declarados or (o.type == "EMPTY" and (len(o.keys()) or descriptor.get("TODOS_VACIOS"))):
            pivotes.add(o)
        for c in o.constraints:
            exigir(getattr(c, "target", None) in nombres, f"{o.name}: restricción {c.type} sin objetivo interno")
            pivotes.update((o,c.target))
        for f in drivers(o):
            pivotes.add(o)
            for v in f.driver.variables:
                obj = v.targets[0].id
                exigir(obj in nombres, f"{o.name}: variable {v.name} fuera de la máquina")
                pivotes.add(obj)
    faltan = declarados - set(nombres.values())
    exigir(not faltan, f"pivotes declarados ausentes: {sorted(faltan)}")
    nombres[raiz] = descriptor["NOMBRE"]
    # El depsgraph ya contiene los padres intermedios en su pose de reposo.
    orden = sorted(pivotes, key=lambda o: (profundidad(o), nombres[o]))
    exigir(len({nombres[o] for o in orden}) == len(orden), "nombres de pivote repetidos")
    return todos, {o:nombres[o] for o in orden}


def profundidad(o):
    n = 0
    while o.parent:
        o, n = o.parent, n+1
    return n


def descomponer(m):
    t,q,s = m.decompose()
    copia = Matrix.LocRotScale(t,q,s)
    exigir(max(abs(a-b) for fila,otra in zip(copia,m) for a,b in zip(fila,otra)) < 1e-5,
           "la matriz constante contiene cizalla no representable en TRS")
    return dict(t=gltf(t), r=gltf((q.x,q.y,q.z,q.w)), s=[s.x,s.z,s.y])


def leer_pivote(o, padre, nombres, escena, manuales, dg):
    ev = o.evaluated_get(dg)
    identidad = Matrix.Identity(4)
    # K = inversa(W del pivote padre) · W del padre original · matrix_parent_inverse.
    k = identidad
    if o.parent:
        exigir(o.parent_type == "OBJECT", f"{o.name}: padre no admitido {o.parent_type}")
        k = o.parent.evaluated_get(dg).matrix_world @ o.matrix_parent_inverse
        if padre:
            k = padre.evaluated_get(dg).matrix_world.inverted() @ k
    local = k @ ev.matrix_basis
    reposo = descomponer(local)  # El nodo glTF debe poder guardar esta TRS sin perder cizalla.
    valores = {(canal,i):v for canal in CANALES for i,v in enumerate(getattr(ev,canal))}
    conducidos = {}
    for (obj,ruta),(control,factor) in escena.enlaces.items():
        if obj == o and not ruta.startswith("["):
            m = re.fullmatch(r"(\w+)\[([012])\]", ruta)
            exigir(m and m[1] in CANALES, f"{o.name}: canal directo no admitido {ruta}")
            conducidos[m[1],int(m[2])] = control if factor == 1 else combinar("*", factor,control)
    for f in drivers(o):
        clave = (f.data_path,f.array_index)
        exigir(clave in valores and clave not in conducidos, f"{o.name}: canal no admitido o duplicado {clave}")
        conducidos[clave] = expresion_driver(o,f,escena.enlaces)
    reglas = []
    manual = manuales.get(nombres[o], []) or json.loads(o.get("rig","[]"))
    if manual:
        exigir(not conducidos, f"{o.name}: un MANDO no se puede mezclar con drivers")
        reglas.append(mandos(reposo, manual))
    if conducidos:
        reglas.append(canales(descomponer(k), o.rotation_mode, {**valores, **conducidos}))
    reglas.extend(restriccion(c, nombres[c.target]) for c in o.constraints)
    # El nodo almacena la entrada de la pila. Hornear su salida aplicaría la
    # orientación/escala del primer fotograma dos veces y cambiaría el swing.
    return local.copy(), reglas
