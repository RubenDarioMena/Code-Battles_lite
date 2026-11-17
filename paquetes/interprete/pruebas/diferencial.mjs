import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { crearInterprete } from '../index.js';
import { sincronicos, asincronicos } from './corpus.mjs';
const acorn = createRequire(import.meta.url)('../../../shared/vendor/acorn-8.11.3.js');
// Resultados clonables con undefined, NaN, -0, BigInt y errores, sin comparar prototipos de realms.
export function dato(v) {
  if (v instanceof Error || v && /Error$/.test(v.name) && typeof v.message === 'string') return { tipo: v.name, mensaje: v.message };
  if (Array.isArray(v)) return Array.from(v, dato);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x]) => [k,dato(x)]));
  return v;
}
export async function comparar(codigo, async = false, preludio = '') {
  const fuente = `${preludio}\n(${async ? 'async ' : ''}function(){${codigo}\n})()`, trazas = [[], []], salidas = [];
  const registro = i => (...xs) => trazas[i].push(xs.map(dato));
  let valor, error;
  try {
    const contexto = vm.createContext({ console: { log: registro(0) }, queueMicrotask });
    valor = await vm.runInContext(fuente, contexto, { timeout: 2000 });
    // Permite que terminen cadenas ya publicadas sin await en el fragmento.
    for (let i=0;i<20;i++) await Promise.resolve();
  } catch (x) { error = { tipo: x.name, mensaje: x.message }; }
  salidas.push({ valor: dato(valor), error, traza: trazas[0] });
  const e = crearInterprete({ acorn, globales: { console: { log: registro(1) } } });
  valor = error = undefined;
  try {
    const v = e.ejecutar(fuente);
    if (async) {
      let fin = false;
      v.then(x => { valor=x; fin=true; }, x => { error={tipo:x.name,mensaje:x.message};fin=true; });
      e.vaciarTrabajos(); assert.ok(fin, 'Promesa sin resolver');
    } else { valor=v; e.vaciarTrabajos(); }
  } catch (x) { error={tipo:x.name,mensaje:x.message}; }
  salidas.push({ valor: dato(valor), error, traza: trazas[1] });
  e.liberar();
  assert.deepEqual(salidas[1], salidas[0], codigo);
}
let n=0, fallos=0;
for (const [codigos,async] of [[sincronicos,false],[asincronicos,true]]) for (const codigo of codigos) { try { await comparar(codigo,async); n++; } catch(e){fallos++;console.error(e.message);console.dir({actual:e.actual,esperado:e.expected},{depth:8});} }
assert.equal(fallos,0,'Diferencias con V8');
console.log(`Intérprete diferencial: ${n} fragmentos iguales a V8 (valor, traza, excepción).`);
