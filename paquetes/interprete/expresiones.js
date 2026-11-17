import { binario } from './entorno.js';
export const expresiones = {
  texto(n) { return n.fuente.slice(n.start, n.end); },
  iterable(v, n) {
    if (v == null || typeof v[Symbol.iterator] !== 'function')
      throw new TypeError(`${this.texto(n)} is not iterable`);
    return v;
  },
  *referencia(n, e, ctx) {
    if (n.type === 'Identifier') return { get: () => this.seguro(e.leer(n.name)),
      set: v => e.escribir(n.name, v, false, ctx.estricto), del: () => false };
    const esSuper = n.object.type === 'Super';
    const obj = esSuper ? ctx.home && Object.getPrototypeOf(ctx.home) : yield* this.evaluar(n.object, e, ctx);
    if (obj === this.CORTO || n.optional && obj == null) return this.CORTO;
    const key = n.computed ? yield* this.evaluar(n.property, e, ctx) : n.property.name;
    const receptor = esSuper ? this.leerThis(ctx) : obj;
    if (n.property.type === 'PrivateIdentifier') return this.privada(receptor, key, ctx);
    return { obj: receptor, key,
      get: () => this.seguro(esSuper ? Reflect.get(obj, key, receptor) : obj[key]),
      set: v => { if (esSuper) {
        if (!Reflect.set(obj, key, v, receptor)) throw new TypeError(`Cannot assign to read only property '${String(key)}' of object '#<Object>'`);
      } else if (ctx.estricto || this.aislamiento.fachadas.has(obj)) obj[key] = v;
        else Reflect.set(Object(obj), key, v);
        return v; }, del: () => ctx.estricto || this.aislamiento.fachadas.has(obj) ? delete obj[key] : Reflect.deleteProperty(Object(obj), key) };
  },
  *asignar(n, v, e, ctx, declarar = false) {
    if (n.type === 'Identifier') {
      if (declarar) e.declarar(n.name, undefined, declarar);
      e.escribir(n.name, v, Boolean(declarar), ctx.estricto);
    } else if (n.type === 'MemberExpression') (yield* this.referencia(n, e, ctx)).set(v);
    else if (n.type === 'AssignmentPattern') yield* this.asignar(n.left, v === undefined ? yield* this.evaluar(n.right, e, ctx) : v, e, ctx, declarar);
    else if (n.type === 'RestElement') yield* this.asignar(n.argument, v, e, ctx, declarar);
    else if (n.type === 'ArrayPattern') {
      const it = this.iterable(v, n)[Symbol.iterator](); let fin = false;
      try {
        for (const x of n.elements) {
          if (x?.type === 'RestElement') {
            const resto = []; let r;
            while (!(r = it.next()).done) resto.push(r.value);
            fin = true; yield* this.asignar(x, resto, e, ctx, declarar); break;
          }
          const r = fin ? { done: true } : it.next(); fin = Boolean(r.done);
          if (x) yield* this.asignar(x, r.value, e, ctx, declarar);
        }
      } finally { if (!fin && it.return) it.return(); }
    } else if (n.type === 'ObjectPattern') {
      const usados = [];
      for (const p of n.properties) {
        if (p.type === 'RestElement') {
          const resto = {};
          for (const k of Reflect.ownKeys(Object(v))) if (!usados.includes(k) && Object.prototype.propertyIsEnumerable.call(v, k)) resto[k] = v[k];
          yield* this.asignar(p.argument, resto, e, ctx, declarar);
        } else {
          const k = p.computed ? yield* this.evaluar(p.key, e, ctx) : p.key.name ?? p.key.value;
          usados.push(k); yield* this.asignar(p.value, this.seguro(v[k]), e, ctx, declarar);
        }
      }
    } else throw new SyntaxError(`Patrón no soportado: ${n.type}`);
    return v;
  },
  *argumentos(ns, e, ctx) {
    const a = [];
    for (const n of ns) {
      if (n.type === 'SpreadElement') a.push(...this.iterable(yield* this.evaluar(n.argument, e, ctx), n.argument));
      else a.push(yield* this.evaluar(n, e, ctx));
    }
    return a;
  },
  *expresion(n, e, ctx) {
    switch (n.type) {
      case 'Literal': return n.regex ? new RegExp(n.regex.pattern, n.regex.flags) : n.value;
      case 'Identifier': return this.seguro(e.leer(n.name));
      case 'ThisExpression': return this.leerThis(ctx);
      case 'MetaProperty': return ctx.nuevo;
      case 'FunctionExpression': case 'ArrowFunctionExpression': return this.funcion(n, e, ctx);
      case 'ClassExpression': return yield* this.clase(n, e, ctx);
      case 'YieldExpression': {
        const valor = n.argument ? yield* this.evaluar(n.argument, e, ctx) : undefined;
        if (n.delegate) return yield* this.delegar(this.iterable(valor, n.argument));
        return yield { tipo: 'yield', valor };
      }
      case 'ArrayExpression': {
        const a = [];
        for (const x of n.elements) {
          if (!x) { a.length++; continue; }
          if (x.type === 'SpreadElement') a.push(...this.iterable(yield* this.evaluar(x.argument, e, ctx), x.argument));
          else a.push(yield* this.evaluar(x, e, ctx));
        }
        return a;
      }
      case 'ObjectExpression': {
        const o = {};
        for (const p of n.properties) {
          if (p.type === 'SpreadElement') {
            const v = yield* this.evaluar(p.argument, e, ctx);
            if (v != null) for (const k of Reflect.ownKeys(Object(v))) if (Object.prototype.propertyIsEnumerable.call(v, k))
              Object.defineProperty(o, k, { value: this.seguro(v[k]), writable: true, enumerable: true, configurable: true });
            continue;
          }
          const k = p.computed ? yield* this.evaluar(p.key, e, ctx) : p.key.name ?? p.key.value;
          const v = p.method || p.kind === 'get' || p.kind === 'set'
            ? this.funcion(p.value, e, { ...ctx, home: o }) : yield* this.evaluar(p.value, e, ctx);
          if (p.kind === 'get' || p.kind === 'set') Object.defineProperty(o, k,
            { ...Object.getOwnPropertyDescriptor(o, k)?.get && { get: Object.getOwnPropertyDescriptor(o, k).get },
              ...Object.getOwnPropertyDescriptor(o, k)?.set && { set: Object.getOwnPropertyDescriptor(o, k).set },
              [p.kind]: v, enumerable: true, configurable: true });
          else if (!p.computed && !p.shorthand && !p.method && k === '__proto__') {
            if (v === null || typeof v === 'object' || typeof v === 'function') Object.setPrototypeOf(o, v);
          } else Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
        }
        return o;
      }
      case 'ChainExpression': {
        const v = yield* this.evaluar(n.expression, e, ctx); return v === this.CORTO ? undefined : v;
      }
      case 'MemberExpression': {
        const r = yield* this.referencia(n, e, ctx); return r === this.CORTO ? r : r.get();
      }
      case 'CallExpression': case 'NewExpression': {
        if (n.callee.type === 'Super') return this.construirSuper(ctx, yield* this.argumentos(n.arguments, e, ctx));
        let fn, obj = undefined;
        if (n.callee.type === 'MemberExpression') {
          const r = yield* this.referencia(n.callee, e, ctx);
          if (r === this.CORTO) return r;
          obj = r.obj; fn = r.get();
        } else fn = yield* this.evaluar(n.callee, e, ctx);
        if (fn === this.CORTO || n.optional && fn == null) return this.CORTO;
        const args = yield* this.argumentos(n.arguments, e, ctx);
        if (typeof fn !== 'function') throw new TypeError(`${this.texto(n.callee)} is not ${n.type === 'NewExpression' ? 'a constructor' : 'a function'}`);
        if (!this.funciones.has(fn) && !this.aislamiento.nativas.has(fn)) this.cobrar(n, ctx);
        if (n.type === 'NewExpression') {
          if (!this.construible(fn)) throw new TypeError(`${this.texto(n.callee)} is not a constructor`);
          return this.seguro(Reflect.construct(fn, args));
        }
        return this.seguro(Reflect.apply(fn, obj, args));
      }
      case 'AwaitExpression': return yield { tipo: 'await', valor: yield* this.evaluar(n.argument, e, ctx) };
      case 'ConditionalExpression': return yield* this.evaluar((yield* this.evaluar(n.test, e, ctx)) ? n.consequent : n.alternate, e, ctx);
      case 'SequenceExpression': { let v; for (const x of n.expressions) v = yield* this.evaluar(x, e, ctx); return v; }
      case 'BinaryExpression': {
        if (n.left.type === 'PrivateIdentifier') {
          const obj = yield* this.evaluar(n.right, e, ctx); return ctx.privados.get(n.left.name).valores.has(obj);
        }
        return binario(n.operator, yield* this.evaluar(n.left, e, ctx), yield* this.evaluar(n.right, e, ctx));
      }
      case 'LogicalExpression': {
        const a = yield* this.evaluar(n.left, e, ctx);
        return (n.operator === '&&' ? a : n.operator === '||' ? !a : a == null) ? yield* this.evaluar(n.right, e, ctx) : a;
      }
      case 'AssignmentExpression': {
        if (n.left.type.endsWith('Pattern')) return yield* this.asignar(n.left, yield* this.evaluar(n.right, e, ctx), e, ctx);
        const r = yield* this.referencia(n.left, e, ctx), op = n.operator;
        if (op === '=') return r.set(yield* this.evaluar(n.right, e, ctx));
        const a = r.get();
        if (op === '&&=' && !a || op === '||=' && a || op === '??=' && a != null) return a;
        const b = yield* this.evaluar(n.right, e, ctx);
        return r.set(['&&=', '||=', '??='].includes(op) ? b : binario(op.slice(0, -1), a, b));
      }
      case 'UpdateExpression': {
        const r = yield* this.referencia(n.argument, e, ctx), v = r.get();
        let x = typeof v === 'bigint' ? v : +v, anterior = x;
        if (n.operator === '++') ++x; else --x;
        r.set(x); return n.prefix ? x : anterior;
      }
      case 'UnaryExpression': {
        if (n.operator === 'typeof' && n.argument.type === 'Identifier' && !e.tiene(n.argument.name)) return 'undefined';
        if (n.operator === 'delete') {
          const argumento = n.argument.type === 'ChainExpression' ? n.argument.expression : n.argument;
          if (argumento.type === 'MemberExpression' || argumento.type === 'Identifier') {
            const r = yield* this.referencia(argumento, e, ctx); return r === this.CORTO ? true : r.del();
          }
          yield* this.evaluar(n.argument, e, ctx); return true;
        }
        const v = yield* this.evaluar(n.argument, e, ctx);
        switch (n.operator) {
          case '!': return !v; case '~': return ~v; case '+': return +v; case '-': return -v;
          case 'void': return undefined; case 'typeof': return typeof v;
        }
        break;
      }
      case 'TemplateLiteral': {
        let s = n.quasis[0].value.cooked;
        for (let i = 0; i < n.expressions.length; i++) s += String(yield* this.evaluar(n.expressions[i], e, ctx)) + n.quasis[i + 1].value.cooked;
        return s;
      }
      case 'TaggedTemplateExpression': {
        let tag, receptor;
        if (n.tag.type === 'MemberExpression') { const r = yield* this.referencia(n.tag, e, ctx); tag = r.get(); receptor = r.obj; }
        else tag = yield* this.evaluar(n.tag, e, ctx);
        const plantillas = ctx.plantillas || this.plantillas;
        let textos = plantillas.get(n);
        if (!textos) {
          textos = n.quasi.quasis.map(q => q.value.cooked === null ? undefined : q.value.cooked);
          Object.defineProperty(textos, 'raw', { value: Object.freeze(n.quasi.quasis.map(q => q.value.raw)) });
          Object.freeze(textos); plantillas.set(n, textos);
        }
        return this.seguro(Reflect.apply(tag, receptor, [textos, ...yield* this.argumentos(n.quasi.expressions, e, ctx)]));
      }
    }
    throw new SyntaxError(`Construcción no soportada: ${n.type}`);
  },
};
