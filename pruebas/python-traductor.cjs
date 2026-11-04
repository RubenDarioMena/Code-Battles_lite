// E5–E7 · Python → JS y JS → Python, sin DOM: node pruebas/python-traductor.cjs
// Las salidas esperadas son las de CPython 3.13, copiadas aquí a mano (la prueba no ejecuta CPython).
// También: mismas líneas, precedencia, diagnósticos con su línea, nombres de la API (D1), await (D2),
// y la conversión por árbol de JS a Python, comprobada ejecutando los dos programas.
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const ctx = vm.createContext({ console, window: {} });
for (const archivo of ['shared/vendor/acorn-8.11.3.js', 'shared/vendor/lezer-python-1.1.19.js', 'shared/editor/javascript.js', 'shared/editor/catalogo.js', 'shared/editor/python.js', 'shared/python/traductor.js', 'shared/python/desde-js.js'])
  vm.runInContext(readFileSync(path.join(__dirname, '..', archivo), 'utf8') + (archivo.includes('lezer') ? ';window.LezerPython = LezerPython;' : '') + (archivo.includes('acorn') ? ';window.acorn = acorn;' : ''), ctx, { filename: archivo });
const { CMGPythonJS: T, CMGJSaPython: C, CMGEditorJS, CMGEditorPython } = ctx.window;
const AF = Object.getPrototypeOf(async function () {}).constructor;
let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m); checks++; };

// Un Worker de mentira: la misma tabla de alias que da el proveedor de War, con órdenes que se apuntan.
const WAR = {
  funciones: [
    { objeto: null, nombre: 'autoTarget', destino: 'autoTarget' }, { objeto: null, nombre: 'auto_target', destino: 'autoTarget' },
    { objeto: null, nombre: 'regularShoot', destino: 'regularShoot' }, { objeto: null, nombre: 'regular_shoot', destino: 'regularShoot' },
    { objeto: null, nombre: 'stopFire', destino: 'stopFire' }, { objeto: null, nombre: 'stop_fire', destino: 'stopFire' },
    { objeto: null, nombre: 'esperar', destino: 'esperar', await: true }, { objeto: null, nombre: 'wait', destino: 'esperar', await: true },
    { objeto: 'VIB_01', nombre: 'detect', destino: 'detect' }, { objeto: 'console', nombre: 'log', destino: 'log' },
  ],
  objetos: ['yo', 'LAU_01', 'VIB_01'], propiedades: ['failureRate', 'missiles', 'jammed'],
};
async function correr(src, opciones = {}, api = {}) {
  const r = T.traducir(src, opciones);
  if (!r.ok) return { diag: r.diagnosticos[0], salida: null };
  const out = [], __py = T.preludio();
  const consola = { log: t => out.push(t), info: t => out.push('info ' + t), warn: t => out.push('warn ' + t), error: t => out.push('error ' + t) };
  const nombres = Object.keys(api);
  try { await new AF('__py', 'console', ...nombres, r.js)(__py, consola, ...nombres.map(n => api[n])); }
  catch (e) { out.push(__py.mensaje(e)); }
  return { js: r.js, salida: out.join('\n') };
}
async function correrJS(src, api = {}) {
  const out = [], nombres = Object.keys(api);
  const consola = { log: (...a) => out.push(a.join(' ')) };
  await new AF('console', ...nombres, src)(consola, ...nombres.map(n => api[n]));
  return out.join('\n');
}

const NUCLEO = [
  ["x = 7\nprint(x // 2, x % 3, -7 // 2, -7 % 3, 7 / 2, 2 ** 10, 2 ** -1, -2 ** 2)\nprint(1 < x <= 10, not x and True, x > 0 and not False or 9, 0 or \"\", None or [] or 3)\nprint(True + 1, \"ab\" * 3, None, [1, \"a\", None, True], [], 3 * [0])",
   "3 1 -4 2 3.5 1024 0.5 -4\nTrue False True  3\n2 ababab None [1, 'a', None, True] [] [0, 0, 0]"],
  ["s = 0\nfor i in range(10):\n    if i % 2 == 0:\n        continue\n    if i > 7:\n        break\n    s += i\nprint(s, i)\nn = 0\nwhile n < 3:\n    n += 1\nprint(n)",
   "16 9\n3"],
  ["def f(a, b=2, *c):\n    return a + b + len(c)\nprint(f(1), f(1, 5), f(1, 2, 3, 4), f(b=10, a=1))\ng = lambda q, r=1: q * r\nprint(g(3), g(3, 4), (lambda: None)())\ndef nada():\n    pass\nprint(nada(), nada() is None)",
   "3 6 5 11\n3 12 None\nNone True"],
  ["z = 5\ndef h():\n    global z\n    z = z + 1\nh()\ndef contador():\n    k = 0\n    def inc():\n        nonlocal k\n        k += 1\n        return k\n    inc()\n    return inc()\nprint(z, contador())",
   "6 2"],
  ["x = 7\nprint(f\"n={x:>4}|{3.14159:.2f}|{x!r}|{'t'!r}|{x=}|{1000000:,}|{0.5:%}|{12:05d}|{'ab':^6}|{2.5:.0f}|{0.125:.2f}|{1e-7:g}|{-3:+d}|\")\nprint(round(2.5), round(3.5), round(2.675, 2), round(-0.5), abs(-3), min(3, 1, 2), max([4, 9, 2]))\nprint(int(\"42\") + 1, int(-3.9), float(\"2.5\"), str(3) + \"x\", bool(\"\"), bool([0]), repr(\"it's\"))\nprint(0.1 + 0.2, 1e-5, 1/3, 1e22, 0.0001, 2.0 ** 0.5, 10 / 4)\nprint(\"a\", \"b\", sep=\"-\", end=\"!\\n\")",
   "n=   7|3.14|7|'t'|x=7|1,000,000|50.000000%|00012|  ab  |2|0.12|1e-07|-3|\n2 4 2.67 0 3 1 9\n43 -3 2.5 3x False True \"it's\"\n0.30000000000000004 1e-05 0.3333333333333333 1e+22 0.0001 1.4142135623730951 2.5\na-b!"],
  ["a, b = 1, 2\na, b = b, a\nt = (1, 2)\nprint(a, b, t, (1,), len(t), t == (1, 2), [1, [2, 3]] == [1, [2, 3]], 1 == 1.0, \"1\" == 1)\nprint(\"hola\"[1], \"hola\"[-1], \"hola\"[1:3], \"hola\"[::-1], \"a\" in \"casa\", 3 not in [1, 2])\n",
   "2 1 (1, 2) (1,) 2 True True True False\no a ol aloh True True"],
];
const LISTAS = [
  ["xs = [3, 1, 2]\nxs.append(5)\nprint(xs, len(xs), xs[-1], xs[1:3], xs[::-1], xs[::2], xs[-2:], xs[:-1], xs[5:], xs[1:100], xs[3:0:-1], xs[-1:-4:-2])",
   "[3, 1, 2, 5] 4 5 [1, 2] [5, 2, 1, 3] [3, 2] [2, 5] [3, 1, 2] [] [1, 2, 5] [5, 2, 1] [5, 1]"],
  ["xs = [3, 1, 2, 5]\nprint(xs.pop(), xs.pop(0), xs)\nxs.insert(1, 9)\nxs.insert(-100, 0)\nprint(xs, xs.index(9), xs.count(2))\nxs.sort()\nprint(xs, sorted([3, 1, 2], reverse=True), sorted([\"b\", \"a\"]), sorted([-3, 1, 2], key=abs))\nxs.remove(9)\nxs.reverse()\nprint(xs)",
   "5 3 [1, 2]\n[0, 1, 9, 2] 2 1\n[0, 1, 2, 9] [3, 2, 1] ['a', 'b'] [1, 2, -3]\n[2, 1, 0]"],
  ["xs = [0, 1, 2, 9]\nys = [x * 2 for x in xs if x > 1]\nprint(ys, [i + j for i in range(3) for j in range(2) if i != j])\nx = 5\nr = [x for x in range(3)]\nprint(x, r, [[0] * 2 for _ in range(2)])",
   "[4, 18] [1, 1, 2, 3]\n5 [0, 1, 2] [[0, 0], [0, 0]]"],
  ["for i, v in enumerate([\"a\", \"b\"]):\n    print(i, v)\nfor i, v in enumerate([\"a\", \"b\"], 1):\n    print(i, v)\nprint(list(enumerate(\"ab\")))\nprint(list(range(10, 0, -3)), list(range(0)), len(range(1, 10, 2)), 4 in range(5), range(3))",
   "0 a\n1 b\n1 a\n2 b\n[(0, 'a'), (1, 'b')]\n[10, 7, 4, 1] [] 5 True range(0, 3)"],
  ["zs = [0] * 3\nzs[0] = 1\nzs[-1] += 5\nprint(zs, [1, 2] + [3], sum([1, 2, 3]), sum(range(5), 10), any([0, 0]), all([1, 1]), list(reversed([1, 2, 3])))\ndel zs[0]\na = [1, 2]\nb = a\nb += [3]\nprint(zs, a, a is b, bool([]), [] == [], [] or \"vacia\", [1] and \"llena\")\nm = [[1, 2], [3, 4]]\nprint(m[1][0], [fila[0] for fila in m], max([1, 5, 3]), min(\"bca\"), [1, 2] < [1, 3])",
   "[1, 0, 5] [1, 2, 3] 6 20 False True [3, 2, 1]\n[0, 5] [1, 2, 3] True False True vacia llena\n3 [1, 3] 5 a True"],
  ["s = \"a,b,,c\"\nprint(s.split(\",\"), \" x y \".split(), \"-\".join([\"1\", \"2\"]), \"Hola\".upper(), \"  t \".strip(), \"abc\".replace(\"b\", \"B\"), \"abc\".startswith(\"a\"), \"abc\".find(\"z\"))\n",
   "['a', 'b', '', 'c'] ['x', 'y'] 1-2 HOLA t aBc True -1"],
];
const ERRORES = [
  ["print(\"a\" + 1)",
   "TypeError: can only concatenate str (not \"int\") to str"],
  ["x = [1]\nprint(x[3])",
   "IndexError: list index out of range"],
  ["print(desconocido)",
   "NameError: name 'desconocido' is not defined"],
  ["def f(a):\n    return a\nf()",
   "TypeError: f() missing 1 required positional argument: 'a'"],
  ["print(1 / 0)",
   "ZeroDivisionError: division by zero"],
  ["x = None\nprint(x.y)",
   "AttributeError: 'NoneType' object has no attribute 'y'"],
  ["print(int(\"abc\"))",
   "ValueError: invalid literal for int() with base 10: 'abc'"],
  ["a, b = [1, 2, 3]",
   "ValueError: too many values to unpack (expected 2)"],
  ["print(len(5))",
   "TypeError: object of type 'int' has no len()"],
  ["for x in 5:\n    pass",
   "TypeError: 'int' object is not iterable"],
  ["print([1, 2] < \"a\")",
   "TypeError: '<' not supported between instances of 'list' and 'str'"],
  ["t = (1, 2)\nt[0] = 3",
   "TypeError: 'tuple' object does not support item assignment"],
  ["xs = []\nxs.pop()",
   "IndexError: pop from empty list"],
  ["print(\"x\".foo())",
   "AttributeError: 'str' object has no attribute 'foo'"],
  ["[1, 2].remove(3)\n",
   "ValueError: list.remove(x): x not in list"],
];

(async () => {
  // ---------- E5 · núcleo, E6 · listas: la misma salida que CPython ----------
  for (const [src, esperado] of NUCLEO) eq((await correr(src)).salida, esperado, 'núcleo: ' + src.split('\n')[0]);
  for (const [src, esperado] of LISTAS) eq((await correr(src)).salida, esperado, 'listas: ' + src.split('\n')[0]);
  for (const [src, esperado] of ERRORES) eq((await correr(src)).salida, esperado, 'error al estilo de Python: ' + src.split('\n')[0]);

  // ---------- Mismas líneas ----------
  const prog = '# comentario\nx = 1\n\nif x > 0:\n    print("a")  # fin\nelif x:\n    pass\nelse:\n    x += 1\ndef f(a):\n    return a\nwhile True:\n    break\n';
  const tr = T.traducir(prog, {});
  eq([tr.ok, tr.js.split('\n').length], [true, prog.split('\n').length], 'el JS tiene las mismas líneas que el Python');
  const lineaDe = (js, t) => js.split('\n').findIndex(l => l.includes(t)) + 1;
  eq([lineaDe(tr.js, 'x = 1;'), lineaDe(tr.js, 'console.log'), lineaDe(tr.js, 'else if'), lineaDe(tr.js, 'x = __py.aug'), lineaDe(tr.js, 'return a'), lineaDe(tr.js, 'break;')], [2, 5, 6, 9, 11, 13], 'cada sentencia en su línea de Python');

  // ---------- Precedencia de Python (lezer la asocia distinto) ----------
  const esperar = async () => 'ok';
  eq((await correr('a = False\nb = True\nprint(not a and b, not (a and b), not a == b, -2 ** 2, 2 ** -1, 1 + 2 * 3 ** 2)')).salida, 'True True True -4 0.5 19', 'not, ** y unarios con la precedencia de Python');
  eq((await correr('async def f():\n    return 2\nprint(await f() + 1, 1 if False else 2 or 3, 0 or 1 if True else 5)')).salida, '3 2 1', 'await se une a la llamada; if-else es lo más bajo');

  // ---------- Diagnósticos con la línea de Python ----------
  const diag = async (src, op = WAR) => { const d = (await correr(src, op)).diag; return d && [d.linea, d.mensaje.split(' (')[0]]; };
  eq(await diag('if x\n    y = 1'), [1, "SyntaxError: expected ':'"], 'falta «:»');
  eq(await diag('while x:\npass'), [2, "IndentationError: expected an indented block after 'while' statement on line 1"], 'cuerpo sin sangría');
  eq(await diag('if x:\n    a = 1\n  b = 2'), [3, 'IndentationError: unindent does not match any outer indentation level'], 'sangría que no coincide');
  eq(await diag('x = 1\n  y = 2'), [2, 'IndentationError: unexpected indent'], 'sangría de más');
  eq(await diag('print((1)'), [1, "SyntaxError: '(' was never closed"], 'paréntesis sin cerrar');
  eq(await diag('print("hola)'), [1, 'SyntaxError: unterminated string literal'], 'comillas sin cerrar');
  eq(await diag('x = 1\nregular_shoot(__lugar__)'), [2, 'Rellena el hueco __lugar__ antes de ejecutar. Doble clic en un valor del inspector lo pone en su lugar.'], 'hueco sin rellenar (D4)');
  eq(await diag('wait(1)'), [1, 'Falta await: wait espera a que termine. Escribe await wait(1).'], 'falta await en una orden que espera (D2)');
  eq(await diag('async def f():\n    await wait(1)\nf()'), [3, 'Falta await: f es async def. Escribe await f(…).'], 'falta await en una async def (D2)');
  eq(await diag('def f():\n    await wait(1)'), [2, "SyntaxError: 'await' outside async function"], 'await fuera de async def');
  eq(await diag('return 1'), [1, "SyntaxError: 'return' outside function"], 'return fuera de def');
  eq(await diag('x = {1: 2}'), [1, 'Los diccionarios aún no están en el Python del juego.'], 'lo que está fuera del subconjunto lo dice');
  eq(await diag('import os'), [1, 'import aún no está en el Python del juego.'], 'import fuera');
  eq(await diag('regular_shoot(lugar=1)'), [1, 'regular_shoot no acepta argumentos con nombre: escríbelos en orden, sin «lugar=».'], 'la API no tiene argumentos con nombre');

  // ---------- D1: nombres de la API y ámbito ----------
  const apuntes = [];
  const api = {
    autoTarget: (t, s) => { apuntes.push(`autoTarget(${t},${s})`); return t === 'crawler' ? { x: 1, y: 2 } : null; },
    regularShoot: l => { apuntes.push(`regularShoot(${l && l.x})`); return 'ok'; }, stopFire: () => { apuntes.push('stopFire'); return 'ok'; },
    esperar: async s => { apuntes.push(`esperar(${s})`); return 'ok'; },
    VIB_01: { detect: t => { apuntes.push(`detect(${t})`); return null; } }, LAU_01: { missiles: 8, failureRate: 0.25 },
  };
  const py = 'for i in range(2):\n    pos = auto_target("drone", "visual") or VIB_01.detect("crawler") or autoTarget("crawler", "radar")\n    if pos is not None:\n        regular_shoot(pos)\n    else:\n        stop_fire()\n    await wait(0.5)\nprint(LAU_01.missiles, LAU_01.failure_rate)\n';
  const js = 'for (let i = 0; i < 2; i++) {\n  const pos = autoTarget("drone", "visual") ?? VIB_01.detect("crawler") ?? autoTarget("crawler", "radar");\n  if (pos !== null) regularShoot(pos); else stopFire();\n  await esperar(0.5);\n}\nconsole.log(LAU_01.missiles, LAU_01.failureRate);\n';
  const rpy = await correr(py, WAR, api); const trazaPy = apuntes.splice(0);
  const rjs = await correrJS(js, api); const trazaJS = apuntes.splice(0);
  eq([trazaPy, rpy.salida], [trazaJS, rjs], 'Python y JS hacen las mismas llamadas a la API en el mismo orden (D1: auto_target, autoTarget y wait → esperar)');
  eq((await correr('def count():\n    return 3\nprint(count())', { ...WAR, funciones: [...WAR.funciones, { objeto: null, nombre: 'count', destino: 'count' }] })).js.includes('$count = __py.def'), true, 'una función local que se llama como la API sigue siendo local');
  eq((await correr('new = 2\nthis = 3\nprint(new + this)')).salida, '5', 'los nombres reservados de JS se renombran');

  // ---------- E7 · JS → Python por árbol ----------
  const huecos = { re: CMGEditorJS.RE_HUECO, aPython: CMGEditorPython.aHueco };
  const nombres = new Map([['esperar', 'wait'], ['autoTarget', 'auto_target'], ['regularShoot', 'regular_shoot'], ['stopFire', 'stop_fire'], ['pickUp', 'pick_up']]);
  const conv = src => C.convertir(src, { nombres, huecos, objetoONulo: ['autoTarget', 'detect'], acorn: ctx.window.acorn });
  eq(conv('while (true) {\n  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");\n  if (pos) regularShoot(pos); // dispara\n  else stopFire();\n\n  // espera\n  await esperar(0.5);\n}\n').texto,
    'while True:\n    pos = auto_target("drone", "visual") or auto_target("crawler", "visual")\n    if pos:\n        regular_shoot(pos)  # dispara\n    else:\n        stop_fire()\n\n    # espera\n    await wait(0.5)\n', 'War: bucle, ?? de una lectura, comentarios y línea en blanco');
  eq(conv('for (let i = 0; i < 3; i++) {\n  await pickUp(ENT_1, "cobre");\n  await deliver(FUN);\n}\n').texto, 'for i in range(3):\n    await pick_up(ENT_1, "cobre")\n    await deliver(FUN)\n', 'Factory: for clásico → range');
  eq(conv('const pos = autoTarget(/* tipo de enemigo */, /* sensor */);\nregularShoot(/* lugar */);').texto, 'pos = auto_target(__tipo_de_enemigo__, __sensor__)\nregular_shoot(__lugar__)\n', 'los huecos /* … */ pasan a __hueco__ (D4)');
  eq(conv('// const pos = autoTarget("crawler", "visual");\n// regularShoot(pos);\n').texto, '# pos = auto_target("crawler", "visual")\n# regular_shoot(pos)\n', 'el código comentado se convierte y sigue comentado');
  eq(conv('if (a > 1 && !b || c === null) { x++; } else if (d !== 2) { x--; } else {}\nconst r = n % 2 === 0 ? "par" : "impar";\nfor (let i = 10; i >= 0; i -= 2) n += i;\n').texto,
    'if a > 1 and not b or c == None:\n    x += 1\nelif d != 2:\n    x -= 1\nelse:\n    pass\nr = "par" if n % 2 == 0 else "impar"\nfor i in range(10, -1, -2):\n    n += i\n', 'operadores, else vacío con pass y for descendente');
  eq([conv('const o = { a: 1 };'), conv('const f = y => y;').motivo, conv('switch (x) {}').linea], [{ ok: false, motivo: 'Los objetos { … } (diccionarios) aún no están en el Python del juego.', linea: 1 }, 'Las funciones anónimas aún no tienen equivalente en el Python del juego: usa def.', 1], 'lo que no cabe se explica con su línea, sin inventar');
  eq(conv('const t = "a" + 1;\nconst u = 1 + "a";').motivo, 'Esta suma mezcla números y textos con +. En Python escríbela como f"…{x}…" o con str(x).', 'una suma de número y texto se convierte en f-string solo si empieza por texto');
  // Ida y vuelta: el JS y su conversión a Python dan la misma salida.
  for (const prog of [
    'let total = 0;\nfor (let i = 1; i <= 5; i++) { if (i % 2 === 0) continue; total += i; }\nconst xs = [1, 2, 3];\nxs.push(total);\nconsole.log("total: " + total, xs.length, xs.includes(9) ? "sí" : "no", xs[3]);',
    'function doble(n) { return n * 2; }\nlet k = 10;\nwhile (k > 0) { k -= 3; }\nconsole.log(doble(k), `k=${k}`, Math.max(k, 4), Math.floor(7 / 2));',
    'let s = "";\nfor (const c of ["a", "b"]) s = s + c;\nlet n = 0;\ndo { n++; } while (n < 3);\nconsole.log(s.toUpperCase(), n, ["x", "y"].join("-"));',
  ]) {
    const r = conv(prog);
    eq([r.ok, (await correr(r.texto)).salida], [true, await correrJS(prog)], 'JS y su conversión a Python dan lo mismo: ' + prog.split('\n')[0]);
  }
  console.log(checks + ' comprobaciones del traductor Python correctas');
})().catch(e => { console.error(e); process.exit(1); });
