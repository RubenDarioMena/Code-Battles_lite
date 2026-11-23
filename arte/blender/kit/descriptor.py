"""Datos accesibles desde CPython y Blender; las fuentes se importan al construir."""
import json
from dataclasses import dataclass, field
from pathlib import Path


def presupuesto(nombre):
    return json.loads((Path(__file__).parent/"presupuestos"/(nombre+".json")).read_text())


@dataclass
class Nivel:
    minimo: float
    bisel: int
    curvas: tuple
    proporcion: float
    umbral: int
    fuera: str = "(?!)"
    excepciones: tuple = ()
    bisel_minimo: float = 0
    # Para migrar un decimado por grupo: cuota histórica por pivote.
    cuotas: dict = field(default_factory=dict)


@dataclass
class Escena:
    raiz: object
    controles: list = field(default_factory=list)
    # (objeto Blender, ruta RNA) -> (nombre de control, unidades Blender/juego)
    enlaces: dict = field(default_factory=dict)
    nombres: dict = field(default_factory=dict)
    visibles: object = None
    paleta: dict = field(default_factory=dict)
    extras: dict = field(default_factory=dict)


def control(nombre, unidad, minimo=None, maximo=None, ciclico=False, reposo=0):
    c = dict(nombre=nombre, unidad=unidad, reposo=reposo)
    if minimo is not None:
        c["min"] = minimo
    if maximo is not None:
        c["max"] = maximo
    if ciclico:
        c["ciclico"] = True
    return c
