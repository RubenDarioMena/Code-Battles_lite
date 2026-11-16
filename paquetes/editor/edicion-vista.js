
/* Interfaz extraída; juego y demo crean instancias de este mismo módulo. */
// edicion: vista. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {

  ctx.pintarVista = function() {
    const v = ctx.$codigo.value, toks = ctx.cmg.lexico(v), lineas = [];
    let linea = "", off = 0;
    toks.forEach((t, i) => {
      const [k, txt] = t;
      if (k === "nl") { lineas.push(linea); linea = ""; off++; return; }
      const cls = k === "esp" ? "e" : (ctx.cmg.clasificar(toks, i) || (k === "id" ? "nom" : k));
      txt.split("\n").forEach((parte, j) => {
        if (j) { lineas.push(linea); linea = ""; off++; }
        if (parte) linea += `<span class="${cls}" data-a="${off}">${ctx.esc(parte)}</span>`;
        off += parte.length;
      });
    });
    lineas.push(linea);
    ctx.$texto.innerHTML = lineas.map((l, i) => `<div class="ln" data-l="${i}">${l}</div>`).join("");
    ctx.filas = [];
    let inicio = 0;
    v.split("\n").forEach((l, i) => {
      const el = ctx.$texto.children[i];
      ctx.filas.push({ a: inicio, b: inicio + l.length, el, piezas: [...el.children].map(s => ({ a: +s.dataset.a, b: +s.dataset.a + s.textContent.length, el: s })) });
      inicio += l.length + 1;
    });
    ctx.pintado = v;
  };
  ctx.filaDe = function(pos) {
    let lo = 0, hi = ctx.filas.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ctx.filas[m].a <= pos) lo = m; else hi = m - 1; }
    return ctx.filas[lo] || null;
  };
  ctx.puntoDOM = function(pos) {
    const f = ctx.filaDe(pos);
    if (!f) return null;
    for (const p of f.piezas) if (pos >= p.a && pos <= p.b) return [p.el.firstChild, pos - p.a];
    if (!f.piezas.length) return [f.el, 0];
    const u = f.piezas[f.piezas.length - 1];
    return pos < f.piezas[0].a ? [f.piezas[0].el.firstChild, 0] : [u.el.firstChild, u.el.textContent.length];
  };
  ctx.rectsDe = function(a, b) {
    const p = ctx.puntoDOM(a), q = ctx.puntoDOM(b);
    if (!p || !q) return [];
    const r = /** @type {any} */ (document.createRange());
    r.setStart(...p); r.setEnd(...q);
    return [...r.getClientRects()].filter(x => x.width > 0 || x.height > 0);
  };
  // Un rectángulo por renglón visual: los elementos completos y su texto se repiten en getClientRects.
  ctx.renglones = function(rects) {
    const out = [];
    for (const r of [...rects].sort((x, y) => x.top - y.top)) {
      const u = out[out.length - 1], c = r.top + r.height / 2;
      if (u && c > u.top && c < u.bottom) { u.left = Math.min(u.left, r.left); u.right = Math.max(u.right, r.right); u.bottom = Math.max(u.bottom, r.bottom); }
      else out.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
    return out;
  };
  ctx.rectCaret = function(pos) {
    const p = ctx.puntoDOM(pos);
    if (!p) return null;
    if (p[0].nodeType !== 3) { const r = p[0].getBoundingClientRect(); return { left: r.left, top: r.top, bottom: r.bottom, height: r.height }; }
    const r = /** @type {any} */ (document.createRange());
    r.setStart(...p); r.collapse(true);
    const x = r.getClientRects()[0] || r.getBoundingClientRect();
    return { left: x.left, top: x.top, bottom: x.bottom, height: x.height };
  };
  ctx.caja = function(cls, l, t, w, h) {
    const base = ctx.$in.getBoundingClientRect(), d = document.createElement("div");
    d.className = cls;
    Object.assign(d.style, { left: `${l - base.left}px`, top: `${t - base.top}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });
    ctx.$capa.append(d);
    return d;
  };
  ctx.pintarSeleccion = function() {
    if (!ctx.activo) return;
    if (ctx.$codigo.value !== ctx.pintado) ctx.pintarVista();
    for (const d of [...ctx.$capa.children]) if (!d.classList.contains("destino-b")) d.remove();
    for (const s of ctx.$texto.querySelectorAll(".sel")) s.classList.remove("sel");
    const [a, b] = ctx.sel();
    if (a === b) { const r = ctx.rectCaret(a); if (r) ctx.caja("cursor-b", r.left - 1, r.top, 2, r.height); return; }
    // Lo elegido no desplaza la vista al tocarlo: se puede arrastrar con el dedo.
    for (const f of ctx.filas) if (f.a <= b && f.b >= a) for (const p of f.piezas) if (p.a < b && p.b > a) p.el.classList.add("sel");
    const rs = ctx.renglones(ctx.rectsDe(a, b));
    if (!rs.length) return;
    if (ctx.sonLineas(a, b)) {
      const t = ctx.$texto.getBoundingClientRect(), cs = getComputedStyle(ctx.$texto), izq = parseFloat(cs.paddingLeft) || 0, der = parseFloat(cs.paddingRight) || 0;
      ctx.caja("sel-b lineas", t.left + izq - 4, rs[0].top, t.width - izq - der + 8, rs[rs.length - 1].bottom - rs[0].top);
      return;
    }
    for (const r of rs) ctx.caja("sel-b", r.left - 2, r.top, r.right - r.left + 4, r.bottom - r.top);
  };
  ctx.mostrarRango = function(pos) {
    const r = ctx.rectCaret(pos), v = ctx.$vista.getBoundingClientRect();
    if (!r) return;
    if (r.top < v.top + 8) ctx.$vista.scrollTop -= v.top + 8 - r.top;
    else if (r.bottom > v.bottom - 8) ctx.$vista.scrollTop += r.bottom - v.bottom + 8;
  };
  ctx.enPieza = function(span, x, y, caracter) {
    const t = span.firstChild;
    if (!t) return 0;
    const r = /** @type {any} */ (document.createRange());
    let mejor = 0, dist = Infinity;
    for (let i = 0; i < t.length + (caracter ? 0 : 1); i++) {
      r.setStart(t, i); r.setEnd(t, caracter ? i + 1 : i);
      const c = r.getClientRects()[0] || r.getBoundingClientRect();
      const d = ctx.distY(c, y) * 1000 + (caracter ? (x < c.left ? c.left - x : x > c.right ? x - c.right : 0) : Math.abs(c.left - x));
      if (d < dist) { dist = d; mejor = i; }
    }
    return mejor;
  };
  ctx.posEn = function(x, y) {
    const el = /** @type {HTMLElement} */ (document.elementFromPoint(x, y));
    const pieza = el && el.closest && el.closest("#bloques-texto span[data-a]");
    if (pieza) return +/** @type {HTMLElement} */ (pieza).dataset.a + ctx.enPieza(pieza, x, y, false);
    const ln = el && el.closest && el.closest("#bloques-texto .ln");
    let mejor = null, dist = Infinity;
    for (const f of ln ? [ctx.filas[+/** @type {HTMLElement} */ (ln).dataset.l]] : ctx.filas) {
      if (!f) continue;
      if (!f.piezas.length) { const d = ctx.distY(f.el.getBoundingClientRect(), y) * 1000; if (d < dist) { dist = d; mejor = f.a; } continue; }
      for (const p of f.piezas) for (const r of p.el.getClientRects()) {
        const d = ctx.distY(r, y) * 1000 + (x < r.left ? r.left - x : x > r.right ? x - r.right : 0);
        if (d < dist) { dist = d; mejor = x <= r.left ? p.a : x >= r.right ? p.b : p.a + ctx.enPieza(p.el, x, y, false); }
      }
    }
    return mejor ?? 0;
  };
  // Lo que hay bajo el puntero: una ficha (con el carácter exacto) o un hueco entre fichas.
  ctx.objetivo = function(x, y) {
    const el = /** @type {HTMLElement} */ (document.elementFromPoint(x, y));
    const pieza = el && el.closest && el.closest("#bloques-texto span[data-a]");
    if (pieza && !pieza.classList.contains("e")) return { pos: +/** @type {HTMLElement} */ (pieza).dataset.a + ctx.enPieza(pieza, x, y, true), ficha: true };
    return { pos: ctx.posEn(x, y), ficha: false };
  };
  return function iniciar() {


  // ---------- Vista de bloques ----------
  // Una línea por div y una ficha por span (también los espacios), con su posición en data-a.
  (ctx.filas = []), (ctx.pintado = null);
  // Posición del texto bajo el puntero: el carácter dentro de una ficha o el borde más cercano.
  (ctx.distY = (r, y) => y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0);
  };
}
