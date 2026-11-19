

// seudo: gestos. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {

  ctx.posibleArrastre = function(ev, fuente, el) {
    if (ctx.quieto() || ev.button > 0) return;
    ctx.arrastre = { fuente, el, x0: ev.clientX, y0: ev.clientY, x: ev.clientX, y: ev.clientY, activo: false, tactil: ev.pointerType !== "mouse", id: ev.pointerId };
    if (ctx.arrastre.tactil && fuente.id) ctx.arrastre.temporizador = ctx.vida.setTimeout(() => { if (ctx.arrastre && !ctx.arrastre.activo) ctx.activarArrastre(); }, 280);
  };
  ctx.activarArrastre = function() {
    const a = ctx.arrastre;
    ctx.vida.clearTimeout(a.temporizador);
    a.activo = true;
    ctx.cerrarHueco();
    const f = document.createElement("div");
    f.className = `fantasma-seudo ${a.fuente.nuevo ? "nuevo" : "prog-seudo"}`;
    const muestra = a.fuente.nuevo ? a.el : (a.el.querySelector(":scope > .fila.cabeza") || a.el);
    f.appendChild(muestra.cloneNode(true));
    f.style.width = `${Math.min(muestra.getBoundingClientRect().width, 340)}px`;
    ctx.vida.portal(f);
    a.fantasma = f;
    if (a.fuente.id) a.el.classList.add("arrastrando");
    ctx.$prog.appendChild(ctx.$linea);
    ctx.moverArrastre();
  };
  ctx.destinoEn = function(x, y) {
    const r = ctx.$prog.getBoundingClientRect();
    if (x < r.left - 40 || x > r.right + 40 || y < r.top - 30 || y > r.bottom + 30) return null;
    const excl = ctx.arrastre.fuente.id ? ctx.$prog.querySelector(`[data-item="${ctx.arrastre.fuente.id}"]`) : null;
    let mejor = null, dm = Infinity;
    for (const lista of ctx.$prog.querySelectorAll(".lista[data-padre]")) {
      if (excl && excl.contains(lista)) continue;
      const lr = lista.getBoundingClientRect(), items = [...lista.children].filter(c => c.dataset.item);
      const ys = items.length ? items.map(it => it.getBoundingClientRect().top - 2).concat(items[items.length - 1].getBoundingClientRect().bottom + 2) : [(lista.querySelector(".vacio") || lista).getBoundingClientRect().top + 14];
      ys.forEach((yy, i) => {
        const d = Math.abs(yy - y) + (x < lr.left - 6 ? 300 : 0) - lr.left * .01;
        if (d < dm) { dm = d; mejor = { padre: lista.dataset.padre, rama: lista.dataset.rama, idx: i, y: yy, x: lr.left, w: lr.width }; }
      });
    }
    return mejor;
  };
  ctx.moverArrastre = function() {
    const a = ctx.arrastre;
    a.fantasma.style.transform = `translate(${a.x + 12}px, ${a.y + (a.tactil ? -48 : 10)}px)`;
    const pr = ctx.$paleta.getBoundingClientRect();
    a.borrar = !!a.fuente.id && a.y >= pr.top - 8 && a.y <= pr.bottom + 8;
    ctx.$paleta.classList.toggle("borrar", a.borrar);
    a.destino = a.borrar ? null : ctx.destinoEn(a.x, a.y);
    const r = ctx.$prog.getBoundingClientRect();
    if (a.destino) {
      ctx.$linea.hidden = false;
      ctx.$linea.style.top = `${a.destino.y - r.top + ctx.$prog.scrollTop}px`;
      ctx.$linea.style.left = `${a.destino.x - r.left + ctx.$prog.scrollLeft}px`;
      ctx.$linea.style.width = `${a.destino.w}px`;
    } else ctx.$linea.hidden = true;
    if (a.y < r.top + 28 && a.y > r.top - 30) ctx.$prog.scrollTop -= 10; else if (a.y > r.bottom - 28 && a.y < r.bottom + 30) ctx.$prog.scrollTop += 10;
  };
  ctx.limpiarArrastre = function(a) {
    ctx.vida.clearTimeout(a.temporizador);
    if (a.fantasma) a.fantasma.remove();
    a.el.classList.remove("arrastrando");
    ctx.$paleta.classList.remove("borrar");
    ctx.$linea.hidden = true; ctx.$linea.remove();
  };
  ctx.cancelarArrastre = function() { const a = ctx.arrastre; ctx.arrastre = null; if (a) ctx.limpiarArrastre(a); };
  ctx.soltarArrastre = function() {
    const a = ctx.arrastre; ctx.arrastre = null;
    ctx.limpiarArrastre(a);
    if (!a.activo) return;   // fue un toque: lo atiende el clic
    ctx.suprimirClicHasta = performance.now() + 80;
    if (a.borrar) return ctx.borrar(a.fuente.id);
    if (!a.destino) return ctx.pintar();
    const { padre, rama, idx } = a.destino;
    if (a.fuente.nuevo) ctx.insertarEn(ctx.nuevoLadrillo(a.fuente.nuevo), padre, rama, idx);
    else ctx.moverA(a.fuente.id, padre, rama, idx);
  };

  // ---------- Barra de edición en seudocódigo: actúa sobre el renglón elegido ----------
  ctx.accion = function(id) {
    if (!ctx.activo()) return false;
    if (["deshacer", "rehacer", "teclado"].includes(id)) return false;
    if (ctx.quieto()) return "Detén el programa para editarlo.";
    if (id === "desenvolver") return "Desenvolver está en JavaScript: cambia a JS para usarlo.";
    if (id === "pegar") {
      if (!ctx.portaBloque) return "No hay ningún bloque copiado.";
      ctx.agregar(ctx.conIds([ctx.portaBloque])[0]);
      return true;
    }
    if (id === "linea") return true;
    if (!ctx.elegido || !ctx.buscar(ctx.modelo, ctx.elegido)) return "Toca primero un renglón.";
    const n = ctx.buscar(ctx.modelo, ctx.elegido).nodo;
    if (id === "copiar" || id === "cortar") { ctx.portaBloque = ctx.sinIds(n); if (id === "cortar") ctx.borrar(ctx.elegido); return id === "cortar" ? "Cortado" : "Copiado"; }
    if (id === "borrar") return ctx.borrar(ctx.elegido), true;
    if (id === "duplicar") return ctx.duplicar(ctx.elegido), true;
    if (id === "subir" || id === "bajar") return ctx.mover(ctx.elegido, id === "subir" ? -1 : 1), true;
    if (id === "ampliar") { const l = ctx.buscar(ctx.modelo, ctx.elegido); if (l.padre !== "raiz") { ctx.pilaAmpliar.push(ctx.elegido); ctx.elegido = l.padre; ctx.pintar(); } return true; }
    if (id === "reducir") { const prev = ctx.pilaAmpliar.pop(); if (prev && ctx.buscar(ctx.modelo, prev)) { ctx.elegido = prev; ctx.pintar(); } else if (n.cuerpo && n.cuerpo[0]) { ctx.elegido = n.cuerpo[0].id; ctx.pintar(); } return true; }
    return false;
  };

  // ---------- Modo ----------
  ctx.aplicarModo = function(nuevo) {
    if (nuevo !== "js") {
      try {
        const r = ctx.arbolDe(ctx.$codigo.value);
        ctx.modelo = r.arbol; ctx.conComentarios = r.comentarios; ctx.texto = ctx.$codigo.value;
        const g = ctx.generar(ctx.modelo); ctx.mapa = g.codigo === ctx.texto ? g.mapa : [];
        ctx.cursor = { padre: "raiz", rama: "cuerpo", idx: ctx.modelo.cuerpo.length }; ctx.elegido = null;
      } catch (e) {
        if (!(e instanceof ctx.NoTraducible)) throw e;
        ctx.cmg.aviso(`No puedo pasar este programa a seudocódigo: ${ctx.esc(e.message)} Se queda en JavaScript.`);
        nuevo = "js";
      }
    }
    ctx.modo = nuevo;
    ctx.escribir("modo", ctx.modo);
    ctx.app.dataset.modo = ctx.modo;
    ctx.$prog.classList.toggle("v-bloques", ctx.modo === "bloques");
    ctx.cerrarHueco();
    ctx.$prog.hidden = ctx.modo === "js";
    ctx.$paleta.hidden = ctx.modo === "js";
    ctx.$editor.hidden = ctx.modo !== "js";
    ctx.$("paleta").hidden = ctx.modo !== "js";
    if (ctx.modo !== "js" && ctx.cmg.tieneFoco()) ctx.$codigo.blur();
    for (const b of ctx.ambito.querySelectorAll("[data-modo-codigo]")) b.setAttribute("aria-pressed", String(b.dataset.modoCodigo === ctx.modo));
    if (ctx.modo !== "js") { ctx.pintarPaleta(); ctx.pintar(); }
    else ctx.cmg.medirEditor();
    ctx.app.dispatchEvent(new Event("cmg:modo"));
  };
  ctx.aplicarIdioma = function(i) {
    ctx.idioma = i; ctx.escribir("idioma-seudo", ctx.idioma);
    for (const b of ctx.ambito.querySelectorAll("[data-idioma-seudo]")) b.setAttribute("aria-pressed", String(b.dataset.idiomaSeudo === ctx.idioma));
    if (ctx.activo()) { ctx.pintarPaleta(); ctx.pintar(); }
  };
  return function iniciar() {


  // ---------- Arrastrar y soltar ----------
  // Ratón: arrastrar más de 6 px. Dedo: mantener pulsado un renglón 0,28 s; un ladrillo, arrastrarlo hacia abajo.
  // Soltar un renglón sobre la paleta lo borra.
  (ctx.arrastre = null), (ctx.suprimirClicHasta = 0);
  (ctx.$linea = document.createElement("div")); ctx.$linea.className = "soltar-linea"; ctx.$linea.hidden = true;
  ctx.vida.escuchar(ctx.$prog, "pointerdown", (ev) => {
    if (ev.target.closest(".slot")) return;
    const f = ev.target.closest(".fila[data-id]");
    if (f) ctx.posibleArrastre(ev, { id: f.dataset.id }, ctx.$prog.querySelector(`[data-item="${f.dataset.id}"]`) || f);
  });
  ctx.vida.escuchar(ctx.$paleta, "pointerdown", (ev) => { const l = ev.target.closest("[data-ladrillo]"); if (l) ctx.posibleArrastre(ev, { nuevo: l.dataset.ladrillo }, l); });
  ctx.vida.escuchar(document, "pointermove", (ev) => {
    const a = ctx.arrastre;
    if (!a || ev.pointerId !== a.id) return;
    a.x = ev.clientX; a.y = ev.clientY;
    const dx = a.x - a.x0, dy = a.y - a.y0, d = Math.hypot(dx, dy);
    if (!a.activo) {
      if (!a.tactil) { if (d > 6) ctx.activarArrastre(); }
      else if (a.fuente.nuevo && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) ctx.activarArrastre();
      else if (d > 10) ctx.cancelarArrastre();
      return;
    }
    ctx.moverArrastre();
  });
  ctx.vida.escuchar(document, "pointerup", (ev) => { if (ctx.arrastre && ev.pointerId === ctx.arrastre.id) ctx.soltarArrastre(); });
  ctx.vida.escuchar(document, "pointercancel", (ev) => { if (ctx.arrastre && ev.pointerId === ctx.arrastre.id) ctx.cancelarArrastre(); });
  ctx.vida.escuchar(document, "touchmove", (ev) => {
    const a = ctx.arrastre;
    if (!a) return;
    if (a.activo) { ev.preventDefault(); return; }
    if (a.fuente.nuevo && ev.touches[0]) { const dx = ev.touches[0].clientX - a.x0, dy = ev.touches[0].clientY - a.y0; if (Math.abs(dy) > Math.abs(dx)) ev.preventDefault(); }
  }, { passive: false });
  ctx.vida.escuchar(document, "click", (ev) => { if (performance.now() < ctx.suprimirClicHasta) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  ctx.vida.escuchar(document, "click", (ev) => {
    const m = ev.target.closest("[data-modo-codigo]");
    if (m) return ctx.aplicarModo(m.dataset.modoCodigo);
    const i = ev.target.closest("[data-idioma-seudo]");
    if (i) ctx.aplicarIdioma(i.dataset.idiomaSeudo);
  });

  // Cambios que llegan por fuera (deshacer, otro programa, reto nuevo) vuelven a traducirse.
  ctx.vida.escuchar(ctx.$codigo, "input", () => { if (ctx.activo() && !ctx.escribiendo) ctx.sincronizar(); });
  ctx.vida.escuchar(ctx.$codigo, "cmg:documento", () => { if (ctx.activo()) { ctx.texto = null; ctx.sincronizar(); ctx.pintarPaleta(); } });
  ctx.vida.escuchar(ctx.$codigo, "cmg:estado", () => { if (ctx.activo()) { ctx.cerrarHueco(); ctx.pintar(); } });
  ctx.vida.escuchar(ctx.$codigo, "cmg:marcas", () => { if (ctx.activo()) ctx.pintarMarcas(); });

  ctx.cmg.seudo = { get activo() { return ctx.activo(); }, accion: ctx.accion, aplicarModo: ctx.aplicarModo, generar: ctx.generar, parsear: ctx.parsear, get modelo() { return ctx.modelo; } };
  ctx.aplicarIdioma(ctx.idioma);
  ctx.aplicarModo(ctx.modo);
  };
}
