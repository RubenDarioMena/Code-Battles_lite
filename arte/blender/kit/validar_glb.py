"""Valida el GLB que recibirá el juego. CLI y API son Python puro."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from kit import reposo, validar_rig
from kit.geometria import cruz, punto as escalar
from kit.lectura_glb import elemento, exigir, leer, matriz
from kit.rig import producto, punto, trs

KIT = Path(__file__).resolve().parent


def presupuesto(ruta):
    p = Path(ruta)
    if p.suffix == ".py":
        return runpy.run_path(str(p))["PRESUPUESTO"]
    if not p.is_file():
        p = KIT / "presupuestos" / (str(ruta)+".json")
    return json.loads(p.read_text(encoding="utf8"))


def inspeccionar(doc, pres, informe, referencia=None):
    d = doc.d
    def fallo(regla, nodo, detalle):
        informe["errores"].append(f"{regla} · {nodo} · {detalle}")
    for k in ("animations", "skins", "cameras"):
        if d.get(k):
            fallo("contenido", "-", k)
    if ("KHR_lights_punctual" in d.get("extensionsUsed", []) or
            "KHR_lights_punctual" in d.get("extensions", {})):
        fallo("contenido", "-", "luces")
    if d.get("textures") or d.get("images"):
        fallo("material", "-", "la paleta de juego requiere materiales planos sin texturas")
    for m in d["materials"]:
        k = m["name"]
        if k not in pres["paleta"]:
            fallo("material", k, "fuera de paleta")
        if (any(m.get("emissiveFactor", [])) or "emissiveTexture" in m) and k not in pres["emisivos"]:
            fallo("emision", k, "material no declarado emisivo")
    nodos = d["nodes"]
    exigir(len(d["scenes"]) == 1 and d.get("scene",0) == 0, "se requiere una única escena")
    raices = d["scenes"][0]["nodes"]
    esperadas = [f"L{i}_{pres['nombre']}" for i in range(3)]
    nombres = [elemento(nodos,i)["name"] for i in raices]
    if sorted(nombres) != sorted(esperadas):
        fallo("raices", "-", f"se esperaban {esperadas}, hay {nombres}")
    visitados = set()
    meshes_usadas = set()
    jerarquia = controles = None
    nombres_nodo = set()
    for k, nombre in enumerate(esperadas):
        if nombre not in nombres:
            continue
        pref = f"L{k}_"
        pivotes, padres, mallas = {}, {}, set()
        geometria = []
        cuenta = dict(pivotes=0, mallas=0, primitivas=0, triangulos=0)
        raiz = nodos[raices[nombres.index(nombre)]]
        m = matriz(raiz)
        determinante = escalar(m[:3],cruz(m[4:7],m[8:11]))
        if (determinante < 0 or any(abs(math.hypot(*m[j:j+3])-1) > 1e-5 for j in (0,4,8))
                or any(abs(s-1) > 1e-5 for s in raiz.get("scale", []))):
            fallo("escala", nombre, "la raíz debe tener escala 1")
        pila = [(raices[nombres.index(nombre)], None, trs())]
        while pila:
            i,padre,anterior = pila.pop()
            n = elemento(nodos,i)
            nom = n["name"]
            exigir(i not in visitados, f"ciclo o nodo con varios padres: {nom}")
            visitados.add(i)
            exigir(nom not in nombres_nodo, f"nombre de nodo repetido: {nom}")
            nombres_nodo.add(nom)
            if any(c in n for c in ("camera","skin","weights")) or "KHR_lights_punctual" in n.get("extensions", {}):
                fallo("contenido", nom, "cámara, piel, morph o luz")
            mundo = producto(anterior, matriz(n))
            corto = nom.removeprefix(pref)
            exigir(corto != nom and corto and not corto.startswith(("L0_","L1_","L2_")), f"prefijo incorrecto: {nom}")
            if "mesh" in n:
                if (padre is None or corto != padre+"_malla" or padre in mallas or n.get("children")
                        or "rig" in n.get("extras", {})):
                    fallo("malla", nom, "se requiere <pivote>_malla como única malla hoja")
                mallas.add(padre)
                cuenta["mallas"] += 1
                meshes_usadas.add(n["mesh"])
                prim = elemento(d["meshes"],n["mesh"])["primitives"]
                exigir(prim, f"malla sin primitivas: {nom}")
                cuenta["primitivas"] += len(prim)
                for p in prim:
                    tris, puntos = doc.primitiva(p)
                    cuenta["triangulos"] += tris
                    if k == 0:
                        geometria.append((padre, matriz(n), mundo, puntos))
            else:
                exigir(corto not in pivotes, f"pivote repetido: {nom}")
                pivotes[corto], padres[corto] = n,padre
                pila.extend((j,corto,mundo) for j in n.get("children", []))
        cuenta["pivotes"] = len(pivotes)
        if jerarquia is None:
            jerarquia = padres
            huella = hashlib.sha256(json.dumps(padres,sort_keys=True,ensure_ascii=False,
                                               separators=(",",":")).encode()).hexdigest()
            if pres.get("jerarquia_sha256",huella) != huella:
                fallo("jerarquia", nombre, "los pivotes o sus padres cambiaron respecto al GLB de referencia")
            controles = raiz.get("extras",{}).get("controles")
        elif padres != jerarquia:
            fallo("jerarquia", nombre, "nombres o padres de pivotes distintos de L0")
        if raiz.get("extras",{}).get("rig_v") == 2 and controles != raiz["extras"].get("controles"):
            fallo("controles", nombre, "controles distintos entre niveles")
        lista = raiz.get("extras",{}).get("controles")
        if isinstance(lista,list) and "controles" in pres and all(isinstance(c,dict) for c in lista):
            if {c.get("nombre") for c in lista} != set(pres["controles"]):
                fallo("controles", nombre, "faltan o sobran mandos respecto al descriptor")
        pila_rig = validar_rig.nivel(raiz,pivotes,padres,fallo)
        informe["niveles"][pref[:2]] = cuenta
        limite = pres["niveles"][pref[:2]]
        maximo_tris = limite.get("triangulos_max", limite["triangulos"])
        if cuenta["triangulos"] > maximo_tris:
            fallo("presupuesto", nombre, f"triángulos {cuenta['triangulos']} > máximo {maximo_tris}")
        for clave, actual in cuenta.items():
            if (clave in ("pivotes","mallas") and actual != limite[clave] or
                    clave == "primitivas" and actual > limite[clave] or
                    clave == "triangulos" and abs(actual-limite[clave]) > .01*limite[clave]):
                fallo("presupuesto", nombre, f"{clave}: {actual}, referencia {limite[clave]}")
        resueltos = {}
        if pila_rig and (k == 0 or referencia is not None):
            orden, reglas = pila_rig
            resueltos = reposo.mundos(orden,pivotes,padres,reglas)
        if referencia is not None:
            for pivote,m in resueltos.items():
                error = max(abs(x-y) for x,y in zip(m,referencia[k][pivote]))
                if error > 1e-5:
                    fallo("reposo", pref+pivote, f"error de mundo frente al depsgraph {error:.8g}")
        if k == 0:
            exigir(geometria, f"{nombre}: nivel sin geometría")
            minimo, maximo = [math.inf]*3, [-math.inf]*3
            for padre, local, mundo, puntos in geometria:
                if padre in resueltos:
                    mundo = producto(resueltos[padre],local)
                for v in puntos:
                    for eje,x in enumerate(punto(mundo,v)):
                        minimo[eje] = min(minimo[eje],x)
                        maximo[eje] = max(maximo[eje],x)
            caja = [b-a for a,b in zip(minimo,maximo)]
            exigir(all(map(math.isfinite,caja)), f"{nombre}: caja no finita")
            informe["base_y"] = minimo[1]
            informe["medidas"] = caja
            if any(abs(x-y) > .05*y for x,y in zip(caja,pres["medidas"])):
                fallo("medidas", nombre, f"caja XYZ {caja}, esperada {pres['medidas']}")
            if abs(minimo[1]) > .01:
                fallo("base", nombre, f"Y mínima {minimo[1]:.6f} m")
    if meshes_usadas != set(range(len(d["meshes"]))):
        fallo("malla", "-", "mallas sin nodo en los niveles")
    if len(visitados) != len(nodos):
        fallo("jerarquia", "-", "nodos fuera de las tres raíces")
    t = [v["triangulos"] for v in informe["niveles"].values()]
    if any(a <= b for a,b in zip(t,t[1:])):
        fallo("presupuesto", "-", "se exige L0 > L1 > L2 en triángulos")


def validar(ruta, pres, referencia=None):
    informe = dict(niveles={}, errores=[])
    try:
        inspeccionar(leer(ruta), pres, informe, referencia)
    except (OSError, ValueError, TypeError, IndexError, KeyError, ArithmeticError, AttributeError, RecursionError) as e:
        informe["errores"].append(f"GLB · {Path(ruta).name} · {e}")
    return informe


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archivo")
    parser.add_argument("--maquina", required=True)
    parser.add_argument("--json", action="store_true")
    a = parser.parse_args()
    try:
        informe = validar(a.archivo, presupuesto(a.maquina))
    except (KeyError, ValueError, OSError, ImportError, SyntaxError) as exc:
        informe = {"errores":[f"descriptor · {a.maquina} · {exc}"]}
    if a.json:
        print(json.dumps(informe, ensure_ascii=False, indent=2))
    else:
        print("\n".join(informe["errores"]) or f"GLB válido · {a.archivo}")
    return int(bool(informe["errores"]))


if __name__ == "__main__":
    sys.exit(main())
