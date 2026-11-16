import { BUILTINS, CONSOLA, PUNTUACION, NO_SOPORTADO, COMPARA, LBP, falla, util, Ambito } from './python-base.js';

/** @param {Record<string, any>} contexto */
export function crearExpresiones({src, txt, nombreHueco, resolver, jsNombre, funciones, miembros, objetos, propiedades, noSoportado, temp, ligar, declaraciones, parametros}) {
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
      return `__py.def("<lambda>", ${JSON.stringify(ps.nombres)}, ${ps.obligatorios}, ${ps.estrella}, [${ps.defectos.map(([i, v]) => `[${i}, ${v}]`).join(", ")}], (${ps.js.join(", ")}) => { ${declaraciones(hijo)}return ${e}; })`;
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
  return { verdad, tupla, expr, subindice, miembroJS };
}
