import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import reglamento, { legado, retos } from '../index.js';
import { crearPartida, restaurar, crearRng, DT } from '../../nucleo/index.js';
import { esDatoPlano, validarInstantanea, validarSuceso } from '../../protocolo/index.js';

let comprobaciones = 0;
const igual = (actual, esperado, mensaje) => { assert.deepEqual(actual, esperado, mensaje); comprobaciones++; };
const comprobar = (valor, mensaje) => { assert.ok(valor, mensaje); comprobaciones++; };
igual(typeof globalThis.window, 'undefined');
igual(reglamento.id, 'factory');
igual(reglamento.version, 1);
igual(Object.keys(legado), ['crear', 'conectar', 'validar', 'instantanea', 'MATERIALES']);
igual(Object.keys(retos), ['RETOS', 'propio', 'normalizar', 'generar']);
comprobar(esDatoPlano(reglamento.api));
igual(reglamento.api.materiales, legado.MATERIALES);
igual(retos.RETOS.length, 6);

// La función que runtime interpola debe ejecutarse sin catálogo, imports ni puente.
const validarAislado = vm.runInNewContext(`(${legado.validar.toString()})`, Object.create(null));
const lectura = legado.instantanea(legado.crear(retos.RETOS[0], 1));
for (const [verbo, args] of [
  ['recoger', ['ENT-1', 'cobre']], ['recoger', ['ENT-1', 'silicio']],
  ['recoger', ['ENT-1']], ['recoger', ['ENT-1', 'oro']],
  ['recoger', ['FUN', 'cobre']], ['recoger', ['NO', 'cobre']], ['recoger', [42]],
  ['entregar', ['FUN']], ['entregar', ['NO']], ['entregar', []],
  ['esperar', [1]], ['esperar', [0]], ['esperar', [61]], ['esperar', ['2']],
  ['cuantos', ['NO', 'cobre']], ['cuantos', ['ENT-1', 'oro']],
  ['cuantos', ['ENT-1']], ['cuantos', [null, 'cobre']],
]) igual(validarAislado(lectura, verbo, args), legado.validar(lectura, verbo, args), `validar aislado: ${verbo} ${args}`);
igual(validarAislado(lectura, 'recoger', ['ENT-1', 'cobre']), null);
comprobar(validarAislado(lectura, 'recoger', ['ENT-1', 'oro']).includes('No existe el material'));

const escenario = { reto: retos.RETOS[0], intento: 1 };
const nueva = () => crearPartida({ reglas: reglamento, escenario, semilla: 7 });
function verificar(partida) {
  const snap = partida.instantanea();
  igual(validarInstantanea(snap), []);
  igual(JSON.parse(JSON.stringify(snap)), snap, 'instantánea serializable');
  for (const suceso of partida.sucesos()) igual(validarSuceso(suceso), []);
  return snap;
}
function ordenar(partida, verbo, args, paso = partida.pasoActual) {
  partida.ordenar({ paso, origen: 'programa', unidad: 'R1', verbo, args });
}
function ejecutar() {
  const partida = nueva(), instantaneas = [];
  // Una recogida/entrega tarda 29 pasos desde estas posiciones; se deja margen.
  for (let viaje = 0; viaje < 3; viaje++) {
    ordenar(partida, 'recoger', ['ENT-1', 'cobre'], viaje * 80);
    ordenar(partida, 'entregar', ['FUN'], viaje * 80 + 40);
  }
  while (!partida.evaluar() && partida.pasoActual < 300) {
    partida.paso(); instantaneas.push(verificar(partida));
  }
  igual(partida.evaluar()?.fin, 'victoria');
  igual(partida.mundo.porId.FUN.recibido.cobre, 3);
  return { partida, instantaneas };
}
const primera = ejecutar(), segunda = ejecutar();
igual(primera.instantaneas, segunda.instantaneas, 'evolución determinista');
igual(primera.partida.sucesos(), segunda.partida.sucesos(), 'sucesos deterministas');
for (const tipo of ['recogida', 'entrega', 'produccion', 'orden-terminada', 'fin'])
  comprobar(primera.partida.sucesos().some(s => s.tipo === tipo), `hay ${tipo}`);

const datos = JSON.parse(JSON.stringify(primera.partida.serializar()));
const finalRestaurado = restaurar(datos, reglamento);
igual(verificar(finalRestaurado), verificar(primera.partida));
igual(finalRestaurado.evaluar(), primera.partida.evaluar());
igual(finalRestaurado.sucesos(), primera.partida.sucesos());
igual(finalRestaurado.serializar(), datos);

// Guardado durante un viaje con una entrega pendiente: rehace las clausuras.
const original = nueva();
ordenar(original, 'recoger', ['ENT-1', 'cobre']);
ordenar(original, 'entregar', ['FUN'], 40);
for (let paso = 0; paso < 10; paso++) original.paso();
comprobar(original.mundo.robot.tarea);
const recuperada = restaurar(JSON.parse(JSON.stringify(original.serializar())), reglamento);
for (let paso = 0; paso < 90; paso++) {
  igual(verificar(recuperada), verificar(original));
  original.paso(); recuperada.paso();
}
igual(recuperada.sucesos(), original.sucesos());

// Respuestas por mundo, en el instante exacto de terminar y fuera del registro de actividad.
{
  const p = nueva(), otra = nueva();
  ordenar(p, 'entregar', ['FUN']); p.aplicarOrdenes();
  igual(p.pasoActual, 0, 'rechazo inmediato sin paso');
  igual(reglamento.respuestas(otra.mundo), [], 'colas independientes');
  const [respuesta] = reglamento.respuestas(p.mundo);
  igual([respuesta.unidad, respuesta.resultado, respuesta.instantanea.t], ['R1', 'manos_vacias', 0]);
  igual(reglamento.respuestas(p.mundo), [], 'respuestas vacía la cola');
  ordenar(p, 'recoger', ['ENT-1', 'cobre']); p.aplicarOrdenes();
  for (let i = 0; i < 29; i++) p.paso();
  const [recogida] = reglamento.respuestas(p.mundo);
  igual(recogida.instantanea.factory.porId['ENT-1'].stock.cobre, 2, 'foto al terminar');
  p.mundo.porId['ENT-1'].stock.cobre = 0;
  igual(recogida.instantanea.factory.porId['ENT-1'].stock.cobre, 2, 'foto independiente');
  igual([p.mundo.eventos, p.mundo.verbos, p.mundo.resultados], [[], {}, {}], 'las reglas no escriben actividad');
  p.ordenar({ paso: p.pasoActual, origen: 'sistema', unidad: 'R1', verbo: 'programa-acabado', args: [] });
  p.aplicarOrdenes();
  igual([p.pasoActual, p.evaluar()?.motivo], [29, 'incompleto'], 'done evalúa sin avanzar');
  const satisfecha = reglamento.crearMundo({ reto: { ...retos.RETOS[0], metas: [] } }, () => 0);
  igual(satisfecha.final?.fin, 'victoria', 'evalúa al crear');
}

// Una instantánea del reglamento no presta las existencias mutables del mundo.
const copia = original.instantanea();
copia.factory.porId['ENT-1'].stock.cobre = 99;
igual(original.mundo.porId['ENT-1'].stock.cobre, 2);
const rng = crearRng(7), control = crearRng(7);
for (let intento = 1; intento <= 10; intento++) {
  const m = reglamento.crearMundo({ reto: retos.RETOS[4], intento }, rng);
  igual(m.stockOculto, retos.RETOS[4].stockPorIntento[(intento - 1) % 5]);
}
igual(rng(), control(), 'el intento no consume RNG');
igual(reglamento.crearMundo({ reto: retos.RETOS[4] }, rng).stockOculto, 7);

const agotada = crearPartida({ reglas: reglamento,
  escenario: { reto: { ...retos.RETOS[0], tiempoMax: .1 } }, semilla: 7 });
for (let paso = 0; paso < 4; paso++) agotada.paso();
igual(agotada.evaluar()?.motivo, 'tiempo');
igual(agotada.mundo.activo, false);
verificar(agotada);

// Anotar sucesos no cambia estado enumerable, resultados ni orden de los hooks.
const conRegistro = legado.crear(retos.RETOS[0], 1);
const sinRegistro = { ...legado.crear(retos.RETOS[0], 1) };
const llamadas = [[], []];
const conexiones = [conRegistro, sinRegistro].map((mundo, indice) => legado.conectar(mundo, {
  terminarOrden: r => llamadas[indice].push(['orden', r]),
  terminar: (...args) => llamadas[indice].push(['fin', ...args]),
  programaAcabado: () => false, llamadaPendiente: () => false,
}));
for (const [verbo, args] of [['recoger', ['ENT-1', 'cobre']], ['entregar', ['FUN']]]) {
  for (const c of conexiones) c.iniciarOrden(verbo, args);
  for (let paso = 0; paso < 40; paso++) {
    for (const c of conexiones) c.paso(DT);
    igual(JSON.parse(JSON.stringify(conRegistro)), JSON.parse(JSON.stringify(sinRegistro)));
  }
}
igual(llamadas[0], llamadas[1]);
comprobar(!Object.keys(conRegistro).includes('sucesos'));

// Integración estática del arranque; el navegador real lo ejecuta el revisor.
const html = readFileSync(new URL('../../../Prototypes/Rocket Launcher/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"/g)].map(m => m[1]);
const puente = scripts.indexOf('js/compat-paquetes.js');
comprobar(puente >= 0);
// js/runtime.js ya no existe: el puente construye el Worker con paquetes/anfitrion (fase 2).
for (const lector of ['juego']) comprobar(scripts.indexOf(`js/${lector}.js`) > puente);
comprobar(!scripts.includes('js/runtime.js'));
for (const retirado of ['factory', 'factory-retos']) comprobar(!scripts.includes(`js/${retirado}.js`));
comprobar(/js\/compat-paquetes\.js\?v=\d+/.test(html));

// Escena (fase 2): lo que dibujan las vistas. Datos planos, mismos valores que el mundo e independiente de él.
{
  const ESCENARIO_ESCENA = { reto: retos.RETOS[0], intento: 1 }, PASOS_ESCENA = 40;
  const CAMPOS_ESCENA = ['entidades', 'robot', 'revelado'];
  const { esDatoPlano: plano } = await import('../../protocolo/index.js');
  const { crearPartida: crear } = await import('../../nucleo/index.js');
  const partidaEscena = crear({ reglas: reglamento, escenario: ESCENARIO_ESCENA, semilla: 7 });
  for (const o of [{ paso: 0, origen: 'jugador', unidad: 'R1', verbo: 'recoger', args: ['ENT-1', 'cobre'] }]) partidaEscena.ordenar(o);  // con un encargo en curso
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

console.log(`reglas-factory: ${comprobaciones} comprobaciones`);
