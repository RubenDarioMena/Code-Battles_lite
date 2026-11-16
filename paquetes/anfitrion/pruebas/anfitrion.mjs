// Pruebas del anfitrión en Node: texto del Worker, ejecución en VM y despertar del lockstep.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fuenteTrabajador, algunoCorre, despertar, despertarCampaign } from '../index.js';

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

console.log(`anfitrion: ${comprobaciones} comprobaciones`);
