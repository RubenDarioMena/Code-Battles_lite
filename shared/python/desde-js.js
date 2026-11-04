/* Conversión JavaScript → Python por árbol (E7). Fuera del componente editor: la usa el juego al pasar
 * una unidad de JS a Python. Recorre el árbol de acorn y escribe Python del subconjunto del juego; si el
 * programa usa algo que no cabe, no inventa: devuelve el motivo y la línea, y el JS se conserva.
 *
 * convertir(src, { nombres: Map js→python, huecos: { re, aPython(nombre) } })
 *   → { ok, texto } | { ok: false, motivo, linea }
 * Los comentarios se conservan como «#»; las líneas de código comentadas se convierten también. */
(() => {
  "use strict";
  const UNIDAD = "    ";
  const PALABRAS_PY = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield print len range str int float bool abs min max round sum enumerate list sorted reversed any all repr info warn error match case".split(" "));
  // Python: lambda 0, if-else 1, or 2, and 3, not 4, comparaciones 5, | 6, ^ 7, & 8, << >> 9, + - 10, * / // % 11, unarios 12, ** 13, await 14, primario 15.
  const BIN = { "||": 2, "&&": 3, "==": 5, "===": 5, "!=": 5, "!==": 5, "<": 5, ">": 5, "<=": 5, ">=": 5, "|": 6, "^": 7, "&": 8, "<<": 9, ">>": 9, "+": 10, "-": 10, "*": 11, "/": 11, "%": 11, "**": 13 };
  const OP_PY = { "||": "or", "&&": "and", "===": "==", "==": "==", "!==": "!=", "!=": "!=" };
  const CONSOLA = { log: "print", info: "info", warn: "warn", error: "error" };
  const METODOS = { push: "append", toUpperCase: "upper", toLowerCase: "lower", trim: "strip", trimStart: "lstrip", trimEnd: "rstrip", startsWith: "startswith", endsWith: "endswith", split: "split", pop: "pop", replaceAll: "replace" };
  const MATH = { abs: "abs", min: "min", max: "max", round: "round" };

  class NoCabe { constructor(nodo, motivo) { this.nodo = nodo; this.motivo = motivo; } }
  const noCabe = (nodo, motivo) => { throw new NoCabe(nodo, motivo); };

  function convertir(src, opciones = {}) {
    const acorn = opciones.acorn || (typeof window !== "undefined" && window.acorn) || (typeof globalThis !== "undefined" && globalThis.acorn);
    if (!acorn) return { ok: false, motivo: "Falta el analizador de JavaScript.", linea: null };
    const nombres = opciones.nombres || new Map();
    const huecos = opciones.huecos || null;
    // Los huecos /* lugar */ pasan a identificadores __lugar__ (D4) antes de analizar.
    let texto = String(src).replace(/\r\n?/g, "\n");
    if (huecos) texto = texto.replace(new RegExp(huecos.re.source, "g"), h => huecos.aPython(h.replace(/^\/\*\s*|\s*\*\/$/g, "")));
    const comentarios = [];
    let ast;
    try { ast = acorn.parse(texto, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, locations: true, onComment: comentarios }); }
    catch (e) { return { ok: false, motivo: `El JavaScript tiene un error de sintaxis (${e.message.replace(/\s*\(\d+:\d+\)$/, "")}): corrígelo antes de pasar a Python.`, linea: e.loc ? e.loc.line : null }; }
    const salida = [];
    let pendientes = comentarios.slice(), ultimaLinea = 0;
    const definidas = new Set();
    try {
      bloque(ast.body, 0, { funcion: false, async: true, bucle: false, fin: texto.length, raiz: true });
      return { ok: true, texto: salida.join("\n").replace(/\n{3,}/g, "\n\n") + "\n" };
    } catch (e) {
      if (!(e instanceof NoCabe)) throw e;
      return { ok: false, motivo: e.motivo, linea: e.nodo && e.nodo.loc ? e.nodo.loc.start.line : null };
    }

    function linea(t, nivel) { salida.push(UNIDAD.repeat(nivel) + t); }
    function hueco(desde, hasta) { if (ultimaLinea && desde - ultimaLinea > 1 && salida.length && salida[salida.length - 1].trim()) salida.push(""); }
    // Comentarios antes de la posición dada: líneas de código comentadas se convierten; el resto, tal cual.
    function comentariosHasta(pos, nivel) {
      const grupo = [];
      const vaciar = () => {
        if (!grupo.length) return;
        const cuerpo = grupo.map(c => c.value.replace(/^ ?/, "")).join("\n");
        const r = grupo.every(c => c.type === "Line") && /[;(){}=]/.test(cuerpo) ? convertir(cuerpo, { ...opciones, comentarios: false }) : null;
        hueco(grupo[0].loc.start.line);
        if (r && r.ok) for (const l of r.texto.replace(/\n$/, "").split("\n")) linea(l ? "# " + l : "#", nivel);
        else for (const c of grupo) for (const l of (c.type === "Block" ? c.value.split("\n").map(x => x.replace(/^\s*\* ?|^ /, "").replace(/^\*$/, "")) : [c.value.replace(/^ ?/, "")]))
          linea(l.trim() ? "# " + l.replace(/\s+$/, "") : "#", nivel);
        ultimaLinea = grupo[grupo.length - 1].loc.end.line;
        grupo.length = 0;
      };
      while (pendientes.length && pendientes[0].end <= pos) {
        const c = pendientes.shift();
        const previo = grupo[grupo.length - 1];
        if (previo && (c.type !== "Line" || previo.type !== "Line" || c.loc.start.line !== previo.loc.end.line + 1)) vaciar();
        grupo.push(c);
      }
      vaciar();
    }
    function finDeLinea(n) {
      // Comentario al final de la misma línea de una sentencia simple.
      const c = pendientes[0];
      if (c && c.loc.start.line === n.loc.end.line && c.start >= n.end && c.type === "Line") { pendientes.shift(); return "  # " + c.value.trim(); }
      return "";
    }
    function bloque(stmts, nivel, ctx) {
      const antes = salida.length;
      for (const s of stmts) {
        comentariosHasta(s.start, nivel);
        hueco(s.loc.start.line);
        sentencia(s, nivel, ctx);
        ultimaLinea = s.loc.end.line;
      }
      comentariosHasta(ctx.fin, nivel);
      if (!ctx.raiz && (salida.length === antes || salida.slice(antes).every(l => !l.trim() || /^\s*#/.test(l)))) linea("pass", nivel);
    }
    function cuerpo(n, nivel, ctx) {
      if (n.type === "BlockStatement") bloque(n.body, nivel, { ...ctx, fin: n.end, raiz: false });
      else bloque([n], nivel, { ...ctx, fin: n.end, raiz: false });
    }
    function asignado(nodo, nombre) {
      let si = false;
      const rec = x => {
        if (!x || typeof x !== "object" || si) return;
        if ((x.type === "AssignmentExpression" && x.left.type === "Identifier" && x.left.name === nombre) || (x.type === "UpdateExpression" && x.argument.type === "Identifier" && x.argument.name === nombre)) si = true;
        for (const v of Object.values(x)) if (Array.isArray(v)) v.forEach(rec); else if (v && typeof v === "object" && v.type) rec(v);
      };
      rec(nodo);
      return si;
    }
    function contiene(nodo, tipo, parar = /^(For|While|DoWhile|ForOf|ForIn)Statement$|Function/) {
      let si = false;
      const rec = (x, raiz) => {
        if (!x || typeof x !== "object" || si) return;
        if (x.type === tipo) { si = true; return; }
        if (!raiz && parar.test(x.type || "")) return;
        for (const v of Object.values(x)) if (Array.isArray(v)) v.forEach(h => rec(h, false)); else if (v && typeof v === "object" && v.type) rec(v, false);
      };
      rec(nodo, true);
      return si;
    }
    function sentencia(s, nivel, ctx) {
      switch (s.type) {
        case "EmptyStatement": return;
        case "VariableDeclaration":
          for (const d of s.declarations) {
            if (d.id.type !== "Identifier") noCabe(d, "La desestructuración (const { a } = …) aún no tiene equivalente en el Python del juego.");
            linea(`${nombre(d.id.name)} = ${d.init ? expr(d.init, 0) : "None"}` + finDeLinea(s), nivel);
          }
          return;
        case "ExpressionStatement": linea(sentenciaExpr(s.expression) + finDeLinea(s), nivel); return;
        case "IfStatement": {
          let n = s, primero = true;
          while (n) {
            linea(`${primero ? "if" : "elif"} ${expr(n.test, 0)}:`, nivel);
            cuerpo(n.consequent, nivel + 1, ctx);
            primero = false;
            const alt = n.alternate;
            if (alt && alt.type === "IfStatement") { comentariosHasta(alt.start, nivel); n = alt; continue; }
            if (alt) { comentariosHasta(alt.start, nivel); linea("else:", nivel); cuerpo(alt, nivel + 1, ctx); }
            n = null;
          }
          return;
        }
        case "WhileStatement":
          linea(`while ${s.test.type === "Literal" && s.test.value === true ? "True" : expr(s.test, 0)}:`, nivel);
          cuerpo(s.body, nivel + 1, { ...ctx, bucle: true });
          return;
        case "DoWhileStatement":
          if (contiene(s.body, "ContinueStatement")) noCabe(s, "do … while con continue no tiene equivalente directo en Python.");
          linea("while True:", nivel);
          cuerpo(s.body, nivel + 1, { ...ctx, bucle: true });
          linea(`if not ${expr(s.test, 12)}:`, nivel + 1); linea("break", nivel + 2);
          return;
        case "ForStatement": return para(s, nivel, ctx);
        case "ForOfStatement": {
          const izq = s.left.type === "VariableDeclaration" ? s.left.declarations[0].id : s.left;
          if (izq.type !== "Identifier") noCabe(s, "for … of con desestructuración aún no tiene equivalente en el Python del juego.");
          if (s.await) noCabe(s, "for await no tiene equivalente en el Python del juego.");
          linea(`for ${nombre(izq.name)} in ${expr(s.right, 0)}:`, nivel);
          cuerpo(s.body, nivel + 1, { ...ctx, bucle: true });
          return;
        }
        case "BreakStatement": case "ContinueStatement":
          if (s.label) noCabe(s, "break y continue con etiqueta no existen en Python.");
          linea((s.type === "BreakStatement" ? "break" : "continue") + finDeLinea(s), nivel); return;
        case "ReturnStatement":
          if (!ctx.funcion) noCabe(s, "En Python, return solo va dentro de una función (def). Para terminar el programa, deja que acabe el código.");
          linea((s.argument ? `return ${expr(s.argument, 0)}` : "return") + finDeLinea(s), nivel); return;
        case "FunctionDeclaration": {
          if (s.generator) noCabe(s, "Los generadores (function*) no están en el Python del juego.");
          const params = s.params.map(p => {
            if (p.type === "Identifier") return nombre(p.name);
            if (p.type === "AssignmentPattern" && p.left.type === "Identifier") return `${nombre(p.left.name)}=${expr(p.right, 0)}`;
            if (p.type === "RestElement" && p.argument.type === "Identifier") return "*" + nombre(p.argument.name);
            noCabe(p, "Este tipo de parámetro aún no tiene equivalente en el Python del juego.");
          });
          definidas.add(s.id.name);
          linea(`${s.async ? "async " : ""}def ${nombre(s.id.name)}(${params.join(", ")}):`, nivel);
          bloque(s.body.body, nivel + 1, { funcion: true, async: s.async, bucle: false, fin: s.body.end });
          return;
        }
        case "BlockStatement": bloque(s.body, nivel, { ...ctx, fin: s.end }); return;
        case "SwitchStatement": noCabe(s, "switch no está en el Python del juego: usa if / elif / else.");
        case "TryStatement": noCabe(s, "try / catch aún no está en el Python del juego.");
        case "ThrowStatement": noCabe(s, "throw aún no está en el Python del juego.");
        case "ClassDeclaration": noCabe(s, "Las clases no están en el Python del juego.");
        case "ForInStatement": noCabe(s, "for … in de JavaScript recorre claves de objetos, que aún no están en el Python del juego.");
        case "LabeledStatement": noCabe(s, "Las etiquetas no existen en Python.");
        default: noCabe(s, `${s.type} no tiene equivalente en el Python del juego.`);
      }
    }
    // for (let i = a; i < b; i++) → for i in range(a, b). Si no tiene esa forma, while con la actualización al final.
    function para(s, nivel, ctx) {
      const ini = s.init, t = s.test, u = s.update;
      const decl = ini && ini.type === "VariableDeclaration" && ini.declarations.length === 1 && ini.declarations[0].id.type === "Identifier" ? ini.declarations[0] : null;
      const v = decl ? decl.id.name : ini && ini.type === "AssignmentExpression" && ini.operator === "=" && ini.left.type === "Identifier" ? ini.left.name : null;
      let paso = null;
      if (v && u) {
        if (u.type === "UpdateExpression" && u.argument.type === "Identifier" && u.argument.name === v) paso = u.operator === "++" ? 1 : -1;
        else if (u.type === "AssignmentExpression" && u.left.type === "Identifier" && u.left.name === v && (u.operator === "+=" || u.operator === "-=") && u.right.type === "Literal" && typeof u.right.value === "number" && Number.isInteger(u.right.value) && u.right.value !== 0)
          paso = u.operator === "+=" ? u.right.value : -u.right.value;
      }
      const fijo = n => n.type === "Literal" ? typeof n.value === "number" : n.type === "Identifier" ? !asignado(s.body, n.name) : n.type === "UnaryExpression" && n.operator === "-" && fijo(n.argument);
      if (paso && t && t.type === "BinaryExpression" && t.left.type === "Identifier" && t.left.name === v && !asignado(s.body, v) && fijo(t.right) && (paso > 0 ? /^<=?$/.test(t.operator) : /^>=?$/.test(t.operator))) {
        const a = decl ? decl.init : ini.right;
        let b = expr(t.right, 10);
        if (t.operator === "<=") b = t.right.type === "Literal" ? String(t.right.value + 1) : `${b} + 1`;
        if (t.operator === ">=") b = t.right.type === "Literal" ? String(t.right.value - 1) : `${b} - 1`;
        const desde = a ? expr(a, 0) : "0";
        const args = paso === 1 && desde === "0" ? [b] : paso === 1 ? [desde, b] : [desde, b, String(paso)];
        linea(`for ${nombre(v)} in range(${args.join(", ")}):`, nivel);
        cuerpo(s.body, nivel + 1, { ...ctx, bucle: true });
        return;
      }
      if (contiene(s.body, "ContinueStatement")) noCabe(s, "Este for con continue no tiene una forma directa en Python: escríbelo como for i in range(…) o como while.");
      if (ini) { if (ini.type === "VariableDeclaration") sentencia(ini, nivel, ctx); else linea(sentenciaExpr(ini), nivel); }
      linea(`while ${t ? expr(t, 0) : "True"}:`, nivel);
      cuerpo(s.body, nivel + 1, { ...ctx, bucle: true });
      if (u) linea(sentenciaExpr(u), nivel + 1);
    }
    function sentenciaExpr(e) {
      if (e.type === "AssignmentExpression") {
        if (/^(\?\?|\|\||&&)=$/.test(e.operator) || e.operator === ">>>=") noCabe(e, `El operador ${e.operator} no está en Python.`);
        const objetivos = [];
        let x = e;
        while (x.type === "AssignmentExpression" && x.operator === "=") { objetivos.push(destino(x.left)); x = x.right; }
        if (objetivos.length) {
          if (x.type === "AssignmentExpression") noCabe(x, "Una asignación dentro de otra no tiene equivalente en Python.");
          return `${objetivos.join(" = ")} = ${expr(x, 0)}`;
        }
        return `${destino(e.left)} ${e.operator} ${expr(e.right, 0)}`;
      }
      if (e.type === "UpdateExpression") return `${destino(e.argument)} ${e.operator === "++" ? "+=" : "-="} 1`;
      if (e.type === "SequenceExpression") noCabe(e, "Las expresiones con coma (a, b) no tienen equivalente en Python.");
      return expr(e, 0);
    }
    function destino(n) {
      if (n.type === "Identifier") return nombre(n.name);
      if (n.type === "MemberExpression" && !n.optional) {
        if (!n.computed && n.property.name === "length") noCabe(n, "En Python no se cambia len() de una lista asignando.");
        return expr(n, 15);
      }
      noCabe(n, "Esta asignación aún no tiene equivalente en el Python del juego.");
    }
    function nombre(n) {
      if (nombres.has(n)) return nombres.get(n);
      return PALABRAS_PY.has(n) ? n + "_" : n;
    }
    function cadena(v, comilla = '"') {
      const j = JSON.stringify(v);
      if (comilla === '"') return j;
      return "'" + j.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'") + "'";
    }
    function paren(t, p, min) { return min < p ? `(${t})` : t; }
    function esTexto(n) { return (n.type === "Literal" && typeof n.value === "string") || n.type === "TemplateLiteral"; }
    function fstring(partes) {
      // partes: [{ texto } | { nodo }] → f"…" (o "…" si no hay expresiones).
      if (partes.every(p => p.texto != null)) return cadena(partes.map(p => p.texto).join(""));
      let out = "";
      for (const p of partes) {
        if (p.texto != null) out += JSON.stringify(p.texto).slice(1, -1).replace(/\{/g, "{{").replace(/\}/g, "}}");
        else {
          const e = expr(p.nodo, 0, "'");
          if (/["\\]/.test(e) || /[{}]/.test(e.replace(/'[^']*'/g, ""))) noCabe(p.nodo, "Esta expresión no cabe dentro de una f-string de Python: guárdala antes en una variable.");
          out += "{" + e + "}";
        }
      }
      return `f"${out}"`;
    }
    function sumaTextos(n) {
      const xs = [];
      const suma = x => x.type === "BinaryExpression" && x.operator === "+";
      const empiezaTexto = x => esTexto(x) || (suma(x) && empiezaTexto(x.left));
      // El lado izquierdo sigue el orden de evaluación de JS. El derecho es una expresión
      // completa: «"x=" + (1 + 2)» suma antes de concatenar. Solo se puede aplanar si ya es texto.
      const aplanar = x => {
        if (!suma(x)) { xs.push(x); return; }
        aplanar(x.left);
        if (empiezaTexto(x.right)) aplanar(x.right); else xs.push(x.right);
      };
      aplanar(n);
      if (!xs.some(esTexto)) return null;
      if (!esTexto(xs[0])) noCabe(n, "Esta suma mezcla números y textos con +. En Python escríbela como f\"…{x}…\" o con str(x).");
      const partes = [];
      for (const x of xs) {
        if (x.type === "Literal") partes.push({ texto: String(x.value) });
        else if (x.type === "TemplateLiteral") x.quasis.forEach((q, i) => { partes.push({ texto: q.value.cooked }); if (x.expressions[i]) partes.push({ nodo: x.expressions[i] }); });
        else partes.push({ nodo: x });
      }
      return fstring(partes);
    }
    function argumentos(args) {
      return args.map(a => a.type === "SpreadElement" ? "*" + expr(a.argument, 15) : expr(a, 0)).join(", ");
    }
    function expr(n, p, comilla = '"') {
      switch (n.type) {
        case "Literal":
          if (n.regex) noCabe(n, "Las expresiones regulares no están en el Python del juego.");
          if (n.bigint) noCabe(n, "Los BigInt no están en el Python del juego.");
          if (n.value === null) return "None";
          if (typeof n.value === "boolean") return n.value ? "True" : "False";
          if (typeof n.value === "string") return cadena(n.value, comilla);
          return n.raw.replace(/^0([0-7]+)$/, "0o$1");
        case "Identifier":
          if (n.name === "undefined") return "None";
          if (n.name === "NaN" || n.name === "Infinity") noCabe(n, `${n.name} no tiene nombre propio en el Python del juego.`);
          return nombre(n.name);
        case "TemplateLiteral": return fstring(n.quasis.flatMap((q, i) => [{ texto: q.value.cooked }, ...(n.expressions[i] ? [{ nodo: n.expressions[i] }] : [])]));
        case "ArrayExpression": return "[" + n.elements.map(e => e == null ? noCabe(n, "Las listas con huecos ([1, , 2]) no existen en Python.") : e.type === "SpreadElement" ? "*" + expr(e.argument, 15) : expr(e, 0, comilla)).join(", ") + "]";
        case "ObjectExpression": noCabe(n, "Los objetos { … } (diccionarios) aún no están en el Python del juego.");
        case "ArrowFunctionExpression": case "FunctionExpression": noCabe(n, "Las funciones anónimas aún no tienen equivalente en el Python del juego: usa def.");
        case "AwaitExpression": return paren("await " + expr(n.argument, 15, comilla), p, 14);
        case "UnaryExpression": {
          if (n.operator === "!") return paren("not " + expr(n.argument, 4, comilla), p, 4);
          if (n.operator === "-" || n.operator === "+" || n.operator === "~") return paren(n.operator + expr(n.argument, 12, comilla), p, 12);
          noCabe(n, `${n.operator} no tiene equivalente en el Python del juego.`);
        }
        case "LogicalExpression": {
          if (n.operator === "??") {
            // Las lecturas que devuelven un lugar o null (autoTarget, detect): «or» es lo mismo que «??».
            const fn = n.left.type === "CallExpression" && (n.left.callee.type === "Identifier" ? n.left.callee.name : n.left.callee.type === "MemberExpression" && !n.left.callee.computed ? n.left.callee.property.name : null);
            if (fn && (opciones.objetoONulo || []).includes(fn)) return paren(`${expr(n.left, 3, comilla)} or ${expr(n.right, 3, comilla)}`, p, 2);
            if (!/^(Identifier|MemberExpression)$/.test(n.left.type) || contiene(n.left, "CallExpression", /^$/)) noCabe(n, "?? solo se convierte con un nombre a la izquierda: en Python es «a if a is not None else b».");
            const a = expr(n.left, 15, comilla);
            return paren(`${a} if ${a} is not None else ${expr(n.right, 1, comilla)}`, p, 1);
          }
          const q = BIN[n.operator];
          return paren(`${expr(n.left, q, comilla)} ${OP_PY[n.operator]} ${expr(n.right, q + 1, comilla)}`, p, q);
        }
        case "BinaryExpression": {
          if (n.operator === "+") { const f = sumaTextos(n); if (f) return f; }
          if (n.operator === "in" || n.operator === "instanceof" || n.operator === ">>>") noCabe(n, `${n.operator} no tiene equivalente directo en el Python del juego.`);
          const q = BIN[n.operator], op = OP_PY[n.operator] || n.operator;
          if (q === 5 && (n.left.type === "BinaryExpression" && BIN[n.left.operator] === 5)) noCabe(n, "Una comparación encadenada significa otra cosa en Python: sepárala con and.");
          if (n.operator === "**") return paren(`${expr(n.left, 14, comilla)} ** ${expr(n.right, 12, comilla)}`, p, 13);
          return paren(`${expr(n.left, q, comilla)} ${op} ${expr(n.right, q === 5 ? 6 : q + 1, comilla)}`, p, q);
        }
        case "ConditionalExpression": return paren(`${expr(n.consequent, 2, comilla)} if ${expr(n.test, 2, comilla)} else ${expr(n.alternate, 1, comilla)}`, p, 1);
        case "CallExpression": return llamada(n, comilla);
        case "MemberExpression": {
          if (n.optional) noCabe(n, "?. no tiene equivalente en el Python del juego.");
          if (n.computed) return `${expr(n.object, 15, comilla)}[${expr(n.property, 0, comilla)}]`;
          if (n.property.name === "length") return `len(${expr(n.object, 0, comilla)})`;
          return `${expr(n.object, 15, comilla)}.${nombre(n.property.name)}`;
        }
        case "ChainExpression": noCabe(n, "?. no tiene equivalente en el Python del juego.");
        case "NewExpression": noCabe(n, "new no tiene equivalente en el Python del juego.");
        case "AssignmentExpression": case "UpdateExpression": noCabe(n, "En Python una asignación va en su propia línea, no dentro de otra expresión.");
        case "SequenceExpression": noCabe(n, "Las expresiones con coma (a, b) no tienen equivalente en Python.");
        case "ThisExpression": noCabe(n, "this no está en el Python del juego.");
        default: noCabe(n, `${n.type} no tiene equivalente en el Python del juego.`);
      }
    }
    function llamada(n, comilla) {
      const c = n.callee;
      if (n.optional) noCabe(n, "?.() no tiene equivalente en el Python del juego.");
      if (c.type === "MemberExpression" && !c.computed) {
        const obj = c.object, m = c.property.name;
        if (obj.type === "Identifier" && obj.name === "console" && CONSOLA[m]) return `${CONSOLA[m]}(${argumentos(n.arguments)})`;
        if (obj.type === "Identifier" && obj.name === "Math") {
          if (MATH[m]) return `${MATH[m]}(${argumentos(n.arguments)})`;
          if (m === "floor" && n.arguments.length === 1) { const a = n.arguments[0]; return a.type === "BinaryExpression" && a.operator === "/" ? paren(`${expr(a.left, 11, comilla)} // ${expr(a.right, 12, comilla)}`, 15, 11) : `int(${expr(a, 0, comilla)} // 1)`; }
          if (m === "sqrt" && n.arguments.length === 1) return `(${expr(n.arguments[0], 14, comilla)} ** 0.5)`;
          noCabe(n, `Math.${m} no tiene equivalente en el Python del juego.`);
        }
        if (m === "push" && n.arguments.length !== 1) noCabe(n, "push con varios valores: en Python, un append por valor.");
        if (m === "includes" && n.arguments.length === 1) return paren(`${expr(n.arguments[0], 6, comilla)} in ${expr(obj, 6, comilla)}`, 15, 5);
        if (m === "join") return `${n.arguments.length ? expr(n.arguments[0], 15, comilla) : cadena(",", comilla)}.join(${expr(obj, 0, comilla)})`;
        if (m === "slice" && n.arguments.length <= 2) return `${expr(obj, 15, comilla)}[${n.arguments[0] ? expr(n.arguments[0], 0, comilla) : ""}:${n.arguments[1] ? expr(n.arguments[1], 0, comilla) : ""}]`;
        if (m === "toFixed" && n.arguments.length === 1 && n.arguments[0].type === "Literal") return fstringFormato(obj, `.${n.arguments[0].value}f`, comilla);
        if (/^(indexOf|splice|shift|unshift|map|filter|forEach|reduce|find|some|every|concat|substring|substr|charAt|padStart|padEnd|repeat|toString)$/.test(m))
          noCabe(n, `.${m}() aún no tiene equivalente en el Python del juego.`);
        const nm = nombres.has(m) ? nombres.get(m) : METODOS[m] || nombre(m);
        return `${expr(obj, 15, comilla)}.${nm}(${argumentos(n.arguments)})`;
      }
      if (c.type === "Identifier") {
        const f = { String: "str", Number: "float", parseInt: "int", parseFloat: "float", Boolean: "bool" }[c.name];
        if (f) return `${f}(${argumentos(n.arguments)})`;
        if (/^(setTimeout|setInterval|alert|prompt|require|fetch|eval)$/.test(c.name)) noCabe(n, `${c.name} no está en el juego.`);
        return `${nombre(c.name)}(${argumentos(n.arguments)})`;
      }
      return `${expr(c, 15, comilla)}(${argumentos(n.arguments)})`;
    }
    function fstringFormato(obj, spec, comilla) {
      const e = expr(obj, 0, "'");
      if (/["\\{}]/.test(e)) noCabe(obj, "Esta expresión no cabe dentro de una f-string de Python: guárdala antes en una variable.");
      return comilla === '"' ? `f"{${e}:${spec}}"` : `f'{${e}:${spec}}'`;
    }
  }
  const api = { convertir };
  if (typeof window !== "undefined") window.CMGJSaPython = api;
  if (typeof module !== "undefined") module.exports = api;
})();
