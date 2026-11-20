"""Árbol de expresiones de cbl-rig. El lector de Python nunca ejecuta el driver."""
import ast
import math
import operator

BINARIOS = {ast.Add: "+", ast.Sub: "-", ast.Mult: "*", ast.Div: "/", ast.Pow: "**"}
FUNCIONES = {
    "+": (2, operator.add), "-": (2, operator.sub), "*": (2, operator.mul),
    "/": (2, operator.truediv), "**": (2, operator.pow), "neg": (1, operator.neg),
    "min": (None, min), "max": (None, max), "abs": (1, abs), "sqrt": (1, math.sqrt),
    "sin": (1, math.sin), "cos": (1, math.cos), "tan": (1, math.tan),
    "clamp": (3, lambda x, bajo, alto: min(max(x, bajo), alto)),
}


def numero(x):
    try:
        return type(x) in (int, float) and math.isfinite(x)
    except OverflowError:
        return False


def operacion(op, args):
    if op not in FUNCIONES:
        raise ValueError(f"operador prohibido: {op}")
    n, funcion = FUNCIONES[op]
    if (n is None and len(args) < 2) or (n is not None and len(args) != n):
        raise ValueError(f"aridad incorrecta de {op}")
    return funcion


def calcular(op, args):
    valor = operacion(op, args)(*map(float,args))
    if not numero(valor):
        raise ValueError(f"resultado no finito o no real en {op}")
    return valor


def combinar(op, *args):
    operacion(op, args)
    if all(numero(a) for a in args):
        return calcular(op, args)
    return [op, *args]


def convertir(texto, variables):
    def visitar(n):
        if isinstance(n, ast.Constant) and numero(n.value):
            return n.value
        if isinstance(n, ast.Name):
            if n.id in variables:
                return variables[n.id]
            if n.id == "pi":
                return math.pi
        if isinstance(n, ast.BinOp) and type(n.op) in BINARIOS:
            return combinar(BINARIOS[type(n.op)], visitar(n.left), visitar(n.right))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return combinar("neg", visitar(n.operand))
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and not n.keywords:
            return combinar(n.func.id, *(visitar(a) for a in n.args))
        raise ValueError(f"expresión prohibida: {texto}")
    try:
        return visitar(ast.parse(texto, mode="eval").body)
    except SyntaxError as e:
        raise ValueError(f"expresión inválida: {texto}") from e


def evaluar(expr, controles, usados=None):
    if numero(expr):
        return expr
    if isinstance(expr, str) and expr in controles:
        if usados is not None:
            usados.add(expr)
        return controles[expr]
    if isinstance(expr, list) and expr and isinstance(expr[0], str):
        return calcular(expr[0], [evaluar(a, controles, usados) for a in expr[1:]])
    raise ValueError(f"expresión o control desconocido: {expr}")
