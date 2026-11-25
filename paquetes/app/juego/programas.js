import { CMGProgramas } from './aplicar-programas.js';

/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarProgramasJuego(ctx) {
  // ---------- Programas ----------
  function actualizarEtiquetasProgs() {
    const $progs = ctx.$("progs");
    $progs.setAttribute("aria-label", ctx.ti18n(ctx.ES_CAMPAIGN ? "campaign.progs.aria" : ctx.ES_FACTORY ? "partida.progs.aria.factory" : "partida.progs.aria.war"));
    for (const b of $progs.querySelectorAll(".prog-tab")) {
      const id = b.dataset.id;
      const pre = b.querySelector(".prog-pre");
      if (pre) pre.textContent = ctx.ti18n("partida.progs.prefijo");
      b.setAttribute("aria-label", ctx.ti18n("partida.progs.unidad", { unidad: id }));
    }
  }
  // Campaign: las otras unidades encendidas de la misma clase (a ellas se copia un programa).
  const gemelos = id => { const e = ctx.mundo && ctx.mundo.porId[id]; return e ? ctx.mundo.programables.filter(u => u.id !== id && u.clase === e.clase) : []; };
  function pintarProgs() {
    const varios = ctx.programablesDe(ctx.def).length > 1;
    if (ctx.uiHito?.arbol) ctx.uiHito.arbol();
    else ctx.$("progs").innerHTML = ctx.programablesDe(ctx.def).map(l => {
      const p = ctx.ejec && ctx.ejec.progs.get(l.id);
      const est = (ctx.lineaErr && ctx.lineaErr.id === l.id) || (p && ctx.anfitrion.estado(l.id) === "error") ? "error" : p ? (["nuevo", "corre"].includes(ctx.anfitrion.estado(l.id)) ? "corre" : ctx.anfitrion.estado(l.id) === "espera" ? "espera" : "") : "";
      return `<button type="button" class="prog-tab" data-id="${l.id}" aria-pressed="${ctx.edicion.ids.includes(l.id)}"><span class="punto ${est}"></span><span class="prog-pre"></span>${l.id}</button>`;
    }).join("");
    ctx.$("b-copiar-prog").hidden = !varios || ctx.edicion.ids.length > 1 || (ctx.ES_CAMPAIGN && !gemelos(ctx.progSel).length);
    ctx.$("b-restaurar").hidden = ctx.edicion.ids.length > 1;
    actualizarEtiquetasProgs();
  }
  ctx.$("progs").addEventListener("click", (ev) => { const b = /** @type {any} */ (ev.target).closest(".prog-tab"); if (b) abrirPrograma(b.dataset.id); });
  function abrirPrograma(id) {
    if (!Object.hasOwn(ctx.programas, id)) return;
    ctx.seleccionar(id, { inspeccionar: "conservar" });
    configurarEdicion([id], true);
  }
  function configurarEdicion(ids, forzar = false) {
    ids = [...new Set(ids)].filter(id => Object.hasOwn(ctx.programas, id));
    if (!ids.length) return;
    if (!forzar && ids.join("|") === ctx.edicion.ids.join("|")) return;
    ctx.vinculos?.preparar(ids);
    const textos = ids.map(ctx.textoDe), langs = ids.map(ctx.lenguajeDe);
    const variosLenguajes = langs.some(l => l !== langs[0]);
    ctx.edicion = { ids, mixto: variosLenguajes || textos.some(src => src !== textos[0]), lenguaje: variosLenguajes ? "js" : langs[0], variosLenguajes };
    ctx.progSel = ids[0];
    ctx.$codigo.value = ctx.edicion.mixto ? (ctx.borradoresMulti.get(ctx.claveEdicion(ids) + ":" + ctx.edicion.lenguaje) || "") : textos[0];
    ctx.$("acciones-multi").hidden = !ctx.edicion.mixto;
    // Cambia el documento que se edita: el historial de deshacer de edicion.js va por documento.
    ctx.editorPrograma.abrir({ id: claveDocumento(), lenguaje: ctx.edicion.lenguaje, texto: ctx.$codigo.value, revision: 0 });
    actualizarEtiquetasEdicion();
    if (leccionV2()) actualizarEtiquetasConfirmaciones();
    pintarProgs(); ctx.medirEditor(); pintarEdicion(); ctx.pintarPieIns(); pintarLenguaje(); ctx.marcasSucias = true;
  }
  function actualizarEtiquetasEdicion() {
    const $codigoActivo = ctx.$("codigo");
    if (!$codigoActivo || !ctx.edicion.ids.length) return;
    const nombreL = ctx.ti18n(ctx.edicion.lenguaje === "python" ? "partida.lenguaje.python" : "partida.lenguaje.javascript");
    $codigoActivo.placeholder = ctx.edicion.mixto ? ctx.ti18n("partida.multi.placeholder") : "";
    ctx.$("multi-estado").textContent = ctx.edicion.variosLenguajes
      ? ctx.ti18n("partida.multi.lenguajes_distintos", { cantidad: ctx.edicion.ids.length })
      : ctx.ti18n("partida.multi.programas_distintos", { cantidad: ctx.edicion.ids.length });
    $codigoActivo.setAttribute("aria-label", ctx.edicion.ids.length > 1
      ? ctx.ti18n("partida.multi.aria", { cantidad: ctx.edicion.ids.length, lenguaje: nombreL })
      : ctx.ti18n("partida.programa.aria", { unidad: ctx.progSel, lenguaje: nombreL }));
  }
  const claveDocumento = () => `${ctx.retoIdx}:${ctx.claveEdicion(ctx.edicion.ids)}${ctx.edicion.mixto ? ":borrador" : ""}${ctx.edicion.lenguaje === "python" ? ":python" : ""}`;
  // Lenguaje de la unidad: el desplegable de la cabecera y Python en Ajustes. JavaScript, Seudo y
  // Bloques vuelven a JavaScript; el programa Python se conserva para cuando se vuelva a elegir.
  const $selLenguaje = ctx.$("sel-lenguaje");
  function asegurarOpcionesLenguaje() {
    if (!$selLenguaje || $selLenguaje.dataset.opcionesI18n === "1") return;
    $selLenguaje.replaceChildren();
    const varios = document.createElement("option"); varios.value = "varios"; varios.disabled = true; varios.dataset.i18n = "partida.selector.varios";
    $selLenguaje.appendChild(varios);
    const agregarOpcion = (valor, clave) => {
      const opcion = document.createElement("option"); opcion.value = valor; opcion.dataset.i18n = clave; $selLenguaje.appendChild(opcion);
    };
    agregarOpcion("js", "partida.lenguaje.javascript");
    if (ctx.PYTHON) agregarOpcion("python", "partida.lenguaje.python");
    // Campaign se programa en JavaScript o Python; todavía no tiene vistas de seudocódigo ni bloques.
    if (ctx.ES_CAMPAIGN) { $selLenguaje.dataset.opcionesI18n = "1"; return; }
    const vistas = document.createElement("optgroup"); vistas.dataset.i18nLabel = "partida.selector.vistas_js";
    const seudo = document.createElement("option"); seudo.value = "pseudo"; seudo.dataset.i18n = "partida.selector.seudocodigo"; vistas.appendChild(seudo);
    if (ctx.ES_FACTORY) { const bloques = document.createElement("option"); bloques.value = "bloques"; bloques.dataset.i18n = "partida.selector.bloques"; vistas.appendChild(bloques); }
    $selLenguaje.appendChild(vistas);
    $selLenguaje.dataset.opcionesI18n = "1";
  }
  function actualizarEtiquetasSelectorLenguaje() {
    if (!$selLenguaje) return;
    for (const opcion of $selLenguaje.querySelectorAll("option[data-i18n]")) opcion.textContent = ctx.ti18n(opcion.dataset.i18n);
    const vistas = $selLenguaje.querySelector("optgroup[data-i18n-label]");
    if (vistas) vistas.label = ctx.ti18n(vistas.dataset.i18nLabel);
  }
  function pintarSelectorLenguaje() {
    if (!$selLenguaje) return;
    asegurarOpcionesLenguaje();
    const varios = ctx.PYTHON && !!ctx.edicion.variosLenguajes, py = ctx.PYTHON && ctx.edicion.lenguaje === "python" && !varios;
    const modoVista = ctx.$("app").dataset.modo || "js";
    const opcionVarios = $selLenguaje.querySelector('option[value="varios"]');
    if (opcionVarios) opcionVarios.hidden = !varios;
    $selLenguaje.value = varios ? "varios" : py ? "python" : (modoVista === "js" ? "js" : modoVista);
    actualizarEtiquetasSelectorLenguaje();
  }
  function pintarLenguaje() {
    pintarSelectorLenguaje();
    if (!ctx.PYTHON) return;
    const py = ctx.edicion.lenguaje === "python" && !ctx.edicion.variosLenguajes;
    for (const b of /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll("[data-lenguaje-programa]"))) { b.hidden = false; b.disabled = false; b.setAttribute("aria-pressed", String(py)); }
    if (py) for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-modo-codigo]"))) b.setAttribute("aria-pressed", "false");
    ctx.$("app").dataset.lenguaje = py ? "python" : "js";
  }
  if ($selLenguaje) {
    $selLenguaje.addEventListener("change", () => {
      const v = $selLenguaje.value;
      if (v === "python") cambiarLenguaje("python");
      else if (ctx.PYTHON && ctx.edicion.lenguaje === "python") { if (cambiarLenguaje("js")) ctx.editorPrograma.fachada.seudo?.aplicarModo(v); }
      else ctx.editorPrograma.fachada.seudo?.aplicarModo(v);
      pintarSelectorLenguaje();
    });
    ctx.$("app").addEventListener("cmg:modo", pintarSelectorLenguaje);
  }
  function cambiarLenguaje(lenguaje) {
    if (!ctx.PYTHON || !ctx.def) return false;
    if (ctx.ejec) { ctx.avisoEditor(ctx.ti18n("partida.editor.detener_para_cambiar_lenguaje")); return false; }
    if (!ctx.edicion.variosLenguajes && ctx.edicion.lenguaje === lenguaje) return false;
    const sinConvertir = [];
    for (const id of ctx.edicion.ids) {
      if (lenguaje === "python") {
        // Py recupera el último Python de la unidad; si no lo hay, convierte su JS (E7). Si no cabe, el JS se conserva.
        if (ctx.fuentes[id]) { ctx.fuentes[id] = { ...ctx.fuentes[id], enUso: true }; continue; }
        const js = ctx.programas[id] || "";
        let texto = ctx.textoInicialPython(ctx.def, id);
        if (js !== ctx.textoInicial(ctx.def, id) && js.trim()) {
          const r = ctx.convertirAPython(js);
          if (r.ok) texto = r.texto;
          else { sinConvertir.push(`<b>${ctx.esc(id)}</b>: <span>${ctx.esc(r.motivo)}</span>${r.linea ? ` <span>(línea ${r.linea} del JavaScript)</span>` : ""}`); texto = `# Programa de ${id} en Python.\n# Tu programa JavaScript no se pudo convertir; sigue guardado: vuelve con JS para verlo.\n\n`; }
        }
        ctx.fuentes[id] = { lenguaje: "python", texto, enUso: true };
      } else if (ctx.fuentes[id]) ctx.fuentes[id].enUso = false;
    }
    ctx.vinculos?.sincronizar(ctx.edicion.ids);
    ctx.guardarProgramas(); configurarEdicion(ctx.edicion.ids, true); ctx.pintarInspector();
    if (sinConvertir.length) ctx.avisoEditor(`No se pudo pasar a Python: ${sinConvertir.join(" · ")}`);
    return true;
  }
  if (ctx.PYTHON) document.addEventListener("click", (ev) => {
    const py = /** @type {any} */ (ev.target).closest && /** @type {any} */ (ev.target).closest("[data-lenguaje-programa]");
    if (py) { cambiarLenguaje(py.dataset.lenguajePrograma); return; }
    const vista = /** @type {any} */ (ev.target).closest && /** @type {any} */ (ev.target).closest("[data-modo-codigo]");
    // Con Python no hay vistas: elegir JS, Seudo o Bloques vuelve a JavaScript y aplica esa vista.
    if (vista && ctx.edicion.lenguaje === "python" && cambiarLenguaje("js")) ctx.editorPrograma.fachada.seudo?.aplicarModo(vista.dataset.modoCodigo);
  });
  const CLAVE_CONFIRMAR_REPLACE = "cmg-juego-confirmar-replace";
  let confirmarReplace = (() => { try { return ctx.plataforma.almacen.leer(CLAVE_CONFIRMAR_REPLACE) !== "false"; } catch { return true; } })();
  let idsReplaceAbierto = null;
  function actualizarTextoReplace() {
    const texto = ctx.$("replace-texto");
    if (texto && idsReplaceAbierto) texto.textContent = ctx.ti18n("partida.replace.texto", { unidades: idsReplaceAbierto.join(", ") });
  }
  function preferirConfirmacionReplace(valor) {
    confirmarReplace = !!valor;
    try { ctx.plataforma.almacen.escribir(CLAVE_CONFIRMAR_REPLACE, JSON.stringify(confirmarReplace)); } catch { /* preferencia de sesión */ }
  }
  function confirmarReemplazo(ids) {
    if (!confirmarReplace) return Promise.resolve(true);
    const dialogo = ctx.$("confirmar-replace"), omitir = ctx.$("replace-no-preguntar");
    omitir.checked = false;
    dialogo.returnValue = "cancelar";
    idsReplaceAbierto = [...ids];
    actualizarTextoReplace();
    return new Promise(resolve => {
      dialogo.addEventListener("close", () => {
        const aceptado = dialogo.returnValue === "reemplazar";
        if (aceptado && omitir.checked) preferirConfirmacionReplace(false);
        idsReplaceAbierto = null;
        resolve(aceptado);
      }, { once: true });
      dialogo.showModal();
    });
  }
  const aplicarMulti = CMGProgramas.crearAplicador({
    estado: () => ({ ejec: ctx.ejec, edicion: ctx.edicion, programas: ctx.edicion.lenguaje === "python" ? ctx.textosPython : ctx.programas, texto: ctx.$codigo.value }),
    confirmarReemplazo,
    alAplicar(ids) {
      ctx.vinculos?.sincronizar(ids);
      if (ctx.vinculos && ids.every(id => ctx.textoDe(id) === ctx.textoDe(ids[0]))) ctx.vinculos.unir(ids);
      ctx.borradoresMulti.delete(ctx.claveEdicion(ids) + ":" + ctx.edicion.lenguaje);
      ctx.guardarProgramas(); configurarEdicion(ids, true); ctx.pintarInspector();
    },
  });
  const aplicarSiSeMezcla = reemplazar => ctx.edicion.variosLenguajes ? ctx.avisoEditor(ctx.ti18n("partida.multi.lenguaje_error")) : aplicarMulti(reemplazar);
  ctx.$("b-add").addEventListener("click", () => aplicarSiSeMezcla(false));
  ctx.$("b-replace").addEventListener("click", () => aplicarSiSeMezcla(true));
  ctx.$("b-coordenadas").addEventListener("click", () => { const texto = ctx.$("coordenadas").value.trim(); if (texto) ctx.insertar(texto); });
  if (ctx.runtime) ctx.$("orden-manual").addEventListener("change", ev => {
    const verbo = ev.target.value;
    ev.target.value = "";
    if (!ctx.ejec || !ctx.reglasProgramas.api.ordenes.includes(verbo)) return;
    const args = [];
    if (verbo !== "stopFire") {
      try {
        // El campo de War usa {x: 16, y: 9, z: 0}. Se admiten también claves JSON.
        const lugar = JSON.parse(ctx.$("coordenadas").value.replace(/([{,]\s*)([xyz])\s*:/g, '$1"$2":'));
        if (![lugar.x, lugar.y, lugar.z ?? 0].every(Number.isFinite)) throw new Error();
        args.push({ x: lugar.x, y: lugar.y, z: lugar.z ?? 0 });
      } catch {
        ctx.avisoEditor(ctx.ti18n('cv2.lugar'));
        return;
      }
    }
    ctx.encolar({ tipo: 'orden', unidad: ctx.progSel, verbo, args });
  });
  let confirmarCopia = false;
  let confirmarRestaurar = false;
  let anteriorLeccion = null;
  const leccionV2 = () => ctx.checkpointsV2 && ctx.retoIdx !== ctx.IDX_PROPIO;
  const documentoLeccion = () => ctx.claveDocumento() + ':' + ctx.progSel;
  function actualizarEtiquetasConfirmaciones() {
    ctx.$("b-copiar-prog").textContent = ctx.ES_CAMPAIGN ? ctx.ti18n(confirmarCopia ? "campaign.copiar.confirmar" : "campaign.copiar", { clase: ctx.ti18n(ctx.mundo && ctx.mundo.porId[ctx.progSel] && ctx.mundo.porId[ctx.progSel].clase === "obrero" ? "campaign.copiar.obrero" : "campaign.copiar.maquina") })
      : ctx.ti18n(confirmarCopia ? "partida.programa.copiar.confirmar" : "partida.programa.copiar", { unidad: ctx.progSel });
    ctx.$("b-restaurar").textContent = ctx.ti18n(leccionV2() ? (anteriorLeccion?.id === documentoLeccion() ? "cv2.deshacer" : "cv2.leccion")
      : confirmarRestaurar ? "partida.programa.restaurar.confirmar" : "partida.programa.restaurar");
    ctx.$("b-copiar").textContent = ctx.ti18n("partida.telemetria.copiar");
    ctx.$("b-borrar").textContent = ctx.ti18n(ctx.confirmarBorrado ? "partida.telemetria.borrar.confirmar" : "partida.telemetria.borrar");
    ctx.$("copiado").textContent = ctx.ti18n("partida.telemetria.copiada");
  }
  ctx.$("b-copiar-prog").addEventListener("click", (ev) => {
    if (ctx.ejec) return;
    if (!confirmarCopia) {
      confirmarCopia = true; actualizarEtiquetasConfirmaciones();
      setTimeout(() => { confirmarCopia = false; actualizarEtiquetasConfirmaciones(); }, 3000);
      return;
    }
    confirmarCopia = false; actualizarEtiquetasConfirmaciones();
    // Se copia el programa en su lenguaje: los demás pasan a ese lenguaje y conservan el otro.
    if (ctx.vinculos) {
      ctx.vinculos.unir([ctx.progSel, ...ctx.def.lanzadores.map(l => l.id)]);
      ctx.guardarProgramas(); pintarProgs(); return;
    }
    const py = ctx.lenguajeDe(ctx.progSel) === "python";
    for (const l of (ctx.ES_CAMPAIGN ? gemelos(ctx.progSel) : ctx.def.lanzadores)) if (l.id !== ctx.progSel) {
      if (py) ctx.fuentes[l.id] = { lenguaje: "python", texto: ctx.fuentes[ctx.progSel].texto.split(ctx.progSel).join(l.id), enUso: true };
      else { ctx.programas[l.id] = ctx.programas[ctx.progSel].split(ctx.progSel).join(l.id); if (ctx.fuentes[l.id]) ctx.fuentes[l.id].enUso = false; }
    }
    ctx.guardarProgramas();
  });
  ctx.$("b-restaurar").addEventListener("click", (ev) => {
    if (ctx.ejec) return;
    if (leccionV2()) {
      const id = documentoLeccion();
      if (anteriorLeccion?.id === id) {
        ctx.ponerTexto(ctx.progSel, anteriorLeccion.texto);
        anteriorLeccion = null;
      } else {
        const js = (ctx.def.inicial[ctx.progSel] ?? []).join("\n");
        const programa = ctx.lenguajeDe(ctx.progSel) === 'python' ? ctx.convertirAPython(js).texto : js;
        if (programa == null) return;
        anteriorLeccion = { id, texto: ctx.textoDe(ctx.progSel) };
        ctx.ponerTexto(ctx.progSel, programa);
      }
      ctx.guardarProgramas(); abrirPrograma(ctx.progSel); actualizarEtiquetasConfirmaciones();
      return;
    }
    if (!confirmarRestaurar) {
      confirmarRestaurar = true; actualizarEtiquetasConfirmaciones();
      setTimeout(() => { confirmarRestaurar = false; actualizarEtiquetasConfirmaciones(); }, 3000);
      return;
    }
    confirmarRestaurar = false; actualizarEtiquetasConfirmaciones();
    ctx.ponerTexto(ctx.progSel, ctx.lenguajeDe(ctx.progSel) === "python" ? ctx.textoInicialPython(ctx.def, ctx.progSel) : ctx.textoInicial(ctx.def, ctx.progSel)); ctx.guardarProgramas(); abrirPrograma(ctx.progSel);
  });
  function pintarEdicion() {
    ctx.$codigo.readOnly = ctx.edicionBloqueada;
    for (const id of ["b-add", "b-replace"]) ctx.$(id).disabled = !!ctx.ejec;
    for (const id of ["b-coordenadas", "coordenadas"]) ctx.$(id).disabled = ctx.edicionBloqueada;
    ctx.marcasSucias = true;
    ctx.$codigo.dispatchEvent(new CustomEvent("cmg:estado"));
  }


  return {
    get actualizarEtiquetasProgs() { return actualizarEtiquetasProgs; },
    get gemelos() { return gemelos; },
    get pintarProgs() { return pintarProgs; },
    get abrirPrograma() { return abrirPrograma; },
    get configurarEdicion() { return configurarEdicion; },
    get actualizarEtiquetasEdicion() { return actualizarEtiquetasEdicion; },
    get claveDocumento() { return claveDocumento; },
    get $selLenguaje() { return $selLenguaje; },
    get asegurarOpcionesLenguaje() { return asegurarOpcionesLenguaje; },
    get actualizarEtiquetasSelectorLenguaje() { return actualizarEtiquetasSelectorLenguaje; },
    get pintarSelectorLenguaje() { return pintarSelectorLenguaje; },
    get pintarLenguaje() { return pintarLenguaje; },
    get cambiarLenguaje() { return cambiarLenguaje; },
    get CLAVE_CONFIRMAR_REPLACE() { return CLAVE_CONFIRMAR_REPLACE; },
    get confirmarReplace() { return confirmarReplace; }, set confirmarReplace(v) { confirmarReplace = v; },
    get idsReplaceAbierto() { return idsReplaceAbierto; }, set idsReplaceAbierto(v) { idsReplaceAbierto = v; },
    get actualizarTextoReplace() { return actualizarTextoReplace; },
    get preferirConfirmacionReplace() { return preferirConfirmacionReplace; },
    get confirmarReemplazo() { return confirmarReemplazo; },
    get aplicarMulti() { return aplicarMulti; },
    get aplicarSiSeMezcla() { return aplicarSiSeMezcla; },
    get confirmarCopia() { return confirmarCopia; }, set confirmarCopia(v) { confirmarCopia = v; },
    get confirmarRestaurar() { return confirmarRestaurar; }, set confirmarRestaurar(v) { confirmarRestaurar = v; },
    get actualizarEtiquetasConfirmaciones() { return actualizarEtiquetasConfirmaciones; },
    get pintarEdicion() { return pintarEdicion; }
  };
}
