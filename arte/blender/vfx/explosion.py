"""Explosión convencional de Code Battle Lite / Codemageddon, generada por código en Blender.

Una sola implementación parametrizable: simulación de gas (Mantaflow) con tres emisores
—estallido central, chorros de escombro y oleada a ras de suelo—, render con Cycles y salida
como secuencia EXR con alfa asociado (premultiplicado). `empaquetar.py` la convierte en atlas.

Sin ventana:
    blender -b --factory-startup --python arte/blender/vfx/explosion.py -- \
        --variante polvo --semilla 1 --salida <carpeta> [--calidad borrador|media|final]
        [--solo sim|render] [--cuadros 1,8,16] [--suelo]

Convenciones (las mismas de robots.py):
- 1 m = 1 casilla. La explosión nace en el origen, sobre el suelo z = 0.
- La cámara es ortográfica, mira hacia +Y y baja ELEVACION grados: la inclinación por defecto de
  la cámara del juego (pitch 0,93 rad). El origen queda en ANCLA dentro del cuadro.
- `semilla` cambia chorros, turbulencia y giro del conjunto; `variante` cambia la receta.
- La luz va horneada en el flipbook (sol + cielo). El destello, las chispas y la onda son capas
  aparte: no forman parte de la simulación.
- No hay reglas de juego aquí: tamaño e intensidad son artísticos, no daño.
"""
import argparse
import json
import math
import os
import random
import sys
import time

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import nodos  # noqa: E402

FPS = 20          # reproducción prevista del flipbook
CUADROS = 64      # 8 × 8 en el atlas → 3,2 s
ELEVACION = 53.0  # grados sobre el horizonte (pitch 0,93 rad del juego)
ENCUADRE = 8.0    # metros que cubre el lado del cuadro
ANCLA = (0.5, 0.20)  # posición del origen (suelo) en el cuadro: x desde la izquierda, y desde abajo

# Resolución del dominio, ruido de detalle, píxeles por cuadro y muestras de Cycles.
CALIDADES = {
    "borrador": dict(res=80, ruido=0, px=160, muestras=24),
    "media": dict(res=112, ruido=0, px=256, muestras=32),
    "final": dict(res=128, ruido=2, px=256, muestras=96),
}

# Receta base; cada variante solo declara lo que cambia. Velocidades en m/s, tamaños en metros,
# vidas y duraciones en cuadros.
BASE = dict(
    # bola: ráfaga corta y frenada que reparte combustible y humo → bola de fuego
    bola=220, vel_bola=(2.0, 9.0), freno_bola=0.22, vida_bola=(4, 8), tam_bola=0.30,
    combustible=1.0, densidad=1.0, temperatura=2.5, alargar=1.3,
    # nube: cuerpo de gas caliente que aparece de golpe bajo el destello → hongo que sube
    radio_nube=1.2, combustible_nube=0.9, densidad_nube=1.2, temperatura_nube=2.5,
    # chorros: partículas balísticas que dejan estelas de polvo → púas de escombro
    chorros=24, vel_chorros=(9.0, 16.0), apertura=0.95, tam_chorro=0.15, densidad_chorro=1.4,
    vida_chorro=(5, 10), freno_chorro=0.08,
    # oleada: aro de polvo que corre a ras de suelo
    oleada=70, vel_oleada=(5.0, 10.0), tam_oleada=0.24, densidad_oleada=1.0, vida_oleada=(5, 9),
    freno_oleada=0.16,
    # gas
    vorticidad=0.35, flotacion_calor=3.0, flotacion_densidad=1.2, disolver=0, escala_tiempo=1.8,
    quemado=0.9, humo_de_llama=1.2, vorticidad_llama=0.6,
    turbulencia=1.2, viento=(0.35, 0.1, 0.0),
    # aspecto
    color_polvo=(0.58, 0.46, 0.31), color_humo=(0.22, 0.18, 0.14), color_hollin=(0.03, 0.027, 0.025),
    calor_color=(0.3, 2.2),  # calor del gas que corresponde a polvo puro y a hollín puro
    densidad_render=9.0, fuego=14.0, anisotropia=0.25,
)
VARIANTES = {
    # Impacto en tierra: poco fuego, púas de escombro y columna de polvo (referencia 1).
    "polvo": dict(combustible=0.5, densidad=1.6, temperatura=2.0, chorros=30, densidad_chorro=1.6,
                  oleada=90, color_humo=(0.30, 0.24, 0.17), fuego=10.0, quemado=1.3,
                  densidad_nube=1.6, temperatura_nube=2.2),
    # Combustible: bola de fuego que rueda y hongo de hollín (referencia 2).
    "fuego": dict(bola=320, combustible=1.6, densidad=0.8, temperatura=3.0, vel_bola=(1.5, 7.0),
                  radio_nube=1.3, combustible_nube=1.4, densidad_nube=0.7, temperatura_nube=3.5,
                  chorros=9, vel_chorros=(6.0, 11.0), oleada=30, flotacion_calor=2.4, vorticidad=0.5,
                  color_humo=(0.05, 0.045, 0.04), quemado=0.45, humo_de_llama=1.8,
                  densidad_render=12.0, fuego=13.0),
    # Carga explosiva en el aire o sobre metal: seca, rápida, gris, se deshace pronto.
    "seca": dict(combustible=0.8, densidad=0.8, temperatura=1.6, vel_bola=(4.0, 12.0), chorros=34,
                 vel_chorros=(11.0, 20.0), apertura=1.25, tam_chorro=0.14, densidad_chorro=1.0,
                 oleada=50, vel_oleada=(7.0, 13.0), disolver=150, vorticidad=0.25, quemado=1.6,
                 color_humo=(0.27, 0.27, 0.28), color_polvo=(0.42, 0.40, 0.37), fuego=12.0,
                 radio_nube=0.9, combustible_nube=0.6, densidad_nube=0.7, temperatura_nube=1.6),
}


def receta(variante):
    r = dict(BASE)
    r.update(VARIANTES[variante])
    return r


# ------------------------------------------------------------------ utilidades


def _malla(nombre, verts, caras):
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(verts, [], caras)
    me.update()
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _activar(ob):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def _clave(datos, prop, valores):
    """Claves constantes: {cuadro: valor}."""
    for cuadro, v in valores.items():
        setattr(datos, prop, v)
        datos.keyframe_insert(prop, frame=cuadro)


# ------------------------------------------------------------------ simulación


DOMINIO = (9.0, 9.0, 7.5)  # metros; el suelo es su cara inferior


def _emisor(nombre, direcciones, radio, alto):
    """Malla de triángulos diminutos: la normal de cada uno es la dirección de salida de sus partículas."""
    verts, caras = [], []
    for d in direcciones:
        u = d.cross(Vector((0, 0, 1)))
        u = u.normalized() if u.length > 1e-4 else Vector((1, 0, 0))
        v = d.cross(u)
        p = d * radio + Vector((0, 0, alto))
        b = len(verts)
        verts += [p + u * 0.04, p - u * 0.02 + v * 0.035, p - u * 0.02 - v * 0.035]
        caras.append((b, b + 1, b + 2))
    return _malla(nombre, verts, caras)


def _rafaga(ob, semilla, cuantas, vel, vida, freno, gravedad):
    """Sistema de partículas que sale en los dos primeros cuadros. Devuelve el sistema."""
    _activar(ob)
    ob.modifiers.new("particulas", "PARTICLE_SYSTEM")
    psys = ob.particle_systems[0]
    psys.seed = semilla
    ps = psys.settings
    ps.count = cuantas
    ps.frame_start, ps.frame_end = 1, 2
    ps.lifetime = vida[1]
    ps.lifetime_random = 1 - vida[0] / vida[1]
    ps.emit_from = "FACE"
    ps.use_emit_random = True
    ps.normal_factor = vel[1]
    ps.factor_random = (vel[1] - vel[0]) * 0.5
    ps.physics_type = "NEWTON"
    ps.damping = freno
    ps.render_type = "NONE"
    ps.effector_weights.all = 0.0
    ps.effector_weights.gravity = gravedad
    return psys


def construir_sim(r, semilla, calidad, cache):
    rng = random.Random(semilla)
    giro = rng.uniform(0, math.tau)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, CUADROS
    sc.render.fps = FPS
    celda = max(DOMINIO) / calidad["res"]  # los tamaños de partícula del flujo van en celdas

    # Dominio: caja con el suelo cerrado y el resto abierto para que el humo salga sin rebotar.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, DOMINIO[2] / 2))
    dom = bpy.context.object
    dom.name = "dominio"
    dom.scale = DOMINIO
    m = dom.modifiers.new("gas", "FLUID")
    m.fluid_type = "DOMAIN"
    d = m.domain_settings
    d.domain_type = "GAS"
    d.resolution_max = calidad["res"]
    d.use_adaptive_domain = True
    d.adapt_margin = 4
    d.adapt_threshold = 0.004
    d.use_adaptive_timesteps = True
    d.cfl_condition = 3.0
    d.timesteps_min, d.timesteps_max = 2, 10
    d.time_scale = r["escala_tiempo"]
    d.vorticity = r["vorticidad"]
    d.alpha = r["flotacion_densidad"]
    d.beta = r["flotacion_calor"]
    d.use_dissolve_smoke = r["disolver"] > 0  # 0 = el humo no se disuelve: lo funde el atlas al final
    if r["disolver"]:
        d.dissolve_speed = r["disolver"]
        d.use_dissolve_smoke_log = True
    d.burning_rate = r["quemado"]
    d.flame_smoke = r["humo_de_llama"]
    d.flame_vorticity = r["vorticidad_llama"]
    d.flame_ignition = 1.5
    d.flame_max_temp = 3.0
    for lado in ("front", "back", "left", "right", "top"):
        setattr(d, f"use_collision_border_{lado}", False)
    d.use_collision_border_bottom = True
    if calidad["ruido"]:
        d.use_noise = True
        d.noise_scale = calidad["ruido"]
        d.noise_strength = 1.4
        d.noise_pos_scale = 2.0
    d.cache_type = "ALL"
    d.cache_directory = cache
    d.cache_frame_start, d.cache_frame_end = 1, CUADROS
    d.cache_data_format = "OPENVDB"
    d.openvdb_cache_compress_type = "BLOSC"
    d.openvdb_data_depth = "16"

    def flujo(ob, psys, tipo, tam, hasta, **kw):
        mf = ob.modifiers.new("flujo", "FLUID")
        mf.fluid_type = "FLOW"
        f = mf.flow_settings
        f.flow_type = tipo
        f.flow_behavior = "INFLOW"
        f.flow_source = "PARTICLES"
        f.particle_system = psys
        f.use_particle_size = True
        f.particle_size = max(1.0, tam / celda)
        f.use_initial_velocity = True
        f.subframes = 6
        for k, v in kw.items():
            setattr(f, k, v)
        _clave(f, "use_inflow", {1: True, hasta: True, hasta + 1: False})
        ob.hide_render = True
        return f

    def direccion(az, cz):
        sz = math.sqrt(max(0.0, 1 - cz * cz))
        return Vector((math.cos(az) * sz, math.sin(az) * sz, cz))

    # 1. Bola: una ráfaga muy frenada reparte combustible y humo en un hemisferio algo alargado.
    #    Un solver incompresible anula la velocidad radial de una esfera que emite; por eso el
    #    estallido lo llevan las partículas y el gas solo hereda su arrastre.
    dirs = []
    for _ in range(max(24, r["bola"] // 4)):
        d_ = direccion(rng.uniform(0, math.tau), rng.uniform(0.0, 1.0))
        d_.z *= r["alargar"]
        dirs.append(d_.normalized())
    bola = _emisor("bola", dirs, 0.15, 0.25)
    psys = _rafaga(bola, semilla, r["bola"], r["vel_bola"], r["vida_bola"], r["freno_bola"], 0.0)
    flujo(bola, psys, "BOTH", r["tam_bola"], r["vida_bola"][1] + 1, fuel_amount=r["combustible"],
          density=r["densidad"], temperature=r["temperatura"], velocity_factor=0.9)

    # 1b. Nube: una esfera irregular que crece suelta gas caliente durante tres cuadros. No necesita velocidad:
    #     el calor la hace subir y enrollarse en hongo.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r["radio_nube"],
                                          location=(0, 0, r["radio_nube"] * 0.6))
    nube = bpy.context.object
    nube.name = "nube"
    bultos = [(direccion(rng.uniform(0, math.tau), rng.uniform(-0.3, 1.0)), rng.uniform(-0.3, 0.25))
              for _ in range(7)]
    for v in nube.data.vertices:  # bultos suaves: cada semilla da otra silueta
        n_ = v.co.normalized()
        v.co *= 1 + sum(a_ * max(0.0, n_.dot(d_)) ** 3 for d_, a_ in bultos)
    for cuadro, escala in ((1, 0.35), (2, 0.7), (3, 1.0)):  # crece en tres cuadros en vez de aparecer hecha
        nube.scale = (escala,) * 3
        nube.keyframe_insert("scale", frame=cuadro)
    mf = nube.modifiers.new("flujo", "FLUID")
    mf.fluid_type = "FLOW"
    f = mf.flow_settings
    f.flow_type = "BOTH"
    f.flow_behavior = "INFLOW"
    f.fuel_amount = r["combustible_nube"]
    f.density = r["densidad_nube"]
    f.temperature = r["temperatura_nube"]
    f.surface_distance = 0.5
    f.volume_density = 1.0
    _clave(f, "use_inflow", {1: True, 3: True, 4: False})
    nube.hide_render = True

    # 2. Chorros: partículas balísticas que dejan una estela de polvo (las púas de la referencia).
    c0 = math.cos(r["apertura"])
    dirs = [direccion(giro + math.tau * (i + rng.uniform(-0.4, 0.4)) / r["chorros"],
                      rng.uniform(c0, 1.0) ** 0.6) for i in range(r["chorros"])]
    cho = _emisor("chorros", dirs, 0.25, 0.15)
    psys = _rafaga(cho, semilla + 1, r["chorros"] * 3, r["vel_chorros"], r["vida_chorro"],
                   r["freno_chorro"], 1.0)
    flujo(cho, psys, "SMOKE", r["tam_chorro"], r["vida_chorro"][1] + 2, density=r["densidad_chorro"],
          temperature=0.25, velocity_factor=0.7)

    # 3. Oleada: aro de polvo que corre a ras de suelo y se frena.
    if r["oleada"]:
        n = max(16, r["oleada"] // 2)
        dirs = [direccion(giro + math.tau * (i + rng.uniform(-0.5, 0.5)) / n, rng.uniform(0.0, 0.12))
                for i in range(n)]
        ole = _emisor("oleada", dirs, 0.35, 0.12)
        psys = _rafaga(ole, semilla + 2, r["oleada"], r["vel_oleada"], r["vida_oleada"],
                       r["freno_oleada"], 0.0)
        flujo(ole, psys, "SMOKE", r["tam_oleada"], r["vida_oleada"][1] + 1,
              density=r["densidad_oleada"], temperature=0.1, velocity_factor=0.6)

    # Turbulencia y viento: lo que hace distinta cada semilla una vez pasado el estallido.
    bpy.ops.object.effector_add(type="TURBULENCE", location=(0, 0, 2.5))
    tur = bpy.context.object
    tur.field.strength = r["turbulencia"]
    tur.field.size = 1.6
    tur.field.flow = 0.5
    tur.field.seed = semilla
    tur.field.noise = 0.5
    viento = Vector(r["viento"])
    if viento.length > 0:
        bpy.ops.object.effector_add(type="WIND", location=(0, 0, 3))
        vi = bpy.context.object
        ang = giro * 0.5
        dir_ = Vector((math.cos(ang) * viento.x - math.sin(ang) * viento.y,
                       math.sin(ang) * viento.x + math.cos(ang) * viento.y, 0))
        vi.rotation_euler = dir_.to_track_quat("Z", "Y").to_euler()
        vi.field.strength = viento.length
        vi.field.flow = 0.3
    return dom


def hornear(dom):
    t = time.time()
    _activar(dom)
    with bpy.context.temp_override(object=dom, active_object=dom, selected_objects=[dom]):
        bpy.ops.fluid.bake_all()
    return time.time() - t


# ------------------------------------------------------------------ aspecto y render


def material_gas(r):
    mat = bpy.data.materials.new("gas")
    nt = nodos(mat)
    N, L = nt.nodes.new, nt.links.new
    sal = N("ShaderNodeOutputMaterial")
    vol = N("ShaderNodeVolumePrincipled")
    dens = N("ShaderNodeAttribute"); dens.attribute_name = "density"
    llama = N("ShaderNodeAttribute"); llama.attribute_name = "flame"
    calor = N("ShaderNodeAttribute"); calor.attribute_name = "heat"

    md = N("ShaderNodeMath"); md.operation = "MULTIPLY"; md.inputs[1].default_value = r["densidad_render"]
    L(dens.outputs["Fac"], md.inputs[0])
    L(md.outputs[0], vol.inputs["Density"])
    vol.inputs["Anisotropy"].default_value = r["anisotropia"]
    vol.inputs["Blackbody Intensity"].default_value = 0.0

    # Color del humo: el calor que arrastra el gas delata de dónde viene. Frío = polvo levantado,
    # templado = humo del estallido, caliente = hollín recién salido de la llama.
    mr = N("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = r["calor_color"]
    L(calor.outputs["Fac"], mr.inputs["Value"])
    tinte = N("ShaderNodeValToRGB")
    e = tinte.color_ramp.elements
    e[0].position, e[0].color = 0.0, (*r["color_polvo"], 1)
    e[1].position, e[1].color = 1.0, (*r["color_hollin"], 1)
    k = e.new(0.45); k.color = (*r["color_humo"], 1)
    L(mr.outputs["Result"], tinte.inputs["Fac"])
    L(tinte.outputs["Color"], vol.inputs["Color"])

    # Fuego: la rejilla «flame» pasa por una rampa de cuerpo negro estilizada.
    rampa = N("ShaderNodeValToRGB")
    e = rampa.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0, 0, 0, 1)
    e[1].position, e[1].color = 1.0, (1.0, 0.86, 0.55, 1)
    for pos, col in ((0.12, (0.55, 0.05, 0.0, 1)), (0.38, (1.0, 0.28, 0.02, 1)), (0.68, (1.0, 0.58, 0.12, 1))):
        k = e.new(pos); k.color = col
    L(llama.outputs["Fac"], rampa.inputs["Fac"])
    pot = N("ShaderNodeMath"); pot.operation = "POWER"; pot.inputs[1].default_value = 1.6
    L(llama.outputs["Fac"], pot.inputs[0])
    mf = N("ShaderNodeMath"); mf.operation = "MULTIPLY"; mf.inputs[1].default_value = r["fuego"]
    L(pot.outputs[0], mf.inputs[0])
    L(rampa.outputs["Color"], vol.inputs["Emission Color"])
    L(mf.outputs[0], vol.inputs["Emission Strength"])
    L(vol.outputs["Volume"], sal.inputs["Volume"])
    return mat


def preparar_render(dom, r, calidad, suelo):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    cy = sc.cycles
    cy.device = "CPU"
    cy.samples = calidad["muestras"]
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.use_denoising = True
    cy.volume_bounces = 2
    cy.max_bounces = 4
    cy.volume_step_rate = 1.0
    cy.volume_max_steps = 256
    sc.render.resolution_x = sc.render.resolution_y = calidad["px"]
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = not suelo
    sc.render.use_persistent_data = False
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    im = sc.render.image_settings
    im.file_format = "OPEN_EXR"
    im.color_mode = "RGBA"
    im.color_depth = "16"
    im.exr_codec = "ZIP"

    dom.data.materials.clear()
    dom.data.materials.append(material_gas(r))

    # Cámara ortográfica a la inclinación del juego, mirando hacia +Y.
    cam = bpy.data.cameras.new("camara")
    cam.type = "ORTHO"
    cam.ortho_scale = ENCUADRE
    cam.clip_start, cam.clip_end = 0.1, 200
    co = bpy.data.objects.new("camara", cam)
    sc.collection.objects.link(co)
    el = math.radians(ELEVACION)
    hacia = Vector((0, math.cos(el), -math.sin(el)))      # dirección de la mirada
    arriba = Vector((0, math.sin(el), math.cos(el)))       # vertical del cuadro
    centro = arriba * (ENCUADRE * (0.5 - ANCLA[1]))        # el origen queda en ANCLA
    co.location = centro - hacia * 60
    co.rotation_euler = (math.radians(90 - ELEVACION), 0, 0)
    cam.shift_x = 0.5 - ANCLA[0]
    sc.camera = co

    # Sol alto desde la izquierda y por delante, y cielo claro: lo que sugieren las referencias.
    sol = bpy.data.lights.new("sol", "SUN")
    sol.energy = 4.2
    sol.color = (1.0, 0.95, 0.86)
    sol.angle = math.radians(3)
    so = bpy.data.objects.new("sol", sol)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(48), 0, math.radians(-55))
    mundo = bpy.data.worlds.new("cielo")
    sc.world = mundo
    nt = nodos(mundo)
    fondo = nt.nodes.new("ShaderNodeBackground")
    fondo.inputs["Color"].default_value = (0.62, 0.72, 0.9, 1)
    fondo.inputs["Strength"].default_value = 0.9
    nt.links.new(fondo.outputs[0], nt.nodes.new("ShaderNodeOutputWorld").inputs["Surface"])

    if suelo:  # solo para vistas previas: arena que recibe sombra y luz del fuego
        bpy.ops.mesh.primitive_plane_add(size=60)
        pl = bpy.context.object
        ms = bpy.data.materials.new("arena")
        nt = nodos(ms)
        b = nt.nodes.new("ShaderNodeBsdfDiffuse")
        b.inputs["Color"].default_value = (0.52, 0.42, 0.29, 1)
        nt.links.new(b.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
        pl.data.materials.append(ms)


def renderizar(salida, cuadros):
    sc = bpy.context.scene
    tiempos = []
    for c in cuadros:
        sc.frame_set(c)
        sc.render.filepath = os.path.join(salida, f"c{c:03d}.exr")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        tiempos.append(time.time() - t)
    return tiempos


# ------------------------------------------------------------------ entrada


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="explosion.py")
    ap.add_argument("--variante", default="polvo", choices=sorted(VARIANTES))
    ap.add_argument("--semilla", type=int, default=1)
    ap.add_argument("--salida", required=True)
    ap.add_argument("--calidad", default="borrador", choices=sorted(CALIDADES))
    ap.add_argument("--solo", choices=("sim", "render"))
    ap.add_argument("--cuadros", help="lista de cuadros a renderizar, p. ej. 1,4,8; por defecto todos")
    ap.add_argument("--suelo", action="store_true", help="vista previa con arena, sombra y luz")
    a = ap.parse_args(args)

    r, calidad = receta(a.variante), CALIDADES[a.calidad]
    salida = os.path.abspath(a.salida)
    cache = os.path.join(salida, "cache")
    cuadros_dir = os.path.join(salida, "suelo" if a.suelo else "cuadros")
    os.makedirs(cuadros_dir, exist_ok=True)

    escena = os.path.join(salida, "explosion.blend")
    informe = dict(variante=a.variante, semilla=a.semilla, calidad=a.calidad, fps=FPS, cuadros=CUADROS,
                   px=calidad["px"], encuadre_m=ENCUADRE, ancla=list(ANCLA), elevacion=ELEVACION,
                   blender=bpy.app.version_string)
    ruta_informe = os.path.join(salida, "informe.json")
    if os.path.exists(ruta_informe):
        informe.update({k: v for k, v in json.load(open(ruta_informe)).items() if k.startswith("s_")})
    if a.solo == "render":
        # La simulación horneada vive en la escena guardada: un dominio recién creado no lee la caché.
        bpy.ops.wm.open_mainfile(filepath=escena)
        dom = bpy.data.objects["dominio"]
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        dom = construir_sim(r, a.semilla, calidad, cache)
        informe["s_sim"] = round(hornear(dom), 1)
        bpy.ops.wm.save_as_mainfile(filepath=escena, compress=True)
        print(f"[explosion] simulación: {informe['s_sim']} s")
    if a.solo != "sim":
        preparar_render(dom, r, calidad, a.suelo)
        cuadros = [int(x) for x in a.cuadros.split(",")] if a.cuadros else list(range(1, CUADROS + 1))
        ts = renderizar(cuadros_dir, cuadros)
        informe["s_render_suelo" if a.suelo else "s_render"] = round(sum(ts), 1)
        informe["s_cuadro_max"] = round(max(ts), 2)
        print(f"[explosion] render: {sum(ts):.1f} s en {len(ts)} cuadros (máx. {max(ts):.2f} s)")
    json.dump(informe, open(ruta_informe, "w"), indent=1)


if __name__ == "__main__":
    main()
