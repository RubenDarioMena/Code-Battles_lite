import assert from 'node:assert/strict';
import { montar } from './campaign-v2-intento-base.mjs';

const { conductor, partida, b, avisos, aplicar } = await montar({ textos: {
  'LAU-01': 'burstFire({x:22,y:3});\nawait esperar(30);\nlog("viejo");' } });
const l = b.porId['LAU-01'];
while (!l.atascado && !conductor.terminada) await conductor.avanzar(1);
assert.ok(l.atascado && l.misiles < b.def.cargador);
const estado = () => [partida.pasoActual, l.misiles, l.atascado, l.cx, l.cy, l.tReparar];
const antes = estado();
aplicar(l.id, 'log("nuevo");\nawait esperar(30);');
await conductor.avanzar(0);
assert.deepEqual(estado(), antes);
assert.equal(partida.mundo.batalla.porId[l.id], l);
assert.deepEqual(avisos.filter(m => m.type === 'consola').map(m => [m.linea, m.texto]), [[1, 'nuevo']]);
conductor.cerrar();
console.log('B1 conserva el lanzador atascado, su munición, posición y paso al arrancar la línea 1.');
