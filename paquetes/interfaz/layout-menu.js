/** @param {any} l
 * @param {any} cmg */
export function instalarMenuFicha(l, cmg) {
  const dom = /** @type {any} */ (document);
  // ---------- Menú ⋯ de la barra del código (teléfono) ----------
  // Lo que sale de la barra superior mínima: pestañas y Ajustes. Son las mismas placas metálicas que las
  // variantes de la paleta; la pestaña actual queda encendida. El modo sin teclado tiene su botón en la barra.
  const ICO_MENU = {
    programa: '<path class="s1" d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.4 5.2l-2.8 13.6"/>',
    registro: '<rect class="s1" x="3.5" y="4.5" width="17" height="15" rx="2"/><path class="s1" d="M3.5 9.5h17M9 9.5v10M12 13h5.5M12 16.2h4"/>',
    ayuda: '<path class="s1" d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13.5H6.5A1.5 1.5 0 0 0 5 19zM5 19a1.5 1.5 0 0 0 1.5 1.5H19v-3"/><path class="s1" d="M9 8.5h6M9 12h4"/>',
    escenario: '<path class="s1" d="M12 20.5s-6.5-5.6-6.5-10.6a6.5 6.5 0 0 1 13 0c0 5-6.5 10.6-6.5 10.6z"/><circle class="s1" cx="12" cy="10" r="2.4"/>',
    // Binoculares: el modo revisión (los mismos que en la barra del mapa).
    revisar: '<circle class="s1" cx="6.5" cy="15.5" r="3.6"/><circle class="s1" cx="17.5" cy="15.5" r="3.6"/><path class="s1" d="M10.1 15.2h3.8M3.1 14.3l2.6-7.8a1.7 1.7 0 0 1 1.6-1.2h.6a1.7 1.7 0 0 1 1.7 1.7v6.4M20.9 14.3l-2.6-7.8a1.7 1.7 0 0 0-1.6-1.2h-.6a1.7 1.7 0 0 0-1.7 1.7v6.4"/>',
    ajustes: '<circle class="s1" cx="12" cy="12" r="3.1"/><path class="s1" d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3L5.6 5.6"/>',
  };
  const MENU = [
    { id: "programa", t: () => l.t("disposicion.menu.programa"), c1: "#7FA3FF" },
    { id: "registro", t: () => l.t("disposicion.menu.registro"), c1: "#63D2E0" },
    { id: "ayuda", t: () => l.t("disposicion.menu.ordenes"), c1: "#CFA2FF" },
    { id: "escenario", t: () => l.$("t-escenario").textContent.trim(), c1: "#5FC28A" },
    { id: "revisar", t: () => l.t("disposicion.menu.revisar"), c1: "#E0AE4A", fn: () => cmg.revisionJuego && cmg.revisionJuego.abrir() },
    { id: "ajustes", t: () => l.t("disposicion.menu.ajustes"), c1: "#B7C2CC", fn: l.abrirAjustes },
  ];
  const $menu = dom.createElement("div");
  $menu.id = "menu-cod"; $menu.className = "variantes menu-cod"; $menu.hidden = true;
  $menu.setAttribute("role", "menu"); $menu.setAttribute("aria-label", l.t("disposicion.menu.aria_label"));
  dom.body.append($menu);
  const $bMenu = l.$("b-menu-cod");
  function pintarTextosMenu() {
    $menu.setAttribute("aria-label", l.t("disposicion.menu.aria_label"));
    for (const m of MENU) {
      const etiqueta = $menu.querySelector(`[data-menu="${m.id}"] span`);
      if (etiqueta) etiqueta.textContent = m.t();
    }
  }
  function pintarMenu() {
    const actual = l.zonaCodigo.dataset.pestana || "programa";
    const botones = MENU.filter(m => !m.ver || m.ver()).map(m => {
      const esPestana = !m.fn, encendido = esPestana ? m.id === actual : m.activo ? m.activo() : false;
      const boton = dom.createElement("button");
      boton.type = "button";
      boton.className = `variante${encendido ? " activa" : ""}`;
      boton.setAttribute("role", "menuitem");
      boton.dataset.menu = m.id;
      boton.style.setProperty("--c1", m.c1);
      if (esPestana && encendido) boton.setAttribute("aria-current", "page");
      if (m.activo) boton.setAttribute("aria-pressed", String(encendido));
      // El HTML del icono es una constante local; todo texto visible se asigna como texto plano.
      boton.innerHTML = l.svg(ICO_MENU[m.id]);
      const etiqueta = dom.createElement("span");
      etiqueta.textContent = m.t();
      boton.append(etiqueta);
      return boton;
    });
    $menu.replaceChildren(...botones);
    pintarTextosMenu();
  }
  function colocarMenu() {
    const r = $bMenu.getBoundingClientRect(), m = $menu.getBoundingClientRect();
    const x = Math.max(6, Math.min(innerWidth - m.width - 6, r.right - m.width));
    let y = r.bottom + 6;
    if (y + m.height > innerHeight - 6) y = Math.max(6, r.top - m.height - 6);
    $menu.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function abrirMenu(si) {
    if (si) { pintarMenu(); $menu.hidden = false; colocarMenu(); }
    else { $menu.hidden = true; $menu.replaceChildren(); }
    $bMenu.setAttribute("aria-expanded", String(si));
    $bMenu.classList.toggle("abierto", si);
  }
  // pointerdown sin foco: abrir el menú no cierra el teclado ni mueve el cursor.
  $bMenu.addEventListener("pointerdown", /** @param {any} ev */ (ev) => ev.preventDefault());
  $bMenu.addEventListener("click", () => abrirMenu($menu.hidden));
  $menu.addEventListener("pointerdown", /** @param {any} ev */ (ev) => ev.preventDefault());
  $menu.addEventListener("click", /** @param {any} ev */ (ev) => {
    const b = ev.target.closest("[data-menu]"); if (!b) return;
    const m = MENU.find(x => x.id === b.dataset.menu);
    abrirMenu(false);
    if (m.fn) m.fn(); else l.$(`t-${m.id}`).click();
  });
  dom.addEventListener("pointerdown", /** @param {any} ev */ (ev) => { if (!$menu.hidden && !ev.target.closest("#menu-cod, #b-menu-cod")) abrirMenu(false); }, true);
  dom.addEventListener("keydown", /** @param {any} ev */ (ev) => { if (ev.key === "Escape" && !$menu.hidden) { abrirMenu(false); $bMenu.focus(); } });
  addEventListener("resize", () => { if (!$menu.hidden) abrirMenu(false); });

  // ---------- Modo sin teclado (teléfono) ----------
  // Interruptor en la barra superior, donde estaba comentar. edicion.js pinta su estado (clase .b-teclado).
  // Al volver al teclado, el código recupera el foco y el teclado se abre.
  const $bTeclado = l.$("b-teclado-movil");
  $bTeclado.addEventListener("pointerdown", /** @param {any} ev */ (ev) => ev.preventDefault());
  $bTeclado.addEventListener("click", () => { const e = cmg && cmg.edicion; if (e) e.activar(!e.activo, true); });
  // Al cambiar de modo, la barra de inserción vuelve al principio: allí está el conjunto principal de ese modo
  // (bloques sin teclado; edición y signos con teclado). El cambio de orden lo hace layout.css.
  new MutationObserver(() => { l.$("paleta").scrollLeft = 0; }).observe(l.app, { attributes: true, attributeFilter: ["data-sin-teclado"] });

  // ---------- Ficha ⓘ como hoja (teléfono) ----------
  // Sube desde la pestaña de la esquina inferior derecha del código. Empieza en la mitad de la pantalla (CSS);
  // cambiado con el asa, su alto se guarda como fracción del código (--info-alto): así se adapta al abrir o
  // cerrar el teclado y se recuerda entre aperturas. Soltar el asa casi abajo cierra la hoja sin olvidar el alto.
  const $info = l.$("info-reto"), $asaInfo = l.$("info-asa"), $editorCod = l.$("area-programa");
  const INFO_MIN_PX = 96, INFO_CERRAR_PX = 72;
  const fraccionInfo = (f) => Number.isFinite(f) ? Math.min(1, Math.max(.15, f)) : null;
  let altoInfo = fraccionInfo(l.leer("info-alto", null));
  const aplicarAltoInfo = (f = altoInfo) => f == null ? $info.style.removeProperty("--info-alto") : $info.style.setProperty("--info-alto", `${(f * 100).toFixed(2)}%`);
  aplicarAltoInfo();
  let arrastreInfo = null;
  $asaInfo.addEventListener("pointerdown", /** @param {any} ev */ (ev) => {
    if (l.forma !== "movil" || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    ev.preventDefault();   // el código conserva el foco: el teclado no se cierra
    try { $asaInfo.setPointerCapture(ev.pointerId); } catch { /* sin captura: basta con los eventos del asa */ }
    const r = $info.getBoundingClientRect();
    arrastreInfo = { id: ev.pointerId, desfase: ev.clientY - r.top, alto: r.height };
    $info.classList.add("arrastrando");
  });
  $asaInfo.addEventListener("pointermove", /** @param {any} ev */ (ev) => {
    if (!arrastreInfo || ev.pointerId !== arrastreInfo.id) return;
    const e = $editorCod.getBoundingClientRect();
    const alto = Math.max(0, Math.min(e.height - 30, e.bottom - (ev.clientY - arrastreInfo.desfase)));
    arrastreInfo.alto = alto;
    // Durante el arrastre la hoja puede bajar del mínimo: así se ve que soltarla ahí la cierra.
    $info.style.minHeight = "0px";
    aplicarAltoInfo(alto / e.height);
    $info.classList.toggle("por-cerrar", alto < INFO_CERRAR_PX);
  });
  function soltarAsaInfo(ev) {
    if (!arrastreInfo || ev.pointerId !== arrastreInfo.id) return;
    const { alto } = arrastreInfo, e = $editorCod.getBoundingClientRect();
    arrastreInfo = null;
    $info.classList.remove("arrastrando", "por-cerrar");
    $info.style.removeProperty("min-height");
    if (alto < INFO_CERRAR_PX) { aplicarAltoInfo(); l.$("info-reto-cerrar").click(); return; }
    altoInfo = fraccionInfo(Math.max(alto, INFO_MIN_PX) / e.height);
    aplicarAltoInfo(); l.escribir("info-alto", altoInfo);
  }
  $asaInfo.addEventListener("pointerup", soltarAsaInfo);
  $asaInfo.addEventListener("pointercancel", soltarAsaInfo);
  $asaInfo.addEventListener("lostpointercapture", soltarAsaInfo);
  $asaInfo.addEventListener("keydown", /** @param {any} ev */ (ev) => {
    const d = { ArrowUp: .05, ArrowDown: -.05, PageUp: .2, PageDown: -.2 }[ev.key];
    if (d == null) return;
    ev.preventDefault();
    altoInfo = fraccionInfo((altoInfo ?? $info.getBoundingClientRect().height / $editorCod.getBoundingClientRect().height) + d);
    aplicarAltoInfo(); l.escribir("info-alto", altoInfo);
  });
  l.app.addEventListener("cmg:pantalla", /** @param {any} ev */ (ev) => l.verPanel(ev.detail));
  // Campo girado 90° con la pantalla en vertical (la cámara lo lee de data-girar-campo).
  l.app.dataset.girarCampo = String(l.leer("pantalla-girar", true) !== false);
  l.$("ajustes-girar-campo").checked = l.app.dataset.girarCampo === "true";
  l.$("ajustes-girar-campo").addEventListener("change", /** @param {any} ev */ (ev) => { l.app.dataset.girarCampo = String(ev.target.checked); l.escribir("pantalla-girar", ev.target.checked); });
  l.$("ajustes-pantalla-info").addEventListener("click", l.abrirInfoPantalla);
  l.$("info-pantalla-cerrar").addEventListener("click", () => l.$("info-pantalla").close());


  return Object.getOwnPropertyDescriptors({
    get pintarTextosMenu() { return pintarTextosMenu; },
  });
}
