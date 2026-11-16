import { localizarHTML } from './dependencias.js';

/* Interfaz extraída; juego y demo crean instancias de este mismo módulo. */
// edicion: gestos. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {

  // Un botón (barra, paleta, sugerencias…) actúa sobre lo último que se tocó: la elección que esperaba
  // un posible doble toque se aplica ya. Un cambio de texto la anula, su posición ya no vale.
  ctx.resolverPendiente = function() {
    ctx.vida.clearTimeout(ctx.tSimple); ctx.tSimple = 0;
    const o = ctx.pendiente; ctx.pendiente = null;
    if (o) ctx.simple(o, false);
  };
  ctx.levantar = function() {
    if (!ctx.gesto || ctx.gesto.arrastre) return;
    const r = ctx.E.atomo(ctx.estructura(), ctx.gesto.o.pos);
    if (!r) return;
    ctx.elegir(r[0], r[1]);
    Object.assign(ctx.gesto, { levantado: true, antes: r, dentro: true });
    if (navigator.vibrate) navigator.vibrate(10);
  };
  ctx.mostrarAnillo = function(x, y, ms) {
    ctx.$anillo.style.setProperty("--dur", `${ms}ms`);
    ctx.$anillo.style.transform = `translate(${Math.round(x - 26)}px, ${Math.round(Math.max(4, y - 92))}px)`;
    ctx.$anillo.hidden = false;
    ctx.$anillo.classList.remove("llena"); void ctx.$anillo.offsetWidth; ctx.$anillo.classList.add("llena");
  };
  ctx.ocultarAnillo = function() { ctx.$anillo.hidden = true; ctx.$anillo.classList.remove("llena"); };
  ctx.programarMenu = function(g) {
    g.anilloT = ctx.vida.setTimeout(() => { if (ctx.gesto === g && !g.arrastre) ctx.mostrarAnillo(g.x, g.y, ctx.MENU_MS - ctx.ANILLO_MS); }, ctx.ANILLO_MS);
    g.menuT = ctx.vida.setTimeout(() => {
      if (ctx.gesto !== g || g.arrastre) return;
      ctx.vida.clearTimeout(g.largo); ctx.ocultarAnillo();
      ctx.gesto = null;
      if (navigator.vibrate) navigator.vibrate(15);
      ctx.abrirAlternativas(g.o.pos);
    }, ctx.MENU_MS);
  };
  ctx.cancelarMenu = function(g) { if (!g) return; ctx.vida.clearTimeout(g.anilloT); ctx.vida.clearTimeout(g.menuT); ctx.ocultarAnillo(); };

  // Un toque elige el elemento entero; el doble toque amplía hasta el siguiente límite semántico.
  // Un toque dentro de lo elegido espera un momento por si llega el segundo, así ampliar no parpadea.
  ctx.toque = function(g, ev) {
    const ahora = performance.now();
    const doble = ctx.ultimoToque && ahora - ctx.ultimoToque.t < ctx.DOBLE_MS && Math.hypot(ev.clientX - ctx.ultimoToque.x, ev.clientY - ctx.ultimoToque.y) < 26;
    ctx.vida.clearTimeout(ctx.tSimple); ctx.pendiente = null;
    if (doble) {
      const base = ctx.ultimoToque.base;
      ctx.ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY, base: null };
      if (base && base[0] < base[1] && g.o.pos >= base[0] && g.o.pos < base[1]) ctx.$codigo.setSelectionRange(...base);
      const [a, b] = ctx.sel();
      if (a === b || g.o.pos < a || g.o.pos >= b) { const t = ctx.E.atomo(ctx.estructura(), g.o.pos); if (t) ctx.$codigo.setSelectionRange(...t); }
      ctx.pila.length = 0;
      return ctx.ampliar();
    }
    ctx.ultimoToque = { t: ahora, x: ev.clientX, y: ev.clientY, base: g.antes };
    const [a, b] = g.antes, shift = ev.shiftKey;
    if (a < b && g.o.pos >= a && g.o.pos < b && !shift) { ctx.pendiente = g.o; ctx.tSimple = ctx.vida.setTimeout(ctx.resolverPendiente, ctx.DOBLE_MS); return; }
    ctx.simple(g.o, shift);
  };
  ctx.simple = function(o, extender) {
    const t = o.ficha ? ctx.E.atomo(ctx.estructura(), o.pos) : null, r = t || [o.pos, o.pos];
    if (extender) { const [a, b] = ctx.sel(); return ctx.elegir(Math.min(a, r[0]), Math.max(b, r[1])); }
    ctx.elegir(r[0], r[1]);
  };

  // Arrastrar: los valores se copian sobre un hueco, un argumento o dentro de ( ) y [ ];
  // las sentencias y líneas completas se mueven entre líneas (con Alt o Ctrl, se copian).
  ctx.iniciarArrastre = function(ev, [a, b], lineas) {
    if (!ctx.editable() || a === b) { ctx.gesto = null; return; }
    ctx.cancelarMenu(ctx.gesto);
    const v = ctx.$codigo.value;
    ctx.gesto.arrastre = { a, b, texto: v.slice(a, b), lineas, x: ev.clientX, y: ev.clientY, tactil: ev.pointerType !== "mouse", destino: null };
    const t = v.slice(a, b).replace(/\n$/, ""), primera = t.split("\n")[0].trim();
    ctx.$fantasma.textContent = primera.length > 42 ? primera.slice(0, 40) + "…" : primera + (t.includes("\n") ? " …" : "");
    ctx.$fantasma.hidden = false;
    ctx.$editor.classList.add("arrastrando");
    ctx.cerrarSugerencias();
    ctx.moverArrastre(ev.clientX, ev.clientY);
    ctx.autoDesplazar();
  };
  ctx.moverArrastre = function(x, y) {
    const d = ctx.gesto.arrastre, r = ctx.$vista.getBoundingClientRect(), ed = ctx.$editor.getBoundingClientRect();
    ctx.$fantasma.style.transform = `translate(${Math.round(x + 12)}px, ${Math.round(y - (d.tactil ? 48 : 18))}px)`;
    // Todo el editor cuenta: número de línea, código y columna de asas.
    const dentro = x >= ed.left - 10 && x <= ed.right + 10 && y >= r.top - 4 && y <= r.bottom + 4;
    d.destino = !dentro ? null : d.lineas ? ctx.destinoLineas(y, d, x) : ctx.destinoValor(x, y, d);
    ctx.pintarDestino(d);
  };
  ctx.anchoCaracter = function() {
    if (ctx.medida) return ctx.medida;
    const c = document.createElement("canvas").getContext("2d"), cs = getComputedStyle(ctx.$texto);
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return (ctx.medida = c.measureText("0000000000").width / 10 || 8);
  };
  ctx.nivelArrastre = function(d, l, x) {
    const v = ctx.$codigo.value, e = ctx.estructura(), destino = l < e.lineas.length ? e.lineas[l] : v.length;
    const { resto, crece } = ctx.sinLineas(v, d.a, d.b, false);
    let pos = destino < d.a ? destino : destino - (d.b - d.a);
    if (destino >= d.b) pos += crece;
    const ns = ctx.nivelesEn(resto, Math.min(pos, resto.length));
    if (!ns.length) return null;
    const x0 = ctx.$texto.getBoundingClientRect().left + (parseFloat(getComputedStyle(ctx.$texto).paddingLeft) || 0), w = ctx.anchoCaracter();
    let mejor = 0;
    ns.forEach((n, i) => { if (Math.abs(x - (x0 + n.length * w)) < Math.abs(x - (x0 + ns[mejor].length * w))) mejor = i; });
    return { nivel: ns[mejor], xNivel: x0 + ns[mejor].length * w };
  };
  ctx.destinoLineas = function(y, d, x) {
    const e = ctx.estructura(), l0 = ctx.E.lineaDe(e, d.a), l1 = ctx.E.lineaDe(e, Math.max(d.a, d.b - 1)) + 1;
    let mejor = null;
    for (let l = 0; l <= ctx.filas.length; l++) {
      const yl = l < ctx.filas.length ? ctx.filas[l].el.getBoundingClientRect().top : ctx.filas[ctx.filas.length - 1].el.getBoundingClientRect().bottom;
      if (!mejor || Math.abs(y - yl) < Math.abs(y - mejor.y)) mejor = { tipo: "linea", l, y: yl };
    }
    if (!mejor) return null;
    if (ctx.significativa) {
      const n = ctx.nivelArrastre(d, mejor.l, x);
      if (!n) return { ...mejor, valido: false };
      if (mejor.l >= l0 && mejor.l <= l1 && n.nivel === ctx.sangriaDe(ctx.$codigo.value.slice(d.a, d.b))) return { ...mejor, nulo: true };
      return { ...mejor, ...n, valido: true };
    }
    if (mejor.l >= l0 && mejor.l <= l1) return { ...mejor, nulo: true };   // en su propio sitio
    return { ...mejor, valido: ctx.E.fronteraValida(e, mejor.l) };
  };
  ctx.destinoValor = function(x, y, d) {
    const o = ctx.objetivo(x, y), ch = ctx.$codigo.value[o.pos];
    // Sobre un paréntesis o corchete que abre, el valor cae dentro.
    const pos = o.ficha && (ch === "(" || ch === "[") ? o.pos + 1 : o.pos;
    if (pos >= d.a && pos <= d.b) return null;
    const t = ctx.E.destino(ctx.estructura(), pos);
    if (!t) return { tipo: "insertar", a: pos, b: pos, valido: false };
    if (t.a < d.b && t.b > d.a) return null;
    return { ...t, valido: true };
  };
  ctx.pintarDestino = function(d) {
    for (const x of ctx.$capa.querySelectorAll(".destino-b")) x.remove();
    const t = d.destino;
    ctx.$fantasma.classList.toggle("no", !!t && t.valido === false);
    if (!t || t.nulo) return;
    if (t.tipo === "linea") { const r = ctx.$texto.getBoundingClientRect(), x = t.xNivel != null ? Math.max(r.left + 4, t.xNivel) : r.left + 4; ctx.caja(`destino-b linea${t.valido ? "" : " no"}`, x, t.y - 1.5, r.right - 4 - x, 3); return; }
    if (t.tipo === "reemplazar") { for (const r of ctx.renglones(ctx.rectsDe(t.a, t.b))) ctx.caja("destino-b hueco", r.left - 3, r.top - 1, r.right - r.left + 6, r.bottom - r.top + 2); return; }
    const c = ctx.rectCaret(t.a);
    if (c) ctx.caja(`destino-b cursor${t.valido ? "" : " no"}`, c.left - 1.5, c.top, 3, c.height);
  };
  ctx.soltar = function(ev, d) {
    ctx.terminarArrastre();
    const t = d.destino;
    if (!t || t.nulo || t.valido === false || !ctx.editable()) return;
    if (d.lineas) return ctx.moverLineasA(d.a, d.b, t.l, ev.altKey || ev.ctrlKey || ev.metaKey, t.nivel ?? null);
    // Un valor se duplica: el original se queda donde estaba.
    if (t.tipo === "reemplazar") return ctx.reemplazar(t.a, t.b, d.texto, t.a, t.a + d.texto.length);
    const ins = t.vacio || t.lista ? ctx.E.enLista(ctx.$codigo.value, t.a, t.b, d.texto) : d.texto, ini = t.a + ins.indexOf(d.texto);
    ctx.reemplazar(t.a, t.b, ins, ini, ini + d.texto.length);
  };
  ctx.terminarArrastre = function() {
    ctx.$fantasma.hidden = true;
    ctx.$editor.classList.remove("arrastrando");
    for (const x of ctx.$capa.querySelectorAll(".destino-b")) x.remove();
    ctx.vida.cancelAnimationFrame(ctx.rafDesplazar);
  };
  // Cerca de los bordes de la vista, el arrastre la desplaza.
  ctx.autoDesplazar = function() {
    ctx.vida.cancelAnimationFrame(ctx.rafDesplazar);
    const paso = () => {
      if (!ctx.gesto || !ctx.gesto.arrastre) return;
      const r = ctx.$vista.getBoundingClientRect(), { x, y } = ctx.gesto.arrastre, borde = 34;
      const v = y < r.top + borde ? y - r.top - borde : y > r.bottom - borde ? y - r.bottom + borde : 0;
      if (v) { ctx.$vista.scrollTop += Math.max(-16, Math.min(16, v * 0.4)); ctx.moverArrastre(x, y); }
      ctx.rafDesplazar = ctx.vida.requestAnimationFrame(paso);
    };
    ctx.rafDesplazar = ctx.vida.requestAnimationFrame(paso);
  };

  // ---------- Asas de línea: en el número o en el borde derecho ----------
  ctx.iniciarAsa = function(ev, l) {
    if (!ctx.activo || l < 0) return;
    ev.preventDefault();
    const u = ctx.E.unidadLinea(ctx.estructura(), l);
    if (u[0] === u[1]) return;
    ctx.gesto = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, raton: ev.pointerType === "mouse", lineas: u, o: { pos: u[0] }, antes: ctx.sel() };
  };
  ctx.pintarAsas = function() {
    if (!ctx.activo || ctx.asa !== "borde") { ctx.$asasIn.innerHTML = localizarHTML(""); return; }
    ctx.$asasIn.innerHTML = localizarHTML(ctx.filas.map((f, i) => ctx.$codigo.value.slice(f.a, f.b).trim()
      ? `<div class="asa" data-l="${i}" style="top:${f.el.offsetTop}px" title="Arrastra la línea ${i + 1}"></div>` : "").join(""));
    ctx.$asasIn.style.transform = `translateY(${-ctx.$vista.scrollTop}px)`;
  };
  return function iniciar() {


  // ---------- Toques: elegir, ampliar con doble toque y arrastrar ----------
  (ctx.DOBLE_MS = 380), (ctx.LARGO_MS = 430);
  (ctx.gesto = null), (ctx.ultimoToque = null), (ctx.tSimple = 0), (ctx.pendiente = null);
  ctx.vida.escuchar(document, "pointerdown", (ev) => { if (ctx.pendiente && !ctx.$vista.contains(ev.target)) ctx.resolverPendiente(); }, true);
  ctx.vida.escuchar(ctx.$codigo, "input", () => { ctx.vida.clearTimeout(ctx.tSimple); ctx.tSimple = 0; ctx.pendiente = null; });
  (ctx.$fantasma = document.createElement("div"));
  ctx.$fantasma.className = "fantasma-bloque"; ctx.$fantasma.hidden = true; ctx.$fantasma.setAttribute("aria-hidden", "true");
  ctx.vida.portal(ctx.$fantasma);
  ctx.vida.escuchar(ctx.$vista, "pointerdown", (ev) => {
    if (!ctx.activo || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    if (ev.pointerType === "mouse") { ev.preventDefault(); ctx.$vista.focus({ preventScroll: true }); }
    const o = ctx.objetivo(ev.clientX, ev.clientY), [a, b] = ctx.sel();
    ctx.gesto = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, o, antes: [a, b], dentro: a < b && o.pos >= a && o.pos < b, raton: ev.pointerType === "mouse" };
    // Con el dedo, una ficha sin elegir se levanta manteniéndola pulsada (si no, el dedo desplaza la vista).
    if (!ctx.gesto.raton && !ctx.gesto.dentro && o.ficha) ctx.gesto.largo = ctx.vida.setTimeout(ctx.levantar, ctx.LARGO_MS);
    // Con el dedo quieto 2 s se abre el menú de alternativas (como el clic derecho).
    if (!ctx.gesto.raton) { ctx.ultimoTactil = performance.now(); ctx.programarMenu(ctx.gesto); }
  });
  ctx.vida.escuchar(window, "pointermove", (ev) => {
    if (!ctx.gesto || ev.pointerId !== ctx.gesto.id) return;
    if (ctx.gesto.arrastre) { ctx.gesto.arrastre.x = ev.clientX; ctx.gesto.arrastre.y = ev.clientY; ctx.moverArrastre(ev.clientX, ev.clientY); return; }
    if (Math.hypot(ev.clientX - ctx.gesto.x, ev.clientY - ctx.gesto.y) < (ctx.gesto.raton ? 5 : 9)) return;
    ctx.vida.clearTimeout(ctx.gesto.largo);
    ctx.cancelarMenu(ctx.gesto);
    if (ctx.gesto.lineas) return ctx.iniciarArrastre(ev, ctx.gesto.lineas, true);
    if (ctx.gesto.raton || ctx.gesto.dentro || ctx.gesto.levantado) {
      const r = ctx.gesto.dentro ? ctx.gesto.antes : ctx.E.atomo(ctx.estructura(), ctx.gesto.o.pos);
      if (!r || r[0] === r[1]) { ctx.gesto = null; return; }
      if (!ctx.gesto.dentro) ctx.elegir(r[0], r[1]);
      return ctx.sonLineas(r[0], r[1]) ? ctx.iniciarArrastre(ev, ctx.lineasDe(r[0], r[1]), true) : ctx.iniciarArrastre(ev, r, false);
    }
    ctx.gesto = null;   // el dedo desplaza la vista
  });
  ctx.vida.escuchar(window, "pointerup", (ev) => {
    if (!ctx.gesto || ev.pointerId !== ctx.gesto.id) return;
    ctx.vida.clearTimeout(ctx.gesto.largo);
    ctx.cancelarMenu(ctx.gesto);
    const g = ctx.gesto; ctx.gesto = null;
    if (g.arrastre) return ctx.soltar(ev, g.arrastre);
    if (g.lineas) return ctx.elegir(...ctx.sinSalto(g.lineas));   // toque en un asa: elige la sentencia de esa línea
    if (!g.levantado) ctx.toque(g, ev);
  });
  ctx.vida.escuchar(window, "pointercancel", (ev) => {
    if (!ctx.gesto || ev.pointerId !== ctx.gesto.id) return;
    ctx.vida.clearTimeout(ctx.gesto.largo);
    ctx.cancelarMenu(ctx.gesto);
    if (ctx.gesto.arrastre) ctx.terminarArrastre();
    ctx.gesto = null;
  });
  // Con la ficha levantada el dedo arrastra en vez de desplazar.
  ctx.vida.escuchar(ctx.$vista, "touchmove", (ev) => { if (ctx.gesto && (ctx.gesto.arrastre || ctx.gesto.levantado)) ev.preventDefault(); }, { passive: false });
  // Clic derecho: alternativas del elemento. La pulsación larga del dedo dispara también «contextmenu»
  // en Android; ahí manda el temporizador de 2 s, no el menú del sistema.
  (ctx.ultimoTactil = -1e9);
  ctx.vida.escuchar(ctx.$vista, "contextmenu", (ev) => {
    if (!ctx.activo) return;
    ev.preventDefault();
    if (performance.now() - ctx.ultimoTactil < 2500 || ev.pointerType === "touch") return;
    ctx.$vista.focus({ preventScroll: true });
    ctx.abrirAlternativas(ctx.objetivo(ev.clientX, ev.clientY).pos);
  });

  // Anillo que se llena mientras el dedo sigue quieto: el primer segundo no pasa nada,
  // el segundo se llena el círculo y al completarlo se abre la lista.
  (ctx.MENU_MS = 2000), (ctx.ANILLO_MS = 1000);
  (ctx.$anillo = document.createElement("div"));
  ctx.$anillo.className = "anillo-carga"; ctx.$anillo.hidden = true; ctx.$anillo.setAttribute("aria-hidden", "true");
  ctx.$anillo.innerHTML = `<svg viewBox="0 0 48 48"><circle class="fondo" cx="24" cy="24" r="19"/><circle class="relleno" cx="24" cy="24" r="19"/></svg>`;
  ctx.vida.portal(ctx.$anillo);
  // Python: en el hueco elegido, el nivel cuya columna queda más cerca del puntero.
  (ctx.medida = null);
  ctx.vida.escuchar(ctx.$codigo, "cmg:medido", () => { ctx.medida = null; });
  (ctx.rafDesplazar = 0);
  // Palabras arrastradas desde el inspector (arrastre nativo del navegador en PC).
  ctx.vida.escuchar(ctx.$vista, "dragover", (ev) => {
    if (!ctx.activo || ctx.$codigo.readOnly || !ev.dataTransfer.types.includes("text/plain")) return;
    ev.preventDefault(); ev.dataTransfer.dropEffect = "copy";
  });
  ctx.vida.escuchar(ctx.$vista, "drop", (ev) => {
    if (!ctx.activo) return;
    ev.preventDefault();
    ctx.$editor.classList.remove("soltar");
    const texto = ev.dataTransfer.getData("text/plain");
    if (!texto || !ctx.editable()) return;
    const t = ctx.destinoValor(ev.clientX, ev.clientY, { a: -1, b: -1 });
    if (t && t.valido) ctx.soltar(ev, { texto, lineas: false, destino: t });
    else { const p = ctx.posEn(ev.clientX, ev.clientY); ctx.reemplazar(p, p, texto, p, p + texto.length); }
  });
  ctx.vida.escuchar(ctx.$gutter, "pointerdown", (ev) => {
    if (!ctx.activo || ctx.asa !== "numero" || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    const d = ev.target.closest(".gutter-in > div");
    if (d) ctx.iniciarAsa(ev, [...ctx.$gutter.children].indexOf(d));
  });
  ctx.vida.escuchar(ctx.$asasIn, "pointerdown", (ev) => {
    const d = ev.target.closest("[data-l]");
    if (d && !(ev.pointerType === "mouse" && ev.button !== 0)) ctx.iniciarAsa(ev, +d.dataset.l);
  });
  ctx.vida.escuchar(ctx.$vista, "scroll", () => {
    ctx.cmg.alDesplazar();
    ctx.$asasIn.style.transform = `translateY(${-ctx.$vista.scrollTop}px)`;
    if (!ctx.$sug.hidden) ctx.colocarSugerencias();
  }, { passive: true });
  };
}
