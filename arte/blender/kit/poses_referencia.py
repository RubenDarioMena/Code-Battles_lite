"""Oráculo de la fuente. La montura S también se puede medir con CPython."""
import argparse
import json
from pathlib import Path
import re
import runpy
import sys
from tempfile import TemporaryDirectory

BLENDER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BLENDER))
from kit.validar_rig import controles as validar_controles
from kit.rig import EJES, blender, gltf

DESCRIPTORES = {"VehiculoTubular":BLENDER/"vehiculo-tubular/exportar_tubular.py",
                "TorretaObservacion":BLENDER/"torreta_observacion/esfera/exportar_torreta.py"}


def muestras(controles):
    reposo = {k:round(x,7) for k,x in validar_controles(controles).items()}
    yield reposo
    rangos = {}
    for c in sorted(controles,key=lambda c:c["nombre"]):
        k = c["nombre"]
        extremos = [-2.5,-1.,1.,2.5] if c.get("ciclico") else [c["min"],c["max"]]
        rangos[k] = extremos[0], extremos[-1]
        for x in extremos:
            yield {**reposo,k:round(x,7)}
    semilla = 0xCB120002
    for _ in range(8):
        valores = {}
        for k,(bajo,alto) in rangos.items():
            semilla = (1664525*semilla+1013904223) % 2**32
            valores[k] = round(bajo+(alto-bajo)*semilla/2**32,7)
        yield valores


def torreta(d):
    from kit.fuente_esfera import PIVOTES, modelo, t, tr
    m = modelo()
    for controles in muestras(d["CONTROLES"]):
        motores = (-tr.AZ*controles["azimut"], -tr.N*controles["inclinacion"],
                   controles["hojas"], controles["extension"], 0.)
        mundo = {d["NOMBRE"]:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}
        for original,nombre in PIVOTES.items():
            # Transformar origen y tres vectores por la cadena real de partes.
            # pose() incluye las relaciones de transmisión y el signo de cada hoja.
            origen = [0.,0.,0.]
            vectores = [blender(e) for e in EJES]
            p = m.parts[original]
            while p is not None:
                loc, rot = t.pose(p,motores,"S")
                origen = t.apply(origen,loc,rot)
                vectores = [t.rotate(v,rot) for v in vectores]
                p = m.parts.get(p.parent)
            mundo[nombre] = [round(x,7) for col in vectores for x in (*gltf(col),0)] + [
                *[round(x,7) for x in gltf(origen)],1]
        yield dict(controles=controles,mundo=mundo)


def vehiculo(d):
    import bpy
    from kit.rig_blender import C, seleccion
    bpy.ops.wm.read_factory_settings(use_empty=True)
    escena = d["construir"](0)
    bpy.context.view_layer.update()
    _,nombres = seleccion(escena,d)
    dg = bpy.context.evaluated_depsgraph_get()
    inv_raiz = escena.raiz.evaluated_get(dg).matrix_world.inverted()
    inv_c = C.inverted()
    for controles in muestras(escena.controles):
        for (obj,ruta),(k,factor) in escena.enlaces.items():
            x = factor*controles[k]
            if ruta.startswith("["):
                obj[json.loads(ruta[1:-1])] = x
            else:
                canal,indice = re.fullmatch(r"(\w+)\[(\d+)\]",ruta).groups()
                getattr(obj,canal)[int(indice)] = x
            obj.update_tag()
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        mundo = {}
        for obj,nombre in nombres.items():
            w = C @ inv_raiz @ obj.evaluated_get(dg).matrix_world @ inv_c
            mundo[nombre] = [round(w[i][j],7) for j in range(4) for i in range(4)]
        yield dict(controles=controles,mundo=mundo)


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--maquina", choices=DESCRIPTORES,required=True)
    parser.add_argument("--salida",type=Path,default=BLENDER.parents[1]/"pruebas/rig")
    a = parser.parse_args(argv)
    d = runpy.run_path(str(DESCRIPTORES[a.maquina]))
    if a.maquina == "TorretaObservacion":
        fuente, poses = "torreta_esfera.pose / transmision_esfera (S)",torreta(d)
    else:
        fuente, poses = "tubular.construir / depsgraph de Blender",vehiculo(d)
    datos = dict(formato="cbl-rig-poses",v=1,maquina=a.maquina,fuente=fuente,muestras=list(poses))
    a.salida.mkdir(exist_ok=True,parents=True)
    ruta = a.salida/(a.maquina+"-poses.json")
    with TemporaryDirectory(dir=a.salida) as temporal:
        candidato = Path(temporal)/ruta.name
        with candidato.open("w",encoding="utf8") as f:
            json.dump(datos,f,ensure_ascii=False,allow_nan=False,separators=(",",":"))
            f.write("\n")
        candidato.replace(ruta)
    print("POSES", ruta, len(datos["muestras"]), "muestras")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
