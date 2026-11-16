import { dependencias } from './dependencias.js';

/* Interfaz extraída; juego y demo crean instancias de este mismo módulo. */
// edicion: barra. Estado compartido solo por esta instancia.
/** @param {any} ctx */
export function preparar(ctx) {

  ctx.validarGrupos = function(g) {
    const vistos = new Set();
    const out = (Array.isArray(g) ? g : []).map(x => (Array.isArray(x) ? x : []).filter(id => Object.hasOwn(ctx.ACCIONES, id) && !vistos.has(id) && vistos.add(id))).filter(x => x.length);
    const faltan = Object.keys(ctx.ACCIONES).filter(id => !vistos.has(id));
    if (faltan.length) out.push(faltan);
    return out;
  };
  ctx.textoI18n = function(clave) {
    const i18n = dependencias.i18n, t = i18n && typeof i18n.t === "function" ? i18n.t(clave) : null;
    return typeof t === "string" && t !== clave ? t : ctx.TRADUCCIONES_ES[clave] || clave;
  };
  ctx.construirBarra = function() {
    // Un grupo que solo lleva el interruptor del teclado se oculta donde el interruptor no aplica.
    ctx.$barra.innerHTML = ctx.grupos.map(g => `<span class="grupo-ed${g.length === 1 && g[0] === "teclado" ? " solo-teclado" : ""}">${g.map(ctx.botonBarra).join("")}</span>`).join("")
      + `<span class="ed-movil"><button type="button" class="b-seleccion con-variantes" data-seleccion aria-pressed="false" aria-label="${ctx.esc(ctx.textoI18n("editor.aria.seleccion.apagada"))}" data-tip="${ctx.esc(ctx.textoI18n("editor.tip.seleccion"))}" data-tip-cod="${ctx.esc(ctx.textoI18n("editor.tip.seleccion.codigo"))}">${ctx.svg(ctx.ICONOS.seleccion)}</button>`
      // Sin tooltip: taparía el código mientras se arrastra (un toque sin arrastrar ya explica su uso).
      + `<span class="protomouse" data-protomouse role="img" aria-label="${ctx.esc(ctx.textoI18n("editor.aria.protomouse"))}">${ctx.svg(ctx.ICONOS.mouse)}</span></span>`;
    ctx.pintarBarra();
  };
  // Una acción de la barra (botón o variante). En seudocódigo actúan sobre el renglón elegido (seudo.js);
  // deshacer sigue siendo del texto.
  ctx.ejecutarAccion = function(id) {
    if (id === "seleccion") return ctx.alternarSeleccion();
    const accion = ctx.accionDe(id);
    if (!accion) return;
    if (!["ampliar", "reducir", "teclado"].includes(id)) ctx.apagarSeleccion();
    const r = ctx.cmg.seudo && ctx.cmg.seudo.activo ? ctx.cmg.seudo.accion(id) : false;
    if (r) { if (typeof r === "string") ctx.toast(r); return; }
    accion.fn();
  };
  ctx.pintarInterruptor = function() {
    const b = ctx.$barra.querySelector("[data-seleccion]");
    if (b) {
      b.setAttribute("aria-pressed", String(ctx.seleccionando));
      b.setAttribute("aria-label", ctx.textoI18n(ctx.seleccionando ? "editor.aria.seleccion.encendida" : "editor.aria.seleccion.apagada"));
    }
    ctx.$barra.classList.toggle("seleccionando", ctx.seleccionando);
  };
  ctx.alternarSeleccion = function(si = !ctx.seleccionando) {
    ctx.seleccionando = !!si;
    ctx.pintarInterruptor();
    if (ctx.seleccionando && !ctx.avisoSeleccion) { ctx.avisoSeleccion = true; ctx.toast(ctx.textoI18n("editor.toast.seleccion.encendida")); }
  };
  ctx.apagarSeleccion = function() { if (ctx.seleccionando) ctx.alternarSeleccion(false); };
  ctx.menuBarra = function() {
    if (ctx.$varBarra) return ctx.$varBarra;
    ctx.$varBarra = document.createElement("div");
    ctx.$varBarra.className = "variantes variantes-ed"; ctx.$varBarra.hidden = true; ctx.$varBarra.setAttribute("role", "menu");
    ctx.vida.portal(ctx.$varBarra);
    ctx.vida.escuchar(ctx.$varBarra, "pointerdown", (ev) => ev.preventDefault());
    ctx.vida.escuchar(ctx.$varBarra, "click", (ev) => { const v = ev.target.closest(".variante:not(:disabled)"); if (v) ctx.elegirVarianteBarra(v); });
    return ctx.$varBarra;
  };
  ctx.abrirVariantesBarra = function(b) {
    ctx.menuBarra();
    const id = ctx.idBoton(b), lista = [id, ...ctx.VARIANTES_BARRA[id]], quieto = ctx.$codigo.readOnly;
    ctx.$varBarra.innerHTML = lista.map((v, j) => `<button type="button" class="variante${j ? "" : " principal"}" role="menuitem" data-v="${v}" style="--c1:${ctx.LUZ[v]}"`
      + ` data-tip="${ctx.esc(v === "seleccion" ? ctx.tituloDe(v) : ctx.textoAccion(v))}"${quieto && !["seleccion", "copiar", "ampliar", "reducir"].includes(v) ? " disabled" : ""}>${ctx.svg(ctx.ICONOS[v])}<span>${ctx.esc(ctx.tituloDe(v))}</span></button>`).join("");
    ctx.$varBarra.hidden = false;
    // El aviso y el nombre del botón (tooltip del toque) taparían las placas.
    ctx.$toast.hidden = true;
    for (const t of document.querySelectorAll(".tip")) /** @type {HTMLElement} */ (t).hidden = true;
    const r = b.getBoundingClientRect(), m = ctx.$varBarra.getBoundingClientRect();
    let y = r.top - m.height - 8;
    if (y < 6) y = r.bottom + 8;
    const x = Math.max(6, Math.min(innerWidth - m.width - 6, r.left + r.width / 2 - m.width / 2));
    ctx.$varBarra.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    b.classList.add("abierto");
    if (navigator.vibrate) navigator.vibrate(12);
  };
  ctx.cerrarVariantesBarra = function() {
    if (!ctx.$varBarra || ctx.$varBarra.hidden) return;
    ctx.$varBarra.hidden = true; ctx.$varBarra.innerHTML = "";
    ctx.$barra.querySelectorAll(".abierto").forEach(x => x.classList.remove("abierto"));
  };
  ctx.elegirVarianteBarra = function(v) { ctx.cerrarVariantesBarra(); ctx.ejecutarAccion(v.dataset.v); };
  ctx.pintarTextoBarra = function() {
    for (const b of ctx.$barra.querySelectorAll("[data-accion]")) {
      const texto = ctx.textoAccion(b.dataset.accion);
      b.setAttribute("aria-label", texto);
      b.dataset.tip = texto;
    }
    const seleccion = ctx.$barra.querySelector("[data-seleccion]");
    if (seleccion) {
      seleccion.setAttribute("aria-label", ctx.textoI18n(ctx.seleccionando ? "editor.aria.seleccion.encendida" : "editor.aria.seleccion.apagada"));
      seleccion.dataset.tip = ctx.textoI18n("editor.tip.seleccion");
      seleccion.dataset.tipCod = ctx.textoI18n("editor.tip.seleccion.codigo");
    }
    const mouse = ctx.$barra.querySelector("[data-protomouse]");
    if (mouse) mouse.setAttribute("aria-label", ctx.textoI18n("editor.aria.protomouse"));
    for (const b of ctx.ambito.querySelectorAll(".b-teclado")) {
      b.setAttribute("aria-label", ctx.textoI18n(ctx.activo ? "editor.teclado.activo.aria" : "editor.teclado.inactivo.aria"));
      b.dataset.tip = ctx.textoI18n(ctx.activo ? "editor.teclado.activo.tip" : "editor.teclado.inactivo.tip");
    }
    for (const b of ctx.$barra.querySelectorAll("button.con-variantes")) if (b.hasAttribute("aria-description"))
      b.setAttribute("aria-description", ctx.textoI18n("editor.aria.mantener_variantes"));
    if (ctx.$varBarra) for (const b of ctx.$varBarra.querySelectorAll("[data-v]")) {
      const id = b.dataset.v;
      b.dataset.tip = id === "seleccion" ? ctx.tituloDe(id) : ctx.textoAccion(id);
      const nombre = b.querySelector("span");
      if (nombre) {
        if (nombre.firstChild) nombre.firstChild.nodeValue = ctx.tituloDe(id);
        else nombre.append(document.createTextNode(ctx.tituloDe(id)));
      }
    }
  };
  ctx.pintarBarra = function() {
    ctx.pintarTextoBarra();
    for (const b of ctx.ambito.querySelectorAll(".b-teclado")) {
      b.setAttribute("aria-pressed", String(ctx.activo));
      b.setAttribute("aria-keyshortcuts", "Control+Alt+A");
      b.dataset.tipCod = "Ctrl+Alt+A";
    }
    const quieto = ctx.$codigo.readOnly;
    for (const b of ctx.$barra.querySelectorAll("[data-accion]")) {
      const id = b.dataset.accion;
      b.disabled = id === "deshacer" ? quieto || !ctx.hist.pasado.length : id === "rehacer" ? quieto || !ctx.hist.futuro.length : quieto && !["teclado", "copiar", "ampliar", "reducir"].includes(id);
    }
    ctx.pintarInterruptor();
    const movil = ctx.disposicionMovil();
    for (const b of ctx.$barra.querySelectorAll("button.con-variantes")) {
      if (movil) { b.setAttribute("aria-haspopup", "menu"); b.setAttribute("aria-description", ctx.textoI18n("editor.aria.mantener_variantes")); }
      else { b.removeAttribute("aria-haspopup"); b.removeAttribute("aria-description"); }
    }
  };
  ctx.toast = function(texto) {
    if (dependencias.presentacion) dependencias.presentacion.rotular(ctx.$toast, texto); else ctx.$toast.textContent = texto; ctx.$toast.hidden = false;
    const r = (ctx.$barra.getClientRects().length ? ctx.$barra : ctx.$editor).getBoundingClientRect();
    // Con la barra al pie de la pantalla (teléfono), el aviso sale encima de ella.
    const y = r.bottom > innerHeight * .55 ? r.top - ctx.$toast.offsetHeight - 6 : r.bottom + 6;
    ctx.$toast.style.transform = `translate(${Math.round(Math.max(6, Math.min(innerWidth - ctx.$toast.offsetWidth - 6, r.left + r.width / 2 - ctx.$toast.offsetWidth / 2)))}px, ${Math.round(Math.max(6, y))}px)`;
    ctx.vida.clearTimeout(ctx.tToast);
    ctx.tToast = ctx.vida.setTimeout(() => { ctx.$toast.hidden = true; }, 1500);
  };
  return function iniciar() {


  // ---------- Barra de edición ----------
  (ctx.ICONOS = {
    teclado: '<rect x="2.5" y="6" width="19" height="12.5" rx="2.2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 13.6h.01M17 13.6h.01M9.5 14.6h5"/><path class="tachado" d="M3.6 3.4l16.8 17.2"/>',
    deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    rehacer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    cortar: '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8 16.2L18.5 4M16 16.2L5.5 4"/>',
    copiar: '<rect x="8.5" y="8.5" width="11.5" height="12.5" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2V15a2 2 0 0 0 2 2h3"/>',
    pegar: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="9" y="2.5" width="6" height="4" rx="1"/><path d="M9 12h6M9 15.5h4"/>',
    borrar: '<path d="M8.5 5H20a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H8.5L2.5 12z"/><path d="M11.5 9.5l5 5M16.5 9.5l-5 5"/>',
    ampliar: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><rect x="9" y="9.5" width="6" height="5" rx="1"/>',
    reducir: '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/>',
    duplicar: '<rect x="3.5" y="3.5" width="11.5" height="11.5" rx="2"/><path d="M19 8.5h.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H10a1.5 1.5 0 0 1-1.5-1.5V19"/><path d="M9.25 6.5v5M6.75 9h5"/>',
    subir: '<path d="M12 19.5V5M6 11l6-6 6 6"/>',
    bajar: '<path d="M12 4.5V19M6 13l6 6 6-6"/>',
    desenvolver: '<path d="M8 4H7a2 2 0 0 0-2 2v3.5L3 12l2 2.5V18a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v3.5l2 2.5-2 2.5V18a2 2 0 0 1-2 2h-1" stroke-dasharray="2.6 2.4"/><path d="M9.5 12h5"/>',
    linea: '<path d="M19.5 5v6.5a3 3 0 0 1-3 3H6"/><path d="M10 10.5l-4 4 4 4"/>',
    // Teléfono: interruptor de selección (un tramo resaltado con el cursor de texto) y ProtoMouse.
    seleccion: '<rect x="2.5" y="8.2" width="12.5" height="7.6" rx="1.4" fill="currentColor" fill-opacity=".3" stroke="none"/><path d="M15.5 4.5v15M13 4.5h5M13 19.5h5"/><path d="M2.5 8.2h12.5M2.5 15.8h12.5" stroke-dasharray="1.6 2"/>',
    mouse: '<rect x="7.5" y="3.5" width="9" height="15.5" rx="4.5"/><path d="M12 3.5v5.2M7.5 8.7h9"/><path d="M3.6 11.2l-1.8 1.8 1.8 1.8M20.4 11.2l1.8 1.8-1.8 1.8" stroke-width="1.6"/>',
    sangrar: '<path d="M3 4.5h18M11 9.5h10M11 14.5h10M3 19.5h18"/><path d="M3.5 9l3.5 3-3.5 3"/>',
    desangrar: '<path d="M3 4.5h18M11 9.5h10M11 14.5h10M3 19.5h18"/><path d="M7 9l-3.5 3L7 15"/>',
  });
  (ctx.svg = (c) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${c}</svg>`);
  (ctx.ACCIONES = {
    teclado: { t: "Modo sin teclado", fn: () => ctx.activar(!ctx.activo, true) },
    deshacer: { t: "Deshacer", fn: ctx.deshacer }, rehacer: { t: "Rehacer", fn: ctx.rehacer },
    cortar: { t: "Cortar", fn: () => ctx.copiar(true) }, copiar: { t: "Copiar", fn: () => ctx.copiar(false) }, pegar: { t: "Pegar", fn: ctx.pegar }, borrar: { t: "Borrar", fn: ctx.borrar },
    ampliar: { t: "Ampliar selección", fn: ctx.ampliar }, reducir: { t: "Reducir selección", fn: ctx.reducir },
    duplicar: { t: "Duplicar", fn: ctx.duplicar }, subir: { t: "Subir línea", fn: () => ctx.moverLineas(-1) }, bajar: { t: "Bajar línea", fn: () => ctx.moverLineas(1) }, linea: { t: "Línea nueva", fn: ctx.lineaNueva },
    desenvolver: { t: "Desenvolver: quita el if/while que lo rodea", fn: ctx.desenvolver },
  });
  // Grupos de la barra: el orden de grupos y de botones se cambia en Ajustes y se guarda por dispositivo.
  (ctx.GRUPOS_BASE = [["teclado"], ["deshacer", "rehacer"], ["cortar", "copiar", "pegar", "borrar"], ["ampliar", "reducir"], ["duplicar", "subir", "bajar", "linea", "desenvolver"]]);
  (ctx.grupos = ctx.validarGrupos(ctx.leer("barra", ctx.GRUPOS_BASE)));
  // Teléfono (juego): la barra muestra seis botones alrededor del ProtoMouse (deshacer · rehacer · selección |
  // ProtoMouse | cortar · copiar · pegar). Lo demás sigue a mano manteniendo pulsado su pariente: las mismas
  // placas metálicas que las variantes de la paleta. El CSS decide qué disposición se ve; el marcado es uno.
  (ctx.VARIANTES_BARRA = { seleccion: ["ampliar", "reducir", "subir", "bajar"], cortar: ["borrar", "desenvolver"], copiar: ["duplicar"], pegar: ["linea", "sangrar", "desangrar"] });
  (ctx.LUZ = { seleccion: "#7FA3FF", ampliar: "#63D2E0", reducir: "#63D2E0", subir: "#5FC28A", bajar: "#5FC28A", cortar: "#F2C14E", borrar: "#F07A70",
    desenvolver: "#CFA2FF", copiar: "#9CC8FF", duplicar: "#9CC8FF", pegar: "#B4EE4D", linea: "#B7C2CC", sangrar: "#B7C2CC", desangrar: "#B7C2CC" });
  // Acciones que solo existen como placas del teléfono (no entran en la barra de PC ni en su orden).
  (ctx.EXTRA = { sangrar: { t: "Sangrar: un nivel más", fn: () => ctx.sangrar(1) }, desangrar: { t: "Quitar un nivel de sangría", fn: () => ctx.sangrar(-1) } });
  (ctx.accionDe = (id) => ctx.EXTRA[id] || ctx.ACCIONES[id]);
  (ctx.TRADUCCIONES_ES = {
    "editor.accion.teclado": "Modo sin teclado", "editor.accion.deshacer": "Deshacer", "editor.accion.rehacer": "Rehacer",
    "editor.accion.cortar": "Cortar", "editor.accion.copiar": "Copiar", "editor.accion.pegar": "Pegar", "editor.accion.borrar": "Borrar",
    "editor.accion.ampliar": "Ampliar selección", "editor.accion.reducir": "Reducir selección", "editor.accion.duplicar": "Duplicar",
    "editor.accion.subir": "Subir línea", "editor.accion.bajar": "Bajar línea", "editor.accion.linea": "Línea nueva",
    "editor.accion.desenvolver": "Desenvolver: quita el if/while que lo rodea", "editor.accion.sangrar": "Sangrar: un nivel más",
    "editor.accion.desangrar": "Quitar un nivel de sangría",
    "editor.etiqueta.seleccion": "Selección", "editor.etiqueta.ampliar": "Ampliar", "editor.etiqueta.reducir": "Reducir",
    "editor.etiqueta.cortar": "Cortar", "editor.etiqueta.copiar": "Copiar", "editor.etiqueta.pegar": "Pegar", "editor.etiqueta.borrar": "Borrar",
    "editor.etiqueta.duplicar": "Duplicar", "editor.etiqueta.subir": "Subir línea", "editor.etiqueta.bajar": "Bajar línea", "editor.etiqueta.desenvolver": "Desenvolver",
    "editor.etiqueta.linea": "Línea nueva", "editor.etiqueta.sangrar": "Sangrar", "editor.etiqueta.desangrar": "Quitar sangría",
    "editor.aria.seleccion.encendida": "Selección: encendida, el ProtoMouse amplía lo elegido",
    "editor.aria.seleccion.apagada": "Selección: apagada, el ProtoMouse mueve el cursor",
    "editor.tip.seleccion": "Selección", "editor.tip.seleccion.codigo": "enciende y arrastra",
    "editor.aria.protomouse": "ProtoMouse: mantén el dedo y arrastra para mover el cursor",
    "editor.aria.mantener_variantes": "Mantén pulsado para más acciones",
    "editor.toast.seleccion.encendida": "Selección encendida: arrastra el ProtoMouse para ampliarla",
    "editor.toast.protomouse.mover_cursor": "Mantén el dedo en el ProtoMouse y arrastra para mover el cursor",
    "editor.teclado.activo.aria": "Modo sin teclado activo: toca para escribir con teclado (Ctrl+Alt+A)",
    "editor.teclado.inactivo.aria": "Modo sin teclado (Ctrl+Alt+A)",
    "editor.teclado.activo.tip": "Volver al teclado", "editor.teclado.inactivo.tip": "Modo sin teclado",
  });
  (ctx.textoAccion = (id) => ctx.textoI18n(`editor.accion.${id}`));
  // Etiquetas cortas para las placas (el nombre completo sigue en el tooltip y en aria-label).
  (ctx.tituloDe = (id) => ctx.textoI18n(`editor.etiqueta.${id}`));
  // La esquina marcada y el aviso de «mantén para más» solo valen donde hay variantes (pintarBarra los ajusta).
  (ctx.botonBarra = (id) => `<button type="button" data-accion="${id}" aria-label="${ctx.esc(ctx.textoAccion(id))}" data-tip="${ctx.esc(ctx.textoAccion(id))}"${id === "teclado" ? ` class="b-teclado" aria-pressed="false"` : ctx.VARIANTES_BARRA[id] ? ` class="con-variantes"` : ""}>${ctx.svg(ctx.ICONOS[id])}</button>`);
  ctx.$("b-teclado").innerHTML = ctx.svg(ctx.ICONOS.teclado);
  // pointerdown sin foco: con teclado, el textarea lo conserva y el teclado del teléfono no se cierra.
  ctx.vida.escuchar(ctx.$barra, "pointerdown", (ev) => { if (ev.target.closest("button, .protomouse")) ev.preventDefault(); });
  ctx.vida.escuchar(ctx.$barra, "click", (ev) => {
    if (ctx.suprimirClicBarra) { ctx.suprimirClicBarra = false; return; }
    const b = ev.target.closest("[data-accion], [data-seleccion]");
    if (!b || b.disabled) return;
    ctx.cerrarVariantesBarra();
    ctx.ejecutarAccion(b.dataset.seleccion != null ? "seleccion" : b.dataset.accion);
  });

  // ---------- Selección del teléfono ----------
  // Un interruptor con luz: apagado, el ProtoMouse mueve el cursor; encendido, amplía lo elegido desde su
  // extremo fijo. Se apaga al cambiar el texto y al usar las demás acciones (cortar, copiar, pegar…).
  (ctx.seleccionando = false), (ctx.avisoSeleccion = false);
  ctx.vida.escuchar(ctx.$codigo, "input", ctx.apagarSeleccion);

  // Variantes de la barra: mantener pulsado ~0,45 s (o clic derecho) despliega placas metálicas encima del
  // botón, como en la paleta. Se puede soltar el dedo sobre una o tocarla después; desplazar cancela.
  // El menú se crea la primera vez que hace falta: en PC y en la demo no existe.
  (ctx.$varBarra = null);
  (ctx.disposicionMovil = () => { const z = ctx.$barra.querySelector(".protomouse"); return !!z && z.getClientRects().length > 0; });
  (ctx.idBoton = (b) => b.dataset.seleccion != null ? "seleccion" : b.dataset.accion);
  (ctx.pulsoBarra = null), (ctx.suprimirClicBarra = false);
  (ctx.varianteBarraEn = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest && el.closest(".variantes-ed .variante:not(:disabled)"); });
  ctx.vida.escuchar(ctx.$barra, "pointerdown", (ev) => {
    ctx.suprimirClicBarra = false;
    const b = ev.target.closest("button.con-variantes");
    if (!b || ev.button > 0 || !ctx.disposicionMovil()) return;
    ctx.pulsoBarra = { b, id: ev.pointerId, x: ev.clientX, y: ev.clientY, abierto: false };
    ctx.pulsoBarra.t = ctx.vida.setTimeout(() => { if (ctx.pulsoBarra) { ctx.pulsoBarra.abierto = true; ctx.abrirVariantesBarra(b); } }, 450);
  });
  ctx.vida.escuchar(document, "pointermove", (ev) => {
    if (!ctx.pulsoBarra || ev.pointerId !== ctx.pulsoBarra.id) return;
    if (!ctx.pulsoBarra.abierto) { if (Math.hypot(ev.clientX - ctx.pulsoBarra.x, ev.clientY - ctx.pulsoBarra.y) > 12) { ctx.vida.clearTimeout(ctx.pulsoBarra.t); ctx.pulsoBarra = null; } return; }
    const v = ctx.varianteBarraEn(ev.clientX, ev.clientY);
    ctx.$varBarra.querySelectorAll(".variante").forEach(x => x.classList.toggle("activa", x === v));
  });
  (ctx.soltarPulsoBarra = (ev) => {
    if (!ctx.pulsoBarra || ev.pointerId !== ctx.pulsoBarra.id) return;
    ctx.vida.clearTimeout(ctx.pulsoBarra.t);
    if (ctx.pulsoBarra.abierto) {
      ctx.suprimirClicBarra = true;
      const v = ev.type === "pointerup" && ctx.varianteBarraEn(ev.clientX, ev.clientY);
      if (v) ctx.elegirVarianteBarra(v);
    }
    ctx.pulsoBarra = null;
  });
  ctx.vida.escuchar(document, "pointerup", ctx.soltarPulsoBarra);
  ctx.vida.escuchar(document, "pointercancel", ctx.soltarPulsoBarra);
  // Android también dispara «contextmenu» al mantener el dedo: aquí manda el temporizador.
  ctx.vida.escuchar(ctx.$barra, "contextmenu", (ev) => {
    const b = ev.target.closest("button.con-variantes");
    if (!b || !ctx.disposicionMovil()) return;
    ev.preventDefault();
    if (ctx.pulsoBarra) { if (!ctx.pulsoBarra.abierto) { ctx.vida.clearTimeout(ctx.pulsoBarra.t); ctx.pulsoBarra.abierto = true; ctx.abrirVariantesBarra(b); } return; }
    ctx.abrirVariantesBarra(b);
  });
  ctx.vida.escuchar(document, "pointerdown", (ev) => { if (ctx.$varBarra && !ctx.$varBarra.hidden && !ev.target.closest(".variantes-ed, .barra-edicion .abierto")) ctx.cerrarVariantesBarra(); }, true);
  ctx.vida.escuchar(document, "keydown", (ev) => { if (ev.key === "Escape") ctx.cerrarVariantesBarra(); });
  ctx.vida.escuchar(window, "cmg:idioma", ctx.pintarTextoBarra);
  // La disposición la decide el CSS según la forma: al cambiar, se revisan los avisos de las variantes.
  ctx.vida.escuchar(ctx.app, "cmg:forma", () => ctx.vida.requestAnimationFrame(ctx.pintarBarra));
  (ctx.$toast = document.createElement("div"));
  ctx.$toast.className = "toast-edicion"; ctx.$toast.hidden = true; ctx.$toast.setAttribute("role", "status");
  ctx.vida.portal(ctx.$toast);
  (ctx.tToast = 0);
  };
}
