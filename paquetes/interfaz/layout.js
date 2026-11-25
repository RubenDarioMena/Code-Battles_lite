import { instalarAjusteEfectos } from './layout-efectos.js';
import { CMGTips } from '../editor/index.js';
import { instalarPanelPantalla } from './layout-panel.js';
import { instalarMenuFicha } from './layout-menu.js';
/** Distribución sobre el marcado existente; recibe el contexto de composición.
 * @param {any} ctx */
export function instalarLayout(ctx) {
  const { cmg, servicios } = ctx;
  // Con CodeMirror el textarea es un puerto oculto: el foco real lo informa el motor.
  function focoCodigo() { const c = cmg && cmg.codigo; return c?.cmgMotor ? c.cmgMotor.tieneFoco() : !!c && dom.activeElement === c; }
  const dom = /** @type {any} */ (document);
  /** @type {any} */
  const l = {};

  const $ = (id) => dom.getElementById(id);
  const t = (clave, parametros) => servicios.CMGI18n.t(clave, parametros);
  const app = $("app"), divisor = $("divisor"), zonaCodigo = $("zona-codigo");
  const svg = (cuerpo) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
  const params = new URLSearchParams(location.search);
  const forzada = ["movil", "escritorio"].includes(params.get("forma")) ? params.get("forma") : null;
  const enMarco = !ctx.batallasV2 && params.get("marco") === "1";
  const leer = (k, d) => { try { const v = ctx.plataforma.almacen.leer(`cmg-juego-${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { ctx.plataforma.almacen.escribir(`cmg-juego-${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento: no pasa nada */ } };

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
    if (!mostrar && dom.activeElement === $("coordenadas")) $("coordenadas").blur();
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
      if (oculto && panel.contains(dom.activeElement)) dom.activeElement.blur();
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
      if (l.aplicarPantalla()) aplicarReparto(l.repartoActual());
      return;
    }
    forma = f;
    eje = nuevoEje;
    app.dataset.forma = f;
    app.dataset.eje = eje;
    app.dataset.primero = primero;
    // Reordena los mismos paneles: conserva estado, selección y orden de tabulación.
    const seleccion = focoCodigo() ? [codigo().selectionStart, codigo().selectionEnd, codigo().selectionDirection] : null;
    const primerPanel = primero === "mapa" ? $("zona-mapa") : zonaCodigo;
    const segundoPanel = primero === "mapa" ? zonaCodigo : $("zona-mapa");
    app.insertBefore(primerPanel, app.firstChild);
    primerPanel.after(divisor, segundoPanel);
    if (seleccion) { codigo().focus({ preventScroll: true }); codigo().setSelectionRange(...seleccion); }
    app.dispatchEvent(new Event("cmg:forma"));
    divisor.setAttribute("aria-orientation", eje === "vertical" ? "horizontal" : "vertical");
    l.aplicarPantalla();
    aplicarReparto(l.repartoActual());
    l.aplicarPie();
    actualizarTeclado();
  }

  // El divisor se arrastra (ratón o dedo), se mueve con las flechas y vuelve al reparto inicial con doble clic.
  // Un pequeño margen facilita alcanzar los extremos con el dedo.
  const recortar = p => p <= 3 ? 0 : p >= 97 ? 100 : p;
  let arrastre = null;
  divisor.addEventListener("pointerdown", /** @param {any} ev */ (ev) => {
    divisor.setPointerCapture(ev.pointerId);
    arrastre = app.getBoundingClientRect();
    divisor.classList.add("arrastra");
    ev.preventDefault();
  });
  divisor.addEventListener("pointermove", /** @param {any} ev */ (ev) => {
    if (!arrastre) return;
    const cs = getComputedStyle(app);
    const posicion = eje === "vertical"
      ? (ev.clientY - arrastre.top - parseFloat(cs.paddingTop)) / (arrastre.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 16) * 100
      : (ev.clientX - arrastre.left - parseFloat(cs.paddingLeft)) / (arrastre.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 16) * 100;
    l.panelFS = null;
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
  function restaurarReparto() { l.panelFS = null; aplicarReparto(REPARTO[forma]); escribir(claveReparto(), REPARTO[forma]); }
  divisor.addEventListener("dblclick", restaurarReparto);
  divisor.addEventListener("keydown", /** @param {any} ev */ (ev) => {
    const menos = eje === "vertical" ? "ArrowUp" : "ArrowLeft", mas = eje === "vertical" ? "ArrowDown" : "ArrowRight";
    if (![menos, mas, "Home", "End"].includes(ev.key)) return;
    ev.preventDefault();
    const actual = Number(app.dataset.mapaPorcentaje), signo = primero === "mapa" ? 1 : -1;
    const p = ev.key === "Home" ? (primero === "mapa" ? 0 : 100) : ev.key === "End" ? (primero === "mapa" ? 100 : 0) : Math.max(0, Math.min(100, actual + (ev.key === mas ? 2 : -2) * signo));
    l.panelFS = null;
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
  instalarAjusteEfectos($("ajustes-efectos"), { leer, escribir,
    cambiar: valor => ctx.calidadEfectos.cambiar(valor) });
  const ajustes = $("ajustes"), confirmar = $("ajustes-confirmar");
  function abrirAjustes() {
    confirmar.checked = cmg.confirmarReplace;
    if (!ajustes.open) ajustes.showModal();
  }
  $("b-ajustes").addEventListener("click", abrirAjustes);
  $("ajustes-cerrar").addEventListener("click", () => ajustes.close());
  confirmar.addEventListener("change", () => { cmg.confirmarReplace = confirmar.checked; });
  $("ajustes-reparto").addEventListener("click", restaurarReparto);
  $("ajustes-orientacion").value = orientacion;
  $("ajustes-orientacion").addEventListener("change", /** @param {any} ev */ ev => {
    orientacion = ev.target.value;
    escribir("orientacion", orientacion); aplicarForma();
  });
  for (const ejePosicion of ["horizontal", "vertical"]) {
    $(`ajustes-primero-${ejePosicion}`).addEventListener("change", /** @param {any} ev */ ev => {
      ordenPorEje[ejePosicion] = ev.target.value;
      escribir(`primero-${ejePosicion}`, ev.target.value); aplicarForma();
    });
  }
  $("ajustes-coordenadas").checked = app.dataset.coordenadas === "true";
  $("ajustes-coordenadas").addEventListener("change", /** @param {any} ev */ ev => { mostrarCoordenadas(ev.target.checked); escribir("coordenadas", ev.target.checked); });
  $("b-barras").addEventListener("pointerdown", /** @param {any} ev */ ev => ev.preventDefault());
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
  const codigo = () => cmg && cmg.codigo;
  function actualizarTeclado() {
    const vv = window.visualViewport;
    const real = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    const enCodigo = focoCodigo();
    const teclado = enMarco ? simulado : real;
    const abierto = forma === "movil" && enCodigo && teclado > 100;
    if (abierto !== app.classList.contains("teclado")) expandidoTeclado = false;
    app.classList.toggle("teclado", abierto);
    aplicarBarras();
    simbolos.hidden = true;
    if (tecladoSim) tecladoSim.hidden = !(abierto && enMarco);
    dom.documentElement.style.setProperty("--teclado", `${abierto ? teclado : 0}px`);
    if (abierto) {
      const arriba = enMarco ? 0 : (vv ? vv.offsetTop : 0);
      const alto = enMarco ? innerHeight - simulado : (vv ? vv.height : innerHeight - teclado);
      app.style.setProperty("--codigo-arriba", `${arriba}px`);
      app.style.setProperty("--codigo-alto", `${Math.max(0, alto)}px`);
      requestAnimationFrame(() => cmg && cmg.medirEditor());
    } else {
      app.style.removeProperty("--codigo-arriba");
      app.style.removeProperty("--codigo-alto");
    }
  }
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", actualizarTeclado);
    visualViewport.addEventListener("scroll", actualizarTeclado);
  }
  dom.addEventListener("focusin", /** @param {any} ev */ (ev) => {
    if (ev.target !== codigo()) return;
    if (enMarco) simulado = Math.round(innerHeight * .4);
    actualizarTeclado();
    setTimeout(actualizarTeclado, 350);  // iOS termina de subir el teclado después del foco
  });
  dom.addEventListener("focusout", /** @param {any} ev */ (ev) => {
    if (ev.target !== codigo()) return;
    setTimeout(() => { if (!focoCodigo()) { simulado = 0; actualizarTeclado(); } }, 60);
  });

  // Teclado simulado (solo en probar.html): un dibujo para ver el reparto; se escribe con el teclado del PC.
  const crearTecla = (texto, clase = "") => {
    const tecla = dom.createElement("i");
    if (clase) tecla.className = clase;
    tecla.textContent = texto;
    return tecla;
  };
  const filasTeclado = [];
  for (const [i, letras] of ["qwertyuiop", "asdfghjkl", "zxcvbnm"].entries()) {
    const fila = dom.createElement("div"); fila.className = "fila";
    if (i === 2) fila.append(crearTecla("⇧", "gris"));
    for (const letra of letras) fila.append(crearTecla(letra));
    if (i === 2) fila.append(crearTecla("⌫", "gris"));
    filasTeclado.push(fila);
  }
  const filaEspecial = dom.createElement("div"); filaEspecial.className = "fila";
  filaEspecial.append(crearTecla("123", "gris"));
  teclaEspacioSim = crearTecla(t("disposicion.teclado.espacio"), "ancha");
  teclaIntroSim = crearTecla(t("disposicion.teclado.intro"), "gris");
  filaEspecial.append(teclaEspacioSim, teclaIntroSim);
  filasTeclado.push(filaEspecial);
  tecladoSim?.replaceChildren(...filasTeclado);

  // ---------- Barras de una línea ----------
  // La paleta, la barra de edición y las pestañas de información se deslizan; con ratón, la rueda vertical
  // las mueve en horizontal. Al final dejan un margen para sacar un botón de debajo de los flotantes.
  for (const barra of [$("paleta"), $("edicion"), $("info-pestanas")]) {
    barra.addEventListener("wheel", /** @param {any} ev */ (ev) => {
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
      f.addEventListener("pointerdown", /** @param {any} ev */ (ev) => ev.preventDefault());
      f.addEventListener("click", () => banda.scrollBy({ left: signo * Math.max(80, banda.clientWidth * .6), behavior: "smooth" }));
    }
    banda.addEventListener("scroll", revisar, { passive: true });
    new ResizeObserver(revisar).observe(banda);
    let arr = null;
    banda.addEventListener("pointerdown", /** @param {any} ev */ (ev) => {
      if (ev.pointerType !== "mouse" || ev.button !== 0) return;
      arr = { id: ev.pointerId, x: ev.clientX, s: banda.scrollLeft, movido: false };
      caja.classList.remove("arrastrada");
    });
    banda.addEventListener("pointermove", /** @param {any} ev */ (ev) => {
      if (!arr || ev.pointerId !== arr.id) return;
      const dx = ev.clientX - arr.x;
      if (!arr.movido && Math.abs(dx) < 5) return;
      if (!arr.movido) { arr.movido = true; banda.setPointerCapture(ev.pointerId); caja.classList.add("arrastrada"); }
      banda.scrollLeft = arr.s - dx;
    });
    const fin = /** @param {any} ev */ (ev) => {
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


  Object.defineProperties(l, Object.getOwnPropertyDescriptors({
    get $() { return $; },
    get leer() { return leer; },
    get forma() { return forma; }, set forma(v) { forma = v; },
    get zonaCodigo() { return zonaCodigo; },
    get t() { return t; },
    get escribir() { return escribir; },
    get app() { return app; },
    get claveReparto() { return claveReparto; },
    get REPARTO() { return REPARTO; },
    get aplicarReparto() { return aplicarReparto; },
    get abrirAjustes() { return abrirAjustes; },
    get svg() { return svg; },
  }));
  Object.defineProperties(l, instalarPanelPantalla(l, cmg, !!ctx.uiHito));
  Object.defineProperties(l, instalarMenuFicha(l, cmg));
  // ---------- Tooltips rápidos ----------
  // Los iconos no llevan nombre: aparece al pasar el cursor (o al tocarlos en el teléfono).
  // El módulo es compartido con el editor autónomo (paquetes/editor/tips.js).
  CMGTips.crear({ tip: $("tip") });

  function pintarTextosDisposicion() {
    const ejeActual = eje || (orientacion === "auto" ? (decidirForma() === "movil" ? "vertical" : "horizontal") : orientacion);
    pintarTextosAjustes(ejeActual);
    pintarTextoHerramientas();
    pintarTextoDivisor();
    l.pintarTextosPie();
    const ef = l.pantallaEfectiva();
    l.pintarTextosBotonesPantalla(ef);
    l.pintarTextoEstadoPantalla(ef);
    l.pintarTextosMenu();
    if (teclaEspacioSim) teclaEspacioSim.textContent = t("disposicion.teclado.espacio");
    if (teclaIntroSim) teclaIntroSim.textContent = t("disposicion.teclado.intro");
    // Repinta los textos visibles sin cancelar ni prolongar sus timers.
    if (l.mantener) l.pintarTextoMantener();
    if (!l.$avisoPantalla.hidden && l.avisoPantallaActual) l.pintarAvisoPantalla();
  }
  window.addEventListener("cmg:idioma", pintarTextosDisposicion);

  // ---------- Arranque ----------
  addEventListener("resize", () => { aplicarForma(); actualizarTeclado(); });
  aplicarForma();
}
