import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as L from '../index.js';

const acorn = createRequire(import.meta.url)('../../../shared/vendor/acorn-8.11.3.js');
const lezer = new Function(readFileSync(new URL('../../../shared/vendor/lezer-python-1.1.19.js', import.meta.url), 'utf8') + ';return LezerPython;')();
const fuente = '/* lugar */\nconsole.log("🦾"); // autoTarget()\nawait esperar(1);';
assert.equal(L.lexico(fuente).map(t => t[1]).join(''), fuente);
assert(L.HUECO.test('/* condición */'));
assert(L.RE_HUECO.test('regularShoot(/* lugar */);'));
assert.deepEqual(L.vecino(L.lexico('yo /* nota */ .'), 0, 1), ['p', '.']);
assert.equal(L.vecino(L.lexico('yo'), 0, -1), null);
const est = L.ESTRUCTURA.analizar('if (x) { regularShoot(/* lugar */);', L.lexico('if (x) { regularShoot(/* lugar */);'));
assert.equal(est.raiz.k, 'programa');
assert(est.nodos.some(n => n.k === 'hueco'));
assert.equal(L.ESTRUCTURA.lineaDe(est, 5), 0);
assert.equal(typeof L.ESTRUCTURA.consultas().contexto, 'function');

assert.equal(L.CMGPythonJS.traducir('print(1)').ok, false);
assert.match(L.CMGPythonJS.traducir('print(1)').diagnosticos[0].mensaje, /falta el analizador/);
const a = L.crearPython({ lezer }), b = L.crearPython({ lezer });
const opciones = { objetos: ['yo'] };
const r = a.traducirCache('print(2 ** 3)', opciones);
assert(r.ok);
assert.equal(a.traducirCache('print(2 ** 3)', opciones), r);
assert.notEqual(a.traducirCache('print(2 ** 3)', { ...opciones }), r);
assert.notEqual(b.traducirCache('print(2 ** 3)', opciones), r);
const conHueco = L.crearPython({ lezer, hueco: n => n === 'pendiente' ? 'valor' : null });
assert.match(conHueco.traducir('print(pendiente)').diagnosticos[0].mensaje, /Rellena el hueco/);
assert(conHueco.traducir('print(pendiente)', { hueco: () => null }).ok);
assert(a.traducir('print(pendiente)').ok);
assert.equal(a.traducir('print(__valor__)').ok, false);
assert(a.traducir('print(__name__)').ok);
const multilinea = 'x = 2\nprint(x + 3)\n';
const traducido = a.traducir(multilinea);
assert.equal(traducido.js.split('\n').length, multilinea.split('\n').length);
// El Worker reconstruye la función en un contexto vacío: ningún cierre del paquete.
const py = vm.runInNewContext(`(${L.preludio.toString()})()`);
assert.equal(py.bin('//', -7, 3), -3);
assert.equal(py.str(null), 'None');
const salida = [];
await new (Object.getPrototypeOf(async function () {}).constructor)('__py', 'console', traducido.js)(py, { log: t => salida.push(t) });
assert.deepEqual(salida, ['5']);

assert.equal(L.CMGJSaPython.convertir('console.log(1);').ok, false);
const converter = L.crearJSaPython({ acorn });
assert.equal(converter.convertir('console.log(1);').texto.trim(), 'print(1)');
assert.equal(L.CMGJSaPython.convertir('console.log(1);', { acorn }).texto.trim(), 'print(1)');
assert(converter.convertir('const p = autoTarget();', { nombres: new Map([['autoTarget', 'auto_target']]) }).texto.includes('auto_target()'));

assert(L.vocabulario('war').FN_PROPIAS.has('regularShoot'));
assert(!L.vocabulario('factory').FN_PROPIAS.has('regularShoot'));
assert(L.vocabulario('campaign').PROPS.has('budget'));
assert(L.vocabulario('campaign').FN_MIEMBRO.has('goTo'));
L.vocabulario('war').FN_PROPIAS.clear();
assert(L.vocabulario('war').FN_PROPIAS.has('regularShoot'));
assert.equal(L.instrumentar('autoTarget();\nVIB_01.detect(); yo.stopFire();', { objetos: ['VIB_01'] }),
  '__L(1).autoTarget();\n__L(2).VIB_01.detect(); __L(2).yo.stopFire();');
assert.equal(L.instrumentar('"regularShoot()"; // esperar()\nconsole.log(1);'),
  '"regularShoot()"; // esperar()\n__L(2).console.log(1);');
for (const serie of ['factory', 'campaign']) {
  const codigo = 'const wait = () => {}; wait();\nawait ROB_1.pickUp(ENT_1, "oro");';
  assert.equal(L.instrumentar(codigo, { serie, objetos: ['ROB_1', 'ENT_1'], acorn }),
    'const wait = () => {}; wait();\nawait __L(2).ROB_1.pickUp(ENT_1, "oro");');
  assert.equal(L.instrumentar('function f({ pickUp }) { pickUp(); }', { serie, acorn }),
    'function f({ pickUp }) { pickUp(); }');
}
assert.equal(L.revisar('await esperar(1);', acorn), null);
assert.equal(L.revisar('// /* lugar */', acorn), null);
assert.equal(L.revisar('\nregularShoot(/* lugar */);', acorn).linea, 2);
assert.match(L.revisar('const =', acorn).mensaje, /Error de sintaxis/);
assert.equal(L.revisar('const ='), null);
const alias = [{ nombre: 'wait', destino: 'esperar', await: true }];
assert.deepEqual(L.opcionesPython(['ROB_1'], alias, new Set(['busy'])), {
  funciones: alias, objetos: ['yo', 'ROB_1'], propiedades: ['busy'],
});
assert.equal(L.mensajePython('autoTarget: true, null, undefined', new Map([['autoTarget', 'auto_target']])),
  'auto_target: True, None, None');
assert.equal(L.fmtLugar({ x: 1.234, y: -2, id: 'A' }), '{x: 1.23, y: -2, z: 0, id: "A"}');
assert.equal(L.fmtValor(null), 'null');
assert.equal(L.fmtValor(3), '3');
assert.equal(L.fmtValor({ x: 0, y: 0 }), '{x: 0, y: 0, z: 0}');
console.log('lenguaje: léxico, estructura, inyección, cache aislada, preludio autónomo, conversión, instrumentación y diagnósticos correctos.');
