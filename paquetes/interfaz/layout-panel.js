/** @param {any} l
 * @param {any} cmg */
export function instalarPanelPantalla(l, cmg, pantallaMovil = false) {
  const dom = /** @type {any} */ (document);
  // ---------- Panel inferior: inspector del programa (por defecto) o consola ----------
  // Su barra se arrastra como el divisor: llevarla hasta abajo lo cierra del todo; un toque en la barra
  // o el botón ▾/▴ lo cierra o lo recupera con su último alto. Alto y contenido se guardan por forma.
  const pie = l.$("pie"), pieCuerpo = l.$("pie-cuerpo"), pieBarra = l.$("pie-barra"), pieAgarre = l.$("pie-agarre"), bPie = l.$("b-pie");
  const PIE = { escritorio: 170, movil: 0 }, PIE_ABRIR = { escritorio: 170, movil: 130 }, PIE_MIN = 48;
  let pieModo = l.leer("pie-modo", "inspector") === "consola" ? "consola" : "inspector";
  const numero = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
  const altoPie = () => Math.max(0, numero(l.leer(`pie-alto-${l.forma}`, PIE[l.forma]), PIE[l.forma]));
  const altoActual = () => pie.dataset.abierto === "true" ? pieCuerpo.getBoundingClientRect().height : 0;
  // El editor conserva unas líneas a la vista.
  const maxPie = () => Math.max(PIE_MIN, l.$("v-programa").getBoundingClientRect().height - pieBarra.offsetHeight - 90);
  // En el teléfono la consola es una pestaña de la ficha ⓘ: el aviso de mensajes nuevos va en ese botón y en la pestaña.
  let hayNuevo = false;
  const marcarNuevo = (si = hayNuevo) => {
    hayNuevo = si;
    pie.querySelector('[data-pie-modo="consola"]').classList.toggle("con-nuevo", si);
    l.$("b-info-reto").classList.toggle("con-nuevo", si && l.forma === "movil");
    l.$("info-t-consola").dataset.estado = si ? "nueva" : "";
  };
  const consolaEnFicha = () => !l.$("info-reto").hidden && l.$("info-t-consola").getAttribute("aria-selected") === "true";
  const consolaVisible = () => !l.zonaCodigo.inert && l.$("consola").getClientRects().length > 0
    && (l.forma === "movil" ? consolaEnFicha() : pieModo === "consola" && pie.dataset.abierto === "true");
  function bajarConsola() {
    const c = l.$("consola"), cont = l.$("pie-con");
    c.scrollTop = c.scrollHeight;
    // En la ficha, la consola crece con sus mensajes y quien se desplaza es pie-con. Lleva el último
    // mensaje a la vista sin saltar a los ajustes que vienen después ni desplazar el resto de la página.
    const ultimo = c.lastElementChild;
    if (ultimo) cont.scrollTop += ultimo.getBoundingClientRect().bottom - cont.getBoundingClientRect().bottom + 4;
  }
  function pintarTextosPie() {
    const abierto = pie.dataset.abierto === "true";
    const clave = abierto ? "cerrar" : "abrir";
    bPie.setAttribute("aria-label", l.t(`disposicion.panel.${clave}`));
    bPie.dataset.tip = l.t(`disposicion.panel.${clave}`);
    const alto = Number(pieAgarre.getAttribute("aria-valuenow")) || 0;
    pieAgarre.setAttribute("aria-valuetext", abierto
      ? l.t("disposicion.panel.alto", { alto })
      : l.t("disposicion.panel.cerrado"));
  }
  function aplicarPie(alto = altoPie()) {
    const abierto = alto > 0;
    pie.dataset.abierto = String(abierto);
    pie.dataset.modo = pieModo;
    if (abierto) pie.style.setProperty("--pie-alto", `${Math.round(alto)}px`);
    bPie.setAttribute("aria-expanded", String(abierto));
    bPie.textContent = abierto ? "▾" : "▴";
    pieAgarre.setAttribute("aria-valuenow", String(Math.round(alto)));
    pintarTextosPie();
    for (const b of pie.querySelectorAll("[data-pie-modo]")) b.setAttribute("aria-pressed", String(b.dataset.pieModo === pieModo));
    // En el teléfono el panel no se ve (su inspector y su consola están en la ficha ⓘ).
    if (abierto && pieModo === "consola" && l.forma !== "movil") { marcarNuevo(false); bajarConsola(); }
    else marcarNuevo();
    requestAnimationFrame(() => cmg && cmg.medirEditor());
  }
  function guardarPie(alto) {
    l.escribir(`pie-alto-${l.forma}`, Math.round(alto));
    if (alto > 0) l.escribir(`pie-ultimo-${l.forma}`, Math.round(alto));
  }
  function abrirPie(si) {
    const alto = si ? Math.max(PIE_MIN, numero(l.leer(`pie-ultimo-${l.forma}`, PIE_ABRIR[l.forma]), PIE_ABRIR[l.forma])) : 0;
    aplicarPie(alto); guardarPie(alto);
  }
  bPie.addEventListener("click", () => abrirPie(pie.dataset.abierto !== "true"));
  pie.querySelector(".pie-modos").addEventListener("click", /** @param {any} ev */ (ev) => {
    const b = ev.target.closest("[data-pie-modo]"); if (!b) return;
    pieModo = b.dataset.pieModo; l.escribir("pie-modo", pieModo);
    if (pie.dataset.abierto !== "true") abrirPie(true); else aplicarPie(altoActual());
  });
  let piePulso = null;
  pieBarra.addEventListener("pointerdown", /** @param {any} ev */ (ev) => {
    if (ev.target.closest("button") || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    ev.preventDefault();
    pieBarra.setPointerCapture(ev.pointerId);
    piePulso = { id: ev.pointerId, y0: ev.clientY, alto0: altoActual(), max: maxPie(), movido: false, alto: null };
    pieBarra.classList.add("arrastra");
  });
  pieBarra.addEventListener("pointermove", /** @param {any} ev */ (ev) => {
    if (!piePulso || ev.pointerId !== piePulso.id) return;
    const d = piePulso.y0 - ev.clientY;
    if (!piePulso.movido && Math.abs(d) < 5) return;
    piePulso.movido = true;
    const alto = Math.max(0, Math.min(piePulso.max, piePulso.alto0 + d));
    piePulso.alto = alto < PIE_MIN * .7 ? 0 : Math.max(PIE_MIN, alto);
    aplicarPie(piePulso.alto);
  });
  const soltarPie = /** @param {any} ev */ (ev) => {
    if (!piePulso || ev.pointerId !== piePulso.id) return;
    const p = piePulso; piePulso = null;
    pieBarra.classList.remove("arrastra");
    if (p.movido) guardarPie(p.alto ?? p.alto0);
    else if (ev.type === "pointerup") abrirPie(pie.dataset.abierto !== "true");
  };
  pieBarra.addEventListener("pointerup", soltarPie);
  pieBarra.addEventListener("pointercancel", soltarPie);
  pieAgarre.addEventListener("keydown", /** @param {any} ev */ (ev) => {
    const actual = altoActual();
    let a = ev.key === "ArrowUp" ? actual + 24 : ev.key === "ArrowDown" ? actual - 24 : ev.key === "Home" ? 0 : ev.key === "End" ? maxPie() : null;
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrirPie(actual === 0); return; }
    if (a == null) return;
    ev.preventDefault();
    a = a < PIE_MIN ? 0 : Math.min(a, maxPie());
    aplicarPie(a); guardarPie(a);
  });
  // Mensajes nuevos con la consola oculta: un punto en su botón.
  new MutationObserver(() => {
    const c = l.$("consola");
    if (c.children.length === 1 && c.firstElementChild.classList.contains("vacia")) { marcarNuevo(false); return; }
    if (!consolaVisible()) marcarNuevo(true);
    else bajarConsola();
  }).observe(l.$("consola"), { childList: true });
  // La ficha ⓘ avisa al cambiar de pestaña (juego.js): al ver la consola se borra la marca y baja al final.
  l.app.addEventListener("cmg:info", () => {
    if (!consolaVisible()) return;
    marcarNuevo(false);
    bajarConsola();
  });

  // ---------- Modo pantalla completa (tabletas y teléfonos) ----------
  // Mantener 2 s el botón de las cuatro esquinas lo activa o lo desactiva. Activo, la batalla y el código
  // ocupan cada uno toda la pantalla y se salta de uno a otro con </>, EJECUTAR o el botón del mapa.
  // El divisor sigue funcionando; esos botones vuelven a llevar a pantalla completa.
  const MANTENER_MS = 2000;
  const gruesa = matchMedia("(pointer: coarse)");
  let pantallaActiva = l.leer("pantalla-completa", null), panelFS = "mapa";
  const pantallaPermitida = () => l.forma === "movil" || innerWidth <= 1100 || (gruesa.matches && innerWidth <= 1400);
  const preferida = () => pantallaActiva ?? (pantallaMovil && l.forma === "movil");
  const pantallaEfectiva = () => preferida() && pantallaPermitida();
  // Reparto al cambiar de forma: el panel a pantalla completa, o el guardado.
  const repartoActual = () => pantallaEfectiva() && panelFS ? (panelFS === "mapa" ? 100 : 0) : l.leer(l.claveReparto(), l.REPARTO[l.forma]);
  function pintarTextosBotonesPantalla(ef = pantallaEfectiva()) {
    for (const b of dom.querySelectorAll(".b-pantalla")) {
      b.setAttribute("aria-label", l.t(`disposicion.pantalla.etiqueta${ef ? "_activa" : ""}`));
      b.dataset.tip = l.t(`disposicion.pantalla.tip${ef ? "_activo" : ""}`);
      b.dataset.tipCod = l.t(`disposicion.pantalla.tip_codigo${ef ? "_salir" : ""}`);
    }
  }
  function pintarTextoEstadoPantalla(ef = pantallaEfectiva()) {
    l.$("ajustes-pantalla-estado").textContent = l.t(
      `disposicion.pantalla.estado.${ef ? "activo" : pantallaActiva ? "pausado" : "inactivo"}`);
  }
  function aplicarPantalla() {
    const ok = pantallaPermitida(), ef = pantallaEfectiva(), antes = l.app.dataset.pantallaCompleta === "true";
    l.app.dataset.pantallaPermitida = String(ok);
    l.app.dataset.pantallaCompleta = String(ef);
    for (const b of dom.querySelectorAll(".b-pantalla")) {
      b.setAttribute("aria-pressed", String(ef));
    }
    pintarTextosBotonesPantalla(ef);
    pintarTextoEstadoPantalla(ef);
    l.$("ajustes-pantalla-estado").classList.toggle("activo", ef);
    return ef !== antes;
  }
  function verPanel(panel) {
    if (!pantallaEfectiva() || (panel !== "mapa" && panel !== "codigo")) return;
    panelFS = panel;
    l.aplicarReparto(panel === "mapa" ? 100 : 0);
    if (consolaVisible()) { marcarNuevo(false); bajarConsola(); }
    requestAnimationFrame(() => cmg && cmg.medirEditor());
  }
  const $avisoPantalla = dom.createElement("button");
  $avisoPantalla.type = "button"; $avisoPantalla.className = "aviso-pantalla"; $avisoPantalla.hidden = true;
  $avisoPantalla.setAttribute("role", "status");
  const $tituloAviso = dom.createElement("b"), separadorAviso = dom.createTextNode("");
  const $textoAviso = dom.createElement("span");
  $avisoPantalla.append($tituloAviso, separadorAviso, $textoAviso);
  dom.body.append($avisoPantalla);
  const TEXTOS_AVISO = {
    activado: { titulo: "disposicion.pantalla.toast.activado.titulo", texto: "disposicion.pantalla.toast.activado.texto" },
    desactivado: { titulo: "disposicion.pantalla.toast.desactivado.titulo" },
    activar: { titulo: "disposicion.pantalla.aviso.titulo", texto: "disposicion.pantalla.aviso.activar" },
    salir: { titulo: "disposicion.pantalla.aviso.titulo", texto: "disposicion.pantalla.aviso.salir" },
  };
  /** @type {any} */
  let tAvisoPantalla = 0, avisoDesde = 0, avisoPantallaActual = null;
  function pintarAvisoPantalla() {
    if (!avisoPantallaActual) return;
    const aviso = TEXTOS_AVISO[avisoPantallaActual.tipo];
    $tituloAviso.textContent = l.t(aviso.titulo);
    const texto = aviso.texto ? l.t(aviso.texto) : "";
    separadorAviso.nodeValue = texto ? " " : "";
    $textoAviso.textContent = texto;
    $textoAviso.hidden = !texto;
  }
  function avisoPantalla(tipo, info = false) {
    avisoPantallaActual = { tipo };
    pintarAvisoPantalla();
    $avisoPantalla.dataset.info = String(info);
    $avisoPantalla.hidden = false;
    avisoDesde = performance.now();
    clearTimeout(tAvisoPantalla);
    tAvisoPantalla = setTimeout(() => { $avisoPantalla.hidden = true; avisoPantallaActual = null; }, info ? 4200 : 2200);
  }
  const abrirInfoPantalla = () => { if (!l.$("info-pantalla").open) l.$("info-pantalla").showModal(); };
  // Al soltar el dedo tras mantener el botón no se abre nada por accidente.
  $avisoPantalla.addEventListener("click", () => {
    if (performance.now() - avisoDesde < 700) return;
    $avisoPantalla.hidden = true;
    const info = $avisoPantalla.dataset.info === "true";
    avisoPantallaActual = null;
    if (info) abrirInfoPantalla();
  });
  function alternarPantalla() {
    pantallaActiva = !preferida();
    l.escribir("pantalla-completa", pantallaActiva);
    aplicarPantalla();
    if (pantallaActiva) { verPanel("mapa"); avisoPantalla("activado", true); }
    else { panelFS = "mapa"; l.aplicarReparto(l.leer(l.claveReparto(), l.REPARTO[l.forma])); avisoPantalla("desactivado"); }
  }
  // Círculo grande que se llena mientras se mantiene el botón.
  const $carga = dom.createElement("div");
  $carga.className = "carga-pantalla"; $carga.hidden = true; $carga.setAttribute("aria-hidden", "true");
  $carga.innerHTML = `<svg viewBox="0 0 120 120"><circle class="fondo" cx="60" cy="60" r="52"/><circle class="relleno" cx="60" cy="60" r="52"/></svg>`
    + `<span class="icono">${dom.querySelector(".b-pantalla").innerHTML}</span><span class="txt"></span>`;
  dom.body.append($carga);
  let mantener = null;
  function pintarTextoMantener() {
    $carga.querySelector(".txt").textContent = l.t(`disposicion.pantalla.mantener.${pantallaActiva ? "salir" : "activar"}`);
  }
  function empezarMantener(id) {
    terminarMantener();
    pintarTextoMantener();
    $carga.style.setProperty("--dur", `${MANTENER_MS}ms`);
    $carga.hidden = false;
    $carga.classList.remove("llena"); void $carga.offsetWidth; $carga.classList.add("llena");
    const m = { id, hecho: false };
    m.t = setTimeout(() => { m.hecho = true; $carga.hidden = true; if (navigator.vibrate) navigator.vibrate(20); alternarPantalla(); }, MANTENER_MS);
    mantener = m;
  }
  function terminarMantener(pista = false) {
    if (!mantener) return;
    const m = mantener; mantener = null;
    clearTimeout(m.t); $carga.hidden = true; $carga.classList.remove("llena");
    if (pista && !m.hecho) avisoPantalla(pantallaActiva ? "salir" : "activar");
  }
  for (const b of dom.querySelectorAll(".b-pantalla")) {
    b.addEventListener("pointerdown", /** @param {any} ev */ (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      ev.preventDefault();
      try { b.setPointerCapture(ev.pointerId); } catch { /* sin captura: basta con los eventos del botón */ }
      empezarMantener(ev.pointerId);
    });
    b.addEventListener("pointerup", /** @param {any} ev */ (ev) => { if (mantener && mantener.id === ev.pointerId) terminarMantener(true); });
    b.addEventListener("pointercancel", /** @param {any} ev */ (ev) => { if (mantener && mantener.id === ev.pointerId) terminarMantener(); });
    b.addEventListener("contextmenu", /** @param {any} ev */ (ev) => ev.preventDefault());
    b.addEventListener("keydown", /** @param {any} ev */ (ev) => {
      if ((ev.key !== "Enter" && ev.key !== " ") || ev.repeat) return;
      ev.preventDefault(); empezarMantener("tecla");
    });
    b.addEventListener("keyup", /** @param {any} ev */ (ev) => { if ((ev.key === "Enter" || ev.key === " ") && mantener && mantener.id === "tecla") terminarMantener(true); });
    b.addEventListener("blur", () => { if (mantener && mantener.id === "tecla") terminarMantener(); });
  }
  l.$("b-ver-codigo").addEventListener("click", () => verPanel("codigo"));
  l.$("b-ver-mapa").addEventListener("click", () => verPanel("mapa"));
  l.$("b-mapa-movil").addEventListener("click", () => verPanel("mapa"));


  return Object.getOwnPropertyDescriptors({
    get aplicarPantalla() { return aplicarPantalla; },
    get repartoActual() { return repartoActual; },
    get aplicarPie() { return aplicarPie; },
    get panelFS() { return panelFS; }, set panelFS(v) { panelFS = v; },
    get verPanel() { return verPanel; },
    get abrirInfoPantalla() { return abrirInfoPantalla; },
    get pintarTextosPie() { return pintarTextosPie; },
    get pantallaEfectiva() { return pantallaEfectiva; },
    get pintarTextosBotonesPantalla() { return pintarTextosBotonesPantalla; },
    get pintarTextoEstadoPantalla() { return pintarTextoEstadoPantalla; },
    get mantener() { return mantener; },
    get pintarTextoMantener() { return pintarTextoMantener; },
    get $avisoPantalla() { return $avisoPantalla; },
    get avisoPantallaActual() { return avisoPantallaActual; },
    get pintarAvisoPantalla() { return pintarAvisoPantalla; },
  });
}
