import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { crearInterprete } from '../paquetes/interprete/index.js';
import { crearTrabajadorInterprete } from '../paquetes/anfitrion/index.js';
import { cargar } from '../herramientas/partida/cargar.mjs';
import { escenario } from '../herramientas/espina-interprete/escenarios.mjs';
import { crearPrograma as vm } from '../herramientas/partida/programa.mjs';
import { referencias, ejecutarCaso, diferencias } from '../herramientas/espina-interprete/corpus.mjs';
import './api-muchos-nombres.mjs';
const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
const nativo = crearTrabajadorInterprete({ acorn });
const drenar = w => { let n = 0; while (w.entregar()) assert(++n < 100); };
// Ámbitos con el mismo binding, compilación dinámica, this implícito e intrínsecos únicos.
const motor = crearInterprete({ acorn });
const a = motor.crearAmbito(), b = motor.crearAmbito();
a.activar(); motor.ejecutar('var nombre = "A"; self.dato = 1;');
const array = motor.ejecutar('Array.prototype');
const retenida = motor.ejecutar('(function(){ return nombre; })');
assert.throws(() => motor.ejecutar('Array.prototype.push = 1'), TypeError);
b.activar(); assert.equal(motor.ejecutar('typeof nombre'), 'undefined');
assert.equal(motor.ejecutar('Array.prototype'), array);
assert.throws(() => motor.ejecutar('"use strict"; Promise.prototype.then = 1'), TypeError);
motor.ejecutar('var nombre = "B"; self.dato = 2;');
assert.equal(motor.ejecutar('new Function("return nombre + this.dato")()'), 'B2');
a.activar(); assert.equal(motor.ejecutar('nombre + globalThis.dato'), 'A1');
a.liberar(); assert.throws(() => a.activar(), /liberado/);
assert.throws(() => retenida(), /liberado/);
b.activar(); assert.equal(motor.ejecutar('[1,2].map(x => x+1).join(",")'), '2,3');
assert.equal(motor.ejecutar('nombre'), 'B');
motor.liberar(); assert(motor.medir().liberado); assert.equal(Array.prototype.push.call([], 1), 1);
// Dos lanzadores observan la foto común y solo la fila propia refleja órdenes del turno.
function dos(crear) {
  const e = escenario('war'), mensajes = [], otro = 'LAU-02';
  e.snap.maq[otro] = structuredClone(e.snap.maq[e.propia]);
  const antes = structuredClone(e.snap);
  const w = [e.propia, otro].map((id, i) => {
    const u = crear(e.fuente, id, m => mensajes.push({ unidad: id, ...m }), 4000);
    const codigo = `globalThis.nombre = "${id}";\nregularShoot({ x: 2, y: 3 });\nconsole.log(yo.mode, ${i ? 'LAU_01' : 'LAU_02'}.mode);\nawait esperar(.1);\nconsole.log(nombre);`;
    u.postMessage({ ...e.mensaje(codigo), propia: id, nombres: [e.propia, otro] }); return u;
  });
  w.forEach(drenar); assert.deepEqual(e.snap, antes);
  w[0].terminate();
  w[1].postMessage({ type: 'despierta', snap: e.snap, id: 1 }); drenar(w[1]);
  assert.equal(mensajes.filter(m => m.type === 'consola').at(-1).texto, otro);
  assert(w[0].medir?.().liberado ?? true); w[1].terminate(); return mensajes;
}
assert.deepEqual(dos(nativo), dos(vm));
// Errores nativos de API, errores Python, línea instrumentada y mensajes defensivos.
for (const [serie, codigo, lenguaje] of [
  ['war', 'noExiste();', 'js'],
  ['war', 'const x = null;\nx.foo;', 'js'],
  ['war', 'throw new Error("fallo deliberado");', 'js'],
  ['factory', 'const x = {}; x.self = x; yo.recoger(x);', 'js'],
  ['war', 'await esperar(0);', 'js'],
  ['war', 'try { esperar(0); } catch(e) { console.log(e.stack); }', 'js'],
  ['campaign', 'await wait(0);', 'js'],
  ['war', 'x = 1 / 0', 'python'],
  ['war', 'await esperar(0)', 'python'],
  ['war', 'const p = {x:1,y:2}; regularShoot(p); p.x=999; yo.target.x=888; console.log(yo.target.x);', 'js'],
]) {
  const e = escenario(serie);
  let m = e.mensaje(codigo);
  if (lenguaje === 'python') {
    const t = cargar().contexto.CMGPythonJS.traducir(codigo, e.lenguaje.opcionesPython());
    assert(t.ok); m = { ...m, codigo: t.js, lenguaje };
  }
  const correr = crear => {
    const mensajes = [], w = crear(e.fuente, e.propia, m => mensajes.push(m), 4000);
    w.postMessage(m); drenar(w); w.terminate(); return mensajes;
  };
  assert.deepEqual(correr(nativo), correr(vm), codigo);
}
const sensor = referencias.find(c => c.id === 'factory-limite-sensores');
async function sensorCon(crear) {
  const mensajes = [];
  const resultado = await ejecutarCaso(sensor, (fuente, id, recibir, max) => crear(fuente, id, m => {
    mensajes.push(m); recibir(m);
  }, max));
  assert.deepEqual(diferencias(sensor, resultado), []); return mensajes;
}
const esperado = await sensorCon(vm);
assert.deepEqual(await sensorCon(crearTrabajadorInterprete({ acorn, presupuesto: 7024 })), esperado);
assert.notDeepEqual(await sensorCon(crearTrabajadorInterprete({ acorn, presupuesto: 7023 })), esperado);
function consolasCon(crear) {
  const e = escenario('war'), mensajes = [];
  const w = crear(e.fuente, e.propia, m => mensajes.push(m), 4000);
  w.postMessage(e.mensaje('while(true){console.log("a");}')); drenar(w); w.terminate(); return mensajes;
}
const consolas = consolasCon(vm);
assert.deepEqual(consolasCon(crearTrabajadorInterprete({ acorn, presupuesto: 44024 })), consolas);
assert.deepEqual(consolasCon(crearTrabajadorInterprete({ acorn })), consolas, 'el valor por defecto conserva la traza');
assert.notDeepEqual(consolasCon(crearTrabajadorInterprete({ acorn, presupuesto: 44023 })), consolas);
const cortes = [];
for (const codigo of ['while(true){}', 'while(true){yo.missiles;}']) {
  const medidas = [];
  for (let i = 0; i < 2; i++) {
    const e = escenario('war'), mensajes = [], w = nativo(e.fuente, e.propia, m => mensajes.push(m), 4000);
    w.postMessage(e.mensaje(codigo)); const inicio = performance.now(); drenar(w);
    cortes.push({ codigo, ms: performance.now() - inicio });
    assert.equal(mensajes.at(-1).code, 'CBL_PRESUPUESTO'); medidas.push(w.medir()); w.terminate();
  }
  assert.deepEqual(medidas[0], medidas[1]);
}
console.log(`API nativa: reino/ámbitos/liberación, capa War y errores iguales a VM; mínimo 44024 (sensor: 7024), cortes ${JSON.stringify(cortes)}.`);
