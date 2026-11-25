"""Contenedor GLB 2.0 y accesores binarios del perfil de mallas rígidas del juego."""
import json
import math
import struct
from pathlib import Path

from .rig import trs
from .geometria import punto as escalar
from .expresiones import numero


def exigir(condicion, mensaje):
    if not condicion:
        raise ValueError(mensaje)


def elemento(lista, indice):
    exigir(type(indice) is int and 0 <= indice < len(lista), f"índice fuera de rango: {indice}")
    return lista[indice]


def vector(v, n):
    exigir(isinstance(v, (tuple, list)) and len(v) == n and all(map(numero, v)), f"vector inválido: {v}")
    return v


def matriz(n):
    if "matrix" in n:
        exigir(not {"translation", "scale", "rotation"}.intersection(n), "matrix junto a TRS")
        m = vector(n["matrix"], 16)
        exigir(m[3::4] == [0, 0, 0, 1], "matriz no afín")
        cols = [m[k:k+3] for k in (0,4,8)]
        for i,j in ((0,1),(0,2),(1,2)):
            exigir(abs(escalar(cols[i],cols[j])) <= 1e-5*math.hypot(*cols[i])*math.hypot(*cols[j]),
                   "matrix contiene cizalla")
        return m
    q = vector(n.get("rotation", [0, 0, 0, 1]), 4)
    exigir(abs(sum(x*x for x in q)-1) <= 1e-5, "cuaternión no unitario")
    return trs(vector(n.get("translation", [0]*3), 3), q, vector(n.get("scale", [1]*3), 3))


def cargar_json(texto):
    def constante(x):
        raise ValueError(f"constante ajena a JSON: {x}")
    def objeto(pares):
        resultado = dict(pares)
        exigir(len(pares) == len(resultado), "clave JSON duplicada")
        return resultado
    return json.loads(texto, parse_constant=constante, object_pairs_hook=objeto)


def leer(ruta):
    datos = Path(ruta).read_bytes()
    exigir(len(datos) >= 20, "cabecera truncada")
    magic, version, largo = struct.unpack_from("<4sII", datos)
    exigir((magic, version, largo) == (b"glTF", 2, len(datos)), "cabecera o longitud GLB incorrecta")
    bloques = []
    i = 12
    while i < largo:
        exigir(i+8 <= largo, "cabecera de bloque truncada")
        n, tipo = struct.unpack_from("<I4s", datos, i)
        i += 8
        exigir(n % 4 == 0 and i+n <= largo, "longitud de bloque incorrecta")
        bloques.append((tipo, datos[i:i+n]))
        i += n
    exigir([k for k, _ in bloques] == [b"JSON", b"BIN\0"], "se requieren JSON y BIN internos")
    d = cargar_json(bloques[0][1].decode("utf8"))
    exigir(d["asset"]["version"] == "2.0", "asset.version distinto de 2.0")
    buffers = d["buffers"]
    exigir(len(buffers) == 1 and "uri" not in buffers[0], "se requiere un solo buffer interno")
    n = buffers[0]["byteLength"]
    binario = bloques[1][1]
    exigir(type(n) is int and 0 < n <= len(binario) <= n+3 and not any(binario[n:]), "longitud o relleno de BIN incorrecto")
    return Documento(d, memoryview(binario)[:n])


class Documento:
    def __init__(self, d, binario):
        self.d = d
        self.binario = binario
        self.formatos = []
        for v in d["bufferViews"]:
            inicio, largo = v.get("byteOffset", 0), v["byteLength"]
            exigir(type(v["buffer"]) is int and v["buffer"] == 0 and type(inicio) is int and
                   type(largo) is int and inicio >= 0 and largo > 0 and inicio+largo <= len(binario),
                   "bufferView fuera del BIN")
            if "byteStride" in v:
                exigir(type(v["byteStride"]) is int and 4 <= v["byteStride"] <= 252 and v["byteStride"] % 4 == 0, "byteStride inválido")
        for a in d["accessors"]:
            exigir("sparse" not in a, "accesor disperso fuera del perfil")
            v = elemento(d["bufferViews"], a["bufferView"])
            formato = {5120:"b", 5121:"B", 5122:"h", 5123:"H", 5125:"I", 5126:"f"}[a["componentType"]]
            k = {"SCALAR":1, "VEC2":2, "VEC3":3, "VEC4":4}[a["type"]]
            lector = struct.Struct("<"+k*formato)
            offset = a.get("byteOffset", 0)
            paso = v.get("byteStride", lector.size)
            inicio = v.get("byteOffset", 0)+offset
            exigir(type(offset) is int and offset >= 0 and type(a["count"]) is int and a["count"] > 0 and paso >= lector.size and
                   inicio % struct.calcsize(formato) == 0 and
                   offset+(a["count"]-1)*paso+lector.size <= v["byteLength"], "accesor fuera de bufferView")
            self.formatos.append((lector, inicio, paso, a["count"]))

    def valores(self, indice):
        lector, inicio, paso, n = elemento(self.formatos, indice)
        return (lector.unpack_from(self.binario, inicio+i*paso) for i in range(n))

    def primitiva(self, p):
        exigir(p.get("mode", 4) == 4 and "targets" not in p, "se requieren triángulos rígidos")
        idx = p["attributes"]["POSITION"]
        a = elemento(self.d["accessors"], idx)
        exigir((a["componentType"], a["type"]) == (5126, "VEC3"), "POSITION debe ser FLOAT VEC3")
        for j in p["attributes"].values():
            exigir(elemento(self.d["accessors"], j)["count"] == a["count"], "cantidad de vértices desigual")
        posiciones = list(self.valores(idx))
        exigir(all(math.isfinite(x) for pos in posiciones for x in pos), "POSITION no finita")
        for clave, fn in (("min", min), ("max", max)):
            cotas = vector(a[clave], 3)
            exigir(all(abs(fn(col)-v) <= 1e-5 for col, v in zip(zip(*posiciones), cotas)),
                   f"POSITION.{clave} incorrecto")
        if "indices" in p:
            j = p["indices"]
            ind = elemento(self.d["accessors"], j)
            exigir(ind["type"] == "SCALAR" and ind["componentType"] in (5121,5123,5125), "tipo de índice")
            indices = [i for i, in self.valores(j)]
            exigir(max(indices) < len(posiciones), "índice de vértice fuera de POSITION")
            cantidad = len(indices)
            posiciones = [posiciones[i] for i in set(indices)]
        else:
            cantidad = len(posiciones)
        exigir(cantidad % 3 == 0, "cantidad de índices no divisible por tres")
        elemento(self.d["materials"], p["material"])
        return cantidad//3, posiciones


def escribir(ruta, d, binario):
    """Empaqueta JSON y BIN sin cambiar offsets relativos a BIN."""
    cab = json.dumps(d, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    cab += b" "*(-len(cab)%4)
    datos = bytes(binario)
    datos += b"\0"*(-len(datos)%4)
    with Path(ruta).open("wb") as f:
        f.write(struct.pack("<4sIII4s", b"glTF", 2, 28+len(cab)+len(datos), len(cab), b"JSON"))
        f.write(cab)
        f.write(struct.pack("<I4s",len(datos),b"BIN\0"))
        f.write(datos)
