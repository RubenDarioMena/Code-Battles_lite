import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { componerCampaignV2, jugarPartida, crearPlataformaMemoria } from '../paquetes/app/index.js';
import { abrirCheckpoints } from '../paquetes/app/juego/checkpoints-v2.js';
import { niveles } from '../paquetes/reglas-campaign-v2/index.js';
import { crearAnfitrion, crearTrabajadorInterprete } from '../paquetes/anfitrion/index.js';
import { crearInstrumentador } from '../herramientas/partida/instrumentar.mjs';
import { crearHuella } from '../herramientas/partida/huella.mjs';

const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2'));
const { reglas } = config;
const programas = { 'LAU-01': 'while (true) { burstFire({ x: 22, y: 3 }); await esperar(0.4); }' };
const datos = { programas, vinculos: { 'LAU-01': 'compartido' },
  fuentes: { 'LAU-01': { lenguaje: 'python', texto: 'await wait(1)', enUso: false } } };
const p = crearPartida({ reglas, escenario: { ...config.escenario(-1), ...datos,
  torretas: { 'LAU-01': { x: 7, y: 8 } }, semillaFabrica: 53 }, semilla: 1 });
const almacen = crearPlataformaMemoria().almacen;
const historial = abrirCheckpoints(config, almacen);
historial.guardar(p.mundo);
// H0 se juega en la sesión de fábrica: al cerrarlo, la planta pasa a la Batalla B1.
reglas.cerrarFabrica(p.mundo);
historial.guardar(p.mundo);
const cp = JSON.parse(JSON.stringify(historial.ultimo()));
assert.equal(cp.hito, 'b1');
assert.equal(cp.semillaFabrica, 53);
assert.equal('batalla' in cp, false);
const vuelta = reglas.restaurar(cp, 29);
assert.deepEqual(reglas.serializar(vuelta), cp);
assert.deepEqual([vuelta.batalla.lanzadores[0].cx, vuelta.batalla.lanzadores[0].cy], [7.5, 8.5]);
assert.equal(vuelta.semillaIntento, 29);
assert.equal(reglas.restaurar(cp, 30).semillaIntento, 30);
const anterior = { ...cp, revision: cp.revision + 1 };
const reinicio = reglas.restaurar(anterior, 9);
// Sin checkpoint válido se vuelve a la planta recién instalada, con la bodega inicial del nivel.
assert.deepEqual([reinicio.hito, reinicio.bodega.misiles, reinicio.fabrica.t, reinicio.aviso], ['h0', niveles['nivel-1'].fabrica.bodegaInicial, 0, 'cv2.revision']);
for (const k of Object.keys(datos)) assert.deepEqual(reinicio[k], datos[k]);

async function jugar(escenario) {
  const partida = crearPartida({ reglas, escenario, semilla: 29 });
  const m = partida.mundo, b = m.batalla;
  const host = crearAnfitrion({ reglas: config.reglasProgramas, crearTrabajador: crearTrabajadorInterprete({ acorn }),
    contexto: { nombres: b.maquinas.map(l => l.id) } });
  const { instrumentar } = crearInstrumentador({ acorn }, b, 'war');
  await host.cargar('LAU-01', instrumentar(m.programas['LAU-01']));
  const huella = crearHuella();
  const r = await jugarPartida({ partida, reglas, anfitrion: host, escenario, semilla: 29,
    alPaso: (_, foto) => huella.paso({ foto, bodega: m.bodega.misiles, producidos: m.fabrica.producidos }) });
  assert.equal(r.error, null);
  assert.equal(r.limite, false);
  assert.ok(b.consumidos > 0 && b.atascos > 0);
  return { hash: huella.terminar().hash, pasos: r.pasos, fin: r.evaluacion };
}
const ensayo = { ...config.escenario(0), modo: 'ensayo', ...datos, fabrica: cp.fabrica, bodega: cp.bodega,
  torretas: cp.torretas, semillaFabrica: cp.semillaFabrica, semillaIntento: 29 };
assert.deepEqual(await jugar({ ...config.escenario(0), checkpoint: cp, semillaIntento: 29 }), await jugar(ensayo));

historial.guardarActuales({ ...datos, programas: { 'LAU-01': 'stopFire();' } });
const reabierto = abrirCheckpoints(config, almacen);
assert.equal(reabierto.actuales.programas['LAU-01'], 'stopFire();');
assert.deepEqual(reabierto.ultimo(), cp);
reabierto.volver('h0');
assert.equal(reabierto.actuales.programas['LAU-01'], 'stopFire();');
reabierto.volver('b1', true);
assert.deepEqual(reabierto.actuales, datos);
assert.equal(reabierto.lista.length, 2);
almacen.escribir('campaign-v2-nivel-1', JSON.stringify({ ultimo: 'b1', hitos: { b1: anterior } }));
const nuevo = abrirCheckpoints(config, almacen);
assert.equal(nuevo.aviso, 'cv2.revision');
assert.deepEqual(nuevo.lista.map(c => c.hito), ['h0']);
assert.deepEqual(nuevo.actuales, datos);
console.log('Checkpoint: ida y vuelta, huella con programas, revisión, selección de programas y persistencia por hito.');
