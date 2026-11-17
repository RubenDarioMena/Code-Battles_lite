import { Entorno, SIN_INICIAR } from './entorno.js';
export const clases = {
  privada(obj, key, ctx) {
    const p = ctx.privados.get(key);
    if (!p.valores.has(obj)) throw new TypeError(`Cannot read private member #${key} from an object whose class did not declare it`);
    return { obj, key, get: () => {
      if (p.get) return Reflect.apply(p.get, obj, []);
      if (p.set) throw new TypeError(`'#${key}' was defined without a getter`);
      return p.valores.get(obj);
    }, set: v => {
      if (p.set) Reflect.apply(p.set, obj, [v]);
      else if (p.get) throw new TypeError(`'#${key}' was defined without a setter`);
      else if (p.metodo) throw new TypeError(`Private method '#${key}' is not writable`);
      else p.valores.set(obj, v);
      return v;
    } };

  },
  construirSuper(ctx, args) {
    const c = ctx.construccion;
    if (!c || !c.derivada) throw new SyntaxError('super() fuera de un constructor derivado');
    const instancia = Reflect.construct(c.padre, args, ctx.nuevo);
    if (c.receptor.valor !== SIN_INICIAR) throw new ReferenceError('Super constructor may only be called once');
    c.receptor.valor = instancia; c.iniciar(instancia); return instancia;
  },
  *clase(n, e, contexto) {
    const scope = new Entorno(e), motor = this;
    if (n.id) scope.declarar(n.id.name, undefined, 'const');
    const padre = n.superClass ? yield* this.evaluar(n.superClass, scope, contexto) : null;
    const derivada = Boolean(n.superClass);
    const privados = new Map(contexto.privados || []), campos = [], metodosPrivados = [];
    let constructor;
    const Clase = function (...args) {
      motor.comprobarVivo();
      if (!new.target) throw new TypeError(`Class constructor ${Clase.name} cannot be invoked without 'new'`);
      const receptor = { valor: derivada ? SIN_INICIAR : this };
      const c = { derivada, padre, receptor, iniciar: obj => iniciar(obj, false) };
      if (!derivada) iniciar(this, false);
      if (constructor) {
        const f = motor.funciones.get(constructor);
        const v = motor.invocar(f.n, f.cierre, f.contexto, this, args, new.target, c);
        if (v !== null && ['object', 'function'].includes(typeof v)) return v;
        if (derivada && v !== undefined) throw new TypeError('Derived constructors may only return object or undefined');
        return motor.leerThis({ receptor });
      }
      if (derivada) { receptor.valor = Reflect.construct(padre, args, new.target); iniciar(receptor.valor, false); }
      return receptor.valor;
    };
    Object.defineProperty(Clase, 'name', { value: n.id?.name || '', configurable: true });
    if (derivada) {
      if (padre !== null && typeof padre !== 'function') throw new TypeError(`Class extends value ${String(padre)} is not a constructor or null`);
      Object.setPrototypeOf(Clase.prototype, padre === null ? null : padre.prototype);
      if (padre) Object.setPrototypeOf(Clase, padre);
    }
    Object.defineProperty(Clase, 'prototype', { writable: false });
    // Los nombres privados existen durante la evaluación de toda la clase.
    const locales = new Set();
    for (const m of n.body.body) if (m.key?.type === 'PrivateIdentifier' && !locales.has(m.key.name)) {
      privados.set(m.key.name, { valores: new WeakMap() }); locales.add(m.key.name);
    }
    for (const m of n.body.body) {
      if (m.type === 'StaticBlock') { campos.push({ bloque: m, static: true }); continue; }
      const key = m.computed ? yield* this.evaluar(m.key, scope, contexto) : m.key.name ?? m.key.value;
      const home = m.static ? Clase : Clase.prototype;
      const ctx = { ...contexto, estricto: true, privados, home };
      if (m.type === 'PropertyDefinition') { campos.push({ m, key, ctx, static: m.static }); continue; }
      const fn = motor.funcion(m.value, scope, ctx);
      Object.defineProperty(fn, 'name', { value: `${m.kind === 'get' || m.kind === 'set' ? m.kind + ' ' : ''}${String(key)}`, configurable: true });
      if (m.kind === 'constructor') constructor = fn;
      else if (m.key.type === 'PrivateIdentifier') {
        const p = privados.get(key);
        if (m.kind === 'get' || m.kind === 'set') p[m.kind] = fn;
        else p.metodo = fn;
        metodosPrivados.push({ p, static: m.static });
      } else if (m.kind === 'get' || m.kind === 'set') Object.defineProperty(home, key, { [m.kind]: fn, configurable: true });
      else Object.defineProperty(home, key, { value: fn, configurable: true, writable: true });
    }
    function iniciar(obj, estatico) {
      for (const p of metodosPrivados) if (p.static === estatico) p.p.valores.set(obj, p.p.metodo);
      for (const f of campos) if (f.static === estatico) {
        const ctx = { ...(f.ctx || contexto), estricto: true, this: obj, receptor: null, nuevo: undefined, privados, home: estatico ? Clase : Clase.prototype };
        if (f.bloque) { motor.sincronico(motor.lista(f.bloque.body, new Entorno(scope), ctx)); continue; }
        const v = f.m.value ? motor.sincronico(motor.evaluar(f.m.value, scope, ctx)) : undefined;
        if (f.m.key.type === 'PrivateIdentifier') privados.get(f.key).valores.set(obj, v);
        else Object.defineProperty(obj, f.key, { value: v, writable: true, enumerable: true, configurable: true });
      }
    }
    if (n.id) scope.escribir(n.id.name, Clase, true);
    iniciar(Clase, true);
    return Clase;
  },
};
