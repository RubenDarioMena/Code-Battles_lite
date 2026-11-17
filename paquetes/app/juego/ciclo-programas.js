import { crearTrabajadorInterprete } from '../../anfitrion/index.js';

/** instalarCicloProgramas: sección del juego; estado y servicios vivos inyectados por la composición.
 * @param {any} ctx */
export function instalarCicloProgramas(ctx) {
  const crearTrabajador = crearTrabajadorInterprete({ acorn: ctx.acorn, piezas: ctx.piezasTrabajador,
    mensajePresupuesto: unidad => ctx.ti18n(ctx.ES_CAMPAIGN ? "campaign.presupuesto" : `partida.presupuesto.${ctx.SERIE}`, { unidad }) });
  // ---------- Ciclo de los programas (lockstep) ----------
  const algunoCorre = () => !!ctx.ejec && ctx.anfitrion.algunoCorre();
  function soloComentarios(src) { return ctx.lexico(src).every(([k]) => k === "com" || k === "esp" || k === "nl"); }

  // Antes de ejecutar: huecos /* … */ sin rellenar y errores de sintaxis, con su línea.
  const revisar = src => ctx.lenguaje.revisar(src, ctx.acorn);

  function ejecutar() {
    if (ctx.edicion.mixto && ctx.$codigo.value.trim()) {
      ctx.mostrarBanner("fallo", "Aplica el borrador antes de ejecutar",
        "El borrador todavía no pertenece a los lanzadores. Usa Add para anexarlo o Replace para sustituir sus programas.", null,
        [["Volver al borrador", "primario", () => { ctx.ocultarBanner(); ctx.verPanel("codigo"); ctx.abrirPestana("programa"); ctx.$codigo.focus(); }]]);
      return;
    }
    cerrarProgramas();
    ctx.vaciarEfectos?.();
    if (ctx.CMGPulsos) ctx.CMGPulsos.reiniciar();
    // Cada unidad, en su lenguaje: JS se revisa con acorn; Python se traduce (huecos, sangría y sintaxis con su línea).
    const codigos = {}, lenguajes = {}, fuentesTexto = {};
    for (const l of ctx.programablesDe(ctx.def)) {
      const lenguaje = ctx.lenguajeDe(l.id), texto = ctx.textoDe(l.id) || "";
      let err = null;
      lenguajes[l.id] = lenguaje; fuentesTexto[l.id] = texto;
      if (lenguaje === "python") {
        const r = ctx.CMGPythonJS.traducirCache(texto, ctx.opcionesPython());
        if (r.ok) codigos[l.id] = r.js;
        else err = r.diagnosticos[0];
        if (r.ok && typeof ctx.acorn !== "undefined") {
          try { ctx.acorn.parse(r.js, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true }); }
          catch (e) { err = { linea: e.loc ? e.loc.line : null, mensaje: "El traductor de Python no pudo con esta línea. Reescríbela de otra forma o avísanos." }; }
        }
      } else {
        codigos[l.id] = texto;
        err = ctx.ES_FACTORY ? null : revisar(texto);
      }
      // Pulsos en el editor (paquetes/app/juego/pulsos.js): JS con los ganchos del trazador; Python, por línea.
      if (!err && !ctx.ES_FACTORY && !ctx.ES_CAMPAIGN && ctx.CMGPulsos) {
        if (lenguaje === "python") ctx.CMGPulsos.python(l.id, texto);
        else codigos[l.id] = ctx.CMGPulsos.preparar(l.id, texto);
      }
      if (err) {
        ctx.abrirPrograma(l.id); ctx.lineaErr = { id: l.id, linea: err.linea }; ctx.marcasSucias = true;
        ctx.ultimoAviso[ctx.claveReto()] = { resultado: "sintaxis", motivo: "error", texto: err.mensaje, linea: err.linea, id: l.id, cuando: Date.now() };
        ctx.avisar("cmg:intento", { reto: ctx.retoIdx + 1, titulo: ctx.def.titulo, intento: ctx.intento + 1, resultado: "sintaxis", motivo: "error", mensaje: err.mensaje, linea: err.linea, programa: l.id, codigos: { ...fuentesTexto }, lenguajes: { ...lenguajes } });
        ctx.mostrarBanner("fallo", err.linea ? `Línea ${err.linea} de ${l.id}` : `Programa de ${l.id}`, ctx.esc(err.mensaje), null, [["Ir a la línea", "primario", () => { ctx.ocultarBanner(); ctx.irALinea(err.linea); }]]);
        return;
      }
    }
    ctx.intento++;
    if (!ctx.semillaFija) ctx.semilla = ctx.intento;
    // Campaign conserva la partida; cada ejecución tiene su propio anfitrión.
    if (ctx.ES_CAMPAIGN) { ctx.eventos = []; ctx.eventosSucios = true; ctx.hitoPendiente = null; ctx.hitoDetiene = false; }
    else ctx.nuevoMundo(ctx.intento);
    ctx.finActual = null; ctx.desdeRegistro = 0; ctx.acum = 0; ctx.registrosPendientes.clear();
    if (ctx.ES_CAMPAIGN && ctx.anfitrion) { const c = ctx.anfitrion.registro().consolas; for (const n of ctx.NIVELES) ctx.consolasCampaign[n] += c[n]; }
    ctx.anfitrion = ctx.crearAnfitrion({ reglas: ctx.reglas, piezas: ctx.piezasTrabajador,
      crearTrabajador,
      contexto: { nombres: ctx.nombradas().map(e => e.id), tipos: Object.keys(ctx.TIPOS), sensores: Object.keys(ctx.SENSOR),
        conf: { fallaRafaga: ctx.LAU.fallaRafaga, cadencia: ctx.LAU.cadencia, cadenciaRafaga: ctx.LAU.cadenciaRafaga } } });
    ctx.limpiarConsola(); ctx.ocultarBanner(); ctx.cerrarAvisos();
    ctx.lineaCorre = {}; ctx.lineaErr = null; ctx.marcasSucias = true;
    ctx.ejec = { progs: new Map(), inicio: new Date().toISOString(), codigos: {}, lenguajes };
    for (const l of ctx.mundo.programables) arrancarPrograma(l.id, codigos[l.id] || "", fuentesTexto[l.id]);
    // La planta sigue tras H5 (salva y suministro); su evaluación es un hito, no el fin del mundo vivo.
    let entregaInicial = true;
    ctx.conductor = ctx.crearConductor({ reglas: ctx.reglas,
      partida: ctx.ES_CAMPAIGN ? Object.create(ctx.partida, { evaluar: { value: () => null } }) : ctx.partida, anfitrion: ctx.anfitrion,
      detener: () => ctx.hitoDetiene,
      alTurno, alSucesos: lista => {
        // Al cambiar de anfitrión, los sucesos anteriores de la planta ya se mostraron.
        if (!ctx.ES_CAMPAIGN || !entregaInicial) alSucesos(lista);
        entregaInicial = false;
      },
      alPaso: () => { ctx.__banco.alPaso?.(ctx.mundo); } });
    ctx.pausa = false;
    ctx.pintarControles(); ctx.pintarProgs(); ctx.pintarEdicion();
    avanzar();
  }

  function arrancarPrograma(id, codigo, fuente) {
    ctx.ejec.progs.set(id, { id, finT: null });
    ctx.ejec.codigos[id] = fuente ?? codigo;
    // cargar crea la unidad inmediatamente; el conductor lo arranca al ceder.
    ctx.anfitrion.cargar(id, ctx.instrumentar(codigo), { lenguaje: ctx.ejec.lenguajes[id] });
  }

  const { fmtLugar, fmtValor } = ctx.lenguaje;
  function registroActual() {
    const r = ctx.anfitrion ? ctx.anfitrion.registro() : { eventos: [], uso: {}, verbos: {}, resultados: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 }, lecturas: {} };
    if (ctx.ES_CAMPAIGN) r.consolas = Object.fromEntries(ctx.NIVELES.map(n => [n, ctx.consolasCampaign[n] + r.consolas[n]]));
    return r;
  }
  function recogerRegistro() {
    if (!ctx.anfitrion) return;
    const desde = ctx.registrosPendientes.size ? Math.min(...ctx.registrosPendientes.keys()) : ctx.desdeRegistro;
    const nuevos = ctx.anfitrion.registro({ desde }).eventos;
    for (const [i, e] of nuevos.entries()) {
      const indice = desde + i, pendiente = ctx.registrosPendientes.get(indice);
      if (indice < ctx.desdeRegistro) {
        if (!pendiente || e.resultado == null) continue;
        Object.assign(pendiente, e); ctx.registrosPendientes.delete(indice);
      } else {
        ctx.eventos.push(e);
        if (e.resultado == null) ctx.registrosPendientes.set(indice, e);
      }
      ctx.eventosSucios = true;
      if (ctx.ES_FACTORY && e.orden && !e.sensor) ctx.consola(e.resultado === "ok" ? "log" : "warn", "R1", e.linea, `${ctx.esc(e.orden)} → <b>${ctx.esc(e.resultado)}</b>`);
      if (ctx.ES_CAMPAIGN && e.clase === "warn" && e.que.endsWith(")")) {
        ctx.consola("warn", e.maquina, e.linea, ctx.esc(ctx.ti18n("campaign.aviso.resultado", { orden: e.que, resultado: e.resultado })));
        ctx.globo(e.maquina, "warn", e.resultado);
      }
    }
    ctx.desdeRegistro = desde + nuevos.length;
  }
  function alTurno(turno) {
    for (const m of turno.avisos) {
      const id = m.unidad;
      if (m.type === "traza") { ctx.CMGPulsos?.traza(id, m.ev); continue; }
      if (!ctx.ES_FACTORY && !ctx.ES_CAMPAIGN && ["lee", "cmd", "consola"].includes(m.type)) ctx.CMGPulsos?.linea(id, m.linea, m.type, m.type === "lee" ? m.valor : m.type === "cmd" ? m.res : null);
      if (m.type === "consola") ctx.mostrarConsola(id, m.linea, m.nivel, m.texto);
      if (["espera", "encargo", "modo", "lecturaFactory", "done"].includes(m.type)) {
        ctx.lineaCorre[id] = m.type === "done" ? null : m.linea; ctx.marcasSucias = true;
      }
      if (m.type === "done") { ctx.ejec.progs.get(id).finT = ctx.mundo.t; ctx.pintarProgs(); }
    }
  }
  function alSucesos(lista) {
    ctx.sucesosVistas?.(lista);
    recogerRegistro();
    for (const s of lista) {
      const d = s.datos;
      if (s.tipo === "registro") { ctx.eventos.push({ t: +(s.paso * ctx.DT).toFixed(2), ...d, linea: d.linea ?? "" }); ctx.eventosSucios = true; }
      else if (s.tipo === "aviso") ctx.avisoSistema(d.texto);
      else if (s.tipo === "globo") ctx.globo(s.unidad, d.nivel, d.texto);
      else if (s.tipo === "entrega-pedido") ctx.entregaCampaign(ctx.mundo.porId[s.unidad], d);
      else if (s.tipo === "hito") { ctx.hitoPendiente = d; ctx.hitoDetiene = true; }
    }
  }

  function avanzar() {
    if (!ctx.ejec || ctx.enVuelo || ctx.pausa) return;
    const actual = ctx.conductor, sesion = ctx.ejec;
    const llamada = actual.avanzar(Math.max(0, Math.floor(ctx.acum / ctx.DT + 1e-9)));
    ctx.enVuelo = llamada;
    llamada.then(({ pasos }) => {
      if (ctx.ejec !== sesion) return;
      ctx.acum = Math.max(0, ctx.acum - pasos * ctx.DT);
      recogerRegistro();
      if (actual.error) {
        const e = actual.error;
        errorPrograma({ id: e.unidad }, e.mensaje, e.linea);
      } else if (!ctx.ES_CAMPAIGN) {
        const fin = ctx.partida.evaluar();
        if (fin) ctx.terminar(fin.fin, fin.motivo, fin.mensaje);
      }
      // Como el ciclo antiguo al recibir «espera»: se sigue en cuanto los programas ceden, no en el siguiente fotograma.
      const turno = ctx.ejec === sesion && actual.turnoPendiente();
      if (turno) turno.then(() => { if (ctx.ejec === sesion && !ctx.pausa) avanzar(); });
    }).catch(error => {
      if (ctx.ejec === sesion) errorPrograma({ id: ctx.progSel }, error.message, null);
    }).finally(() => { if (ctx.enVuelo === llamada) ctx.enVuelo = null; });
  }

  function errorPrograma(p, mensaje, linea) {
    if (!ctx.ejec) return;
    if (ctx.ES_CAMPAIGN && mensaje === `El programa de ${p.id} dio 4000 órdenes y lecturas sin esperar. ¿Falta await wait(...) dentro del bucle?`)
      mensaje = ctx.ti18n("campaign.ordenes_sin_esperar", { unidad: p.id, n: 4000 });
    if (ctx.ejec.lenguajes && ctx.ejec.lenguajes[p.id] === "python") mensaje = ctx.mensajePython(mensaje);
    ctx.lineaErr = { id: p.id, linea }; ctx.marcasSucias = true;
    ctx.consola("error", p.id, linea, ctx.htmlInterfaz(escapeMsg(mensaje)));
    ctx.terminar("error", "error", mensaje, linea, p.id);
  }
  const escapeMsg = (s) => ctx.esc(s);

  function cerrarProgramas() {
    if (ctx.ejec) {
      ctx.conductor?.cerrar();
      recogerRegistro();
      if (ctx.ES_CAMPAIGN || ctx.ES_FACTORY) {
        ctx.partida.ordenar({ paso: ctx.partida.pasoActual, origen: "sistema", unidad: ctx.SERIE, verbo: ctx.ES_CAMPAIGN ? "fin-tramo" : "fin-intento", args: [] });
        ctx.partida.aplicarOrdenes();
      }
    }
    ctx.ejec = null; ctx.enVuelo = null; ctx.pausa = false; ctx.hitoDetiene = false;
  }

  return {
    algunoCorre, soloComentarios, revisar, ejecutar, arrancarPrograma, fmtLugar, registroActual,
    avanzar, cerrarProgramas
  };
}
