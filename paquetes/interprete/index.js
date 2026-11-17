import { Entorno } from './entorno.js';
import { analizar, medirCache } from './analisis.js';
import { expresiones } from './expresiones.js';
import { sentencias } from './sentencias.js';
import { funciones } from './funciones.js';
import { clases } from './clases.js';
import { crearPromesa } from './promesa.js';
import { intrinsecos } from './intrinsecos.js';
import { rapidoexpresiones } from './expresiones-rapido.js';
import { rapidosentencias } from './sentencias-rapido.js';
import { rapidoclases } from './clases-rapido.js';
export class PresupuestoAgotado extends Error {
  constructor(cuenta, linea) {
    super(`Presupuesto P agotado (${cuenta}).`);
    this.name = 'PresupuestoAgotado'; this.code = 'CBL_PRESUPUESTO';
    this.cuenta = cuenta; this.linea = linea; this.__linea = linea;
  }
}
/** @param {import('./index.js').OpcionesInterprete} opciones */
export function crearInterprete(opciones) { return new Interprete(opciones); }
class Interprete {
  constructor({ acorn, presupuesto = 600000, globales = {}, depurar = false }) {
    if (!acorn?.parse) throw new TypeError('crearInterprete requiere acorn.parse');
    if (!Number.isSafeInteger(presupuesto) || presupuesto < 1) throw new RangeError('presupuesto debe ser un entero positivo');
    this.acorn = acorn; this.presupuesto = presupuesto; this.depurar = depurar;
    this.cola = []; this.pausas = []; this.cuenta = 0; this.linea = null; this.liberado = false;
    this.funciones = new WeakMap(); this.plantillas = new WeakMap();
    this.VACIO = Symbol('sin valor'); this.CORTO = Symbol('cadena opcional interrumpida');
    this.Promise = crearPromesa(this.cola);
    Object.freeze(this.Promise.prototype); Object.freeze(this.Promise);
    this.global = Object.create(null);
    const motor = this;
    this.Function = function (...args) { return motor.compilar(args, 'normal'); };
    this.AF = function (...args) { return motor.compilar(args, 'async'); };
    this.GF = function (...args) { return motor.compilar(args, 'generator'); };
    this.AGF = function () { throw new SyntaxError('Construcción no soportada: async generator'); };
    this.aislamiento = intrinsecos(this); this.seguro = this.aislamiento.seguro;
    this.asyncProto = this.AF.prototype;
    this.generatorProto = this.GF.prototype;
    Object.assign(this.global, this.aislamiento.globales, { Infinity, NaN, undefined, Promise: this.Promise,
      Function: this.Function, eval: undefined, Date: undefined,
      queueMicrotask: fn => { if (typeof fn !== 'function') throw new TypeError('callback is not a function'); this.cola.push(fn); } }, globales);
    this.global = this.aislamiento.globalSeguro(this.global);
    this.global.self = this.global.globalThis = this.global;
    this.entorno = new Entorno(null, this.global);
    this.baseGlobales = Object.getOwnPropertyDescriptors(this.global);
    delete this.baseGlobales.self; delete this.baseGlobales.globalThis;
    this.ambitos = new Set();
  }
  crearAmbito(globales = {}) {
    this.comprobarVivo();
    const global = this.aislamiento.globalSeguro(Object.defineProperties(Object.create(null), this.baseGlobales));
    Object.assign(global, globales); global.self = global.globalThis = global;
    const entorno = new Entorno(null, global), motor = this;
    let liberado = false;
    const ambito = {
      global,
      get liberado() { return liberado; },
      activar() {
        motor.comprobarVivo();
        if (liberado) throw new Error('Ámbito liberado');
        motor.global = global; motor.entorno = entorno; motor.ambitoActual = ambito;
      },
      liberar() {
        if (liberado) return;
        liberado = true;
        for (const k of Reflect.ownKeys(global)) if (Object.getOwnPropertyDescriptor(global, k).configurable) delete global[k];
        entorno.valores.clear(); motor.ambitos.delete(ambito);
        if (motor.global === global) { motor.global = Object.create(null); motor.entorno = new Entorno(null, motor.global); motor.ambitoActual = null; }
      },
    };
    this.ambitos.add(ambito); return ambito;
  }
  comprobarVivo() { if (this.liberado) throw new Error('Intérprete liberado'); }
  reiniciarPresupuesto() { this.comprobarVivo(); this.cuenta = 0; this.linea = null; }
  cobrar(n = null, ctx = null) {
    if (this.liberado) this.comprobarVivo();
    if (ctx?.usuario && n?.loc) this.linea = n.loc.start.line;
    if (++this.cuenta > this.presupuesto) throw new PresupuestoAgotado(this.cuenta, this.linea);
  }
  *evaluar(n, e, ctx) {
    if (!n) return this.VACIO;
    if (!n.suspende && !ctx.debug) return this.rapido(n, e, ctx);
    this.cobrar(n, ctx);
    try { return yield* this.sentencia(n, e, ctx); }
    catch (x) {
      if (ctx.usuario) this.anotarError(x, n);
      throw x;
    }
  }
  rapido(n, e, ctx) {
    if (!n) return this.VACIO;
    this.cobrar(n, ctx);
    try { return this.sentRapida(n, e, ctx); }
    catch (x) {
      if (ctx.usuario) this.anotarError(x, n);
      throw x;
    }
  }
  anotarError(error, n) {
    if (!(error instanceof Error) || Object.hasOwn(error, 'linea') || (Object.hasOwn(error, '__linea') && Reflect.get(error, '__linea') != null) || !Object.isExtensible(error)) return;
    Object.defineProperty(error, 'linea', { value: n.loc.start.line, configurable: true });
    // El Worker histórico reconoce <anonymous> y calibra el desplazamiento de AF.
    // __linea se reserva a errores de API: __py.mensaje lo usa para distinguirlos.
    const stack = Object.getOwnPropertyDescriptor(error, 'stack');
    if (stack?.writable || stack?.set)
      error.stack = `${error.name}: ${error.message}\n    at <anonymous>:${n.loc.start.line + 2}:${n.loc.start.column + 1}`;
  }
  noSuspender() { throw new SyntaxError('Suspensión en el recorrido síncrono'); }
  sincronico(gen) {
    const r = gen.next();
    if (!r.done) throw new SyntaxError('Suspensión no soportada en una llamada síncrona');
    return r.value;
  }
  compilar(args, modo) {
    this.comprobarVivo();
    const codigo = String(args.at(-1) ?? ''), params = args.slice(0, -1).map(String).join(',');
    const ast = analizar(this.acorn, `(${modo === 'async' ? 'async ' : ''}function${modo === 'generator' ? '*' : ''} anonymous(${params}){${codigo}\n})`);
    return this.funcion(ast.body[0].expression, this.entorno,
      { this: this.global, ambito: this.ambitoActual, usuario: true, estricto: false, plantillas: new WeakMap(), depurable: typeof this.depurar !== 'object' || args.slice(0, -1).includes(this.depurar.parametro) });
  }
  ejecutar(fuente, { usuario = true } = {}) {
    this.comprobarVivo();
    const ast = analizar(this.acorn, String(fuente));
    const ctx = { this: this.global, ambito: this.ambitoActual, usuario, plantillas: new WeakMap(), estricto: ast.body.some(s => s.directive === 'use strict'), debug: false };
    const v = this.sincronico(this.evaluar(ast, this.entorno, ctx));
    return v === this.VACIO ? undefined : v;
  }
  vaciarTrabajos() {
    this.comprobarVivo();
    while (this.cola.length) { this.cobrar(); this.cola.shift()(); }
  }
  pausasPendientes() { return this.pausas.map(({ linea, nodo }) => ({ linea, nodo })); }
  reanudar() {
    this.comprobarVivo();
    const p = this.pausas.shift(); if (!p) return null;
    p.reanudar(); return { linea: p.linea, nodo: p.nodo };
  }
  medir() { return { nodos: this.cuenta, linea: this.linea, trabajos: this.cola.length,
    pausas: this.pausas.length, cache: medirCache(this.acorn), liberado: this.liberado }; }
  liberar() {
    if (this.liberado) return;
    for (const ambito of this.ambitos) ambito.liberar();
    this.liberado = true; this.cola.length = this.pausas.length = 0;
    for (const k of Reflect.ownKeys(this.global)) if (Object.getOwnPropertyDescriptor(this.global, k).configurable) delete this.global[k];
    this.global = Object.create(null); this.entorno.global = this.global;
    this.entorno.valores.clear(); this.funciones = new WeakMap(); this.plantillas = new WeakMap();
    this.aislamiento.liberar();
    this.baseGlobales = null; this.aislamiento = null; this.seguro = null;
    this.asyncProto = this.generatorProto = null;
    this.Function = this.AF = this.GF = this.AGF = this.Promise = null;
  }
}
Object.assign(Interprete.prototype, expresiones, sentencias, funciones, clases, rapidoexpresiones, rapidosentencias, rapidoclases);
