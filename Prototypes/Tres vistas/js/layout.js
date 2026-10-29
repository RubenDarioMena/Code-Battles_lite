/* Code Battle Lite · reparto de pantalla, teclado del teléfono, barra de símbolos y tooltips.
 * No sabe nada del juego: habla con juego.js solo a través de window.cmg (insertar, comentar, medir).
 *
 * Forma: ?forma=movil o ?forma=escritorio la fuerzan; si no, se decide por el tamaño de la ventana.
 * ?marco=1 (lo pone probar.html): dentro de un marco de teléfono se simula el teclado al escribir. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const app = $("app"), divisor = $("divisor"), zonaCodigo = $("zona-codigo");
  const params = new URLSearchParams(location.search);
  const forzada = ["movil", "escritorio"].includes(params.get("forma")) ? params.get("forma") : null;
  const enMarco = params.get("marco") === "1";
  const leer = (k, d) => { try { const v = localStorage.getItem(`cmg-banco02-ui-${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(`cmg-banco02-ui-${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento: no pasa nada */ } };

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
  function aplicarBarras() {
    const plegadas = zonaCodigo.dataset.pestana === "programa" && (app.classList.contains("teclado") ? !expandidoTeclado : barrasPlegadas);
    $("cabecera-editor").classList.toggle("plegada", plegadas);
    $("b-barras").hidden = zonaCodigo.dataset.pestana !== "programa";
    $("b-barras").setAttribute("aria-expanded", String(!plegadas));
    $("b-barras").setAttribute("aria-label", plegadas ? "Mostrar herramientas" : "Plegar herramientas");
    $("b-barras").textContent = plegadas ? "▾" : "▴";
  }
  app.dataset.inspectorMovil = "completo";
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
    for (const [panel, oculto] of [[$("zona-mapa"), p === 0], [zonaCodigo, p === 100]]) {
      if (oculto && panel.contains(document.activeElement)) document.activeElement.blur();
      panel.inert = oculto;
      panel.setAttribute("aria-hidden", String(oculto));
    }
    divisor.setAttribute("aria-valuemin", 0);
    divisor.setAttribute("aria-valuemax", 100);
    divisor.setAttribute("aria-valuenow", Math.round(p));
    divisor.setAttribute("aria-valuetext", p === 0 ? "Solo código" : p === 100 ? "Solo mapa" : `${Math.round(p)} % mapa`);
  }
  function aplicarForma() {
    const f = decidirForma();
    const nuevoEje = orientacion === "auto" ? (f === "movil" ? "vertical" : "horizontal") : orientacion;
    primero = ordenPorEje[nuevoEje];
    actualizarAjustesPantalla(nuevoEje);
    if (f === forma && nuevoEje === eje && app.dataset.primero === primero) return;
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
    aplicarReparto(leer(claveReparto(), REPARTO[f]));
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
  function restaurarReparto() { aplicarReparto(REPARTO[forma]); escribir(claveReparto(), REPARTO[forma]); }
  divisor.addEventListener("dblclick", restaurarReparto);
  divisor.addEventListener("keydown", (ev) => {
    const menos = eje === "vertical" ? "ArrowUp" : "ArrowLeft", mas = eje === "vertical" ? "ArrowDown" : "ArrowRight";
    if (![menos, mas, "Home", "End"].includes(ev.key)) return;
    ev.preventDefault();
    const actual = Number(app.dataset.mapaPorcentaje), signo = primero === "mapa" ? 1 : -1;
    const p = ev.key === "Home" ? (primero === "mapa" ? 0 : 100) : ev.key === "End" ? (primero === "mapa" ? 100 : 0) : Math.max(0, Math.min(100, actual + (ev.key === mas ? 2 : -2) * signo));
    aplicarReparto(p); escribir(claveReparto(), p);
  });

  // ---------- Ajustes ----------
  function actualizarAjustesPantalla(e) {
    const horizontal = e === "horizontal";
    $("ajustes-orientacion-nota").textContent = orientacion === "auto"
      ? `Se adapta al tamaño de la pantalla. Ahora: ${horizontal ? "izquierda y derecha" : "arriba y abajo"}.`
      : `Los paneles se mostrarán siempre ${horizontal ? "uno al lado del otro" : "uno encima del otro"}.`;
    for (const ejePosicion of ["horizontal", "vertical"]) {
      $(`ajustes-primero-${ejePosicion}`).value = ordenPorEje[ejePosicion];
      const previa = $(`ajustes-previa-${ejePosicion}`);
      previa.dataset.primero = ordenPorEje[ejePosicion];
      previa.setAttribute("aria-label", ejePosicion === "horizontal"
        ? (ordenPorEje[ejePosicion] === "mapa" ? "Mapa a la izquierda, código a la derecha" : "Código a la izquierda, mapa a la derecha")
        : (ordenPorEje[ejePosicion] === "mapa" ? "Mapa arriba, código abajo" : "Código arriba, mapa abajo"));
    }
  }
  const ajustes = $("ajustes");
  $("b-ajustes").addEventListener("click", () => {
    ajustes.showModal();
  });
  $("ajustes-cerrar").addEventListener("click", () => ajustes.close());
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
  $("b-barras").addEventListener("pointerdown", ev => ev.preventDefault());
  $("b-barras").addEventListener("click", () => {
    if (app.classList.contains("teclado")) expandidoTeclado = !expandidoTeclado;
    else { barrasPlegadas = !barrasPlegadas; escribir("barras-plegadas", barrasPlegadas); }
    aplicarBarras();
  });
  aplicarBarras();

  // ---------- Selector del reto ----------
  function cerrarRetos() { $("hoja-reto").hidden = true; $("b-reto").setAttribute("aria-expanded", "false"); }
  $("b-reto").addEventListener("click", () => {
    const abrir = $("hoja-reto").hidden;
    $("hoja-reto").hidden = !abrir;
    $("b-reto").setAttribute("aria-expanded", abrir);
  });
  $("reto-cerrar").addEventListener("click", cerrarRetos);
  document.addEventListener("keydown", ev => {
    if (ev.key !== "Escape") return;
    cerrarRetos(); $("inspector").dataset.estado = "cerrado";
  });
  // ---------- Teclado del teléfono ----------
  // Con interactive-widget=resizes-visual el teclado no encoge la página: tapa su parte de abajo.
  // El editor ocupa todo el viewport visual disponible encima de la barra de símbolos.
  const ALTO_SIMBOLOS = 46;
  const simbolos = $("simbolos"), tecladoSim = $("teclado-sim");
  let simulado = 0;
  const codigo = () => window.cmg && window.cmg.codigo;
  function actualizarTeclado() {
    const vv = window.visualViewport;
    const real = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    const enCodigo = window.cmg.modo === "js" && document.activeElement === codigo();
    const teclado = enMarco ? simulado : real;
    const abierto = forma === "movil" && enCodigo && teclado > 100;
    if (abierto !== app.classList.contains("teclado")) expandidoTeclado = false;
    app.classList.toggle("teclado", abierto);
    aplicarBarras();
    simbolos.hidden = !abierto;
    tecladoSim.hidden = !(abierto && enMarco);
    document.documentElement.style.setProperty("--teclado", `${abierto ? teclado : 0}px`);
    if (abierto) {
      const arriba = enMarco ? 0 : (vv ? vv.offsetTop : 0);
      const alto = enMarco ? innerHeight - simulado : (vv ? vv.height : innerHeight - teclado);
      app.style.setProperty("--codigo-arriba", `${arriba}px`);
      app.style.setProperty("--codigo-alto", `${Math.max(0, alto - ALTO_SIMBOLOS)}px`);
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
  tecladoSim.innerHTML = ["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((f, i) =>
    `<div class="fila">${i === 2 ? `<i class="gris">⇧</i>` : ""}${[...f].map(c => `<i>${c}</i>`).join("")}${i === 2 ? `<i class="gris">⌫</i>` : ""}</div>`).join("")
    + `<div class="fila"><i class="gris">123</i><i class="ancha">espacio</i><i class="gris">intro</i></div>`;

  // ---------- Barra de símbolos ----------
  // Lo que cuesta escribir en un teclado de teléfono: pares, operadores y palabras clave de JavaScript.
  const TECLAS = [
    { t: "⇥", ins: "  ", cls: "nav", n: "Sangría" }, { t: "←", mover: -1, cls: "nav" }, { t: "→", mover: 1, cls: "nav" }, "|",
    { t: "( )", ins: "()", sel: 1 }, { t: "{ }", ins: "{}", sel: 1 }, { t: "[ ]", ins: "[]", sel: 1 }, { t: '" "', ins: '""', sel: 1 },
    { t: ";" }, { t: "." }, { t: "," }, { t: "=" }, { t: "===" }, { t: "!==" }, { t: "<" }, { t: ">" },
    { t: "&&" }, { t: "||" }, { t: "!" }, { t: "??" }, { t: "+" }, { t: "-" }, { t: "*" }, { t: "/" }, { t: "%" }, "|",
    ...["const", "let", "if", "else", "while", "await", "true", "false", "null"].map(k => ({ t: k, ins: k + " ", cls: "kw" })), "|",
    { t: "//", comentar: true, cls: "nav" }, { t: "⌄", ocultar: true, cls: "nav", n: "Ocultar teclado" },
  ];
  simbolos.innerHTML = TECLAS.map((k, i) => k === "|" ? `<span class="sep-pal" aria-hidden="true"></span>`
    : `<button type="button" data-i="${i}" class="${k.cls || ""}" aria-label="${k.n || k.t}">${k.t}</button>`).join("");
  // pointerdown sin foco: el textarea conserva el foco y el teclado no se cierra.
  simbolos.addEventListener("pointerdown", (ev) => { if (ev.target.closest("button")) ev.preventDefault(); });
  simbolos.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-i]"); if (!b || !window.cmg) return;
    const k = TECLAS[+b.dataset.i], c = codigo();
    if (k.ocultar) { c.blur(); return; }
    if (k.comentar) { window.cmg.alternarComentario(); return; }
    if (k.mover) { const p = Math.max(0, Math.min(c.value.length, c.selectionStart + k.mover)); c.setSelectionRange(p, p); return; }
    const texto = k.ins ?? k.t;
    if (k.sel != null && window.cmg.envolver(texto.slice(0, k.sel), texto.slice(k.sel))) return;
    window.cmg.insertar(texto, k.sel, k.sel);
  });

  // ---------- Barras de una línea ----------
  // La paleta y la barra de edición se deslizan; con ratón, la rueda vertical las mueve en horizontal.
  for (const barra of [$("paleta"), $("edicion")]) {
    barra.addEventListener("wheel", (ev) => {
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX) || barra.scrollWidth <= barra.clientWidth) return;
      ev.preventDefault();
      barra.scrollLeft += ev.deltaY;
    }, { passive: false });
  }

  // ---------- Consola plegable (teléfono) ----------
  $("b-pie").addEventListener("click", () => {
    const pie = $("pie"), abierto = pie.dataset.abierto !== "true";
    pie.dataset.abierto = abierto;
    $("b-pie").setAttribute("aria-expanded", abierto);
    const con = $("consola"); con.scrollTop = con.scrollHeight;
  });

  // ---------- Tooltips rápidos ----------
  // Los iconos no llevan nombre: aparece al pasar el cursor (o al tocarlos en el teléfono).
  const tip = $("tip");
  let tipDe = null, tipT = 0, tipFuera = 0;
  function mostrarTip(el) {
    tipDe = el;
    const cod = el.dataset.tipCod;
    tip.innerHTML = `<b></b>${cod ? "<code></code>" : ""}`;
    tip.querySelector("b").textContent = el.dataset.tip;
    if (cod) tip.querySelector("code").textContent = cod;
    tip.hidden = false;
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - t.width / 2, y = r.top - t.height - 8;
    if (y < 4) y = r.bottom + 8;
    x = Math.max(6, Math.min(innerWidth - t.width - 6, x));
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function ocultarTip() { clearTimeout(tipT); tipDe = null; tip.hidden = true; }
  document.addEventListener("pointerover", (ev) => {
    if (ev.pointerType === "touch") return;
    const el = ev.target.closest("[data-tip]");
    if (el === tipDe) return;
    clearTimeout(tipT);
    if (!el) { ocultarTip(); return; }
    tipT = setTimeout(() => mostrarTip(el), tip.hidden ? 70 : 0);
  });
  document.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-tip]");
    if (ev.pointerType !== "touch") { if (!el) ocultarTip(); return; }
    if (!el) { ocultarTip(); return; }
    mostrarTip(el);
    el.classList.add("vivo");
    clearTimeout(tipFuera);
    tipFuera = setTimeout(() => { el.classList.remove("vivo"); if (tipDe === el) ocultarTip(); }, 900);
  });
  addEventListener("blur", ocultarTip);

  // ---------- Arranque ----------
  app.addEventListener("cmg:modo", actualizarTeclado);
  new MutationObserver(aplicarBarras).observe(zonaCodigo, { attributes: true, attributeFilter: ["data-pestana"] });
  addEventListener("resize", () => { aplicarForma(); actualizarTeclado(); });
  aplicarForma();
})();

