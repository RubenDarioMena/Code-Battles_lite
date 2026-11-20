"""Descriptor de RobotTransporte. Se puede leer sin Blender."""
from math import radians
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit import regla_mando
from kit.descriptor import Escena, Nivel, control, presupuesto

NOMBRE = "RobotTransporte"
ARCHIVO = "t1.glb"
PRESUPUESTO = presupuesto(NOMBRE)
AJUSTE_SUELO_Y = .01248
TODOS_VACIOS = True
NIVELES = [
    Nivel(0, 2, None, .35, 2000, cuotas={"RobotTransporte":4712,"cuerpo":1772,"carga":1160}),
    Nivel(.035, 1, None, .35, 300, cuotas={"RobotTransporte":2292,"cuerpo":828,"carga":554,
          "hombro":166,"codo":150,"muneca":150,"torreta":114}),
    Nivel(.09, 0, None, .25, 150, cuotas={"RobotTransporte":538,"cuerpo":90,
          "hombro":46,"codo":48,"muneca":44})]
MANDOS = {p:[regla_mando(p+".giro","rotacion", eje, 1)] for p,eje in
          (("torreta",(0,0,1)),("hombro",(1,0,0)),("codo",(1,0,0)),("muneca",(1,0,0)))}
for lado,signo in (("i",-1),("d",1)):
    MANDOS["dedo_"+lado] = [regla_mando("pinza.apertura","rotacion",(0,1,0),signo)]


CONTROLES = [control(p+".giro","rad",ciclico=True) for p in ("torreta","hombro","codo","muneca")]
CONTROLES.append(control("pinza.apertura","rad",0,radians(16)))


def construir(nivel):
    import bpy
    import robots
    robots._mats.clear()
    raiz = robots.robot_transporte(bpy.context.scene.collection)
    return Escena(raiz, CONTROLES, paleta=dict(robots._mats))


if __name__ == "__main__":
    from kit.exportar import ejecutar
    ejecutar(globals())
