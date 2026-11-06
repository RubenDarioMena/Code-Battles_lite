/* Modo revisión · interfaz. Código arriba, explicación abajo, de borde a borde; casi sin botones.
 *
 *   CMGRevision.montar(elemento, grabacion, { salir: url|null })
 *
 * - Paso a paso: ‹ › (o flechas), ▶ avanza solo. Cada paso ilumina en el código lo que se ejecuta, con el
 *   color de su papel, y escribe abajo qué pasó con los valores reales de la partida.
 * - Tocar el código explica ese fragmento (nombre, propiedad, llamada, argumento…); tocar otra vez el
 *   mismo sube al bloque que lo contiene. Tocar un fragmento de la explicación lo señala en el código.
 * - Un programa por máquina (LAU-01, LAU-02): al cambiar, se conserva el momento de la partida.
 * - La franja de tramos es la partida entera: cada color es un camino del programa; se puede tocar. */
(() => {
  "use strict";
  const E = window.CMGExplicar, PS = window.CMGPasos, C = window.CMGCatalogo;
  const coma = C.coma;
  const PALABRAS = new Set("break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return super switch this throw try typeof var void while with yield await async true false null undefined".split(" "));
  const ICONO = {
    salir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    antes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    despues: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tonoRol = (rol) => `var(--rol-${rol || "neutro"})`;
  const TONO_VALOR = { ok: "var(--ok)", bad: "var(--bad)", neutro: "var(--tenue)", valor: "var(--valor)", texto: "var(--tk-str)" };
  const TONO_FASE = { neutro: "var(--tenue)", orden: "var(--cobre)", cond: "var(--foco)", otra: "var(--cian)", bad: "var(--bad)" };

  // Fichas de color para el código (las mismas clases que el editor del juego).
  function fichas(src) {
    const out = [], re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\d*\.?\d+(?:e[+-]?\d+)?)|([A-Za-z_$][\w$]*)|(\n)|([ \t]+)|([^\w\s])/gy;
    let m, i = 0;
    while (i < src.length && (re.lastIndex = i, m = re.exec(src))) {
      const [t] = m, a = i;
      let k = m[1] ? "com" : m[2] ? "str" : m[3] ? "num" : m[4] ? "id" : m[5] ? "nl" : m[6] ? "esp" : "op";
      if (k === "id") {
        const antes = src.slice(0, a).replace(/\s+$/, ""), despues = src.slice(a + t.length).replace(/^\s+/, "");
        k = PALABRAS.has(t) ? "kw" : antes.endsWith(".") ? "prop" : despues.startsWith("(") ? "fn" : "var";
      }
      out.push({ k, t, a, b: a + t.length });
      i += t.length;
    }
    if (i < src.length) out.push({ k: "op", t: src.slice(i), a: i, b: src.length });
    return out;
  }

  // HTML del programa: fichas de color dentro de un span por nodo del árbol (anidados como el árbol).
  function htmlCodigo(P) {
    const N = P.nodos, abre = new Map();
    for (const n of N) if (n.padre != null) (abre.get(n.a) || abre.set(n.a, []).get(n.a)).push(n);
    for (const l of abre.values()) l.sort((x, y) => y.b - x.b || x.prof - y.prof);
    const pila = [];
    let html = "";
    for (const f of fichas(P.fuente)) {
      while (pila.length && pila.at(-1).b <= f.a) { html += "</span>"; pila.pop(); }
      for (const n of abre.get(f.a) || []) { if (n.b <= n.a) continue; html += `<span class="n" data-n="${n.id}">`; pila.push(n); }
      html += f.k === "nl" || f.k === "esp" ? esc(f.t) : `<span class="${f.k}">${esc(f.t)}</span>`;
    }
    while (pila.length) { html += "</span>"; pila.pop(); }
    return html;
  }

  function montar(raiz, G, opciones = {}) {
    const ids = Object.keys(G.programas);
    const datos = Object.fromEntries(ids.map(id => [id, PS.construir(G, id)]));
    const fin = G.partida && G.partida.t != null ? G.partida.t : 0;
    const estado = { prog: ids[0], paso: 0, sel: null, auto: false, temporizador: 0 };

    raiz.classList.add("rv");
    raiz.innerHTML = `
      <section class="rv-codigo" aria-label="Programa">
        <div class="rv-barra">
          ${opciones.salir ? `<a class="rv-salir" href="${esc(opciones.salir)}" aria-label="Salir del modo revisión">${ICONO.salir}</a>` : ""}
          <span class="rv-reto"><b>Reto ${G.reto.numero} · ${esc(G.reto.titulo)}</b> · semilla ${G.semilla}</span>
          <div class="rv-progs" role="group" aria-label="Programa de cada máquina">${ids.map(id => `<button type="button" data-prog="${id}" aria-pressed="false">${id}<span class="rv-punto" aria-hidden="true"></span></button>`).join("")}</div>
        </div>
        <div class="rv-scroll"><div class="rv-lienzo">
          <div class="rv-numeros" aria-hidden="true"></div>
          <pre class="rv-pre" tabindex="0" aria-label="Código del programa. Toca un fragmento para ver qué es."></pre>
          <div class="rv-capa rv-capa-bandas" aria-hidden="true"></div>
          <div class="rv-capa rv-capa-velos" aria-hidden="true"></div>
          <div class="rv-capa rv-capa-insignias" aria-hidden="true"></div>
        </div></div>
      </section>
      <section class="rv-explica" aria-label="Explicación">
        <header class="rv-cabeza"><span class="rv-tiempo"></span><span class="rv-etiqueta"></span><span class="rv-cuenta"></span></header>
        <div class="rv-texto" aria-live="polite"></div>
        <div class="rv-estado"></div>
        <footer class="rv-pie">
          <div class="rv-botones">
            <button type="button" class="rv-boton" data-accion="antes" aria-label="Paso anterior">${ICONO.antes}</button>
            <button type="button" class="rv-boton" data-accion="auto" aria-label="Avanzar solo" data-play="false">${ICONO.play}</button>
            <button type="button" class="rv-boton" data-accion="despues" aria-label="Paso siguiente">${ICONO.despues}</button>
          </div>
          <div class="rv-tiempo-linea">
            <div class="rv-tramos" role="group" aria-label="Tramos de la partida"></div>
            <div class="rv-hitos" aria-hidden="true"></div>
            <div class="rv-escala" aria-hidden="true"><span>0 s</span><span>${coma(fin)} s</span></div>
          </div>
        </footer>
        <div class="rv-que" role="dialog" aria-label="Qué es" hidden></div>
      </section>`;
    const $ = (s) => raiz.querySelector(s);
    const el = {
      pre: $(".rv-pre"), numeros: $(".rv-numeros"), bandas: $(".rv-capa-bandas"), velos: $(".rv-capa-velos"), insignias: $(".rv-capa-insignias"),
      scroll: $(".rv-scroll"), lienzo: $(".rv-lienzo"), texto: $(".rv-texto"), estado: $(".rv-estado"), tiempo: $(".rv-tiempo"), etiqueta: $(".rv-etiqueta"),
      cuenta: $(".rv-cuenta"), tramos: $(".rv-tramos"), hitos: $(".rv-hitos"), que: $(".rv-que"), auto: $('[data-accion="auto"]'),
      antes: $('[data-accion="antes"]'), despues: $('[data-accion="despues"]'), codigo: $(".rv-codigo"),
    };

    // ---------- Dibujo del programa ----------
    let medida = { lh: 24, ch: 9, pad: 6 };
    function dibujarPrograma() {
      const d = datos[estado.prog], P = d.P;
      el.pre.innerHTML = htmlCodigo(P);
      const n = P.fuente.replace(/\n$/, "").split("\n").length;
      el.numeros.innerHTML = Array.from({ length: n }, (_, i) => `<div>${i + 1}</div>`).join("");
      raiz.querySelectorAll(".rv-progs button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.prog === estado.prog)));
      el.codigo.setAttribute("aria-label", `Programa de ${estado.prog}`);
      ajustarLetra();
      dibujarTramos();
    }
    // La letra se ajusta para que quepa la línea más larga (entre 11 y 17 px).
    function ajustarLetra() {
      const P = datos[estado.prog].P;
      const cols = Math.max(...P.fuente.split("\n").map(l => l.length), 20);
      const ancho = el.scroll.clientWidth || 360, alto = el.scroll.clientHeight || 300;
      const filas = P.fuente.replace(/\n$/, "").split("\n").length;
      const numeros = 16 + 12 + 2 * 0.6 * 15;
      // Que quepa a lo ancho y, si se puede sin bajar de 13 px, también a lo alto.
      const porAncho = (ancho - numeros - 18) / (cols * 0.6 + 2), porAlto = (alto - 22) / (filas * 1.65);
      const fs = Math.max(11, Math.min(17, porAncho, Math.max(13, porAlto)));
      el.lienzo.style.setProperty("--fs", fs.toFixed(2) + "px");
      const cs = getComputedStyle(el.pre);
      medida = { lh: parseFloat(cs.lineHeight) || fs * 1.65, ch: fs * 0.6, pad: parseFloat(getComputedStyle(el.lienzo).paddingTop) || 6, fs };
    }

    // ---------- Pasos ----------
    const pasoActual = () => datos[estado.prog].pasos[estado.paso];
    function ir(i, { desdeAuto = false } = {}) {
      const pasos = datos[estado.prog].pasos;
      estado.paso = Math.max(0, Math.min(pasos.length - 1, i));
      if (!desdeAuto) pararAuto();
      cerrarQue();
      pintarPaso();
    }
    function pintarPaso() {
      const d = datos[estado.prog], P = d.P, p = pasoActual();
      const f = d.fases[p.fase];
      // Cabecera
      el.tiempo.textContent = p.tipo === "programa" ? "antes de empezar" : p.tipo === "final" ? `fin · ${coma(p.t)} s` : `${coma(p.t)} s${p.t1 != null && p.t1 !== p.t ? ` → ${coma(p.t1)} s` : ""}`;
      const etiqueta = p.tipo === "programa" ? "el programa en palabras" : p.tipo === "final" ? "resultado" : f ? f.etiqueta : "";
      el.etiqueta.textContent = etiqueta;
      el.etiqueta.style.setProperty("--tono", p.tipo === "programa" || p.tipo === "final" ? "var(--tinta)" : TONO_FASE[f && f.tono] || "var(--tenue)");
      el.cuenta.textContent = `paso ${estado.paso + 1} de ${d.pasos.length}`;
      el.antes.disabled = estado.paso === 0;
      el.despues.disabled = estado.paso === d.pasos.length - 1;
      // Texto
      el.texto.innerHTML = "";
      if (p.tipo === "programa") {
        const intro = document.createElement("p"); intro.className = "rv-reto-objetivo";
        intro.innerHTML = `<b>Reto ${G.reto.numero}.</b> ${esc(G.reto.objetivo || "")}`;
        const como = document.createElement("p");
        como.append(`Así se lee el programa de ${estado.prog}. El juego lo ejecuta de arriba abajo, vuelta tras vuelta; ▶ o › lo recorre con los valores reales de esta partida.`);
        const lista = document.createElement("ul"); lista.className = "rv-lista";
        for (const l of p.lineasNL) {
          const li = document.createElement("li"); li.style.setProperty("--nivel", l.nivel); li.dataset.ref = l.ref;
          li.append(...segmentos(P, l.seg));
          lista.append(li);
        }
        el.texto.append(intro, lista, como);
      } else el.texto.append(...parrafos(P, p.texto));
      el.texto.scrollTop = 0;
      // Código
      pintarCodigo(p);
      pintarEstado(p);
      pintarMarca(p);
    }

    function pintarCodigo(p) {
      const d = datos[estado.prog], P = d.P, N = P.nodos;
      const nLineas = P.fuente.replace(/\n$/, "").split("\n").length;
      const activas = new Map(p.lineas.map(l => [l.linea, l.rol]));
      const todo = p.tipo === "programa" || p.tipo === "final";
      const top = (l) => medida.pad + (l - 1) * medida.lh;
      el.bandas.innerHTML = [...activas].map(([l, rol]) => `<div class="rv-banda rv-activa" style="top:${top(l)}px;--tono:${tonoRol(rol)}"></div>`).join("");
      el.velos.innerHTML = todo ? "" : Array.from({ length: nLineas }, (_, i) => i + 1).filter(l => !activas.has(l)).map(l => `<div class="rv-velo" style="top:${top(l)}px"></div>`).join("");
      el.pre.querySelectorAll(".rv-anillo").forEach(x => { x.classList.remove("rv-anillo"); x.style.removeProperty("--tono"); });
      for (const id of p.foco) {
        const s = el.pre.querySelector(`[data-n="${id}"]`);
        if (s) { s.classList.add("rv-anillo"); s.style.setProperty("--tono", tonoRol(N[id].campo === "test" && N[id].tipo !== "MemberExpression" ? "cond" : E.rol(P, id))); }
      }
      // Insignias de valores al final de su línea, solo si caben sin tapar código.
      const lineas = P.fuente.split("\n"), ancho = el.scroll.clientWidth, x0 = el.numeros.offsetWidth;
      let html = "";
      for (const [l, x] of p.valores || []) {
        const txt = x.valores.length > 1 ? PS.resumenValores(x.valores) : E.valor(x.valores[0]).texto;
        if (txt == null) continue;
        const tono = x.valores.length > 1 && !x.valores.every(v => E.valor(v).tono === E.valor(x.valores[0]).tono) ? "var(--tinta)" : TONO_VALOR[E.valor(x.valores[0]).tono];
        const etiqueta = x.nombre ? `<i>${esc(x.nombre)} =</i> ` : "";
        const izq = x0 + (lineas[l - 1] || "").length * medida.ch + medida.ch * 1.5;
        const largo = ((x.nombre ? x.nombre.length + 2 : 0) + txt.length) * medida.ch * 0.78 + 20;
        if (izq + largo > ancho - 8) continue;
        html += `<span class="rv-insignia" style="top:${top(l)}px;left:${izq}px;--tono:${tono}">${etiqueta}${esc(txt)}</span>`;
      }
      el.insignias.innerHTML = html;
      // Que lo iluminado se vea.
      const primera = Math.min(...[...activas.keys()]), ultima = Math.max(...[...activas.keys()]);
      if (isFinite(primera)) {
        const a = top(primera) - medida.lh, b = top(ultima) + 2 * medida.lh;
        if (a < el.scroll.scrollTop || b > el.scroll.scrollTop + el.scroll.clientHeight) el.scroll.scrollTo({ top: Math.max(0, a), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    }

    // Lo que vio el programa: el estado de las máquinas en ese despertar, y el robot reparador.
    function pintarEstado(p) {
      const e = p.estado || {};
      const maquinas = Object.entries(e).filter(([, v]) => v && "jammed" in v);
      const rep = reparando(p.t);
      el.estado.innerHTML = `<span class="rv-estado-titulo">${p.tipo === "programa" ? "Al empezar" : `Lo que vio ${estado.prog}`} a los ${coma(p.t)} s${rep ? ` · REP-01 reparando ${rep}` : ""}</span>` + maquinas.map(([id, v]) => `
        <div class="rv-maq" data-propia="${id === estado.prog}"${id === estado.prog ? ' aria-label="Esta máquina"' : ""}>
          <span class="rv-maq-nombre">${id}</span>
          <span class="rv-maq-estado" data-atascado="${v.jammed}">${v.jammed ? "atascado" : "funciona"}</span>
          <span class="rv-maq-datos"><span>failureRate <b>${coma(v.failureRate, 3)}</b></span><span>misiles <b>${v.missiles}</b></span><span>modo <b>${({ idle: "parado", regular: "normal", burst: "ráfaga" })[v.mode] || v.mode}</b></span></span>
          <span class="rv-barrita" title="failureRate"><i style="width:${Math.min(100, v.failureRate / 0.3 * 100).toFixed(1)}%"></i></span>
        </div>`).join("");
      raiz.querySelectorAll(".rv-progs button").forEach(b => { const v = e[b.dataset.prog]; b.querySelector(".rv-punto").dataset.atascado = String(!!(v && v.jammed)); });
    }
    const atascos = (G.partida && G.partida.atascos) || [];
    const reparaciones = ((G.partida && G.partida.eventos) || []).filter(x => x.resultado === "reparado");
    function reparando(t) {
      for (const a of atascos) {
        const r = reparaciones.find(x => x.t >= a.t && String(x.que).endsWith(a.id));
        if (t >= a.t && (!r || t < r.t)) return a.id;
      }
      return null;
    }

    // ---------- Franja de tramos ----------
    function dibujarTramos() {
      const d = datos[estado.prog];
      el.tramos.innerHTML = d.fases.map(f => `<button type="button" class="rv-tramo" data-fase="${f.i}" style="flex:${Math.max(0.01, f.t1 - f.t0)} 0 0;--tono:${TONO_FASE[f.tono]}" aria-label="${esc(`De ${coma(f.t0)} a ${coma(f.t1)} s: ${f.etiqueta}`)}" title="${esc(`${coma(f.t0)}–${coma(f.t1)} s · ${f.etiqueta}`)}"></button>`).join("") + '<span class="rv-marca"></span>';
      el.hitos.innerHTML = [...atascos.map(a => ({ t: a.t, tipo: "atasco", id: a.id })), ...reparaciones.map(r => ({ t: r.t, tipo: "reparado" }))]
        .map(h => `<span class="rv-hito" data-tipo="${h.tipo}" style="left:${(h.t / fin * 100).toFixed(2)}%"></span>`).join("");
    }
    function pintarMarca(p) {
      const marca = el.tramos.querySelector(".rv-marca");
      if (marca) marca.style.left = `calc(${(Math.min(fin, p.t) / (fin || 1) * 100).toFixed(2)}% - 1px)`;
      el.tramos.querySelectorAll(".rv-tramo").forEach(b => b.setAttribute("aria-current", String(p.tipo !== "programa" && p.tipo !== "final" && +b.dataset.fase === p.fase)));
    }

    // ---------- Texto con fragmentos ----------
    function segmentos(P, seg) {
      const out = [];
      for (const s of seg.flat()) {
        if (s == null || s === "") continue;
        if (typeof s === "string" || typeof s === "number") { out.push(document.createTextNode(String(s))); continue; }
        if (s.b != null) { const b = document.createElement("strong"); b.textContent = s.b; out.push(b); continue; }
        if (s.c != null) {
          const b = document.createElement("button"); b.type = "button"; b.className = "rv-chip"; b.dataset.ref = s.c;
          b.style.setProperty("--tono", tonoRol(E.rol(P, s.c)));
          b.textContent = E.corto(P, s.c, 40); b.setAttribute("aria-label", `Señalar ${P.txt(s.c).replace(/\s+/g, " ")} en el código`);
          out.push(b); continue;
        }
        if (s.k != null) { const c = document.createElement("code"); c.className = "rv-k"; c.textContent = s.k; out.push(c); continue; }
        if ("v" in s) { const v = E.valor(s.v), x = document.createElement("span"); x.className = "rv-v"; x.style.setProperty("--tono", TONO_VALOR[v.tono]); x.textContent = v.texto; out.push(x); continue; }
      }
      return out;
    }
    function parrafos(P, seg) {
      const out = []; let p = document.createElement("p");
      for (const s of seg) {
        if (s && s.br) { if (p.childNodes.length) out.push(p); p = document.createElement("p"); continue; }
        if (s && s.nota != null) { if (p.childNodes.length) out.push(p); const n = document.createElement("p"); n.className = "rv-nota"; n.innerHTML = "<b>Nota del autor</b>"; n.append(document.createTextNode(s.nota.replace(/^\/\/\s*|^\/\*\s*|\s*\*\/$/g, ""))); out.push(n); p = document.createElement("p"); continue; }
        p.append(...segmentos(P, [s]));
      }
      if (p.childNodes.length) out.push(p);
      return out;
    }

    // ---------- «¿Qué es?» ----------
    function abrirQue(id) {
      const d = datos[estado.prog], P = d.P, p = pasoActual();
      const vals = p.vals instanceof Map ? p.vals : new Map();
      const r = E.queEs(P, id, vals);
      if (p.tipo === "fase" && d.fases[p.fase].valores.has(id)) r.cuerpo.push({ br: 1 }, { b: "En este tramo: " }, PS.resumenValores(d.fases[p.fase].valores.get(id)), ".");
      estado.sel = id;
      el.pre.querySelectorAll(".rv-sel").forEach(x => x.classList.remove("rv-sel"));
      const s = el.pre.querySelector(`[data-n="${id}"]`); if (s) s.classList.add("rv-sel");
      el.que.style.setProperty("--tono", tonoRol(r.rol));
      el.que.innerHTML = `<div class="rv-que-cabeza"><div><span class="rv-que-titulo"></span><span class="rv-que-etiqueta">${esc(r.etiqueta)}</span></div>
        <button type="button" class="rv-salir" data-accion="cerrar-que" aria-label="Cerrar">${ICONO.salir}</button></div><div class="rv-que-cuerpo"></div>
        <p class="rv-que-pista">Toca otra vez el mismo fragmento para ver lo que lo contiene.</p>`;
      el.que.querySelector(".rv-que-titulo").append(...segmentos(P, r.titulo));
      el.que.querySelector(".rv-que-cuerpo").append(...parrafos(P, r.cuerpo));
      el.que.hidden = false;
    }
    // Un nombre suelto no se explica solo: «jammed» es la lectura LAU_02.jammed; «autoTarget» o
    // «LAU_02.autoTarget», la llamada entera (que es la que tiene valor).
    function normalizar(id) {
      const N = datos[estado.prog].P.nodos;
      let x = id;
      if (N[x].tipo === "Identifier" && N[x].campo === "property" && N[N[x].padre].tipo === "MemberExpression" && !N[N[x].padre].computado) x = N[x].padre;
      if ((N[x].tipo === "Identifier" || N[x].tipo === "MemberExpression") && N[x].campo === "callee" && N[N[x].padre].tipo === "CallExpression") x = N[x].padre;
      return x;
    }
    function abrirComentario(texto) {
      estado.sel = null;
      el.pre.querySelectorAll(".rv-sel").forEach(x => x.classList.remove("rv-sel"));
      el.que.style.setProperty("--tono", "var(--tk-com)");
      el.que.innerHTML = `<div class="rv-que-cabeza"><div><code class="rv-k"></code><span class="rv-que-etiqueta">comentario</span></div>
        <button type="button" class="rv-salir" data-accion="cerrar-que" aria-label="Cerrar">${ICONO.salir}</button></div>
        <div class="rv-que-cuerpo"><p>Una nota para personas: el programa la ignora. Sirve para contar la intención, y el modo revisión la muestra como «nota del autor» en el paso que toca.</p></div>`;
      el.que.querySelector("code").textContent = texto;
      el.que.hidden = false;
    }
    function cerrarQue() {
      el.que.hidden = true; estado.sel = null;
      el.pre.querySelectorAll(".rv-sel").forEach(x => x.classList.remove("rv-sel"));
    }
    function señalar(id, si) {
      el.pre.querySelectorAll(".rv-ref").forEach(x => x.classList.remove("rv-ref"));
      if (!si) return;
      const s = el.pre.querySelector(`[data-n="${id}"]`);
      if (!s) return;
      s.classList.add("rv-ref");
      const r = s.getBoundingClientRect(), c = el.scroll.getBoundingClientRect();
      if (r.top < c.top || r.bottom > c.bottom) el.scroll.scrollBy({ top: r.top - c.top - c.height / 3, behavior: "smooth" });
    }

    // ---------- Avance automático ----------
    function duracion(p) {
      const palabras = (el.texto.textContent || "").split(/\s+/).length;
      return Math.max(3500, Math.min(16000, 1400 + palabras / 2.6 * 1000));
    }
    function programarAuto() {
      clearTimeout(estado.temporizador);
      if (!estado.auto) return;
      estado.temporizador = setTimeout(() => {
        const pasos = datos[estado.prog].pasos;
        if (estado.paso >= pasos.length - 1) { pararAuto(); return; }
        ir(estado.paso + 1, { desdeAuto: true });
        programarAuto();
      }, duracion(pasoActual()));
    }
    function alternarAuto() {
      estado.auto = !estado.auto;
      if (estado.auto && estado.paso >= datos[estado.prog].pasos.length - 1) ir(0, { desdeAuto: true });
      el.auto.dataset.play = String(estado.auto);
      el.auto.innerHTML = estado.auto ? ICONO.pausa : ICONO.play;
      el.auto.setAttribute("aria-label", estado.auto ? "Pausar" : "Avanzar solo");
      programarAuto();
    }
    function pararAuto() { if (!estado.auto) return; estado.auto = false; clearTimeout(estado.temporizador); el.auto.dataset.play = "false"; el.auto.innerHTML = ICONO.play; el.auto.setAttribute("aria-label", "Avanzar solo"); }

    // Cambiar de programa conservando el momento de la partida.
    function cambiarPrograma(id) {
      if (id === estado.prog || !datos[id]) return;
      const p = pasoActual();
      estado.prog = id;
      const pasos = datos[id].pasos;
      let i = 0;
      if (p.tipo === "final") i = pasos.length - 1;
      else if (p.tipo !== "programa") { for (let k = 0; k < pasos.length; k++) if (pasos[k].tipo !== "final" && pasos[k].tipo !== "programa" && pasos[k].t <= p.t + 1e-9) i = k; }
      dibujarPrograma();
      ir(i);
    }

    // ---------- Eventos ----------
    raiz.addEventListener("click", (ev) => {
      const b = ev.target.closest("button, [data-ref], .rv-pre");
      if (!b || !raiz.contains(b)) return;
      if (b.dataset.accion === "antes") return ir(estado.paso - 1);
      if (b.dataset.accion === "despues") return ir(estado.paso + 1);
      if (b.dataset.accion === "auto") return alternarAuto();
      if (b.dataset.accion === "cerrar-que") return cerrarQue();
      if (b.dataset.prog) return cambiarPrograma(b.dataset.prog);
      if (b.classList.contains("rv-tramo")) {
        const fase = +b.dataset.fase, pasos = datos[estado.prog].pasos;
        const i = pasos.findIndex(p => p.tipo === "fase" && p.fase === fase);
        return ir(i >= 0 ? i : pasos.findIndex(p => p.fase === fase));
      }
      if (b.dataset.ref != null) { const id = +b.dataset.ref; señalar(id, true); return abrirQue(id); }
      if (b === el.pre) {
        const t = ev.target;
        if (t.classList && t.classList.contains("com")) return abrirComentario(t.textContent);
        const n = t.closest("[data-n]");
        if (!n) return cerrarQue();
        let id = normalizar(+n.dataset.n);
        // Otro toque en lo mismo: sube al nodo que lo contiene (sin pasar por nodos del mismo texto).
        if (estado.sel != null && id === estado.sel) {
          const actual = el.pre.querySelector(`[data-n="${id}"]`);
          let x = actual && actual.parentElement && actual.parentElement.closest("[data-n]");
          while (x && x.textContent === actual.textContent && x.parentElement) x = x.parentElement.closest("[data-n]");
          if (x) id = +x.dataset.n;
        }
        señalar(null, false);
        return abrirQue(id);
      }
    });
    raiz.addEventListener("pointerover", (ev) => { const c = ev.target.closest && ev.target.closest(".rv-chip, .rv-lista li"); if (c) señalar(+c.dataset.ref, true); });
    raiz.addEventListener("pointerout", (ev) => { const c = ev.target.closest && ev.target.closest(".rv-chip, .rv-lista li"); if (c && !c.contains(ev.relatedTarget)) señalar(null, false); });
    raiz.addEventListener("focusin", (ev) => { const c = ev.target.closest && ev.target.closest(".rv-chip"); if (c) señalar(+c.dataset.ref, true); });
    const teclado = (ev) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const k = ev.key;
      if (k === "ArrowRight" || k === "PageDown") { ev.preventDefault(); ir(estado.paso + 1); }
      else if (k === "ArrowLeft" || k === "PageUp") { ev.preventDefault(); ir(estado.paso - 1); }
      else if (k === "Home") { ev.preventDefault(); ir(0); }
      else if (k === "End") { ev.preventDefault(); ir(datos[estado.prog].pasos.length - 1); }
      else if (k === " " && !(ev.target.closest && ev.target.closest("button, a"))) { ev.preventDefault(); alternarAuto(); }
      else if (k === "Escape") cerrarQue();
      else if (/^[1-9]$/.test(k) && ids[+k - 1]) cambiarPrograma(ids[+k - 1]);
    };
    document.addEventListener("keydown", teclado);
    // Deslizar en la explicación: paso anterior o siguiente.
    let toque = null;
    raiz.querySelector(".rv-explica").addEventListener("touchstart", (ev) => { const t = ev.touches[0]; toque = { x: t.clientX, y: t.clientY }; }, { passive: true });
    raiz.querySelector(".rv-explica").addEventListener("touchend", (ev) => {
      if (!toque) return; const t = ev.changedTouches[0], dx = t.clientX - toque.x, dy = t.clientY - toque.y; toque = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.6 * Math.abs(dy)) ir(estado.paso + (dx < 0 ? 1 : -1));
    }, { passive: true });
    const ro = new ResizeObserver(() => { ajustarLetra(); pintarCodigo(pasoActual()); });
    ro.observe(el.scroll);

    dibujarPrograma();
    ir(0);
    const api = { datos, ir, cambiarPrograma, get estado() { return { prog: estado.prog, paso: estado.paso, total: datos[estado.prog].pasos.length, sel: estado.sel }; },
      paso: () => pasoActual(), destruir() { ro.disconnect(); document.removeEventListener("keydown", teclado); clearTimeout(estado.temporizador); raiz.innerHTML = ""; } };
    return api;
  }

  window.CMGRevision = { montar, htmlCodigo, fichas };
})();
