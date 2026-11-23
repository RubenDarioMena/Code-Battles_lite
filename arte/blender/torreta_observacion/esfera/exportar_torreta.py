"""Descriptor del exterior del mecanismo S."""
from math import radians
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from kit import regla_mando
from kit.descriptor import Nivel, control, presupuesto
from kit.fuente_esfera import escena

NOMBRE = "TorretaObservacion"
ARCHIVO = "torreta_observacion.glb"
PRESUPUESTO = presupuesto(NOMBRE)
AJUSTE_SUELO_Y = -.055
CONTROLES = [control("azimut","rad",ciclico=True), control("inclinacion","rad",ciclico=True),
             control("hojas","factor",0,1), control("extension","factor",0,1)]
MANDOS = {"base_giro":[regla_mando("azimut","rotacion",(0,0,1),1)],
          "munon":[regla_mando("inclinacion","rotacion",(1,0,0),1)],
          "hoja_i":[regla_mando("hojas","rotacion",(0,1,0),-radians(100))],
          "hoja_d":[regla_mando("hojas","rotacion",(0,1,0),radians(100))]}
for i in range(1,5):
    MANDOS[f"telescopio_{i}"] = [regla_mando("extension","traslacion",(0,0,1),.1)]
TORRE = r"Fuste|Labio|Junta inferior"
L1 = r"Junta polar|Pasador|Collar|Revestimiento|Casquillo|Junta inferior"
NIVELES = [Nivel(0,0,None,.45,1500,"Junta polar",((TORRE,1),)),
           Nivel(0,0,None,.18,800,L1,((TORRE,.5),)), Nivel(0,0,None,.07,300,L1+"|Crestas",((TORRE,.25),))]


def construir(nivel):
    return escena(CONTROLES)


if __name__ == "__main__":
    from kit.exportar import ejecutar
    ejecutar(globals())
