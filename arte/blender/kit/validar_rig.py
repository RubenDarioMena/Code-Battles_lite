"""Esquema cerrado de cbl-rig v2 y dependencias por nivel."""
from graphlib import CycleError, TopologicalSorter
import re

from .expresiones import numero
from .lectura_glb import cargar_json, exigir, matriz, vector
from .rig import evaluar_local


def campos(d, obligatorios, opcionales=""):
    f, opt = set(obligatorios.split()), set(opcionales.split())
    exigir(isinstance(d, dict) and f <= d.keys() <= f | opt, f"se esperaban campos {obligatorios} ({opcionales})")


def controles(lista):
    exigir(isinstance(lista, list), "controles debe ser una lista JSON")
    reposo = {}
    for c in lista:
        campos(c, "nombre unidad reposo", "min max ciclico")
        k = c["nombre"]
        exigir(isinstance(k, str) and re.fullmatch(r"[^\W\d]\w*(\.[^\W\d]\w*)*", k) and
               not re.match(r"L\d+_", k) and k not in reposo, f"nombre duplicado o inválido: {k}")
        exigir(c["unidad"] in ("rad","m","factor") and type(c.get("ciclico", False)) is bool, f"unidad o ciclo: {k}")
        exigir(all(numero(c[x]) for x in ("min","reposo","max") if x in c) and
               c.get("min", c["reposo"]) <= c["reposo"] <= c.get("max", c["reposo"]), f"rango: {k}")
        reposo[k] = c["reposo"]
    return reposo


def unitario(v, n=3):
    vector(v, n)
    exigir(abs(sum(x*x for x in v)-1) <= 1e-5, f"vector no unitario: {v}")


def validar_local(r, nodo, reposo, usados):
    campos(r, "tipo base traslacion rotaciones escala")
    b = r["base"]
    campos(b, "t r s")
    vector(b["t"], 3)
    unitario(b["r"], 4)
    vector(b["s"], 3)
    for k in ("traslacion", "escala"):
        exigir(isinstance(r[k], list) and len(r[k]) == 3, f"{k} requiere tres expresiones")
    exigir(isinstance(r["rotaciones"], list), "rotaciones requiere una lista")
    for rot in r["rotaciones"]:
        campos(rot, "eje angulo")
        unitario(rot["eje"])
    calculada = evaluar_local(r, reposo, usados)
    error = max(abs(x-y) for x,y in zip(calculada, matriz(nodo)))
    exigir(error <= 1e-5, f"LOCAL incoherente en reposo, error {error:.8g}")


def restriccion(r):
    tipos = {"COPIAR_POSICION":"ejes invertir desplazamiento", "APUNTAR":"eje",
             "ESTIRAR":"longitud_reposo volumen abultamiento eje_fijo", "APUNTAR_BLOQUEADO":"eje bloqueo"}
    tipo = r["tipo"]
    exigir(tipo in tipos, f"tipo desconocido: {tipo}")
    campos(r, "tipo objetivo influencia " + tipos[tipo])
    exigir(numero(r["influencia"]) and 0 <= r["influencia"] <= 1, "influencia fuera de [0,1]")
    if tipo == "COPIAR_POSICION":
        for k in ("ejes", "invertir"):
            exigir(isinstance(r[k], list) and len(r[k]) == 3 and all(type(x) is bool for x in r[k]), k)
        exigir(type(r["desplazamiento"]) is bool, "desplazamiento debe ser booleano")
    if tipo in ("APUNTAR", "APUNTAR_BLOQUEADO"):
        unitario(r["eje"])
    if tipo == "APUNTAR_BLOQUEADO":
        unitario(r["bloqueo"])
        exigir(abs(sum(x*y for x,y in zip(r["bloqueo"], r["eje"]))) < 1e-5, "bloqueo no perpendicular")
    if tipo == "ESTIRAR":
        exigir(numero(r["longitud_reposo"]) and r["longitud_reposo"] > 0, "longitud_reposo inválida")
        exigir(numero(r["abultamiento"]) and r["abultamiento"] >= 0, "abultamiento inválido")
        exigir(r["volumen"] in ("NO","XZ","X","Z") and r["eje_fijo"] in ("Y","Z"), "modo ESTIRAR")


def nivel(raiz, nodos, padres, fallo):
    nombre = raiz["name"]
    e = raiz.get("extras", {})
    if e.get("rig_formato") != "cbl-rig" or type(e.get("rig_v")) is not int or e["rig_v"] != 2:
        antiguo = "controles" in e or any("rig" in n.get("extras", {}) for n in nodos.values())
        detalle = "formato de rig antiguo" if antiguo else "rig ausente"
        fallo("rig", nombre, f"{detalle}; se exige cbl-rig v2")
        return
    try:
        reposo = controles(e.get("controles"))
    except (TypeError, ValueError) as exc:
        fallo("controles", nombre, exc)
        return
    grafo = TopologicalSorter()
    usados = set()
    reglas = {}
    correcto = True
    for k,n in nodos.items():
        grafo.add(k, *([padres[k]] if padres[k] else []))
        rig = n.get("extras", {}).get("rig")
        if rig is None:
            continue
        try:
            exigir(isinstance(rig, str), "rig debe ser una cadena JSON")
            rig = cargar_json(rig)
            campos(rig, "v reglas")
            exigir(type(rig["v"]) is int and rig["v"] == 2 and isinstance(rig["reglas"], list)
                   and rig["reglas"], "formato o versión de rig incorrectos")
            reglas[k] = rig["reglas"]
            for i,r in enumerate(reglas[k]):
                if r["tipo"] == "LOCAL":
                    exigir(i == 0, "LOCAL debe aparecer una sola vez, al principio")
                    leidos = set()
                    validar_local(r,n,reposo,leidos)
                    usados.update(leidos)
                    grafo.add(k, *(("control", c) for c in leidos))
                else:
                    restriccion(r)
                    exigir(r["objetivo"] in nodos, f"objetivo inexistente: {r['objetivo']}")
                    grafo.add(k,r["objetivo"])
        except (ArithmeticError, TypeError, ValueError, KeyError) as exc:
            correcto = False
            fallo("rig", n["name"], exc)
    try:
        orden = list(grafo.static_order())
    except CycleError as exc:
        correcto = False
        fallo("ciclo", nombre, exc.args[1])
    for k in sorted(reposo.keys()-usados):
        fallo("controles", nombre, f"control sin regla: {k}")
    if correcto:
        return orden, reglas
