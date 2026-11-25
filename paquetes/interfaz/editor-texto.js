
/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarEditorTexto(ctx) {
  // ---------- Editor de texto ----------
  const $codigo = ctx.$("codigo"), $gutter = ctx.$("gutter"), $banda = ctx.$("banda"), $espejo = ctx.$("espejo"), $resaltado = ctx.$("resaltado"), $bloques = ctx.$("bloques");
  function pintarBanda() {
    const corre = !ctx.edicion.mixto && ctx.lineaCorre[ctx.progSel], err = !ctx.edicion.mixto && ctx.lineaErr && ctx.lineaErr.id === ctx.progSel ? ctx.lineaErr.linea : null;
    ctx.editorPrograma.marcas(ctx.editorPrograma.documento().revision, [{ linea: corre, clase: "corre" }, { linea: err, clase: "err" }]);
  }
  function pintarMarcasYa() { ctx.marcasSucias = false; pintarBanda(); ctx.pintarProgs(); }
  // En modo pantalla completa, layout.js pone a pantalla completa el panel pedido.
  const verPanel = (panel) => ctx.$("app").dispatchEvent(new CustomEvent("cmg:pantalla", { detail: panel }));
  function irALinea(l) { verPanel("codigo"); ctx.abrirPestana("programa"); ctx.editorPrograma.irALinea(l); }
  $codigo.addEventListener("input", () => {
    if (!ctx.edicion.mixto) for (const id of ctx.edicion.ids) ctx.ponerTexto(id, $codigo.value);
    else ctx.borradoresMulti.set(ctx.claveEdicion(ctx.edicion.ids) + ":" + ctx.edicion.lenguaje, $codigo.value);
    if (ctx.lineaErr && ctx.lineaErr.id === ctx.progSel) { ctx.lineaErr = null; ctx.marcasSucias = true; }
    ctx.medirEditor();
    if (!ctx.edicion.mixto) ctx.guardarProgramas();
  });
  function insertarRef(ins, fin) {
    ctx.abrirPestana("programa");
    if (ctx.edicionBloqueada) { ctx.avisoEditor("Detén el programa para editarlo."); return; }
    if (ctx.$("app").dataset.modo === "pseudo") { ctx.avisoEditor("En seudocódigo toca un valor del programa para cambiarlo, o usa los ladrillos."); return; }
    const v = $codigo.value, a = $codigo.selectionStart, b = $codigo.selectionEnd;
    const finLinea = v.indexOf("\n", b) < 0 ? v.length : v.indexOf("\n", b);
    const py = ctx.edicion.lenguaje === "python", RE = py ? ctx.CMGAdaptadorPython.hueco.re : ctx.RE_HUECO;
    let texto = py ? ctx.aPython(ins) : ins;
    if (/^".*"$/.test(texto) && v[a - 1] === '"' && v[b] === '"') texto = texto.slice(1, -1);
    if (fin && !v.slice(b, finLinea).trim()) texto += " " + (py ? ctx.aPython(fin) : fin);
    const h = texto.search(RE);
    if (h >= 0 && ctx.envolver(texto.slice(0, h), texto.slice(h + texto.slice(h).match(RE)[0].length))) return;
    if (h >= 0) { const m = texto.slice(h).match(RE)[0]; ctx.insertar(texto, h, h + m.length); }
    else { ctx.insertar(texto); ctx.seleccionarHueco(); }
  }

  // Colores y letra: botones de la cabecera en PC y, en todas las formas, Ajustes → Editor
  // (en el teléfono solo allí, para dejar la barra del código mínima).
  function ponerColores(si) {
    ctx.colores = !!si; ctx.guardado.escribir("colores", ctx.colores);
    ctx.$("b-colores").setAttribute("aria-pressed", ctx.colores);
    ctx.$("ajustes-colores").checked = ctx.colores;
    ctx.$editor.classList.toggle("colores", ctx.colores); ctx.pintarResaltado();
  }
  ctx.$("b-colores").setAttribute("aria-pressed", ctx.colores);
  ctx.$("ajustes-colores").checked = ctx.colores;
  ctx.$editor.classList.toggle("colores", ctx.colores);
  ctx.$("b-colores").addEventListener("click", () => ponerColores(!ctx.colores));
  ctx.$("ajustes-colores").addEventListener("change", (ev) => ponerColores(ev.target.checked));
  const TAMANOS = [12, 13, 14, 16, 18];
  function aplicarLetra() {
    /** @type {HTMLElement} */ (document.querySelector(".app")).style.setProperty("--code-size", `${ctx.tamLetra}px`); ctx.guardado.escribir("letra", ctx.tamLetra); ctx.medirEditor();
    for (const b of document.querySelectorAll("#ajustes-letra [data-letra]")) b.setAttribute("aria-pressed", String(+/** @type {HTMLElement} */ (b).dataset.letra === ctx.tamLetra));
  }
  ctx.$("b-menos").addEventListener("click", () => { const i = TAMANOS.indexOf(ctx.tamLetra); ctx.tamLetra = TAMANOS[Math.max(0, (i < 0 ? 2 : i) - 1)]; aplicarLetra(); });
  ctx.$("b-mas").addEventListener("click", () => { const i = TAMANOS.indexOf(ctx.tamLetra); ctx.tamLetra = TAMANOS[Math.min(TAMANOS.length - 1, (i < 0 ? 2 : i) + 1)]; aplicarLetra(); });
  ctx.$("ajustes-letra").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-letra]");
    if (b && TAMANOS.includes(+/** @type {HTMLElement} */ (b).dataset.letra)) { ctx.tamLetra = +/** @type {HTMLElement} */ (b).dataset.letra; aplicarLetra(); }
  });

  // Cómo se muestra cada console
  const DESTINOS = [["globo", "partida.ruteo.globo"], ["pantalla", "partida.ruteo.pantalla"], ["consola", "partida.ruteo.solo_consola"]];
  function actualizarEtiquetasRuteo() {
    for (const boton of ctx.$("ruteo").querySelectorAll("[data-dest]")) {
      const destino = DESTINOS.find(([valor]) => valor === boton.dataset.dest);
      if (destino) boton.textContent = ctx.ti18n(destino[1]);
    }
  }
  function pintarRuteo() {
    const raiz = ctx.$("ruteo"); raiz.replaceChildren();
    for (const nivel of ctx.NIVELES) {
      const codigo = document.createElement("code"); codigo.className = "tk-fn"; codigo.textContent = `console.${nivel}`;
      const grupo = document.createElement("span"); grupo.className = "seg"; grupo.setAttribute("role", "group"); grupo.setAttribute("aria-label", `console.${nivel}`);
      for (const [valor] of DESTINOS) {
        const boton = document.createElement("button"); boton.type = "button"; boton.dataset.nivel = nivel; boton.dataset.dest = valor;
        boton.setAttribute("aria-pressed", String(ctx.ruteo[nivel] === valor)); grupo.appendChild(boton);
      }
      raiz.append(codigo, grupo);
    }
    actualizarEtiquetasRuteo();
  }
  ctx.$("ruteo").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dest]"); if (!b) return;
    ctx.ruteo[b.dataset.nivel] = b.dataset.dest; ctx.guardado.escribir("ruteo", ctx.ruteo); pintarRuteo();
  });


  return {
    get $codigo() { return $codigo; },
    get $gutter() { return $gutter; },
    get $banda() { return $banda; },
    get $espejo() { return $espejo; },
    get $resaltado() { return $resaltado; },
    get $bloques() { return $bloques; },
    get pintarBanda() { return pintarBanda; },
    get pintarMarcasYa() { return pintarMarcasYa; },
    get verPanel() { return verPanel; },
    get irALinea() { return irALinea; },
    get insertarRef() { return insertarRef; },
    get ponerColores() { return ponerColores; },
    get TAMANOS() { return TAMANOS; },
    get aplicarLetra() { return aplicarLetra; },
    get DESTINOS() { return DESTINOS; },
    get actualizarEtiquetasRuteo() { return actualizarEtiquetasRuteo; },
    get pintarRuteo() { return pintarRuteo; }
  };
}
