"""Piso cargado de la singularidad: la figura de Lichtenberg que deja el haz de electrones.

El haz deposita carga en el piso y la carga se reparte en ramas. Aquí están las tres piezas que no
dependen de Blender:

- `arbol`: las ramas, sorteadas una vez con semilla. Cada nudo guarda cuánto camino hay hasta el
  impacto: con eso el frente del reparto recorre las ramas sin guardar estado.
- `hornear`: las ramas dibujadas una vez por cámara, con sus datos por píxel (peso, camino hasta el
  impacto, posición en el suelo y un desfase por rama). En el motor sería una textura del suelo.
- `luz_piso`: lo que haría el fragment shader con esa textura en cada cuadro: el fogonazo del
  frente, el tramo que alimenta el haz y el reposo, que late bajo cada agujero.

Los parámetros son la sección «carga» de singularidad_config.json.
"""
import math

import numpy as np


def arbol(c, semilla):
    """Ramas en el suelo, en metros respecto al impacto. El tramo i une el nudo `padre[i]` con el i."""
    r = np.random.default_rng([semilla, 4242])
    p, padre, dist, rama = [(0.0, 0.0)], [-1], [0.0], [0]
    pendientes = []  # (nudo de salida, dirección, largo que le queda, generación)
    for k in range(c["troncos"]):
        pendientes.append((0, math.tau * (k + r.uniform(-0.3, 0.3)) / c["troncos"],
                           c["radio_m"] * r.uniform(0.75, 1.15), 0))
    n_rama = 0
    while pendientes:
        n, ang, resto, gen = pendientes.pop()
        n_rama += 1
        while resto > 0:
            paso = c["paso_m"] * r.uniform(0.7, 1.3)
            ang += r.normal() * c["giro"]
            x, y = p[n]
            if x * x + y * y > 0.25:  # la carga se repele: las ramas tiran hacia fuera
                ang += c["sesgo"] * math.remainder(math.atan2(y, x) - ang, math.tau)
            p.append((x + paso * math.cos(ang), y + paso * math.sin(ang)))
            padre.append(n)
            dist.append(dist[n] + paso)
            rama.append(n_rama)
            n = len(p) - 1
            resto -= paso
            if gen < c["generaciones"] and resto > c["rama_minima_m"] and r.random() < c["ramificacion"] * paso:
                lado = 1 if r.random() < 0.5 else -1
                pendientes.append((n, ang + lado * math.radians(r.uniform(*c["angulo_rama"])),
                                   resto * r.uniform(*c["reparto"]), gen + 1))
    p, padre, dist = np.array(p), np.array(padre), np.array(dist)
    # Ancho según cuánta rama cuelga de cada tramo: troncos gruesos junto al impacto, puntas finas.
    abajo = np.zeros(len(p))
    for i in range(len(p) - 1, 0, -1):  # los hijos siempre se crean después que su padre
        abajo[padre[i]] += abajo[i] + dist[i] - dist[padre[i]]
    grosor = (abajo / max(1e-6, abajo[1:].max())).clip(0, 1) ** c["exponente_ancho"]
    ancho = c["ancho_m"][0] + (c["ancho_m"][1] - c["ancho_m"][0]) * grosor
    fase = np.random.default_rng([semilla, 4243]).random(n_rama + 1)[np.array(rama)]
    return dict(p=p, padre=padre, dist=dist, ancho=ancho, fase=fase, alcance=float(dist.max()) * 1.02)


def llegada(arb, c, dist):
    """Segundos tras el impacto en que el frente alcanza un punto a `dist` metros de camino.

    El frente frena al alejarse: recorre el 63 % del alcance en «tiempo» y casi todo en tres veces eso.
    """
    return -c["reparto"]["tiempo"] * np.log(1 - np.minimum(dist / arb["alcance"], 0.999))


_HORNOS = {}


def hornear(vista, arb, c, centro):
    """Dibuja las ramas una vez para esta cámara y guarda sus datos solo en los píxeles que tocan."""
    clave = (vista.inv.tobytes(), vista.w, vista.h, id(arb), tuple(centro))
    if clave in _HORNOS:
        return _HORNOS[clave]
    h, w = vista.h, vista.w
    mundo = np.column_stack([arb["p"] + np.asarray(centro)[:2], np.zeros(len(arb["p"]))])
    x, y, z = vista.proyectar(mundo)
    sigma = arb["ancho"] * (h / 2) / (np.maximum(z, 0.5) * vista.ty)
    peso = np.zeros((h, w), np.float32)
    datos = np.zeros((h, w, 4), np.float32)  # camino hasta el impacto, x e y en el suelo, desfase de la rama
    for i in range(1, len(x)):
        j = arb["padre"][i]
        if z[i] < 0.3 or z[j] < 0.3:
            continue
        s = max(0.55, float(sigma[i] + sigma[j]) / 2)
        rad = s * 3 + 1
        x0, x1 = int(max(0, min(x[i], x[j]) - rad)), int(min(w, max(x[i], x[j]) + rad + 1))
        y0, y1 = int(max(0, min(y[i], y[j]) - rad)), int(min(h, max(y[i], y[j]) + rad + 1))
        if x0 >= x1 or y0 >= y1 or (x1 - x0) * (y1 - y0) > 60000:
            continue
        ganancia = min(1.0, float(sigma[i] + sigma[j]) / 2 / 0.55)  # más fina que un píxel: menos luz
        gx, gy = np.arange(x0, x1) + 0.5 - x[j], (np.arange(y0, y1) + 0.5 - y[j])[:, None]
        ax, ay = x[i] - x[j], y[i] - y[j]
        u = np.clip((gx * ax + gy * ay) / max(1e-6, ax * ax + ay * ay), 0, 1)
        q = (np.exp(-((gx - u * ax) ** 2 + (gy - u * ay) ** 2) / (2 * s * s)) * ganancia).astype(np.float32)
        zona = (slice(y0, y1), slice(x0, x1))
        gana = q > peso[zona]  # como en una cinta: en cada píxel manda la rama más cercana
        peso[zona] = np.where(gana, q, peso[zona])
        a = np.array((arb["dist"][j], mundo[j, 0], mundo[j, 1], arb["fase"][i]), np.float32)
        b = np.array((arb["dist"][i], mundo[i, 0], mundo[i, 1], arb["fase"][i]), np.float32)
        datos[zona] = np.where(gana[..., None], a + (b - a) * u[..., None], datos[zona])
    idx = np.nonzero(peso > 0.0005)
    d = datos[idx]
    m = dict(idx=idx, peso=peso[idx], dist=d[:, 0], gx=d[:, 1], gy=d[:, 2], fase=d[:, 3],
             llegada=llegada(arb, c, d[:, 0]), forma=(h, w))
    _HORNOS.clear()  # solo hace falta la cámara actual
    _HORNOS[clave] = m
    return m


def foco(c, focos, gx, gy):
    """Cuánto está un punto del suelo bajo algún agujero (0…1) y a qué distancia del más cercano."""
    g, d = np.zeros_like(gx), np.full_like(gx, 1e6)
    for fx, fy, radio in focos:
        dd = np.hypot(gx - fx, gy - fy)
        g = np.maximum(g, np.exp(-(dd / radio) ** 2))
        d = np.minimum(d, dd)
    lejos = c["reposo"]["lejos"]
    return lejos + (1 - lejos) * g, d


def luz_piso(m, c, ec, t):
    """Luz de la figura en este cuadro (alto, ancho, 3) y cuánto oscurece el piso su quemadura (alto, ancho).

    `ec` es el estado de la carga del guion.
    """
    rp, re = c["reparto"], c["reposo"]
    edad = ec["tau"] - m["llegada"]
    encendido = np.clip(edad / 0.04, 0.0, 1.0) * m["peso"]
    edad = np.maximum(edad, 0.0)
    # Fogonazo del frente al pasar y, mientras dura el haz, el tramo cercano que sigue recibiendo carga.
    fogonazo = rp["destello"] * np.exp(-edad / rp["t_destello"])
    fogonazo += rp["haz"] * ec["haz"] * np.exp(-m["dist"] / rp["haz_alcance_m"]) \
        * (0.8 + 0.2 * np.sin(t * 61.0 + 40.0 * m["fase"]))
    # Reposo: la figura se queda encendida, más bajo cada agujero, y late: dos golpes por ciclo que
    # salen de debajo del agujero y se retrasan un poco con la distancia.
    cerca, d = foco(c, ec["focos"], m["gx"], m["gy"])
    ciclo = (t * re["frecuencia"] - d / re["longitud_onda_m"] + re["desfase"] * m["fase"]) % 1.0
    golpe = np.exp(-((ciclo - 0.25) / 0.09) ** 2) + 0.6 * np.exp(-((ciclo - 0.52) / 0.11) ** 2)
    reposo = re["brillo"] * cerca * (1 + re["latido"] * golpe)
    color = np.array(re["color"], np.float32) \
        + (np.array(re["color_latido"], np.float32) - np.array(re["color"], np.float32)) * (golpe * cerca)[:, None]
    img = np.zeros((*m["forma"], 3), np.float32)
    img[m["idx"]] = (fogonazo[:, None] * np.array(rp["color_destello"], np.float32) + reposo[:, None] * color) \
        * encendido[:, None]
    # Quemadura: una marca oscura algo más ancha que la rama. Sin ella, la luz morada sobre un piso
    # claro se lee blanca.
    quemado = np.zeros(m["forma"], np.float32)
    quemado[m["idx"]] = re["quemado"] * np.clip(edad / 0.25, 0.0, 1.0) * np.clip((m["peso"] ** 0.35 - 0.07) / 0.93, 0.0, 1.0)
    return img, quemado
