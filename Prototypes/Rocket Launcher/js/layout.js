/* Code Battle Lite · reparto de pantalla, teclado del teléfono, barra de símbolos y tooltips.
 * No sabe nada del juego: habla con juego.js solo a través de window.cmg (insertar, comentar, medir).
 *
 * Forma: ?forma=movil o ?forma=escritorio la fuerzan; si no, se decide por el tamaño de la ventana.
 * ?marco=1 (lo pone probar.html): dentro de un marco de teléfono se simula el teclado al escribir. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const t = (clave, parametros) => window.CMGI18n.t(clave, parametros);
  const app = $("app"), divisor = $("divisor"), zonaCodigo = $("zona-codigo");
  const svg = (cuerpo) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
  const params = new URLSearchParams(location.search);
  const forzada = ["movil", "escritorio"].includes(params.get("forma")) ? params.get("forma") : null;
  const enMarco = params.get("marco") === "1";
  const leer = (k, d) => { try { const v = localStorage.getItem(`cmg-juego-${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(`cmg-juego-${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento: no pasa nada */ } };

  if (enMarco) $("b-probar").hidden = true;

  // ---------- Forma y reparto ----------
  const REPARTO = { escritorio: 58, movil: 50 };
  let forma = null, eje = null;
  let orientacion = leer("orientacion", "auto"), primero = leer("primero", "mapa");
  if (!["auto", "horizontal", "vertical"].includes(orientacion)) orientacion = "auto";
  if (!["mapa", "codigo"].includes(primero)) primero = "mapa";
  // Migra la preferencia anterior; cada eje conserva después su propia posición.
  const ordenPorEje = {};
  for (const e of ["horizontal", "vertical"]) {
    const orden = leer(`primero-${e}`, primero);
    ordenPorEje[e] = ["mapa", "codigo"].includes(orden) ? orden : primero;
  }
  let barrasPlegadas = leer("barras-plegadas", false) === true, expandidoTeclado = false;
  const claveReparto = () => orientacion === "auto" ? `reparto-${forma}` : `reparto-${forma}-${eje}`;
  function pintarTextoHerramientas() {
    const plegadas = $("cabecera-editor").classList.contains("plegada");
    $("b-barras").setAttribute("aria-label", t(`disposicion.herramientas.${plegadas ? "mostrar" : "plegar"}`));
  }
  function aplicarBarras() {
    // En el teléfono la barra superior ya es mínima: no se pliega, tampoco con el teclado abierto.
    const plegadas = forma === "movil" ? false : app.classList.contains("teclado") ? !expandidoTeclado : barrasPlegadas;
    $("cabecera-editor").classList.toggle("plegada", plegadas);
    $("b-barras").setAttribute("aria-expanded", String(!plegadas));
    pintarTextoHerramientas();
    $("b-barras").textContent = plegadas ? "▾" : "▴";
  }
  function mostrarCoordenadas(mostrar) {
    app.dataset.coordenadas = String(mostrar);
    if (!mostrar && document.activeElement === $("coordenadas")) $("coordenadas").blur();
  }
  function pintarTextoDivisor() {
    const p = Number(app.dataset.mapaPorcentaje);
    const valor = p === 0
      ? t("disposicion.divisor.solo_codigo")
      : p === 100
        ? t("disposicion.divisor.solo_mapa")
        : t("disposicion.divisor.porcentaje", { porcentaje: Math.round(p) });
    divisor.setAttribute("aria-valuetext", valor);
  }
  mostrarCoordenadas(leer("coordenadas", false) === true);
  // Reserva para Settings: «tira» conserva la presentación móvil anterior.
  app.dataset.inspectorMovil = leer("inspector-movil", "completo") === "tira" ? "tira" : "completo";
  function decidirForma() {
    if (forzada) return forzada;
    const w = innerWidth, h = innerHeight;
    return w < 760 || (w < 1000 && h > w) ? "movil" : "escritorio";
  }
  function aplicarReparto(p) {
    p = Number.isFinite(Number(p)) ? Math.max(0, Math.min(100, Number(p))) : REPARTO[forma];
    app.style.setProperty("--a", `${primero === "mapa" ? p : 100 - p}fr`);
    app.style.setProperty("--b", `${primero === "mapa" ? 100 - p : p}fr`);
    app.dataset.mapaPorcentaje = p;
    app.dataset.solo = p === 0 ? "codigo" : p === 100 ? "mapa" : "";
    // Panel que ocupa la esquina superior derecha: ahí va el botón de pantalla completa.
    app.dataset.esquina = app.dataset.solo || (eje === "horizontal" ? (primero === "mapa" ? "codigo" : "mapa") : primero);
    for (const [panel, oculto] of [[$("zona-mapa"), p === 0], [zonaCodigo, p === 100]]) {
      if (oculto && panel.contains(document.activeElement)) document.activeElement.blur();
      panel.inert = oculto;
      panel.setAttribute("aria-hidden", String(oculto));
    }
    divisor.setAttribute("aria-valuemin", 0);
    divisor.setAttribute("aria-valuemax", 100);
    divisor.setAttribute("aria-valuenow", Math.round(p));
    pintarTextoDivisor();
  }
  function aplicarForma() {
    const f = decidirForma();
    const nuevoEje = orientacion === "auto" ? (f === "movil" ? "vertical" : "horizontal") : orientacion;
    primero = ordenPorEje[nuevoEje];
    actualizarAjustesPantalla(nuevoEje);
    if (f === forma && nuevoEje === eje && app.dataset.primero === primero) {
      if (aplicarPantalla()) aplicarReparto(repartoActual());
      return;
    }
    forma = f;
    eje = nuevoEje;
    app.dataset.forma = f;
    app.dataset.eje = eje;
    app.dataset.primero = primero;
    // Reordena los mismos paneles: conserva estado, selección y orden de tabulación.
    const activo = document.activeElement;
    const seleccion = activo === codigo() ? [activo.selectionStart, activo.selectionEnd, activo.selectionDirection] : null;
    const primerPanel = primero === "mapa" ? $("zona-mapa") : zonaCodigo;
    const segundoPanel = primero === "mapa" ? zonaCodigo : $("zona-mapa");
    app.insertBefore(primerPanel, app.firstChild);
    primerPanel.after(divisor, segundoPanel);
    if (seleccion) { activo.focus({ preventScroll: true }); activo.setSelectionRange(...seleccion); }
    app.dispatchEvent(new Event("cmg:forma"));
    divisor.setAttribute("aria-orientation", eje === "vertical" ? "horizontal" : "vertical");
    aplicarPantalla();
    aplicarReparto(repartoActual());
    aplicarPie();
    actualizarTeclado();
  }

  // El divisor se arrastra (ratón o dedo), se mueve con las flechas y vuelve al reparto inicial con doble clic.
  // Un pequeño margen facilita alcanzar los extremos con el dedo.
  const recortar = p => p <= 3 ? 0 : p >= 97 ? 100 : p;
  let arrastre = null;
  divisor.addEventListener("pointerdown", (ev) => {
    divisor.setPointerCapture(ev.pointerId);
    arrastre = app.getBoundingClientRect();
    divisor.classList.add("arrastra");
    ev.preventDefault();
  });
  divisor.addEventListener("pointermove", (ev) => {
    if (!arrastre) return;
    const cs = getComputedStyle(app);
    const posicion = eje === "vertical"
      ? (ev.clientY - arrastre.top - parseFloat(cs.paddingTop)) / (arrastre.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 16) * 100
      : (ev.clientX - arrastre.left - parseFloat(cs.paddingLeft)) / (arrastre.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 16) * 100;
    panelFS = null;
    aplicarReparto(recortar(primero === "mapa" ? posicion : 100 - posicion));
  });
  const soltar = () => {
    if (!arrastre) return;
    arrastre = null; divisor.classList.remove("arrastra");
    escribir(claveReparto(), Number(app.dataset.mapaPorcentaje));
  };
  divisor.addEventListener("pointerup", soltar);
  divisor.addEventListener("pointercancel", soltar);
  divisor.addEventListener("lostpointercapture", soltar);
  function restaurarReparto() { panelFS = null; aplicarReparto(REPARTO[forma]); escribir(claveReparto(), REPARTO[forma]); }
  divisor.addEventListener("dblclick", restaurarReparto);
  divisor.addEventListener("keydown", (ev) => {
    const menos = eje === "vertical" ? "ArrowUp" : "ArrowLeft", mas = eje === "vertical" ? "ArrowDown" : "ArrowRight";
    if (![menos, mas, "Home", "End"].includes(ev.key)) return;
    ev.preventDefault();
    const actual = Number(app.dataset.mapaPorcentaje), signo = primero === "mapa" ? 1 : -1;
    const p = ev.key === "Home" ? (primero === "mapa" ? 0 : 100) : ev.key === "End" ? (primero === "mapa" ? 100 : 0) : Math.max(0, Math.min(100, actual + (ev.key === mas ? 2 : -2) * signo));
    panelFS = null;
    aplicarReparto(p); escribir(claveReparto(), p);
  });

  // ---------- Ajustes ----------
  function pintarTextosAjustes(e) {
    const horizontal = e === "horizontal";
    $("ajustes-orientacion-nota").textContent = t(
      `ajustes.orientacion.${orientacion === "auto" ? "auto" : "fija"}.${horizontal ? "horizontal" : "vertical"}`);
    for (const ejePosicion of ["horizontal", "vertical"]) {
      $(`ajustes-previa-${ejePosicion}`).setAttribute("aria-label",
        t(`ajustes.previa.${ejePosicion}.${ordenPorEje[ejePosicion]}`));
    }
  }
  function actualizarAjustesPantalla(e) {
    for (const ejePosicion of ["horizontal", "vertical"]) {
      $(`ajustes-primero-${ejePosicion}`).value = ordenPorEje[ejePosicion];
      $(`ajustes-previa-${ejePosicion}`).dataset.primero = ordenPorEje[ejePosicion];
    }
    pintarTextosAjustes(e);
  }
  const ajustes = $("ajustes"), confirmar = $("ajustes-confirmar");
  function abrirAjustes() {
    confirmar.checked = window.cmg.confirmarReplace;
    if (!ajustes.open) ajustes.showModal();
  }
  $("b-ajustes").addEventListener("click", abrirAjustes);
  $("ajustes-cerrar").addEventListener("click", () => ajustes.close());
  confirmar.addEventListener("change", () => { window.cmg.confirmarReplace = confirmar.checked; });
  $("ajustes-reparto").addEventListener("click", restaurarReparto);
  $("ajustes-orientacion").value = orientacion;
  $("ajustes-orientacion").addEventListener("change", ev => {
    orientacion = ev.target.value;
    escribir("orientacion", orientacion); aplicarForma();
  });
  for (const ejePosicion of ["horizontal", "vertical"]) {
    $(`ajustes-primero-${ejePosicion}`).addEventListener("change", ev => {
      ordenPorEje[ejePosicion] = ev.target.value;
      escribir(`primero-${ejePosicion}`, ev.target.value); aplicarForma();
    });
  }
  $("ajustes-coordenadas").checked = app.dataset.coordenadas === "true";
  $("ajustes-coordenadas").addEventListener("change", ev => { mostrarCoordenadas(ev.target.checked); escribir("coordenadas", ev.target.checked); });
  $("b-barras").addEventListener("pointerdown", ev => ev.preventDefault());
  $("b-barras").addEventListener("click", () => {
    if (app.classList.contains("teclado")) expandidoTeclado = !expandidoTeclado;
    else { barrasPlegadas = !barrasPlegadas; escribir("barras-plegadas", barrasPlegadas); }
    aplicarBarras();
  });
  aplicarBarras();

  // ---------- Teclado del teléfono ----------
  // Con interactive-widget=resizes-visual el teclado no encoge la página: tapa su parte de abajo.
  // El editor ocupa todo el viewport visual disponible. Sus dos barras propias (edición con ProtoMouse
  // e inserción metálica) van al pie del código, así quedan justo encima del teclado; la antigua barra
  // de símbolos ya no hace falta: sus pares y signos son botones metálicos de la barra de inserción.
  const simbolos = $("simbolos"), tecladoSim = $("teclado-sim");
  let teclaEspacioSim = null, teclaIntroSim = null;
  let simulado = 0;
  const codigo = () => window.cmg && window.cmg.codigo;
  function actualizarTeclado() {
    const vv = window.visualViewport;
    const real = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    const enCodigo = document.activeElement && document.activeElement === codigo();
    const teclado = enMarco ? simulado : real;
    const abierto = forma === "movil" && enCodigo && teclado > 100;
    if (abierto !== app.classList.contains("teclado")) expandidoTeclado = false;
    app.classList.toggle("teclado", abierto);
    aplicarBarras();
    simbolos.hidden = true;
    tecladoSim.hidden = !(abierto && enMarco);
    document.documentElement.style.setProperty("--teclado", `${abierto ? teclado : 0}px`);
    if (abierto) {
      const arriba = enMarco ? 0 : (vv ? vv.offsetTop : 0);
      const alto = enMarco ? innerHeight - simulado : (vv ? vv.height : innerHeight - teclado);
      app.style.setProperty("--codigo-arriba", `${arriba}px`);
      app.style.setProperty("--codigo-alto", `${Math.max(0, alto)}px`);
      requestAnimationFrame(() => window.cmg && window.cmg.medirEditor());
    } else {
      app.style.removeProperty("--codigo-arriba");
      app.style.removeProperty("--codigo-alto");
    }
  }
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", actualizarTeclado);
    visualViewport.addEventListener("scroll", actualizarTeclado);
  }
  document.addEventListener("focusin", (ev) => {
    if (ev.target !== codigo()) return;
    if (enMarco) simulado = Math.round(innerHeight * .4);
    actualizarTeclado();
    setTimeout(actualizarTeclado, 350);  // iOS termina de subir el teclado después del foco
  });
  document.addEventListener("focusout", (ev) => {
    if (ev.target !== codigo()) return;
    setTimeout(() => { if (document.activeElement !== codigo()) { simulado = 0; actualizarTeclado(); } }, 60);
  });

  // Teclado simulado (solo en probar.html): un dibujo para ver el reparto; se escribe con el teclado del PC.
  const crearTecla = (texto, clase = "") => {
    const tecla = document.createElement("i");
    if (clase) tecla.className = clase;
    tecla.textContent = texto;
    return tecla;
  };
  const filasTeclado = [];
  for (const [i, letras] of ["qwertyuiop", "asdfghjkl", "zxcvbnm"].entries()) {
    const fila = document.createElement("div"); fila.className = "fila";
    if (i === 2) fila.append(crearTecla("⇧", "gris"));
    for (const letra of letras) fila.append(crearTecla(letra));
    if (i === 2) fila.append(crearTecla("⌫", "gris"));
    filasTeclado.push(fila);
  }
  const filaEspecial = document.createElement("div"); filaEspecial.className = "fila";
  filaEspecial.append(crearTecla("123", "gris"));
  teclaEspacioSim = crearTecla(t("disposicion.teclado.espacio"), "ancha");
  teclaIntroSim = crearTecla(t("disposicion.teclado.intro"), "gris");
  filaEspecial.append(teclaEspacioSim, teclaIntroSim);
  filasTeclado.push(filaEspecial);
  tecladoSim.replaceChildren(...filasTeclado);

  // ---------- Barras de una línea ----------
  // La paleta, la barra de edición y las pestañas de información se deslizan; con ratón, la rueda vertical
  // las mueve en horizontal. Al final dejan un margen para sacar un botón de debajo de los flotantes.
  for (const barra of [$("paleta"), $("edicion"), $("info-pestanas")]) {
    barra.addEventListener("wheel", (ev) => {
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX) || barra.scrollWidth <= barra.clientWidth) return;
      ev.preventDefault();
      barra.scrollLeft += ev.deltaY;
    }, { passive: false });
  }

  // Tiras con flechas: la flecha aparece mientras queda algo por ese lado y, al pulsarla, desliza la tira.
  // Con ratón también se arrastra (un arrastre no cuenta como clic sobre una pestaña).
  function tira(caja) {
    const banda = caja.querySelector('[role="tablist"]'), izq = caja.querySelector(".tira-flecha.izq"), der = caja.querySelector(".tira-flecha.der");
    const revisar = () => {
      const max = banda.scrollWidth - banda.clientWidth;
      izq.hidden = banda.scrollLeft <= 2;
      der.hidden = banda.scrollLeft >= max - 2;
    };
    for (const [f, signo] of [[izq, -1], [der, 1]]) {
      f.addEventListener("pointerdown", (ev) => ev.preventDefault());
      f.addEventListener("click", () => banda.scrollBy({ left: signo * Math.max(80, banda.clientWidth * .6), behavior: "smooth" }));
    }
    banda.addEventListener("scroll", revisar, { passive: true });
    new ResizeObserver(revisar).observe(banda);
    let arr = null;
    banda.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType !== "mouse" || ev.button !== 0) return;
      arr = { id: ev.pointerId, x: ev.clientX, s: banda.scrollLeft, movido: false };
      caja.classList.remove("arrastrada");
    });
    banda.addEventListener("pointermove", (ev) => {
      if (!arr || ev.pointerId !== arr.id) return;
      const dx = ev.clientX - arr.x;
      if (!arr.movido && Math.abs(dx) < 5) return;
      if (!arr.movido) { arr.movido = true; banda.setPointerCapture(ev.pointerId); caja.classList.add("arrastrada"); }
      banda.scrollLeft = arr.s - dx;
    });
    const fin = (ev) => {
      if (!arr || ev.pointerId !== arr.id) return;
      arr = null;
      // El clic llega justo después: la marca lo anula y se quita en el siguiente ciclo.
      setTimeout(() => caja.classList.remove("arrastrada"), 0);
    };
    banda.addEventListener("pointerup", fin);
    banda.addEventListener("pointercancel", fin);
    revisar();
  }
  tira($("info-tira"));

  // ---------- Panel inferior: inspector del programa (por defecto) o consola ----------
  // Su barra se arrastra como el divisor: llevarla hasta abajo lo cierra del todo; un toque en la barra
  // o el botón ▾/▴ lo cierra o lo recupera con su último alto. Alto y contenido se guardan por forma.
  const pie = $("pie"), pieCuerpo = $("pie-cuerpo"), pieBarra = $("pie-barra"), pieAgarre = $("pie-agarre"), bPie = $("b-pie");
  const PIE = { escritorio: 170, movil: 0 }, PIE_ABRIR = { escritorio: 170, movil: 130 }, PIE_MIN = 48;
  let pieModo = leer("pie-modo", "inspector") === "consola" ? "consola" : "inspector";
  const numero = (v, d) => Number.isFinite(Number(v)) ? Number(v) : d;
  const altoPie = () => Math.max(0, numero(leer(`pie-alto-${forma}`, PIE[forma]), PIE[forma]));
  const altoActual = () => pie.dataset.abierto === "true" ? pieCuerpo.getBoundingClientRect().height : 0;
  // El editor conserva unas líneas a la vista.
  const maxPie = () => Math.max(PIE_MIN, $("v-programa").getBoundingClientRect().height - pieBarra.offsetHeight - 90);
  // En el teléfono la consola es una pestaña de la ficha ⓘ: el aviso de mensajes nuevos va en ese botón y en la pestaña.
  let hayNuevo = false;
  const marcarNuevo = (si = hayNuevo) => {
    hayNuevo = si;
    pie.querySelector('[data-pie-modo="consola"]').classList.toggle("con-nuevo", si);
    $("b-info-reto").classList.toggle("con-nuevo", si && forma === "movil");
    $("info-t-consola").dataset.estado = si ? "nueva" : "";
  };
  const consolaEnFicha = () => !$("info-reto").hidden && $("info-t-consola").getAttribute("aria-selected") === "true";
  const consolaVisible = () => !zonaCodigo.inert && $("consola").getClientRects().length > 0
    && (forma === "movil" ? consolaEnFicha() : pieModo === "consola" && pie.dataset.abierto === "true");
  function bajarConsola() {
    const c = $("consola"), cont = $("pie-con");
    c.scrollTop = c.scrollHeight;
    // En la ficha, la consola crece con sus mensajes y quien se desplaza es pie-con. Lleva el último
    // mensaje a la vista sin saltar a los ajustes que vienen después ni desplazar el resto de la página.
    const ultimo = c.lastElementChild;
    if (ultimo) cont.scrollTop += ultimo.getBoundingClientRect().bottom - cont.getBoundingClientRect().bottom + 4;
  }
  function pintarTextosPie() {
    const abierto = pie.dataset.abierto === "true";
    const clave = abierto ? "cerrar" : "abrir";
    bPie.setAttribute("aria-label", t(`disposicion.panel.${clave}`));
    bPie.dataset.tip = t(`disposicion.panel.${clave}`);
    const alto = Number(pieAgarre.getAttribute("aria-valuenow")) || 0;
    pieAgarre.setAttribute("aria-valuetext", abierto
      ? t("disposicion.panel.alto", { alto })
      : t("disposicion.panel.cerrado"));
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
    if (abierto && pieModo === "consola" && forma !== "movil") { marcarNuevo(false); bajarConsola(); }
    else marcarNuevo();
    requestAnimationFrame(() => window.cmg && window.cmg.medirEditor());
  }
  function guardarPie(alto) {
    escribir(`pie-alto-${forma}`, Math.round(alto));
    if (alto > 0) escribir(`pie-ultimo-${forma}`, Math.round(alto));
  }
  function abrirPie(si) {
    const alto = si ? Math.max(PIE_MIN, numero(leer(`pie-ultimo-${forma}`, PIE_ABRIR[forma]), PIE_ABRIR[forma])) : 0;
    aplicarPie(alto); guardarPie(alto);
  }
  bPie.addEventListener("click", () => abrirPie(pie.dataset.abierto !== "true"));
  pie.querySelector(".pie-modos").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-pie-modo]"); if (!b) return;
    pieModo = b.dataset.pieModo; escribir("pie-modo", pieModo);
    if (pie.dataset.abierto !== "true") abrirPie(true); else aplicarPie(altoActual());
  });
  let piePulso = null;
  pieBarra.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest("button") || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    ev.preventDefault();
    pieBarra.setPointerCapture(ev.pointerId);
    piePulso = { id: ev.pointerId, y0: ev.clientY, alto0: altoActual(), max: maxPie(), movido: false, alto: null };
    pieBarra.classList.add("arrastra");
  });
  pieBarra.addEventListener("pointermove", (ev) => {
    if (!piePulso || ev.pointerId !== piePulso.id) return;
    const d = piePulso.y0 - ev.clientY;
    if (!piePulso.movido && Math.abs(d) < 5) return;
    piePulso.movido = true;
    const alto = Math.max(0, Math.min(piePulso.max, piePulso.alto0 + d));
    piePulso.alto = alto < PIE_MIN * .7 ? 0 : Math.max(PIE_MIN, alto);
    aplicarPie(piePulso.alto);
  });
  const soltarPie = (ev) => {
    if (!piePulso || ev.pointerId !== piePulso.id) return;
    const p = piePulso; piePulso = null;
    pieBarra.classList.remove("arrastra");
    if (p.movido) guardarPie(p.alto ?? p.alto0);
    else if (ev.type === "pointerup") abrirPie(pie.dataset.abierto !== "true");
  };
  pieBarra.addEventListener("pointerup", soltarPie);
  pieBarra.addEventListener("pointercancel", soltarPie);
  pieAgarre.addEventListener("keydown", (ev) => {
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
    const c = $("consola");
    if (c.children.length === 1 && c.firstElementChild.classList.contains("vacia")) { marcarNuevo(false); return; }
    if (!consolaVisible()) marcarNuevo(true);
    else bajarConsola();
  }).observe($("consola"), { childList: true });
  // La ficha ⓘ avisa al cambiar de pestaña (juego.js): al ver la consola se borra la marca y baja al final.
  app.addEventListener("cmg:info", () => {
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
  let pantallaActiva = leer("pantalla-completa", false) === true, panelFS = "mapa";
  const pantallaPermitida = () => forma === "movil" || innerWidth <= 1100 || (gruesa.matches && innerWidth <= 1400);
  const pantallaEfectiva = () => pantallaActiva && pantallaPermitida();
  // Reparto al cambiar de forma: el panel a pantalla completa, o el guardado.
  const repartoActual = () => pantallaEfectiva() && panelFS ? (panelFS === "mapa" ? 100 : 0) : leer(claveReparto(), REPARTO[forma]);
  function pintarTextosBotonesPantalla(ef = pantallaEfectiva()) {
    for (const b of document.querySelectorAll(".b-pantalla")) {
      b.setAttribute("aria-label", t(`disposicion.pantalla.etiqueta${ef ? "_activa" : ""}`));
      b.dataset.tip = t(`disposicion.pantalla.tip${ef ? "_activo" : ""}`);
      b.dataset.tipCod = t(`disposicion.pantalla.tip_codigo${ef ? "_salir" : ""}`);
    }
  }
  function pintarTextoEstadoPantalla(ef = pantallaEfectiva()) {
    $("ajustes-pantalla-estado").textContent = t(
      `disposicion.pantalla.estado.${ef ? "activo" : pantallaActiva ? "pausado" : "inactivo"}`);
  }
  function aplicarPantalla() {
    const ok = pantallaPermitida(), ef = pantallaActiva && ok, antes = app.dataset.pantallaCompleta === "true";
    app.dataset.pantallaPermitida = String(ok);
    app.dataset.pantallaCompleta = String(ef);
    for (const b of document.querySelectorAll(".b-pantalla")) {
      b.setAttribute("aria-pressed", String(ef));
    }
    pintarTextosBotonesPantalla(ef);
    pintarTextoEstadoPantalla(ef);
    $("ajustes-pantalla-estado").classList.toggle("activo", ef);
    return ef !== antes;
  }
  function verPanel(panel) {
    if (!pantallaEfectiva() || (panel !== "mapa" && panel !== "codigo")) return;
    panelFS = panel;
    aplicarReparto(panel === "mapa" ? 100 : 0);
    if (consolaVisible()) { marcarNuevo(false); bajarConsola(); }
    requestAnimationFrame(() => window.cmg && window.cmg.medirEditor());
  }
  const $avisoPantalla = document.createElement("button");
  $avisoPantalla.type = "button"; $avisoPantalla.className = "aviso-pantalla"; $avisoPantalla.hidden = true;
  $avisoPantalla.setAttribute("role", "status");
  const $tituloAviso = document.createElement("b"), separadorAviso = document.createTextNode("");
  const $textoAviso = document.createElement("span");
  $avisoPantalla.append($tituloAviso, separadorAviso, $textoAviso);
  document.body.append($avisoPantalla);
  const TEXTOS_AVISO = {
    activado: { titulo: "disposicion.pantalla.toast.activado.titulo", texto: "disposicion.pantalla.toast.activado.texto" },
    desactivado: { titulo: "disposicion.pantalla.toast.desactivado.titulo" },
    activar: { titulo: "disposicion.pantalla.aviso.titulo", texto: "disposicion.pantalla.aviso.activar" },
    salir: { titulo: "disposicion.pantalla.aviso.titulo", texto: "disposicion.pantalla.aviso.salir" },
  };
  let tAvisoPantalla = 0, avisoDesde = 0, avisoPantallaActual = null;
  function pintarAvisoPantalla() {
    if (!avisoPantallaActual) return;
    const aviso = TEXTOS_AVISO[avisoPantallaActual.tipo];
    $tituloAviso.textContent = t(aviso.titulo);
    const texto = aviso.texto ? t(aviso.texto) : "";
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
  const abrirInfoPantalla = () => { if (!$("info-pantalla").open) $("info-pantalla").showModal(); };
  // Al soltar el dedo tras mantener el botón no se abre nada por accidente.
  $avisoPantalla.addEventListener("click", () => {
    if (performance.now() - avisoDesde < 700) return;
    $avisoPantalla.hidden = true;
    const info = $avisoPantalla.dataset.info === "true";
    avisoPantallaActual = null;
    if (info) abrirInfoPantalla();
  });
  function alternarPantalla() {
    pantallaActiva = !pantallaActiva;
    escribir("pantalla-completa", pantallaActiva);
    aplicarPantalla();
    if (pantallaActiva) { verPanel("mapa"); avisoPantalla("activado", true); }
    else { panelFS = "mapa"; aplicarReparto(leer(claveReparto(), REPARTO[forma])); avisoPantalla("desactivado"); }
  }
  // Círculo grande que se llena mientras se mantiene el botón.
  const $carga = document.createElement("div");
  $carga.className = "carga-pantalla"; $carga.hidden = true; $carga.setAttribute("aria-hidden", "true");
  $carga.innerHTML = `<svg viewBox="0 0 120 120"><circle class="fondo" cx="60" cy="60" r="52"/><circle class="relleno" cx="60" cy="60" r="52"/></svg>`
    + `<span class="icono">${document.querySelector(".b-pantalla").innerHTML}</span><span class="txt"></span>`;
  document.body.append($carga);
  let mantener = null;
  function pintarTextoMantener() {
    $carga.querySelector(".txt").textContent = t(`disposicion.pantalla.mantener.${pantallaActiva ? "salir" : "activar"}`);
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
  for (const b of document.querySelectorAll(".b-pantalla")) {
    b.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      ev.preventDefault();
      try { b.setPointerCapture(ev.pointerId); } catch { /* sin captura: basta con los eventos del botón */ }
      empezarMantener(ev.pointerId);
    });
    b.addEventListener("pointerup", (ev) => { if (mantener && mantener.id === ev.pointerId) terminarMantener(true); });
    b.addEventListener("pointercancel", (ev) => { if (mantener && mantener.id === ev.pointerId) terminarMantener(); });
    b.addEventListener("contextmenu", (ev) => ev.preventDefault());
    b.addEventListener("keydown", (ev) => {
      if ((ev.key !== "Enter" && ev.key !== " ") || ev.repeat) return;
      ev.preventDefault(); empezarMantener("tecla");
    });
    b.addEventListener("keyup", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && mantener && mantener.id === "tecla") terminarMantener(true); });
    b.addEventListener("blur", () => { if (mantener && mantener.id === "tecla") terminarMantener(); });
  }
  $("b-ver-codigo").addEventListener("click", () => verPanel("codigo"));
  $("b-ver-mapa").addEventListener("click", () => verPanel("mapa"));
  $("b-mapa-movil").addEventListener("click", () => verPanel("mapa"));

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
    { id: "programa", t: () => t("disposicion.menu.programa"), c1: "#7FA3FF" },
    { id: "registro", t: () => t("disposicion.menu.registro"), c1: "#63D2E0" },
    { id: "ayuda", t: () => t("disposicion.menu.ordenes"), c1: "#CFA2FF" },
    { id: "escenario", t: () => $("t-escenario").textContent.trim(), c1: "#5FC28A" },
    { id: "revisar", t: () => t("disposicion.menu.revisar"), c1: "#E0AE4A", fn: () => window.CMGRevisionJuego && window.CMGRevisionJuego.abrir(), ver: () => !(window.cmg && window.cmg.serie === "factory") },
    { id: "ajustes", t: () => t("disposicion.menu.ajustes"), c1: "#B7C2CC", fn: abrirAjustes },
  ];
  const $menu = document.createElement("div");
  $menu.id = "menu-cod"; $menu.className = "variantes menu-cod"; $menu.hidden = true;
  $menu.setAttribute("role", "menu"); $menu.setAttribute("aria-label", t("disposicion.menu.aria_label"));
  document.body.append($menu);
  const $bMenu = $("b-menu-cod");
  function pintarTextosMenu() {
    $menu.setAttribute("aria-label", t("disposicion.menu.aria_label"));
    for (const m of MENU) {
      const etiqueta = $menu.querySelector(`[data-menu="${m.id}"] span`);
      if (etiqueta) etiqueta.textContent = m.t();
    }
  }
  function pintarMenu() {
    const actual = zonaCodigo.dataset.pestana || "programa";
    const botones = MENU.filter(m => !m.ver || m.ver()).map(m => {
      const esPestana = !m.fn, encendido = esPestana ? m.id === actual : m.activo ? m.activo() : false;
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = `variante${encendido ? " activa" : ""}`;
      boton.setAttribute("role", "menuitem");
      boton.dataset.menu = m.id;
      boton.style.setProperty("--c1", m.c1);
      if (esPestana && encendido) boton.setAttribute("aria-current", "page");
      if (m.activo) boton.setAttribute("aria-pressed", String(encendido));
      // El HTML del icono es una constante local; todo texto visible se asigna como texto plano.
      boton.innerHTML = svg(ICO_MENU[m.id]);
      const etiqueta = document.createElement("span");
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
  $bMenu.addEventListener("pointerdown", (ev) => ev.preventDefault());
  $bMenu.addEventListener("click", () => abrirMenu($menu.hidden));
  $menu.addEventListener("pointerdown", (ev) => ev.preventDefault());
  $menu.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-menu]"); if (!b) return;
    const m = MENU.find(x => x.id === b.dataset.menu);
    abrirMenu(false);
    if (m.fn) m.fn(); else $(`t-${m.id}`).click();
  });
  document.addEventListener("pointerdown", (ev) => { if (!$menu.hidden && !ev.target.closest("#menu-cod, #b-menu-cod")) abrirMenu(false); }, true);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$menu.hidden) { abrirMenu(false); $bMenu.focus(); } });
  addEventListener("resize", () => { if (!$menu.hidden) abrirMenu(false); });

  // ---------- Modo sin teclado (teléfono) ----------
  // Interruptor en la barra superior, donde estaba comentar. edicion.js pinta su estado (clase .b-teclado).
  // Al volver al teclado, el código recupera el foco y el teclado se abre.
  const $bTeclado = $("b-teclado-movil");
  $bTeclado.addEventListener("pointerdown", (ev) => ev.preventDefault());
  $bTeclado.addEventListener("click", () => { const e = window.cmg && window.cmg.edicion; if (e) e.activar(!e.activo, true); });
  // Al cambiar de modo, la barra de inserción vuelve al principio: allí está el conjunto principal de ese modo
  // (bloques sin teclado; edición y signos con teclado). El cambio de orden lo hace layout.css.
  new MutationObserver(() => { $("paleta").scrollLeft = 0; }).observe(app, { attributes: true, attributeFilter: ["data-sin-teclado"] });

  // ---------- Ficha ⓘ como hoja (teléfono) ----------
  // Sube desde la pestaña de la esquina inferior derecha del código. Empieza en la mitad de la pantalla (CSS);
  // cambiado con el asa, su alto se guarda como fracción del código (--info-alto): así se adapta al abrir o
  // cerrar el teclado y se recuerda entre aperturas. Soltar el asa casi abajo cierra la hoja sin olvidar el alto.
  const $info = $("info-reto"), $asaInfo = $("info-asa"), $editorCod = $("area-programa");
  const INFO_MIN_PX = 96, INFO_CERRAR_PX = 72;
  const fraccionInfo = (f) => Number.isFinite(f) ? Math.min(1, Math.max(.15, f)) : null;
  let altoInfo = fraccionInfo(leer("info-alto", null));
  const aplicarAltoInfo = (f = altoInfo) => f == null ? $info.style.removeProperty("--info-alto") : $info.style.setProperty("--info-alto", `${(f * 100).toFixed(2)}%`);
  aplicarAltoInfo();
  let arrastreInfo = null;
  $asaInfo.addEventListener("pointerdown", (ev) => {
    if (forma !== "movil" || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    ev.preventDefault();   // el código conserva el foco: el teclado no se cierra
    try { $asaInfo.setPointerCapture(ev.pointerId); } catch { /* sin captura: basta con los eventos del asa */ }
    const r = $info.getBoundingClientRect();
    arrastreInfo = { id: ev.pointerId, desfase: ev.clientY - r.top, alto: r.height };
    $info.classList.add("arrastrando");
  });
  $asaInfo.addEventListener("pointermove", (ev) => {
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
    if (alto < INFO_CERRAR_PX) { aplicarAltoInfo(); $("info-reto-cerrar").click(); return; }
    altoInfo = fraccionInfo(Math.max(alto, INFO_MIN_PX) / e.height);
    aplicarAltoInfo(); escribir("info-alto", altoInfo);
  }
  $asaInfo.addEventListener("pointerup", soltarAsaInfo);
  $asaInfo.addEventListener("pointercancel", soltarAsaInfo);
  $asaInfo.addEventListener("lostpointercapture", soltarAsaInfo);
  $asaInfo.addEventListener("keydown", (ev) => {
    const d = { ArrowUp: .05, ArrowDown: -.05, PageUp: .2, PageDown: -.2 }[ev.key];
    if (d == null) return;
    ev.preventDefault();
    altoInfo = fraccionInfo((altoInfo ?? $info.getBoundingClientRect().height / $editorCod.getBoundingClientRect().height) + d);
    aplicarAltoInfo(); escribir("info-alto", altoInfo);
  });
  app.addEventListener("cmg:pantalla", (ev) => verPanel(ev.detail));
  // Campo girado 90° con la pantalla en vertical (la cámara lo lee de data-girar-campo).
  app.dataset.girarCampo = String(leer("pantalla-girar", true) !== false);
  $("ajustes-girar-campo").checked = app.dataset.girarCampo === "true";
  $("ajustes-girar-campo").addEventListener("change", (ev) => { app.dataset.girarCampo = String(ev.target.checked); escribir("pantalla-girar", ev.target.checked); });
  $("ajustes-pantalla-info").addEventListener("click", abrirInfoPantalla);
  $("info-pantalla-cerrar").addEventListener("click", () => $("info-pantalla").close());

  // ---------- Tooltips rápidos ----------
  // Los iconos no llevan nombre: aparece al pasar el cursor (o al tocarlos en el teléfono).
  // El módulo es compartido con el editor autónomo (shared/editor/tips.js).
  window.CMGTips.crear({ tip: $("tip") });

  function pintarTextosDisposicion() {
    const ejeActual = eje || (orientacion === "auto" ? (decidirForma() === "movil" ? "vertical" : "horizontal") : orientacion);
    pintarTextosAjustes(ejeActual);
    pintarTextoHerramientas();
    pintarTextoDivisor();
    pintarTextosPie();
    const ef = pantallaEfectiva();
    pintarTextosBotonesPantalla(ef);
    pintarTextoEstadoPantalla(ef);
    pintarTextosMenu();
    if (teclaEspacioSim) teclaEspacioSim.textContent = t("disposicion.teclado.espacio");
    if (teclaIntroSim) teclaIntroSim.textContent = t("disposicion.teclado.intro");
    // Repinta los textos visibles sin cancelar ni prolongar sus timers.
    if (mantener) pintarTextoMantener();
    if (!$avisoPantalla.hidden && avisoPantallaActual) pintarAvisoPantalla();
  }
  window.addEventListener("cmg:idioma", pintarTextosDisposicion);

  // ---------- Arranque ----------
  addEventListener("resize", () => { aplicarForma(); actualizarTeclado(); });
  aplicarForma();
})();
