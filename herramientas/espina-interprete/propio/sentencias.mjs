import { Entorno, Salto } from './entorno.mjs';
export const sentencias = {
  *lista(ns, e, ctx) {
    for (const n of ns) if (n.type === 'FunctionDeclaration') e.declarar(n.id.name, this.funcion(n, e, ctx));
    for (const n of ns) yield* this.evaluar(n, e, ctx);
  },
  *sentencia(n, e, ctx) {
    if (ctx.debug && (n.type.endsWith('Statement') || n.type === 'VariableDeclaration') && !['BlockStatement', 'EmptyStatement'].includes(n.type))
      yield { tipo: 'linea', linea: n.loc.start.line, nodo: n.type };
    switch (n.type) {
      case 'Program': return yield* this.lista(n.body, e, ctx);
      case 'BlockStatement': return yield* this.lista(n.body, new Entorno(e), ctx);
      case 'EmptyStatement': case 'FunctionDeclaration': return;
      case 'ClassDeclaration': e.declarar(n.id.name, yield* this.clase(n, e, ctx)); return;
      case 'ExpressionStatement': yield* this.evaluar(n.expression, e, ctx); return;
      case 'VariableDeclaration':
        for (const d of n.declarations) yield* this.asignar(d.id, d.init ? yield* this.evaluar(d.init, e, ctx) : undefined, e, ctx, true);
        return;
      case 'IfStatement':
        return yield* this.evaluar((yield* this.evaluar(n.test, e, ctx)) ? n.consequent : n.alternate, e, ctx);
      case 'ReturnStatement': throw new Salto('return', n.argument ? yield* this.evaluar(n.argument, e, ctx) : undefined);
      case 'ThrowStatement': throw yield* this.evaluar(n.argument, e, ctx);
      case 'BreakStatement': throw new Salto('break', undefined, n.label?.name);
      case 'ContinueStatement': throw new Salto('continue', undefined, n.label?.name);
      case 'TryStatement': {
        try { yield* this.evaluar(n.block, e, ctx); }
        catch (x) {
          if (x instanceof Salto || x?.code === 'CBL_PRESUPUESTO' || !n.handler) throw x;
          const c = new Entorno(e);
          if (n.handler.param) yield* this.asignar(n.handler.param, x, c, ctx, true);
          yield* this.evaluar(n.handler.body, c, ctx);
        } finally { if (n.finalizer) yield* this.evaluar(n.finalizer, e, ctx); }
        return;
      }
      case 'WhileStatement': case 'DoWhileStatement': case 'ForStatement': {
        let scope = new Entorno(e);
        if (n.init) yield* this.evaluar(n.init, scope, ctx);
        let primero = true;
        while (n.type === 'DoWhileStatement' && primero || !n.test || (yield* this.evaluar(n.test, scope, ctx))) {
          primero = false;
          try { yield* this.evaluar(n.body, scope, ctx); }
          catch (x) {
            if (!(x instanceof Salto) || x.tipo === 'return' || x.etiqueta) throw x;
            if (x.tipo === 'break') break;
          }
          // El binding de let en for es nuevo por vuelta (cierres en callbacks).
          if (n.type === 'ForStatement') {
            const siguiente = new Entorno(e);
            for (const [k, v] of scope.valores) siguiente.declarar(k, v);
            scope = siguiente;
          }
          if (n.update) yield* this.evaluar(n.update, scope, ctx);
        }
        return;
      }
      case 'ForOfStatement': case 'ForInStatement': {
        const v = yield* this.evaluar(n.right, e, ctx);
        for (const x of n.type === 'ForInStatement' ? Object.keys(v) : v) {
          const scope = new Entorno(e), decl = n.left.type === 'VariableDeclaration';
          yield* this.asignar(decl ? n.left.declarations[0].id : n.left, x, scope, ctx, decl);
          try { yield* this.evaluar(n.body, scope, ctx); }
          catch (s) {
            if (!(s instanceof Salto) || s.tipo === 'return' || s.etiqueta) throw s;
            if (s.tipo === 'break') break;
          }
        }
        return;
      }
      case 'SwitchStatement': {
        const v = yield* this.evaluar(n.discriminant, e, ctx), scope = new Entorno(e);
        let inicio = -1, defecto = -1;
        for (let i = 0; i < n.cases.length; i++) {
          const c = n.cases[i];
          if (!c.test) defecto = i;
          else if ((yield* this.evaluar(c.test, scope, ctx)) === v) { inicio = i; break; }
        }
        if (inicio < 0) inicio = defecto;
        try { if (inicio >= 0) for (const c of n.cases.slice(inicio)) yield* this.lista(c.consequent, scope, ctx); }
        catch (s) { if (!(s instanceof Salto && s.tipo === 'break' && !s.etiqueta)) throw s; }
        return;
      }
      default: return yield* this.expresion(n, e, ctx);
    }
  },
};
