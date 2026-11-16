import { RESERVADAS_JS, DUNDER, PUNTUACION, NO_SOPORTADO, ARITMETICA, Diagnostico, falla, plano, util, Ambito } from './python-base.js';
import { crearExpresiones } from './python-expresiones.js';
import { preludio } from './python-preludio.js';

/** @param {{ lezer?: any, hueco?: (nombre: string) => string | null }} [dependencias] */
export function crearPython({ lezer, hueco } = {}) {
  function traducir(texto, opciones = {}) {
    const src = String(texto).replace(/\r\n?/g, "\n");
    const L = lezer;
    if (!L) return { ok: false, js: "", diagnosticos: [{ linea: null, columna: null, mensaje: "Python no está disponible: falta el analizador." }] };
    const inicios = [0];
    for (let i = 0; i < src.length; i++) if (src[i] === "\n") inicios.push(i + 1);
    const lineaDe = pos => { let lo = 0, hi = inicios.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (inicios[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; };
    const txt = n => src.slice(n.a, n.b);
    const nombreHueco = opciones.hueco || hueco || (t => /^__[a-z][a-z0-9_]*__$/.test(t) && !DUNDER.test(t) ? t.slice(2, -2).replace(/_/g, " ") : null);
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
    const jsNombre = n => reservadas.has(n) || n === "__r" || /^__t\d+$/.test(n) ? "$" + n : n;

    let raiz;
    try { raiz = plano(L.parser.parse(src)); }
    catch (e) { return { ok: false, js: "", diagnosticos: [{ linea: null, columna: null, mensaje: "No se pudo analizar el programa: " + e.message }] }; }

    const salida = Array.from({ length: inicios.length }, () => "");
    const emitir = (pos, t) => { const i = lineaDe(pos) - 1; salida[i] += (salida[i] && !/[\s{(]$/.test(salida[i]) ? " " : "") + t; };
    const finDe = n => { let b = n.b; while (b > n.a && /\s/.test(src[b - 1])) b--; return Math.max(n.a, b - 1); };
    const ambitos = new Map();
    const marcas = [];

    const { verdad, tupla, expr, subindice, miembroJS } = crearExpresiones({ src, txt, nombreHueco, resolver, jsNombre, funciones, miembros, objetos, propiedades, noSoportado, temp, ligar, declaraciones, parametros });

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
      /** @type {any} */
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
      const nombres = [], js = [], defectos = [];
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
        if (h[i + 1] && h[i + 1].t === "AssignOp") { conDefecto = true; defectos.push([nombres.length - 1, expr(h[i + 2], amb)]); js.push(jsNombre(x)); i += 2; }
        else { if (conDefecto) falla(p.a, "SyntaxError: parameter without a default follows parameter with a default"); obligatorios++; js.push(jsNombre(x)); }
      }
      return { nombres, js, obligatorios, estrella, defectos };
    }
    function definir(s, amb) {
      const hijo = ambitos.get(s), nombre = s.h.find(h => h.t === "VariableName"), esAsync = s.h[0].t === "async";
      const ps = parametros(s.h.find(h => h.t === "ParamList"), amb);
      if (s.h.some(h => h.t === "TypeDef")) noSoportado(s.h.find(h => h.t === "TypeDef"));
      hijo.marca = marcas.push(hijo) - 1;
      emitir(s.a, `${nombreLigado(nombre, amb)} = __py.def(${JSON.stringify(txt(nombre))}, ${JSON.stringify(ps.nombres)}, ${ps.obligatorios}, ${ps.estrella}, [${ps.defectos.map(([i, v]) => `[${i}, ${v}]`).join(", ")}], ${esAsync ? "async " : ""}function (${ps.js.join(", ")}) { \u0001${hijo.marca}\u0001`);
      const b = cuerpo(s, hijo, { bucles: 0 });
      cerrar(b, "});");
    }

    // ---------- Expresiones ----------
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
  return { traducir, traducirCache, preludio };
}
export const CMGPythonJS = crearPython();
export { preludio };
