// FIFO propia: las reacciones y la adopción de thenables son trabajos distintos.
export function crearPromesa(cola) {
  const estados = new WeakMap();
  const presupuesto = e => { if (e?.code === 'CBL_PRESUPUESTO') throw e; };
  function terminar(p, estado, valor) {
    const s = estados.get(p); if (s.estado) return;
    s.estado = estado; s.valor = valor;
    for (const fn of s.esperas.splice(0)) cola.push(fn);
  }
  function resolver(p, v) {
    if (estados.get(p).estado) return;
    if (v === p) return terminar(p, 2, new TypeError('Chaining cycle detected for promise #<Promise>'));
    if (v && ['object', 'function'].includes(typeof v)) {
      let then;
      try { then = v.then; } catch (e) { presupuesto(e); terminar(p, 2, e); return; }
      if (typeof then === 'function') {
        cola.push(() => {
          let una = false;
          try { Reflect.apply(then, v, [x => { if (!una) { una = true; resolver(p, x); } },
            e => { if (!una) { una = true; terminar(p, 2, e); } }]); }
          catch (e) { presupuesto(e); if (!una) terminar(p, 2, e); }
        });
        return;
      }
    }
    terminar(p, 1, v);
  }
  function Promise(executor) {
    if (!new.target) throw new TypeError("Promise constructor cannot be invoked without 'new'");
    if (typeof executor !== 'function') throw new TypeError(`Promise resolver ${String(executor)} is not a function`);
    estados.set(this, { estado: 0, valor: undefined, esperas: [] });
    let una = false;
    try { executor(v => { if (!una) { una = true; resolver(this, v); } },
      e => { if (!una) { una = true; terminar(this, 2, e); } }); }
    catch (e) { presupuesto(e); if (!una) { una = true; terminar(this, 2, e); } }
  }
  function iterar(vs) {
    if (vs == null || typeof vs[Symbol.iterator] !== 'function')
      throw new TypeError(`${typeof vs} ${String(vs)} is not iterable (cannot read property Symbol(Symbol.iterator))`);
    return vs;
  }
  const metodos = {
    then(ok, mal) {
      const s = estados.get(this);
      if (!s) throw new TypeError(`Method Promise.prototype.then called on incompatible receiver ${Object.prototype.toString.call(this) === '[object Object]' ? '#<Object>' : String(this)}`);
      const C = /** @type {any} */ (this.constructor);
      return new C((resolve, reject) => {
        const fn = () => {
          try {
            const f = s.estado === 1 ? ok : mal;
            if (typeof f === 'function') resolve(f(s.valor));
            else (s.estado === 1 ? resolve : reject)(s.valor);
          } catch (e) { presupuesto(e); reject(e); }
        };
        if (s.estado) cola.push(fn); else s.esperas.push(fn);
      });
    },
    catch(fn) { return this.then(undefined, fn); },
    finally(fn) {
      if (typeof fn !== 'function') return this.then(fn, fn);
      const C = /** @type {any} */ (this.constructor);
      return this.then(v => C.resolve(fn()).then(() => v), e => C.resolve(fn()).then(() => { throw e; }));
    },
    get [Symbol.toStringTag]() { return 'Promise'; },
  };
  Object.defineProperties(Promise.prototype, Object.getOwnPropertyDescriptors(metodos));
  for (const k of ['then', 'catch', 'finally']) Object.defineProperty(Promise.prototype, k, { enumerable: false });
  const estaticos = {
    /** @this {any} */
    resolve(v) { return estados.has(v) && v.constructor === this ? v : new this(r => r(v)); },
    /** @this {any} */
    reject(e) { return new this((_, r) => r(e)); },
    all(vs) { return combinar(this, vs, 'all'); },
    allSettled(vs) { return combinar(this, vs, 'settled'); },
    race(vs) { return combinar(this, vs, 'race'); },
    any(vs) { return combinar(this, vs, 'any'); },
  };
  function combinar(C, vs, tipo) {
    return new C((resolve, reject) => {
      const out = []; let pendientes = 1, indice = 0;
      for (const v of iterar(vs)) {
        const i = indice++; pendientes++; out[i] = undefined;
        C.resolve(v).then(x => {
          if (tipo === 'race' || tipo === 'any') { resolve(x); return; }
          out[i] = tipo === 'settled' ? { status: 'fulfilled', value: x } : x;
          if (!--pendientes) resolve(out);
        }, e => {
          if (tipo === 'all' || tipo === 'race') { reject(e); return; }
          out[i] = tipo === 'settled' ? { status: 'rejected', reason: e } : e;
          if (!--pendientes) {
            if (tipo === 'any') reject(new AggregateError(out, 'All promises were rejected')); else resolve(out);
          }
        });
      }
      if (!--pendientes) {
        if (tipo === 'any') reject(new AggregateError(out, 'All promises were rejected'));
        else if (tipo !== 'race') resolve(out);
      }
    });
  }
  for (const k of Object.keys(estaticos)) Object.defineProperty(Promise, k,
    { value: estaticos[k], configurable: true, writable: true });
  return Promise;
}
