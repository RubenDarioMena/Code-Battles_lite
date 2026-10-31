"""Robots de Code Battle Lite / Codemageddon modelados por código en Blender.

Estética «fábrica de juguete» (concepto «Toy Factory Robots at Work»): piezas industriales
sencillas con biseles generosos, crema con acentos turquesa, articulaciones grafito, amarillo de
seguridad y luces emisivas pequeñas. Hereda las convenciones de
Codemageddon/Concepto2/tools/blender/modelos.py.

Uso desde la sesión abierta (MCP o consola de Blender):
    g = {"__name__": "robots_cbl"}; exec(open(RUTA).read(), g); g["vista_previa"]()
construye la escena «CBL Robots» (ambos robots, suelo, luces y cámara) sin tocar las demás.

Sin ventana (exporta un GLB por robot, con su animación «ciclo»):
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python arte/blender/robots.py -- <carpeta>

Convenciones:
- 1 m = 1 casilla. Cada robot se centra en el origen, apoya en z = 0 y mira hacia +Y de
  Blender (en glTF/Three.js, -Z).
- Las articulaciones son Empties con nombres fijos para animarlas por código: torreta, hombro,
  codo, muneca, dedo_i/d, rueda_i/d_N (transporte); cabeza, abdomen, antena, pata_X,
  femur_X y rodilla_X con X en d1..d4 / i1..i4 (araña); elitro_i/d, propulsor_i/d, llama_i/d
  y patas d1..d3 / i1..i3 (escarabajo; `pose_vuelo` abre élitros y despliega propulsores).
- «rol» es el color de la función principal (turquesa por defecto); el juego puede cambiarlo.
- Las luces son materiales emisivos, no lámparas: el brillo es textura, nunca luz simulada.
- «pantalla» es la cara de la araña; el juego puede ponerle una textura pixel art.
- «carga» agrupa la caja que lleva la pinza; se oculta cuando el robot va vacío.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

N = 48  # fotogramas del ciclo a 24 fps = 2 s

# ---------------------------------------------------------------- materiales


def _lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# nombre: (color sRGB, metálico, rugosidad)
PALETA = {
    "crema": ("#E7DFCE", 0.0, 0.46),
    "rol": ("#2E8C93", 0.0, 0.40),
    "grafito": ("#464B53", 0.45, 0.38),
    "goma": ("#26272B", 0.0, 0.80),
    "acero": ("#A9ADB1", 0.3, 0.36),
    "amarillo": ("#EAA937", 0.0, 0.42),
    "naranja": ("#D35C38", 0.0, 0.50),
    "naranja_oscuro": ("#97391F", 0.0, 0.55),
    "hueso": ("#F3EEE4", 0.0, 0.45),
    "lente": ("#0C0F12", 0.0, 0.08),
    "pantalla": ("#0D1B24", 0.2, 0.15),
}
# nombre: (color sRGB, intensidad de emisión)
EMISIVOS = {
    "luz_calida": ("#FFD39A", 7.0),
    "ambar_luz": ("#FF9F1C", 9.0),
    "cian_luz": ("#58E4FF", 9.0),
    "llama": ("#FFB347", 14.0),
}

_mats = {}


def _entrada(nodo, ident):
    return next(s for s in nodo.inputs if s.identifier == ident)


def material(nombre):
    if nombre in _mats:
        return _mats[nombre]
    m = bpy.data.materials.get(nombre)
    if m is None or not m.get("cbl"):
        m = bpy.data.materials.new(nombre)
        m["cbl"] = True
    try:
        m.use_nodes = True
    except (AttributeError, TypeError):
        pass
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    if nombre in EMISIVOS:
        hexa, fuerza = EMISIVOS[nombre]
        color, metal, rug = _lin(hexa), 0.0, 0.3
        _entrada(bsdf, "Emission Color").default_value = color
        _entrada(bsdf, "Emission Strength").default_value = fuerza
    else:
        hexa, metal, rug = PALETA[nombre]
        color = _lin(hexa)
        _entrada(bsdf, "Emission Strength").default_value = 0.0
    _entrada(bsdf, "Base Color").default_value = color
    _entrada(bsdf, "Metallic").default_value = metal
    _entrada(bsdf, "Roughness").default_value = rug
    m.diffuse_color = color
    _mats[nombre] = m
    return m


# ---------------------------------------------------------------- piezas

COL = None  # colección donde se crean las piezas


def vacio(nombre, padre=None, pos=(0, 0, 0), rot=(0, 0, 0), tam=0.06):
    o = bpy.data.objects.new(nombre, None)
    o.empty_display_type = "PLAIN_AXES"
    o.empty_display_size = tam
    COL.objects.link(o)
    o.parent = padre
    o.location = pos
    o.rotation_euler = rot
    return o


def _objeto(nombre, bm, mat, padre, pos, rot, bisel, segs=3):
    bm.normal_update()
    me = bpy.data.meshes.new(nombre)
    me["cbl"] = True
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    o = bpy.data.objects.new(nombre, me)
    COL.objects.link(o)
    o.parent = padre
    o.location = pos
    o.rotation_euler = rot
    if mat:
        me.materials.append(material(mat))
    if bisel:
        md = o.modifiers.new("bisel", "BEVEL")
        md.width = bisel
        md.segments = segs
        md.limit_method = "ANGLE"
        md.angle_limit = math.radians(30)
        md.harden_normals = True
    return o


def _orientar(bm, eje):
    if eje == "X":
        bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.pi / 2, 4, "Y"), verts=bm.verts)
    elif eje == "Y":
        bmesh.ops.transform(bm, matrix=Matrix.Rotation(-math.pi / 2, 4, "X"), verts=bm.verts)


def caja(nombre, tam, pos, mat, padre, bisel=0.012, rot=(0, 0, 0), segs=3):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((tam[0], tam[1], tam[2], 1.0)))
    return _objeto(nombre, bm, mat, padre, pos, rot, bisel, segs)


def cilindro(nombre, r, h, pos, mat, padre, eje="Z", verts=24, r2=None, bisel=0.005,
             rot=(0, 0, 0), giro=0.0, segs=2):
    """Cilindro (o tronco de cono si hay r2) centrado en pos; r2 queda hacia +eje."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r,
                          radius2=r if r2 is None else r2, depth=h,
                          matrix=Matrix.Rotation(giro, 4, "Z"))
    _orientar(bm, eje)
    return _objeto(nombre, bm, mat, padre, pos, rot, bisel, segs)


def esfera(nombre, r, pos, mat, padre, escala=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r,
                              matrix=Matrix.Diagonal((*escala, 1.0)))
    return _objeto(nombre, bm, mat, padre, pos, (0, 0, 0), 0)


def _prisma_bm(puntos, z0, z1):
    bm = bmesh.new()
    a = [bm.verts.new((x, y, z0)) for x, y in puntos]
    b = [bm.verts.new((x, y, z1)) for x, y in puntos]
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(len(puntos)):
        j = (i + 1) % len(puntos)
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def prisma(nombre, puntos, z0, z1, mat, padre, pos=(0, 0, 0), bisel=0.012, rot=(0, 0, 0), segs=3):
    """Extruye un polígono del plano XY entre z0 y z1."""
    return _objeto(nombre, _prisma_bm(puntos, z0, z1), mat, padre, pos, rot, bisel, segs)


def _anillo_bm(ext, inte, z0, z1, bm=None):
    """Sólido entre dos contornos con el mismo número de puntos (p. ej. un engrane con hueco)."""
    bm = bm or bmesh.new()
    n = len(ext)
    ea = [bm.verts.new((x, y, z0)) for x, y in ext]
    eb = [bm.verts.new((x, y, z1)) for x, y in ext]
    ia = [bm.verts.new((x, y, z0)) for x, y in inte]
    ib = [bm.verts.new((x, y, z1)) for x, y in inte]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((eb[i], eb[j], ib[j], ib[i]))
        bm.faces.new((ea[j], ea[i], ia[i], ia[j]))
        bm.faces.new((ea[i], ea[j], eb[j], eb[i]))
        bm.faces.new((ia[j], ia[i], ib[i], ib[j]))
    return bm


def poligono(n, r, giro=0.0):
    return [(r * math.cos(giro + 2 * math.pi * k / n), r * math.sin(giro + 2 * math.pi * k / n))
            for k in range(n)]


def engrane(nombre, pos, mat, padre, r_ext=0.042, r_raiz=0.033, r_hueco=0.014, dientes=8,
            grosor=0.004, rot=(0, 0, 0)):
    """Icono de engrane (el de las máquinas y cajas de la referencia), en el plano XY."""
    p = 2 * math.pi / dientes
    ext, inte = [], []
    for i in range(dientes):
        a0 = i * p
        for f, r in ((0.0, r_raiz), (0.14, r_ext), (0.42, r_ext), (0.56, r_raiz)):
            a = a0 + f * p
            ext.append((r * math.cos(a), r * math.sin(a)))
            inte.append((r_hueco * math.cos(a), r_hueco * math.sin(a)))
    bm = _anillo_bm(ext, inte, -grosor / 2, grosor / 2)
    return _objeto(nombre, bm, mat, padre, pos, rot, 0.0012, 1)


def articulacion(nombre, pos, r, largo, padre, eje="X", tapa="acero"):
    """Eje grafito con tapas a ambos lados (las articulaciones redondas de la referencia)."""
    j = cilindro(nombre, r, largo, pos, "grafito", padre, eje=eje, verts=24, bisel=0.006)
    if tapa:
        cilindro(nombre + "_tapa", r * 0.56, largo + 0.018, pos, tapa, padre, eje=eje, verts=20,
                 bisel=0.004)
    return j


# ---------------------------------------------------------------- robot de transporte (T1)

ORUGA_X = 0.27       # centro de cada oruga
ORUGA_ANCHO = 0.14
ORUGA_Y0 = -0.02     # centro longitudinal de la oruga
ORUGA_YC = 0.30      # distancia del centro a cada tambor
ORUGA_R = 0.1        # radio exterior de los tambores
ORUGA_GROSOR = 0.024
RUEDA_R = 0.073


def _contorno_estadio(r, n_arco=14, n_recto=6):
    """Puntos (y, z, ny, nz) de un estadio en el plano YZ, empezando abajo y avanzando hacia +Y."""
    yc, zc, y0 = ORUGA_YC, ORUGA_R, ORUGA_Y0
    pts = []
    for k in range(n_recto):
        y = -yc + 2 * yc * k / n_recto
        pts.append((y0 + y, zc - r, 0.0, -1.0))
    for k in range(n_arco):
        a = -math.pi / 2 + math.pi * k / n_arco
        pts.append((y0 + yc + r * math.cos(a), zc + r * math.sin(a), math.cos(a), math.sin(a)))
    for k in range(n_recto):
        y = yc - 2 * yc * k / n_recto
        pts.append((y0 + y, zc + r, 0.0, 1.0))
    for k in range(n_arco):
        a = math.pi / 2 + math.pi * k / n_arco
        pts.append((y0 - yc + r * math.cos(a), zc + r * math.sin(a), math.cos(a), math.sin(a)))
    return pts


def _punto_estadio(s, r):
    """Punto a la distancia s (por el contorno exterior) y su normal."""
    yc, zc, y0 = ORUGA_YC, ORUGA_R, ORUGA_Y0
    recto, arco = 2 * yc, math.pi * r
    s %= 2 * recto + 2 * arco
    if s < recto:
        return Vector((0, y0 - yc + s, zc - r)), Vector((0, 0, -1))
    s -= recto
    if s < arco:
        a = -math.pi / 2 + s / r
        return Vector((0, y0 + yc + r * math.cos(a), zc + r * math.sin(a))), Vector((0, math.cos(a), math.sin(a)))
    s -= arco
    if s < recto:
        return Vector((0, y0 + yc - s, zc + r)), Vector((0, 0, 1))
    s -= recto
    a = math.pi / 2 + s / r
    return Vector((0, y0 - yc + r * math.cos(a), zc + r * math.sin(a))), Vector((0, math.cos(a), math.sin(a)))


def oruga(nombre, x, padre):
    """Banda de goma en estadio con tejas de rodadura."""
    w = ORUGA_ANCHO
    ext = [(y, z) for y, z, _, _ in _contorno_estadio(ORUGA_R)]
    inte = [(y, z) for y, z, _, _ in _contorno_estadio(ORUGA_R - ORUGA_GROSOR)]
    bm = _anillo_bm(ext, inte, -w / 2, w / 2)
    # el anillo se construyó con (y, z) en XY y el ancho en Z: pasar a (x=ancho, y, z)
    giro = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    bmesh.ops.transform(bm, matrix=giro, verts=bm.verts)
    perim = 4 * ORUGA_YC + 2 * math.pi * ORUGA_R
    n = 34
    for k in range(n):
        p, nrm = _punto_estadio(perim * k / n, ORUGA_R)
        tang = Vector((0, -nrm.z, nrm.y))
        c = p + nrm * 0.006
        m = Matrix.Identity(4)
        for i in range(3):
            m[i][0] = (1, 0, 0)[i] * (w + 0.008)
            m[i][1] = tang[i] * 0.026
            m[i][2] = nrm[i] * 0.014
            m[i][3] = c[i]
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _objeto(nombre, bm, "goma", padre, (x, 0, 0), (0, 0, 0), 0.004, 1)


def rueda(nombre, pos, r, lado, padre):
    """Rueda octogonal facetada con buje, como las de la referencia."""
    w = 0.1
    o = cilindro(nombre, r, w, pos, "acero", padre, eje="X", verts=8, giro=math.pi / 8, bisel=0.008)
    rot = (0, 0, 0) if lado > 0 else (0, 0, math.pi)
    cilindro(nombre + "_tapa", r * 0.97, 0.016, (lado * (w / 2 + 0.008), 0, 0), "acero", o, eje="X",
             verts=8, r2=r * 0.38, giro=math.pi / 8, bisel=0.002, rot=rot)
    cilindro(nombre + "_buje", r * 0.3, w + 0.04, (0, 0, 0), "grafito", o, eje="X", verts=12, bisel=0.004)
    return o


def robot_transporte(col):
    """T1: transporte básico de orugas con brazo posterior largo, alineado con su torreta."""
    global COL
    COL = col
    raiz = vacio("RobotTransporte", tam=0.3)
    cuerpo = vacio("cuerpo", raiz)

    # tren de rodaje
    for lado, s in (("i", -1), ("d", 1)):
        oruga(f"oruga_{lado}", s * ORUGA_X, raiz)
        ys = [ORUGA_Y0 + ORUGA_YC * f for f in (-1, -0.5, 0, 0.5, 1)]
        for k, y in enumerate(ys):
            rueda(f"rueda_{lado}_{k}", (s * ORUGA_X, y, ORUGA_R), RUEDA_R, s, raiz)

    # casco
    caja("vientre", (0.38, 0.74, 0.14), (0, -0.03, 0.13), "grafito", cuerpo, bisel=0.015)
    caja("casco", (0.72, 0.85, 0.18), (0, -0.025, 0.28), "crema", cuerpo, bisel=0.02)
    proa = [(-0.36, 0.34), (0.36, 0.34), (0.36, 0.38), (0.27, 0.47), (-0.27, 0.47), (-0.36, 0.38)]
    prisma("proa", proa, 0.075, 0.372, "crema", cuerpo, bisel=0.018)
    for s in (-1, 1):
        caja(f"labio_{'d' if s > 0 else 'i'}", (0.02, 0.78, 0.022), (s * 0.358, -0.04, 0.198), "grafito",
             cuerpo, bisel=0.006)
        caja(f"panel_{'d' if s > 0 else 'i'}", (0.014, 0.6, 0.12), (s * 0.366, -0.06, 0.285), "crema",
             cuerpo, bisel=0.005)
        caja(f"esquina_rol_{'d' if s > 0 else 'i'}", (0.075, 0.09, 0.195), (s * 0.336, -0.418, 0.282),
             "rol", cuerpo, bisel=0.016)
        caja(f"esquina_proa_{'d' if s > 0 else 'i'}", (0.016, 0.05, 0.12), (s * 0.366, 0.36, 0.30), "rol",
             cuerpo, bisel=0.005)
    caja("tapa_delantera", (0.58, 0.33, 0.022), (0, 0.17, 0.377), "crema", cuerpo, bisel=0.008)
    caja("tapa_trasera", (0.58, 0.37, 0.022), (0, -0.205, 0.377), "crema", cuerpo, bisel=0.008)

    # frente: ceja turquesa, cara oscura con dos ojos-faro y parachoques amarillo
    caja("ceja_rol", (0.52, 0.022, 0.08), (0, 0.472, 0.328), "rol", cuerpo, bisel=0.008)
    caja("cara", (0.42, 0.012, 0.13), (0, 0.472, 0.214), "goma", cuerpo, bisel=0.004)
    for s in (-1, 1):
        lado = "d" if s > 0 else "i"
        x = s * 0.105
        cilindro(f"ojo_{lado}_aro", 0.052, 0.022, (x, 0.478, 0.214), "grafito", cuerpo, eje="Y", bisel=0.004)
        cilindro(f"ojo_{lado}_luz", 0.041, 0.028, (x, 0.48, 0.214), "luz_calida", cuerpo, eje="Y", bisel=0.002)
        cilindro(f"ojo_{lado}", 0.03, 0.032, (x, 0.482, 0.214), "lente", cuerpo, eje="Y", bisel=0.003)
        cilindro(f"perno_{lado}", 0.011, 0.01, (s * 0.175, 0.5, 0.11), "grafito", cuerpo, eje="Y", verts=10,
                 bisel=0.002)
    caja("parachoques", (0.47, 0.04, 0.066), (0, 0.478, 0.11), "amarillo", cuerpo, bisel=0.01)
    caja("luz_frontal", (0.13, 0.012, 0.018), (0, 0.5, 0.113), "ambar_luz", cuerpo, bisel=0.002)

    # trasera y cubierta
    for s in (-1, 1):
        caja(f"piloto_{'d' if s > 0 else 'i'}", (0.06, 0.012, 0.026), (s * 0.215, -0.456, 0.33), "ambar_luz",
             cuerpo, bisel=0.003)
    for k in range(3):
        caja(f"rejilla_{k}", (0.17, 0.012, 0.012), (0, -0.455, 0.235 + k * 0.03), "goma", cuerpo, bisel=0.002)
    cilindro("luz_estado_base", 0.03, 0.014, (0.235, 0.29, 0.393), "grafito", cuerpo, verts=16)
    cilindro("luz_estado", 0.021, 0.026, (0.235, 0.29, 0.405), "ambar_luz", cuerpo, verts=16, bisel=0.006)

    # brazo: torreta → hombro → codo → muñeca → pinza (todo alineado sobre el eje de la torreta)
    torreta = vacio("torreta", cuerpo, (0, -0.19, 0.388))
    prisma("aro_torreta", poligono(8, 0.13, math.pi / 8), 0.0, 0.058, "rol", torreta, bisel=0.012)
    cilindro("anillo_torreta", 0.098, 0.03, (0, 0, 0.07), "grafito", torreta, verts=24)
    caja("base_hombro", (0.165, 0.165, 0.17), (0, 0, 0.165), "crema", torreta, bisel=0.024)
    caja("costura_hombro", (0.167, 0.006, 0.11), (0, 0, 0.16), "grafito", torreta, bisel=0.0)
    hombro = vacio("hombro", torreta, (0, 0, 0.255))
    articulacion("eje_hombro", (0, 0, 0), 0.058, 0.215, hombro)
    L1, L2 = 0.44, 0.38
    caja("brazo_a", (0.112, 0.098, L1), (0, 0, L1 / 2), "crema", hombro, bisel=0.02)
    caja("brazo_a_placa", (0.117, 0.046, L1 * 0.55), (0, 0, L1 * 0.5), "crema", hombro, bisel=0.008)
    caja("collar_codo", (0.12, 0.106, 0.05), (0, 0, L1 - 0.07), "amarillo", hombro, bisel=0.009)
    codo = vacio("codo", hombro, (0, 0, L1))
    articulacion("eje_codo", (0, 0, 0), 0.052, 0.165, codo)
    caja("brazo_b", (0.096, 0.086, L2), (0, 0, L2 / 2), "crema", codo, bisel=0.018)
    caja("brazo_b_placa", (0.101, 0.038, L2 * 0.5), (0, 0, L2 * 0.5), "crema", codo, bisel=0.007)
    muneca = vacio("muneca", codo, (0, 0, L2))
    articulacion("eje_muneca", (0, 0, 0), 0.043, 0.13, muneca)
    caja("muneca_cuerpo", (0.072, 0.07, 0.07), (0, 0, 0.045), "grafito", muneca, bisel=0.01)
    caja("pinza_base", (0.225, 0.075, 0.04), (0, 0, 0.09), "acero", muneca, bisel=0.008)
    for s in (-1, 1):
        lado = "d" if s > 0 else "i"
        dedo = vacio(f"dedo_{lado}", muneca, (s * 0.096, 0, 0.1))
        caja(f"dedo_{lado}_a", (0.026, 0.062, 0.13), (0, 0, 0.06), "acero", dedo, bisel=0.006)
        caja(f"dedo_{lado}_yema", (0.016, 0.066, 0.05), (-s * 0.016, 0, 0.1), "grafito", dedo, bisel=0.004)

    carga = vacio("carga", muneca, (0, 0, 0.19))
    caja_carga(carga)
    return raiz


def caja_carga(padre, lado=0.17):
    """Caja naranja con marco oscuro y engrane blanco, como la de la referencia."""
    h = lado / 2
    caja("caja", (lado, lado, lado), (0, 0, 0), "naranja_oscuro", padre, bisel=0.012)
    t = lado * 0.8
    for nombre, tam, pos in (("cara_px", (0.006, t, t), (h, 0, 0)), ("cara_nx", (0.006, t, t), (-h, 0, 0)),
                             ("cara_py", (t, 0.006, t), (0, h, 0)), ("cara_ny", (t, 0.006, t), (0, -h, 0)),
                             ("cara_pz", (t, t, 0.006), (0, 0, h)), ("cara_nz", (t, t, 0.006), (0, 0, -h))):
        caja(nombre, tam, pos, "naranja", padre, bisel=0.003)
    engrane("engrane_py", (0, h + 0.005, 0), "hueso", padre, rot=(-math.pi / 2, 0, 0))
    engrane("engrane_ny", (0, -h - 0.005, 0), "hueso", padre, rot=(math.pi / 2, 0, 0))


def pose_transporte(raiz, giro=0.0, a1=0.0, a2=0.0, a3=0.0, pinza=0.0):
    """Ángulos en grados. a1-a3 > 0 inclinan el brazo hacia la trasera de la torreta."""
    o = {c.name.split(".")[0]: c for c in raiz.children_recursive}
    o["torreta"].rotation_euler = (0, 0, math.radians(giro))
    o["hombro"].rotation_euler = (math.radians(a1), 0, 0)
    o["codo"].rotation_euler = (math.radians(a2), 0, 0)
    o["muneca"].rotation_euler = (math.radians(a3), 0, 0)
    o["dedo_i"].rotation_euler = (0, math.radians(-pinza), 0)
    o["dedo_d"].rotation_euler = (0, math.radians(pinza), 0)


# ---------------------------------------------------------------- robot araña

ARANA_Z = 0.27            # altura de las caderas
ARANA_RC = 0.2            # radio de las caderas sobre el tórax
FEMUR, TIBIA = 0.29, 0.42  # largo de los segmentos de pata
PIE_R = 0.03
PATAS = (("d1", 34), ("d2", 72), ("d3", 108), ("d4", 144),
         ("i1", -34), ("i2", -72), ("i3", -108), ("i4", -144))  # grados desde +Y hacia +X
ALCANCE = 0.36            # distancia horizontal de la cadera al pie en reposo

# Cara pixel art de 32 x 16 (fila 0 arriba): «#» ojo, «o» brillo, «+» ojo pequeño.
CARAS = {
    "neutra": [
        "................................",
        "................................",
        "..++......................++....",
        "..++......................++....",
        "................................",
        ".......######....######.........",
        "......#oo#####..#oo#####........",
        "......#oo#####..#oo#####........",
        "......########..########........",
        "......########..########........",
        "......########..########........",
        ".......######....######.........",
        "................................",
        "................................",
        "................................",
        "................................",
    ],
    "contenta": [
        "................................",
        "................................",
        "..++......................++....",
        "..++......................++....",
        "................................",
        "................................",
        ".......######....######.........",
        "......########..########........",
        "......###..###..###..###........",
        "......##....##..##....##........",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
        "................................",
    ],
}


def textura_cara(expresion="neutra"):
    """Imagen pixel art para «pantalla» (la regla de Codemageddon: la cara del robot es pixel art)."""
    nombre = f"cbl_cara_{expresion}"
    img = bpy.data.images.get(nombre) or bpy.data.images.new(nombre, 32, 16, alpha=False)
    fondo, ojo, brillo, chico = (0.03, 0.07, 0.1), (0.35, 0.9, 1.0), (0.92, 1.0, 1.0), (0.22, 0.7, 0.82)
    filas = CARAS[expresion]
    px = []
    for y in range(16):
        fila = filas[15 - y]  # Blender guarda las filas de abajo arriba
        for x in range(32):
            c = {"#": ojo, "o": brillo, "+": chico}.get(fila[x], fondo)
            if fila[x] == "." and y % 2:
                c = tuple(v * 0.75 for v in c)
            px.extend((*c, 1.0))
    img.pixels = px
    img.pack()
    return img


def _material_pantalla(expresion="neutra"):
    nombre = "pantalla_pixel"
    if nombre in _mats:
        return _mats[nombre]
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    try:
        m.use_nodes = True
    except (AttributeError, TypeError):
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"):
            nt.nodes.remove(n)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = textura_cara(expresion)
    tex.interpolation = "Closest"
    nt.links.new(tex.outputs["Color"], _entrada(bsdf, "Base Color"))
    nt.links.new(tex.outputs["Color"], _entrada(bsdf, "Emission Color"))
    _entrada(bsdf, "Emission Strength").default_value = 3.0
    _entrada(bsdf, "Roughness").default_value = 0.2
    m.diffuse_color = _lin("#1B6F80")
    _mats[nombre] = m
    return m


def pantalla_plana(nombre, ancho, alto, pos, padre):
    """Rectángulo con UV 0..1 mirando a +Y, para la textura de la cara."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    w, h = ancho / 2, alto / 2
    vs = [bm.verts.new(v) for v in ((-w, 0, -h), (-w, 0, h), (w, 0, h), (w, 0, -h))]
    f = bm.faces.new(vs)
    for lazo, c in zip(f.loops, ((0, 0), (0, 1), (1, 1), (1, 0))):
        lazo[uv].uv = c
    o = _objeto(nombre, bm, None, padre, pos, (0, 0, 0), 0)
    o.data.materials.append(_material_pantalla())
    return o


def _ik(dx, dz, lf=FEMUR, lt=TIBIA):
    """Pierna de dos segmentos con la rodilla arriba. Devuelve (giro_femur, giro_rodilla) en Y."""
    d = max(min(math.hypot(dx, dz), lf + lt - 1e-4), abs(lf - lt) + 1e-4)
    bajo = math.atan2(-dz, dx)
    alfa = math.acos((lf ** 2 + d ** 2 - lt ** 2) / (2 * lf * d))
    elev = alfa - bajo
    kx, kz = lf * math.cos(elev), lf * math.sin(elev)
    caida = math.atan2(-(dz - kz), dx - kx)
    return -elev, caida + elev


def robot_arana(col):
    """Araña de ocho patas con cara-pantalla: candidata a protagonista de Campaign."""
    global COL
    COL = col
    raiz = vacio("RobotArana", tam=0.3)
    cuerpo = vacio("cuerpo", raiz)

    # tórax octogonal: vientre grafito, carcasa crema, franja y escotilla «rol»
    octo = math.pi / 8
    prisma("torax_vientre", poligono(8, 0.19, octo), 0.19, 0.27, "grafito", cuerpo, bisel=0.02)
    prisma("torax", poligono(8, 0.225, octo), 0.245, 0.345, "crema", cuerpo, bisel=0.024)
    prisma("franja_rol", poligono(8, 0.231, octo), 0.284, 0.307, "rol", cuerpo, bisel=0.004)
    cilindro("torax_tapa", 0.205, 0.05, (0, 0, 0.37), "crema", cuerpo, verts=8, r2=0.15, giro=octo,
             bisel=0.015)
    prisma("escotilla_rol", poligono(8, 0.11, octo), 0.393, 0.41, "rol", cuerpo, bisel=0.006)
    cilindro("luz_estado", 0.02, 0.02, (0, -0.06, 0.418), "ambar_luz", cuerpo, verts=12, bisel=0.004)

    # cabeza: cráneo crema, visor grafito con la cara pixel art, ceja «rol» y quelíceros
    cabeza = vacio("cabeza", cuerpo, (0, 0.19, 0.3))
    cilindro("cuello", 0.062, 0.08, (0, -0.01, 0), "grafito", cabeza, eje="Y", verts=16)
    caja("craneo", (0.23, 0.17, 0.16), (0, 0.075, 0.01), "crema", cabeza, bisel=0.05, segs=4)
    caja("ceja_rol", (0.17, 0.07, 0.022), (0, 0.09, 0.091), "rol", cabeza, bisel=0.009)
    caja("visor", (0.2, 0.022, 0.104), (0, 0.158, 0.008), "grafito", cabeza, bisel=0.016)
    pantalla_plana("pantalla", 0.17, 0.085, (0, 0.1695, 0.008), cabeza)
    for s in (-1, 1):
        lado = "d" if s > 0 else "i"
        caja(f"queliceros_{lado}", (0.032, 0.056, 0.062), (s * 0.046, 0.14, -0.082), "grafito", cabeza,
             bisel=0.01, rot=(math.radians(-25), 0, 0))

    # abdomen: cápsula crema con franja «rol», hilera ámbar, «batería» y antena
    abdomen = vacio("abdomen", cuerpo, (0, -0.19, 0.335), rot=(math.radians(-8), 0, 0))
    cilindro("pedicelo", 0.066, 0.1, (0, -0.02, 0), "grafito", abdomen, eje="Y", verts=16)
    caja("abdomen_casco", (0.34, 0.4, 0.27), (0, -0.25, 0.05), "crema", abdomen, bisel=0.09, segs=5)
    caja("abdomen_franja_rol", (0.096, 0.406, 0.276), (0, -0.25, 0.05), "rol", abdomen, bisel=0.045, segs=4)
    cilindro("hilera", 0.04, 0.04, (0, -0.452, 0.0), "grafito", abdomen, eje="Y", verts=16)
    cilindro("hilera_luz", 0.025, 0.044, (0, -0.455, 0.0), "ambar_luz", abdomen, eje="Y", verts=16)
    for k in range(3):
        for s in (-1, 1):
            caja(f"bateria_{'d' if s > 0 else 'i'}_{k}", (0.008, 0.042, 0.02),
                 (s * 0.171, -0.19 - k * 0.06, 0.06), "ambar_luz", abdomen, bisel=0.002)
    antena = vacio("antena", abdomen, (0.085, -0.16, 0.185))
    cilindro("antena_base", 0.024, 0.024, (0, 0, 0.005), "grafito", antena, verts=14)
    cilindro("antena_mastil", 0.009, 0.13, (0, 0, 0.07), "grafito", antena, verts=8, bisel=0)
    cilindro("antena_luz", 0.016, 0.05, (0, 0, 0.15), "cian_luz", antena, verts=12, bisel=0.006)

    # patas: cadera (giro Z) → fémur (giro Y) → rodilla (giro Y)
    b, c = _ik(ALCANCE, PIE_R - ARANA_Z)
    for nombre, grados in PATAS:
        t = math.radians(grados)
        pata = vacio(f"pata_{nombre}", cuerpo,
                     (ARANA_RC * math.sin(t), ARANA_RC * math.cos(t), ARANA_Z), (0, 0, math.pi / 2 - t))
        cilindro(f"coxa_{nombre}", 0.048, 0.085, (0, 0, 0), "grafito", pata, verts=16, bisel=0.009)
        femur = vacio(f"femur_{nombre}", pata, (0.035, 0, 0), (0, b, 0))
        cilindro(f"cadera_{nombre}", 0.04, 0.09, (0, 0, 0), "grafito", femur, eje="Y", verts=16)
        caja(f"femur_{nombre}_m", (FEMUR, 0.064, 0.06), (FEMUR / 2, 0, 0), "crema", femur, bisel=0.018)
        caja(f"femur_{nombre}_rol", (FEMUR * 0.55, 0.066, 0.016), (FEMUR * 0.52, 0, 0.027), "rol", femur,
             bisel=0.005)
        rodilla = vacio(f"rodilla_{nombre}", femur, (FEMUR, 0, 0), (0, c, 0))
        articulacion(f"rodilla_{nombre}_eje", (0, 0, 0), 0.05, 0.085, rodilla, eje="Y", tapa="rol")
        caja(f"tibia_{nombre}", (TIBIA * 0.58, 0.056, 0.056), (TIBIA * 0.3, 0, 0), "crema", rodilla,
             bisel=0.017)
        caja(f"espinilla_{nombre}", (TIBIA * 0.42, 0.042, 0.042), (TIBIA * 0.76, 0, 0), "grafito", rodilla,
             bisel=0.012)
        esfera(f"pie_{nombre}", PIE_R, (TIBIA, 0, 0), "goma", rodilla)
    return raiz


# ---------------------------------------------------------------- escarabajo explorador

ESC_FEMUR, ESC_TIBIA = 0.25, 0.37
ESC_Z = 0.3               # altura de las caderas
ESC_ALCANCE = 0.29
ESC_PATAS = (("d1", 0.12, 52), ("d2", -0.05, 92), ("d3", -0.22, 128),
             ("i1", 0.12, -52), ("i2", -0.05, -92), ("i3", -0.22, -128))  # (nombre, y de la cadera, grados)
CAPARAZON = (0.215, 0.31, 0.175)  # semiejes
CAPARAZON_Y, CAPARAZON_Z, CAPARAZON_SUELO = -0.06, 0.38, 0.28
ENSANCHE = 0.12           # el caparazón es más ancho atrás, como un huevo


def _forma_huevo(x, y, z, a, b, c, ensanche, suelo):
    f = 1 + ensanche * max(0.0, -y / b)
    return x * f, y, max(z, suelo)


def elipsoide(nombre, semiejes, pos, mat, padre, ensanche=0.0, suelo=None, u=36, v=18):
    """Elipsoide (opcionalmente con forma de huevo y base plana a la altura local `suelo`)."""
    a, b, c = semiejes
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    lim = -1e9 if suelo is None else suelo
    for vt in bm.verts:
        x, y, z = vt.co.x * a, vt.co.y * b, vt.co.z * c
        vt.co = _forma_huevo(x, y, z, a, b, c, ensanche, lim)
    return _objeto(nombre, bm, mat, padre, pos, (0, 0, 0), 0)


def aro_caparazon(nombre, y_local, ancho, mat, padre, margen=0.005):
    """Franja que rodea el caparazón a la distancia y_local de su centro."""
    a, b, c = CAPARAZON
    k = math.sqrt(max(0.0, 1 - (y_local / b) ** 2))
    rx = a * k * (1 + ENSANCHE * max(0.0, -y_local / b)) + margen
    rz = c * k + margen
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=48, radius1=1, radius2=1, depth=ancho)
    _orientar(bm, "Y")
    suelo = CAPARAZON_SUELO - CAPARAZON_Z + 0.004
    for vt in bm.verts:
        vt.co = Vector((vt.co.x * rx, vt.co.y, max(vt.co.z * rz, suelo)))
    return _objeto(nombre, bm, mat, padre, (0, CAPARAZON_Y + y_local, CAPARAZON_Z), (0, 0, 0), 0)


BISAGRA = (0, 0.16, 0.5)   # bisagra delantera de los élitros
CORTE_ELITRO = -0.25       # los élitros bajan hasta -0.25 del semieje vertical
FRANJAS = ((0.2, 0.024), (-0.08, 0.02))  # (y local, medio ancho) de las franjas «rol»
PROPULSOR_X = (0.07, 0.31)  # recogido / desplegado


def _elitro_bm(lado):
    """Mitad del caparazón (lado +1 derecha, -1 izquierda) con polos en Y para que las franjas
    «rol» y la costura sigan las aristas. Índices de material: 0 crema, 1 rol."""
    a, b, c = CAPARAZON
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=28, radius=1.0)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, "X"))
    for vt in bm.verts:
        x = 0.0 if abs(vt.co.x) < 1e-5 else vt.co.x
        vt.co = _forma_huevo(x * a, vt.co.y * b, vt.co.z * c, a, b, c, ENSANCHE, -1e9)
    fuera = [f for f in bm.faces if f.calc_center_median().x * lado <= 0
             or f.calc_center_median().z < CORTE_ELITRO * c]
    bmesh.ops.delete(bm, geom=fuera, context="FACES")
    for f in bm.faces:
        cm = f.calc_center_median()
        franja = any(abs(cm.y - y) < w for y, w in FRANJAS) or abs(cm.x) < 0.014
        f.material_index = 1 if franja else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def elitro(nombre, lado, padre):
    bm = _elitro_bm(lado)
    desplaz = Vector((0, CAPARAZON_Y, CAPARAZON_Z)) - Vector(BISAGRA)
    bmesh.ops.translate(bm, verts=bm.verts, vec=desplaz)
    o = _objeto(nombre + "_m", bm, None, padre, (0, 0, 0), (0, 0, 0), 0)
    for m in ("crema", "rol", "grafito", "grafito"):
        o.data.materials.append(material(m))
    md = o.modifiers.new("grosor", "SOLIDIFY")
    md.thickness = 0.011
    md.offset = -1.0
    md.use_even_offset = True
    md.use_rim = True
    md.material_offset = 2       # cara interior grafito
    md.material_offset_rim = 0
    return o


def propulsor(lado, padre):
    """Propulsor que sale de debajo del élitro. «llama_X» se escala para encenderlo."""
    s = 1 if lado == "d" else -1
    p = vacio(f"propulsor_{lado}", padre, (s * PROPULSOR_X[0], -0.2, 0.4))
    caja(f"riel_{lado}", (0.24, 0.032, 0.028), (-s * 0.12, 0, 0.0), "grafito", p, bisel=0.008)
    cilindro(f"gondola_{lado}", 0.058, 0.12, (0, 0, 0.0), "crema", p, verts=24, bisel=0.014)
    cilindro(f"gondola_{lado}_rol", 0.06, 0.022, (0, 0, 0.03), "rol", p, verts=24, bisel=0.004)
    cilindro(f"gondola_{lado}_tapa", 0.036, 0.02, (0, 0, 0.066), "grafito", p, verts=16, bisel=0.004)
    cilindro(f"tobera_{lado}", 0.05, 0.05, (0, 0, -0.085), "grafito", p, verts=24, r2=0.04, bisel=0.004)
    cilindro(f"tobera_{lado}_luz", 0.036, 0.006, (0, 0, -0.111), "ambar_luz", p, verts=20, bisel=0)
    llama = vacio(f"llama_{lado}", p, (0, 0, -0.112), tam=0.03)
    cilindro(f"llama_{lado}_m", 0.034, 0.18, (0, 0, -0.09), "llama", llama, verts=16, r2=0.004, bisel=0,
             rot=(math.pi, 0, 0))
    llama.scale = (1, 1, 0.001)
    return p


def robot_escarabajo(col):
    """Explorador de seis patas con un solo caparazón: los élitros se abren para volar con dos
    propulsores laterales. Sus ojos son los sensores."""
    global COL
    COL = col
    raiz = vacio("RobotEscarabajo", tam=0.3)
    cuerpo = vacio("cuerpo", raiz)
    a, b, c = CAPARAZON
    suelo = CAPARAZON_SUELO - CAPARAZON_Z

    # núcleo grafito (se ve bajo los élitros y al abrirlos), élitros y propulsores
    elipsoide("nucleo", (a * 0.95, b * 0.95, c * 0.93), (0, CAPARAZON_Y, CAPARAZON_Z), "grafito", cuerpo,
              ENSANCHE, suelo)
    elipsoide("nucleo_luz", (0.012, b * 0.78, c * 0.94), (0, CAPARAZON_Y, CAPARAZON_Z), "cian_luz", cuerpo,
              0.0, suelo, u=12)
    for lado, sgn in (("d", 1), ("i", -1)):
        bis = vacio(f"elitro_{lado}", cuerpo, BISAGRA)
        elitro(f"elitro_{lado}", sgn, bis)
        propulsor(lado, cuerpo)
        for k in range(3):
            y = -0.12 - k * 0.06
            kk = math.sqrt(max(0.0, 1 - ((y - CAPARAZON_Y) / (b * 0.95)) ** 2 - 0.2 ** 2))
            x = a * 0.95 * kk * (1 + ENSANCHE * max(0.0, -(y - CAPARAZON_Y) / b))
            caja(f"bateria_{lado}_{k}", (0.012, 0.032, 0.016), (sgn * x, y, CAPARAZON_Z - 0.2 * c * 0.93),
                 "ambar_luz", cuerpo, bisel=0.002)

    # cabeza: cúpula crema con dos ojos-sensor y collar grafito
    cabeza = vacio("cabeza", cuerpo, (0, 0.22, 0.36))
    cilindro("collar", 0.115, 0.06, (0, -0.005, 0.0), "grafito", cabeza, eje="Y", verts=32)
    elipsoide("craneo", (0.15, 0.115, 0.115), (0, 0.075, 0.005), "crema", cabeza, suelo=-0.075)
    caja("craneo_rol", (0.05, 0.12, 0.03), (0, 0.06, 0.112), "rol", cabeza, bisel=0.012)
    for s in (-1, 1):
        lado = "d" if s > 0 else "i"
        cilindro(f"ojo_{lado}_aro", 0.064, 0.03, (s * 0.083, 0.135, 0.03), "grafito", cabeza, eje="Y", verts=28,
                 rot=(0, 0, s * math.radians(-28)), bisel=0.006)
        esfera(f"ojo_{lado}", 0.056, (s * 0.088, 0.15, 0.03), "cian_luz", cabeza, escala=(1, 0.75, 1))
    caja("morro", (0.07, 0.03, 0.03), (0, 0.185, -0.04), "grafito", cabeza, bisel=0.01)
    cilindro("morro_luz", 0.011, 0.012, (0, 0.2, -0.04), "ambar_luz", cabeza, eje="Y", verts=12, bisel=0.002)
    cilindro("luz_estado", 0.014, 0.018, (0, -0.02, 0.118), "ambar_luz", cabeza, verts=12, bisel=0.004)

    # patas de pistón: rótula → fémur → rodilla → tibia con bota cilíndrica
    b_, c_ = _ik(ESC_ALCANCE, 0.012 - ESC_Z, ESC_FEMUR, ESC_TIBIA)
    for nombre, y, grados in ESC_PATAS:
        t = math.radians(grados)
        x = 0.13 if abs(grados) < 110 else 0.12
        pata = vacio(f"pata_{nombre}", cuerpo, (math.copysign(x, grados), y, ESC_Z), (0, 0, math.pi / 2 - t))
        esfera(f"rotula_{nombre}", 0.036, (0, 0, 0), "grafito", pata)
        femur = vacio(f"femur_{nombre}", pata, (0.02, 0, 0), (0, b_, 0))
        lf, lt = ESC_FEMUR, ESC_TIBIA
        cilindro(f"femur_{nombre}_eje", 0.017, lf, (lf / 2, 0, 0), "grafito", femur, eje="X", verts=12)
        cilindro(f"femur_{nombre}_m", 0.03, lf * 0.6, (lf * 0.42, 0, 0), "crema", femur, eje="X", verts=16,
                 bisel=0.008)
        cilindro(f"femur_{nombre}_rol", 0.032, 0.016, (lf * 0.78, 0, 0), "rol", femur, eje="X", verts=16)
        rodilla = vacio(f"rodilla_{nombre}", femur, (lf, 0, 0), (0, c_, 0))
        esfera(f"rodilla_{nombre}_bola", 0.034, (0, 0, 0), "grafito", rodilla)
        cilindro(f"rodilla_{nombre}_tapa", 0.022, 0.078, (0, 0, 0), "rol", rodilla, eje="Y", verts=16)
        cilindro(f"tibia_{nombre}", 0.015, lt, (lt / 2, 0, 0), "grafito", rodilla, eje="X", verts=12)
        cilindro(f"bota_{nombre}", 0.034, 0.12, (lt - 0.075, 0, 0), "crema", rodilla, eje="X", verts=16,
                 r2=0.04, bisel=0.008)
        cilindro(f"suela_{nombre}", 0.043, 0.024, (lt - 0.004, 0, 0), "goma", rodilla, eje="X", verts=16,
                 bisel=0.006)
    return raiz


def pose_vuelo(raiz, t=1.0):
    """Abre los élitros, despliega los propulsores y recoge las patas (t de 0 a 1)."""
    o = _hijos(raiz)
    for lado, s in (("d", 1), ("i", -1)):
        o[f"elitro_{lado}"].rotation_euler = (math.radians(-38 * t), math.radians(-18 * s * t),
                                              math.radians(34 * s * t))
        o[f"propulsor_{lado}"].location.x = s * (PROPULSOR_X[0] + (PROPULSOR_X[1] - PROPULSOR_X[0]) * t)
        o[f"llama_{lado}"].scale = (1, 1, max(t, 0.001))
    b0, c0 = _ik(ESC_ALCANCE, 0.012 - ESC_Z, ESC_FEMUR, ESC_TIBIA)
    for nombre, _, _ in ESC_PATAS:
        o[f"femur_{nombre}"].rotation_euler = (0, b0 + (-0.45 - b0) * t, 0)
        o[f"rodilla_{nombre}"].rotation_euler = (0, c0 + (2.3 - c0) * t, 0)


# ---------------------------------------------------------------- animaciones «ciclo»


def _hijos(raiz):
    return {c.name.split(".")[0]: c for c in raiz.children_recursive}


def _clave(obj, ruta, valor, fr):
    setattr(obj, ruta, valor)
    obj.keyframe_insert(ruta, frame=fr)


def _lineal(objetos):
    """Interpolación lineal en todas las claves (Blender 5 guarda las curvas en capas)."""
    for obj in objetos:
        ad = obj.animation_data
        if not ad or not ad.action:
            continue
        acc = ad.action
        curvas = getattr(acc, "fcurves", None)
        if curvas is None:
            curvas = [fc for capa in acc.layers for tira in capa.strips
                      for bolsa in tira.channelbags for fc in bolsa.fcurves]
        for fc in curvas:
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"


def _envolver(a, ref):
    return ref + (a - ref + math.pi) % (2 * math.pi) - math.pi


def animar_caminar(raiz, grupo_a, lf, lt, desplaz, alcance, pie_z, paso, alto, bob=0.008):
    """Paso en el sitio: medio grupo apoya y empuja hacia atrás mientras el otro avanza en el aire.
    Los pies se calculan en el suelo y las rodillas por cinemática inversa, así no resbalan."""
    o = _hijos(raiz)
    cuerpo = o["cuerpo"]
    patas = []
    for nombre in sorted(k[5:] for k in o if k.startswith("pata_")):
        pata, femur, rod = o[f"pata_{nombre}"], o[f"femur_{nombre}"], o[f"rodilla_{nombre}"]
        cadera = Vector(pata.location)
        phi = pata.rotation_euler.z
        reposo = cadera + Vector((math.cos(phi), math.sin(phi), 0)) * (desplaz + alcance)
        reposo.z = pie_z
        patas.append((pata, femur, rod, cadera, reposo, phi, 0.0 if nombre in grupo_a else 0.5))
    for f in range(0, N + 1, 2):
        u = f / N
        h = bob * math.cos(4 * math.pi * u)
        _clave(cuerpo, "location", (0, 0, h), f)
        for pata, femur, rod, cadera, reposo, phi, fase in patas:
            ph = (u + fase) % 1.0
            if ph < 0.5:
                dy, sube = paso * (0.5 - ph / 0.5), 0.0
            else:
                s = (ph - 0.5) / 0.5
                s = s * s * (3 - 2 * s)
                dy, sube = paso * (s - 0.5), alto * math.sin(math.pi * s)
            v = reposo + Vector((0, dy, sube - h)) - cadera
            giro = _envolver(math.atan2(v.y, v.x), phi)
            b, c = _ik(math.hypot(v.x, v.y) - desplaz, v.z, lf, lt)
            _clave(pata, "rotation_euler", (0, 0, giro), f)
            _clave(femur, "rotation_euler", (0, b, 0), f)
            _clave(rod, "rotation_euler", (0, c, 0), f)
    return o


def animar_transporte(raiz, giro=-25.0, a1=28.0, a2=74.0):
    o = _hijos(raiz)
    for f in range(0, N + 1, 2):
        u = f / N
        w = 2 * math.pi * u
        for k, obj in o.items():
            if k.startswith("rueda_") and k.count("_") == 2:
                _clave(obj, "rotation_euler", (-w, 0, 0), f)
        _clave(o["cuerpo"], "location", (0, 0, 0.003 * math.sin(4 * w)), f)
        b1 = a1 + 3 * math.sin(w + 0.6)
        b2 = a2 + 6 * math.sin(w)
        _clave(o["torreta"], "rotation_euler", (0, 0, math.radians(giro + 9 * math.sin(w))), f)
        _clave(o["hombro"], "rotation_euler", (math.radians(b1), 0, 0), f)
        _clave(o["codo"], "rotation_euler", (math.radians(b2), 0, 0), f)
        _clave(o["muneca"], "rotation_euler", (math.radians(180 - b1 - b2), 0, 0), f)
    _lineal(o.values())


def animar_arana(raiz):
    o = animar_caminar(raiz, ("d1", "i2", "d3", "i4"), FEMUR, TIBIA, 0.035, ALCANCE, PIE_R, 0.11, 0.065)
    for f in range(0, N + 1, 2):
        w = 2 * math.pi * f / N
        _clave(o["cabeza"], "rotation_euler", (0, 0, math.radians(7 * math.sin(w))), f)
        _clave(o["abdomen"], "rotation_euler", (math.radians(-8 + 2.5 * math.sin(2 * w)), 0,
                                                math.radians(3 * math.sin(w + 1.2))), f)
        _clave(o["antena"], "rotation_euler", (math.radians(9 * math.sin(2 * w + 1)), 0, 0), f)
    _lineal(o.values())


def animar_escarabajo(raiz):
    o = animar_caminar(raiz, ("d1", "i2", "d3"), ESC_FEMUR, ESC_TIBIA, 0.02, ESC_ALCANCE, 0.012, 0.09, 0.055)
    for f in range(0, N + 1, 2):
        w = 2 * math.pi * f / N
        _clave(o["cabeza"], "rotation_euler", (math.radians(3 * math.sin(2 * w)), 0,
                                               math.radians(6 * math.sin(w))), f)
    _lineal(o.values())


def animar_vuelo(raiz, altura=0.34):
    """Escarabajo en vuelo estacionario: élitros abiertos, propulsores encendidos y balanceo."""
    pose_vuelo(raiz, 1.0)
    o = _hijos(raiz)
    for f in range(0, N + 1, 2):
        w = 2 * math.pi * f / N
        _clave(o["cuerpo"], "location", (0, 0, altura + 0.025 * math.sin(w)), f)
        _clave(o["cuerpo"], "rotation_euler", (math.radians(2 * math.sin(w + 0.8)), math.radians(3 * math.sin(w)), 0), f)
        for lado, s in (("d", 1), ("i", -1)):
            _clave(o[f"llama_{lado}"], "scale", (1, 1, 1 + 0.18 * math.sin(6 * w + s)), f)
            e = o[f"elitro_{lado}"]
            _clave(e, "rotation_euler", (math.radians(-38 + 2.5 * math.sin(2 * w)), math.radians(-18 * s),
                                         math.radians(34 * s)), f)
    _lineal(o.values())


ANIMACIONES = {
    "robot_transporte": animar_transporte,
    "robot_arana": animar_arana,
    "robot_escarabajo": animar_escarabajo,
}


# ---------------------------------------------------------------- escena de vista previa


def _material_suelo():
    m = bpy.data.materials.get("cbl_suelo") or bpy.data.materials.new("cbl_suelo")
    try:
        m.use_nodes = True
    except (AttributeError, TypeError):
        pass
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"):
            nt.nodes.remove(n)
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    ruido = nt.nodes.new("ShaderNodeTexNoise")
    _entrada(ruido, "Scale").default_value = 3.0
    _entrada(ruido, "Detail").default_value = 6.0
    rampa = nt.nodes.new("ShaderNodeValToRGB")
    rampa.color_ramp.elements[0].color = _lin("#6F6860")
    rampa.color_ramp.elements[1].color = _lin("#9A9186")
    nt.links.new(ruido.outputs["Fac"], rampa.inputs["Fac"])
    nt.links.new(rampa.outputs["Color"], _entrada(bsdf, "Base Color"))
    _entrada(bsdf, "Roughness").default_value = 0.62
    m.diffuse_color = _lin("#857D73")
    return m


def escenario(col):
    global COL
    COL = col
    bm = bmesh.new()
    s = 6.0
    bm.faces.new([bm.verts.new(v) for v in ((-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0))])
    suelo = _objeto("suelo", bm, None, None, (0, 0, 0), (0, 0, 0), 0)
    suelo.data.materials.append(_material_suelo())
    caja("linea_seguridad", (5.0, 0.07, 0.004), (0, 1.15, 0.002), "amarillo", None, bisel=0)
    for k in range(9):
        caja(f"guion_{k}", (0.26, 0.05, 0.004), (-2.4 + k * 0.6, -1.15, 0.002), "hueso", None, bisel=0)

    sol = bpy.data.lights.new("cbl_sol", "SUN")
    sol.energy = 3.6
    sol.color = (1.0, 0.84, 0.66)
    sol.angle = math.radians(12)
    o = bpy.data.objects.new("sol", sol)
    col.objects.link(o)
    o.rotation_euler = (math.radians(52), 0, math.radians(-48))
    contra = bpy.data.lights.new("cbl_contraluz", "SUN")
    contra.energy = 1.2
    contra.color = (0.62, 0.78, 1.0)
    contra.angle = math.radians(20)
    o = bpy.data.objects.new("contraluz", contra)
    col.objects.link(o)
    o.rotation_euler = (math.radians(62), 0, math.radians(150))

    cam = bpy.data.cameras.new("cbl_camara")
    cam.lens = 58
    camo = bpy.data.objects.new("camara", cam)
    col.objects.link(camo)
    apuntar(camo, Vector((0.15, 0.0, 0.35)), azimut=22, elevacion=35, distancia=8.0)
    return camo


def apuntar(camo, objetivo, azimut, elevacion, distancia):
    az, el = math.radians(azimut), math.radians(elevacion)
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    camo.location = objetivo + d * distancia
    camo.rotation_euler = (objetivo - camo.location).to_track_quat("-Z", "Y").to_euler()


def ajustes_render(escena, camo):
    escena.camera = camo
    escena.render.resolution_x, escena.render.resolution_y = 1600, 1000
    escena.render.resolution_percentage = 100
    ev = escena.eevee
    for prop, val in (("taa_render_samples", 64), ("use_raytracing", True), ("use_shadows", True),
                      ("use_fast_gi", True)):
        if hasattr(ev, prop):
            try:
                setattr(ev, prop, val)
            except (AttributeError, TypeError):
                pass
    mundo = bpy.data.worlds.get("cbl_cielo") or bpy.data.worlds.new("cbl_cielo")
    try:
        mundo.use_nodes = True
    except (AttributeError, TypeError):
        pass
    fondo = next(n for n in mundo.node_tree.nodes if n.type == "BACKGROUND")
    _entrada(fondo, "Color").default_value = _lin("#5A5F6B")
    _entrada(fondo, "Strength").default_value = 0.75
    escena.world = mundo
    vs = escena.view_settings
    looks = [i.identifier for i in type(vs).bl_rna.properties["look"].enum_items]
    for preferido in ("AgX - Medium High Contrast", "Medium High Contrast"):
        if preferido in looks:
            vs.look = preferido
            break
    escena.frame_start, escena.frame_end = 0, N
    escena.render.fps = 24
    try:  # resplandor suave de las luces emisivas (compositor de Blender 5)
        ng = bpy.data.node_groups.get("cbl_composicion") or bpy.data.node_groups.new("cbl_composicion",
                                                                                      "CompositorNodeTree")
        for n in list(ng.nodes):
            ng.nodes.remove(n)
        if not any(i.in_out == "OUTPUT" for i in ng.interface.items_tree):
            ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        capas, brillo, salida = (ng.nodes.new(t) for t in ("CompositorNodeRLayers", "CompositorNodeGlare",
                                                            "NodeGroupOutput"))
        for nombre, valor in (("Type", "Bloom"), ("Quality", "High"), ("Threshold", 1.6), ("Strength", 0.35),
                              ("Size", 0.45)):
            brillo.inputs[nombre].default_value = valor
        ng.links.new(capas.outputs["Image"], brillo.inputs["Image"])
        ng.links.new(brillo.outputs["Image"], salida.inputs[0])
        escena.compositing_node_group = ng
    except (AttributeError, KeyError, TypeError):
        pass


def _limpiar(escena):
    for o in list(escena.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(escena.collection.children):
        bpy.data.collections.remove(c)
    for me in list(bpy.data.meshes):
        if me.get("cbl") and me.users == 0:
            bpy.data.meshes.remove(me)


ROBOTS = {
    "robot_transporte": robot_transporte,
    "robot_arana": robot_arana,
    "robot_escarabajo": robot_escarabajo,
}


def vista_previa():
    """Construye ambos robots en la escena «CBL Robots», con suelo, luces y cámara."""
    escena = bpy.data.scenes.get("CBL Robots") or bpy.data.scenes.new("CBL Robots")
    bpy.context.window.scene = escena
    _limpiar(escena)
    _mats.clear()
    colocacion = (("robot_transporte", (-1.75, 0.3, 0), 160, None),
                  ("robot_arana", (-0.3, -0.15, 0), 200, None),
                  ("robot_escarabajo", (0.95, 0.25, 0), 215, None),
                  ("robot_escarabajo_vuelo", (2.05, -0.45, 0), 200, animar_vuelo))
    raices = {}
    for nombre, pos, giro, anim in colocacion:
        col = bpy.data.collections.new(nombre)
        escena.collection.children.link(col)
        base = nombre.replace("_vuelo", "")
        r = ROBOTS[base](col)
        (anim or ANIMACIONES[base])(r)
        r.location = pos
        r.rotation_euler = (0, 0, math.radians(giro))
        raices[nombre] = r
    esc = bpy.data.collections.new("escenario")
    escena.collection.children.link(esc)
    camo = escenario(esc)
    ajustes_render(escena, camo)
    return escena


def exportar(ruta, escena):
    escena.frame_start, escena.frame_end = 0, N
    escena.render.fps = 24
    hay_anim = any(o.animation_data for o in escena.objects)
    bpy.ops.export_scene.gltf(filepath=ruta, export_format="GLB", export_yup=True,
                              export_animations=hay_anim, export_animation_mode="SCENE", export_apply=True)


if __name__ == "__main__" and bpy.app.background:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    destino = argv[0] if argv else "."
    os.makedirs(destino, exist_ok=True)
    for nombre, fn in ROBOTS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        _mats.clear()
        escena = bpy.context.scene
        escena.name = "ciclo"
        ANIMACIONES[nombre](fn(escena.collection))
        ruta = os.path.join(destino, nombre + ".glb")
        exportar(ruta, escena)
        print("EXPORTADO", ruta)
