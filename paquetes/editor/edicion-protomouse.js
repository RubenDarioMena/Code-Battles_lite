
/* Interfaz extraída; juego y demo crean instancias de este mismo módulo. */
// edicion: protomouse. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {

  // Posición del texto en un punto de la pantalla, con el espejo del textarea (una línea por div, sin desplazar).
  ctx.puntoEspejo = function(pos) {
    const v = ctx.$codigo.value;
    let i = 0, inicio = 0;
    for (let fin = v.indexOf("\n"); fin >= 0 && fin < pos; fin = v.indexOf("\n", inicio)) { inicio = fin + 1; i++; }
    const d = ctx.$espejo && ctx.$espejo.children[i];
    if (!d) return null;
    const t = d.firstChild;
    return t && t.nodeType === 3 ? [t, Math.min(pos - inicio, t.length)] : [d, 0];
  };
  ctx.rectTexto = function(pos) {
    const motor = ctx.cmg.motorTexto;
    if (motor) { const r = motor.rect(pos); return r ? { ...r, height: r.bottom - r.top } : null; }
    const p = ctx.puntoEspejo(pos);
    if (!p) return null;
    const r = /** @type {any} */ (document.createRange());
    r.setStart(...p); r.collapse(true);
    const c = r.getClientRects()[0] || r.getBoundingClientRect(), alto = c.height || parseFloat(getComputedStyle(ctx.$codigo).lineHeight) || 20;
    return { left: c.left - ctx.$codigo.scrollLeft, top: c.top - ctx.$codigo.scrollTop, height: alto, bottom: c.top - ctx.$codigo.scrollTop + alto };
  };
  ctx.rectsTexto = function(a, b) {
    if (ctx.cmg.motorTexto) return ctx.cmg.motorTexto.rects(a, b);
    const p = ctx.puntoEspejo(a), q = ctx.puntoEspejo(b);
    if (!p || !q) return [];
    const r = /** @type {any} */ (document.createRange()), sl = ctx.$codigo.scrollLeft, st = ctx.$codigo.scrollTop;
    r.setStart(...p); r.setEnd(...q);
    return [...r.getClientRects()].filter(x => x.width > 0 || x.height > 0).map(x => ({ left: x.left - sl, right: x.right - sl, top: x.top - st, bottom: x.bottom - st }));
  };
  ctx.posTexto = function(x, y) {
    if (ctx.cmg.motorTexto) return ctx.cmg.motorTexto.posicion(x, y);
    const divs = ctx.$espejo ? ctx.$espejo.children : [];
    if (!divs.length) return 0;
    const ey = y + ctx.$codigo.scrollTop, ex = x + ctx.$codigo.scrollLeft;
    let lo = 0, hi = divs.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (divs[m].getBoundingClientRect().top <= ey) lo = m; else hi = m - 1; }
    const lineas = ctx.$codigo.value.split("\n");
    let inicio = 0;
    for (let i = 0; i < lo; i++) inicio += lineas[i].length + 1;
    return inicio + Math.min((lineas[lo] || "").length, ctx.enPieza(divs[lo], ex, ey, false));
  };
  ctx.cajaVisible = function() {
    const motor = ctx.cmg.motorTexto;
    const s = ctx.activo ? ctx.$vista : motor?.scroll || ctx.$codigo, r = s.getBoundingClientRect(), cs = getComputedStyle(ctx.activo ? ctx.$texto : motor?.elemento || ctx.$codigo);
    return { s, left: r.left + (parseFloat(cs.paddingLeft) || 0) - 2, right: r.right - (parseFloat(cs.paddingRight) || 0), top: r.top + 3, bottom: r.bottom - 3 };
  };
  // Cursor y selección propios mientras el textarea no tiene el foco (el navegador no los pinta).
  ctx.pintarPM = function() {
    ctx.$pmSel.replaceChildren(); ctx.$pmCursor.hidden = true;
    if (!ctx.$area || !ctx.pmMarca || ctx.activo || ctx.cmg.tieneFoco() || !(ctx.cmg.motorTexto?.elemento || ctx.$codigo).getClientRects().length) return;
    const base = ctx.$area.getBoundingClientRect(), [a, b] = ctx.sel();
    if (a === b) {
      const r = ctx.rectTexto(a); if (!r) return;
      Object.assign(ctx.$pmCursor.style, { left: `${r.left - base.left - 1}px`, top: `${r.top - base.top}px`, height: `${r.height}px` });
      ctx.$pmCursor.hidden = false;
      return;
    }
    for (const r of ctx.renglones(ctx.rectsTexto(a, b))) {
      const d = document.createElement("div"); d.className = "pm-sel";
      Object.assign(d.style, { left: `${r.left - base.left - 1}px`, top: `${r.top - base.top}px`, width: `${Math.max(4, r.right - r.left + 2)}px`, height: `${r.bottom - r.top}px` });
      ctx.$pmSel.append(d);
    }
  };
  ctx.olvidarMarca = function() { if (ctx.pmMarca) { ctx.pmMarca = false; ctx.pintarPM(); } };
  ctx.pintarFantasma = function() {
    if (!ctx.pm || !ctx.$area) return;
    const base = ctx.$area.getBoundingClientRect();
    ctx.$pmFantasma.style.transform = `translate(${Math.round(ctx.pm.vx - base.left)}px, ${Math.round(ctx.pm.vy - base.top)}px)`;
  };
  ctx.iniciarPM = function(ev, zona) {
    if (ctx.cmg.seudo && ctx.cmg.seudo.activo) return;
    ctx.cerrarSugerencias(); ctx.cerrarVariantesBarra(); ctx.resolverPendiente();
    const [a, b] = ctx.sel();
    // El extremo que se mueve: el último que movió el ProtoMouse o, si no, el final (o el principio si se eligió hacia atrás).
    let movil = b;
    if (a !== b) movil = ctx.pmUltimo && ctx.pmUltimo.a === a && ctx.pmUltimo.b === b ? ctx.pmUltimo.movil : ctx.$codigo.selectionDirection === "backward" ? a : b;
    const ancla = ctx.seleccionando ? (a === b ? a : movil === a ? b : a) : null;
    if (!ctx.activo && !ctx.cmg.tieneFoco()) ctx.pmMarca = true;
    // Si el cursor quedó fuera de la vista, primero se trae: el arrastre sigue desde donde estaba.
    let r = ctx.caretEn(movil), c = ctx.cajaVisible();
    if (r && (r.top < c.top || r.bottom > c.bottom)) {
      c.s.scrollTop += r.top < c.top ? r.top - c.top - 8 : r.bottom - c.bottom + 8;
      r = ctx.caretEn(movil); c = ctx.cajaVisible();
    }
    const x0 = r ? r.left : c.left, y0 = r ? r.top + r.height / 2 : c.top + 10;
    // Sin la selección encendida, el primer movimiento deja solo el cursor (aunque caiga en el mismo sitio).
    ctx.pm = { id: ev.pointerId, zona, x: ev.clientX, y: ev.clientY, t: performance.now(), recorrido: 0, movido: false, ancla, pos: ancla != null || a === b ? movil : null,
      vx: Math.max(c.left, Math.min(c.right, x0)), vy: Math.max(c.top, Math.min(c.bottom, y0)) };
    zona.classList.add("vivo");
    try { zona.setPointerCapture(ev.pointerId); } catch { /* sin captura: siguen llegando los eventos de la franja */ }
    if (ctx.activo) ctx.pintarSeleccion(); else ctx.pintarPM();
  };
  ctx.ponerPM = function(pos) {
    if (pos == null || pos === ctx.pm.pos) return;
    ctx.pm.pos = pos;
    const an = ctx.pm.ancla, [a, b, dir] = an == null ? [pos, pos, "none"] : pos < an ? [pos, an, "backward"] : [an, pos, "forward"];
    ctx.$codigo.setSelectionRange(a, b, dir);
    ctx.pila.length = 0;
    ctx.pmUltimo = { a, b, movil: pos };
    if (ctx.activo) ctx.pintarSeleccion(); else ctx.pintarPM();
  };
  ctx.moverPM = function(ev) {
    const dx = ev.clientX - ctx.pm.x, dy = ev.clientY - ctx.pm.y, ahora = performance.now(), dt = Math.max(8, ahora - ctx.pm.t);
    ctx.pm.x = ev.clientX; ctx.pm.y = ev.clientY; ctx.pm.t = ahora;
    if (!ctx.pm.movido) {
      ctx.pm.recorrido += Math.hypot(dx, dy);
      if (ctx.pm.recorrido < 4) return;
      ctx.pm.movido = true; ctx.$pmFantasma.hidden = false;
    }
    // Lento, uno a uno (un carácter son unos 8 px de dedo); rápido, hasta 2,6 veces más lejos.
    const g = Math.min(2.6, 1 + Math.max(0, Math.hypot(dx, dy) / dt - .3) * 1.4);
    ctx.pm.vx += dx * g; ctx.pm.vy += dy * g;
    const c = ctx.cajaVisible();
    if (ctx.pm.vy < c.top) { c.s.scrollTop -= c.top - ctx.pm.vy; ctx.pm.vy = c.top; }
    else if (ctx.pm.vy > c.bottom) { c.s.scrollTop += ctx.pm.vy - c.bottom; ctx.pm.vy = c.bottom; }
    ctx.pm.vx = Math.max(c.left, Math.min(c.right, ctx.pm.vx));
    ctx.ponerPM(ctx.posPunto(ctx.pm.vx, ctx.pm.vy));
    ctx.pintarFantasma();
  };
  ctx.terminarPM = function(ev) {
    const p = ctx.pm; ctx.pm = null;
    p.zona.classList.remove("vivo");
    ctx.$pmFantasma.hidden = true;
    if (!p.movido) { if (ev.type === "pointerup") ctx.toast(ctx.textoI18n("editor.toast.protomouse.mover_cursor")); return; }
    if (ctx.activo) ctx.pintarSeleccion(); else ctx.pintarPM();
    // Al soltar sobre un hueco /* … */ aparece su lista, como al tocarlo.
    ctx.actualizarSugerencias();
  };
  return function iniciar() {


  // ---------- ProtoMouse (teléfono) ----------
  // Como un trackpad: el dedo mueve un puntero virtual sobre el código (con algo de aceleración) y el cursor
  // salta al sitio más cercano. La captura del puntero deja seguir el arrastre fuera de la franja; al llegar
  // arriba o abajo, el código se desplaza. Con la selección encendida amplía lo elegido desde su extremo fijo.
  // Nunca enfoca el textarea: el teclado sigue como estaba. Con el teclado cerrado pinta su propio cursor.
  (ctx.$area = ctx.$("area")), (ctx.$espejo = ctx.$("espejo"));
  (ctx.$pmCapa = document.createElement("div"));
  ctx.$pmCapa.className = "pm-capa"; ctx.$pmCapa.setAttribute("aria-hidden", "true");
  ctx.$pmCapa.innerHTML = `<div class="pm-sel-capa"></div><div class="pm-cursor" hidden></div><div class="pm-fantasma" hidden></div>`;
  ctx.vida.portal(ctx.$pmCapa); if (ctx.$area) ctx.$area.append(ctx.$pmCapa);
  (ctx.$pmSel = ctx.$pmCapa.children[0]), (ctx.$pmCursor = ctx.$pmCapa.children[1]), (ctx.$pmFantasma = ctx.$pmCapa.children[2]);
  (ctx.pm = null), (ctx.pmUltimo = null), (ctx.pmMarca = false);
  (ctx.caretEn = (pos) => ctx.activo ? ctx.rectCaret(pos) : ctx.rectTexto(pos));
  (ctx.posPunto = (x, y) => ctx.activo ? ctx.posEn(x, y) : ctx.posTexto(x, y));
  ctx.vida.escuchar(ctx.$codigo, "focus", ctx.olvidarMarca);
  ctx.vida.escuchar(ctx.$codigo, "scroll", ctx.pintarPM, { passive: true });
  ctx.vida.escuchar(ctx.$codigo, "cmg:medido", () => ctx.vida.queueMicrotask(ctx.pintarPM));
  ctx.vida.escuchar(ctx.$codigo, "cmg:seleccion", ctx.pintarPM);
  ctx.vida.escuchar(ctx.$barra, "pointerdown", (ev) => {
    const zona = ev.target.closest(".protomouse");
    if (!zona || ctx.pm || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    ev.preventDefault();
    ctx.iniciarPM(ev, zona);
  });
  ctx.vida.escuchar(ctx.$barra, "pointermove", (ev) => { if (ctx.pm && ev.pointerId === ctx.pm.id) ctx.moverPM(ev); });
  ctx.vida.escuchar(ctx.$barra, "pointerup", (ev) => { if (ctx.pm && ev.pointerId === ctx.pm.id) ctx.terminarPM(ev); });
  ctx.vida.escuchar(ctx.$barra, "pointercancel", (ev) => { if (ctx.pm && ev.pointerId === ctx.pm.id) ctx.terminarPM(ev); });
  ctx.vida.escuchar(ctx.$barra, "lostpointercapture", (ev) => { if (ctx.pm && ev.pointerId === ctx.pm.id) ctx.terminarPM(ev); });
  };
}
