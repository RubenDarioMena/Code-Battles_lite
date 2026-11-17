import { Entorno, Salto, nombres, SIN_INICIAR } from './entorno.js';
const directivaEstricta = n => n.body?.some(s => s.directive === 'use strict');
const constructores = new WeakMap();
export const funciones = {
  construible(fn) {
    if (constructores.has(fn)) return constructores.get(fn);
    let si = true;
    try { Reflect.construct(new Proxy(fn, { construct() { return {}; } }), []); } catch { si = false; }
    constructores.set(fn, si); return si;
  },
  leerThis(ctx) {
    if (ctx.receptor?.valor === SIN_INICIAR) throw new ReferenceError("Must call super constructor in derived class before accessing 'this' or returning from derived constructor");
    return ctx.receptor ? ctx.receptor.valor : ctx.this;
  },
  funcion(n, cierre, contexto) {
    const motor = this;
    const ejecutar = (receptor, args, nuevo) => {
      motor.comprobarVivo();
      return motor.invocar(n, cierre, contexto, receptor, args, nuevo);
    };
    let fn;
    if (n.type === 'ArrowFunctionExpression') fn = (...args) => ejecutar(undefined, args, undefined);
    else if (n.async || n.generator) fn = { fn(...args) { return ejecutar(this, args, undefined); } }.fn;
    else fn = function (...args) { return ejecutar(this, args, new.target); };
    Object.defineProperty(fn, 'name', { value: n.id?.name || '', configurable: true });
    const length = n.params.findIndex(p => ['AssignmentPattern', 'RestElement'].includes(p.type));
    Object.defineProperty(fn, 'length', { value: length < 0 ? n.params.length : length, configurable: true });
    if (n.async) Object.setPrototypeOf(fn, this.asyncProto);
    if (n.generator) Object.setPrototypeOf(fn, this.generatorProto);
    if (n.type === 'FunctionExpression' && n.id) {
      const nombre = new Entorno(cierre); nombre.declarar(n.id.name, fn, 'const'); cierre = nombre;
    }
    this.funciones.set(fn, { n, cierre, contexto });
    return fn;
  },
  invocar(n, cierre, contexto, receptor, args, nuevo, construccion = null) {
    const flecha = n.type === 'ArrowFunctionExpression', local = new Entorno(cierre, null, true);
    const estricto = contexto.estricto || directivaEstricta(n.body);
    const ctx = { ...contexto, estricto, etiquetas: [],
      receptor: flecha ? contexto.receptor : construccion?.receptor,
      this: flecha ? contexto.this : estricto ? receptor : receptor == null ? this.global : Object(receptor),
      nuevo: flecha ? contexto.nuevo : nuevo, construccion: flecha ? contexto.construccion : construccion,
      debug: Boolean(n.async && contexto.usuario && contexto.depurable !== false && this.depurar) };
    if (!flecha && n.usaArguments) {
      const argumentos = { length: args.length, [Symbol.iterator]: Array.prototype[Symbol.iterator] };
      for (let i = 0; i < args.length; i++) Object.defineProperty(argumentos, i, { value: args[i], writable: true, enumerable: true, configurable: true });
      if (!estricto && n.params.every(p => p.type === 'Identifier')) {
        n.params.forEach((p, i) => { if (i < args.length) Object.defineProperty(argumentos, i,
          { get: () => local.leer(p.name), set: v => local.escribir(p.name, v), enumerable: true, configurable: true }); });
      }
      local.declarar('arguments', argumentos);
    }
    for (const p of n.params) for (const k of nombres(p)) local.declarar(k);
    const motor = this;
    const parametros = () => {
      for (let i = 0; i < n.params.length; i++) motor.asigRapida(n.params[i],
        n.params[i].type === 'RestElement' ? args.slice(i) : args[i], local, ctx, 'let');
    };
    if (!n.async && !n.generator) {
      try {
        parametros();
        if (n.body.type !== 'BlockStatement') return motor.rapido(n.body, local, ctx);
        motor.preparar(n.body.body, local, ctx, true); motor.rapido(n.body, local, ctx); return undefined;
      } catch (s) { if (s instanceof Salto && s.tipo === 'return') return s.valor; throw s; }
    }
    if (n.generator) parametros();
    function* cuerpo() {
      try {
        if (!n.generator) for (let i = 0; i < n.params.length; i++) yield* motor.asignar(n.params[i],
          n.params[i].type === 'RestElement' ? args.slice(i) : args[i], local, ctx, 'let');
        if (n.body.type !== 'BlockStatement') return yield* motor.evaluar(n.body, local, ctx);
        motor.preparar(n.body.body, local, ctx, true);
        yield* motor.evaluar(n.body, local, ctx);
      } catch (s) { if (s instanceof Salto && s.tipo === 'return') return s.valor; throw s; }
    }
    if (n.generator) {
      const gen = cuerpo(); let iniciado = false, terminado = false;
      const mover = (metodo, v) => {
        motor.comprobarVivo();
        if (terminado || !iniciado && metodo === 'return') {
          terminado = true; if (metodo === 'throw') throw v; return { done: true, value: metodo === 'return' ? v : undefined };
        }
        iniciado = true;
        const r = metodo === 'return' ? gen.throw(new Salto('return', v)) : gen[metodo](v); terminado = r.done; return { done: r.done, value: r.done ? r.value : r.value.valor };
      };
      return { next(v) { return mover('next', v); }, throw(v) { return mover('throw', v); },
        return(v) { return mover('return', v); }, [Symbol.iterator]() { return this; } };
    }
    return n.async ? this.asincronico(cuerpo()) : this.sincronico(cuerpo());
  },
  *delegar(v) {
    const it = v[Symbol.iterator]();
    const transformar = r => {
      if (r === null || !['object', 'function'].includes(typeof r)) throw new TypeError(`Iterator result ${String(r)} is not an object`);
      return { done: r.done, value: r.done ? r.value : { tipo: 'yield', valor: r.value } };
    };
    const puente = { next(x) { return transformar(it.next(x)); },
      [Symbol.iterator]() { return this; } };
    if (it.return) puente.return = x => transformar(it.return(x));
    puente.throw = x => {
      if (x instanceof Salto && x.tipo === 'return') {
        if (!it.return) throw x;
        const r = it.return(x.valor); if (r.done) throw new Salto('return', r.value); return transformar(r);
      }
      if (it.throw) return transformar(it.throw(x));
      if (it.return) it.return();
      throw new TypeError("The iterator does not provide a 'throw' method.");
    };
    return yield* puente;
  },
  asincronico(gen) {
    return new this.Promise((resolve, reject) => {
      const continuar = (valor = undefined, lanzar = false) => {
        if (this.liberado) return;
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
  },
};
