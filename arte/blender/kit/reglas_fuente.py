"""Traducción de propiedades de constraints y drivers, también comprobable sin bpy."""
from .expresiones import combinar, convertir
from .lectura_glb import exigir
from .rig import EJES, gltf


def eje(valor):
    partes = valor.split("_")
    exigir(partes[-1] in ("X","Y","Z"), f"eje no admitido: {valor}")
    signo = -1 if "NEGATIVE" in partes else 1
    return gltf([signo*x for x in EJES["XYZ".index(partes[-1])]])


def restriccion(c, nombre):
    contexto = f"{c.id_data.name}/{c.name}"
    for prop, esperado in (("owner_space","WORLD"),("target_space","WORLD"),("subtarget",""),
                           ("head_tail",0),("use_bbone_shape",False),("mute",False),
                           ("use_bulge_min",False),("use_bulge_max",False)):
        exigir(getattr(c, prop, esperado) == esperado, f"{contexto}: ajuste no admitido {prop}")
    r = dict(objetivo=nombre, influencia=c.influence)
    if c.type == "COPY_LOCATION":
        def mascara(prefijo):
            return [getattr(c,prefijo+i) for i in "xzy"]
        r.update(tipo="COPIAR_POSICION", ejes=mascara("use_"), invertir=mascara("invert_"),
                 desplazamiento=c.use_offset)
    elif c.type in ("DAMPED_TRACK","LOCKED_TRACK"):
        r.update(tipo="APUNTAR", eje=eje(c.track_axis))
        if c.type == "LOCKED_TRACK":
            r.update(tipo="APUNTAR_BLOQUEADO", bloqueo=eje(c.lock_axis))
    elif c.type == "STRETCH_TO":
        volumen = {"NO_VOLUME":"NO","VOLUME_XZX":"XZ","VOLUME_X":"X","VOLUME_Z":"Z"}
        fijo = {"SWING_Y":"Y","PLANE_Z":"Z"}
        exigir(c.keep_axis in fijo and c.volume in volumen and c.rest_length > 0,
               f"{contexto}: ESTIRAR no admite {c.keep_axis}/{c.volume}/longitud {c.rest_length}")
        r.update(tipo="ESTIRAR", volumen=volumen[c.volume], eje_fijo=fijo[c.keep_axis],
                 abultamiento=c.bulge, longitud_reposo=c.rest_length)
    else:
        raise ValueError(f"{contexto}: restricción no admitida {c.type}")
    return r


def curva_identidad(puntos, extrapolacion, tolerancia=1e-6):
    """¿La FCurve del driver deja pasar el valor sin cambiarlo?

    Blender 4+/5 crea cada driver con dos claves (0,0) y (1,1), tiradores sobre la diagonal y
    extrapolación lineal: la identidad. Se admite cualquier curva cuyos puntos y tiradores estén todos
    sobre y = x, con interpolación BEZIER o LINEAR; una curva que de verdad remapea el valor no.
    `puntos` es una lista de (co, tirador_izquierdo, tirador_derecho, interpolacion)."""
    if not puntos:
        return True
    if len(puntos) < 2 or extrapolacion != "LINEAR":
        return False
    sobre = lambda p: abs(p[0] - p[1]) <= tolerancia  # noqa: E731
    return all(i in ("BEZIER", "LINEAR") and sobre(co) and sobre(hi) and sobre(hd) for co, hi, hd, i in puntos)


def expresion_driver(o, f, enlaces):
    dr = f.driver
    puntos = [(tuple(k.co), tuple(k.handle_left), tuple(k.handle_right), k.interpolation) for k in f.keyframe_points]
    exigir(dr.type == "SCRIPTED" and not dr.use_self and not f.mute and not f.sampled_points
           and curva_identidad(puntos, getattr(f, "extrapolation", "CONSTANT")), f"{o.name}: FCurve no admitida {f.data_path}")
    for md in f.modifiers:
        exigir(md.type == "GENERATOR" and md.mode == "POLYNOMIAL" and not md.use_additive
               and not md.use_restricted_range and not md.use_influence
               and tuple(md.coefficients) == (0,1), f"{o.name}: modificador de driver no identidad")
    variables = {}
    for v in dr.variables:
        t = v.targets[0]
        clave = (t.id,t.data_path)
        exigir(v.type == "SINGLE_PROP" and clave in enlaces and not getattr(t, "use_fallback_value", False),
               f"{o.name}: variable {v.name} sin enlace admitido a {t.data_path}")
        nombre, factor = enlaces[clave]
        variables[v.name] = combinar("*", nombre, factor) if factor != 1 else nombre
    return convertir(dr.expression, variables)
