/* Modo revisión · el programa como diagrama de flujo y la traza como un recorrido por ese diagrama.
 *
 * Funciona con cualquier programa: no sabe nada del reto ni del juego. Sale todo del árbol (acorn) y
 * de la traza del trazador.
 *
 *   preparar(programa, { id, serie }) → P   el programa con su tabla de nodos y ayudas para recorrerla
 *   construir(P) → F                        filas del diagrama, en orden de lectura
 *   recorrer(P, F, opciones) → R            pasos (una visita a una fila cada uno) y vueltas del bucle principal
 *   estructura(P, F) → R                    recorrido de lectura sin ejecutar: una visita por fila, en orden de
 *                                           lectura (cada salida lateral, justo después de su decisión)
 *   dentro(P, F, i) → [filas]               las filas que están dentro de la fila i (un bucle, una función…)
 *
 * Una fila es una sentencia (o la cabecera de un if, un bucle o una función) con número y color propios.
 * Su número y su color se repiten en el margen del código y en la franja de tiempo, igual que cada campo de
 * un formulario ilumina su parte del texto generado.
 *   fila = { i, tipo: 'paso'|'decision'|'bucle'|'funcion'|'intento'|'segun', nodo, test, nivel, num, color,
 *            lateral, salida, si, no, sig, rama, bucle, seccion, cadena, salto }
 *   si/no/sig: fila a la que se va si la condición es true / false / al terminar normalmente (null = fin). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.CMGFlujo = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : self, function () {
  "use strict";
  // Un color por fila, como cada campo del formulario. Sin verde ni rojo: son de true y false.
  const PALETA = ["#E0AE4A", "#7FA3FF", "#63D2E0", "#CFA2FF", "#E2894F", "#F27AB0", "#C3D96B", "#8FC9BC", "#B49BFF", "#E7C27D", "#6FB7F2", "#D79BD0"];
  const BUCLE = /^(While|DoWhile|For|ForOf|ForIn)Statement$/;
  const FUNCION = /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;
  // ¿Es «verdadero» un valor de la traza? undefined, NaN… llegan como { $: … }.
  const verdad = (v) => v && typeof v === "object" && "$" in v ? v.$ === "f" || v.$ === "p" || v.$ === "o" || (v.$ === "n" && v.v !== "NaN") : !!v;
  const COMPUESTA = /^(If|While|DoWhile|For|ForOf|ForIn|Try|Switch|Labeled|Block)Statement$/;

  function preparar(programa, { id = null, serie = "libre" } = {}) {
    const N = programa.nodos, src = programa.fuente;
    const P = { id, serie, lenguaje: programa.lenguaje === "python" ? "python" : "js", fuente: src, nodos: N, comentarios: programa.comentarios || [], eventos: programa.eventos || [], cache: new Map() };
    P.txt = (i) => src.slice(N[i].a, N[i].b);
    P.hijo = (i, campo) => { const h = N[i].hijos.find(x => N[x].campo === campo); return h === undefined ? null : h; };
    P.hijos = (i, campo) => N[i].hijos.filter(x => N[x].campo === campo);
    P.desciende = (i, de) => { for (let x = i; x != null; x = N[x].padre) if (x === de) return true; return false; };
    // Variables y parámetros: nombre → { declarador, clase: const|let|var|param }.
    P.variables = new Map();
    for (const n of N) {
      if (n.tipo === "VariableDeclarator") { const nom = P.hijo(n.id, "id"); if (nom != null && N[nom].nombre) P.variables.set(N[nom].nombre, { declarador: n.id, clase: N[n.padre].clase }); }
      if (FUNCION.test(n.tipo)) for (const p of P.hijos(n.id, "params")) if (N[p].nombre) P.variables.set(N[p].nombre, { declarador: p, clase: "param" });
    }
    // Funciones con nombre: nombre → nodo de la función.
    P.funciones = new Map();
    for (const n of N) {
      if (n.tipo === "FunctionDeclaration") { const f = P.hijo(n.id, "id"); if (f != null) P.funciones.set(N[f].nombre, n.id); }
      if (n.tipo === "VariableDeclarator") { const ini = P.hijo(n.id, "init"), nom = P.hijo(n.id, "id"); if (ini != null && FUNCION.test(N[ini].tipo) && N[nom].nombre) P.funciones.set(N[nom].nombre, ini); }
    }
    // Un nombre que se reasigna (g = otra cosa) ya no dice a qué función se llama: no se enlaza a ningún cuerpo.
    for (const n of N) if (n.tipo === "AssignmentExpression") { const l = P.hijo(n.id, "left"); if (l != null && N[l].tipo === "Identifier") P.funciones.delete(N[l].nombre); }
    // Bucles «por cada»: for…of, for…in y lista.forEach(x => { … }), que se lee igual que un for…of.
    // sentencia → { x: la variable de cada vuelta, l: lo que recorre, cuerpo, clave: for…in, fn: la función de forEach }
    P.porCada = new Map();
    P.cadaFn = new Set();
    P.cuerpoExpr = new Set();
    for (const n of N) {
      if (n.tipo === "ForOfStatement" || n.tipo === "ForInStatement") {
        const l = P.hijo(n.id, "left"), x = N[l].tipo === "VariableDeclaration" ? P.hijo(P.hijos(l, "declarations")[0], "id") : l;
        P.porCada.set(n.id, { x, l: P.hijo(n.id, "right"), cuerpo: P.hijo(n.id, "body"), clave: n.tipo === "ForInStatement", fn: null });
      }
      // Un forEach que es el cuerpo expresión de otro (l => l.forEach(x => …)) también es un bucle: su fila es la llamada.
      const fe = n.tipo === "ExpressionStatement" ? forEach(P, P.hijo(n.id, "expression")) : P.cuerpoExpr.has(n.id) ? forEach(P, n.id) : null;
      if (fe) { P.porCada.set(n.id, fe); P.cadaFn.add(fe.fn); }
    }
    return P;
  }
  // lista.forEach(x => { … }) o lista.forEach(function (x) { … }): la llamada c. Un callback async no es un bucle:
  // forEach no lo espera.
  function forEach(P, c) {
    const N = P.nodos;
    if (c == null || N[c].tipo !== "CallExpression") return null;
    const m = P.hijo(c, "callee"), args = P.hijos(c, "arguments");
    if (m == null || N[m].tipo !== "MemberExpression" || N[m].computado || args.length !== 1) return null;
    const prop = P.hijo(m, "property");
    if (prop == null || N[prop].nombre !== "forEach") return null;
    const fn = args[0];
    if (!/^(FunctionExpression|ArrowFunctionExpression)$/.test(N[fn].tipo) || (N[fn].tipo === "FunctionExpression" && P.hijo(fn, "id") != null)) return null;
    if (N[fn].async || /^async\b/.test(P.txt(fn))) return null;
    const cuerpo = P.hijo(fn, "body"), x = P.hijos(fn, "params")[0];
    if (cuerpo == null || x == null) return null;
    // Cuerpo de una expresión (x => console.log(x)): esa expresión es la fila del cuerpo, sin inventar una sentencia.
    if (N[cuerpo].tipo !== "BlockStatement") P.cuerpoExpr.add(cuerpo);
    return { x, l: P.hijo(m, "object"), cuerpo, clave: false, fn };
  }

  const bloque = (P, i) => i == null ? [] : P.nodos[i].tipo === "BlockStatement" ? P.hijos(i, "body") : [i];
  const sinVacias = (P, ids) => ids.filter(s => P.nodos[s].tipo !== "EmptyStatement" && P.nodos[s].tipo !== "FunctionDeclaration");

  function construir(P) {
    const N = P.nodos;
    const filas = [], filaDe = new Map(), orden = [], rieles = [], saltoA = new Map();
    const nueva = (tipo, nodo, nivel, ctx, extra = {}) => {
      const f = { i: filas.length, tipo, nodo, nivel, rama: !!ctx.rama, bucle: ctx.bucle ?? null, seccion: ctx.seccion ?? null, sig: null, ...extra };
      filas.push(f); filaDe.set(nodo, f.i);
      return f;
    };
    const unir = (de, a) => { for (const r of de) filas[r].sig = a; };
    // Cada sentencia devuelve { entrada, salidas, breaks, continues }: las salidas siguen en lo que venga después.
    function seq(ids, nivel, ctx) {
      ids = sinVacias(P, ids);
      let entrada = null, salidas = null;
      const breaks = [], continues = [];
      ids.forEach((s, k) => {
        if (k > 0) orden.push({ conector: true, nivel, etiqueta: salidas && salidas.etiqueta || null });
        const r = sentencia(s, nivel, ctx);
        if (entrada == null) entrada = r.entrada;
        if (salidas) unir(salidas, r.entrada);
        salidas = r.salidas; salidas.etiqueta = r.abajo || null;
        breaks.push(...r.breaks); continues.push(...r.continues);
      });
      return { entrada, salidas: salidas || [], breaks, continues, vacia: entrada == null };
    }
    const simple = (s) => !COMPUESTA.test(N[s].tipo);
    // Las etiquetas de una sentencia (a: b: for…): todas las LabeledStatement seguidas que la envuelven.
    const etiquetasDe = (s) => { const out = []; for (let x = N[s].padre; x != null && N[x].tipo === "LabeledStatement"; x = N[x].padre) out.push(N[P.hijo(x, "label")].nombre); return out; };
    function sentencia(s, nivel, ctx) {
      const n = N[s];
      if (BUCLE.test(n.tipo) || P.porCada.has(s)) return bucle(s, nivel, ctx);
      if (n.tipo === "IfStatement") return decision(s, nivel, ctx);
      if (n.tipo === "BlockStatement") { const r = seq(P.hijos(s, "body"), nivel, ctx); return r.vacia ? paso(s, nivel, ctx) : r; }
      if (n.tipo === "LabeledStatement") {
        // Un bucle o un switch con etiqueta(s) resuelve sus saltos él mismo (etiquetasDe). Un bloque con etiqueta
        // consume los break que la nombran: salen del bloque y siguen detrás.
        let dentro = s;
        while (N[dentro].tipo === "LabeledStatement") dentro = P.hijo(dentro, "body");
        if (BUCLE.test(N[dentro].tipo) || P.porCada.has(dentro) || N[dentro].tipo === "SwitchStatement") return sentencia(dentro, nivel, ctx);
        const r = sentencia(dentro, nivel, ctx), suyas = etiquetasDe(dentro);
        const mios = r.breaks.filter(x => suyas.includes(saltoA.get(x)));
        for (const x of mios) filas[x].destino = { tipo: "bloque", nombre: saltoA.get(x) };
        return { ...r, salidas: [...r.salidas, ...mios], breaks: r.breaks.filter(x => !mios.includes(x)) };
      }
      if (n.tipo === "TryStatement") return intento(s, nivel, ctx);
      if (n.tipo === "SwitchStatement") return segun(s, nivel, ctx);
      return paso(s, nivel, ctx);
    }
    function paso(s, nivel, ctx, lateral = false) {
      const t = N[s].tipo;
      // return dentro de forEach termina solo esa vuelta: sigue con la siguiente, como continue.
      const sigue = t === "ReturnStatement" && ctx.cadaFn != null && ctx.cadaFn === ctx.bucle;
      const f = nueva("paso", s, nivel, ctx, { lateral, salto: t === "BreakStatement" ? "break" : t === "ContinueStatement" || sigue ? "continue" : t === "ReturnStatement" || t === "ThrowStatement" ? "fin" : null });
      // break/continue con etiqueta: es del bucle que la lleva, no del más cercano.
      if (t === "BreakStatement" || t === "ContinueStatement") { const l = P.hijo(s, "label"); if (l != null) saltoA.set(f.i, N[l].nombre); }
      if (!lateral) orden.push({ fila: f.i });
      if (f.salto === "break") return { entrada: f.i, salidas: [], breaks: [f.i], continues: [] };
      if (f.salto === "continue") return { entrada: f.i, salidas: [], breaks: [], continues: [f.i] };
      if (f.salto === "fin") return { entrada: f.i, salidas: [], breaks: [], continues: [] };
      return { entrada: f.i, salidas: [f.i], breaks: [], continues: [] };
    }
    function bucle(s, nivel, ctx) {
      const n = N[s], test = /^(While|DoWhile|For)Statement$/.test(n.tipo) ? P.hijo(s, "test") : null;
      const infinito = /^(While|DoWhile|For)Statement$/.test(n.tipo) && (test == null || (N[test].tipo === "Literal" && N[test].valor === true));
      const R = nueva("bucle", s, nivel, ctx, { test, infinito });
      if (test != null) filaDe.set(test, R.i);
      R.salida = infinito ? null : { tipo: "fin", etiqueta: test != null ? "false" : "fin" };
      orden.push({ fila: R.i });
      const pc = P.porCada.get(s);
      const cuerpo = sinVacias(P, bloque(P, pc ? pc.cuerpo : P.hijo(s, "body")));
      if (cuerpo.length) orden.push({ conector: true, nivel: nivel + 1, etiqueta: test != null && !infinito ? "true" : null });
      const r = seq(cuerpo, nivel + 1, { ...ctx, bucle: R.i, cadaFn: pc && pc.fn != null ? R.i : ctx.cadaFn });
      R.si = r.entrada;
      // Los saltos sin etiqueta o con la de este bucle son suyos; los demás siguen hacia fuera.
      const etiquetas = etiquetasDe(s);
      const mio = (x) => !saltoA.has(x) || etiquetas.includes(saltoA.get(x));
      const continues = r.continues.filter(mio), breaks = r.breaks.filter(mio);
      for (const x of breaks) filas[x].destino = { tipo: "bucle", fila: R.i };
      unir(r.salidas, R.i); unir(continues, R.i);
      for (const de of [...r.salidas, ...continues]) rieles.push({ de, a: R.i });
      return { entrada: R.i, salidas: infinito ? [...breaks] : [R.i, ...breaks], breaks: r.breaks.filter(x => !mio(x)), continues: r.continues.filter(x => !mio(x)) };
    }
    function decision(s, nivel, ctx) {
      let x = s, primera = true, anterior = null, abajo = null;
      const salidas = [], breaks = [], continues = [];
      let entrada = null;
      while (x != null) {
        const test = P.hijo(x, "test");
        const D = nueva("decision", x, nivel, ctx, { test, cadena: !primera });
        filaDe.set(test, D.i);
        if (entrada == null) entrada = D.i;
        if (anterior) anterior.no = D.i;
        orden.push({ fila: D.i });
        const cons = sinVacias(P, bloque(P, P.hijo(x, "consequent")));
        const rama = { ...ctx, rama: true };
        if (cons.length === 1 && simple(cons[0])) {
          const r = paso(cons[0], nivel + 1, rama, true);
          D.salida = { tipo: "fila", fila: r.entrada, etiqueta: "true" };
          D.si = r.entrada; salidas.push(...r.salidas); breaks.push(...r.breaks); continues.push(...r.continues);
          D.salta = !r.salidas.length;
        } else if (cons.length) {
          orden.push({ conector: true, nivel: nivel + 1, etiqueta: "true" });
          const r = seq(cons, nivel + 1, rama);
          D.si = r.entrada; salidas.push(...r.salidas); breaks.push(...r.breaks); continues.push(...r.continues);
        } else { D.si = null; salidas.push(D.i); }
        const alt = P.hijo(x, "alternate");
        if (alt != null && N[alt].tipo === "IfStatement") { orden.push({ conector: true, nivel, etiqueta: "false" }); anterior = D; primera = false; x = alt; continue; }
        if (alt != null && sinVacias(P, bloque(P, alt)).length) {
          orden.push({ conector: true, nivel: nivel + 1, etiqueta: "false" });
          const r = seq(bloque(P, alt), nivel + 1, rama);
          D.no = r.entrada; salidas.push(...r.salidas); breaks.push(...r.breaks); continues.push(...r.continues);
        } else { D.no = null; salidas.push(D.i); if (D.salta) abajo = "false"; }
        x = null;
      }
      return { entrada, salidas, breaks, continues, abajo };
    }
    function intento(s, nivel, ctx) {
      const T = nueva("intento", s, nivel, ctx);
      orden.push({ fila: T.i });
      orden.push({ conector: true, nivel: nivel + 1, etiqueta: null });
      const a = seq(bloque(P, P.hijo(s, "block")), nivel + 1, ctx);
      T.si = a.entrada;
      const salidas = [...a.salidas], breaks = [...a.breaks], continues = [...a.continues];
      const h = P.hijo(s, "handler");
      if (h != null) {
        orden.push({ conector: true, nivel: nivel + 1, etiqueta: "catch" });
        const b = seq(bloque(P, P.hijo(h, "body")), nivel + 1, { ...ctx, rama: true });
        salidas.push(...b.salidas); breaks.push(...b.breaks); continues.push(...b.continues);
      }
      const fin = P.hijo(s, "finalizer");
      if (fin != null) {
        orden.push({ conector: true, nivel: nivel + 1, etiqueta: "finally" });
        const c = seq(bloque(P, fin), nivel + 1, ctx);
        if (!c.vacia) { unir(salidas, c.entrada); return { entrada: T.i, salidas: c.salidas, breaks, continues }; }
      }
      if (a.vacia) salidas.push(T.i);
      return { entrada: T.i, salidas, breaks, continues };
    }
    function segun(s, nivel, ctx) {
      const S = nueva("segun", s, nivel, ctx);
      orden.push({ fila: S.i });
      const salidas = [], breaks = [], continues = [];
      let previas = [];
      for (const c of P.hijos(s, "cases")) {
        const prueba = P.hijo(c, "test");
        orden.push({ conector: true, nivel: nivel + 1, etiqueta: prueba == null ? "default" : `case ${P.txt(prueba)}` });
        const r = seq(P.hijos(c, "consequent"), nivel + 1, { ...ctx, rama: true });
        if (!r.vacia) { if (S.si == null) S.si = r.entrada; unir(previas, r.entrada); previas = r.salidas; }
        breaks.push(...r.breaks); continues.push(...r.continues);
      }
      // break dentro de switch sale del switch, no del bucle; uno con la etiqueta de otro sitio sigue hacia fuera.
      const etiquetas = etiquetasDe(s), mio = (x) => !saltoA.has(x) || etiquetas.includes(saltoA.get(x));
      const propios = breaks.filter(mio);
      for (const x of propios) filas[x].destino = { tipo: "segun", fila: S.i };
      salidas.push(...previas, ...propios, S.i);
      return { entrada: S.i, salidas, breaks: breaks.filter(x => !mio(x)), continues };
    }

    // El programa, y después cada función con cuerpo de bloque como sección aparte.
    const principal = seq(P.hijos(0, "body"), 0, {});
    unir(principal.salidas, null);
    const secciones = [];
    for (const n of N) {
      if (!FUNCION.test(n.tipo) || P.cadaFn.has(n.id)) continue;
      const cuerpo = P.hijo(n.id, "body");
      if (cuerpo == null || N[cuerpo].tipo !== "BlockStatement") continue;
      const H = nueva("funcion", n.id, 0, {});
      H.seccion = H.i;
      orden.push({ seccion: H.i });
      const r = seq(P.hijos(cuerpo, "body"), 1, { seccion: H.i });
      H.si = r.entrada;
      unir(r.salidas, null);
      secciones.push(H.i);
    }

    // Números y colores en orden de lectura; la salida lateral va justo después de su decisión.
    let num = 0;
    const numerar = (f) => { f.num = ++num; f.color = PALETA[(f.num - 1) % PALETA.length]; };
    for (const e of orden) {
      const f = e.fila != null ? filas[e.fila] : e.seccion != null ? filas[e.seccion] : null;
      if (!f) continue;
      numerar(f);
      if (f.salida && f.salida.tipo === "fila") numerar(filas[f.salida.fila]);
    }
    for (const f of filas) if (f.num == null) numerar(f);

    // Quién es dueño de cada nodo: la fila más cercana hacia arriba en el árbol.
    const duenas = new Map();
    function duena(i) {
      if (i == null) return null;
      if (duenas.has(i)) return duenas.get(i);
      let r = null;
      for (let x = i; x != null; x = N[x].padre) if (filaDe.has(x)) { r = filaDe.get(x); break; }
      duenas.set(i, r);
      return r;
    }
    // Una función escrita dentro de una fila sin sección propia («() => i»): la más externa que contiene el
    // nodo i por debajo de su fila, o null. Lo de dentro se ejecuta cuando alguien la llama, no en su fila.
    const enLineas = new Map();
    function enLinea(i) {
      if (i == null) return null;
      if (enLineas.has(i)) return enLineas.get(i);
      const f = duena(i);
      let r = null;
      if (f != null) for (let x = i; x != null && x !== filas[f].nodo; x = N[x].padre) if (FUNCION.test(N[x].tipo) && !P.cadaFn.has(x)) r = x;
      enLineas.set(i, r);
      return r;
    }
    // El nodo que se ilumina en el código para cada fila: la condición, o la sentencia entera.
    // (en for…of / for…in, la variable de cada vuelta: «const n»).
    for (const f of filas) f.foco = f.test != null ? f.test : N[f.nodo].tipo === "ForOfStatement" || N[f.nodo].tipo === "ForInStatement" ? P.hijo(f.nodo, "left") : P.porCada.has(f.nodo) ? P.porCada.get(f.nodo).x : f.nodo;
    // Líneas de cada fila (para el margen del código): la de su cabecera.
    for (const f of filas) f.linea = N[f.foco].linea;
    return { filas, filaDe, orden, rieles, secciones, duena, enLinea, entrada: principal.entrada };
  }

  // ---------- La traza como recorrido ----------
  // paso = { i, fila, nodo, valor?, vals: Map(nodo → valor), t, t1?, espera?, vuelta, fuera?, lecturas?, diferido? } y al final { fin: true }.
  // diferido = la función en línea que corre, agendada, cuando ya acabó el código principal.
  // regreso = la llamada next() cuyo resultado llega en este paso, después del cuerpo del generador.
  // lecturas = [{ llamada, lee: [[nodo, valor]…] }]: lo que leyó cada función en línea al llamarla en este paso.
  function recorrer(P, F, { fin = null } = {}) {
    const N = P.nodos, pasos = [];
    let t = null, cur = null;
    const vueltasDe = new Map(), enEspera = new Map();
    const nuevo = (fila, nodo) => { const p = { i: pasos.length, fila, nodo, t, vals: new Map() }; pasos.push(p); return p; };
    const esCondicion = (n) => (n.campo === "test" && /^(If|While|DoWhile|For)Statement$/.test(N[n.padre].tipo)) || P.porCada.has(n.id);
    // Callbacks agendados: cada ejecución va entre ["corre"] y ["/corre"] (ronda), también si corre mientras el
    // código principal espera; ["luego"]: ya terminó el código principal. Al salir de un callback, el paso en
    // curso vuelve a ser el del código principal.
    let luego = false, ronda = 0, enCallback = false, principalCur = null;
    // next() de un generador → el nodo cuyo valor trae su resultado: la llamada, o el await que la espera
    // (generador async: la llamada solo da una promesa, que no dice nada).
    const avances = new Map();
    const esperados = new Set();
    for (const n of N) if (n.tipo === "CallExpression" && avance(P, n.id)) {
      if (N[n.padre].tipo === "AwaitExpression") { avances.set(n.padre, n.id); esperados.add(n.id); } else avances.set(n.id, n.id);
    }
    for (const e of P.eventos) {
      if (e[0] === "luego") { luego = true; cur = null; continue; }
      if (e[0] === "corre") { ronda++; enCallback = true; principalCur = cur; continue; }
      if (e[0] === "/corre") { enCallback = false; if (!luego) cur = principalCur; continue; }
      // Un callback que corre durante una espera mueve el reloj, pero la espera sigue hasta que vuelve el principal.
      if (e[0] === "t") { t = e[1]; if (!enCallback && cur && cur.espera != null && cur.t1 == null) cur.t1 = t; continue; }
      const id = e[0], n = N[id];
      if (!n) continue;
      if (e.length === 1) {
        if (n.ganchos.includes("s") && !n.ganchos.includes("w")) {
          // Un bloque suelto o una etiqueta no son filas: sus sentencias ya avisan solas.
          const f = F.filaDe.get(id);
          if (f == null) continue;
          cur = nuevo(f, id);
          const tipo = F.filas[f].tipo;
          cur.pendiente = tipo === "decision" || tipo === "bucle";
          if (tipo === "bucle") vueltasDe.set(f, 0);
        } else if (cur) { cur.espera = id; }
        continue;
      }
      const v = e[1];
      if (n.ganchos.includes("c") && esCondicion(n)) {
        const f = F.filaDe.get(id);
        const fila = F.filas[f];
        const iter = fila.tipo === "bucle" && (verdad(v) || P.porCada.has(n.id)) ? vueltasDe.set(f, (vueltasDe.get(f) || 0) + 1).get(f) : null;
        const antes = enEspera.get(f) || new Map();
        enEspera.delete(f);
        if (cur && cur.fila === f && cur.pendiente) { for (const [a, b] of antes) cur.vals.set(a, b); cur.valor = v; cur.nodo = id; cur.pendiente = false; cur.vals.set(id, v); cur.iter = iter; continue; }
        cur = nuevo(f, id); cur.valor = v; cur.iter = iter;
        for (const [a, b] of antes) cur.vals.set(a, b);
        cur.vals.set(id, v);
        // Si la condición llamó a funciones del programa, los valores de antes de la llamada siguen siendo suyos.
        for (let k = pasos.length - 2; k >= Math.max(0, pasos.length - 80); k--) if (pasos[k].fila === f && pasos[k].pendiente) { for (const [a, b] of pasos[k].vals) if (!cur.vals.has(a)) cur.vals.set(a, b); break; }
        continue;
      }
      // Lo de dentro de una función en línea pasa cuando alguien la llama: es del paso en curso (el que la
      // llama), no de la fila donde se escribió. Se junta con la llamada que llega justo después.
      // Después del código principal (luego), una función en línea que corre es un callback agendado: abre su
      // propio paso en la fila donde se escribió (paso.diferido = la función).
      const fnL = F.enLinea(id);
      if (fnL != null) {
        // Sin marcas (la continuación de un await, un then…), un mismo nodo que vuelve a evaluarse es otra ejecución.
        const otra = cur && cur.diferido === fnL && !enCallback && cur.vals.has(id);
        if ((luego || enCallback) && (otra || !(cur && cur.diferido === fnL && cur.ronda === ronda))) { cur = nuevo(F.duena(fnL), fnL); cur.diferido = fnL; cur.ronda = ronda; cur.luego = luego; cur.continua = !enCallback; }
        if (cur) { cur.vals.set(id, v); if (cur.diferido == null) (cur.pend || (cur.pend = [])).push([id, v]); }
        continue;
      }
      if (cur && cur.pend && F.duena(id) === cur.fila) {
        const llamada = n.tipo === "CallExpression" ? id : n.tipo === "AwaitExpression" && N[P.hijo(id, "argument")].tipo === "CallExpression" ? P.hijo(id, "argument") : null;
        const c = llamada != null ? N[P.hijo(llamada, "callee")] : null, propia = c && c.tipo === "Identifier" ? P.funciones.get(c.nombre) : undefined;
        if (llamada != null && (propia === undefined || cur.pend.some(([x]) => F.enLinea(x) === propia))) { (cur.lecturas || (cur.lecturas = [])).push({ llamada, lee: cur.pend }); cur.pend = null; }
      }
      // Lo que se lee para una condición llega antes que la condición: se guarda para su paso.
      const f = F.duena(id);
      const ff = f != null ? F.filas[f] : null;
      if (ff && ff.test != null && P.desciende(id, ff.test) && !(cur && cur.fila === f && cur.pendiente)) {
        (enEspera.get(f) || enEspera.set(f, new Map()).get(f)).set(id, v);
        continue;
      }
      // next() de un generador: si su cuerpo ha corrido entre medias, el resultado llega después, en un paso
      // propio de vuelta a la fila (paso.regreso), no en el paso de antes del cuerpo.
      if (esperados.has(id)) continue;
      if (f != null && cur && cur.fila !== f && avances.has(id)) { const c = avances.get(id); cur = nuevo(f, c); cur.regreso = c; cur.vals.set(id, v); cur.vals.set(c, v); continue; }
      // Un valor va al último paso de su fila: una llamada a una función propia intercala otros pasos.
      // En una recursión, el paso de fuera recibe su valor después que los de dentro: va al paso más reciente
      // de su fila que todavía no lo tenga (y si todos lo tienen, al más reciente).
      let destino = cur, reciente = null;
      if (f != null) for (let k = pasos.length - 1; k >= Math.max(0, pasos.length - 2000); k--) {
        if (pasos[k].fila !== f) continue;
        if (!reciente) reciente = pasos[k];
        if (!pasos[k].vals.has(id)) { destino = pasos[k]; break; }
        destino = reciente;
      }
      if (destino) destino.vals.set(id, v);
    }

    // Bucle principal: el de fuera (fuera de funciones) con más visitas. Cada visita que entra abre una vuelta.
    const visitas = new Map();
    for (const p of pasos) if (p.valor !== undefined) visitas.set(p.fila, (visitas.get(p.fila) || 0) + 1);
    const candidatos = F.filas.filter(f => f.tipo === "bucle" && f.seccion == null && visitas.get(f.i));
    candidatos.sort((a, b) => a.nivel - b.nivel || visitas.get(b.i) - visitas.get(a.i));
    const L = candidatos.length ? candidatos[0] : null;
    const vueltas = [];
    let fuera = false, actual = null;
    const porCada = L && P.porCada.has(L.nodo);
    const dentro = (i) => { const f = F.filas[i]; if (f.seccion != null || i === L.i) return true; for (let b = f.bucle; b != null; b = F.filas[b].bucle) if (b === L.i) return true; return false; };
    for (const p of pasos) {
      if (L && p.fila === L.i && p.valor !== undefined && !fuera) {
        if (porCada || verdad(p.valor)) { actual = { n: vueltas.length + 1, desde: p.i, hasta: p.i, t0: p.t, color: null, fila: null }; vueltas.push(actual); }
        else { fuera = true; p.vuelta = actual ? actual.n : 0; if (actual) actual.hasta = p.i; continue; }
      }
      // Una fila fuera del bucle (ni dentro de él ni en una función) después de empezar: ya salió.
      if (actual && !fuera && !dentro(p.fila)) fuera = true;
      p.vuelta = fuera ? null : actual ? actual.n : 0;
      if (fuera) p.fuera = true;
      if (actual && !fuera) {
        actual.hasta = p.i;
        if (actual.fila == null && F.filas[p.fila].rama && F.filas[p.fila].seccion == null) { actual.fila = p.fila; actual.color = F.filas[p.fila].color; }
      }
    }
    for (const p of pasos) delete p.pend;
    // Último paso: cómo termina (partida, error, corte o fin del programa).
    const ultimo = pasos.length ? pasos[pasos.length - 1] : null;
    const pasoFin = { i: pasos.length, fin: true, fila: null, t: fin && fin.t != null ? fin.t : ultimo ? (ultimo.t1 ?? ultimo.t) : null, vals: new Map(), vuelta: ultimo ? ultimo.vuelta : 0, fuera: ultimo ? ultimo.fuera : false };
    if (ultimo && ultimo.espera != null && ultimo.t1 == null) ultimo.cortada = true;
    pasos.push(pasoFin);
    for (let k = 0; k < vueltas.length; k++) vueltas[k].t1 = k + 1 < vueltas.length ? vueltas[k + 1].t0 : pasoFin.t;
    const antes = pasos.findIndex(p => p.vuelta !== 0);
    // Cuántas veces pasó por cada fila y qué dio cada condición (para la tarjeta de una fila).
    const cuentas = new Map();
    for (const p of pasos) {
      if (p.fin) continue;
      const c = cuentas.get(p.fila) || cuentas.set(p.fila, { veces: 0, si: 0, no: 0 }).get(p.fila);
      if (p.valor === undefined && p.pendiente) continue;
      c.veces++;
      if (p.valor !== undefined) { if (verdad(p.valor)) c.si++; else c.no++; }
    }
    return { pasos, vueltas, principal: L ? L.i : null, antes: antes > 0 ? antes : 0, cuentas, conReloj: pasos.some(p => p.t != null && p.t > 0) };
  }

  // ---------- Recorrido de lectura ----------
  // Para entender el código antes de ejecutarlo: no hay traza ni valores, solo el programa leído fila a
  // fila. Mismo formato que recorrer (los pasos no tienen valor) y R.estructural = true.
  function estructura(P, F) {
    const filas = [...F.filas].sort((a, b) => a.num - b.num);
    const pasos = filas.map((f, i) => ({ i, fila: f.i, nodo: f.foco, t: null, vals: new Map(), vuelta: 0 }));
    pasos.push({ i: pasos.length, fin: true, fila: null, t: null, vals: new Map(), vuelta: 0 });
    // El bucle principal: el de más fuera del programa (no de una función).
    const L = F.filas.filter(f => f.tipo === "bucle" && f.seccion == null).sort((a, b) => a.nivel - b.nivel || a.num - b.num)[0];
    return { pasos, vueltas: [], principal: L ? L.i : null, antes: 0, cuentas: new Map(), conReloj: false, estructural: true };
  }
  // Filas dentro de otra (su nodo desciende del de ella), en orden de lectura.
  function dentro(P, F, i) {
    const de = F.filas[i].nodo;
    return F.filas.filter(f => f.i !== i && P.desciende(f.nodo, de)).sort((a, b) => a.num - b.num).map(f => f.i);
  }

  // La expresión que hace la fila s: la de una sentencia expresión, o la fila misma si es el cuerpo expresión de
  // un forEach (x => console.log(x)). null si la fila es otra cosa.
  const expresion = (P, s) => P.nodos[s].tipo === "ExpressionStatement" ? P.hijo(s, "expression") : P.cuerpoExpr && P.cuerpoExpr.has(s) ? s : null;
  // ---------- Ámbitos: a qué declaración se refiere un nombre ----------
  // La función (o el programa, 0) donde está el nodo i.
  function funcionDe(P, i) { const N = P.nodos; for (let x = N[i].padre; x != null; x = N[x].padre) if (FUNCION.test(N[x].tipo)) return x; return 0; }
  // ¿Es el identificador i un uso de una variable? (no un nombre de propiedad, de parámetro o de declaración)
  function esUso(P, i) {
    const N = P.nodos, n = N[i];
    if (n.tipo !== "Identifier" || !n.nombre || n.campo === "params" || n.campo === "key" || n.campo === "id" || n.campo === "label") return false;
    return !(n.campo === "property" && N[n.padre].tipo === "MemberExpression" && !N[n.padre].computado);
  }
  // La declaración que ve el identificador i: { nodo, clase: let|const|var|param, ambito } o null (un nombre del
  // juego o global). let/const valen en su bloque (y la cabecera de su for); var y Python, en toda su función.
  function declaracion(P, i) {
    const N = P.nodos, nom = N[i].nombre, py = P.lenguaje === "python";
    const nombre = (d) => N[P.hijo(d, "id")]?.nombre;
    const deFuncion = (fn) => {
      for (const d of N) if (d.tipo === "FunctionDeclaration" && nombre(d.id) === nom && funcionDe(P, d.id) === fn) return { nodo: d.id, clase: "funcion", ambito: fn };
      for (const d of N) if (d.tipo === "VariableDeclarator" && nombre(d.id) === nom && funcionDe(P, d.id) === fn) {
        const c = N[d.padre].clase;
        if (py || c === "var") return { nodo: d.id, clase: py ? "var" : c, ambito: fn };
      }
      return null;
    };
    for (let x = N[i].padre; x != null; x = N[x].padre) {
      const n = N[x];
      if (!py) {
        const lista = n.tipo === "ForStatement" ? P.hijos(x, "init") : /^For(Of|In)Statement$/.test(n.tipo) ? P.hijos(x, "left")
          : n.tipo === "BlockStatement" || n.tipo === "Program" ? P.hijos(x, "body") : [];
        for (const h of lista) if (N[h].tipo === "VariableDeclaration" && (N[h].clase === "let" || N[h].clase === "const"))
          for (const d of P.hijos(h, "declarations")) if (nombre(d) === nom) return { nodo: d, clase: N[h].clase, ambito: x };
      }
      if (FUNCION.test(n.tipo)) {
        const p = P.hijos(x, "params").find(q => N[q].nombre === nom);
        if (p != null) return { nodo: p, clase: "param", ambito: x };
        const d = deFuncion(x);
        if (d) return d;
      }
      if (x === 0) return deFuncion(0);
    }
    return null;
  }
  // ¿El identificador i lee una variable del programa declarada fuera de la función fn?
  function deFuera(P, i, fn) {
    if (!esUso(P, i)) return false;
    const d = declaracion(P, i);
    return !!d && !P.desciende(d.nodo, fn);
  }
  // Una función que se guarda para después (no se ejecuta en su fila): en una variable, una propiedad, una
  // lista, un return, o como argumento de algo que se sabe que la guarda: push/unshift/append/insert de una
  // lista del programa ([]), add de un new Set, set de un new Map, o setTimeout/setInterval/queueMicrotask sin
  // redefinir. Un método que solo se llama igual (receptor.push) no lo acredita: de las demás (map, forEach,
  // una función cualquiera) no se sabe si se llaman ahí mismo, y la frase no dice cuándo se ejecutan.
  const AGENDAN = new Set(["setTimeout", "setInterval", "queueMicrotask"]);
  const GUARDAN = { push: "ArrayExpression", unshift: "ArrayExpression", append: "ArrayExpression", insert: "ArrayExpression", add: "Set", set: "Map" };
  function guardada(P, fn) {
    const N = P.nodos, n = N[fn], p = N[n.padre];
    if (p.tipo === "VariableDeclarator" || p.tipo === "AssignmentExpression" || p.tipo === "ArrayExpression" || p.tipo === "Property" || p.tipo === "ReturnStatement") return true;
    if (p.tipo !== "CallExpression" || n.campo !== "arguments") return false;
    const c = P.hijo(n.padre, "callee");
    if (N[c].tipo === "Identifier") return AGENDAN.has(N[c].nombre) && !declaracion(P, c);
    if (N[c].tipo !== "MemberExpression" || N[c].computado) return false;
    const o = P.hijo(c, "object"), tipo = GUARDAN[N[P.hijo(c, "property")]?.nombre];
    if (!tipo || N[o].tipo !== "Identifier") return false;
    const d = declaracion(P, o), ini = d && N[d.nodo].tipo === "VariableDeclarator" ? P.hijo(d.nodo, "init") : null;
    if (ini == null) return false;
    // Un método sustituido (f.push = cb => cb()) ya no acredita nada.
    const metodo = N[P.hijo(c, "property")].nombre;
    if (N.some(x => x.tipo === "AssignmentExpression" && (() => { const l = P.hijo(x.id, "left"); if (N[l].tipo !== "MemberExpression") return false;
      const lo = P.hijo(l, "object"), lp = P.hijo(l, "property");
      return N[lo].tipo === "Identifier" && declaracion(P, lo)?.nodo === d.nodo && (N[l].computado ? N[lp].valor === metodo : N[lp].nombre === metodo); })())) return false;
    if (tipo === "ArrayExpression") return N[ini].tipo === "ArrayExpression";
    return N[ini].tipo === "NewExpression" && N[P.hijo(ini, "callee")]?.nombre === tipo;
  }
  // ---------- Generadores ----------
  // ¿El yield i delega (yield*, yield from)? Sin la marca (tablas antiguas o Python), por su texto.
  const delega = (P, i) => !!P.nodos[i].delega || /^yield\s*(\*|from\b)/.test(P.txt(i));
  // ¿Es generadora la función fn? (function*; en Python, un def con yield). Sin la marca (tablas antiguas), por su texto.
  const generadora = (P, fn) => fn != null && FUNCION.test(P.nodos[fn].tipo) && (!!P.nodos[fn].generador || /^(async\s+)?function\s*\*/.test(P.txt(fn)));
  // La función propia a la que llama la llamada i, si se sabe por su nombre (function g, const g = function…).
  function funcionDeLlamada(P, i) {
    const N = P.nodos, c = P.hijo(i, "callee");
    if (N[c].tipo !== "Identifier") return null;
    const d = declaracion(P, c);
    if (!d) return null;
    // Si el nombre se reasigna (g = otra cosa), ya no se sabe a qué función llama.
    if (N.some(x => x.tipo === "AssignmentExpression" && (() => { const l = P.hijo(x.id, "left"); return N[l].tipo === "Identifier" && N[l].nombre === N[c].nombre && declaracion(P, l)?.nodo === d.nodo; })())) return null;
    if (d.clase === "funcion") return d.nodo;
    if (N[d.nodo].tipo === "VariableDeclarator" && d.clase === "const") { const ini = P.hijo(d.nodo, "init"); return ini != null && FUNCION.test(N[ini].tipo) ? ini : null; }
    return null;
  }
  // ¿La llamada i crea un generador? (llama a una función generadora) → esa función, o null.
  function creaGenerador(P, i) {
    if (i == null || P.nodos[i].tipo !== "CallExpression") return null;
    const fn = funcionDeLlamada(P, i);
    return generadora(P, fn) ? fn : null;
  }
  // ¿La llamada i avanza un generador? g().next(), it.next() (it = g(), sin reasignar) o next(it) en Python
  // → { fn, gen } (la función generadora y el nodo del generador en el código), o null.
  function avance(P, i) {
    const N = P.nodos;
    if (N[i].tipo !== "CallExpression") return null;
    const c = P.hijo(i, "callee");
    let gen = null;
    if (N[c].tipo === "MemberExpression" && !N[c].computado && N[P.hijo(c, "property")]?.nombre === "next") gen = P.hijo(c, "object");
    else if (P.lenguaje === "python" && N[c].tipo === "Identifier" && N[c].nombre === "next" && !declaracion(P, c)) gen = P.hijos(i, "arguments")[0];
    if (gen == null) return null;
    // Un generador async: next() da una promesa; si nadie la espera (await), el programa sigue sin el valor.
    const con = (r) => r && { ...r, async: /^async\b/.test(P.txt(r.fn)), esperado: N[N[i].padre].tipo === "AwaitExpression" };
    if (N[gen].tipo === "CallExpression") { const fn = creaGenerador(P, gen); return fn != null ? con({ fn, gen }) : null; }
    if (N[gen].tipo !== "Identifier") return null;
    const d = declaracion(P, gen);
    if (!d || N[d.nodo].tipo !== "VariableDeclarator") return null;
    const fn = creaGenerador(P, P.hijo(d.nodo, "init"));
    if (fn == null) return null;
    // Si se reasigna, ya no se sabe qué generador es.
    const misma = (x) => N[x].tipo === "Identifier" && N[x].nombre === N[gen].nombre && declaracion(P, x)?.nodo === d.nodo;
    if (N.some(x => x.tipo === "AssignmentExpression" && misma(P.hijo(x.id, "left")))) return null;
    if (P.lenguaje === "python" && N.some(x => x.tipo === "VariableDeclarator" && x.id !== d.nodo && misma(P.hijo(x.id, "id")))) return null;
    return con({ fn, gen });
  }
  // La llamada i agenda una función para después del código principal (queueMicrotask, setTimeout, setInterval
  // sin redefinir)? → el nodo de la función (escrita ahí o por su nombre), o null.
  function agendada(P, i) {
    const N = P.nodos;
    if (N[i].tipo !== "CallExpression") return null;
    const c = P.hijo(i, "callee"), a0 = P.hijos(i, "arguments")[0];
    if (N[c].tipo !== "Identifier" || !AGENDAN.has(N[c].nombre) || declaracion(P, c) || a0 == null) return null;
    if (FUNCION.test(N[a0].tipo)) return a0;
    return N[a0].tipo === "Identifier" && P.funciones.has(N[a0].nombre) ? a0 : null;
  }
  // Funciones escritas en la fila i (en línea o con su propio cuerpo) que usan una variable de un bucle que
  // las rodea: [{ fn, x, tipo, cabecera, guardada }].
  //   tipo 'propia': let/const declarada dentro de ese bucle (JS): cada vuelta tiene la suya y la función se
  //     queda con la de su vuelta. cabecera: es la del for («for (let i…)»), no una del cuerpo.
  //   tipo 'compartida': una sola variable (var, de fuera o de Python) que cambia dentro del bucle: la función
  //     leerá la que valga cuando se ejecute. Si no cambia dentro del bucle, no se dice nada.
  function capturas(P, F, i) {
    const N = P.nodos, f = F.filas[i], out = [], vistas = new Set();
    if (f.bucle == null) return out;
    const fns = N.filter(n => FUNCION.test(n.tipo) && !P.cadaFn.has(n.id) && F.duena(n.padre) === i && F.enLinea(n.padre) == null);
    for (const fn of fns.map(n => n.id)) {
      if (N[fn].campo === "callee" && N[N[fn].padre].tipo === "CallExpression") continue;
      for (const n of N) {
        if (!P.desciende(n.id, fn) || !esUso(P, n.id)) continue;
        const d = declaracion(P, n.id);
        if (!d || d.clase === "param" || P.desciende(d.nodo, fn) || vistas.has(`${fn}:${d.nodo}`)) continue;
        const misma = (x) => esUso(P, x) && N[x].nombre === n.nombre && declaracion(P, x)?.nodo === d.nodo;
        for (let b = f.bucle; b != null; b = F.filas[b].bucle) {
          const L = F.filas[b].nodo, en = (x) => P.desciende(x, L) && !P.desciende(x, fn);
          const propia = d.clase !== "var" && P.desciende(d.nodo, L);
          const cambia = en(d.nodo) || N.some(x => en(x.id) && ((x.tipo === "AssignmentExpression" && misma(P.hijo(x.id, "left")))
            || (x.tipo === "UpdateExpression" && misma(P.hijo(x.id, "argument")))));
          if (!propia && !cambia) continue;
          out.push({ fn, x: n.id, tipo: propia ? "propia" : "compartida", cabecera: d.ambito === L, guardada: guardada(P, fn) });
          vistas.add(`${fn}:${d.nodo}`);
          break;
        }
      }
    }
    return out;
  }

  return { preparar, construir, recorrer, estructura, dentro, declaracion, deFuera, capturas, agendada, generadora, creaGenerador, avance, delega, expresion, verdad, PALETA };
});
