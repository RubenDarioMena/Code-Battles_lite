/* Campaign · interfaz de escritorio (feedback «War actual vs prototipo», nov. 2026).
 *
 * Mapa: sin barra superior. Arriba a la derecha, misión (!), revisar y ajustes; debajo, las metas numéricas en
 * columna con su pieza y los recursos. Vista 3D / 2D en el centro. Ficha compacta abajo a la izquierda al elegir una
 * unidad; mantenerla pulsada abre la ficha completa en el panel del código. Máquinas sustituye a Checkpoint.
 * Código: selector de unidades (árbol con casillas), pestañas con «+» (biblioteca), modo sin teclado y menú ⋯ con
 * las pantallas que ocupan el sitio del código (misión, máquinas, historial, guardado, biblioteca…).
 * Panel inferior: Objetivo, Specs y Consola.
 *
 * En el teléfono no cambia nada de esto (se queda la interfaz de War): todo lo nuevo se oculta por CSS y el menú ⋯
 * conserva sus entradas. Solo lee el mundo; las órdenes y el guardado pasan por juego.js (ctx). */
(() => {
  "use strict";
  const SVG = (cuerpo, extra = "") => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"${extra}>${cuerpo}</svg>`;
  const ICO = {
    mision: '<path d="M12 3.5l9 16H3z"/><path d="M12 9.5v4.6"/><path d="M12 17.2v.1" stroke-width="2.6"/>',
    maquinas: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    investigar: '<path d="M9.5 3.5h5M10.5 3.5v5.2L5.2 18a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3l-5.3-9.3V3.5"/><path d="M7.6 14.5h8.8"/>',
    mundo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.3 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.3-3.8-8.5s1.2-6.1 3.8-8.5z"/>',
    guardar: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    carpeta: '<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.3l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v9.3a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    vida: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z"/><path d="M7.5 12h2.3l1.4-2.4 1.8 4.3 1.3-1.9h2.2"/>',
    volver: '<path d="M14.5 6l-6 6 6 6"/>',
    cerrar: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    expandir: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    centrar: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    editar: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16z"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    flecha: '<path d="M9.5 6l6 6-6 6"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    girar: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.2h-4.2"/>',
    candado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    abierto: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    rayo: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    moneda: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9a3.3 3.3 0 1 0 0 6"/><path d="M12 6.5v2M12 15.5v2"/>',
    pista: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-.7c0-.8.4-1.5 1-2A6 6 0 0 0 12 3.5z"/>',
    papelera: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  };
  // Siluetas de las piezas: las mismas formas que el mapa, en color.
  const PIEZA_SVG = {
    steel: '<rect x="4" y="7" width="16" height="3" rx=".7" fill="#A9BCCF"/><rect x="4" y="11.2" width="16" height="3" rx=".7" fill="#8CA0B5"/><rect x="4" y="15.4" width="16" height="3" rx=".7" fill="#71859A"/>',
    polymer: '<path d="M7 9.5c0-2.5 2.2-4 5-4s5 1.5 5 4l1 8.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="#B98CFF"/><path d="M9 6.5h6" stroke="#3B2A5C" stroke-width="1.4"/>',
    nose: '<path d="M12 3c3.4 3.8 5.2 8 5.2 13H6.8C6.8 11 8.6 6.8 12 3z" fill="#F2B84B"/><rect x="6.5" y="16.5" width="11" height="3.5" rx="1" fill="#C98C2A"/>',
    base: '<rect x="9" y="4" width="6" height="13" rx="1.2" fill="#6FD3A8"/><path d="M9 11l-4.5 7H9zM15 11l4.5 7H15z" fill="#3FA77C"/><rect x="8.5" y="17" width="7" height="3" rx=".8" fill="#2E7D5D"/>',
    charge: '<rect x="7" y="5" width="10" height="15" rx="2.2" fill="#FF8A65"/><rect x="7" y="10" width="10" height="3" fill="#C9583A"/><rect x="9.5" y="3" width="5" height="2.5" rx=".8" fill="#C9583A"/>',
    motor: '<rect x="6" y="5" width="12" height="10" rx="2" fill="#7FA3FF"/><path d="M8 15h8l1.5 5h-11z" fill="#4E6FC2"/><path d="M9 9h6" stroke="#2B3F73" stroke-width="1.4"/>',
    missile: '<path d="M12 2.5c2 2 3 4.4 3 7V17H9V9.5c0-2.6 1-5 3-7z" fill="#FF5D6C"/><path d="M9 13l-3 4.5V20l3-1.5zM15 13l3 4.5V20l-3-1.5z" fill="#B83242"/><path d="M10.5 17h3l-.6 4h-1.8z" fill="#F2B84B"/>',
  };
  const COLOR = { montacargas: "#C8E65A", obrero: "#C8E65A", prensa: "#A887FF", moldeadora: "#A887FF", mezcladora: "#A887FF", ensambladora: "#A887FF",
    banda: "#63D2E0", control: "#7FA3FF", bahia: "#E0AE4A", lugar: "#E0AE4A", pad: "#8FA0AE", pila: "#8FA0AE", arsenal: "#FF8A65", torreta: "#FF5D6C" };
  // Dibujo 2D de cada clase: las máquinas tienen su lámina SVG y los robots su render.
  const IMG = { prensa: "img/campaign/maquinas/svg/prensa.svg", moldeadora: "img/campaign/maquinas/svg/moldeadora.svg", mezcladora: "img/campaign/maquinas/svg/mezcladora.svg",
    ensambladora: "img/campaign/maquinas/svg/ensambladora.svg", montacargas: "img/campaign/robots/frk-01-armado.png", obrero: "img/campaign/robots/bot-01-cargando.png" };
  const ORDEN_CLASES = ["montacargas", "obrero", "prensa", "moldeadora", "mezcladora", "ensambladora", "banda", "control"];
  const MOVIBLES = new Set(["prensa", "moldeadora", "mezcladora"]);
  const RE_UNIDAD = /\b(?:FRK|BOT|PRS|MLD|MIX|ASM|BLT|CTL|BAY|SUP|LOT|PAD|STK|DEP|LAU)-\d+\b/g;
  const RE_CANTIDAD = /\b(\d+)(\s+(?:láminas?|ojivas?|bases?|cargas?|misiles?|motores?|tarimas?|nose cones?|charges?|missiles?|motors?|pallets?|steel sheets?|sheets?))\b/gi;

  function crear(ctx) {
    const { esc, t, uiC } = ctx;
    const C = window.CAMPAIGN;
    const $ = (id) => document.getElementById(id);
    const app = $("app"), campo = $("campo"), zonaCod = $("zona-codigo");
    const M = () => ctx.mundo, D = () => ctx.def;
    const movil = () => app.dataset.forma === "movil";
    const s = (ico, extra) => SVG(ICO[ico], extra);
    const pieza = p => `<svg class="pieza" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PIEZA_SVG[p] || ""}</svg>`;
    const color = e => COLOR[e.clase] || "#B7C2CC";
    const clase = e => uiC.clase(e);
    const programable = id => Object.hasOwn(D().inicial, id);
    const nodo = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
    const dibujo = (e, cls = "dibujo") => IMG[e.clase] ? `<img class="${cls}" src="${IMG[e.clase]}" alt="" draggable="false">` : `<span class="${cls} gen" style="--c:${color(e)}">${esc(e.id.split("-")[0])}</span>`;

    // ---------- Texto rico: unidades con su color y cantidades destacadas ----------
    function rico(texto) {
      const m = M();
      return esc(texto).replace(RE_UNIDAD, id => {
        const e = m && m.porId[id];
        return e ? `<span class="rico-u" data-u="${id}" tabindex="0" style="--c:${color(e)}">${id}</span>` : id;
      }).replace(RE_CANTIDAD, (_, n, resto) => `<b class="rico-n">${n}${resto}</b>`);
    }
    // Tarjeta al pasar el cursor (o mantener el dedo) sobre una unidad del texto.
    const $tipU = nodo(`<div class="cmp-tip-u" role="tooltip" hidden></div>`);
    document.body.append($tipU);
    let tipDe = null, tTip = 0;
    function mostrarTipU(el) {
      const e = M() && M().porId[el.dataset.u]; if (!e) return;
      tipDe = el;
      const [cls, txt] = uiC.estado(e);
      $tipU.innerHTML = `${dibujo(e)}<div><b style="color:${color(e)}">${esc(e.id)}</b> <small>${esc(clase(e))}</small><span class="estado ${cls}">${esc(txt)}</span></div>`;
      $tipU.hidden = false;
      const r = el.getBoundingClientRect(), w = $tipU.offsetWidth, h = $tipU.offsetHeight;
      const x = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2));
      const y = r.top - h - 8 < 6 ? r.bottom + 8 : r.top - h - 8;
      $tipU.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
    const ocultarTipU = () => { tipDe = null; $tipU.hidden = true; };
    document.addEventListener("pointerover", (ev) => { const el = ev.target.closest && ev.target.closest(".rico-u"); if (el && ev.pointerType === "mouse") mostrarTipU(el); });
    document.addEventListener("pointerout", (ev) => { if (tipDe && ev.target.closest && ev.target.closest(".rico-u") === tipDe && !tipDe.contains(ev.relatedTarget)) ocultarTipU(); });
    document.addEventListener("pointerdown", (ev) => {
      const el = ev.target.closest && ev.target.closest(".rico-u");
      clearTimeout(tTip);
      if (!el) { ocultarTipU(); return; }
      if (ev.pointerType !== "mouse") tTip = setTimeout(() => mostrarTipU(el), 350);
    });
    document.addEventListener("focusin", (ev) => { if (ev.target.classList && ev.target.classList.contains("rico-u")) mostrarTipU(ev.target); });
    document.addEventListener("focusout", (ev) => { if (ev.target === tipDe) ocultarTipU(); });
    // Clic en una unidad del texto: la elige en el mapa.
    document.addEventListener("click", (ev) => {
      const el = ev.target.closest && ev.target.closest(".rico-u"); if (!el) return;
      ctx.seleccionar([el.dataset.u], { inspeccionar: false }); ctx.abarcar([el.dataset.u]);
    });

    // ---------- Esquina del mapa: vida (batalla), misión, revisar y ajustes ----------
    const $esquina = nodo(`<div class="cmp-esquina" id="cmp-esquina">
      <button type="button" class="cmp-redondo" id="cmp-b-vida" hidden>${s("vida")}</button>
      <button type="button" class="cmp-redondo" id="cmp-b-mision" aria-haspopup="dialog" aria-expanded="false" aria-controls="cmp-pop">${s("mision")}<i class="nuevo" aria-hidden="true"></i></button>
    </div>`);
    const $recursos = nodo(`<div class="cmp-recursos" id="cmp-recursos" aria-live="off"></div>`);
    const $pop = nodo(`<div class="cmp-pop marco" id="cmp-pop" role="dialog" hidden></div>`);
    const $popVida = nodo(`<div class="cmp-pop cmp-pop-vida marco" id="cmp-pop-vida" role="dialog" hidden></div>`);
    const $mini = nodo(`<div class="cmp-mini marco" id="cmp-mini" hidden></div>`);
    const $marcas = nodo(`<div class="cmp-marcas" aria-hidden="true"></div>`);
    campo.append($esquina, $recursos, $pop, $popVida, $mini, $marcas);
    const bMision = $("cmp-b-mision"), bVida = $("cmp-b-vida");
    // Revisar y Ajustes viven en la cabecera del mapa en el teléfono y en la esquina en el escritorio.
    const $cabeza = document.querySelector("#zona-mapa .cabeza");
    function colocarBotones() {
      const destino = movil() ? $cabeza : $esquina;
      for (const id of ["b-revisar", "b-ajustes"]) { const b = $(id); if (b && b.parentElement !== destino) destino.append(b); }
    }

    // ---------- Misión: ventana mínima y pantalla completa ----------
    const CLAVE_VISTA = "campaign-hito-visto";
    const hitoN = () => M() ? (M().completado ? D().hitos.length : M().hito) : 0;
    const textoHito = (n, campo_) => t(`campaign.hito.${n}.${campo_}`);
    function metasHTML(compacto = false) {
      const m = M(); if (!m) return "";
      return C.metas(m).map(x => {
        const nombre = x.tipo === "en" ? t("campaign.meta.en", { pieza: uiC.pieza(x.pieza), lugar: x.lugar }) : x.tipo === "lotes" ? t("campaign.meta.lotes", { pieza: uiC.pieza(x.pieza) }) : t("campaign.meta.banda");
        const p = Math.min(1, x.valor / x.n);
        return `<li class="cmp-meta${x.cumplida ? " ok" : ""}"${compacto ? ` title="${esc(nombre)}"` : ""}>${pieza(x.pieza || "missile")}<span class="txt">${compacto ? "" : `<span class="nom">${rico(nombre)}</span>`}<b>${Math.min(x.valor, 999)}/${x.n}</b></span>${compacto ? "" : `<span class="barra"><i style="width:${Math.round(p * 100)}%"></i></span>`}</li>`;
      }).join("");
    }
    function pintarPop() {
      const m = M(); if (!m) return;
      const n = Math.min(m.hito, D().hitos.length - 1), h = D().hitos[n];
      const fin = m.completado;
      $pop.innerHTML = `<div class="cmp-pop-cab"><span class="placa">${esc(h.clave)}</span><b>${esc(fin ? t("campaign.banner.fin") : uiC.tituloHito(n))}</b>
          <button type="button" class="cmp-x" data-pop-cerrar aria-label="${esc(t("juego.accion.cerrar"))}">${s("cerrar")}</button></div>
        <p class="cmp-pop-obj">${rico(primeraFrase(fin ? t("campaign.hud.fin_corto") : textoHito(n, "objetivo")))}</p>
        ${fin ? "" : `<ul class="cmp-metas-lista">${metasHTML()}</ul>`}
        <div class="cmp-pop-pie"><button type="button" class="btn chico primario" data-ver-mision>${esc(t("campaign.hud.ver_mas"))} ${s("flecha")}</button></div>`;
    }
    const primeraFrase = (txt) => { const i = txt.search(/[.!?](\s|$)/); return i > 40 && i < txt.length - 1 ? txt.slice(0, i + 1) : txt; };
    function abrirPop(si = $pop.hidden) {
      if (si) { pintarPop(); abrirVida(false); guardarVisto(); }
      $pop.hidden = !si; bMision.setAttribute("aria-expanded", String(si));
    }
    function guardarVisto() { ctx.guardado.escribir(CLAVE_VISTA, hitoN()); bMision.classList.remove("con-nuevo"); }
    bMision.addEventListener("click", () => abrirPop());
    $pop.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-pop-cerrar]")) abrirPop(false);
      else if (ev.target.closest("[data-ver-mision]")) { abrirPop(false); abrirPantalla("mision"); }
    });

    // Vida de las unidades: solo en modo batalla. Ordenadas de menos a más vida.
    // El nivel 1 aún no tiene daño: todas están al 100 % hasta que lleguen los combates.
    function pintarVida() {
      const m = M(); if (!m) return;
      const lista = m.maquinas.filter(e => e.presente !== false && (C.esRobot(e) || C.esMaquina(e) || e.clase === "torreta" || e.clase === "control"))
        .map(e => ({ e, v: e.vidaMax ? Math.max(0, e.vida ?? e.vidaMax) / e.vidaMax : 1 })).sort((a, b) => a.v - b.v || a.e.id.localeCompare(b.e.id));
      $popVida.innerHTML = `<div class="cmp-pop-cab"><b>${esc(t("campaign.hud.vida"))}</b><button type="button" class="cmp-x" data-vida-cerrar aria-label="${esc(t("juego.accion.cerrar"))}">${s("cerrar")}</button></div>
        <ul class="cmp-vida-lista">${lista.map(({ e, v }) => `<li><button type="button" data-u-sel="${e.id}"><span class="id" style="color:${color(e)}">${esc(e.id)}</span><span class="barra${v < .35 ? " mal" : v < .7 ? " alerta" : ""}"><i style="width:${Math.round(v * 100)}%"></i></span><b>${Math.round(v * 100)} %</b></button></li>`).join("")}</ul>`;
    }
    function abrirVida(si = $popVida.hidden) { if (si) { pintarVida(); abrirPop(false); } $popVida.hidden = !si; bVida.setAttribute("aria-expanded", String(si)); }
    bVida.addEventListener("click", () => abrirVida());
    $popVida.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-vida-cerrar]")) return abrirVida(false);
      const b = ev.target.closest("[data-u-sel]"); if (b) { ctx.seleccionar([b.dataset.uSel], { inspeccionar: false }); ctx.abarcar([b.dataset.uSel]); }
    });
    function alPiel(batalla) { bVida.hidden = !batalla; if (!batalla) abrirVida(false); }

    // Metas numéricas y recursos: columna bajo los botones.
    let claveRecursos = "";
    function pintarRecursos() {
      const m = M(); if (!m) return;
      const e = m.energia, alerta = e.uso > e.max;
      const html = (m.completado ? "" : `<ul class="cmp-metas-col">${metasHTML(true)}</ul>`)
        + `<ul class="cmp-rec-col"><li title="${esc(t("campaign.hud.presupuesto", { gastado: m.gastado, ingresado: m.ingresado }))}">${s("moneda")}<b>${m.presupuesto}</b></li>`
        + `<li class="${alerta ? "mal" : ""}" title="${esc(t("campaign.hud.energia"))}">${s("rayo")}<b>${e.uso}/${e.max}</b></li>`
        + `<li title="${esc(t("campaign.hud.reloj"))}">${s("reloj")}<b>${ctx.coma(Math.floor(m.t))} s</b></li></ul>`;
      if (html !== claveRecursos) { claveRecursos = html; $recursos.innerHTML = html; }
    }

    // ---------- Ficha compacta (abajo a la izquierda del mapa) ----------
    let miniId = null, miniCerrada = null, mantenerMini = null;
    const PROPS_CLAVE = { obrero: ["cargo", "busy"], montacargas: ["cargo", "busy"], prensa: ["input", "output"], moldeadora: ["input", "output"], mezcladora: ["input", "output"], ensambladora: ["recipe", "output"],
      banda: ["items", "running"], control: ["power", "budget"], lugar: ["items", "free"], bahia: ["items", "pending"], pad: ["free"], arsenal: ["missiles"], torreta: ["missiles"] };
    const ORDENES_CLAVE = { obrero: ["pickUp", "deliver", "goTo"], montacargas: ["pickUp", "deliver", "goTo"], prensa: ["start", "stop", "light"], moldeadora: ["start", "stop", "light"], mezcladora: ["start", "stop", "light"],
      ensambladora: ["setRecipe", "start", "stop"], banda: ["start", "stop"], bahia: ["request"] };
    function pintarMini() {
      const sel = [...ctx.seleccionadas], m = M();
      const id = sel.length === 1 ? sel[0] : null, e = id && m && m.porId[id];
      if (movil() || !e || miniCerrada === id) { $mini.hidden = true; miniId = null; return; }
      miniId = id; $mini.hidden = false;
      const pre = id === ctx.progSel ? "" : `${ctx.varDe(id)}.`, snap = C.instantanea(m).u[id] || {};
      const props = (PROPS_CLAVE[e.clase] || []).map(p => {
        const v = p === "power" ? `${snap.power ? snap.power.used + "/" + snap.power.max : "—"}` : snap[p];
        return `<span class="cmp-prop">${ctx.tk("prop", `${pre}${p}`, `${pre}${p}`)}<span class="sep">=</span><span class="v" data-vivo="${id}:${p}">${esc(v === null || v === undefined ? "null" : String(v))}</span></span>`;
      }).join("");
      const ajeno = programable(id) && id !== ctx.progSel && !(M().hito >= C.HITO_MAESTRO && ctx.progSel === "CTL-01") ? t("campaign.ins.solo_propio", { unidad: id }) : null;
      const ARGS = { pickUp: "/* lugar */", deliver: "/* lugar */", goTo: "/* lugar */", light: '"red"', setRecipe: '"missile"', request: '"polymer"' };
      const ordenes = (ORDENES_CLAVE[e.clase] || []).map(o => {
        const espera = ["pickUp", "deliver", "goTo"].includes(o), ins = `${espera ? "await " : ""}${pre}${o}(${ARGS[o] || ""});`;
        return ctx.tk("fn", `${o}()`, ins, { ajeno: o === "request" ? null : ajeno });
      }).join("");
      const [cls, txt] = uiC.estado(e);
      $mini.style.setProperty("--c", color(e));
      $mini.innerHTML = `<div class="cmp-mini-cab"><i class="punto"></i><b>${esc(id)}</b><small>${esc(clase(e))}</small><span class="estado ${cls}" data-fm-estado>${esc(txt)}</span>
          <button type="button" class="cmp-x" data-mini-cerrar aria-label="${esc(t("juego.accion.cerrar"))}">${s("cerrar")}</button></div>
        ${props ? `<div class="cmp-mini-props">${props}</div>` : ""}${ordenes ? `<div class="cmp-mini-ord">${ordenes}</div>` : ""}
        <button type="button" class="cmp-mini-pie" data-mini-ficha><span>${esc(t("campaign.hud.mantener_ficha"))}</span>${s("expandir")}<i class="carga-mini"></i></button>`;
    }
    $mini.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-mini-cerrar]")) { miniCerrada = miniId; pintarMini(); return; }
      // El icono ⛶ abre la ficha completa con un clic; el resto del pie, manteniendo pulsado.
      if (ev.target.closest("[data-mini-ficha] svg")) abrirFicha(miniId);
    });
    $mini.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || ev.target.closest(".tk, .cmp-x, [data-mini-ficha] svg")) return;
      const id = miniId; if (!id) return;
      $mini.classList.add("cargando");
      mantenerMini = setTimeout(() => { $mini.classList.remove("cargando"); mantenerMini = null; abrirFicha(id); }, 600);
    });
    const soltarMini = () => { clearTimeout(mantenerMini); mantenerMini = null; $mini.classList.remove("cargando"); };
    for (const tipo of ["pointerup", "pointerleave", "pointercancel"]) $mini.addEventListener(tipo, soltarMini);

    // ---------- Botón Máquinas (donde estaba Checkpoint) ----------
    const $bMaq = nodo(`<button class="btn cmp-b-maquinas" id="b-maquinas" type="button">${s("maquinas")}<span class="txt"></span><span class="cuenta"></span></button>`);
    document.querySelector("#zona-mapa .controles").append($bMaq);
    $bMaq.addEventListener("click", () => abrirPantalla("maquinas"));

    // ---------- Cabecera del código: selector de unidades y pestañas con «+» ----------
    const $barraProg = document.querySelector(".barra-prog"), $progs = $("progs");
    const $bUnidades = nodo(`<button type="button" class="cmp-b-unidades" id="cmp-b-unidades" aria-haspopup="dialog" aria-expanded="false" aria-controls="cmp-arbol">${s("carpeta")}<span class="txt"></span><span class="chev" aria-hidden="true">▾</span></button>`);
    const $bMas = nodo(`<button type="button" class="cmp-b-mas" id="cmp-b-mas">${s("mas")}</button>`);
    const $arbol = nodo(`<div class="cmp-pop cmp-arbol marco" id="cmp-arbol" role="dialog" hidden></div>`);
    $barraProg.insertBefore($bUnidades, $progs); $barraProg.insertBefore($bMas, $progs);
    document.body.append($arbol);
    const abiertosArbol = new Set(ORDEN_CLASES);
    function unidadesProgramables() { const m = M(); return m ? m.maquinas.filter(e => programable(e.id)) : []; }
    function pintarBotonUnidades() {
      const sel = [...ctx.seleccionadas].filter(programable);
      $bUnidades.querySelector(".txt").textContent = sel.length > 1 ? t("campaign.hud.n_unidades", { n: sel.length }) : sel[0] || ctx.progSel || t("campaign.hud.unidades");
    }
    function pintarArbol() {
      const sel = new Set(ctx.seleccionadas), lista = unidadesProgramables();
      const grupos = ORDEN_CLASES.map(k => [k, lista.filter(e => e.clase === k)]).filter(([, l]) => l.length);
      const disponible = e => e.presente !== false && (e.encendida ?? true);
      $arbol.innerHTML = `<div class="cmp-pop-cab"><b>${esc(t("campaign.hud.unidades"))}</b><button type="button" class="btn chico" data-arbol-ninguna>${esc(t("campaign.hud.ninguna"))}</button>
          <button type="button" class="cmp-x" data-arbol-cerrar aria-label="${esc(t("juego.accion.cerrar"))}">${s("cerrar")}</button></div>
        <ul class="cmp-arbol-lista" role="tree">${grupos.map(([k, l]) => {
          const vivos = l.filter(disponible), marcados = vivos.filter(e => sel.has(e.id)).length, abierto = abiertosArbol.has(k);
          return `<li role="treeitem" aria-expanded="${abierto}"><div class="carpeta"><button type="button" class="giro" data-arbol-abrir="${k}" aria-label="${esc(t(abierto ? "campaign.hud.plegar" : "campaign.hud.desplegar"))}">${abierto ? "▾" : "▸"}</button>
              <label><input type="checkbox" data-arbol-grupo="${k}"${marcados && marcados === vivos.length ? " checked" : ""}${!vivos.length ? " disabled" : ""} data-mixto="${marcados > 0 && marcados < vivos.length}"> ${s("carpeta")} <span>${esc(t(`campaign.clase.${k}`))}</span> <small>${l.length}</small></label></div>
            ${abierto ? `<ul role="group">${l.map(e => { const [cls, txt] = uiC.estado(e), ok = disponible(e);
              return `<li role="treeitem"><label class="${ok ? "" : "apagada"}"><input type="checkbox" data-arbol-u="${e.id}"${sel.has(e.id) ? " checked" : ""}${ok ? "" : " disabled"}> <i class="punto" style="--c:${color(e)}"></i><b>${esc(e.id)}</b>
                <span class="estado ${cls}" data-mq-estado="${e.id}">${esc(ok ? txt : t("campaign.hud.desde", { hito: D().hitos[e.desde || 0].clave }))}</span></label></li>`; }).join("")}</ul>` : ""}</li>`;
        }).join("")}</ul><p class="nota">${esc(t("campaign.hud.arbol_nota"))}</p>`;
      for (const c of $arbol.querySelectorAll('[data-mixto="true"]')) c.indeterminate = true;
      colocarArbol();
    }
    function colocarArbol() {
      if ($arbol.hidden) return;
      const r = $bUnidades.getBoundingClientRect();
      $arbol.style.transform = `translate(${Math.round(Math.max(6, Math.min(innerWidth - $arbol.offsetWidth - 6, r.left)))}px, ${Math.round(r.bottom + 6)}px)`;
    }
    function abrirArbol(si = $arbol.hidden) {
      $arbol.hidden = !si; $bUnidades.setAttribute("aria-expanded", String(si));
      if (si) pintarArbol();
    }
    $bUnidades.addEventListener("click", () => abrirArbol());
    function marcar(ids) { ctx.seleccionar(ids, { inspeccionar: false }); if (ids.length) ctx.abarcar(ids); pintarArbol(); }
    $arbol.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-arbol-cerrar]")) return abrirArbol(false);
      if (ev.target.closest("[data-arbol-ninguna]")) return marcar([]);
      const g = ev.target.closest("[data-arbol-abrir]");
      if (g) { const k = g.dataset.arbolAbrir; if (abiertosArbol.has(k)) abiertosArbol.delete(k); else abiertosArbol.add(k); pintarArbol(); }
    });
    $arbol.addEventListener("change", (ev) => {
      const sel = new Set(ctx.seleccionadas), c = ev.target;
      if (c.dataset.arbolU) { if (c.checked) sel.add(c.dataset.arbolU); else sel.delete(c.dataset.arbolU); }
      else if (c.dataset.arbolGrupo) for (const e of unidadesProgramables().filter(e => e.clase === c.dataset.arbolGrupo && e.presente !== false && (e.encendida ?? true))) { if (c.checked) sel.add(e.id); else sel.delete(e.id); }
      marcar([...sel]);
    });
    $bMas.addEventListener("click", () => abrirPantalla("biblioteca"));
    document.addEventListener("pointerdown", (ev) => {
      if (!$arbol.hidden && !ev.target.closest("#cmp-arbol, #cmp-b-unidades")) abrirArbol(false);
      if (!$pop.hidden && !ev.target.closest("#cmp-pop, #cmp-b-mision")) abrirPop(false);
      if (!$popVida.hidden && !ev.target.closest("#cmp-pop-vida, #cmp-b-vida")) abrirVida(false);
    }, true);
    addEventListener("resize", colocarArbol);

    // ---------- Barra inferior del modo sin teclado: tipografía del código y modo ratón ----------
    // Repite la barra de símbolos del editor (#simbolos, oculta en el escritorio): se le delega el clic, así cada
    // signo se comporta igual (los pares rodean lo elegido) y cambia con el lenguaje del programa.
    const $tipografia = nodo(`<div class="cmp-tipografia" id="cmp-tipografia" role="toolbar"></div>`);
    $("area-programa").after($tipografia);
    function pintarTipografia() {
      const fuentes = [...document.querySelectorAll("#simbolos button[data-i]")].filter(b => b.dataset.i18nDescripcion !== "paleta.simbolo.ocultar_teclado");
      $tipografia.setAttribute("aria-label", t("campaign.hud.tipografia"));
      $tipografia.innerHTML = fuentes.map(b => `<button type="button" data-signo="${b.dataset.i}" aria-label="${esc(b.getAttribute("aria-label") || b.textContent)}"${b.dataset.tip ? ` data-tip="${esc(b.dataset.tip)}"` : ""}><code>${esc(b.textContent)}</code></button>`).join("");
    }
    new MutationObserver(pintarTipografia).observe($("simbolos"), { childList: true });
    $tipografia.addEventListener("pointerdown", (ev) => ev.preventDefault());
    $tipografia.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-signo]"); if (!b) return;
      const fuente = document.querySelector(`#simbolos button[data-i="${b.dataset.signo}"]`); if (fuente) fuente.click();
    });

    // ---------- Panel inferior: Objetivo · Specs · Consola ----------
    const $pieModos = document.querySelector("#pie .pie-modos");
    const $bObj = nodo(`<button type="button" data-pie-modo="objetivo" aria-pressed="false"></button>`);
    $pieModos.prepend($bObj);
    const $pieObj = nodo(`<div class="pie-obj" id="pie-obj"></div>`);
    $("pie-cuerpo").prepend($pieObj);
    let pistasVistas = 0;
    function pintarPieObj() {
      const m = M(); if (!m) return;
      const n = Math.min(m.hito, D().hitos.length - 1), h = D().hitos[n], pistas = uiC.pistas();
      pistasVistas = Math.min(pistas.length, ctx.guardado.leer(`campaign-pistas-h${n}`, 0) | 0);
      $pieObj.innerHTML = `<div class="cmp-obj"><div class="cmp-obj-txt"><h4><span class="placa">${esc(h.clave)}</span> ${esc(uiC.tituloHito(n))}</h4>
          <p>${rico(m.completado ? t("campaign.hud.fin_corto") : textoHito(n, "objetivo"))}</p><p class="nota">${esc(t("campaign.hud.aprendes"))} ${rico(textoHito(n, "leccion"))}</p>
          ${pistas.slice(0, pistasVistas).map((p, i) => `<p class="cmp-pista">${s("pista")} <span><b>${esc(t("campaign.hud.pista_n", { n: i + 1 }))}</b> ${rico(p)}</span></p>`).join("")}
          ${pistasVistas < pistas.length ? `<button type="button" class="btn chico" data-pista>${s("pista")} ${esc(t("campaign.hud.ver_pista", { n: pistasVistas + 1, total: pistas.length }))}</button>` : ""}</div>
        ${m.completado ? "" : `<ul class="cmp-metas-lista">${metasHTML()}</ul>`}</div>`;
    }
    function verPista() {
      const n = Math.min(M().hito, D().hitos.length - 1);
      ctx.guardado.escribir(`campaign-pistas-h${n}`, pistasVistas + 1);
      pintarPieObj(); if (pantalla === "mision") pintarMision();
    }
    $pieObj.addEventListener("click", (ev) => { if (ev.target.closest("[data-pista]")) verPista(); });

    // ---------- Pantallas en el sitio del código ----------
    let pantalla = "", fichaId = null, volverDe = "programa", detenerRetrato = null;
    const $titulo = nodo(`<div class="cmp-titulo-pantalla" id="cmp-titulo-pantalla" hidden><button type="button" class="cmp-volver" data-volver>${s("volver")}</button><h3></h3><span class="acc"></span></div>`);
    const $pant = nodo(`<section class="cmp-pantallas" id="cmp-pantallas" hidden></section>`);
    $("cabecera-editor").after($titulo, $pant);
    const vistas = {};
    for (const id of ["mision", "maquinas", "ficha", "guardado", "biblioteca", "investigacion", "mundo"]) {
      vistas[id] = nodo(`<div class="cmp-pantalla desliza" data-pantalla="${id}" hidden></div>`); $pant.append(vistas[id]);
    }
    const PESTANAS = ["programa", "registro", "ayuda", "escenario"];
    const TITULO = { mision: "campaign.pantalla.mision", maquinas: "campaign.pantalla.maquinas", guardado: "campaign.pantalla.guardado", biblioteca: "campaign.pantalla.biblioteca",
      investigacion: "campaign.pantalla.investigacion", mundo: "campaign.pantalla.mundo", registro: "campaign.pantalla.registro", ayuda: "campaign.pantalla.ordenes", escenario: "campaign.pantalla.historial" };
    function abrirPantalla(id) {
      if (movil() && !PESTANAS.includes(id)) { ctx.verPanel("codigo"); }
      ctx.verPanel("codigo");
      if (detenerRetrato) { detenerRetrato(); detenerRetrato = null; }
      if (PESTANAS.includes(id)) {
        pantalla = id === "programa" ? "" : id; zonaCod.dataset.cmpPantalla = id === "programa" ? "" : "pestana";
        $pant.hidden = true; ctx.abrirPestana(id);
      } else {
        if (id !== "ficha") volverDe = id;
        pantalla = id; zonaCod.dataset.cmpPantalla = id;
        ctx.abrirPestana("programa");
        $pant.hidden = false;
        for (const [k, v] of Object.entries(vistas)) v.hidden = k !== id;
        pintarPantalla();
        vistas[id].scrollTop = 0;
      }
      pintarTitulo();
    }
    function pintarTitulo() {
      const id = pantalla;
      $titulo.hidden = !id || movil();
      if (!id) return;
      const e = id === "ficha" && M() ? M().porId[fichaId] : null;
      $titulo.querySelector("h3").innerHTML = e ? `<i class="punto" style="--c:${color(e)}"></i>${esc(e.id)} <small>${esc(clase(e))}</small>` : esc(t(TITULO[id]));
      $titulo.querySelector("[data-volver]").setAttribute("aria-label", esc(t(id === "ficha" ? "campaign.hud.volver_maquinas" : "campaign.hud.volver_codigo")));
      $titulo.querySelector("[data-volver]").dataset.tip = t(id === "ficha" ? "campaign.hud.volver_maquinas" : "campaign.hud.volver_codigo");
      $titulo.querySelector(".acc").innerHTML = e ? `<button type="button" class="cmp-redondo chico" data-fi-centrar data-tip="${esc(t("juego.camara.recentrar"))}">${s("centrar")}</button>`
        + (programable(e.id) && (e.encendida ?? true) ? `<button type="button" class="btn chico" data-fi-programa>${s("editar")} ${esc(t("campaign.hud.programar"))}</button>` : "") : "";
    }
    $titulo.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-volver]")) abrirPantalla(pantalla === "ficha" ? "maquinas" : "programa");
      else if (ev.target.closest("[data-fi-centrar]")) ctx.abarcar([fichaId]);
      else if (ev.target.closest("[data-fi-programa]")) { const id = fichaId; abrirPantalla("programa"); ctx.abrirPrograma(id); }
    });
    // Las pestañas de War (Programa, Registro…) también cambian de pantalla: se sigue la pista del cambio.
    for (const id of PESTANAS) $(`t-${id}`).addEventListener("click", () => { if (pantalla && !vistas[pantalla]) { pantalla = id === "programa" ? "" : id; pintarTitulo(); } });
    function pintarPantalla() {
      if (!M()) return;
      ({ mision: pintarMision, maquinas: pintarMaquinas, ficha: pintarFicha, guardado: pintarGuardado, biblioteca: pintarBiblioteca, investigacion: pintarInvestigacion, mundo: pintarMundo }[pantalla] || (() => {}))();
    }

    // Misión: el hito en curso explicado, las misiones anteriores y lo que viene.
    function pintarMision() {
      const m = M(), n = hitoN(), pistas = uiC.pistas();
      const hitos = D().hitos.map((h, i) => {
        if (i < n) return `<details class="cmp-hito hecho"><summary><span class="ok">${s("ok")}</span><span class="placa">${esc(h.clave)}</span> ${esc(uiC.tituloHito(i))}
            <small>${m.hitosT[i] != null ? esc(t("campaign.hud.hecho_en", { t: ctx.coma(m.hitosT[i]) })) : ""}</small></summary><p>${rico(textoHito(i, "objetivo"))}</p><p class="nota">${esc(t("campaign.hud.aprendes"))} ${rico(textoHito(i, "leccion"))}</p></details>`;
        if (i === n) return `<article class="cmp-hito actual"><header><span class="placa">${esc(h.clave)}</span><h4>${esc(uiC.tituloHito(i))}</h4><span class="en-curso">${esc(t("campaign.hud.en_curso"))}</span></header>
            <p class="cmp-hito-obj">${rico(textoHito(i, "objetivo"))}</p><p class="nota">${esc(t("campaign.hud.aprendes"))} ${rico(textoHito(i, "leccion"))}</p>
            <ul class="cmp-metas-lista">${metasHTML()}</ul>
            <div class="cmp-pistas">${pistas.slice(0, pistasVistas).map((p, k) => `<p class="cmp-pista">${s("pista")} <span><b>${esc(t("campaign.hud.pista_n", { n: k + 1 }))}</b> ${rico(p)}</span></p>`).join("")}
            ${pistasVistas < pistas.length ? `<button type="button" class="btn chico" data-pista>${s("pista")} ${esc(t("campaign.hud.ver_pista", { n: pistasVistas + 1, total: pistas.length }))}</button><span class="nota">${esc(t("campaign.hud.pistas_nota"))}</span>` : ""}</div></article>`;
        return `<div class="cmp-hito bloqueado">${s("candado")}<span class="placa">${esc(h.clave)}</span> ${esc(uiC.tituloHito(i))}</div>`;
      }).join("");
      vistas.mision.innerHTML = `<div class="cmp-mision">${m.completado ? `<p class="cmp-fin">${rico(t("campaign.hud.fin_corto"))}</p>` : ""}${hitos}</div>`;
    }
    vistas.mision.addEventListener("click", (ev) => { if (ev.target.closest("[data-pista]")) verPista(); });

    // Máquinas: las propias por clase (abren su ficha; las ligeras se arrastran al mapa) y las enemigas conocidas.
    function pintarMaquinas() {
      const m = M(), propias = m.maquinas.filter(e => C.esRobot(e) || C.esMaquina(e) || ["banda", "control", "torreta", "arsenal"].includes(e.clase));
      const clases = [...ORDEN_CLASES, "torreta", "arsenal"];
      const grupos = clases.map(k => [k, propias.filter(e => e.clase === k)]).filter(([, l]) => l.length);
      const enemigas = (D().enemigas || []).filter(x => (m.vistos || []).includes(x.id));
      vistas.maquinas.innerHTML = `<div class="cmp-maquinas">
        <h4>${esc(t("campaign.hud.propias"))}</h4>
        ${grupos.map(([k, l]) => `<div class="cmp-mq-grupo"><h5>${esc(t(`campaign.clase.${k}`))} <small>${l.length}</small></h5><ul>${l.map(e => {
          const ok = e.presente !== false && (e.encendida ?? true), [cls, txt] = uiC.estado(e), mueve = MOVIBLES.has(e.clase) && ok;
          return `<li class="${ok ? "" : "apagada"}"><button type="button" class="cmp-mq" data-ficha="${e.id}" style="--c:${color(e)}">${dibujo(e)}<span class="nom"><b>${esc(e.id)}</b><small>${esc(clase(e))}</small></span>
              <span class="estado ${ok ? cls : ""}" data-mq-estado="${e.id}">${esc(ok ? txt : t("campaign.hud.desde", { hito: D().hitos[e.desde || 0].clave }))}</span>${s("flecha")}</button>
            ${mueve ? `<button type="button" class="cmp-mq-asa" data-colocar="${e.id}" aria-label="${esc(t("campaign.hud.mover", { unidad: e.id }))}" data-tip="${esc(t("campaign.hud.mover", { unidad: e.id }))}">⠿</button>` : ""}</li>`;
        }).join("")}</ul></div>`).join("")}
        <p class="nota">${esc(t("campaign.hud.mover_nota"))}</p>
        <h4>${esc(t("campaign.hud.enemigas"))}</h4>
        ${enemigas.length ? "" : `<div class="cmp-vacio">${s("maquinas")}<p>${esc(t("campaign.hud.enemigas_vacio"))}</p></div>`}
        <p class="nota">${esc(t("campaign.hud.ingenieria"))}</p></div>`;
    }
    vistas.maquinas.addEventListener("click", (ev) => { const b = ev.target.closest("[data-ficha]"); if (b) abrirFicha(b.dataset.ficha); });

    // Ficha completa: dibujo 2D, modelo 3D (escritorio), qué hace, nombre, órdenes, datos y signos vitales.
    function abrirFicha(id) {
      if (!id || !M() || !M().porId[id]) return;
      fichaId = id; miniCerrada = null;
      if (![...ctx.seleccionadas].includes(id)) ctx.seleccionar([id], { inspeccionar: false });
      abrirPantalla("ficha");
    }
    function pintarFicha() {
      const e = M().porId[fichaId]; if (!e) { abrirPantalla("maquinas"); return; }
      const { c1, c2, botones } = uiC.ficha(e), met = uiC.metricas(e);
      const [cls, txt] = uiC.estado(e);
      const clave = e.clase === "lugar" ? e.tipo : e.clase;
      vistas.ficha.innerHTML = `<div class="cmp-ficha" style="--c:${color(e)}">
        <div class="cmp-fi-hero">${dibujo(e, "dibujo grande")}<canvas class="cmp-fi-3d" width="260" height="190" aria-label="${esc(t("campaign.hud.modelo_3d", { unidad: e.id }))}"></canvas>
          <div class="cmp-fi-id"><b>${esc(e.id)}</b><span>${esc(clase(e))}</span><span class="estado ${cls}" data-fi-estado>${esc(txt)}</span></div></div>
        <section><h4>${esc(t("campaign.hud.que_hace"))}</h4><p>${rico(t(`campaign.que.${clave}`))}</p></section>
        <div class="cmp-fi-cols ins-cols"><div class="ins-col">${c1}</div><div class="ins-col">${c2}</div></div>
        ${botones ? `<div class="fila-botones">${botones}</div>` : ""}
        <section><h4>${esc(t("campaign.hud.vitales"))}</h4><div class="vitales" id="fi-vitales">${ctx.htmlVitales(e)}</div></section>
        ${met ? `<section><h4>${esc(t("inspector.seccion.metricas"))}</h4><div class="metricas">${met.map(([k, v]) => `<span><small>${esc(k)}</small><b>${esc(String(v))}</b></span>`).join("")}</div></section>` : ""}
        <p class="nota cmp-fi-nota">${esc(t("campaign.hud.ficha_nota"))}</p><div class="pista-tk" id="pista-tk-fi"></div></div>`;
      pintarTitulo();
      const lienzo = vistas.ficha.querySelector(".cmp-fi-3d");
      if (detenerRetrato) detenerRetrato();
      detenerRetrato = !movil() && ctx.retrato3D ? ctx.retrato3D(e.id, lienzo) : null;
      if (!detenerRetrato) lienzo.hidden = true;
    }
    vistas.ficha.addEventListener("click", (ev) => {
      const b = ev.target.closest('[data-accion="programa"]');
      if (b) { const id = fichaId; abrirPantalla("programa"); ctx.abrirPrograma(id); }
    });

    // Guardado manual: varias ranuras con el mundo y los programas.
    let confirmar = null;
    const fecha = (n) => new Date(n).toLocaleString(window.CMGI18n && window.CMGI18n.idioma === "en" ? "en" : "es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    function pintarGuardado() {
      const ranuras = ctx.ranuras.leer();
      vistas.guardado.innerHTML = `<div class="cmp-guardado"><p class="nota">${esc(t("campaign.hud.guardado_intro"))}</p><ol class="cmp-ranuras">${ranuras.map((r, i) => `<li class="${r ? "" : "vacia"}">
          <span class="n">${i + 1}</span><div class="txt">${r ? `<b>${esc(t("campaign.historial.fila", { hito: D().hitos[r.hito].clave, titulo: uiC.tituloHito(r.hito) }))}</b><small>${esc(t("campaign.historial.detalle", { t: ctx.coma(r.t), presupuesto: r.mundo.presupuesto, cuando: fecha(r.cuando) }))}</small>` : `<b>${esc(t("campaign.hud.ranura_vacia"))}</b>`}</div>
          <div class="acc"><button type="button" class="btn chico${r ? "" : " primario"}" data-ranura-guardar="${i}">${esc(t(confirmar === `g${i}` ? "campaign.historial.confirmar" : "campaign.hud.guardar_aqui"))}</button>
            ${r ? `<button type="button" class="btn chico primario" data-ranura-cargar="${i}">${esc(t(confirmar === `c${i}` ? "campaign.historial.confirmar" : "campaign.hud.cargar"))}</button>
            <button type="button" class="cmp-redondo chico" data-ranura-borrar="${i}" aria-label="${esc(t("campaign.hud.borrar"))}" data-tip="${esc(t(confirmar === `b${i}` ? "campaign.historial.confirmar" : "campaign.hud.borrar"))}">${s("papelera")}</button>` : ""}</div></li>`).join("")}</ol>
        <p class="nota">${esc(t("campaign.hud.guardado_auto"))} <button type="button" class="link" data-ir-historial>${esc(t("campaign.pantalla.historial"))}</button></p></div>`;
    }
    function doble(clave, hacer) {
      if (confirmar !== clave) { confirmar = clave; pintarGuardado(); setTimeout(() => { if (confirmar === clave) { confirmar = null; if (pantalla === "guardado") pintarGuardado(); } }, 3000); return; }
      confirmar = null; hacer(); if (pantalla === "guardado") pintarGuardado();
    }
    vistas.guardado.addEventListener("click", (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      if (b.dataset.irHistorial) return abrirPantalla("escenario");
      const r = ctx.ranuras.leer();
      if (b.dataset.ranuraGuardar != null) { const i = +b.dataset.ranuraGuardar; if (r[i]) doble(`g${i}`, () => ctx.ranuras.guardar(i)); else { ctx.ranuras.guardar(i); pintarGuardado(); } }
      else if (b.dataset.ranuraCargar != null) { const i = +b.dataset.ranuraCargar; doble(`c${i}`, () => ctx.ranuras.cargar(i)); }
      else if (b.dataset.ranuraBorrar != null) { const i = +b.dataset.ranuraBorrar; doble(`b${i}`, () => ctx.ranuras.borrar(i)); }
    });

    // Biblioteca: carpetas con programas guardados para cargarlos en cualquier unidad.
    const CLAVE_BIB = "campaign-biblioteca";
    const leerBib = () => { const l = ctx.guardado.leer(CLAVE_BIB, []); return Array.isArray(l) ? l.filter(x => x && typeof x.texto === "string") : []; };
    let carpetaAbierta = null;
    function pintarBiblioteca() {
      const lista = leerBib(), id = ctx.progSel;
      const carpetas = [...new Set(lista.map(x => x.carpeta || t("campaign.hud.sin_carpeta")))].sort((a, b) => a.localeCompare(b));
      vistas.biblioteca.innerHTML = `<div class="cmp-bib">
        <form class="cmp-bib-nuevo" data-bib-form><b>${esc(t("campaign.hud.guardar_programa", { unidad: id }))}</b>
          <label><span>${esc(t("campaign.hud.nombre"))}</span><input name="nombre" required maxlength="60" value="${esc(`${id} · ${D().hitos[Math.min(M().hito, D().hitos.length - 1)].clave}`)}"></label>
          <label><span>${esc(t("campaign.hud.carpeta"))}</span><input name="carpeta" maxlength="40" list="cmp-bib-carpetas" value="${esc(carpetaAbierta || M().porId[id] && clase(M().porId[id]) || "")}"></label>
          <datalist id="cmp-bib-carpetas">${carpetas.map(c => `<option value="${esc(c)}">`).join("")}</datalist>
          <button type="submit" class="btn chico primario">${s("guardar")} ${esc(t("campaign.hud.guardar"))}</button></form>
        ${carpetas.length ? carpetas.map(c => { const items = lista.map((x, i) => [x, i]).filter(([x]) => (x.carpeta || t("campaign.hud.sin_carpeta")) === c);
          return `<details class="cmp-bib-carpeta"${carpetaAbierta === c || carpetas.length === 1 ? " open" : ""} data-carpeta="${esc(c)}"><summary>${s("carpeta")} ${esc(c)} <small>${items.length}</small></summary><ul>${items.map(([x, i]) => `<li>
            <div class="txt"><b>${esc(x.nombre)}</b><small>${esc(`${x.unidad || "—"} · ${x.lenguaje === "python" ? "Python" : "JavaScript"} · ${fecha(x.cuando)}`)}</small><pre>${esc(x.texto.split("\n").slice(0, 3).join("\n"))}</pre></div>
            <div class="acc"><button type="button" class="btn chico primario" data-bib-cargar="${i}">${esc(t("campaign.hud.cargar_en", { unidad: id }))}</button><button type="button" class="cmp-redondo chico" data-bib-borrar="${i}" data-tip="${esc(t(confirmar === `bib${i}` ? "campaign.historial.confirmar" : "campaign.hud.borrar"))}" aria-label="${esc(t("campaign.hud.borrar"))}">${s("papelera")}</button></div></li>`).join("")}</ul></details>`; }).join("")
          : `<div class="cmp-vacio">${s("carpeta")}<p>${esc(t("campaign.hud.biblioteca_vacia"))}</p></div>`}</div>`;
    }
    vistas.biblioteca.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target), lista = leerBib(), id = ctx.progSel;
      const carpeta = String(f.get("carpeta") || "").trim() || t("campaign.hud.sin_carpeta");
      lista.push({ nombre: String(f.get("nombre") || id).trim() || id, carpeta, unidad: id, lenguaje: ctx.lenguajeDe(id), texto: ctx.textoPrograma(id), cuando: Date.now() });
      ctx.guardado.escribir(CLAVE_BIB, lista); carpetaAbierta = carpeta; pintarBiblioteca();
    });
    vistas.biblioteca.addEventListener("click", (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      const lista = leerBib();
      if (b.dataset.bibCargar != null) { const x = lista[+b.dataset.bibCargar]; if (x) { const id = ctx.progSel; abrirPantalla("programa"); ctx.ponerTextoPrograma(id, x.texto, x.lenguaje); } }
      else if (b.dataset.bibBorrar != null) {
        const i = +b.dataset.bibBorrar, clave = `bib${i}`;
        if (confirmar !== clave) { confirmar = clave; b.dataset.tip = t("campaign.historial.confirmar"); b.classList.add("confirmar"); setTimeout(() => { if (confirmar === clave) confirmar = null; b.classList.remove("confirmar"); }, 3000); return; }
        confirmar = null; lista.splice(i, 1); ctx.guardado.escribir(CLAVE_BIB, lista); pintarBiblioteca();
      }
    });
    vistas.biblioteca.addEventListener("toggle", (ev) => { const d = ev.target; if (d.open && d.dataset.carpeta) carpetaAbierta = d.dataset.carpeta; }, true);

    // Investigación: lo que cada hito ha desbloqueado. El árbol con energía para I+D llega en otro nivel.
    function pintarInvestigacion() {
      const m = M(), n = hitoN();
      const nodos = D().hitos.map((h, i) => ({ h, i, unidades: m.maquinas.filter(u => (u.desde ?? -1) === i && (C.esMaquina(u) || C.esRobot(u) || ["banda", "control"].includes(u.clase))) }));
      vistas.investigacion.innerHTML = `<div class="cmp-arbol-inv"><p class="nota">${esc(t("campaign.hud.inv_intro"))}</p><ol>${nodos.map(({ h, i, unidades }) => `<li class="${i < n ? "hecho" : i === n ? "actual" : "bloqueado"}">
          <span class="nodo">${i < n ? s("ok") : i === n ? s("abierto") : s("candado")}</span><div><b><span class="placa">${esc(h.clave)}</span> ${esc(uiC.tituloHito(i))}</b>
          <small>${rico(textoHito(i, "leccion"))}</small>${unidades.length ? `<span class="tecs">${unidades.map(u => `<span class="tec" style="--c:${color(u)}">${esc(clase(u))} · ${esc(u.id)}</span>`).join("")}</span>` : ""}</div></li>`).join("")}</ol>
        <p class="nota">${esc(t("campaign.hud.inv_futuro"))}</p></div>`;
    }
    function pintarMundo() { vistas.mundo.innerHTML = `<div class="cmp-vacio">${s("mundo")}<p>${esc(t("campaign.hud.mundo_pendiente"))}</p></div>`; }

    // ---------- Colocar una máquina desde Máquinas (widget como el de shapez) ----------
    // Arrastrar el asa ⠿ al mapa: la silueta se ajusta a la plataforma más cercana. ✓ manda al montacargas a moverla,
    // ⟳ gira la silueta, ✗ cancela y el candado deja la herramienta armada para colocar otra vez.
    const $fantasma = nodo(`<div class="cmp-fantasma" hidden><span class="silueta"></span></div>`);
    const $widget = nodo(`<div class="cmp-widget marco" role="toolbar" hidden>
      <button type="button" class="ok" data-w="ok">${s("ok")}</button><button type="button" data-w="girar">${s("girar")}</button>
      <button type="button" class="no" data-w="no">${s("cerrar")}</button><button type="button" data-w="fijar" aria-pressed="false">${s("candado")}</button><span class="msg" role="status"></span></div>`);
    campo.append($fantasma, $widget);
    let colocar = null;
    function padMasCercano(cx, cy) {
      const p = ctx.suelo(cx, cy); if (!p) return null;
      let mejor = null, dm = 6;
      for (const u of M().maquinas) if (u.clase === "pad") { const d = Math.hypot(u.cx - p.x, u.cy - p.y); if (d < dm) { dm = d; mejor = u; } }
      return mejor;
    }
    function validar(c) {
      const q = M().porId[c.id], pad = c.pad && M().porId[c.pad];
      if (!pad) return t("campaign.hud.colocar_fuera");
      if (q.pad === pad.id) return t("campaign.hud.colocar_mismo");
      if (pad.maquina) return t("campaign.hud.colocar_ocupado", { pad: pad.id });
      const frk = M().maquinas.find(u => u.clase === "montacargas" && u.presente !== false);
      if (!frk) return t("campaign.hud.colocar_sin_frk");
      return null;
    }
    function pintarColocar() {
      if (!colocar || !colocar.pad) { $fantasma.hidden = true; $widget.hidden = true; return; }
      const pad = M().porId[colocar.pad], p = ctx.aPantalla(pad.cx, pad.cy), r = campo.getBoundingClientRect();
      const error = validar(colocar);
      $fantasma.hidden = !p.visible; $fantasma.classList.toggle("mal", !!error);
      $fantasma.style.transform = `translate(${Math.round(p.x - r.left)}px, ${Math.round(p.y - r.top)}px)`;
      $fantasma.querySelector(".silueta").style.transform = `translate(-50%, -50%) rotate(${colocar.giro}deg)`;
      $fantasma.querySelector(".silueta").textContent = colocar.id;
      if (!colocar.soltado) { $widget.hidden = true; return; }
      $widget.hidden = !p.visible;
      // A la derecha de la silueta (a la izquierda si no cabe), sin taparla.
      const wx = p.x - r.left + 44 + 200 < r.width ? p.x - r.left + 44 : p.x - r.left - 44 - 200;
      $widget.style.transform = `translate(${Math.round(Math.max(6, wx))}px, ${Math.round(Math.min(r.height - 110, Math.max(6, p.y - r.top - 30)))}px)`;
      $widget.querySelector(".msg").textContent = error || t("campaign.hud.colocar_listo", { unidad: colocar.id, pad: colocar.pad });
      $widget.querySelector('[data-w="ok"]').disabled = !!error;
      $widget.querySelector('[data-w="fijar"]').setAttribute("aria-pressed", String(colocar.fijo));
      for (const [w, k] of [["ok", "confirmar"], ["girar", "girar"], ["no", "cancelar"], ["fijar", "fijar"]]) { const b = $widget.querySelector(`[data-w="${w}"]`); b.dataset.tip = t(`campaign.hud.w_${k}`); b.setAttribute("aria-label", t(`campaign.hud.w_${k}`)); }
    }
    function terminarColocar() { colocar = null; pintarColocar(); }
    vistas.maquinas.addEventListener("pointerdown", (ev) => {
      const asa = ev.target.closest("[data-colocar]"); if (!asa || ev.button !== 0) return;
      ev.preventDefault();
      colocar = { id: asa.dataset.colocar, pad: null, giro: 0, fijo: colocar ? colocar.fijo : false, soltado: false, arrastre: ev.pointerId };
      document.body.classList.add("cmp-arrastrando");
      if (movil()) ctx.verPanel("mapa");
    });
    addEventListener("pointermove", (ev) => {
      if (!colocar || colocar.arrastre !== ev.pointerId) return;
      const r = campo.getBoundingClientRect(), dentro = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      const pad = dentro ? padMasCercano(ev.clientX, ev.clientY) : null;
      colocar.pad = pad ? pad.id : null; pintarColocar();
    });
    addEventListener("pointerup", (ev) => {
      if (!colocar || colocar.arrastre !== ev.pointerId) return;
      document.body.classList.remove("cmp-arrastrando");
      colocar.arrastre = null;
      if (!colocar.pad) { terminarColocar(); return; }
      colocar.soltado = true; pintarColocar();
    });
    $widget.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-w]"); if (!b || !colocar) return;
      const w = b.dataset.w;
      if (w === "no") terminarColocar();
      else if (w === "girar") { colocar.giro = (colocar.giro + 90) % 360; pintarColocar(); }
      else if (w === "fijar") { colocar.fijo = !colocar.fijo; pintarColocar(); }
      else if (w === "ok" && !validar(colocar)) {
        const frk = M().maquinas.find(u => u.clase === "montacargas" && u.presente !== false);
        const res = ctx.ordenManual(frk.id, [["pickUp", colocar.id], ["deliver", colocar.pad]], { aviso: true });
        if (res) { $widget.querySelector(".msg").textContent = res; return; }
        if (colocar.fijo) { colocar.soltado = false; colocar.pad = null; pintarColocar(); colocar.soltado = true; }
        else terminarColocar();
      }
    });
    // Arrastrar la silueta ya soltada a otra plataforma.
    campo.addEventListener("pointerdown", (ev) => {
      if (!colocar || !colocar.soltado || ev.button !== 0 || ev.target.tagName !== "CANVAS") return;
      const pad = padMasCercano(ev.clientX, ev.clientY);
      if (pad) { colocar.pad = pad.id; pintarColocar(); ev.stopPropagation(); }
    }, true);
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && colocar) terminarColocar(); });

    // Marca de una orden con clic derecho (como en los juegos de estrategia).
    function marcaOrden(x, y, ok) {
      const r = campo.getBoundingClientRect(), m = document.createElement("i");
      m.className = `cmp-marca${ok ? "" : " mal"}`; m.style.left = `${x - r.left}px`; m.style.top = `${y - r.top}px`;
      $marcas.append(m); setTimeout(() => m.remove(), 700);
    }

    // ---------- Ajustes: filas etiqueta–control; las explicaciones, en ⓘ ----------
    function ordenarAjustes() {
      const dlg = $("ajustes"); if (!dlg || dlg.dataset.cmpOrdenado) return;
      dlg.dataset.cmpOrdenado = "1"; dlg.classList.add("cmp-ajustes");
      // Las notas largas pasan a un ⓘ junto a su sección; se leen al pasar el cursor, con el foco o con un toque.
      for (const sec of dlg.querySelectorAll("section")) {
        const h = sec.querySelector("h3"), notas = [...sec.querySelectorAll(":scope > p.nota, :scope > div > p.nota")];
        if (!h || !notas.length) continue;
        const b = document.createElement("button");
        b.type = "button"; b.className = "cmp-info"; b.textContent = "i";
        b.dataset.tip = notas.map(n => n.textContent.trim()).join(" ");
        b.setAttribute("aria-label", b.dataset.tip);
        h.append(b);
        for (const n of notas) n.classList.add("cmp-nota-oculta");
      }
      // Filas etiqueta–control: el título o la etiqueta a la izquierda y su control a la derecha.
      for (const seg of dlg.querySelectorAll(".seg")) {
        const etq = seg.previousElementSibling;
        if (!etq || !(etq.matches("h3") || (etq.matches("p") && !etq.classList.contains("nota")))) continue;
        const fila = document.createElement("div"); fila.className = "cmp-fila";
        seg.before(fila); fila.append(etq, seg);
      }
      // Campaign no tiene seudocódigo: fuera su idioma.
      for (const b of dlg.querySelectorAll("[data-idioma-seudo]")) b.closest(".seg").hidden = true;
      // Lenguaje del programa: JS o Python desde aquí (en el escritorio ya no está en la barra del código).
      const py = dlg.querySelector('[data-lenguaje-programa="python"]'), js = dlg.querySelector('[data-modo-codigo="js"]');
      if (py && js) {
        py.disabled = false;
        const elegir = (l) => { const sel = $("sel-lenguaje"); if (!sel) return; if ([...sel.options].some(o => o.value === l)) { sel.value = l; sel.dispatchEvent(new Event("change", { bubbles: true })); } pintarLenguajeAjustes(); };
        py.addEventListener("click", () => elegir("python"));
        js.addEventListener("click", () => elegir("js"));
      }
    }
    function pintarLenguajeAjustes() {
      const dlg = $("ajustes"), sel = $("sel-lenguaje"); if (!dlg || !sel) return;
      const py = dlg.querySelector('[data-lenguaje-programa="python"]'), js = dlg.querySelector('[data-modo-codigo="js"]');
      if (!py || !js) return;
      py.hidden = ![...sel.options].some(o => o.value === "python");
      py.setAttribute("aria-pressed", String(sel.value === "python")); js.setAttribute("aria-pressed", String(sel.value !== "python"));
    }
    $("ajustes").addEventListener("toggle", pintarLenguajeAjustes);
    $("b-ajustes").addEventListener("click", () => setTimeout(pintarLenguajeAjustes, 0));

    // ---------- Textos ----------
    function pintarTextos() {
      bMision.setAttribute("aria-label", t("campaign.hud.mision")); bMision.dataset.tip = t("campaign.hud.mision");
      bVida.setAttribute("aria-label", t("campaign.hud.vida")); bVida.dataset.tip = t("campaign.hud.vida");
      $pop.setAttribute("aria-label", t("campaign.hud.mision")); $popVida.setAttribute("aria-label", t("campaign.hud.vida"));
      $bMaq.querySelector(".txt").textContent = t("campaign.pantalla.maquinas");
      $bUnidades.setAttribute("aria-label", t("campaign.hud.selector")); $bUnidades.dataset.tip = t("campaign.hud.selector");
      $bMas.setAttribute("aria-label", t("campaign.hud.mas")); $bMas.dataset.tip = t("campaign.hud.mas");
      $arbol.setAttribute("aria-label", t("campaign.hud.unidades"));
      $bObj.textContent = t("campaign.hud.objetivo");
      const bIns = $pieModos.querySelector('[data-pie-modo="inspector"]'); if (bIns) { bIns.removeAttribute("data-i18n"); bIns.textContent = t("campaign.hud.specs"); }
      $widget.setAttribute("aria-label", t("campaign.hud.widget"));
      // En el escritorio «Plano» pasa a llamarse 2D; en el teléfono se queda como en War.
      const b2 = document.querySelector('[data-vista="2d"]');
      if (b2) { b2.removeAttribute("data-i18n"); b2.textContent = movil() ? t("juego.vista.plano") : "2D"; }
      pintarTipografia(); pintarBotonUnidades();
    }
    function refrescar() {
      pintarTextos(); pintarRecursos(); pintarMini(); pintarPieObj();
      if (!$pop.hidden) pintarPop();
      if (!$arbol.hidden) pintarArbol();
      if (pantalla && vistas[pantalla]) pintarPantalla();
      pintarTitulo();
      const cuenta = M() ? M().maquinas.filter(e => (C.esRobot(e) || C.esMaquina(e)) && e.presente !== false && (e.encendida ?? true)).length : 0;
      $bMaq.querySelector(".cuenta").textContent = cuenta;
    }

    // ---------- Ganchos de juego.js ----------
    function alHito() {
      miniCerrada = null;
      bMision.classList.toggle("con-nuevo", (ctx.guardado.leer(CLAVE_VISTA, -1) | 0) < hitoN() && $pop.hidden);
      refrescar();
    }
    let tVivo = 0, tArbol = 0;
    function ciclo(ahora) {
      if (!M()) return;
      if (colocar && colocar.pad) pintarColocar();
      if (ahora - tVivo < 250) return;
      tVivo = ahora;
      const m = M();
      pintarRecursos();
      const poner = (el, e) => { if (!el || !e) return; const [cls, txt] = uiC.estado(e); if (el.textContent !== txt) el.textContent = txt; el.className = `estado ${cls}`; };
      if (!$mini.hidden) { poner($mini.querySelector("[data-fm-estado]"), m.porId[miniId]); ctx.vivos($mini); }
      if (pantalla === "ficha") {
        const e = m.porId[fichaId]; poner(vistas.ficha.querySelector("[data-fi-estado]"), e);
        const v = $("fi-vitales"); if (v && e) { const h = ctx.htmlVitales(e); if (v.innerHTML !== h) v.innerHTML = h; }
        ctx.vivos(vistas.ficha);
      } else if (pantalla === "maquinas") for (const el of vistas.maquinas.querySelectorAll("[data-mq-estado]")) { const e = m.porId[el.dataset.mqEstado]; if (e && e.presente !== false && (e.encendida ?? true)) poner(el, e); }
      else if (pantalla === "mision") { const clave = C.metas(m).map(x => `${x.valor}/${x.n}`).join("|"); if (vistas.mision.dataset.clave !== clave) { vistas.mision.dataset.clave = clave; pintarMision(); } }
      const claveObj = C.metas(m).map(x => `${x.valor}/${x.n}`).join("|");
      if ($pieObj.dataset.clave !== claveObj) { $pieObj.dataset.clave = claveObj; pintarPieObj(); }
      if (!$pop.hidden && $pop.dataset.clave !== claveObj) { $pop.dataset.clave = claveObj; pintarPop(); }
      if (!$popVida.hidden) pintarVida();
      if (!$arbol.hidden && ahora - tArbol > 1000) { tArbol = ahora; if (!$arbol.contains(document.activeElement)) for (const el of $arbol.querySelectorAll("[data-mq-estado]")) poner(el, m.porId[el.dataset.mqEstado]); }
    }
    // Menú ⋯ (layout.js): en el escritorio son las pantallas del panel del código; en el teléfono no cambia.
    function menu(base) {
      if (movil()) return base;
      const de = id => base.find(x => x.id === id);
      const p = (id, clave, ico, c1) => ({ id, t: () => t(`campaign.pantalla.${clave}`), c1, ico: SVG(ICO[ico].replace(/<(path|circle|rect)/g, '<$1 class="s1"')), fn: () => abrirPantalla(id), activo: () => pantalla === id });
      const pest = (id, clave) => { const b = de(id); return b && { ...b, t: () => t(`campaign.pantalla.${clave}`), fn: () => abrirPantalla(id), activo: () => (pantalla || "programa") === id }; };
      return [pest("programa", "codigo"), p("mision", "mision", "mision", "#E0AE4A"), p("maquinas", "maquinas", "maquinas", "#A887FF"), pest("escenario", "historial"), pest("registro", "registro"), pest("ayuda", "ordenes"),
        p("investigacion", "investigacion", "investigar", "#63D2E0"), p("mundo", "mundo", "mundo", "#5FC28A"), p("guardado", "guardado", "guardar", "#F27AB0"), p("biblioteca", "biblioteca", "carpeta", "#9BD56B"), de("revisar"), de("ajustes")].filter(Boolean);
    }
    app.addEventListener("cmg:forma", () => {
      colocarBotones(); pintarMini(); pintarTitulo(); pintarTextos();
      if (movil()) { abrirArbol(false); abrirPop(false); abrirVida(false); if (pantalla && vistas[pantalla]) abrirPantalla("programa"); }
    });
    window.addEventListener("cmg:idioma", () => { if (M()) refrescar(); });
    colocarBotones();
    ordenarAjustes();
    pintarTextos();

    return {
      metasHTML, abrirFicha, abrirPantalla, marcaOrden, menu, ciclo, alHito, alPiel, refrescar, rico,
      alSeleccionar() { pintarMini(); pintarBotonUnidades(); if (!$arbol.hidden && !$arbol.contains(document.activeElement)) pintarArbol(); if (pantalla === "maquinas") pintarMaquinas(); },
      seleccionCambia(opciones = {}) { if (opciones.inspeccionar !== "conservar") miniCerrada = null; },
      alProgramas() { pintarBotonUnidades(); if (pantalla === "biblioteca") pintarBiblioteca(); },
      get pantalla() { return pantalla; },
      escritorio: () => !movil(),
    };
  }
  window.CAMPAIGN_HUD = { crear };
})();
