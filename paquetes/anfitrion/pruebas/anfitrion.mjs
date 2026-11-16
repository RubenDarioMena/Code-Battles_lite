// Pruebas del anfitrión en Node: texto del Worker, ejecución en VM y despertar del lockstep.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fuenteTrabajador, algunoCorre, despertar, despertarCampaign, crearAnfitrion } from '../index.js';

let comprobaciones = 0;
const igual = (a, b, m) => { assert.deepEqual(a, b, m); comprobaciones++; };
const ok = (v, m) => { assert.ok(v, m); comprobaciones++; };

// Texto: sin piezas usa los valores neutros; con piezas, su texto literal.
const neutro = fuenteTrabajador();
ok(neutro.includes('const validarFactory = () => null;'), 'validarFactory neutro');
ok(neutro.includes('const __py = (() => null)();'), 'preludio neutro');
ok(neutro.includes("const modoCampaign = () => 'ok';"), 'modo neutro');
igual(fuenteTrabajador(), neutro, 'el texto es determinista');
function validarDePrueba(s, v) { return v === 'malo' ? 'no' : null; }
const conPiezas = fuenteTrabajador({ validarFactory: validarDePrueba, validarCampaign: '(c) => null' });
ok(conPiezas.includes(`const validarFactory = ${validarDePrueba.toString()};`), 'función por texto');
ok(conPiezas.includes('const validarCampaign = (c) => null;'), 'cadena tal cual');
new vm.Script(neutro); comprobaciones++;
new vm.Script(conPiezas); comprobaciones++;

/** Ejecuta el texto del Worker en una VM y devuelve sus mensajes tras vaciar microtareas.
 * @param {string} fuente */
function trabajador(fuente) {
  const salidas = [];
  const c = vm.createContext({ postMessage: m => salidas.push(structuredClone(m)), setTimeout: () => 0 }, { microtaskMode: 'afterEvaluate' });
  vm.runInContext('self = globalThis;\n' + fuente, c);
  return {
    salidas,
    enviar(m) { c.__m = structuredClone(m); vm.runInContext('onmessage({ data: __m });', c); },
  };
}
const snapWar = {
  t: 0, maq: { 'LAU-01': { failureRate: 0.02, missiles: 8, mode: 'idle', jammed: false, fireRate: 0, sensors: ['visual'], target: null } },
  auto: { 'LAU-01': { visual: { drone: { x: 10, y: 5, z: 2.5, id: 'D1' } } } }, vib: {},
};
const conf = { fallaRafaga: 0.04, cadencia: 1, cadenciaRafaga: 2.2 };
const run = (codigo, extra = {}) => ({ type: 'run', serie: 'war', lenguaje: 'js', codigo, propia: 'LAU-01', nombres: ['LAU-01'],
  tipos: ['crawler', 'drone', 'stealth'], sensores: ['visual', 'thermal'], conf, snap: snapWar, ...extra });

// Un programa War: lee, dispara y espera; la espera devuelve el turno al anfitrión.
const w = trabajador(neutro);
w.enviar(run('const o = __L(1).autoTarget("drone", "visual");\n__L(2).regularShoot(o);\nawait __L(3).esperar(0.5);\n__L(4).log("fin");'));
igual(w.salidas.map(m => m.type), ['lee', 'cmd', 'espera'], 'lectura, orden y espera');
igual(w.salidas[0].valor, { x: 10, y: 5, z: 2.5, id: 'D1' }, 'la lectura sale de la instantánea');
igual([w.salidas[1].verbo, w.salidas[1].res, w.salidas[1].lugar], ['regularShoot', 'ok', { x: 10, y: 5, z: 2.5, id: 'D1' }], 'orden con lugar');
igual([w.salidas[2].linea, w.salidas[2].s], [3, 0.5], 'espera con línea');
w.enviar({ type: 'despierta', id: w.salidas[2].id, snap: { ...snapWar, t: 0.5 } });
igual(w.salidas.slice(3).map(m => [m.type, m.texto ?? null]), [['consola', 'fin'], ['done', null]], 'despierta y termina');

// Errores con línea y nombres de la API.
const e = trabajador(neutro);
e.enviar(run('await __L(1).esperar(99);'));
igual(e.salidas.map(m => [m.type, m.linea]), [['error', 1]], 'espera fuera de rango');
ok(/esperar necesita segundos/.test(e.salidas[0].mensaje), 'mensaje de la API real');
const s = trabajador(neutro);
s.enviar(run('esto no es js ('));
igual(s.salidas[0].type, 'error', 'error de sintaxis');
ok(s.salidas[0].mensaje.startsWith('Error de sintaxis'), 'texto del error de sintaxis');

// Factory: validarFactory llega por su texto y decide antes de enviar el encargo.
const f = trabajador(fuenteTrabajador({ validarFactory: (_s, verbo) => verbo === 'recoger' ? 'Prohibido.' : null }));
f.enviar(run('await __L(1).recoger("A", "cobre");', { serie: 'factory', propia: 'R1', nombres: ['R1'], snap: { t: 0, maq: {}, auto: {}, vib: {}, factory: { porId: {} } } }));
igual(f.salidas.map(m => [m.type, m.mensaje, m.linea]), [['error', 'Prohibido.', 1]], 'validación inyectada');

// Despertar: el lockstep elige los programas vencidos con una sola instantánea.
const enviados = [];
const prog = (id, extra) => ({ id, estado: 'espera', desde: 0, mensajes: 9, espera: 1, despertar: 1, pend: new Map(),
  worker: { postMessage: m => enviados.push([id, m]), terminate() {} }, ...extra });
const ejec = { progs: new Map([['A', prog('A')], ['B', prog('B', { despertar: 2, espera: 7 })]]) };
let tomas = 0;
const foto = () => ({ n: ++tomas });
igual(algunoCorre(ejec), false, 'nadie corre');
igual(despertar(ejec, { t: 0.5 }, foto), false, 'nadie vencido');
igual(despertar(ejec, { t: 1 - 1e-10 }, foto, () => 42), true, 'tolerancia 1e-9');
igual(enviados, [['A', { type: 'despierta', id: 1, snap: { n: 1 } }]], 'despierta solo a A');
igual([ejec.progs.get('A').estado, ejec.progs.get('A').desde, ejec.progs.get('A').mensajes], ['corre', 42, 0], 'estado y vigía');
igual(algunoCorre(ejec), true, 'A corre');
igual(algunoCorre(null), false, 'sin ejecución');
igual(despertar(null, { t: 0 }, foto), false, 'sin ejecución no despierta');

// Campaign: varias esperas por programa; los encargos no despiertan por tiempo.
const envC = [];
const pc = { id: 'C', estado: 'espera', desde: 0, mensajes: 3, espera: null, despertar: 0, worker: { postMessage: m => envC.push(m), terminate() {} },
  pend: new Map([[1, { tipo: 'espera', despertar: 1 }], [2, { tipo: 'encargo' }], [3, { tipo: 'espera', despertar: 1 }], [4, { tipo: 'espera', despertar: 5 }]]) };
const ejecC = { progs: new Map([['C', pc]]) };
tomas = 0;
igual(despertarCampaign(ejecC, { t: 1 }, foto), true, 'Campaign despierta');
igual(envC.map(m => [m.id, m.snap.n]), [[1, 1], [3, 1]], 'vencidas en orden, una sola instantánea');
igual([...pc.pend.keys()], [2, 4], 'quedan el encargo y la espera futura');
igual(despertarCampaign(ejecC, { t: 1 }, foto), false, 'nada más que despertar');

// crearAnfitrion con Workers asíncronos falsos: el orden de llegada real no cambia el resultado.
const reglasWar = { id: 'war', api: { tipos: { drone: {} }, sensores: { visual: {} }, conf: { cadencia: 1 } } };
/** Trabajador que contesta cuando el reloj de la prueba quiere, en el orden que se le diga. */
function falsos() {
  const cola = [], creados = new Map();
  const crear = (_fuente, unidad, recibir) => {
    const w = { unidad, recibidos: [], terminado: false, guion: [],
      postMessage(m) { w.recibidos.push(m); for (const r of w.guion.shift() || []) cola.push(() => recibir(r)); },
      terminate() { w.terminado = true; } };
    creados.set(unidad, w);
    return w;
  };
  return { crear, creados, async soltar(orden) {
    // Entrega los mensajes pendientes en el orden pedido (índices sobre la cola) y cede al anfitrión.
    const tareas = cola.splice(0); for (const i of orden ?? tareas.map((_, k) => k)) { tareas[i](); await null; }
  } };
}
const cmd = (verbo, x) => ({ type: 'cmd', linea: 1, verbo, lugar: { x, y: 1, z: 0, id: null }, res: 'ok' });
for (const invertido of [false, true]) {
  const f = falsos();
  const a = crearAnfitrion({ reglas: reglasWar, crearTrabajador: f.crear, contexto: { nombres: ['A', 'B'] } });
  await a.cargar('A', 'codigoA'); await a.cargar('B', 'codigoB');
  f.creados.get('A').guion.push([cmd('regularShoot', 1), { type: 'espera', id: 1, linea: 2, s: 0.5 }]);
  f.creados.get('B').guion.push([cmd('burstFire', 2), { type: 'espera', id: 1, linea: 2, s: 0.25 }]);
  const turno = a.ceder({ t: 0 });
  await f.soltar(invertido ? [2, 3, 0, 1] : [0, 1, 2, 3]);
  const r = await turno;
  igual(r.ordenes.map(o => [o.unidad, o.verbo, o.paso, o.origen]), [['A', 'regularShoot', 0, 'programa'], ['B', 'burstFire', 0, 'programa']],
    `orden por unidad y llegada (${invertido ? 'B llega antes' : 'A llega antes'})`);
  igual(r.avisos.map(m => `${m.unidad}.${m.type}`), ['A.cmd', 'A.espera', 'B.cmd', 'B.espera'], 'avisos en el mismo orden');
  igual(f.creados.get('A').recibidos[0].type, 'run', 'el primer ceder arranca');
  igual(f.creados.get('A').recibidos[0].conf, { cadencia: 1 }, 'conf del reglamento');
  igual(f.creados.get('B').recibidos[0].nombres, ['A', 'B'], 'nombres del contexto');
  igual(a.proximaEspera(), 0.25, 'la espera más próxima');
  // En t=0.25 solo despierta B; A sigue esperando.
  f.creados.get('B').guion.push([{ type: 'done' }]);
  const t2 = a.ceder({ t: 0.25 }); await f.soltar(); const r2 = await t2;
  igual(f.creados.get('A').recibidos.length, 1, 'A no despierta antes de tiempo');
  igual(f.creados.get('B').recibidos.at(-1), { type: 'despierta', id: 1, snap: { t: 0.25 } }, 'B despierta con la instantánea');
  igual([r2.ordenes, a.estado('B'), a.algunoCorre()], [[], 'fin', false], 'B termina');
  a.detener();
  ok(f.creados.get('A').terminado && f.creados.get('B').terminado, 'detener termina los Workers');
}
// Error de programa y MAX_ORDENES.
{
  const f = falsos();
  const a = crearAnfitrion({ reglas: reglasWar, crearTrabajador: f.crear, maxOrdenes: 3 });
  await a.cargar('A', 'x');
  f.creados.get('A').guion.push([cmd('regularShoot', 1), cmd('regularShoot', 2), cmd('regularShoot', 3), cmd('regularShoot', 4), cmd('regularShoot', 5)]);
  const t = a.ceder({ t: 1 }); await f.soltar(); const r = await t;
  igual(r.error, { unidad: 'A', mensaje: 'El programa de A dio 3 órdenes y lecturas sin esperar. ¿Falta await esperar(...) dentro del bucle?', linea: 1 }, 'MAX_ORDENES');
  igual(r.ordenes.length, 4, 'la orden que supera el límite llega, las posteriores no (como el juego)');
  igual(r.ordenes[0].paso, 20, 'paso de la orden según t');
}
{
  const f = falsos();
  const a = crearAnfitrion({ reglas: reglasWar, crearTrabajador: f.crear });
  await a.cargar('A', 'x');
  f.creados.get('A').guion.push([{ type: 'error', mensaje: 'Malo.', linea: 7 }]);
  const t = a.ceder({ t: 0 }); await f.soltar(); const r = await t;
  igual(r.error, { unidad: 'A', mensaje: 'Malo.', linea: 7 }, 'error del Worker');
  igual(a.estado('A'), 'error', 'estado de error');
}
// Imitación sin pantalla (entregar síncrono): un programa que no cede se corta sin colgar.
{
  const a = crearAnfitrion({ reglas: reglasWar, crearTrabajador: () => ({ postMessage() {}, terminate() {}, entregar: () => false }) });
  await a.cargar('A', 'x');
  const r = await a.ceder({ t: 0 });
  igual([r.error.unidad, r.error.motivo], ['A', 'sin-cesion'], 'sin-cesion');
}
let rechazo = null;
try { crearAnfitrion({ reglas: { id: 'desconocido' }, crearTrabajador: () => null }); } catch (e) { rechazo = e.message; }
ok(/solo War, Factory y Campaign/.test(rechazo), 'rechaza un reglamento desconocido');

// Factory: el reglamento contesta con su instantánea, sin despertar esperas por tiempo.
const encargo = (id = 1, linea = 2) => ({ type: 'encargo', id, linea, texto: 'entregar("FUN")', verbo: 'entregar', args: ['FUN'] });
{
  const f = falsos(), a = crearAnfitrion({ reglas: { id: 'factory' }, crearTrabajador: f.crear });
  await a.cargar('R1', 'x'); await a.cargar('otra', 'x');
  f.creados.get('R1').guion.push([encargo()]);
  f.creados.get('otra').guion.push([{ type: 'espera', id: 4, s: 1 }]);
  const t = a.ceder({ t: 0 }); await f.soltar(); const r = await t;
  igual(r.ordenes, [{ paso: 0, origen: 'programa', unidad: 'R1', verbo: 'entregar', args: ['FUN'] }], 'encargo por órdenes');
  igual([a.estado('R1'), a.algunoCorre()], ['encargo', false], 'el encargo cede el turno');
  const snap = { t: 2, factory: { observado: 7 } };
  f.creados.get('R1').guion.push([{ type: 'done' }]);
  const respuesta = a.responder([{ unidad: 'R1', resultado: 'manos_vacias', instantanea: snap }]);
  await f.soltar();
  igual((await respuesta).ordenes, [{ paso: 40, origen: 'sistema', unidad: 'R1', verbo: 'programa-acabado', args: [] }], 'done es orden del sistema');
  igual(f.creados.get('R1').recibidos.at(-1), { type: 'despierta', id: 1, resultado: 'manos_vacias', snap }, 'respuesta con la foto recibida');
  igual(f.creados.get('otra').recibidos.length, 1, 'responder no despierta esperas vencidas');
  igual(a.registro().eventos, [{ t: 2, linea: 2, orden: 'entregar("FUN")', resultado: 'manos_vacias' }], 'registro del resultado');
  await a.responder([{ unidad: 'R1', resultado: 'ok', instantanea: snap }]);
  igual(a.registro().resultados, { manos_vacias: 1 }, 'ignora respuestas sin encargo');
  const copia = a.registro(); copia.eventos.length = 0; copia.resultados.manos_vacias = 99;
  igual(a.registro().resultados.manos_vacias, 1, 'registro independiente');
  igual(a.registro().eventos.length, 1, 'eventos independientes');
  a.detener();
}
for (const tipo of ['encargo', 'sensor', 'consola']) {
  const f = falsos(), a = crearAnfitrion({ reglas: { id: 'factory' }, crearTrabajador: f.crear, maxOrdenes: 1 });
  await a.cargar('R1', 'x');
  const mensajes = tipo === 'encargo' ? [encargo(), encargo(2, 9)] : tipo === 'sensor'
    ? Array.from({ length: 501 }, () => ({ type: 'lecturaFactory', linea: 5, texto: 'cuantos()', valor: 3 }))
    : [1, 2].map(() => ({ type: 'consola', linea: 5, nivel: 'log', texto: 'hola' }));
  f.creados.get('R1').guion.push(mensajes);
  const t = a.ceder({ t: 0 }); await f.soltar(); const r = await t;
  igual(r.error.linea, tipo === 'encargo' ? 2 : 5, `${tipo}: línea del diagnóstico`);
  // Como el ciclo (alMensaje): el encargo sin await y el sensor 501 fallan sin registrarse; la consola que
  // pasa del límite se registra y después falla.
  igual(r.avisos.length, tipo === 'sensor' ? 500 : tipo === 'consola' ? 2 : 1, `${tipo}: avisos entregados`);
  if (tipo === 'encargo') {
    igual(r.ordenes.length, 1, 'el segundo encargo no da orden');
    ok(r.error.mensaje.startsWith('Falta await en la línea 2:'), 'diagnóstico del encargo anterior');
  } else if (tipo === 'sensor') igual(a.registro().verbos.cuantos, 500, 'el sensor erróneo no se registra');
  else igual(a.registro().consolas.log, 2, 'la consola que pasa del límite se registra, como en el ciclo');
  a.detener();
}
{
  const f = falsos(), a = crearAnfitrion({ reglas: { id: 'factory' }, crearTrabajador: f.crear });
  await a.cargar('R1', 'x'); f.creados.get('R1').guion.push([encargo(), { type: 'done' }]);
  const t = a.ceder({ t: 0 }); await f.soltar(); await t;
  igual(a.estado('R1'), 'encargo', 'done no cancela el encargo');
  a.detener([{ unidad: 'R1', resultado: 'ok', instantanea: { t: 1 } }]);
  igual(a.registro().resultados, { ok: 1 }, 'el resultado terminal se registra al cerrar');
  igual([a.estado('R1'), f.creados.get('R1').terminado], ['fin', true], 'termina sin ejecutar continuaciones');
}

// Campaign: correlación por emisor, modos antes de consola y varias esperas/encargos.
{
  const f = falsos(), a = crearAnfitrion({ reglas: { id: 'campaign' }, crearTrabajador: f.crear });
  await a.cargar('CTL-01', 'x');
  const w = f.creados.get('CTL-01');
  w.guion.push([{ type: 'modo', unidad: 'PRS-01', verbo: 'start', args: [], linea: 1, texto: 'start()' },
    { type: 'consola', nivel: 'log', texto: 'hola', linea: 2 },
    { ...encargo(), unidad: 'BOT-01', verbo: 'deliver' },
    { ...encargo(2, 3), unidad: 'BOT-02', verbo: 'deliver' },
    { type: 'espera', id: 3, s: 1 }, { type: 'espera', id: 4, s: 2 }]);
  const t = a.ceder({ t: 0 }); await f.soltar(); const r = await t;
  igual(r.ordenes.map(o => [o.unidad, o.ref]),
    [['PRS-01', 'CTL-01#modo:1'], ['BOT-01', 'CTL-01#1'], ['BOT-02', 'CTL-01#2']], 'ref identifica al emisor y no al robot');
  igual([r.avisos[0].unidad, r.avisos.at(-1).unidad], ['CTL-01', 'CTL-01'], 'los avisos señalan el programa para marcar su línea, las órdenes señalan el destino');
  igual(a.proximaEspera(), 1, 'varias esperas por programa');
  await a.responder([{ unidad: 'PRS-01', ref: r.ordenes[0].ref, resultado: 'apagada', modo: true }]);
  igual(a.registro().eventos.map(e => [e.que, e.resultado, e.clase]),
    [['start()', 'apagada', 'warn'], ['console.log', 'hola', 'sensor']], 'modo conserva su posición antes de la consola');
  await a.responder([{ unidad: 'BOT-01', resultado: 'ok', instantanea: { t: 0 } }]);
  igual(a.registro().eventos.length, 2, 'ignora respuestas sin ref');
  w.guion.push([{ type: 'cede' }]);
  const t2 = a.responder([{ unidad: 'BOT-02', ref: 'CTL-01#2', resultado: 'ok', instantanea: { t: 0.5 } }]);
  await f.soltar(); await t2;
  igual([a.estado('CTL-01'), a.registro().eventos.at(-1).maquina], ['espera', 'BOT-02'], 'cede conserva pendientes y registra el robot');
  w.guion.push([{ type: 'cede' }]);
  const t3 = a.ceder({ t: 1 }); await f.soltar(); await t3;
  igual(w.recibidos.at(-1).id, 3, 'despierta la primera espera');
  igual(a.proximaEspera(), 2, 'conserva la segunda espera');
  w.guion.push([{ type: 'done' }]);
  const t4 = a.ceder({ t: 2 }); await f.soltar(); await t4;
  const enviados = w.recibidos.length;
  a.detener([{ unidad: 'BOT-01', ref: 'CTL-01#1', resultado: 'ok', instantanea: { t: 3 } }]);
  igual([a.estado('CTL-01'), w.recibidos.length], ['fin', enviados], 'done registra el encargo tardío sin despertar');
  igual(a.registro().uso['CTL-01'], { start: 1, deliver: 2, wait: 2 }, 'uso por programa y función');
}
{
  const f = falsos(), a = crearAnfitrion({ reglas: { id: 'campaign' }, crearTrabajador: f.crear, maxOrdenes: 1 });
  await a.cargar('A', 'x');
  f.creados.get('A').guion.push([1, 2].map(() => ({ type: 'consola', nivel: 'log', texto: 'hola', linea: 5 })));
  const t = a.ceder({ t: 0 }); await f.soltar(); const r = await t;
  igual(a.registro().consolas.log, 2, 'Campaign registra la consola que supera el límite');
  ok(r.error.mensaje.includes('await wait(...)'), 'Campaign conserva el diagnóstico');
  a.detener();
}

// War: formatos del juego, contadores por programa y sensores de la instantánea.
{
  const f = falsos(), a = crearAnfitrion({ reglas: reglasWar, crearTrabajador: f.crear });
  await a.cargar('A', 'x'); await a.cargar('B', 'x', { lenguaje: 'python' });
  f.creados.get('A').guion.push([
    { type: 'lee', linea: 1, maquina: 'A', fn: 'autoTarget', que: 'autoTarget()', valor: { x: 1.234, y: -2.345, id: 'D1' } },
    { type: 'lee', linea: 2, maquina: 'VIB-01', fn: 'detect', que: 'VIB_01.detect()', valor: null },
    { type: 'lee', linea: 3, maquina: 'VIB-01', fn: 'detect', que: 'VIB_01.detect()', valor: 7 },
    { ...cmd('regularShoot', 1.236), res: 'sin_objetivo' },
    { type: 'cmd', verbo: 'stopFire', res: 'ok' },
    { type: 'consola', nivel: 'info', texto: 'hola' },
    { type: 'espera', s: 1, id: 1 },
  ]);
  f.creados.get('B').guion.push([...['log', 'info', 'warn', 'error'].map(nivel => ({ type: 'consola', nivel, texto: nivel })), { type: 'done' }]);
  const t = a.ceder({ t: 0.125, vib: { 'VIB-01': {}, 'VIB-02': {} } }); await f.soltar(); await t;
  const r = a.registro();
  igual(r.eventos.slice(0, 3).map(e => [e.resultado, e.clase]),
    [['{x: 1.23, y: -2.35, z: 0, id: "D1"}', 'sensor'], ['null', 'sensor'], ['7', 'sensor']], 'fmtValor exacto');
  igual(r.eventos.slice(3, 6).map(e => [e.que, e.resultado, e.clase, e.linea]),
    [['regularShoot({x: 1.24, y: 1, z: 0})', 'sin_objetivo', 'warn', 1], ['stopFire()', 'ok', 'ok', ''],
      ['console.info', 'hola', 'sensor', '']], 'órdenes y consola JS');
  igual(r.eventos.slice(6).map(e => [e.que, e.clase]),
    [['print', 'sensor'], ['info', 'sensor'], ['warn', 'warn'], ['error', 'bad']], 'consola Python');
  ok(r.eventos.every(e => e.t === 0.13), 'tiempo redondeado como el juego');
  igual(r.uso, { A: { autoTarget: 1, detect: 2, regularShoot: 1, stopFire: 1, esperar: 1 } }, 'uso por programa');
  igual(r.lecturas, { 'VIB-01': 2, 'VIB-02': 0 }, 'solo cuentan lecturas de sensores, incluidos los no usados');
  igual(r.consolas, { log: 1, info: 2, warn: 1, error: 1 }, 'consolas de ambos lenguajes');
  igual(a.registro({ desde: 3 }), { ...r, eventos: r.eventos.slice(3) }, 'registro incremental con todos los contadores');
  igual(a.registro({ desde: r.eventos.length }).eventos, [], 'cursor al final');
  const copia = a.registro({ desde: 3 }); copia.eventos[0].que = 'otro'; copia.uso.A.detect = 99; copia.lecturas['VIB-01'] = 99;
  igual(a.registro(), r, 'el registro incremental es una copia profunda');
  a.detener();
}

// Registro incremental también en Factory y Campaign, con contadores acumulados.
for (const id of ['factory', 'campaign']) {
  const f = falsos(), a = crearAnfitrion({ reglas: { id }, crearTrabajador: f.crear });
  await a.cargar('A', 'x');
  f.creados.get('A').guion.push(['log', 'warn'].map(nivel => ({ type: 'consola', nivel, texto: nivel } )).concat({ type: 'done' }));
  const t = a.ceder({ t: 0 }); await f.soltar(); await t;
  const r = a.registro(), copia = a.registro({ desde: 1 });
  igual(copia, { ...r, eventos: r.eventos.slice(1) }, `${id}: cursor y contadores`);
  copia.eventos[0].resultado = 'otro'; copia.consolas.warn = 99;
  igual(a.registro(), r, `${id}: copia incremental independiente`);
  a.detener();
}

// Vigía: usa el reloj inyectado, incluye el umbral y despierta al turno pendiente.
{
  const f = falsos(), a = crearAnfitrion({ reglas: reglasWar, crearTrabajador: f.crear, ahora: () => 100 });
  await a.cargar('A', 'x'); await a.cargar('B', 'x');
  const texto = id => `vigía de ${id}`;
  igual(a.vigilar(999, 50, texto), null, 'un programa nuevo no corre');
  const t = a.ceder({ t: 0 });
  igual(a.vigilar(149, 50, texto), null, 'antes del umbral');
  igual(a.vigilar(150, 50, texto), 'A', 'falla al llegar al umbral');
  igual((await t).error, { unidad: 'A', mensaje: 'vigía de A', linea: null }, 'despierta el turno aunque B siga corriendo');
  igual(a.vigilar(200, 50, texto), null, 'no sustituye el primer error');
  a.detener();
}
{
  let reloj = 10;
  const f = falsos(), a = crearAnfitrion({ reglas: reglasWar, crearTrabajador: f.crear, ahora: () => reloj });
  await a.cargar('A', 'x'); f.creados.get('A').guion.push([{ type: 'espera', s: 0.5, id: 1 }]);
  const t = a.ceder({ t: 0 }); await f.soltar(); await t;
  reloj = 20000;
  igual(a.vigilar(reloj, 50, () => 'mal'), null, 'no vigila programas que esperan');
  const siguiente = a.ceder({ t: 0.5 });
  igual(a.vigilar(20049, 50, () => 'mal'), null, 'despertar reinicia desde con el reloj inyectado');
  igual(a.vigilar(20050, 50, () => 'mal'), 'A', 'vigila desde el último despertar');
  await siguiente; a.detener();
}
{
  const f = falsos(), a = crearAnfitrion({ reglas: reglasWar, crearTrabajador: f.crear });
  await a.cargar('A', 'x'); const t = a.ceder({ t: 0 });
  a.detener(); await t;
  igual(a.vigilar(99999, 1, () => 'mal'), null, 'cerrar libera un turno pendiente y desactiva el vigía');
}

console.log(`anfitrion: ${comprobaciones} comprobaciones`);
