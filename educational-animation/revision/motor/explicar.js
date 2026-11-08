/* Modo revisión · del árbol, el catálogo y los valores reales a frases, en el idioma de la interfaz.
 *
 * Todo es determinista y genérico: no hay texto escrito para un programa ni para un reto. Lo que una
 * plantilla no sabe decir se muestra como código, que también se puede tocar.
 *
 * Una frase es una lista de segmentos:
 *   "texto"         texto              { c: nodo }    fragmento del programa: ficha que se puede tocar
 *   { k: "código" } código suelto      { v: valor }   valor de la traza (true verde, false rojo…)
 *   { f: fila }     número de una fila del diagrama, con su color
 *   { lista: [] }   líneas de consola  { br: 1 }      salto
 *   { mas: [] }     detalles plegados («Más detalles»): lo secundario de una tarjeta, para que quepa en el teléfono
 * Las plantillas están en textos.js (revision.*) y se interpolan con fichas, no con texto. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(raiz.CMGCatalogoRevision, raiz.CMGFlujo, raiz.CMGI18n);
  else raiz.CMGExplicar = fabrica(raiz.CMGCatalogoRevision, raiz.CMGFlujo, raiz.CMGI18n);
})(typeof globalThis !== "undefined" ? globalThis : self, function (C, FL, I18N) {
  "use strict";
  const verdad = FL.verdad;
  // Python: las mismas frases con sus palabras (None, True, False, print, elif…). Lo fija cada llamada de fuera
  // con el programa que explica, y se queda puesto para pintar sus valores justo después.
  let py = false;
  const PALABRAS_PY = [[/\bnull\b|\bundefined\b/g, "None"], [/\btrue\b/g, "True"], [/\bfalse\b/g, "False"], [/\bconsole\.log\b/g, "print"],
    [/\belse if\b/g, "elif"], [/\bcatch\b/g, "except"], [/===/g, "=="], [/!==/g, "!="], [/&&/g, "and"], [/\|\|/g, "or"]];
  const aPython = (x) => PALABRAS_PY.reduce((s, [re, v]) => s.replace(re, v), x);
  const palabra = (x) => py && typeof x === "string" ? aPython(x) : x;
  const t = (k, p) => palabra(I18N.t("revision." + k, p));
  const existe = (k) => I18N.t("revision." + k) !== "revision." + k;
  const idioma = () => I18N.idioma;
  // Números en la prosa: «0,25 s» en español, «0.25 s» en inglés. En el código y sus valores, siempre JS.
  const num = (v, d = 2) => { if (typeof v !== "number" || !isFinite(v)) return String(v); const s = String(+v.toFixed(d)); return idioma() === "es" ? s.replace(".", ",") : s; };
  const OPS = { "===": "igual", "==": "igual", "!==": "distinto", "!=": "distinto", "<": "menor", "<=": "menorIgual", ">": "mayor", ">=": "mayorIgual" };
  const ARIT = new Set(["+", "-", "*", "/", "%", "**"]);
  const TONO_RESULTADO = { ok: "ok", atascado: "bad", sin_misiles: "bad", sin_objetivo: "neutro" };

  // Plantilla con huecos → segmentos. Los parámetros pueden ser texto, un segmento o una lista de segmentos.
  function tpl(clave, params = {}) {
    const raw = t(clave), out = [];
    let ultimo = 0;
    raw.replace(/\{(\w+)\}/g, (m, k, pos) => {
      if (pos > ultimo) out.push(raw.slice(ultimo, pos));
      const v = params[k];
      if (v === undefined || v === null) out.push(m);
      else if (Array.isArray(v)) out.push(...v);
      else out.push(typeof v === "number" ? String(v) : v);
      ultimo = pos + m.length;
      return m;
    });
    if (ultimo < raw.length) out.push(raw.slice(ultimo));
    return out;
  }
  const unir = (listas, sep) => listas.flatMap((l, k) => k ? [sep, ...l] : l);

  // ---------- ¿Qué es este nombre o llamada en el juego? ----------
  // → { tipo, def, nombre, objeto (id del juego), propio, clase: 'metodo'|'propiedad'|'objeto', nodoObjeto }
  function resolver(P, i) {
    if (P.cache.has(i)) return P.cache.get(i);
    const N = P.nodos, n = N[i];
    let r = null;
    const deObjeto = (o, nombre, clase) => {
      if (N[o].tipo !== "Identifier") return null;
      const tp = C.tipoDeObjeto(N[o].nombre);
      const mapa = tp && (clase === "metodo" ? tp.metodos : tp.propiedades);
      if (!tp || !Object.hasOwn(mapa, nombre)) return null;
      const id = tp.idDe(N[o].nombre);
      return { tipo: tp, def: mapa[nombre], nombre, objeto: id, propio: id === P.id, clase, nodoObjeto: o };
    };
    if (n.tipo === "CallExpression") {
      const f = P.hijo(i, "callee");
      if (N[f].tipo === "Identifier" && !P.funciones.has(N[f].nombre)) {
        const p = C.propia(N[f].nombre, P.serie, "metodo");
        if (p) r = { ...p, nombre: N[f].nombre, objeto: P.id, propio: true, clase: "metodo" };
      } else if (N[f].tipo === "MemberExpression" && !N[f].computado) r = deObjeto(P.hijo(f, "object"), N[P.hijo(f, "property")].nombre, "metodo");
    } else if (n.tipo === "MemberExpression" && !n.computado) {
      if (!(n.campo === "callee" && N[n.padre].tipo === "CallExpression")) r = deObjeto(P.hijo(i, "object"), N[P.hijo(i, "property")].nombre, "propiedad");
    } else if (n.tipo === "Identifier" && !P.variables.has(n.nombre) && !P.funciones.has(n.nombre)) {
      const pa = n.padre != null ? N[n.padre] : null;
      const esCallee = pa && pa.tipo === "CallExpression" && n.campo === "callee";
      if (!(pa && pa.tipo === "MemberExpression" && n.campo === "property")) {
        const p = C.propia(n.nombre, P.serie, esCallee ? "metodo" : "propiedad");
        if (p) r = { ...p, nombre: n.nombre, objeto: P.id, propio: true, clase: esCallee ? "metodo" : "propiedad" };
        else { const tp = C.tipoDeObjeto(n.nombre); if (tp) { const id = tp.idDe(n.nombre); r = { tipo: tp, def: null, nombre: n.nombre, objeto: id, propio: id === P.id, clase: "objeto", nodoObjeto: i }; } }
      }
    }
    P.cache.set(i, r);
    return r;
  }
  const sujeto = (P, r) => r.propio ? (P.id || "") : r.objeto;
  // Texto del catálogo para una llamada, con sus argumentos como fichas o como nombres («dron», «0,25»).
  function textoLlamada(P, r, llamada, campo) {
    const k = C.clave(r.tipo, r.def, campo);
    if (!existe(k)) return null;
    const params = {};
    // La consola escribe todos sus argumentos, separados por un espacio.
    if (r.def.clase === "consola") return tpl(k, { 0: unir(P.hijos(llamada, "arguments").map(a => expr(P, a)), " ") });
    P.hijos(llamada, "arguments").forEach((a, j) => {
      const n = P.nodos[a], g = r.def.args[j] && r.def.args[j].grupo;
      if (n.tipo === "Literal" && g && C.grupos[g].includes(n.valor)) params[j] = t(C.claveGrupo(g, n.valor));
      else if (n.tipo === "Literal" && typeof n.valor === "number") params[j] = num(n.valor, 3);
      else params[j] = expr(P, a);
    });
    return tpl(k, params);
  }
  const textoCat = (r, campo, params) => { const k = C.clave(r.tipo, r.def, campo); return existe(k) ? tpl(k, params) : null; };

  // ---------- Valores ----------
  function valor(v) {
    if (v && typeof v === "object" && "$" in v) {
      if (v.$ === "o" && v.r) return { texto: v.r.length > 40 ? v.r.slice(0, 39) + "…" : v.r, tono: "valor" };
      return { texto: { u: "undefined", f: t("val.funcion"), p: t("val.promesa"), n: v.v, o: t("val.objeto") }[v.$] || "?", tono: "neutro" };
    }
    if (v === undefined) return { texto: py ? "None" : "undefined", tono: "neutro" };
    if (v === null) return { texto: py ? "None" : "null", tono: "neutro" };
    if (v === true) return { texto: py ? "True" : "true", tono: "ok" };
    if (v === false) return { texto: py ? "False" : "false", tono: "bad" };
    if (typeof v === "number") return { texto: String(+v.toFixed(4)), tono: "valor" };
    if (typeof v === "string") return { texto: JSON.stringify(v), tono: TONO_RESULTADO[v] || "texto" };
    if (C.esEnemigo(v)) return { texto: t("val.objetivo", { tipo: t(C.claveGrupo("enemigo", v.tipo)), id: v.id, x: num(v.x, 1), y: num(v.y, 1) }), tono: "valor" };
    if (v && typeof v === "object" && "x" in v && "y" in v && Object.keys(v).length <= 3) return { texto: t("val.lugar", { x: num(v.x, 1), y: num(v.y, 1) }), tono: "valor" };
    const j = JSON.stringify(v);
    return { texto: j.length > 40 ? j.slice(0, 39) + "…" : j, tono: "valor" };
  }
  const texto = (v) => valor(v).texto;
  const lit = (P, i) => P.nodos[i].tipo === "Literal" ? P.nodos[i].valor : undefined;
  const valorDe = (P, vals, i) => vals.has(i) ? vals.get(i) : lit(P, i);
  // Lo que imprime console.log con esos valores: textos sin comillas, separados por un espacio.
  const plano = (v) => typeof v === "string" ? v : texto(v);

  // ---------- Frases sin valores (las etiquetas de las filas) ----------
  // a ?? b ?? c (o, en Python, a or b or c) → [a, b, c].
  function cadenaNula(P, i) { const N = P.nodos, partes = [], op = N[i].op; (function ir(x) { if (N[x].tipo === "LogicalExpression" && N[x].op === op && (op === "??" || op === "||")) { ir(P.hijo(x, "left")); ir(P.hijo(x, "right")); } else partes.push(x); })(i); return partes; }
  // Una expresión como sustantivo: «dron», «pos», «0,25»… o la ficha de su código.
  function expr(P, i) {
    const N = P.nodos, n = N[i];
    if (n.tipo === "Literal") return [{ k: P.txt(i) }];
    if (n.tipo === "AwaitExpression") return expr(P, P.hijo(i, "argument"));
    if (n.tipo === "LogicalExpression" && (n.op === "??" || (P.lenguaje === "python" && n.op === "||" && cadenaNula(P, i).every(p => N[p].tipo === "CallExpression")))) return cadenaNula(P, i).map(x => expr(P, x)).reduce((a, b) => tpl("f.siNo", { a, b }));
    const r = resolver(P, i);
    if (r && r.clase === "objeto") return [r.objeto];
    if (r && r.clase === "metodo" && r.def) return textoLlamada(P, r, i, "corta") || textoLlamada(P, r, i, "etiqueta") || [{ c: i }];
    return [{ c: i }];
  }
  // Una condición dentro de otra frase: «LAU-02 está atascado», «failureRate es menor que 0.12».
  function pred(P, i) {
    const N = P.nodos, n = N[i];
    if (n.tipo === "BinaryExpression" && OPS[n.op]) return tpl("p." + OPS[n.op], { l: expr(P, P.hijo(i, "left")), r: expr(P, P.hijo(i, "right")) });
    if (n.tipo === "LogicalExpression" && (n.op === "&&" || n.op === "||")) return tpl(n.op === "&&" ? "p.y" : "p.o", { a: pred(P, P.hijo(i, "left")), b: pred(P, P.hijo(i, "right")) });
    if (n.tipo === "UnaryExpression" && n.op === "!") {
      const a = P.hijo(i, "argument"), r = resolver(P, a);
      if (r && r.clase === "propiedad" && r.def.tipo === "booleano") return textoCat(r, "no", { s: sujeto(P, r) }) || tpl("p.no", { x: expr(P, a) });
      return tpl("p.no", { x: pred(P, a) });
    }
    const r = resolver(P, i);
    if (r && r.clase === "propiedad" && r.def.tipo === "booleano") return textoCat(r, "si", { s: sujeto(P, r) }) || [{ c: i }];
    return expr(P, i);
  }
  // Una condición como pregunta: la etiqueta de un if o de un while.
  function pregunta(P, i) {
    const N = P.nodos, n = N[i];
    if (n.tipo === "BinaryExpression" && OPS[n.op]) return tpl("q." + OPS[n.op], { l: expr(P, P.hijo(i, "left")), r: expr(P, P.hijo(i, "right")) });
    if (n.tipo === "LogicalExpression" && (n.op === "&&" || n.op === "||")) return tpl(n.op === "&&" ? "q.y" : "q.o", { a: pred(P, P.hijo(i, "left")), b: pred(P, P.hijo(i, "right")) });
    if (n.tipo === "UnaryExpression" && n.op === "!") {
      const a = P.hijo(i, "argument"), r = resolver(P, a);
      if (r && r.clase === "propiedad" && r.def.tipo === "booleano") return textoCat(r, "preguntaNo", { s: sujeto(P, r) }) || tpl("q.falso", { x: expr(P, a) });
      return tpl("q.falso", { x: expr(P, a) });
    }
    const r = resolver(P, i);
    if (r && r.clase === "propiedad" && r.def.tipo === "booleano") return textoCat(r, "pregunta", { s: sujeto(P, r) }) || tpl("q.cierto", { x: [{ c: i }] });
    if (n.tipo === "Identifier" || n.tipo === "MemberExpression") return tpl("q.cierto", { x: expr(P, i) });
    return tpl("q.generica", { x: expr(P, i) });
  }
  const esFuncion = (P, i) => /^(FunctionExpression|ArrowFunctionExpression)$/.test(P.nodos[i].tipo);
  const esFijo = (P, i) => { const n = P.nodos[i]; return n.tipo === "Literal" || (n.tipo === "UnaryExpression" && P.nodos[P.hijo(i, "argument")].tipo === "Literal") || ((n.tipo === "ArrayExpression" || n.tipo === "ObjectExpression" || n.tipo === "TemplateLiteral") && P.txt(i).length <= 24); };
  function etiquetaLlamada(P, i) {
    const r = resolver(P, i);
    if (r && r.clase === "metodo" && r.def) { const x = textoLlamada(P, r, i, "etiqueta"); if (x) return x; }
    const f = P.hijo(i, "callee");
    if (P.nodos[f].tipo === "Identifier" && P.funciones.has(P.nodos[f].nombre)) return tpl("f.llama", { f: [{ c: i }] });
    return [{ c: i }];
  }
  function etiquetaSentencia(P, s, lateral) {
    const N = P.nodos, n = N[s];
    if (n.tipo === "VariableDeclaration") {
      return unir(P.hijos(s, "declarations").map(d => {
        const nom = P.hijo(d, "id"), ini = P.hijo(d, "init"), x = [{ c: nom }];
        if (ini == null) return tpl("f.declara", { x });
        if (esFuncion(P, ini)) return tpl("f.defineFuncion", { x });
        if (esFijo(P, ini)) return tpl("f.empieza", { x, v: [{ k: P.txt(ini) }] });
        return tpl("f.guarda", { x, e: expr(P, ini) });
      }), "; ");
    }
    if (n.tipo === "ExpressionStatement") {
      const e = P.hijo(s, "expression"), x = N[e];
      if (x.tipo === "AwaitExpression") { const a = P.hijo(e, "argument"); return N[a].tipo === "CallExpression" ? etiquetaLlamada(P, a) : tpl("f.espera", { e: [{ c: a }] }); }
      if (x.tipo === "AssignmentExpression") {
        const l = P.hijo(e, "left"), d = P.hijo(e, "right"), xl = [{ c: l }];
        if (x.op === "=" && N[d].tipo === "BinaryExpression" && (N[d].op === "+" || N[d].op === "-") && P.txt(P.hijo(d, "left")) === P.txt(l))
          return tpl(N[d].op === "+" ? "f.suma" : "f.resta", { k: expr(P, P.hijo(d, "right")), x: xl });
        if (x.op === "+=" || x.op === "-=") return tpl(x.op === "+=" ? "f.suma" : "f.resta", { k: expr(P, d), x: xl });
        return tpl("f.asigna", { x: xl, e: x.op === "=" ? expr(P, d) : [{ c: e }] });
      }
      if (x.tipo === "UpdateExpression") return tpl(x.op === "++" ? "f.suma" : "f.resta", { k: "1", x: [{ c: P.hijo(e, "argument") }] });
      if (x.tipo === "CallExpression") return etiquetaLlamada(P, e);
      return [{ c: e }];
    }
    if (n.tipo === "ReturnStatement") { const a = P.hijo(s, "argument"); return a != null ? tpl("f.devuelve", { e: expr(P, a) }) : [t("f.termina")]; }
    if (n.tipo === "BreakStatement") return lateral ? [{ k: P.txt(s).replace(/;$/, "") }] : [t("f.break")];
    if (n.tipo === "ContinueStatement") return lateral ? [{ k: P.txt(s).replace(/;$/, "") }] : [t("f.continue")];
    if (n.tipo === "ThrowStatement") return tpl("f.lanza", { e: expr(P, P.hijo(s, "argument")) });
    return [{ c: s }];
  }
  // Etiqueta de una fila del diagrama.
  function etiqueta(P, F, i) {
    const f = F.filas[i], N = P.nodos, n = N[f.nodo];
    if (f.tipo === "bucle") {
      if (P.porCada.has(f.nodo)) {
        const pc = P.porCada.get(f.nodo);
        return tpl(pc.clave ? "f.porCadaClave" : "f.porCada", { x: [{ c: pc.x }], l: expr(P, pc.l), o: expr(P, pc.l) });
      }
      if (f.infinito) return [t("f.siempre")];
      if (n.tipo === "DoWhileStatement") return tpl("f.repiteMientras", { c: pred(P, f.test) });
      return pregunta(P, f.test);
    }
    if (f.tipo === "decision") return pregunta(P, f.test);
    if (f.tipo === "funcion") {
      const nom = n.tipo === "FunctionDeclaration" ? P.hijo(f.nodo, "id") : null;
      const nombre = nom != null ? N[nom].nombre : (n.padre != null && N[n.padre].tipo === "VariableDeclarator" ? N[P.hijo(n.padre, "id")].nombre : null);
      return tpl("f.funcion", { f: nombre != null ? [{ k: nombre }] : t("f.anonima", { l: n.linea }), p: [{ k: P.hijos(f.nodo, "params").map(p => P.txt(p)).join(", ") }] });
    }
    if (f.tipo === "intento") return [t("f.intenta")];
    if (f.tipo === "segun") return tpl("f.segun", { e: expr(P, P.hijo(f.nodo, "discriminant")) });
    return etiquetaSentencia(P, f.nodo, f.lateral);
  }
  // Texto pequeño de una salida lateral («false → Fin del bucle»).
  const textoSalida = (f) => f.salida && f.salida.tipo === "fin" ? (f.salida.etiqueta === "fin" ? t("f.alAcabar") : "false") : "true";

  // ---------- Frases con valores (la narración de un paso) ----------
  function condicion(P, i, vals) {
    const N = P.nodos, n = N[i], b = vals.get(i);
    if (n.tipo === "Literal") return tpl("d.siempreCierto", { c: [{ c: i }] });
    const r = resolver(P, i);
    if (r && r.clase === "propiedad") {
      const m = r.def.tipo === "booleano" ? textoCat(r, verdad(b) ? "si" : "no", { s: sujeto(P, r) }) : null;
      return m ? tpl("d.prop", { c: [{ c: i }], v: [{ v: b }], m }) : tpl("d.es", { c: [{ c: i }], v: [{ v: b }] });
    }
    if (n.tipo === "BinaryExpression" && OPS[n.op]) {
      const l = P.hijo(i, "left"), d = P.hijo(i, "right"), out = [];
      for (const x of [l, d]) if (N[x].tipo !== "Literal" && vals.has(x)) out.push(tpl("d.vale", { x: [{ c: x }], v: [{ v: vals.get(x) }] }));
      out.push(tpl("d.comparacion", { e: [{ k: `${texto(valorDe(P, vals, l))} ${n.op} ${texto(valorDe(P, vals, d))}` }], v: [{ v: b }] }));
      return unir(out, "; ");
    }
    if (n.tipo === "LogicalExpression" && (n.op === "&&" || n.op === "||")) {
      const l = P.hijo(i, "left"), d = P.hijo(i, "right");
      return [...condicion(P, l, vals), "; ", ...(vals.has(d) ? condicion(P, d, vals) : tpl("d.atajo", { op: [{ k: n.op }] })), "; ", ...tpl("d.total", { c: [{ c: i }], v: [{ v: b }] })];
    }
    if (n.tipo === "UnaryExpression" && n.op === "!") return [...condicion(P, P.hijo(i, "argument"), vals), "; ", ...tpl("d.alReves", { c: [{ k: "!" }], v: [{ v: b }] })];
    return tpl("d.es", { c: [{ c: i }], v: [{ v: b }] });
  }
  function significado(r, v) {
    if (!r || !r.def || r.clase !== "metodo") return null;
    if (v === null && r.def.nulo) return textoCat(r, "resultado.null", {});
    if (typeof v === "string" && r.def.resultados.includes(v)) { const k = C.claveResultado(r.tipo, r.def, v); return existe(k) ? tpl(k) : null; }
    return null;
  }
  // Cómo se calculó una expresión: los intentos de ??, una llamada con su resultado, una cuenta.
  function evaluacion(P, i, vals) {
    const N = P.nodos, n = N[i];
    if (n.tipo === "LogicalExpression" && n.op === "??") {
      const partes = cadenaNula(P, i).filter(x => vals.has(x) || N[x].tipo === "Literal");
      return [t("d.intentos"), " ", ...unir(partes.map(x => tpl("d.da", { c: [{ c: x }], v: [{ v: valorDe(P, vals, x) }] })), " · "), ". "];
    }
    if (n.tipo === "CallExpression" && vals.has(i)) {
      const m = significado(resolver(P, i), vals.get(i));
      return m ? [...tpl("d.daSignifica", { c: [{ c: i }], v: [{ v: vals.get(i) }], m }), " "] : [...tpl("d.da", { c: [{ c: i }], v: [{ v: vals.get(i) }] }), ". "];
    }
    if (n.tipo === "BinaryExpression" && ARIT.has(n.op) && vals.has(i)) {
      const l = P.hijo(i, "left"), d = P.hijo(i, "right");
      return [...tpl("d.cuenta", { e: [{ k: `${texto(valorDe(P, vals, l))} ${n.op} ${texto(valorDe(P, vals, d))}` }], v: [{ v: vals.get(i) }] }), " "];
    }
    return [];
  }
  function llamada(P, F, i, vals) {
    const r = resolver(P, i), v = vals.get(i);
    if (r && r.def && r.def.clase === "consola") {
      const args = P.hijos(i, "arguments").map(a => plano(valorDe(P, vals, a)));
      return tpl("d.imprime", { v: [{ v: args.join(" ") }] });
    }
    if (r && r.def) {
      const m = significado(r, v);
      if (v === undefined) return tpl("d.ejecuta", { c: [{ c: i }] });
      return m ? tpl("d.daSignifica", { c: [{ c: i }], v: [{ v }], m }) : [...tpl("d.da", { c: [{ c: i }], v: [{ v }] }), "."];
    }
    const f = P.hijo(i, "callee");
    if (P.nodos[f].tipo === "Identifier" && P.funciones.has(P.nodos[f].nombre) && F.filaDe.has(P.funciones.get(P.nodos[f].nombre))) {
      const out = tpl("d.llamaFuncion", { c: [{ c: i }], f: [{ f: F.filaDe.get(P.funciones.get(P.nodos[f].nombre)) }] });
      if (v !== undefined && !(v && v.$ === "u")) out.push(" ", ...tpl("d.devolvio", { c: [{ c: i }], v: [{ v }] }));
      return out;
    }
    return v !== undefined ? [...tpl("d.da", { c: [{ c: i }], v: [{ v }] }), "."] : tpl("d.ejecuta", { c: [{ c: i }] });
  }
  // Lo que leyó de fuera cada función en línea al llamarla en este paso: «[f[0]()] lee [i] «3»».
  function lecturas(P, F, paso) {
    const grupos = (paso.lecturas || []).map(g => {
      // Una misma lectura repetida (i + i) se dice una vez; la misma variable con otro valor (un map), cada vez.
      const vistos = new Set(), lee = g.lee.filter(([x, v]) => { const k = `${x}:${valor(v).texto}`; return !vistos.has(k) && vistos.add(k) && FL.deFuera(P, x, F.enLinea(x)); });
      return lee.length ? tpl("d.lee", { c: [{ c: g.llamada }], l: unir(lee.map(([x, v]) => [{ c: x }, " ", { v }]), ", ") }) : null;
    }).filter(Boolean);
    return grupos.length ? [...tpl("d.alLlamar", { l: unir(grupos, " · ") }), " "] : [];
  }
  // Una función que usa la variable de un bucle: ¿se queda con la de su vuelta o comparte la misma? «No se ejecuta
  // aquí» solo si se sabe que se guarda para después. La variable de cada vuelta declarada en el cuerpo (no en la
  // cabecera del for) va plegada: es cierto, pero rara vez es lo que cambia el resultado.
  const capturas = (P, F, i) => FL.capturas(P, F, i).flatMap(c => {
    const frase = tpl(`r.captura.${c.tipo}${c.guardada ? "" : "Uso"}`, { fn: [{ c: c.fn }], x: [{ c: c.x }] });
    return [" ", ...(c.tipo === "propia" && !c.cabecera ? [{ mas: frase }] : frase)];
  });
  function detalle(P, F, R, paso, G = {}) {
    if (paso.fin) return final(P, R, paso, G);
    // En la traza, la pista de ámbito va en la primera visita a la fila: no se repite en cada vuelta.
    const primera = !R || !R.pasos.some(p => p.i < paso.i && p.fila === paso.fila);
    return [...lecturas(P, F, paso), ...detalleFila(P, F, R, paso), ...(primera ? capturas(P, F, paso.fila) : [])];
  }
  function detalleFila(P, F, R, paso) {
    const N = P.nodos, f = F.filas[paso.fila], vals = paso.vals, n = N[f.nodo];
    const ir = (x) => [{ f: x }];
    if (f.tipo === "bucle") {
      if (paso.valor === undefined) return [t("d.entraBucle")];
      if (P.porCada.has(f.nodo)) {
        return tpl("d.porCada", { n: paso.iter || 1, x: [{ c: P.porCada.get(f.nodo).x }], v: [{ v: paso.valor }] });
      }
      if (f.infinito) return tpl("d.siempre", { n: paso.iter || 1, c: f.test != null ? [{ c: f.test }] : [{ k: "for (;;)" }] });
      const cierre = verdad(paso.valor) ? tpl("d.entraVuelta", { n: paso.iter || 1 }) : f.sig != null ? tpl("d.saleBucle", { f: ir(f.sig) }) : [t("d.saleFin")];
      return [...condicion(P, f.test, vals), ". ", ...cierre];
    }
    if (f.tipo === "decision") {
      if (paso.valor === undefined) return tpl("d.evalua", { c: [{ c: f.test }] });
      let cierre;
      if (verdad(paso.valor)) cierre = f.si != null ? tpl("d.entraEn", { f: ir(f.si) }) : [];
      else if (f.no != null) cierre = F.filas[f.no].cadena ? tpl("d.pasaA", { f: ir(f.no) }) : tpl("d.vaElse", { f: ir(f.no) });
      else cierre = f.sig != null ? tpl("d.salta", { f: ir(f.sig) }) : [t("d.saltaFin")];
      return [...condicion(P, f.test, vals), ". ", ...cierre];
    }
    if (f.tipo !== "paso") return tpl("d.ejecuta", { c: [{ c: f.nodo }] });
    if (n.tipo === "VariableDeclaration") {
      return unir(P.hijos(f.nodo, "declarations").map(d => {
        const nom = P.hijo(d, "id"), ini = P.hijo(d, "init"), x = [{ c: nom }];
        if (ini == null) return tpl("d.declara", { x });
        if (esFuncion(P, ini)) return tpl("d.funcionGuardada", { x });
        const v = vals.has(ini) || P.nodos[ini].tipo === "Literal" ? [{ v: valorDe(P, vals, ini) }] : [{ k: P.txt(ini).replace(/\s+/g, " ") }];
        return [...evaluacion(P, ini, vals), ...tpl("d.guarda", { x, v })];
      }), " ");
    }
    if (n.tipo === "ExpressionStatement") {
      const e = P.hijo(f.nodo, "expression"), x = N[e];
      if (x.tipo === "AwaitExpression") {
        const a = P.hijo(e, "argument"), r = N[a].tipo === "CallExpression" ? resolver(P, a) : null;
        if (r && r.def && r.def.clase === "espera") {
          const a0 = P.hijos(a, "arguments")[0], s = num(a0 != null ? valorDe(P, vals, a0) : 0, 3);
          if (paso.t != null && paso.t1 != null) return tpl("d.espera", { s, t0: num(paso.t), t1: num(paso.t1) });
          if (paso.t != null && paso.cortada) return tpl("d.esperaFin", { s, t0: num(paso.t) });
          return [...(textoLlamada(P, r, a, "etiqueta") || [{ c: a }]), "."];
        }
        return tpl("d.esperaA", { c: [{ c: a }], v: [{ v: vals.get(e) }] });
      }
      if (x.tipo === "AssignmentExpression") {
        const l = P.hijo(e, "left"), d = P.hijo(e, "right");
        if (x.op === "=") return [...evaluacion(P, d, vals), ...tpl("d.ahoraVale", { x: [{ c: l }], v: [{ v: valorDe(P, vals, d) }] })];
        return tpl("d.ejecuta", { c: [{ c: e }] });
      }
      if (x.tipo === "UpdateExpression" && typeof vals.get(e) === "number") {
        const v = vals.get(e), d = x.op === "++" ? 1 : -1, prefijo = P.txt(e).startsWith(x.op);
        const a = prefijo ? v - d : v, b = prefijo ? v : v + d;
        return tpl("d.pasaDe", { x: [{ c: P.hijo(e, "argument") }], a: [{ v: a }], b: [{ v: b }] });
      }
      if (x.tipo === "CallExpression") return llamada(P, F, e, vals);
      return vals.has(e) ? tpl("d.ejecutaValor", { c: [{ c: e }], v: [{ v: vals.get(e) }] }) : tpl("d.ejecuta", { c: [{ c: e }] });
    }
    if (n.tipo === "ReturnStatement") { const a = P.hijo(f.nodo, "argument"); return a != null ? tpl("d.devuelve", { v: [{ v: valorDe(P, vals, a) }] }) : [t("d.termina")]; }
    if (n.tipo === "BreakStatement") return f.sig != null ? tpl("d.break", { f: ir(f.sig) }) : [t("d.breakFin")];
    if (n.tipo === "ContinueStatement") return tpl("d.continue", { f: ir(f.sig != null ? f.sig : f.bucle) });
    if (n.tipo === "ThrowStatement") { const a = P.hijo(f.nodo, "argument"); return tpl("d.lanza", { v: [{ v: valorDe(P, vals, a) }] }); }
    return tpl("d.ejecuta", { c: [{ c: f.nodo }] });
  }
  // Cómo acaba: la partida (si hay juego), un error, un corte o el final del programa; y la consola.
  function final(P, R, paso, G) {
    const out = [];
    const pa = G.partida;
    if (pa) {
      out.push(...tpl("fin.partida", { t: num(pa.t), r: pa.resultado === "victoria" ? t("fin.victoria") : pa.resultado === "derrota" ? t("fin.derrota") : String(pa.resultado) }));
      out.push(" ", ...tpl("fin.datos", { d: pa.derribos, e: pa.enemigos, b: pa.brechas, a: (pa.atascos || []).length }));
    } else if (G.error) out.push(...tpl("fin.error", { m: [{ k: `${G.error.tipo}: ${G.error.mensaje}` }] }));
    else if (G.cortado) out.push(...tpl("fin.cortado", { n: P.eventos.length }));
    else out.push(t("fin.programa"));
    const salida = G.salida || [];
    if (salida.length) out.push({ br: 1 }, t("fin.consola"), { lista: salida.map(s => s.texto) });
    return out;
  }

  // ---------- «¿Qué es?» al tocar el código ----------
  // → { titulo: segmentos, tipo: texto corto, cuerpo: segmentos }
  function queEs(P, F, R, i, paso, filaCuenta = F.filaDe.get(i)) {
    const N = P.nodos, n = N[i], r = resolver(P, i);
    const vals = paso && paso.vals ? paso.vals : new Map();
    const ahora = vals.has(i) ? vals.get(i) : undefined;
    const cuerpo = [];
    let tipo = t("que.codigo");
    const en = (clave, p) => cuerpo.push(...tpl(clave, p), " ");
    // Lo secundario (de quién es, notas, resultados posibles) va plegado: la tarjeta cabe en el teléfono.
    const mas = [];
    const masEn = (clave, p) => mas.push(...(mas.length ? [{ br: 1 }] : []), ...tpl(clave, p));
    const masTexto = (k) => { if (existe(k)) mas.push(...(mas.length ? [{ br: 1 }] : []), t(k)); };
    if (r && r.clase === "propiedad") {
      tipo = t("que.propiedad", { id: r.objeto || P.id || "" });
      cuerpo.push(t(C.clave(r.tipo, r.def, "que")), " ");
      if (r.propio && n.tipo === "Identifier") masEn("que.b.propia", { id: P.id || "" });
      if (!r.propio) masEn("que.b.ajena");
      if (r.nodoObjeto != null) masEn("que.b.objetoNombre", { c: [{ c: r.nodoObjeto }], id: r.objeto });
      masTexto(C.clave(r.tipo, r.def, "nota"));
      if (ahora !== undefined) cuerpo.push({ br: 1 }, ...tpl("que.b.ahora", { v: [{ v: ahora }] }));
    } else if (r && r.clase === "metodo" && r.def) {
      tipo = t("que.metodo", { clase: t("que.clase." + r.def.clase), id: r.objeto || P.id || "" });
      cuerpo.push(t(C.clave(r.tipo, r.def, "hace")), " ");
      if (!r.propio && r.objeto && r.def.clase === "lectura") masEn("que.b.ajena");
      if (r.propio && r.def.clase === "orden") masEn("que.b.ordenPropia");
      masTexto(C.clave(r.tipo, r.def, "nota"));
      const posibles = [...r.def.resultados.map(v => [v, C.claveResultado(r.tipo, r.def, v)]), ...(r.def.nulo ? [[null, C.clave(r.tipo, r.def, "resultado.null")]] : [])].filter(([, k]) => existe(k));
      if (posibles.length) { mas.push(...(mas.length ? [{ br: 1 }] : []), t("que.b.puede")); posibles.forEach(([v, k]) => mas.push({ br: 1 }, "· ", { v }, " ", t(k))); }
      if (ahora !== undefined) cuerpo.push({ br: 1 }, ...tpl("que.b.devolvio", { v: [{ v: ahora }] }));
    } else if (r && r.clase === "objeto") {
      tipo = t("que.objeto", { nombre: t(`cat.${r.tipo.clave}.nombre`), id: r.objeto });
      cuerpo.push(t(`cat.${r.tipo.clave}.descripcion`), " ");
      en("que.b.objetoNombre", { c: [{ c: i }], id: r.objeto });
    } else if (n.tipo === "Literal") {
      const pa = N[n.padre], rp = pa && pa.tipo === "CallExpression" ? resolver(P, n.padre) : null;
      const k = rp && rp.def ? P.hijos(n.padre, "arguments").indexOf(i) : -1;
      if (k >= 0 && existe(C.clave(rp.tipo, rp.def, `arg${k}`))) {
        tipo = t("que.argumento");
        en("que.b.arg", { n: k + 1, f: [{ k: rp.nombre }], que: t(C.clave(rp.tipo, rp.def, `arg${k}`)) });
        const g = rp.def.args[k] && rp.def.args[k].grupo;
        if (g && C.grupos[g].includes(n.valor)) {
          cuerpo.push({ br: 1 }, { k: P.txt(i) }, ` = ${t(C.claveGrupo(g, n.valor))}: ${t(C.claveGrupo(g, n.valor, true))}.`);
          const otros = C.grupos[g].filter(x => x !== n.valor);
          cuerpo.push({ br: 1 }, ...tpl("que.b.otros", { l: unir(otros.map(x => [{ k: JSON.stringify(x) }, ` (${t(C.claveGrupo(g, x))})`]), ", ") }));
        }
      } else if (typeof n.valor === "number") { tipo = t("que.numero"); en("que.b.numero"); }
      else if (typeof n.valor === "boolean") { tipo = t("que.booleano"); en(n.valor ? "que.b.true" : "que.b.false"); }
      else if (n.valor === null) { tipo = t("que.nulo"); en("que.b.null"); }
      else { tipo = t("que.texto"); en("que.b.texto"); }
    } else if (n.tipo === "Identifier" && P.variables.has(n.nombre)) {
      const d = P.variables.get(n.nombre);
      tipo = t(d.clase === "param" ? "que.parametro" : "que.variable");
      en("que.b.variable", { x: [{ k: n.nombre }] });
      if (d.clase === "param") en("que.b.parametro");
      else if (d.clase === "const") en("que.b.const");
      else en("que.b.let");
      if (ahora !== undefined) cuerpo.push({ br: 1 }, ...tpl("que.b.ahora", { v: [{ v: ahora }] }));
    } else if (n.tipo === "Identifier" && P.funciones.has(n.nombre)) {
      tipo = t("que.funcion");
      const fila = F.filaDe.get(P.funciones.get(n.nombre));
      en("que.b.llamadaPropia", { f: [{ k: n.nombre }], n: fila != null ? [{ f: fila }] : "" });
    } else if (n.tipo === "CallExpression") {
      tipo = t("que.llamada");
      const f = P.hijo(i, "callee"), nombre = N[f].tipo === "Identifier" ? N[f].nombre : null;
      if (nombre && P.funciones.has(nombre) && F.filaDe.has(P.funciones.get(nombre))) en("que.b.llamadaPropia", { f: [{ k: nombre }], n: [{ f: F.filaDe.get(P.funciones.get(nombre)) }] });
      else en("que.b.llamada", { f: [{ c: f }] });
      if (ahora !== undefined) cuerpo.push({ br: 1 }, ...tpl("que.b.devolvio", { v: [{ v: ahora }] }));
    } else if (n.tipo === "BinaryExpression" && OPS[n.op]) {
      tipo = t("que.comparacion"); en("que.b.comparacion");
      if (ahora !== undefined) cuerpo.push({ br: 1 }, ...condicion(P, i, vals), ".");
    } else if (n.tipo === "BinaryExpression") {
      tipo = t("que.cuenta"); en("que.b.cuenta");
      if (ahora !== undefined) cuerpo.push({ br: 1 }, ...tpl("que.b.dio", { v: [{ v: ahora }] }));
    } else if (n.tipo === "LogicalExpression") {
      tipo = t("que.operador", { op: n.op }); en(n.op === "&&" ? "que.b.y" : n.op === "||" ? "que.b.o" : "que.b.nulo");
      if (ahora !== undefined) cuerpo.push({ br: 1 }, ...tpl("que.b.dio", { v: [{ v: ahora }] }));
    } else if (n.tipo === "UnaryExpression" && n.op === "!") { tipo = t("que.operador", { op: "!" }); en("que.b.no"); }
    else if (n.tipo === "AwaitExpression") { tipo = "await"; en("que.b.await", { c: [{ c: P.hijo(i, "argument") }] }); }
    else if (/^(While|DoWhile|For|ForOf|ForIn)Statement$/.test(n.tipo)) {
      const k = { WhileStatement: "while", DoWhileStatement: "do…while", ForStatement: "for", ForOfStatement: "for…of", ForInStatement: "for…in" }[n.tipo];
      tipo = t("que.bucle", { k });
      en({ WhileStatement: "que.b.while", DoWhileStatement: "que.b.doWhile", ForStatement: "que.b.for", ForOfStatement: "que.b.forOf", ForInStatement: "que.b.forIn" }[n.tipo]);
      const f = F.filas[F.filaDe.get(i)];
      if (f && f.infinito) en("que.b.whileTrue");
    } else if (n.tipo === "IfStatement") {
      const elseIf = n.campo === "alternate";
      tipo = t(elseIf ? "que.elseif" : "que.decision"); en("que.b.if"); if (elseIf) en("que.b.elseif");
    } else if (n.tipo === "BreakStatement") { tipo = "break"; en("que.b.break"); }
    else if (n.tipo === "ContinueStatement") { tipo = "continue"; en("que.b.continue"); }
    else if (n.tipo === "ReturnStatement") { tipo = "return"; en("que.b.return"); }
    else if (/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.tipo)) {
      tipo = t("que.funcion");
      const nom = P.hijo(i, "id");
      en("que.b.funcion", { f: [{ k: nom != null ? N[nom].nombre : "…" }] });
    } else if (n.tipo === "ExpressionStatement") return queEs(P, F, R, P.hijo(i, "expression"), paso, filaCuenta);
    else if (n.tipo === "VariableDeclaration") return queEs(P, F, R, P.hijo(P.hijos(i, "declarations")[0], "id"), paso, filaCuenta);
    else if (n.tipo === "AssignmentExpression" || n.tipo === "UpdateExpression") {
      tipo = t("que.asignacion");
      const x = P.hijo(i, n.tipo === "AssignmentExpression" ? "left" : "argument");
      en("que.b.asignacion", { x: [{ c: x }] });
    }
    else if (/Statement$/.test(n.tipo)) { tipo = t("que.sentencia"); en("que.b.sentencia"); }
    else if (/(Expression|Literal)$/.test(n.tipo)) {
      tipo = t("que.expresion"); en("que.b.expresion");
      if (ahora !== undefined) cuerpo.push({ br: 1 }, ...tpl("que.b.dio", { v: [{ v: ahora }] }));
    }
    if (mas.length) cuerpo.push({ mas });
    // Si es una fila del diagrama (o su condición): cuántas veces pasó por ella en toda la ejecución.
    // En el recorrido de lectura no se ejecutó nada: no hay cuentas.
    const fila = filaCuenta;
    if (fila != null && R && !R.estructural) {
      const c = R.cuentas.get(fila);
      const veces = c ? c.veces : 0;
      cuerpo.push({ br: 1 }, ...(veces === 0 ? [t("que.b.nunca")] : veces === 1 ? [t("que.b.vez")] : tpl("que.b.veces", { n: veces })));
      if (c && (F.filas[fila].tipo === "decision" || (F.filas[fila].tipo === "bucle" && !F.filas[fila].infinito && F.filas[fila].test != null)) && c.si + c.no) cuerpo.push(" ", ...tpl("que.b.resultados", { a: c.si, b: c.no }));
    }
    return { titulo: [{ c: i }], tipo, cuerpo };
  }

  // ---------- Recorrido de lectura: qué hace cada fila, en lenguaje de personas ----------
  // Sin valores ni traza: sale del árbol, del diagrama y del catálogo. Frases cortas (caben en el teléfono)
  // que dicen qué hace la fila y por dónde sigue el programa después.
  const fichaFila = (i) => [{ f: i }];
  function rango(P, F, i) {
    const d = FL.dentro(P, F, i);
    if (!d.length) return null;
    return d.length === 1 ? tpl("r.fila", { a: fichaFila(d[0]) }) : tpl("r.filas", { a: fichaFila(d[0]), b: fichaFila(d.at(-1)) });
  }
  // ¿Una variable guarda un true/false? (para decir «es true» y no «tiene un valor»).
  function booleana(P, i) {
    const N = P.nodos, n = N[i];
    if (n.tipo === "Literal") return typeof n.valor === "boolean";
    if ((n.tipo === "BinaryExpression" && OPS[n.op]) || (n.tipo === "UnaryExpression" && n.op === "!")) return true;
    if (n.tipo === "LogicalExpression" && (n.op === "&&" || n.op === "||")) return booleana(P, P.hijo(i, "left")) && booleana(P, P.hijo(i, "right"));
    const r = resolver(P, i);
    return !!(r && r.clase === "propiedad" && r.def.tipo === "booleano");
  }
  // Una condición dicha como frase: «LAU-02 está atascado», «pos tiene un valor», «misiles es menor que 3».
  function condicionHumana(P, i) {
    const N = P.nodos, n = N[i];
    if (n.tipo === "BinaryExpression" && OPS[n.op]) return pred(P, i);
    if (n.tipo === "LogicalExpression" && (n.op === "&&" || n.op === "||")) return tpl(n.op === "&&" ? "p.y" : "p.o", { a: condicionHumana(P, P.hijo(i, "left")), b: condicionHumana(P, P.hijo(i, "right")) });
    if (n.tipo === "UnaryExpression" && n.op === "!") {
      const a = P.hijo(i, "argument"), r = resolver(P, a);
      if (r && r.clase === "propiedad" && r.def.tipo === "booleano") return textoCat(r, "no", { s: sujeto(P, r) }) || tpl("p.no", { x: expr(P, a) });
      if (N[a].tipo === "Identifier") return tpl(esBooleana(P, a) ? "r.esFalse" : "r.sinValor", { x: [{ c: a }] });
      return tpl("p.no", { x: condicionHumana(P, a) });
    }
    const r = resolver(P, i);
    if (r && r.clase === "propiedad" && r.def.tipo === "booleano") return textoCat(r, "si", { s: sujeto(P, r) }) || [{ c: i }];
    if (n.tipo === "Identifier") return esBooleana(P, i) ? tpl("p.cierto", { x: [{ c: i }] }) : tpl("r.hay", { x: [{ c: i }] });
    if (n.tipo === "Literal") return tpl("p.cierto", { x: [{ c: i }] });
    // Una llamada: la lectura del juego puede dar null; una función propia o de JavaScript, true o false.
    if (n.tipo === "CallExpression" && !(r && r.def && r.def.nulo)) return tpl("r.daTrue", { x: [{ c: i }] });
    return tpl("r.hay", { x: [{ c: i }] });
  }
  function esBooleana(P, i) {
    const v = P.variables.get(P.nodos[i].nombre);
    if (!v || v.clase === "param") return false;
    const ini = P.hijo(v.declarador, "init");
    return ini != null && booleana(P, ini);
  }
  // Por dónde sigue una fila cuando termina: la fila, el bucle al que vuelve o el final.
  function adonde(P, F, f, sig, { salta = false } = {}) {
    if (sig == null) return [t(f.seccion != null ? "r.acabaFuncion" : "r.acaba")];
    const g = F.filas[sig];
    if (g.tipo === "bucle" && (g.i === f.bucle || P.desciende(f.nodo, g.nodo))) return tpl("r.vuelve", { f: fichaFila(sig) });
    return tpl(salta ? "r.salta" : "r.sigue", { f: fichaFila(sig) });
  }
  function llamadaHumana(P, F, f, i) {
    const r = resolver(P, i);
    if (r && r.def && r.def.clase === "consola") return tpl("r.imprime", { e: unir(P.hijos(i, "arguments").map(a => expr(P, a)), " ") });
    if (r && r.def) {
      const out = [...(textoLlamada(P, r, i, "breve") || textoLlamada(P, r, i, "hace") || tpl("r.ejecuta", { c: [{ c: i }] }))];
      const a0 = P.hijos(i, "arguments")[0];
      if (r.def.clase === "orden" && r.def.resultados.includes("sin_objetivo") && a0 != null && P.nodos[a0].tipo === "Identifier" && !f.rama) out.push(" ", ...tpl("r.siNullParado", { x: [{ c: a0 }] }));
      return out;
    }
    const cal = P.hijo(i, "callee");
    if (P.nodos[cal].tipo === "Identifier" && P.funciones.has(P.nodos[cal].nombre) && F.filaDe.has(P.funciones.get(P.nodos[cal].nombre)))
      return tpl("r.llama", { f: [{ k: P.nodos[cal].nombre }], n: fichaFila(F.filaDe.get(P.funciones.get(P.nodos[cal].nombre))) });
    return tpl("r.ejecuta", { c: [{ c: i }] });
  }
  // Lo que se guarda en una variable: una lectura del juego dice qué busca y qué pasa si no hay nada.
  function guardaHumana(P, F, f, x, ini) {
    const N = P.nodos;
    const sinAwait = N[ini].tipo === "AwaitExpression" ? P.hijo(ini, "argument") : ini;
    const r = N[sinAwait].tipo === "CallExpression" ? resolver(P, sinAwait) : null;
    if (r && r.def && r.clase === "metodo" && r.def.clase === "lectura") {
      const out = [...(textoLlamada(P, r, sinAwait, "breve") || textoLlamada(P, r, sinAwait, "hace") || [])];
      const nulo = r.def.nulo && existe(C.clave(r.tipo, r.def, "resultado.null"));
      out.push(" ", ...(nulo ? tpl("r.loGuardaNull", { x, r: t(C.clave(r.tipo, r.def, "resultado.null")) }) : tpl("r.loGuarda", { x })));
      return out;
    }
    if (N[ini].tipo === "LogicalExpression" && (N[ini].op === "??" || (P.lenguaje === "python" && N[ini].op === "||" && cadenaNula(P, ini).every(p => N[p].tipo === "CallExpression")))) {
      const partes = cadenaNula(P, ini).map(p => { const rp = N[p].tipo === "CallExpression" ? resolver(P, p) : null; return rp && rp.def ? (textoLlamada(P, rp, p, "etiqueta") || [{ c: p }]) : expr(P, p); });
      // Las opciones, plegadas: el código ya las enseña y la frase cabe en el teléfono.
      const mas = partes.flatMap((p, k) => [...(k ? [{ br: 1 }] : []), `${k + 1}. `, ...p]);
      return [...tpl("r.guardaPrimero", { x, n: String(partes.length) }), { mas }];
    }
    if (esFuncion(P, ini)) return tpl("r.funcionGuardada", { x });
    if (esFijo(P, ini)) return tpl(N[f.nodo].clase === "const" ? "r.empiezaConst" : "r.empiezaLet", { x, v: [{ k: P.txt(ini) }] });
    return tpl("r.guarda", { x, e: expr(P, ini) });
  }
  function pasoHumano(P, F, f) {
    const N = P.nodos, s = f.nodo, n = N[s];
    if (n.tipo === "VariableDeclaration") {
      return unir(P.hijos(s, "declarations").map(d => {
        const nom = P.hijo(d, "id"), ini = P.hijo(d, "init"), x = [{ c: nom }];
        return ini == null ? tpl("r.declara", { x }) : guardaHumana(P, F, f, x, ini);
      }), " ");
    }
    if (n.tipo === "ExpressionStatement") {
      const e = P.hijo(s, "expression"), x = N[e];
      if (x.tipo === "AwaitExpression") { const a = P.hijo(e, "argument"); return N[a].tipo === "CallExpression" ? llamadaHumana(P, F, f, a) : tpl("r.espera", { e: [{ c: a }] }); }
      if (x.tipo === "AssignmentExpression") {
        const l = P.hijo(e, "left"), d = P.hijo(e, "right"), xl = [{ c: l }];
        if (x.op === "=" && N[d].tipo === "BinaryExpression" && (N[d].op === "+" || N[d].op === "-") && P.txt(P.hijo(d, "left")) === P.txt(l))
          return tpl(N[d].op === "+" ? "r.suma" : "r.resta", { k: expr(P, P.hijo(d, "right")), x: xl });
        if (x.op === "+=" || x.op === "-=") return tpl(x.op === "+=" ? "r.suma" : "r.resta", { k: expr(P, d), x: xl });
        if (x.op === "=") { const sinAwait = N[d].tipo === "AwaitExpression" ? P.hijo(d, "argument") : d, r = N[sinAwait].tipo === "CallExpression" ? resolver(P, sinAwait) : null; if (r && r.def && r.def.clase === "lectura") return guardaHumana(P, F, f, xl, d); }
        return tpl("r.asigna", { x: xl, e: x.op === "=" ? expr(P, d) : [{ c: e }] });
      }
      if (x.tipo === "UpdateExpression") return tpl(x.op === "++" ? "r.suma" : "r.resta", { k: "1", x: [{ c: P.hijo(e, "argument") }] });
      if (x.tipo === "CallExpression") return llamadaHumana(P, F, f, e);
      return tpl("r.ejecuta", { c: [{ c: e }] });
    }
    if (n.tipo === "ReturnStatement") { const a = P.hijo(s, "argument"); return a != null ? tpl("r.devuelve", { e: expr(P, a) }) : [t("r.termina")]; }
    if (n.tipo === "BreakStatement") return f.bucle != null ? tpl("r.break", { f: fichaFila(f.bucle), a: adonde(P, F, f, f.sig) }) : [t("que.b.break")];
    if (n.tipo === "ContinueStatement") { const b = f.sig != null ? f.sig : f.bucle; return b != null ? tpl("r.continue", { f: fichaFila(b) }) : [t("que.b.continue")]; }
    if (n.tipo === "ThrowStatement") return tpl("r.lanza", { e: expr(P, P.hijo(s, "argument")) });
    return tpl("r.ejecuta", { c: [{ c: s }] });
  }
  function describir(P, F, i) {
    const f = F.filas[i], N = P.nodos, n = N[f.nodo];
    const filas = rango(P, F, i);
    let out;
    if (f.tipo === "bucle") {
      const cuerpo = filas || [t("r.vacio")];
      const conBreak = FL.dentro(P, F, i).some(k => F.filas[k].salto === "break" && F.filas[k].bucle === i);
      if (P.porCada.has(f.nodo)) {
        const pc = P.porCada.get(f.nodo);
        out = tpl(pc.clave ? "r.porCadaClave" : "r.porCada", { filas: cuerpo, x: [{ c: pc.x }], l: expr(P, pc.l) });
      } else if (f.infinito) out = tpl(conBreak ? "r.siempreBreak" : "r.siempre", { filas: cuerpo });
      else if (n.tipo === "DoWhileStatement") out = tpl("r.hastaQue", { filas: cuerpo, c: condicionHumana(P, f.test) });
      else out = tpl("r.mientras", { filas: cuerpo, c: condicionHumana(P, f.test) });
      if (!f.infinito) out.push(" ", ...tpl("r.alTerminar", { a: adonde(P, F, f, f.sig) }));
    } else if (f.tipo === "decision") {
      const si = f.si != null ? tpl("r.sigue", { f: fichaFila(f.si) }) : [t("r.nada")];
      const no = f.no != null ? tpl(F.filas[f.no].cadena ? "r.prueba" : "r.va", { f: fichaFila(f.no) }) : adonde(P, F, f, f.sig, { salta: true });
      out = tpl("r.si", { c: condicionHumana(P, f.test), a: si, b: no });
    } else if (f.tipo === "funcion") {
      const nom = n.tipo === "FunctionDeclaration" ? P.hijo(f.nodo, "id") : null;
      const nombre = nom != null ? N[nom].nombre : (n.padre != null && N[n.padre].tipo === "VariableDeclarator" ? N[P.hijo(n.padre, "id")].nombre : "…");
      out = filas ? tpl("r.funcion", { f: [{ k: nombre }], filas }) : tpl("r.funcionVacia", { f: [{ k: nombre }] });
    } else if (f.tipo === "intento") out = tpl("r.intenta", { filas: filas || [t("r.vacio")] });
    else if (f.tipo === "segun") out = tpl("r.segun", { e: expr(P, P.hijo(f.nodo, "discriminant")) });
    else {
      out = [...pasoHumano(P, F, f)];
      // Una salida lateral no repite «solo si…»: el paso anterior (su decisión) ya lo ha dicho.
      // La última fila de una vuelta: después vuelve al bucle (un continue ya lo dice).
      const riel = F.rieles.find(r => r.de === i);
      if (riel && f.salto !== "continue") out.push(" ", ...tpl("r.vuelveA", { f: fichaFila(riel.a) }));
      else if (f.sig == null && !f.salto && f.seccion == null && !f.bucle) out.push(" ", t("r.ultima"));
    }
    return [...out, ...capturas(P, F, i)];
  }
  // El final del recorrido: si el programa no acaba solo, por qué.
  function resumen(P, F, R) {
    const L = R && R.principal != null ? F.filas[R.principal] : null;
    const sale = L && FL.dentro(P, F, L.i).some(k => F.filas[k].salto === "break" && F.filas[k].bucle === L.i);
    const out = L && L.infinito && !sale ? tpl(P.serie && P.serie !== "libre" ? "r.finSiempreJuego" : "r.finSiempre", { f: fichaFila(L.i) }) : [t("r.fin")];
    if (F.secciones.length) out.push(" ", ...tpl("r.finFunciones", { f: unir(F.secciones.map(fichaFila), ", ") }));
    return out;
  }

  // Lo que se llama desde fuera con un programa fija el lenguaje de sus palabras.
  const con = (fn) => function (P, ...a) { py = !!(P && P.lenguaje === "python"); return fn(P, ...a); };
  return { tpl, t, num, resolver, valor, palabra, expr: con(expr), pred: con(pred), pregunta: con(pregunta), etiqueta: con(etiqueta),
    textoSalida: (f) => palabra(textoSalida(f)), condicion: con(condicion), detalle: con(detalle), queEs: con(queEs), describir: con(describir), resumen: con(resumen),
    lenguaje: (P) => { py = !!(P && P.lenguaje === "python"); } };
});
