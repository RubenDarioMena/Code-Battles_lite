"""Rayo láser de Code Battle Lite / Codemageddon: prototipo del haz con «textura».

No es una línea uniforme. El haz es una cinta entre el arma y el punto de impacto, y todo lo que se
ve sale de las coordenadas de esa cinta (s = metros desde el origen, x = metros a un lado) y del
tiempo, sin estado:

- la línea central serpentea con ondas que viajan hacia el blanco, y el grosor late con pulsos;
- núcleo casi blanco, vaina naranja con ruido que fluye, halo rojo y jirones que se desprenden;
- hebras de plasma trenzadas alrededor del núcleo y nudos brillantes que lo recorren;
- chispas a lo largo del haz y en el impacto, destello con raya de lente en la boca del arma;
- cicatriz incandescente donde barre, luz roja sobre el escenario y refracción de calor;
- fases: carga, disparo (el frente avanza), sostenido y corte (la cola se va del arma).

Como en singularidad.py, Blender solo pone el escenario de prueba (color y profundidad). Lo demás es
un pase de numpy que hace lo que hará el motor. Todos los números están en rayo_config.json.

Sin ventana:
    blender -b --factory-startup --python arte/blender/vfx/rayo.py -- --salida <carpeta>
        [--calidad borrador|final] [--modo completo|simple] [--vista general|cerca]
        [--config ruta.json] [--cuadros 10,40,80] [--nombre rayo]

Convenciones:
- 1 m = 1 casilla; el suelo es z = 0.
- El efecto no decide nada del juego: recibe origen, punto de impacto, tipo de superficie y los
  instantes de carga, disparo y corte. Quién recibe daño lo decide el juego (aquí, el guion de la demo).
- `--modo simple` es la ruta degradada: sin refracción, bloom ni jirones, y con menos hebras y chispas.
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
from comun import a_bytes, a_srgb, escribir_jpg, escribir_png, hoja, leer_exr, tono, video  # noqa: E402
from singularidad import (FPS, Vista, _caja, _material, camara, cargar_config, desenfoque, escalon,  # noqa: E402
                          escenario, material_profundidad, muestrear, suave, trazar)

CONFIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rayo_config.json")
ALTURA_ENEMIGO = 0.4
PASO = 1 / 120  # resolución del guion de la demo

CALIDADES = {
    "borrador": dict(ancho=512, alto=288, muestras=16),
    "final": dict(ancho=960, alto=540, muestras=16),
}


# ------------------------------------------------------------------ azar y ruido sin estado


def azar(a, b=0, c=0):
    """Hash entero → [0, 1). Acepta escalares o arreglos; el mismo (a, b, c) da siempre lo mismo."""
    h = (np.asarray(a, np.int64) % 1000003 * 374761393 + np.asarray(b, np.int64) % 1000003 * 668265263
         + np.asarray(c, np.int64) % 1000003 * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = ((h ^ (h >> 16)) * 668265263) & 0xFFFFFFFF
    return ((h ^ (h >> 15)) & 0xFFFFFF) / float(1 << 24)


def ruido2(x, y, semilla=0):
    """Ruido de valor en [0, 1]. En el motor sería una textura de ruido que se repite."""
    x0, y0 = np.floor(x), np.floor(y)
    fx, fy = x - x0, y - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    x0, y0 = x0.astype(np.int64), y0.astype(np.int64)
    a, b = azar(x0, y0, semilla), azar(x0 + 1, y0, semilla)
    c, d = azar(x0, y0 + 1, semilla), azar(x0 + 1, y0 + 1, semilla)
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy


def ruido1(x, semilla=0):
    x = np.asarray(x, np.float64)
    x0 = np.floor(x)
    f = x - x0
    f = f * f * (3 - 2 * f)
    x0 = x0.astype(np.int64)
    a, b = azar(x0, 0, semilla), azar(x0 + 1, 0, semilla)
    return a + (b - a) * f


def fbm(x, y, semilla=0, octavas=3):
    total, amp, norma = 0.0, 1.0, 0.0
    for i in range(octavas):
        total = total + amp * ruido2(x * 2 ** i, y * 2 ** i, semilla + i)
        norma += amp
        amp *= 0.5
    return total / norma


def base_perpendicular(u):
    """Dos vectores unitarios perpendiculares a u."""
    ref = np.array((0.0, 0.0, 1.0)) if abs(u[2]) < 0.9 else np.array((1.0, 0.0, 0.0))
    e1 = np.cross(u, ref)
    e1 /= np.linalg.norm(e1)
    return e1, np.cross(u, e1)


# ------------------------------------------------------------------ guion de la demo


class Guion:
    """Lo que el juego le contaría al efecto: de dónde sale, dónde pega, en qué y cuándo empieza y acaba.

    El recorrido se tabula una vez a 120 Hz para decidir qué enemigo se interpone y cuándo cae; después
    todo se consulta por tiempo, en cualquier orden.
    """

    def __init__(self, cfg):
        self.cfg, d, f = cfg, cfg["demo"], cfg["fases"]
        self.duracion = d["duracion"]
        self.origen = np.array(d["origen"], np.float64)
        self.t_carga, self.t_disparo, self.t_corte = d["t_carga"], d["t_carga"] + f["carga"], d["t_corte"]
        self.vel = f["velocidad_frente"]
        self.mira_t = np.array([m[0] for m in d["mira"]])
        self.mira_p = np.array([m[1:] for m in d["mira"]], np.float64)
        self.enemigos = [dict(pos=np.array((x, y, ALTURA_ENEMIGO)), t_fin=math.inf, dano=0.0) for x, y in d["enemigos"]]
        self.eventos = []
        self._evento(self.t_carga, "carga")
        self._evento(self.t_disparo, "disparo")
        # Tabla del punto de impacto y cicatriz: tramos de puntos seguidos sobre suelo o muro.
        self.tabla, self.cicatriz, tramo, primero = [], [], None, True
        n = int(round(self.duracion / PASO)) + 1
        for i in range(n):
            t = i * PASO
            tc = min(t, self.t_corte)  # tras el corte el haz que queda sigue apuntando a donde apuntaba
            fin, sup, quien = self._fin(tc)
            largo = float(np.linalg.norm(fin - self.origen))
            self.tabla.append((fin, sup, largo))
            llega = self.t_disparo <= t and (t - self.t_disparo) * self.vel >= largo \
                and (t - self.t_corte) * self.vel < largo
            if llega and primero:
                self._evento(t, "impacto", superficie=sup)
                primero = False
            if llega and quien is not None:
                e = self.enemigos[quien]
                e["dano"] += PASO
                if e["dano"] >= d["aguante"]:
                    e["t_fin"] = t
                    self._evento(t, "objetivo_destruido", enemigo=quien)
            if llega and sup != "enemigo":
                if tramo is None or np.linalg.norm(fin - tramo["pts"][-1]) > 0.6 or sup != tramo["sup"]:
                    tramo = dict(pts=[], t=[], sup=sup)
                    self.cicatriz.append(tramo)
                if tramo["pts"] and np.linalg.norm(fin - tramo["pts"][-1]) < 0.05:
                    continue  # parado en el mismo sitio: no se acumulan puntos
                tramo["pts"].append(fin + (np.array((0, 0, 0.02)) if sup == "suelo" else np.array((0, -0.02, 0))))
                tramo["t"].append(t)
            else:
                tramo = None
        for c in self.cicatriz:
            c["pts"], c["t"] = np.array(c["pts"]), np.array(c["t"])
        self.cicatriz = [c for c in self.cicatriz if len(c["t"]) > 1]
        self._evento(self.t_corte, "corte")
        self.t_apagado = self.t_corte + self.tabla[int(round(self.t_corte / PASO))][2] / self.vel
        self._evento(self.t_apagado, "apagado")
        self.eventos.sort(key=lambda e: e["t"])

    def _evento(self, t, nombre, **datos):
        self.eventos.append(dict(t=round(t, 3), evento=nombre, **datos))

    def _mira(self, t):
        i = int(np.clip(np.searchsorted(self.mira_t, t, side="right") - 1, 0, len(self.mira_t) - 2))
        u = suave((t - self.mira_t[i]) / (self.mira_t[i + 1] - self.mira_t[i]))
        return self.mira_p[i] + (self.mira_p[i + 1] - self.mira_p[i]) * u

    def _fin(self, t):
        """Punto de impacto: la mira, o el primer enemigo vivo que se cruce (lo que haría el raycast del juego)."""
        m = self._mira(t)
        largo = np.linalg.norm(m - self.origen)
        u = (m - self.origen) / largo
        mejor = (m, "muro" if m[2] > 0.02 else "suelo", None)
        radio = self.cfg["demo"]["radio_enemigo"]
        for i, e in enumerate(self.enemigos):
            if e["t_fin"] <= t:
                continue
            s = float((e["pos"] - self.origen) @ u)
            d = float(np.linalg.norm(e["pos"] - self.origen - s * u))
            s -= math.sqrt(max(0.0, radio * radio - d * d))
            if d < radio and 0 < s < largo:
                largo, mejor = s, (self.origen + u * s, "enemigo", i)
        return mejor

    def haz_en(self, t):
        """Segmento visible en t: (origen, fin, superficie, largo, cola, frente). Vacío si cola >= frente."""
        fin, sup, largo = self.tabla[int(np.clip(round(t / PASO), 0, len(self.tabla) - 1))]
        frente = min(largo, max(0.0, (t - self.t_disparo) * self.vel))
        cola = max(0.0, (t - self.t_corte) * self.vel)
        return self.origen, fin, sup, largo, cola, frente

    def potencia(self, t):
        f = self.cfg["fases"]
        if t < self.t_disparo:
            return 0.0
        tau = t - self.t_disparo
        return 1 + f["arranque"][0] * math.exp(-tau / f["arranque"][1]) \
            + f["respiracion"][0] * math.sin(math.tau * f["respiracion"][1] * tau)

    def estado(self, t):
        a, b, sup, largo, cola, frente = self.haz_en(t)
        carga = 0.0
        if self.t_carga <= t < self.t_disparo:
            carga = (t - self.t_carga) / (self.t_disparo - self.t_carga)
        return dict(t=t, origen=a, fin=b, superficie=sup, largo=largo, cola=cola, frente=frente,
                    potencia=self.potencia(t), carga=carga,
                    emite=self.t_disparo <= t < self.t_corte,          # el arma sigue disparando
                    impacta=cola < largo <= frente + 1e-6,             # el haz está tocando el blanco
                    enemigos=[None if e["t_fin"] <= t else e["pos"] for e in self.enemigos],
                    caidos=[(e["pos"], t - e["t_fin"]) for e in self.enemigos if 0 <= t - e["t_fin"] < 0.45])


# ------------------------------------------------------------------ el haz (lo que sería el fragment shader de la cinta)


def haz(cfg, s, x, ppm, t, potencia, simple):
    """Emisión RGB en coordenadas del haz. s y x en metros; ppm = píxeles por metro (para no afinar más que un píxel)."""
    hz, on, fi, tu, nu = cfg["haz"], cfg["onda"], cfg["filamentos"], cfg["turbulencia"], cfg["nudos"]
    # Serpenteo: la línea central se aparta con ondas que viajan; pegada al arma, libre después.
    centro = 0.0
    for i, o in enumerate(on["serpenteo"]):
        centro = centro + o["amplitud"] * np.sin(math.tau * (s - o["velocidad"] * t) / o["longitud"] + 1.7 * i)
    o = on["serpenteo_irregular"]
    centro = centro + o["amplitud"] * 2 * (ruido1((s - o["velocidad"] * t) / o["longitud"], 11) - 0.5)
    x = x - centro * (1 - np.exp(-s / on["anclaje"]))
    # Grosor: pulsos regulares, ruido y los nudos de plasma que recorren el haz.
    g = 1.0
    for i, o in enumerate(on["grosor"]):
        g = g + o["amplitud"] * np.sin(math.tau * (s - o["velocidad"] * t) / o["longitud"] + 2.3 * i)
    o = on["grosor_irregular"]
    g = g + o["amplitud"] * 2 * (ruido1((s - o["velocidad"] * t) / o["longitud"], 23) - 0.5)
    q = (s - nu["velocidad"] * t) / nu["separacion"]
    celda = np.floor(q)
    nudo = np.exp(-((q - celda - 0.2 - 0.6 * azar(celda.astype(np.int64), 0, 31)) * nu["separacion"] / nu["largo"]) ** 2)
    g = np.maximum(g, 0.3) * (1 + nu["grosor"] * nudo) * math.sqrt(potencia)
    fino = 0.7 / ppm
    rn, rv, rh = np.maximum(hz["radio_nucleo"] * g, fino), hz["radio_vaina"] * g, hz["radio_halo"] * (0.6 + 0.4 * g)
    # Ruido que fluye hacia el blanco: textura de la vaina y lenguas del borde.
    flujo, lado = (s - tu["velocidad"] * t) * tu["escala"][0], x / hz["radio_vaina"] * tu["escala"][1]
    turb = fbm(flujo, lado + 3.1, 50)
    textura = np.maximum(0.0, 1 - tu["contraste"] + tu["contraste"] * 2 * turb)
    nucleo = np.exp(-x * x / (2 * rn * rn)) * (1 + nu["brillo"] * nudo)
    vaina = np.exp(-x * x / (2 * rv * rv)) * textura
    halo = np.exp(-np.abs(x) / rh) * (0.55 + 0.9 * ruido2(flujo * 0.35, lado * 0.3 + 8.0, 60))
    if not simple:
        borde = np.exp(-((np.abs(x) - 1.5 * rv) / (0.5 * tu["radio_jirones"] * rv)) ** 2)
        lenguas = escalon(0.5, 0.72, fbm((s - 0.6 * tu["velocidad"] * t) * tu["escala"][0] * 1.7, lado * 1.6 + 9.0, 70))
        vaina = vaina + tu["jirones"] * borde * lenguas
    # Hebras trenzadas: hélices alrededor del núcleo, vistas de lado. Más brillantes al pasar por delante.
    hebras = 0.0
    ancho = np.maximum(fi["ancho"] * math.sqrt(potencia), 0.6 / ppm)
    for i in range(fi["cantidad"] // (2 if simple else 1)):
        paso = fi["paso"][0] + (fi["paso"][1] - fi["paso"][0]) * azar(i, 1, 80)
        giro = (fi["giro"][0] + (fi["giro"][1] - fi["giro"][0]) * azar(i, 2, 80)) * (1 if i % 2 else -1)
        radio = fi["radio"][0] + (fi["radio"][1] - fi["radio"][0]) * azar(i, 3, 80)
        ang = math.tau * (s / paso - giro * t + azar(i, 4, 80))
        xi = radio * rv * np.sin(ang)
        vivo = escalon(fi["corte"] - 0.12, fi["corte"] + 0.12, ruido1((s - tu["velocidad"] * t) * 0.8 + 17.3 * i, 90 + i)) \
            if fi["corte"] > 0 else 1.0
        hebras = hebras + np.exp(-(x - xi) ** 2 / (2 * ancho * ancho)) * (0.5 + 0.5 * np.cos(ang)) * vivo
    rgb = (nucleo[:, None] * np.array(hz["color_nucleo"]) + vaina[:, None] * np.array(hz["color_vaina"])
           + halo[:, None] * np.array(hz["color_halo"]) + (hebras * fi["brillo"])[:, None] * np.array(fi["color"]))
    return rgb * (hz["brillo"] * potencia), halo


def chispas(cfg, guion, est, simple):
    """Tramos de luz (dos puntos cada uno) de las chispas vivas en t. Cada chispa renace en bucle con otra semilla."""
    ch, t, salida = cfg["chispas"], est["t"], []

    def lote(c, clave, impacto):
        n = c["cantidad"] // (2 if simple else 1)
        i = np.arange(n)
        vida = c["vida"][0] + (c["vida"][1] - c["vida"][0]) * azar(i, 1, clave)
        reloj = t + vida * azar(i, 2, clave)
        nac = np.floor(reloj / vida).astype(np.int64)
        edad = reloj - nac * vida
        for k in range(n):
            a, b, sup, largo, cola, frente = guion.haz_en(t - edad[k])
            if frente - cola < 0.05 or (impacto and not (cola < largo <= frente + 1e-6)):
                continue
            u = (b - a) / largo
            e1, e2 = base_perpendicular(u)
            r1, r2, r3, r4 = (float(azar(k, nac[k], clave + j)) for j in (3, 4, 5, 6))
            rapidez = c["velocidad"][0] + (c["velocidad"][1] - c["velocidad"][0]) * r3 * r3
            if impacto:
                normal = {"suelo": np.array((0.0, 0.0, 1.0)), "muro": np.array((0.0, -1.0, 0.0))}.get(sup, -u * 0.7 + np.array((0, 0, 0.7)))
                normal = normal / np.linalg.norm(normal)
                n1, n2 = base_perpendicular(normal)
                cono, giro = math.radians(c["apertura_grados"]) * math.sqrt(r1), math.tau * r2
                direccion = normal * math.cos(cono) + (n1 * math.cos(giro) + n2 * math.sin(giro)) * math.sin(cono)
                p0, v = b + normal * 0.03, direccion * rapidez
            else:
                giro = math.tau * r2
                radial = e1 * math.cos(giro) + e2 * math.sin(giro)
                p0 = a + u * (cola + (frente - cola) * r1) + radial * cfg["haz"]["radio_vaina"] * 0.8
                v = radial * rapidez + u * c["arrastre_haz"] * r4
            pts = []
            for tau in (edad[k], max(0.0, edad[k] - c["estela"])):
                p = p0 + v * (1 - math.exp(-c["frenado"] * tau)) / c["frenado"] + np.array((0, 0, 0.5 * c["gravedad"] * tau * tau))
                p[2] = max(p[2], 0.02)
                pts.append(p)
            brillo = (1 - edad[k] / vida[k]) ** 1.5 * (0.5 + r4)
            salida.append((np.array(pts), c["ancho"], np.array(c["color"]) * brillo))

    lote(ch["haz"], 100, False)
    lote(ch["impacto"], 200, True)
    if est["carga"] > 0:  # la carga: motas que caen en espiral hacia la boca del arma
        c = ch["carga"]
        for k in range(c["cantidad"]):
            periodo = 0.22 + 0.2 * float(azar(k, 1, 300))
            fase, nac = math.modf(t / periodo + float(azar(k, 2, 300)))
            az, el = math.tau * float(azar(k, nac, 303)), math.pi * (float(azar(k, nac, 304)) - 0.5)
            pts = []
            for q in (fase, max(0.0, fase - 0.12)):
                r, giro = c["radio"] * (1 - q) ** 1.6, az + 2.5 * q
                pts.append(est["origen"] + r * np.array((math.cos(el) * math.cos(giro), math.cos(el) * math.sin(giro), math.sin(el))))
            salida.append((np.array(pts), c["ancho"], np.array(c["color"]) * est["carga"] * (0.3 + 0.7 * fase)))
    return salida


# ------------------------------------------------------------------ pase de pantalla


def componer(vista, escena, zesc, est, guion, cfg, modo):
    w, h, X, Y = vista.w, vista.h, vista.X, vista.Y
    completo, t, pot = modo == "completo", est["t"], est["potencia"]
    hz, lz, ca, im, org = cfg["haz"], cfg["luz"], cfg["calor"], cfg["impacto"], cfg["origen"]
    luz = np.zeros((h, w, 3), np.float32)
    # Penumbra: el escenario baja de exposición mientras el arma carga y dispara.
    penumbra = lz["penumbra"] * (min(1.0, pot) if est["emite"] else 0.6 * est["carga"] ** 2)
    if t >= guion.t_corte:  # vuelve la luz poco a poco, no de golpe
        penumbra = lz["penumbra"] * math.exp(-(t - guion.t_corte) / 0.25)
    escena = escena * (1 - penumbra)
    out = escena.copy()
    o = vista.mat[:3, 3]
    dirs = np.stack([(X / w * 2 - 1) * vista.tx, (1 - Y / h * 2) * vista.ty, -np.ones_like(X)], axis=-1) @ vista.mat[:3, :3].T
    zfin = np.minimum(zesc, 1e3)

    def sprite(pos, radio, halo, raya, color, hervor=0.0, semilla=0):
        """Destello: núcleo, halo y raya horizontal de lente. `hervor` lo deforma con ruido en ángulo y tiempo."""
        cx, cy, zc = (float(v[0]) for v in vista.proyectar(np.asarray(pos, np.float64)))
        if zc < 0.3:
            return
        ppm = (h / 2) / (zc * vista.ty)
        dx, dy = (X - cx) / ppm, (Y - cy) / ppm
        r = np.sqrt(dx * dx + dy * dy)
        forma = 1.0
        if hervor > 0:
            forma = 1 + hervor * 2 * (ruido2(np.arctan2(dy, dx) * 2.2 + 20, np.full_like(dx, t * 22.0), semilla) - 0.5)
        radio = radio * forma
        capa = np.exp(-r * r / (2 * radio * radio)) + 0.16 * np.exp(-r / halo) \
            + 0.5 * np.exp(-(dy / (0.22 * radio)) ** 2) * np.exp(-np.abs(dx) / raya)
        luz[...] += (capa * escalon(zc - 1.6, zc - 0.3, zesc))[..., None] * np.asarray(color, np.float32)

    activo = est["frente"] - est["cola"] > 1e-3
    rescoldo = t > guion.t_corte and t < guion.t_apagado + 4 * cfg["fases"]["rescoldo"]
    a, b, largo = est["origen"], est["fin"], est["largo"]
    u = (b - a) / largo

    if activo or rescoldo:
        # Coordenadas de la cinta por píxel: el punto del haz más cercano al rayo de la cámara.
        s_min, s_max = (est["cola"], est["frente"]) if activo else (0.0, largo)
        w0 = a - o
        bb, cc, dd, ee = dirs @ u, np.sum(dirs * dirs, axis=-1), float(u @ w0), dirs @ w0
        s_libre = (bb * ee - cc * dd) / np.maximum(cc - bb * bb, 1e-9)
        normal = np.cross(u, dirs)
        normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-9)

        def cinta(s0, s1):
            s = np.clip(s_libre, s0, s1)
            p = a + s[..., None] * u
            tray = np.sum((p - o) * dirs, axis=-1) / cc  # profundidad del punto del haz
            dif = o + tray[..., None] * dirs - p
            r = np.linalg.norm(dif, axis=-1)
            # Más allá de los extremos la cinta se acaba: `punta` la funde en vez de repetir el corte en anillos.
            punta = np.exp(-((s_libre - s) / 0.12) ** 2)
            return s, np.sum(dif * normal, axis=-1), r, tray, punta

    if activo:
        s, x, r, tray, punta = cinta(s_min, s_max)
        ppm = (h / 2) / (np.maximum(tray, 0.5) * vista.ty)
        delante = escalon(-0.35, -0.05, zfin - tray)  # 1 donde el escenario queda detrás del haz

        # 1. Refracción de calor: el fondo tiembla alrededor del haz.
        if completo:
            peso = np.exp(-r / ca["radio"]) * delante * min(1.0, pot) * ca["amplitud"] * ppm * escalon(0.0, 0.6, s)
            n1 = fbm(s * ca["escala"] - t * ca["velocidad"], x * ca["escala"] * 2, 5) - 0.5
            n2 = fbm(s * ca["escala"] + t * ca["velocidad"] * 0.7, x * ca["escala"] * 2 + 13.0, 6) - 0.5
            out = muestrear(escena, X + 2 * n1 * peso, Y + 2 * n2 * peso)

    # 2. Cicatriz: quemadura oscura que queda y metal al rojo que se enfría.
    ci = im["cicatriz"]
    quemado = np.zeros((h, w, 3), np.float32)
    for c in guion.cicatriz:
        hasta = int(np.searchsorted(c["t"], t, side="right"))
        if hasta < 2:
            continue
        px, py, pz = vista.proyectar(c["pts"][:hasta])
        edad = t - c["t"][:hasta]
        xi, yi = np.clip(px.astype(int), 0, w - 1), np.clip(py.astype(int), 0, h - 1)
        ver = (pz > 0.2) & (zesc[yi, xi] > pz - 0.2)
        ppm_p = (h / 2) / (np.maximum(pz, 0.5) * vista.ty)
        vivo = np.exp(-edad / ci["enfriado"])
        temblor = 0.7 + 0.6 * ruido1(np.arange(hasta) * 0.35, 7)
        color = (vivo * temblor * ci["brillo"])[:, None] * (np.array(ci["color"]) * (0.25 + 0.75 * vivo[:, None] ** np.array((0.3, 1.0, 2.0))))
        trazar(luz, px, py, ci["ancho"] * ppm_p * (0.6 + 0.4 * vivo), color.astype(np.float32), ver)
        trazar(quemado, px, py, ci["ancho_quemadura"] * ppm_p * (0.55 + 0.9 * ruido1(np.arange(hasta) * 0.45, 8)), np.ones((hasta, 3), np.float32) * np.minimum(1, edad / 0.08)[:, None], ver)
    out *= 1 - ci["quemadura"] * np.clip(quemado, 0, 1)

    # 3. Luz sobre el escenario: por distancia real de cada píxel al segmento del haz y al impacto.
    if activo:
        pw = o + dirs * zfin[..., None]
        sp = np.clip((pw - a) @ u, est["cola"], est["frente"])
        d2 = np.sum((pw - a - sp[..., None] * u) ** 2, axis=-1)
        ilum = lz["fuerza"] * pot / (1 + d2 / lz["alcance"] ** 2)
        if est["impacta"]:
            parpadeo = 1 + im["parpadeo"] * 2 * (float(ruido1(t * 31.0, 3)) - 0.5)
            ilum += lz["impacto"] * pot * parpadeo / (1 + np.sum((pw - b) ** 2, axis=-1) / lz["alcance_impacto"] ** 2) ** 1.5
        out += escena * (ilum * (zesc < 1e5))[..., None] * np.array(lz["color"], np.float32)

        # 4. El haz. Solo se evalúa cerca de la cinta.
        zona = r < 4.5 * hz["radio_halo"]
        peso = delante * punta
        if est["cola"] > 0:  # la cola se afila al irse
            peso = peso * escalon(est["cola"], est["cola"] + 1.2, s)
        rgb, _ = haz(cfg, s[zona], x[zona], ppm[zona], t, pot, not completo)
        luz[zona] += (rgb * peso[zona][:, None]).astype(np.float32)
        if est["frente"] < largo - 1e-3:  # cabeza del frente mientras avanza
            sprite(a + u * est["frente"], im["radio"] * 0.8, im["halo"] * 0.6, im["raya"], np.array(im["color"]) * im["brillo"] * 0.8)

    # Rescoldo: donde ya pasó la cola queda un humo rojo que se apaga.
    if rescoldo:
        s, x, r, tray, punta = cinta(0.0, min(largo, (t - guion.t_corte) * guion.vel))
        zona = r < 3 * hz["radio_halo"]
        edad = (t - guion.t_corte) - s[zona] / guion.vel
        ppm_z = (h / 2) / (np.maximum(tray[zona], 0.5) * vista.ty)
        _, halo = haz(cfg, s[zona], x[zona], ppm_z, guion.t_corte + 0.15 * (t - guion.t_corte), 1.0, True)
        resto = halo * np.exp(-edad / cfg["fases"]["rescoldo"]) * (edad > 0) * escalon(-0.35, -0.05, (zfin - tray)[zona]) * punta[zona] * 1.4
        luz[zona] += (resto[:, None] * np.array(hz["color_halo"]) * np.array((1.6, 3.0, 2.0))).astype(np.float32)

    # 5. Destellos: boca del arma (carga y disparo), impacto que hierve y enemigos que caen.
    parp = 1 + org["parpadeo"] * 2 * (float(ruido1(t * 43.0, 1)) - 0.5)
    if est["carga"] > 0:
        k = est["carga"] ** 2
        sprite(a, org["radio"] * (0.3 + 0.7 * k), org["halo"] * k + 0.05, org["raya"] * k + 0.05,
               np.array(org["color"]) * org["brillo_carga"] * k * parp, 0.25, 1)
    if est["emite"]:
        sprite(a, org["radio"] * math.sqrt(pot), org["halo"], org["raya"], np.array(org["color"]) * org["brillo"] * pot * parp, 0.3, 1)
    if est["impacta"]:
        parp = 1 + im["parpadeo"] * 2 * (float(ruido1(t * 37.0, 2)) - 0.5)
        sprite(b, im["radio"] * math.sqrt(pot) * parp, im["halo"], im["raya"], np.array(im["color"]) * im["brillo"] * pot * parp, 0.5, 2)
    for pos, edad in est["caidos"]:  # la explosión es otro efecto: aquí solo un fogonazo que marca el evento
        k = math.exp(-edad / 0.12)
        sprite(pos, 0.35 + 0.7 * (1 - k), 1.2, 2.4, np.array((2.6, 1.2, 0.35)) * 1.1 * k, 0.4, 4)

    # 6. Chispas.
    for pts, ancho, color in chispas(cfg, guion, est, not completo):
        px, py, pz = vista.proyectar(pts)
        xi, yi = np.clip(px.astype(int), 0, w - 1), np.clip(py.astype(int), 0, h - 1)
        ver = (pz > 0.2) & (zesc[yi, xi] > pz - 0.15)
        ppm_p = (h / 2) / (np.maximum(pz, 0.5) * vista.ty)
        trazar(luz, px, py, ancho * ppm_p, np.tile(color.astype(np.float32), (2, 1)), ver)

    out += luz
    if est["emite"]:  # neblina: mientras dispara, toda la imagen se tiñe un poco
        out += np.array(lz["color"], np.float32) * (lz["neblina"] * pot)
    # 7. Bloom barato: solo de la luz, a un cuarto de resolución.
    if completo:
        peq = luz[::4, ::4]
        velo = desenfoque(peq, 2) * 0.5 + desenfoque(peq, 8) * 0.5
        out += np.repeat(np.repeat(velo, 4, axis=0), 4, axis=1)[:h, :w] * cfg["post"]["bloom"]
    return out


# ------------------------------------------------------------------ entrada


def orientar(co, elevacion, yaw, dist, objetivo):
    el, az = math.radians(elevacion), math.radians(yaw)
    objetivo = Vector(objetivo)
    co.location = objetivo + dist * Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el)))
    co.rotation_euler = (objetivo - co.location).to_track_quat("-Z", "Y").to_euler()


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="rayo.py")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--nombre", default="rayo")
    ap.add_argument("--config", default=CONFIG)
    ap.add_argument("--calidad", default="borrador", choices=sorted(CALIDADES))
    ap.add_argument("--modo", default="completo", choices=("completo", "simple"))
    ap.add_argument("--vista", default="general", choices=("general", "cerca"))
    ap.add_argument("--cuadros", help="lista de cuadros (desde 0); por defecto todos")
    a = ap.parse_args(args)
    cfg = cargar_config(a.config)
    cal = CALIDADES[a.calidad]
    w, h = cal["ancho"], cal["alto"]
    sufijo = ("" if a.vista == "general" else "_cerca") + ("" if a.modo == "completo" else "_simple")
    salida = os.path.abspath(a.salida)
    os.makedirs(salida, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="rayo_")
    guion = Guion(cfg)
    n_total = int(round(guion.duracion * FPS))
    cuadros = [int(x) for x in a.cuadros.split(",")] if a.cuadros else list(range(n_total))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.max_bounces = 3
    sc.render.use_persistent_data = True
    sc.view_settings.view_transform = "Standard"
    ims = sc.render.image_settings
    ims.file_format = "OPEN_EXR"
    ims.color_mode = "RGBA"
    ims.color_depth = "32"
    ims.exr_codec = "ZIP"
    col, enemigos = escenario(len(guion.enemigos))
    # El arma de la demo: una torre con la boca en el origen del haz.
    ox, oy, oz = guion.origen
    _caja("arma_base", ox, oy, 0.9, 0.9, oz - 0.35, _material("arma", (0.03, 0.26, 0.29)), col)
    _caja("arma_cabeza", ox, oy, 0.6, 0.6, 0.5, _material("arma_cabeza", (0.07, 0.08, 0.09)), col).location.z = oz
    cam = cfg["demo"]["camara" if a.vista == "general" else "camara_cerca"]
    co = camara(cal, cam["elevacion"], cam["yaw"], cam["distancia"])
    orientar(co, cam["elevacion"], cam["yaw"], cam["distancia"], cam["objetivo"])
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
    firma = escena = zesc = None
    vista = Vista(co, w, h)
    salidas, renders = {}, 0
    for i, c in enumerate(cuadros):
        t = c / FPS
        est = guion.estado(t)
        nueva = tuple(p is None for p in est["enemigos"])
        if nueva != firma:  # el escenario solo se vuelve a renderizar cuando cae un enemigo
            firma = nueva
            for (cuerpo, torre), p in zip(enemigos, est["enemigos"]):
                x, y, hundido = (p[0], p[1], 0.0) if p is not None else (0.0, 0.0, -400.0)
                cuerpo.location = (x, y, 0.275 + hundido)
                torre.location = (x, y, 0.7 + hundido)
            capa.update()
            escena = render(os.path.join(tmp, "escena.exr"), False)[..., :3]
            z = render(os.path.join(tmp, "z.exr"), True)
            zesc = np.where(z[..., 3] > 0.5, z[..., 0], 1e6).astype(np.float32)
            vista = Vista(co, w, h)
            renders += 1
        img = componer(vista, escena, zesc, est, guion, cfg, a.modo)
        salidas[c] = a_bytes(a_srgb(tono(img, 1.0, 0.8)))
        escribir_png(os.path.join(tmp, f"f{i:04d}.png"), salidas[c], nivel=3)
        if i % 24 == 0:
            print(f"[rayo] cuadro {c}/{n_total} t={t:.2f} potencia={est['potencia']:.2f} haz={est['cola']:.1f}–{est['frente']:.1f} m")
    seg = time.time() - t_ini

    if not a.cuadros:
        video(os.path.join(tmp, "f%04d.png"), FPS, os.path.join(salida, f"{a.nombre}{sufijo}.mp4"))
        caida = [e["t"] for e in guion.eventos if e["evento"] == "objetivo_destruido"]
        td, tc = guion.t_disparo, guion.t_corte
        tiempos = [td - 0.2, td - 0.04, td + 0.05, td + 0.14, td + 0.5, (caida[0] if caida else td + 1) + 0.03,
                   2.0, 2.6, 3.3, 4.2, tc + 0.06, tc + 0.3]
        elegidos = [salidas[min(n_total - 1, max(0, int(round(t * FPS))))][::2, ::2] for t in tiempos]
        escribir_jpg(os.path.join(salida, f"{a.nombre}{sufijo}_hoja.jpg"), hoja(elegidos, 4))
        json.dump(dict(fps=FPS, cuadros=n_total, resolucion=[w, h], calidad=a.calidad, modo=a.modo, vista=a.vista,
                       eventos=guion.eventos,
                       tiempos=dict(carga=guion.t_carga, disparo=guion.t_disparo, corte=guion.t_corte, apagado=round(guion.t_apagado, 3)),
                       segundos=dict(total=round(seg, 1), por_cuadro=round(seg / len(cuadros), 2), renders_escenario=renders),
                       config=cfg, blender=bpy.app.version_string),
                  open(os.path.join(salida, f"{a.nombre}{sufijo}.json"), "w"), indent=1, ensure_ascii=False)
    else:
        escribir_jpg(os.path.join(salida, f"{a.nombre}{sufijo}_prueba.jpg"),
                     hoja([salidas[c] for c in cuadros], min(2, len(cuadros))), calidad=93)
    for f_ in os.listdir(tmp):
        os.remove(os.path.join(tmp, f_))
    os.rmdir(tmp)
    print("[rayo] eventos:", " | ".join(f"{e['t']:.2f} {e['evento']}" for e in guion.eventos))
    print(f"[rayo] {len(cuadros)} cuadros en {seg:.1f} s ({seg / len(cuadros):.2f} s por cuadro, {renders} renders del escenario)")


if __name__ == "__main__":
    main()
