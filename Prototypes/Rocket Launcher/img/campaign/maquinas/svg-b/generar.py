#!/usr/bin/env python3
"""Propuesta B de las máquinas de campaña, dibujada solo desde la descripción.

Unidad = 1 píxel de los robots (bot-01 y frk-01 miden 48x32). Cada máquina ocupa 96x64.
Proyección oblicua única: un punto del suelo (x, y) con altura z se dibuja en (x, y - z).
Así la cara superior no se deforma y la altura se lee en el frente visible.

Uso: python3 generar.py <carpeta de salida>
"""
import math, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
K = "#171b26"                      # contorno, el mismo de los robots
#          base       luz        sombra
NAVY = ("#252a36", "#3a4150", "#1b1f29")     # losa y ruedas
STEEL = ("#9aa3b2", "#c3cad5", "#6c7584")    # herramienta intercambiable
WHITE = ("#f2f4f7", "#ffffff", "#b4bcc9")    # mecanismo móvil (como el brazo del obrero)
ORANGE = ("#f08a24", "#ffb04d", "#b85e12")   # pieza (como pieza-naranja)
YELLOW = ("#e3a81b", "#f6cc4a", "#a8760f")
PURPLE = ("#7b4cc4", "#9a72dc", "#55318f")
GREEN = ("#2f9a45", "#53bd68", "#1e6a30")
TEAL = ("#1e9c9c", "#45c0bd", "#136c70")
SLATE = ("#5d6e8a", "#8193ad", "#3f4c63")
IRON = ("#474450", "#615e6c", "#2e2c36")
BRICK = ("#b5482c", "#d46a48", "#7d2f1c")
ROSE = ("#c0477d", "#dc6f9d", "#862d55")
IN_C, OUT_C = "#3fc1e0", "#f6b817"           # borde de bandeja de entrada / de salida


def rect(x, y, w, h, fill, rx=0.8, stroke=K, sw=1, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ""
    return f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{rx:g}" fill="{fill}"{s}{extra}/>'


def circ(x, y, r, fill, stroke=K, sw=1):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    return f'<circle cx="{x:g}" cy="{y:g}" r="{r:g}" fill="{fill}"{s}/>'


def path(d, fill="none", stroke=K, sw=1, extra=""):
    s = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"' if stroke else ""
    return f'<path d="{d}" fill="{fill}"{s}{extra}/>'


def blk(x, y, w, dep, z0, z1, col, rx=0.8, hi=True):
    """Bloque: planta (x, y, w, dep) en el suelo, de altura z0 a z1."""
    o = rect(x, y - z1, w, dep + z1 - z0, col[2], rx) + rect(x, y - z1, w, dep, col[0], rx)
    if hi and w > 5 and dep > 4:
        o += rect(x + 1.5, y - z1 + 1.5, w - 3, 1, col[1], 0.5, None)
    return o


def cyl(cx, cy, r, z0, z1, col):
    """Cilindro vertical con centro (cx, cy) en el suelo."""
    return (path(f"M{cx-r:g} {cy-z1:g} V{cy-z0:g} A{r:g} {r:g} 0 0 0 {cx+r:g} {cy-z0:g} V{cy-z1:g} Z", col[2])
            + circ(cx, cy - z1, r, col[0]))


def prism(pts, z0, z1, col):
    """Prisma de planta poligonal (lista de puntos del suelo)."""
    d = lambda dz: "M" + " L".join(f"{x:g} {y - dz:g}" for x, y in pts) + " Z"
    steps = [z0 + i * 0.5 for i in range(int((z1 - z0) * 2) + 1)]
    return ("".join(path(d(z), K) for z in steps)
            + "".join(path(d(z), col[2], None) for z in steps)
            + path(d(z1), col[0]))


def slab(x, y, w, dep):
    return blk(x, y, w, dep, 0, 2, NAVY, 2, hi=False) + "".join(
        circ(px, py - 2, 0.7, NAVY[1], None) for px in (x + 2.5, x + w - 2.5) for py in (y + 2.5, y + dep - 2.5))


def tray(x, y, kind, w=14, dep=12):
    """Bandeja a ras de suelo. kind='in' (borde cian, a la izquierda) u 'out' (borde amarillo)."""
    c = IN_C if kind == "in" else OUT_C
    o = blk(x, y, w, dep, 0, 2, STEEL, 1, hi=False)
    o += rect(x + 1.5, y - 0.5, w - 3, dep - 3, STEEL[2], 0.5, None)
    o += rect(x + 1.5, y - 0.5, w - 3, 1.2, c, 0.5, None) + rect(x + 1.5, y + dep - 4.7, w - 3, 1.2, c, 0.5, None)
    mx, my = x + w / 2, y + dep / 2 - 2
    o += path(f"M{mx-1.5:g} {my-2:g} L{mx+1:g} {my:g} L{mx-1.5:g} {my+2:g}", "none", STEEL[1], 1.2)
    return o


def console(x, y):
    """Consola de programación: misma pieza en todas las máquinas. El piloto es el círculo."""
    return (blk(x, y, 8, 4, 2, 6, NAVY, 0.8, hi=False) + rect(x + 1.2, y - 4.8, 3.6, 2.2, "#3fc1e0", 0.3, None)
            + f'<circle id="piloto" cx="{x+6.2:g}" cy="{y-3.7:g}" r="1" fill="#59606e" data-encendido="#7dff6a"/>')


def bolts(pts, c):
    return "".join(circ(x, y, 0.7, c, None) for x, y in pts)


def G(id_, content, extra=""):
    return f'  <g id="{id_}"{extra}>\n    ' + content.replace("><", ">\n    <") + "\n  </g>\n"


def svg(name, title, desc, body, defs=""):
    s = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64" width="384" height="256">
  <title>{title}</title>
  <desc>{desc}</desc>
  <defs>{defs}</defs>
{body}</svg>
'''
    open(os.path.join(OUT, name + ".svg"), "w").write(s)


# ------------------------------------------------------------------ PRENSA
def prensa():
    def col(x):
        return (blk(x, 38, 10, 20, 2, 34, YELLOW, 1.2)
                + rect(x + 3.5, 30, 3, 18, YELLOW[0], 1, None)            # nervio
                + bolts([(x + 5, 27), (x + 5, 51)], YELLOW[1]))
    bancada = blk(34, 42, 28, 14, 2, 6, NAVY, 0.8, hi=False) + rect(35, 50.5, 26, 3, "url(#franjas)", 0.3, None)
    pieza = blk(40, 45, 16, 8, 6, 9, ORANGE)
    cabezal = blk(36, 44, 24, 9, 22, 26, WHITE, 0.6, hi=False)
    troquel = path("M41 27 H55 V30 L52 33 H44 L41 30 Z", STEEL[0]) + rect(42.5, 28, 11, 1, STEEL[1], 0.5, None)
    puente = (blk(32, 42, 32, 12, 26, 34, YELLOW, 0.8)
              + cyl(48, 48, 4, 34, 37, IRON) + circ(48, 11, 1.8, WHITE[0], K, 0.6))
    body = (G("bandejas", tray(4, 44, "in") + tray(78, 44, "out"), ' data-entrada="11,50" data-salida="85,50"')
            + G("bastidor", slab(20, 34, 56, 28) + col(22) + col(64) + bancada)
            + G("pieza", pieza, ' data-ancla="48,45"')
            + G("cabezal", cabezal + G("troquel", troquel, ' data-ancla="48,27"').strip(), ' data-recorrido-y="0..7"')
            + G("puente", puente)
            + G("consola", console(66, 57)))
    defs = ('<pattern id="franjas" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            f'<rect width="4" height="4" fill="{OUT_C}"/><rect width="2" height="4" fill="{K}"/></pattern>')
    svg("prensa", "Prensa", "Bastidor en H visto desde arriba: dos columnas altas y un puente. "
        "El cabezal blanco baja con el troquel de acero; la pieza queda a la vista en la bancada.", body, defs)


# ------------------------------------------------------------------ MOLDEADORA
def aletas(cx, cy, r=3.2, fin=6.2, w=1.3):
    """Planta de la base con aletas: círculo con cuatro aletas."""
    p = []
    for i in range(4):
        a = math.pi / 2 * i
        ca, sa = math.cos(a), math.sin(a)
        for dx, dy in ((r * 0.8, -w), (fin, -w), (fin, w), (r * 0.8, w)):
            p.append((cx + dx * ca - dy * sa, cy + dx * sa + dy * ca))
        b = a + math.pi / 4
        p.append((cx + r * math.cos(b), cy + r * math.sin(b)))
    return "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in p) + " Z"


def moldeadora():
    cil = lambda y: (rect(22, y - 3.5, 19, 7, STEEL[0], 2.5) + rect(24, y - 2, 15, 1, STEEL[1], 0.5, None)
                     + rect(22, y + 1.5, 19, 1.5, STEEL[2], 0.5, None) + rect(39, y - 4.5, 3.5, 9, OUT_C, 1))
    bancada = blk(21, 26, 22, 26, 2, 6, PURPLE, 1, hi=False)
    carcasa = (blk(42, 24, 34, 32, 2, 12, PURPLE, 1.5)
               + rect(45, 16, 28, 25, NAVY[2], 1)
               + bolts([(43.7, 14), (74.3, 14), (43.7, 42), (74.3, 42)], PURPLE[1]))
    cav = lambda cx: path(aletas(cx, 28.5), NAVY[0], K, 0.6)
    fijo = (rect(61.5, 18, 10, 21, STEEL[0], 0.6) + rect(62.5, 19, 8, 1, STEEL[1], 0.5, None)
            + f'<g clip-path="url(#cf)">{cav(61.5)}</g>')
    movil = (rect(41, 21.5, 6, 2.5, WHITE[0], 0.5, K, 0.6) + rect(41, 33.5, 6, 2.5, WHITE[0], 0.5, K, 0.6)
             + rect(46.5, 18, 10, 21, WHITE[0], 0.6) + rect(47.5, 19, 8, 1, WHITE[1], 0.5, None)
             + f'<g clip-path="url(#cm)">{cav(56.5)}</g>')
    defs = ('<clipPath id="cf"><rect x="62" y="18.5" width="9" height="20"/></clipPath>'
            '<clipPath id="cm"><rect x="47" y="18.5" width="9" height="20"/></clipPath>')
    body = (G("bandejas", tray(4, 40, "in") + tray(80, 36, "out"), ' data-entrada="11,46" data-salida="87,42"')
            + G("carcasa", slab(18, 22, 60, 38) + bancada + carcasa)
            + G("molde-fijo", fijo, ' data-ancla="61.5,28.5"')
            + G("molde-movil", movil, ' data-ancla="56.5,28.5" data-recorrido-x="0..5"')
            + G("cilindros", cil(22.8) + cil(34.8))
            + G("consola", console(66, 55)))
    svg("moldeadora", "Moldeadora", "Molde partido que se abre en horizontal: mitad fija de acero y mitad móvil blanca "
        "empujada por dos cilindros. La cavidad es la planta de la base con aletas.", body, defs)


# ------------------------------------------------------------------ MEZCLADORA
def mezcladora():
    cx, cy, top = 48, 41, 41 - 13
    tina = cyl(cx, cy, 19, 2, 13, GREEN) + path(f"M{cx-16.5} {top-5} A17.5 17.5 0 0 1 {cx+4} {top-17}", "none", GREEN[1], 1)
    contenido = (circ(cx, top, 14.5, GREEN[2])
                 + "".join(path(f"M{cx + r*math.cos(a):.1f} {top + r*math.sin(a):.1f} A{r} {r} 0 0 1 "
                                f"{cx + r*math.cos(a+1.1):.1f} {top + r*math.sin(a+1.1):.1f}", "none", GREEN[1], 1.2)
                           for r, a in ((11, 0.4), (7.5, 2.5), (11.5, 4.4))))
    aspa = lambda ang: (f'<g transform="rotate({ang} {cx} {top})">' + rect(cx - 2, top - 13.5, 4, 13, WHITE[0], 1.2)
                        + rect(cx - 0.9, top - 12, 1, 9, WHITE[1], 0.5, None) + "</g>")
    aspas = aspa(0) + aspa(120) + aspa(240) + circ(cx, top, 3.2, WHITE[0]) + circ(cx - 0.7, top - 0.7, 1, WHITE[1], None)
    boca = blk(66, 37, 13, 8, 2, 5, STEEL, 0.6, hi=False) + rect(65.5, 30, 3.5, 11, OUT_C, 1)
    body = (G("bandejas", tray(6, 36, "in") + tray(80, 36, "out"), ' data-entrada="13,42" data-salida="87,42"')
            + G("tina", slab(24, 22, 48, 40) + boca + tina)
            + G("contenido", contenido, f' data-ancla="{cx},{top}"')
            + G("aspas", aspas, f' data-ancla="{cx},{top}" data-giro="0..360"')
            + G("consola", console(63, 58)))
    svg("mezcladora", "Mezcladora", "Tina circular verde con tres aspas blancas y boca de salida. "
        "Es la única máquina redonda.", body)


# ------------------------------------------------------------------ ENSAMBLADORA
def ensambladora():
    Y = [(22, 22), (40, 22), (51, 33), (74, 33), (74, 45), (51, 45), (40, 56), (22, 56),
         (22, 44), (35, 44), (40, 39), (35, 34), (22, 34)]
    carcasa = prism(Y, 2, 11, TEAL)
    luz = path("M24 13 H39.5 L50 23.5 H72", "none", TEAL[1], 1)
    juntas = path("M30 11.5 V22.5 M30 33.5 V44.5 M64 22.5 V33.5", "none", TEAL[2], 0.8)
    flecha = lambda x, y: path(f"M{x-1.5} {y-2} L{x+1} {y} L{x-1.5} {y+2}", "none", WHITE[0], 1.2)
    marcas = flecha(26, 17) + flecha(26, 39) + flecha(69, 28)
    ventana = circ(48, 28, 4.2, NAVY[2]) + path("M45.5 28 H50.5 M48 25.5 V30.5", "none", WHITE[0], 1.2)
    body = (G("bandejas", tray(6, 22, "in") + tray(6, 44, "in") + tray(78, 33, "out"),
              ' data-entrada-a="13,28" data-entrada-b="13,50" data-salida="85,39"')
            + G("carcasa", slab(20, 20, 56, 40) + carcasa + luz + juntas + marcas)
            + G("ventana", ventana, ' data-ancla="48,28"')
            + G("consola", console(62, 57)))
    svg("ensambladora", "Ensambladora", "La carcasa misma tiene forma de Y: dos brazos de entrada y un tronco de salida. "
        "Por la ventana del cruce se ve la cruceta blanca que une las piezas.", body)


# ------------------------------------------------------------------ CNC
def cnc():
    mesa = (blk(22, 24, 52, 30, 2, 7, SLATE, 1)
            + "".join(rect(25, y, 46, 0.9, SLATE[2], 0.4, None) for y in (22, 26.5, 31, 35.5, 40, 44.5)))
    pieza = (blk(34, 29, 28, 15, 7, 9, ORANGE, 0.6)
             + "".join(rect(x, y, 3, 3, NAVY[0], 0.5, K, 0.6) for x in (32.5, 60.5) for y in (20.5, 33.5)))
    pata = lambda x: blk(x, 26, 5, 5, 7, 18, WHITE, 0.6, hi=False)
    portico = (pata(20.5) + pata(70.5) + rect(26, 23, 44, 1.5, "#000", 0.5, None, 0, ' opacity=".22"')
               + blk(20.5, 26, 55, 5, 14, 18, WHITE, 0.8, hi=False) + rect(22, 9.3, 52, 1, WHITE[1], 0.5, None))
    cabezal = (path("M33 22 H37 L35 26.5 Z", STEEL[0], K, 0.6)
               + blk(31, 25, 8, 7, 10, 20, IRON, 0.8, hi=False) + rect(32.5, 6.3, 5, 2.4, IN_C, 0.5, K, 0.6))
    body = (G("bandejas", tray(4, 36, "in") + tray(80, 36, "out"), ' data-entrada="11,42" data-salida="87,42"')
            + G("mesa", slab(18, 20, 60, 40) + mesa)
            + G("pieza", pieza, ' data-ancla="48,27.5"')
            + G("portico", portico + G("cabezal", cabezal, ' data-punta="35,26.5" data-recorrido-x="0..28"').strip(),
                ' data-recorrido-y="0..12"')
            + G("consola", console(66, 59)))
    svg("cnc", "CNC", "Mesa ranurada abierta. El pórtico blanco se mueve en Y y el cabezal corre sobre él en X.", body)


# ------------------------------------------------------------------ FUNDIDORA
def fundidora():
    pedestal = (blk(22, 32, 28, 22, 2, 16, IRON, 1) + rect(27, 45, 18, 3, OUT_C, 1, K, 0.6)
                + blk(24, 42, 4, 4, 16, 23, WHITE, 0.5, hi=False))             # actuador del volcado
    crisol = (path("M46 14 L55 17.5 L47 22.5 Z", BRICK[0])
              + cyl(36, 43, 12, 16, 25, BRICK) + path("M25.5 14 A11 11 0 0 1 38 7.2", "none", BRICK[1], 1)
              + circ(36, 18, 8.5, NAVY[2]))
    metal = (path("M27.6 19 A8.5 8.5 0 0 0 44.4 19 Q36 15.5 27.6 19 Z", "#ff7a1a", None)
             + path("M31 19.6 Q36 17.6 41 19.6", "none", "#ffc04d", 1))
    banco = blk(54, 38, 22, 18, 2, 6, IRON, 1, hi=False)
    molde = (blk(56, 40, 18, 14, 6, 10, STEEL, 0.8) + circ(65, 38, 4.6, NAVY[0], K, 0.6)
             + path("M61.2 39.5 A4 4 0 0 0 68.8 39.5", "none", NAVY[1], 0.8))
    body = (G("bandejas", tray(4, 38, "in") + tray(80, 40, "out"), ' data-entrada="11,44" data-salida="87,46"')
            + G("base", slab(18, 24, 60, 36) + pedestal + banco)
            + G("molde", molde, ' data-ancla="65,38"')
            + G("crisol", crisol + G("metal", metal).strip(), ' data-pico="55,17.5" data-caida="65,38"')
            + G("consola", console(44, 59)))
    svg("fundidora", "Fundidora", "Crisol de ladrillo sobre un pedestal alto y molde de acero en un banco bajo. "
        "El frente del pedestal enseña el desnivel: el chorro cae del pico (55,17.5) a la cavidad (65,38).", body)


# ------------------------------------------------------------------ MONTAJE DE BASE
def montaje():
    banco = (blk(24, 26, 48, 30, 2, 7, ROSE, 1)
             + rect(37, 22, 2, 24, ROSE[2], 0.5, None) + rect(57, 22, 2, 24, ROSE[2], 0.5, None))   # cunas de los ejes
    rueda = lambda x, y: rect(x, y, 9, 4.5, NAVY[0], 1.5) + rect(x + 1.5, y + 1, 6, 0.9, NAVY[1], 0.4, None)
    pieza = (rect(37.4, 23, 1.2, 22, STEEL[0], 0.3, K, 0.5) + rect(57.4, 23, 1.2, 22, STEEL[0], 0.3, K, 0.5)
             + rect(37, 27, 22, 14, NAVY[0], 1) + rect(39, 28.5, 18, 1, NAVY[1], 0.4, None)
             + bolts([(39.5, 32), (56.5, 32), (39.5, 38), (56.5, 38)], NAVY[1])
             + "".join(rueda(x, y) for x in (33.5, 53.5) for y in (22, 40)))
    emp = lambda i, y: f'<g id="{i}">' + blk(30, y, 36, 3, 7, 10, WHITE, 0.6, hi=False) + "</g>"
    body = (G("bandejas", tray(6, 36, "in") + tray(78, 36, "out"), ' data-entrada="13,42" data-salida="85,42"')
            + G("banco", slab(20, 22, 56, 38) + banco)
            + G("empujadores", emp("empujador-fondo", 26) + emp("empujador-frente", 55),
                ' data-recorrido-y="fondo 0..3, frente 0..-3"')
            + G("pieza", pieza, ' data-ancla="48,34"')
            + G("consola", console(63, 59)))
    svg("montaje-base", "Montaje de base (propuesta)", "Banco con dos cunas para los ejes y dos empujadores blancos "
        "que calan las ruedas. Sale la base del montacargas tal como es en frk-01-base-ruedas.", body)


prensa(); moldeadora(); mezcladora(); ensambladora(); cnc(); fundidora(); montaje()
print(sorted(os.listdir(OUT)))
