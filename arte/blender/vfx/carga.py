"""Piso cargado de la singularidad: la figura de Lichtenberg que deja el haz de electrones.

El haz deposita carga en el piso y la carga se reparte en ramas. Aquí están las tres piezas que no
dependen de Blender:

- `arbol`: las ramas, sorteadas una vez con semilla. Cada nudo guarda cuánto camino hay hasta el
  impacto: con eso el frente del reparto recorre las ramas sin guardar estado.
- `hornear`: las ramas dibujadas una vez por cámara, con sus datos por píxel (peso, camino hasta el
  impacto, posición en el suelo y un desfase por rama). En el motor sería una textura del suelo.
- `luz_piso`: lo que haría el fragment shader con esa textura en cada cuadro. La figura nunca se
  ve entera: solo se enciende el tramo por el que pasa cada latido, del impacto hacia fuera.

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
             alcance=arb["alcance"], forma=(h, w))
    _HORNOS.clear()  # solo hace falta la cámara actual
    _HORNOS[clave] = m
    return m


def luz_piso(m, c, ec, t):
    """Luz de la figura en este cuadro (alto, ancho, 3). `ec["latidos"]` son los segundos de cada latido en curso.

    Cada latido es una banda que recorre las ramas a velocidad constante: frente blanco y nítido, cola
    violeta corta. Detrás no queda nada encendido.
    """
    on = c["onda"]
    frente_c, cola_c = np.array(on["color"], np.float32), np.array(on["color_cola"], np.float32)
    luz = np.zeros((len(m["peso"]), 3), np.float32)
    for tau in ec["latidos"]:
        atras = on["velocidad_m_s"] * tau - m["dist"]  # metros que lleva el frente pasado por aquí
        banda = np.where(atras >= 0, np.exp(-atras / on["cola_m"]), np.exp(-(atras / on["frente_m"]) ** 2))
        # Se gasta al alejarse y chisporrotea un poco por rama.
        vida = np.clip(1 - m["dist"] / (on["alcance"] * m["alcance"]), 0.0, 1.0) ** on["desgaste"]
        chispa = 0.8 + 0.2 * np.sin(t * 61.0 + 40.0 * m["fase"])
        mezcla = np.clip(atras / on["cola_m"], 0.0, 1.0)[:, None]
        luz += (on["brillo"] * banda * vida * chispa)[:, None] * (frente_c + (cola_c - frente_c) * mezcla)
    img = np.zeros((*m["forma"], 3), np.float32)
    img[m["idx"]] = luz * m["peso"][:, None]
    return img


def duracion_latido(c, arb):
    """Segundos que tarda un latido en recorrer la figura y apagarse."""
    on = c["onda"]
    return (arb["alcance"] * on["alcance"] + 3 * on["cola_m"]) / on["velocidad_m_s"]
