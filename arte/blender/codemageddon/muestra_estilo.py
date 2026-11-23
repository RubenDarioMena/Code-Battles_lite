"""Fotograma de estilo CODEMAGEDDON (orquestador). Reutiliza las letras de codemageddon.py.

Blender -b --factory-startup --python muestra_estilo.py -- --salida <carpeta> [--alta]
Cambios del usuario (20 nov 2026): escena negra salvo los dos bloques y las herramientas; soportes
apenas visibles; bloque cortado de la mitad de grosor (2.5 cm) y de acero galvanizado; el suelo es
la propia placa de acero cepillado; letras metálicas con gradiente de rojo brillante (aristas
superior e inferior) a metal en el centro; láser fuera de cuadro, solo el haz.
"""
import sys
from pathlib import Path
import numpy as np
import bpy
from mathutils import Vector, Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
import codemageddon as cm
cm.bpy, cm.Vector, cm.Matrix = bpy, Vector, Matrix

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SALIDA = Path(args[args.index('--salida') + 1]).resolve()
ALTA = '--alta' in args
SALIDA.mkdir(parents=True, exist_ok=True)

H = .025            # grosor del bloque cortado = alto de cada pieza (mitad de los 5 cm)
Z_SUP = .060        # cara inferior del bloque cortado
ROJO = (1.0, .045, .07)
MAGEDDON = range(4, 12)
YA = (4, 5, 6, 7, 8, 9)   # M A G E D D encajadas
N, O = 11, 10

# ---------- utilidades ----------
def nodo(t, tipo, **kw):
    n = t.nodes.new(tipo)
    for k, v in kw.items():
        setattr(n, k, v)
    return n

def enlazar(t, a, b):
    t.links.new(a, b)

def principled(nombre):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    return m, m.node_tree, next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')

def rango(t, senal, a, b, c, d):
    r = nodo(t, 'ShaderNodeMapRange')
    enlazar(t, senal, r.inputs['Value'])
    r.inputs['From Min'].default_value, r.inputs['From Max'].default_value = a, b
    r.inputs['To Min'].default_value, r.inputs['To Max'].default_value = c, d
    return r.outputs['Result']

def caja_obj(nombre, a, b, mat):
    a, b = np.asarray(a, float), np.asarray(b, float)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) / 2)
    o = bpy.context.object
    o.name = nombre
    o.data.transform(Matrix.Diagonal(Vector((*(b - a), 1))))
    o.data.materials.append(mat)
    bv = o.modifiers.new('bisel', 'BEVEL'); bv.width, bv.segments = .0004, 2
    return o

# ---------- materiales ----------
def acero_cepillado():
    m, t, bs = principled('Acero cepillado')
    bs.inputs['Metallic'].default_value = 1
    bs.inputs['Base Color'].default_value = (.50, .53, .56, 1)
    bs.inputs['Anisotropic'].default_value = .8
    bs.inputs['Anisotropic Rotation'].default_value = .25
    tg = nodo(t, 'ShaderNodeTangent', direction_type='RADIAL', axis='X')
    enlazar(t, tg.outputs[0], bs.inputs['Tangent'])
    co = nodo(t, 'ShaderNodeTexCoord').outputs['Object']
    esc = nodo(t, 'ShaderNodeVectorMath', operation='MULTIPLY')
    esc.inputs[1].default_value = (40, 9000, 9000)
    enlazar(t, co, esc.inputs[0])
    ruido = nodo(t, 'ShaderNodeTexNoise')
    ruido.inputs['Detail'].default_value = 2
    enlazar(t, esc.outputs[0], ruido.inputs['Vector'])
    enlazar(t, rango(t, ruido.outputs['Fac'], .3, .7, .18, .34), bs.inputs['Roughness'])
    bump = nodo(t, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value, bump.inputs['Distance'].default_value = .25, .00003
    enlazar(t, ruido.outputs['Fac'], bump.inputs['Height'])
    enlazar(t, bump.outputs[0], bs.inputs['Normal'])
    return m

def galvanizado():
    """Lentejuelas de cinc: celdas Voronoi de ~1–2 cm con brillo y rugosidad distintos."""
    m, t, bs = principled('Acero galvanizado')
    bs.inputs['Metallic'].default_value = 1
    co = nodo(t, 'ShaderNodeTexCoord').outputs['Object']
    ruido = nodo(t, 'ShaderNodeTexNoise'); ruido.inputs['Scale'].default_value = 220
    ruido.inputs['Detail'].default_value = 4
    enlazar(t, co, ruido.inputs['Vector'])
    dist = nodo(t, 'ShaderNodeVectorMath', operation='ADD')
    enlazar(t, co, dist.inputs[0])
    off = nodo(t, 'ShaderNodeVectorMath', operation='SCALE')
    enlazar(t, ruido.outputs['Color'], off.inputs[0]); off.inputs['Scale'].default_value = .002
    enlazar(t, off.outputs[0], dist.inputs[1])
    vor = nodo(t, 'ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 150
    enlazar(t, dist.outputs[0], vor.inputs['Vector'])
    sep = nodo(t, 'ShaderNodeSeparateColor')
    enlazar(t, vor.outputs['Color'], sep.inputs[0])
    enlazar(t, rango(t, sep.outputs[0], 0, 1, .17, .25), bs.inputs['Roughness'])
    gris = rango(t, sep.outputs[1], 0, 1, .60, .67)
    comb = nodo(t, 'ShaderNodeCombineColor')
    for k in range(3):
        enlazar(t, gris, comb.inputs[k])
    enlazar(t, comb.outputs[0], bs.inputs['Base Color'])
    # Bordes de grano: líneas finas un poco más oscuras.
    vb = nodo(t, 'ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE'); vb.inputs['Scale'].default_value = 150
    enlazar(t, dist.outputs[0], vb.inputs['Vector'])
    bump = nodo(t, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value, bump.inputs['Distance'].default_value = .12, .00001
    enlazar(t, rango(t, vb.outputs['Distance'], 0, .04, 0, 1), bump.inputs['Height'])
    enlazar(t, bump.outputs[0], bs.inputs['Normal'])
    return m

def grafito():
    m, t, bs = principled('Soporte oscuro')
    bs.inputs['Metallic'].default_value = .85
    bs.inputs['Base Color'].default_value = (.012, .013, .015, 1)
    bs.inputs['Roughness'].default_value = .42
    return m

def emisivo(nombre, color, fuerza, alfa=1.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    out = nodo(t, 'ShaderNodeOutputMaterial')
    em = nodo(t, 'ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = fuerza
    if alfa < 1:
        tr = nodo(t, 'ShaderNodeBsdfTransparent')
        mix = nodo(t, 'ShaderNodeMixShader')
        mix.inputs[0].default_value = alfa
        enlazar(t, tr.outputs[0], mix.inputs[1]); enlazar(t, em.outputs[0], mix.inputs[2])
        enlazar(t, mix.outputs[0], out.inputs['Surface'])
        m.surface_render_method = 'BLENDED'
    else:
        enlazar(t, em.outputs[0], out.inputs['Surface'])
    return m

def distancia_borde(i):
    """Mismo enrejado que cm.campo (para casar con la UV de cm.prisma), pero distancia real en m."""
    anillos = [cm.inset(p) for p in cm.contorno_letra(i)]
    a, b = cm.caja(np.vstack(anillos))
    paso = max(b - a) / 248
    a = a - 4 * paso
    w, h = np.ceil((b + 4 * paso - a) / paso).astype(int)
    y, x = np.ogrid[:h, :w]
    x, y = a[0] + (x + .5) * paso, a[1] + (y + .5) * paso
    dist, dentro = np.full((h, w), np.inf), np.zeros((h, w), bool)
    for p in anillos:
        for (u, v), (s, t) in zip(p, np.roll(p, -1, axis=0)):
            dx, dy = s - u, t - v
            k = np.clip(((x - u) * dx + (y - v) * dy) / (dx * dx + dy * dy), 0, 1)
            dist = np.minimum(dist, (x - u - k * dx) ** 2 + (y - v - k * dy) ** 2)
            if dy:
                dentro ^= ((v > y) != (t > y)) & (x < u + (y - v) * dx / dy)
    d = np.where(dentro, np.sqrt(dist), 0.)
    g = np.clip(d / .0036, 0, 1)          # 0 en el borde, 1 a 2.6 mm hacia dentro
    g = g * g * (3 - 2 * g)
    img = bpy.data.images.new(f'dist_{i}', width=w, height=h, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((h, w, 4), 'f'); rgba[:, :, :3] = g[:, :, None]
    img.pixels.foreach_set(rgba.ravel()); img.update(); img.pack()
    return img

def metal_rojo(i, metal='cepillado'):
    """Metal con gradiente: rojo brillante en el contorno superior y en las aristas de arriba y
    abajo de los laterales; acero en el centro de la cara y en la mitad del lateral."""
    m, t, bs = principled(f'Letra roja {i}')
    bs.inputs['Metallic'].default_value = 1
    # Cara superior/inferior: campo de distancia proyectado.
    uv = nodo(t, 'ShaderNodeUVMap', uv_map='Proyección XY')
    tex = nodo(t, 'ShaderNodeTexImage', image=distancia_borde(i), interpolation='Linear', extension='EXTEND')
    enlazar(t, uv.outputs[0], tex.inputs[0])
    g_tapa = tex.outputs['Color']
    # Laterales: distancia a la arista superior e inferior (z objeto de 0 a H).
    sep = nodo(t, 'ShaderNodeSeparateXYZ')
    enlazar(t, nodo(t, 'ShaderNodeTexCoord').outputs['Object'], sep.inputs[0])
    inv = nodo(t, 'ShaderNodeMath', operation='SUBTRACT'); inv.inputs[0].default_value = H
    enlazar(t, sep.outputs['Z'], inv.inputs[1])
    mn = nodo(t, 'ShaderNodeMath', operation='MINIMUM')
    enlazar(t, sep.outputs['Z'], mn.inputs[0]); enlazar(t, inv.outputs[0], mn.inputs[1])
    g_lado = rango(t, mn.outputs[0], .0003, .0055, 0, 1)
    # Elegir por la normal.
    nz = nodo(t, 'ShaderNodeSeparateXYZ')
    enlazar(t, nodo(t, 'ShaderNodeNewGeometry').outputs['Normal'], nz.inputs[0])
    absz = nodo(t, 'ShaderNodeMath', operation='ABSOLUTE'); enlazar(t, nz.outputs['Z'], absz.inputs[0])
    es_tapa = rango(t, absz.outputs[0], .6, .8, 0, 1)
    mixg = nodo(t, 'ShaderNodeMix', data_type='FLOAT')
    enlazar(t, es_tapa, mixg.inputs['Factor'])
    enlazar(t, g_lado, mixg.inputs['A']); enlazar(t, g_tapa, mixg.inputs['B'])
    g = mixg.outputs['Result']
    # Color: rojo -> acero.
    col = nodo(t, 'ShaderNodeMix', data_type='RGBA')
    enlazar(t, g, col.inputs['Factor'])
    col.inputs['A'].default_value = (.95, .06, .08, 1)
    col.inputs['B'].default_value = (.62, .64, .67, 1) if metal == 'cepillado' else (.66, .66, .68, 1)
    enlazar(t, col.outputs['Result'], bs.inputs['Base Color'])
    enlazar(t, rango(t, g, 0, 1, .32, .26), bs.inputs['Roughness'])
    # Emisión: solo en la franja roja, fuerte en la arista.
    inv_g = rango(t, g, 0, 1, 1, 0)
    pot = nodo(t, 'ShaderNodeMath', operation='POWER'); pot.inputs[1].default_value = 2.0
    enlazar(t, inv_g, pot.inputs[0])
    fuerza = nodo(t, 'ShaderNodeMath', operation='MULTIPLY'); fuerza.inputs[1].default_value = 7.0
    enlazar(t, pot.outputs[0], fuerza.inputs[0])
    bs.inputs['Emission Color'].default_value = (*ROJO, 1)
    enlazar(t, fuerza.outputs[0], bs.inputs['Emission Strength'])
    return m

# ---------- escena ----------
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene
cep, galv, osc = acero_cepillado(), galvanizado(), grafito()

# Placa-suelo de acero cepillado (sin mesa): se sale del cuadro por todos lados.
suelo = caja_obj('Placa cepillada', (-.7, -.45, -.05), (.7, .6, 0), cep)
bpy.context.view_layer.objects.active = suelo
bpy.ops.object.modifier_apply(modifier='bisel')
for i in MAGEDDON:
    hueco = cm.prisma(f'hueco_{i}', cm.contorno_letra(i), (-H, .002))
    cm.restar(suelo, hueco)

# Bloque cortado: galvanizado, 2.5 cm, sobre MAGEDDON.
x0 = min(cm.caja(cm.contorno_letra(i)[0])[0][0] for i in MAGEDDON) - .012
x1 = max(cm.caja(cm.contorno_letra(i)[0])[1][0] for i in MAGEDDON) + .012
sup = caja_obj('Bloque galvanizado', (x0, -.03, Z_SUP), (x1, .03, Z_SUP + H), galv)
bpy.context.view_layer.objects.active = sup
bpy.ops.object.modifier_apply(modifier='bisel')
for i in MAGEDDON:
    cm.restar(sup, cm.prisma(f'calado_{i}', cm.contorno_letra(i), (Z_SUP - .002, Z_SUP + H + .002)))

# Piezas.
for i in YA:
    cm.prisma(f'Letra {i}', [cm.inset(p) for p in cm.contorno_letra(i)], (-H, 0), metal_rojo(i), uv=i)
cm.prisma('Letra N cayendo', [cm.inset(p) for p in cm.contorno_letra(N)], (.012, .012 + H), metal_rojo(N), uv=N)
o_pieza = cm.prisma('Letra O en corte', [cm.inset(p) for p in cm.contorno_letra(O)], (Z_SUP, Z_SUP + H), galv, uv=O)

# Soportes: mordazas y brazo, casi invisibles.
for xa, xb in ((x0 - .014, x0), (x1, x1 + .014)):
    caja_obj('Mordaza', (xa, -.036, Z_SUP - .004), (xb, .036, Z_SUP + H + .004), osc)
    caja_obj('Mordaza brazo', (xa, .02, Z_SUP + H), (xb, .05, .40), osc)
caja_obj('Travesaño', (x0 - .02, .03, .16), (x1 + .02, .06, .19), osc)

# ---------- láser: solo el haz y el corte ----------
ext = cm.contorno_letra(O)[0]
seg = np.linalg.norm(np.roll(ext, -1, 0) - ext, axis=1)
s = np.concatenate([[0], np.cumsum(seg)])
cerrado = np.vstack([ext, ext[:1]])
PROG = .63
def tramo(a, b, n=120):
    u = np.linspace(a, b, n) * s[-1]
    return np.column_stack([np.interp(u, s, cerrado[:, 0]), np.interp(u, s, cerrado[:, 1])])
zc = Z_SUP + H + .0002
def tubo(nombre, pts, radio, mat):
    c = bpy.data.curves.new(nombre, 'CURVE'); c.dimensions = '3D'
    c.bevel_depth, c.bevel_resolution = radio, 2
    sp = c.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (*q, 1)
    o = bpy.data.objects.new(nombre, c); sc.collection.objects.link(o)
    c.materials.append(mat)
    return o
tubo('Sangría fría', [(*p, zc) for p in tramo(0, PROG - .16)], .00022, emisivo('sangria fria', (1, .05, .03), 2.5))
tubo('Sangría caliente', [(*p, zc) for p in tramo(PROG - .17, PROG - .03)], .00028, emisivo('sangria', (1, .35, .08), 14))
tubo('Sangría blanca', [(*p, zc) for p in tramo(PROG - .035, PROG)], .00032, emisivo('sangria blanca', (1, .85, .6), 40))
P = tramo(PROG, PROG, 1)[0]
tubo('Haz núcleo', [(*P, zc), (*P, .9)], .00025, emisivo('haz', (1, .9, .92), 60))
tubo('Haz halo', [(*P, zc), (*P, .9)], .0011, emisivo('halo', (1, .05, .12), 6, alfa=.35))
bpy.ops.mesh.primitive_uv_sphere_add(radius=.0012, location=(*P, zc))
bpy.context.object.data.materials.append(emisivo('destello', (1, .8, .7), 80))
rng = np.random.default_rng(7)
chispa = emisivo('chispa', (1, .55, .15), 35)
for k in range(18):
    d = rng.normal(size=3); d[2] = abs(d[2]) * 1.6 + .3; d /= np.linalg.norm(d)
    a = np.array([*P, zc]) + d * rng.uniform(.002, .02)
    tubo(f'chispa {k}', [a, a + d * rng.uniform(.003, .008) - [0, 0, .001]], .00012, chispa)

# ---------- luz: todo negro salvo los bloques ----------
sc.world = bpy.data.worlds.new('Negro')
sc.world.use_nodes = True
next(n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND').inputs['Strength'].default_value = 0
foco = Vector((.12, 0, .03))
def spot(nombre, pos, energia, color, angulo, radio=.02, destino=foco):
    bpy.ops.object.light_add(type='SPOT', location=pos)
    o = bpy.context.object; o.name = nombre
    o.rotation_euler = (Vector(destino) - o.location).to_track_quat('-Z', 'Y').to_euler()
    o.data.energy, o.data.color = energia, color
    o.data.spot_size, o.data.spot_blend, o.data.shadow_soft_size = np.radians(angulo), .7, radio
    return o
spot('Contra fría', (.12, .45, .40), 90, (.55, .8, 1), 20, .06, (.10, 0, .07))
spot('Rasante cálida', (-.32, -.06, .07), 90, (1, .62, .36), 26, .03, (.12, 0, 0))
spot('Clave', (.36, -.40, .42), 30, (1, .97, .95), 26, .05)
spot('Galvanizado', (.05, -.25, .30), 30, (.85, .9, 1), 18, .04, (.13, 0, Z_SUP + H))

# ---------- cámara ----------
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam)
mira = Vector((.135, 0, .035))
cam.location = mira + Vector((.15, -.42, .20))
cam.rotation_euler = (mira - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.lens, cam.data.sensor_width = 52, 36
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = (Vector((cm.centro(N), 0, .02)) - cam.location).length
cam.data.dof.aperture_fstop = 4
sc.camera = cam

# ---------- render ----------
sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.use_raytracing = True
sc.eevee.taa_render_samples = 64 if ALTA else 32
sc.render.resolution_x, sc.render.resolution_y = (1920, 1080) if ALTA else (1280, 720)
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
try:
    t = bpy.data.node_groups.new('Halo', 'CompositorNodeTree')
    t.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = t.nodes.new('CompositorNodeRLayers')
    gl = t.nodes.new('CompositorNodeGlare')
    gl.inputs['Type'].default_value = 'Fog Glow'
    gl.inputs['Threshold'].default_value = 2.0
    out = t.nodes.new('NodeGroupOutput')
    t.links.new(rl.outputs['Image'], gl.inputs['Image'])
    t.links.new(gl.outputs['Image'], out.inputs['Image'])
    sc.compositing_node_group = t
except Exception as e:
    print('SIN BLOOM', e)
sc.render.image_settings.file_format = 'JPEG'
sc.render.image_settings.quality = 90
sc.render.filepath = str(SALIDA / ('muestra-alta.jpg' if ALTA else 'muestra.jpg'))
bpy.ops.render.render(write_still=True)
