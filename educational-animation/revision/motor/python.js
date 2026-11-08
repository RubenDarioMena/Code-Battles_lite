/* Modo revisión · lector de Python. Lee un programa de Python con lezer (el mismo analizador del editor) y
 * devuelve la misma tabla de nodos que el trazador da para JavaScript, con los tipos de acorn (ESTree):
 * así el diagrama, las frases y las tarjetas sirven para los dos lenguajes sin cambiar.
 *
 *   leer(fuente, opciones) → { lenguaje: 'python', fuente, nodos, comentarios, eventos: [] }
 *     nodos: { id, tipo, a, b, linea, lineaFin, padre, campo, hijos, prof, ganchos, nombre?, op?, valor?, clase?,
 *              computado? }. a y b son posiciones en la fuente de Python: el resaltado cae en el texto real.
 *   opciones.lezer   el analizador (por defecto, LezerPython global)
 *   opciones.nombre(n) → nombre para el catálogo (auto_target → autoTarget). El texto del código no cambia.
 *
 * Correspondencias: la primera asignación de un nombre en su ámbito es una declaración (let; en Python todo
 * puede cambiar); las siguientes, asignaciones. if/elif/else → IfStatement encadenados; for → ForOfStatement;
 * def → FunctionDeclaration; and/or/not → && || !; == is → ===; != «is not» → !==; None/True/False → Literal;
 * pass → EmptyStatement; raise → ThrowStatement; try/except → TryStatement con CatchClause; lambda → flecha.
 * Lo que no tiene equivalente (clases, import, comprensiones…) queda como sentencia o expresión genérica:
 * se ve en el diagrama con su código.
 * Solo lee: no ejecuta nada. Como lezer no respeta toda la precedencia de Python («not a and b»), las
 * cadenas de operadores se aplanan y se vuelven a asociar con la tabla de Python (como el traductor). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.CMGPythonRevision = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";
  const PUNTUACION = new Set(["(", ")", "[", "]", "{", "}", ",", ":", ".", ";", "Comment"]);
  // Precedencia de Python (de menos a más). Los unarios y await se tratan como operandos.
  const LBP = { or: 2, and: 3, "|": 6, "^": 7, "&": 8, "<<": 9, ">>": 9, "+": 10, "-": 10, "*": 11, "/": 11, "//": 11, "%": 11, "@": 11, "**": 13 };
  for (const c of ["<", ">", "<=", ">=", "==", "!=", "in", "not in", "is", "is not"]) LBP[c] = 5;
  const OP_JS = { and: "&&", or: "||", "==": "===", "!=": "!==", is: "===", "is not": "!==", "not in": "not in" };
  const ARIT = new Set(["+", "-", "*", "/", "//", "%", "**", "@", "&", "|", "^", "<<", ">>"]);

  function plano(arbol) {
    const c = arbol.cursor();
    const rec = () => {
      const n = { t: c.name, a: c.from, b: c.to, e: c.type.isError, h: [] };
      if (c.firstChild()) { do n.h.push(rec()); while (c.nextSibling()); c.parent(); }
      return n;
    };
    return rec();
  }
  const util = (n) => n.h.filter(h => !PUNTUACION.has(h.t));

  function leer(texto, opciones = {}) {
    const src = String(texto).replace(/\r\n?/g, "\n");
    const L = opciones.lezer || (typeof LezerPython !== "undefined" ? LezerPython : null) || (typeof self !== "undefined" && self.LezerPython) || null;
    if (!L) throw new Error("Falta lezer para leer Python.");
    const nombreCat = opciones.nombre || ((n) => n);
    const inicios = [0];
    for (let i = 0; i < src.length; i++) if (src[i] === "\n") inicios.push(i + 1);
    const lineaDe = (pos) => { let lo = 0, hi = inicios.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (inicios[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };
    const txt = (n) => src.slice(n.a, n.b);
    const raizL = plano(L.parser.parse(src));

    // Un error de sintaxis se avisa como acorn: mensaje y loc.line.
    // lezer 1.1.19 no acepta «yield» sin valor: deja un error vacío justo detrás. Python sí lo acepta.
    (function errores(n, padre) {
      if (n.e && n.a === n.b && padre && /^Yield(Statement|Expression)$/.test(padre.t)) return;
      if (n.e) { const e = new SyntaxError(`«${src.slice(n.a, n.a + 12).split("\n")[0].trim() || "…"}» (${lineaDe(n.a)})`); e.loc = { line: lineaDe(n.a), column: n.a - inicios[lineaDe(n.a) - 1] }; throw e; }
      n.h.forEach(h => errores(h, n));
    })(raizL, null);

    const comentarios = [];
    (function notas(n) { if (n.t === "Comment") comentarios.push({ a: n.a, b: n.b, linea: lineaDe(n.a), texto: txt(n).replace(/^#\s?/, "").trim(), bloque: false }); n.h.forEach(notas); })(raizL);

    // Nodo ESTree provisional: { tipo, a, b, hijos: [[campo, nodo]], ...datos }.
    const nodo = (tipo, a, b, hijos = [], datos = {}) => ({ tipo, a, b, hijos: hijos.filter(h => h[1]), ...datos });
    const rango = (lista) => lista.length ? [lista[0].a, lista.at(-1).b] : null;

    // Ámbitos: la primera asignación de un nombre en su ámbito lo declara.
    let ambito = new Set();

    function cuerpo(body) {
      const ss = util(body).flatMap(sentencia);
      const r = rango(ss) || [body.b, body.b];
      return nodo("BlockStatement", r[0], r[1], ss.map(s => ["body", s]));
    }

    function sentencia(n) {
      const h = util(n);
      switch (n.t) {
        case "AssignStatement": {
          // Partes separadas por «=»; una parte con comas es una tupla (a, b = 1, 2).
          const grupos = [[]];
          for (const x of n.h) { if (x.t === "AssignOp") grupos.push([]); else if (!PUNTUACION.has(x.t) && x.t !== "TypeDef") grupos.at(-1).push(x); }
          const ops = grupos.length - 1;
          const partes = grupos.map(g => g.length === 1 ? g[0] : { t: "TupleExpression", a: g[0].a, b: g.at(-1).b, h: g, e: false });
          const valor = expresion(partes.at(-1)), destinos = partes.slice(0, -1);
          if (ops === 1 && destinos.length === 1 && destinos[0].t === "VariableName" && !ambito.has(txt(destinos[0]))) {
            ambito.add(txt(destinos[0]));
            const id = expresion(destinos[0]);
            return [nodo("VariableDeclaration", n.a, n.b, [["declarations", nodo("VariableDeclarator", n.a, n.b, [["id", id], ["init", valor]])]], { clase: "let" })];
          }
          for (const d of destinos) for (const v of d.t === "TupleExpression" ? d.h : [d]) if (v.t === "VariableName") ambito.add(txt(v));
          // a = b = 1: la última asignación lleva el valor; las demás, en cadena.
          let e = valor;
          for (const d of destinos.slice().reverse()) e = nodo("AssignmentExpression", d.a, n.b, [["left", expresion(d)], ["right", e]], { op: "=" });
          return [nodo("ExpressionStatement", n.a, n.b, [["expression", e]])];
        }
        case "UpdateStatement": {
          const op = n.h.find(x => x.t === "UpdateOp"), [l, r] = h.filter(x => x.t !== "UpdateOp");
          return [nodo("ExpressionStatement", n.a, n.b, [["expression", nodo("AssignmentExpression", n.a, n.b, [["left", expresion(l)], ["right", expresion(r)]], { op: txt(op) })]])];
        }
        case "ExpressionStatement": return [nodo("ExpressionStatement", n.a, n.b, [["expression", expresion(h[0])]])];
        case "PassStatement": return [nodo("EmptyStatement", n.a, n.b)];
        case "BreakStatement": return [nodo("BreakStatement", n.a, n.b)];
        case "ContinueStatement": return [nodo("ContinueStatement", n.a, n.b)];
        case "ReturnStatement": { const v = h.find(x => x.t !== "return"); return [nodo("ReturnStatement", n.a, n.b, [["argument", v ? expresion(v) : null]])]; }
        case "RaiseStatement": { const v = h.find(x => x.t !== "raise" && x.t !== "from"); return [nodo("ThrowStatement", n.a, n.b, [["argument", v ? expresion(v) : null]])]; }
        case "WhileStatement": {
          const test = h.find(x => x.t !== "while" && x.t !== "Body" && x.t !== "else"), body = h.find(x => x.t === "Body");
          return [nodo("WhileStatement", n.a, n.b, [["test", expresion(test)], ["body", cuerpo(body)]])];
        }
        case "IfStatement": return [siEncadenado(n, n.h, 0)];
        case "ForStatement": {
          const k = h.findIndex(x => x.t === "in"), body = h.find(x => x.t === "Body");
          const objetivo = h.slice(h[0].t === "async" ? 2 : 1, k), iterable = h.slice(k + 1).find(x => x.t !== "Body");
          let left;
          if (objetivo.length === 1 && objetivo[0].t === "VariableName") {
            ambito.add(txt(objetivo[0]));
            const id = expresion(objetivo[0]);
            left = nodo("VariableDeclaration", id.a, id.b, [["declarations", nodo("VariableDeclarator", id.a, id.b, [["id", id]])]], { clase: "let" });
          } else {
            const r = rango(objetivo);
            left = nodo("ArrayPattern", r[0], r[1], objetivo.filter(x => x.t === "VariableName").map(x => { ambito.add(txt(x)); return ["elements", expresion(x)]; }));
          }
          return [nodo("ForOfStatement", n.a, n.b, [["left", left], ["right", expresion(iterable)], ["body", cuerpo(body)]])];
        }
        case "FunctionDefinition": {
          const nom = h.find(x => x.t === "VariableName"), params = h.find(x => x.t === "ParamList"), body = h.find(x => x.t === "Body");
          if (nom) ambito.add(txt(nom));
          const fuera = ambito;
          ambito = new Set();
          const ps = parametros(params);
          // Un yield en su cuerpo (no en una función o lambda de dentro) la hace generadora.
          const generador = (function hay(x) { return x !== body && /^(FunctionDefinition|LambdaExpression)$/.test(x.t) ? false : /^Yield(Statement|Expression)$/.test(x.t) || x.h.some(hay); })(body);
          const f = nodo("FunctionDeclaration", n.a, n.b, [["id", nom ? expresion(nom) : null], ...ps.map(p => ["params", p]), ["body", cuerpo(body)]], { async: h[0].t === "async", ...(generador ? { generador } : {}) });
          ambito = fuera;
          return [f];
        }
        case "TryStatement": {
          // try: Body (except [tipo [as nombre]]: Body)* [else: Body] [finally: Body]
          const partes = [];
          let actual = null;
          for (const x of h) {
            if (x.t === "try" || x.t === "except" || x.t === "else" || x.t === "finally") { actual = { clave: x.t, a: x.a, cosas: [] }; partes.push(actual); }
            else if (actual) actual.cosas.push(x);
          }
          const bloqueDe = (p) => p && p.cosas.find(x => x.t === "Body");
          const t = partes.find(p => p.clave === "try"), ex = partes.find(p => p.clave === "except"), fin = partes.find(p => p.clave === "finally");
          let handler = null;
          if (ex) {
            const b = bloqueDe(ex), nombre = ex.cosas.filter(x => x.t === "VariableName").at(-1), conAs = ex.cosas.some(x => x.t === "as");
            if (conAs && nombre) ambito.add(txt(nombre));
            const cb = cuerpo(b);
            handler = nodo("CatchClause", ex.a, cb.b, [["param", conAs && nombre ? expresion(nombre) : null], ["body", cb]]);
          }
          return [nodo("TryStatement", n.a, n.b, [["block", cuerpo(bloqueDe(t))], ["handler", handler], ["finalizer", fin ? cuerpo(bloqueDe(fin)) : null]])];
        }
        case "Comment": return [];
        default: return [nodo("PySentencia", n.a, n.b, [], { py: n.t })];
      }
    }

    // if c: A  elif d: B  else: C  →  IfStatement(c, A, IfStatement(d, B, C)). Cada elif empieza en su palabra.
    function siEncadenado(n, hs, desde) {
      const h = hs.slice(desde).filter(x => !PUNTUACION.has(x.t));
      const test = h[1], body = h[2], resto = h.slice(3);
      const consecuente = cuerpo(body);
      let alternativa = null;
      if (resto.length && resto[0].t === "elif") alternativa = siEncadenado({ a: resto[0].a, b: n.b }, resto, 0);
      else if (resto.length && resto[0].t === "else") alternativa = cuerpo(resto[1]);
      return nodo("IfStatement", n.a, n.b, [["test", expresion(test)], ["consequent", consecuente], ["alternate", alternativa]]);
    }

    function parametros(lista) {
      if (!lista) return [];
      const h = util(lista), out = [];
      for (let k = 0; k < h.length; k++) {
        const x = h[k];
        if (x.t !== "VariableName") continue;
        ambito.add(txt(x));
        if (h[k + 1] && h[k + 1].t === "AssignOp") { out.push(nodo("AssignmentPattern", x.a, h[k + 2].b, [["left", expresion(x)], ["right", expresion(h[k + 2])]])); k += 2; }
        else out.push(expresion(x));
      }
      return out;
    }

    // Cadena de operadores binarios: se aplana y se vuelve a asociar con la precedencia de Python.
    function aplanar(n, out) {
      if (n.t === "BinaryExpression" || esNotLargo(n)) {
        // lezer puede dejar «not a and b» como not(a and b): se separa el not como operando de a.
        if (n.t === "UnaryExpression") { const resto = n.h.slice(1); out.push({ unario: n.h[0] }); for (const x of resto) aplanarUno(x, out); return; }
        for (const x of n.h) aplanarUno(x, out);
        return;
      }
      out.push({ operando: n });
    }
    function aplanarUno(x, out) {
      if (x.t === "BinaryExpression" || esNotLargo(x)) return aplanar(x, out);
      if (["CompareOp", "ArithOp", "BitOp", "and", "or", "in", "is", "not"].includes(x.t) && !(x.t === "ArithOp" && out.length && !out.at(-1).operando && !out.at(-1).op)) {
        // «is not» y «not in»: dos palabras, un operador.
        const prev = out.at(-1);
        if (x.t === "not" && prev && prev.op === "is") { prev.op = "is not"; prev.b = x.b; return; }
        if (x.t === "in" && prev && prev.unario && prev.unario.t === "not" && out.at(-2) && out.at(-2).operando) { out.pop(); out.push({ op: "not in", a: prev.unario.a, b: x.b }); return; }
        if (x.t === "not") { out.push({ unario: x }); return; }
        out.push({ op: txt(x), a: x.a, b: x.b });
        return;
      }
      out.push({ operando: x });
    }
    // lezer deja «not a and b» como not (a and b): se aplana y se vuelve a asociar.
    const esNotLargo = (n) => n.t === "UnaryExpression" && n.h[0] && n.h[0].t === "not" && n.h.slice(1).some(x => x.t === "BinaryExpression");
    function binaria(n) {
      const seq = [];
      aplanar(n, seq);
      const items = seq.map(s => s.unario ? { not: s.unario } : s.operando ? { e: expresion(s.operando) } : { op: s.op });
      // «not» va entre and y las comparaciones: not a == b → not (a == b); not a and b → (not a) and b.
      let k = 0;
      function expr(min) {
        let izq;
        if (items[k].not) { const u = items[k++].not, arg = expr(5); izq = nodo("UnaryExpression", u.a, arg.b, [["argument", arg]], { op: "!" }); }
        else izq = items[k++].e;
        while (k < items.length && items[k].op && LBP[items[k].op] >= min) {
          const op = items[k].op, p = LBP[op];
          k++;
          const der = expr(op === "**" ? p : p + 1);
          const tipo = op === "and" || op === "or" ? "LogicalExpression" : "BinaryExpression";
          izq = nodo(tipo, izq.a, der.b, [["left", izq], ["right", der]], { op: OP_JS[op] || op });
        }
        return izq;
      }
      return expr(0);
    }

    function expresion(n) {
      if (!n) return null;
      const h = util(n);
      switch (n.t) {
        case "VariableName": return nodo("Identifier", n.a, n.b, [], { nombre: nombreCat(txt(n)) });
        case "PropertyName": return nodo("Identifier", n.a, n.b, [], { nombre: nombreCat(txt(n)) });
        case "Number": { const v = Number(txt(n).replace(/_/g, "").replace(/[jJ]$/, "")); return nodo("Literal", n.a, n.b, [], { valor: isNaN(v) ? txt(n) : v }); }
        case "String": case "FormatString": {
          if (n.t === "FormatString" || /^[fF]|^[rR][fF]|^[fF][rR]/.test(txt(n))) return nodo("TemplateLiteral", n.a, n.b);
          const m = /^([rRbBuU]*)("""|'''|"|')([\s\S]*)\2$/.exec(txt(n));
          return nodo("Literal", n.a, n.b, [], { valor: m ? m[3] : txt(n) });
        }
        case "ContinuedString": return nodo("Literal", n.a, n.b, [], { valor: txt(n) });
        case "Boolean": return nodo("Literal", n.a, n.b, [], { valor: txt(n) === "True" });
        case "None": return nodo("Literal", n.a, n.b, [], { valor: null });
        case "ParenthesizedExpression": return h.length === 1 ? expresion(h[0]) : nodo("SequenceExpression", n.a, n.b, h.map(x => ["expressions", expresion(x)]));
        case "BinaryExpression": return binaria(n);
        case "UnaryExpression": {
          if (n.h[0].t === "not") return esNotLargo(n) ? binaria(n) : nodo("UnaryExpression", n.a, n.b, [["argument", expresion(n.h[1])]], { op: "!" });
          return nodo("UnaryExpression", n.a, n.b, [["argument", expresion(n.h[1])]], { op: txt(n.h[0]) });
        }
        case "AwaitExpression": return nodo("AwaitExpression", n.a, n.b, [["argument", expresion(h.find(x => x.t !== "await"))]]);
        case "ConditionalExpression": {
          const [si, , test, , no] = h;
          return nodo("ConditionalExpression", n.a, n.b, [["test", expresion(test)], ["consequent", expresion(si)], ["alternate", expresion(no)]]);
        }
        case "MemberExpression": {
          const [obj, ...resto] = n.h;
          if (n.h.some(x => x.t === "[")) {
            const dentro = resto.filter(x => !PUNTUACION.has(x.t));
            return nodo("MemberExpression", n.a, n.b, [["object", expresion(obj)], ["property", dentro.length === 1 ? expresion(dentro[0]) : nodo("PyExpresion", dentro[0] ? dentro[0].a : n.b, dentro.length ? dentro.at(-1).b : n.b)]], { computado: true });
          }
          return nodo("MemberExpression", n.a, n.b, [["object", expresion(obj)], ["property", expresion(resto.find(x => x.t === "PropertyName"))]], { computado: false });
        }
        case "CallExpression": {
          const [callee, args] = [n.h[0], n.h.find(x => x.t === "ArgList")];
          return nodo("CallExpression", n.a, n.b, [["callee", expresion(callee)], ...argumentos(args).map(a => ["arguments", a])]);
        }
        case "ArrayExpression": case "TupleExpression": return nodo("ArrayExpression", n.a, n.b, h.map(x => ["elements", expresion(x)]));
        case "DictionaryExpression": return nodo("ObjectExpression", n.a, n.b);
        case "LambdaExpression": {
          const ps = h.find(x => x.t === "ParamList"), fuera = ambito;
          ambito = new Set();
          const cuerpoL = expresion(h.at(-1)), params = parametros(ps);
          ambito = fuera;
          return nodo("ArrowFunctionExpression", n.a, n.b, [...params.map(p => ["params", p]), ["body", cuerpoL]]);
        }
        default: return nodo("PyExpresion", n.a, n.b, [], { py: n.t });
      }
    }
    function argumentos(lista) {
      if (!lista) return [];
      const h = util(lista), out = [];
      for (let k = 0; k < h.length; k++) {
        const x = h[k];
        if (h[k + 1] && h[k + 1].t === "AssignOp") { out.push(nodo("AssignmentPattern", x.a, h[k + 2].b, [["left", expresion(x)], ["right", expresion(h[k + 2])]])); k += 2; }
        else if (x.t !== "*" && x.t !== "**") out.push(expresion(x));
      }
      return out;
    }

    const programa = nodo("Program", 0, src.length, util(raizL).flatMap(sentencia).map(s => ["body", s]));

    // Tabla en orden de fuente (preorden), como la de acorn.
    const nodos = [];
    (function visitar(x, padre, campo, prof) {
      // Sin los saltos de línea del final (lezer los incluye en los cuerpos).
      const b = x.a + src.slice(x.a, x.b).trimEnd().length;
      const y = { id: nodos.length, tipo: x.tipo, a: x.a, b, linea: lineaDe(x.a), lineaFin: lineaDe(Math.max(x.a, b - 1)), padre, campo, hijos: [], prof, ganchos: "" };
      for (const k of ["nombre", "op", "valor", "clase", "computado", "py", "async", "generador"]) if (x[k] !== undefined) y[k] = x[k];
      nodos.push(y);
      if (padre != null) nodos[padre].hijos.push(y.id);
      for (const [c, h] of x.hijos) visitar(h, y.id, c, prof + 1);
    })(programa, null, null, 0);
    return { lenguaje: "python", fuente: src, nodos, comentarios, eventos: [] };
  }

  return { leer };
});
