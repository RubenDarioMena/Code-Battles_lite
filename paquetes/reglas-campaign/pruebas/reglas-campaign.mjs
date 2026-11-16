import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import reglamento, { nivel, serializar, restaurar } from '../index.js';
import * as C from '../index.js';
import { conectar } from '../mundo.js';
import { crearPartida, restaurar as repetir, crearRng, DT } from '../../nucleo/index.js';
import { esDatoPlano, validarInstantanea, validarSuceso } from '../../protocolo/index.js';

let comprobaciones = 0;
const igual = (a, b, msg) => { assert.deepEqual(a, b, msg); comprobaciones++; };
const comprobar = (v, msg) => { assert.ok(v, msg); comprobaciones++; };
const json = v => JSON.parse(JSON.stringify(v));
igual(typeof globalThis.window, 'undefined');
igual(reglamento.id, 'campaign');
igual(reglamento.version, 1);
igual('conectar' in C, false, 'los ganchos son internos');
igual(Object.keys(nivel), ['RETOS', 'NIVEL', 'MAPA']);
comprobar(esDatoPlano(reglamento.api));

// Cada función se evalúa por separado, sin imports, catálogos ni otra función.
const validar = vm.runInNewContext(`(${C.validar.toString()})`, Object.create(null));
const modo = vm.runInNewContext(`(${C.modoEnSnap.toString()})`, Object.create(null));
for (const hito of [0, 4, 5]) {
  const m = C.crear(nivel.NIVEL); m.hito = hito; C.indexar(m);
  const snap = C.instantaneaHistorica(m);
  for (const [propia, unidad, verbo, args] of [
    ['BOT-01', 'BOT-01', 'pickUp', ['SUP-1', 'steel']],
    ['BOT-01', 'BOT-01', 'pickUp', ['SUP-1', 'oro']],
    ['BOT-01', 'BOT-01', 'deliver', ['NO']], ['BOT-01', 'BOT-01', 'goTo', [42]],
    ['BOT-01', 'NO', 'start', []], ['BOT-01', 'BOT-01', 'start', []],
    ['BOT-01', 'PRS-01', 'start', []], ['CTL-01', 'PRS-01', 'start', []],
    ['ASM-01', 'ASM-01', 'setRecipe', ['motor']], ['ASM-01', 'ASM-01', 'setRecipe', ['oro']],
    ['PRS-01', 'PRS-01', 'light', ['green']], ['PRS-01', 'PRS-01', 'light', ['blue']],
    ['BOT-01', 'BAY-1', 'request', ['steel']], ['BOT-01', 'BAY-1', 'request', ['oro']],
    ['BOT-01', 'BOT-01', 'count', ['SUP-1', 'steel']],
    ['BOT-01', 'BOT-01', 'count', ['SUP-1']], ['BOT-01', 'BOT-01', 'count', [null, 'steel']],
  ]) igual(validar(json(snap), propia, unidad, verbo, args), C.validar(snap, propia, unidad, verbo, args));
  for (const [unidad, verbo, args] of [
    ['PRS-01', 'start', []], ['PRS-01', 'stop', []], ['PRS-01', 'light', ['red']],
    ['ASM-01', 'setRecipe', ['motor']], ['ASM-01', 'setRecipe', ['missile']],
    ['BAY-1', 'request', ['steel']],
  ]) {
    const a = json(snap), b = json(snap);
    igual(modo(a, unidad, verbo, args), C.modoEnSnap(b, unidad, verbo, args));
    igual(a, b, 'el modo aislado modifica la misma instantánea');
  }
}
for (const [state, recipe, verbo, args, fondos, cola, esperado] of [
  ['working', 'motor', 'setRecipe', ['missile'], 300, 0, 'ocupado'],
  ['changeover', 'motor', 'setRecipe', ['missile'], 300, 0, 'ocupado'],
  ['idle', 'motor', 'setRecipe', ['motor'], 300, 0, 'ok'],
  ['idle', 'motor', 'setRecipe', ['missile'], 300, 0, 'ok'],
  ['idle', 'motor', 'request', ['steel'], 0, 0, 'sin_fondos'],
  ['idle', 'motor', 'request', ['steel'], 300, 2, 'ocupado'],
]) {
  const a = C.instantaneaHistorica(C.crear(nivel.NIVEL));
  a.u['ASM-01'].state = state; a.u['ASM-01'].recipe = recipe;
  a.presupuesto = fondos; a.u['BAY-1'].pending = cola;
  const b = json(a), id = verbo === 'request' ? 'BAY-1' : 'ASM-01';
  igual(modo(a, id, verbo, args), esperado);
  igual(C.modoEnSnap(b, id, verbo, args), esperado);
  igual(a, b);
}

const nueva = () => crearPartida({ reglas: reglamento, escenario: { reto: nivel.NIVEL }, semilla: 7 });
function ordenar(p, unidad, verbo, args, paso = p.pasoActual) {
  p.ordenar({ paso, origen: 'programa', unidad, verbo, args });
}
function verificar(p) {
  const snap = p.instantanea();
  igual(validarInstantanea(snap), []);
  igual(json(snap), snap);
  for (const s of p.sucesos()) igual(validarSuceso(s), []);
  return snap;
}
const a = nueva();
ordenar(a, 'FRK-01', 'pickUp', ['BAY-1']);
ordenar(a, 'FRK-01', 'deliver', ['SUP-1'], 100);
for (let i = 0; i < 20; i++) a.paso();
comprobar(a.mundo.porId['FRK-01'].tarea, 'guardado del núcleo durante un encargo');
const b = repetir(json(a.serializar()), reglamento);
for (let i = 0; i < 250; i++) {
  igual(verificar(a), verificar(b), 'repetición exacta, incluso al cruzar H0');
  a.paso(); b.paso();
}
igual(a.mundo.hito, 1);
igual(a.sucesos(), b.sucesos());
igual(serializar(a.mundo), serializar(b.mundo));
for (const tipo of ['encargo-terminado', 'recogida', 'entrega', 'hito'])
  comprobar(a.sucesos().some(s => s.tipo === tipo), `hay ${tipo}`);

// Contrato histórico de checkpoints: sin sucesos, sin nuevas claves y sin tareas.
const campos = ['version', 'nivel', 'rev', 't', 'hito', 'completado', 'hitosT', 'presupuesto',
  'gastado', 'ingresado', 'unidades', 'tarimas', 'sigTarima', 'sigMisil', 'tSuministro', 'producidos', 'pedidos'];
const cp = serializar(a.mundo);
igual(Object.keys(cp), campos);
igual(serializar(restaurar(json(cp))), cp, 'guardar → cargar → guardar');
igual(restaurar(cp).activo, false);
const parcial = nueva(); ordenar(parcial, 'FRK-01', 'pickUp', ['BAY-1']); parcial.paso();
const cpParcial = serializar(parcial.mundo);
igual(cpParcial.unidades.find(u => u.id === 'FRK-01').tarea, null);
comprobar(parcial.mundo.porId['FRK-01'].tarea, 'serializar no cancela el mundo original');
igual(restaurar(cpParcial).porId['FRK-01'].tarea, null);
for (const cambio of [{ version: -1 }, { nivel: 'otro' }, { rev: -1 }, { unidades: null }])
  igual(serializar(restaurar({ ...cp, ...cambio })), serializar(C.crear(nivel.NIVEL)));
const rng = crearRng(7), control = crearRng(7);
const continuada = reglamento.crearMundo({ reto: nivel.NIVEL, guardado: cp }, rng);
igual(serializar(continuada), cp); igual(rng(), control());
const snap = reglamento.instantanea(continuada); snap.campaign.coste.steel = 999;
igual(C.COSTE.steel, 40, 'instantánea independiente de catálogos');

// Producción, transportador, suministro, pedidos y salva en una instalación preparada.
function preparar() {
  const m = C.crear(nivel.NIVEL); m.hito = 5; C.indexar(m); m.activo = true;
  m.banda.marcha = true;
  m.porId['PRS-01'].entrada.steel = 2;
  m.porId['ASM-01'].salida.push('missile');
  m.banda.piezas.push({ pieza: 'missile', s: m.banda.largo });
  m.porId['SUP-2'].tarima = m.bahia.tarima;
  m.tarimaPorId[m.bahia.tarima].en = 'SUP-2'; m.bahia.tarima = null;
  m.bahia.pedidos.push({ pieza: 'polymer', n: 12, pide: 0, llega: 0 });
  m.arsenal.porBanda = 11;
  m.torretas[0].misiles = 1;
  return m;
}
const conRegistro = preparar(), sinRegistro = { ...preparar() }, llamadas = [[], []];
const sims = [conRegistro, sinRegistro].map((m, i) => conectar(m, {
  registrar: (...args) => llamadas[i].push(['registrar', ...args]),
  terminarOrden: (...args) => llamadas[i].push(['encargo', ...args]),
  hito: (...args) => llamadas[i].push(['hito', ...args]),
  entrega: (bahia, p) => llamadas[i].push(['entrega', bahia.id, json(p)]),
  salva: s => llamadas[i].push(['salva', json(s)]),
}));
for (let paso = 0; paso < 300; paso++) {
  for (const s of sims) s.paso(DT);
  igual(json(conRegistro), json(sinRegistro), 'anotar no altera estado ni guardados');
}
igual(llamadas[0], llamadas[1], 'mismos hooks en el mismo orden');
for (const tipo of ['produccion', 'misil-banda', 'misil-arsenal', 'entrega-pedido', 'hito', 'suministro', 'disparo', 'explosion'])
  comprobar(conRegistro.sucesos.desde(0).some(s => s.tipo === tipo), `hay ${tipo}`);
for (const s of conRegistro.sucesos.desde(0)) igual(validarSuceso(s), []);
comprobar(conRegistro.completado);
igual(conRegistro.fin, null, 'el mundo continuo no se detiene al completar');
comprobar(conectar(conRegistro).quieto());
comprobar(!Object.keys(conRegistro).includes('sucesos'));
igual(Object.keys(serializar(conRegistro)), campos);
igual(reglamento.evaluar(conRegistro), { fin: 'victoria', hito: 5, completado: true });

const html = readFileSync(new URL('../../../Prototypes/Rocket Launcher/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"/g)].map(m => m[1]);
const puente = scripts.indexOf('js/compat-paquetes.js'); comprobar(puente >= 0);
// js/runtime.js ya no existe: el puente construye el Worker con paquetes/anfitrion (fase 2).
comprobar(!scripts.includes('js/runtime.js'));
// Las vistas y el relieve pasaron a vista-2d/vista-3d (fase 2): los carga el puente.
for (const nombre of ['campaign-plano', 'campaign-terreno', 'campaign-3d']) comprobar(!scripts.includes(`js/${nombre}.js`));
for (const nombre of ['juego', 'campaign-ui'])
  comprobar(scripts.indexOf(`js/${nombre}.js`) > puente);
for (const nombre of ['campaign', 'campaign-nivel']) comprobar(!scripts.includes(`js/${nombre}.js`));
comprobar(/js\/compat-paquetes\.js\?v=\d+/.test(html));

// Escena (fase 2): lo que dibujan las vistas. Datos planos, mismos valores que el mundo e independiente de él.
{
  const ESCENARIO_ESCENA = { reto: nivel.NIVEL }, PASOS_ESCENA = 40;
  const CAMPOS_ESCENA = ['maquinas', 'robots', 'tarimas', 'misiles', 'explosiones', 'bahia', 'hito', 'activo'];
  const { esDatoPlano: plano } = await import('../../protocolo/index.js');
  const { crearPartida: crear } = await import('../../nucleo/index.js');
  const partidaEscena = crear({ reglas: reglamento, escenario: ESCENARIO_ESCENA, semilla: 7 });
  for (const o of [{ paso: 0, origen: 'jugador', unidad: 'FRK-01', verbo: 'pickUp', args: ['BAY-1'] }]) partidaEscena.ordenar(o);  // con un encargo en curso
  for (let i = 0; i < PASOS_ESCENA; i++) partidaEscena.paso();
  const m = partidaEscena.mundo, e = reglamento.escena(m);
  comprobar(plano(e), 'escena en datos planos');
  igual(e.t, m.t, 'escena: t');
  // Todo lo enumerable del mundo está en la escena con el mismo valor (la escena añade los getters).
  const contiene = (x, o, ruta) => {
    if (o === null || typeof o !== 'object') return igual(x, o, ruta);
    if (Array.isArray(o)) { igual(Array.isArray(x) && x.length, o.length, ruta); o.forEach((v, i) => contiene(x[i], v, `${ruta}[${i}]`)); return; }
    for (const k of Object.keys(o)) contiene(x[k], o[k], `${ruta}.${k}`);
  };
  for (const k of CAMPOS_ESCENA) contiene(e[k], JSON.parse(JSON.stringify(m[k])), `escena: ${k}`);
  for (const [id, x] of Object.entries(e.porId)) contiene(x, JSON.parse(JSON.stringify(m.porId[id])), `escena: porId ${id}`);
  // Las vistas leen también getters no enumerables (cx/cy del robot de Factory): deben estar en la escena.
  for (const [id, x] of Object.entries(m.porId)) for (const k of Object.getOwnPropertyNames(x))
    if (typeof x[k] !== 'function' && typeof x[k] !== 'object') igual(e.porId[id][k], x[k], `escena: ${id}.${k}`);
  const antes = JSON.stringify(reglamento.instantanea(m));
  for (const x of Object.values(e.porId)) { x.cx = -99; x.id = 'otro'; }
  igual(JSON.stringify(reglamento.instantanea(m)), antes, 'cambiar la escena no toca el mundo');
}

// Respuestas del adaptador público: foto al terminar, modos correlacionados y cierre por orden.
{
  const p = crearPartida({ reglas: reglamento, escenario: { reto: nivel.NIVEL }, semilla: 1 });
  const m = p.mundo, inicial = json({ activo: m.activo, eventos: m.eventos, uso: m.uso, consolas: m.consolas });
  const ordenar = (unidad, verbo, args, ref) => p.ordenar({ paso: p.pasoActual, origen: 'programa', unidad, verbo, args, ref });
  ordenar('FRK-01', 'deliver', ['SUP-1'], 'CTL-01#1');
  p.aplicarOrdenes();
  const [r] = reglamento.respuestas(m);
  igual([r.unidad, r.ref, r.resultado, r.instantanea.t], ['FRK-01', 'CTL-01#1', 'manos_vacias', 0]);
  igual(reglamento.respuestas(m), [], 'vacía la cola');
  ordenar('FRK-01', 'goTo', ['SUP-1'], 'CTL-01#2');
  p.aplicarOrdenes();
  igual(m.porId['FRK-01'].tarea.id, 'CTL-01#2');
  ordenar('FRK-01', 'light', ['red'], 'CTL-01#modo:1');
  p.aplicarOrdenes();
  igual(reglamento.respuestas(m), [{ unidad: 'FRK-01', ref: 'CTL-01#modo:1', resultado: 'ok', modo: true }]);
  p.ordenar({ paso: p.pasoActual, origen: 'sistema', unidad: 'campaign', verbo: 'fin-tramo', args: [] });
  p.aplicarOrdenes();
  igual(m.robots.every(r => r.tarea === null), true, 'fin-tramo cancela tareas');
  igual(m.estaciones.every(q => q.luz === null), true, 'fin-tramo suelta luces');
  igual(json({ activo: m.activo, eventos: m.eventos, uso: m.uso, consolas: m.consolas }), inicial, 'registro fuera del mundo');
  r.instantanea.t = 99;
  igual(m.t, 0, 'la respuesta es independiente del mundo');
}

console.log(`reglas-campaign: ${comprobaciones} comprobaciones`);
