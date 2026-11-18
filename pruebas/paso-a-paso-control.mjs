import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { crearPartida } from '../paquetes/nucleo/index.js';
import war, { retos } from '../paquetes/reglas-war/index.js';
import campaign, { nivel } from '../paquetes/reglas-campaign/index.js';
import { crearAnfitrion, crearTrabajadorInterprete } from '../paquetes/anfitrion/index.js';
import { crearConductor } from '../paquetes/app/index.js';
import { cargar } from '../herramientas/partida/cargar.mjs';
import { crearInstrumentador } from '../herramientas/partida/instrumentar.mjs';
import { jugar, prepararEscenario } from '../herramientas/partida/jugar.mjs';
const acorn = createRequire(import.meta.url)('../shared/vendor/acorn-8.11.3.js');
const sesion = cargar();
const codigoWar = `let n = 0;
while (n < 2) {
  const lugar = autoTarget("drone", "visual");
  regularShoot(lugar);
  n++;
  await esperar(0.1);
}
console.log(n);`;
const codigoPython = `n = 0
while n < 2:
    n += 1
    print(n)
    await esperar(0.1)
print(n)`;
const codigoCampaign = `let n = 7;
const resultados = await Promise.all([FRK_01.pickUp(BAY_1), wait(0.1)]);
n += resultados.length;
console.log(n, resultados[0], resultados[1]);`;
for (const [serie, idioma, id, codigo, esperado, textos] of [
  ['war', 'js', 'LAU-01', codigoWar, [1,2,3,4,5,6,3,4,5,6,8], ['2']],
  ['war', 'python', 'LAU-01', codigoPython, [1,2,3,4,5,3,4,5,6], ['1','2','2']],
  ['campaign', 'js', 'FRK-01', codigoCampaign, [1,2,3,4], ['9 ok ok']],
]) {
  const config = serie === 'war' ? prepararEscenario({ reglas: serie, reto: 2, semilla: 7 })
    : { reglas: campaign, escenario: { reto: nivel.NIVEL }, maxPasos: 1000 };
  const lineas = [], consolas = [];
  const r = await jugar({ ...config, pasoAPaso: true, programas: { [id]: { lenguaje: idioma, codigo } },
    detener: () => consolas.length >= textos.length,
    alLinea(p) { assert.equal(p.unidad, id); lineas.push(p.linea); },
    alTurno(turno) { consolas.push(...turno.avisos.filter(m => m.type === 'consola').map(m => m.texto)); } });
  assert.equal(r.error, null); assert.deepEqual(lineas, esperado, `${serie}/${idioma}: líneas del jugador`);
  assert.deepEqual(consolas, textos, `${serie}/${idioma}: locales y resultados sobreviven`);
}

// Dos ámbitos intercalados en un solo reino: no reiniciar presupuesto al pausar,
// líneas, cierres, intrínsecos compartidos, y liberación independiente.
{
  const partida = crearPartida({ reglas: war, escenario: { reto: retos.normalizar(retos.RETOS[1]) }, semilla: 7 });
  const instrumentador = crearInstrumentador(sesion.contexto, partida.mundo, 'war');
  const mensajes = [[], []], unidades = [];
  const crear = crearTrabajadorInterprete({ acorn, piezas: sesion.piezasTrabajador, depurar: true, presupuesto: 150 });
  for (const [i, id] of ['LAU-01', 'LAU-02'].entries()) {
    const unidad = crear(sesion.fuenteWorker, id, m => mensajes[i].push(m));
    unidades.push(unidad);
    unidad.postMessage({ type: 'run', serie: 'war', codigo: instrumentador.instrumentar('let n=0;\nwhile(true){\nn++;\n}'),
      propia: id, nombres: [], tipos: [], sensores: [], conf: {}, snap: partida.instantanea() });
    assert(unidad.entregar()); assert.equal(unidad.pausa().linea, 1);
  }
  let previos = [0, 0];
  for (let n = 0; n < 200 && unidades.some(u => u.pausa()); n++) {
    const i = n % 2, u = unidades[i];
    if (!u.pausa()) continue;
    u.reanudar();
    assert(u.medir().nodos >= previos[i]); previos[i] = u.medir().nodos;
  }
  const sinPausas = [];
  const normal = crearTrabajadorInterprete({ acorn, piezas: sesion.piezasTrabajador, presupuesto: 150 })(
    sesion.fuenteWorker, 'LAU-01', m => sinPausas.push(m));
  normal.postMessage({ type: 'run', serie: 'war', codigo: instrumentador.instrumentar('let n=0;\nwhile(true){\nn++;\n}'),
    propia: 'LAU-01', nombres: [], tipos: [], sensores: [], conf: {}, snap: partida.instantanea() });
  normal.entregar();
  assert.deepEqual(sinPausas, mensajes[0]);
  assert.equal(normal.medir().nodos, unidades[0].medir().nodos);
  assert.deepEqual(mensajes[0], mensajes[1]);
  assert.equal(mensajes[0].at(-1).code, 'CBL_PRESUPUESTO');
  assert(unidades.every(u => u.medir().liberado && !u.pausa() && !u.entregar()));
}

// API del anfitrión/conductor: el reloj y el turno se retienen; continuar solo
// libera el turno actual; detener resuelve la cesión y descarta las pausas.
{
  const reglas = war;
  const partida = crearPartida({ reglas, escenario: { reto: retos.normalizar(retos.RETOS[1]) }, semilla: 7 });
  const lenguaje = crearInstrumentador(sesion.contexto, partida.mundo, 'war');
  const unidades = [];
  const crear = crearTrabajadorInterprete({ acorn, piezas: sesion.piezasTrabajador });
  const anfitrion = crearAnfitrion({ reglas, pasoAPaso: true,
    crearTrabajador(...args) { const u = crear(...args); unidades.push(u); return u; } });
  for (const id of ['LAU-02', 'LAU-01']) await anfitrion.cargar(id, lenguaje.instrumentar('let n=1;\nn++;\nawait esperar(0.1);\nconsole.log(n);'));
  const conductor = crearConductor({ reglas, partida, anfitrion });
  const a = await conductor.avanzar(5);
  assert.equal(a.esperandoPausa, true); assert.equal(a.pasos, 0); assert.equal(partida.mundo.t, 0);
  assert(anfitrion.algunoCorre()); assert.equal(anfitrion.pausas()[0].unidad, 'LAU-02');
  assert.equal(await anfitrion.avanzarLinea('desconocida'), null);
  assert.deepEqual(await conductor.avanzarLinea('LAU-02'), { unidad: 'LAU-02', linea: 2 });
  await conductor.continuar();
  assert.deepEqual(anfitrion.pausas(), []); assert.equal(anfitrion.algunoCorre(), false);
  const b = await conductor.avanzar(5);
  assert.equal(b.esperandoPausa, true); assert.equal(b.pasos, 2); assert.equal(partida.mundo.t, 0.1);
  assert.deepEqual(anfitrion.pausas()[0], { unidad: 'LAU-02', linea: 4 });
  const turno = conductor.turnoPendiente();
  conductor.cerrar(); conductor.cerrar(); await turno;
  assert.deepEqual(anfitrion.pausas(), []); assert.equal(anfitrion.algunoCorre(), false);
  assert(unidades.every(u => u.medir().liberado && !u.pausa()));
  assert.equal((await conductor.avanzar(9)).pasos, 0);
}

// El tramo síncrono de funciones async y la FIFO de trabajos conservan el orden
// aunque Promise.all arranque varias funciones interpretadas en una sentencia.
for (const espera of ['', 'await Promise.resolve();']) {
  const trazas = [[], []];
  const codigo = `async function f(n) {
console.log(n);
${espera}
console.log(n+1);
}
await Promise.all([f(1), f(3)]);
console.log("fin");`;
  for (const pasoAPaso of [false, true]) await jugar({
    ...prepararEscenario({ reglas: 'war', reto: 2, semilla: 7 }), pasoAPaso,
    programas: { 'LAU-01': codigo },
    detener: () => trazas[+pasoAPaso].some(m => m.texto === 'fin'),
    alTurno(t) { trazas[+pasoAPaso].push(...t.avisos); },
  });
  assert.deepEqual(trazas[1], trazas[0], 'Promise.all: funciones async y cola propia');
}

// CLI real: el límite vale para toda la campaña, y JSON queda limpio en stdout.
for (const max of [2, 3]) {
  const cli = spawnSync(process.execPath, ['herramientas/partida.mjs', '--reglas', 'campaign',
    '--lenguaje', 'python', '--paso-a-paso', '--max-lineas', String(max), '--json'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stderr.trim().split('\n').length, max);
  const r = JSON.parse(cli.stdout);
  assert.equal(r.resultado.registro.motivo, 'lineas');
  assert.equal(r.resultado.registro.mensaje, `Límite de ${max} líneas.`);
}
console.log('Paso a paso control: War, Campaign/Promise.all, Python, locales, presupuesto por ámbito, reloj, continuar, cierre y CLI.');
