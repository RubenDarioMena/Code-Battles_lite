// Promesas locales: ninguna continuación depende de microtareas de V8.
export function crearPromesa(cola) {
  return class Promesa {
    constructor(executor) {
      this.estado = 0; this.valor = undefined; this.esperas = [];
      try { executor(v => this.resolver(v), e => this.terminar(2, e)); }
      catch (e) { if (e?.code === 'CBL_PRESUPUESTO') throw e; this.terminar(2, e); }
    }
    terminar(estado, valor) {
      if (this.estado) return;
      this.estado = estado; this.valor = valor;
      for (const fn of this.esperas.splice(0)) cola.push(fn);
    }
    resolver(v) {
      if (this.estado) return;
      if (v === this) return this.terminar(2, new TypeError('Chaining cycle detected for promise'));
      if (v && typeof v.then === 'function') {
        let una = false;
        try { v.then(x => { if (!una) { una = true; this.resolver(x); } },
          e => { if (!una) { una = true; this.terminar(2, e); } }); }
        catch (e) { if (!una) this.terminar(2, e); }
      } else this.terminar(1, v);
    }
    then(ok, mal) {
      return new this.constructor((resolve, reject) => {
        const fn = () => {
          try {
            const f = this.estado === 1 ? ok : mal;
            if (typeof f === 'function') resolve(f(this.valor));
            else (this.estado === 1 ? resolve : reject)(this.valor);
          } catch (e) { if (e?.code === 'CBL_PRESUPUESTO') throw e; reject(e); }
        };
        if (this.estado) cola.push(fn); else this.esperas.push(fn);
      });
    }
    catch(fn) { return this.then(undefined, fn); }
    finally(fn) { return this.then(v => this.constructor.resolve(fn()).then(() => v),
      e => this.constructor.resolve(fn()).then(() => { throw e; })); }
    static resolve(v) { return v instanceof this ? v : new this(r => r(v)); }
    static reject(e) { return new this((_, r) => r(e)); }
    static all(vs) {
      return new this((resolve, reject) => {
        const a = Array.from(vs), out = []; let n = a.length;
        if (!n) resolve([]);
        a.forEach((v, i) => this.resolve(v).then(x => { out[i] = x; if (!--n) resolve(out); }, reject));
      });
    }
    static race(vs) { return new this((r, e) => { for (const v of vs) this.resolve(v).then(r, e); }); }
  };
}
