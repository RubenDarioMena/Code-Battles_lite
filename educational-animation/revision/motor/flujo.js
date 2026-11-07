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
    return P;
  }

  const bloque = (P, i) => i == null ? [] : P.nodos[i].tipo === "BlockStatement" ? P.hijos(i, "body") : [i];
  const sinVacias = (P, ids) => ids.filter(s => P.nodos[s].tipo !== "EmptyStatement" && P.nodos[s].tipo !== "FunctionDeclaration");

  function construir(P) {
    const N = P.nodos;
    const filas = [], filaDe = new Map(), orden = [], rieles = [];
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
    function sentencia(s, nivel, ctx) {
      const n = N[s];
      if (BUCLE.test(n.tipo)) return bucle(s, nivel, ctx);
      if (n.tipo === "IfStatement") return decision(s, nivel, ctx);
      if (n.tipo === "BlockStatement") { const r = seq(P.hijos(s, "body"), nivel, ctx); return r.vacia ? paso(s, nivel, ctx) : r; }
      if (n.tipo === "LabeledStatement") return sentencia(P.hijo(s, "body"), nivel, ctx);
      if (n.tipo === "TryStatement") return intento(s, nivel, ctx);
      if (n.tipo === "SwitchStatement") return segun(s, nivel, ctx);
      return paso(s, nivel, ctx);
    }
    function paso(s, nivel, ctx, lateral = false) {
      const t = N[s].tipo;
      const f = nueva("paso", s, nivel, ctx, { lateral, salto: t === "BreakStatement" ? "break" : t === "ContinueStatement" ? "continue" : t === "ReturnStatement" || t === "ThrowStatement" ? "fin" : null });
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
      const cuerpo = sinVacias(P, bloque(P, P.hijo(s, "body")));
      if (cuerpo.length) orden.push({ conector: true, nivel: nivel + 1, etiqueta: test != null && !infinito ? "true" : null });
      const r = seq(cuerpo, nivel + 1, { ...ctx, bucle: R.i });
      R.si = r.entrada;
      unir(r.salidas, R.i); unir(r.continues, R.i);
      for (const de of [...r.salidas, ...r.continues]) rieles.push({ de, a: R.i });
      return { entrada: R.i, salidas: infinito ? [...r.breaks] : [R.i, ...r.breaks], breaks: [], continues: [] };
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
      // break dentro de switch sale del switch, no del bucle.
      salidas.push(...previas, ...breaks, S.i);
      return { entrada: S.i, salidas, breaks: [], continues };
    }

    // El programa, y después cada función con cuerpo de bloque como sección aparte.
    const principal = seq(P.hijos(0, "body"), 0, {});
    unir(principal.salidas, null);
    const secciones = [];
    for (const n of N) {
      if (!FUNCION.test(n.tipo)) continue;
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
    // El nodo que se ilumina en el código para cada fila: la condición, o la sentencia entera.
    // (en for…of / for…in, la variable de cada vuelta: «const n»).
    for (const f of filas) f.foco = f.test != null ? f.test : /^(ForOf|ForIn)Statement$/.test(N[f.nodo].tipo) ? P.hijo(f.nodo, "left") : f.nodo;
    // Líneas de cada fila (para el margen del código): la de su cabecera.
    for (const f of filas) f.linea = N[f.foco].linea;
    return { filas, filaDe, orden, rieles, secciones, duena, entrada: principal.entrada };
  }

  // ---------- La traza como recorrido ----------
  // paso = { i, fila, nodo, valor?, vals: Map(nodo → valor), t, t1?, espera?, vuelta, fuera? } y al final { fin: true }.
  function recorrer(P, F, { fin = null } = {}) {
    const N = P.nodos, pasos = [];
    let t = null, cur = null;
    const vueltasDe = new Map(), enEspera = new Map();
    const nuevo = (fila, nodo) => { const p = { i: pasos.length, fila, nodo, t, vals: new Map() }; pasos.push(p); return p; };
    const esCondicion = (n) => (n.campo === "test" && /^(If|While|DoWhile|For)Statement$/.test(N[n.padre].tipo)) || /^(ForOf|ForIn)Statement$/.test(n.tipo);
    for (const e of P.eventos) {
      if (e[0] === "t") { t = e[1]; if (cur && cur.espera != null && cur.t1 == null) cur.t1 = t; continue; }
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
        const iter = fila.tipo === "bucle" && (verdad(v) || /^(ForOf|ForIn)Statement$/.test(n.tipo)) ? vueltasDe.set(f, (vueltasDe.get(f) || 0) + 1).get(f) : null;
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
      // Lo que se lee para una condición llega antes que la condición: se guarda para su paso.
      const f = F.duena(id);
      const ff = f != null ? F.filas[f] : null;
      if (ff && ff.test != null && P.desciende(id, ff.test) && !(cur && cur.fila === f && cur.pendiente)) {
        (enEspera.get(f) || enEspera.set(f, new Map()).get(f)).set(id, v);
        continue;
      }
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
    const porCada = L && /^(ForOf|ForIn)Statement$/.test(N[L.nodo].tipo);
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

  return { preparar, construir, recorrer, estructura, dentro, verdad, PALETA };
});
