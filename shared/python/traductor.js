/* Traductor Python → JavaScript (E5). Fuera del componente editor: lo usa el juego al pulsar Ejecutar.
 *
 * Toma el mismo árbol de lezer que el editor y genera JS con las MISMAS líneas: cada sentencia va en
 * su línea, las llaves de cierre al final de la última línea del cuerpo y los auxiliares viven en el
 * preludio del Worker (__py). Así __L(linea), la línea en ejecución y los errores no cambian.
 *
 * lezer no respeta toda la precedencia de Python («not a and b», «await f() + 1»): las expresiones
 * con operadores se aplanan y se vuelven a asociar aquí con la tabla de Python.
 *
 * traducir(texto, opciones) → { ok, js, diagnosticos: [{ linea, columna, mensaje }] }
 * opciones: { funciones: [{ objeto, nombre, destino, await }], objetos: [...], propiedades: [...], hueco(nombre) }
 * El texto original es la fuente de verdad; el JS es un resultado derivado y desechable. */
(() => {
  "use strict";
  const RESERVADAS_JS = new Set(("await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield arguments eval undefined NaN Infinity globalThis self console __L __py Object Array String Number Boolean Math JSON Promise Error Symbol Proxy Reflect Function postMessage onmessage close location navigator setTimeout").split(" "));
  const BUILTINS = new Set(["print", "len", "range", "str", "int", "float", "bool", "abs", "min", "max", "round", "sum", "enumerate", "list", "sorted", "reversed", "any", "all", "repr"]);
  // D3: print → registro; warn/info/error, a sus niveles de la consola del juego.
  const CONSOLA = { print: "log", info: "info", warn: "warn", error: "error" };
  const DUNDER = /^__(name|main|init|file|doc|class|dict|module)__$/;
  const PUNTUACION = new Set(["(", ")", "[", "]", "{", "}", ",", ":", ".", ";", "Comment"]);
  const NO_SOPORTADO = {
    DictionaryExpression: "Los diccionarios", DictionaryComprehensionExpression: "Los diccionarios", SetExpression: "Los conjuntos",
    SetComprehensionExpression: "Los conjuntos", ComprehensionExpression: "Los generadores", YieldExpression: "yield", NamedExpression: "El operador :=",
    Ellipsis: "«...»", ClassDefinition: "Las clases", ImportStatement: "import", ImportFromStatement: "import", TryStatement: "try",
    WithStatement: "with", RaiseStatement: "raise", AssertStatement: "assert", DecoratedStatement: "Los decoradores", MatchStatement: "match",
    PrintStatement: "print sin paréntesis", TypeDef: "Las anotaciones de tipo", ConditionalStatement: null,
  };
  const ARITMETICA = new Set(["+", "-", "*", "/", "//", "%", "**", "&", "|", "^", "<<", ">>", "@"]);
  const COMPARA = new Set(["<", ">", "<=", ">=", "==", "!=", "in", "not in", "is", "is not"]);
  // Precedencia de Python (de menos a más): if-else 1, or 2, and 3, not 4, comparaciones 5, | 6, ^ 7, & 8,
  // << >> 9, + - 10, * / // % @ 11, unarios 12, ** 13, await 14.
  const LBP = { if: 1, or: 2, and: 3, "|": 6, "^": 7, "&": 8, "<<": 9, ">>": 9, "+": 10, "-": 10, "*": 11, "/": 11, "//": 11, "%": 11, "@": 11, "**": 13 };
  for (const c of COMPARA) LBP[c] = 5;

  class Diagnostico { constructor(pos, mensaje) { this.pos = pos; this.mensaje = mensaje; } }
  const falla = (pos, mensaje) => { throw new Diagnostico(pos, mensaje); };

  function plano(arbol) {
    const c = arbol.cursor();
    const rec = () => {
      const n = { t: c.name, a: c.from, b: c.to, e: c.type.isError, h: [] };
      if (c.firstChild()) { do n.h.push(rec()); while (c.nextSibling()); c.parent(); }
      return n;
    };
    return rec();
  }
  const util = n => n.h.filter(h => !PUNTUACION.has(h.t));

  class Ambito {
    constructor(tipo, padre, esAsync) {
      this.tipo = tipo; this.padre = padre; this.esAsync = esAsync;
      this.locales = new Set(); this.globales = new Set(); this.nolocales = new Set();
      this.funciones = new Map(); this.otros = new Set(); this.temps = 0; this.marca = null;
    }
    get modulo() { let a = this; while (a.padre) a = a.padre; return a; }
    get funcion() { let a = this; while (a.tipo === "comprension") a = a.padre; return a; }
  }

  function traducir(texto, opciones = {}) {
    const src = String(texto).replace(/\r\n?/g, "\n");
    const L = (typeof window !== "undefined" && window.LezerPython) || (typeof LezerPython !== "undefined" ? LezerPython : null);
    if (!L) return { ok: false, js: "", diagnosticos: [{ linea: null, columna: null, mensaje: "Python no está disponible: falta el analizador." }] };
    const inicios = [0];
    for (let i = 0; i < src.length; i++) if (src[i] === "\n") inicios.push(i + 1);
    const lineaDe = pos => { let lo = 0, hi = inicios.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (inicios[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };
    const txt = n => src.slice(n.a, n.b);
    const nombreHueco = opciones.hueco || ((typeof window !== "undefined" && window.CMGEditorPython && window.CMGEditorPython.nombreDe) || (t => /^__[a-z][a-z0-9_]*__$/.test(t) && !DUNDER.test(t) ? t.slice(2, -2).replace(/_/g, " ") : null));
    const funciones = new Map(), miembros = new Map();
    for (const f of opciones.funciones || []) {
      const e = { destino: f.destino, await: !!f.await };
      if (!f.objeto) funciones.set(f.nombre, e);
      if (f.objeto !== "console") miembros.set(f.nombre, e);
    }
    const objetos = new Set(opciones.objetos || []);
    const propiedades = new Map();
    for (const p of opciones.propiedades || []) { propiedades.set(p, p); propiedades.set(p.replace(/[A-Z]/g, m => "_" + m.toLowerCase()), p); }
    const reservadas = new Set([...RESERVADAS_JS, ...funciones.keys(), ...miembros.keys(), ...objetos, ...propiedades.keys(), ...propiedades.values(), "log", "yo"]);
    const jsNombre = n => reservadas.has(n) ? "$" + n : n;

    let raiz;
    try { raiz = plano(L.parser.parse(src)); }
    catch (e) { return { ok: false, js: "", diagnosticos: [{ linea: null, columna: null, mensaje: "No se pudo analizar el programa: " + e.message }] }; }

    const salida = Array.from({ length: inicios.length }, () => "");
    const emitir = (pos, t) => { const i = lineaDe(pos) - 1; salida[i] += (salida[i] && !/[\s{(]$/.test(salida[i]) ? " " : "") + t; };
    const finDe = n => { let b = n.b; while (b > n.a && /\s/.test(src[b - 1])) b--; return Math.max(n.a, b - 1); };
    const ambitos = new Map();
    const marcas = [];

    try {
      revisarSintaxis(raiz);
      const modulo = new Ambito("modulo", null, true);
      recolectar(util(raiz), modulo);
      modulo.marca = marcas.push(modulo) - 1;
      bloque(util(raiz), modulo, { bucles: 0 });
      let js = salida.join("\n");
      js = js.replace(/\u0001(\d+)\u0001/g, (_, i) => declaraciones(marcas[+i]));
      const decl = declaraciones(modulo);
      js = decl + js;
      return { ok: true, js, diagnosticos: [] };
    } catch (e) {
      if (!(e instanceof Diagnostico)) throw e;
      const linea = e.pos == null ? null : lineaDe(e.pos);
      return { ok: false, js: "", diagnosticos: [{ linea, columna: e.pos == null ? null : e.pos - inicios[linea - 1] + 1, mensaje: e.mensaje }] };
    }

    function declaraciones(amb) {
      const nombres = [...amb.locales].filter(n => !amb.params || !amb.params.has(n)).map(jsNombre);
      for (let i = 1; i <= amb.temps; i++) nombres.push("__t" + i);
      return nombres.length ? `let ${nombres.join(", ")}; ` : "";
    }

    // ---------- Sintaxis: errores de lezer, sangría y huecos ----------
    function revisarSintaxis(raiz) {
      const lineaTxt = p => src.slice(inicios[lineaDe(p) - 1], (inicios[lineaDe(p)] ?? src.length + 1) - 1);
      const sangria = p => { const t = lineaTxt(p); return t.length - t.trimStart().length; };
      const empiezaLinea = n => !src.slice(inicios[lineaDe(n.a) - 1], n.a).trim();
      const CABECERA = { IfStatement: "if", WhileStatement: "while", ForStatement: "for", FunctionDefinition: "def" };
      let primero = null;
      const buscar = (n, pila) => {
        if (primero) return;
        if (n.e) { primero = { n, pila: [...pila] }; return; }
        pila.push(n); for (const h of n.h) buscar(h, pila); pila.pop();
      };
      buscar(raiz, []);
      const despues = (kw, linea) => `${kw === "def" ? "function definition" : `'${kw}' statement`} on line ${linea}`;
      // Sangría: todas las sentencias de un bloque al mismo nivel, y los cuerpos más adentro que su cabecera.
      const revisarBloque = (stmts, nivelPadre, cabecera) => {
        let nivel = null, previa = null;
        for (const s of stmts) {
          if (!empiezaLinea(s)) continue;
          const n = sangria(s.a);
          if (nivel == null) {
            nivel = n;
            if (cabecera == null && n > 0) falla(s.a, "IndentationError: unexpected indent (sobra sangría al principio de la línea)");
            if (cabecera != null && n <= nivelPadre) falla(s.a, `IndentationError: expected an indented block after ${despues(cabecera.kw, lineaDe(cabecera.a))} (el cuerpo va con más sangría)`);
          } else if (n !== nivel) falla(s.a, n > nivel && !(previa && previa.h.some(h => h.t === "Body")) ? "IndentationError: unexpected indent (esta línea tiene más sangría que la anterior)"
            : "IndentationError: unindent does not match any outer indentation level (la sangría no coincide con ningún bloque)");
          revisarHijos(s, n);
          previa = s;
        }
      };
      const revisarHijos = (s, nivel) => {
        let kw = CABECERA[s.t], a = s.a;
        for (const h of s.h) {
          if (h.t === "elif" || h.t === "else") { kw = h.t; a = h.a; }
          if (h.t === "Body") revisarBloque(util(h).filter(b => !b.e), nivel, { kw, a });
        }
      };
      if (primero) {
        const { n, pila } = primero, padre = pila[pila.length - 1], abuelo = pila[pila.length - 2];
        if (padre && padre.t === "Body" && abuelo && CABECERA[abuelo.t] && !util(padre).some(h => !h.e)) {
          let kw = CABECERA[abuelo.t], a = abuelo.a;
          for (const h of abuelo.h) { if (h === padre) break; if (h.t === "elif" || h.t === "else") { kw = h.t; a = h.a; } }
          falla(n.a, `IndentationError: expected an indented block after ${despues(kw, lineaDe(a))} (falta el cuerpo con sangría)`);
        }
        if (padre && CABECERA[padre.t] && !padre.h.some(h => h.t === "Body" && h.a < n.a)) falla(n.a, "SyntaxError: expected ':' (falta «:» al final de la línea)");
        const abiertos = cuentaAbiertos(src.slice(0, n.b + 1));
        if (abiertos && abiertos.cadena) falla(abiertos.pos, `SyntaxError: unterminated string literal (detected at line ${lineaDe(abiertos.pos)}) (faltan las comillas de cierre)`);
        if (abiertos) falla(abiertos.pos, `SyntaxError: '${abiertos.c}' was never closed (falta cerrar «${abiertos.c}»)`);
        if (/^\s*(if|elif|while|for|def|else)\b[^:#]*$/.test(lineaTxt(n.a))) falla(n.a, "SyntaxError: expected ':' (falta «:» al final de la línea)");
        falla(n.a, "SyntaxError: invalid syntax (revisa esta línea)");
      }
      revisarBloque(util(raiz), -1, null);
      // Huecos sin rellenar (D4).
      const huecos = n => {
        if ((n.t === "VariableName" || n.t === "PropertyName") && nombreHueco(txt(n))) falla(n.a, `Rellena el hueco ${txt(n)} antes de ejecutar. Doble clic en un valor del inspector lo pone en su lugar.`);
        n.h.forEach(huecos);
      };
      huecos(raiz);
    }
    function cuentaAbiertos(t) {
      const pila = [];
      let q = null, inicioQ = 0;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (q) { if (c === "\\") i++; else if (t.startsWith(q, i)) { i += q.length - 1; q = null; } else if (c === "\n" && q.length === 1) return { cadena: true, pos: inicioQ }; continue; }
        if (c === "#") { while (i < t.length && t[i] !== "\n") i++; continue; }
        if (c === '"' || c === "'") { q = t.startsWith(c.repeat(3), i) ? c.repeat(3) : c; inicioQ = i; i += q.length - 1; continue; }
        if ("([{".includes(c)) pila.push({ c, pos: i });
        else if (")]}".includes(c)) pila.pop();
      }
      if (q && q.length === 1) return { cadena: true, pos: inicioQ };
      return pila.length ? pila[pila.length - 1] : null;
    }

    // ---------- Ámbitos (antes de generar): qué nombres asigna cada función ----------
    function ligar(n, amb, def = false) {
      if (n.t === "VariableName") {
        const x = txt(n);
        if (amb.globales.has(x)) amb.modulo.locales.add(x);
        else if (!amb.nolocales.has(x)) amb.locales.add(x);
        if (!def) amb.otros.add(x);
      } else if (n.t === "TupleExpression" || n.t === "ArrayExpression" || n.t === "ParenthesizedExpression") util(n).forEach(h => ligar(h, amb));
    }
    function recolectar(stmts, amb) {
      for (const s of stmts) {
        switch (s.t) {
          case "ScopeStatement": {
            const tipo = s.h[0].t;
            for (const v of util(s).slice(1)) {
              const x = txt(v);
              if (amb.tipo === "modulo") { if (tipo === "nonlocal") falla(s.a, "SyntaxError: nonlocal declaration not allowed at module level"); continue; }
              if (amb.locales.has(x)) falla(s.a, `SyntaxError: name '${x}' is assigned to before ${tipo} declaration`);
              if (tipo === "global") { amb.globales.add(x); amb.modulo.locales.add(x); }
              else {
                let p = amb.padre; while (p && p.tipo !== "modulo" && !p.locales.has(x)) p = p.padre;
                if (!p || p.tipo === "modulo") falla(s.a, `SyntaxError: no binding for nonlocal '${x}' found`);
                amb.nolocales.add(x);
              }
            }
            break;
          }
          case "AssignStatement": {
            let grupo = [];
            for (const h of s.h) { if (h.t === "AssignOp") { grupo.forEach(g => ligar(g, amb)); grupo = []; } else if (h.t !== "," && h.t !== "Comment") grupo.push(h); }
            break;
          }
          case "UpdateStatement": ligar(s.h[0], amb); break;
          case "ForStatement": { for (const h of s.h) { if (h.t === "in") break; if (h.t !== "for" && h.t !== ",") ligar(h, amb); } s.h.filter(h => h.t === "Body").forEach(b => recolectar(util(b), amb)); break; }
          case "FunctionDefinition": {
            const nombre = s.h.find(h => h.t === "VariableName");
            const esAsync = s.h[0].t === "async";
            if (nombre) { ligar(nombre, amb, true); amb.funciones.set(txt(nombre), (amb.funciones.get(txt(nombre)) ?? esAsync) && esAsync); }
            const hijo = new Ambito("funcion", amb, esAsync);
            hijo.params = new Set();
            ambitos.set(s, hijo);
            const pl = s.h.find(h => h.t === "ParamList");
            if (pl) for (const p of pl.h) if (p.t === "VariableName") { hijo.params.add(txt(p)); hijo.locales.add(txt(p)); }
            const cuerpo = s.h.find(h => h.t === "Body");
            if (cuerpo) recolectar(util(cuerpo), hijo);
            break;
          }
          case "IfStatement": case "WhileStatement": s.h.filter(h => h.t === "Body").forEach(b => recolectar(util(b), amb)); break;
          case "StatementGroup": recolectar(util(s), amb); break;
          default: break;
        }
      }
    }
    function resolver(x, amb) {
      for (let a = amb; a; a = a.padre) {
        if (a.globales.has(x)) return a.modulo;
        if (a.locales.has(x) || (a.params && a.params.has(x))) return a;
      }
      return null;
    }
    function temp(amb) { const f = amb.tipo === "comprension" || amb.tipo === "lambda" ? amb : amb.funcion; return "__t" + (++f.temps); }

    // ---------- Sentencias ----------
    function bloque(stmts, amb, ctx) { for (const s of stmts) sentencia(s, amb, ctx); }
    function cuerpo(n, amb, ctx) {
      const b = n.h.find(h => h.t === "Body");
      bloque(util(b), amb, ctx);
      return b;
    }
    function cerrar(b, t = "}") { emitir(finDe(b), t); }
    function noSoportado(n) {
      const que = NO_SOPORTADO[n.t];
      falla(n.a, `${que || "Esta construcción"} aún no ${que && /^L(o|a)s /.test(que) ? "están" : "está"} en el Python del juego.`);
    }
    function sentencia(s, amb, ctx) {
      switch (s.t) {
        case "ExpressionStatement": emitir(s.a, expr(s.h[0], amb) + ";"); return;
        case "StatementGroup": bloque(util(s), amb, ctx); return;
        case "PassStatement": emitir(s.a, ";"); return;
        case "BreakStatement": case "ContinueStatement":
          if (!ctx.bucles) falla(s.a, `SyntaxError: '${s.t === "BreakStatement" ? "break" : "continue"}' outside loop`);
          emitir(s.a, (s.t === "BreakStatement" ? "break" : "continue") + ";"); return;
        case "ReturnStatement": {
          if (amb.funcion.tipo !== "funcion") falla(s.a, "SyntaxError: 'return' outside function (return solo va dentro de def)");
          const v = util(s).slice(1);
          emitir(s.a, v.length ? `return ${v.length > 1 ? tupla(v, amb) : expr(v[0], amb)};` : "return null;"); return;
        }
        case "ScopeStatement": emitir(s.a, ";"); return;
        case "AssignStatement": return asignar(s, amb);
        case "UpdateStatement": return actualizar(s, amb);
        case "DeleteStatement": {
          const objetivos = util(s).slice(1);
          emitir(s.a, objetivos.map(o => {
            if (o.t === "MemberExpression" && o.h.some(h => h.t === "[")) { const { obj, idx } = subindice(o, amb); return `__py.borrar(${obj}, ${idx});`; }
            falla(o.a, "del solo borra elementos de una lista, como del xs[0].");
          }).join(" "));
          return;
        }
        case "IfStatement": {
          let i = 0;
          const h = s.h.filter(x => x.t !== "Comment");
          while (i < h.length) {
            const k = h[i];
            if (k.t === "if" || k.t === "elif") {
              const cond = h[i + 1], b = h[i + 2];
              emitir(k.a, `${k.t === "elif" ? "else " : ""}if (${verdad(cond, amb)}) {`);
              bloque(util(b), amb, ctx); cerrar(b); i += 3;
            } else if (k.t === "else") {
              const b = h[i + 1];
              emitir(k.a, "else {"); bloque(util(b), amb, ctx); cerrar(b); i += 2;
            } else i++;
          }
          return;
        }
        case "WhileStatement": {
          if (s.h.some(h => h.t === "else")) falla(s.h.find(h => h.t === "else").a, "while … else aún no está en el Python del juego.");
          const cond = s.h[1];
          emitir(s.a, `while (${cond.t === "Boolean" && txt(cond) === "True" ? "true" : verdad(cond, amb)}) {`);
          const b = cuerpo(s, amb, { ...ctx, bucles: ctx.bucles + 1 }); cerrar(b);
          return;
        }
        case "ForStatement": {
          if (s.h.some(h => h.t === "else")) falla(s.h.find(h => h.t === "else").a, "for … else aún no está en el Python del juego.");
          const iEn = s.h.findIndex(h => h.t === "in");
          const objetivos = s.h.slice(1, iEn).filter(h => h.t !== ",");
          const iterable = s.h[iEn + 1];
          const destinos = objetivos.length === 1 && objetivos[0].t === "VariableName" ? null
            : (objetivos.length === 1 && (objetivos[0].t === "TupleExpression" || objetivos[0].t === "ArrayExpression") ? util(objetivos[0]) : objetivos);
          if (destinos && destinos.some(d => d.t !== "VariableName")) falla(s.a, "for solo admite nombres de variable, como for i, x in enumerate(xs).");
          if (!destinos) emitir(s.a, `for (${nombreLigado(objetivos[0], amb)} of __py.iter(${expr(iterable, amb)})) {`);
          else { const t = temp(amb); emitir(s.a, `for (${t} of __py.iter(${expr(iterable, amb)})) { [${destinos.map(d => nombreLigado(d, amb)).join(", ")}] = __py.desempacar(${t}, ${destinos.length});`); }
          const b = cuerpo(s, amb, { ...ctx, bucles: ctx.bucles + 1 }); cerrar(b);
          return;
        }
        case "FunctionDefinition": return definir(s, amb);
        case "Comment": return;
        default:
          if (s.t in NO_SOPORTADO) noSoportado(s);
          falla(s.a, `Esto aún no está en el Python del juego: ${txt(s).split("\n")[0].slice(0, 40)}`);
      }
    }
    function nombreLigado(n, amb) {
      const x = txt(n);
      if (nombreHueco(x)) falla(n.a, `Rellena el hueco ${x} antes de ejecutar.`);
      return jsNombre(x);
    }
    function grupos(s) {
      const g = [[]];
      for (const h of s.h) { if (h.t === "AssignOp" || h.t === "UpdateOp") { g.push([]); continue; } if (h.t === "TypeDef") noSoportado(h); if (h.t !== "Comment") g[g.length - 1].push(h); }
      return g.map(x => { const sinComa = x.filter(h => h.t !== ","); return { nodos: sinComa, tupla: x.some(h => h.t === ",") }; });
    }
    function asignar(s, amb) {
      const gs = grupos(s);
      const valor = gs.pop();
      const rhs = valor.tupla || valor.nodos.length > 1 ? tupla(valor.nodos, amb) : expr(valor.nodos[0], amb);
      const simples = gs.every(g => !g.tupla && g.nodos.length === 1 && g.nodos[0].t === "VariableName");
      if (simples) { emitir(s.a, `${gs.map(g => nombreLigado(g.nodos[0], amb)).join(" = ")} = ${rhs};`); return; }
      const t = temp(amb);
      emitir(s.a, `${t} = ${rhs}; ${gs.map(g => destino(g.tupla || g.nodos.length > 1 ? { t: "TupleExpression", h: g.nodos } : g.nodos[0], t, amb)).join(" ")}`);
    }
    // Asigna el valor (ya calculado en una variable temporal) a un destino de Python.
    function destino(n, valor, amb) {
      if (n.t === "VariableName") return `${nombreLigado(n, amb)} = ${valor};`;
      if (n.t === "TupleExpression" || n.t === "ArrayExpression" || n.t === "ParenthesizedExpression") {
        const partes = n.h.filter(h => !PUNTUACION.has(h.t));
        if (partes.some(p => p.t !== "VariableName")) falla(n.a || 0, "Para desempacar usa solo nombres de variable, como a, b = b, a.");
        return `[${partes.map(p => nombreLigado(p, amb)).join(", ")}] = __py.desempacar(${valor}, ${partes.length});`;
      }
      if (n.t === "MemberExpression") {
        if (n.h.some(h => h.t === "[")) { const { obj, idx, corte } = subindice(n, amb); if (corte) falla(n.a, "Asignar a un trozo (xs[a:b] = …) aún no está en el Python del juego."); return `__py.poner(${obj}, ${idx}, ${valor});`; }
        const prop = n.h.find(h => h.t === "PropertyName");
        return `${expr(n.h[0], amb)}.${miembroJS(txt(prop))} = ${valor};`;
      }
      falla(n.a, "SyntaxError: cannot assign to expression (a la izquierda del = va un nombre)");
    }
    function actualizar(s, amb) {
      const objetivo = s.h[0], op = txt(s.h[1]).slice(0, -1), valor = expr(s.h[2], amb);
      if (!ARITMETICA.has(op)) falla(s.h[1].a, "Este operador aún no está en el Python del juego.");
      if (objetivo.t === "VariableName") {
        const x = nombreLigado(objetivo, amb);
        emitir(s.a, `${x} = __py.aug("${op}", ${x}, ${valor});`); return;
      }
      if (objetivo.t === "MemberExpression" && objetivo.h.some(h => h.t === "[")) {
        const { obj, idx, corte } = subindice(objetivo, amb);
        if (corte) falla(objetivo.a, "Asignar a un trozo aún no está en el Python del juego.");
        const to = temp(amb), ti = temp(amb);
        emitir(s.a, `__py.poner(${to} = ${obj}, ${ti} = ${idx}, __py.aug("${op}", __py.idx(${to}, ${ti}), ${valor}));`); return;
      }
      if (objetivo.t === "MemberExpression") {
        const prop = miembroJS(txt(objetivo.h.find(h => h.t === "PropertyName"))), to = temp(amb);
        emitir(s.a, `${to} = ${expr(objetivo.h[0], amb)}; ${to}.${prop} = __py.aug("${op}", ${to}.${prop}, ${valor});`); return;
      }
      falla(objetivo.a, "SyntaxError: illegal expression for augmented assignment");
    }
    function parametros(pl, amb) {
      const nombres = [], js = [];
      let obligatorios = 0, estrella = false, conDefecto = false;
      const h = pl ? pl.h.filter(x => x.t !== "(" && x.t !== ")" && x.t !== "Comment") : [];
      for (let i = 0; i < h.length; i++) {
        const p = h[i];
        if (p.t === ",") continue;
        if (p.t === "*" ) {
          const v = h[i + 1];
          if (!v || v.t !== "VariableName") falla(p.a, "El * solo, para argumentos con nombre, aún no está en el Python del juego.");
          estrella = true; js.push("..." + jsNombre(txt(v))); i++; continue;
        }
        if (p.t === "**" || p.t === "/") falla(p.a, `${p.t === "**" ? "**kwargs" : "Los parámetros solo posicionales (/)"} aún no está en el Python del juego.`);
        if (p.t === "TypeDef") noSoportado(p);
        if (p.t !== "VariableName") falla(p.a, "SyntaxError: invalid syntax");
        const x = txt(p);
        if (nombres.includes(x)) falla(p.a, `SyntaxError: duplicate argument '${x}' in function definition`);
        nombres.push(x);
        if (h[i + 1] && h[i + 1].t === "AssignOp") { conDefecto = true; js.push(`${jsNombre(x)} = ${expr(h[i + 2], amb)}`); i += 2; }
        else { if (conDefecto) falla(p.a, "SyntaxError: parameter without a default follows parameter with a default"); obligatorios++; js.push(jsNombre(x)); }
      }
      return { nombres, js, obligatorios, estrella };
    }
    function definir(s, amb) {
      const hijo = ambitos.get(s), nombre = s.h.find(h => h.t === "VariableName"), esAsync = s.h[0].t === "async";
      const ps = parametros(s.h.find(h => h.t === "ParamList"), amb);
      if (s.h.some(h => h.t === "TypeDef")) noSoportado(s.h.find(h => h.t === "TypeDef"));
      hijo.marca = marcas.push(hijo) - 1;
      emitir(s.a, `${nombreLigado(nombre, amb)} = __py.def(${JSON.stringify(txt(nombre))}, ${JSON.stringify(ps.nombres)}, ${ps.obligatorios}, ${ps.estrella}, ${esAsync ? "async " : ""}function (${ps.js.join(", ")}) { \u0001${hijo.marca}\u0001`);
      const b = cuerpo(s, hijo, { bucles: 0 });
      cerrar(b, "});");
    }

    // ---------- Expresiones ----------
    function verdad(n, amb) { return `__py.v(${expr(n, amb)})`; }
    function tupla(nodos, amb) { return `__py.tupla([${nodos.map(n => elemento(n, amb)).join(", ")}])`; }
    function elemento(n, amb) { return n.t === "*" ? null : expr(n, amb); }
    function lista(n, amb) {
      const out = [];
      const h = n.h.filter(x => !PUNTUACION.has(x.t) || x.t === "*");
      for (let i = 0; i < h.length; i++) {
        if (h[i].t === "*") { out.push(`...__py.iter(${expr(h[i + 1], amb)})`); i++; }
        else out.push(expr(h[i], amb));
      }
      return out;
    }
    function expr(n, amb) {
      switch (n.t) {
        case "Number": return numero(n);
        case "String": return JSON.stringify(cadena(txt(n), n.a));
        case "ContinuedString": return "(" + util(n).map(h => expr(h, amb)).join(" + ") + ")";
        case "FormatString": return formato(n, amb);
        case "Boolean": return txt(n) === "True" ? "true" : "false";
        case "None": return "null";
        case "VariableName": return nombre(n, amb);
        case "ParenthesizedExpression": { const u = util(n); if (u.length !== 1) falla(n.a, "SyntaxError: invalid syntax"); return "(" + expr(u[0], amb) + ")"; }
        case "TupleExpression": return `__py.tupla([${lista(n, amb).join(", ")}])`;
        case "ArrayExpression": return `[${lista(n, amb).join(", ")}]`;
        case "BinaryExpression": case "UnaryExpression": case "AwaitExpression": case "ConditionalExpression": return operadores(n, amb);
        case "CallExpression": return llamada(n, amb, false);
        case "MemberExpression": return miembro(n, amb);
        case "ArrayComprehensionExpression": return comprension(n, amb);
        case "LambdaExpression": return lambda(n, amb);
        default:
          if (n.t in NO_SOPORTADO) noSoportado(n);
          falla(n.a, `Esto aún no está en el Python del juego: ${txt(n).slice(0, 40)}`);
      }
    }
    function numero(n) {
      let t = txt(n).replace(/_/g, "");
      if (/[jJ]$/.test(t)) falla(n.a, "Los números complejos no están en el Python del juego.");
      if (/^0\d/.test(t) && !/^0+$/.test(t) && !/[.eE]/.test(t)) falla(n.a, "SyntaxError: leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers");
      if (/^0[oO]/.test(t)) t = "0o" + t.slice(2);
      if (/^\./.test(t)) t = "0" + t;
      if (/\.$/.test(t)) t += "0";
      if (/\.[eE]/.test(t)) t = t.replace(".", ".0");
      return t;
    }
    // Decodifica un literal de texto de Python (prefijos, comillas triples, escapes).
    function cadena(t, pos) {
      const m = t.match(/^([rRbBuUfF]*)('''|"""|'|")([\s\S]*)\2$/);
      if (!m) falla(pos, "SyntaxError: unterminated string literal (falta cerrar las comillas)");
      const pre = m[1].toLowerCase();
      if (pre.includes("b")) falla(pos, "Los bytes (b'…') no están en el Python del juego.");
      return pre.includes("r") ? m[3] : escapes(m[3], pos);
    }
    function escapes(s, pos) {
      return s.replace(/\\(?:(\n)|([\\'"abfnrtv])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|([0-7]{1,3})|(N\{[^}]*\})|([\s\S]))/g, (all, nl, c, x, u, U, oct, N, otro) => {
        if (nl) return "";
        if (c) return { "\\": "\\", "'": "'", '"': '"', a: "\x07", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" }[c];
        if (x || u || U) return String.fromCodePoint(parseInt(x || u || U, 16));
        if (oct) return String.fromCharCode(parseInt(oct, 8));
        if (N) falla(pos, "Los escapes \\N{…} no están en el Python del juego.");
        return "\\" + otro;
      });
    }
    function formato(n, amb) {
      const t = txt(n), m = t.match(/^([rRfF]*)('''|"""|'|")/);
      const raw = m[1].toLowerCase().includes("r"), ini = n.a + m[0].length, fin = n.b - m[2].length;
      const partes = [];
      let p = ini;
      const literal = (a, b) => {
        if (b <= a) return;
        let s = src.slice(a, b).replace(/\{\{/g, "{").replace(/\}\}/g, "}");
        if (!raw) s = escapes(s, a);
        if (s) partes.push(JSON.stringify(s));
      };
      for (const r of n.h.filter(h => h.t === "FormatReplacement")) {
        literal(p, r.a);
        const hs = r.h.filter(h => h.t !== "{" && h.t !== "}");
        const e = hs.find(h => !/^Format(Conversion|Spec|SelfDoc)$/.test(h.t));
        if (!e) falla(r.a, "SyntaxError: f-string: valid expression required before '}'");
        const conv = hs.find(h => h.t === "FormatConversion"), spec = hs.find(h => h.t === "FormatSpec"), doc = hs.find(h => h.t === "FormatSelfDoc");
        if (spec && spec.h.some(h => h.t === "FormatReplacement")) falla(spec.a, "Los formatos con {…} anidados aún no están en el Python del juego.");
        if (doc) partes.push(JSON.stringify(src.slice(r.a + 1, doc.b)));
        const c = conv ? txt(conv).slice(1) : doc && !spec ? "r" : "";
        partes.push(`__py.formato(${expr(e, amb)}, ${JSON.stringify(spec ? txt(spec).slice(1) : "")}, ${JSON.stringify(c)})`);
        p = r.b;
      }
      literal(p, fin);
      return partes.length ? "(" + (partes[0].startsWith('"') ? "" : '"" + ') + partes.join(" + ") + ")" : '""';
    }
    function nombre(n, amb) {
      const x = txt(n);
      if (nombreHueco(x)) falla(n.a, `Rellena el hueco ${x} antes de ejecutar. Doble clic en un valor del inspector lo pone en su lugar.`);
      if (resolver(x, amb)) return jsNombre(x);
      if (x === "print") return "((...a) => console.log(__py.imprimir(...a)))";
      if (BUILTINS.has(x)) return "__py." + x;
      if (funciones.has(x)) return funciones.get(x).destino;
      if (propiedades.has(x)) return propiedades.get(x);
      return x;
    }
    function miembroJS(p) { return (miembros.get(p) || {}).destino || propiedades.get(p) || p; }

    function argumentos(n, amb, { kw = true, quien = "" } = {}) {
      const al = n.h.find(h => h.t === "ArgList");
      const h = al.h.filter(x => x.t !== "(" && x.t !== ")" && x.t !== "Comment");
      const pos = [], nombrados = [];
      for (let i = 0; i < h.length; i++) {
        const a = h[i];
        if (a.t === ",") continue;
        if (a.t === "*") { pos.push(`...__py.iter(${expr(h[i + 1], amb)})`); i++; continue; }
        if (a.t === "**") falla(a.a, "**kwargs aún no está en el Python del juego.");
        if (a.t === "VariableName" && h[i + 1] && h[i + 1].t === "AssignOp") {
          if (!kw) falla(a.a, `${quien} no acepta argumentos con nombre: escríbelos en orden, sin «${txt(a)}=».`);
          nombrados.push(`${JSON.stringify(txt(a))}: ${expr(h[i + 2], amb)}`); i += 2; continue;
        }
        if (a.t === "ComprehensionExpression") noSoportado(a);
        if (nombrados.length) falla(a.a, "SyntaxError: positional argument follows keyword argument");
        pos.push(expr(a, amb));
      }
      if (nombrados.length) pos.push(`__py.kw({ ${nombrados.join(", ")} })`);
      return pos.join(", ");
    }
    function exigirAwait(n, conAwait, quien, esFuncionPropia) {
      if (conAwait) return;
      falla(n.a, esFuncionPropia
        ? `Falta await: ${quien} es async def. Escribe await ${txt(n).split("(")[0]}(…).`
        : `Falta await: ${quien} espera a que termine. Escribe await ${txt(n)}.`);
    }
    function llamada(n, amb, conAwait) {
      const f = n.h[0];
      if (f.t === "VariableName") {
        const x = txt(f), ligado = resolver(x, amb);
        if (nombreHueco(x)) falla(f.a, `Rellena el hueco ${x} antes de ejecutar.`);
        if (ligado) {
          if (ligado.funciones.get(x) && !ligado.otros.has(x)) exigirAwait(n, conAwait, x, true);
          return `${jsNombre(x)}(${argumentos(n, amb)})`;
        }
        if (CONSOLA[x]) return `console.${CONSOLA[x]}(__py.imprimir(${argumentos(n, amb)}))`;
        if (BUILTINS.has(x)) return `__py.${x}(${argumentos(n, amb)})`;
        if (funciones.has(x)) {
          const e = funciones.get(x);
          if (e.await) exigirAwait(n, conAwait, x, false);
          return `${e.destino}(${argumentos(n, amb, { kw: false, quien: x })})`;
        }
        return `${x}(${argumentos(n, amb)})`;
      }
      if (f.t === "MemberExpression" && f.h.some(h => h.t === ".")) {
        const obj = f.h[0], prop = txt(f.h.find(h => h.t === "PropertyName"));
        if (obj.t === "VariableName" && !resolver(txt(obj), amb) && objetos.has(txt(obj))) {
          const e = miembros.get(prop);
          if (e && e.await) exigirAwait(n, conAwait, `${txt(obj)}.${prop}`, false);
          return `${txt(obj)}.${miembroJS(prop)}(${argumentos(n, amb, { kw: false, quien: prop })})`;
        }
        return `__py.metodo(${expr(obj, amb)}, ${JSON.stringify(prop)}, ${JSON.stringify(miembroJS(prop))}, [${argumentos(n, amb)}])`;
      }
      return `${expr(f, amb)}(${argumentos(n, amb)})`;
    }
    function subindice(n, amb) {
      const obj = expr(n.h[0], amb);
      const iA = n.h.findIndex(h => h.t === "["), iB = n.h.length - 1 - [...n.h].reverse().findIndex(h => h.t === "]");
      const dentro = n.h.slice(iA + 1, iB).filter(h => h.t !== "Comment");
      if (dentro.some(h => h.t === ",")) falla(n.a, "Los índices con coma (xs[a, b]) no están en el Python del juego.");
      if (!dentro.some(h => h.t === ":")) {
        if (dentro.length !== 1) falla(n.a, "SyntaxError: invalid syntax");
        return { obj, idx: expr(dentro[0], amb), corte: false };
      }
      const partes = [[]];
      for (const h of dentro) { if (h.t === ":") partes.push([]); else partes[partes.length - 1].push(h); }
      if (partes.length > 3) falla(n.a, "SyntaxError: invalid syntax");
      const v = i => partes[i] && partes[i].length ? expr(partes[i][0], amb) : "null";
      return { obj, idx: `${v(0)}, ${v(1)}, ${v(2)}`, corte: true };
    }
    function miembro(n, amb) {
      if (n.h.some(h => h.t === "[")) {
        const { obj, idx, corte } = subindice(n, amb);
        return corte ? `__py.corte(${obj}, ${idx})` : `__py.idx(${obj}, ${idx})`;
      }
      const obj = n.h[0], prop = txt(n.h.find(h => h.t === "PropertyName"));
      if (obj.t === "VariableName" && !resolver(txt(obj), amb) && objetos.has(txt(obj))) return `${txt(obj)}.${miembroJS(prop)}`;
      return `__py.attr(${expr(obj, amb)}, ${JSON.stringify(prop)}, ${JSON.stringify(miembroJS(prop))})`;
    }
    function comprension(n, amb) {
      const hijo = new Ambito("comprension", amb, amb.funcion.esAsync);
      const h = n.h.filter(x => x.t !== "[" && x.t !== "]" && x.t !== "Comment");
      const elementoN = h[0];
      const clausulas = [];
      for (let i = 1; i < h.length; i++) {
        if (h[i].t === "for") {
          const iEn = h.findIndex((x, j) => j > i && x.t === "in");
          const objetivos = h.slice(i + 1, iEn).filter(x => x.t !== ",");
          clausulas.push({ tipo: "for", objetivos, iterable: h[iEn + 1] });
          i = iEn + 1;
        } else if (h[i].t === "if") { clausulas.push({ tipo: "if", cond: h[i + 1] }); i++; }
        else if (h[i].t === "async") falla(h[i].a, "async for aún no está en el Python del juego.");
      }
      // La primera colección se evalúa fuera de la comprensión, como en Python.
      const primera = expr(clausulas[0].iterable, amb);
      for (const c of clausulas) if (c.tipo === "for") c.objetivos.forEach(o => ligar(o, hijo));
      let codigo = "", cierres = "";
      clausulas.forEach((c, k) => {
        if (c.tipo === "for") {
          const it = k === 0 ? primera : expr(c.iterable, hijo);
          const destinos = c.objetivos.length === 1 && c.objetivos[0].t === "VariableName" ? null : (c.objetivos.length === 1 ? util(c.objetivos[0]) : c.objetivos);
          if (destinos && destinos.some(d => d.t !== "VariableName")) falla(c.objetivos[0].a, "for solo admite nombres de variable.");
          if (!destinos) codigo += `for (${jsNombre(txt(c.objetivos[0]))} of __py.iter(${it})) { `;
          else { const t = temp(hijo); codigo += `for (${t} of __py.iter(${it})) { [${destinos.map(d => jsNombre(txt(d))).join(", ")}] = __py.desempacar(${t}, ${destinos.length}); `; }
        } else codigo += `if (${verdad(c.cond, hijo)}) { `;
        cierres += "} ";
      });
      const el = expr(elementoN, hijo);
      const conAwait = /\bawait\b/.test(codigo + el);
      if (conAwait && !amb.funcion.esAsync) falla(n.a, "SyntaxError: asynchronous comprehension outside of an asynchronous function");
      const cuerpoJS = `${declaraciones(hijo)}const __r = []; ${codigo}__r.push(${el}); ${cierres}return __r;`;
      return conAwait ? `(await (async () => { ${cuerpoJS} })())` : `(() => { ${cuerpoJS} })()`;
    }
    function lambda(n, amb) {
      const hijo = new Ambito("lambda", amb, false);
      hijo.params = new Set();
      const pl = n.h.find(h => h.t === "ParamList");
      if (pl) for (const p of pl.h) if (p.t === "VariableName") { hijo.params.add(txt(p)); hijo.locales.add(txt(p)); }
      const ps = parametros(pl, amb);
      const cuerpoN = n.h[n.h.length - 1];
      const e = expr(cuerpoN, hijo);
      return `__py.def("<lambda>", ${JSON.stringify(ps.nombres)}, ${ps.obligatorios}, ${ps.estrella}, (${ps.js.join(", ")}) => { ${declaraciones(hijo)}return ${e}; })`;
    }

    // Operadores: se aplana la expresión de lezer y se reasocia con la precedencia de Python.
    function operadores(n, amb) {
      const fichas = [];
      const aplanar = x => {
        if (["BinaryExpression", "UnaryExpression", "AwaitExpression", "ConditionalExpression"].includes(x.t)) {
          for (const h of x.h) {
            if (h.t === "Comment") continue;
            if (["ArithOp", "CompareOp", "BitOp", "and", "or", "not", "in", "is", "await", "if", "else"].includes(h.t)) fichas.push({ op: txt(h), pos: h.a });
            else aplanar(h);
          }
        } else fichas.push({ nodo: x, pos: x.a });
      };
      aplanar(n);
      let i = 0;
      const ver = () => fichas[i], tomar = () => fichas[i++];
      const opDe = () => {
        const f = ver();
        if (!f || !f.op) return null;
        if (f.op === "not" && fichas[i + 1] && fichas[i + 1].op === "in") return "not in";
        if (f.op === "is" && fichas[i + 1] && fichas[i + 1].op === "not") return "is not";
        return f.op;
      };
      const tomarOp = op => { i += op === "not in" || op === "is not" ? 2 : 1; };
      const parse = rbp => {
        const f = tomar();
        if (!f) falla(n.b, "SyntaxError: invalid syntax");
        let izq;
        if (f.op) {
          if (f.op === "not") izq = { u: "not", x: parse(4), pos: f.pos };
          else if (f.op === "-" || f.op === "+" || f.op === "~") izq = { u: f.op, x: parse(12), pos: f.pos };
          else if (f.op === "await") { const x = parse(14); izq = { u: "await", x, pos: f.pos }; }
          else falla(f.pos, "SyntaxError: invalid syntax");
        } else izq = { nodo: f.nodo };
        for (;;) {
          const op = opDe();
          if (!op || !(op in LBP) || LBP[op] <= rbp) break;
          const pos = ver().pos;
          tomarOp(op);
          if (op === "if") {
            const cond = parse(1);
            if (!ver() || ver().op !== "else") falla(pos, "SyntaxError: expected 'else' after 'if' expression");
            tomar();
            izq = { tern: true, si: izq, cond, no: parse(0), pos };
          } else if (COMPARA.has(op)) {
            const ops = [op], xs = [izq, parse(5)];
            for (;;) { const o = opDe(); if (!o || !COMPARA.has(o)) break; tomarOp(o); ops.push(o); xs.push(parse(5)); }
            izq = { cmp: ops, xs, pos };
          } else if (op === "**") izq = { bin: op, a: izq, b: parse(12), pos };
          else izq = { bin: op, a: izq, b: parse(LBP[op]), pos };
        }
        return izq;
      };
      const arbol = parse(0);
      if (i < fichas.length) falla(fichas[i].pos, "SyntaxError: invalid syntax");
      return generar(arbol, amb);
    }
    function generar(x, amb) {
      if (x.nodo) return expr(x.nodo, amb);
      if (x.u) {
        if (x.u === "await") {
          if (!amb.funcion.esAsync || amb.tipo === "lambda" || amb.funcion.tipo === "lambda") falla(x.pos, "SyntaxError: 'await' outside async function (usa async def para las funciones que esperan)");
          const dentro = x.x.nodo && x.x.nodo.t === "CallExpression" ? llamada(x.x.nodo, amb, true) : generar(x.x, amb);
          return `(await ${dentro})`;
        }
        const v = generar(x.x, amb);
        return x.u === "not" ? `!__py.v(${v})` : `__py.un("${x.u}", ${v})`;
      }
      if (x.tern) return `(__py.v(${generar(x.cond, amb)}) ? ${generar(x.si, amb)} : ${generar(x.no, amb)})`;
      if (x.bin) {
        const a = generar(x.a, amb), b = generar(x.b, amb);
        if (x.bin === "and" || x.bin === "or") { const t = temp(amb); return x.bin === "and" ? `(__py.v(${t} = ${a}) ? ${b} : ${t})` : `(__py.v(${t} = ${a}) ? ${t} : ${b})`; }
        if (x.bin === "@") falla(x.pos, "El operador @ no está en el Python del juego.");
        return `__py.bin("${x.bin}", ${a}, ${b})`;
      }
      if (x.cmp) {
        const xs = x.xs.map(e => generar(e, amb));
        if (xs.length === 2) return `__py.cmp("${x.cmp[0]}", ${xs[0]}, ${xs[1]})`;
        const partes = [];
        let izq = xs[0];
        for (let k = 0; k < x.cmp.length; k++) {
          const ultimo = k === x.cmp.length - 1;
          const t = ultimo ? null : temp(amb);
          partes.push(`__py.cmp("${x.cmp[k]}", ${izq}, ${ultimo ? xs[k + 1] : `${t} = ${xs[k + 1]}`})`);
          izq = t;
        }
        return "(" + partes.join(" && ") + ")";
      }
      throw new Error("expresión desconocida");
    }
  }

  // ---------- Preludio del Worker ----------
  // Se inyecta en el Worker con toString(): no puede usar nada de fuera de la función.
  function preludio() {
    "use strict";
    const TUPLA = Symbol("tupla"), RANGO = Symbol("rango");
    class KW { constructor(v) { this.v = v; } }
    class ErrorPython extends Error { constructor(tipo, msg) { super(tipo + ": " + msg); this.tipoPython = tipo; } }
    const err = (t, m) => new ErrorPython(t, m);
    const nada = x => x === undefined ? null : x;
    const esNum = x => typeof x === "number" || typeof x === "boolean";
    const esInt = x => typeof x === "boolean" || (typeof x === "number" && Number.isInteger(x));
    const esLista = x => Array.isArray(x) && !x[TUPLA];
    const esTupla = x => Array.isArray(x) && !!x[TUPLA];
    const tipo = x => x == null ? "NoneType" : typeof x === "boolean" ? "bool" : typeof x === "number" ? (Number.isInteger(x) ? "int" : "float")
      : typeof x === "string" ? "str" : esTupla(x) ? "tuple" : Array.isArray(x) ? "list" : x[RANGO] ? "range" : typeof x === "function" ? "function" : "object";
    const num = x => typeof x === "boolean" ? +x : x;
    function v(x) {
      if (x == null) return false;
      if (typeof x === "boolean") return x;
      if (typeof x === "number") return x !== 0;
      if (typeof x === "string" || Array.isArray(x)) return x.length > 0;
      if (x[RANGO]) return len(x) > 0;
      return true;
    }
    function reprFloat(x) {
      if (x === Infinity) return "inf";
      if (x === -Infinity) return "-inf";
      if (Number.isNaN(x)) return "nan";
      if (Number.isInteger(x) && Math.abs(x) < 1e21) return String(x);
      const [m, e] = x.toExponential().split("e"), exp = +e;
      const dig = m.replace("-", "").replace(".", ""), sig = x < 0 ? "-" : "";
      if (exp >= -4 && exp < 16) {
        if (exp < 0) return sig + "0." + "0".repeat(-exp - 1) + dig;
        const ent = dig.slice(0, exp + 1).padEnd(exp + 1, "0"), dec = dig.slice(exp + 1);
        return sig + ent + (dec ? "." + dec : "");
      }
      return sig + dig[0] + (dig.length > 1 ? "." + dig.slice(1) : "") + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
    }
    function reprStr(s) {
      const q = s.includes("'") && !s.includes('"') ? '"' : "'";
      return q + s.replace(/[\\\n\r\t]|[\x00-\x1f\x7f]/g, c => ({ "\\": "\\\\", "\n": "\\n", "\r": "\\r", "\t": "\\t" }[c] || "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0")))
        .replace(new RegExp(q, "g"), "\\" + q) + q;
    }
    function repr(x, vistos = new Set()) {
      if (x == null) return "None";
      if (x === true) return "True";
      if (x === false) return "False";
      if (typeof x === "number") return reprFloat(x);
      if (typeof x === "string") return reprStr(x);
      if (typeof x === "function") return `<function ${x.__nombre || x.name || "función"}>`;
      if (vistos.has(x)) return Array.isArray(x) ? "[...]" : "{...}";
      vistos.add(x);
      try {
        if (esTupla(x)) return "(" + x.map(e => repr(e, vistos)).join(", ") + (x.length === 1 ? ",)" : ")");
        if (Array.isArray(x)) return "[" + x.map(e => repr(e, vistos)).join(", ") + "]";
        if (x[RANGO]) return `range(${x.inicio}, ${x.fin}${x.paso !== 1 ? ", " + x.paso : ""})`;
        return "{" + Object.keys(x).map(k => reprStr(k) + ": " + repr(x[k], vistos)).join(", ") + "}";
      } finally { vistos.delete(x); }
    }
    const str = x => typeof x === "string" ? x : repr(x);
    function imprimir(...args) {
      let sep = " ", end = "\n";
      if (args.length && args[args.length - 1] instanceof KW) {
        const k = args.pop().v;
        for (const n of Object.keys(k)) if (n !== "sep" && n !== "end") throw err("TypeError", `'${n}' is an invalid keyword argument for print()`);
        if (k.sep != null) sep = k.sep; if (k.end != null) end = k.end;
      }
      const t = args.map(a => typeof a === "string" ? a : repr(a)).join(sep) + end;
      return t.endsWith("\n") ? t.slice(0, -1) : t;
    }
    function quitarKW(nombre, args, permitidos = []) {
      if (!args.length || !(args[args.length - 1] instanceof KW)) return {};
      const k = args.pop().v;
      for (const n of Object.keys(k)) if (!permitidos.includes(n)) throw err("TypeError", `${nombre}() got an unexpected keyword argument '${n}'`);
      return k;
    }
    function def(nombre, params, obligatorios, estrella, fn) {
      const w = function (...args) {
        args = args.map(nada);
        const kw = quitarKW(nombre, args, params);
        const n = params.length;
        if (args.length > n && !estrella) throw err("TypeError", `${nombre}() takes ${n} positional argument${n === 1 ? "" : "s"} but ${args.length} ${args.length === 1 ? "was" : "were"} given`);
        const posicionales = args.length;
        for (const k of Object.keys(kw)) {
          const i = params.indexOf(k);
          if (i < posicionales) throw err("TypeError", `${nombre}() got multiple values for argument '${k}'`);
          while (args.length < i) args.push(undefined);
          args[i] = nada(kw[k]);
        }
        const faltan = [];
        for (let i = 0; i < obligatorios; i++) if (args[i] === undefined) faltan.push(`'${params[i]}'`);
        if (faltan.length) throw err("TypeError", `${nombre}() missing ${faltan.length} required positional argument${faltan.length === 1 ? "" : "s"}: ${faltan.length === 1 ? faltan[0] : faltan.slice(0, -1).join(", ") + " and " + faltan[faltan.length - 1]}`);
        const r = fn.apply(this, args);
        return r instanceof Promise ? r.then(nada) : nada(r);
      };
      w.__nombre = nombre;
      return w;
    }
    // Redondeo como Python: mitad al par sobre el valor binario exacto.
    function redondear(x, d) {
      if (!Number.isFinite(x) || Math.abs(x) >= 1e21) return x;
      if (d < 0) { const f = 10 ** -d; return redondear(x / f, 0) * f; }
      const s = Math.abs(x).toFixed(Math.min(100, d + 30));
      const [ent, dec = ""] = s.split(".");
      const cifras = ent + dec.slice(0, d), resto = dec.slice(d);
      let n = BigInt(cifras);
      const mitad = resto[0] === "5" && /^0*$/.test(resto.slice(1));
      if (resto[0] > "5" || (resto[0] === "5" && !mitad) || (mitad && n % 2n === 1n)) n += 1n;
      const t = n.toString().padStart(d + 1, "0");
      const r = Number(d ? t.slice(0, -d) + "." + t.slice(-d) : t);
      return x < 0 ? -r : r;
    }
    function fijo(x, d) {
      if (!Number.isFinite(x)) return reprFloat(x);
      const t = Math.abs(redondear(x, d)).toFixed(d);
      return x < 0 ? "-" + t : t;
    }
    function general(x, p) {
      if (!Number.isFinite(x)) return reprFloat(x);
      if (x === 0) return "0";
      p = p || 1;
      const [m, e] = x.toExponential(p - 1).split("e"), exp = +e;
      if (exp < -4 || exp >= p) return (m.includes(".") ? m.replace(/0+$/, "").replace(/\.$/, "") : m) + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
      const t = fijo(x, p - 1 - exp);
      return t.includes(".") ? t.replace(/0+$/, "").replace(/\.$/, "") : t;
    }
    function formato(x, spec, conv) {
      if (conv === "r" || conv === "a") x = repr(x);
      else if (conv === "s") x = str(x);
      if (!spec) return typeof x === "string" ? x : repr(x);
      const m = spec.match(/^(?:([\s\S])?([<>=^]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([bcdeEfFgGnosxX%])?$/);
      if (!m) throw err("ValueError", `Invalid format specifier '${spec}' for object of type '${tipo(x)}'`);
      let [, relleno, alinear, signo, , cero, ancho, grupo, prec, t] = m;
      let s;
      const numerico = esNum(x);
      if (t && !numerico && t !== "s") throw err("ValueError", `Unknown format code '${t}' for object of type '${tipo(x)}'`);
      if (t === "s" && numerico) throw err("ValueError", `Unknown format code 's' for object of type '${tipo(x)}'`);
      if (numerico) {
        const n = num(x);
        const p = prec == null ? null : +prec;
        if (t === "d" || t === "n") { if (!Number.isInteger(n)) throw err("ValueError", `Unknown format code '${t}' for object of type 'float'`); s = String(Math.abs(n)); }
        else if (t === "b" || t === "o" || t === "x" || t === "X") { if (!Number.isInteger(n)) throw err("ValueError", `Unknown format code '${t}' for object of type 'float'`); s = Math.abs(n).toString({ b: 2, o: 8, x: 16, X: 16 }[t]); if (t === "X") s = s.toUpperCase(); }
        else if (t === "f" || t === "F") s = fijo(Math.abs(n), p == null ? 6 : p);
        else if (t === "e" || t === "E") { let [a, e] = Math.abs(n).toExponential(p == null ? 6 : p).split("e"); s = a + "e" + (+e < 0 ? "-" : "+") + String(Math.abs(+e)).padStart(2, "0"); if (t === "E") s = s.toUpperCase(); }
        else if (t === "%") s = fijo(Math.abs(n) * 100, p == null ? 6 : p) + "%";
        else if (t === "g" || t === "G") s = general(Math.abs(n), p == null ? 6 : p);
        else s = p == null ? (typeof x === "boolean" ? String(+x) : reprFloat(Math.abs(n))) : general(Math.abs(n), p);
        if (typeof x === "boolean" && !t && p == null) s = x ? "True" : "False";
        if (grupo) { const [e, d] = s.split("."); s = e.replace(/\B(?=(\d{3})+(?!\d))/g, grupo) + (d != null ? "." + d : ""); }
        const neg = n < 0 || Object.is(n, -0) && t;
        const pre = neg ? "-" : signo === "+" ? "+" : signo === " " ? " " : "";
        if (cero && !alinear) { relleno = "0"; alinear = "="; }
        s = { s: pre + s, pre };
      } else {
        s = String(x);
        if (prec != null) s = s.slice(0, +prec);
        s = { s, pre: "" };
      }
      const w = ancho ? +ancho : 0, f = relleno || " ", a = alinear || (numerico ? ">" : "<");
      let r = s.s;
      if (r.length < w) {
        const falta = w - r.length;
        if (a === "<") r += f.repeat(falta);
        else if (a === ">") r = f.repeat(falta) + r;
        else if (a === "^") r = f.repeat(Math.floor(falta / 2)) + r + f.repeat(Math.ceil(falta / 2));
        else r = s.pre + f.repeat(falta) + r.slice(s.pre.length);
      }
      return r;
    }
    function eq(a, b) {
      a = nada(a); b = nada(b);
      if (a === b) return true;
      if (esNum(a) && esNum(b)) return num(a) === num(b);
      if (Array.isArray(a) && Array.isArray(b)) return esTupla(a) === esTupla(b) && a.length === b.length && a.every((x, i) => eq(x, b[i]));
      if (a && b && a[RANGO] && b[RANGO]) return eq([...a], [...b]);
      return false;
    }
    function orden(op, a, b) {
      if (esNum(a) && esNum(b)) { a = num(a); b = num(b); }
      else if (typeof a === "string" && typeof b === "string") { /* orden de JS por unidades UTF-16, como Python para el BMP */ }
      else if (Array.isArray(a) && Array.isArray(b) && esTupla(a) === esTupla(b)) {
        for (let i = 0; i < Math.min(a.length, b.length); i++) if (!eq(a[i], b[i])) return orden(op, a[i], b[i]);
        a = a.length; b = b.length;
      } else throw err("TypeError", `'${op}' not supported between instances of '${tipo(a)}' and '${tipo(b)}'`);
      return op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : a >= b;
    }
    function en(a, b) {
      if (typeof b === "string") { if (typeof a !== "string") throw err("TypeError", `'in <string>' requires string as left operand, not ${tipo(a)}`); return b.includes(a); }
      if (Array.isArray(b)) return b.some(x => eq(x, a));
      if (b && b[RANGO]) return esNum(a) && Number.isInteger(num(a)) && [...b].includes(num(a));
      if (b && typeof b === "object") return Object.keys(b).includes(a);
      throw err("TypeError", `argument of type '${tipo(b)}' is not iterable`);
    }
    function cmp(op, a, b) {
      switch (op) {
        case "==": return eq(a, b);
        case "!=": return !eq(a, b);
        case "is": return nada(a) === nada(b);
        case "is not": return nada(a) !== nada(b);
        case "in": return en(a, b);
        case "not in": return !en(a, b);
        default: return orden(op, a, b);
      }
    }
    const nombreOp = { "+": "+", "-": "-", "*": "*", "/": "/", "//": "//", "%": "%", "**": "** or pow()", "&": "&", "|": "|", "^": "^", "<<": "<<", ">>": ">>" };
    const operando = (op, a, b) => err("TypeError", `unsupported operand type(s) for ${nombreOp[op]}: '${tipo(a)}' and '${tipo(b)}'`);
    function repetir(sec, n, op) {
      if (!esInt(n)) throw err("TypeError", `can't multiply sequence by non-int of type '${tipo(n)}'`);
      n = Math.max(0, num(n));
      if (typeof sec === "string") return sec.repeat(n);
      const r = []; for (let i = 0; i < n; i++) r.push(...sec);
      return esTupla(sec) ? tupla(r) : r;
    }
    function bin(op, a, b) {
      if (esNum(a) && esNum(b)) {
        const x = num(a), y = num(b);
        switch (op) {
          case "+": return x + y;
          case "-": return x - y;
          case "*": return x * y;
          case "/": if (y === 0) throw err("ZeroDivisionError", "division by zero"); return x / y;
          case "//": if (y === 0) throw err("ZeroDivisionError", esInt(a) && esInt(b) ? "integer division or modulo by zero" : "float floor division by zero"); return Math.floor(x / y);
          case "%": { if (y === 0) throw err("ZeroDivisionError", esInt(a) && esInt(b) ? "integer modulo by zero" : "float modulo by zero"); let r = x % y; if (r !== 0 && (r < 0) !== (y < 0)) r += y; return r; }
          case "**": {
            if (x === 0 && y < 0) throw err("ZeroDivisionError", "zero to a negative power");
            if (x < 0 && !Number.isInteger(y)) throw err("ValueError", "el resultado sería un número complejo, que no está en el Python del juego");
            return x ** y;
          }
          default:
            if (!esInt(a) || !esInt(b)) throw operando(op, a, b);
            if ((op === "<<" || op === ">>") && y < 0) throw err("ValueError", "negative shift count");
            return op === "&" ? x & y : op === "|" ? x | y : op === "^" ? x ^ y : op === "<<" ? x * 2 ** y : Math.floor(x / 2 ** y);
        }
      }
      if (op === "+") {
        if (typeof a === "string") { if (typeof b !== "string") throw err("TypeError", `can only concatenate str (not "${tipo(b)}") to str`); return a + b; }
        if (esLista(a)) { if (!esLista(b)) throw err("TypeError", `can only concatenate list (not "${tipo(b)}") to list`); return [...a, ...b]; }
        if (esTupla(a)) { if (!esTupla(b)) throw err("TypeError", `can only concatenate tuple (not "${tipo(b)}") to tuple`); return tupla([...a, ...b]); }
      }
      if (op === "*") {
        if ((typeof a === "string" || Array.isArray(a)) && !Array.isArray(b) && typeof b !== "string") return repetir(a, b);
        if ((typeof b === "string" || Array.isArray(b)) && !Array.isArray(a) && typeof a !== "string") return repetir(b, a);
      }
      if (op === "%" && typeof a === "string") throw err("TypeError", "el formato con % no está en el Python del juego: usa f-strings, como f\"{x}\"");
      throw operando(op, a, b);
    }
    function aug(op, a, b) {
      if (op === "+" && esLista(a)) { a.push(...iter(b)); return a; }
      if (op === "*" && esLista(a)) { const r = repetir(a, b); a.length = 0; a.push(...r); return a; }
      return bin(op, a, b);
    }
    function un(op, x) {
      if (!esNum(x) || (op === "~" && !esInt(x))) throw err("TypeError", `bad operand type for unary ${op}: '${tipo(x)}'`);
      x = num(x);
      return op === "-" ? -x : op === "+" ? x : ~x;
    }
    function tupla(a) { a[TUPLA] = true; return Object.freeze(a); }
    function rango(...args) {
      if (args.length < 1 || args.length > 3) throw err("TypeError", `range expected at least 1 argument, got ${args.length}`);
      for (const a of args) if (!esInt(a)) throw err("TypeError", `'${tipo(a)}' object cannot be interpreted as an integer`);
      let [inicio, fin, paso = 1] = args.length === 1 ? [0, num(args[0])] : args.map(num);
      if (paso === 0) throw err("ValueError", "range() arg 3 must not be zero");
      return { [RANGO]: true, inicio, fin, paso, *[Symbol.iterator]() { for (let i = inicio; paso > 0 ? i < fin : i > fin; i += paso) yield i; } };
    }
    function len(x) {
      if (typeof x === "string" || Array.isArray(x)) return x.length;
      if (x && x[RANGO]) return Math.max(0, Math.ceil((x.fin - x.inicio) / x.paso));
      throw err("TypeError", `object of type '${tipo(x)}' has no len()`);
    }
    function iter(x) {
      if (Array.isArray(x)) return x;
      if (typeof x === "string") return [...x];
      if (x && x[RANGO]) return x;
      throw err("TypeError", `'${tipo(x)}' object is not iterable`);
    }
    function desempacar(x, n) {
      const a = [...iter(x)];
      if (a.length < n) throw err("ValueError", `not enough values to unpack (expected ${n}, got ${a.length})`);
      if (a.length > n) throw err("ValueError", `too many values to unpack (expected ${n})`);
      return a;
    }
    function indice(x, i, que) {
      if (!esInt(i)) throw err("TypeError", `${que} indices must be integers or slices, not ${tipo(i)}`);
      i = num(i);
      const n = len(x), j = i < 0 ? i + n : i;
      return { j, fuera: j < 0 || j >= n };
    }
    function idx(x, i) {
      if (typeof x === "string" || Array.isArray(x) || (x && x[RANGO])) {
        const que = typeof x === "string" ? "string" : esTupla(x) ? "tuple" : x[RANGO] ? "range object" : "list";
        const { j, fuera } = indice(x, i, que);
        if (fuera) throw err("IndexError", `${que} index out of range`);
        return x[RANGO] ? x.inicio + j * x.paso : x[j];
      }
      if (x == null) throw err("TypeError", "'NoneType' object is not subscriptable");
      if (typeof x === "object") { if (typeof i === "string" && i in x) return x[i]; throw err("KeyError", repr(i)); }
      throw err("TypeError", `'${tipo(x)}' object is not subscriptable`);
    }
    function poner(x, i, valor) {
      if (esLista(x)) {
        const { j, fuera } = indice(x, i, "list");
        if (fuera) throw err("IndexError", "list assignment index out of range");
        x[j] = valor; return valor;
      }
      if (x && typeof x === "object" && !Array.isArray(x) && !x[RANGO] && typeof i === "string") { x[i] = valor; return valor; }
      throw err("TypeError", `'${tipo(x)}' object does not support item assignment`);
    }
    function borrar(x, i) {
      if (!esLista(x)) throw err("TypeError", `'${tipo(x)}' object doesn't support item deletion`);
      const { j, fuera } = indice(x, i, "list");
      if (fuera) throw err("IndexError", "list assignment index out of range");
      x.splice(j, 1);
    }
    function corte(x, i, j, k) {
      const sec = typeof x === "string" || Array.isArray(x);
      if (!sec) throw err("TypeError", `'${tipo(x)}' object is not subscriptable`);
      for (const a of [i, j, k]) if (a != null && !esInt(a)) throw err("TypeError", "slice indices must be integers or None or have an __index__ method");
      const n = x.length, paso = k == null ? 1 : num(k);
      if (paso === 0) throw err("ValueError", "slice step cannot be zero");
      const bajo = paso < 0 ? -1 : 0, alto = paso < 0 ? n - 1 : n;
      const lim = (a, def) => a == null ? def : (a = num(a)) < 0 ? Math.max(a + n, bajo) : Math.min(a, alto);
      const ini = lim(i, paso < 0 ? alto : bajo), fin = lim(j, paso < 0 ? bajo : alto);
      const r = [];
      for (let p = ini; paso > 0 ? p < fin : p > fin; p += paso) r.push(x[p]);
      return typeof x === "string" ? r.join("") : esTupla(x) ? tupla(r) : r;
    }
    const ATRIBUTOS = {
      list: ["append", "pop", "insert", "remove", "index", "count", "extend", "clear", "reverse", "sort", "copy"],
      tuple: ["index", "count"],
      str: ["upper", "lower", "strip", "lstrip", "rstrip", "split", "join", "replace", "startswith", "endswith", "find", "count", "index", "isdigit", "isalpha", "capitalize", "title"],
    };
    function clave(kw) {
      const f = kw.key == null ? (x => x) : kw.key;
      return (a, b) => { const x = f(a), y = f(b); return orden("<", x, y) ? -1 : orden("<", y, x) ? 1 : 0; };
    }
    function ordenar(a, kw) {
      const c = clave(kw);
      const r = [...a].map((x, i) => [x, i]).sort((p, q) => c(p[0], q[0]) || p[1] - q[1]).map(p => p[0]);
      if (kw.reverse) { const g = [...a].map((x, i) => [x, i]).sort((p, q) => -c(p[0], q[0]) || p[1] - q[1]).map(p => p[0]); return g; }
      return r;
    }
    function metodo(o, nombre, nombreJS, args) {
      const t = tipo(o);
      if (ATRIBUTOS[t] || o == null || typeof o !== "object" && typeof o !== "function") {
        if (!(ATRIBUTOS[t] || []).includes(nombre)) throw err("AttributeError", `'${t}' object has no attribute '${nombre}'`);
        const kw = quitarKW(nombre, args, nombre === "sort" ? ["key", "reverse"] : nombre === "split" ? ["sep", "maxsplit"] : []);
        const aridad = (min, max) => { if (args.length < min || args.length > max) throw err("TypeError", `${nombre}() takes ${min === max ? (min === 0 ? "no arguments" : `exactly ${min} argument${min === 1 ? "" : "s"}`) : `at most ${max} arguments`} (${args.length} given)`); };
        const str1 = (x, que) => { if (typeof x !== "string") throw err("TypeError", `${que} arg must be None or str`); return x; };
        if (t === "list") switch (nombre) {
          case "append": aridad(1, 1); o.push(args[0]); return null;
          case "pop": {
            aridad(0, 1);
            if (!o.length) throw err("IndexError", "pop from empty list");
            const { j, fuera } = indice(o, args.length ? args[0] : -1, "list");
            if (fuera) throw err("IndexError", "pop index out of range");
            return o.splice(j, 1)[0];
          }
          case "insert": { aridad(2, 2); if (!esInt(args[0])) throw err("TypeError", `'${tipo(args[0])}' object cannot be interpreted as an integer`); let i = num(args[0]); if (i < 0) i = Math.max(0, i + o.length); o.splice(Math.min(i, o.length), 0, args[1]); return null; }
          case "remove": { aridad(1, 1); const i = o.findIndex(x => eq(x, args[0])); if (i < 0) throw err("ValueError", "list.remove(x): x not in list"); o.splice(i, 1); return null; }
          case "extend": aridad(1, 1); o.push(...iter(args[0])); return null;
          case "clear": aridad(0, 0); o.length = 0; return null;
          case "reverse": aridad(0, 0); o.reverse(); return null;
          case "sort": { aridad(0, 0); const r = ordenar(o, kw); o.length = 0; o.push(...r); return null; }
          case "copy": aridad(0, 0); return [...o];
        }
        if (t === "list" || t === "tuple") switch (nombre) {
          case "index": { aridad(1, 1); const i = o.findIndex(x => eq(x, args[0])); if (i < 0) throw err("ValueError", `${t === "list" ? repr(args[0]) + " is not in list" : "tuple.index(x): x not in tuple"}`); return i; }
          case "count": aridad(1, 1); return o.filter(x => eq(x, args[0])).length;
        }
        if (t === "str") switch (nombre) {
          case "upper": aridad(0, 0); return o.toUpperCase();
          case "lower": aridad(0, 0); return o.toLowerCase();
          case "capitalize": aridad(0, 0); return o.charAt(0).toUpperCase() + o.slice(1).toLowerCase();
          case "title": aridad(0, 0); return o.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
          case "strip": case "lstrip": case "rstrip": {
            aridad(0, 1);
            const c = args[0] == null ? null : str1(args[0], nombre);
            const es = ch => c == null ? /\s/.test(ch) : c.includes(ch);
            let a = 0, b = o.length;
            if (nombre !== "rstrip") while (a < b && es(o[a])) a++;
            if (nombre !== "lstrip") while (b > a && es(o[b - 1])) b--;
            return o.slice(a, b);
          }
          case "split": {
            const sep = args.length ? args[0] : kw.sep ?? null, max = args.length > 1 ? num(args[1]) : kw.maxsplit ?? -1;
            if (sep === "") throw err("ValueError", "empty separator");
            if (sep == null) { const p = o.trim().split(/\s+/).filter(Boolean); return max >= 0 && p.length > max + 1 ? [...p.slice(0, max), o.trim().split(/\s+/).slice(max).join(" ")] : p; }
            const p = o.split(str1(sep, "split"));
            return max >= 0 && p.length > max + 1 ? [...p.slice(0, max), p.slice(max).join(sep)] : p;
          }
          case "join": {
            aridad(1, 1);
            const xs = [...iter(args[0])];
            xs.forEach((x, i) => { if (typeof x !== "string") throw err("TypeError", `sequence item ${i}: expected str instance, ${tipo(x)} found`); });
            return xs.join(o);
          }
          case "replace": { aridad(2, 3); const [a, b, c = -1] = args; str1(a, "replace"); str1(b, "replace"); let r = o, n = num(c); if (n < 0) return o.split(a).join(b); const p = o.split(a); return p.length - 1 <= n ? p.join(b) : p.slice(0, n + 1).join(b) + a + p.slice(n + 1).join(a); }
          case "startswith": aridad(1, 1); return o.startsWith(str1(args[0], "startswith"));
          case "endswith": aridad(1, 1); return o.endsWith(str1(args[0], "endswith"));
          case "find": aridad(1, 1); return o.indexOf(str1(args[0], "find"));
          case "index": { aridad(1, 1); const i = o.indexOf(str1(args[0], "index")); if (i < 0) throw err("ValueError", "substring not found"); return i; }
          case "count": aridad(1, 1); return str1(args[0], "count") === "" ? o.length + 1 : o.split(args[0]).length - 1;
          case "isdigit": aridad(0, 0); return o.length > 0 && /^\d+$/.test(o);
          case "isalpha": aridad(0, 0); return o.length > 0 && /^\p{L}+$/u.test(o);
        }
        throw err("AttributeError", `'${t}' object has no attribute '${nombre}'`);
      }
      const f = o[nombreJS] !== undefined ? o[nombreJS] : o[nombre];
      if (typeof f !== "function") throw err("AttributeError", `'${tipo(o)}' object has no attribute '${nombre}'`);
      if (args.length && args[args.length - 1] instanceof KW) throw err("TypeError", `${nombre}() no acepta argumentos con nombre`);
      return f.apply(o, args);
    }
    function attr(o, nombre, nombreJS) {
      if (o == null || typeof o !== "object" || Array.isArray(o)) {
        if (o != null && ATRIBUTOS[tipo(o)] && ATRIBUTOS[tipo(o)].includes(nombre)) return (...a) => metodo(o, nombre, nombre, a);
        throw err("AttributeError", `'${tipo(o)}' object has no attribute '${nombre}'`);
      }
      if (nombreJS in o) return o[nombreJS];
      if (nombre in o) return o[nombre];
      throw err("AttributeError", `'${tipo(o)}' object has no attribute '${nombre}'`);
    }
    const kw = o => new KW(o);
    function entero(x, base) {
      if (base !== undefined) {
        if (typeof x !== "string") throw err("TypeError", "int() can't convert non-string with explicit base");
        const t = x.trim().replace(/_/g, ""), n = parseInt(t, num(base));
        if (!t || Number.isNaN(n) || !new RegExp(`^[+-]?[0-9a-z]+$`, "i").test(t)) throw err("ValueError", `invalid literal for int() with base ${base}: ${repr(x)}`);
        return n;
      }
      if (esNum(x)) { if (!Number.isFinite(num(x))) throw err(Number.isNaN(x) ? "ValueError" : "OverflowError", Number.isNaN(x) ? "cannot convert float NaN to integer" : "cannot convert float infinity to integer"); return Math.trunc(num(x)); }
      if (typeof x === "string") {
        const t = x.trim();
        if (!/^[+-]?\d(_?\d)*$/.test(t)) throw err("ValueError", `invalid literal for int() with base 10: ${repr(x)}`);
        return parseInt(t.replace(/_/g, ""), 10);
      }
      throw err("TypeError", `int() argument must be a string, a bytes-like object or a real number, not '${tipo(x)}'`);
    }
    function flotante(x) {
      if (esNum(x)) return num(x);
      if (typeof x === "string") {
        const t = x.trim().toLowerCase();
        if (/^[+-]?(inf|infinity)$/.test(t)) return t.startsWith("-") ? -Infinity : Infinity;
        if (/^[+-]?nan$/.test(t)) return NaN;
        if (!/^[+-]?(\d(_?\d)*(\.(\d(_?\d)*)?)?|\.\d(_?\d)*)(e[+-]?\d+)?$/.test(t)) throw err("ValueError", `could not convert string to float: ${repr(x)}`);
        return parseFloat(t.replace(/_/g, ""));
      }
      throw err("TypeError", `float() argument must be a string or a real number, not '${tipo(x)}'`);
    }
    function extremo(nombre, menor, args) {
      const k = quitarKW(nombre, args, ["key", "default"]);
      const xs = args.length === 1 ? [...iter(args[0])] : args;
      if (!xs.length) { if ("default" in k) return k.default; throw err("ValueError", `${nombre}() iterable argument is empty`); }
      const f = k.key == null ? (x => x) : k.key;
      let mejor = xs[0], fm = f(mejor);
      for (const x of xs.slice(1)) { const fx = f(x); if (menor ? orden("<", fx, fm) : orden(">", fx, fm)) { mejor = x; fm = fx; } }
      return mejor;
    }
    const sinKW = (nombre, args) => { quitarKW(nombre, args); return args; };
    const B = {
      len: (...a) => { sinKW("len", a); if (a.length !== 1) throw err("TypeError", `len() takes exactly one argument (${a.length} given)`); return len(a[0]); },
      range: (...a) => rango(...sinKW("range", a)),
      str: (...a) => { sinKW("str", a); return a.length ? str(a[0]) : ""; },
      int: (...a) => { sinKW("int", a); return a.length ? entero(a[0], a[1]) : 0; },
      float: (...a) => { sinKW("float", a); return a.length ? flotante(a[0]) : 0; },
      bool: (...a) => { sinKW("bool", a); return a.length ? v(a[0]) : false; },
      abs: (...a) => { sinKW("abs", a); if (!esNum(a[0])) throw err("TypeError", `bad operand type for abs(): '${tipo(a[0])}'`); return Math.abs(num(a[0])); },
      min: (...a) => extremo("min", true, a),
      max: (...a) => extremo("max", false, a),
      round: (...a) => {
        sinKW("round", a);
        if (!esNum(a[0])) throw err("TypeError", `type ${tipo(a[0])} doesn't define __round__ method`);
        return a.length > 1 && a[1] != null ? redondear(num(a[0]), num(a[1])) : redondear(num(a[0]), 0);
      },
      sum: (...a) => { const k = quitarKW("sum", a, ["start"]); let s = a.length > 1 ? a[1] : k.start ?? 0; if (typeof s === "string") throw err("TypeError", "sum() can't sum strings [use ''.join(seq) instead]"); for (const x of iter(a[0])) s = bin("+", s, x); return s; },
      enumerate: (...a) => { const k = quitarKW("enumerate", a, ["start"]); const ini = a.length > 1 ? num(a[1]) : num(k.start ?? 0); return [...iter(a[0])].map((x, i) => tupla([ini + i, x])); },
      list: (...a) => { sinKW("list", a); return a.length ? [...iter(a[0])] : []; },
      sorted: (...a) => { const k = quitarKW("sorted", a, ["key", "reverse"]); return ordenar([...iter(a[0])], k); },
      reversed: (...a) => { sinKW("reversed", a); return [...iter(a[0])].reverse(); },
      any: (...a) => { sinKW("any", a); return [...iter(a[0])].some(v); },
      all: (...a) => { sinKW("all", a); return [...iter(a[0])].every(v); },
      repr: (...a) => { sinKW("repr", a); return repr(a[0]); },
    };
    for (const [k, f] of Object.entries(B)) f.__nombre = k;
    // Mensajes de error al estilo de Python para lo que lanza el propio JS.
    function mensaje(e) {
      const m = String((e && e.message) || e).replace(/\$(?=[A-Za-z_])/g, "");
      if (e instanceof ErrorPython) return m;
      if (e && e.__linea !== undefined) return m;
      let r;
      if ((r = m.match(/^(\S+) is not defined$/))) return `NameError: name '${r[1]}' is not defined`;
      if ((r = m.match(/^Cannot read properties of (null|undefined) \(reading '([^']*)'\)$/))) return `AttributeError: 'NoneType' object has no attribute '${r[2]}'`;
      if ((r = m.match(/^(.+) is not a function$/))) return `TypeError: '${r[1].replace(/^__py\./, "")}' is not callable`;
      if ((r = m.match(/^Cannot access '([^']*)' before initialization$/))) return `UnboundLocalError: cannot access local variable '${r[1]}' where it is not associated with a value`;
      if (/Maximum call stack size exceeded/.test(m)) return "RecursionError: maximum recursion depth exceeded";
      return m;
    }
    return { v, bin, aug, un, cmp, idx, poner, borrar, corte, metodo, attr, iter, desempacar, tupla, def, kw, imprimir, formato, mensaje, ...B };
  }

  const cache = new Map();
  function traducirCache(texto, opciones) {
    const k = String(texto);
    if (cache.has(k) && cache.get(k).opciones === opciones) return cache.get(k).r;
    const r = traducir(texto, opciones);
    if (cache.size > 20) cache.clear();
    cache.set(k, { opciones, r });
    return r;
  }
  const api = { traducir, traducirCache, preludio };
  if (typeof window !== "undefined") window.CMGPythonJS = api;
  if (typeof module !== "undefined") module.exports = api;
})();
