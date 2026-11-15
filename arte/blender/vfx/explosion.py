"""Explosiones de artillería de Code Battle Lite / Codemageddon, generadas por código en Blender.

Una sola implementación parametrizable: simulación de gas (Mantaflow) con tres emisores
—estallido central, chorros de escombro y oleada a ras de suelo—, render con Cycles y salida
como secuencia EXR con alfa asociado (premultiplicado). `empaquetar.py` la convierte en atlas.

Sin ventana:
    blender -b --factory-startup --python arte/blender/vfx/explosion.py -- \
        --variante tierra --poder 2 --semilla 1 --salida <carpeta> [--calidad borrador|media|final]
        [--solo sim|render] [--cuadros 1,8,16] [--suelo]

Convenciones (las mismas de robots.py):
- La simulación corre en un dominio normalizado de 8 m. `escala` (según el poder) dice cuántos
  metros del juego cubre cada metro simulado: 1 m del juego = 1 casilla.
- Las explosiones de tierra nacen en el origen, sobre el suelo z = 0. Las aéreas y la bocanada
  nacen en el centro del dominio y no tienen suelo.
- La cámara es ortográfica, mira hacia +Y y baja ELEVACION grados: la inclinación por defecto de
  la cámara del juego (pitch 0,93 rad). El origen queda en `ancla` dentro del cuadro.
- `semilla` cambia chorros, turbulencia y giro del conjunto; `variante` cambia la receta y
  `poder` (1–3) su tamaño, su ritmo y sus capas baratas.
- La luz va horneada en el flipbook (sol + cielo). El destello, las chispas, la onda expansiva,
  la quemadura y la sombra son capas aparte (`capas.py`): no forman parte de la simulación.
  La receta dice cuáles lleva cada poder y viaja en el informe hasta el JSON del atlas.
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

ELEVACION = 53.0  # grados sobre el horizonte (pitch 0,93 rad del juego)
ENCUADRE = 8.0    # metros simulados que cubre el lado del cuadro
DOMINIO = (8.0, 8.0, 7.0)  # metros simulados; en las variantes de tierra el suelo es su cara inferior

# Resolución del dominio, ruido de detalle, píxeles por cuadro y muestras de Cycles.
CALIDADES = {
    "borrador": dict(res=80, ruido=0, px=160, muestras=24),
    "media": dict(res=112, ruido=0, px=256, muestras=32),
    "final": dict(res=128, ruido=2, px=256, muestras=96),
}

# Receta base; cada variante solo declara lo que cambia. Velocidades en m/s, tamaños en metros
# simulados, vidas y duraciones en cuadros.
BASE = dict(
    cuadros=64, fps=20,   # 8 × 8 en el atlas → 3,2 s
    continuo=False,       # True: la nube emite sin parar (incendio en bucle) en vez de estallar
    calentamiento=0,      # cuadros simulados antes del primero que se renderiza
    solape=0,             # cuadros de más que empaquetar.py funde con los primeros para cerrar el bucle
    suelo=True, ancla=(0.5, 0.20),  # posición del origen en el cuadro: x desde la izquierda, y desde abajo
    escala=1.0,           # metros del juego por metro simulado
    px=1.0,               # factor sobre los píxeles por cuadro de la calidad
    # bola: ráfaga corta y frenada que reparte combustible y humo → bola de fuego
    bola=220, vel_bola=(2.0, 9.0), freno_bola=0.22, vida_bola=(4, 8), tam_bola=0.30,
    combustible=1.0, densidad=1.0, temperatura=2.5, alargar=1.3,
    # nube: cuerpo de gas caliente que aparece de golpe bajo el destello → hongo que sube
    radio_nube=1.2, combustible_nube=0.9, densidad_nube=1.2, temperatura_nube=2.5, cuadros_nube=3,
    bultos=(7, 1.0),  # cuántos bultos deforman la nube y cuánto
    aplastar=1.0,     # escala vertical de la nube: un incendio emite desde una base chata
    vel_nube=0.0,     # velocidad inicial hacia arriba del gas de la nube (m/s): alarga la llama
    # chorros: partículas balísticas que dejan estelas de polvo → púas de escombro
    chorros=24, vel_chorros=(9.0, 16.0), apertura=0.95, tam_chorro=0.15, densidad_chorro=1.4,
    vida_chorro=(5, 10), freno_chorro=0.08, gravedad_chorro=1.0, calor_chorro=0.25,
    # oleada: aro de polvo que corre a ras de suelo
    oleada=70, vel_oleada=(5.0, 10.0), tam_oleada=0.24, densidad_oleada=1.0, vida_oleada=(5, 9),
    freno_oleada=0.16,
    # gas
    vorticidad=0.35, flotacion_calor=3.0, flotacion_densidad=1.2, disolver=0, escala_tiempo=1.8,
    quemado=0.9, humo_de_llama=1.2, vorticidad_llama=0.6,
    turbulencia=1.2, tam_turbulencia=1.6, viento=(0.35, 0.1, 0.0),
    # aspecto
    color_polvo=(0.58, 0.46, 0.31), color_humo=(0.22, 0.18, 0.14), color_hollin=(0.03, 0.027, 0.025),
    calor_color=(0.3, 2.2),  # calor del gas que corresponde a polvo puro y a hollín puro
    densidad_render=9.0, fuego=14.0, anisotropia=0.25,
    rebotes=2,  # rebotes de luz dentro del gas: el humo claro necesita más para no quedar gris
    # capas baratas que pondrá el motor (capas.py); distancias en metros del juego, tiempos en segundos.
    # onda = 0 → sin onda expansiva.
    capas=dict(destello=1.0, luz=1.0, chispas=46, quemadura=1.15, onda=0.0, radio_onda=4.0,
               duracion_onda=0.35, sombra=0.45),
)
VARIANTES = {
    # Proyectil explosivo en tierra: destello, bola de fuego compacta y hongo oscuro sobre un tallo,
    # con falda de polvo (referencia: «fire mission»).
    "tierra": dict(bola=260, combustible=1.3, densidad=0.9, temperatura=3.0, vel_bola=(1.5, 7.5),
                   radio_nube=1.15, combustible_nube=1.2, densidad_nube=0.9, temperatura_nube=3.4,
                   chorros=10, vel_chorros=(5.5, 10.5), densidad_chorro=1.0, oleada=60,
                   flotacion_calor=3.1, vorticidad=0.5,
                   color_humo=(0.085, 0.066, 0.055), color_polvo=(0.50, 0.39, 0.26), quemado=0.5,
                   humo_de_llama=2.6, densidad_render=15.0, fuego=13.0, disolver=260,
                   calor_color=(0.1, 0.9)),
    # Impacto en tierra blanda: poco fuego, púas de escombro y columna de polvo.
    "polvo": dict(combustible=0.5, densidad=1.6, temperatura=2.0, chorros=30, densidad_chorro=1.6,
                  oleada=90, color_humo=(0.30, 0.24, 0.17), fuego=10.0, quemado=1.3,
                  densidad_nube=1.6, temperatura_nube=2.2, disolver=140),
    # Combustible: bola de fuego que rueda y hongo de hollín.
    "fuego": dict(bola=320, combustible=1.6, densidad=0.8, temperatura=3.0, vel_bola=(1.5, 7.0),
                  radio_nube=1.3, combustible_nube=1.4, densidad_nube=0.7, temperatura_nube=3.5,
                  chorros=9, vel_chorros=(6.0, 11.0), oleada=30, flotacion_calor=2.4, vorticidad=0.5,
                  color_humo=(0.05, 0.045, 0.04), quemado=0.45, humo_de_llama=1.8,
                  densidad_render=12.0, fuego=13.0, disolver=220, calor_color=(0.1, 0.9)),
    # Estallido en el aire (misil contra dron): bola blanca, nube redonda que se queda colgada
    # y se deshace; sin polvo ni suelo.
    "aerea": dict(suelo=False, ancla=(0.5, 0.5), bola=240, combustible=1.0, densidad=1.0,
                  temperatura=1.4, vel_bola=(3.0, 9.5), freno_bola=0.26, alargar=1.0,
                  radio_nube=0.95, combustible_nube=0.9, densidad_nube=1.1, temperatura_nube=1.2,
                  chorros=16, vel_chorros=(8.0, 15.0), apertura=math.pi, tam_chorro=0.13,
                  densidad_chorro=0.9, gravedad_chorro=0.35, calor_chorro=0.6, oleada=0,
                  flotacion_calor=0.55, flotacion_densidad=0.2, vorticidad=0.45, quemado=1.5,
                  humo_de_llama=1.6, disolver=110, turbulencia=1.6, viento=(0.5, 0.15, 0.0), rebotes=4,
                  vida_chorro=(4, 7),
                  color_polvo=(0.42, 0.40, 0.38), color_humo=(0.20, 0.185, 0.175),
                  color_hollin=(0.05, 0.045, 0.042), calor_color=(0.15, 1.3), fuego=13.0,
                  densidad_render=10.0,
                  capas=dict(destello=1.1, luz=0.35, chispas=40, quemadura=0.0, onda=0.0,
                             radio_onda=3.0, duracion_onda=0.28, sombra=0.35)),
    # Incendio: llama y columna de humo que no se acaban (restos ardiendo). Bucle de 32 cuadros:
    # se simulan de más y empaquetar.py funde los últimos con los primeros.
    "incendio": dict(continuo=True, cuadros=32, fps=16, calentamiento=44, solape=10, escala=0.55,
                     bola=0, chorros=0, oleada=0, radio_nube=0.58, bultos=(5, 1.0), aplastar=0.6,
                     vel_nube=3.5, combustible_nube=1.0, densidad_nube=0.6, temperatura_nube=2.4,
                     flotacion_calor=3.0, flotacion_densidad=0.4, vorticidad=0.6, quemado=0.5,
                     humo_de_llama=3.0, vorticidad_llama=1.0, disolver=130, escala_tiempo=1.3,
                     turbulencia=2.0, tam_turbulencia=1.1, viento=(0.25, 0.08, 0.0),
                     color_humo=(0.06, 0.055, 0.05), color_polvo=(0.16, 0.15, 0.14), calor_color=(0.05, 0.8),
                     densidad_render=14.0, fuego=4.5,
                     capas=dict(destello=0.0, luz=0.0, chispas=0, quemadura=0.0, onda=0.0, sombra=0.4)),
    # Bocanada de humo para las estelas de los cohetes: sin fuego, blanca (el motor la tiñe),
    # 16 cuadros. Se empaqueta con varias semillas, una por fila.
    "bocanada": dict(suelo=False, ancla=(0.5, 0.5), cuadros=16, fps=16, bola=160, combustible=0.0,
                     densidad=1.0, temperatura=0.6, vel_bola=(2.5, 9.0), freno_bola=0.3,
                     vida_bola=(3, 6), tam_bola=0.6, alargar=1.0,
                     radio_nube=1.3, combustible_nube=0.0, densidad_nube=1.0, temperatura_nube=0.5,
                     cuadros_nube=2, chorros=0, oleada=0, flotacion_calor=1.0, flotacion_densidad=0.0,
                     vorticidad=0.8, disolver=40, escala_tiempo=2.3, turbulencia=9.0,
                     tam_turbulencia=1.3, viento=(0.0, 0.0, 0.0), bultos=(14, 2.4),
                     color_polvo=(0.9, 0.9, 0.9), color_humo=(0.9, 0.9, 0.9),
                     color_hollin=(0.9, 0.9, 0.9), densidad_render=3.5, fuego=0.0, anisotropia=0.4,
                     rebotes=8, capas=dict()),
}
# Lo que cambia con el poder (1 = misil ligero, 2 = artillería media, 3 = pesada). El poder 2 es la
# receta tal cual. `escala` agranda la explosión en el juego; el ritmo (fps y tiempo simulado) la hace
# pesar; las capas dicen si lleva onda expansiva y cuánta.
PODERES = {
    "tierra": {
        1: dict(escala=0.62, fps=24, bola=170, radio_nube=0.95, chorros=6, oleada=24, disolver=150,
                escala_tiempo=2.0,
                capas=dict(destello=0.8, luz=0.7, chispas=22, quemadura=0.75, onda=0.0, sombra=0.4)),
        2: dict(capas=dict(destello=1.0, luz=1.0, chispas=46, quemadura=1.2, onda=0.55, radio_onda=4.2,
                           duracion_onda=0.34, sombra=0.45)),
        3: dict(escala=1.6, fps=16, px=1.5, bola=340, radio_nube=1.3, combustible_nube=1.5, chorros=26,
                vel_chorros=(8.0, 15.0), oleada=130, vel_oleada=(6.0, 12.0), densidad_oleada=1.3,
                escala_tiempo=1.6, disolver=320, flotacion_calor=3.2,
                capas=dict(destello=1.4, luz=1.5, chispas=90, quemadura=2.1, onda=1.0, radio_onda=9.5,
                           duracion_onda=0.55, sombra=0.5)),
    },
    "polvo": {
        1: dict(escala=0.62, fps=24, chorros=16, oleada=40, disolver=90,
                capas=dict(destello=0.5, luz=0.4, chispas=10, quemadura=0.7, onda=0.0, sombra=0.4)),
        2: dict(capas=dict(destello=0.7, luz=0.6, chispas=24, quemadura=1.1, onda=0.4, radio_onda=3.8,
                           duracion_onda=0.34, sombra=0.45)),
        3: dict(escala=1.6, fps=16, chorros=44, oleada=150, escala_tiempo=1.6,
                capas=dict(destello=0.9, luz=0.8, chispas=50, quemadura=2.0, onda=0.9, radio_onda=9.0,
                           duracion_onda=0.55, sombra=0.5)),
    },
    "fuego": {
        1: dict(escala=0.62, fps=24, bola=220, radio_nube=1.05, disolver=80,
                capas=dict(destello=0.8, luz=0.9, chispas=14, quemadura=0.8, onda=0.0, sombra=0.4)),
        2: dict(capas=dict(destello=1.0, luz=1.3, chispas=30, quemadura=1.3, onda=0.3, radio_onda=3.6,
                           duracion_onda=0.36, sombra=0.45)),
        3: dict(escala=1.6, fps=16, bola=400, radio_nube=1.45, escala_tiempo=1.6, disolver=160,
                capas=dict(destello=1.3, luz=1.8, chispas=60, quemadura=2.2, onda=0.7, radio_onda=8.5,
                           duracion_onda=0.6, sombra=0.5)),
    },
    "aerea": {
        1: dict(escala=0.55, fps=24, bola=170, radio_nube=0.8, chorros=10, disolver=55,
                capas=dict(destello=0.9, luz=0.25, chispas=26, quemadura=0.0, onda=0.0, sombra=0.3)),
        2: dict(capas=dict(destello=1.1, luz=0.35, chispas=40, quemadura=0.0, onda=0.35, radio_onda=3.0,
                           duracion_onda=0.28, sombra=0.35)),
        3: dict(escala=1.5, fps=16, bola=320, radio_nube=1.15, chorros=26, escala_tiempo=1.6, disolver=110,
                capas=dict(destello=1.4, luz=0.5, chispas=70, quemadura=0.0, onda=0.7, radio_onda=6.5,
                           duracion_onda=0.42, sombra=0.4)),
    },
    "bocanada": {1: {}, 2: {}, 3: {}},
    "incendio": {1: dict(escala=0.4, radio_nube=0.45), 2: {}, 3: dict(escala=0.8, radio_nube=0.72)},
}


def receta(variante, poder=2):
    r = dict(BASE)
    capas = dict(BASE["capas"])
    for cambios in (VARIANTES[variante], PODERES[variante][poder]):
        cambios = dict(cambios)
        capas.update(cambios.pop("capas", {}))
        r.update(cambios)
    r["capas"] = capas if VARIANTES[variante].get("capas") != {} else {}
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
    total = r["calentamiento"] + r["cuadros"] + r["solape"]
    sc.frame_start, sc.frame_end = 1, total
    sc.render.fps = r["fps"]
    celda = max(DOMINIO) / calidad["res"]  # los tamaños de partícula del flujo van en celdas
    # Origen del estallido: sobre el suelo, o en el centro del dominio si la variante es aérea.
    z0 = 0.0 if r["suelo"] else DOMINIO[2] / 2

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
    d.use_collision_border_bottom = r["suelo"]
    if calidad["ruido"]:
        d.use_noise = True
        d.noise_scale = calidad["ruido"]
        d.noise_strength = 1.4
        d.noise_pos_scale = 2.0
    d.cache_type = "ALL"
    d.cache_directory = cache
    d.cache_frame_start, d.cache_frame_end = 1, total
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
    abajo = 0.0 if r["suelo"] else -1.0  # coseno mínimo: hemisferio sobre el suelo o esfera completa
    dirs = []
    for _ in range(max(24, r["bola"] // 4)):
        d_ = direccion(rng.uniform(0, math.tau), rng.uniform(abajo, 1.0))
        d_.z *= r["alargar"]
        dirs.append(d_.normalized())
    if r["bola"]:
        bola = _emisor("bola", dirs, 0.15, z0 + (0.25 if r["suelo"] else 0.0))
        psys = _rafaga(bola, semilla, r["bola"], r["vel_bola"], r["vida_bola"], r["freno_bola"], 0.0)
        con_fuego = r["combustible"] > 0
        flujo(bola, psys, "BOTH" if con_fuego else "SMOKE", r["tam_bola"], r["vida_bola"][1] + 1,
              density=r["densidad"], temperature=r["temperatura"], velocity_factor=0.9,
              **(dict(fuel_amount=r["combustible"]) if con_fuego else {}))

    # 1b. Nube: una esfera irregular que crece suelta gas caliente durante tres cuadros. No necesita velocidad:
    #     el calor la hace subir y enrollarse en hongo.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r["radio_nube"],
                                          location=(0, 0, z0 + (r["radio_nube"] * 0.6 if r["suelo"] else 0.0)))
    nube = bpy.context.object
    nube.name = "nube"
    bultos = [(direccion(rng.uniform(0, math.tau), rng.uniform(-0.3 if r["suelo"] else -1.0, 1.0)),
               rng.uniform(-0.3, 0.25) * r["bultos"][1]) for _ in range(r["bultos"][0])]
    for v in nube.data.vertices:  # bultos suaves: cada semilla da otra silueta
        n_ = v.co.normalized()
        v.co *= max(0.3, 1 + sum(a_ * max(0.0, n_.dot(d_)) ** 3 for d_, a_ in bultos))
    n_nube = r["cuadros_nube"]
    nube.scale = (1.0, 1.0, r["aplastar"])
    for i in range(0 if r["continuo"] else n_nube):  # crece en unos cuadros en vez de aparecer hecha
        nube.scale = (0.35 + 0.65 * i / max(1, n_nube - 1),) * 3
        nube.keyframe_insert("scale", frame=i + 1)
    mf = nube.modifiers.new("flujo", "FLUID")
    mf.fluid_type = "FLOW"
    f = mf.flow_settings
    f.flow_type = "BOTH" if r["combustible_nube"] > 0 else "SMOKE"
    f.flow_behavior = "INFLOW"
    if r["combustible_nube"] > 0:
        f.fuel_amount = r["combustible_nube"]
    f.density = r["densidad_nube"]
    f.temperature = r["temperatura_nube"]
    f.surface_distance = 0.5
    if r["vel_nube"]:
        f.use_initial_velocity = True
        f.velocity_coord = (0.0, 0.0, r["vel_nube"])
    f.volume_density = 1.0
    if not r["continuo"]:
        _clave(f, "use_inflow", {1: True, n_nube: True, n_nube + 1: False})
    nube.hide_render = True

    # 2. Chorros: partículas balísticas que dejan una estela de polvo (las púas de la referencia).
    if r["chorros"]:
        c0 = math.cos(r["apertura"])

        def altura():  # coseno del ángulo con la vertical: sesgado hacia arriba en tierra, uniforme en el aire
            u = rng.uniform(c0, 1.0)
            return u ** 0.6 if r["suelo"] else u

        dirs = [direccion(giro + math.tau * (i + rng.uniform(-0.4, 0.4)) / r["chorros"], altura())
                for i in range(r["chorros"])]
        cho = _emisor("chorros", dirs, 0.25, z0 + (0.15 if r["suelo"] else 0.0))
        psys = _rafaga(cho, semilla + 1, r["chorros"] * 3, r["vel_chorros"], r["vida_chorro"],
                       r["freno_chorro"], r["gravedad_chorro"])
        flujo(cho, psys, "SMOKE", r["tam_chorro"], r["vida_chorro"][1] + 2, density=r["densidad_chorro"],
              temperature=r["calor_chorro"], velocity_factor=0.7)

    # 3. Oleada: aro de polvo que corre a ras de suelo y se frena.
    if r["oleada"] and r["suelo"]:
        n = max(16, r["oleada"] // 2)
        dirs = [direccion(giro + math.tau * (i + rng.uniform(-0.5, 0.5)) / n, rng.uniform(0.0, 0.12))
                for i in range(n)]
        ole = _emisor("oleada", dirs, 0.35, 0.12)
        psys = _rafaga(ole, semilla + 2, r["oleada"], r["vel_oleada"], r["vida_oleada"],
                       r["freno_oleada"], 0.0)
        flujo(ole, psys, "SMOKE", r["tam_oleada"], r["vida_oleada"][1] + 1,
              density=r["densidad_oleada"], temperature=0.1, velocity_factor=0.6)

    # Turbulencia y viento: lo que hace distinta cada semilla una vez pasado el estallido.
    bpy.ops.object.effector_add(type="TURBULENCE", location=(0, 0, z0 + (2.5 if r["suelo"] else 0.0)))
    tur = bpy.context.object
    tur.field.strength = r["turbulencia"]
    tur.field.size = r["tam_turbulencia"]
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
    cy.volume_bounces = r["rebotes"]
    cy.max_bounces = max(4, r["rebotes"])
    cy.volume_step_rate = 1.0
    cy.volume_max_steps = 256
    sc.render.resolution_x = sc.render.resolution_y = int(calidad["px"] * r["px"])
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
    ancla = r["ancla"]
    z0 = 0.0 if r["suelo"] else DOMINIO[2] / 2
    centro = Vector((0, 0, z0)) + arriba * (ENCUADRE * (0.5 - ancla[1]))  # el origen queda en el ancla
    co.location = centro - hacia * 60
    co.rotation_euler = (math.radians(90 - ELEVACION), 0, 0)
    cam.shift_x = 0.5 - ancla[0]
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


def renderizar(salida, cuadros, desfase=0):
    """Renderiza los cuadros pedidos; `desfase` salta el calentamiento de la simulación."""
    sc = bpy.context.scene
    tiempos = []
    for c in cuadros:
        sc.frame_set(c + desfase)
        sc.render.filepath = os.path.join(salida, f"c{c:03d}.exr")
        t = time.time()
        bpy.ops.render.render(write_still=True)
        tiempos.append(time.time() - t)
    return tiempos


# ------------------------------------------------------------------ entrada


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="explosion.py")
    ap.add_argument("--variante", default="tierra", choices=sorted(VARIANTES))
    ap.add_argument("--poder", type=int, default=2, choices=(1, 2, 3))
    ap.add_argument("--semilla", type=int, default=1)
    ap.add_argument("--salida", required=True)
    ap.add_argument("--calidad", default="borrador", choices=sorted(CALIDADES))
    ap.add_argument("--solo", choices=("sim", "render"))
    ap.add_argument("--cuadros", help="lista de cuadros a renderizar, p. ej. 1,4,8; por defecto todos")
    ap.add_argument("--suelo", action="store_true", help="vista previa con arena, sombra y luz")
    a = ap.parse_args(args)

    r, calidad = receta(a.variante, a.poder), CALIDADES[a.calidad]
    salida = os.path.abspath(a.salida)
    cache = os.path.join(salida, "cache")
    cuadros_dir = os.path.join(salida, "suelo" if a.suelo else "cuadros")
    os.makedirs(cuadros_dir, exist_ok=True)

    escena = os.path.join(salida, "explosion.blend")
    informe = dict(variante=a.variante, poder=a.poder, semilla=a.semilla, calidad=a.calidad, fps=r["fps"],
                   cuadros=r["cuadros"], px=int(calidad["px"] * r["px"]), encuadre_m=round(ENCUADRE * r["escala"], 3),
                   escala=r["escala"], suelo=r["suelo"], ancla=list(r["ancla"]), elevacion=ELEVACION,
                   bucle=r["continuo"], solape=r["solape"],
                   capas=r["capas"], blender=bpy.app.version_string)
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
        cuadros = [int(x) for x in a.cuadros.split(",")] if a.cuadros else list(range(1, r["cuadros"] + r["solape"] + 1))
        ts = renderizar(cuadros_dir, cuadros, r["calentamiento"])
        informe["s_render_suelo" if a.suelo else "s_render"] = round(sum(ts), 1)
        informe["s_cuadro_max"] = round(max(ts), 2)
        print(f"[explosion] render: {sum(ts):.1f} s en {len(ts)} cuadros (máx. {max(ts):.2f} s)")
    json.dump(informe, open(ruta_informe, "w"), indent=1)


if __name__ == "__main__":
    main()
