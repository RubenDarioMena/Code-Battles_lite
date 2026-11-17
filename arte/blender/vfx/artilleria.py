"""Escena de prueba de artillería: cohetes con estela, impactos en tierra por poder y estallidos aéreos.

Junta, como lo hará el motor, los atlas de `explosion.py` + `empaquetar.py` con las capas baratas de
`capas.py`. No hay Blender en la imagen: todo es composición de sprites sobre un suelo, con la
cámara ortográfica del juego. Se ejecuta con el Python de Blender solo por numpy y el JPEG.

    blender -b --factory-startup --python arte/blender/vfx/artilleria.py -- \\
        --atlas <carpeta con los atlas> --salida <carpeta> [--config otro.json]
        [--cuadros 2.2,4.9,7.6] [--sin-rotulos]

Necesita los atlas `bocanada` y los que nombre el guion (`tierra_p1`, `aerea_p2`…).

Qué es cada cosa en el motor:
- **Explosión**: un billboard con el flipbook (alfa premultiplicado), interpolando entre cuadros,
  más las capas de su JSON: destello, luz, chispas, quemadura (decal) y onda expansiva.
- **Sombra**: el mismo cuadro del flipbook, aplastado y sesgado sobre el suelo según el sol.
- **Estela**: bocanadas sin estado. La bocanada i nace en t0 + i·paso/velocidad en el punto de la
  trayectoria de ese instante; su tamaño, opacidad, deriva y cuadro del atlas son función de su edad.
- **Incendio**: un flipbook en bucle sobre los restos, con su sombra y una luz que parpadea.
- **Trayectoria**: p(u) = origen + (blanco − origen)·u + arco·4u(1 − u) en z. Es coreografía de la
  vista previa; el juego usará la suya.

Escribe `artilleria.mp4`, `artilleria_hoja.jpg` y `artilleria.json` (eventos con su instante).
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capas import (SOL, Vista, alcance_capas, capas_explosion, escalar, pegar, refractar, sombra_proyectada,  # noqa: E402
                   suelo_arena)
from comun import a_bytes, a_srgb, de_srgb, escribir_jpg, escribir_png, hoja, leer_png, tono, video  # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTE = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


# ------------------------------------------------------------------ atlas


class Atlas:
    """Flipbook de `empaquetar.py`: PNG sRGB con alfa premultiplicado y su JSON."""

    def __init__(self, carpeta, nombre):
        self.meta = json.load(open(os.path.join(carpeta, nombre + ".json")))
        self.img = leer_png(os.path.join(carpeta, nombre + ".png"))
        m = self.meta
        self.px, self.cols, self.filas, self.n, self.fps = m["px"], m["columnas"], m["filas"], m["cuadros"], m["fps"]
        self.por_fila = m["orden"].startswith("una fila")
        self.bucle = m.get("bucle", False)

    def _celda(self, fila, col):
        c = self.img[fila * self.px:(fila + 1) * self.px, col * self.px:(col + 1) * self.px]
        return np.concatenate([de_srgb(c[..., :3]), c[..., 3:4].astype(np.float32) / 255.0], axis=2)

    def cuadro(self, f, fila=0):
        """Cuadro en la posición fraccionaria `f` (0 = primero), mezclando los dos vecinos. None si ya acabó."""
        if self.bucle:
            f = f % self.n
        if f < 0 or f >= self.n:
            return None
        i, k = int(f), f - int(f)

        def celda(j):
            if self.bucle:
                j %= self.n
            if j >= self.n:
                return 0.0
            return self._celda(fila, j) if self.por_fila else self._celda(*divmod(j, self.cols))

        return celda(i) * (1 - k) + (celda(i + 1) * k if k > 1e-3 else 0.0)


# ------------------------------------------------------------------ dibujo simple


def mancha(img, cx, cy, rx, ry, color, alfa, suma=False):
    """Elipse gaussiana: suma luz o mezcla un color."""
    H, W = img.shape[:2]
    x0, x1 = max(0, int(cx - 3 * rx)), min(W, int(cx + 3 * rx) + 2)
    y0, y1 = max(0, int(cy - 3 * ry)), min(H, int(cy + 3 * ry) + 2)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    g = np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)) * alfa
    zona = img[y0:y1, x0:x1]
    if zona.ndim == 2:               # mapa de oscuridad: las sombras se solapan sin pasar de 1
        zona[:] = 1 - (1 - zona) * (1 - g)
    elif suma:
        zona += g[..., None] * np.asarray(color, np.float32)
    else:
        zona *= 1 - g[..., None]
        zona += g[..., None] * np.asarray(color, np.float32)


def poligono(img, pts, color, alfa=1.0):
    """Polígono convexo relleno, con borde suavizado de un píxel."""
    pts = np.asarray(pts, np.float32)
    H, W = img.shape[:2]
    x0, y0 = np.floor(pts.min(axis=0)).astype(int) - 1
    x1, y1 = np.ceil(pts.max(axis=0)).astype(int) + 2
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x0 >= x1 or y0 >= y1:
        return
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    area = sum(pts[i, 0] * pts[(i + 1) % len(pts), 1] - pts[(i + 1) % len(pts), 0] * pts[i, 1] for i in range(len(pts)))
    signo = 1.0 if area > 0 else -1.0
    dentro = np.full(xx.shape, 1e9, np.float32)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        e = b - a
        largo = float(np.hypot(*e)) or 1.0
        dentro = np.minimum(dentro, signo * ((xx - a[0]) * e[1] - (yy - a[1]) * e[0]) / largo * -1)
    m = np.clip(dentro + 0.5, 0, 1)[..., None] * alfa
    zona = img[y0:y1, x0:x1]
    zona *= 1 - m
    zona += m * np.asarray(color, np.float32)


def segmento(img, x0, y0, x1, y1, ancho, color, alfa=1.0):
    """Segmento grueso de extremos redondos."""
    H, W = img.shape[:2]
    m = ancho + 2
    X0, X1 = max(0, int(min(x0, x1) - m)), min(W, int(max(x0, x1) + m) + 1)
    Y0, Y1 = max(0, int(min(y0, y1) - m)), min(H, int(max(y0, y1) + m) + 1)
    if X0 >= X1 or Y0 >= Y1:
        return
    yy, xx = np.mgrid[Y0:Y1, X0:X1].astype(np.float32)
    ax, ay = x1 - x0, y1 - y0
    s = np.clip(((xx - x0) * ax + (yy - y0) * ay) / max(1e-4, ax * ax + ay * ay), 0, 1)
    d = np.sqrt((xx - (x0 + s * ax)) ** 2 + (yy - (y0 + s * ay)) ** 2)
    k = np.clip(ancho / 2 + 0.5 - d, 0, 1)[..., None] * alfa
    zona = img[Y0:Y1, X0:X1]
    zona *= 1 - k
    zona += k * np.asarray(color, np.float32)


def caja(img, vista, x, y, z, lx, ly, lz, color):
    """Caja alineada con los ejes: cara de arriba y cara que mira a la cámara."""
    c = np.asarray(color, np.float32)

    def p(dx, dy, dz):
        return vista.px(x + dx * lx / 2, y + dy * ly / 2, z + dz * lz)

    poligono(img, [p(-1, -1, 0), p(1, -1, 0), p(1, -1, 1), p(-1, -1, 1)], c * 0.55)
    poligono(img, [p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)], c)


def sombra_suelo(x, y, z):
    """Punto del suelo donde cae la sombra de (x, y, z)."""
    k = z / -SOL[2]
    return x + SOL[0] * k, y + SOL[1] * k


# ------------------------------------------------------------------ escena


def _azar(semilla, n):
    return np.random.default_rng(int(semilla) & 0x7FFFFFFF).uniform(0.0, 1.0, n)


class Disparo:
    def __init__(self, i, d, cfg):
        self.i, self.cfg = i, d
        lan = cfg["lanzadores"][d["desde"]]
        self.origen = np.array([lan["pos"][0], lan["pos"][1], lan["boca"]], np.float32)
        blanco = cfg["drones"][d["hasta"]] if isinstance(d["hasta"], str) else d["hasta"]
        self.dron = d["hasta"] if isinstance(d["hasta"], str) else None
        self.blanco = np.array(blanco, np.float32)
        self.vel = d.get("velocidad", cfg["cohete"]["velocidad"])
        self.t0 = d["t"]
        self.vuelo = float(np.linalg.norm(self.blanco - self.origen)) / self.vel
        self.t1 = self.t0 + self.vuelo
        self.arco = d.get("arco", 0.0)
        self.estela = cfg["estelas"][d["estela"]]
        self.semilla = 1000 + 17 * i

    def pos(self, t):
        """Posición del cohete. Función pura del tiempo."""
        u = min(1.0, max(0.0, (t - self.t0) / self.vuelo))
        p = self.origen + (self.blanco - self.origen) * u
        p[2] += self.arco * 4 * u * (1 - u)
        return p


def construir(cfg):
    disparos = [Disparo(i, d, cfg) for i, d in enumerate(cfg["guion"])]
    eventos = []
    for d in disparos:
        eventos.append(dict(t=round(d.t0, 3), tipo="disparo", desde=d.cfg["desde"]))
        eventos.append(dict(t=round(d.t1, 3), tipo="explosion", atlas=d.cfg["explosion"],
                            pos=[round(float(v), 2) for v in d.blanco], dron=d.dron))
    return disparos, sorted(eventos, key=lambda e: e["t"])


def render(cfg, atlas, tiempos, guardar):
    """Compone la escena en cada instante de `tiempos` y llama a guardar(i, rgb8)."""
    v = cfg["vista"]
    vista = Vista(v["ancho"], v["alto"], v["ppm"], v["elevacion"], tuple(v["centro"]))
    ppm = vista.ppm
    suelo = suelo_arena(vista, rejilla=v.get("rejilla", True))
    disparos, _ = construir(cfg)
    boc, coh, fog = atlas["bocanada"], cfg["cohete"], cfg["fogonazo"]
    horneadas = set()

    def sprite(img, oscuridad, a, f, x, y, z, fila=0, sombra=0.0, lado=None, tinte=None, alfa=1.0, calor=0.0):
        """Dibuja un cuadro de atlas centrado en su ancla sobre el punto (x, y, z); `lado` en metros."""
        c = a.cuadro(f, fila)
        if c is None:
            return
        lado_px = max(2, int(round((lado if lado else a.meta["encuadre_m"]) * ppm)))
        c = escalar(c, lado_px, lado_px)
        if tinte is not None:
            c = c * np.array([tinte[0], tinte[1], tinte[2], 1.0], np.float32)
        if alfa != 1.0:
            c = c * alfa
        if calor > 0:  # luz de la llama en el humo recién salido: suma sin tapar
            c = c.copy()
            c[..., :3] += c[..., 3:4] * calor * np.array((1.0, 0.55, 0.2), np.float32)
        ax, ay = a.meta["ancla"]
        cx, cy = vista.px(x, y, z)
        x_izq, y_arr = int(round(cx - ax * lado_px)), int(round(cy - (1 - ay) * lado_px))
        if sombra > 0 and oscuridad is not None:
            _, cy_suelo = vista.px(x, y, 0)
            sombra_proyectada(oscuridad, c[..., 3], vista, x_izq + lado_px / 2, cy_suelo,
                              cy_suelo - (y_arr + lado_px), sombra)
        if img is not None:
            pegar(img, c, x_izq, y_arr)

    t_ini = time.time()
    for n, t in enumerate(tiempos):
        img = suelo.copy()
        bajo = np.zeros_like(img)
        bajo_fuego = np.zeros_like(img)
        sobre = np.zeros_like(img)
        despl = None
        velos = []
        oscuridad = np.zeros(img.shape[:2], np.float32)
        cosas = []  # (profundidad y, función que dibuja): se pintan de lejos a cerca

        # --- capas de cada estallido (y del fogonazo de cada disparo)
        def capas_en(x, y, z, edad, c, escala, semilla, aerea, radio, clave=None):
            nonlocal despl
            win = vista.ventana(x, y, z if aerea else 0, radio)
            if win is None:
                return
            gx, gy = vista.gx[win] - x, vista.gy[win] - y
            k = capas_explosion(edad, gx, gy, gx, gy * vista.sen - z * vista.cos, c, escala, semilla,
                                vista.sen, vista.cos, aerea)
            if "mult" in k:
                asentada = edad > max(0.2, c.get("duracion_onda", 0) if c.get("onda", 0) > 0 else 0)
                if clave is not None and asentada:
                    suelo[win] *= k["mult"]      # la quemadura ya no cambia: queda en el suelo
                    horneadas.add(clave)
                img[win] *= k["mult"]
            if "bajo" in k:
                bajo[win] += k["bajo"]
            if "sobre" in k:
                sobre[win] += k["sobre"]
            if "despl" in k:
                if despl is None:
                    despl = np.zeros(img.shape[:2] + (2,), np.float32)
                despl[win][..., 0] += k["despl"][..., 0] * ppm
                despl[win][..., 1] -= k["despl"][..., 1] * ppm
            if "velo" in k:
                velos.append((win, k["velo"]))

        for d in disparos:
            if t >= d.t0 and t - d.t0 < 0.6:
                capas_en(d.origen[0], d.origen[1], d.origen[2], t - d.t0, fog["capas"], 0.5, d.semilla + 5, True, 3.0)
            if t < d.t1:
                continue
            a = atlas[d.cfg["explosion"]]
            m = a.meta
            c, edad, aerea = m.get("capas", {}), t - d.t1, not m.get("suelo", True)
            if ("x", d.i) in horneadas and edad > 2.5:
                continue
            c_viva = dict(c, quemadura=0.0) if ("x", d.i) in horneadas else c
            radio = alcance_capas(c, m.get("escala", 1.0), m["encuadre_m"], aerea)
            capas_en(d.blanco[0], d.blanco[1], d.blanco[2], edad, c_viva, m.get("escala", 1.0), m["semillas"][0] + d.i,
                     aerea, radio, clave=("x", d.i))

        if despl is not None:
            img = refractar(img, despl)
        img += bajo
        for win, velo in velos:
            img[win] = velo[..., :3] + img[win] * (1 - velo[..., 3:4])

        # --- lanzadores
        for nombre, lan in cfg["lanzadores"].items():
            if nombre == "_":
                continue
            x, y = lan["pos"]
            pesado = lan.get("pesado", False)
            lx, ly, lz = (1.9, 1.3, 0.8) if pesado else (1.5, 1.1, 0.65)
            sx_, sy_ = sombra_suelo(x, y, lz)
            mancha(oscuridad, *vista.px(sx_ - 0.2, sy_ - 0.1), lx * 0.42 * ppm, ly * 0.34 * ppm, None, 0.6)

            def dibuja(img_, x=x, y=y, lx=lx, ly=ly, lz=lz, pesado=pesado, boca=lan["boca"]):
                verde = (0.045, 0.065, 0.04) if pesado else (0.055, 0.075, 0.045)
                caja(img_, vista, x, y, 0, lx, ly, lz, verde)
                caja(img_, vista, x + 0.1, y, lz, lx * 0.55, ly * 0.6, boca - lz + 0.12, tuple(c_ * 0.8 for c_ in verde))

            cosas.append((y, dibuja))

        # --- vehículos: enteros hasta que les cae algo; después, restos quemados
        for nombre, veh in cfg.get("vehiculos", {}).items():
            if nombre == "_":
                continue
            x, y = veh["pos"]
            lx, ly, lz = veh["tam"]
            roto = any(np.hypot(d.blanco[0] - x, d.blanco[1] - y) < 1.5 and t >= d.t1 for d in disparos)
            sx_, sy_ = sombra_suelo(x, y, lz)
            mancha(oscuridad, *vista.px(sx_ - 0.2, sy_ - 0.1), lx * 0.42 * ppm, ly * 0.34 * ppm, None, 0.6)

            def dibuja(img_, x=x, y=y, lx=lx, ly=ly, lz=lz, roto=roto):
                color = (0.02, 0.018, 0.017) if roto else (0.20, 0.05, 0.04)
                caja(img_, vista, x, y, 0, lx, ly, lz * (0.75 if roto else 1.0), color)
                if not roto:
                    caja(img_, vista, x - 0.1, y, lz, lx * 0.45, ly * 0.55, 0.3, tuple(c_ * 0.8 for c_ in color))

            cosas.append((y + 0.3, dibuja))

        # --- drones vivos
        for nombre, dron in cfg["drones"].items():
            if nombre == "_":
                continue
            x, y, z = dron
            caido = any(d.dron == nombre and t >= d.t1 for d in disparos)
            if caido:
                continue
            bx, by = x, y
            bz = z + 0.06 * math.sin(2.2 * t + sum(map(ord, nombre)) % 7)
            sx_, sy_ = sombra_suelo(bx, by, bz)
            mancha(oscuridad, *vista.px(sx_, sy_), 0.42 * ppm, 0.26 * ppm, None, 0.33)

            def dibuja(img_, bx=bx, by=by, bz=bz):
                for dx, dy in ((-0.34, -0.3), (0.34, -0.3), (-0.34, 0.3), (0.34, 0.3)):
                    mancha(img_, *vista.px(bx + dx, by + dy, bz + 0.08), 0.2 * ppm, 0.13 * ppm, (0.2, 0.2, 0.21), 0.5)
                caja(img_, vista, bx, by, bz - 0.08, 0.5, 0.4, 0.16, (0.16, 0.05, 0.045))

            cosas.append((by, dibuja))

        # --- estelas, fogonazos y cohetes
        for d in disparos:
            if t < d.t0:
                continue
            e = d.estela
            # Fogonazo: bocanadas grandes en la boca, que retroceden un poco.
            rumbo = d.blanco[:2] - d.origen[:2]
            rumbo = rumbo / (np.linalg.norm(rumbo) or 1.0)
            h = _azar(d.semilla + 1, fog["bocanadas"] * 5).reshape(5, -1)
            for j in range(fog["bocanadas"]):
                vida = fog["vida"] * (0.75 + 0.5 * h[0, j])
                edad = t - d.t0 - 0.03 * j
                if not 0 <= edad < vida:
                    continue
                u = edad / vida
                atras = fog["retroceso"] * (1 - math.exp(-3 * edad)) / 3 * (0.4 + h[1, j])
                x = d.origen[0] - rumbo[0] * atras + (h[2, j] - 0.5) * fog["dispersion"]
                y = d.origen[1] - rumbo[1] * atras + (h[3, j] - 0.5) * fog["dispersion"]
                z = max(0.25, d.origen[2] * 0.7 + 0.5 * edad)
                radio = fog["radio"] * (1 + fog["crecer"] * math.sqrt(u)) * (0.8 + 0.4 * h[4, j])
                alfa = fog["alfa"] * min(1.0, edad / 0.05) * (1 - u) ** 1.4
                cosas.append((y, lambda img_, f=u * (boc.n - 1), fila=j % boc.filas, x=x, y=y, z=z, radio=radio, alfa=alfa,
                              tinte=e["tinte"]: sprite(img_, None, boc, f, x, y, z, fila, lado=radio * 3.2, tinte=tinte, alfa=alfa)))
                sx_, sy_ = sombra_suelo(x, y, z)
                mancha(oscuridad, *vista.px(sx_, sy_), radio * 0.9 * ppm, radio * 0.6 * ppm, None, e["sombra"] * alfa)

            # Estela: bocanadas sin estado a lo largo de la trayectoria.
            dt = e["paso"] / d.vel
            cuantas = int(min(t, d.t1) / dt - d.t0 / dt) + 1
            hh = _azar(d.semilla + 2, max(1, int(d.vuelo / dt) + 2) * 5).reshape(5, -1)
            for j in range(max(0, cuantas)):
                nace = d.t0 + j * dt
                vida = e["vida"] * (0.8 + 0.4 * hh[0, j])
                edad = t - nace
                if not 0 <= edad < vida:
                    continue
                u = edad / vida
                p = d.pos(nace)
                x = p[0] + e["viento"][0] * edad + (hh[1, j] - 0.5) * 2 * e["dispersion"]
                y = p[1] + e["viento"][1] * edad + (hh[2, j] - 0.5) * 2 * e["dispersion"]
                z = p[2] + e["subida"] * edad + (hh[3, j] - 0.5) * 2 * e["dispersion"]
                radio = e["radio"] * (1 + e["crecer"] * math.sqrt(u)) * (0.8 + 0.4 * hh[4, j])
                alfa = e["alfa"] * min(1.0, edad / 0.04) * (1 - u) ** 1.4
                calor = e["calor"] * max(0.0, 1 - edad / e["duracion_calor"])
                cosas.append((y, lambda img_, f=u * (boc.n - 1), fila=j % boc.filas, x=x, y=y, z=z, radio=radio, alfa=alfa,
                              calor=calor, tinte=e["tinte"]: sprite(img_, None, boc, f, x, y, z, fila, lado=radio * 3.2,
                                                                    tinte=tinte, alfa=alfa, calor=calor)))
                sx_, sy_ = sombra_suelo(x, y, z)
                mancha(oscuridad, *vista.px(sx_, sy_), radio * 0.85 * ppm, radio * 0.55 * ppm, None, e["sombra"] * alfa)

            # Cohete y llama.
            if t < d.t1:
                p, q = d.pos(t), d.pos(t - 0.02)
                dir_ = p - q
                dir_ = dir_ / (np.linalg.norm(dir_) or 1.0)
                cola = p - dir_ * coh["largo"]
                sx_, sy_ = sombra_suelo(*p)
                mancha(oscuridad, *vista.px(sx_, sy_), 0.3 * ppm, 0.16 * ppm, None, coh["sombra"])

                def dibuja(img_, p=p, cola=cola, escala=1.5 if d.cfg["estela"] == "pesada" else 1.0):
                    (x1, y1), (x0, y0) = vista.px(*p), vista.px(*cola)
                    segmento(img_, x0, y0, x1, y1, coh["ancho"] * escala * ppm, coh["color"])
                    mancha(sobre, x0, y0, coh["radio_halo"] * escala * ppm, coh["radio_halo"] * escala * ppm * 0.8,
                           (1.0, 0.55, 0.22), coh["halo"], suma=True)
                    mancha(sobre, x0, y0, coh["radio_llama"] * escala * ppm, coh["radio_llama"] * escala * ppm,
                           (1.0, 0.9, 0.7), coh["llama"], suma=True)

                cosas.append((float(p[1]), dibuja))

        # --- flipbooks de las explosiones (con su sombra proyectada)
        for d in disparos:
            if t < d.t1:
                continue
            a = atlas[d.cfg["explosion"]]
            f = (t - d.t1) * a.fps
            if f >= a.n:
                continue
            fuerza = a.meta.get("capas", {}).get("sombra", 0.0)
            sprite(None, oscuridad, a, f, *d.blanco, sombra=fuerza)
            cosas.append((float(d.blanco[1]) - 0.01, lambda img_, a=a, f=f, b=d.blanco: sprite(img_, None, a, f, *b)))

        # --- incendios en bucle sobre los restos
        for d in disparos:
            nombre = d.cfg.get("incendio")
            if not nombre or t < d.t1 + 0.25:
                continue
            a = atlas[nombre]
            entra = min(1.0, (t - d.t1 - 0.25) / 0.7)
            f = (t - d.t1) * a.fps
            x, y = float(d.blanco[0]), float(d.blanco[1])
            parpadeo = 0.75 + 0.25 * math.sin(23.0 * t + d.i) * math.sin(7.3 * t)
            mancha(bajo_fuego, *vista.px(x, y), 1.5 * ppm, 1.0 * ppm, (1.0, 0.5, 0.18), 0.5 * entra * parpadeo, suma=True)
            sprite(None, oscuridad, a, f, x, y, 0.35, sombra=a.meta.get("capas", {}).get("sombra", 0.0) * entra, alfa=entra)
            cosas.append((y + 0.29, lambda img_, a=a, f=f, x=x, y=y, entra=entra: sprite(img_, None, a, f, x, y, 0.35, alfa=entra)))

        img += bajo_fuego
        img *= 1 - oscuridad[..., None]
        for _, dibuja in sorted(cosas, key=lambda c: -c[0]):
            dibuja(img)
        img += sobre
        guardar(n, a_bytes(a_srgb(tono(img, 1.0, 0.8))))
        if n % 30 == 0:
            print(f"[artilleria] t = {t:5.2f} s · {n + 1}/{len(tiempos)} · {time.time() - t_ini:.0f} s", flush=True)


def rotular(mp4, cfg, disparos, vista):
    """Añade con ffmpeg un rótulo junto a cada explosión que lo pida en el guion."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg or not os.path.exists(FUENTE):
        return False
    filtros = []
    for d in disparos:
        texto = d.cfg.get("rotulo")
        if not texto:
            continue
        x, y = vista.px(d.blanco[0], d.blanco[1], 0)
        x = min(max(8, int(x - 4.5 * len(texto))), vista.w - 9 * len(texto) - 8)
        y = min(vista.h - 30, int(y + 0.9 * vista.ppm))
        filtros.append(f"drawtext=fontfile={FUENTE}:text='{texto}':x={x}:y={y}:fontsize=17:fontcolor=white:"
                       f"borderw=2:bordercolor=black@0.7:enable='between(t,{d.t1 - 0.1:.2f},{d.t1 + 3.4:.2f})'")
    if not filtros:
        return False
    tmp = mp4 + ".tmp.mp4"
    subprocess.run([ffmpeg, "-v", "error", "-y", "-i", mp4, "-vf", ",".join(filtros), "-c:v", "libx264", "-crf", "19",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", tmp], check=True)
    os.replace(tmp, mp4)
    return True


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="artilleria.py")
    ap.add_argument("--atlas", required=True, help="carpeta con los atlas de empaquetar.py")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--config", default=os.path.join(AQUI, "artilleria_config.json"))
    ap.add_argument("--cuadros", help="solo estos instantes (s), en una hoja de prueba")
    ap.add_argument("--sin-rotulos", action="store_true")
    a = ap.parse_args(args)

    cfg = json.load(open(a.config))
    os.makedirs(a.salida, exist_ok=True)
    nombres = {"bocanada"} | {d["explosion"] for d in cfg["guion"]} | {d["incendio"] for d in cfg["guion"] if d.get("incendio")}
    atlas = {n: Atlas(a.atlas, n) for n in sorted(nombres)}
    v = cfg["vista"]
    disparos, eventos = construir(cfg)

    if a.cuadros:
        tiempos = [float(x) for x in a.cuadros.split(",")]
        cuadros = {}
        render(cfg, atlas, tiempos, lambda i, rgb: cuadros.__setitem__(i, rgb))
        mitad = [cuadros[i][::2, ::2] for i in range(len(tiempos))] if len(tiempos) > 2 else [cuadros[i] for i in range(len(tiempos))]
        escribir_jpg(os.path.join(a.salida, "artilleria_prueba.jpg"), hoja(mitad, min(3, len(mitad))))
        return

    tmp = tempfile.mkdtemp(prefix="artilleria_")
    total = int(v["duracion"] * v["fps"])
    tiempos = [i / v["fps"] for i in range(total)]
    marcas = {min(total - 1, int(round(t * v["fps"]))): t for t in cfg.get("hoja", [])}
    elegidos = {}

    def guardar(i, rgb):
        escribir_png(os.path.join(tmp, f"p{i:04d}.png"), rgb, nivel=3)
        if i in marcas:
            elegidos[i] = rgb[::2, ::2].copy()

    t = time.time()
    render(cfg, atlas, tiempos, guardar)
    mp4 = os.path.join(a.salida, "artilleria.mp4")
    if video(os.path.join(tmp, "p%04d.png"), v["fps"], mp4) and not a.sin_rotulos:
        vista = Vista(v["ancho"], v["alto"], v["ppm"], v["elevacion"], tuple(v["centro"]))
        rotular(mp4, cfg, disparos, vista)
    if elegidos:
        escribir_jpg(os.path.join(a.salida, "artilleria_hoja.jpg"), hoja([elegidos[i] for i in sorted(elegidos)], 4))
    shutil.rmtree(tmp)
    json.dump(dict(fps=v["fps"], duracion_s=v["duracion"], segundos_composicion=round(time.time() - t, 1),
                   atlas={n: dict(variante=x.meta["variante"], poder=x.meta["poder"], encuadre_m=x.meta["encuadre_m"],
                                  fps=x.fps, capas=x.meta.get("capas", {})) for n, x in atlas.items()},
                   eventos=eventos),
              open(os.path.join(a.salida, "artilleria.json"), "w"), indent=1, ensure_ascii=False)
    print(f"[artilleria] {mp4} · {time.time() - t:.0f} s")


if __name__ == "__main__":
    main()
