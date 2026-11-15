#!/usr/bin/env python3
"""Genera los SVG base de las máquinas de campaña (192x128, misma proporción 3:2 que los robots 48x32)."""
import math, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

STYLE = """
  .o{stroke:#171b26;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}
  .t{stroke:#171b26;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
  .n{stroke:none}
  .k{fill:#171b26}
  .d{fill:#343944}.m{fill:#4d5461}.l{fill:#6f7786}
  .s{fill:#aab2bf}.h{fill:#dfe4ea}.w{fill:#f6f8fa}
  .y{fill:#f6b817}.yd{fill:#c2870a}
  .g{fill:#1f6a2c}.gl{fill:#35a043}
  .f{fill:#ff7a1a}.fl{fill:#ffc04d}
  .hi{fill:#fff;opacity:.22}.sh{fill:#000;opacity:.22}
"""
DEFS = """<pattern id="franjas" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="12" height="12" fill="#f6b817"/><rect width="6" height="12" fill="#22262f"/>
  </pattern>"""


def R(x, y, w, h, c, rx=2, extra=""):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="{c}"{extra}/>'


def C(x, y, r, c, extra=""):
    return f'<circle cx="{x}" cy="{y}" r="{r}" class="{c}"{extra}/>'


def P(d, c, extra=""):
    return f'<path d="{d}" class="{c}"{extra}/>'


def box(x, y, w, h, d, top="m", front="d", rx=3):
    """Caja vista casi cenital: cara superior (x,y,w,h) y frente visible de altura d."""
    return (R(x, y + h - rx - 1, w, d + rx + 1, front + " o", rx)
            + R(x, y, w, h, top + " o", rx)
            + R(x + 3, y + 2.5, w - 6, 2.5, "hi n", 1))


def bolt(x, y, r=2.4):
    return C(x, y, r, "s t")


def rollers(x, y, w, h, n):
    step = w / (n + 1)
    return "".join(R(round(x + step * (i + 1) - 1, 1), y + 3, 2, h - 6, "m n", 1) for i in range(n))


def conveyor(x, y, w, h, n=4, d=5):
    return box(x, y, w, h, d, "s", "l", 2) + rollers(x, y, w, h, n)


def svg(name, title, desc, body):
    s = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 128" width="384" height="256">
  <title>{title}</title>
  <desc>{desc}</desc>
  <style>{STYLE}</style>
  <defs>{DEFS}</defs>
{body}
</svg>
'''
    open(os.path.join(OUT, name + ".svg"), "w").write(s)


def G(id_, content, extra=""):
    return f'  <g id="{id_}"{extra}>\n    ' + content.replace("><", ">\n    <") + "\n  </g>\n"


# ---------------------------------------------------------------- PRENSA
def prensa():
    col = lambda x: (box(x, 10, 30, 94, 10, "m", "d", 5)
                     + R(x + 11, 32, 8, 50, "y t", 3) + bolt(x + 15, 21) + bolt(x + 15, 93))
    cuerpo = (R(60, 34, 5, 56, "s t", 1) + R(127, 34, 5, 56, "s t", 1)      # guías
              + box(48, 84, 96, 14, 9, "d", "d", 2)
              + R(51, 86.5, 90, 9, "n", 1, ' fill="url(#franjas)"')
              + box(66, 80, 60, 10, 5, "l", "m", 2))                         # yunque
    pieza = R(74, 73, 44, 9, "h t", 2) + R(74, 79, 44, 4, "s t", 2) + R(77, 75, 38, 2, "w n", 1)
    cabezal = (R(90, -10, 12, 58, "s t", 2) + R(92, -8, 3, 54, "hi n", 1)   # vástago
               + R(56, 46, 80, 5, "l o", 2) + R(56, 40, 80, 9, "s o", 2) + R(59, 42, 74, 2, "hi n", 1))
    troquel = P("M78 51 H114 L101 66 H91 Z", "l o") + P("M82 53 H110 L108 55 H84 Z", "hi n")
    viga = (box(48, 18, 96, 14, 7, "d", "d", 2)
            + R(51, 20.5, 90, 9, "n", 1, ' fill="url(#franjas)"')
            + box(82, 12, 28, 16, 5, "m", "d", 3) + R(88, 16, 16, 5, "y t", 2))
    body = (G("bastidor", col(18) + col(144) + cuerpo)
            + G("pieza", pieza, ' data-ancla="96,82"')
            + G("cabezal", cabezal + G("troquel", troquel, ' data-ancla="96,51"').strip(),
                ' data-ancla="96,40" data-recorrido-y="0..14"')
            + G("viga", viga))
    svg("prensa", "Prensa", "Bastidor en H, cabezal móvil con troquel intercambiable. "
        "Capas: bastidor, pieza, cabezal (contiene troquel), viga. El cabezal baja en Y de 0 a 14.", body)


# ---------------------------------------------------------------- MOLDEADORA
def lobulos(cx, cy, r0, a, n=8, steps=96):
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        r = r0 + a * math.cos(n * t)
        pts.append(f"{cx + r * math.cos(t):.1f} {cy + r * math.sin(t):.1f}")
    return "M" + " L".join(pts) + " Z"


def moldeadora():
    def cil(y):
        return (R(12, y + 5, 10, 14, "l o", 3)
                + R(20, y, 46, 24, "s o", 5) + R(24, y + 3, 38, 4, "w n", 2) + R(22, y + 16, 42, 6, "sh n", 3))
    carcasa = (box(78, 12, 98, 92, 10, "m", "d", 9)
               + R(105, 16, 44, 7, "y t", 3) + R(105, 93, 44, 7, "y t", 3)
               + "".join(bolt(x, y) for x in (87, 167) for y in (21, 95)))
    molde = (R(100, 28, 62, 62, "s o", 4) + R(103, 30.5, 56, 2.5, "hi n", 1)
             + "".join(bolt(x, y, 2) for x in (107, 155) for y in (35, 83))
             + P(lobulos(131, 59, 15.5, 4.5), "k t") + P(lobulos(131, 60.5, 13, 4), "d n"))
    movil = (R(64, 34, 22, 8, "s t", 2) + R(64, 70, 22, 8, "s t", 2)         # vástagos
             + R(84, 28, 12, 62, "l o", 3) + R(86, 31, 3, 56, "hi n", 1))
    collares = R(66, 28, 12, 20, "y o", 3) + R(66, 64, 12, 20, "y o", 3)
    body = (G("cilindros", cil(26) + cil(62))
            + G("carcasa", carcasa)
            + G("molde", molde, ' data-ancla="131,59"')
            + G("molde-movil", movil, ' data-ancla="84,59" data-recorrido-x="0..66"')
            + G("collares", collares))
    svg("moldeadora", "Moldeadora", "Carcasa compacta, dos cilindros horizontales y cavidad lobulada visible. "
        "Capas: cilindros, carcasa, molde (cavidad intercambiable), molde-movil (cierra en X de 0 a 66), collares.", body)


# ---------------------------------------------------------------- MEZCLADORA
def mezcladora():
    cx, cy = 84, 60
    orejas = "".join(R(cx + sx * 33 - 11, cy + sy * 33 - 11 + 4, 22, 22, "d o", 5)
                     + R(cx + sx * 33 - 11, cy + sy * 33 - 11, 22, 22, "m o", 5)
                     + bolt(cx + sx * 37, cy + sy * 37) for sx in (-1, 1) for sy in (-1, 1))
    bandeja = conveyor(128, 49, 52, 24, 4, 6)
    tina = (C(cx, cy + 9, 45, "d o") + C(cx, cy, 45, "m o")
            + P(f"M{cx-41} {cy-8} A42 42 0 0 1 {cx+20} {cy-37}", "n", ' fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2.5" stroke-linecap="round"')
            + C(cx, cy, 36, "g o")
            + P(f"M{cx-36} {cy} A36 36 0 0 1 {cx+36} {cy} A36 30 0 0 0 {cx-36} {cy} Z", "sh n"))
    contenido = "".join(
        f'<path d="M{cx + r*math.cos(a):.1f} {cy + r*math.sin(a):.1f} A{r} {r} 0 0 1 {cx + r*math.cos(a+1.0):.1f} {cy + r*math.sin(a+1.0):.1f}" '
        f'fill="none" stroke="#35a043" stroke-width="3" stroke-linecap="round"/>'
        for r, a in ((27, 0.3), (20, 2.4), (29, 4.3)))
    aspa = lambda ang: (f'<g transform="rotate({ang} {cx} {cy})">' + R(cx - 4.5, cy - 33, 9, 33, "s o", 3)
                        + R(cx - 2.5, cy - 30, 2.5, 26, "w n", 1) + "</g>")
    aspas = aspa(0) + aspa(120) + aspa(240) + C(cx, cy, 8, "s o") + C(cx - 2, cy - 2, 2.5, "w n")
    compuerta = R(124, 46, 10, 30, "y o", 3) + R(34, 46, 8, 28, "y o", 3)
    body = (G("bandeja", bandeja, ' data-ancla="158,61"')
            + G("tina", orejas + tina)
            + G("contenido", contenido, f' data-ancla="{cx},{cy}"')
            + G("aspas", aspas, f' data-ancla="{cx},{cy}" data-giro="0..360"')
            + G("compuerta", compuerta))
    svg("mezcladora", "Mezcladora", "Tina circular verde con tres aspas plateadas y bandeja de salida. "
        "Capas: bandeja, tina, contenido (remolinos), aspas (giran sobre 84,60), compuerta.", body)


# ---------------------------------------------------------------- ENSAMBLADORA
def ensambladora():
    cintas = conveyor(10, 24, 58, 24) + conveyor(10, 72, 58, 24) + conveyor(128, 48, 54, 24)
    oct_ = lambda dy, c: P(f"M70 {14+dy} H128 L142 {28+dy} V{90+dy} L128 {104+dy} H70 L56 {90+dy} V{28+dy} Z", c)
    carcasa = (oct_(10, "d o") + oct_(0, "m o") + P("M72 17 H126 L128 19 H70 Z", "hi n")
               + "".join(bolt(x, y) for x, y in ((74, 22), (124, 22), (74, 96), (124, 96))))
    yd = "M60 36 H84 L104 60 H138 M60 84 H84 L104 60"
    canal = (f'<path d="{yd}" fill="none" stroke="#171b26" stroke-width="20" stroke-linejoin="round"/>'
             f'<path d="{yd}" fill="none" stroke="#aab2bf" stroke-width="14" stroke-linejoin="round"/>'
             f'<path d="M60 32 H86 L105 55 H138 M60 80 H84" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2.5" stroke-linejoin="round"/>')
    bocas = R(54, 20, 11, 32, "y o", 3) + R(54, 68, 11, 32, "y o", 3) + R(133, 44, 11, 32, "y o", 3)
    piloto = R(112, 25, 16, 8, "yd t", 3)
    body = (G("cintas", cintas, ' data-entrada-a="28,36" data-entrada-b="28,84" data-salida="164,60"')
            + G("carcasa", carcasa) + G("canal", canal) + G("bocas", bocas)
            + G("piloto", piloto, ' data-encendido="#ffd84a"'))
    svg("ensambladora", "Ensambladora", "Carcasa en Y: dos entradas convergen en una salida. "
        "Capas: cintas, carcasa, canal, bocas, piloto (apagado; encendido = #ffd84a).", body)


# ---------------------------------------------------------------- CNC
def cnc():
    ranuras = "".join(R(38, y, 116, 2.5, "d n", 1) for y in range(38, 100, 9))
    mesa = box(30, 30, 132, 76, 10, "l", "d", 3) + ranuras
    riel = lambda x: (box(x, 20, 16, 92, 9, "m", "d", 4)
                      + R(x + 3, 16, 10, 9, "y t", 3) + R(x + 3, 106, 10, 9, "y t", 3))
    pieza = (R(60, 56, 72, 34, "h o", 3) + R(63, 58.5, 66, 2.5, "w n", 1) + R(62, 84, 68, 4, "sh n", 2)
             + "".join(R(x, y, 9, 9, "d t", 2) for x in (56, 127) for y in (52, 85)))
    portico = (R(22, 40, 148, 5, "sh n", 2)
               + R(20, 30, 152, 6, "l o", 2) + R(20, 24, 152, 9, "s o", 3) + R(24, 26, 144, 2.5, "w n", 1))
    cabezal = (P("M44 40 H56 L53 47 L50 52 L47 47 Z", "s t")
               + box(38, 16, 24, 20, 6, "m", "d", 3) + R(41, 13, 18, 8, "y t", 3))
    body = (G("mesa", mesa + riel(16) + riel(160))
            + G("pieza", pieza, ' data-ancla="96,73"')
            + G("portico", portico + G("cabezal", cabezal, ' data-ancla="50,52" data-recorrido-x="0..92"').strip(),
                ' data-recorrido-y="0..40"'))
    svg("cnc", "CNC", "Mesa ranurada abierta con pórtico y cabezal móvil. "
        "Capas: mesa, pieza (sujeta con mordazas), portico (se mueve en Y) con cabezal (se mueve en X). "
        "La punta de la herramienta está en 50,52.", body)


# ---------------------------------------------------------------- FUNDIDORA
def fundidora():
    base = (R(22, 108, 10, 8, "k o", 2) + R(72, 108, 10, 8, "k o", 2)
            + box(14, 66, 76, 18, 28, "m", "d", 4) + R(32, 94, 40, 8, "y t", 3)
            + R(8, 40, 14, 40, "d o", 4) + R(8, 36, 14, 30, "m o", 4))              # soporte del muñón
    cx, cy = 54, 44
    dientes = (f'<path d="M{cx-22.6} {cy-22.6} A32 32 0 0 0 {cx-22.6} {cy+22.6}" fill="none" stroke="#171b26" stroke-width="9"/>'
               f'<path d="M{cx-22.6} {cy-22.6} A32 32 0 0 0 {cx-22.6} {cy+22.6}" fill="none" stroke="#f6b817" stroke-width="5" stroke-dasharray="5 4"/>')
    crisol = (dientes
              + P(f"M{cx+24} {cy-16} L{cx+38} {cy-8} L{cx+26} {cy+4} Z", "m o")     # pico
              + C(cx, cy + 5, 30, "d o") + C(cx, cy, 30, "m o")
              + P(f"M{cx-27} {cy-5} A28 28 0 0 1 {cx+12} {cy-25}", "n", ' fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2.5" stroke-linecap="round"')
              + C(cx, cy, 22, "k o"))
    metal = (P(f"M{cx-21} {cy+4} A22 22 0 0 0 {cx+21} {cy+4} Q{cx} {cy-3} {cx-21} {cy+4} Z", "f n")
             + P(f"M{cx-15} {cy+5} Q{cx} {cy} {cx+15} {cy+5}", "n", ' fill="none" stroke="#ffc04d" stroke-width="2.5" stroke-linecap="round"'))
    munon = C(76, 68, 6, "s o") + C(76, 68, 2, "d n")
    bandeja = R(152, 112, 8, 6, "k o", 2) + box(146, 94, 38, 12, 7, "l", "d", 2)
    molde = (R(106, 112, 8, 6, "k o", 2) + R(136, 112, 8, 6, "k o", 2)
             + box(100, 78, 48, 26, 10, "s", "l", 3)
             + "".join(bolt(x, y, 2) for x in (106, 142) for y in (84, 98))
             + f'<ellipse cx="124" cy="91" rx="13" ry="8" class="k t"/><ellipse cx="124" cy="93" rx="10" ry="5" class="d n"/>')
    body = (G("bandeja", bandeja, ' data-ancla="165,100"')
            + G("molde", molde, ' data-ancla="124,91"')
            + G("base", base)
            + G("crisol", crisol + G("metal", metal).strip(), ' data-pivote="76,68" data-giro="0..55"')
            + G("munon", munon))
    svg("fundidora", "Fundidora", "Crisol basculante elevado a la izquierda, molde intercambiable más bajo a la derecha y bandeja. "
        "Capas: bandeja, molde, base, crisol (gira sobre 76,68; contiene metal), munon.", body)


# ---------------------------------------------------------------- MONTAJE DE BASE (propuesta)
def montaje():
    mesa = (box(34, 22, 124, 78, 10, "m", "d", 4)
            + R(50, 26, 92, 6, "n", 1, ' fill="url(#franjas)"') + R(50, 90, 92, 6, "n", 1, ' fill="url(#franjas)"')
            + "".join(bolt(x, y) for x in (41, 151) for y in (29, 93)))
    cuna = lambda x: R(x - 5, 36, 10, 50, "d o", 3) + R(x - 2, 39, 4, 44, "k n", 2)
    cunas = cuna(70) + cuna(122)
    rueda = lambda x, y: R(x - 12, y - 6, 24, 12, "k o", 4) + R(x - 8, y - 4, 16, 2.5, "l n", 1)
    pieza = (R(68, 30, 4, 62, "s t", 1) + R(120, 30, 4, 62, "s t", 1)             # ejes
             + R(60, 44, 72, 34, "d o", 3) + R(64, 47, 64, 2.5, "l n", 1)
             + "".join(R(x, y, 3, 3, "l n", 0) for x in (66, 123) for y in (55, 70))
             + "".join(rueda(x, y) for x in (70, 122) for y in (32, 90)))
    emp = lambda y, s: (R(88, y, 16, 12, "s o", 3) + R(90, y + 2, 12, 2.5, "w n", 1)
                        + R(46, y + (10 if s < 0 else -2), 100, 4, "y t", 2))
    empujadores = (f'<g id="empujador-sup" data-recorrido-y="0..8">' + emp(6, -1) + "</g>"
                   + f'<g id="empujador-inf" data-recorrido-y="0..-8">' + emp(104, 1) + "</g>")
    body = (G("mesa", mesa + cunas)
            + G("pieza", pieza, ' data-ancla="96,61"')
            + G("empujadores", empujadores))
    svg("montaje-base", "Montaje de base (propuesta)", "Mesa con dos cunas para ejes y dos empujadores que calan las ruedas. "
        "Sale la base completa del montacargas. Capas: mesa, pieza, empujadores.", body)


prensa(); moldeadora(); mezcladora(); ensambladora(); cnc(); fundidora(); montaje()
print(sorted(os.listdir(OUT)))
