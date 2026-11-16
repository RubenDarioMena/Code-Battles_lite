// Regresiones del anfitrión: no sustituyen al contraste con Workers reales.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ejecutarWar } from '../herramientas/partida/anfitrion-war.mjs';
import { canonico, crearHuella, registro } from '../herramientas/partida/huella.mjs';
import { crearPrograma } from '../herramientas/partida/programa.mjs';
import { cargar } from '../herramientas/partida/cargar.mjs';
import { extraerFuncion, extraerConst } from './extraer-juego.mjs';

const a = await ejecutarWar({ reto: 2, semilla: 7 }), b = await ejecutarWar({ reto: 2, semilla: 7 });
assert.equal(a.hash, b.hash);
assert.deepEqual(a.resultado, b.resultado);
assert.equal(a.metricas.pasos, b.metricas.pasos);
assert.equal(canonico({ 2: 2, 10: 10, a: 0.123456789 }), '{"10":10,"2":2,"a":0.123456789}');
const h = crearHuella(), snap = { a: 1 };
h.paso(snap); snap.a = 2;
const final = h.terminar();
assert.deepEqual(final.instantanea, { a: 1 });
assert.equal(final.hash, createHash('sha256').update(registro(1, { a: 1 })).digest('hex'));

const limitado = await ejecutarWar({ reto: 2, semilla: 7, maxPasos: 11 });
assert.equal(limitado.metricas.pasos, 11);
assert.equal(limitado.resultado.fin, 'límite');
const max = await ejecutarWar({ reto: 1, semilla: 7,
  programas: { 'LAU-01': 'while (true) { console.log("a"); }' } });
assert.equal(max.resultado.fin, 'error');
assert.equal(max.metricas.mensajes.consola, 4001);
assert.match(max.resultado.texto, /4000 órdenes/);
assert.equal(max.metricas.pasos, 0);
const api = await ejecutarWar({ reto: 1, semilla: 7, programas: { 'LAU-01': 'await esperar(0);' } });
assert.equal(api.resultado.fin, 'error'); assert.equal(api.resultado.linea, 1);

const js = 'while (true) {\n const pos = autoTarget("crawler", "visual");\n regularShoot(pos);\n await esperar(0.5);\n}';
const py = 'while True:\n    pos = auto_target("crawler", "visual")\n    regular_shoot(pos)\n    await wait(0.5)';
const j = await ejecutarWar({ reto: 2, semilla: 7, programas: { 'LAU-01': js } });
const p = await ejecutarWar({ reto: 2, semilla: 7, programas: { 'LAU-01': { lenguaje: 'python', codigo: py } } });
assert.equal(j.hash, p.hash); assert.deepEqual(j.resultado, p.resultado);
await assert.rejects(() => ejecutarWar({ reto: 2, semilla: 7, programas: { 'LAU-02': '' } }), /Unidad no programable/);
await assert.rejects(() => ejecutarWar({ reto: 2, semilla: 7, programas: { 'LAU-01': 'const =' } }), /sintaxis/);

// Los bloqueos de la VM conservan el resultado público del ciclo anterior.
const sinCesion = await ejecutarWar({ reto: 1, semilla: 7,
  programas: { 'LAU-01': 'await new Promise(() => {});' } });
assert.deepEqual(sinCesion.resultado, { fin: 'bloqueado', motivo: 'sin-cesion', t: 0,
  texto: 'Programa sin espera del juego ni tarea virtual.', linea: null, idProg: null });
assert.equal(sinCesion.metricas.pasos, 0);
assert.equal(sinCesion.instantanea, null);
for (const previa of ['', 'await esperar(0.1); ']) {
  const bloqueo = await ejecutarWar({ reto: 1, semilla: 7,
    programas: { 'LAU-01': previa + 'while (true) {}' } });
  assert.deepEqual(bloqueo.resultado, { fin: 'bloqueado', motivo: 'vm-timeout', t: previa ? .1 : 0,
    texto: 'El programa no cedió dentro del límite de VM (1000 ms).', linea: null, idProg: null });
  assert.equal(bloqueo.metricas.pasos, previa ? 2 : 0);
  if (previa) {
    const hastaEspera = await ejecutarWar({ reto: 1, semilla: 7, maxPasos: 2,
      programas: { 'LAU-01': 'await esperar(0.1);' } });
    assert.equal(bloqueo.hash, hastaEspera.hash, 'el timeout conserva la huella hasta el último paso');
    assert.deepEqual(bloqueo.instantanea, hastaEspera.instantanea);
  }
}

// Dos Workers con globales separados; envío y recepción clonan, incluso entre
// la primera entrega y la continuación por temporizador virtual.
const salida = [];
const fuente = `onmessage = async (ev) => {
  self.propio = ev.data.id; await Promise.resolve();
  const m = { propio, dato: ev.data.dato }; postMessage(m); m.dato.n = 99;
  setTimeout(() => postMessage({ propio }), 5);
};`;
const w1 = crearPrograma(fuente, 'sonda1', m => salida.push(m), 4000);
const w2 = crearPrograma(fuente, 'sonda2', m => salida.push(m), 4000);
const entrada = { id: 'a', dato: { n: 1 } };
w1.postMessage(entrada); entrada.dato.n = 22;
w2.postMessage({ id: 'b', dato: { n: 2 } });
w1.entregar(); w2.entregar(); w1.entregar(); w2.entregar();
assert.deepEqual(salida, [{ propio: 'a', dato: { n: 1 } }, { propio: 'b', dato: { n: 2 } }, { propio: 'a' }, { propio: 'b' }]);
w1.terminate(); w2.terminate();
assert.equal(w1.entregar(), false);

const C = cargar().contexto;
assert.throws(() => extraerFuncion('function otra() {}', 'instrumentar', C.acorn), /no se encuentra/);
assert.throws(() => extraerConst('const otra = () => 0;', 'fmtLugar', C.acorn), /no se encuentra/);
assert.equal(extraerFuncion('function f() { return "}"; /* } */ }', 'f', C.acorn).texto,
  'function f() { return "}"; /* } */ }');
console.log('OK: repetición, huella, límite, MAX_ORDENES, error API, JS/Python, aislamiento, clonación, microtareas, timer virtual y extracción.');
