  const OPERADORES = ["===", "!==", "**=", "...", ">>>", "<<=", ">>=", "&&=", "||=", "??=", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "=>",
    "++", "--", "+=", "-=", "*=", "/=", "%=", "**", "<<", ">>", "&=", "|=", "^="];
  const COMPLETOS = new Set(OPERADORES);
  const PREFIJOS = new Set(OPERADORES.flatMap(o => [...o].map((_, i) => o.slice(0, i + 1))));
  const PREC = { "??": 1, "||": 2, "&&": 3, "|": 4, "^": 5, "&": 6, "==": 7, "!=": 7, "===": 7, "!==": 7, "<": 8, ">": 8, "<=": 8, ">=": 8,
    in: 8, of: 8, instanceof: 8, "<<": 9, ">>": 9, ">>>": 9, "+": 10, "-": 10, "*": 11, "/": 11, "%": 11, "**": 12 };
  const ASIGNA = new Set(["=", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", "&=", "|=", "^=", "&&=", "||=", "??="]);
  const UNARIOS = new Set(["!", "-", "+", "~", "++", "--", "...", "typeof", "void", "delete", "await", "new"]);
  const LITERALES = new Set(["true", "false", "null", "undefined", "this", "NaN", "Infinity"]);
  const SENTENCIAS = new Set(["if", "else", "while", "do", "for", "const", "let", "var", "return", "break", "continue", "throw",
    "switch", "case", "default", "try", "catch", "finally", "class", "function"]);
  const CLAVES = new Set([...SENTENCIAS, ...UNARIOS, "in", "of", "instanceof"]);
  const LOGICOS = new Set(["&&", "||", "??"]);
  const COMPARA = new Set(["==", "!=", "===", "!==", "<", ">", "<=", ">="]);
  // Sentencias que ocupan líneas: se agarran por el número de línea y se mueven enteras.
  const DE_LINEA = new Set(["sentencia", "decl", "si", "sino", "mientras", "hacer", "para", "salto", "bloque", "funcion", "error"]);
  // Solo dentro de estos se puede soltar una línea sin partir otra construcción.
  const CONTENEDORES = new Set(["programa", "bloque", "cuerpo"]);
  const HOJAS = new Set(["id", "num", "str", "lit", "hueco"]);

  function analizar(src, lex) {
    // Fichas con posición. Las significativas omiten espacios y comentarios, salvo los comentarios
    // de una línea /* … */, que hacen de valor (los huecos de las plantillas).
    const todas = [];
    let off = 0;
    for (const [k, v] of lex) { todas.push({ k, v, a: off, b: off + v.length }); off += v.length; }
    const sig = [];
    let nl = true;
    for (let i = 0; i < todas.length; i++) {
      const f = todas[i];
      if (f.k === "nl") { nl = true; continue; }
      if (f.k === "esp") continue;
      if (f.k === "com") {
        if (f.v.startsWith("/*") && f.v.endsWith("*/") && f.v.length >= 4 && !f.v.includes("\n")) { sig.push({ k: "hueco", v: f.v, a: f.a, b: f.b, nl }); nl = false; }
        else if (f.v.includes("\n")) nl = true;
        continue;
      }
      if (f.k === "p") {
        // El léxico entrega los signos de uno en uno: se juntan en el operador más largo.
        let v = f.v, j = i;
        while (j + 1 < todas.length && todas[j + 1].k === "p" && PREFIJOS.has(v + todas[j + 1].v)) { j++; v += todas[j].v; }
        while (v.length > 1 && !COMPLETOS.has(v)) { v = v.slice(0, -1); j--; }
        sig.push({ k: "p", v, a: f.a, b: todas[j].b, nl }); nl = false; i = j;
        continue;
      }
      sig.push({ k: f.k, v: f.v, a: f.a, b: f.b, nl }); nl = false;
    }
    // Pares de delimitadores; un cierre sin apertura se ignora.
    const par = new Array(sig.length).fill(-1), pila = [];
    sig.forEach((f, i) => {
      if (f.k !== "p") return;
      if (f.v === "(" || f.v === "[" || f.v === "{") pila.push(i);
      else if (f.v === ")" || f.v === "]" || f.v === "}") {
        const abre = "([{"[")]}".indexOf(f.v)];
        for (let s = pila.length - 1; s >= 0; s--) if (sig[pila[s]].v === abre) { par[pila[s]] = i; par[i] = pila[s]; pila.length = s; break; }
      }
    });

    const nodos = [], duenos = new Map(), hojas = new Map();
    let p = 0;
    const nodo = (k, ia, ib, h = [], extra) => {
      const n = { k, a: sig[ia].a, b: sig[ib].b, ia, ib, h: h.filter(Boolean), padre: null, ...extra };
      for (const c of n.h) c.padre = n;
      nodos.push(n);
      if (ia === ib && HOJAS.has(k)) hojas.set(ia, n);
      return n;
    };
    // Las palabras clave, operadores y delimitadores pertenecen a la construcción que forman.
    const propias = (n, ...idx) => { for (const i of idx) if (i >= 0 && !duenos.has(i)) duenos.set(i, n); return n; };
    const es = (v, lim) => p < lim && sig[p].k === "p" && sig[p].v === v;
    const esPal = (v, lim) => p < lim && sig[p].k === "id" && sig[p].v === v;
    const cierre = (i, lim) => par[i] > i && par[i] < lim ? par[i] : -1;
    const finDeLinea = (i, lim) => { let j = i + 1; while (j < lim && !sig[j].nl) j++; return j; };
    const error = () => { const n = propias(nodo("error", p, p), p); p++; return n; };
    const vacio = (i, j) => { const n = { k: "vacio", a: sig[i].b, b: sig[j].a, ia: i, ib: j, h: [], padre: null, sel: false }; nodos.push(n); return n; };

    function sentencias(lim) {
      const out = [];
      while (p < lim) {
        const i = p, s = sentencia(lim);
        if (s) out.push(s);
        if (p === i) out.push(error());
      }
      return out;
    }
    function sentencia(lim) {
      const f = sig[p];
      if (f.k === "p") {
        if (f.v === ";") { p++; return null; }
        if (f.v === "{") return bloque(lim, true);
        if (f.v === "}" || f.v === ")" || f.v === "]") return null;
      }
      if (f.k === "id") switch (f.v) {
        case "if": return si(lim);
        case "while": return mientras(lim);
        case "do": return hacer(lim);
        case "for": return para(lim);
        case "const": case "let": case "var": return declaracion(lim, true);
        case "return": case "throw": case "break": case "continue": return salto(lim);
        case "function": return funcion(lim);
        case "else": return null;
      }
      const i0 = p, e = expresion(lim, true);
      if (!e) return null;
      const i1 = es(";", lim) ? p++ : p - 1;
      return propias(nodo("sentencia", i0, i1, [e]), sig[i1].k === "p" && sig[i1].v === ";" ? i1 : -1);
    }
    function bloque(lim, suelto) {
      const i0 = p, j = cierre(p, lim);
      p++;
      const dentro = sentencias(j >= 0 ? j : lim);
      let i1 = Math.max(i0, p - 1);
      if (j >= 0) { p = j + 1; i1 = j; }
      const h = dentro.length > 1 ? [nodo("cuerpo", dentro[0].ia, dentro[dentro.length - 1].ib, dentro)] : dentro;
      return propias(nodo("bloque", i0, i1, h, { sel: suelto }), i0, j);
    }
    // El cuerpo de if/while/for no se elige como { … }: un toque en sus llaves elige la sentencia entera.
    function cuerpoDe(lim) {
      const s = p < lim ? sentencia(lim) : null;
      if (s && s.k === "bloque") s.sel = false;
      return s;
    }
    function cabecera(lim) {
      if (!es("(", lim)) return { e: null, ia: -1, ic: -1, resto: [] };
      const ia = p, ic = cierre(p, lim), fin = ic >= 0 ? ic : finDeLinea(p, lim);
      p++;
      const e = expresion(fin, true), resto = restos(fin);
      if (ic >= 0) p = ic + 1;
      return { e, ia, ic, resto };
    }
    // Lo que sobra dentro de un paréntesis se conserva como nodos sueltos.
    function restos(fin) {
      const out = [];
      while (p < fin) {
        const i = p, x = asignacion(fin);
        if (x) out.push(x);
        if (p === i) out.push(error());
      }
      return out;
    }
    function si(lim) {
      const i0 = p; p++;
      const c = cabecera(lim), cons = cuerpoDe(lim);
      let alt = null;
      if (esPal("else", lim)) {
        const ie = p; p++;
        const s = cuerpoDe(lim);
        alt = propias(nodo("sino", ie, s ? s.ib : ie, [s]), ie);
      }
      const ult = alt || cons;
      return propias(nodo("si", i0, ult ? ult.ib : c.ic >= 0 ? c.ic : i0, [c.e, ...c.resto, cons, alt], { cond: c.e }), i0, c.ia, c.ic);
    }
    function mientras(lim) {
      const i0 = p; p++;
      const c = cabecera(lim), cuerpo = cuerpoDe(lim);
      return propias(nodo("mientras", i0, cuerpo ? cuerpo.ib : c.ic >= 0 ? c.ic : i0, [c.e, ...c.resto, cuerpo], { cond: c.e }), i0, c.ia, c.ic);
    }
    function hacer(lim) {
      const i0 = p; p++;
      const cuerpo = cuerpoDe(lim);
      let iw = -1, ipc = -1, c = { e: null, ia: -1, ic: -1, resto: [] };
      if (esPal("while", lim)) { iw = p; p++; c = cabecera(lim); if (es(";", lim)) ipc = p++; }
      const i1 = ipc >= 0 ? ipc : c.ic >= 0 ? c.ic : iw >= 0 ? iw : cuerpo ? cuerpo.ib : i0;
      return propias(nodo("hacer", i0, i1, [cuerpo, c.e, ...c.resto], { cond: c.e }), i0, iw, c.ia, c.ic, ipc);
    }
    function para(lim) {
      const i0 = p; p++;
      const h = [], marcas = [];
      let ia = -1, ic = -1;
      if (es("(", lim)) {
        ia = p; ic = cierre(p, lim);
        const fin = ic >= 0 ? ic : finDeLinea(p, lim);
        p++;
        while (p < fin) {
          if (es(";", fin)) { marcas.push(p); p++; continue; }
          const i = p, x = esPal("const", fin) || esPal("let", fin) || esPal("var", fin) ? declaracion(fin, false) : expresion(fin, true);
          if (x) h.push(x);
          if (p === i) h.push(error());
        }
        if (ic >= 0) p = ic + 1;
      }
      const cuerpo = cuerpoDe(lim);
      return propias(nodo("para", i0, cuerpo ? cuerpo.ib : ic >= 0 ? ic : i0, [...h, cuerpo]), i0, ia, ic, ...marcas);
    }
    function declaracion(lim, conFin) {
      const i0 = p; p++;
      const h = [], marcas = [];
      while (p < lim) {
        const patron = primaria(lim);
        if (!patron) break;
        h.push(patron);
        if (es("=", lim) || esPal("of", lim) || esPal("in", lim)) { marcas.push(p); p++; const v = asignacion(lim); if (v) h.push(v); }
        if (es(",", lim)) { marcas.push(p); p++; continue; }
        break;
      }
      let i1 = h.length ? h[h.length - 1].ib : i0;
      if (marcas.length && marcas[marcas.length - 1] > i1) i1 = marcas[marcas.length - 1];
      if (conFin && es(";", lim)) { marcas.push(p); i1 = p; p++; }
      return propias(nodo("decl", i0, i1, h), i0, ...marcas);
    }
    function salto(lim) {
      const i0 = p, palabra = sig[p].v; p++;
      let e = null, ipc = -1;
      if ((palabra === "return" || palabra === "throw") && p < lim && !sig[p].nl && !es(";", lim) && !es("}", lim)) e = expresion(lim, true);
      let i1 = e ? e.ib : i0;
      if (es(";", lim)) { ipc = p; i1 = p; p++; }
      return propias(nodo("salto", i0, i1, [e]), i0, ipc);
    }
    function funcion(lim) {
      const i0 = p; p++;
      if (es("*", lim)) p++;
      let nombre = null;
      if (p < lim && sig[p].k === "id" && !SENTENCIAS.has(sig[p].v)) { nombre = nodo("id", p, p); p++; }
      const ar = es("(", lim) ? argumentos(lim, true) : { args: [], extra: [], ia: -1, ic: -1, comas: [] };
      const cuerpo = es("{", lim) ? bloque(lim, false) : null;
      return propias(nodo("funcion", i0, cuerpo ? cuerpo.ib : ar.ic >= 0 ? ar.ic : i0, [nombre, ...ar.args, ...ar.extra, cuerpo]), i0, ar.ia, ar.ic, ...ar.comas);
    }

    function expresion(lim, coma) {
      const e = asignacion(lim);
      if (!e || !coma || !es(",", lim)) return e;
      const h = [e], comas = [];
      while (es(",", lim)) { comas.push(p); p++; const x = asignacion(lim); if (!x) break; h.push(x); }
      return propias(nodo("secuencia", e.ia, Math.max(h[h.length - 1].ib, comas[comas.length - 1]), h), ...comas);
    }
    function asignacion(lim) {
      if (p >= lim) return null;
      const ic = cierre(p, lim);
      if ((sig[p].k === "id" && !CLAVES.has(sig[p].v) && p + 1 < lim && sig[p + 1].v === "=>") || (es("(", lim) && ic >= 0 && ic + 1 < lim && sig[ic + 1].v === "=>")) return flecha(lim);
      const izq = condicional(lim);
      if (!izq) return null;
      if (p < lim && sig[p].k === "p" && ASIGNA.has(sig[p].v)) {
        const io = p; p++;
        const der = asignacion(lim);
        return propias(nodo("asignacion", izq.ia, der ? der.ib : io, [izq, der], { op: sig[io].v }), io);
      }
      return izq;
    }
    function flecha(lim) {
      const i0 = p;
      let params = [], ar = null;
      if (es("(", lim)) { ar = argumentos(lim, true); params = [...ar.args, ...ar.extra]; }
      else { params = [nodo("id", p, p)]; p++; }
      const io = p; p++;
      const cuerpo = es("{", lim) ? bloque(lim, false) : asignacion(lim);
      return propias(nodo("flecha", i0, cuerpo ? cuerpo.ib : io, [...params, cuerpo]), io, ar ? ar.ia : -1, ar ? ar.ic : -1, ...(ar ? ar.comas : []));
    }
    function condicional(lim) {
      const c = binaria(lim, 1);
      if (!c || !es("?", lim)) return c;
      const iq = p; p++;
      const si = asignacion(lim);
      let no = null, ic = -1;
      if (es(":", lim)) { ic = p; p++; no = asignacion(lim); }
      const fin = no || si;
      return propias(nodo("ternaria", c.ia, fin ? fin.ib : ic >= 0 ? ic : iq, [c, si, no]), iq, ic);
    }
    function binaria(lim, min) {
      let izq = unaria(lim);
      if (!izq) return null;
      while (p < lim) {
        const f = sig[p];
        const op = f.k === "p" || (f.k === "id" && (f.v === "in" || f.v === "of" || f.v === "instanceof")) ? f.v : null;
        if (op == null || !Object.hasOwn(PREC, op) || PREC[op] < min) break;
        const io = p; p++;
        const der = binaria(lim, op === "**" ? PREC[op] : PREC[op] + 1);
        izq = propias(nodo("binaria", izq.ia, der ? der.ib : io, [izq, der], { op }), io);
      }
      return izq;
    }
    function unaria(lim) {
      if (p >= lim) return null;
      const f = sig[p];
      if ((f.k === "p" || f.k === "id") && UNARIOS.has(f.v)) {
        const io = p; p++;
        const x = unaria(lim);
        return propias(nodo("unaria", io, x ? x.ib : io, [x], { op: f.v }), io);
      }
      return postfija(lim);
    }
    function postfija(lim) {
      let e = primaria(lim);
      if (!e) return null;
      while (p < lim) {
        const f = sig[p];
        if (f.k !== "p" || ((f.v === "(" || f.v === "[") && f.nl)) break;   // una línea nueva empieza otra sentencia
        if (f.v === "." || f.v === "?.") {
          const io = p; p++;
          if (p < lim && sig[p].k === "id") {
            const nom = nodo("id", p, p, [], { prop: true }); p++;
            if (es("(", lim) && !sig[p].nl) {
              // obj.metodo(args): «metodo(args)» es un nivel propio entre el argumento y la llamada entera.
              const ar = argumentos(lim), fin = ar.ic >= 0 ? ar.ic : ar.ultimo;
              const met = nodo("metodo", nom.ia, fin, [nom, ...ar.args, ...ar.extra]);
              e = propias(nodo("llamada", e.ia, fin, [e, met], { nombre: nom, args: ar.args }), io, ar.ia, ar.ic, ...ar.comas);
              met.llamada = e;
              continue;
            }
            e = propias(nodo("miembro", e.ia, nom.ib, [e, nom]), io);
            continue;
          }
          e = propias(nodo("miembro", e.ia, io, [e]), io);
          continue;
        }
        if (f.v === "(") {
          const ar = argumentos(lim), fin = ar.ic >= 0 ? ar.ic : ar.ultimo;
          const nombre = e.k === "id" ? e : e.k === "miembro" && e.h[1] ? e.h[1] : null;
          e = propias(nodo("llamada", e.ia, fin, [e, ...ar.args, ...ar.extra], { nombre, args: ar.args }), ar.ia, ar.ic, ...ar.comas);
          continue;
        }
        if (f.v === "[") {
          const ia = p, ic = cierre(p, lim), fin = ic >= 0 ? ic : finDeLinea(p, lim);
          p++;
          const x = expresion(fin, true), resto = restos(fin);
          if (ic >= 0) p = ic + 1;
          e = propias(nodo("miembro", e.ia, ic >= 0 ? ic : Math.max(ia, p - 1), [e, x, ...resto]), ia, ic);
          continue;
        }
        if ((f.v === "++" || f.v === "--") && !f.nl) { const io = p; p++; e = propias(nodo("unaria", e.ia, io, [e], { op: f.v }), io); continue; }
        break;
      }
      return e;
    }
    // Argumentos de una llamada o elementos de una lista. Un hueco sin valor ( ), (a, ) o [ ]
    // queda como nodo «vacio»: ahí se puede soltar o elegir un valor.
    function argumentos(lim, sinVacios = false) {
      const ia = p, ic = cierre(p, lim), fin = ic >= 0 ? ic : finDeLinea(p, lim);
      p++;
      const args = [], extra = [], comas = [];
      let previo = ia, hay = false;
      while (p < fin) {
        if (es(",", fin)) {
          if (!hay && !sinVacios) args.push(vacio(previo, p));
          comas.push(p); previo = p; p++; hay = false;
          continue;
        }
        const i = p, x = asignacion(fin);
        if (x) { if (hay) extra.push(x); else args.push(x); hay = true; }
        if (p === i) { extra.push(error()); hay = true; }
      }
      if (!hay && !sinVacios && ic >= 0) args.push(vacio(previo, ic));
      const ultimo = Math.max(ia, p - 1);
      if (ic >= 0) p = ic + 1;
      return { args, extra, ia, ic, comas, ultimo };
    }
    function primaria(lim) {
      if (p >= lim) return null;
      const f = sig[p];
      if (f.k === "id") {
        if (f.v === "function") return funcion(lim);
        if (SENTENCIAS.has(f.v)) return null;
        p++;
        return nodo(LITERALES.has(f.v) ? "lit" : "id", p - 1, p - 1);
      }
      if (f.k === "num" || f.k === "str" || f.k === "hueco") { p++; return nodo(f.k, p - 1, p - 1); }
      if (f.k !== "p") return null;
      if (f.v === "(") {
        const ia = p, ic = cierre(p, lim), fin = ic >= 0 ? ic : finDeLinea(p, lim);
        p++;
        const x = expresion(fin, true), resto = restos(fin);
        if (ic >= 0) p = ic + 1;
        return propias(nodo("grupo", ia, ic >= 0 ? ic : Math.max(ia, p - 1), [x, ...resto]), ia, ic);
      }
      if (f.v === "[") {
        const ar = argumentos(lim);
        return propias(nodo("lista", ar.ia, ar.ic >= 0 ? ar.ic : ar.ultimo, [...ar.args, ...ar.extra], { args: ar.args }), ar.ia, ar.ic, ...ar.comas);
      }
      if (f.v === "{") return objeto(lim);
      return null;
    }
    function objeto(lim) {
      const ia = p, ic = cierre(p, lim), fin = ic >= 0 ? ic : lim;
      p++;
      const h = [], marcas = [];
      while (p < fin) {
        if (es(",", fin)) { marcas.push(p); p++; continue; }
        const i = p;
        let clave = null;
        if (sig[p].k === "id" || sig[p].k === "str" || sig[p].k === "num") { clave = nodo(sig[p].k === "id" ? "id" : sig[p].k, p, p, [], { prop: true }); p++; }
        else if (es("[", fin)) clave = primaria(fin);
        if (clave && es(":", fin)) { const ip = p; p++; const v = asignacion(fin); h.push(propias(nodo("prop", clave.ia, v ? v.ib : ip, [clave, v]), ip)); }
        else if (clave) h.push(clave);
        while (p < fin && !es(",", fin)) { const j = p, x = asignacion(fin); if (x) h.push(x); if (p === j) h.push(error()); }
        if (p === i) h.push(error());
      }
      if (ic >= 0) p = ic + 1;
      return propias(nodo("objeto", ia, ic >= 0 ? ic : Math.max(ia, p - 1), h), ia, ic, ...marcas);
    }

    const tope = sentencias(sig.length);
    const raiz = { k: "programa", a: 0, b: src.length, ia: 0, ib: sig.length - 1, h: tope, padre: null };
    for (const n of tope) n.padre = raiz;
    nodos.push(raiz);
    const lineas = [0];
    for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineas.push(i + 1);
    return { src, todas, sig, par, nodos, raiz, duenos, hojas, lineas };
  }


export { analizar, CLAVES, LOGICOS, COMPARA, DE_LINEA, CONTENEDORES, HOJAS };
