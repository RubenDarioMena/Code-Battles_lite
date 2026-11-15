// Regresiones del anfitrión: no sustituyen al contraste con Workers reales.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ejecutarWar } from '../herramientas/partida/anfitrion-war.mjs';
import { canonico, crearHuella, registro } from '../herramientas/partida/huella.mjs';
import { crearPrograma } from '../herramientas/partida/programa.mjs';
import { cargar } from '../herramientas/partida/cargar.mjs';
import { extraerFuncion, extraerConst } from '../herramientas/partida/instrumentar.mjs';

const a = ejecutarWar({ reto: 2, semilla: 7 }), b = ejecutarWar({ reto: 2, semilla: 7 });
assert.equal(a.hash, b.hash);
assert.deepEqual(a.resultado, b.resultado);
assert.equal(a.metricas.pasos, b.metricas.pasos);
assert.equal(canonico({ 2: 2, 10: 10, a: 0.123456789 }), '{"10":10,"2":2,"a":0.123456789}');
const h = crearHuella(), snap = { a: 1 };
h.paso(snap); snap.a = 2;
const final = h.terminar();
assert.deepEqual(final.instantanea, { a: 1 });
assert.equal(final.hash, createHash('sha256').update(registro(1, { a: 1 })).digest('hex'));

const limitado = ejecutarWar({ reto: 2, semilla: 7, maxPasos: 11 });
assert.equal(limitado.metricas.pasos, 11);
assert.equal(limitado.resultado.fin, 'límite');
const max = ejecutarWar({ reto: 1, semilla: 7,
  programas: { 'LAU-01': 'while (true) { console.log("a"); }' } });
assert.equal(max.resultado.fin, 'error');
assert.equal(max.metricas.mensajes.consola, 4001);
assert.match(max.resultado.texto, /4000 órdenes/);
assert.equal(max.metricas.pasos, 0);
const api = ejecutarWar({ reto: 1, semilla: 7, programas: { 'LAU-01': 'await esperar(0);' } });
assert.equal(api.resultado.fin, 'error'); assert.equal(api.resultado.linea, 1);

const js = 'while (true) {\n const pos = autoTarget("crawler", "visual");\n regularShoot(pos);\n await esperar(0.5);\n}';
const py = 'while True:\n    pos = auto_target("crawler", "visual")\n    regular_shoot(pos)\n    await wait(0.5)';
const j = ejecutarWar({ reto: 2, semilla: 7, programas: { 'LAU-01': js } });
const p = ejecutarWar({ reto: 2, semilla: 7, programas: { 'LAU-01': { lenguaje: 'python', codigo: py } } });
assert.equal(j.hash, p.hash); assert.deepEqual(j.resultado, p.resultado);
assert.throws(() => ejecutarWar({ reto: 2, semilla: 7, programas: { 'LAU-02': '' } }), /Unidad no programable/);
assert.throws(() => ejecutarWar({ reto: 2, semilla: 7, programas: { 'LAU-01': 'const =' } }), /sintaxis/);

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
for (let reto = 1; reto <= 5; reto++) for (const semilla of [1, 7]) {
  const r = ejecutarWar({ reto, semilla });
  assert.ok(r.resultado); assert.ok(r.metricas.pasos > 0);
  console.log(`War ${reto}/${semilla} · ${r.hash.slice(0, 12)} · ${r.metricas.pasos} pasos · ${r.resultado.fin}/${r.resultado.motivo}`);
}
console.log('OK: repetición, huella, límite, MAX_ORDENES, error API, JS/Python, aislamiento, clonación, microtareas, timer virtual y extracción.');
