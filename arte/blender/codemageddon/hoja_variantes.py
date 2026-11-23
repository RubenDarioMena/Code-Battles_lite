"""Monta una hoja de variantes con etiquetas (Python del sistema con Pillow).

python3 hoja_variantes.py --salida hoja.jpg --titulo "Luz × ancho del rojo" \
    --filas "luz −½" "luz 0" "luz +½" --columnas "rojo 3 mm" "rojo 4 mm" "rojo 5 mm" \
    --imagenes f0c0.jpg f0c1.jpg ... (fila a fila)
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

p = argparse.ArgumentParser()
p.add_argument('--salida', required=True)
p.add_argument('--titulo', default='')
p.add_argument('--filas', nargs='+', required=True)
p.add_argument('--columnas', nargs='+', required=True)
p.add_argument('--imagenes', nargs='+', required=True)
p.add_argument('--ancho', type=int, default=640, help='ancho de cada casilla')
a = p.parse_args()
nf, nc = len(a.filas), len(a.columnas)
assert len(a.imagenes) == nf * nc, 'hace falta una imagen por casilla'

ims = [Image.open(f).convert('RGB') for f in a.imagenes]
w = a.ancho
h = round(ims[0].height * w / ims[0].width)
ims = [im.resize((w, h), Image.LANCZOS) for im in ims]

def fuente(t):
    for ruta in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc'):
        try:
            return ImageFont.truetype(ruta, t)
        except OSError:
            pass
    return ImageFont.load_default()

f_tit, f_eje, f_cas = fuente(30), fuente(22), fuente(20)
margen_izq, margen_sup, sep = 150, 100, 6
hoja = Image.new('RGB', (margen_izq + nc * (w + sep), margen_sup + nf * (h + sep)), (18, 18, 20))
d = ImageDraw.Draw(hoja)
d.text((16, 14), a.titulo, font=f_tit, fill=(235, 235, 235))
for c, etiqueta in enumerate(a.columnas):
    d.text((margen_izq + c * (w + sep) + w // 2, margen_sup - 18), etiqueta, font=f_eje,
           fill=(255, 200, 120), anchor='ms')
for r, etiqueta in enumerate(a.filas):
    d.text((margen_izq - 14, margen_sup + r * (h + sep) + h // 2), etiqueta, font=f_eje,
           fill=(140, 210, 255), anchor='rm')
for k, im in enumerate(ims):
    r, c = divmod(k, nc)
    x, y = margen_izq + c * (w + sep), margen_sup + r * (h + sep)
    hoja.paste(im, (x, y))
    rotulo = f'{chr(65 + r)}{c + 1}'
    d.rectangle((x + 6, y + 6, x + 52, y + 36), fill=(0, 0, 0))
    d.text((x + 29, y + 21), rotulo, font=f_cas, fill=(255, 255, 255), anchor='mm')
hoja.save(a.salida, quality=88)
print(a.salida, hoja.size)
