import afirmar from 'node:assert/strict';
import { runInNewContext as ejecutarEnOtroReino } from 'node:vm';
import {
  ORIGENES, esDatoPlano, validarOrden, validarSuceso, validarInstantanea,
} from '../index.js';

let comprobaciones = 0;
function comprobar(actual, esperado) {
  afirmar.deepEqual(actual, esperado);
  comprobaciones++;
}
function invalido(validar, valor, ruta) {
  const errores = validar(valor);
  afirmar.ok(errores.length > 0);
  afirmar.ok(errores.every(error => typeof error === 'string'));
  afirmar.ok(errores.some(error => error.startsWith(`${ruta}:`)), errores.join('\n'));
  comprobaciones++;
}

comprobar(ORIGENES, ['programa', 'jugador', 'sistema']);
comprobar(Object.isFrozen(ORIGENES), true);
class Ejemplo { constructor() { this.a = 1; } }
const ciclo = {};
ciclo.propia = ciclo;
const arregloCiclico = [];
arregloCiclico.push(arregloCiclico);
const compartido = { a: 1 };
const otroReino = ejecutarEnOtroReino('({a: [1, {b: null}]})');
for (const valor of [null, true, false, '', 'texto', 0, -3.5, [], {},
  [1, { b: null }], Object.create(null), otroReino, [compartido, compartido], { a: undefined }]) {
  comprobar(esDatoPlano(valor), true);
}
for (const valor of [undefined, () => {}, Symbol('dato'), 1n, NaN, Infinity,
  -Infinity, new Map(), new Date(), new Ejemplo(), ciclo, arregloCiclico,
  [undefined], new Array(1), { a: { b: NaN } },
  { [Symbol('clave')]: 1 }, { get a() { throw new Error('No debe ejecutarse'); } },
  Object.assign([], { extra: () => {} })]) {
  comprobar(esDatoPlano(valor), false);
}

const orden = { paso: 0, origen: 'programa', unidad: 'unidad-1', verbo: 'mover', args: [1, { x: 2 }, null] };
const suceso = { paso: 3, tipo: 'impacto', unidad: 'unidad-1', datos: { posicion: [1, 2], objetivo: null } };
const instantanea = { t: 0.5, maq: { lanzador: { modo: 'auto', objetivo: null } }, auto: {}, vib: {} };
for (const [validar, mensaje] of [[validarOrden, orden], [validarSuceso, suceso], [validarInstantanea, instantanea]]) {
  comprobar(validar(mensaje), []);
  const desdeJson = JSON.parse(JSON.stringify(mensaje));
  comprobar(desdeJson, mensaje);
  comprobar(validar(desdeJson), []);
  const clonado = structuredClone(mensaje);
  comprobar(clonado, mensaje);
  comprobar(validar(clonado), []);
  invalido(validar, null, validar === validarOrden ? 'orden' : validar === validarSuceso ? 'suceso' : 'instantanea');
  const campo = validar === validarInstantanea ? 't' : 'paso';
  const conAccesor = Object.defineProperty({ ...mensaje }, campo, {
    get() { throw new Error('No debe ejecutarse'); },
  });
  invalido(validar, conAccesor, `${validar === validarOrden ? 'orden' : validar === validarSuceso ? 'suceso' : 'instantanea'}.${campo}`);
}

for (const origen of ORIGENES) comprobar(validarOrden({ ...orden, origen }), []);
comprobar(validarOrden(ejecutarEnOtroReino(`(${JSON.stringify(orden)})`)), []);
comprobar(validarSuceso({ paso: 0, tipo: 'inicio' }), []);
comprobar(validarSuceso({ paso: 0, tipo: 'inicio', datos: Object.create(null) }), []);
comprobar(validarInstantanea({ t: 0, otroReino }), []);
comprobar(validarInstantanea(Object.assign(Object.create(null), { t: 0 })), []);

for (const paso of [-1, 0.5, NaN, Infinity, '1', undefined]) {
  invalido(validarOrden, { ...orden, paso }, 'orden.paso');
  invalido(validarSuceso, { ...suceso, paso }, 'suceso.paso');
}
for (const [campo, valor] of [['origen', 'otro'], ['unidad', ''], ['verbo', 2], ['args', {}], ['extra', 1]]) {
  invalido(validarOrden, { ...orden, [campo]: valor }, `orden.${campo}`);
}
for (const campo of Object.keys(orden)) {
  const incompleta = { ...orden };
  delete incompleta[campo];
  invalido(validarOrden, incompleta, `orden.${campo}`);
}
comprobar(validarOrden({ ...orden, args: [1, undefined] }), ['orden.args[1]: no es dato plano']);
invalido(validarOrden, { ...orden, args: [ciclo] }, 'orden.args[0].propia');
for (const [campo, valor] of [['tipo', ''], ['unidad', undefined], ['datos', []], ['extra', true]]) {
  invalido(validarSuceso, { ...suceso, [campo]: valor }, `suceso.${campo}`);
}
invalido(validarSuceso, { tipo: 'inicio' }, 'suceso.paso');
invalido(validarSuceso, { paso: 0 }, 'suceso.tipo');
comprobar(validarSuceso({ ...suceso, datos: { a: undefined } }), []);
for (const t of [-1, Infinity, NaN, '0', undefined]) {
  invalido(validarInstantanea, { t }, 'instantanea.t');
}
invalido(validarInstantanea, {}, 'instantanea.t');
invalido(validarInstantanea, { t: 0, posicion: { x: NaN } }, 'instantanea.posicion.x');
invalido(validarInstantanea, { t: 0, ciclo }, 'instantanea.ciclo.propia');
invalido(validarInstantanea, new Ejemplo(), 'instantanea');
invalido(validarOrden, [], 'orden');
invalido(validarSuceso, new Ejemplo(), 'suceso');

console.log(`protocolo: ${comprobaciones} comprobaciones`);
