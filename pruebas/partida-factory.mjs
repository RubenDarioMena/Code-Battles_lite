// Lógica únicamente: los hashes de VM necesitan aún el contraste con Workers reales.
import assert from 'node:assert/strict';
import { ejecutarFactory } from '../herramientas/partida/anfitrion-factory.mjs';
import { ejecutarWar } from '../herramientas/partida/anfitrion-war.mjs';
import { canonico } from '../herramientas/partida/huella.mjs';
import { casosFactory, opcionesFactory, exclusionFactory } from './partida-factory-casos.mjs';

const cuentas = { iguales: 0, deltas: 0, diferencias: 0, excluidos: 0 };
console.log('caso · resultado · comparación');
for (const c of casosFactory()) {
  const opciones = opcionesFactory(c), r = ejecutarFactory(opciones);
  const exclusion = exclusionFactory(c);
  if (exclusion) {
    assert.equal(r.resultado.fin, 'bloqueado');
    assert.equal(r.resultado.motivo, 'vm-timeout');
    cuentas.excluidos++;
    console.log(`${c.id} · bloqueado/vm-timeout · EXCLUIDO: ${exclusion}`);
    continue;
  }
  // Compara todos los campos usados por factory-comun, incluidos eventos y t exacto.
  const campos = Object.keys(c.esperado).filter(k => canonico(r.resultado[k]) !== canonico(c.esperado[k]));
  const estado = campos.length ? 'DIFERENCIA' : c.delta ? 'delta aceptado' : 'igual al oráculo';
  cuentas[campos.length ? 'diferencias' : c.delta ? 'deltas' : 'iguales']++;
  console.log(`${c.id} · ${r.resultado.fin}/${r.resultado.motivo ?? '—'} · ${estado}`);
  for (const campo of campos) console.error(`${c.id}.${campo}: actual=${canonico(r.resultado[campo])}; esperado=${canonico(c.esperado[campo])}`);
  // Repetición independiente: protege determinismo del resultado y de toda la huella.
  const repetida = ejecutarFactory(opciones);
  assert.equal(r.hash, repetida.hash, `${c.id}: hash repetido`);
  assert.equal(canonico(r.resultado), canonico(repetida.resultado), `${c.id}: resultado repetido`);
}
const js = ejecutarFactory({ reto: 1, intento: 1, programas: { R1: 'await pickUp(ENT_1, "cobre");\nawait deliver(FUN);' } });
const py = ejecutarFactory({ reto: 1, semilla: 1, programas: { R1: { lenguaje: 'python', codigo: 'await pick_up(ENT_1, "cobre")\nawait deliver(FUN)' } } });
assert.equal(js.hash, py.hash);
assert.equal(canonico(js.resultado), canonico(py.resultado));
assert.equal(ejecutarFactory({ reto: 5, intento: 7 }).hash, ejecutarFactory({ reto: 5, semilla: 7 }).hash);
assert.throws(() => ejecutarFactory({ reto: 1, intento: 2, semilla: 1 }), /deben coincidir/);
assert.throws(() => ejecutarFactory({ reto: 1, intento: 0 }), /positivo/);
assert.throws(() => ejecutarFactory({ reto: 1, intento: 1, programas: { X: '' } }), /Unidad no programable/);
const limitado = ejecutarFactory({ reto: 1, intento: 1, maxPasos: 3 });
assert.equal(limitado.metricas.pasos, 3); assert.equal(limitado.resultado.fin, 'límite');
// La misma protección cubre bucles al arrancar y en una continuación de promesa.
const bloqueado = ejecutarWar({ reto: 1, semilla: 1, programas: { 'LAU-01': 'await esperar(0.1); while (true) {}' } });
assert.equal(bloqueado.resultado.fin, 'bloqueado');
console.log(`Factory: ${cuentas.iguales} iguales, ${cuentas.deltas} deltas aceptados, ${cuentas.diferencias} DIFERENCIAS, ${cuentas.excluidos} excluidos; 28 ejecutados.`);
assert.equal(cuentas.diferencias, 0, 'Diferencias NO aceptadas con el oráculo');
