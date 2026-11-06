// Regresiones de JS → Python: nombres, aliases, parámetros por defecto y ámbito.
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const ctx = vm.createContext({ window: {} });
for (const f of ['shared/vendor/acorn-8.11.3.js', 'shared/python/desde-js.js'])
  vm.runInContext(readFileSync(path.join(__dirname, '..', f), 'utf8') + (f.includes('acorn') ? ';window.acorn=acorn;' : ''), ctx, { filename: f });
const C = ctx.window.CMGJSaPython;
const nombres = new Map([['autoTarget', 'auto_target'], ['pickUp', 'pick_up']]);
const conv = src => C.convertir(src, { acorn: ctx.window.acorn, nombres });
function cpython(texto) {
  const r = spawnSync('python3', ['-c', texto], { encoding: 'utf8' });
  assert.equal(r.status, 0, `CPython rechazó:\n${texto}\n${r.stderr}`);
  return r.stdout.trimEnd();
}
let checks = 0;
function eq(a, b, msg) { assert.deepEqual(a, b, msg); checks++; }

// Identificadores que Python normaliza y los que solo JavaScript permite.
const unicode = conv('let K = 1; let K = 2; let a‌b = 3; console.log(K, K, a‌b);');
eq(unicode.ok, true, 'Unicode válido o convertible');
eq(cpython(unicode.texto), '1 2 3', 'NFKC no fusiona K/K y ZWNJ se renombra');
const collision = conv('let match = 1; let match_ = 2; let $valor = 3; console.log(match, match_, $valor);');
eq(collision.ok, true, 'keywords suaves y $ se renombran sin colisión');
eq(cpython(collision.texto), '1 2 3', 'nombres renombrados mantienen bindings distintos');
const builtin = conv('let print = 9; let print_ = 10; let len = 11; console.log(print, print_, len);');
eq(builtin.ok, true, 'los nombres locales pueden coincidir con builtins');
eq(cpython(builtin.texto), '9 10 11', 'los nombres locales no ocultan los builtins que genera el conversor');

// El alias solo cambia la función de API. El binding local conserva su propio nombre.
const local = conv('const auto_target = 9; console.log(autoTarget(), auto_target);');
eq(local.texto, 'auto_target__local = 9\nprint(auto_target(), auto_target__local)\n', 'binding local no colisiona con alias de API');
eq(cpython('def auto_target(): return 4\n' + local.texto), '4 9', 'llamada de API y binding local quedan separados');
const sombreado = conv('function f(autoTarget) { return autoTarget(); }\nautoTarget();');
eq([sombreado.ok, sombreado.linea, sombreado.motivo.includes('oculta un nombre de la API')], [false, 1, true], 'sombra local de API se diagnostica');
const miembro = conv('yo.pickUp(ENT_1);\nobj.print();');
eq(miembro.texto, 'yo.pick_up(ENT_1)\nobj.print()\n', 'se conserva el alias miembro de yo y propiedades ajenas');
eq(conv('let print = 9; obj.print();').texto, 'print_ = 9\nobj.print()\n', 'renombrar un binding no cambia una propiedad con el mismo nombre');

// Defaults literales son seguros; defaults dinámicos y undefined explícito no lo son.
const literal = conv('function f(x = 4, s = "hola", b = null) { return x; }\nconsole.log(f());');
eq(literal.ok, true, 'defaults literales admitidos');
eq(cpython(literal.texto), '4', 'default literal ejecutable en CPython');
for (const src of [
  'let d = 1; function f(x = d) { return x; } d = 2; console.log(f());',
  'function f(a, b = a) { return b; }',
  'function f(a = 1, b) { return a + b; }',
  'function f(x = 4) { return x; } console.log(f(undefined));',
]) {
  const r = conv(src);
  eq([r.ok, r.linea, /por defecto dinámico|valor por defecto|parámetros obligatorios/.test(r.motivo)], [false, 1, true], 'caso default inseguro se diagnostica');
}

// Los nombres de let/const no deben escapar de su ámbito JS en el resultado Python.
eq(conv('for (let i = 0; i < 2; i++) {}\nconsole.log(i);').ok, false, 'let del for no escapa');
eq(conv('if (true) { let x = 1; }\nconsole.log(x);').ok, false, 'let del bloque no escapa');
// El contador de un for clásico termina distinto en Python range; no inventar un resultado.
const vr = conv('for (var i = 0; i < 2; i++) {}\nconsole.log(i);');
eq([vr.ok, vr.linea, vr.motivo.includes('valor final')], [false, 1, true], 'var usado tras un for con diagnóstico');
console.log(`${checks} regresiones JS → Python correctas (CPython ${spawnSync('python3', ['--version'], { encoding: 'utf8' }).stdout.trim().replace(/^Python /, '')})`);
