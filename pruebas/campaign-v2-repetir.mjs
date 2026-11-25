import assert from 'node:assert/strict';
import { montar } from './campaign-v2-intento-base.mjs';
import { repetirIntento } from '../paquetes/app/juego/repetir-intento.js';
import { crearHuella } from '../herramientas/partida/huella.mjs';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { componerCampaignV2 } from '../paquetes/app/index.js';

const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2'));
const planta = crearPartida({ reglas: config.reglas, escenario: config.escenario(-1), semilla: 5 });
while (planta.mundo.hito === 'h0') planta.paso();
const checkpoint = config.reglas.serializar(planta.mundo);
const huella = crearHuella(), duplicada = crearHuella();
const observar = h => (_, foto, p) => h.paso({ foto, bodega: p.mundo.bodega.misiles, producidos: p.mundo.fabrica.producidos });
const { partida, conductor, opciones, reglas, aplicar, ordenar } = await montar({
  consulta: '', checkpoint, alPaso: observar(huella), textos: { 'LAU-01': 'await esperar(10);' } });
await conductor.avanzar(20);
ordenar('burstFire', { x: 22, y: 3, z: 0 });
await conductor.avanzar(7);
ordenar('stopFire');
const fuente = 'while (true) { regularShoot(autoTarget("crawler","visual")); await esperar(0.5); }';
aplicar('LAU-01', fuente);
await conductor.avanzar(1500);
assert.equal(conductor.terminada, true);
const datos = JSON.parse(JSON.stringify(partida.serializar()));
assert.equal(datos.intento.semillaIntento, 29);
assert.deepEqual(datos.intento.entradas.map(e => [e.paso, e.verbo ?? e.fuente]),
  [[20, 'burstFire'], [27, 'stopFire'], [27, fuente]]);
const copia = await repetirIntento(datos, reglas, opciones, observar(duplicada));
assert.deepEqual(duplicada.terminar(), huella.terminar());
assert.deepEqual(copia.serializar(), datos);
assert.deepEqual(copia.evaluar(), partida.evaluar());
assert.equal(copia.mundo.hito, partida.mundo.hito);
assert.ok(!('intento' in reglas.serializar(copia.mundo)));
conductor.cerrar();
console.log('Repetición desde B1 con el intérprete y la semilla grabada: huella, órdenes, pasos y resultado idénticos.');
