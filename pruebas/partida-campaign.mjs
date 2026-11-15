// Lógica sobre el Worker real en VM. El contraste con Chromium se ejecuta aparte.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compararResultadoCampaign } from './partida-campaign-comparacion.mjs';
import { diagnosticoPartida, primeraDiferencia } from './partida-diagnostico.mjs';
import { createHash } from 'node:crypto';
import soluciones from './campaign-soluciones.cjs';
import comprobarReglas from './campaign-reglas.cjs';
import { ejecutarCampaign, programasCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';
import { registro } from '../herramientas/partida/huella.mjs';

const referencia = await comprobarReglas();
let js;
for (const lenguaje of ['js', 'python']) {
  const continuo = createHash('sha256'); let ultimo = 0;
  const a = ejecutarCampaign({ lenguaje, alPaso(n, snap) {
    assert.equal(n, ++ultimo); continuo.update(registro(n, snap));
  } });
  const b = ejecutarCampaign({ lenguaje });
  assert.equal(a.hash, continuo.digest('hex'));
  assert.equal(a.hash, b.hash); assert.deepEqual(a.tramos, b.tramos);
  assert.equal(a.resultado.hito, referencia.hito); assert.equal(a.resultado.completado, referencia.completado);
  // H0/H1 usan la misma política. Más adelante el mini-lockstep elige otras rutas;
  // no se imponen sus tiempos a los programas completos de campaign-soluciones.
  assert.deepEqual(a.resultado.hitosT.slice(0, 2), referencia.hitosT.slice(0, 2));
  assert.equal(a.instantanea.campaign.u['DEP-01'].received, referencia.porBanda);
  assert.equal(a.tramos.length, 6);
  assert.deepEqual(a.tramos.map(t => t.hito), [1, 2, 3, 4, 5, 5]);
  if (js) assert.equal(a.hash, js.hash); else js = a;
  console.log(`${lenguaje}: ${a.hash} · ${a.metricas.pasos} pasos · H5 completa`);
}
const corto = ejecutarCampaign({ maxPasos: 1 });
assert.equal(corto.tramos.length, 1); assert.equal(corto.metricas.pasos, 1);
assert.equal(corto.resultado.registro.resultado, 'límite');
const quieto = ejecutarCampaign({ programas: [{}] });
assert.equal(quieto.resultado.registro.motivo, 'quieto');
assert.throws(() => ejecutarCampaign({ programas: [] }), /lista/);
assert.throws(() => ejecutarCampaign({ programas: [{ AJENA: '' }] }), /Unidad no programable/);
assert.throws(() => ejecutarCampaign({ programas: [{ 'BLT-01': 'start();' }] }), /Unidad no programable/);
// Varios pendientes por programa: despierta/cede tras Promise.all, no solo una espera.
const simultaneo = ejecutarCampaign({ programas: [{ 'FRK-01':
  'await Promise.all([pickUp(BAY_1), wait(0.2)]); await deliver(SUP_1);' }] });
assert.equal(simultaneo.resultado.hito, 1); assert.ok(simultaneo.metricas.mensajes.cede > 0);
const explicitos = ejecutarCampaign({ programas: programasCampaign('js').slice(0, 1) });
assert.equal(explicitos.tramos[0].hash, js.tramos[0].hash);
assert.equal(ejecutarCampaign({ lenguaje: 'python', programas: soluciones.python.slice(0, 1) }).hash, explicitos.hash);
console.log('Campaign sin pantalla: referencia JS/Python repetible, continuidad, cortes y límites correctos');

// Evidencia mínima del contraste Chromium: mismos eventos simultáneos, otro
// intercalado entre Workers. Todos los campos y el FIFO por unidad siguen contando.
const intercalados = JSON.parse(readFileSync(new URL('./partida-campaign-intercalado.json', import.meta.url), 'utf8'));
for (const caso of intercalados) {
  const juego = { eventos: caso.juego }, sinPantalla = { eventos: caso.sinPantalla };
  assert.notDeepEqual(juego, sinPantalla);
  const antes = structuredClone(juego);
  assert.deepEqual(compararResultadoCampaign(juego), compararResultadoCampaign(sinPantalla));
  assert.deepEqual(juego, antes, 'comparar no altera la captura original');
  const cambiado = structuredClone(sinPantalla); cambiado.eventos[0].resultado = 'otro';
  assert.notDeepEqual(compararResultadoCampaign(juego), compararResultadoCampaign(cambiado));
  cambiado.eventos = cambiado.eventos.slice(1);
  assert.notDeepEqual(compararResultadoCampaign(juego), compararResultadoCampaign(cambiado));
}
const a = { t: 1, maquina: 'BOT-01', resultado: 'a' }, b = { ...a, resultado: 'b' };
assert.notDeepEqual(compararResultadoCampaign({ eventos: [a, b] }), compararResultadoCampaign({ eventos: [b, a] }));
assert.notDeepEqual(compararResultadoCampaign({ eventos: [a, { ...b, t: 2 }] }),
  compararResultadoCampaign({ eventos: [{ ...b, t: 2 }, a] }));
assert.deepEqual(primeraDiferencia({ x: [1, 2] }, { x: [1, 3] }),
  { ruta: 'x[1]', juego: 2, sinPantalla: 3 });
assert.equal(primeraDiferencia({ x: 1 }, { y: 1 }).ruta, 'x');
const diagnostico = diagnosticoPartida({
  juego: { resultado: { uso: 1 }, tramos: [{ resultado: { t: 1 } }] },
  sinPantalla: { resultado: { uso: 2 }, tramos: [{ resultado: { t: 2 } }] },
  errores: ['x'.repeat(1000) + '\nsegunda línea'] });
assert.ok(diagnostico.some(l => l.startsWith('resultado.uso ·')));
assert.ok(diagnostico.some(l => l.startsWith('tramos[0].resultado.t ·')));
assert.ok(diagnostico.some(l => l.startsWith('errores[0] ·')));
const masivo = diagnosticoPartida({ juego: { tramos: Array(100).fill({ t: 'x'.repeat(1000) }) },
  sinPantalla: { tramos: Array(100).fill({ t: 'y'.repeat(1000) }) }, errores: Array(100).fill('error'.repeat(1000)) });
for (const lineas of [diagnostico, masivo]) {
  assert.ok(lineas.length <= 19);
  assert.ok(lineas.every(l => l.length <= 300 && !l.includes('\n') && l.includes(' · sin pantalla=')));
}
console.log('Contraste: intercalado simultáneo acotado y diagnóstico limitado correctos');
