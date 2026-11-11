"""Singularidad (black hole) de Code Battle Lite / Codemageddon: prototipo del arma de final de juego.

Un agujero negro diminuto y con carga eléctrica flota repelido por el piso, que un arma eléctrica
cargó antes. Solo es débil; su poder crece de forma no lineal con la masa (agujeros fusionados más
enemigos comidos) hasta la masa crítica. Todo lo que se ve sale de la masa y de unos pocos eventos:

- lente gravitacional más fuerte con más masa; brillo de Hawking inverso a la masa (pequeño =
  blanco azulado y muy brillante; cerca de la masa crítica, negro y con el entorno apagado);
- arcos eléctricos erráticos al piso, que son lo que lo sostiene a la vista;
- cada enemigo absorbido se estira en una línea de luz que orbita, cierra la espiral y se apaga en
  el horizonte (no hay disco de acreción estable: el «disco» son esas líneas);
- dos agujeros se repelen, entran en órbita cada vez más rápida, derivan hacia el fondo y se
  fusionan con destello, anillo de onda gravitacional, retroceso y ringdown.

Blender solo pone el escenario de prueba (color y profundidad). Lo demás es un pase de numpy que
hace lo que hará el motor en espacio de pantalla y con geometría mínima (líneas), sin estado.
Todos los números están en singularidad_config.json.

Sin ventana:
    blender -b --factory-startup --python arte/blender/vfx/singularidad.py -- --salida <carpeta>
        [--demo fusion|masa] [--calidad borrador|final] [--modo completo|simple]
        [--config ruta.json] [--cuadros 10,40,80] [--orbita 0] [--elevacion 38] [--distancia 17]

Convenciones:
- 1 m = 1 casilla; el suelo es z = 0.
- El efecto no decide nada del juego: recibe posiciones, masas y eventos (crear, absorber, fusionar)
  y emite los ganchos de `eventos` del config. No depende del estado de carga.
- `--modo simple` es la ruta degradada: sin lente, aberración ni bloom, y con la mitad de arcos.
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
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import a_bytes, a_srgb, escribir_jpg, escribir_png, hoja, leer_exr, nodos, tono, video  # noqa: E402

FPS = 24
FOV_Y = 38.0  # el de la cámara del juego
ALTURA_ENEMIGO = 0.4
CONFIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "singularidad_config.json")

CALIDADES = {
    "borrador": dict(ancho=512, alto=288, muestras=16),
    "final": dict(ancho=768, alto=432, muestras=16),
}


def suave(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def cargar_config(ruta):
    def limpiar(x):
        if isinstance(x, dict):
            return {k: limpiar(v) for k, v in x.items() if k != "_"}
        return x
    return limpiar(json.load(open(ruta, encoding="utf-8")))


def curva(c, masa):
    return c["base"] * masa ** c["exponente"]


def apariencia(cfg, masa, pulso=0.0):
    """Todo lo visual que depende solo de la masa. `pulso` es la palpitación del ringdown (−1…1)."""
    x = min(1.0, masa / cfg["masa"]["critica"])
    hw, osc = cfg["hawking"], cfg["oscuridad"]
    apagado = 1 - suave((x - hw["apagado"][0]) / (hw["apagado"][1] - hw["apagado"][0]))
    return dict(
        x=x,
        radio=curva(cfg["curvas"]["radio_horizonte"], masa) * (1 + pulso),
        lente=curva(cfg["curvas"]["lente"], masa) * (1 + 0.6 * pulso),
        hawking=hw["brillo"] * masa ** -hw["exponente"] * apagado * (1 + 2.5 * abs(pulso)),
        oscuridad=osc["maxima"] * max(0.0, (x - osc["inicio"]) / (1 - osc["inicio"])) ** osc["exponente"],
        arcos=curva(cfg["arcos"]["cantidad"], masa),
        brillo_arcos=curva(cfg["arcos"]["brillo"], masa),
        alcance_arcos=curva(cfg["arcos"]["alcance"], masa),
    )


def letalidad(cfg, masa):
    return min(1.0, masa / cfg["masa"]["critica"]) ** cfg["curvas"]["letalidad"]["exponente"]


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


def escenario(n_enemigos):
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
    # Enemigos de la demo: se mueven y desaparecen al ser absorbidos (los coloca el bucle de render).
    enemigos = []
    rojo = _material("enemigo", (0.70, 0.07, 0.03))
    for i in range(n_enemigos):
        cuerpo = _caja(f"enemigo{i}", 0, 0, 0.8, 0.9, 0.55, rojo if i % 3 else naranja, col)
        torre = _caja(f"enemigo_torre{i}", 0, 0, 0.42, 0.42, 0.3, grafito, col)
        enemigos.append((cuerpo, torre))
    return col, enemigos


def camara(calidad, elevacion, yaw, dist):
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
    orientar(co, elevacion, yaw, dist)
    return co


def orientar(co, elevacion, yaw, dist):
    el, az = math.radians(elevacion), math.radians(yaw)
    objetivo = Vector((0.0, 1.4, 1.5))
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


# ------------------------------------------------------------------ guion: masas, trayectorias y eventos


class Guion:
    """Lo que el juego le contaría al efecto: dónde está cada agujero, cuánta masa tiene y qué pasó.

    Las trayectorias son fórmulas del tiempo (se pueden evaluar en cualquier orden y el juego puede
    llamar a la misma función para saber dónde está cada agujero). Solo al construir la demo se
    recorre el tiempo, para decidir qué enemigo entra en el radio de absorción y cuándo.
    """

    def __init__(self, cfg, demo, semilla):
        self.cfg, self.demo, self.semilla = cfg, demo, semilla
        self.rng = np.random.default_rng(semilla)
        self.agujeros, self.absorciones, self.eventos, self.enemigos = {}, [], [], []
        self.fu = None
        d = cfg["demo"][demo]
        self.duracion = d["duracion"]
        if demo == "fusion":
            self._demo_fusion(d)
        else:
            self._demo_masa(d)
        self.eventos.sort(key=lambda e: e["t"])

    # -- construcción ----------------------------------------------------------

    def _evento(self, t, nombre, **datos):
        self.eventos.append(dict(t=round(t, 3), evento=nombre, **datos))

    def _absorber(self, t, pos, agujero, masa, color, enemigo=None):
        e = self.cfg["espagueti"]
        az, inc = self.rng.uniform(0, math.tau), math.radians(self.rng.uniform(0, e["inclinacion_max_grados"]))
        self.absorciones.append(dict(
            t=t, pos=np.array(pos, np.float64), agujero=agujero, masa=masa, color=np.array(color), enemigo=enemigo,
            dur=e["estiramiento"] + self.rng.uniform(*e["orbita"]), vueltas=self.rng.uniform(*e["vueltas"]),
            eje=np.array((math.sin(inc) * math.cos(az), math.sin(inc) * math.sin(az), math.cos(inc)))))
        self._evento(t, "enemigo_absorbido", agujero=agujero, masa=masa)

    def _umbrales(self, t, antes, ahora):
        for nombre, clave in (("super_arma", "super_arma"), ("masa_critica", "critica")):
            if antes < self.cfg["masa"][clave] <= ahora:
                self._evento(t, nombre, masa=round(ahora, 3))

    def _demo_fusion(self, d):
        cfg, f, m = self.cfg, self.cfg["fusion"], self.cfg["masa"]
        ta, tb = d["agujero_a"]["t"], d["agujero_b"]["t"]
        ang = math.radians(d["agujero_b"]["direccion_grados"])
        t_r = tb + 1.5 * (f["distancia_inicial"] - f["distancia_minima"]) / f["velocidad_disparo"]
        t_o = t_r + f["repulsion"]
        dd = np.array(f["direccion_deriva"], np.float64)
        self.fu = dict(t_d=tb, t_r=t_r, t_o=t_o, t_f=t_o + f["orbita"], a0=np.array(d["agujero_a"]["pos"], np.float64),
                       u0=np.array((math.cos(ang), math.sin(ang))), deriva=dd / np.linalg.norm(dd),
                       wa=0.5, wb=0.5, patada=0.0)
        self.agujeros = {"A": dict(nace=ta, m0=m["agujero"]), "B": dict(nace=tb, m0=m["agujero"])}
        self._evento(ta, "agujero_creado", agujero="A")
        self._evento(tb, "agujero_creado", agujero="B")
        self._evento(t_r, "repulsion")
        self._evento(t_o, "orbita")
        en = d["enemigos"]
        for i in range(en["cantidad"]):
            self.enemigos.append(dict(p0=np.array((en["carriles_x"][i % len(en["carriles_x"])],
                                                   en["primero_y"] + en["separacion_y"] * i)),
                                      v=np.array((0.0, -en["velocidad"])), t_abs=None))
        masas, fase, dt, t = {"A": m["agujero"], "B": m["agujero"]}, 0, 1 / 120, 0.0
        while t < self.duracion:
            fu = self.fu
            if fase == 0 and t >= fu["t_r"]:  # los pesos del baricentro se fijan al empezar a repelerse
                fu["wa"], fu["wb"] = (masas[k] / (masas["A"] + masas["B"]) for k in "AB")
                fase = 1
            if fase == 1 and t >= fu["t_f"]:
                asim = abs(masas["A"] - masas["B"]) / (masas["A"] + masas["B"])
                fu["patada"] = f["retroceso"]["velocidad"] * (1 + f["retroceso"]["asimetria"] * asim)
                antes = masas["A"]
                masas["A"] += masas["B"]
                self._evento(fu["t_f"], "fusion", masa=round(masas["A"], 3), asimetria=round(asim, 3),
                             retroceso=round(fu["patada"], 2))
                self._evento(fu["t_f"] + 4 * f["ringdown"]["amortiguacion"], "ringdown_fin")
                self._umbrales(t, antes, masas["A"])
                fase = 2
            vivos = [k for k in "AB" if t >= self.agujeros[k]["nace"] and not (k == "B" and fase == 2)]
            for i, e in enumerate(self.enemigos):
                if e["t_abs"] is not None:
                    continue
                p = e["p0"] + e["v"] * t
                for k in vivos:
                    if np.hypot(*(p - self.pos(k, t)[:2])) < curva(cfg["curvas"]["radio_absorcion"], masas[k]):
                        e["t_abs"] = t
                        self._absorber(t, (p[0], p[1], ALTURA_ENEMIGO), k, m["enemigo"], (1.0, 0.25, 0.06), i)
                        self._umbrales(t, masas[k], masas[k] + m["enemigo"])
                        masas[k] += m["enemigo"]
                        break
            t += dt

    def _demo_masa(self, d):
        cfg, m = self.cfg, self.cfg["masa"]
        self.agujeros = {"A": dict(nace=0.3, m0=m["agujero"])}
        self.fu = None
        self.a0 = np.array((0.0, 1.0))
        self._evento(0.3, "agujero_creado", agujero="A")
        t, antes = 0.6, m["agujero"]
        while t < self.duracion:
            masa = self.masa("A", t)
            ang, r = self.rng.uniform(0, math.tau), curva(cfg["curvas"]["radio_absorcion"], masa) * 0.8
            self._absorber(t, (self.a0[0] + r * math.cos(ang), self.a0[1] + r * math.sin(ang), ALTURA_ENEMIGO),
                           "A", 0.0, (1.0, 0.25, 0.06))
            self._umbrales(t, antes, masa)
            antes = masa
            t += 1 / d["lineas_por_segundo"]

    # -- consultas sin estado --------------------------------------------------

    def id_actual(self, k, t):
        return "A" if (k == "B" and self.fu and t >= self.fu["t_f"]) else k

    def masa(self, k, t):
        """Masa visible: sube mientras la línea del enemigo cruza el horizonte, no de golpe."""
        if self.demo == "masa":
            d, m = self.cfg["demo"]["masa"], self.cfg["masa"]
            return m["agujero"] + (m["critica"] - m["agujero"]) * min(1.0, t / (0.92 * d["duracion"])) ** d["exponente"]
        fundido = self.fu and t >= self.fu["t_f"]
        total = 0.0
        for q in (("A", "B") if (k == "A" and fundido) else (k,)):
            total += self.agujeros[q]["m0"]
            for a in self.absorciones:
                if a["agujero"] == q:
                    total += a["masa"] * suave((t - a["t"] - 0.5 * a["dur"]) / (0.5 * a["dur"]))
        return total

    def pos(self, k, t):
        """Posición del agujero k en el instante t (metros)."""
        fl = self.cfg["flotacion"]
        n = 0 if k == "A" else 1
        z = fl["altura"] + fl["altura_por_masa"] * (self.masa(k, t) if self.demo == "masa" else 1.0) \
            + fl["vaiven"] * math.sin(math.tau * fl["frecuencia"] * t + 2.1 * n) \
            + fl["temblor"] * math.sin(t * 61.0 + n) * math.sin(t * 37.0 + 1.3 * n)
        if self.fu is None:
            return np.array((self.a0[0], self.a0[1], z))
        fu, f = self.fu, self.cfg["fusion"]
        if t < fu["t_r"] and k == "A":
            return np.array((fu["a0"][0], fu["a0"][1], z))
        d0, dmin, dorb = f["distancia_inicial"], f["distancia_minima"], f["distancia_orbita"]
        w0 = math.tau * f["vueltas"] * f["exponente_fase"] / f["orbita"]  # velocidad angular al entrar en órbita
        fase0 = math.atan2(fu["u0"][1], fu["u0"][0])
        c_r = fu["a0"] + fu["wb"] * dmin * fu["u0"]
        if t < fu["t_r"]:      # B se acerca frenando; A no se mueve
            u = (t - fu["t_d"]) / (fu["t_r"] - fu["t_d"])
            d, fase, c = d0 - (d0 - dmin) * (1 - (1 - u) ** 1.5), fase0, None
        elif t < fu["t_o"]:    # misma carga: se repelen y empiezan a girar
            u = (t - fu["t_r"]) / f["repulsion"]
            d, fase, c = dmin + (dorb - dmin) * (1 - (1 - u) ** 2), fase0 + w0 * f["repulsion"] * u * u / 2, c_r
        elif t < fu["t_f"]:    # órbita mutua que se acelera; la pareja deriva hacia el fondo
            u = (t - fu["t_o"]) / f["orbita"]
            d = dorb * (1 - u) ** f["exponente_separacion"]
            fase = fase0 + w0 * f["repulsion"] / 2 + math.tau * f["vueltas"] * (1 - (1 - u) ** f["exponente_fase"])
            c = c_r + fu["deriva"] * f["deriva"] * (t - fu["t_o"])
        else:                  # fusionados: retroceso en la dirección de la deriva
            tau, fr = t - fu["t_f"], f["retroceso"]["frenado"]
            c = c_r + fu["deriva"] * (f["deriva"] * f["orbita"] + fu["patada"] * fr * (1 - math.exp(-tau / fr)))
            return np.array((c[0], c[1], z))
        s = d * np.array((math.cos(fase), math.sin(fase)))
        dz = d * math.sin(fase - fase0) * math.sin(math.radians(f["inclinacion_grados"]))
        if c is None:
            p = fu["a0"] + s
            return np.array((p[0], p[1], z))
        p, signo = (c - fu["wb"] * s, -fu["wb"]) if k == "A" else (c + fu["wa"] * s, fu["wa"])
        return np.array((p[0], p[1], z + signo * dz))

    def estado(self, t, simple=False):
        """Todo lo que hay que dibujar en t: agujeros, líneas de luz, arcos, destellos y ondas."""
        cfg, f, fu = self.cfg, self.cfg["fusion"], self.fu
        rd = f["ringdown"]
        pulso = 0.0
        if fu and t >= fu["t_f"]:
            tau = t - fu["t_f"]
            pulso = rd["amplitud"] * math.exp(-tau / rd["amortiguacion"]) * math.cos(math.tau * rd["frecuencia"] * tau)
        agujeros = []
        for k, a in self.agujeros.items():
            if t < a["nace"] or self.id_actual(k, t) != k:
                continue
            masa = self.masa(k, t)
            agujeros.append(dict(id=k, pos=self.pos(k, t), masa=masa, **apariencia(cfg, masa, pulso)))
        est = dict(t=t, agujeros=agujeros, lineas=[], destellos=[], ondas=[],
                   enemigos=[None if (e["t_abs"] is not None and t >= e["t_abs"]) else e["p0"] + e["v"] * t
                             for e in self.enemigos])
        por_id = {a["id"]: a for a in agujeros}

        # Spaghettificación: una polilínea por enemigo, de la cola a la cabeza sobre una espiral.
        e = cfg["espagueti"]
        n = e["segmentos"] // (2 if simple else 1)
        for ab in self.absorciones:
            s = (t - ab["t"]) / ab["dur"]
            retraso = e["estiramiento"] / ab["dur"]
            if s <= 0 or s >= 1 + retraso:
                continue
            ag = por_id.get(self.id_actual(ab["agujero"], t))
            if ag is None:
                continue
            h0 = self.pos(ab["agujero"], ab["t"])
            rel = ab["pos"] - h0
            rho0 = np.linalg.norm(rel)
            er = rel / rho0
            et = np.cross(ab["eje"], er)
            et /= np.linalg.norm(et)
            q = np.linspace(max(0.0, s - retraso) ** e["avance"], min(1.0, s) ** e["avance"], n + 1)
            rho = ag["radio"] + (rho0 - ag["radio"]) * (1 - q)
            ang = math.tau * ab["vueltas"] * (1 - (1 - q) ** e["espiral"])
            pts = ag["pos"] + (rho * np.cos(ang))[:, None] * er + (rho * np.sin(ang))[:, None] * et
            u1 = min(1.0, (t - ab["t"]) / e["estiramiento"])        # 0→1 durante el estiramiento
            k = np.linspace(0, 1, n + 1)                             # 0 en la cola, 1 en la cabeza
            ancho = e["ancho_m"] + (e["tamano_enemigo_m"] * 0.5 - e["ancho_m"]) * (1 - u1) ** 2 * (1 - k) ** 2
            color = ab["color"] + (np.array(e["color_final"]) - ab["color"]) * (0.25 + 0.75 * u1) * (0.4 + 0.6 * k[:, None])
            apagar = 1 - suave((s - 1) / retraso)
            est["lineas"].append(dict(pts=pts, ancho=ancho, color=color * (e["brillo"] * (0.35 + 0.65 * k[:, None]) * apagar)))

        # Arcos eléctricos: se sortean de nuevo en cada intervalo; la semilla es (agujero, intervalo, arco).
        a_ = cfg["arcos"]
        cubo, resto = divmod(t * a_["frecuencia"], 1.0)
        for ag in agujeros:
            col = np.array(a_["color"]) + (np.array(a_["color_critico"]) - np.array(a_["color"])) * ag["x"] ** 1.5
            cuantos = ag["arcos"] * (0.5 if simple else 1.0)
            r0 = np.random.default_rng([self.semilla, ord(ag["id"]), int(cubo)])
            for j in range(int(cuantos) + (r0.random() < cuantos % 1)):
                r = np.random.default_rng([self.semilla, ord(ag["id"]), int(cubo), j])
                rr, az = ag["alcance_arcos"] * math.sqrt(r.random()), r.uniform(0, math.tau)
                fin = np.array((ag["pos"][0] + rr * math.cos(az), ag["pos"][1] + rr * math.sin(az), 0.0))
                brillo = ag["brillo_arcos"] * r.uniform(0.5, 1.2) * (1 - 0.6 * resto)
                rayo = _rayo(r, ag["pos"], fin, a_["segmentos"], a_["zigzag"], a_["zigzag_fino"])
                est["lineas"].append(dict(pts=rayo, ancho=np.full(len(rayo), a_["ancho_m"] * r.uniform(0.7, 1.4)),
                                          color=np.tile(col * brillo, (len(rayo), 1)), suelo=fin, arco=True))
                if r.random() < a_["ramas"]:
                    i = int(r.integers(3, a_["segmentos"] - 3))
                    punta = rayo[i] + r.normal(size=3) * 0.35 * np.linalg.norm(fin - ag["pos"]) * np.array((1, 1, 0.5))
                    punta[2] = max(0.0, punta[2] - 0.3)
                    rama = _rayo(r, rayo[i], punta, 6, a_["zigzag"], a_["zigzag_fino"])
                    est["lineas"].append(dict(pts=rama, ancho=np.full(len(rama), a_["ancho_m"] * 0.7),
                                              color=np.tile(col * brillo * 0.5, (len(rama), 1)), arco=True))
        if len(agujeros) == 2 and fu and t >= fu["t_r"] - 0.4:  # arcos entre los dos durante la órbita
            col = np.array(a_["color"])
            for j in range(a_["entre_agujeros"] // (2 if simple else 1) + 1):
                r = np.random.default_rng([self.semilla, 999, int(cubo), j])
                rayo = _rayo(r, agujeros[0]["pos"], agujeros[1]["pos"], a_["segmentos"], a_["zigzag"], a_["zigzag_fino"])
                est["lineas"].append(dict(pts=rayo, ancho=np.full(len(rayo), a_["ancho_m"] * 1.2), arco=True,
                                          color=np.tile(col * 2.2 * r.uniform(0.5, 1.2) * (1 - 0.6 * resto), (len(rayo), 1))))

        # Destellos (aparición y fusión) y anillo de onda gravitacional.
        ap = cfg["aparicion"]
        for k, a in self.agujeros.items():
            tau = t - a["nace"]
            if 0 <= tau < ap["duracion"]:
                est["destellos"].append(dict(pos=self.pos(k, t), k=1 - tau / ap["duracion"], brillo=ap["brillo"], radio=ap["radio_m"]))
        if fu and t >= fu["t_f"]:
            tau, de, on = t - fu["t_f"], f["destello"], f["onda"]
            centro = self.pos("A", fu["t_f"])
            escala = (self.masa("A", fu["t_f"] + 1e-3) / (2 * cfg["masa"]["agujero"])) ** 0.5
            if tau < 4 * de["duracion"]:
                est["destellos"].append(dict(pos=centro, k=math.exp(-tau / de["duracion"]), brillo=de["brillo"] * escala,
                                             radio=de["radio_m"] * escala))
            if tau < on["duracion"]:
                est["ondas"].append(dict(pos=centro, radio=on["velocidad"] * tau, ancho=on["ancho_m"] + 0.06 * on["velocidad"] * tau,
                                         amplitud=on["amplitud_m"] * escala * (1 - tau / on["duracion"]) ** 2, luz=on["luz"]))
        return est


def _rayo(r, ini, fin, segmentos, zigzag, fino=0.0):
    """Polilínea quebrada entre dos puntos: paseo aleatorio anclado en los extremos más un temblor fino."""
    s = np.linspace(0, 1, segmentos + 1)[:, None]
    paseo = np.cumsum(r.normal(size=(segmentos + 1, 3)), axis=0) * 0.4
    paseo -= paseo[0] + s * (paseo[-1] - paseo[0])
    temblor = r.normal(size=(segmentos + 1, 3)) * np.sin(math.pi * s)
    return ini + (fin - ini) * s + (paseo * zigzag + temblor * fino) * np.linalg.norm(fin - ini)


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


def trazar(lienzo, x, y, sigma, color, ver):
    """Suma una polilínea de luz: por cada tramo, la distancia al segmento dentro de su caja."""
    h, w, _ = lienzo.shape
    for i in range(len(x) - 1):
        if not (ver[i] and ver[i + 1]):
            continue
        s = max(0.55, float(sigma[i] + sigma[i + 1]) / 2)
        ganancia = min(1.0, float(sigma[i] + sigma[i + 1]) / 2 / 0.55)  # más fina que un píxel: menos luz, no menos ancho
        rad = s * 3 + 1
        x0, x1 = int(max(0, min(x[i], x[i + 1]) - rad)), int(min(w, max(x[i], x[i + 1]) + rad + 1))
        y0, y1 = int(max(0, min(y[i], y[i + 1]) - rad)), int(min(h, max(y[i], y[i + 1]) + rad + 1))
        if x0 >= x1 or y0 >= y1 or (x1 - x0) * (y1 - y0) > 60000:
            continue
        gx, gy = np.arange(x0, x1) + 0.5 - x[i], (np.arange(y0, y1) + 0.5 - y[i])[:, None]
        ax, ay = x[i + 1] - x[i], y[i + 1] - y[i]
        u = np.clip((gx * ax + gy * ay) / max(1e-6, ax * ax + ay * ay), 0, 1)
        d2 = (gx - u * ax) ** 2 + (gy - u * ay) ** 2
        col = color[i] + (color[i + 1] - color[i]) * u[..., None]
        lienzo[y0:y1, x0:x1] += (np.exp(-d2 / (2 * s * s)) * ganancia)[..., None] * col


def componer(vista, escena, zesc, est, cfg, modo):
    """Un fotograma: lente de todos los agujeros con profundidad, entorno, horizontes y luz."""
    w, h, X, Y = vista.w, vista.h, vista.X, vista.Y
    completo = modo == "completo"
    cl, osc, hw = cfg["lente"], cfg["oscuridad"], cfg["hawking"]
    margen = 0.4
    sen_elev = abs(float(vista.mat[2, 2]))  # cuánto se aplasta un círculo del suelo en pantalla
    luz = np.zeros((h, w, 3), np.float32)

    def local(pos):
        cx, cy, zc = (float(v[0]) for v in vista.proyectar(np.asarray(pos, np.float64)))
        ppm = (h / 2) / (max(zc, 0.5) * vista.ty)  # píxeles por metro a esa profundidad
        dx, dy = (X - cx) / ppm, (Y - cy) / ppm
        r2 = dx * dx + dy * dy
        return dict(cx=cx, cy=cy, zc=zc, ppm=ppm, dx=dx, dy=dy, r2=r2, r=np.sqrt(r2),
                    visible=(zesc >= zc - margen).astype(np.float32))

    def detras(z, zc, largo):
        d = np.maximum(z - zc, 0.0)
        return d / (d + largo)

    hoyos = [dict(a, **local(a["pos"])) for a in est["agujeros"][:cl["max_lentes"]]]
    ondas = [dict(o, **local(o["pos"])) for o in est["ondas"]]

    # 1. Fondo deformado: suma de las lentes puntuales (β = θ − θE²/θ) y del pulso de la onda. La
    #    profundidad pondera cada lente: lo que está delante del agujero no se desvía.
    out = escena.copy()
    if completo and (hoyos or ondas):
        desx, desy = np.zeros((h, w), np.float32), np.zeros((h, w), np.float32)
        for H in hoyos:
            alcance = cl["alcance"][0] * H["lente"] + cl["alcance"][1]
            k = H["lente"] ** 2 / (H["r2"] + cl["suavizado"]) * (1 - escalon(0.55 * alcance, alcance, H["r"])) \
                * detras(zesc, H["zc"], cl["largo_profundidad"])
            H["k"] = k
            desx -= H["dx"] * k * H["ppm"]
            desy -= H["dy"] * k * H["ppm"]
        for O in ondas:
            # La onda es una esfera que crece: se mide con la distancia real al punto de fusión, así
            # recorre el suelo y los edificios en vez de ser un aro pegado a la pantalla.
            r3 = np.sqrt(O["r2"] + (np.minimum(zesc, 1e3) - O["zc"]) ** 2)
            pulso = O["amplitud"] * np.exp(-((r3 - O["radio"]) / O["ancho"]) ** 2)
            O["pulso"] = pulso
            rr = np.maximum(O["r"], 1e-3)
            desx -= O["dx"] / rr * pulso * O["ppm"]
            desy -= O["dy"] / rr * pulso * O["ppm"]
        x_max = max([H["x"] for H in hoyos], default=0.0)
        ab = cl["aberracion"] * (1 + 2 * x_max)
        lensado = np.stack([muestrear(escena[..., i], X + desx * f, Y + desy * f)
                            for i, f in enumerate((1 - ab, 1.0, 1 + ab))], axis=-1)
        # Lo que se trae de otro sitio no puede ser algo que estaba delante.
        zmin = min([H["zc"] for H in hoyos] + [O["zc"] for O in ondas])
        valido = muestrear(zesc, X + desx, Y + desy) >= zmin - margen
        out = np.where(valido[..., None], lensado, escena)

    # 2. Entorno según la masa: se apaga y pierde color alrededor; dentro del anillo de Einstein la
    #    imagen llega invertida y se atenúa para que se lea como pozo. Luz de los arcos en el suelo.
    for H in hoyos:
        radio_osc = osc["radio_m"][0] + (osc["radio_m"][1] - osc["radio_m"][0]) * H["x"]
        g = np.exp(-(H["r2"] + (np.minimum(zesc, 1e3) - H["zc"]) ** 2) / radio_osc ** 2)  # distancia real al agujero
        gris = out @ np.array((0.3, 0.55, 0.15), np.float32)
        out += (gris[..., None] - out) * (osc["desaturar"] * H["oscuridad"] / osc["maxima"] * g)[..., None]
        out *= ((1 - H["oscuridad"] * g) ** osc["contraste"])[..., None]  # en lineal, para que en pantalla sea negro de verdad
        if completo:
            pozo = (1 - escalon(0.45 * H["lente"], H["lente"], H["r"])) * H["visible"] \
                * detras(zesc, H["zc"], cl["largo_profundidad"])
            out *= (1 - osc["pozo"] * (0.4 + 0.6 * math.sqrt(H["x"])) * pozo)[..., None]
        gx, gy, gz = (float(v[0]) for v in vista.proyectar(np.array((H["pos"][0], H["pos"][1], 0.0))))
        ppg = (h / 2) / (max(gz, 0.5) * vista.ty)
        ra = max(0.8, H["alcance_arcos"]) * 1.3 * ppg
        charco = np.exp(-(((X - gx) / ra) ** 2 + ((Y - gy) / (ra * sen_elev)) ** 2))
        col = np.array(cfg["arcos"]["color"], np.float32)
        fuerza_luz = cfg["arcos"]["luz_suelo"] * (0.6 * H["brillo_arcos"] * (1 - 0.75 * H["x"]) + 0.5 * H["hawking"])
        out += escena * (charco * fuerza_luz)[..., None] * col  # cerca de la masa crítica ya casi no alumbra

    # 3. Horizontes: discos negros diminutos.
    for H in hoyos:
        H["radio"] = max(H["radio"], 1.4 / H["ppm"])  # nunca menos de píxel y medio: tiene que leerse como punto negro
        borde = max(0.7 / H["ppm"], H["radio"] * 0.15)
        out *= (1 - (1 - escalon(H["radio"] - borde, H["radio"] + 0.3 / H["ppm"], H["r"])) * H["visible"])[..., None]

    # 4. Luz. Brillo de Hawking: núcleo y halo, más fuerte cuanto menor es la masa.
    for H in hoyos:
        if H["hawking"] <= 1e-3:
            continue
        parpadeo = 1 + hw["parpadeo"] * math.sin(est["t"] * 53.0 + ord(H["id"])) * math.sin(est["t"] * 31.0)
        col = np.array(hw["color_pequeno"]) + (np.array(hw["color_grande"]) - np.array(hw["color_pequeno"])) * H["x"] ** 0.6
        nucleo = max(hw["nucleo_m"], 1.1 / H["ppm"]) + H["radio"]
        capa = H["hawking"] * parpadeo * (np.exp(-H["r2"] / (2 * nucleo ** 2)) + hw["halo"] * np.exp(-H["r"] / hw["halo_m"])
                                          + hw["raya"] * np.exp(-(H["dy"] / (nucleo * 0.4)) ** 2) * np.exp(-np.abs(H["dx"]) / (hw["halo_m"] * 2.0)))
        # La corona nace fuera del horizonte: el centro se queda negro aunque el agujero mida dos píxeles.
        fuera = escalon(H["radio"], H["radio"] + max(1.0 / H["ppm"], 0.6 * H["radio"]), H["r"])
        luz += (capa * fuera * H["visible"])[..., None] * col.astype(np.float32)

    # Líneas de luz (enemigos estirados y arcos): geometría mínima, una polilínea cada una.
    for L in est["lineas"]:
        px, py, pz = vista.proyectar(L["pts"])
        ver = pz > 0.2
        for H in hoyos:  # lo que pasa por detrás de un agujero se ve desplazado por su lente y lo tapa su horizonte
            qx, qy = (px - H["cx"]) / H["ppm"], (py - H["cy"]) / H["ppm"]
            beta = np.sqrt(qx * qx + qy * qy) + 1e-6
            det = pz > H["zc"]
            if completo and not L.get("arco"):
                le = H["lente"] * np.sqrt(detras(pz, H["zc"], 0.5))
                alcance = cl["alcance"][0] * H["lente"] + cl["alcance"][1]
                theta = beta + ((beta + np.sqrt(beta * beta + 4 * le * le)) / 2 - beta) * (1 - escalon(0.55 * alcance, alcance, beta))
                px, py = H["cx"] + qx / beta * theta * H["ppm"], H["cy"] + qy / beta * theta * H["ppm"]
                beta = theta
            ver &= ~(det & (beta < H["radio"]))
        xi, yi = np.clip(px.astype(int), 0, w - 1), np.clip(py.astype(int), 0, h - 1)
        ver &= zesc[yi, xi] > pz - 0.15
        ppm_p = (h / 2) / (np.maximum(pz, 0.5) * vista.ty)
        trazar(luz, px, py, L["ancho"] * ppm_p, L["color"].astype(np.float32), ver)
        if "suelo" in L and ver[-1]:  # chispa donde el arco toca el piso
            salpicar(luz, px[-1:], py[-1:], L["color"][-1:].astype(np.float32) * 0.8, np.array([0.07 * ppm_p[-1]]))

    # Destellos y luz del anillo de onda.
    for D in est["destellos"]:
        d = local(D["pos"])
        k = D["k"]
        radio = D["radio"] * (0.5 + 1.6 * (1 - k))
        capa = k ** 1.5 * D["brillo"] * (np.exp(-d["r2"] / radio ** 2) + 0.12 * np.exp(-d["r"] / (3.0 * D["radio"]))
                                         + 0.4 * np.exp(-(d["dy"] / (0.09 * D["radio"])) ** 2) * np.exp(-np.abs(d["dx"]) / (4.5 * D["radio"])))
        luz += capa[..., None] * np.array((0.85, 0.92, 1.0), np.float32)
    for O in ondas:
        if completo and O["luz"] > 0:
            luz += (O["pulso"] / max(1e-3, O["amplitud"]) * O["luz"] * min(1.0, O["amplitud"] * 3))[..., None] \
                * np.array((0.75, 0.85, 1.0), np.float32)
    out += luz

    # 5. Bloom barato: solo de la luz, a un cuarto de resolución.
    if completo:
        peq = luz[::4, ::4]
        halo = desenfoque(peq, 2) * 0.55 + desenfoque(peq, 7) * 0.45
        out += np.repeat(np.repeat(halo, 4, axis=0), 4, axis=1)[:h, :w] * cfg["lente"]["bloom"]
    return out


# ------------------------------------------------------------------ entrada


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="singularidad.py")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--demo", default="fusion", choices=("fusion", "masa"))
    ap.add_argument("--nombre")
    ap.add_argument("--config", default=CONFIG)
    ap.add_argument("--calidad", default="borrador", choices=sorted(CALIDADES))
    ap.add_argument("--modo", default="completo", choices=("completo", "simple"))
    ap.add_argument("--elevacion", type=float, default=38.0)
    ap.add_argument("--yaw", type=float, default=18.0)
    ap.add_argument("--distancia", type=float, default=17.0)
    ap.add_argument("--orbita", type=float, default=0.0, help="grados que gira la cámara durante la demo")
    ap.add_argument("--cuadros", help="lista de cuadros (desde 0); por defecto todos")
    ap.add_argument("--semilla", type=int, default=7)
    a = ap.parse_args(args)
    cfg = cargar_config(a.config)
    cal = CALIDADES[a.calidad]
    w, h = cal["ancho"], cal["alto"]
    nombre = a.nombre or f"singularidad_{a.demo}"
    salida = os.path.abspath(a.salida)
    os.makedirs(salida, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="singularidad_")
    guion = Guion(cfg, a.demo, a.semilla)
    n_total = int(round(guion.duracion * FPS))
    cuadros = [int(x) for x in a.cuadros.split(",")] if a.cuadros else list(range(n_total))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.max_bounces = 3
    sc.render.use_persistent_data = True  # el escenario se renderiza muchas veces: no reconstruirlo cada vez
    sc.view_settings.view_transform = "Standard"
    im = sc.render.image_settings
    im.file_format = "OPEN_EXR"
    im.color_mode = "RGBA"
    im.color_depth = "32"
    im.exr_codec = "ZIP"
    _, enemigos = escenario(len(guion.enemigos))
    co = camara(cal, a.elevacion, a.yaw, a.distancia)
    prof = material_profundidad()
    capa = bpy.context.view_layer

    def render(ruta, profundidad):
        capa.material_override = prof if profundidad else None
        sc.render.film_transparent = profundidad
        sc.cycles.samples = 1 if profundidad else cal["muestras"]
        sc.cycles.use_denoising = not profundidad
        sc.cycles.pixel_filter_type = "BOX" if profundidad else "BLACKMAN_HARRIS"
        sc.cycles.filter_width = 0.01 if profundidad else 1.5
        sc.render.filepath = ruta
        bpy.ops.render.render(write_still=True)
        return leer_exr(ruta)

    t_ini = time.time()
    firma = escena = zesc = vista = None
    salidas, renders = {}, 0
    for i, c in enumerate(cuadros):
        t = c / FPS
        est = guion.estado(t, a.modo == "simple")
        yaw = a.yaw + a.orbita * (t / guion.duracion - 0.5)
        nueva = (round(yaw, 4), tuple(None if p is None else (round(p[0], 3), round(p[1], 3)) for p in est["enemigos"]))
        if nueva != firma:  # el escenario solo se vuelve a renderizar si cambió la cámara o algún enemigo
            firma = nueva
            orientar(co, a.elevacion, yaw, a.distancia)
            for (cuerpo, torre), p in zip(enemigos, est["enemigos"]):
                cuerpo.hide_render = torre.hide_render = p is None
                if p is not None:
                    cuerpo.location = (p[0], p[1], 0.275)
                    torre.location = (p[0], p[1], 0.7)
            capa.update()
            escena = render(os.path.join(tmp, "escena.exr"), False)[..., :3]
            z = render(os.path.join(tmp, "z.exr"), True)
            zesc = np.where(z[..., 3] > 0.5, z[..., 0], 1e6).astype(np.float32)
            vista = Vista(co, w, h)
            renders += 1
        img = componer(vista, escena, zesc, est, cfg, a.modo)
        salidas[c] = a_bytes(a_srgb(tono(img, 1.0, 0.8)))
        escribir_png(os.path.join(tmp, f"f{i:04d}.png"), salidas[c], nivel=3)
        if i % 24 == 0:
            print(f"[singularidad] cuadro {c}/{n_total} t={t:.2f} masas " + " ".join(f"{g['id']}={g['masa']:.2f}" for g in est["agujeros"]))
    seg = time.time() - t_ini

    sufijo = "" if a.modo == "completo" else "_simple"
    if not a.cuadros:
        video(os.path.join(tmp, "f%04d.png"), FPS, os.path.join(salida, f"{nombre}{sufijo}.mp4"))
        if guion.fu:
            fu, t1 = guion.fu, guion.absorciones[0]["t"] if guion.absorciones else 1.0
            tiempos = [t1 - 0.3, t1 + 0.1, t1 + 0.7, fu["t_d"] + 1.2, fu["t_r"] + 0.15, fu["t_o"] + 0.3, fu["t_o"] + 1.6,
                       fu["t_f"] - 0.25, fu["t_f"] + 0.03, fu["t_f"] + 0.16, fu["t_f"] + 0.45, fu["t_f"] + 1.6]
        else:
            tiempos = [guion.duracion * (k + 0.5) / 8 for k in range(8)]
        elegidos = [salidas[min(n_total - 1, max(0, int(round(t * FPS))))][::2, ::2] for t in tiempos]
        escribir_jpg(os.path.join(salida, f"{nombre}{sufijo}_hoja.jpg"), hoja(elegidos, 4))
        masas = [1, 2, 3, 4, 6, 8, cfg["masa"]["critica"]]
        tabla = {str(m): dict({k: round(v, 3) for k, v in apariencia(cfg, m).items()},
                              radio_absorcion=round(curva(cfg["curvas"]["radio_absorcion"], m), 3),
                              letalidad=round(letalidad(cfg, m), 4)) for m in masas}
        json.dump(dict(demo=a.demo, fps=FPS, cuadros=n_total, resolucion=[w, h], calidad=a.calidad, modo=a.modo,
                       eventos=guion.eventos, por_masa=tabla,
                       tiempos_fusion={k: round(v, 3) for k, v in guion.fu.items() if k.startswith("t_")} if guion.fu else None,
                       segundos=dict(total=round(seg, 1), por_cuadro=round(seg / len(cuadros), 2), renders_escenario=renders),
                       config=cfg, blender=bpy.app.version_string),
                  open(os.path.join(salida, f"{nombre}{sufijo}.json"), "w"), indent=1, ensure_ascii=False)
    else:
        escribir_jpg(os.path.join(salida, f"{nombre}{sufijo}_prueba.jpg"),
                     hoja([salidas[c] for c in cuadros], min(3, len(cuadros))))
    for f_ in os.listdir(tmp):
        os.remove(os.path.join(tmp, f_))
    os.rmdir(tmp)
    print("[singularidad] eventos:", " | ".join(f"{e['t']:.2f} {e['evento']}" for e in guion.eventos))
    print(f"[singularidad] {len(cuadros)} cuadros en {seg:.1f} s ({seg / len(cuadros):.2f} s por cuadro, {renders} renders del escenario)")


if __name__ == "__main__":
    main()
