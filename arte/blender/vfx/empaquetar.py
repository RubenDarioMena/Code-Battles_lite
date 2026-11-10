"""Convierte los cuadros EXR de explosion.py en un atlas de flipbook listo para el motor.

Sin ventana (usa el Python de Blender: numpy para las cuentas y bpy solo para leer EXR):
    blender -b --factory-startup --python arte/blender/vfx/empaquetar.py -- \
        --entrada <carpeta de explosion.py> --destino <carpeta> --nombre explosion_polvo
        [--exposicion 1.0] [--desvanecer 8] [--previa] [--hoja-pasos 4]

Escribe en `destino`:
- `<nombre>.png`: atlas de 8 × 8 cuadros, de izquierda a derecha y de arriba abajo. RGB con alfa
  **premultiplicado** y codificado en sRGB: el fuego (que emite sin tapar) y el humo (que tapa sin
  emitir) caben en la misma textura. En el motor se mezcla con ONE, ONE_MINUS_SRC_ALPHA.
- `<nombre>.json`: rejilla, fps, metros que cubre el cuadro, ancla del suelo y uso real del cuadro.
- `<nombre>_hoja.jpg`: hoja de contactos sobre arena, para revisar sin reproducir.
- con `--previa`, `<nombre>.mp4`: el flipbook con las capas baratas que no salen de la simulación
  (destello, luz en el suelo, onda, chispas y quemadura), tal como las pondría el motor.
"""
import argparse
import json
import math
import os
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comun import a_bytes, a_srgb, escribir_jpg, escribir_png, hoja, leer_exr, tono, video  # noqa: E402

ARENA = (0.52, 0.42, 0.29)  # lineal; la misma arena del suelo de vista previa de explosion.py


# ------------------------------------------------------------------ suelo y capas baratas


def suelo(px, encuadre, ancla, elev):
    """Arena con una retícula de 1 m vista desde la cámara: da la escala y el plano del suelo."""
    y, x = np.mgrid[0:px, 0:px].astype(np.float32)
    mx = (x / px - ancla[0]) * encuadre                       # metros a la derecha del origen
    my = ((1 - y / px) - ancla[1]) * encuadre / math.sin(elev)  # metros hacia el fondo, sobre el suelo
    g = np.zeros((px, px, 3), np.float32) + np.array(ARENA, np.float32)
    grosor = encuadre / px * 0.9
    linea = (np.abs(mx - np.rint(mx)) < grosor) | (np.abs(my - np.rint(my)) < grosor / math.sin(elev))
    g[linea] *= 0.9
    return g, mx, my


def capas_baratas(t, mx, my, px, encuadre, ancla, elev, semilla):
    """Destello, luz en el suelo, onda, chispas y quemadura: lo que el motor hará con shaders y partículas.

    Devuelve (multiplica, suma_bajo, suma_sobre): la quemadura oscurece el suelo, la luz y la onda
    se suman bajo el flipbook, y el destello y las chispas por encima.
    """
    r_suelo = np.sqrt(mx * mx + my * my)
    multiplica = np.ones((px, px, 1), np.float32)
    bajo = np.zeros((px, px, 3), np.float32)
    sobre = np.zeros((px, px, 3), np.float32)

    # Quemadura: aparece con el estallido y se queda.
    q = min(1.0, t / 0.12)
    multiplica[..., 0] -= 0.55 * q * np.exp(-(r_suelo / 1.15) ** 2.5)

    # Luz del estallido sobre el suelo: 0,3 s.
    k = max(0.0, 1 - t / 0.3) ** 2
    if k > 0:
        bajo += k * 2.2 * np.exp(-(r_suelo / 2.6) ** 2)[..., None] * np.array((1.0, 0.62, 0.28), np.float32)

    # Onda expansiva: aro que recorre el suelo hasta 4 m en 0,35 s.
    u = t / 0.35
    if 0 < u < 1:
        radio = 4.0 * (1 - (1 - u) ** 2)
        aro = np.exp(-((r_suelo - radio) / (0.10 + 0.25 * u)) ** 2) * (1 - u) ** 1.5
        bajo += 0.5 * aro[..., None] * np.array((1.0, 0.9, 0.75), np.float32)

    # Coordenadas de pantalla en metros (x a la derecha, v hacia arriba) con el origen en el ancla.
    yy, xx = np.mgrid[0:px, 0:px].astype(np.float32)
    sx = (xx / px - ancla[0]) * encuadre
    sv = ((1 - yy / px) - ancla[1]) * encuadre

    # Chispas: balística simple, proyectada con la cámara ortográfica.
    rng = np.random.default_rng(semilla + 77)
    n = 46
    az = rng.uniform(0, math.tau, n)
    ce = rng.uniform(0.15, 1.0, n)
    vel = rng.uniform(5.0, 13.0, n)
    vida = rng.uniform(0.35, 0.9, n)
    arrastre = 2.2
    for i in range(n):
        if t >= vida[i]:
            continue
        se = math.sqrt(1 - ce[i] ** 2)
        d = np.array((math.cos(az[i]) * se, math.sin(az[i]) * se, ce[i])) * vel[i]

        def pos(tt):
            f = (1 - math.exp(-arrastre * tt)) / arrastre
            p = d * f + np.array((0, 0, 0.3 - 4.9 * tt * tt))
            p[2] = max(p[2], 0.02)
            return p[0], p[1] * math.sin(elev) + p[2] * math.cos(elev)

        (x1, v1), (x0, v0) = pos(t), pos(max(0.0, t - 0.045))
        ax, av = x1 - x0, v1 - v0
        largo = max(1e-4, ax * ax + av * av)
        s = np.clip(((sx - x0) * ax + (sv - v0) * av) / largo, 0, 1)
        dist2 = (sx - (x0 + s * ax)) ** 2 + (sv - (v0 + s * av)) ** 2
        brillo = (1 - t / vida[i]) ** 1.5
        ancho = 0.028
        sobre += (brillo * 1.6 * np.exp(-dist2 / ancho ** 2) * (0.35 + 0.65 * s))[..., None] * np.array((1.0, 0.72, 0.3), np.float32)

    # Destello: núcleo y halo a 0,5 m del suelo, más una raya horizontal; 0,12 s.
    k = max(0.0, 1 - t / 0.12)
    if k > 0:
        cv = 0.5 * math.cos(elev)
        r2 = sx * sx + (sv - cv) ** 2
        nucleo = np.exp(-r2 / (0.55 * (0.4 + k)) ** 2) * 6.0
        halo = np.exp(-np.sqrt(r2) / 1.5) * 1.2
        raya = np.exp(-((sv - cv) / 0.07) ** 2) * np.exp(-np.abs(sx) / 2.4) * 1.5
        sobre += (k ** 1.5) * ((nucleo + halo)[..., None] * np.array((1.0, 0.88, 0.62), np.float32)
                               + raya[..., None] * np.array((1.0, 0.75, 0.45), np.float32))
    return multiplica, bajo, sobre


# ------------------------------------------------------------------ entrada


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="empaquetar.py")
    ap.add_argument("--entrada", required=True)
    ap.add_argument("--destino", required=True)
    ap.add_argument("--nombre", required=True)
    ap.add_argument("--exposicion", type=float, default=1.0)
    ap.add_argument("--desvanecer", type=int, default=14, help="cuadros finales que se funden a transparente")
    ap.add_argument("--hoja-pasos", type=int, default=4, help="un cuadro de cada N en la hoja de contactos")
    ap.add_argument("--previa", action="store_true")
    ap.add_argument("--sin-atlas", action="store_true", help="solo hoja de contactos (iteración rápida)")
    a = ap.parse_args(args)

    info = json.load(open(os.path.join(a.entrada, "informe.json")))
    carpeta = os.path.join(a.entrada, "cuadros")
    presentes = sorted(int(f[1:4]) for f in os.listdir(carpeta) if f.endswith(".exr"))
    total, fps = info["cuadros"], info["fps"]
    encuadre, ancla, elev = info["encuadre_m"], info["ancla"], math.radians(info["elevacion"])
    os.makedirs(a.destino, exist_ok=True)

    cuadros = {}
    for c in presentes:
        f = leer_exr(os.path.join(carpeta, f"c{c:03d}.exr"))
        fundido = min(1.0, (total - c) / max(1, a.desvanecer)) if a.desvanecer else 1.0
        rgb = tono(f[..., :3], a.exposicion) * fundido
        alfa = np.clip(f[..., 3:4], 0, 1) * fundido
        cuadros[c] = np.concatenate([rgb, alfa], axis=2)
    px = next(iter(cuadros.values())).shape[0]
    fondo, mx, my = suelo(px, encuadre, ancla, elev)

    def componer(c, capas=None):
        f = cuadros[c]
        base = fondo
        if capas:
            base = fondo * capas[0] + capas[1]
        img = f[..., :3] + base * (1 - f[..., 3:4])
        if capas:
            img = img + capas[2]
        return a_bytes(a_srgb(tono(img, 1.0, 0.8) if capas else img))

    # Hoja de contactos.
    elegidos = [c for c in presentes if (c - 1) % a.hoja_pasos == 0] if len(presentes) > 24 else presentes
    escribir_jpg(os.path.join(a.destino, f"{a.nombre}_hoja.jpg"),
                 hoja([componer(c) for c in elegidos], min(8, len(elegidos))))
    print(f"[empaquetar] hoja: {len(elegidos)} cuadros {elegidos[:4]}…")
    if a.sin_atlas:
        return

    # Atlas.
    cols = filas = int(math.ceil(math.sqrt(total)))
    atlas = np.zeros((filas * px, cols * px, 4), np.uint8)
    caja = [px, px, 0, 0]
    for c, f in cuadros.items():
        y, x = divmod(c - 1, cols)
        rgba = np.concatenate([a_srgb(f[..., :3]), f[..., 3:4]], axis=2)
        atlas[y * px:(y + 1) * px, x * px:(x + 1) * px] = a_bytes(rgba)
        ocupa = np.argwhere((f[..., 3] > 0.01) | (f[..., :3].max(axis=2) > 0.01))
        if len(ocupa):
            (y0, x0), (y1, x1) = ocupa.min(axis=0), ocupa.max(axis=0)
            caja = [min(caja[0], x0), min(caja[1], y0), max(caja[2], x1), max(caja[3], y1)]
    ruta = os.path.join(a.destino, f"{a.nombre}.png")
    escribir_png(ruta, atlas)
    meta = dict(nombre=a.nombre, variante=info["variante"], semilla=info["semilla"], columnas=cols, filas=filas,
                cuadros=total, px=px, fps=fps, duracion_s=round(total / fps, 3), encuadre_m=encuadre,
                ancla=ancla, elevacion_grados=info["elevacion"], alfa="premultiplicado", espacio="sRGB",
                mezcla="ONE, ONE_MINUS_SRC_ALPHA", orden="izquierda→derecha, arriba→abajo",
                uso_cuadro_px=[int(v) for v in caja], kb=round(os.path.getsize(ruta) / 1024),
                calidad=info["calidad"], blender=info["blender"],
                segundos={k[2:]: v for k, v in info.items() if k.startswith("s_")})
    json.dump(meta, open(os.path.join(a.destino, f"{a.nombre}.json"), "w"), indent=1, ensure_ascii=False)
    print(f"[empaquetar] atlas {cols}×{filas} de {px} px → {meta['kb']} KB; uso del cuadro {meta['uso_cuadro_px']}")

    # Vista previa con las capas baratas.
    if a.previa:
        tmp = tempfile.mkdtemp(prefix="previa_")
        cola = int(fps * 0.6)
        vacio = np.zeros((px, px, 4), np.float32)
        for i in range(total + cola):
            c = i + 1
            cuadros.setdefault(c, vacio)
            capas = capas_baratas(i / fps, mx, my, px, encuadre, ancla, elev, info["semilla"])
            escribir_png(os.path.join(tmp, f"p{i:03d}.png"), componer(c, capas), nivel=3)
        mp4 = os.path.join(a.destino, f"{a.nombre}.mp4")
        if video(os.path.join(tmp, "p%03d.png"), fps, mp4, escala=2):
            print(f"[empaquetar] vista previa {mp4}")
        for f in os.listdir(tmp):
            os.remove(os.path.join(tmp, f))
        os.rmdir(tmp)


if __name__ == "__main__":
    main()
