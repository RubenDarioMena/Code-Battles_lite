import { repetirIntento } from './repetir-intento.js';
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

  const runtime = ctx.batallasV2?.runtime;
  let ultimoIntento, opcionesAnfitrion, hitoEnEjecucion;
  function prepararPrograma(id, texto, lenguaje) {
    let err = null, codigo = texto;
    if (lenguaje === "python") {
      const r = ctx.CMGPythonJS.traducirCache(texto, ctx.opcionesPython());
      if (r.ok) codigo = r.js;
      else err = r.diagnosticos[0];
      if (r.ok && typeof ctx.acorn !== "undefined") {
        try { ctx.acorn.parse(r.js, { ecmaVersion: 2022, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true }); }
        catch (e) { err = { linea: e.loc ? e.loc.line : null, mensaje: "El traductor de Python no pudo con esta línea. Reescríbela de otra forma o avísanos." }; }
      }
    } else {
      err = ctx.ES_FACTORY ? null : revisar(texto);
    }
    // Pulsos en el editor (paquetes/app/juego/pulsos.js): JS con los ganchos del trazador; Python, por línea.
    if (!err && !ctx.ES_FACTORY && !ctx.ES_CAMPAIGN && ctx.CMGPulsos) {
      if (lenguaje === "python") ctx.CMGPulsos.python(id, texto);
      else codigo = ctx.CMGPulsos.preparar(id, texto);
    }
    return { fuente: texto, lenguaje, codigo: err ? "" : ctx.instrumentar(codigo), ...(err && { diagnostico: err }) };
  }

  function nombreEntrada(e) {
    if (e.verbo === 'clicProgramado') return e.args[0];
    if (e.verbo === 'intentoPuntual') return ctx.ti18n('cv2.puntual');
    return e.verbo ?? ctx.ti18n('cv2.aplicar');
  }

  function encolar(entrada) {
    if (!ctx.conductor?.encolar(entrada)) return;
    if (ctx.pausa) {
      const accion = nombreEntrada(entrada);
      ctx.consola("sistema", entrada.unidad, null, ctx.esc(ctx.ti18n('cv2.enCola', { accion })));
    } else avanzar();
  }

  function aplicarAhora() {
    if (ctx.edicion.ids.length !== 1) {
      ctx.avisoEditor(ctx.ti18n('cv2.unaUnidad'));
      return;
    }
    const id = ctx.progSel;
    encolar({ tipo: 'programa', unidad: id, ...prepararPrograma(id, ctx.textoDe(id), ctx.lenguajeDe(id)) });
  }

  function alAplicar(e, paso) {
    if (e.tipo === 'programa') {
      ctx.ejec.codigos[e.unidad] = e.fuente;
      ctx.ejec.lenguajes[e.unidad] = e.lenguaje;
      ctx.ejec.progs.get(e.unidad).finT = null;
      if (ctx.lineaErr?.id === e.unidad) ctx.lineaErr = null;
      ctx.lineaCorre[e.unidad] = null;
      ctx.marcasSucias = true;
    }
    if (e.verbo === 'colocar') {
      ctx.mundo = ctx.mundoPantalla(ctx.partida.mundo);
      ctx.invalidarEscena();
    }
    const accion = nombreEntrada(e);
    ctx.consola("sistema", e.unidad, null, ctx.esc(ctx.ti18n('cv2.aplicada', { accion, paso })));
  }

  async function repetirUltimo() {
    if (!ultimoIntento || ctx.ejec) return;
    const p = await repetirIntento(ultimoIntento.datos, ctx.reglas, ultimoIntento.opciones);
    const fin = p.evaluar()?.fin ?? (p.mundo.hito !== ultimoIntento.datos.escenario.hito ? 'victoria' : 'detenido');
    ctx.consola("sistema", null, null, ctx.esc(ctx.ti18n('cv2.repeticion', { paso: p.pasoActual, fin })));
    return p;
  }

  function alternarEjecucion() { return ctx.ejec && !runtime ? ctx.detener() : ejecutar(); }

  function ejecutar() {
    if (ctx.ejec && runtime) return aplicarAhora();
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
    const iniciales = {}, lenguajes = {}, fuentesTexto = {};
    for (const l of ctx.programablesDe(ctx.def)) {
      const lenguaje = ctx.lenguajeDe(l.id), texto = ctx.textoDe(l.id) || "";
      const programa = prepararPrograma(l.id, texto, lenguaje);
      iniciales[l.id] = programa;
      lenguajes[l.id] = lenguaje; fuentesTexto[l.id] = texto;
      const err = programa.diagnostico;
      if (err && !runtime) {
        ctx.abrirPrograma(l.id); ctx.lineaErr = { id: l.id, linea: err.linea }; ctx.marcasSucias = true;
        ctx.ultimoAviso[ctx.claveReto()] = { resultado: "sintaxis", motivo: "error", texto: err.mensaje, linea: err.linea, id: l.id, cuando: Date.now() };
        ctx.avisar("cmg:intento", { reto: ctx.retoIdx + 1, titulo: ctx.def.titulo, intento: ctx.intento + 1, resultado: "sintaxis", motivo: "error", mensaje: err.mensaje, linea: err.linea, programa: l.id, codigos: { ...fuentesTexto }, lenguajes: { ...lenguajes } });
        ctx.mostrarBanner("fallo", err.linea ? `Línea ${err.linea} de ${l.id}` : `Programa de ${l.id}`, ctx.esc(err.mensaje), null, [["Ir a la línea", "primario", () => { ctx.ocultarBanner(); ctx.irALinea(err.linea); }]]);
        return;
      }
    }
    ctx.intento++;
    if (!ctx.semillaFija) ctx.semilla = ctx.intento;
    if (ctx.checkpointsV2 && !ctx.semillaFija) {
      ctx.semilla = ctx.guardado.leer('intento-nivel-1', 0) + 1;
      ctx.guardado.escribir('intento-nivel-1', ctx.semilla);
    }
    // Campaign conserva la partida; cada ejecución tiene su propio anfitrión.
    if (ctx.ES_CAMPAIGN) { ctx.eventos = []; ctx.eventosSucios = true; ctx.hitoPendiente = null; ctx.hitoDetiene = false; }
    else ctx.nuevoMundo(ctx.intento, !!runtime);
    if (runtime?.crearVista3D) ctx.ponerPiel(true);
    ctx.finActual = null; ctx.desdeRegistro = 0; ctx.acum = 0; ctx.registrosPendientes.clear();
    if (ctx.ES_CAMPAIGN && ctx.anfitrion) { const c = ctx.anfitrion.registro().consolas; for (const n of ctx.NIVELES) ctx.consolasCampaign[n] += c[n]; }
    opcionesAnfitrion = { eventos: runtime?.eventos, erroresEvento: runtime && { tarde: ctx.ti18n("cv2.registroTarde"), funcion: ctx.ti18n("cv2.funcion") }, aislarErrores: runtime?.aislarErrores, reglas: ctx.reglasProgramas ?? ctx.reglas, pasoAPaso: !!ctx.__banco?.pasoAPaso, piezas: ctx.piezasTrabajador,
      crearTrabajador,
      contexto: { nombres: ctx.nombradas().map(e => e.id), tipos: Object.keys(ctx.TIPOS), sensores: Object.keys(ctx.SENSOR),
        conf: { fallaRafaga: ctx.LAU.fallaRafaga, cadencia: ctx.LAU.cadencia, cadenciaRafaga: ctx.LAU.cadenciaRafaga } } };
    ctx.anfitrion = ctx.crearAnfitrion(opcionesAnfitrion);
    ctx.limpiarConsola(); ctx.ocultarBanner(); ctx.cerrarAvisos();
    ctx.lineaCorre = {}; ctx.lineaErr = null; ctx.marcasSucias = true;
    ctx.ejec = { progs: new Map(), inicio: new Date().toISOString(), codigos: {}, lenguajes };
    for (const l of ctx.mundo.programables) cargarPreparado(l.id, iniciales[l.id]);
    // La planta sigue tras H5 (salva y suministro); su evaluación es un hito, no el fin del mundo vivo.
    let entregaInicial = true;
    const hitoInicial = hitoEnEjecucion = ctx.partida.mundo.hito;
    ctx.conductor = ctx.crearConductor({ reglas: ctx.reglas,
      intento: runtime && { programas: iniciales, semillaIntento: ctx.partida.mundo.semillaIntento, enPausa: () => ctx.pausa, alAplicar },
      partida: ctx.ES_CAMPAIGN ? Object.create(ctx.partida, { evaluar: { value: () => null } }) : ctx.partida, anfitrion: ctx.anfitrion,
      detener: () => ctx.hitoDetiene || (ctx.checkpointsV2 && ctx.partida.mundo.hito !== hitoInicial),
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
    cargarPreparado(id, { fuente: fuente ?? codigo, codigo: ctx.instrumentar(codigo), lenguaje: ctx.ejec.lenguajes[id] });
  }
  function cargarPreparado(id, programa) {
    ctx.ejec.progs.set(id, { id, finT: null });
    ctx.ejec.codigos[id] = programa.fuente;
    // cargar crea la unidad inmediatamente; el conductor lo arranca al ceder.
    ctx.anfitrion.cargar(id, programa.codigo, programa);
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
      if (m.type === "errorUnidad") {
        ctx.lineaCorre[id] = null;
        mostrarError(id, m.mensaje, m.linea);
        continue;
      }
      if (m.type === "oyente") ctx.consola("sistema", id, m.linea, ctx.esc(ctx.ti18n("cv2.escucha", { evento: m.evento })));
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
      else if (s.tipo === "colocar-descartada") ctx.avisoSistema(ctx.ti18n("cv2.colocar." + d.motivo));
      else if (s.tipo === "puntual-descartada") ctx.consola("warn", s.unidad, null, ctx.esc(ctx.ti18n("cv2.descarte." + d.motivo)));
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
      } else if (ctx.checkpointsV2 && ctx.partida.mundo.hito !== hitoEnEjecucion) {
        const m = ctx.partida.mundo;
        ctx.checkpointsV2.guardar(m, { programas: { ...m.programas, ...ctx.programas }, fuentes: ctx.fuentes, vinculos: ctx.vinculos.datos });
        // La etapa siguiente espera tras la tarjeta de transición: se para aquí y arranca al continuar.
        // Sin Batalla montada viene un hito de fábrica, que se juega en su propia sesión: se recarga la página.
        const seguir = () => m.batalla ? ctx.elegirReto(ctx.batallasV2.batallas.indexOf(m.hito)) : location.reload();
        cerrarProgramas();
        if (ctx.batallasV2.anunciarHito) ctx.batallasV2.anunciarHito(ctx, m, seguir); else seguir();
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
    mostrarError(p.id, mensaje, linea);
    ctx.terminar("error", "error", mensaje, linea, p.id);
  }
  function mostrarError(id, mensaje, linea) {
    ctx.lineaErr = { id, linea }; ctx.marcasSucias = true;
    ctx.consola("error", id, linea, ctx.htmlInterfaz(ctx.esc(mensaje)));
  }

  function cerrarProgramas() {
    if (ctx.ejec) {
      if (runtime) ultimoIntento = { datos: ctx.partida.serializar(), opciones: opcionesAnfitrion };
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
    runtime, encolar, alternarEjecucion, repetirUltimo,
    get puedeRepetir() { return !!runtime?.repetir && !!ultimoIntento && !ctx.ejec; },
    get edicionBloqueada() { return !!ctx.ejec && (!runtime || ctx.edicion.ids.length !== 1); },
    algunoCorre, soloComentarios, revisar, ejecutar, arrancarPrograma, fmtLugar, registroActual,
    avanzar, cerrarProgramas
  };
}
