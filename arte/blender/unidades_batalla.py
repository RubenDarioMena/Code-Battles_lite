"""Diseño tentativo de las unidades del laboratorio de batalla (`laboratorio/batalla/`).

- VEH · vehículo con torreta: solo un armazón tubular sobre dos ejes. Los tubos suben desde los
  ejes y se juntan en un aro central; encima del aro va la torreta (dos lanzadores de 5 tubos =
  cargador de 10), debajo un motor simple y, a un lado, una placa de circuitos a la vista con los
  4 LED de vida.
- WHL · rueda kamikaze: «rueda con patas». Un aro sin buje que gira alrededor de un núcleo que
  no gira y lleva la carga (naranja). La pista interior del aro es metal imantado (niquelado
  de neodimio) y cada par de patas cuelga de un imán del mismo metal pegado a ella: nada va
  atornillado, así que los pares pueden deslizarse por dentro del aro. Rueda con las patas
  recogidas arriba y, al reponerse en la base, los imanes bajan y se apoya inclinada sobre ellas.

Reutiliza piezas, paleta, suelo y render de `robots.py` (misma estética y convenciones: 1 m =
1 casilla, apoyo en z = 0, mirada a +Y, pivotes Empty con nombre fijo).

Pivotes:
- VEH: torreta (giro Z), elevacion (giro X), rueda_i/d_0..1 (giro X), vida_0..3 (LED de la placa).
- WHL: aro (giro X: lo único que rueda), nucleo, iman_1 e iman_2 (giro X: deslizan cada par de
  patas por la pista), pata_X y rodilla_X con X en d1, d2, i1, i2 (giro Y).
  `pose_rueda(raiz, t)` va de rodando (t = 0) a apoyada (t = 1).

Sin ventana (Blender o el módulo `bpy` de pip):
    blender -b --factory-startup --python arte/blender/unidades_batalla.py -- <carpeta>
escribe `unidades_batalla.blend` junto al script y los renders en <carpeta> (por defecto, aquí).
Con `CBL_MOTOR=cycles` renderiza por CPU (para máquinas sin GPU, donde EEVEE no arranca).
No exporta GLB ni está integrado en el juego.
"""
import math
import os
import sys

import bpy  # antes que bmesh: con el módulo de pip, bmesh solo existe tras importar bpy
import bmesh
from mathutils import Matrix, Vector

RAIZ = os.path.dirname(os.path.abspath(__file__))
g = {"__name__": "robots_cbl"}
exec(open(os.path.join(RAIZ, "robots.py")).read(), g)
vacio, caja, cilindro, prisma, poligono, esfera = (g[k] for k in ("vacio", "caja", "cilindro", "prisma",
                                                                   "poligono", "esfera"))
articulacion, _objeto, _anillo_bm, _prisma_bm = (g[k] for k in ("articulacion", "_objeto", "_anillo_bm",
                                                                "_prisma_bm"))

# (a, b, c) → (x = c, y = a, z = b): lleva un perfil dibujado en XY al plano YZ, con el grosor en X
A_YZ = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def _tacos(bm, r, ancho, n, largo=0.03, alto=0.012, desfase=0.0):
    """Tacos de rodadura sobre un neumático cuyo eje es X."""
    for k in range(n):
        a = desfase + 2 * math.pi * k / n
        nrm, tang = Vector((0, math.cos(a), math.sin(a))), Vector((0, -math.sin(a), math.cos(a)))
        c = nrm * (r + alto * 0.3)
        m = Matrix.Identity(4)
        for i in range(3):
            m[i][0] = (1, 0, 0)[i] * ancho
            m[i][1] = tang[i] * largo
            m[i][2] = nrm[i] * alto
            m[i][3] = c[i]
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)


# ---------------------------------------------------------------- vehículo con torreta (VEH)

VEH_RUEDA_R = 0.17
VEH_RUEDA_W = 0.13
VEH_EJES = (0.29, -0.29)   # y de los ejes delantero y trasero
VEH_VIA = 0.33             # x del centro de cada rueda


def rueda_todoterreno(nombre, pos, lado, padre):
    r, w = VEH_RUEDA_R, VEH_RUEDA_W
    piv = vacio(nombre, padre, pos)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=28, radius1=r, radius2=r, depth=w)
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.pi / 2, 4, "Y"), verts=bm.verts)
    _tacos(bm, r, w + 0.006, 14)
    _objeto(nombre + "_goma", bm, "goma", piv, (0, 0, 0), (0, 0, 0), 0.012, 2)
    rot = (0, 0, 0) if lado > 0 else (0, 0, math.pi)
    cilindro(nombre + "_llanta", r * 0.66, 0.02, (lado * (w / 2 + 0.004), 0, 0), "crema", piv, eje="X",
             verts=8, r2=r * 0.4, giro=math.pi / 8, bisel=0.003, rot=rot)
    cilindro(nombre + "_buje", r * 0.24, 0.03, (lado * (w / 2 + 0.014), 0, 0), "rol", piv, eje="X", verts=12,
             bisel=0.004)
    return piv


def lanzador(nombre, x, padre):
    """Caja de 5 tubos (3 abajo, 2 arriba) con las puntas de los misiles asomando."""
    caja(nombre, (0.15, 0.36, 0.135), (x, 0.04, 0), "crema", padre, bisel=0.016)
    caja(nombre + "_boca", (0.132, 0.012, 0.117), (x, 0.222, 0), "goma", padre, bisel=0.004)
    caja(nombre + "_franja", (0.154, 0.05, 0.139), (x, -0.06, 0), "rol", padre, bisel=0.006)
    caja(nombre + "_cola", (0.11, 0.012, 0.09), (x, -0.142, 0), "grafito", padre, bisel=0.004)
    for k, (dx, dz) in enumerate(((-0.042, -0.027), (0, -0.027), (0.042, -0.027), (-0.021, 0.03), (0.021, 0.03))):
        cilindro(f"{nombre}_tubo_{k}", 0.019, 0.016, (x + dx, 0.226, dz), "grafito", padre, eje="Y", verts=14,
                 bisel=0.002)
        cilindro(f"{nombre}_misil_{k}", 0.013, 0.03, (x + dx, 0.232, dz), "naranja", padre, eje="Y", verts=12,
                 r2=0.003, bisel=0.0)


VEH_ARO_R = 0.19           # aro central donde se juntan los tubos y asienta la torreta
VEH_ARO_Z = 0.4
g["PALETA"]["placa"] = ("#1F6F52", 0.0, 0.5)  # verde de placa de circuitos


def tubo(nombre, a, b, r, mat, padre, nudos=True):
    """Tubo recto entre dos puntos, con un nudo esférico en cada extremo."""
    a, b = Vector(a), Vector(b)
    rot = (b - a).to_track_quat("Z", "Y").to_euler()
    o = cilindro(nombre, r, (b - a).length, (a + b) / 2, mat, padre, verts=12, bisel=0.0, rot=rot)
    if nudos:
        for k, p in enumerate((a, b)):
            esfera(f"{nombre}_nudo_{k}", r * 1.45, p, "grafito", padre)
    return o


def toro(nombre, R, r, pos, mat, padre, n=40, m=10):
    bm = bmesh.new()
    vs = [[bm.verts.new(((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v)))
           for v in (2 * math.pi * j / m for j in range(m))] for u in (2 * math.pi * i / n for i in range(n))]
    for i in range(n):
        for j in range(m):
            bm.faces.new((vs[i][j], vs[(i + 1) % n][j], vs[(i + 1) % n][(j + 1) % m], vs[i][(j + 1) % m]))
    return _objeto(nombre, bm, mat, padre, pos, (0, 0, 0), 0)


def placa_circuitos(padre, pos):
    """Placa genérica mirando a +X: chips, condensadores, pistas y los 4 LED de vida."""
    p = vacio("placa", padre, pos)
    caja("placa_base", (0.008, 0.3, 0.15), (0, 0, 0), "placa", p, bisel=0.003)
    x = 0.007
    caja("chip_a", (0.008, 0.07, 0.06), (x, -0.045, -0.005), "goma", p, bisel=0.003)
    caja("chip_b", (0.008, 0.04, 0.03), (x, 0.045, -0.04), "goma", p, bisel=0.002)
    caja("chip_c", (0.008, 0.03, 0.03), (x, 0.1, -0.04), "goma", p, bisel=0.002)
    caja("conector", (0.014, 0.022, 0.07), (x + 0.003, -0.128, -0.01), "hueso", p, bisel=0.003)
    for k, (y, z) in enumerate(((0.035, 0.012), (0.065, 0.012), (0.1, 0.008))):
        cilindro(f"condensador_{k}", 0.011, 0.024, (x + 0.008, y, z), "rol" if k < 2 else "acero", p, eje="X",
                 verts=12, bisel=0.002)
    for k, (y, z, ly, lz) in enumerate(((0.0, -0.058, 0.2, 0.004), (-0.045, 0.036, 0.004, 0.022),
                                        (0.02, 0.047, 0.134, 0.004), (0.086, -0.012, 0.004, 0.03),
                                        (-0.098, -0.03, 0.04, 0.004))):
        caja(f"pista_{k}", (0.002, ly, lz), (0.005, y, z), "amarillo", p, bisel=0.0)
    for k in range(4):
        v = vacio(f"vida_{k}", p, (x, -0.04 + k * 0.035, 0.058))
        caja(f"vida_{k}_luz", (0.008, 0.018, 0.012), (0, 0, 0), "cian_luz", v, bisel=0.002)
    for sy in (-1, 1):
        for sz in (-1, 1):
            cilindro(f"tornillo_{sy}_{sz}", 0.007, 0.012, (0.002, sy * 0.138, sz * 0.063), "acero", p, eje="X",
                     verts=8, bisel=0.0)
    return p


def vehiculo_torreta(col):
    g["COL"] = col
    raiz = vacio("VehiculoTorreta", tam=0.3)
    cuerpo = vacio("cuerpo", raiz)
    zr, rt = VEH_RUEDA_R, 0.02

    # dos ejes y nada más de rodaje
    for lado, s in (("i", -1), ("d", 1)):
        for k, y in enumerate(VEH_EJES):
            rueda_todoterreno(f"rueda_{lado}_{k}", (s * VEH_VIA, y, zr), s, raiz)
    for k, y in enumerate(VEH_EJES):
        cilindro(f"eje_{k}", 0.026, 0.56, (0, y, zr), "grafito", cuerpo, eje="X", verts=12)

    # armazón: cuatro tubos suben de los ejes y se juntan en el aro central; dos largueros abajo
    toro("aro_central", VEH_ARO_R, 0.022, (0, 0, VEH_ARO_Z), "crema", cuerpo)
    d = VEH_ARO_R * math.sqrt(0.5)
    for sx in (-1, 1):
        lx = "d" if sx > 0 else "i"
        for k, y in enumerate(VEH_EJES):
            sy = 1 if y > 0 else -1
            tubo(f"tubo_{lx}_{k}", (sx * 0.21, y, zr), (sx * d, sy * d, VEH_ARO_Z), rt, "crema", cuerpo)
            caja(f"abrazadera_{lx}_{k}", (0.05, 0.07, 0.07), (sx * 0.21, y, zr), "rol", cuerpo, bisel=0.012)
        tubo(f"larguero_{lx}", (sx * 0.115, VEH_EJES[0], zr), (sx * 0.115, VEH_EJES[1], zr), rt * 0.9, "crema",
             cuerpo)
        tubo(f"montante_{lx}", (sx * 0.115, 0, zr), (sx * VEH_ARO_R, 0, VEH_ARO_Z), rt * 0.8, "crema", cuerpo)
    # travesaños con los faros (delante) y la toma de suministro (detrás)
    f = 0.55  # fracción de la subida donde cruzan
    tx, ty, tz = 0.21 + (d - 0.21) * f, 0.29 + (d - 0.29) * f, zr + (VEH_ARO_Z - zr) * f
    for k, sy in enumerate((1, -1)):
        tubo(f"travesano_{k}", (-tx, sy * ty, tz), (tx, sy * ty, tz), rt * 0.8, "crema", cuerpo, nudos=False)
    for s in (-1, 1):
        lado = "d" if s > 0 else "i"
        cilindro(f"faro_{lado}_aro", 0.04, 0.05, (s * 0.085, ty + 0.012, tz), "grafito", cuerpo, eje="Y", bisel=0.006)
        cilindro(f"faro_{lado}_luz", 0.031, 0.056, (s * 0.085, ty + 0.014, tz), "luz_calida", cuerpo, eje="Y",
                 bisel=0.002)
        cilindro(f"faro_{lado}", 0.02, 0.06, (s * 0.085, ty + 0.016, tz), "lente", cuerpo, eje="Y", bisel=0.003)
    caja("toma_suministro", (0.11, 0.05, 0.06), (0, -ty - 0.01, tz), "amarillo", cuerpo, bisel=0.01)
    cilindro("toma_boca", 0.018, 0.012, (0, -ty - 0.038, tz), "lente", cuerpo, eje="Y", verts=14, bisel=0.002)

    # motor simple bajo la torreta: carcasa con aletas, tapa «rol» y árbol al eje trasero
    zm = 0.262
    cilindro("motor", 0.082, 0.2, (0, 0.01, zm), "acero", cuerpo, eje="Y", verts=24, bisel=0.01)
    for k in range(5):
        cilindro(f"motor_aleta_{k}", 0.094, 0.012, (0, -0.05 + k * 0.03, zm), "grafito", cuerpo, eje="Y", verts=24,
                 bisel=0.002)
    cilindro("motor_tapa", 0.07, 0.03, (0, 0.122, zm), "rol", cuerpo, eje="Y", verts=24, r2=0.05, bisel=0.004)
    cilindro("motor_reductora", 0.05, 0.05, (0, -0.112, zm), "grafito", cuerpo, eje="Y", verts=16, bisel=0.006)
    tubo("arbol", (0, -0.13, zm), (0, VEH_EJES[1], zr), 0.014, "acero", cuerpo, nudos=False)
    caja("diferencial", (0.1, 0.09, 0.09), (0, VEH_EJES[1], zr), "grafito", cuerpo, bisel=0.02)
    caja("motor_cuna", (0.25, 0.1, 0.022), (0, 0.01, zr + 0.005), "grafito", cuerpo, bisel=0.006)
    cilindro("motor_columna", 0.03, 0.09, (0, 0.01, VEH_ARO_Z - 0.06), "grafito", cuerpo, verts=12)

    # placa de circuitos a la vista en el costado derecho, con cables hacia el motor
    placa_circuitos(cuerpo, (0.168, 0.0, 0.272))
    for k, y in enumerate((-0.11, 0.11)):
        cilindro(f"separador_{k}", 0.008, 0.05, (0.142, y, 0.205), "acero", cuerpo, eje="X", verts=8, bisel=0.0)
    for k, (y, mat) in enumerate(((-0.128, "naranja"), (-0.118, "amarillo"))):
        tubo(f"cable_{k}", (0.17, y, 0.215), (0.07, -0.06 + k * 0.02, 0.225), 0.005, mat, cuerpo, nudos=False)

    # torreta sobre el aro: la misma arma que las torretas del muro, con 10 misiles a la vista
    cilindro("plato_torreta", VEH_ARO_R - 0.012, 0.016, (0, 0, VEH_ARO_Z), "grafito", cuerpo, verts=32, bisel=0.003)
    torreta = vacio("torreta", cuerpo, (0, 0, VEH_ARO_Z + 0.008))
    prisma("aro_torreta", poligono(8, 0.14, math.pi / 8), 0.0, 0.04, "rol", torreta, bisel=0.012)
    cilindro("anillo_torreta", 0.105, 0.03, (0, 0, 0.05), "grafito", torreta, verts=24)
    caja("torre", (0.16, 0.22, 0.14), (0, -0.01, 0.125), "crema", torreta, bisel=0.022)
    caja("torre_visor", (0.1, 0.012, 0.032), (0, 0.102, 0.15), "lente", torreta, bisel=0.004)
    elev = vacio("elevacion", torreta, (0, -0.02, 0.14), rot=(math.radians(14), 0, 0))
    articulacion("eje_elevacion", (0, 0, 0), 0.038, 0.29, elev)
    for s in (-1, 1):
        lanzador(f"lanzador_{'d' if s > 0 else 'i'}", s * 0.195, elev)
    # sensor (9 casillas): mástil con plato y luz cian detrás de la torre
    cilindro("mastil", 0.011, 0.2, (0, -0.1, 0.295), "grafito", torreta, verts=10, bisel=0.002)
    cilindro("plato", 0.055, 0.018, (0, -0.1, 0.4), "crema", torreta, verts=20, r2=0.03, bisel=0.003)
    esfera("sensor_luz", 0.02, (0, -0.1, 0.425), "cian_luz", torreta)
    return raiz


# ---------------------------------------------------------------- rueda kamikaze (WHL)

WHL_R = 0.44               # radio exterior del aro
WHL_W = 0.11               # ancho del neumático
WHL_R_INT = WHL_R - 0.11   # radio de la pista interior imantada
WHL_CADERA_X = 0.1         # |x| de las caderas, a cada lado del imán
WHL_CADERA_R = WHL_R_INT - 0.044  # distancia de las caderas al centro del aro
WHL_FEMUR, WHL_TIBIA = 0.21, 0.32
# Cada par de patas cuelga de un imán que se pega a la pista y puede deslizarse por ella.
# nombre del imán, signo (delante +, detrás -) y sus dos patas (nombre, lado x)
WHL_PARES = (("iman_1", 1, (("d1", 1), ("i1", -1))), ("iman_2", -1, (("d2", 1), ("i2", -1))))
WHL_IMAN_RODANDO, WHL_IMAN_APOYADA = 90.0, 46.0  # grados desde abajo, hacia delante o detrás
WHL_INCLINACION = 17.0     # grados que se recuesta al apoyarse
WHL_PIES = {1: 0.47, -1: -0.27}  # x del pie apoyado (se recuesta hacia +X)
g["PALETA"]["iman"] = ("#DFE3E8", 1.0, 0.13)  # niquelado de imán de neodimio


def _aro_bm(r_ext, r_int, ancho, n=72):
    bm = _anillo_bm(poligono(n, r_ext), poligono(n, r_int), -ancho / 2, ancho / 2)
    bmesh.ops.transform(bm, matrix=A_YZ, verts=bm.verts)
    return bm


def _sector(r_ext, r_int, a0, a1, n=20):
    """Sector de corona en XY, medido desde abajo (0° = -Y del perfil, que acaba siendo -Z)."""
    ang = [math.radians(a0 + (a1 - a0) * k / n) for k in range(n + 1)]
    return ([(r_ext * math.sin(a), -r_ext * math.cos(a)) for a in ang]
            + [(r_int * math.sin(a), -r_int * math.cos(a)) for a in reversed(ang)])


def sector(nombre, r_ext, r_int, a0, a1, ancho, mat, padre, bisel=0.012):
    bm = _prisma_bm(_sector(r_ext, r_int, a0, a1), -ancho / 2, ancho / 2)
    bmesh.ops.transform(bm, matrix=A_YZ, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _objeto(nombre, bm, mat, padre, (0, 0, 0), (0, 0, 0), bisel, 2)


def rueda_kamikaze(col):
    g["COL"] = col
    raiz = vacio("RuedaKamikaze", tam=0.3)
    centro = vacio("centro", raiz, (0, 0, WHL_R))

    # aro: lo único que gira. Neumático, llanta crema y pista interior; sin buje ni radios.
    aro = vacio("aro", centro)
    bm = _aro_bm(WHL_R, WHL_R - 0.05, WHL_W)
    _tacos(bm, WHL_R, WHL_W + 0.006, 40, largo=0.028, alto=0.012)
    _objeto("neumatico", bm, "goma", aro, (0, 0, 0), (0, 0, 0), 0.01, 2)
    _objeto("llanta", _aro_bm(WHL_R - 0.045, WHL_R - 0.09, WHL_W - 0.016), "crema", aro, (0, 0, 0), (0, 0, 0),
            0.008, 2)
    _objeto("pista", _aro_bm(WHL_R - 0.085, WHL_R_INT, 0.074), "iman", aro, (0, 0, 0), (0, 0, 0), 0.006, 2)
    for k in range(6):  # marcas «rol» en la llanta: se ve que rueda y de quién es
        a = math.radians(k * 60)
        r = WHL_R - 0.0675
        caja(f"marca_{k}", (WHL_W - 0.008, 0.09, 0.03), (0, r * math.sin(a), -r * math.cos(a)), "rol", aro,
             bisel=0.006, rot=(a, 0, 0))

    # núcleo: cuna colgada de la pista por abajo; no gira con el aro
    nucleo = vacio("nucleo", centro)
    rc = WHL_R_INT - 0.014
    sector("cuna", rc, rc - 0.085, -27, 27, 0.19, "crema", nucleo, bisel=0.014)
    sector("cuna_franja", rc + 0.002, rc - 0.087, -22, -15, 0.194, "rol", nucleo, bisel=0.005)
    sector("cuna_franja_b", rc + 0.002, rc - 0.087, 15, 22, 0.194, "rol", nucleo, bisel=0.005)
    for k, a in enumerate((-31, 0, 31)):
        a = math.radians(a)
        r = WHL_R_INT - 0.026
        articulacion(f"rodillo_{k}", (0, r * math.sin(a), -r * math.cos(a)), 0.026, 0.1, nucleo, tapa="iman")
    # carga: bidón naranja atravesado, con collar amarillo y detonadores encendidos
    zc = -(rc - 0.085) + 0.055
    cilindro("carga", 0.078, 0.3, (0, 0, zc), "naranja", nucleo, eje="X", verts=24, bisel=0.014)
    for s in (-1, 1):
        cilindro(f"carga_aro_{'d' if s > 0 else 'i'}", 0.082, 0.03, (s * 0.1, 0, zc), "naranja_oscuro", nucleo,
                 eje="X", verts=24, bisel=0.004)
        cilindro(f"detonador_{'d' if s > 0 else 'i'}", 0.034, 0.02, (s * 0.156, 0, zc), "ambar_luz", nucleo,
                 eje="X", verts=16, bisel=0.004)
    cilindro("carga_collar", 0.083, 0.05, (0, 0, zc), "amarillo", nucleo, eje="X", verts=24, bisel=0.004)
    caja("carga_brida", (0.07, 0.2, 0.03), (0, 0, zc - 0.07), "grafito", nucleo, bisel=0.008)
    # ojo único delante: lo que «ve» el sensor
    ao = math.radians(17)
    ro = rc - 0.04
    cabeza = vacio("cabeza", nucleo, (0, ro * math.sin(ao), -ro * math.cos(ao)), rot=(math.radians(-8), 0, 0))
    caja("cabeza_caja", (0.15, 0.1, 0.1), (0, 0.03, 0.04), "crema", cabeza, bisel=0.02)
    cilindro("ojo_aro", 0.042, 0.02, (0, 0.082, 0.04), "grafito", cabeza, eje="Y", bisel=0.004)
    cilindro("ojo_luz", 0.033, 0.026, (0, 0.084, 0.04), "ambar_luz", cabeza, eje="Y", bisel=0.002)
    cilindro("ojo", 0.021, 0.03, (0, 0.086, 0.04), "lente", cabeza, eje="Y", bisel=0.003)
    cilindro("antena", 0.006, 0.12, (0.05, 0.02, 0.13), "grafito", cabeza, verts=8, bisel=0.0)
    esfera("antena_luz", 0.013, (0.05, 0.02, 0.195), "cian_luz", cabeza)

    # patas: cada par cuelga de un imán cilíndrico pegado a la pista (pivote iman_N, giro X en el
    # centro del aro: deslizarlo cambia el par de sitio). Cadera y rodilla giran en Y; en reposo
    # la pata apunta hacia fuera del aro (-Z del imán).
    for iman, sy, patas in WHL_PARES:
        piv = vacio(iman, centro)
        zi = -(WHL_R_INT - 0.044)
        cilindro(f"{iman}_cuerpo", 0.042, 0.15, (0, 0, zi), "iman", piv, eje="X", verts=28, bisel=0.008, segs=3)
        for k in (-1, 0, 1):  # juntas entre los discos apilados
            cilindro(f"{iman}_junta_{k}", 0.0425, 0.004, (k * 0.038, 0, zi), "grafito", piv, eje="X", verts=28,
                     bisel=0.0)
        for nombre, sx in patas:
            pata = vacio(f"pata_{nombre}", piv, (sx * WHL_CADERA_X, 0, -WHL_CADERA_R))
            cilindro(f"cadera_{nombre}", 0.036, 0.06, (0, 0, 0), "grafito", pata, eje="Y", verts=24, bisel=0.006)
            cilindro(f"cadera_{nombre}_tapa", 0.022, 0.078, (0, 0, 0), "iman", pata, eje="Y", verts=20, bisel=0.004)
            caja(f"femur_{nombre}", (0.05, 0.04, WHL_FEMUR), (0, 0, -WHL_FEMUR / 2), "crema", pata, bisel=0.014)
            rodilla = vacio(f"rodilla_{nombre}", pata, (0, 0, -WHL_FEMUR))
            articulacion(f"eje_rodilla_{nombre}", (0, 0, 0), 0.03, 0.105, rodilla, eje="Y", tapa="rol")
            ty = sy * 0.04  # la tibia va al lado del fémur para poder plegarse sobre él
            cilindro(f"tibia_{nombre}", 0.014, WHL_TIBIA - 0.03, (0, ty, -(WHL_TIBIA - 0.03) / 2), "crema",
                     rodilla, verts=14, r2=0.03, bisel=0.004)
            esfera(f"pie_{nombre}", 0.022, (0, ty, -WHL_TIBIA + 0.022), "goma", rodilla)
    pose_rueda(raiz, 0.0)
    return raiz


def _ang(dx, dz):
    """Giro en Y que lleva la dirección de reposo (0, 0, -1) a (dx, ·, dz)."""
    return math.atan2(-dx, -dz)


def pose_rueda(raiz, t=1.0, imanes=None):
    """t = 0: rodando (vertical, patas plegadas hacia el centro). t = 1: apoyada (recostada, pies al suelo).

    `imanes` fija a mano el ángulo de cada imán sobre la pista (grados desde abajo, + hacia delante);
    por defecto van de ±WHL_IMAN_RODANDO a ±WHL_IMAN_APOYADA. Los pies solo llegan al suelo con los
    imanes en la mitad baja del aro."""
    hijos = {o.name.split(".")[0]: o for o in raiz.children_recursive}
    phi = math.radians(WHL_INCLINACION) * t
    alza = WHL_W / 2 * math.sin(phi)  # al recostarse apoya en el canto del neumático
    raiz.rotation_euler.y = phi
    raiz.location.z = alza
    for k, (iman, sy, patas) in enumerate(WHL_PARES):
        grados = imanes[k] if imanes else sy * (WHL_IMAN_RODANDO + (WHL_IMAN_APOYADA - WHL_IMAN_RODANDO) * t)
        th = math.radians(grados)
        hijos[iman].rotation_euler = (th, 0, 0)  # +th lleva el -Z del imán hacia +Y (delante)
        for nombre, sx in patas:
            plegada = (math.pi - sx * math.radians(7), sx * math.radians(172))  # fémur al centro, tibia de vuelta
            # pie en el marco del imán (plano y = 0): en el suelo y a la x de mundo pedida
            x = WHL_PIES[sx] * math.cos(phi) + alza * math.sin(phi)
            qz = WHL_PIES[sx] * math.sin(phi) - alza * math.cos(phi)
            z = (qz - WHL_R) / max(math.cos(th), 0.2)
            dx, dz = x - sx * WHL_CADERA_X, z + WHL_CADERA_R
            L = min(math.hypot(dx, dz), (WHL_FEMUR + WHL_TIBIA) * 0.995)
            a0 = _ang(dx, dz)
            alfa = math.acos((WHL_FEMUR ** 2 + L ** 2 - WHL_TIBIA ** 2) / (2 * WHL_FEMUR * L))
            af = a0 + sx * alfa  # la rodilla queda hacia fuera
            rx, rz = -math.sin(af) * WHL_FEMUR, -math.cos(af) * WHL_FEMUR
            at = _ang(dx - rx, dz - rz)
            apoyada = (af, (at - af + math.pi) % (2 * math.pi) - math.pi)
            hijos[f"pata_{nombre}"].rotation_euler = (0, plegada[0] + (apoyada[0] - plegada[0]) * t, 0)
            hijos[f"rodilla_{nombre}"].rotation_euler = (0, plegada[1] + (apoyada[1] - plegada[1]) * t, 0)


# ---------------------------------------------------------------- escena y render

UNIDADES = (  # colección, constructor, posición, giro Z en grados, pose de la rueda
    ("transporte_escala", g["robot_transporte"], (-2.35, 0.55, 0), 160, None),
    ("vehiculo_torreta", vehiculo_torreta, (-1.0, 0.0, 0), 205, None),
    ("rueda_rodando", rueda_kamikaze, (0.35, -0.15, 0), 235, 0.0),
    ("rueda_apoyada", rueda_kamikaze, (1.6, 0.25, 0), 215, 1.0),
    ("rueda_imanes", rueda_kamikaze, (2.75, -0.35, 0), 240, (0.0, (75, 180))),  # imanes cambiados de sitio
)


def construir():
    escena = bpy.context.scene
    escena.name = "CBL Unidades de batalla"
    g["_limpiar"](escena)
    g["_mats"].clear()
    raices = {}
    for nombre, fn, pos, giro, pose in UNIDADES:
        col = bpy.data.collections.new(nombre)
        escena.collection.children.link(col)
        r = fn(col)
        if pose is not None:
            pose_rueda(r, *pose) if isinstance(pose, tuple) else pose_rueda(r, pose)
        r.location = Vector(pos) + Vector((0, 0, r.location.z))
        r.rotation_euler.z = math.radians(giro)
        raices[nombre] = r
    esc = bpy.data.collections.new("escenario")
    escena.collection.children.link(esc)
    camo = g["escenario"](esc)
    g["ajustes_render"](escena, camo)
    escena.frame_set(0)
    return escena, camo, raices


VISTAS = (  # archivo, objetivo, azimut, elevación, distancia, (ancho, alto)
    ("render_unidades_batalla.png", (0.45, 0.0, 0.35), 20, 30, 10.2, (1600, 1000)),
    ("render_vehiculo.png", (-1.0, 0.0, 0.3), -28, 22, 3.6, (1200, 900)),  # lado de la placa
    ("render_rueda.png", (1.55, -0.05, 0.4), 14, 18, 6.0, (1600, 900)),
)


def renderizar(destino, escena, camo):
    for archivo, objetivo, az, el, dist, (w, h) in VISTAS:
        g["apuntar"](camo, Vector(objetivo), az, el, dist)
        escena.render.resolution_x, escena.render.resolution_y = w, h
        escena.render.filepath = os.path.join(destino, archivo)
        bpy.ops.render.render(write_still=True)
        print("RENDER", escena.render.filepath)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    destino = os.path.abspath(argv[0]) if argv else RAIZ
    os.makedirs(destino, exist_ok=True)
    if bpy.app.background:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    escena, camo, _ = construir()
    if bpy.app.background:
        if os.environ.get("CBL_MOTOR") == "cycles":  # sin GPU (contenedor): EEVEE no arranca
            escena.render.engine = "CYCLES"
            escena.cycles.samples = 64
            escena.cycles.use_denoising = True
            escena.render.compositor_device = "CPU"
        renderizar(destino, escena, camo)
        g["apuntar"](camo, Vector(VISTAS[0][1]), *VISTAS[0][2:5])
        escena.render.resolution_x, escena.render.resolution_y = VISTAS[0][5]
        escena.render.filepath = "//render_unidades_batalla.png"
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(RAIZ, "unidades_batalla.blend"), compress=True)
