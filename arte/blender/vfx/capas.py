"""Capas baratas de las explosiones y vista del juego: lo que el motor hará con shaders y decals.

Nada de esto sale de la simulación de gas. Son fórmulas del tiempo transcurrido desde el estallido
y de una semilla, sin estado: destello, luz en el suelo, onda expansiva, chispas, quemadura y
sombra proyectada. `empaquetar.py` las usa para la vista previa de cada atlas y `artilleria.py`
para la escena completa. Solo depende de numpy.

Unidades: metros del juego (1 m = 1 casilla) y segundos. El suelo es z = 0, la cámara es
ortográfica, mira hacia +Y y baja `elev` grados.
"""
import math

import numpy as np

# Dirección en que viaja la luz del sol horneado en explosion.py (rotación 48°, 0, −55°).
SOL = (0.609, 0.426, -0.669)
ARENA = (0.52, 0.42, 0.29)  # lineal; la arena del suelo de vista previa

_BLANCO_CALIDO = np.array((1.0, 0.88, 0.62), np.float32)
_NARANJA = np.array((1.0, 0.62, 0.28), np.float32)
_CHISPA = np.array((1.0, 0.72, 0.3), np.float32)
_ONDA = np.array((1.0, 0.93, 0.82), np.float32)
_POLVO = np.array((0.60, 0.49, 0.34), np.float32)
_BORDE_QUEMADO = np.array((1.0, 0.70, 0.40), np.float32)


class Vista:
    """Cámara ortográfica del juego sobre una imagen de `ancho` × `alto` píxeles.

    `centro` es el punto del suelo que cae en el centro de la imagen y `ppm` los píxeles por metro.
    """

    def __init__(self, ancho, alto, ppm, elev_grados=53.0, centro=(0.0, 0.0)):
        self.w, self.h, self.ppm = ancho, alto, float(ppm)
        self.sen, self.cos = math.sin(math.radians(elev_grados)), math.cos(math.radians(elev_grados))
        self.x0, self.y0 = centro
        yy, xx = np.mgrid[0:alto, 0:ancho].astype(np.float32)
        self.gx = (xx + 0.5 - ancho / 2) / self.ppm + self.x0            # punto del suelo bajo cada píxel
        self.gy = (alto / 2 - yy - 0.5) / self.ppm / self.sen + self.y0

    def px(self, x, y, z=0.0):
        """Píxel (columna, fila) donde se ve el punto (x, y, z)."""
        return ((x - self.x0) * self.ppm + self.w / 2,
                self.h / 2 - ((y - self.y0) * self.sen + z * self.cos) * self.ppm)

    def ventana(self, x, y, z, radio):
        """Recorte (filas, columnas) que cubre `radio` metros de pantalla alrededor del punto, o None."""
        cx, cy = self.px(x, y, z)
        r = radio * self.ppm
        x0, x1 = max(0, int(cx - r)), min(self.w, int(cx + r) + 1)
        y0, y1 = max(0, int(cy - r)), min(self.h, int(cy + r) + 1)
        if x0 >= x1 or y0 >= y1:
            return None
        return slice(y0, y1), slice(x0, x1)


def suelo_arena(vista, semilla=3, rejilla=True):
    """Arena con retícula de 1 m y un grano suave: da la escala y el plano del suelo."""
    rng = np.random.default_rng(semilla)
    g = np.zeros((vista.h, vista.w, 3), np.float32) + np.array(ARENA, np.float32)
    # Manchas de baja frecuencia: ruido de valor en dos octavas, interpolado sobre el suelo.
    for celda, fuerza in ((4.0, 0.07), (1.3, 0.035)):
        u, v = vista.gx / celda + 100.0, vista.gy / celda + 100.0
        iu, iv = np.floor(u).astype(np.int32), np.floor(v).astype(np.int32)
        fu, fv = u - iu, v - iv
        fu, fv = fu * fu * (3 - 2 * fu), fv * fv * (3 - 2 * fv)
        tabla = rng.uniform(-1, 1, (256, 256)).astype(np.float32)
        a, b = tabla[iv % 256, iu % 256], tabla[iv % 256, (iu + 1) % 256]
        c, d = tabla[(iv + 1) % 256, iu % 256], tabla[(iv + 1) % 256, (iu + 1) % 256]
        g *= (1 + fuerza * ((a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv))[..., None]
    if rejilla:
        grosor = 0.9 / vista.ppm
        linea = ((np.abs(vista.gx - np.rint(vista.gx)) < grosor)
                 | (np.abs(vista.gy - np.rint(vista.gy)) < grosor / vista.sen))
        g[linea] *= 0.92
    return g


def _hash(semilla, n, k):
    """n números en [0, 1) reproducibles para la capa k de un estallido."""
    return np.random.default_rng([int(semilla) & 0x7FFFFFFF, k]).uniform(0.0, 1.0, n)


def alcance_capas(c, escala, encuadre, aerea=False):
    """Radio, en metros de pantalla, de la ventana que hay que dar a `capas_explosion` para que nada se corte."""
    luz = 2.3 * (3.2 if aerea else 2.6) * escala if c.get("luz", 0) > 0 else 0
    onda = 1.1 * c.get("radio_onda", 0) if c.get("onda", 0) > 0 else 0
    return max(encuadre * 0.7, luz, onda, 2.3 * 1.9 * escala)


def capas_explosion(t, gx, gy, sx, sv, c, escala, semilla, sen, cos, aerea=False):
    """Capas de un estallido, `t` segundos después de producirse.

    `gx`, `gy`: metros de suelo de cada píxel respecto al punto del suelo bajo el estallido.
    `sx`, `sv`: metros de pantalla (derecha, arriba) respecto al punto donde se ve el estallido.
    `c`: capas de la receta (destello, luz, chispas, quemadura, onda, radio_onda, duracion_onda).
    `escala`: metros del juego por metro simulado; agranda destello, luz y chispas.

    Devuelve un dict con las que estén activas:
    - `mult` (h, w, 3): multiplica el suelo (quemadura y sombra de la onda). Se queda para siempre.
    - `bajo` (h, w, 3): luz que se suma al suelo, bajo el humo.
    - `sobre` (h, w, 3): luz que se suma por encima de todo (destello y chispas).
    - `despl` (h, w, 2): refracción de la onda, en metros de pantalla (derecha, arriba).
    - `velo` (h, w, 4): polvo que levanta la onda, premultiplicado, sobre el suelo.
    """
    if t < 0 or not c:
        return {}
    out = {}
    lento = math.sqrt(escala)  # lo grande tarda más
    r_suelo = np.sqrt(gx * gx + gy * gy)
    ang = np.arctan2(gy, gx)
    fase = _hash(semilla, 6, 1) * math.tau

    # Quemadura: mancha oscura de borde irregular con un cerco tostado. Aparece con el estallido y se queda.
    radio_q = c.get("quemadura", 0.0)
    if radio_q > 0 and not aerea:
        q = min(1.0, t / 0.12)
        borde = radio_q * (1 + 0.16 * np.sin(3 * ang + fase[0]) + 0.09 * np.sin(7 * ang + fase[1])
                           + 0.05 * np.sin(13 * ang + fase[2]))
        nucleo = np.exp(-(r_suelo / borde) ** 2.5)
        cerco = np.exp(-((r_suelo - borde * 1.08) / (0.34 * radio_q)) ** 2)
        # Rayos de eyección: irregulares, y solo fuera del centro para que no formen una estrella.
        rayos = (np.maximum(0.0, np.sin(5 * ang + fase[3]) * np.sin(8 * ang + fase[4])) ** 2
                 * np.exp(-(r_suelo / (radio_q * 2.0)) ** 2) * np.clip(r_suelo / radio_q - 0.4, 0, 1))
        m = (1 - 0.62 * q * nucleo - 0.22 * q * rayos)[..., None] * (1 - 0.42 * q * cerco[..., None] * (1 - _BORDE_QUEMADO))
        out["mult"] = m.astype(np.float32)

    # Luz del estallido sobre el suelo: unas décimas de segundo.
    luz = c.get("luz", 0.0)
    k = max(0.0, 1 - t / (0.30 * lento)) ** 2
    if luz > 0 and k > 0:
        alcance = (3.2 if aerea else 2.6) * escala
        out["bajo"] = (k * 2.2 * luz * np.exp(-(r_suelo / alcance) ** 2))[..., None] * _NARANJA

    # Onda expansiva: aro que barre el suelo (o esfera vista como círculo, en el aire). La fuerza
    # decide si se ve: 0 = sin onda. Brilla, refracta lo que pisa, deja una sombra fina detrás y,
    # si es fuerte, levanta un velo de polvo.
    fuerza = c.get("onda", 0.0)
    if fuerza > 0:
        radio_final, dur = c["radio_onda"], c["duracion_onda"]
        u = t / dur
        rr = np.sqrt(sx * sx + sv * sv) if aerea else r_suelo
        if 0 < u < 1:
            radio = radio_final * (1 - (1 - u) ** 2)
            grosor = (0.10 + 0.30 * u) * (0.55 + 0.45 * radio_final / 4.0)
            d = (rr - radio) / grosor
            perfil = np.exp(-d * d) * (1 - u) ** 1.2
            brillo = (0.22 if aerea else 0.38) * fuerza * perfil
            out["bajo"] = out.get("bajo", 0) + brillo[..., None] * _ONDA
            # Refracción: el aro empuja la imagen hacia fuera por delante y hacia dentro por detrás.
            # Su amplitud no depende del grosor: unos 0,16 m con fuerza 1.
            empuje = -fuerza * 0.37 * d * perfil / np.maximum(rr, 1e-3)
            if aerea:
                out["despl"] = np.stack([sx * empuje, sv * empuje], axis=2).astype(np.float32)
            else:
                out["despl"] = np.stack([gx * empuje, gy * empuje * sen], axis=2).astype(np.float32)
            if not aerea:
                detras = np.exp(-(d + 1.7) ** 2) * (1 - u)
                m = (1 - 0.16 * fuerza * detras)[..., None]
                out["mult"] = out["mult"] * m if "mult" in out else np.broadcast_to(m, m.shape[:2] + (3,)).astype(np.float32)
        if fuerza >= 0.5 and not aerea:
            vida = 1.1 + 0.9 * fuerza
            if 0 < t < vida:
                frente = radio_final * (1 - (1 - min(1.0, u)) ** 2)
                grumos = 0.6 + 0.4 * np.sin(5 * ang + fase[4]) * np.sin(11 * ang + fase[5])
                anillo = np.exp(-((r_suelo - 0.62 * frente) / (0.30 * radio_final)) ** 2) * (r_suelo < frente + 0.3)
                alfa = 0.34 * fuerza * anillo * grumos * min(1.0, t / 0.12) * (1 - t / vida) ** 1.5
                out["velo"] = np.concatenate([alfa[..., None] * _POLVO, alfa[..., None]], axis=2).astype(np.float32)

    # Chispas: balística simple proyectada con la cámara. Cada una solo toca su caja de píxeles.
    n = int(c.get("chispas", 0))
    sobre = None
    if n and t < 0.95 * lento:
        sobre = np.zeros(sx.shape + (3,), np.float32)
        h = _hash(semilla, n * 4, 2).reshape(4, n)
        az = h[0] * math.tau
        ce = (h[1] * 2 - 1) if aerea else (0.15 + 0.85 * h[1])
        vel = (5.0 + 8.0 * h[2]) * escala ** 0.75
        vida = (0.35 + 0.55 * h[3]) * lento
        arrastre, ancho = 2.2, 0.028 * max(1.0, escala ** 0.5)
        paso = float(sx[0, 1] - sx[0, 0]) if sx.shape[1] > 1 else 1.0  # metros por píxel
        x_izq, v_arr = float(sx[0, 0]), float(sv[0, 0])
        margen = 3 * ancho
        for i in range(n):
            if t >= vida[i]:
                continue
            se = math.sqrt(max(0.0, 1 - ce[i] ** 2))
            dx, dy, dz = math.cos(az[i]) * se * vel[i], math.sin(az[i]) * se * vel[i], ce[i] * vel[i]

            def pos(tt):
                f = (1 - math.exp(-arrastre * tt)) / arrastre
                z = dz * f - 4.9 * tt * tt + (0.0 if aerea else 0.3 * escala)
                if not aerea:
                    z = max(z, 0.02)
                return dx * f, dy * f * sen + z * cos

            (x1, v1), (x0, v0) = pos(t), pos(max(0.0, t - 0.045))
            j0 = max(0, int((min(x0, x1) - margen - x_izq) / paso))
            j1 = min(sx.shape[1], int((max(x0, x1) + margen - x_izq) / paso) + 2)
            i0 = max(0, int((v_arr - max(v0, v1) - margen) / paso))
            i1 = min(sx.shape[0], int((v_arr - min(v0, v1) + margen) / paso) + 2)
            if j0 >= j1 or i0 >= i1:
                continue
            wx, wv = sx[i0:i1, j0:j1], sv[i0:i1, j0:j1]
            ax, av = x1 - x0, v1 - v0
            largo = max(1e-4, ax * ax + av * av)
            s = np.clip(((wx - x0) * ax + (wv - v0) * av) / largo, 0, 1)
            dist2 = (wx - (x0 + s * ax)) ** 2 + (wv - (v0 + s * av)) ** 2
            brillo = (1 - t / vida[i]) ** 1.5
            sobre[i0:i1, j0:j1] += (brillo * 1.6 * np.exp(-dist2 / ancho ** 2) * (0.35 + 0.65 * s))[..., None] * _CHISPA

    # Destello: núcleo y halo, más una raya horizontal; dura poco más de una décima.
    destello = c.get("destello", 0.0)
    k = max(0.0, 1 - t / (0.12 * lento))
    if destello > 0 and k > 0:
        if sobre is None:
            sobre = np.zeros(sx.shape + (3,), np.float32)
        cv = 0.0 if aerea else 0.5 * escala * cos
        r2 = sx * sx + (sv - cv) ** 2
        nucleo = np.exp(-r2 / (0.55 * escala * (0.4 + k)) ** 2) * 6.0
        halo = np.exp(-r2 / (1.9 * escala) ** 2) * 1.0   # gaussiano: se acaba dentro de su ventana
        raya = np.exp(-((sv - cv) / (0.07 * escala)) ** 2) * np.exp(-(sx / (2.8 * escala)) ** 2) * 1.5
        sobre += destello * (k ** 1.5) * ((nucleo + halo)[..., None] * _BLANCO_CALIDO + raya[..., None] * _NARANJA)
    if sobre is not None:
        out["sobre"] = sobre
    return out


def refractar(img, despl_px):
    """Muestra `img` desplazada (vecino más cercano): `despl_px` es (h, w, 2) en píxeles (derecha, abajo)."""
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    fx = np.clip(np.rint(xx - despl_px[..., 0]).astype(np.int32), 0, w - 1)
    fy = np.clip(np.rint(yy - despl_px[..., 1]).astype(np.int32), 0, h - 1)
    return img[fy, fx]


def escalar(img, w, h):
    """Remuestreo bilineal de (H, W, C) a (h, w, C)."""
    H, W = img.shape[:2]
    if (W, H) == (w, h):
        return img
    x = (np.arange(w, dtype=np.float32) + 0.5) * W / w - 0.5
    y = (np.arange(h, dtype=np.float32) + 0.5) * H / h - 0.5
    x0 = np.clip(np.floor(x).astype(np.int32), 0, W - 1)
    y0 = np.clip(np.floor(y).astype(np.int32), 0, H - 1)
    x1, y1 = np.minimum(x0 + 1, W - 1), np.minimum(y0 + 1, H - 1)
    fx = np.clip(x - x0, 0, 1)[None, :, None]
    fy = np.clip(y - y0, 0, 1)[:, None, None]
    arriba = img[y0][:, x0] * (1 - fx) + img[y0][:, x1] * fx
    abajo = img[y1][:, x0] * (1 - fx) + img[y1][:, x1] * fx
    return arriba * (1 - fy) + abajo * fy


def pegar(dst, sprite, x, y):
    """Compone `sprite` RGBA premultiplicado sobre `dst` RGB con su esquina superior izquierda en (x, y)."""
    h, w = sprite.shape[:2]
    H, W = dst.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x0 >= x1 or y0 >= y1:
        return
    s = sprite[y0 - y:y1 - y, x0 - x:x1 - x]
    zona = dst[y0:y1, x0:x1]
    zona *= 1 - s[..., 3:4]
    zona += s[..., :3]


def sombra_proyectada(oscuridad, alfa, vista, px_ancla, py_suelo, altura_px, fuerza):
    """Proyecta la silueta de un sprite sobre el suelo, según el sol, y la acumula en `oscuridad`.

    El motor puede hacer lo mismo: dibujar el mismo cuadro del flipbook aplastado y sesgado, en
    negro. `alfa` es (h, w); `px_ancla` es la columna del ancla del sprite, `py_suelo` la fila del
    punto del suelo bajo el ancla y `altura_px` cuántos píxeles queda el borde inferior del sprite
    por encima de ese punto (0 en tierra).
    """
    h, w = alfa.shape
    # Un punto a v píxeles de pantalla sobre el suelo está a z = v / cos y su sombra cae en
    # (SOL.x, SOL.y) · z / −SOL.z sobre el suelo: en pantalla, a la derecha y hacia arriba.
    k = 1.0 / (vista.cos * -SOL[2])
    sesgo, aplasta = SOL[0] * k, SOL[1] * k * vista.sen
    v_min, v_max = altura_px, altura_px + h
    x_izq = int(px_ancla - w / 2 + min(sesgo * v_min, sesgo * v_max)) - 1
    x_der = int(px_ancla + w / 2 + max(sesgo * v_min, sesgo * v_max)) + 2
    y_arr = int(py_suelo - aplasta * v_max) - 1
    y_aba = int(py_suelo - aplasta * v_min) + 2
    X0, X1, Y0, Y1 = max(0, x_izq), min(vista.w, x_der), max(0, y_arr), min(vista.h, y_aba)
    if X0 >= X1 or Y0 >= Y1 or aplasta <= 0:
        return
    yy, xx = np.mgrid[Y0:Y1, X0:X1].astype(np.float32)
    v = (py_suelo - yy) / aplasta                # altura de pantalla del punto que da sombra aquí
    fila = np.rint(altura_px + h - 1 - v).astype(np.int32)
    col = np.rint(xx - sesgo * v - (px_ancla - w / 2)).astype(np.int32)
    dentro = (fila >= 0) & (fila < h) & (col >= 0) & (col < w)
    a = np.where(dentro, alfa[np.clip(fila, 0, h - 1), np.clip(col, 0, w - 1)], 0.0)
    zona = oscuridad[Y0:Y1, X0:X1]
    np.maximum(zona, a * fuerza, out=zona)
