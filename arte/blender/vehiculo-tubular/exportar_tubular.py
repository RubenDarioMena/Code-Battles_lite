"""Descriptor del rig vivo de tubular.construir()."""
from math import radians
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from kit.descriptor import Nivel, control, presupuesto
from kit.fuente_tubular import escena

NOMBRE = "VehiculoTubular"
ARCHIVO = "vehiculo_tubular.glb"
PRESUPUESTO = presupuesto(NOMBRE)
ANIMABLES = {"raiz","plataforma_aro","torreta","arma","boca","motor"}
# Plataforma y motor ya tienen drivers de los mandos de la fuente.
DIRECTOS = [
    ("raiz","rotation_euler[2]",control("raiz.giro","rad",ciclico=True)),
    ("torreta","rotation_euler[2]",control("torreta.giro","rad",ciclico=True)),
    ("arma","rotation_euler[0]",control("arma.elevacion","rad",radians(-15),radians(45))),
    ("boca","delta_location[1]",control("boca.recorrido","m",-.025,0))]
_L0 = (r"cordon|uña_|perilla|perno|remache|bulon|tornillo|anclaje_|tapon|eslabon|puerto_|tuerca|valvula|"
       r"nervio|rosca|laminilla")
_L1 = _L0 + r"|taco|nervio|rosca|aleta|abrazadera|lamina|fuelle|laminilla|asiento_|collarin|lente_led_"
_L2 = (_L1 + r"|resorte|dentado|protector|disco|mordaza|pastilla|beadlock|colector|admision|cinta|"
       r"cartela|pestaña|refuerzo|camisa|ventilador|radiador|uniball|heim|ojo|rayo|piñon")
NIVELES = [Nivel(.02,1,(6,2),.40,60,_L0,bisel_minimo=.15),
           Nivel(.05,0,(3,1),.22,40,_L1), Nivel(.12,0,None,.16,24,_L2)]


def construir(nivel):
    return escena(DIRECTOS)


if __name__ == "__main__":
    from kit.exportar import ejecutar
    ejecutar(globals())
