import { CAMPAIGN_UI } from '../../interfaz/index.js';

/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarCampaignJuego(ctx) {
  // ---------- Campaign: planta en vivo, hitos, checkpoints e historial ----------
  // El mundo no se reinicia al ejecutar. Cada hito cumplido guarda un checkpoint (mundo y programas);
  // además se guarda el estado en vivo para seguir tras recargar la página.
  const CLAVE_VIVO = "campaign-1-vivo", CLAVE_HIST = "campaign-1-historial", MAX_CHECKPOINTS = 30;
  let historialC = ctx.ES_CAMPAIGN ? ctx.guardado.leer(CLAVE_HIST, []).filter(c => c && c.mundo && c.mundo.rev === ctx.RETOS[0].revision) : [];
  /** @type {any} */
  let pielBatalla = ctx.ES_CAMPAIGN && !!ctx.guardado.leer("campaign-piel", false), ponerPiel = /** @type {(si: boolean) => void} */ (() => {});
  let tVivo = 0;
  const uiC = ctx.ES_CAMPAIGN ? CAMPAIGN_UI.crear({
    i18n: ctx.CMGI18n,
    campaign: { ...ctx.campaign, instantanea: ctx.campaign.instantaneaHistorica },
    esc: ctx.esc, coma: ctx.coma, varDe: ctx.varDe, t: ctx.ti18n,
    tk: (...a) => ctx.tk(...a), fila: (...a) => ctx.fila(...a), nota: (...a) => ctx.nota(...a), grupo: (...a) => ctx.grupo(...a), tkValor: (...a) => ctx.tkValor(...a),
    vital: (...a) => ctx.vital(...a), celdas: (...a) => ctx.celdas(...a), variables: () => ctx.variablesPrograma(),
    get mundo() { return ctx.mundo; }, get def() { return ctx.def; }, get progSel() { return ctx.progSel; },
  }) : null;
  const hitoActual = () => ctx.def.hitos[ctx.mundo.hito];
  const guardarVivo = () => ctx.guardado.escribir(CLAVE_VIVO, { cuando: Date.now(), mundo: ctx.campaign.serializar(ctx.mundo) });
  addEventListener("pagehide", () => { if (ctx.ES_CAMPAIGN && ctx.mundo) { guardarVivo(); clearTimeout(ctx.tGuardar); ctx.guardado.escribir(`prog-${ctx.claveReto()}`, { ...ctx.programas }); if (ctx.PYTHON) ctx.guardado.escribir(`fuentes-${ctx.claveReto()}`, ctx.copiaFuentes()); } });
  function guardarCheckpoint() {
    historialC.push({ id: Date.now() + historialC.length, hito: ctx.mundo.hito, t: ctx.r2(ctx.mundo.t), cuando: Date.now(), mundo: ctx.campaign.serializar(ctx.mundo), programas: { ...ctx.programas }, fuentes: ctx.PYTHON ? ctx.copiaFuentes() : {} });
    // Se conservan el inicio del nivel y los más recientes.
    if (historialC.length > MAX_CHECKPOINTS) historialC.splice(1, historialC.length - MAX_CHECKPOINTS);
    ctx.guardado.escribir(CLAVE_HIST, historialC);
  }
  // Lo que cambia en pantalla al pasar de hito o al volver a un checkpoint.
  function refrescarHito() {
    if (ctx.$("reto-n")) ctx.$("reto-n").textContent = ctx.mundo.hito;
    ctx.actualizarContenidoReto();
    if (ctx.$("objetivo-corto")) ctx.$("objetivo-corto").textContent = ctx.textoReto("objetivo");
    ctx.pintarRetos(); ctx.pintarProgs(); ctx.pintarMaquinas(); ctx.pintarInspector(); ctx.pintarPieIns(); ctx.pintarEscenario(); ctx.pintarControles();
    ctx.metasClave = "";
    if (!ctx.$("info-reto").hidden) ctx.pintarInfoReto();
  }
  function volverA(cp, conProgramas) {
    if (!cp) return;
    ctx.cerrarProgramas();
    ctx.estadoCampaign = cp.mundo; ctx.hitoPendiente = null;
    if (conProgramas) {
      ctx.programas = { ...ctx.programas, ...cp.programas };
      if (ctx.PYTHON) { ctx.fuentes = JSON.parse(JSON.stringify(cp.fuentes || {})); ctx.textosPython = ctx.vistaPython(); }
      ctx.guardarProgramas(); ctx.borradoresMulti.clear();
    }
    ctx.lineaCorre = {}; ctx.lineaErr = null; ctx.marcasSucias = true;
    ctx.nuevoMundo();
    if (conProgramas) ctx.configurarEdicion([ctx.progSel], true);
    refrescarHito(); guardarVivo();
    ctx.ocultarBanner(); ctx.cerrarAvisos();
    ctx.consola("sistema", null, null, ctx.esc(ctx.ti18n(conProgramas ? "campaign.historial.vuelto_programas" : "campaign.historial.vuelto", { hito: hitoActual().clave, t: ctx.coma(ctx.mundo.t) })));
  }
  function volverAHito(n) {
    const cp = [...historialC].reverse().find(c => c.hito === n);
    if (!cp) return;
    ctx.abrirHoja(false);
    ctx.mostrarBanner("fallo", `${ctx.def.hitos[n].clave} · ${uiC.tituloHito(n)}`, ctx.esc(ctx.ti18n("campaign.historial.intro")), ctx.ti18n("campaign.historial.detalle", { t: ctx.coma(cp.t), presupuesto: cp.mundo.presupuesto, cuando: new Date(cp.cuando).toLocaleString() }),
      [[ctx.ti18n("campaign.historial.volver"), "primario", () => volverA(cp, false)], [ctx.ti18n("campaign.historial.volver_programas"), "", () => volverA(cp, true)], ["×", "", ctx.ocultarBanner]]);
  }
  function nivelDeNuevo() {
    ctx.cerrarProgramas();
    ctx.estadoCampaign = null; ctx.hitoPendiente = null; historialC = [];
    ctx.nuevoMundo(); guardarCheckpoint(); refrescarHito(); guardarVivo(); ctx.ocultarBanner(); ctx.cerrarAvisos(); ctx.limpiarConsola();
  }
  let cpConfirmar = null;
  function clicHistorial(ev) {
    const b = ev.target.closest("button"); if (!b) return;
    const clave = b.dataset.cpNuevo ? "nuevo" : b.dataset.cpVolver ? `${b.dataset.cpVolver}:${b.dataset.cpProgramas || ""}` : null;
    if (!clave) return;
    // Segundo toque para confirmar: volver pierde el avance posterior.
    if (cpConfirmar !== clave) {
      cpConfirmar = clave; const antes = b.textContent; b.textContent = ctx.ti18n("campaign.historial.confirmar");
      setTimeout(() => { if (cpConfirmar === clave) cpConfirmar = null; if (b.isConnected) b.textContent = antes; }, 3000);
      return;
    }
    cpConfirmar = null;
    if (clave === "nuevo") nivelDeNuevo();
    else volverA(historialC.find(c => String(c.id) === b.dataset.cpVolver), !!b.dataset.cpProgramas);
  }

  function entregaCampaign(bahia, pedido) {
    ctx.consola("sistema", bahia.id, null, ctx.esc(ctx.ti18n("campaign.aviso.entrega", { n: pedido.n, pieza: pedido.pieza })));
    ctx.globo(bahia.id, "info", `${pedido.n} × ${pedido.pieza}`);
  }
  function terminarCampaign(resultado, motivo, texto, linea, idProg) {
    if (!ctx.mundo || !ctx.ejec) return;
    const codigos = ctx.ejec.codigos, inicio = ctx.ejec.inicio, lenguajes = { ...ctx.ejec.lenguajes };
    ctx.finActual = resultado;
    ctx.cerrarProgramas();
    ctx.__banco.alTerminar?.(resultado, motivo, texto, linea, idProg);
    if (resultado !== "error") { ctx.lineaCorre = {}; ctx.marcasSucias = true; }
    ctx.telemetria.push({ sandbox: "campaign", reto: 1, clave: ctx.claveReto(), titulo: ctx.def.titulo, hito: hitoActual().clave, intento: ctx.intento, inicio, resultado, motivo, mensaje: texto ?? null, linea: linea ?? null, programa: idProg ?? null,
      tiempoJuego: ctx.r2(ctx.mundo.t), presupuesto: ctx.mundo.presupuesto, producidos: { ...ctx.mundo.producidos }, uso: ctx.registroActual().uso, consolas: ctx.registroActual().consolas, codigos, lenguajes });
    if (ctx.telemetria.length > 200) ctx.telemetria.splice(0, ctx.telemetria.length - 200);
    ctx.guardado.escribir(`${ctx.PREFIJO}telemetria`, ctx.telemetria);
    guardarVivo();
    if (resultado === "error") {
      ctx.pistaTrasFallo();
      ctx.ultimoAviso[ctx.claveReto()] = { resultado, motivo, texto, linea, id: idProg, intento: ctx.intento, t: ctx.r2(ctx.mundo.t), cuando: Date.now() };
      ctx.mostrarBanner("fallo", linea ? ctx.ti18n("campaign.banner.error_linea", { linea, unidad: idProg }) : ctx.ti18n("campaign.banner.error", { unidad: idProg }), ctx.esc(texto), null,
        [[ctx.ti18n("campaign.banner.ir"), "primario", () => { ctx.ocultarBanner(); ctx.abrirPrograma(idProg); if (linea) ctx.irALinea(linea); }]]);
    } else if (motivo === "quieto") ctx.consola("sistema", null, null, ctx.esc(ctx.ti18n("campaign.aviso.quieto")));
    ctx.pintarControles(); ctx.pintarProgs(); ctx.pintarResumen(); ctx.pintarEdicion(); ctx.pintarInspector(); ctx.metasClave = "";
    if (!ctx.$("info-reto").hidden) ctx.pintarInfoReto();
  }
  // Programas de las unidades recién encendidas: arrancan al seguir tras un hito.
  function arrancarNuevos() {
    if (!ctx.ejec) return;
    for (const l of ctx.mundo.programables) {
      if (ctx.ejec.progs.has(l.id)) continue;
      const lenguaje = ctx.lenguajeDe(l.id), texto = ctx.textoDe(l.id) || "";
      let codigo = texto, err = null;
      if (lenguaje === "python") { const r = ctx.CMGPythonJS.traducirCache(texto, ctx.opcionesPython()); if (r.ok) codigo = r.js; else err = r.diagnosticos[0]; }
      else err = ctx.revisar(texto);
      if (err) { ctx.consola("warn", l.id, err.linea, ctx.esc(ctx.ti18n("campaign.aviso.sin_programa", { unidad: l.id, motivo: err.mensaje }))); continue; }
      ctx.ejec.lenguajes[l.id] = lenguaje;
      ctx.arrancarPrograma(l.id, codigo, texto);
    }
    ctx.pintarProgs();
  }
  function seguirCampaign() { ctx.ocultarBanner(); ctx.hitoDetiene = false; ctx.pausa = false; arrancarNuevos(); ctx.conductor?.reanudar(); ctx.pintarControles(); }
  function alCumplirHito(h) {
    ctx.plataforma.logros?.desbloquear("CBL_PRUEBA_VICTORIA");
    // Campaign-V2: el hito de fábrica cierra la sesión y abre la Batalla siguiente.
    if (ctx.fabricaV2?.alCumplirHito(ctx, h)) return;
    ctx.__banco.alHito?.(h);
    const corriendo = !!ctx.ejec;
    ctx.pausa = corriendo;
    // Hay unidades nuevas o recién encendidas: se rehace el escenario 3D y se repinta la interfaz.
    if (ctx.V3) { ctx.V3.construir(); ctx.V3.anillosDe(ctx.seleccion); }
    for (const o of ctx.etiquetas.values()) { o.etq.remove(); o.g.remove(); }
    ctx.etiquetas.clear();
    guardarCheckpoint(); guardarVivo();
    refrescarHito();
    const stats = ctx.ti18n("campaign.banner.stats", { t: ctx.coma(ctx.mundo.t), presupuesto: ctx.mundo.presupuesto });
    const premio = `<p>${ctx.esc(ctx.ti18n("campaign.banner.premio", { n: ctx.def.premioHito }))}</p>`;
    const editar = [ctx.ti18n("campaign.banner.editar"), "", () => { ctx.ocultarBanner(); if (ctx.ejec) ctx.detener(); ctx.verPanel("codigo"); ctx.abrirPestana("programa"); }];
    if (h.completado) {
      ctx.mostrarBanner("victoria", ctx.ti18n("campaign.banner.fin"), premio + `<p>${ctx.esc(ctx.ti18n("campaign.banner.fin_texto", { misiles: ctx.mundo.arsenal.porBanda + ctx.mundo.arsenal.aMano, t: ctx.coma(ctx.mundo.t), presupuesto: ctx.mundo.presupuesto }))}</p>`, stats,
        [[ctx.ti18n("campaign.banner.ver_salva"), "primario", () => { ponerPiel(true); if (ctx.V3 && ctx.vista === "3d") ctx.V3.verCampo(); seguirCampaign(); }], [ctx.ti18n("campaign.banner.quedarse"), "", seguirCampaign]]);
    } else {
      const sig = h.siguiente, nuevas = ctx.mundo.maquinas.filter(u => (u.desde ?? 0) === sig).map(u => u.id);
      ctx.mostrarBanner("victoria", ctx.ti18n("campaign.banner.hito", { hito: ctx.def.hitos[h.hecho].clave, titulo: uiC.tituloHito(h.hecho) }),
        premio + `<p><b>${ctx.esc(ctx.ti18n("campaign.banner.siguiente", { hito: ctx.def.hitos[sig].clave, titulo: uiC.tituloHito(sig) }))}</b> · ${ctx.esc(ctx.ti18n(`campaign.hito.${sig}.objetivo`))}</p>`
        + (nuevas.length ? `<p>${ctx.esc(ctx.ti18n("campaign.aviso.nuevas", { unidades: nuevas.join(", ") }))}</p>` : ""), stats,
        corriendo ? [[ctx.ti18n("campaign.banner.seguir"), "primario", seguirCampaign], editar] : [editar]);
    }
    if (!ctx.hechos.includes(`campaign-h${h.hecho}`)) { ctx.hechos.push(`campaign-h${h.hecho}`); ctx.guardado.escribir("hechos", ctx.hechos); }
    ctx.telemetria.push({ sandbox: "campaign", reto: 1, clave: ctx.claveReto(), titulo: ctx.def.titulo, hito: ctx.def.hitos[h.hecho].clave, intento: ctx.intento, inicio: new Date().toISOString(), resultado: "victoria", motivo: "hito", tiempoJuego: ctx.r2(ctx.mundo.t), presupuesto: ctx.mundo.presupuesto });
    ctx.guardado.escribir(`${ctx.PREFIJO}telemetria`, ctx.telemetria);
    ctx.pintarResumen();
  }
  // Cada fotograma: hitos recién cumplidos, guardado en vivo y parada cuando ya no queda nada en marcha.
  function cicloCampaign(now) {
    if (ctx.hitoPendiente && !ctx.enVuelo) { const h = ctx.hitoPendiente; ctx.hitoPendiente = null; alCumplirHito(h); }
    if (!ctx.ejec || ctx.pausa || ctx.enVuelo) return;
    if (now - tVivo > 5000) { tVivo = now; guardarVivo(); }
    if ([...ctx.ejec.progs.values()].every(p => ctx.anfitrion.estado(p.id) === "fin") && ctx.campaign.quieto(ctx.mundo)) ctx.terminar("detenido", "quieto", null);
  }

  return {
    get CLAVE_VIVO() { return CLAVE_VIVO; },
    get CLAVE_HIST() { return CLAVE_HIST; },
    get MAX_CHECKPOINTS() { return MAX_CHECKPOINTS; },
    get historialC() { return historialC; }, set historialC(v) { historialC = v; },
    get pielBatalla() { return pielBatalla; }, set pielBatalla(v) { pielBatalla = v; },
    get ponerPiel() { return ponerPiel; }, set ponerPiel(v) { ponerPiel = v; },
    get tVivo() { return tVivo; }, set tVivo(v) { tVivo = v; },
    get uiC() { return uiC; },
    get hitoActual() { return hitoActual; },
    get guardarVivo() { return guardarVivo; },
    get guardarCheckpoint() { return guardarCheckpoint; },
    get refrescarHito() { return refrescarHito; },
    get volverA() { return volverA; },
    get volverAHito() { return volverAHito; },
    get nivelDeNuevo() { return nivelDeNuevo; },
    get cpConfirmar() { return cpConfirmar; }, set cpConfirmar(v) { cpConfirmar = v; },
    get clicHistorial() { return clicHistorial; },
    get entregaCampaign() { return entregaCampaign; },
    get terminarCampaign() { return terminarCampaign; },
    get arrancarNuevos() { return arrancarNuevos; },
    get seguirCampaign() { return seguirCampaign; },
    get alCumplirHito() { return alCumplirHito; },
    get cicloCampaign() { return cicloCampaign; }
  };
}
