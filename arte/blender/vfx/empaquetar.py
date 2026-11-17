"""Convierte los cuadros EXR de explosion.py en un atlas de flipbook listo para el motor.

Sin ventana (usa el Python de Blender: numpy para las cuentas y bpy solo para leer EXR):
    blender -b --factory-startup --python arte/blender/vfx/empaquetar.py -- \
        --entrada <carpeta de explosion.py>[,<otra>…] --destino <carpeta> --nombre tierra_p2
        [--exposicion 1.0] [--desvanecer 14] [--previa] [--hoja-pasos 4]

Escribe en `destino`:
- `<nombre>.png`: atlas de cuadros de izquierda a derecha y de arriba abajo (8 × 8 con una entrada;
  con varias, una fila por entrada: así se juntan las semillas de la bocanada). RGB con alfa
  **premultiplicado** y codificado en sRGB: el fuego (que emite sin tapar) y el humo (que tapa sin
  emitir) caben en la misma textura. En el motor se mezcla con ONE, ONE_MINUS_SRC_ALPHA.
- `<nombre>.json`: rejilla, fps, metros que cubre el cuadro, ancla, uso real del cuadro y las capas
  baratas de la receta (destello, luz, chispas, quemadura, onda expansiva y sombra).
- `<nombre>_hoja.jpg`: hoja de contactos sobre arena, para revisar sin reproducir.
- con `--previa`, `<nombre>.mp4`: el flipbook sobre el suelo con esas capas (`capas.py`), tal como
  las pondría el motor.
"""
import argparse
import json
import math
import os
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capas import ARENA, Vista, alcance_capas, capas_explosion, pegar, refractar, sombra_proyectada, suelo_arena  # noqa: E402
from comun import a_bytes, a_srgb, escribir_jpg, escribir_png, hoja, leer_exr, tono, video  # noqa: E402

ALTURA_AEREA = 2.5  # metros: altura de los drones del juego, para la vista previa de las variantes aéreas


# ------------------------------------------------------------------ entrada


def borde_suave(px, margen=0.07):
    """Máscara que lleva a cero los bordes del cuadro: ningún cuadro se corta en seco."""
    d = (np.arange(px, dtype=np.float32) + 0.5) / px
    d = np.clip(np.minimum(d, 1 - d) / margen, 0, 1)
    d = d * d * (3 - 2 * d)
    return (d[:, None] * d[None, :])[..., None]


def cargar(entrada, exposicion, desvanecer):
    """Cuadros de una carpeta de explosion.py como {n: RGBA lineal premultiplicado}, y su informe."""
    info = json.load(open(os.path.join(entrada, "informe.json")))
    carpeta = os.path.join(entrada, "cuadros")
    presentes = sorted(int(f[1:4]) for f in os.listdir(carpeta) if f.endswith(".exr"))
    total = info["cuadros"]
    bucle, solape = info.get("bucle", False), info.get("solape", 0)
    cuadros, mascara = {}, None
    for c in presentes:
        f = leer_exr(os.path.join(carpeta, f"c{c:03d}.exr"))
        if mascara is None:
            mascara = borde_suave(f.shape[0])
        fundido = min(1.0, (total - c) / max(1, desvanecer)) if desvanecer and not bucle else 1.0
        rgb = tono(f[..., :3], exposicion) * fundido
        alfa = np.clip(f[..., 3:4], 0, 1) * fundido
        cuadros[c] = np.concatenate([rgb, alfa], axis=2) * mascara
    if bucle:
        # Cierra el bucle: los primeros cuadros se funden desde los que siguen al último.
        for c in range(1, solape + 1):
            if c in cuadros and total + c in cuadros:
                w = (c - 1) / solape
                cuadros[c] = cuadros[c] * w + cuadros[total + c] * (1 - w)
        cuadros = {c: f for c, f in cuadros.items() if c <= total}
    return cuadros, info


def previa(cuadros, info, ruta):
    """Vídeo del flipbook sobre el suelo, con las capas baratas, la sombra y sitio para la onda."""
    total, fps = info["cuadros"], info["fps"]
    encuadre, ancla, escala = info["encuadre_m"], info["ancla"], info.get("escala", 1.0)
    capas, aerea = info.get("capas", {}), not info.get("suelo", True)
    px = next(iter(cuadros.values())).shape[0]
    ppm = px / encuadre
    altura = ALTURA_AEREA * max(1.0, escala) if aerea else 0.0
    alcance = max(encuadre * 0.85, alcance_capas(capas, escala, encuadre, aerea))
    ancho = int(2 * alcance * ppm) // 2 * 2
    # Sitio para el humo por arriba y para la onda por abajo; el estallido queda centrado en horizontal.
    sen = math.sin(math.radians(info["elevacion"]))
    onda_px = capas.get("radio_onda", 0) * sen * ppm * 1.06 if capas.get("onda", 0) > 0 else 0
    arriba = max((1 - ancla[1]) * px * 1.04 + altura * ppm * 0.6, onda_px)
    abajo = max(ancla[1] * px * 1.3 + altura * ppm * 0.6, onda_px)
    alto = int(arriba + abajo) // 2 * 2
    vista = Vista(ancho, alto, ppm, info["elevacion"], centro=(0.0, (arriba - alto / 2) / (sen * ppm)))
    base = suelo_arena(vista)
    ex, ey = vista.px(0, 0, altura)
    _, ey_suelo = vista.px(0, 0, 0)
    sx, sv = vista.gx, vista.gy * vista.sen - altura * vista.cos
    tmp = tempfile.mkdtemp(prefix="previa_")
    bucle = info.get("bucle", False)
    cola = int(fps * 0.8)
    vacio = np.zeros((px, px, 4), np.float32)
    quemado = np.ones((alto, ancho, 3), np.float32)
    for i in range(total * 3 if bucle else total + cola):   # un bucle se ve tres veces seguidas
        f = cuadros.get(i % total + 1 if bucle else i + 1, vacio)
        k = {} if bucle else capas_explosion(i / fps, vista.gx, vista.gy, sx, sv, capas, escala, info["semilla"],
                                             vista.sen, vista.cos, aerea)
        if "mult" in k:
            quemado = k["mult"] if i / fps < 0.2 or "despl" in k else quemado
        img = base * (k["mult"] if "mult" in k else quemado)
        if "despl" in k:
            img = refractar(img, np.stack([k["despl"][..., 0], -k["despl"][..., 1]], axis=2) * ppm)
        if "bajo" in k:
            img = img + k["bajo"]
        if "velo" in k:
            img = k["velo"][..., :3] + img * (1 - k["velo"][..., 3:4])
        x_izq, y_arr = int(round(ex - ancla[0] * px)), int(round(ey - (1 - ancla[1]) * px))
        if capas.get("sombra", 0) > 0:
            oscuridad = np.zeros((alto, ancho), np.float32)
            sombra_proyectada(oscuridad, f[..., 3], vista, x_izq + px / 2, ey_suelo,
                              ey_suelo - (y_arr + px), capas["sombra"])
            img = img * (1 - oscuridad[..., None])
        pegar(img, f, x_izq, y_arr)
        if "sobre" in k:
            img = img + k["sobre"]
        escribir_png(os.path.join(tmp, f"p{i:03d}.png"), a_bytes(a_srgb(tono(img, 1.0, 0.8))), nivel=3)
    hecho = video(os.path.join(tmp, "p%03d.png"), fps, ruta, escala=2 if ancho <= 960 else 1)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    return hecho


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser(prog="empaquetar.py")
    ap.add_argument("--entrada", required=True, help="carpeta de explosion.py; varias separadas por comas = una fila cada una")
    ap.add_argument("--destino", required=True)
    ap.add_argument("--nombre", required=True)
    ap.add_argument("--exposicion", type=float, default=1.0)
    ap.add_argument("--desvanecer", type=int, default=14, help="cuadros finales que se funden a transparente")
    ap.add_argument("--hoja-pasos", type=int, default=4, help="un cuadro de cada N en la hoja de contactos")
    ap.add_argument("--previa", action="store_true")
    ap.add_argument("--sin-atlas", action="store_true", help="solo hoja de contactos (iteración rápida)")
    a = ap.parse_args(args)

    entradas = a.entrada.split(",")
    series = [cargar(e, a.exposicion, a.desvanecer) for e in entradas]
    cuadros, info = series[0]
    presentes = sorted(cuadros)
    total, fps = info["cuadros"], info["fps"]
    os.makedirs(a.destino, exist_ok=True)
    px = next(iter(cuadros.values())).shape[0]
    fondo = np.zeros((px, px, 3), np.float32) + np.array(ARENA, np.float32)
    fondo[::px // 8, :] *= 0.9   # retícula solo para dar escala a la hoja: un octavo del cuadro
    fondo[:, ::px // 8] *= 0.9

    def componer(f):
        return a_bytes(a_srgb(f[..., :3] + fondo * (1 - f[..., 3:4])))

    # Hoja de contactos.
    if len(series) > 1:
        elegidos = [(n, c) for n in range(len(series)) for c in sorted(series[n][0])]
        escribir_jpg(os.path.join(a.destino, f"{a.nombre}_hoja.jpg"),
                     hoja([componer(series[n][0][c]) for n, c in elegidos], len(series[0][0])))
    else:
        elegidos = [c for c in presentes if (c - 1) % a.hoja_pasos == 0] if len(presentes) > 24 else presentes
        escribir_jpg(os.path.join(a.destino, f"{a.nombre}_hoja.jpg"),
                     hoja([componer(cuadros[c]) for c in elegidos], min(8, len(elegidos))))
    print(f"[empaquetar] hoja: {len(elegidos)} cuadros")
    if a.sin_atlas:
        return

    # Atlas.
    if len(series) > 1:
        cols, filas = total, len(series)
    else:
        cols = filas = int(math.ceil(math.sqrt(total)))
    atlas = np.zeros((filas * px, cols * px, 4), np.uint8)
    caja = [px, px, 0, 0]
    for n, (cs, _) in enumerate(series):
        for c, f in cs.items():
            y, x = (n, c - 1) if len(series) > 1 else divmod(c - 1, cols)
            rgba = np.concatenate([a_srgb(f[..., :3]), f[..., 3:4]], axis=2)
            atlas[y * px:(y + 1) * px, x * px:(x + 1) * px] = a_bytes(rgba)
            ocupa = np.argwhere((f[..., 3] > 0.01) | (f[..., :3].max(axis=2) > 0.01))
            if len(ocupa):
                (y0, x0), (y1, x1) = ocupa.min(axis=0), ocupa.max(axis=0)
                caja = [min(caja[0], x0), min(caja[1], y0), max(caja[2], x1), max(caja[3], y1)]
    ruta = os.path.join(a.destino, f"{a.nombre}.png")
    escribir_png(ruta, atlas)
    meta = dict(nombre=a.nombre, variante=info["variante"], poder=info.get("poder", 2),
                semillas=[i["semilla"] for _, i in series], columnas=cols, filas=filas,
                cuadros=total, px=px, fps=fps, duracion_s=round(total / fps, 3), encuadre_m=info["encuadre_m"],
                escala=info.get("escala", 1.0), suelo=info.get("suelo", True), bucle=info.get("bucle", False),
                ancla=info["ancla"], elevacion_grados=info["elevacion"], alfa="premultiplicado", espacio="sRGB",
                mezcla="ONE, ONE_MINUS_SRC_ALPHA",
                orden="una fila por semilla" if len(series) > 1 else "izquierda→derecha, arriba→abajo",
                capas=info.get("capas", {}),
                uso_cuadro_px=[int(v) for v in caja], kb=round(os.path.getsize(ruta) / 1024),
                calidad=info["calidad"], blender=info["blender"],
                segundos={k[2:]: v for k, v in info.items() if k.startswith("s_")})
    json.dump(meta, open(os.path.join(a.destino, f"{a.nombre}.json"), "w"), indent=1, ensure_ascii=False)
    print(f"[empaquetar] atlas {cols}×{filas} de {px} px → {meta['kb']} KB; uso del cuadro {meta['uso_cuadro_px']}")

    # Vista previa con las capas baratas.
    if a.previa and len(series) == 1:
        mp4 = os.path.join(a.destino, f"{a.nombre}.mp4")
        if previa(cuadros, info, mp4):
            print(f"[empaquetar] vista previa {mp4}")


if __name__ == "__main__":
    main()
