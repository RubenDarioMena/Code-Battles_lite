// Pruebas del trazador: mismas líneas, mismo resultado y traza en orden de ejecución.
// node educational-animation/revision/pruebas/trazador.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const acorn = require(path.join(__dirname, '../../../shared/vendor/acorn-8.11.3.js'));
const fs = require('node:fs'), vm = require('node:vm');
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../motor/trazador.js'), 'utf8'), { filename: 'trazador.js' });
const T = globalThis.CMGTrazador;
const AF = Object.getPrototypeOf(async function () {}).constructor;
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// Ejecuta un programa con y sin ganchos; devuelve salida, eventos y tabla.
async function correr(src) {
  const salidaDe = async (codigo, extra = {}) => {
    const out = [];
    const consola = { log: (...a) => out.push(a.map(String).join(' ')) };
    await new AF('console', 'postMessage', ...Object.keys(extra), codigo)(consola, () => {}, ...Object.values(extra));
    return out;
  };
  const limpio = await salidaDe(src);
  const r = T.instrumentar(src, { acorn, enviar: '__enviar' });
  const eventos = [];
  const traza = await salidaDe(r.codigo + '\n;__T.fin()', { __enviar: (ev) => eventos.push(...ev) });
  eq(r.codigo.split('\n').length, src.split('\n').length, 'mismas líneas');
  eq(traza, limpio, 'mismo resultado con traza');
  return { ...r, eventos, salida: limpio };
}
const texto = (r, id) => r.fuente.slice(r.nodos[id].a, r.nodos[id].b);

(async () => {
  // 1 · «seis cafés»: break, continue y una comparación por vuelta.
  const cafe = `let drinkCoffee = 0
while (drinkCoffee < 10) {
  drinkCoffee = drinkCoffee + 1

  if (drinkCoffee === 8) { break }
  if (drinkCoffee === 5) { continue }

  console.log('Café')
}`;
  const c = await correr(cafe);
  eq(c.salida.length, 6, 'seis cafés');
  const cond = c.nodos.find(x => x.ganchos.includes('c') && texto(c, x.id) === 'drinkCoffee < 10');
  const vueltas = c.eventos.filter(e => e[0] === cond.id).map(e => e[1]);
  eq(vueltas, [true, true, true, true, true, true, true, true], 'la condición < 10 se evalúa 8 veces y nunca es false');
  const ocho = c.nodos.find(x => x.ganchos.includes('c') && texto(c, x.id) === 'drinkCoffee === 8');
  eq(c.eventos.filter(e => e[0] === ocho.id).map(e => e[1]).lastIndexOf(true), 7, 'break en la vuelta 8');
  const suma = c.nodos.find(x => x.ganchos.includes('v') && texto(c, x.id) === 'drinkCoffee + 1');
  eq(c.eventos.filter(e => e[0] === suma.id).map(e => e[1]), [1, 2, 3, 4, 5, 6, 7, 8], 'valores de la suma');
  const log = c.nodos.find(x => x.ganchos.includes('s') && texto(c, x.id) === "console.log('Café')");
  eq(c.eventos.filter(e => e[0] === log.id).length, 6, 'la sentencia del café se ejecuta 6 veces');

  // 2 · Casos que el trazador no puede romper: ASI, else if, if sin llaves, etiquetas, ?., typeof, ??, ternario, for.
  const raro = `let a = 0
let s = ''
let o = { b: { c: 2 } }
fuera: for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    if (j === 1) continue fuera
    a += i * j
  }
}
if (a > 99) s = 'x'
else if (typeof nada === 'undefined') s = 'y'
else s = 'z'
const k = o?.b?.c ?? 5
const m = (k > 1) ? 'grande' : 'chico'
while (a < 3) a++
const f = (x) => x * 2
console.log(a, s, k, m, f(4), [1, 2].map(f).join('-'))`;
  const r = await correr(raro);
  eq(r.salida, ['3 y 2 grande 8 2-4'], 'resultado de los casos raros');
  ok(r.eventos.some(e => r.nodos[e[0]] && r.nodos[e[0]].tipo === 'ConditionalExpression' || (r.nodos[e[0]] && texto(r, e[0]) === 'k > 1')), 'condición del ternario trazada');
  const quien = r.nodos.find(x => texto(r, x.id) === "typeof nada === 'undefined'");
  eq(r.eventos.filter(e => e[0] === quien.id).map(e => e[1]), [true], 'else if con typeof de una variable que no existe');

  // 3 · Valores especiales y espera: undefined, promesa y lote enviado antes de esperar.
  const espera = `const nada = undefined
const p = Promise.resolve(3)
const tres = await p
console.log(tres, nada)`;
  const e = await correr(espera);
  eq(e.salida, ['3 undefined'], 'await con traza');
  const idAwait = e.nodos.find(x => x.tipo === 'AwaitExpression').id;
  eq(e.eventos.find(v => v[0] === idAwait)[1], 3, 'valor tras await');
  const idP = e.nodos.find(x => x.ganchos.includes('w')).id;
  ok(e.eventos.some(v => v[0] === idP), 'gancho w antes de esperar');

  // 4 · Ningún gancho delante de un callee (conserva this).
  const este = `const o = { n: 7, f() { return this.n } }
console.log(o.f())`;
  eq((await correr(este)).salida, ['7'], 'this se conserva en métodos');

  console.log(`trazador: ${n} comprobaciones`);
})().catch(e => { console.error(e); process.exit(1); });
