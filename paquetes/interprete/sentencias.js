import { Entorno, Salto, nombres } from './entorno.js';
export const sentencias = {
  preparar(ns, e, ctx, elevar = false) {
    const d = declaraciones(ns);
    for (const k of d.vars) e.declarar(k, undefined, 'var');
    if (!ctx.estricto) for (const k of d.anidadas) e.declarar(k, undefined, 'var');
    if (elevar) return;
    for (const [k, clase] of d.lexicas) e.declarar(k, undefined, clase);
    for (const n of d.funciones) {
      const destino = ctx.estricto && !e.funcion ? e : e.ambitoVar();
      destino.declarar(n.id.name, undefined, destino.funcion ? 'var' : 'let');
      destino.escribir(n.id.name, this.funcion(n, e, ctx), true);
    }
  },
  *lista(ns, e, ctx, preparar = true) {
    if (preparar) this.preparar(ns, e, ctx);
    let valor;
    for (const n of ns) { const v = yield* this.evaluar(n, e, ctx); if (v !== this.VACIO) valor = v; }
    return valor;
  },
  *sentencia(n, e, ctx) {
    if (ctx.debug && (n.type.endsWith('Statement') || n.type === 'VariableDeclaration') && !['BlockStatement', 'EmptyStatement'].includes(n.type))
      yield { tipo: 'linea', linea: n.loc.start.line, nodo: n.type };
    switch (n.type) {
      case 'Program': return yield* this.lista(n.body, e, ctx);
      case 'BlockStatement': return yield* this.lista(n.body, new Entorno(e), ctx);
      case 'EmptyStatement': case 'FunctionDeclaration': return this.VACIO;
      case 'ClassDeclaration': e.escribir(n.id.name, yield* this.clase(n, e, ctx), true); return this.VACIO;
      case 'ExpressionStatement': return yield* this.evaluar(n.expression, e, ctx);
      case 'VariableDeclaration':
        for (const d of n.declarations) {
          if (n.kind === 'var' && !d.init) continue;
          const valor = d.init ? yield* this.evaluar(d.init, e, ctx) : undefined;
          if (d.id.type === 'Identifier' && ['FunctionExpression', 'ArrowFunctionExpression', 'ClassExpression'].includes(d.init?.type) && !d.init.id)
            Object.defineProperty(valor, 'name', { value: d.id.name, configurable: true });
          yield* this.asignar(d.id, valor, e, ctx, n.kind);
        }
        return this.VACIO;
      case 'IfStatement':
        return yield* this.evaluar((yield* this.evaluar(n.test, e, ctx)) ? n.consequent : n.alternate, e, ctx);
      case 'ReturnStatement': throw new Salto('return', n.argument ? yield* this.evaluar(n.argument, e, ctx) : undefined);
      case 'ThrowStatement': throw yield* this.evaluar(n.argument, e, ctx);
      case 'BreakStatement': throw new Salto('break', undefined, n.label?.name);
      case 'ContinueStatement': throw new Salto('continue', undefined, n.label?.name);
      case 'LabeledStatement': {
        const etiquetas = [...(ctx.etiquetas || []), n.label.name];
        try { return yield* this.evaluar(n.body, e, { ...ctx, etiquetas }); }
        catch (s) { if (!(s instanceof Salto && s.tipo === 'break' && s.etiqueta === n.label.name)) throw s; }
        return this.VACIO;
      }
      case 'TryStatement': {
        let valor;
        try { valor = yield* this.evaluar(n.block, e, ctx); }
        catch (x) {
          if (x instanceof Salto || x?.code === 'CBL_PRESUPUESTO' || !n.handler) throw x;
          const c = new Entorno(e);
          if (n.handler.param) yield* this.asignar(n.handler.param, x, c, ctx, 'let');
          valor = yield* this.evaluar(n.handler.body, c, ctx);
        } finally { if (n.finalizer) yield* this.evaluar(n.finalizer, e, ctx); }
        return valor;
      }
      case 'WhileStatement': case 'DoWhileStatement': case 'ForStatement': {
        let scope = new Entorno(e);
        if (n.init) {
          if (n.init.type === 'VariableDeclaration') this.preparar([n.init], scope, ctx);
          yield* this.evaluar(n.init, scope, ctx);
        }
        let primero = true;
        while (n.type === 'DoWhileStatement' && primero || !n.test || (yield* this.evaluar(n.test, scope, ctx))) {
          primero = false;
          try { yield* this.evaluar(n.body, scope, { ...ctx, etiquetas: [] }); }
          catch (x) {
            if (!(x instanceof Salto) || x.tipo === 'return' || x.etiqueta && !ctx.etiquetas?.includes(x.etiqueta)) throw x;
            if (x.tipo === 'break') break;
          }
          if (n.type === 'ForStatement' && n.init?.kind === 'let') scope = scope.copiar();
          if (n.update) yield* this.evaluar(n.update, scope, ctx);
        }
        return this.VACIO;
      }
      case 'ForOfStatement': case 'ForInStatement': {
        if (n.await) throw new SyntaxError('Construcción no soportada: for await');
        const v = yield* this.evaluar(n.right, e, ctx);
        let valores;
        if (n.type === 'ForInStatement') { valores = []; for (const k in v) valores.push(k); }
        else valores = this.iterable(v, n.right);
        for (const x of valores) {
          const scope = new Entorno(e), decl = n.left.type === 'VariableDeclaration';
          if (decl) this.preparar([n.left], scope, ctx);
          yield* this.asignar(decl ? n.left.declarations[0].id : n.left, x, scope, ctx, decl ? n.left.kind : false);
          try { yield* this.evaluar(n.body, scope, { ...ctx, etiquetas: [] }); }
          catch (s) {
            if (!(s instanceof Salto) || s.tipo === 'return' || s.etiqueta && !ctx.etiquetas?.includes(s.etiqueta)) throw s;
            if (s.tipo === 'break') break;
          }
        }
        return this.VACIO;
      }
      case 'SwitchStatement': {
        const v = yield* this.evaluar(n.discriminant, e, ctx), scope = new Entorno(e);
        this.preparar(n.cases.flatMap(c => c.consequent), scope, ctx);
        let inicio = -1, defecto = -1;
        for (let i = 0; i < n.cases.length; i++) {
          const c = n.cases[i];
          if (!c.test) defecto = i;
          else if ((yield* this.evaluar(c.test, scope, ctx)) === v) { inicio = i; break; }
        }
        if (inicio < 0) inicio = defecto;
        try { if (inicio >= 0) for (const c of n.cases.slice(inicio)) yield* this.lista(c.consequent, scope, ctx, false); }
        catch (s) { if (!(s instanceof Salto && s.tipo === 'break' && !s.etiqueta)) throw s; }
        return this.VACIO;
      }
      case 'DebuggerStatement': return this.VACIO;
      default: return yield* this.expresion(n, e, ctx);
    }
  },
};

// Índice compartido por árbol: preparar un ámbito no vuelve a recorrer expresiones.
const indices = new WeakMap();
function declaraciones(ns) {
  if (indices.has(ns)) return indices.get(ns);
  const d = { vars: [], anidadas: [], lexicas: [], funciones: [] };
  function elevar(n, directo) {
    if (!n) return;
    if (n.type === 'VariableDeclaration') {
      if (n.kind === 'var') for (const v of n.declarations) d.vars.push(...nombres(v.id));
      else if (directo) for (const v of n.declarations) for (const k of nombres(v.id)) d.lexicas.push([k, n.kind]);
      return;
    }
    if (n.type === 'FunctionDeclaration') {
      if (directo) d.funciones.push(n); else d.anidadas.push(n.id.name);
      return;
    }
    if (n.type === 'ClassDeclaration') { if (directo) d.lexicas.push([n.id.name, 'let']); return; }
    if (!/Statement$|SwitchCase|CatchClause|Program/.test(n.type)) return;
    for (const k of ['body', 'consequent', 'alternate', 'block', 'handler', 'finalizer', 'cases', 'left', 'init']) {
      const v = n[k]; if (Array.isArray(v)) v.forEach(h => elevar(h, false)); else elevar(v, false);
    }
  }
  ns.forEach(n => elevar(n, true)); indices.set(ns, d); return d;
}
