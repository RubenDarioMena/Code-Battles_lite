import { localizarHTML } from './dependencias.js';

/* Interfaz extraída; juego y demo crean instancias de este mismo módulo. */
// edicion: controles. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {


  // ---------- Modo sin teclado ----------
  ctx.activar = function(si, enfocar = false) {
    ctx.activo = !!si;
    ctx.escribir("sin-teclado", ctx.activo);
    ctx.$editor.classList.toggle("sin-teclado", ctx.activo);
    ctx.app.dataset.sinTeclado = String(ctx.activo);
    ctx.$vista.hidden = !ctx.activo;
    ctx.$asas.hidden = !(ctx.activo && ctx.asa === "borde");
    ctx.$codigo.tabIndex = ctx.activo ? -1 : 0;
    if (ctx.activo) ctx.$codigo.setAttribute("inputmode", "none"); else ctx.$codigo.removeAttribute("inputmode");
    ctx.cerrarSugerencias();
    ctx.pintarBarra();
    if (ctx.activo) {
      if (document.activeElement === ctx.$codigo) ctx.$codigo.blur();   // cierra el teclado del teléfono
      ctx.pintarVista();
      ctx.$vista.scrollTop = ctx.$codigo.scrollTop;
      ctx.cmg.medirEditor();
      ctx.vida.queueMicrotask(() => { ctx.pintarSeleccion(); ctx.mostrarRango(ctx.sel()[0]); });
    } else {
      ctx.$codigo.scrollTop = ctx.$vista.scrollTop;
      ctx.cmg.medirEditor();
      if (enfocar) ctx.$codigo.focus({ preventScroll: true });
    }
  };
  // Sin teclado en PC: la vista toma el foco al hacer clic y entiende atajos de bloques.
  ctx.atomoVecino = function(dir) {
    const [a, b] = ctx.sel(), e = ctx.estructura(), v = e.src;
    let p = dir > 0 ? b : a - 1;
    while (p >= 0 && p < v.length && /\s/.test(v[p])) p += dir;
    const t = p >= 0 && p < v.length ? ctx.E.fichaEn(e, p) : null;
    if (t) ctx.elegir(t.a, t.b, { mostrar: true });
  };
  ctx.lineaVecina = function(dir) {
    const [a, b] = ctx.sel(), e = ctx.estructura();
    let l = ctx.E.lineaDe(e, dir < 0 ? a : Math.max(a, b - 1)) + dir;
    while (l >= 0 && l < e.lineas.length && !e.src.slice(ctx.E.inicioLinea(e, l), ctx.E.finLinea(e, l)).trim()) l += dir;
    if (l < 0 || l >= e.lineas.length) return;
    const ini = ctx.E.inicioLinea(e, l), fin = ctx.E.finLinea(e, l);
    ctx.elegir(ini + ctx.sangriaDe(e.src.slice(ini, fin)).length, fin, { mostrar: true });
  };
  ctx.pintarOrden = function() {
    ctx.$grupos.innerHTML = localizarHTML(ctx.grupos.map((g, i) => `<div class="orden-grupo" data-g="${i}">
        <span class="orden-asa" aria-label="Mover el grupo ${i + 1}" title="Mover el grupo">⋮⋮</span>
        <div class="orden-btns">${g.map(id => `<span class="orden-btn" data-id="${id}" title="${ctx.esc(ctx.ACCIONES[id].t)}">${ctx.svg(ctx.ICONOS[id])}<span>${ctx.esc(ctx.ACCIONES[id].t)}</span></span>`).join("")}</div>
      </div>`).join("") + `<div class="orden-grupo nuevo"><div class="orden-btns"><span class="orden-vacio">Grupo nuevo</span></div></div>`);
  };
  ctx.leerOrden = function() {
    ctx.grupos = ctx.validarGrupos([...ctx.$grupos.querySelectorAll(".orden-grupo")].map(g => [...g.querySelectorAll(".orden-btn")].map(b => b.dataset.id)));
    ctx.escribir("barra", ctx.grupos);
    ctx.construirBarra();
    ctx.pintarOrden();
  };
  return function iniciar() {

  ctx.vida.escuchar(ctx.$("b-teclado"), "click", () => ctx.activar(!ctx.activo, true));
  ctx.vida.escuchar(ctx.$codigo, "cmg:medido", () => {
    if (!ctx.activo) return;
    if (ctx.$codigo.value !== ctx.pintado) ctx.pintarVista();
    ctx.pintarAsas();
    // insertar() fija la selección después del evento input: la paleta deja así elegido su primer hueco.
    ctx.vida.queueMicrotask(() => { ctx.pintarSeleccion(); ctx.actualizarSugerencias(); });
  });
  ctx.vida.escuchar(ctx.$codigo, "cmg:seleccion", () => { if (ctx.activo) { ctx.pintarSeleccion(); ctx.mostrarRango(ctx.sel()[0]); } ctx.actualizarSugerencias(); });
  ctx.vida.escuchar(ctx.$codigo, "cmg:estado", () => { ctx.pintarBarra(); if (ctx.$codigo.readOnly) ctx.cerrarSugerencias(); });
  ctx.vida.escuchar(ctx.$codigo, "input", () => { if (!ctx.activo) ctx.actualizarSugerencias(); });

  // ---------- Teclado físico ----------
  // Ctrl+Alt+A activa o desactiva el modo sin teclado desde cualquier parte del juego.
  ctx.vida.escuchar(document, "keydown", (ev) => {
    if (!ev.ctrlKey || !ev.altKey || ev.shiftKey || ev.metaKey || !(ev.code === "KeyA" || (ev.key || "").toLowerCase() === "a")) return;
    if (ctx.ambito.querySelector("dialog[open]") || (ctx.cmg.seudo && ctx.cmg.seudo.activo)) return;
    ev.preventDefault(); ev.stopPropagation();
    ctx.activar(!ctx.activo, true);
    if (ctx.activo && ctx.editorVisible()) ctx.$vista.focus({ preventScroll: true });
    ctx.toast(ctx.activo ? "Modo sin teclado · Ctrl+Alt+A" : "Teclado · Ctrl+Alt+A");
  }, true);
  ctx.vida.escuchar(ctx.$vista, "keydown", (ev) => {
    if (!ctx.activo) return;
    if (ctx.pendiente && !["Shift", "Control", "Alt", "Meta"].includes(ev.key)) ctx.resolverPendiente();
    if (ctx.teclaSugerencias(ev)) return;
    const mod = ev.ctrlKey || ev.metaKey, k = ev.key, l = k.length === 1 ? k.toLowerCase() : k;
    const acciones = [
      [k === "Backspace" || k === "Delete", ctx.borrar],
      [mod && l === "z" && !ev.shiftKey, ctx.deshacer], [(mod && l === "z" && ev.shiftKey) || (mod && l === "y"), ctx.rehacer],
      [mod && l === "d", ctx.duplicar], [mod && k === "/", () => ctx.cmg.alternarComentario()], [mod && k === "Enter", () => ctx.cmg.alternarEjecucion()],
      [ev.altKey && ev.shiftKey && k === "ArrowRight", ctx.ampliar], [ev.altKey && ev.shiftKey && k === "ArrowLeft", ctx.reducir],
      [ev.altKey && !ev.shiftKey && (k === "ArrowUp" || k === "ArrowDown"), () => ctx.moverLineas(k === "ArrowUp" ? -1 : 1)],
      [!ev.altKey && !mod && (k === "ArrowLeft" || k === "ArrowRight"), () => ctx.atomoVecino(k === "ArrowLeft" ? -1 : 1)],
      [!ev.altKey && !mod && (k === "ArrowUp" || k === "ArrowDown"), () => ctx.lineaVecina(k === "ArrowUp" ? -1 : 1)],
      [k === "Enter" && !mod, ctx.lineaNueva], [k === "Tab", () => ctx.sangrar(ev.shiftKey ? -1 : 1)],
      [k === "Escape", () => { const [a] = ctx.sel(); ctx.elegir(a, a); }],
      [k.length === 1 && !mod && !ev.altKey, () => ctx.toast("Modo sin teclado: toca ⌨ para escribir.")],
    ];
    const hit = acciones.find(([si]) => si);
    if (hit) { ev.preventDefault(); hit[1](); }
  });
  // Ctrl+C / X / V con la vista enfocada (el evento llega al documento: la vista no es editable).
  (ctx.conVista = () => ctx.activo && document.activeElement === ctx.$vista);
  ctx.vida.escuchar(document, "copy", (ev) => {
    if (!ctx.conVista()) return;
    const [a, b] = ctx.sel(); if (a === b) return;
    ev.preventDefault();
    const t = ctx.$codigo.value.slice(a, b);
    ev.clipboardData.setData("text/plain", t); ctx.guardarCopia(t); ctx.toast("Copiado");
  });
  ctx.vida.escuchar(document, "cut", (ev) => {
    if (!ctx.conVista()) return;
    const [a, b] = ctx.sel(); if (a === b || !ctx.editable()) return;
    ev.preventDefault();
    const t = ctx.$codigo.value.slice(a, b);
    ev.clipboardData.setData("text/plain", t); ctx.guardarCopia(t); ctx.quitar(a, b);
  });
  ctx.vida.escuchar(document, "paste", (ev) => {
    if (!ctx.conVista()) return;
    ev.preventDefault();
    const t = ev.clipboardData.getData("text/plain");
    if (t && ctx.editable()) ctx.pegarTexto(t);
  });
  // Con teclado: la lista de sugerencias se maneja con flechas y ampliar/mover líneas tienen atajo.
  ctx.vida.escuchar(ctx.$codigo, "keydown", (ev) => {
    if (ctx.activo || ctx.teclaSugerencias(ev)) return;
    if (ev.altKey && ev.shiftKey && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) { ev.preventDefault(); ev.key === "ArrowRight" ? ctx.ampliar() : ctx.reducir(); }
    else if (ev.altKey && !ev.shiftKey && (ev.key === "ArrowUp" || ev.key === "ArrowDown")) { ev.preventDefault(); ctx.moverLineas(ev.key === "ArrowUp" ? -1 : 1); }
  }, true);

  // ---------- Ajustes ----------
  (ctx.$ajusteAsa = ctx.$("ajustes-asa"));
  if (ctx.$ajusteAsa) {
    ctx.$ajusteAsa.value = ctx.asa;
    ctx.vida.escuchar(ctx.$ajusteAsa, "change", () => {
      ctx.asa = ctx.$ajusteAsa.value === "borde" ? "borde" : "numero";
      ctx.escribir("asa", ctx.asa);
      ctx.$editor.dataset.asa = ctx.asa;
      ctx.$asas.hidden = !(ctx.activo && ctx.asa === "borde");
      ctx.pintarAsas();
      ctx.cmg.medirEditor();
    });
  }

  // ---------- Orden de la barra de edición ----------
  // Un diálogo encima de Ajustes: cada grupo es una fila con su asa; los botones se arrastran dentro
  // del grupo, a otro grupo o a «Grupo nuevo». Mientras se arrastra, el elemento se mueve en vivo.
  (ctx.$orden = ctx.$("orden-barra")), (ctx.$grupos = ctx.$("orden-grupos"));
  (ctx.mueve = null);
  ctx.vida.escuchar(ctx.$grupos, "pointerdown", (ev) => {
    const el = ev.target.closest(".orden-btn") || (ev.target.closest(".orden-asa") && ev.target.closest(".orden-grupo"));
    if (!el || el.classList.contains("nuevo") || ev.button > 0) return;
    ev.preventDefault();
    ctx.mueve = { el, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, activo: false, grupo: el.classList.contains("orden-grupo") };
  });
  ctx.vida.escuchar(window, "pointermove", (ev) => {
    if (!ctx.mueve || ev.pointerId !== ctx.mueve.id) return;
    if (!ctx.mueve.activo) {
      if (Math.hypot(ev.clientX - ctx.mueve.x0, ev.clientY - ctx.mueve.y0) < 5) return;
      ctx.mueve.activo = true; ctx.mueve.el.classList.add("levantado");
    }
    if (ctx.mueve.grupo) {
      // El grupo se coloca antes del primer grupo cuyo centro queda por debajo del puntero.
      const otros = [...ctx.$grupos.querySelectorAll(".orden-grupo:not(.nuevo)")].filter(g => g !== ctx.mueve.el);
      const antes = otros.find(g => { const r = g.getBoundingClientRect(); return ev.clientY < r.top + r.height / 2; });
      ctx.$grupos.insertBefore(ctx.mueve.el, antes || ctx.$grupos.querySelector(".orden-grupo.nuevo"));
      return;
    }
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY), g = bajo && bajo.closest && bajo.closest(".orden-grupo");
    if (!g || !ctx.$grupos.contains(g)) return;
    const fila = g.querySelector(".orden-btns"), otros = [...fila.querySelectorAll(".orden-btn")].filter(b => b !== ctx.mueve.el);
    // Antes del botón más cercano si el puntero está en su mitad izquierda; si no, después.
    let mejor = null, d = Infinity;
    for (const b of otros) { const r = b.getBoundingClientRect(), dd = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2)); if (dd < d) { d = dd; mejor = b; } }
    if (!mejor) { const vacio = fila.querySelector(".orden-vacio"); fila.insertBefore(ctx.mueve.el, vacio); return; }
    const r = mejor.getBoundingClientRect();
    fila.insertBefore(ctx.mueve.el, ev.clientX < r.left + r.width / 2 ? mejor : mejor.nextSibling);
  });
  (ctx.soltarOrden = (ev) => {
    if (!ctx.mueve || ev.pointerId !== ctx.mueve.id) return;
    const m = ctx.mueve; ctx.mueve = null;
    m.el.classList.remove("levantado");
    if (m.activo) ctx.leerOrden();
  });
  ctx.vida.escuchar(window, "pointerup", ctx.soltarOrden);
  ctx.vida.escuchar(window, "pointercancel", ctx.soltarOrden);
  ctx.vida.escuchar(ctx.$("ajustes-orden-barra"), "click", () => { ctx.pintarOrden(); ctx.$orden.showModal(); });
  ctx.vida.escuchar(ctx.$("orden-cerrar"), "click", () => ctx.$orden.close());
  ctx.vida.escuchar(ctx.$("orden-restaurar"), "click", () => { ctx.grupos = ctx.validarGrupos(ctx.GRUPOS_BASE); ctx.escribir("barra", ctx.grupos); ctx.construirBarra(); ctx.pintarOrden(); });

  // ---------- Arranque ----------
  ctx.$editor.dataset.asa = ctx.asa;
  // accion(id): una acción de la barra por su nombre (también sangrar y desangrar); la usan los botones de
  // edición de la paleta del teléfono.
  ctx.cmg.edicion = { get activo() { return ctx.activo; }, activar: ctx.activar, accion: ctx.ejecutarAccion, elegir: ctx.elegir, ampliar: ctx.ampliar, reducir: ctx.reducir, deshacer: ctx.deshacer, rehacer: ctx.rehacer, copiar: ctx.copiar, pegar: ctx.pegar, borrar: ctx.borrar, duplicar: ctx.duplicar, moverLineas: ctx.moverLineas, lineaNueva: ctx.lineaNueva, desenvolver: ctx.desenvolver, get portapapeles() { return ctx.portapapeles; },
    get seleccionando() { return ctx.seleccionando; }, seleccion: ctx.alternarSeleccion };
  ctx.construirBarra();
  if (ctx.leer("sin-teclado", false) === true) ctx.activar(true);
  };
}
