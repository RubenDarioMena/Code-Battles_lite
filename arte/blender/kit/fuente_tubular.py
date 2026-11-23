"""Controles de construcción en unidades de juego; enlaces a RNA para exportación y poses."""
import math
import sys
from pathlib import Path

from .descriptor import Escena, control


def escena(directos):
    import bpy
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"vehiculo-tubular"))
    import tubular as t
    from .blender import materiales
    for tabla in (t.CONTROLES,t.CAPAS,t.TRAMOS):
        tabla.clear()
    raiz,_ = t.construir()
    paleta = materiales({"exp_"+k:(t.lineal(rgb)[:3],metal,rug,int(k in ("led","piloto")))
                         for k,(rgb,metal,rug) in t.PALETA.items()})
    s = Escena(raiz, paleta={k[4:]:v for k,v in paleta.items()})
    for c in t.CONTROLES:
        o = bpy.data.objects[c["objeto"]]
        prop = c["propiedad"]
        nombre = f"{o.name}.{prop}"
        factor = 180/math.pi if c["unidad"] == "grados" else 1
        a,b = c["rango"]
        s.controles.append(control(nombre, "rad" if factor != 1 else c["unidad"], a/factor,b/factor,
                                   ciclico=prop=="giro", reposo=o[prop]/factor))
        s.enlaces[o,f'["{prop}"]'] = (nombre,factor)
    for objeto,ruta,c in directos:
        obj = bpy.data.objects[objeto]
        s.controles.append(c)
        s.enlaces[obj,ruta] = (c["nombre"],1)
    return s
