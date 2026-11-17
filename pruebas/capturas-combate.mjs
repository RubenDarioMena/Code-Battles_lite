// Preparación reproducible y corte exacto con el conductor real, sin abrir navegador.
import assert from 'node:assert/strict';
import { COMBATE, prepararCombate, escenaCarga } from '../herramientas/capturas-combate.mjs';
import { crearConductor } from '../paquetes/app/index.js';
import { crearPartida } from '../paquetes/nucleo/index.js';
import war, { retos } from '../paquetes/reglas-war/index.js';
import { jugar, prepararEscenario } from '../herramientas/partida/jugar.mjs';

const partida = crearPartida({ reglas: war, escenario: { reto: retos.normalizar(retos.RETOS[COMBATE.reto]) }, semilla: COMBATE.semilla });
let conductor, ejecucion, pausada = false;
const B = {
  partida, capturaLista: false, alPaso: () => {},
  elegirReto(n) { assert.equal(n, 2); }, fijarSemilla(n) { assert.equal(n, 7); }, turbo(n) { assert.equal(n, 40); },
  congelarVista() { pausada = true; conductor.cerrar(); },
  ejecutar() {
    conductor = crearConductor({ reglas: war, partida, alPaso: () => B.alPaso() });
    ejecucion = conductor.avanzar(COMBATE.paso + 500);
  },
};
prepararCombate(B, COMBATE);
await ejecucion;
assert.equal(partida.pasoActual, COMBATE.paso, 'no termina el resto del lote de pasos del fotograma');
assert.equal(B.capturaLista, true); assert.equal(pausada, true);
assert.equal((await conductor.avanzar(40)).pasos, 0, 'permanece congelada');

const fotos = [], eventos = [];
for (let i = 0; i < 2; i++) {
  const r = await jugar({ ...prepararEscenario({ reglas: 'war', reto: COMBATE.reto + 1, semilla: COMBATE.semilla }), maxPasos: COMBATE.paso });
  fotos.push(war.escena(r.partida.mundo)); eventos.push(r.partida.sucesos());
}
assert.deepEqual(fotos[0], fotos[1], 'la escena de combate se repite');
assert.deepEqual(eventos[0], eventos[1], 'VFX recibe la misma secuencia');
const foto = fotos[0];
for (const tipo of ['crawler', 'drone', 'stealth']) assert.ok(foto.enemigos.some(e => e.tipo === tipo), tipo);
assert.ok(foto.enemigos.some(e => e.z > 0)); assert.ok(foto.misiles.length);
const C = foto.enemigos.filter(e => e.tipo === 'crawler').length, D = foto.enemigos.length - C, P = foto.misiles.length;
assert.deepEqual([C, D, P], [6, 5, 1]);
const antes = JSON.stringify(foto), carga = escenaCarga(foto, 2000);
assert.equal(carga.enemigos.length, 2000); assert.equal(new Set(carga.enemigos.map(e => e.id)).size, 2000);
assert.equal(JSON.stringify(foto), antes, 'saturación solo en la copia de la vista');
assert.deepEqual(escenaCarga(foto, 2000), carga);
assert.ok(carga.enemigos.some(e => e.golpeT === foto.t));
assert.throws(() => escenaCarga(foto, -1), /entero positivo/);
console.log(`capturas-combate: corte exacto y repetición escena/sucesos; paso ${COMBATE.paso}, ${C} orugas/${D} drones/${P} misil; llamadas móviles esperadas 65→14 (rasterizado pendiente).`);
