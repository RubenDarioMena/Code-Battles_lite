import assert from 'node:assert/strict';
import { montar } from './campaign-v2-intento-base.mjs';

const { partida, b, conductor, control, ordenar, aplicar } = await montar();
await conductor.avanzar(12);
control.pausa = true;
ordenar('regularShoot', { x: 13, y: 8, z: 0 });
aplicar('LAU-01', 'log(yo.mode);');
ordenar('stopFire');
await conductor.avanzar(8);
assert.equal(partida.pasoActual, 12);
assert.deepEqual(partida.serializar().intento.entradas, []);
control.pausa = false;
await conductor.avanzar(1);
const datos = partida.serializar();
assert.deepEqual(datos.intento.entradas.map(e => [e.paso, e.verbo ?? e.tipo]),
  [[12, 'regularShoot'], [12, 'programa'], [12, 'stopFire']]);
assert.deepEqual(datos.ordenes.map(o => [o.origen, o.paso, o.verbo]),
  [['jugador', 12, 'regularShoot'], ['jugador', 12, 'stopFire']]);
assert.equal(b.porId['LAU-01'].modo, 'idle');
conductor.cerrar();
console.log('Dos órdenes y una recarga intercalada se aplican por orden en el paso de reanudación.');
