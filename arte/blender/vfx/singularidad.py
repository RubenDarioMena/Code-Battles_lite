"""Singularidad (black hole) de Code Battle Lite / Codemageddon: prototipo del ultimate.

Blender pone lo que es 3D de verdad —un escenario de prueba con color y profundidad, y el disco
de acreción como malla con shader procedural— y un pase de numpy hace lo que hará el motor en
espacio de pantalla: lente gravitacional localizada con profundidad, horizonte, anillo de
fotones, materia en espiral sin estado, destello y onda. Las cinco fases salen de `parametros(t)`,
que es la única fuente de la animación y se exporta a JSON para el motor.

Sin ventana:
    blender -b --factory-startup --python arte/blender/vfx/singularidad.py -- --salida <carpeta>
        [--calidad borrador|final] [--modo completo|simple] [--orbita 0] [--elevacion 38]
        [--cuadros 10,40,80] [--nombre singularidad]

Convenciones:
- 1 m = 1 casilla; el suelo es z = 0 y la singularidad flota en CENTRO.
- `radio` (sombra del horizonte) y `lente` (radio de Einstein) son independientes: en la
  compresión el radio baja mientras la lente sube.
- Nada de esto mueve entidades ni decide daño: el juego informa el estado
  (charging → active → collapsing → complete) y el efecto solo lo dibuja.
- `--modo simple` es la ruta degradada: núcleo, disco y partículas, sin lente ni bloom.
"""
import argparse
import json
import math
import os
import sys
import tempfile
import time

import bpy
import numpy as np
from mathutils import Euler, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import a_bytes, a_srgb, escribir_jpg, escribir_png, hoja, leer_exr, nodos, tono, video  # noqa: E402

FPS = 20
CENTRO = Vector((0.0, 0.0, 2.3))
INCLINACION = (math.radians(16), math.radians(-8), 0.0)  # del disco respecto al suelo
FOV_Y = 38.0  # el de la cámara del juego

# Duración de cada fase en segundos y el estado de juego que la gobierna.
FASES = (("carga", 1.2, "charging"), ("expansion", 1.0, "active"), ("acrecion", 3.0, "active"),
         ("compresion", 1.3, "collapsing"), ("liberacion", 1.1, "collapsing"))
RADIO = 1.15       # sombra del horizonte en la fase de acreción, en metros
DISCO_INT, DISCO_EXT = 1.3, 4.8  # borde interior y exterior del disco, en radios del horizonte

CALIDADES = {
    "borrador": dict(ancho=512, alto=288, muestras=16, muestras_disco=6),
    "final": dict(ancho=768, alto=432, muestras=48, muestras_disco=12),
}


# ------------------------------------------------------------------ animación


def suave(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def limites():
    t, out = 0.0, {}
    for nombre, dur, _ in FASES:
        out[nombre] = (t, t + dur)
        t += dur
    return out, t


def parametros(t):
    """Todo lo que cambia con el tiempo. Sin estado: se puede evaluar en cualquier orden."""
    lim, total = limites()

    def u(fase):
        a, b = lim[fase]
        return (t - a) / (b - a)

    p = dict(t=t, fase="fin", radio=0.0, lente=0.0, disco=0.0, aberracion=0.0, oscurecer=0.0,
             fotones=0.0, destello=0.0, onda=-1.0, tiempo_disco=t)
    if t < lim["carga"][1]:
        k = u("carga")
        p.update(fase="carga", radio=0.03 + 0.12 * suave(k), lente=0.55 * suave(k),
                 disco=0.25 * suave(k), aberracion=0.02 * k, oscurecer=0.18 * k, fotones=0.3 * k)
    elif t < lim["expansion"][1]:
        k = u("expansion")
        rebote = 1 + 0.12 * math.sin(math.pi * k) * (1 - k)
        p.update(fase="expansion", radio=(0.15 + (RADIO - 0.15) * suave(k)) * rebote,
                 lente=0.55 + 1.15 * suave(k), disco=0.25 + 0.75 * suave(k), aberracion=0.02 - 0.008 * k,
                 oscurecer=0.18 + 0.27 * k, fotones=0.3 + 0.7 * k)
    elif t < lim["acrecion"][1]:
        k = u("acrecion")
        ta = t - lim["acrecion"][0]
        p.update(fase="acrecion", radio=RADIO * (1 + 0.025 * math.sin(ta * 3.9)),
                 lente=1.7 + 0.3 * k, disco=1.0 + 0.10 * math.sin(ta * 7.0) * math.sin(ta * 2.3),
                 aberracion=0.012, oscurecer=0.45, fotones=1.0)
    elif t < lim["compresion"][1]:
        k = u("compresion")
        p.update(fase="compresion", radio=RADIO + (0.13 - RADIO) * k ** 2.2,
                 lente=2.0 + 1.5 * k ** 1.6, disco=1.0 + 0.9 * k, aberracion=0.012 + 0.03 * k ** 2,
                 oscurecer=0.45 + 0.2 * k, fotones=1.0 + 1.5 * k)
    elif t < lim["liberacion"][1]:
        tl = t - lim["liberacion"][0]
        ceder = max(0.0, 1 - tl / 0.16)
        p.update(fase="liberacion", radio=0.13 * ceder ** 2, lente=3.5 * ceder ** 2, disco=1.9 * ceder ** 3,
                 aberracion=0.042 * ceder, oscurecer=0.65 * max(0.0, 1 - tl / 0.35), fotones=2.5 * ceder,
                 destello=math.exp(-tl / 0.10), onda=tl)
    return p


# ------------------------------------------------------------------ escenario de prueba


def _material(nombre, color, rugosidad=0.6):
    m = bpy.data.materials.new(nombre)
    nt = nodos(m)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rugosidad
    nt.links.new(b.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
    return m


def _caja(nombre, x, y, ancho, fondo, alto, mat, col):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, alto / 2))
    o = bpy.context.object
    o.name = nombre
    o.scale = (ancho, fondo, alto)
    o.data.materials.append(mat)
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    return o


def escenario():
    """Suelo cuadriculado, calle, edificios y postes: líneas rectas que delatan cualquier deformación."""
    sc = bpy.context.scene
    col = bpy.data.collections.new("escenario")
    sc.collection.children.link(col)

    bpy.ops.mesh.primitive_plane_add(size=120)
    suelo = bpy.context.object
    suelo.name = "suelo"
    m = bpy.data.materials.new("suelo")
    nt = nodos(m)
    N, L = nt.nodes.new, nt.links.new
    co = N("ShaderNodeTexCoord")
    dam = N("ShaderNodeTexChecker")
    dam.inputs["Scale"].default_value = 1.0
    dam.inputs["Color1"].default_value = (0.47, 0.50, 0.42, 1)
    dam.inputs["Color2"].default_value = (0.40, 0.43, 0.36, 1)
    L(co.outputs["Object"], dam.inputs["Vector"])
    grande = N("ShaderNodeTexChecker")
    grande.inputs["Scale"].default_value = 0.25
    grande.inputs["Color1"].default_value = (1, 1, 1, 1)
    grande.inputs["Color2"].default_value = (0.86, 0.86, 0.86, 1)
    L(co.outputs["Object"], grande.inputs["Vector"])
    mez = N("ShaderNodeMixRGB")
    mez.blend_type = "MULTIPLY"
    mez.inputs["Fac"].default_value = 1.0
    L(dam.outputs["Color"], mez.inputs["Color1"])
    L(grande.outputs["Color"], mez.inputs["Color2"])
    b = N("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = 0.8
    L(mez.outputs["Color"], b.inputs["Base Color"])
    L(b.outputs[0], N("ShaderNodeOutputMaterial").inputs["Surface"])
    suelo.data.materials.append(m)
    for c in suelo.users_collection:
        c.objects.unlink(suelo)
    col.objects.link(suelo)

    crema = _material("crema", (0.80, 0.74, 0.62))
    grafito = _material("grafito", (0.07, 0.08, 0.09))
    turquesa = _material("turquesa", (0.03, 0.26, 0.29))
    amarillo = _material("amarillo", (0.82, 0.40, 0.04))
    naranja = _material("naranja", (0.65, 0.11, 0.04))
    asfalto = _material("asfalto", (0.05, 0.05, 0.055), 0.9)
    blanco = _material("blanco", (0.85, 0.85, 0.82))

    # Calle detrás de la singularidad, con línea discontinua.
    _caja("calle", 0, 7.0, 60, 3.0, 0.04, asfalto, col)
    for i in range(-14, 15):
        _caja(f"raya{i}", i * 2.0, 7.0, 1.0, 0.14, 0.06, blanco, col)
    # Edificios: detrás, a los lados y uno delante para probar la oclusión.
    edificios = [(-7.5, 11.5, 4, 4, 5.5, crema), (-2.0, 12.5, 3, 3, 8.0, turquesa), (3.5, 11.5, 5, 3, 4.0, crema),
                 (9.0, 12.0, 3, 4, 6.5, grafito), (-12.0, 4.0, 3, 5, 3.5, turquesa), (11.5, 3.0, 4, 4, 4.5, crema),
                 (-9.0, -5.0, 3, 3, 2.5, grafito), (8.5, -6.0, 4, 3, 3.0, turquesa), (-15.0, 12.0, 4, 4, 9.0, grafito),
                 (15.5, 10.0, 4, 5, 7.0, turquesa)]
    for i, (x, y, w, d, h, mat) in enumerate(edificios):
        _caja(f"edificio{i}", x, y, w, d, h, mat, col)
        _caja(f"azotea{i}", x, y, w + 0.3, d + 0.3, 0.25, amarillo if i % 3 == 0 else grafito, col).location.z = h + 0.12
        for k in range(1, int(h // 1.4)):  # franjas de ventanas
            _caja(f"franja{i}_{k}", x, y, w + 0.04, d + 0.04, 0.22, grafito if mat is not grafito else crema,
                  col).location.z = k * 1.4
    # Postes a lo largo de la calle y una torre delante de la singularidad (no debe deformarse).
    for i in range(-5, 6):
        _caja(f"poste{i}", i * 4.0 + 1.0, 5.2, 0.16, 0.16, 3.2, grafito, col)
        _caja(f"farol{i}", i * 4.0 + 1.0, 5.2, 0.5, 0.3, 0.14, amarillo, col).location.z = 3.25
    _caja("torre_delante", 4.2, -6.0, 0.7, 0.7, 6.0, naranja, col)
    _caja("torre_delante_tope", 4.2, -6.0, 1.3, 1.3, 0.3, grafito, col).location.z = 6.1
    for i, (x, y) in enumerate(((-4.5, -3.0), (-3.0, 2.5), (4.5, 1.5), (5.5, -2.0), (-6.0, 0.5), (1.0, 4.0))):
        _caja(f"unidad{i}", x, y, 0.9, 0.9, 0.6, turquesa if i % 2 else naranja, col)
        _caja(f"unidad_torre{i}", x, y, 0.5, 0.5, 0.35, crema, col).location.z = 0.78

    sol = bpy.data.lights.new("sol", "SUN")
    sol.energy = 3.4
    sol.angle = math.radians(4)
    so = bpy.data.objects.new("sol", sol)
    col.objects.link(so)
    so.rotation_euler = (math.radians(52), 0, math.radians(-40))
    mundo = bpy.data.worlds.new("cielo")
    sc.world = mundo
    nt = nodos(mundo)
    N, L = nt.nodes.new, nt.links.new
    co = N("ShaderNodeTexCoord")
    sep = N("ShaderNodeSeparateXYZ")
    L(co.outputs["Generated"], sep.inputs[0])
    rampa = N("ShaderNodeValToRGB")
    rampa.color_ramp.elements[0].position, rampa.color_ramp.elements[0].color = 0.0, (0.78, 0.82, 0.84, 1)
    rampa.color_ramp.elements[1].position, rampa.color_ramp.elements[1].color = 0.35, (0.30, 0.48, 0.74, 1)
    L(sep.outputs["Z"], rampa.inputs["Fac"])
    fondo = N("ShaderNodeBackground")
    fondo.inputs["Strength"].default_value = 1.0
    L(rampa.outputs["Color"], fondo.inputs["Color"])
    L(fondo.outputs[0], N("ShaderNodeOutputWorld").inputs["Surface"])
    return col


def camara(calidad, elevacion, yaw):
    sc = bpy.context.scene
    cam = bpy.data.cameras.new("camara")
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = math.radians(FOV_Y)
    cam.clip_start, cam.clip_end = 0.1, 400
    co = bpy.data.objects.new("camara", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = calidad["ancho"], calidad["alto"]
    sc.render.resolution_percentage = 100
    orientar(co, elevacion, yaw)
    return co


def orientar(co, elevacion, yaw, dist=23.0):
    el, az = math.radians(elevacion), math.radians(yaw)
    objetivo = Vector((0.0, 0.5, 1.7))
    co.location = objetivo + dist * Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
    co.rotation_euler = (objetivo - co.location).to_track_quat("-Z", "Y").to_euler()


def material_profundidad():
    m = bpy.data.materials.new("profundidad")
    nt = nodos(m)
    cd = nt.nodes.new("ShaderNodeCameraData")
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(cd.outputs["View Z Depth"], em.inputs["Color"])
    nt.links.new(em.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
    return m


# ------------------------------------------------------------------ disco de acreción


def disco():
    """Malla plana con shader procedural. En unidades del objeto el horizonte mide 1: la escala es el radio."""
    bpy.ops.mesh.primitive_circle_add(vertices=128, radius=DISCO_EXT + 0.1, fill_type="NGON", location=CENTRO)
    o = bpy.context.object
    o.name = "disco"
    o.rotation_euler = Euler(INCLINACION)
    o.visible_shadow = False
    m = bpy.data.materials.new("disco")
    nt = nodos(m)
    N, L = nt.nodes.new, nt.links.new

    def val(nombre, v):
        n = N("ShaderNodeValue")
        n.name = n.label = nombre
        n.outputs[0].default_value = v
        return n.outputs[0]

    def mat(op, a, b=None, c=None):
        n = N("ShaderNodeMath")
        n.operation = op
        for i, x in enumerate((a, b, c)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                n.inputs[i].default_value = x
            else:
                L(x, n.inputs[i])
        return n.outputs[0]

    tiempo = val("tiempo", 0.0)
    brillo = val("brillo", 1.0)
    co = N("ShaderNodeTexCoord")
    sep = N("ShaderNodeSeparateXYZ")
    L(co.outputs["Object"], sep.inputs[0])
    x, y = sep.outputs["X"], sep.outputs["Y"]
    r = mat("SQRT", mat("ADD", mat("MULTIPLY", x, x), mat("MULTIPLY", y, y)))
    phi = mat("ARCTAN2", y, x)
    omega = mat("MULTIPLY", mat("POWER", mat("MAXIMUM", r, 0.5), -1.5), 2.6)  # rotación kepleriana, rad/s

    # Dos fases desfasadas medio ciclo (técnica de mapa de flujo): la rotación diferencial enrolla
    # el ruido sin fin; cada fase se reinicia cuando su peso es cero y así nunca se ve el salto.
    ciclo = 2.4
    capas = []
    for desfase, semilla in ((0.0, 0.0), (0.5, 37.0)):
        fase = mat("FRACT", mat("ADD", mat("DIVIDE", tiempo, ciclo), desfase))
        peso = mat("SUBTRACT", 1.0, mat("ABSOLUTE", mat("SUBTRACT", mat("MULTIPLY", fase, 2.0), 1.0)))
        ang = mat("SUBTRACT", phi, mat("MULTIPLY", omega, mat("MULTIPLY", mat("SUBTRACT", fase, 0.5), ciclo)))
        valor = None
        for a_, b_, det, w in ((2.2, 3.0, 5.0, 0.65), (6.0, 9.0, 3.0, 0.35)):  # bandas anchas y filamentos
            vec = N("ShaderNodeCombineXYZ")
            L(mat("MULTIPLY", mat("COSINE", ang), a_), vec.inputs["X"])
            L(mat("MULTIPLY", mat("SINE", ang), a_), vec.inputs["Y"])
            L(mat("ADD", mat("MULTIPLY", r, b_), semilla), vec.inputs["Z"])
            ruido = N("ShaderNodeTexNoise")
            ruido.inputs["Scale"].default_value = 1.0
            ruido.inputs["Detail"].default_value = det
            ruido.inputs["Roughness"].default_value = 0.62
            L(vec.outputs[0], ruido.inputs["Vector"])
            parte = mat("MULTIPLY", ruido.outputs["Fac"], w)
            valor = parte if valor is None else mat("ADD", valor, parte)
        capas.append(mat("MULTIPLY", valor, peso))
    ruido = mat("ADD", capas[0], capas[1])
    contraste = mat("POWER", mat("MAXIMUM", mat("SUBTRACT", mat("MULTIPLY", ruido, 2.1), 0.48), 0.0), 1.6)

    # Perfil radial: nace en el borde interior, cae hacia fuera y se apaga antes del borde de la malla.
    dentro = N("ShaderNodeMapRange")
    dentro.interpolation_type = "SMOOTHSTEP"
    dentro.inputs["From Min"].default_value, dentro.inputs["From Max"].default_value = DISCO_INT, DISCO_INT + 0.28
    L(r, dentro.inputs["Value"])
    fuera = N("ShaderNodeMapRange")
    fuera.interpolation_type = "SMOOTHSTEP"
    fuera.inputs["From Min"].default_value, fuera.inputs["From Max"].default_value = DISCO_EXT - 2.2, DISCO_EXT
    fuera.inputs["To Min"].default_value, fuera.inputs["To Max"].default_value = 1.0, 0.0
    L(r, fuera.inputs["Value"])
    caida = mat("POWER", mat("DIVIDE", DISCO_INT, mat("MAXIMUM", r, DISCO_INT)), 1.25)
    perfil = mat("MULTIPLY", mat("MULTIPLY", dentro.outputs["Result"], fuera.outputs["Result"]), caida)

    # Efecto Doppler: el lado que gira hacia la cámara brilla más.
    geo = N("ShaderNodeNewGeometry")
    vt = N("ShaderNodeVectorTransform")
    vt.vector_type = "VECTOR"
    vt.convert_from, vt.convert_to = "WORLD", "OBJECT"
    L(geo.outputs["Incoming"], vt.inputs[0])
    nor = N("ShaderNodeVectorMath")
    nor.operation = "NORMALIZE"
    L(vt.outputs[0], nor.inputs[0])
    tang = N("ShaderNodeCombineXYZ")
    L(mat("MULTIPLY", mat("SINE", phi), -1.0), tang.inputs["X"])
    L(mat("COSINE", phi), tang.inputs["Y"])
    dot = N("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    L(tang.outputs[0], dot.inputs[0])
    L(nor.outputs[0], dot.inputs[1])
    doppler = mat("POWER", mat("ADD", 1.0, mat("MULTIPLY", dot.outputs["Value"], 0.38)), 2.5)

    fuerza = mat("MULTIPLY", mat("MULTIPLY", perfil, mat("ADD", contraste, 0.06)), doppler)
    # Color por temperatura: blanco azulado junto al horizonte, oro, naranja y rojo hacia fuera.
    temp = mat("MULTIPLY", mat("POWER", mat("DIVIDE", DISCO_INT, mat("MAXIMUM", r, DISCO_INT)), 0.9),
               mat("ADD", 0.38, mat("MULTIPLY", contraste, 0.5)))
    rampa = N("ShaderNodeValToRGB")
    e = rampa.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0.40, 0.015, 0.0, 1)
    e[1].position, e[1].color = 1.0, (1.0, 0.93, 0.82, 1)
    for pos, c in ((0.3, (1.0, 0.16, 0.01, 1)), (0.7, (1.0, 0.50, 0.10, 1))):
        k = e.new(pos)
        k.color = c
    L(mat("MULTIPLY", temp, mat("POWER", doppler, 0.35)), rampa.inputs["Fac"])
    emi = N("ShaderNodeEmission")
    L(rampa.outputs["Color"], emi.inputs["Color"])
    L(mat("MULTIPLY", mat("MULTIPLY", fuerza, brillo), 7.0), emi.inputs["Strength"])
    tr = N("ShaderNodeBsdfTransparent")
    mez = N("ShaderNodeMixShader")
    L(mat("MINIMUM", mat("MULTIPLY", mat("MULTIPLY", fuerza, brillo), 3.0), 1.0), mez.inputs["Fac"])
    L(tr.outputs[0], mez.inputs[1])
    L(emi.outputs[0], mez.inputs[2])
    L(mez.outputs[0], N("ShaderNodeOutputMaterial").inputs["Surface"])
    o.data.materials.append(m)
    return o, nt.nodes["tiempo"].outputs[0], nt.nodes["brillo"].outputs[0]


# ------------------------------------------------------------------ pase de pantalla (lo que hará el motor)


class Vista:
    """Proyección de la cámara de Blender para hacer en numpy las cuentas del shader."""

    def __init__(self, co, w, h):
        self.w, self.h = w, h
        self.inv = np.array(co.matrix_world.inverted(), np.float64)
        self.mat = np.array(co.matrix_world, np.float64)
        self.ty = math.tan(math.radians(FOV_Y) / 2)
        self.tx = self.ty * w / h
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        self.X, self.Y = xx + 0.5, yy + 0.5

    def proyectar(self, p):
        """Puntos del mundo (n, 3) → x, y en píxeles y profundidad a lo largo del eje de la cámara."""
        p = np.atleast_2d(p)
        c = p @ self.inv[:3, :3].T + self.inv[:3, 3]
        z = -c[:, 2]
        zs = np.maximum(z, 1e-3)
        x = (c[:, 0] / zs / self.tx * 0.5 + 0.5) * self.w
        y = (0.5 - c[:, 1] / zs / self.ty * 0.5) * self.h
        return x, y, z

    def profundidad_plano(self, punto, normal):
        """Profundidad por píxel de un plano infinito (el del disco)."""
        dx = (self.X / self.w * 2 - 1) * self.tx
        dy = (1 - self.Y / self.h * 2) * self.ty
        d = np.stack([dx, dy, -np.ones_like(dx)], axis=-1) @ self.mat[:3, :3].T
        o = self.mat[:3, 3]
        den = d @ normal
        s = ((punto - o) @ normal) / np.where(np.abs(den) < 1e-6, 1e-6, den)
        return np.where(s > 0, s, np.inf).astype(np.float32)


def muestrear(img, x, y):
    """Bilineal con reflejo en los bordes: lo que queda fuera de pantalla no existe para este pase."""
    h, w = img.shape[:2]
    x = np.abs(x - 0.5)
    y = np.abs(y - 0.5)
    x = np.where(x > w - 1, 2 * (w - 1) - x, x).clip(0, w - 1)
    y = np.where(y > h - 1, 2 * (h - 1) - y, y).clip(0, h - 1)
    x0, y0 = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32)
    x1, y1 = np.minimum(x0 + 1, w - 1), np.minimum(y0 + 1, h - 1)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    if img.ndim == 2:
        fx, fy = fx[..., 0], fy[..., 0]
    return (img[y0, x0] * (1 - fx) + img[y0, x1] * fx) * (1 - fy) + (img[y1, x0] * (1 - fx) + img[y1, x1] * fx) * fy


def escalon(a, b, x):
    u = np.clip((x - a) / (b - a), 0.0, 1.0)
    return u * u * (3 - 2 * u)


def desenfoque(img, radio):
    """Gaussiano aproximado con tres pasadas de caja (sumas acumuladas)."""
    out = img
    for _ in range(3):
        for eje in (0, 1):
            pad = [(0, 0)] * out.ndim
            pad[eje] = (radio + 1, radio)
            c = np.cumsum(np.pad(out, pad, mode="edge"), axis=eje, dtype=np.float32)
            n = out.shape[eje]
            a = np.take(c, range(2 * radio + 1, 2 * radio + 1 + n), axis=eje)
            b = np.take(c, range(0, n), axis=eje)
            out = (a - b) / (2 * radio + 1)
    return out


class Particulas:
    """Materia sin estado: la posición de cada partícula es una fórmula del tiempo y de su semilla."""

    def __init__(self, semilla, densidad=1.0):
        rng = np.random.default_rng(semilla)
        lim, _ = limites()
        self.lim = lim
        rot = np.array(Euler(INCLINACION).to_matrix(), np.float64)
        self.e1, self.e2, self.n = rot[:, 0], rot[:, 1], rot[:, 2]
        self.c = np.array(CENTRO, np.float64)
        # a) órbitas de la carga, en planos al azar
        n = int(30 * densidad)
        self.a_r = rng.uniform(0.4, 1.3, n)
        self.a_fase = rng.uniform(0, math.tau, n)
        eje = rng.normal(size=(n, 3))
        eje[:, 2] = np.abs(eje[:, 2]) + 0.8
        eje /= np.linalg.norm(eje, axis=1, keepdims=True)
        u = np.cross(eje, [1.0, 0.0, 0.0])
        u /= np.linalg.norm(u, axis=1, keepdims=True)
        self.a_u, self.a_v = u, np.cross(eje, u)
        # b) acreción: espirales hacia el horizonte
        n = int(340 * densidad)
        t0, t1 = lim["expansion"][0], lim["acrecion"][1] - 0.5
        self.b_nace = rng.uniform(t0, t1, n)
        self.b_vida = rng.uniform(1.5, 3.0, n)
        self.b_r0 = rng.uniform(4.0, 8.0, n)
        self.b_fase = rng.uniform(0, math.tau, n)
        self.b_vueltas = rng.uniform(1.2, 3.2, n)
        self.b_alto = rng.normal(0, 0.09, n)
        self.b_tam = rng.uniform(0.6, 1.5, n)
        # c) residuos de la liberación
        n = int(240 * densidad)
        d = rng.normal(size=(n, 3))
        d[:, 2] *= 0.45  # salen sobre todo en el plano del disco
        d /= np.linalg.norm(d, axis=1, keepdims=True)
        self.c_dir = d @ rot.T
        self.c_vel = rng.uniform(5.0, 24.0, n)
        self.c_vida = rng.uniform(0.45, 1.05, n)
        self.c_tam = rng.uniform(0.6, 1.6, n)

    def evaluar(self, t, radio):
        """Devuelve posiciones (n, 3), brillo (n,), tamaño (n,) y calor 0–1 (n,) de las partículas vivas."""
        lim, P, B, S, K = self.lim, [], [], [], []
        # a) carga: giran y se cierran sobre el punto negro; el horizonte se las traga al crecer
        if t < lim["expansion"][1]:
            k = suave(t / lim["carga"][1])
            r = self.a_r * (1 - 0.55 * k)
            ang = self.a_fase + t * 4.2 * self.a_r ** -1.5
            p = self.c + (np.cos(ang) * r)[:, None] * self.a_u + (np.sin(ang) * r)[:, None] * self.a_v
            vivo = r > radio * 1.05
            b = np.minimum(1.0, t / 0.35) * 0.9
            P.append(p[vivo]); B.append(np.full(vivo.sum(), b)); S.append(np.full(vivo.sum(), 0.8))
            K.append(np.full(vivo.sum(), 0.75))
        # b) acreción
        u = (t - self.b_nace) / self.b_vida
        m = (u > 0) & (u < 1)
        if m.any():
            u_ = u[m]
            r = radio + (self.b_r0[m] - radio) * (1 - u_) ** 0.8
            ang = self.b_fase[m] + self.b_vueltas[m] * math.tau * (1 - (1 - u_) ** 0.4)
            alto = self.b_alto[m] * r * (1 - u_)
            p = self.c + (np.cos(ang) * r)[:, None] * self.e1 + (np.sin(ang) * r)[:, None] * self.e2 \
                + alto[:, None] * self.n
            P.append(p); B.append(np.minimum(1.0, u_ / 0.12) * (0.35 + 1.3 * u_ ** 2)); S.append(self.b_tam[m])
            K.append(u_ ** 1.5)
        # c) residuos
        tl = t - lim["liberacion"][0]
        if tl > 0:
            m = tl < self.c_vida
            f = (1 - np.exp(-2.4 * tl)) / 2.4
            p = self.c + self.c_dir[m] * (self.c_vel[m] * f)[:, None]
            p[:, 2] -= 1.5 * tl * tl
            P.append(p); B.append(2.2 * (1 - tl / self.c_vida[m]) ** 1.5); S.append(self.c_tam[m])
            K.append(np.clip(1 - tl / self.c_vida[m], 0, 1))
        if not P:
            z = np.zeros(0)
            return np.zeros((0, 3)), z, z, z
        return np.concatenate(P), np.concatenate(B), np.concatenate(S), np.concatenate(K)


def color_calor(k):
    """Rojo → naranja → oro → blanco, como el disco."""
    k = np.clip(k, 0, 1)[:, None]
    frio, medio, caliente = np.array((1.0, 0.18, 0.03)), np.array((1.0, 0.6, 0.22)), np.array((0.95, 0.95, 1.0))
    return np.where(k < 0.5, frio + (medio - frio) * (k * 2), medio + (caliente - medio) * (k * 2 - 1))


def salpicar(lienzo, x, y, color, sigma):
    """Suma manchas gaussianas pequeñas (una por partícula)."""
    h, w, _ = lienzo.shape
    for i in range(len(x)):
        s = max(0.6, float(sigma[i]))
        rad = int(math.ceil(s * 3))
        xi, yi = int(round(x[i])), int(round(y[i]))
        x0, x1, y0, y1 = max(0, xi - rad), min(w, xi + rad + 1), max(0, yi - rad), min(h, yi + rad + 1)
        if x0 >= x1 or y0 >= y1:
            continue
        gx = np.exp(-((np.arange(x0, x1) + 0.5 - x[i]) ** 2) / (2 * s * s))
        gy = np.exp(-((np.arange(y0, y1) + 0.5 - y[i]) ** 2) / (2 * s * s))
        lienzo[y0:y1, x0:x1] += (gy[:, None] * gx[None, :])[..., None] * color[i]


def componer(vista, escena, zesc, capa_disco, p, part, modo):
    """Un fotograma: lente con profundidad, disco, horizonte, partículas, destello, onda y bloom."""
    w, h, X, Y = vista.w, vista.h, vista.X, vista.Y
    completo = modo == "completo"
    cx, cy, zc = (float(v[0]) for v in vista.proyectar(np.array(CENTRO)))
    ppm = (h / 2) / (zc * vista.ty)          # píxeles por metro a la profundidad de la singularidad
    dx, dy = (X - cx) / ppm, (Y - cy) / ppm  # metros desde el centro, en ese plano
    r2 = dx * dx + dy * dy
    r = np.sqrt(r2)
    margen = 0.4
    delante = zesc < zc - margen             # el píxel muestra algo que está delante: no se toca
    radio, lente = p["radio"], p["lente"] if completo else 0.0
    alcance = 2.6 * lente + 1.0
    luz = np.zeros((h, w, 3), np.float32)    # todo lo aditivo, para el bloom

    def deformar(fuerza, detras, extra=None):
        """Ecuación de la lente puntual: la imagen en θ viene de β = θ·(1 − θE²/θ²), acotada a `alcance`.

        `detras` (0–1) pondera la lente con la profundidad: lo que está a la altura de la singularidad
        o delante no se desvía, y la desviación crece con la distancia por detrás. Así la máscara de
        profundidad es continua y no deja cortes.
        """
        ventana = 1 - escalon(0.55 * alcance, alcance, r)
        k = fuerza * fuerza / (r2 + 0.02) * ventana * detras
        fx, fy = dx * (1 - k), dy * (1 - k)
        if extra is not None:
            fx, fy = fx - dx / np.maximum(r, 1e-3) * extra, fy - dy / np.maximum(r, 1e-3) * extra
        return cx + fx * ppm, cy + fy * ppm

    def peso_detras(z, largo):
        d = np.maximum(z - zc, 0.0)
        return d / (d + largo)

    # 1. Fondo deformado. La onda de la liberación es un pulso radial que viaja por la misma malla.
    pulso = None
    if p["onda"] >= 0:
        ro = 15.0 * (1 - math.exp(-2.6 * p["onda"]))
        pulso = 0.55 * math.exp(-p["onda"] / 0.35) * np.exp(-((r - ro) / (0.5 + ro * 0.06)) ** 2)
    out = escena.copy()
    detras_esc = peso_detras(zesc, 1.5)
    if completo and (lente > 1e-3 or pulso is not None):
        canales = []
        for i, f in enumerate((1 - p["aberracion"], 1.0, 1 + p["aberracion"])):
            sx, sy = deformar(lente * f, detras_esc, None if pulso is None else pulso * (~delante))
            col = muestrear(escena[..., i], sx, sy)
            if i == 1:
                zsrc = muestrear(zesc, sx, sy)
            canales.append(col)
        lensado = np.stack(canales, axis=-1)
        # Lo que se trae de otro sitio no puede ser algo que estaba delante de la singularidad.
        valido = ~delante & (zsrc >= zc - margen)
        out = np.where(valido[..., None], lensado, escena)
    visible = (~delante).astype(np.float32)
    # La zona de influencia se oscurece un poco: da peso al efecto y contraste al disco. Dentro del
    # anillo de Einstein la imagen llega invertida y muy estirada: se atenúa para que se lea como pozo.
    out *= 1 - p["oscurecer"] * (np.exp(-r2 / (2.4 * max(radio, 0.4) + 2.6) ** 2) * visible)[..., None]
    if completo and lente > 1e-3:
        pozo = (1 - escalon(0.45 * lente, 1.0 * lente, r)) * visible * detras_esc
        out *= (1 - 0.72 * pozo)[..., None]

    # 2. Disco. Lo que queda detrás del centro se ve a través de la lente (el arco sobre la sombra) y
    #    lo de delante, directo; el peso por profundidad une las dos mitades sin costura.
    cerca = None
    if capa_disco is not None:
        zdisco = vista.profundidad_plano(np.array(CENTRO, np.float64), part.n)
        libre = (zdisco < zesc).astype(np.float32)[..., None]
        if completo and lente > 1e-3:
            sx, sy = deformar(lente, peso_detras(zdisco, 0.5))
            capa = muestrear(capa_disco * libre, sx, sy)
        else:
            capa = capa_disco * libre
        es_cerca = (zdisco < zc)[..., None]
        cerca = capa * es_cerca
        capa_lejos = capa * ~es_cerca * visible[..., None]
        out = capa_lejos[..., :3] + out * (1 - capa_lejos[..., 3:4])
        luz += capa_lejos[..., :3]

    # 3. Partículas detrás del centro: su posición aparente también pasa por la lente.
    pos, brillo, tam, calor = part.evaluar(p["t"], radio)
    if len(pos):
        px, py, pz = vista.proyectar(pos)
        col = color_calor(calor) * brillo[:, None]
        sig = tam * 0.045 * ppm * (zc / np.maximum(pz, 1.0))
        detras = pz >= zc
        qx, qy = (px - cx) / ppm, (py - cy) / ppm
        beta = np.sqrt(qx * qx + qy * qy) + 1e-6
        if completo and lente > 1e-3:
            le = lente * np.sqrt(peso_detras(pz, 0.5))
            theta = (beta + np.sqrt(beta * beta + 4 * le * le)) / 2  # imagen primaria
            vent = 1 - escalon(0.55 * alcance, alcance, beta)
            theta = beta + (theta - beta) * vent
            lx, ly = cx + qx / beta * theta * ppm, cy + qy / beta * theta * ppm
        else:
            lx, ly = px, py
        xi, yi = np.clip(lx.astype(int), 0, w - 1), np.clip(ly.astype(int), 0, h - 1)
        dentro = (lx >= 0) & (lx < w) & (ly >= 0) & (ly < h) & (pz > 0.2)
        libre_p = zesc[yi, xi] > pz
        fuera_sombra = np.hypot((lx - cx) / ppm, (ly - cy) / ppm) > radio
        capa = np.zeros((h, w, 3), np.float32)
        m = dentro & libre_p & detras & fuera_sombra
        salpicar(capa, lx[m], ly[m], col[m], sig[m])
        out += capa
        luz += capa

    # 4. Horizonte: la sombra tapa lo que hay detrás. Anillo de fotones pegado a su borde.
    if radio > 1e-3:
        borde = max(0.04, radio * 0.06)
        sombra = (1 - escalon(radio - borde, radio, r)) * visible
        out *= (1 - sombra)[..., None]
        if p["fotones"] > 0:
            ancho = 0.035 + radio * 0.035
            anillo = np.exp(-((r - radio * 1.03) / ancho) ** 2) * visible * p["fotones"]
            capa = anillo[..., None] * np.array((1.0, 0.82, 0.55), np.float32) * 1.6
            out += capa
            luz += capa

    # 5. Mitad cercana del disco y partículas de delante, sin lente y por encima de la sombra.
    if cerca is not None:
        out = cerca[..., :3] + out * (1 - cerca[..., 3:4])
        luz += cerca[..., :3]
    if len(pos):
        capa = np.zeros((h, w, 3), np.float32)
        m = dentro & libre_p & ~detras
        salpicar(capa, lx[m], ly[m], col[m], sig[m])
        out += capa
        luz += capa

    # 6. Liberación: destello y aro de luz de la onda.
    if p["destello"] > 1e-3:
        k = p["destello"]
        capa = (k * 4.0 * np.exp(-r2 / (0.5 + 1.6 * (1 - k)) ** 2) + k * 0.5 * np.exp(-r / 3.0)
                + k * 1.6 * np.exp(-(dy / 0.10) ** 2) * np.exp(-np.abs(dx) / 5.0))[..., None] \
            * np.array((1.0, 0.9, 0.78), np.float32)
        out += capa
        luz += capa
    if pulso is not None:
        capa = (pulso * 1.4)[..., None] * np.array((1.0, 0.85, 0.7), np.float32)
        out += capa

    # 7. Bloom barato: solo de lo aditivo, a un cuarto de resolución.
    if completo:
        peq = luz[::4, ::4]
        halo = desenfoque(peq, 2) * 0.55 + desenfoque(peq, 7) * 0.45
        out += np.repeat(np.repeat(halo, 4, axis=0), 4, axis=1)[:h, :w] * 0.4
    return out


# ------------------------------------------------------------------ entrada


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="singularidad.py")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--nombre", default="singularidad")
    ap.add_argument("--calidad", default="borrador", choices=sorted(CALIDADES))
    ap.add_argument("--modo", default="completo", choices=("completo", "simple"))
    ap.add_argument("--elevacion", type=float, default=38.0)
    ap.add_argument("--yaw", type=float, default=18.0)
    ap.add_argument("--orbita", type=float, default=0.0, help="grados que gira la cámara durante el efecto")
    ap.add_argument("--cuadros", help="lista de cuadros (desde 0); por defecto todos")
    ap.add_argument("--semilla", type=int, default=7)
    a = ap.parse_args(args)
    cal = CALIDADES[a.calidad]
    w, h = cal["ancho"], cal["alto"]
    salida = os.path.abspath(a.salida)
    os.makedirs(salida, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="singularidad_")
    lim, total = limites()
    n_total = int(round(total * FPS)) + int(0.5 * FPS)
    cuadros = [int(x) for x in a.cuadros.split(",")] if a.cuadros else list(range(n_total))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 0, n_total - 1
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 3
    sc.view_settings.view_transform = "Standard"
    im = sc.render.image_settings
    im.file_format = "OPEN_EXR"
    im.color_mode = "RGBA"
    im.color_depth = "32"
    im.exr_codec = "ZIP"
    col = escenario()
    co = camara(cal, a.elevacion, a.yaw)
    ob_disco, nodo_tiempo, nodo_brillo = disco()
    prof = material_profundidad()
    capa = bpy.context.view_layer

    # Claves del disco: la escena guardada reproduce la animación sin este script.
    for c in range(n_total):
        p = parametros(c / FPS)
        ob_disco.scale = (max(p["radio"], 1e-3),) * 3
        ob_disco.keyframe_insert("scale", frame=c)
        nodo_tiempo.default_value = p["tiempo_disco"]
        nodo_tiempo.keyframe_insert("default_value", frame=c)
        nodo_brillo.default_value = p["disco"]
        nodo_brillo.keyframe_insert("default_value", frame=c)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(salida, f"{a.nombre}.blend"), compress=True)

    def render(ruta, muestras, que):
        """que: 'escena' (color), 'profundidad' o 'disco' (emisión con alfa)."""
        ob_disco.hide_render = que != "disco"
        col.hide_render = que == "disco"
        capa.material_override = prof if que == "profundidad" else None
        sc.render.film_transparent = que != "escena"
        sc.cycles.samples = muestras
        sc.cycles.use_denoising = que == "escena"
        sc.cycles.pixel_filter_type = "BOX" if que == "profundidad" else "BLACKMAN_HARRIS"
        sc.cycles.filter_width = 0.01 if que == "profundidad" else 1.5
        sc.render.filepath = ruta
        bpy.ops.render.render(write_still=True)
        return leer_exr(ruta)

    part = Particulas(a.semilla, 1.0 if a.modo == "completo" else 0.4)
    t_ini = time.time()
    escena = zesc = None
    salidas, capas_prueba = {}, []
    for i, c in enumerate(cuadros):
        t = c / FPS
        p = parametros(t)
        sc.frame_set(c)
        if a.orbita or escena is None:
            orientar(co, a.elevacion, a.yaw + a.orbita * (t / total - 0.5))
            bpy.context.view_layer.update()
            escena = render(os.path.join(tmp, "escena.exr"), cal["muestras"], "escena")[..., :3]
            z = render(os.path.join(tmp, "z.exr"), 1, "profundidad")
            zesc = np.where(z[..., 3] > 0.5, z[..., 0], 1e6).astype(np.float32)
            vista = Vista(co, w, h)
        capa_disco = render(os.path.join(tmp, "disco.exr"), cal["muestras_disco"], "disco") if p["disco"] > 1e-3 else None
        img = componer(vista, escena, zesc, capa_disco, p, part, a.modo)
        salidas[c] = a_bytes(a_srgb(tono(img, 1.0, 0.8)))
        if a.cuadros:  # modo prueba: guarda también las capas de entrada del pase de pantalla
            lejos = np.clip(1 - (zesc - 8) / 40, 0, 1)[..., None].repeat(3, 2)
            d8 = a_bytes(a_srgb(tono(capa_disco[..., :3]))) if capa_disco is not None else np.zeros((h, w, 3), np.uint8)
            capas_prueba.append(hoja([a_bytes(a_srgb(escena)), a_bytes(lejos), d8, salidas[c]], 4))
        escribir_png(os.path.join(tmp, f"f{i:04d}.png"), salidas[c], nivel=3)
        print(f"[singularidad] cuadro {c} ({p['fase']}) radio {p['radio']:.2f} lente {p['lente']:.2f}")
    seg = time.time() - t_ini

    sufijo = "" if a.modo == "completo" else "_simple"
    if not a.cuadros:
        video(os.path.join(tmp, "f%04d.png"), FPS, os.path.join(salida, f"{a.nombre}{sufijo}.mp4"))
        # Hoja de contactos: dos momentos por fase y el final.
        tiempos = []
        for nombre, (t0, t1) in lim.items():
            tiempos += [t0 + (t1 - t0) * 0.45, t0 + (t1 - t0) * 0.92] if nombre != "liberacion" else \
                [t0 + 0.04, t0 + 0.2, t0 + 0.5, t0 + 0.9]
        elegidos = [salidas[min(n_total - 1, int(round(t * FPS)))][::2, ::2] for t in tiempos]
        escribir_jpg(os.path.join(salida, f"{a.nombre}{sufijo}_hoja.jpg"), hoja(elegidos, 4))
        curvas = [parametros(c / FPS) for c in range(n_total)]
        json.dump(dict(fps=FPS, cuadros=n_total, centro=list(CENTRO), fov_y=FOV_Y,
                       inclinacion_disco_grados=[round(math.degrees(v), 1) for v in INCLINACION],
                       disco_radios=[DISCO_INT, DISCO_EXT],
                       fases=[dict(nombre=n, inicio=round(lim[n][0], 3), fin=round(lim[n][1], 3), estado=e)
                              for n, _, e in FASES],
                       unidades=dict(radio="m, sombra del horizonte", lente="m, radio de Einstein a la profundidad del centro",
                                     alcance="m, 2,6·lente + 1: fuera no hay deformación",
                                     onda="s desde la liberación; −1 si no hay"),
                       curvas={k: [round(c[k], 4) for c in curvas] for k in curvas[0] if k not in ("fase", "t")},
                       segundos=dict(total=round(seg, 1), por_cuadro=round(seg / len(cuadros), 2)),
                       resolucion=[w, h], calidad=a.calidad, blender=bpy.app.version_string),
                  open(os.path.join(salida, f"{a.nombre}.json"), "w"), indent=1, ensure_ascii=False)
    else:
        escribir_jpg(os.path.join(salida, f"{a.nombre}{sufijo}_prueba.jpg"),
                     hoja([salidas[c] for c in cuadros], min(3, len(cuadros))))
        escribir_jpg(os.path.join(salida, f"{a.nombre}{sufijo}_capas.jpg"),
                     np.concatenate([c[::2, ::2] for c in capas_prueba], axis=0))
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    print(f"[singularidad] {len(cuadros)} cuadros en {seg:.1f} s ({seg / len(cuadros):.2f} s por cuadro)")


if __name__ == "__main__":
    main()
