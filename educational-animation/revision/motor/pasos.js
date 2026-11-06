/* Pasos del modo revisión · de la traza de una partida a vueltas, tramos y pasos para leer.
 *
 * construir(grabacion, idPrograma) → { P, vueltas, fases, pasos }
 *   vueltas  una por cada vez que se evalúa la condición del bucle principal, con sus grupos de eventos
 *            (un grupo = una sentencia o una condición, en orden de ejecución) y el estado que vio el programa.
 *   fases    tramos de vueltas: las iguales seguidas se juntan; las cortas que alternan forman un tramo
 *            («alterna ráfaga y disparo normal»); una vuelta suelta del mismo camino es una excepción.
 *   pasos    lo que se lee: el programa en palabras, la primera vuelta de cada camino nuevo paso a paso
 *            (solo lo que aún no se explicó), un resumen por tramo y el resultado.
 * Nada depende del juego concreto: el catálogo pone los nombres y los papeles. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica(raiz.CMGExplicar, raiz.CMGCatalogo);
  else raiz.CMGPasos = fabrica(raiz.CMGExplicar, raiz.CMGCatalogo);
})(typeof globalThis !== "undefined" ? globalThis : self, function (E, C) {
  "use strict";
  const coma = C.coma;
  const CON_PRUEBA = new Set(["IfStatement", "WhileStatement", "DoWhileStatement", "ForStatement"]);
  const CORTA = 3;      // vueltas: hasta aquí, una racha cuenta como corta (alternancias)
  const EXCEPCION = 2;  // vueltas: una racha así de corta y del mismo camino se absorbe como excepción

  function construir(G, idProg) {
    const prog = G.programas[idProg];
    const P = E.preparar(prog, { id: idProg, serie: G.serie });
    const N = P.nodos;

    // 1 · Eventos con el tiempo y el estado que vio el programa.
    const evs = []; let t = null, estado = null;
    for (const e of prog.eventos) { if (e[0] === "t") { t = e[1]; estado = e[2]; continue; } evs.push({ e, t, estado }); }

    // 2 · Bucle principal: el primero del nivel superior con condición trazada.
    const bucle = P.hijos(0, "body").find(s => /^(While|DoWhile|For)Statement$/.test(N[s].tipo));
    const prueba = bucle != null ? P.hijo(bucle, "test") : null;

    // 3 · Vueltas.
    const vueltas = [];
    let cur = null;
    for (const x of evs) {
      if (prueba != null && x.e[0] === prueba) { cur = { n: vueltas.length + 1, t: x.t, estado: x.estado, ev: [] }; vueltas.push(cur); }
      if (!cur) { if (prueba != null) continue; cur = { n: 1, t: x.t, estado: x.estado, ev: [] }; vueltas.push(cur); }
      cur.ev.push(x);
    }
    const fin = G.partida && G.partida.t != null ? G.partida.t : (vueltas.at(-1) || {}).t;
    vueltas.forEach((v, k) => { v.t1 = k + 1 < vueltas.length ? vueltas[k + 1].t : fin; });

    // 4 · Grupos: una sentencia o una condición, con los valores de sus subexpresiones.
    const esPrueba = (id) => N[id].ganchos.includes("c");
    for (const v of vueltas) {
      const grupos = [];
      for (const x of v.ev) {
        const id = x.e[0], g = grupos.at(-1);
        if (x.e.length === 1 && N[id].ganchos.includes("s")) { grupos.push({ tipo: "s", nodo: id, ev: [], t: x.t, estado: x.estado }); continue; }
        if (x.e.length > 1 && esPrueba(id)) {
          const nuevo = { tipo: "c", nodo: id, valor: x.e[1], ev: [], t: x.t, estado: x.estado };
          if (g) while (g.ev.length && P.desciende(g.ev.at(-1)[0], id)) nuevo.ev.unshift(g.ev.pop());
          grupos.push(nuevo); continue;
        }
        if (g) g.ev.push(x.e); else grupos.push({ tipo: "s", nodo: null, ev: [x.e], t: x.t, estado: x.estado });
      }
      v.grupos = grupos.filter(g => g.nodo != null && !(g.tipo === "s" && CON_PRUEBA.has(N[g.nodo].tipo)));
      for (const g of v.grupos) g.firma = firmaGrupo(P, g);
      v.tipo = v.grupos.map(g => g.firma).join("|");
      const ultimoGrupo = v.grupos.at(-1);
      v.cortada = !!ultimoGrupo && ultimoGrupo.tipo === "s" && N[P.hijo(ultimoGrupo.nodo, "expression") ?? ultimoGrupo.nodo].tipo === "AwaitExpression" && !E.valoresDe(ultimoGrupo).has(P.hijo(ultimoGrupo.nodo, "expression"));
      v.camino = v.grupos.filter(g => g.tipo === "c").map(g => g.firma).join("|");
    }

    // 5 · Rachas de vueltas iguales y tramos.
    const tipos = new Map();   // tipo → { clave, camino, primera: vuelta }
    for (const v of vueltas) if (!tipos.has(v.tipo)) tipos.set(v.tipo, { clave: v.tipo, camino: v.camino, primera: v, n: 0 });
    for (const v of vueltas) tipos.get(v.tipo).n++;
    const rachas = [];
    for (const v of vueltas) { const r = rachas.at(-1); if (r && r.tipo === v.tipo) { r.vueltas.push(v); } else rachas.push({ tipo: v.tipo, vueltas: [v] }); }
    const fases = [];
    for (const r of rachas) {
      const f = fases.at(-1), n = r.vueltas.length;
      const unir = f && (
        (f.corta && n <= CORTA && new Set([...f.tipos.keys(), r.tipo]).size <= 2) ||
        (!f.corta && (r.tipo === f.dominante || (n <= EXCEPCION && tipos.get(r.tipo).camino === tipos.get(f.dominante).camino))));
      if (unir) { f.rachas.push(r); f.tipos.set(r.tipo, (f.tipos.get(r.tipo) || 0) + n); }
      else fases.push({ rachas: [r], corta: n <= CORTA, dominante: r.tipo, tipos: new Map([[r.tipo, n]]) });
    }
    fases.forEach((f, i) => {
      f.i = i;
      f.vueltas = f.rachas.flatMap(r => r.vueltas);
      f.t0 = f.vueltas[0].t; f.t1 = f.vueltas.at(-1).t1;
      if (f.corta) f.dominante = [...f.tipos.entries()].sort((a, b) => b[1] - a[1])[0][0];
      f.valores = estadisticas(f.vueltas);
      f.porTipo = new Map([...f.tipos.keys()].map(tp => [tp, estadisticas(f.vueltas.filter(v => v.tipo === tp))]));
      f.tono = tonoDe(P, f);
      f.etiqueta = etiquetaDe(P, f, tipos);
    });

    // 6 · Pasos.
    const pasos = [];
    const explicados = new Set();   // claves de explicaciones largas ya dadas (qué hace cada función…)
    const notas = new Set();        // comentarios del autor ya mostrados
    const vistos = new Set();       // firmas de grupo ya contadas paso a paso
    const primera = vueltas[0];
    pasos.push({ tipo: "programa", fase: 0, t: primera ? primera.t : 0, t1: primera ? primera.t1 : 0, estado: primera && primera.estado,
      lineasNL: E.programa(P), foco: [], lineas: [], valores: new Map() });
    const tiposExplicados = new Set();
    // Primera vuelta de cada camino nuevo, paso a paso (solo los grupos que aún no se contaron).
    const detallar = (f, tipo) => {
      if (tiposExplicados.has(tipo)) return;
      tiposExplicados.add(tipo);
      const v = f.vueltas.find(x => x.tipo === tipo);
      v.grupos.forEach((g, k) => {
        if (vistos.has(g.firma) || (v.cortada && g === v.grupos.at(-1))) return;
        vistos.add(g.firma);
        const ctx = { vuelta: v.n, explicados, notas, t: v.t, t1: v.t1 };
        pasos.push({ tipo: "detalle", fase: f.i, vuelta: v.n, t: g.t ?? v.t, t1: v.t1, estado: g.estado || v.estado,
          texto: E.narrar(P, g, ctx), foco: focoDe(P, g), lineas: lineasDe(P, g), valores: insigniasDe(P, [g]), vals: E.valoresDe(g), grupo: k });
      });
    };
    for (const f of fases) {
      const orden = [...new Set(f.vueltas.map(v => v.tipo))];
      // En una alternancia se cuentan todos los caminos antes del resumen; en un tramo con excepciones,
      // el camino dominante antes y las excepciones después, para que el tiempo no vuelva atrás.
      const antes = f.corta ? orden : [f.dominante], despues = f.corta ? [] : orden.filter(x => x !== f.dominante);
      for (const tipo of antes) detallar(f, tipo);
      pasos.push({ tipo: "fase", fase: f.i, vuelta: f.vueltas[0].n, t: f.t0, t1: f.t1, estado: f.vueltas[0].estado,
        texto: resumenFase(P, G, f, tipos), foco: focoFase(P, f), lineas: lineasFase(P, f), valores: insigniasFase(P, f) });
      for (const tipo of despues) detallar(f, tipo);
    }
    pasos.push({ tipo: "final", fase: fases.length ? fases.at(-1).i : 0, t: fin, t1: fin, estado: vueltas.length ? vueltas.at(-1).estado : null,
      texto: final(P, G, idProg, vueltas, fases), foco: [], lineas: [], valores: new Map() });
    return { P, vueltas, fases, pasos, tipos };
  }

  // ---------- Firmas ----------
  function firmaGrupo(P, g) {
    const N = P.nodos;
    if (g.tipo === "c") return `${g.nodo}=${g.valor ? "T" : "F"}`;
    const vals = new Map(g.ev.filter(e => e.length > 1).map(e => [e[0], e[1]]));
    const n = N[g.nodo];
    if (n.tipo === "ExpressionStatement") {
      const e = P.hijo(g.nodo, "expression");
      if (N[e].tipo === "AwaitExpression") return `${g.nodo}:await`;   // la espera siempre es la misma; la última puede quedar cortada
      return `${g.nodo}:${E.claseValor(vals.get(e))}`;
    }
    if (n.tipo === "VariableDeclaration") { const d = P.hijos(g.nodo, "declarations")[0], ini = d != null ? P.hijo(d, "init") : null; return `${g.nodo}:${ini != null ? E.claseValor(vals.get(ini)) : ""}`; }
    return String(g.nodo);
  }

  // ---------- Qué se ilumina ----------
  const unaLinea = (P, i) => P.nodos[i].linea === P.nodos[i].lineaFin;
  const INTERESA = new Set(["CallExpression", "MemberExpression", "Identifier", "BinaryExpression", "LogicalExpression", "UnaryExpression", "Literal", "AwaitExpression"]);
  function focoDe(P, g) {
    const N = P.nodos, ids = new Set();
    if (g.tipo === "c") ids.add(g.nodo);
    for (const e of g.ev) if (e.length > 1 && INTERESA.has(N[e[0]].tipo) && unaLinea(P, e[0]) && !(g.tipo === "c" && P.desciende(e[0], g.nodo) && e[0] !== g.nodo && N[g.nodo].tipo !== "BinaryExpression" && N[g.nodo].tipo !== "LogicalExpression")) ids.add(e[0]);
    if (g.tipo === "s" && N[g.nodo].tipo === "ExpressionStatement") { const e = P.hijo(g.nodo, "expression"); if (unaLinea(P, e)) ids.add(e); }
    if (g.tipo === "s" && N[g.nodo].tipo === "VariableDeclaration") for (const d of P.hijos(g.nodo, "declarations")) { const nom = P.hijo(d, "id"); if (nom != null) ids.add(nom); }
    // Sin anillos anidados redundantes: si el padre directo de una lectura ya está, basta el padre…
    // …salvo cuando el hijo es de otro papel (LAU_02.jammed dentro de una condición más grande).
    return [...ids].filter(i => !(N[i].tipo === "Identifier" && ids.has(N[i].padre) && E.rol(P, i) === E.rol(P, N[i].padre)));
  }
  function lineasDe(P, g) {
    const N = P.nodos, out = [];
    const n = g.tipo === "c" ? N[g.nodo] : N[g.nodo];
    const rol = g.tipo === "c" ? "cond" : E.rol(P, g.nodo);
    for (let l = n.linea; l <= n.lineaFin; l++) out.push({ linea: l, rol });
    return out;
  }
  function focoFase(P, f) {
    const v = f.vueltas.find(x => x.tipo === f.dominante) || f.vueltas[0];
    const ids = new Set();
    for (const x of f.vueltas) if (x.tipo === v.tipo || f.corta) for (const g of x.grupos) for (const i of focoDe(P, g)) ids.add(i);
    return [...ids];
  }
  function lineasFase(P, f) {
    const m = new Map();
    for (const x of f.vueltas) for (const g of x.grupos) for (const l of lineasDe(P, g)) if (!m.has(l.linea)) m.set(l.linea, l.rol);
    return [...m].map(([linea, rol]) => ({ linea, rol }));
  }

  // ---------- Insignias de valores junto a las líneas ----------
  // Una por línea: el nodo más exterior de una sola línea que tenga valor; las declaraciones, en su última línea.
  function insigniasDe(P, grupos) {
    const N = P.nodos, porLinea = new Map();
    for (const g of grupos) {
      const vals = E.valoresDe(g);
      for (const [id, v] of vals) {
        if (!unaLinea(P, id) || !INTERESA.has(N[id].tipo) || N[id].tipo === "Literal") continue;
        const l = N[id].linea, actual = porLinea.get(l);
        if (!actual || N[id].prof < N[actual.id].prof) porLinea.set(l, { id, valores: [v] });
      }
      if (g.tipo === "s" && N[g.nodo].tipo === "VariableDeclaration") for (const d of P.hijos(g.nodo, "declarations")) {
        const nom = P.hijo(d, "id"), ini = P.hijo(d, "init");
        if (ini != null && vals.has(ini) && !unaLinea(P, ini)) porLinea.set(N[ini].lineaFin, { id: nom, valores: [vals.get(ini)], nombre: N[nom].nombre });
      }
    }
    return porLinea;
  }
  function insigniasFase(P, f) {
    const m = new Map();
    for (const v of f.vueltas) for (const [l, x] of insigniasDe(P, v.grupos)) {
      const a = m.get(l);
      if (!a) m.set(l, { ...x, valores: [...x.valores] });
      else if (a.id === x.id) a.valores.push(...x.valores);
    }
    return m;
  }

  // ---------- Estadísticas por tramo ----------
  function estadisticas(vueltas) {
    const m = new Map();
    for (const v of vueltas) for (const g of v.grupos) for (const [id, x] of E.valoresDe(g)) { if (!m.has(id)) m.set(id, []); m.get(id).push(x); }
    return m;
  }
  // Texto corto para un conjunto de valores: 0,02–0,11 · true ×8, false ×6 · D3, D5 y 2 más · null.
  function resumenValores(vals) {
    if (!vals || !vals.length) return null;
    if (vals.every(x => typeof x === "number")) { const a = Math.min(...vals), b = Math.max(...vals); return a === b ? coma(a, 3) : `${coma(a, 3)}–${coma(b, 3)}`; }
    const objetivos = vals.filter(x => x && typeof x === "object" && x.id);
    if (objetivos.length) {
      const ids = [...new Set(objetivos.map(x => x.id))], nulos = vals.filter(x => x === null).length;
      const lista = ids.length <= 3 ? ids.join(", ") : `${ids.slice(0, 3).join(", ")} y ${ids.length - 3} más`;
      return nulos ? `${lista} · null ×${nulos}` : lista;
    }
    const cuenta = new Map();
    for (const x of vals) { const t = E.valor(x).texto; cuenta.set(t, (cuenta.get(t) || 0) + 1); }
    if (cuenta.size === 1) return [...cuenta.keys()][0];
    return [...cuenta].map(([k, n]) => `${k} ×${n}`).join(" · ");
  }

  // ---------- Textos de los tramos ----------
  function tonoDe(P, f) {
    const v = f.vueltas.find(x => x.tipo === f.dominante);
    const resultados = v.grupos.filter(g => g.tipo === "s" && P.nodos[g.nodo].tipo === "ExpressionStatement").map(g => E.valoresDe(g).get(P.hijo(g.nodo, "expression")));
    if (resultados.some(r => E.TONO_RESULTADO[r] === "bad")) return "bad";
    if (v.grupos.some(g => g.tipo === "c" && g.valor && E.rol(P, g.nodo) === "otra")) return "otra";
    if (f.corta && f.tipos.size > 1) return "cond";
    if (resultados.some(r => E.TONO_RESULTADO[r] === "neutro")) return "neutro";
    return "orden";
  }
  function etiquetaDe(P, f, tipos) {
    const N = P.nodos;
    const parte = (tipo) => {
      const v = tipos.get(tipo).primera;
      const cond = v.grupos.find(g => g.tipo === "c" && g.valor && E.rol(P, g.nodo) === "otra");
      const orden = v.grupos.find(g => g.tipo === "s" && N[g.nodo].tipo === "ExpressionStatement" && N[P.hijo(g.nodo, "expression")].tipo === "CallExpression");
      if (!orden) return cond ? P.txt(cond.nodo) : "vuelta";
      const e = P.hijo(orden.nodo, "expression"), r = E.valoresDe(orden).get(e), callee = P.txt(P.hijo(e, "callee"));
      return `${cond ? P.txt(cond.nodo) + " → " : ""}${callee}${r !== "ok" && typeof r === "string" ? " · " + r : ""}`;
    };
    const orden = [...f.tipos.keys()];
    return f.corta && orden.length > 1 ? orden.map(parte).filter((x, i, a) => a.indexOf(x) === i).join(" / ") : parte(f.dominante);
  }

  // Una frase por camino: «Apunta a D3 y D5. LAU-02 funciona y el failureRate de LAU-01 (0,02–0,11) es menor que 0,12: dispara en ráfaga a pos → "ok".»
  function frasePorCamino(P, v, stats, incluir = null) {
    const N = P.nodos, partes = [], conds = [], acciones = [];
    for (const g of v.grupos) {
      if (incluir && !incluir.has(g.firma)) continue;
      const vals = E.valoresDe(g);
      if (g.tipo === "c") {
        const padre = N[N[g.nodo].padre];
        if (padre.tipo !== "IfStatement") continue;
        conds.push(condBreve(P, g.nodo, g.valor, stats));
      } else if (N[g.nodo].tipo === "VariableDeclaration") {
        for (const d of P.hijos(g.nodo, "declarations")) {
          const nom = P.hijo(d, "id"), ini = P.hijo(d, "init"); if (ini == null) continue;
          const x = vals.get(ini);
          if (x === null) partes.push("No ve objetivos (", { c: nom }, " es ", { v: null }, "). ");
          else if (x && typeof x === "object" && x.id) partes.push("Apunta a ", resumenValores((stats.get(ini) || [x]).filter(y => y !== null)), " (", { c: nom }, "). ");
          else partes.push({ c: nom }, " = ", resumenValores(stats.get(ini)) || E.valor(x).texto, ". ");
        }
      } else if (N[g.nodo].tipo === "ExpressionStatement") {
        const e = P.hijo(g.nodo, "expression");
        if (N[e].tipo === "AwaitExpression") continue;
        if (N[e].tipo !== "CallExpression") { acciones.push([{ c: e }]); continue; }
        const r = E.resolver(P, e), res = vals.get(e);
        const f = r && r.def && r.def.frase ? r.def.frase(P.hijos(e, "arguments").map(a => N[a].valor), P.hijos(e, "arguments").map(a => P.txt(a)), r.objeto) : P.txt(e);
        const que = r && r.def && r.def.resultados && res !== "ok" ? r.def.resultados[res] : null;
        acciones.push([{ c: e }, ` (${f}) → `, { v: res }, que ? `: ${que}` : ""]);
      }
    }
    if (conds.length) partes.push(...mayus1(conds.flatMap((c, k) => k ? [" y ", ...c] : c)));
    if (acciones.length) partes.push(conds.length ? ": " : "", ...(conds.length ? acciones : acciones.map((a, k) => k ? a : mayus1(a))).flatMap((a, k) => k ? ["; ", ...a] : a));
    if (conds.length || acciones.length) partes.push(".");
    return partes.flat().filter(x => x !== "");
  }
  function mayus1(seg) { const s = [...seg]; if (typeof s[0] === "string" && s[0]) s[0] = s[0][0].toUpperCase() + s[0].slice(1); return s; }
  function condBreve(P, t, b, stats) {
    const N = P.nodos, r = E.resolver(P, t), n = N[t];
    if (r && r.clase === "propiedad" && r.def && r.def.tipo === "booleano") {
      const sujeto = r.propio ? P.id : r.objeto;
      return b ? [`${r.def.frase(sujeto)} (`, { c: t }, " es ", { v: true }, ")"] : [r.def.no ? r.def.no(sujeto) : `no se cumple que ${r.def.frase(sujeto)}`, " (", { c: t }, " es ", { v: false }, ")"];
    }
    if (n.tipo === "BinaryExpression") {
      const l = P.hijo(t, "left"), rango = resumenValores(stats.get(l));
      return [{ c: t }, " es ", { v: b }, rango ? ` (${P.txt(l)}: ${rango})` : ""];
    }
    return [{ c: t }, " es ", { v: b }];
  }
  function eventosJuego(G, t0, t1, ultimo) {
    const out = [];
    const dentro = (t) => t >= t0 - 1e-9 && (ultimo ? t <= t1 + 1e-9 : t < t1 - 1e-9);
    const ev = (G.partida && G.partida.eventos) || [];
    for (const a of (G.partida && G.partida.atascos) || []) if (dentro(a.t)) out.push({ t: a.t, seg: [`A los ${coma(a.t)} s `, { b: `${a.id} se atasca` }, ` con failureRate ${coma(a.falla, 3)}; repararlo tardará ${coma(a.tReparar)} s más el viaje del robot.`] });
    for (const e of ev) if (e.resultado === "reparado" && dentro(e.t)) out.push({ t: e.t, seg: [`A los ${coma(e.t)} s `, { b: `${e.maquina} repara ${String(e.que).replace(/^reparar /, "")}` }, "."] });
    for (const e of ev) if (e.resultado === "brecha" && dentro(e.t)) out.push({ t: e.t, seg: [`A los ${coma(e.t)} s `, { b: `brecha: ${e.que}` }, " cruzó la línea de la base."] });
    out.sort((a, b) => a.t - b.t);
    const derribos = {};
    for (const e of ev) if (e.resultado === "derribado" && dentro(e.t)) derribos[e.maquina] = (derribos[e.maquina] || 0) + 1;
    return { lista: out, derribos };
  }
  function resumenFase(P, G, f, tipos) {
    const a = f.vueltas[0].n, b = f.vueltas.at(-1).n;
    const out = [{ b: `${a === b ? `Vuelta ${a}` : `Vueltas ${a}–${b}`} · de ${coma(f.t0)} a ${coma(f.t1)} s. ` }];
    const orden = [...f.tipos.keys()];
    const rep = (tipo) => f.vueltas.find(v => v.tipo === tipo);
    const firmas = (tipo) => new Set(rep(tipo).grupos.map(g => g.firma));
    const comun = orden.map(firmas).reduce((x, y) => new Set([...x].filter(z => y.has(z))));
    const distinto = (tipo) => new Set([...firmas(tipo)].filter(z => !comun.has(z)));
    if (f.corta && orden.length > 1) {
      out.push(...frasePorCamino(P, rep(orden[0]), f.valores, comun), " Luego alterna:");
      for (const tipo of orden) out.push({ br: 1 }, { b: `${f.tipos.get(tipo)} ${f.tipos.get(tipo) === 1 ? "vuelta" : "vueltas"}: ` }, ...frasePorCamino(P, rep(tipo), f.porTipo.get(tipo), distinto(tipo)));
    } else {
      out.push(...frasePorCamino(P, rep(f.dominante), f.porTipo.get(f.dominante)));
      for (const tipo of orden.filter(x => x !== f.dominante)) {
        const vs = f.vueltas.filter(v => v.tipo === tipo);
        out.push({ br: 1 }, { b: `Excepción en ${vs.length} ${vs.length === 1 ? "vuelta" : "vueltas"} (${vs.map(v => coma(v.t) + " s").join(", ")}): ` }, ...frasePorCamino(P, vs[0], f.porTipo.get(tipo), distinto(tipo)));
      }
    }
    const fin = G.partida && G.partida.t;
    const { lista, derribos } = eventosJuego(G, f.t0, f.t1, Math.abs(f.t1 - fin) < 1e-6);
    for (const e of lista) out.push({ br: 1 }, ...e.seg);
    const d = Object.entries(derribos);
    if (d.length) out.push({ br: 1 }, "Derribos en este tramo: ", d.map(([m, n]) => `${m} ${n}`).join(", "), ".");
    return out;
  }
  function final(P, G, idProg, vueltas, fases) {
    const p = G.partida || {}, out = [];
    const metas = (G.reto && G.reto.metas) || {};
    out.push({ b: p.resultado === "victoria" ? "Victoria. " : "Derrota. " },
      `${p.derribos} de ${p.enemigos} enemigos derribados, ${p.brechas} ${p.brechas === 1 ? "brecha" : "brechas"} (máximo ${metas.brechasMax ?? "—"}) y ${(p.atascos || []).length} atascos en ${coma(p.t)} s.`);
    out.push({ br: 1 }, `El programa de ${idProg} dio ${vueltas.length} vueltas en ${fases.length} tramos.`);
    if (vueltas.length && vueltas.at(-1).cortada) out.push(` La partida terminó durante la espera de la vuelta ${vueltas.at(-1).n}.`);
    const propios = (p.eventos || []).filter(e => e.resultado === "derribado" && e.maquina === idProg).length;
    if (propios) out.push(` Derribó ${propios}.`);
    for (const c of G.comparaciones || []) {
      const r = c.partida, d = r.atascos.length - (p.atascos || []).length, dr = (r.reparaciones ?? 0) - (p.reparaciones ?? 0);
      const dif = d === 0 ? "los mismos atascos" : `${Math.abs(d)} ${Math.abs(d) === 1 ? "atasco" : "atascos"} ${d > 0 ? "más" : "menos"}`;
      out.push({ br: 1 }, { b: `${c.titulo}: ` }, `con la misma semilla ${r.resultado === "victoria" ? (p.resultado === "victoria" ? "también gana" : "gana") : "pierde"}: ${r.derribos} de ${r.enemigos} derribados, ${r.brechas} ${r.brechas === 1 ? "brecha" : "brechas"} y ${r.atascos.length} atascos (${dif}`, dr ? `, ${Math.abs(dr)} ${Math.abs(dr) === 1 ? "reparación" : "reparaciones"} ${dr > 0 ? "más" : "menos"}` : "", ").");
    }
    return out;
  }

  const mayus = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  return { construir, resumenValores, eventosJuego };
});
