import assert from 'node:assert/strict';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { componerCampaignV2 } from '../paquetes/app/index.js';

const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2'));
const p = crearPartida({ reglas: config.reglas, escenario: config.escenario(config.indiceInicial), semilla: 13 });
const m = p.mundo, fabrica = m.fabrica;
assert.equal(m.hito, 'h0');
assert.equal(m.batalla, null);
assert.equal(m.bodega.misiles, 0);
while (m.hito === 'h0' && p.pasoActual < 300) p.paso();
assert.equal(m.hito, 'b1');
assert.equal(m.batalla.t, 0);
assert.equal(m.batalla.enemigos.length, 0);
assert.equal(m.bodega.misiles, config.h0.metas[0].n);
const b1 = m.batalla, semilla = m.semillaIntento;
const t0 = fabrica.t;
m.programas['LAU-01'] = 'mi programa';
for (let i = 0; m.hito === 'b1' && i < 1500; i++) {
  const l = b1.lanzadores[0];
  const lugar = p.instantanea().auto[l.id].visual.crawler;
  p.ordenar({ paso: p.pasoActual, origen: 'jugador', unidad: l.id, verbo: 'regularShoot', args: [lugar] });
  p.paso();
}
assert.equal(b1.final.fin, 'victoria');
assert.equal(m.hito, 'b2');
assert.equal(m.batalla.t, 0);
assert.equal(m.batalla.atascos, 0);
assert.equal(m.batalla.lanzadores[0].misiles, config.retos[1].cargador);
assert.equal(m.programas['LAU-01'], 'mi programa');
assert.notEqual(m.semillaIntento, semilla);
assert.equal(m.fabrica, fabrica);
assert.ok(fabrica.t > t0 && fabrica.producidos.missile > config.h0.metas[0].n);
console.log('H0 → B1 → B2: meta, producción continua, victoria, programas y reinicio de oleadas comprobados.');
