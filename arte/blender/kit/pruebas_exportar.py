"""Pruebas del contrato y del validador con GLB completos, incluidos sus vértices."""
from graphlib import TopologicalSorter
import copy
import json
import math
from pathlib import Path
import runpy
import struct
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from types import SimpleNamespace as RNA

KIT = Path(__file__).resolve().parent
sys.path.insert(0,str(KIT.parent))
from kit.descriptor import control
from kit.expresiones import convertir, evaluar
from kit.lectura_glb import escribir, leer, matriz
from kit.poses_referencia import DESCRIPTORES, muestras, torreta
from kit.exportar import finalizar
from kit.reglas_fuente import curva_identidad, expresion_driver, restriccion
from kit.reposo import aplicar, mundos
from kit.rig import blender, canales, evaluar_local, gltf, mandos, producto, punto, trs
from kit.validar_glb import presupuesto, validar

BASE = dict(t=[0,0,0],r=[0,0,0,1],s=[1,1,1])
# La geometría previa a v2 es el oráculo de estas pruebas de migración.
# Los GLB que carga el juego ya tienen las restricciones sin evaluar.
def setUpModule():
    global MODELOS
    temporal = TemporaryDirectory()
    unittest.addModuleCleanup(temporal.cleanup)
    MODELOS = Path(temporal.name)
    revisiones = {"t1": "bcaf46c56f47500e07693d656d578fbb0dfc486d",
                  "torreta_observacion": "bcaf46c56f47500e07693d656d578fbb0dfc486d",
                  "vehiculo_tubular": "9b4d547b5dad0877aa3a54e6e68bc1bbb267573e"}
    for maquina, revision in revisiones.items():
        nombre = maquina + ".glb"
        ruta = "Prototypes/Rocket Launcher/modelos/" + nombre
        with (MODELOS/nombre).open("wb") as salida:
            subprocess.run(["git", "show", revision + ":" + ruta], cwd=KIT, stdout=salida, check=True)

MAQUINAS = {"t1":"RobotTransporte", "vehiculo_tubular":"VehiculoTubular", "torreta_observacion":"TorretaObservacion"}


def rig(*reglas):
    return json.dumps(dict(v=2,reglas=reglas))


def sintetico():
    d = dict(asset={"version":"2.0"}, scene=0, scenes=[dict(nodes=[])], nodes=[], meshes=[],
             materials=[dict(name="oro")], bufferViews=[], accessors=[])
    pres = dict(nombre="Prueba",medidas=[1,1,1],paleta=["oro"],emisivos=[],niveles={})
    binario = bytearray()
    for i in range(3):
        raiz,hijo,malla = range(3*i,3*i+3)
        d["scenes"][0]["nodes"].append(raiz)
        pref = f"L{i}_"
        local = canales(BASE,"XYZ",{("location",0):"x"})
        extras = dict(rig_formato="cbl-rig",rig_v=2,controles=[control("x","m",-1,1)])
        d["nodes"].extend([dict(name=pref+"Prueba",children=[hijo],extras=extras),
                           dict(name=pref+"brazo",children=[malla],extras={"rig":rig(local)}),
                           dict(name=pref+"brazo_malla",mesh=i)])
        n = 3-i
        pres["niveles"][f"L{i}"] = dict(triangulos=n,primitivas=1,pivotes=2,mallas=1)
        puntos = struct.pack("<9f",0,0,0,1,1,0,0,0,1)*n
        d["bufferViews"].append(dict(buffer=0,byteOffset=len(binario),byteLength=len(puntos)))
        binario.extend(puntos)
        d["accessors"].append(dict(bufferView=i,componentType=5126,count=3*n,type="VEC3",min=[0]*3,max=[1]*3))
        d["meshes"].append(dict(primitives=[dict(attributes=dict(POSITION=i),material=0)]))
    d["buffers"] = [dict(byteLength=len(binario))]
    return d,pres,binario


class Rig(unittest.TestCase):
    def assertVector(self, a, b, tol=1e-7):
        self.assertEqual(len(a),len(b))
        self.assertLessEqual(max(abs(x-y) for x,y in zip(a,b)),tol)

    def test_ejes_y_cuaterniones(self):
        for v in ((2,3,4),(0,-1,0),(.5,-.5,.5,.5)):
            self.assertEqual(blender(gltf(v)),list(v))
        q = (0,math.sin(.3),0,math.cos(.3))
        self.assertVector(punto(trs(r=gltf(q)),gltf((1,2,3))), gltf(punto(trs(r=q),(1,2,3))))

    def test_xyz_delta_y_base(self):
        h = math.pi/2
        m = canales(BASE,"XYZ",{("rotation_euler",0):"angulo",("rotation_euler",1):h,
                                ("delta_rotation_euler",2):h})
        # Z Blender -> -Y por Rx; Ry conserva -Y; RdeltaZ lo lleva a +X.
        self.assertVector(punto(evaluar_local(m,{"angulo":h}),gltf((0,0,1))),[1,0,0])
        # Con YXZ, primero Ry lleva Z a X y Rx deja X fijo.
        m = canales(BASE,"YXZ",{("rotation_euler",0):h,("rotation_euler",1):h})
        self.assertVector(punto(evaluar_local(m,{}),gltf((0,0,1))),[1,0,0])
        base = dict(t=[3,4,5],r=[0,0,math.sin(h/2),math.cos(h/2)],s=[1]*3)
        m = canales(base,"XYZ",{("location",0):"x",("delta_location",0):1,
                                ("scale",0):2,("delta_scale",0):3})
        self.assertVector(punto(evaluar_local(m,{"x":2}),(1,0,0)),[3,13,5])
        r = mandos(base,[dict(tipo="MANDO",canal="traslacion",eje=[1,0,0],factor=-2,mando="x")])
        self.assertVector(punto(evaluar_local(r,{"x":2}),(0,0,0)),[3,0,5])

    def test_restricciones_fuente(self):
        c = RNA(id_data=RNA(name="brazo"), name="seguir", type="COPY_LOCATION", influence=.5,
                use_x=True, use_y=True, use_z=False, invert_x=False, invert_y=True,
                invert_z=False, use_offset=True)
        r = restriccion(c, "pie")
        self.assertEqual(r, dict(tipo="COPIAR_POSICION", objetivo="pie", influencia=.5,
                                 ejes=[True,False,True], invertir=[False,False,True], desplazamiento=True))
        self.assertVector(aplicar(trs(t=(1,2,3)),r,trs(t=(2,4,6)))[12:15],[2,2,0])
        c.type, c.track_axis = "DAMPED_TRACK", "TRACK_Y"
        r = restriccion(c,"pie")
        self.assertEqual(r["eje"],[0,0,-1])
        self.assertVector(punto(aplicar(trs(),r,trs(t=(0,1,0))),(0,0,-1)),
                          [0,math.sqrt(.5),-math.sqrt(.5)])
        c.type, c.lock_axis, c.influence = "LOCKED_TRACK", "LOCK_Z", 1
        r = restriccion(c,"pie")
        self.assertEqual(r["bloqueo"],[0,1,0])
        self.assertVector(punto(aplicar(trs(),r,trs(t=(1,5,0))),(0,0,-1)),[1,0,0])
        c.type, c.keep_axis, c.rest_length, c.bulge = "STRETCH_TO", "SWING_Y", 1, 1
        for c.volume,transversal in (("NO_VOLUME",1),("VOLUME_X",.25),("VOLUME_XZX",.5)):
            r = restriccion(c,"pie")
            m = aplicar(trs(),r,trs(t=(0,0,-4)))
            self.assertVector(punto(m,(0,0,-1)),[0,0,-4])
            self.assertVector(punto(m,(1,0,0)),[transversal,0,0])
        c.keep_axis = "PLANE_Z"
        self.assertVector(punto(aplicar(trs(),restriccion(c,"pie"),trs(t=(3,0,0))),(0,0,-1)),[3,0,0])
        for k,x in (("target_space","LOCAL"),("owner_space","POSE"),("head_tail",.25),
                    ("subtarget","hueso"),("use_bulge_min",True),("type","IK"),("keep_axis","PLANE_X")):
            with self.subTest(k=k),self.assertRaisesRegex(ValueError,"brazo/seguir"):
                restriccion(RNA(**{**vars(c),k:x}),"pie")

    def test_variables_de_driver(self):
        mando = object()
        enlaces = {(mando,'["angulo"]'):("direccion",180/math.pi),
                   (mando,"rotation_euler[2]"):("torreta.giro",1)}
        target = RNA(id=mando,data_path='["angulo"]')
        var = RNA(type="SINGLE_PROP",name="v",targets=[target])
        dr = RNA(type="SCRIPTED",use_self=False,variables=[var],expression="v*pi/180")
        f = RNA(driver=dr,mute=False,keyframe_points=[],sampled_points=[],modifiers=[],data_path="rotation_euler")
        self.assertAlmostEqual(evaluar(expresion_driver(RNA(name="rueda"),f,enlaces),{"direccion":.37}),.37)
        target.data_path, dr.expression = "rotation_euler[2]", "-5*v"
        self.assertEqual(evaluar(expresion_driver(RNA(name="piñon"),f,enlaces),{"torreta.giro":2}),-10)
        target.data_path = "location[0]"
        with self.assertRaisesRegex(ValueError,"sin enlace"):
            expresion_driver(RNA(name="piñon"),f,enlaces)

    def test_operadores_y_rechazos(self):
        v = dict(x=.25)
        for expr,valor in (("clamp(-x,-1,0)",-.25),("abs(-x)",.25),("max(x,1,2)",2),
                           ("min(1,x)",.25),("sqrt(x)",.5),("sin(pi/2)+cos(0)-tan(0)",2),
                           ("(x+1)**2/2",1.25**2/2)):
            self.assertAlmostEqual(evaluar(convertir(expr,{"x":"x"}),v),valor)
        self.assertEqual(convertir("pi*2",{}),math.tau)
        for expr in ("x.y","x[0]","open('x')","x if x else 0","2//1","min(x)", "True",
                     "sin(x=1)", "[x]","x < 1","1e999","variable","(lambda: 2)()"):
            with self.subTest(expr=expr),self.assertRaises(ValueError):
                convertir(expr,{"x":"x"})

    def test_expresiones_historicas(self):
        d = leer(MODELOS/"vehiculo_tubular.glb").d
        cantidad = 0
        for n in d["nodes"]:
            if not n["name"].startswith("L0_"):
                continue
            for r in json.loads(n.get("extras",{}).get("rig","[]")):
                if r["tipo"] != "DRIVER":
                    continue
                cantidad += 1
                v, = r["variables"]
                k = v["mando"][3:]+"."+v["ruta"][2:-2] if v["nombre"]=="v" else "torreta.giro"
                arbol = convertir(r["expresion"],{v["nombre"]:k})
                valor = evaluar(arbol,{k:.125})
                texto = r["expresion"]
                if texto == "-5*yaw":
                    esperado = -.625
                elif texto == "v*pi/180":
                    esperado = math.radians(.125)
                elif texto == "v":
                    esperado = .125
                elif texto.startswith("sqrt"):
                    luz = float(texto.split("/")[1].split(")")[0])
                    esperado = math.hypot(1,.125/luz)
                else:
                    a,b = texto.split("+",1)
                    delta = .125 if b == "v" else max(0,.26*.125-.035) if "max" in b else .26*.125
                    esperado = float(a)+delta
                self.assertAlmostEqual(valor,esperado)
        self.assertEqual(cantidad,31)

    def test_reposo_restricciones_historicas(self):
        d = leer(MODELOS/"vehiculo_tubular.glb").d
        orden = TopologicalSorter()
        pivotes, padres, reglas, referencia = {}, {}, {}, {}
        def recorrer(i, padre, mundo):
            n = d["nodes"][i]
            if "mesh" in n:
                return
            k = n["name"][3:]
            referencia[k] = producto(mundo, matriz(n))
            pivotes[k], padres[k] = dict(n), padre
            orden.add(k,*([padre] if padre else []))
            for r in json.loads(n.get("extras", {}).get("rig", "[]")):
                if r["tipo"] == "DRIVER":
                    continue
                # La fuente construye estas guías sin girar y a escala unidad.
                # El GLB histórico guarda el giro y la escala ya resueltos.
                pivotes[k].pop("rotation",None)
                pivotes[k].pop("scale",None)
                c = RNA(**r, id_data=RNA(name=k), name=k, type=r["tipo"], influence=1,
                        use_x=True,use_y=True,use_z=True,invert_x=False,invert_y=False,invert_z=False,
                        use_offset=False,bulge=1,rest_length=r.get("longitud_reposo",0))
                objetivo = r["objetivo"][3:]
                reglas.setdefault(k,[]).append(restriccion(c,objetivo))
                orden.add(k,objetivo)
            for j in n.get("children", []):
                recorrer(j,k,referencia[k])
        recorrer(d["scenes"][0]["nodes"][0],None,trs())
        resultado = mundos(orden.static_order(),pivotes,padres,reglas)
        self.assertEqual(len(resultado),181)
        for k,m in resultado.items():
            with self.subTest(pivote=k):
                self.assertVector(m,referencia[k],1e-6)

    def test_oraculo_independiente_torreta(self):
        d = runpy.run_path(str(DESCRIPTORES["TorretaObservacion"]))
        glb = leer(MODELOS/"torreta_observacion.glb").d
        poses = list(torreta(d))
        self.assertEqual(len(poses),21)
        referencia = KIT.parents[2]/"pruebas/rig/TorretaObservacion-poses.json"
        self.assertEqual(json.loads(referencia.read_text())["muestras"],poses)
        self.assertEqual([m["controles"] for m in poses],list(muestras(d["CONTROLES"])))
        def recorrer(i,padre,c):
            n = glb["nodes"][i]
            if "mesh" in n:
                return
            k = n["name"][3:]
            local = matriz(n)
            if k in d["MANDOS"]:
                b = dict(t=n.get("translation",[0]*3),r=n.get("rotation",[0,0,0,1]),s=n.get("scale",[1]*3))
                regla = mandos(b,d["MANDOS"][k])
                local = evaluar_local(regla,c["controles"])
                antiguo = json.loads(n["extras"]["rig"])
                self.assertVector(evaluar_local(mandos(b,antiguo),c["controles"]),local,1e-6)
            w = producto(padre,local)
            self.assertVector(w,c["mundo"][k],1e-6)
            for j in n.get("children",[]):
                recorrer(j,w,c)
        for pose in poses:
            self.assertEqual(len(pose["mundo"]),9)
            recorrer(glb["scenes"][0]["nodes"][0],trs(),pose)


class CurvaDriver(unittest.TestCase):
    def test_identidad_por_defecto_de_blender(self):
        # La curva que Blender 5 pone a cada driver nuevo: (0,0)-(1,1), tiradores AUTO_CLAMPED en la diagonal.
        defecto = [((0, 0), (-1/3, -1/3), (1/3, 1/3), "BEZIER"), ((1, 1), (2/3, 2/3), (4/3, 4/3), "BEZIER")]
        self.assertTrue(curva_identidad(defecto, "LINEAR"))
        self.assertTrue(curva_identidad([], "CONSTANT"))

    def test_curvas_que_remapean(self):
        plana = [((0, 0), (-1/3, 0), (1/3, 0), "BEZIER"), ((1, 1), (2/3, 1), (4/3, 1), "BEZIER")]
        self.assertFalse(curva_identidad(plana, "LINEAR"))  # tiradores planos: suaviza y satura
        diagonal = [((0, 0), (-1, -1), (1, 1), "BEZIER"), ((1, 1), (0, 0), (2, 2), "BEZIER")]
        self.assertFalse(curva_identidad(diagonal, "CONSTANT"))  # fuera de [0, 1] se congela
        self.assertFalse(curva_identidad([((0, 0), (0, 0), (0, 0), "CONSTANT"), ((1, 1), (1, 1), (1, 1), "CONSTANT")], "LINEAR"))
        self.assertFalse(curva_identidad([((0, 0), (-1, -1), (1, 1), "BEZIER"), ((1, 2), (0, 1), (2, 3), "BEZIER")], "LINEAR"))


class Validador(unittest.TestCase):
    def setUp(self):
        tmp = TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.ruta = Path(tmp.name)/"prueba.glb"
        self.d,self.pres,self.bin = sintetico()

    def errores(self):
        escribir(self.ruta,self.d,self.bin)
        return "\n".join(validar(self.ruta,self.pres)["errores"])

    def test_correcto_cli_y_estatico(self):
        self.assertEqual(self.errores(),"")
        f = self.ruta.with_suffix(".json")
        f.write_text(json.dumps(self.pres))
        cmd = [sys.executable,str(KIT/"validar_glb.py"),str(self.ruta),"--maquina",str(f),"--json"]
        p = subprocess.run(cmd,capture_output=True,text=True,check=True)
        self.assertEqual(json.loads(p.stdout)["niveles"]["L0"]["triangulos"],3)
        self.ruta.write_bytes(self.ruta.read_bytes()[:-2])
        p = subprocess.run(cmd,capture_output=True,text=True)
        self.assertEqual(p.returncode,1)
        self.assertIn("GLB ·",json.loads(p.stdout)["errores"][0])
        for n in self.d["nodes"]:
            e = n.get("extras",{})
            if "controles" in e:
                e["controles"] = []
            e.pop("rig",None)
        self.assertEqual(self.errores(),"")

    def test_finalizar_y_medir_reposo(self):
        # La corredera parte de Y=2 y copia la altura de su padre.
        # La raíz se ajusta una sola vez y el archivo escrito vuelve a validarse.
        for i in range(3):
            raiz, brazo = self.d["nodes"][3*i:3*i+2]
            raiz["extras"]["controles"] = json.dumps(raiz["extras"]["controles"])
            raiz["translation"] = [0,.055,0]
            raiz["extras"]["rig"] = rig(canales({**BASE,"t":[0,.055,0]},"XYZ",{}))
            brazo["translation"] = [0,2,0]
            local = canales(BASE,"XYZ",{("location",0):"x",("location",2):2})
            copia = dict(tipo="COPIAR_POSICION",objetivo="Prueba",influencia=1,
                         ejes=[False,True,False],invertir=[False]*3,desplazamiento=False)
            brazo["extras"]["rig"] = rig(local,copia)
        escribir(self.ruta,self.d,self.bin)
        self.assertEqual(finalizar(self.ruta,self.pres,-.055)["errores"],[])
        self.assertEqual(validar(self.ruta,self.pres)["base_y"],0)
        self.assertIsInstance(leer(self.ruta).d["nodes"][0]["extras"]["controles"],list)

    def test_geometria_y_contenido(self):
        casos = [
            ("raices",lambda d,p:d["scenes"][0]["nodes"].pop()),
            ("jerarquia",lambda d,p:d["nodes"][4].update(name="L1_codo")),
            ("presupuesto",lambda d,p:p["niveles"]["L0"].update(triangulos=2)),
            ("presupuesto",lambda d,p:p["niveles"]["L1"].update(primitivas=0)),
            ("escala",lambda d,p:d["nodes"][0].update(scale=[1,2,1])),
            ("medidas",lambda d,p:p.update(medidas=[2,1,1])),
            ("base",lambda d,p:d["nodes"][0].update(translation=[0,.02,0])),
            ("material",lambda d,p:d["materials"][0].update(name="fuera")),
            ("emision",lambda d,p:d["materials"][0].update(emissiveFactor=[1,0,0])),
            ("malla",lambda d,p:d["nodes"][2].update(name="L0_mal")),
            ("contenido",lambda d,p:d.update(animations=[{}])),
            ("contenido",lambda d,p:d.update(skins=[{}])),
            ("contenido",lambda d,p:d.update(cameras=[{}])),
            ("contenido",lambda d,p:d.update(extensionsUsed=["KHR_lights_punctual"])),
            ("accesor",lambda d,p:d["accessors"][0].update(byteOffset=200)),
        ]
        for fallo,mutar in casos:
            with self.subTest(fallo=fallo):
                self.d,self.pres,self.bin = sintetico()
                mutar(self.d,self.pres)
                self.assertIn(fallo,self.errores())

    def test_rig_y_grafo(self):
        a = dict(tipo="APUNTAR",eje=[0,0,-1],influencia=1,objetivo="ausente")
        local = canales(BASE,"XYZ",{("location",0):"x"})
        for esperado,rs in (("objetivo inexistente",[local,a]),("ciclo",[local,{**a,"objetivo":"brazo"}]),
                            ("operador prohibido",[{**local,"escala":[1,1,["eval",1]]}]),
                            ("incoherente",[{**local,"traslacion":[1,0,0]}]),
                            ("primera", [a,local]), ("una sola vez",[local,local]),
                            ("desconocido",[{**local,"escala":["q",1,1]}])):
            with self.subTest(esperado=esperado):
                if esperado=="primera":
                    rs = [{**a,"objetivo":"Prueba"},local]
                    esperado="al principio"
                self.d["nodes"][1]["extras"]["rig"] = rig(*rs)
                self.assertIn(esperado,self.errores())
        # El lazo pasa por dos nodos y una arista de parentesco.
        self.d["nodes"][0]["extras"]["rig"] = rig({**a,"objetivo":"brazo"})
        self.d["nodes"][1]["extras"]["rig"] = rig(local)
        self.assertIn("ciclo",self.errores())
        c = self.d["nodes"][0]["extras"]["controles"]
        c.append(copy.deepcopy(c[0]))
        self.assertIn("duplicado",self.errores())

    def test_finalizar_geometria_historica(self):
        # Reempaquetado en un temporal. Aísla el contrato de la pasada de bpy.
        for archivo, ruta in (("t1",KIT.parent/"exportar_t1.py"),
                              ("torreta_observacion",DESCRIPTORES["TorretaObservacion"])):
            d = runpy.run_path(str(ruta))
            doc = leer(MODELOS/(archivo+".glb"))
            controles = d["CONTROLES"]
            for n in doc.d["nodes"]:
                corto = n["name"][3:]
                if corto == d["NOMBRE"]:
                    n.setdefault("extras",{}).update(rig_formato="cbl-rig",rig_v=2,
                                                     controles=json.dumps(controles))
                if corto in d["MANDOS"]:
                    base = dict(t=n.get("translation",[0]*3),r=n.get("rotation",[0,0,0,1]),
                                s=n.get("scale",[1]*3))
                    n.setdefault("extras",{})["rig"] = rig(mandos(base,d["MANDOS"][corto]))
            escribir(self.ruta,doc.d,doc.binario)
            informe = finalizar(self.ruta,d["PRESUPUESTO"],d["AJUSTE_SUELO_Y"])
            self.assertEqual(informe["errores"],[])
            self.assertLess(abs(informe["base_y"]),1e-5)

    def test_glb_historicos(self):
        for archivo,nombre in MAQUINAS.items():
            with self.subTest(nombre=nombre):
                pres = presupuesto(nombre)
                inf = validar(MODELOS/(archivo+".glb"),pres)
                for nivel, cuenta in inf["niveles"].items():
                    self.assertEqual(cuenta,{k:pres["niveles"][nivel][k] for k in cuenta})
                self.assertEqual(len(inf["niveles"]),3)
                mensaje = "rig ausente" if archivo == "t1" else "formato de rig antiguo"
                self.assertEqual(sum(mensaje in x for x in inf["errores"]),3)
                self.assertTrue(all(x.startswith(("base ·","rig ·")) for x in inf["errores"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
