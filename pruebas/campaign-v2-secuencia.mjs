import assert from 'node:assert/strict';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { componerCampaignV2 } from '../paquetes/app/index.js';
import { niveles } from '../paquetes/reglas-campaign-v2/index.js';

// La campaña alterna hitos de fábrica (sesión Campaign) y Batallas. Aquí se recorre H0 → B1 → H1 → B2 sin pantalla:
// cada hito de fábrica se cierra con cerrarFabrica, como hace la página al cumplirlo.
const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2'));
const { reglas } = config, planta = niveles['nivel-1'].fabrica;
const p = crearPartida({ reglas, escenario: config.escenario(-1), semilla: 13 });
const m = p.mundo;
assert.equal(m.hito, 'h0');
assert.equal(m.batalla, null);
assert.equal(m.bodega.misiles, planta.bodegaInicial);
// En un hito de fábrica la composición de Batallas no avanza: la planta se juega en su propia sesión.
const t0 = m.fabrica.t;
for (let i = 0; i < 50; i++) p.paso();
assert.equal(m.fabrica.t, t0);
assert.equal(reglas.cerrarFabrica(m), true);
assert.equal(m.hito, 'b1');
assert.equal(m.batalla.t, 0);
assert.equal(m.batalla.enemigos.length, 0);
const b1 = m.batalla, semilla = m.semillaIntento, fabrica = m.fabrica;
m.programas['LAU-01'] = 'mi programa';
for (let i = 0; m.hito === 'b1' && i < 1500; i++) {
  const l = b1.lanzadores[0];
  const lugar = p.instantanea().auto[l.id].visual.crawler;
  p.ordenar({ paso: p.pasoActual, origen: 'jugador', unidad: l.id, verbo: 'regularShoot', args: [lugar] });
  p.paso();
}
assert.equal(b1.final.fin, 'victoria');
// Tras B1 viene H1: la Batalla se desmonta, la planta siguió trabajando y la bodega pagó los misiles.
assert.equal(m.hito, 'h1');
assert.equal(m.batalla, null);
assert.equal(m.superado.hito, 'b1');
assert.ok(fabrica.t > t0);
// Las vistas siguen dibujando la Batalla ganada detrás de la tarjeta (antes recibían la escena de la planta y la vista
// 3D fallaba en e.enemigos.map); el checkpoint no la lleva.
const quieta = reglas.escena(m), quietaMetros = reglas.escenaMetros(m);
assert.ok(Array.isArray(quieta.enemigos) && Array.isArray(quieta.misiles) && quieta.maquinas.some(e => e.id === 'LAU-01'));
assert.ok(quietaMetros.marco && Array.isArray(quietaMetros.enemigos) && quietaMetros.bastiones.length);
assert.equal('cerrada' in reglas.serializar(m), false);
assert.ok(m.bodega.misiles < planta.bodegaInicial);
const cp = reglas.serializar(m);
assert.equal(cp.hito, 'h1');
assert.equal(cp.programas['LAU-01'], 'mi programa');
// La página recarga en la sesión de fábrica y, al cumplir H1, cierra el hito con su planta: arranca B2.
const vuelta = reglas.restaurar(cp, 41);
assert.equal(reglas.cerrarFabrica(vuelta, vuelta.fabrica), true);
assert.equal(vuelta.hito, 'b2');
assert.equal(vuelta.batalla.t, 0);
assert.equal(vuelta.batalla.atascos, 0);
assert.equal(vuelta.cerrada ?? null, null);
assert.equal(vuelta.batalla.lanzadores[0].misiles, config.retos[1].cargador);
assert.equal(vuelta.programas['LAU-01'], 'mi programa');
assert.equal(vuelta.fabrica.t, fabrica.t);
assert.equal(vuelta.bodega.misiles, m.bodega.misiles);
assert.notEqual(vuelta.semillaIntento, semilla);
// Paridad y Batallas no se cierran como fábrica.
assert.equal(reglas.cerrarFabrica(vuelta), false);
// Tras el último hito de fábrica vienen las Batallas propias: H5 monta la B6 con su vehículo.
const tras = reglas.restaurar({ ...cp, hito: 'h5' }, 3);
assert.equal(reglas.cerrarFabrica(tras), true);
assert.deepEqual([tras.hito, tras.final, !!tras.campo.aliados['VEH-01']], ['b6', null, true]);
console.log('H0 → B1 → H1 → B2: planta parada en fábrica, victoria, bodega gastada, programas, cierre de fábrica y paso de H5 a la B6 comprobados.');
