"""Utilidades compartidas por los scripts de VFX: nodos, lectura de EXR, tono, PNG y vídeo.

Se usa desde el Python de Blender (numpy para las cuentas; bpy solo para nodos, EXR y JPEG).
Cada script añade su carpeta a sys.path antes de `import comun`.
"""
import os
import shutil
import struct
import subprocess
import zlib

import bpy
import numpy as np


def nodos(id_):
    """Árbol de nodos vacío de un material o un mundo, en Blender 4.x y 5.x."""
    if id_.node_tree is None:
        id_.use_nodes = True
    nt = id_.node_tree
    nt.nodes.clear()
    return nt


def leer_exr(ruta):
    """RGBA lineal con alfa asociado, fila superior primero."""
    im = bpy.data.images.load(ruta, check_existing=False)
    w, h = im.size
    a = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)[::-1].copy()


def tono(x, expo=1.0, codo=0.6):
    """Lineal hasta `codo` y hombro exponencial después: la luz se va a amarillo y blanco sin recortarse."""
    x = np.maximum(x * expo, 0.0)
    return np.where(x <= codo, x, codo + (1 - codo) * (1 - np.exp(-(x - codo) / (1 - codo))))


def a_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def a_bytes(x):
    return np.clip(np.rint(x * 255.0), 0, 255).astype(np.uint8)


def escribir_png(ruta, a, nivel=9):
    """PNG de 8 bits sin dependencias. Los datos se guardan tal cual (no se desasocia el alfa)."""
    h, w, c = a.shape
    filas = a.reshape(h, w * c).astype(np.int16)
    candidatos = []
    for filtro in ((1, 2) if nivel >= 9 else (1,)):  # Sub y Up: el humo es suave y así comprime mucho mejor
        previo = np.zeros_like(filas)
        if filtro == 1:
            previo[:, c:] = filas[:, :-c]
        else:
            previo[1:] = filas[:-1]
        dif = ((filas - previo) & 0xFF).astype(np.uint8)
        crudo = np.concatenate([np.full((h, 1), filtro, np.uint8), dif], axis=1).tobytes()
        candidatos.append(zlib.compress(crudo, nivel))
    datos = min(candidatos, key=len)

    def trozo(tipo, d):
        return struct.pack(">I", len(d)) + tipo + d + struct.pack(">I", zlib.crc32(tipo + d) & 0xFFFFFFFF)

    with open(ruta, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + trozo(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, {3: 2, 4: 6}[c], 0, 0, 0))
                + trozo(b"IDAT", datos) + trozo(b"IEND", b""))


def escribir_jpg(ruta, rgb8, calidad=88):
    h, w, _ = rgb8.shape
    im = bpy.data.images.new("hoja", w, h, alpha=False)
    px = np.ones((h, w, 4), np.float32)
    px[..., :3] = rgb8[::-1].astype(np.float32) / 255.0
    im.pixels.foreach_set(px.ravel())
    sc = bpy.context.scene
    sc.view_settings.view_transform = "Standard"
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = calidad
    im.save_render(ruta, scene=sc)
    bpy.data.images.remove(im)


def hoja(cuadros8, columnas):
    """Une cuadros RGB de 8 bits del mismo tamaño en una hoja de contactos."""
    h, w, _ = cuadros8[0].shape
    filas = -(-len(cuadros8) // columnas)
    out = np.zeros((filas * h, columnas * w, 3), np.uint8)
    for i, c in enumerate(cuadros8):
        y, x = divmod(i, columnas)
        out[y * h:(y + 1) * h, x * w:(x + 1) * w] = c
    return out


def video(patron, fps, salida, escala=1):
    """MP4 H.264 a partir de una secuencia PNG. Devuelve False si no hay ffmpeg."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("[vfx] sin ffmpeg: no se genera", os.path.basename(salida))
        return False
    filtro = f"scale=iw*{escala}:ih*{escala}:flags=bicubic," if escala != 1 else ""
    subprocess.run([ffmpeg, "-v", "error", "-y", "-framerate", str(fps), "-i", patron,
                    "-vf", filtro + "pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p", "-c:v", "libx264",
                    "-crf", "20", "-movflags", "+faststart", salida], check=True)
    return True
