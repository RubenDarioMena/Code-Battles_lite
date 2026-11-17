import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { guardarMedidas } from './medidas.mjs';
import { escenario } from './escenarios.mjs';
import { crearPrograma as vm } from '../partida/programa.mjs';
import { motorPropio } from './propio/index.mjs';
import { cargarQuickJS, motorQuickJS } from './quickjs.mjs';
import { Evaluador } from './propio/evaluador.mjs';
import { referencias, ejecutarCaso, diferencias } from './corpus.mjs';
import { codificar, decodificar } from './clon.mjs';
const Q = await cargarQuickJS();
const motores = { vm, ...(Q ? { Q: motorQuickJS(Q) } : {}), P: motorPropio() };
if (!Q) console.warn('Q omitido: falta CBL_QUICKJS.');
const datos = { cortes: [], errores: [], pasoAPaso: {} };
const clon = { u: undefined, a: [undefined, , NaN, Infinity, -0, 12n], mapa: new Map([['x', undefined]]) };
clon.ciclo = clon;
assert.deepEqual(decodificar(codificar(clon)), structuredClone(clon));
datos.clonadoDatosPlanos = true;
const casoSensor = referencias.find(c => c.id === 'factory-limite-sensores');
const bajo = await ejecutarCaso(casoSensor, motorPropio({ presupuesto: 50000 }));
datos.perfilP50000 = { caso: casoSensor.id, camposDistintos: diferencias(casoSensor, bajo), hash: bajo.hash,
  pasos: bajo.pasos, mensaje: bajo.resultado.mensaje, linea: bajo.resultado.linea };
if (Q) {
  const r = await ejecutarCaso(casoSensor, motorQuickJS(Q, { presupuesto: 5 }));
  datos.perfilQ5 = { caso: casoSensor.id, camposDistintos: diferencias(casoSensor, r), mensaje: r.resultado.mensaje };
}
const drenar = w => { let n = 0; while (w.entregar()) if (++n > 1000) throw new Error('No cede'); };
for (const [motor, crear] of Object.entries(motores)) {
  const e = escenario('war');
  for (const codigo of ['noExiste();', 'const x = null;\nx.foo;', 'await esperar(0);', 'throw new Error("fallo deliberado");']) {
    const mensajes = [], w = crear(e.fuente, e.propia, m => mensajes.push(m), 4000);
    try { w.postMessage(e.mensaje(codigo)); drenar(w); datos.errores.push({ motor, codigo, errores: mensajes.filter(m => m.type === 'error') }); }
    finally { w.terminate(); }
  }
}
const presupuestados = { ...motores, ...(Q ? { Q5: motorQuickJS(Q, { presupuesto: 5 }) } : {}), P50000: motorPropio({ presupuesto: 50000 }) };
for (const [motor, crear] of Object.entries(presupuestados).filter(([m]) => m !== 'vm')) {
  for (const [serie, nombre, codigo] of [
    ['war', 'vacío', 'while (true) {}'], ['factory', 'vacío', 'while (true) {}'],
    ['war', 'sensor', 'while (true) { const lectura = yo.missiles; }'],
    ['war', 'contador', 'globalThis.__contador = 0;\nwhile (true) { globalThis.__contador++; }'],
  ]) {
    const repeticiones = [];
    for (let i = 0; i < 2; i++) {
      const e = escenario(serie), mensajes = [], w = crear(e.fuente, e.propia, m => mensajes.push(m), 4000);
      try {
        w.postMessage(e.mensaje(codigo)); const inicio = performance.now(); drenar(w);
        const ms = performance.now() - inicio, medida = w.medir(), error = mensajes.find(m => m.type === 'error');
        assert.match(error?.mensaje ?? '', /^Presupuesto [QP] agotado/);
        repeticiones.push({ ms, error, medida });
      } finally { w.terminate(); }
    }
    const punto = r => motor.startsWith('Q') ? r.medida.corte : { nodos: r.medida.nodos, linea: r.medida.linea, contador: r.medida.contador };
    assert.deepEqual(punto(repeticiones[0]), punto(repeticiones[1]), `${motor} ${serie} ${nombre}: corte determinista`);
    datos.cortes.push({ motor, serie, nombre, determinista: true, repeticiones });
    console.log(`${motor} ${serie} ${nombre}: ${repeticiones.map(r => r.ms.toFixed(2)).join('/')} ms; ${JSON.stringify(punto(repeticiones[0]))}`);
  }
}
// Mismo programa/Worker: el intérprete suspende su generador antes de la sentencia.
{
  const e = escenario('war'), mensajes = [], w = motorPropio({ depurar: true })(e.fuente, e.propia, m => mensajes.push(m), 4000);
  const codigo = 'let x = 1;\nx += 2;\nconsole.log(x);\nawait esperar(0.1);\nconsole.log(x + 1);';
  const traza = []; let resultado;
  try {
    w.postMessage(e.mensaje(codigo)); drenar(w);
    while (w.pausas().length) { traza.push(w.pausas()[0]); w.paso(); }
    const espera = mensajes.find(m => m.type === 'espera');
    assert.ok(espera);
    assert.deepEqual(mensajes.filter(m => m.type === 'consola').map(m => m.texto), ['3']);
    w.postMessage({ type: 'despierta', id: espera.id, snap: e.snap, resultado: 'ok' }); drenar(w);
    while (w.pausas().length) { traza.push(w.pausas()[0]); w.paso(); }
    assert.deepEqual(traza.map(t => t.linea), [1, 2, 3, 4, 5]);
    assert.deepEqual(mensajes.filter(m => m.type === 'consola').map(m => m.texto), ['3', '4']);
    assert.ok(mensajes.some(m => m.type === 'done'));
    resultado = { codigo, traza, mensajes, reanudaTrasAwait: true };
  } finally { w.terminate(); }
  datos.pasoAPaso.P = resultado;
}
// Límites semánticos exploratorios: no se confunden con compatibilidad de las 41 referencias.
{
  const e = new Evaluador(); e.reiniciar();
  assert.equal(e.compilar(['return new Function("n", "return n + 2")(3);'], false)(), 5);
  datos.pasoAPaso.semanticaP = {};
  for (const [nombre, codigo] of Object.entries({ const: 'const x=1; x=2; return x;',
    tdz: 'return x; let x=1;', varFuncion: 'if(true){var x=2;} return x;' })) {
    try { datos.pasoAPaso.semanticaP[nombre] = { valor: e.compilar([codigo], false)() }; }
    catch (x) { datos.pasoAPaso.semanticaP[nombre] = { error: x.message }; }
  }
}
datos.pasoAPaso.Q = { disponible: !!Q, suspenderEnInterrupt: false,
  motivo: 'La variante release-sync expone interrupción terminal; no expone PC, gancho de línea ni continuación de la pila interrumpida.' };
guardarMedidas('diagnosticos', datos);
console.log('Paso a paso P: líneas 1→2→3→4 (await)→5, salida 3/4 y done comprobados.');
