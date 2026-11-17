import { createRequire } from 'node:module';
import { Entorno, Salto } from './entorno.mjs';
import { expresiones } from './expresiones.mjs';
import { sentencias } from './sentencias.mjs';
import { crearPromesa } from './promesa.mjs';
import { mathDeterminista, PresupuestoAgotado } from '../canal.mjs';
const acorn = createRequire(import.meta.url)('../../../shared/vendor/acorn-8.11.3.js');
const cache = new Map();
function analizar(fuente) {
  if (!cache.has(fuente)) cache.set(fuente, acorn.parse(fuente, { ecmaVersion: 2022, locations: true }));
  return cache.get(fuente);
}
export class Evaluador {
  constructor({ presupuesto = 600000, depurar = false } = {}) {
    this.presupuesto = presupuesto; this.depurar = depurar;
    this.cola = []; this.pausas = []; this.cuenta = 0; this.linea = null;
    this.Promise = crearPromesa(this.cola);
    this.global = Object.create(null);
    const g = this.global;
    Object.assign(g, { Object, Array, String, Number, Boolean, Map, Set, WeakMap, WeakSet, Proxy, Reflect,
      JSON, Math: mathDeterminista(), RegExp, Error, TypeError, RangeError, ReferenceError, SyntaxError,
      Symbol, Infinity, NaN, undefined, isNaN, isFinite, parseInt, parseFloat, Promise: this.Promise,
      Date: undefined, eval: undefined });
    const motor = this;
    this.Function = function (...args) { return motor.compilar(args, false); };
    this.AF = function (...args) { return motor.compilar(args, true); };
    this.asyncProto = Object.create(Function.prototype, { constructor: { value: this.AF } });
    g.Function = this.Function; g.self = g.globalThis = g;
    this.entorno = new Entorno(null, g);
  }
  seguro(v) { return v === Function ? this.Function : v; }
  reiniciar() { this.cuenta = 0; this.linea = null; }
  *evaluar(n, e, ctx) {
    if (!n) return undefined;
    if (ctx.usuario) this.linea = n.loc.start.line;
    if (++this.cuenta > this.presupuesto) throw new PresupuestoAgotado('P', this.cuenta, this.linea);
    try { return yield* this.sentencia(n, e, ctx); }
    catch (x) {
      if (ctx.usuario && x instanceof Error && x.__linea == null) x.__linea = n.loc.start.line;
      throw x;
    }
  }
  sincronico(gen) {
    const r = gen.next();
    if (!r.done) throw new Error('Suspensión en una función síncrona (prototipo P)');
    return r.value;
  }
  asincronico(gen) {
    return new this.Promise((resolve, reject) => {
      const continuar = (valor, lanzar = false) => {
        try {
          const r = lanzar ? gen.throw(valor) : gen.next(valor);
          if (r.done) { resolve(r.value); return; }
          if (r.value.tipo === 'linea') {
            this.pausas.push({ ...r.value, reanudar: () => continuar() }); return;
          }
          this.Promise.resolve(r.value.valor).then(v => continuar(v), e => continuar(e, true));
        } catch (e) { if (e?.code === 'CBL_PRESUPUESTO') throw e; reject(e); }
      };
      continuar();
    });
  }
  funcion(n, cierre, contexto) {
    const motor = this;
    const fn = function (...args) {
      const local = new Entorno(cierre);
      const ctx = { ...contexto, this: n.type === 'ArrowFunctionExpression' ? contexto.this : this,
        debug: n.async && contexto.usuario && contexto.depurable !== false && motor.depurar };
      if (n.type !== 'ArrowFunctionExpression') local.declarar('arguments', args);
      if (n.id) local.declarar(n.id.name, fn);
      function* cuerpo() {
        try {
          for (let i = 0; i < n.params.length; i++) yield* motor.asignar(n.params[i],
            n.params[i].type === 'RestElement' ? args.slice(i) : args[i], local, ctx, true);
          if (n.body.type !== 'BlockStatement') return yield* motor.evaluar(n.body, local, ctx);
          yield* motor.evaluar(n.body, local, ctx);
        } catch (s) { if (s instanceof Salto && s.tipo === 'return') return s.valor; throw s; }
      }
      if (n.generator) {
        const gen = cuerpo();
        return { next(v) { const r = gen.next(v); return { done: r.done, value: r.done ? r.value : r.value.valor }; },
          [Symbol.iterator]() { return this; } };
      }
      return n.async ? motor.asincronico(cuerpo()) : motor.sincronico(cuerpo());
    };
    if (n.async) Object.setPrototypeOf(fn, this.asyncProto);
    return fn;
  }
  *clase(n, e, ctx) {
    const padre = n.superClass ? yield* this.evaluar(n.superClass, e, ctx) : null;
    const scope = new Entorno(e), motor = this;
    let constructor;
    const Clase = function (...args) {
      if (constructor) return Reflect.apply(constructor, this, args);
      if (padre) return Reflect.construct(padre, args, new.target);
    };
    if (padre) { Object.setPrototypeOf(Clase.prototype, padre.prototype); Object.setPrototypeOf(Clase, padre); }
    if (n.id) scope.declarar(n.id.name, Clase);
    for (const m of n.body.body) {
      const key = m.computed ? yield* this.evaluar(m.key, e, ctx) : m.key.name;
      const fn = motor.funcion(m.value, scope, { ...ctx, super: padre });
      if (m.kind === 'constructor') constructor = fn;
      else Object.defineProperty(m.static ? Clase : Clase.prototype, key,
        m.kind === 'get' || m.kind === 'set' ? { [m.kind]: fn, configurable: true } : { value: fn, configurable: true, writable: true });
    }
    return Clase;
  }
  compilar(args, async) {
    const codigo = String(args.at(-1) ?? ''), params = args.slice(0, -1).map(String).join(',');
    // La envoltura ocupa la misma línea: loc del cuerpo conserva las líneas del jugador.
    const ast = analizar(`(${async ? 'async ' : ''}function(${params}){${codigo}\n})`);
    return this.funcion(ast.body[0].expression, this.entorno,
      { this: this.global, usuario: true, depurable: args.slice(0, -1).includes('__L') });
  }
  ejecutar(fuente) {
    return this.sincronico(this.evaluar(analizar(fuente), this.entorno, { this: this.global, usuario: false, debug: false }));
  }
  vaciar() { while (this.cola.length) this.cola.shift()(); }
}
Object.assign(Evaluador.prototype, expresiones, sentencias);
export function medirCache() { return { arboles: cache.size, bytesFuente: [...cache.keys()].reduce((n, s) => n + Buffer.byteLength(s), 0) }; }
