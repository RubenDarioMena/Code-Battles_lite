"""Geometría local en metros. Z arriba, +Y hacia delante. Solo biblioteca estándar."""
from dataclasses import dataclass, field, replace
from functools import wraps
from math import atan2, cos, hypot, isfinite, pi, sin, tau

FAMILIAS = frozenset("""caja prisma revolucion tubo manguera chapa cartela tornillo
tuerca arandela remache engrane corona cremallera sinfin rodamiento eje cardan
rotula resorte amortiguador rueda oruga led""".split())


def suma(a, b):
    return tuple(x+y for x, y in zip(a, b))


def resta(a, b):
    return tuple(x-y for x, y in zip(a, b))


def por(v, k):
    return tuple(x*k for x in v)


def punto(a, b):
    return sum(x*y for x, y in zip(a, b))


def cruz(a, b):
    x, y, z = a
    u, v, w = b
    return (y*w-z*v, z*u-x*w, x*v-y*u)


def unidad(v):
    longitud = hypot(*v)
    if not longitud or not isfinite(longitud):
        raise ValueError("Se necesita una dirección finita y no nula")
    return por(v, 1/longitud)


@dataclass
class Malla:
    vertices: list = field(default_factory=list)
    caras: list = field(default_factory=list)
    materiales: list = field(default_factory=list)
    nombre: str = "perfil"
    familia: str = "revolucion"
    ultimo_nivel: int = 2

    def __post_init__(self):
        if self.familia not in FAMILIAS or len(self.materiales) != len(self.caras):
            raise ValueError("Familia desconocida o falta el material de alguna cara")

    @property
    def triangulos(self):
        return sum(len(c)-2 for c in self.caras)

    @property
    def limites(self):
        return tuple((min(coords), max(coords)) for coords in zip(*self.vertices))

    def trasladar(self, vector):
        return replace(self, vertices=[suma(p, vector) for p in self.vertices])

    def escalar(self, factores):
        if isinstance(factores, (float, int)):
            factores = (factores,)*3
        x, y, z = factores
        if x*y*z == 0:
            raise ValueError("Escala nula")
        caras = [c[::-1] for c in self.caras] if x*y*z < 0 else self.caras
        return replace(self, vertices=[(a*x, b*y, c*z) for a,b,c in self.vertices], caras=caras)

    def rotar(self, eje, angulo):
        n = unidad(eje)
        c, s = cos(angulo), sin(angulo)
        def giro(v):
            return suma(suma(por(v, c), por(cruz(n, v), s)), por(n, punto(n, v)*(1-c)))
        return replace(self, vertices=list(map(giro, self.vertices)))

    def alinear(self, vector, eje=(0, 0, 1)):
        a, b = unidad(eje), unidad(vector)
        normal = cruz(a, b)
        seno = hypot(*normal)
        if seno > 1e-12:
            return self.rotar(normal, atan2(seno, punto(a,b)))
        if punto(a,b) < 0:
            guia = (1,0,0) if abs(a[0]) < .9 else (0,1,0)
            return self.rotar(cruz(a,guia), pi)
        return replace(self)

    @classmethod
    def unir(cls, *mallas, familia, nombre, ultimo_nivel=2):
        v, f, mat = [], [], []
        for m in mallas:
            base = len(v)
            v.extend(m.vertices)
            f.extend(tuple(base+i for i in cara) for cara in m.caras)
            mat.extend(m.materiales)
        return cls(v, f, mat, nombre, familia, ultimo_nivel)


def pieza(familia, ultimo=2):
    """El constructor público omite la geometría antes de construirla."""
    if familia not in FAMILIAS:
        raise ValueError(familia)
    def decorar(fn):
        @wraps(fn)
        def construir(*args, detalle=0, nombre=None, **kwargs):
            if type(detalle) is not int or detalle not in (0, 1, 2):
                raise ValueError("detalle debe ser 0, 1 o 2")
            m = fn(*args, detalle=detalle, **kwargs) if detalle <= ultimo else Malla()
            return replace(m, nombre=nombre or fn.__name__, familia=familia, ultimo_nivel=ultimo)
        construir.familia, construir.ultimo_nivel = familia, ultimo
        return construir
    return decorar


def circulo(r, n, z, fase=0):
    return [(r*cos(fase+tau*i/n), r*sin(fase+tau*i/n), z) for i in range(n)]


def superficie(filas, material, ciclica=False):
    """Une secciones antihorarias y polos. Tapa los extremos libres."""
    vertices, anillos, caras = [], [], []
    for fila in filas:
        anillos.append(list(range(len(vertices), len(vertices)+len(fila))))
        vertices.extend(fila)
    for a, b in zip(anillos, anillos[1:] + (anillos[:1] if ciclica else [])):
        n = max(len(a), len(b))
        if len(a) not in (1,n) or len(b) not in (1,n):
            # Avanza por la misma fracción de vuelta en ambas secciones.
            # Un hexágono de seis vértices puede así rematar un cilindro de 24.
            i = j = 0
            while i<len(a) or j<len(b):
                x, y = a[i%len(a)], b[j%len(b)]
                siguiente_a = (i+1)*len(b)
                siguiente_b = (j+1)*len(a)
                borde = [x]
                if siguiente_a<=siguiente_b:
                    i += 1
                    borde.append(a[i%len(a)])
                if siguiente_b<=siguiente_a:
                    j += 1
                    borde.append(b[j%len(b)])
                caras.append(tuple(borde+[y]))
            continue
        for i in range(n):
            cara = (a[i%len(a)], a[(i+1)%len(a)], b[(i+1)%len(b)], b[i%len(b)])
            cara = tuple(dict.fromkeys(cara))
            if len(cara) >= 3:
                caras.append(cara)
    if not ciclica:
        caras.extend(tuple(dict.fromkeys(a)) for a in (anillos[0][::-1], anillos[-1]) if len(a)>2)
    return Malla(vertices, caras, [material]*len(caras))


def torno(perfil, n, material, ciclica=False):
    if ciclica and perfil[0]==perfil[-1]:
        perfil = perfil[:-1]
    filas = [circulo(r,n,z) if r else [(0,0,z)] for r,z in perfil]
    return superficie(filas, material, ciclica)


def ensamblar(*partes):
    return Malla.unir(*partes, familia="prisma", nombre="conjunto")


def eje_gltf(eje):
    x, y, z = eje
    return [x, z, -y]


def regla_mando(mando, canal, eje, factor=1.0):
    if canal not in ("rotacion", "traslacion") or not mando or not isfinite(factor):
        raise ValueError("Regla MANDO inválida")
    return dict(tipo="MANDO", canal=canal, eje=eje_gltf(unidad(eje)), factor=factor, mando=mando)
