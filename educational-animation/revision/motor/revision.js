/* Modo revisión · interfaz. Dos franjas de borde a borde: arriba el código, abajo el mismo programa como
 * diagrama de flujo, y una línea que cuenta el paso con los valores reales.
 *
 *   CMGRevision.montar(elemento, grabacion, { salir, ejemplos: [{ id, titulo }], ejemplo, alElegir(id) })
 *
 * Cada fila del diagrama tiene número y color propios, y los repite en el margen del código y en la franja
 * de tiempo. Al recorrer el programa, la fila activa y su fragmento de código se iluminan juntos. Tocar (o
 * señalar con el ratón) cualquier cosa de un lado ilumina su pareja en el otro: el código ilumina su fila y
 * dice qué es; una fila ilumina su código; una ficha de la narración ilumina su fragmento.
 * El texto sale del árbol del programa, del catálogo del juego y de la traza: nada está escrito a mano para
 * un programa concreto. Textos en el idioma de la interfaz (CMGI18n): cambia al momento. */
(() => {
  "use strict";
  const E = window.CMGExplicar, FL = window.CMGFlujo, I18N = window.CMGI18n, DOC = window.CMGDocumentacion;
  const t = (k, p) => I18N.t("revision." + k, p);
  const PALABRAS = new Set("break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return super switch this throw try typeof var void while with yield await async true false null undefined".split(" "));
  const ICONO = {
    // Los mismos símbolos que el juego: el mapa (botón del mapa del editor) y </> (código a pantalla completa).
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5l5.5-2.5 6 2.5 5.5-2.5v13.5l-5.5 2.5-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
    salir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    antes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    despues: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/></svg>',
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const TONO = { ok: "var(--ok)", bad: "var(--bad)", neutro: "var(--tenue)", valor: "var(--valor)", texto: "var(--tk-str)" };
  const NEUTRO = "#3A4650";
  const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Fichas de color para el código (las mismas clases que el editor del juego).
  function fichas(src) {
    const out = [], re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\d*\.?\d+(?:e[+-]?\d+)?)|([A-Za-z_$][\w$]*)|(\n)|([ \t]+)|([^\w\s])/gy;
    let m, i = 0;
    while (i < src.length && (re.lastIndex = i, m = re.exec(src))) {
      const [x] = m, a = i;
      let k = m[1] ? "com" : m[2] ? "str" : m[3] ? "num" : m[4] ? "id" : m[5] ? "nl" : m[6] ? "esp" : "op";
      if (k === "id") {
        const antes = src.slice(0, a).replace(/\s+$/, ""), despues = src.slice(a + x.length).replace(/^\s+/, "");
        k = PALABRAS.has(x) ? "kw" : antes.endsWith(".") ? "prop" : despues.startsWith("(") ? "fn" : "var";
      }
      out.push({ k, t: x, a, b: a + x.length });
      i += x.length;
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
    const fin = G.partida ? { t: G.partida.t } : null;
    const datos = {};
    for (const id of ids) {
      const P = FL.preparar(G.programas[id], { id: G.serie ? id : null, serie: G.serie || "libre" });
      const F = FL.construir(P);
      const R = FL.recorrer(P, F, { fin });
      // Primer paso del tramo (vuelta, antes o después del bucle) de cada paso.
      const inicio = []; let desde = 0;
      R.pasos.forEach((p, i) => { if (i && (p.vuelta !== R.pasos[i - 1].vuelta || !!p.fuera !== !!R.pasos[i - 1].fuera)) desde = i; inicio.push(desde); });
      datos[id] = { P, F, R, inicio };
    }
    const estado = { prog: ids[0], paso: 0, foco: null, auto: false, temporizador: 0, doc: null };
    const D = () => datos[estado.prog];

    raiz.classList.add("rv");
    raiz.innerHTML = `
      <header class="rv-barra">
        <span class="rv-titulo"></span>
        ${opciones.ejemplos ? `<select class="rv-ejemplos" data-t-aria="ui.ejemplo">${opciones.ejemplos.map(e => `<option value="${esc(e.id)}"${e.id === opciones.ejemplo ? " selected" : ""}>${esc(e.titulo)}</option>`).join("")}</select>` : ""}
        ${ids.length > 1 ? `<div class="rv-progs" role="group" data-t-aria="ui.programas">${ids.map((id, k) => `<button type="button" data-prog="${esc(id)}" aria-pressed="${k === 0}">${esc(id)}</button>`).join("")}</div>` : ""}
        <div class="rv-salidas">
          <button type="button" class="rv-mini" data-accion="mapa" data-t-aria="ui.mapa" data-t-title="ui.mapa">${ICONO.mapa}</button>
          <button type="button" class="rv-mini rv-mini-cod" data-accion="codigo" data-t-aria="ui.codigoNormal" data-t-title="ui.codigoNormal">&lt;/&gt;</button>
        </div>
      </header>
      <section class="rv-codigo">
        <div class="rv-scroll"><div class="rv-lienzo">
          <div class="rv-margen" aria-hidden="true"></div>
          <pre class="rv-pre" tabindex="0"></pre>
          <div class="rv-capa rv-bandas" aria-hidden="true"></div>
          <div class="rv-capa rv-insignias" aria-hidden="true"></div>
        </div></div>
      </section>
      <div class="rv-asa" role="separator" tabindex="0" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" data-t-aria="ui.asa"><span></span></div>
      <section class="rv-abajo">
        <div class="rv-flujo"><div class="rv-rejilla"></div></div>
        <div class="rv-narra" aria-live="polite"></div>
        <footer class="rv-pie">
          <div class="rv-botones">
            <button type="button" class="rv-boton" data-accion="antes" data-t-aria="ui.anterior">${ICONO.antes}</button>
            <button type="button" class="rv-boton" data-accion="auto" data-t-aria="ui.avanzar">${ICONO.play}</button>
            <button type="button" class="rv-boton" data-accion="despues" data-t-aria="ui.siguiente">${ICONO.despues}</button>
          </div>
          <div class="rv-tiempo">
            <div class="rv-tramos" role="slider" tabindex="0" aria-valuemin="0"></div>
            <div class="rv-hitos" aria-hidden="true"></div>
            <div class="rv-donde"></div>
          </div>
        </footer>
      </section>
      <section class="rv-doc" role="dialog" data-t-aria="doc.aria" hidden>
        <header class="rv-doc-cab"><span class="rv-doc-num"></span><h2 class="rv-doc-titulo"></h2><button type="button" class="rv-cerrar" data-accion="cerrarDoc" data-t-aria="ui.cerrar">${ICONO.salir}</button></header>
        <div class="rv-doc-cuerpo">
          <div class="rv-doc-animacion" aria-hidden="true"><span class="rv-doc-pulso"></span><span class="rv-doc-et"></span></div>
          <p class="rv-doc-texto"></p>
        </div>
      </section>`;
    const $ = (s) => raiz.querySelector(s);
    const el = {
      pre: $(".rv-pre"), margen: $(".rv-margen"), bandas: $(".rv-bandas"), insignias: $(".rv-insignias"), scroll: $(".rv-scroll"), lienzo: $(".rv-lienzo"),
      codigo: $(".rv-codigo"), flujo: $(".rv-flujo"), rejilla: $(".rv-rejilla"), narra: $(".rv-narra"), tramos: $(".rv-tramos"), hitos: $(".rv-hitos"),
      asa: $(".rv-asa"), abajo: $(".rv-abajo"), doc: $(".rv-doc"), donde: $(".rv-donde"), auto: $('[data-accion="auto"]'), antes: $('[data-accion="antes"]'), despues: $('[data-accion="despues"]'), titulo: $(".rv-titulo"),
    };
    const traducirAria = () => {
      raiz.querySelectorAll("[data-t-aria]").forEach(x => x.setAttribute("aria-label", t(x.dataset.tAria)));
      raiz.querySelectorAll("[data-t-title]").forEach(x => x.setAttribute("title", t(x.dataset.tTitle)));
    };

    // ---------- Segmentos de texto → DOM ----------
    const corto = (P, i, max = 34) => { const x = P.txt(i).replace(/\s+/g, " "); return x.length <= max ? x : x.slice(0, max - 1) + "…"; };
    function segmentos(segs, { fichas = true } = {}) {
      const { P, F } = D(), frag = document.createDocumentFragment();
      for (const s of segs.flat(9)) {
        if (s == null || s === "") continue;
        if (typeof s === "string" || typeof s === "number") { frag.append(String(s)); continue; }
        if (s.c != null) {
          const f = F.duena(s.c), x = document.createElement(fichas ? "button" : "span");
          if (fichas) x.type = "button";
          x.className = "rv-ref"; x.dataset.ref = s.c; x.textContent = corto(P, s.c);
          if (f != null) x.style.setProperty("--c", F.filas[f].color);
          frag.append(x); continue;
        }
        if (s.k != null) { const x = document.createElement("code"); x.className = "rv-k"; x.textContent = s.k; frag.append(x); continue; }
        if ("v" in s) { const v = E.valor(s.v), x = document.createElement("span"); x.className = "rv-v"; x.style.setProperty("--tono", TONO[v.tono]); x.textContent = v.texto; frag.append(x); continue; }
        if (s.f != null) {
          const f = F.filas[s.f], x = document.createElement(fichas ? "button" : "span");
          if (fichas) { x.type = "button"; x.setAttribute("aria-label", t("ui.fila", { n: f.num })); }
          x.className = "rv-num rv-num-ref"; x.dataset.fila = s.f; x.style.setProperty("--c", f.color); x.textContent = f.num;
          frag.append(x); continue;
        }
        if (s.br) { frag.append(document.createElement("br")); continue; }
        if (s.lista) { const ul = document.createElement("ul"); ul.className = "rv-consola"; for (const l of s.lista) { const li = document.createElement("li"); li.textContent = l; ul.append(li); } frag.append(ul); continue; }
      }
      return frag;
    }

    // ---------- Código ----------
    let medida = { lh: 24, ch: 9, pad: 8 };
    function dibujarCodigo() {
      const { P, F } = D();
      el.pre.innerHTML = htmlCodigo(P);
      const lineas = P.fuente.replace(/\n$/, "").split("\n");
      // Margen: el número de cada fila (con su color) en la línea donde empieza, y el número de línea.
      const porLinea = new Map();
      for (const f of F.filas) (porLinea.get(f.linea) || porLinea.set(f.linea, []).get(f.linea)).push(f);
      el.margen.innerHTML = lineas.map((_, k) => {
        const fs = (porLinea.get(k + 1) || []).slice(0, 2);
        return `<div class="rv-ml">${fs.map(f => `<span class="rv-num rv-num-margen" data-fila="${f.i}" style="--c:${f.color}">${f.num}</span>`).join("")}<span class="rv-ln">${k + 1}</span></div>`;
      }).join("");
      el.margen.style.setProperty("--insignias", Math.max(1, ...[...porLinea.values()].map(x => Math.min(2, x.length))));
      el.pre.setAttribute("aria-label", t("ui.codigo", { id: estado.prog }));
      ajustarLetra();
    }
    function ajustarLetra() {
      const { P } = D();
      const lineas = P.fuente.replace(/\n$/, "").split("\n");
      const cols = Math.max(20, ...lineas.map(l => l.length));
      const ancho = el.scroll.clientWidth || 360, alto = el.scroll.clientHeight || 300;
      const margen = el.margen.offsetWidth || 56;
      const porAncho = (ancho - margen - 20) / (cols * 0.6 + 1), porAlto = (alto - 16) / (lineas.length * 1.6);
      const fs = Math.max(11, Math.min(16.5, porAncho, Math.max(13, porAlto)));
      el.lienzo.style.setProperty("--fs", fs.toFixed(2) + "px");
      const cs = getComputedStyle(el.pre);
      medida = { lh: parseFloat(cs.lineHeight) || fs * 1.6, ch: fs * 0.6, pad: parseFloat(cs.paddingTop) || 8, fs };
    }
    const top = (l) => medida.pad + (l - 1) * medida.lh;
    const span = (id) => el.pre.querySelector(`[data-n="${id}"]`);
    function limpiar(clase) { el.pre.querySelectorAll("." + clase).forEach(x => { x.classList.remove(clase); x.style.removeProperty("--c"); }); }
    function anillar(id, clase, color) { const s = span(id); if (s) { s.classList.add(clase); s.style.setProperty("--c", color); } return s; }
    function verEnCodigo(id) {
      const s = span(id);
      if (!s) return;
      const r = s.getBoundingClientRect(), c = el.scroll.getBoundingClientRect();
      if (r.top < c.top + 4 || r.bottom > c.bottom - 4) el.scroll.scrollBy({ top: r.top - c.top - c.height / 3, behavior: reducido() ? "auto" : "smooth" });
    }

    // ---------- Diagrama ----------
    function dibujarFlujo() {
      const { P, F } = D();
      let html = "", hayFunciones = false;
      for (const e of F.orden) {
        if (e.conector) { html += `<div class="rv-con" style="--nivel:${e.nivel}"${e.etiqueta ? ` data-et="${esc(e.etiqueta)}"` : ""}><span class="rv-flecha">↓</span>${e.etiqueta ? `<span class="rv-con-et">${esc(e.etiqueta)}</span>` : ""}</div>`; continue; }
        const f = F.filas[e.fila != null ? e.fila : e.seccion];
        if (e.seccion != null && !hayFunciones) { hayFunciones = true; html += `<div class="rv-seccion" data-t="ui.funciones"></div>`; }
        html += `<div class="rv-fila" data-fila="${f.i}" data-tipo="${f.tipo}" style="--nivel:${f.nivel};--c:${f.color}">${nodo(f)}`;
        if (f.salida) {
          html += `<span class="rv-sal-et" data-et="${f.salida.etiqueta}">${esc(E.textoSalida(f))} →</span>`;
          if (f.salida.tipo === "fila") { const l = F.filas[f.salida.fila]; html += `<div class="rv-lado" data-fila="${l.i}" style="--c:${l.color}">${nodo(l)}</div>`; }
          else html += `<span class="rv-caja-fin">${esc(t("f.finBucle"))}</span>`;
        }
        html += `</div>`;
      }
      el.rejilla.innerHTML = `<svg class="rv-rieles" aria-hidden="true"></svg>${html}`;
      el.rejilla.querySelectorAll("[data-t]").forEach(x => { x.textContent = t(x.dataset.t); });
      for (const x of el.rejilla.querySelectorAll(".rv-et[data-fila]")) x.append(segmentos(E.etiqueta(P, F, +x.dataset.fila), { fichas: false }));
      requestAnimationFrame(dibujarRieles);
    }
    const nodo = (f) => `<button type="button" class="rv-nodo" data-fila="${f.i}"><span class="rv-num">${f.num}</span><span class="rv-et" data-fila="${f.i}"></span><span class="rv-val" hidden></span></button>`;
    // Flechas de vuelta: de la última fila de cada vuelta (o de un continue) a su bucle, por la izquierda.
    function dibujarRieles() {
      const { F } = D(), svg = el.rejilla.querySelector(".rv-rieles");
      if (!svg) return;
      const base = el.rejilla.getBoundingClientRect();
      const caja = (i) => { const n = el.rejilla.querySelector(`.rv-fila[data-fila="${i}"] > .rv-nodo`) || el.rejilla.querySelector(`.rv-lado[data-fila="${i}"]`)?.closest(".rv-fila")?.querySelector(":scope > .rv-nodo"); return n ? n.getBoundingClientRect() : null; };
      const porBucle = new Map();
      for (const r of F.rieles) (porBucle.get(r.a) || porBucle.set(r.a, []).get(r.a)).push(r);
      let d = "", puntas = "";
      for (const [a, lista] of porBucle) {
        const ra = caja(a);
        if (!ra) continue;
        const destino = { x: ra.left - base.left, y: ra.top - base.top + ra.height / 2 };
        lista.map(r => ({ r, c: caja(r.de) })).filter(x => x.c).sort((x, y) => y.c.top - x.c.top).forEach(({ c }, k) => {
          const y = c.top - base.top + c.height / 2, x0 = c.left - base.left, carril = Math.max(4, destino.x - 10 - k * 7);
          d += `M${x0.toFixed(1)} ${y.toFixed(1)}H${carril.toFixed(1)}V${destino.y.toFixed(1)}H${(destino.x - 2).toFixed(1)}`;
          if (k === 0) puntas += `M${(destino.x - 7).toFixed(1)} ${(destino.y - 4).toFixed(1)}L${(destino.x - 1.5).toFixed(1)} ${destino.y.toFixed(1)}L${(destino.x - 7).toFixed(1)} ${(destino.y + 4).toFixed(1)}`;
        });
      }
      svg.setAttribute("width", el.rejilla.scrollWidth); svg.setAttribute("height", el.rejilla.scrollHeight);
      svg.innerHTML = `<path class="rv-riel" d="${d}"/><path class="rv-punta" d="${puntas}"/>`;
    }

    // ---------- Franja de tiempo ----------
    // Un tramo por vuelta (seguidas del mismo color se juntan), del color de la fila que decidió su camino.
    function dibujarTramos() {
      const { R } = D(), pasos = R.pasos, conReloj = R.conReloj;
      const pos = (p) => conReloj ? (p.t ?? 0) : p.i;
      const total = conReloj ? (pasos.at(-1).t || 1) : Math.max(1, pasos.length - 1);
      const tramos = [];
      const poner = (desde, hasta, color, vuelta) => {
        const a = pos(pasos[desde]), b = hasta + 1 < pasos.length ? pos(pasos[hasta + 1]) : total;
        const ult = tramos.at(-1);
        if (ult && ult.color === color) { ult.b = b; ult.hasta = hasta; return; }
        tramos.push({ a, b, color, desde, hasta, vuelta });
      };
      if (R.vueltas.length) {
        if (R.vueltas[0].desde > 0) poner(0, R.vueltas[0].desde - 1, NEUTRO, 0);
        for (const v of R.vueltas) poner(v.desde, v.hasta, v.color || NEUTRO, v.n);
        const ultimo = R.vueltas.at(-1).hasta;
        if (ultimo < pasos.length - 2) poner(ultimo + 1, pasos.length - 2, NEUTRO, null);
      } else poner(0, pasos.length - 1, NEUTRO, 0);
      D().tramos = { lista: tramos, total, pos };
      el.tramos.innerHTML = tramos.map(x => `<span class="rv-tramo" style="left:${(x.a / total * 100).toFixed(3)}%;width:${(Math.max(0.15, (x.b - x.a) / total * 100)).toFixed(3)}%;--c:${x.color}"></span>`).join("") + '<span class="rv-marca"></span>';
      const hitos = [];
      if (G.partida && conReloj) {
        for (const a of G.partida.atascos || []) hitos.push({ t: a.t, tipo: "atasco", texto: t("ui.atasco", { id: a.id }) });
        for (const r of (G.partida.eventos || []).filter(x => x.resultado === "reparado")) hitos.push({ t: r.t, tipo: "reparado", texto: t("ui.reparado", { id: String(r.que || "").replace(/^.*?(LAU-\d+).*$/, "$1") }) });
      }
      el.hitos.innerHTML = hitos.map(h => `<span class="rv-hito" data-tipo="${h.tipo}" title="${esc(h.texto)} · ${E.num(h.t)} s" style="left:${(h.t / total * 100).toFixed(2)}%"></span>`).join("");
      el.tramos.setAttribute("aria-label", t("ui.linea"));
      el.tramos.setAttribute("aria-valuemax", String(pasos.length - 1));
    }
    function buscarEnTramos(frac) {
      const { R, tramos } = D(), x = frac * tramos.total;
      if (!R.vueltas.length) return Math.round(frac * (R.pasos.length - 1));
      // La vuelta que contiene ese momento; se empieza en su primer paso.
      let mejor = 0;
      for (let k = 0; k < R.pasos.length; k++) { if (tramos.pos(R.pasos[k]) <= x + 1e-9) mejor = k; else break; }
      return D().inicio[mejor];
    }

    // ---------- Pasos ----------
    const paso = () => D().R.pasos[estado.paso];
    function ir(i, { desdeAuto = false } = {}) {
      const pasos = D().R.pasos;
      estado.paso = Math.max(0, Math.min(pasos.length - 1, i));
      if (!desdeAuto) pararAuto();
      quitarFoco(false);
      pintar();
    }
    function valorPrincipal(P, F, p) {
      if (p.fin || p.fila == null) return undefined;
      if (p.valor !== undefined) return p.valor;
      const f = F.filas[p.fila], N = P.nodos, n = N[f.nodo];
      let x = null;
      if (n.tipo === "VariableDeclaration") x = P.hijo(P.hijos(f.nodo, "declarations").at(-1), "init");
      else if (n.tipo === "ExpressionStatement") { const e = P.hijo(f.nodo, "expression"); x = N[e].tipo === "AssignmentExpression" ? P.hijo(e, "right") : e; }
      else if (n.tipo === "ReturnStatement") x = P.hijo(f.nodo, "argument");
      return x != null && p.vals.has(x) ? p.vals.get(x) : undefined;
    }
    function pintar() {
      const { P, F, R, inicio } = D(), p = paso();
      // Filas: la activa con su color; las que ya pasaron en esta vuelta, a plena luz; el resto, apagadas.
      const vistas = new Set();
      for (let k = inicio[estado.paso]; k <= estado.paso; k++) if (R.pasos[k].fila != null) vistas.add(R.pasos[k].fila);
      for (const x of el.rejilla.querySelectorAll(".rv-fila, .rv-lado")) {
        const i = +x.dataset.fila;
        x.toggleAttribute("data-activa", i === p.fila);
        x.toggleAttribute("data-vista", vistas.has(i));
      }
      el.rejilla.querySelectorAll(".rv-val").forEach(v => { v.hidden = true; });
      el.rejilla.querySelectorAll("[data-tomada]").forEach(x => x.removeAttribute("data-tomada"));
      const v = valorPrincipal(P, F, p);
      if (p.fila != null) {
        const f = F.filas[p.fila];
        const caja = el.rejilla.querySelector(`[data-fila="${p.fila}"] > .rv-nodo .rv-val`) || el.rejilla.querySelector(`.rv-nodo[data-fila="${p.fila}"] .rv-val`);
        if (caja && v !== undefined) { const x = E.valor(v); caja.textContent = x.texto; caja.style.setProperty("--tono", TONO[x.tono]); caja.hidden = false; }
        // El camino que toma: la salida lateral (true →) o la flecha de abajo (false).
        if (p.valor !== undefined && (f.tipo === "decision" || f.tipo === "bucle")) {
          const fila = el.rejilla.querySelector(`.rv-fila[data-fila="${p.fila}"]`);
          const sal = fila && fila.querySelector(":scope > .rv-sal-et");
          const si = FL.verdad(p.valor);
          if (sal && (sal.dataset.et === "true") === si) sal.setAttribute("data-tomada", "");
          if (sal && sal.dataset.et === "false" && !si) sal.setAttribute("data-tomada", "");
          if (fila && !sal) { /* sin salida lateral */ }
          const sig = fila && fila.nextElementSibling;
          if (sig && sig.classList.contains("rv-con") && ((sig.dataset.et === "false" && !si) || (sig.dataset.et === "true" && si))) sig.setAttribute("data-tomada", "");
        }
        const activa = el.rejilla.querySelector(`.rv-fila[data-activa], .rv-lado[data-activa]`);
        if (activa) visible(activa);
      }
      pintarCodigo(p, v);
      pintarNarracion(p);
      pintarDonde(p);
      el.antes.disabled = estado.paso === 0;
      el.despues.disabled = estado.paso === R.pasos.length - 1;
    }
    function visible(x) {
      const r = x.getBoundingClientRect(), c = el.flujo.getBoundingClientRect();
      if (r.top < c.top + 6 || r.bottom > c.bottom - 6) el.flujo.scrollBy({ top: r.top - c.top - (c.height - r.height) / 2, behavior: reducido() ? "auto" : "smooth" });
    }
    function pintarCodigo(p, v) {
      const { F } = D();
      limpiar("rv-anillo");
      el.margen.querySelectorAll("[data-activa]").forEach(x => x.removeAttribute("data-activa"));
      el.bandas.innerHTML = ""; el.insignias.innerHTML = "";
      if (p.fila == null) return;
      const f = F.filas[p.fila], N = D().P.nodos, foco = p.nodo != null && N[p.nodo] && (N[p.nodo].campo === "test" || /^(ForOf|ForIn)Statement$/.test(N[p.nodo].tipo)) ? f.foco : f.foco;
      const n = N[foco];
      el.bandas.innerHTML = Array.from({ length: Math.min(n.lineaFin, n.linea + 6) - n.linea + 1 }, (_, k) => `<div class="rv-banda" style="top:${top(n.linea + k)}px;--c:${f.color}"></div>`).join("");
      const s = anillar(foco, "rv-anillo", f.color);
      el.margen.querySelectorAll(`[data-fila="${p.fila}"]`).forEach(x => x.setAttribute("data-activa", ""));
      if (s && v !== undefined && n.linea === n.lineaFin) {
        const x = E.valor(v), linea = D().P.fuente.split("\n")[n.lineaFin - 1] || "";
        const izq = el.pre.offsetLeft + (parseFloat(getComputedStyle(el.pre).paddingLeft) || 0) + linea.length * medida.ch + medida.ch * 1.2, largo = x.texto.length * medida.ch * 0.85 + 18;
        if (izq + largo < el.scroll.clientWidth - 6) el.insignias.innerHTML = `<span class="rv-insignia" style="top:${top(n.linea)}px;left:${izq}px;--tono:${TONO[x.tono]}">${esc(x.texto)}</span>`;
      }
      verEnCodigo(foco);
    }
    function pintarNarracion(p) {
      const { P, F, R } = D();
      el.narra.innerHTML = "";
      el.narra.removeAttribute("data-foco");
      const txt = document.createElement("p"); txt.className = "rv-narra-txt";
      if (p.fila != null) txt.append(segmentos([{ f: p.fila }]));
      txt.append(segmentos(E.detalle(P, F, R, p, G)));
      el.narra.style.setProperty("--c", p.fila != null ? F.filas[p.fila].color : "var(--tenue)");
      el.narra.append(txt);
    }
    function textoDonde(p) {
      const { R } = D(), partes = [];
      if (p.fin) partes.push(t("ui.fin"));
      else if (R.vueltas.length) partes.push(p.fuera ? t("ui.despues") : p.vuelta ? t("ui.vuelta", { n: p.vuelta, total: R.vueltas.length }) : t("ui.antes"));
      else partes.push(t("ui.paso", { n: estado.paso + 1, total: R.pasos.length }));
      if (R.conReloj && p.t != null) partes.push(t("ui.segundos", { t: E.num(p.t) }));
      return partes.join(" · ");
    }
    function pintarDonde(p) {
      const { tramos, R } = D();
      const m = el.tramos.querySelector(".rv-marca");
      if (m) m.style.left = `${(Math.min(1, tramos.pos(p) / tramos.total) * 100).toFixed(3)}%`;
      el.donde.textContent = `${textoDonde(p)}${R.vueltas.length ? "" : ""}`;
      el.tramos.setAttribute("aria-valuenow", String(estado.paso));
      el.tramos.setAttribute("aria-valuetext", textoDonde(p));
    }

    // ---------- Foco: lo que se toca o se señala, iluminado en los dos lados ----------
    function enfocar(id, { tarjeta = true, deFila = null } = {}) {
      const { P, F, R } = D();
      const fila = deFila != null ? deFila : F.duena(id);
      quitarFoco(false);
      estado.foco = { id, fila };
      const color = fila != null ? F.filas[fila].color : "var(--foco)";
      anillar(id, "rv-sel", color);
      if (fila != null) {
        el.rejilla.querySelectorAll(`[data-fila="${fila}"]`).forEach(x => x.closest(".rv-lado, .rv-fila") === x && x.setAttribute("data-foco", ""));
        const x = el.rejilla.querySelector(`.rv-lado[data-fila="${fila}"]`) || el.rejilla.querySelector(`.rv-fila[data-fila="${fila}"]`);
        if (x) { x.setAttribute("data-foco", ""); visible(x); }
        el.margen.querySelectorAll(`[data-fila="${fila}"]`).forEach(x => x.setAttribute("data-foco", ""));
      }
      verEnCodigo(id);
      if (!tarjeta) return;
      pararAuto();
      const q = E.queEs(P, F, R, id, paso());
      el.narra.innerHTML = "";
      el.narra.setAttribute("data-foco", "");
      el.narra.style.setProperty("--c", color);
      const cab = document.createElement("div"); cab.className = "rv-narra-cab";
      if (fila != null) cab.append(segmentos([{ f: fila }]));
      const tit = document.createElement("span"); tit.className = "rv-narra-titulo"; tit.append(segmentos(q.titulo, { fichas: false }));
      const tipo = document.createElement("span"); tipo.className = "rv-narra-tipo"; tipo.textContent = q.tipo;
      const cerrar = document.createElement("button"); cerrar.type = "button"; cerrar.className = "rv-cerrar"; cerrar.dataset.accion = "cerrar"; cerrar.innerHTML = ICONO.salir; cerrar.setAttribute("aria-label", t("ui.cerrar"));
      cab.append(tit, tipo, cerrar);
      const txt = document.createElement("p"); txt.className = "rv-narra-txt"; txt.append(segmentos(q.cuerpo));
      const pista = document.createElement("p"); pista.className = "rv-pista"; pista.textContent = t(deFila != null ? "ui.mantener" : "ui.otraVez");
      el.narra.append(cab, txt, pista);
    }
    function quitarFoco(repintar = true) {
      const habia = !!estado.foco;
      estado.foco = null;
      limpiar("rv-sel"); limpiar("rv-señal");
      raiz.querySelectorAll("[data-foco]:not(.rv-narra)").forEach(x => x.removeAttribute("data-foco"));
      if (habia && repintar) pintarNarracion(paso());
    }
    // Señalar sin tocar (ratón): ilumina la pareja, sin abrir la tarjeta.
    function señalar(id, fila) {
      const { F } = D();
      limpiar("rv-señal");
      raiz.querySelectorAll("[data-señal]").forEach(x => x.removeAttribute("data-señal"));
      if (id == null && fila == null) return;
      const f = fila != null ? fila : F.duena(id);
      if (id != null) anillar(id, "rv-señal", f != null ? F.filas[f].color : "var(--foco)");
      if (f != null) {
        const x = el.rejilla.querySelector(`.rv-lado[data-fila="${f}"]`) || el.rejilla.querySelector(`.rv-fila[data-fila="${f}"]`);
        if (x) x.setAttribute("data-señal", "");
        el.margen.querySelectorAll(`[data-fila="${f}"]`).forEach(m => m.setAttribute("data-señal", ""));
        if (id == null) anillar(F.filas[f].foco, "rv-señal", F.filas[f].color);
      }
    }
    // Un nombre suelto no se explica solo: «jammed» es la lectura LAU_02.jammed; «autoTarget», la llamada.
    function normalizar(id) {
      const N = D().P.nodos;
      let x = id;
      if (N[x].tipo === "Identifier" && N[x].campo === "property" && N[N[x].padre].tipo === "MemberExpression" && !N[N[x].padre].computado) x = N[x].padre;
      if ((N[x].tipo === "Identifier" || N[x].tipo === "MemberExpression") && N[x].campo === "callee" && N[N[x].padre].tipo === "CallExpression") x = N[x].padre;
      return x;
    }
    function tocarCodigo(objetivo) {
      if (objetivo.classList && objetivo.classList.contains("com")) return mostrarComentario(objetivo.textContent);
      const n = objetivo.closest && objetivo.closest("[data-n]");
      if (!n) return quitarFoco();
      let id = normalizar(+n.dataset.n);
      // Otro toque en lo mismo: sube a lo que lo contiene (sin pasar por nodos con el mismo texto).
      if (estado.foco && estado.foco.id === id) {
        const actual = span(id);
        let x = actual && actual.parentElement && actual.parentElement.closest("[data-n]");
        while (x && x.textContent === actual.textContent && x.parentElement) x = x.parentElement.closest("[data-n]");
        if (x) id = +x.dataset.n;
      }
      enfocar(id);
    }
    function mostrarComentario(texto) {
      quitarFoco(false);
      pararAuto();
      el.narra.innerHTML = `<div class="rv-narra-cab"><code class="rv-k"></code><span class="rv-narra-tipo"></span><button type="button" class="rv-cerrar" data-accion="cerrar" aria-label="${esc(t("ui.cerrar"))}">${ICONO.salir}</button></div><p class="rv-narra-txt"></p>`;
      el.narra.setAttribute("data-foco", "");
      el.narra.style.setProperty("--c", "var(--tk-com)");
      el.narra.querySelector("code").textContent = texto;
      el.narra.querySelector(".rv-narra-tipo").textContent = t("que.comentario");
      el.narra.querySelector(".rv-narra-txt").textContent = t("que.b.comentario");
      estado.foco = { id: null, fila: null };
    }

    // ---------- Avance automático ----------
    // Lento cuando la vuelta toma un camino distinto de la anterior; rápido cuando se repite.
    function duracion(p) {
      const { R } = D();
      if (p.fin || !R.vueltas.length || !p.vuelta || p.fuera) return 1100;
      const v = R.vueltas[p.vuelta - 1], antes = R.vueltas[p.vuelta - 2];
      return antes && antes.color === v.color ? 90 : 1000;
    }
    function programar() {
      clearTimeout(estado.temporizador);
      if (!estado.auto) return;
      estado.temporizador = setTimeout(() => {
        if (estado.paso >= D().R.pasos.length - 1) return pararAuto();
        ir(estado.paso + 1, { desdeAuto: true });
        programar();
      }, duracion(paso()));
    }
    function alternarAuto() {
      estado.auto = !estado.auto;
      if (estado.auto && estado.paso >= D().R.pasos.length - 1) ir(0, { desdeAuto: true });
      pintarAuto();
      programar();
    }
    function pintarAuto() { el.auto.innerHTML = estado.auto ? ICONO.pausa : ICONO.play; el.auto.dataset.tAria = estado.auto ? "ui.pausar" : "ui.avanzar"; el.auto.setAttribute("aria-label", t(el.auto.dataset.tAria)); }
    function pararAuto() { if (!estado.auto) return; estado.auto = false; clearTimeout(estado.temporizador); pintarAuto(); }

    // ---------- Programa, idioma y título ----------
    function pintarTitulo() {
      const r = G.reto;
      el.titulo.textContent = r ? `${t("ui.reto", { n: r.numero })} · ${r.titulo}` : (G.titulo || t("ui.titulo"));
    }
    function dibujarTodo() {
      dibujarCodigo(); dibujarFlujo(); dibujarTramos(); pintarTitulo(); traducirAria();
      raiz.querySelectorAll(".rv-progs button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.prog === estado.prog)));
      pintar();
    }
    function cambiarPrograma(id) {
      if (id === estado.prog || !datos[id]) return;
      const p = paso(), pasos = datos[id].R.pasos;
      estado.prog = id;
      let i = 0;
      if (p.fin) i = pasos.length - 1;
      else if (p.t != null) { for (let k = 0; k < pasos.length; k++) if (pasos[k].t != null && pasos[k].t <= p.t + 1e-9) i = k; }
      estado.paso = i;
      el.doc.hidden = true; estado.doc = null;
      quitarFoco(false);
      dibujarTodo();
    }
    const alCambiarIdioma = () => {
      const foco = estado.foco, doc = estado.doc;
      dibujarTodo();
      if (doc) abrirDoc(doc.nodo, doc.fila);
      else if (foco && foco.id != null) enfocar(foco.id, { deFila: foco.fila });
    };
    window.addEventListener("cmg:idioma", alCambiarIdioma);

    // ---------- Eventos ----------
    raiz.addEventListener("click", (ev) => {
      const x = ev.target.closest("button, a, .rv-pre, select");
      if (!x || !raiz.contains(x)) return;
      if (x.dataset.accion === "antes") return ir(estado.paso - 1);
      if (x.dataset.accion === "despues") return ir(estado.paso + 1);
      if (x.dataset.accion === "auto") return alternarAuto();
      if (x.dataset.accion === "cerrar") return quitarFoco();
      if (x.dataset.accion === "cerrarDoc") return cerrarDoc();
      if (x.dataset.accion === "mapa") return opciones.alMapa && opciones.alMapa();
      if (x.dataset.accion === "codigo") return opciones.alCodigo && opciones.alCodigo();
      if (x.dataset.prog) return cambiarPrograma(x.dataset.prog);
      if (x.dataset.ref != null) return enfocar(+x.dataset.ref);
      if (x.classList.contains("rv-num-ref") && x.dataset.fila != null) { const f = D().F.filas[+x.dataset.fila]; return enfocar(f.foco, { deFila: f.i }); }
      if (x.classList.contains("rv-nodo")) {
        const f = D().F.filas[+x.dataset.fila];
        if (estado.foco && estado.foco.fila === f.i && estado.foco.id === f.nodo) return quitarFoco();
        return enfocar(f.nodo, { deFila: f.i });
      }
      if (x === el.pre) return tocarCodigo(ev.target);
    });
    raiz.addEventListener("change", (ev) => { if (ev.target.classList.contains("rv-ejemplos") && opciones.alElegir) opciones.alElegir(ev.target.value); });
    // Ratón: señalar ilumina la pareja al momento (en pantallas táctiles, el toque hace lo mismo con tarjeta).
    const conRaton = matchMedia("(hover: hover)").matches;
    if (conRaton) {
      raiz.addEventListener("pointerover", (ev) => {
        const r = ev.target.closest(".rv-ref"); if (r) return señalar(+r.dataset.ref, null);
        const nf = ev.target.closest(".rv-nodo, .rv-num-ref, .rv-num-margen"); if (nf && nf.dataset.fila != null) return señalar(null, +nf.dataset.fila);
        const n = ev.target.closest(".rv-pre [data-n]"); if (n) return señalar(normalizar(+n.dataset.n), null);
      });
      raiz.addEventListener("pointerleave", () => señalar(null, null));
      el.pre.addEventListener("pointerleave", () => señalar(null, null));
      el.flujo.addEventListener("pointerleave", () => señalar(null, null));
    }
    // Franja de tiempo: tocar o arrastrar salta a esa vuelta.
    let arrastre = false;
    const saltar = (ev) => { const r = el.tramos.getBoundingClientRect(); ir(buscarEnTramos(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)))); };
    el.tramos.addEventListener("pointerdown", (ev) => { arrastre = true; el.tramos.setPointerCapture(ev.pointerId); saltar(ev); });
    el.tramos.addEventListener("pointermove", (ev) => { if (arrastre) saltar(ev); });
    el.tramos.addEventListener("pointerup", () => { arrastre = false; });
    el.tramos.addEventListener("keydown", (ev) => {
      const { R } = D(), v = paso().vuelta || 0;
      if (ev.key === "ArrowRight" && R.vueltas[v]) { ev.preventDefault(); ev.stopPropagation(); ir(R.vueltas[v].desde); }
      if (ev.key === "ArrowLeft" && v > 1) { ev.preventDefault(); ev.stopPropagation(); ir(R.vueltas[v - 2].desde); }
    });
    const teclado = (ev) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey || (ev.target.closest && ev.target.closest("select, textarea, input"))) return;
      const k = ev.key;
      if (k === "ArrowRight" || k === "PageDown") { ev.preventDefault(); ir(estado.paso + 1); }
      else if (k === "ArrowLeft" || k === "PageUp") { ev.preventDefault(); ir(estado.paso - 1); }
      else if (k === "Home") { ev.preventDefault(); ir(0); }
      else if (k === "End") { ev.preventDefault(); ir(D().R.pasos.length - 1); }
      else if (k === " " && !(ev.target.closest && ev.target.closest("button, a"))) { ev.preventDefault(); alternarAuto(); }
      else if (k === "Escape") { if (!el.doc.hidden) cerrarDoc(); else quitarFoco(); }
      else if (/^[1-9]$/.test(k) && ids[+k - 1]) cambiarPrograma(ids[+k - 1]);
    };
    document.addEventListener("keydown", teclado);
    // Deslizar en el diagrama o la narración: paso anterior o siguiente.
    let toque = null;
    const abajo = raiz.querySelector(".rv-narra");
    abajo.addEventListener("touchstart", (ev) => { const x = ev.touches[0]; toque = { x: x.clientX, y: x.clientY }; }, { passive: true });
    abajo.addEventListener("touchend", (ev) => {
      if (!toque) return; const x = ev.changedTouches[0], dx = x.clientX - toque.x, dy = x.clientY - toque.y; toque = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > 1.6 * Math.abs(dy)) ir(estado.paso + (dx < 0 ? 1 : -1));
    }, { passive: true });
    const ro = new ResizeObserver(() => { ajustarLetra(); dibujarRieles(); pintarCodigo(paso(), valorPrincipal(D().P, D().F, paso())); });
    ro.observe(el.scroll); ro.observe(el.flujo);
    const roRaiz = new ResizeObserver(() => aplicarReparto());
    roRaiz.observe(raiz);

    // ---------- Asa: el reparto entre el código y el diagrama ----------
    // Se arrastra como el divisor del juego. Arriba del todo, el diagrama ocupa toda la pantalla; doble clic
    // (o Intro) alterna entre eso y el reparto anterior. El reparto se recuerda en este navegador.
    const CLAVE_REPARTO = "cmg-revision-reparto", PEGAR = 44;
    let reparto = null, repartoAntes = null;
    try { const v = parseFloat(localStorage.getItem(CLAVE_REPARTO)); if (v >= 0 && v <= 1) reparto = v; } catch (e) { /* sin almacenamiento */ }
    const barra = $(".rv-barra"), pie = $(".rv-pie");
    const disponible = () => Math.max(0, raiz.clientHeight - barra.offsetHeight - el.asa.offsetHeight);
    const maxCodigo = () => Math.max(0, disponible() - Math.min(disponible(), el.narra.offsetHeight + pie.offsetHeight + 72));
    function aplicarReparto() {
      if (reparto == null) { raiz.style.removeProperty("grid-template-rows"); raiz.removeAttribute("data-pleno"); }
      else {
        const h = Math.round(Math.max(0, Math.min(maxCodigo(), reparto * disponible())));
        raiz.style.gridTemplateRows = `auto ${h}px auto minmax(0, 1fr)`;
        raiz.toggleAttribute("data-pleno", h === 0);
      }
      const d = disponible();
      el.asa.setAttribute("aria-valuenow", String(d ? Math.round(el.codigo.offsetHeight / d * 100) : 0));
      if (!el.doc.hidden) colocarDoc();
    }
    function fijarReparto(f, { guardar = true } = {}) {
      reparto = f == null ? null : Math.max(0, Math.min(1, f));
      aplicarReparto();
      if (guardar) try { if (reparto == null) localStorage.removeItem(CLAVE_REPARTO); else localStorage.setItem(CLAVE_REPARTO, String(reparto)); } catch (e) { /* sin almacenamiento */ }
    }
    const repartoActual = () => { const d = disponible(); return d ? el.codigo.offsetHeight / d : 0; };
    function alternarPleno() {
      if (raiz.hasAttribute("data-pleno")) fijarReparto(repartoAntes);
      else { repartoAntes = reparto; fijarReparto(0); }
    }
    let arrastreAsa = null;
    el.asa.addEventListener("pointerdown", (ev) => {
      if (ev.button > 0) return;
      ev.preventDefault();
      el.asa.setPointerCapture(ev.pointerId);
      arrastreAsa = { y: ev.clientY, h: el.codigo.offsetHeight, antes: reparto };
      el.asa.classList.add("rv-arrastra");
    });
    el.asa.addEventListener("pointermove", (ev) => {
      if (!arrastreAsa) return;
      let h = arrastreAsa.h + ev.clientY - arrastreAsa.y;
      if (h < PEGAR) h = 0;
      fijarReparto(h / (disponible() || 1), { guardar: false });
    });
    const soltarAsa = () => {
      if (!arrastreAsa) return;
      if (reparto === 0 && arrastreAsa.antes !== 0) repartoAntes = arrastreAsa.antes;
      arrastreAsa = null; el.asa.classList.remove("rv-arrastra");
      if (reparto != null) fijarReparto(reparto);
    };
    el.asa.addEventListener("pointerup", soltarAsa);
    el.asa.addEventListener("pointercancel", soltarAsa);
    el.asa.addEventListener("dblclick", alternarPleno);
    el.asa.addEventListener("keydown", (ev) => {
      const paso = 0.05;
      if (ev.key === "ArrowUp") fijarReparto(Math.max(0, repartoActual() - paso));
      else if (ev.key === "ArrowDown") fijarReparto(repartoActual() + paso);
      else if (ev.key === "Home") { repartoAntes = reparto; fijarReparto(0); }
      else if (ev.key === "End") fijarReparto(1);
      else if (ev.key === "Enter" || ev.key === " ") alternarPleno();
      else return;
      ev.preventDefault(); ev.stopPropagation();
    });

    // ---------- Documentación: mantener pulsado un elemento del diagrama ----------
    // Tapa el código con una página clásica (texto y una animación de apoyo) sobre la naturaleza de lo
    // pulsado: el tema sale de documentacion.js. Por ahora cada página es «TEMA: PLACEHOLDER».
    const PRESION = 1200;
    let presion = null, sinClick = false;
    function objetivoDoc(objetivo) {
      const { F } = D();
      const vis = objetivo.closest(".rv-nodo, .rv-con, .rv-caja-fin, .rv-sal-et");
      if (!vis || !el.flujo.contains(vis)) return null;
      const con = objetivo.closest(".rv-con");
      const conFila = con ? con.previousElementSibling : objetivo.closest("[data-fila]");
      if (!conFila || conFila.dataset.fila == null) return null;
      const fila = +conFila.dataset.fila, ref = objetivo.closest(".rv-ref[data-ref]");
      return { fila, nodo: ref ? normalizar(+ref.dataset.ref) : F.filas[fila].nodo, vis };
    }
    function cancelarPresion() {
      if (!presion) return;
      clearTimeout(presion.temporizador);
      presion.vis.removeAttribute("data-presion");
      presion = null;
    }
    el.flujo.addEventListener("pointerdown", (ev) => {
      if (ev.button > 0) return;
      cancelarPresion();
      const o = objetivoDoc(ev.target);
      if (!o) return;
      o.vis.setAttribute("data-presion", "");
      presion = { ...o, x: ev.clientX, y: ev.clientY, temporizador: setTimeout(() => {
        const { nodo, fila } = presion;
        cancelarPresion();
        sinClick = true;
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* sin vibración */ }
        abrirDoc(nodo, fila);
      }, PRESION) };
    });
    el.flujo.addEventListener("pointermove", (ev) => { if (presion && Math.hypot(ev.clientX - presion.x, ev.clientY - presion.y) > 8) cancelarPresion(); });
    for (const tipo of ["pointerup", "pointercancel", "pointerleave"]) el.flujo.addEventListener(tipo, () => { cancelarPresion(); if (sinClick) setTimeout(() => { sinClick = false; }, 450); });
    el.flujo.addEventListener("scroll", cancelarPresion, { passive: true });
    el.flujo.addEventListener("contextmenu", (ev) => ev.preventDefault());
    // El clic que sigue a una pulsación larga no cuenta como toque.
    raiz.addEventListener("click", (ev) => { if (sinClick && el.flujo.contains(ev.target)) { sinClick = false; ev.stopPropagation(); ev.preventDefault(); } }, true);
    function colocarDoc() {
      const arriba = el.codigo.offsetTop, hasta = el.abajo.offsetTop;
      el.doc.style.top = arriba + "px";
      el.doc.style.height = Math.max(hasta - arriba, (raiz.clientHeight - arriba) * 0.55) + "px";
    }
    function abrirDoc(nodo, fila = null) {
      const { P, F } = D();
      pararAuto();
      const tm = DOC.tema(P, nodo);
      estado.doc = { nodo, fila };
      el.doc.dataset.tema = tm.clave;
      el.doc.style.setProperty("--c", fila != null ? F.filas[fila].color : "var(--foco)");
      const num = el.doc.querySelector(".rv-doc-num");
      num.innerHTML = "";
      if (fila != null) num.append(segmentos([{ f: fila }], { fichas: false }));
      el.doc.querySelector(".rv-doc-titulo").textContent = tm.titulo;
      el.doc.querySelector(".rv-doc-et").textContent = t("doc.animacion");
      el.doc.querySelector(".rv-doc-texto").textContent = t("doc.placeholder", { tema: tm.titulo });
      colocarDoc();
      el.doc.hidden = false;
      enfocar(nodo, { tarjeta: false, deFila: fila });
      el.doc.querySelector(".rv-cerrar").focus({ preventScroll: true });
    }
    function cerrarDoc() {
      if (el.doc.hidden) return;
      el.doc.hidden = true;
      estado.doc = null;
      quitarFoco();
    }

    dibujarTodo();
    aplicarReparto();
    return {
      datos, ir, cambiarPrograma, enfocar, quitarFoco, abrirDoc, cerrarDoc, fijarReparto,
      get estado() { return { prog: estado.prog, paso: estado.paso, total: D().R.pasos.length, foco: estado.foco, auto: estado.auto, doc: estado.doc && DOC.tema(D().P, estado.doc.nodo).clave, reparto, pleno: raiz.hasAttribute("data-pleno") }; },
      paso: () => paso(),
      destruir() { ro.disconnect(); roRaiz.disconnect(); document.removeEventListener("keydown", teclado); window.removeEventListener("cmg:idioma", alCambiarIdioma); clearTimeout(estado.temporizador); cancelarPresion(); raiz.innerHTML = ""; raiz.classList.remove("rv"); raiz.removeAttribute("data-pleno"); raiz.style.removeProperty("grid-template-rows"); },
    };
  }

  window.CMGRevision = { montar, htmlCodigo, fichas };
})();
