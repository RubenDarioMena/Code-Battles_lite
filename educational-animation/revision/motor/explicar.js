/* Plantillas del modo revisión · del árbol, el catálogo y los valores reales a frases en español.
 *
 * Todo es determinista: no inventa valores. Lo que una plantilla no sabe decir se muestra como código
 * («todavía no tiene explicación»), igual que el seudocódigo deja en JS lo que no traduce.
 *
 * Un texto es una lista de segmentos:
 *   "texto"            texto normal
 *   { b: "texto" }     negrita
 *   { c: id }          fragmento del programa (nodo id): se puede tocar y se colorea con su papel
 *   { k: "código" }    código suelto, sin nodo
 *   { v: valor }       valor de la traza, con su tono (true verde, false rojo, "atascado" rojo…)
 *   { nota: "texto" }  comentario del autor del programa (su intención) *
 *   { br: 1 }          salto de párrafo */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(raiz.CMGCatalogo);
  else raiz.CMGExplicar = fabrica(raiz.CMGCatalogo);
})(typeof globalThis !== "undefined" ? globalThis : self, function (C) {
  "use strict";
  const coma = C.coma;
  const CON_PRUEBA = new Set(["IfStatement", "WhileStatement", "DoWhileStatement", "ForStatement"]);
  const COMPARA = { "<": "es menor que", "<=": "es menor o igual que", ">": "es mayor que", ">=": "es mayor o igual que",
    "===": "es igual a", "==": "es igual a", "!==": "no es igual a", "!=": "no es igual a" };
  const COMPARA_NO = { "<": "no es menor que", "<=": "no es menor o igual que", ">": "no es mayor que", ">=": "no es mayor o igual que",
    "===": "no es igual a", "==": "no es igual a", "!==": "es igual a", "!=": "es igual a" };
  const ARIT = { "+": "más", "-": "menos", "*": "por", "/": "entre", "%": "resto de dividir entre", "**": "elevado a" };
  const TONO_RESULTADO = { ok: "ok", atascado: "bad", sin_misiles: "bad", sin_objetivo: "neutro" };

  // ---------- Programa preparado ----------
  function preparar(programa, { id, serie }) {
    const N = programa.nodos, src = programa.fuente;
    const P = { id, serie, fuente: src, nodos: N, comentarios: programa.comentarios || [], eventos: programa.eventos || [], cache: new Map() };
    P.txt = (i) => src.slice(N[i].a, N[i].b);
    P.hijo = (i, campo) => { const h = N[i].hijos.find(x => N[x].campo === campo); return h === undefined ? null : h; };
    P.hijos = (i, campo) => N[i].hijos.filter(x => N[x].campo === campo);
    P.padre = (i) => N[i].padre;
    P.desciende = (i, de) => { for (let x = i; x != null; x = N[x].padre) if (x === de) return true; return false; };
    // Variables declaradas (const/let/var) y dónde.
    P.variables = new Map();
    for (const n of N) if (n.tipo === "VariableDeclarator") { const nom = P.hijo(n.id, "id"); if (nom != null && N[nom].nombre) P.variables.set(N[nom].nombre, { declarador: n.id, clase: N[N[n.id].padre].clase }); }
    return P;
  }

  // ¿Qué es este nombre o llamada en el juego? → { tipo, def, objeto, propio, clase: 'metodo'|'propiedad' }
  function resolver(P, i) {
    if (P.cache.has(i)) return P.cache.get(i);
    const N = P.nodos, n = N[i];
    let r = null;
    if (n.tipo === "CallExpression") {
      const f = P.hijo(i, "callee");
      if (N[f].tipo === "Identifier") {
        const p = C.propia(N[f].nombre, P.serie, "metodo");
        if (p) r = { ...p, nombre: N[f].nombre, objeto: P.id, propio: true, clase: "metodo" };
      } else if (N[f].tipo === "MemberExpression" && !N[f].computado) {
        const o = P.hijo(f, "object"), pr = P.hijo(f, "property");
        if (N[o].tipo === "Identifier") {
          const t = C.tipoDeObjeto(N[o].nombre);
          if (t && t.metodos[N[pr].nombre]) r = { tipo: t, def: t.metodos[N[pr].nombre], nombre: N[pr].nombre, objeto: t.idDe(N[o].nombre), propio: t.idDe(N[o].nombre) === P.id, clase: "metodo", nodoObjeto: o };
        }
      }
    } else if (n.tipo === "MemberExpression" && !n.computado) {
      const o = P.hijo(i, "object"), pr = P.hijo(i, "property");
      if (N[o].tipo === "Identifier") {
        const t = C.tipoDeObjeto(N[o].nombre);
        if (t && t.propiedades[N[pr].nombre]) r = { tipo: t, def: t.propiedades[N[pr].nombre], nombre: N[pr].nombre, objeto: t.idDe(N[o].nombre), propio: t.idDe(N[o].nombre) === P.id, clase: "propiedad", nodoObjeto: o };
      }
    } else if (n.tipo === "Identifier" && !P.variables.has(n.nombre)) {
      const pa = n.padre != null ? N[n.padre] : null;
      const esCallee = pa && pa.tipo === "CallExpression" && n.campo === "callee";
      const p = C.propia(n.nombre, P.serie, esCallee ? "metodo" : "propiedad");
      if (p) r = { ...p, nombre: n.nombre, objeto: P.id, propio: true, clase: esCallee ? "metodo" : "propiedad" };
      else { const t = C.tipoDeObjeto(n.nombre); if (t) r = { tipo: t, def: null, nombre: n.nombre, objeto: t.idDe(n.nombre), propio: t.idDe(n.nombre) === P.id, clase: "objeto", nodoObjeto: i }; }
    }
    P.cache.set(i, r);
    return r;
  }

  // Papel (color) de un nodo.
  function rol(P, i) {
    const N = P.nodos, n = N[i];
    const r = resolver(P, i);
    if (r) {
      if (r.clase === "objeto") return r.propio ? "propia" : "otra";
      if (!r.propio && r.objeto) return "otra";
      return (r.def && r.def.rol) || (r.clase === "propiedad" ? "propia" : "dato");
    }
    if (n.tipo === "AwaitExpression") return rol(P, P.hijo(i, "argument"));
    if (n.campo === "test" || (n.tipo === "BinaryExpression" && COMPARA[n.op]) || n.tipo === "LogicalExpression" && (n.op === "&&" || n.op === "||")) return "cond";
    if (n.tipo === "Identifier" && P.variables.has(n.nombre)) return "dato";
    if (n.tipo === "LogicalExpression" && n.op === "??") return "sensor";
    if (n.tipo === "VariableDeclaration" || n.tipo === "VariableDeclarator") { const d = n.tipo === "VariableDeclaration" ? P.hijos(i, "declarations")[0] : i; const ini = d != null ? P.hijo(d, "init") : null; return ini != null ? rol(P, ini) : "dato"; }
    if (n.tipo === "ExpressionStatement") return rol(P, P.hijo(i, "expression"));
    if (CON_PRUEBA.has(n.tipo)) return "cond";
    if (n.tipo === "BreakStatement" || n.tipo === "ContinueStatement") return "bad";
    return "neutro";
  }

  // ---------- Valores ----------
  function valor(v) {
    if (v && typeof v === "object" && "$" in v) return { texto: { u: "undefined", f: "función", p: "promesa", n: v.v, o: "objeto" }[v.$] || "?", tono: "neutro" };
    if (v === null) return { texto: "null", tono: "neutro" };
    if (v === true) return { texto: "true", tono: "ok" };
    if (v === false) return { texto: "false", tono: "bad" };
    if (typeof v === "number") return { texto: coma(v, 3), tono: "valor" };
    if (typeof v === "string") return { texto: JSON.stringify(v), tono: TONO_RESULTADO[v] || "texto" };
    if (v && typeof v === "object" && v.id && v.tipo) return { texto: `${C.ENEMIGOS[v.tipo] || v.tipo} ${v.id} (${coma(v.x, 1)}; ${coma(v.y, 1)})`, tono: "valor", objetivo: true };
    if (v && typeof v === "object" && "x" in v) return { texto: C.lugar(v), tono: "valor" };
    return { texto: JSON.stringify(v), tono: "valor" };
  }
  const claseValor = (v) => v === null ? "null" : v === undefined ? "u" : typeof v === "object" ? ("$" in v ? "$" + v.$ : "obj") : typeof v === "string" ? v : typeof v === "boolean" ? String(v) : typeof v;
  const corto = (P, i, max = 34) => { const t = P.txt(i).replace(/\s+/g, " "); return t.length <= max ? t : t.slice(0, max - 1) + "…"; };
  const mayus = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const lit = (P, i) => P.nodos[i].tipo === "Literal" ? P.nodos[i].valor : undefined;

  // ---------- Frases (lo que significa una expresión, sin valores) ----------
  // Devuelve segmentos. predicado=true pide forma de condición («LAU-02 está atascado»).
  function frase(P, i, predicado = false) {
    const N = P.nodos, n = N[i];
    const r = resolver(P, i);
    if (n.tipo === "Literal") return [n.valor === true ? "siempre" : n.valor === null ? "null" : typeof n.valor === "number" ? coma(n.valor) : { k: P.txt(i) }];
    if (r && r.clase === "propiedad") {
      const sujeto = r.propio ? (P.id || "esta máquina") : r.objeto;
      if (r.def && r.def.frase) {
        const f = r.def.frase(sujeto);
        if (r.def.tipo === "booleano") return [predicado ? f : `si ${f}`];
        return [f];
      }
      return [{ c: i }];
    }
    if (r && r.clase === "metodo" && r.def && r.def.frase) {
      const args = P.hijos(i, "arguments");
      const vals = args.map(a => lit(P, a)), textos = args.map(a => P.txt(a));
      const f = r.def.frase(vals, textos, r.objeto);
      return [r.propio || !r.objeto ? f : `${f} (de ${r.objeto})`];
    }
    if (n.tipo === "Identifier" && P.variables.has(n.nombre)) return [{ c: i }];
    if (n.tipo === "AwaitExpression") return frase(P, P.hijo(i, "argument"), predicado);
    if (n.tipo === "LogicalExpression" && n.op === "??") {
      const partes = []; (function plano(x) { if (N[x].tipo === "LogicalExpression" && N[x].op === "??") { plano(P.hijo(x, "left")); plano(P.hijo(x, "right")); } else partes.push(x); })(i);
      const out = [...frase(P, partes[0])];
      for (const x of partes.slice(1)) out.push("; si es null, ", ...frase(P, x));
      return out;
    }
    if (n.tipo === "BinaryExpression" && COMPARA[n.op]) return [...frase(P, P.hijo(i, "left")), ` ${COMPARA[n.op]} `, ...frase(P, P.hijo(i, "right"))];
    if (n.tipo === "BinaryExpression" && ARIT[n.op]) return [...frase(P, P.hijo(i, "left")), ` ${ARIT[n.op]} `, ...frase(P, P.hijo(i, "right"))];
    if (n.tipo === "LogicalExpression" && (n.op === "&&" || n.op === "||")) return [...frase(P, P.hijo(i, "left"), true), n.op === "&&" ? " y " : " o ", ...frase(P, P.hijo(i, "right"), true)];
    if (n.tipo === "UnaryExpression" && n.op === "!") return ["no se cumple que ", ...frase(P, P.hijo(i, "argument"), true)];
    return [{ c: i }];
  }

  // ---------- El programa entero en lenguaje natural ----------
  function programa(P) {
    const N = P.nodos, lineas = [];
    const poner = (nivel, ref, seg) => lineas.push({ nivel, ref, seg });
    function bloque(ids, nivel) { for (const s of ids) sentencia(s, nivel); }
    function cuerpo(i, nivel) { if (i == null) return; if (N[i].tipo === "BlockStatement") bloque(P.hijos(i, "body"), nivel); else sentencia(i, nivel); }
    function sentencia(s, nivel) {
      const n = N[s];
      if (n.tipo === "WhileStatement") {
        const t = P.hijo(s, "test");
        if (N[t].tipo === "Literal" && N[t].valor === true) poner(nivel, s, [{ b: "Repite siempre" }, " (cada vuelta, de arriba abajo):"]);
        else poner(nivel, s, [{ b: "Mientras" }, " ", ...frase(P, t, true), ", repite:"]);
        cuerpo(P.hijo(s, "body"), nivel + 1);
      } else if (n.tipo === "ForStatement") {
        poner(nivel, s, [{ b: "Repite" }, " con ", { c: s }, ":"]); cuerpo(P.hijo(s, "body"), nivel + 1);
      } else if (n.tipo === "IfStatement") {
        let x = s, primero = true;
        while (x != null && N[x].tipo === "IfStatement") {
          poner(nivel, x, [{ b: primero ? "Si" : "Si no, si" }, " ", ...frase(P, P.hijo(x, "test"), true), ":"]);
          cuerpo(P.hijo(x, "consequent"), nivel + 1);
          primero = false;
          const alt = P.hijo(x, "alternate");
          if (alt != null && N[alt].tipo !== "IfStatement") { poner(nivel, alt, [{ b: "Si no" }, ":"]); cuerpo(alt, nivel + 1); x = null; }
          else x = alt;
        }
      } else if (n.tipo === "VariableDeclaration") {
        for (const d of P.hijos(s, "declarations")) {
          const nom = P.hijo(d, "id"), ini = P.hijo(d, "init");
          poner(nivel, s, ini == null ? [{ b: "Crea" }, " ", { c: nom }, "."] : [{ b: "Guarda" }, " en ", { c: nom }, " ", ...frase(P, ini), "."]);
        }
      } else if (n.tipo === "ExpressionStatement") {
        const e = P.hijo(s, "expression"), f = frase(P, e);
        if (f.length === 1 && typeof f[0] === "string") poner(nivel, s, [{ b: mayus(f[0].split(" ")[0]) }, f[0].slice(f[0].split(" ")[0].length) + "."]);
        else if (N[e].tipo === "AssignmentExpression") poner(nivel, s, [{ b: "Cambia" }, " ", { c: P.hijo(e, "left") }, ": ", ...frase(P, P.hijo(e, "right")), "."]);
        else poner(nivel, s, [{ c: e }]);
      } else if (n.tipo === "BreakStatement") poner(nivel, s, [{ b: "Sal del bucle" }, "."]);
      else if (n.tipo === "ContinueStatement") poner(nivel, s, [{ b: "Pasa a la siguiente vuelta" }, "."]);
      else if (n.tipo === "BlockStatement") bloque(P.hijos(s, "body"), nivel);
      else if (n.tipo !== "EmptyStatement") poner(nivel, s, [{ c: s }]);
    }
    bloque(P.hijos(0, "body"), 0);
    return lineas;
  }

  // ---------- Narración de un paso (un grupo de eventos de la traza) ----------
  // grupo = { tipo: 's'|'c', nodo, valor, ev: [[id, valor]…] }; ctx = { vuelta, explicados:Set, estado }
  function valoresDe(grupo) { const m = new Map(); for (const e of grupo.ev) if (e.length > 1) m.set(e[0], e[1]); if (grupo.tipo === "c") m.set(grupo.nodo, grupo.valor); return m; }

  // Explicación de una condición con sus valores: «failureRate vale 0,08, y 0,08 < 0,12 es true».
  function condicion(P, t, vals) {
    const N = P.nodos, n = N[t], b = vals.get(t);
    const r = resolver(P, t);
    if (n.tipo === "Literal") return [{ c: t }, " siempre se cumple"];
    if (r && r.clase === "propiedad") {
      const sujeto = r.propio ? P.id : r.objeto;
      const significado = r.def && r.def.valor ? r.def.valor(b) : null;
      return [{ c: t }, " es ", { v: b }, significado ? `: ${sujeto} ${significado}` : ""];
    }
    if (n.tipo === "BinaryExpression" && COMPARA[n.op]) {
      const l = P.hijo(t, "left"), d = P.hijo(t, "right");
      const out = [];
      for (const x of [l, d]) if (N[x].tipo !== "Literal" && vals.has(x)) out.push({ c: x }, " vale ", { v: vals.get(x) }, ", ");
      const lv = vals.has(l) ? vals.get(l) : lit(P, l), dv = vals.has(d) ? vals.get(d) : lit(P, d);
      out.push("y ", { k: `${valor(lv).texto} ${n.op} ${valor(dv).texto}` }, " es ", { v: b });
      return out;
    }
    if (n.tipo === "LogicalExpression") {
      const l = P.hijo(t, "left"), d = P.hijo(t, "right");
      const out = [...condicion(P, l, vals)];
      if (vals.has(d)) out.push("; ", ...condicion(P, d, vals));
      else out.push(` (con eso basta: ${n.op} no mira la derecha)`);
      out.push(". En total, ", { c: t }, " es ", { v: b });
      return out;
    }
    if (n.tipo === "UnaryExpression" && n.op === "!") return [...condicion(P, P.hijo(t, "argument"), vals), ", así que ", { c: t }, " es ", { v: b }];
    return [{ c: t }, " es ", { v: b }];
  }

  // Nota del autor: comentario al final de la línea del nodo o en la línea de encima (si es solo comentario).
  function nota(P, i) {
    const cs = P.comentarios || [], n = P.nodos[i];
    const lineaSola = (l) => { const t = P.fuente.split("\n")[l - 1] || ""; return /^\s*(\/\/|\/\*)/.test(t); };
    const c = cs.find(x => x.linea === n.linea && x.a >= n.b) || cs.find(x => x.linea === n.linea - 1 && lineaSola(x.linea) && n.linea > 1);
    return c ? c.texto : null;
  }
  function narrar(P, grupo, ctx = {}) {
    const out = narrar0(P, grupo, ctx);
    const N = P.nodos, base = grupo.tipo === "c" ? N[grupo.nodo].padre : grupo.nodo;
    const t = nota(P, base);
    if (t && !(ctx.notas && ctx.notas.has(base))) { if (ctx.notas) ctx.notas.add(base); out.push({ br: 1 }, { nota: t }); }
    return out;
  }
  function narrar0(P, grupo, ctx = {}) {
    const N = P.nodos, vals = valoresDe(grupo), out = [];
    const primeraVez = (clave) => { if (!ctx.explicados || ctx.explicados.has(clave)) return false; ctx.explicados.add(clave); return true; };
    if (grupo.tipo === "c") {
      const t = grupo.nodo, padre = N[t].padre, pn = N[padre], b = grupo.valor;
      if (pn.tipo === "WhileStatement" || pn.tipo === "ForStatement" || pn.tipo === "DoWhileStatement") {
        out.push({ b: `Vuelta ${ctx.vuelta || "?"}. ` });
        if (N[t].tipo === "Literal" && N[t].valor === true) {
          out.push({ k: `while (${P.txt(t)})` }, ": ", { c: t }, " siempre se cumple, así que el bloque se repite hasta que acabe la partida.");
          if (primeraVez("bucle-infinito")) out.push(" Cada vuelta termina en una espera; sin ella, el programa no dejaría avanzar el tiempo.");
        } else {
          out.push(...condicion(P, t, vals), b ? ": entra en la vuelta." : ": sale del bucle.");
        }
        return out;
      }
      if (pn.tipo === "IfStatement") {
        const esElseIf = pn.campo === "alternate" && N[pn.padre].tipo === "IfStatement";
        out.push({ b: esElseIf ? "Else if. " : "Decisión. " }, ...condicion(P, t, vals), ". ");
        const alt = P.hijo(padre, "alternate");
        if (b) out.push(esElseIf ? "Entra en este " : "Entra en el ", { k: esElseIf ? "else if" : "if" }, ".");
        else if (alt == null) out.push("Se salta el bloque.");
        else if (N[alt].tipo === "IfStatement") out.push("No entra: prueba el ", { k: "else if" }, ".");
        else out.push("No entra: va al ", { k: "else" }, ".");
        return out;
      }
      if (pn.tipo === "ConditionalExpression") return [{ b: "Condición. " }, ...condicion(P, t, vals), "."];
      return [...condicion(P, t, vals), "."];
    }
    const s = grupo.nodo, n = N[s];
    if (n.tipo === "VariableDeclaration") {
      for (const d of P.hijos(s, "declarations")) {
        const nom = P.hijo(d, "id"), ini = P.hijo(d, "init");
        if (ini == null) { out.push("Crea ", { c: nom }, "."); continue; }
        out.push(...evaluacion(P, ini, vals, primeraVez));
        out.push(" ", { b: `${N[nom].nombre} = ` }, { v: vals.get(ini) }, ".");
        if (vals.get(ini) === null) out.push(" No hay objetivo.");
      }
      return out;
    }
    if (n.tipo === "ExpressionStatement") {
      const e = P.hijo(s, "expression");
      if (N[e].tipo === "AwaitExpression") {
        const arg = P.hijo(e, "argument"), r = resolver(P, arg);
        out.push({ c: e }, ": ");
        if (r && r.def) out.push(primeraVez("m:" + r.nombre) ? `${r.def.hace}.` : `${mayus(r.def.frase(P.hijos(arg, "arguments").map(a => lit(P, a)), []))}.`);
        if (ctx.t != null && ctx.t1 != null) out.push(` Del segundo ${coma(ctx.t)} al ${coma(ctx.t1)}.`);
        return out;
      }
      if (N[e].tipo === "AssignmentExpression") {
        const l = P.hijo(e, "left"), d = P.hijo(e, "right");
        return [...evaluacion(P, d, vals, primeraVez), " ", { c: l }, " pasa a valer ", { v: vals.get(d) }, "."];
      }
      if (N[e].tipo === "CallExpression") return llamada(P, e, vals, primeraVez);
      return [{ c: e }, vals.has(e) ? [" → ", { v: vals.get(e) }] : "", "."].flat();
    }
    if (n.tipo === "BreakStatement") return [{ b: "break: " }, "sale del bucle aquí mismo."];
    if (n.tipo === "ContinueStatement") return [{ b: "continue: " }, "salta el resto de esta vuelta y vuelve a la condición."];
    return [{ c: s }, " (todavía no tiene explicación)."];
  }

  // Cómo se evaluó una expresión: llamadas en orden con su resultado, ?? con atajo, operaciones.
  function evaluacion(P, i, vals, primeraVez) {
    const N = P.nodos, n = N[i];
    if (n.tipo === "LogicalExpression" && n.op === "??") {
      const partes = []; (function plano(x) { if (N[x].tipo === "LogicalExpression" && N[x].op === "??") { plano(P.hijo(x, "left")); plano(P.hijo(x, "right")); } else partes.push(x); })(i);
      const out = [];
      partes.forEach((x, k) => {
        if (!vals.has(x)) return;
        if (k > 0) out.push(" Era null: ", { k: "??" }, " prueba la siguiente. ");
        out.push(...llamadaCorta(P, x, vals, primeraVez));
        const v = vals.get(x);
        if (v !== null && v !== undefined && k < partes.length - 1) out.push(" No es null, así que ", { k: "??" }, " ya no mira las demás.");
      });
      return out;
    }
    if (n.tipo === "CallExpression") return llamadaCorta(P, i, vals, primeraVez);
    if (n.tipo === "BinaryExpression" && ARIT[n.op]) {
      const l = P.hijo(i, "left"), d = P.hijo(i, "right");
      const lv = vals.has(l) ? vals.get(l) : lit(P, l), dv = vals.has(d) ? vals.get(d) : lit(P, d);
      return [{ c: i }, " → ", { k: `${valor(lv).texto} ${n.op} ${valor(dv).texto}` }, " = ", { v: vals.get(i) }, "."];
    }
    return [{ c: i }, " → ", { v: vals.get(i) }, "."];
  }
  function llamadaCorta(P, i, vals, primeraVez) {
    const r = resolver(P, i), v = vals.get(i);
    const out = [{ c: i }];
    if (r && r.def && primeraVez && primeraVez("m:" + r.nombre)) out.push(` ${r.def.hace}. Devuelve `);
    else out.push(" devuelve ");
    out.push({ v }, v === null && r && r.def && r.def.resultado ? ": no ve ninguno." : ".");
    return out;
  }
  function llamada(P, i, vals, primeraVez) {
    const r = resolver(P, i), v = vals.get(i);
    const out = [{ c: i }, ": "];
    if (r && r.def) {
      const args = P.hijos(i, "arguments"), f = r.def.frase(args.map(a => lit(P, a)), args.map(a => P.txt(a)), r.objeto);
      out.push(primeraVez("m:" + r.nombre) ? `${r.def.hace}.` : `${mayus(f)}.`);
      const a0 = args[0];
      if (a0 != null && vals.has(a0) && P.nodos[a0].tipo === "Identifier") out.push(" ", { c: a0 }, " es ", { v: vals.get(a0) }, ".");
      if (v !== undefined) {
        out.push(" Devuelve ", { v });
        const que = r.def.resultados && r.def.resultados[v];
        out.push(que ? `: ${que}.` : ".");
      }
      if (!r.propio && r.def.clase === "orden") out.push(" Ojo: esta orden es para ", r.objeto, ", y solo su propio programa puede dársela.");
      return out;
    }
    out.push("se llama a la función", v !== undefined ? [" y devuelve ", { v }] : "", ".");
    return out.flat();
  }

  // ---------- «¿Qué es esto?» (al tocar el código) ----------
  function queEs(P, i, vals = new Map(), extra = {}) {
    const N = P.nodos, n = N[i], r = resolver(P, i);
    const titulo = [{ c: i }];
    const cuerpo = [];
    let etiqueta = "código";
    const ahora = vals.has(i) ? vals.get(i) : undefined;
    if (r && r.clase === "propiedad") {
      etiqueta = r.propio ? `propiedad de ${P.id} (su propia máquina)` : `propiedad de otra máquina: ${r.objeto}`;
      cuerpo.push(mayus(r.def.que || r.nombre), ". ");
      if (!r.propio) cuerpo.push(...nombreDeMaquina(P, r), " ");
      else if (n.tipo === "Identifier") cuerpo.push("Sin objeto delante es la de la máquina dueña del programa: ", P.id, ". ");
      if (r.def.nota) cuerpo.push(r.def.nota);
      if (ahora !== undefined) cuerpo.push({ br: 1 }, { b: "En este paso: " }, { v: ahora }, r.def.valor ? ` → ${r.def.valor(ahora)}.` : ".");
    } else if (r && r.clase === "metodo") {
      etiqueta = `${{ lectura: "lectura", orden: "orden", espera: "espera", consola: "consola" }[r.def.clase] || "función"} de ${r.propio ? P.id + " (su propia máquina)" : r.objeto}`;
      cuerpo.push(mayus(r.def.hace), ". ");
      if (!r.propio && r.def.clase === "lectura") cuerpo.push(...nombreDeMaquina(P, r), " Leer otra máquina está permitido; darle órdenes, no.");
      if (r.propio && r.def.clase === "orden") cuerpo.push("Las órdenes solo valen para la máquina dueña del programa.");
      if (r.def.nota) cuerpo.push(" ", r.def.nota);
      if (r.def.resultados) { cuerpo.push({ br: 1 }, { b: "Puede devolver: " }); Object.entries(r.def.resultados).forEach(([k, t], x) => cuerpo.push(x ? " · " : "", { v: k }, ` ${t}`)); cuerpo.push("."); }
      if (ahora !== undefined) cuerpo.push({ br: 1 }, { b: "En este paso devolvió " }, { v: ahora }, r.def.resultado ? `: ${r.def.resultado(ahora)}.` : ".");
    } else if (r && r.clase === "objeto") {
      etiqueta = `${r.tipo.nombre} ${r.objeto}`;
      cuerpo.push(r.tipo.descripcion || "", " ", ...nombreDeMaquina(P, r));
    } else if (n.tipo === "Literal") {
      const pa = N[n.padre];
      const rp = pa && pa.tipo === "CallExpression" ? resolver(P, n.padre) : null;
      if (rp && rp.def && rp.def.args) {
        const k = P.hijos(n.padre, "arguments").indexOf(i), a = rp.def.args[k];
        etiqueta = a ? `argumento: ${a.que}` : "argumento";
        cuerpo.push(`Es el ${["primer", "segundo", "tercer"][k] || (k + 1) + ".º"} argumento de `, { k: rp.nombre }, a ? `: ${a.que}.` : ".");
        if (a && a.valores && a.valores[n.valor]) cuerpo.push(" ", { k: JSON.stringify(n.valor) }, ` = ${a.valores[n.valor]}.`);
        if (a && a.valores) cuerpo.push({ br: 1 }, "Otros valores posibles: ", ...Object.keys(a.valores).filter(x => x !== n.valor).flatMap((x, j) => [j ? ", " : "", { k: JSON.stringify(x) }]), ".");
      } else if (typeof n.valor === "number") { etiqueta = "número"; cuerpo.push("Un número escrito en el programa: ", coma(n.valor, 3), "."); }
      else if (typeof n.valor === "boolean") { etiqueta = "booleano"; cuerpo.push(n.valor ? "true: siempre se cumple." : "false: nunca se cumple."); }
      else if (n.valor === null) { etiqueta = "null"; cuerpo.push("null: «nada», ningún valor."); }
      else { etiqueta = "texto"; cuerpo.push("Un texto escrito en el programa."); }
    } else if (n.tipo === "Identifier" && P.variables.has(n.nombre)) {
      const d = P.variables.get(n.nombre), ini = P.hijo(d.declarador, "init");
      etiqueta = `variable (${d.clase})`;
      cuerpo.push("Una variable del programa. ", ...(ini != null ? ["Guarda ", ...frase(P, ini), ". "] : []));
      if (d.clase === "const") cuerpo.push("Con ", { k: "const" }, " no se puede cambiar después; si está dentro del bucle, se crea de nuevo en cada vuelta.");
      if (ahora !== undefined) cuerpo.push({ br: 1 }, { b: "En este paso vale " }, { v: ahora }, ".");
    } else if (n.tipo === "WhileStatement") {
      etiqueta = "bucle while";
      cuerpo.push("Repite el bloque mientras la condición sea ", { v: true }, ". ");
      const t = P.hijo(i, "test");
      if (N[t].tipo === "Literal" && N[t].valor === true) cuerpo.push("Aquí la condición es ", { k: "true" }, ": no acaba nunca. El programa se detiene cuando termina la partida.");
    } else if (n.tipo === "IfStatement") {
      etiqueta = "decisión if";
      cuerpo.push("Prueba las condiciones en orden y entra solo en la primera que sea ", { v: true }, ". Si ninguna lo es y hay ", { k: "else" }, ", entra en el ", { k: "else" }, ".");
    } else if (n.tipo === "LogicalExpression" && n.op === "??") {
      etiqueta = "operador ??";
      cuerpo.push("Si lo de la izquierda es ", { v: null }, " (o undefined), usa lo de la derecha. Si no, se queda con lo de la izquierda ", { b: "y ni siquiera evalúa la derecha" }, ". Encadenado, da el primer valor que no sea null.");
      if (ahora !== undefined) cuerpo.push({ br: 1 }, { b: "En este paso dio " }, { v: ahora }, ".");
    } else if (n.tipo === "LogicalExpression") {
      etiqueta = `operador ${n.op}`;
      cuerpo.push(n.op === "&&" ? "true solo si los dos lados son true. Si el izquierdo es false, no evalúa el derecho." : "true si al menos un lado es true. Si el izquierdo es true, no evalúa el derecho.");
    } else if (n.tipo === "BinaryExpression" && COMPARA[n.op]) {
      etiqueta = "comparación";
      cuerpo.push("Compara dos valores y da ", { v: true }, " o ", { v: false }, ": ", ...frase(P, i), ".");
      if (ahora !== undefined) cuerpo.push({ br: 1 }, { b: "En este paso: " }, ...condicion(P, i, vals), ".");
    } else if (n.tipo === "AwaitExpression") {
      etiqueta = "await";
      cuerpo.push({ k: "await" }, " hace que el programa espere a que termine ", { c: P.hijo(i, "argument") }, " antes de seguir. Sin él, el programa seguiría sin esperar.");
    } else if (n.tipo === "VariableDeclaration") {
      etiqueta = `declaración ${n.clase}`;
      const d = P.hijos(i, "declarations")[0], nom = P.hijo(d, "id"), ini = P.hijo(d, "init");
      cuerpo.push("Crea la variable ", { c: nom }, ini != null ? [" y guarda en ella ", ...frase(P, ini)] : "", ".");
    } else if (n.tipo === "ExpressionStatement" || n.tipo === "BlockStatement") {
      return queEs(P, n.tipo === "ExpressionStatement" ? P.hijo(i, "expression") : (N[i].padre ?? i), vals, extra);
    } else {
      cuerpo.push("Todavía no tiene explicación propia.");
    }
    return { titulo, etiqueta, cuerpo: cuerpo.flat(), rol: rol(P, i) };
  }
  function nombreDeMaquina(P, r) {
    return r.objeto && r.nodoObjeto != null
      ? [{ c: r.nodoObjeto }, ` es ${r.objeto} con «_» en lugar de «-», porque «-» no vale en un nombre.`]
      : r.objeto ? [] : [];
  }

  return { preparar, resolver, rol, valor, claseValor, frase, programa, narrar, nota, valoresDe, condicion, queEs, corto, coma, TONO_RESULTADO };
});
