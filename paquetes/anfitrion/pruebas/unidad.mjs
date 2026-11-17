import assert from 'node:assert/strict';
import { crearTrabajadorInterprete, crearAnfitrion } from '../index.js';
import { createRequire } from 'node:module';
import { crearCanal } from '../canal.js';
import { clonar, codificar, decodificar } from '../clon.js';
const acorn = createRequire(import.meta.url)('../../../shared/vendor/acorn-8.11.3.js');
const crear = crearTrabajadorInterprete({ acorn });
// Clonado propio: ciclos, huecos, undefined, valores especiales y referencias repetidas.
const entrada = { a: [undefined, , -0, NaN, Infinity, 4n], mapa: new Map(), conjunto: new Set() };
entrada.self = entrada; entrada.mapa.set(entrada, entrada.a); entrada.conjunto.add(entrada);
for (const copiar of [clonar, valor => decodificar(codificar(valor))]) {
const copia = copiar(entrada);
assert.notEqual(copia, entrada); assert.equal(copia.self, copia);
assert.equal(copia.mapa.get(copia), copia.a); assert(copia.conjunto.has(copia));
assert.deepEqual(copia.a, entrada.a); assert(!Object.hasOwn(copia.a, 1));
assert.throws(() => copiar({ f() {} }), /no clonable|could not be cloned/);
assert.throws(() => copiar(Symbol()), /no clonable|could not be cloned/);
}
const foto = { maq: { A: { mode: 'idle' } } };
const compartido = crearCanal(() => {}, 4000, true);
const dato = { snap: foto, codigo: 'x', nombres: ['A'] };
compartido.postMessage(dato); dato.nombres.push('B');
const entregado = compartido.tarea().mensaje;
assert.equal(entregado.snap, foto); assert.deepEqual(entregado.nombres, ['A']);
compartido.terminate();
const salidas = [];
const fuente = `let cancelado;
onmessage = e => {
  const dato = e.data; queueMicrotask(() => postMessage({ dato }));
  cancelado = setTimeout(() => postMessage('cancelado'), 1); clearTimeout(cancelado);
  setTimeout(() => { postMessage('tarde'); queueMicrotask(() => postMessage('trabajo')); }, 20);
  setTimeout(() => postMessage('primero'), 5);
  setTimeout(() => postMessage('segundo'), 5);
};`;
const w = crear(fuente, 'A', m => salidas.push(m));
const m = { n: 1 }; w.postMessage(m); m.n = 2;
assert(w.entregar()); assert.deepEqual(salidas, [{ dato: { n: 1 } }]);
while (w.entregar()) {}
assert.deepEqual(salidas, [{ dato: { n: 1 } }, 'primero', 'segundo', 'tarde', 'trabajo']);
w.postMessage({ n: 3 }); w.terminate(); w.terminate();
assert.equal(w.entregar(), false); assert.equal(w.medir().liberado, true);
w.postMessage({}); assert.equal(w.entregar(), false);
// Cada entrega reinicia el presupuesto; agotar en microtareas conserva la línea del usuario.
const mensajes = [];
const limitada = crearTrabajadorInterprete({ acorn, presupuesto: 5000, mensajePresupuesto: id => `límite ${id}` });
const u = limitada(String.raw`onmessage = () => new (Object.getPrototypeOf(async function(){}).constructor)(
  'await Promise.resolve();\nwhile(true){}')();`, 'B', m => mensajes.push(m));
u.postMessage({}); assert(u.entregar());
assert.deepEqual(mensajes, [{ type: 'error', mensaje: 'límite B', linea: 2, code: 'CBL_PRESUPUESTO' }]);
assert.equal(u.medir().liberado, true); assert.equal(u.medir().trabajos, 0); assert.equal(u.entregar(), false);
const repetida = limitada(`onmessage = () => { for(let i=0;i<100;i++) {} postMessage('ok'); };`, 'C', m => mensajes.push(m));
for (let i = 0; i < 5; i++) { repetida.postMessage({}); assert(repetida.entregar()); }
assert.deepEqual(mensajes.slice(1), Array(5).fill('ok')); repetida.terminate();
// El anfitrión debe liberar todas las unidades, también las pausadas, y cerrar idempotentemente.
const unidades = [];
const anfitrion = crearAnfitrion({ reglas: { id: 'war' }, crearTrabajador(...args) {
  const unidad = crear(...args); unidades.push(unidad); return unidad;
} });
await anfitrion.cargar('A', 'await esperar(1);'); await anfitrion.cargar('B', 'await esperar(1);');
await anfitrion.ceder({ t: 0, maq: {}, auto: {}, vib: {} });
anfitrion.detener(); anfitrion.detener();
assert(unidades.every(u => u.medir().liberado && !u.entregar()));
console.log('Unidad: clonación, FIFO, timers virtuales, trabajos, presupuesto por tarea, línea y liberación.');
