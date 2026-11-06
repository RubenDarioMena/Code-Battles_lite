// Regresiones de semántica Python que el traductor debe conservar.
// Salidas contrastadas con CPython 3.12.14 y await superior al estilo del REPL de asyncio.
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');

const ctx = vm.createContext({ console, window: {} });
for (const archivo of ['shared/vendor/acorn-8.11.3.js', 'shared/vendor/lezer-python-1.1.19.js', 'shared/editor/javascript.js', 'shared/editor/plantillas.js', 'shared/editor/python.js', 'shared/python/traductor.js']) {
  vm.runInContext(readFileSync(path.join(__dirname, '..', archivo), 'utf8') +
    (archivo.includes('lezer') ? ';window.LezerPython = LezerPython;' : '') +
    (archivo.includes('acorn') ? ';window.acorn = acorn;' : ''), ctx, { filename: archivo });
}
const T = ctx.window.CMGPythonJS;
const AF = Object.getPrototypeOf(async function () {}).constructor;

async function ejecutar(src) {
  const t = T.traducir(src);
  assert.equal(t.ok, true, t.diagnosticos?.[0]?.mensaje || 'la traducción debe ser válida');
  const salida = [];
  const py = T.preludio();
  try { await new AF('__py', 'console', t.js)(py, { log: (...xs) => salida.push(xs.join(' ')) }); }
  catch (e) { salida.push(py.mensaje(e)); }
  return salida.join('\n');
}

(async () => {
  assert.equal(await ejecutar(
    'items = []\n' +
    'def agrega(xs=items):\n    xs.append(1)\n    return len(xs)\n' +
    'items = [9]\n' +
    'print(agrega(), agrega(), items)\n' +
    'def opcional(a, b=None):\n    return b\n' +
    'print(opcional(1), opcional(1, None), opcional(1, b=4))\n' +
    'g = lambda xs=[]: (xs.append(1), len(xs))[1]\n' +
    'print(g(), g())\n' +
    'x = 3\n' +
    'def captura(v=x):\n    return v\n' +
    'x = 8\n' +
    'print(captura())\n' +
    'async def async_default(xs=[]):\n    xs.append(1)\n    return len(xs)\n' +
    'print(await async_default(), await async_default())\n' +
    'a = 42\n' +
    'def outer_default(a, b=a):\n    return b\n' +
    'print(outer_default(7))\n' +
    'calls = []\n' +
    'def marker():\n    calls.append(1)\n    return len(calls)\n' +
    'def side_effect_default(v=marker()):\n    return v\n' +
    'print(len(calls), side_effect_default(99), len(calls))\n' +
    'funcs = [lambda x=i: x for i in range(3)]\n' +
    'print([f() for f in funcs])'
  ), '1 2 [9]\nNone None 4\n1 2\n3\n1 2\n42\n1 99 1\n[0, 1, 2]');

  assert.equal(await ejecutar(
    '__r = 9\n__t1 = 10\n' +
    'pares = [__r for __r in [1, 2]]\n' +
    'a, b = (3, 4)\n' +
    'print(__r, __t1, pares, a, b)'
  ), '9 10 [1, 2] 3 4');

  assert.equal(await ejecutar(
    'def invalida(a, b=a):\n    return b'
  ), "NameError: name 'a' is not defined");

  console.log('3 regresiones de semántica Python correctas');
})().catch(e => { console.error(e); process.exit(1); });
