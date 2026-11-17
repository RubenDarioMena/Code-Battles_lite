import { binario } from './entorno.mjs';
export const expresiones = {
  *referencia(n, e, ctx) {
    if (n.type === 'Identifier') return { get: () => e.leer(n.name), set: v => e.escribir(n.name, v), del: () => false };
    const obj = yield* this.evaluar(n.object, e, ctx);
    const key = n.computed ? yield* this.evaluar(n.property, e, ctx) : n.property.name;
    return { obj, key, get: () => this.seguro(obj[key]), set: v => obj[key] = v, del: () => delete obj[key] };
  },
  *asignar(n, v, e, ctx, declarar = false) {
    if (n.type === 'Identifier') { if (declarar) e.declarar(n.name, v); else e.escribir(n.name, v); }
    else if (n.type === 'MemberExpression') (yield* this.referencia(n, e, ctx)).set(v);
    else if (n.type === 'AssignmentPattern') yield* this.asignar(n.left, v === undefined ? yield* this.evaluar(n.right, e, ctx) : v, e, ctx, declarar);
    else if (n.type === 'RestElement') yield* this.asignar(n.argument, v, e, ctx, declarar);
    else if (n.type === 'ArrayPattern') {
      const a = Array.from(v); let i = 0;
      for (const x of n.elements) { if (x) yield* this.asignar(x, x.type === 'RestElement' ? a.slice(i) : a[i], e, ctx, declarar); i++; }
    } else if (n.type === 'ObjectPattern') {
      const usados = [];
      for (const p of n.properties) {
        if (p.type === 'RestElement') yield* this.asignar(p.argument,
          Object.fromEntries(Object.entries(v).filter(([k]) => !usados.includes(k))), e, ctx, declarar);
        else {
          const k = p.computed ? yield* this.evaluar(p.key, e, ctx) : p.key.name ?? p.key.value;
          usados.push(k); yield* this.asignar(p.value, v[k], e, ctx, declarar);
        }
      }
    } else throw new Error(`Patrón no implementado: ${n.type}`);
    return v;
  },
  *argumentos(ns, e, ctx) {
    const a = [];
    for (const n of ns) {
      if (n.type === 'SpreadElement') a.push(...yield* this.evaluar(n.argument, e, ctx));
      else a.push(yield* this.evaluar(n, e, ctx));
    }
    return a;
  },
  *expresion(n, e, ctx) {
    switch (n.type) {
      case 'Literal': return n.regex ? new RegExp(n.regex.pattern, n.regex.flags) : n.value;
      case 'Identifier': return e.leer(n.name);
      case 'ThisExpression': return ctx.this;
      case 'FunctionExpression': case 'ArrowFunctionExpression': return this.funcion(n, e, ctx);
      case 'ClassExpression': return yield* this.clase(n, e, ctx);
      case 'Super': return ctx.super;
      case 'YieldExpression': return yield { tipo: 'yield', valor: yield* this.evaluar(n.argument, e, ctx) };
      case 'ArrayExpression': {
        const a = [];
        for (const x of n.elements) {
          if (!x) { a.length++; continue; }
          if (x.type === 'SpreadElement') a.push(...yield* this.evaluar(x.argument, e, ctx));
          else a.push(yield* this.evaluar(x, e, ctx));
        }
        return a;
      }
      case 'ObjectExpression': {
        const o = {};
        for (const p of n.properties) {
          if (p.type === 'SpreadElement') { Object.assign(o, yield* this.evaluar(p.argument, e, ctx)); continue; }
          const k = p.computed ? yield* this.evaluar(p.key, e, ctx) : p.key.name ?? p.key.value;
          const v = yield* this.evaluar(p.value, e, ctx);
          if (p.kind === 'get' || p.kind === 'set') Object.defineProperty(o, k, { [p.kind]: v, enumerable: true, configurable: true });
          else o[k] = v;
        }
        return o;
      }
      case 'ChainExpression': return yield* this.evaluar(n.expression, e, ctx);
      case 'MemberExpression': {
        if (n.optional && (yield* this.evaluar(n.object, e, ctx)) == null) return undefined;
        return (yield* this.referencia(n, e, ctx)).get();
      }
      case 'CallExpression': case 'NewExpression': {
        let fn, obj = this.global;
        if (n.callee.type === 'MemberExpression') {
          if (n.callee.optional && (yield* this.evaluar(n.callee.object, e, ctx)) == null) return undefined;
          const r = yield* this.referencia(n.callee, e, ctx); obj = r.obj; fn = r.get();
        } else fn = yield* this.evaluar(n.callee, e, ctx);
        if (n.optional && fn == null) return undefined;
        const args = yield* this.argumentos(n.arguments, e, ctx);
        if (n.callee.type === 'Super') {
          const base = Reflect.construct(ctx.super, args);
          Object.defineProperties(ctx.this, Object.getOwnPropertyDescriptors(base)); return ctx.this;
        }
        if (n.type === 'NewExpression') return Reflect.construct(fn, args);
        return Reflect.apply(fn, obj, args);
      }
      case 'AwaitExpression': return yield { tipo: 'await', valor: yield* this.evaluar(n.argument, e, ctx) };
      case 'ConditionalExpression': return yield* this.evaluar((yield* this.evaluar(n.test, e, ctx)) ? n.consequent : n.alternate, e, ctx);
      case 'SequenceExpression': { let v; for (const x of n.expressions) v = yield* this.evaluar(x, e, ctx); return v; }
      case 'BinaryExpression': return binario(n.operator, yield* this.evaluar(n.left, e, ctx), yield* this.evaluar(n.right, e, ctx));
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
        const r = yield* this.referencia(n.argument, e, ctx), v = Number(r.get()), x = v + (n.operator === '++' ? 1 : -1);
        r.set(x); return n.prefix ? x : v;
      }
      case 'UnaryExpression': {
        if (n.operator === 'typeof' && n.argument.type === 'Identifier' && !e.tiene(n.argument.name)) return 'undefined';
        if (n.operator === 'delete') return (yield* this.referencia(n.argument, e, ctx)).del();
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
    }
    throw new Error(`ESTree no implementado: ${n.type}`);
  },
};
